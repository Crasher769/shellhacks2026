/*
 * Privacy Scanner — content script for a Manifest V3 Chrome extension.
 * Load at document_start on https://chatgpt.com/* in the isolated world. *
 * Requires background.js to receive { type: "SCAN_PROMPT", text }, POST
 * { text } to your local Python /scan endpoint, and reply with:
 *   { ok: true, result: { sensitive: boolean, findings: [...], sanitizedText: string } }
 * or { ok: false } on failure.
 *
 * Findings: { type: "email", start: 12, end: 28 }. Offsets MUST count Unicode
 * code points (Python string indices), zero-based, end exclusive. We use
 * Array.from(text) below so emoji do not shift the displayed findings.
 *
 * No prompt logging, persistent storage, or third-party API calls here.
 * Text drafts only: attachments, voice, image text, and other send paths are
 * not covered. DOM selectors below are integration assumptions: test them
 * against your ChatGPT page. This is not a network-level privacy boundary.
 */
(function () {
  "use strict";

  // Avoid duplicate listeners if the same content script is injected twice.
  if (globalThis.__privacyScannerInstalled) return;
  globalThis.__privacyScannerInstalled = true;

  // Current ChatGPT can use a ProseMirror <div> without an ID.
  // Match its structural attributes, without relying on a localized aria-label.
  const EDITOR_SELECTOR = [
    '.ProseMirror[contenteditable="true"][role="textbox"][data-composer-markdown]',
    '#prompt-textarea[contenteditable="true"]',
    'textarea#prompt-textarea'
  ].join(',');
  const SEND_SELECTOR = [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send message"]'
  ].join(',');
  const MAX_TEXT_LENGTH = 100000;
  const SCAN_TIMEOUT_MS = 12000;

  let session = null;
  let replay = null;

  function getEditor() {
    // Skip hidden copies of the composer, such as a previous page's editor.
    return [...document.querySelectorAll(EDITOR_SELECTOR)].find(element => element.getClientRects().length > 0 &&
      (element instanceof HTMLTextAreaElement || element.isContentEditable)
    ) || null;
  }

  function getText(editor) {
    // A contenteditable div has no .value. innerText includes its paragraphs
    // and line breaks. data-placeholder is an attribute, not prompt text.
    return editor instanceof HTMLTextAreaElement
      ? editor.value : editor.innerText;
  }

  function getSendButton(editor) {
    const scope = editor.closest('form') || document;
    return [...scope.querySelectorAll(SEND_SELECTOR)]
      .find(function (button) {
        return button.getClientRects().length;
      }) || null;
  }

  function isCurrent(snapshot) {
    return snapshot.editor.isConnected &&
      getEditor() === snapshot.editor &&
      location.href === snapshot.url &&
      getText(snapshot.editor) === snapshot.text;
  }

  // Use textContent for all text from the draft or backend: never insert it as HTML.
  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function closeSession(current, focusEditor = true) {
    if (session !== current) return;
    session = null; // Any late response from this scan is now ignored.
    current.dialog.close();
    current.host.remove();
    if (focusEditor && current.editor.isConnected) current.editor.focus();
  }

  function action(current, label, callback) {
    const button = element('button', label);
    button.type = 'button';
    button.addEventListener('click', callback);
    current.actions.append(button);
    return button;
  }

  function createDialog(current) {
    const host = element('div');
    host.id = 'privacy-scanner-ui';
    const root = host.attachShadow({ mode: 'closed' });
    // Load the extension stylesheet inside the shadow root to keep it scoped.
    const style = element('link');
    style.rel = 'stylesheet';
    style.href = chrome.runtime.getURL('style.css');
    const dialog = element('dialog');
    const title = element('h2', 'Checking your prompt…');
    title.id = 'scanner-title';
    dialog.setAttribute('aria-labelledby', title.id);
    const description = element('p', 'Your draft is paused while the local scanner checks it.');
    const details = element('div');
    const status = element('p');
    status.className = 'status';
    status.setAttribute('role', 'status');
    const actions = element('div');
    actions.className = 'actions';
    dialog.append(title, description, details, status, actions);
    root.append(style, dialog);
    Object.assign(current, { host, dialog, title, description, details, status, actions });
    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeSession(current);
    });
    action(current, 'Back to edit', function () {
      return closeSession(current);
    });
    document.documentElement.append(host);
    dialog.showModal();
  }

  function showError(current, message) {
    if (session !== current) return;
    current.title.textContent = 'Prompt kept in the editor';
    current.description.textContent = message;
    current.details.replaceChildren();
    current.status.textContent = '';
    current.actions.replaceChildren();
    action(current, 'Back to edit', function () {
      return closeSession(current);
    }).focus();
  }

  async function scanText(text) {
    let timer;
    try {
      const response = await Promise.race([
        chrome.runtime.sendMessage({ type: 'SCAN_PROMPT', text }),
        new Promise(function (_, reject) {
          timer = setTimeout(function () {
            return reject(new Error('Scanner timed out.'));
          }, SCAN_TIMEOUT_MS);
        })
      ]);
      if (response?.ok !== true) throw new Error('Scanner unavailable.');
      return validateResult(response.result, text);
    } finally {
      clearTimeout(timer);
    }
  }

  function validateResult(result, text) {
    const length = Array.from(text).length;
    if (!result || typeof result.sensitive !== 'boolean' ||
      !Array.isArray(result.findings) || result.findings.length > 500 ||
      typeof result.sanitizedText !== 'string' ||
      result.sanitizedText.length > MAX_TEXT_LENGTH ||
      result.sensitive !== (result.findings.length > 0)) {
      throw new Error('Invalid scanner response.');
    }
    for (const finding of result.findings) {
      if (!finding || typeof finding.type !== 'string' || !finding.type ||
        finding.type.length > 80 || !Number.isInteger(finding.start) ||
        !Number.isInteger(finding.end) || finding.start < 0 ||
        finding.end <= finding.start || finding.end > length) {
        throw new Error('Invalid scanner findings.');
      }
    }
    return result;
  }

  // Permit only the synchronous replay of this exact reviewed draft.
  // This handles the replayed click and any native submit it triggers.
  function sendReviewed(current) {
    if (session !== current) return;
    if (!isCurrent(current)) {
      showError(current, 'The draft or conversation changed. Return to the editor and send again to rescan.');
      return;
    }
    const button = getSendButton(current.editor);
    const form = current.editor.closest('form');
    if (button && (button.disabled || button.getAttribute('aria-disabled') === 'true')) {
      showError(current, 'The page’s Send button is unavailable. Return to the editor and try again.');
      return;
    }
    if (!button && !form) {
      showError(current, 'Could not find the page’s send control. Check the selectors in scanner.js.');
      return;
    }
    closeSession(current, false);
    replay = current;
    try {
      if (button) button.click();
      else form.requestSubmit();
    } finally {
      replay = null;
    }
  }

  function showFindings(current, result) {
    current.title.textContent = 'Personal information detected';
    current.description.textContent = 'Review these items before sharing your prompt.';
    current.details.replaceChildren();
    const list = element('ul');
    const characters = Array.from(current.text);
    for (const finding of result.findings) {
      list.append(element('li', `${finding.type}: ${characters.slice(finding.start, finding.end).join('')}`));
    }
    const label = element('label', 'Suggested sanitized prompt');
    label.htmlFor = 'sanitized-preview';
    const preview = element('textarea');
    preview.id = label.htmlFor;
    preview.value = result.sanitizedText;
    preview.readOnly = true;
    current.details.append(list, label, preview);
    current.status.textContent = 'Copy this version, then paste it into the prompt box. It will be checked again when you send.';
    current.actions.replaceChildren();
    action(current, 'Back to edit', function () {
      return closeSession(current);
    });
    action(current, 'Copy sanitized', async function () {
      try {
        await navigator.clipboard.writeText(result.sanitizedText);
        if (session === current) current.status.textContent = 'Copied. Choose Back to edit, select your original draft, and paste.';
      } catch {
        preview.focus();
        preview.select();
        current.status.textContent = 'Automatic copy was unavailable. Copy the selected text manually.';
      }
    });
    action(current, 'Send original anyway', function () {
      return sendReviewed(current);
    });
    current.actions.querySelector('button').focus();
  }

  async function beginScan(editor) {
    const current = { editor, text: getText(editor), url: location.href };
    session = current;
    createDialog(current);
    if (current.text.length > MAX_TEXT_LENGTH) {
      showError(current, 'This draft is too long for this prototype. Shorten it before scanning.');
      return;
    }
    try {
      const result = await scanText(current.text);
      if (session !== current) return; // Canceled scan: ignore its response.
      if (!isCurrent(current)) {
        showError(current, 'The draft or conversation changed during scanning. Return to the editor and send again.');
      } else if (result.sensitive) {
        showFindings(current, result);
      } else {
        sendReviewed(current);
      }
    } catch {
      showError(current, 'Could not check this prompt. Confirm the Python server and background script are running, then try again.');
    }
  }

  function intercept(event, editor) {
    if (replay && replay.editor === editor && isCurrent(replay)) return;
    // MUST happen synchronously, before any await or network request.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (session || event.repeat || !getText(editor).trim()) return;
    void beginScan(editor);
  }

  // Delegated listeners survive editor replacement and single-page navigation.
  // Window capture runs before document and element listeners registered later.
  window.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    const editor = getEditor();
    if (editor && event.target instanceof Node && editor.contains(event.target)) {
      intercept(event, editor);
    }
  }, true);

  window.addEventListener('click', function (event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest(SEND_SELECTOR);
    const editor = getEditor();
    if (editor && button && button === getSendButton(editor)) intercept(event, editor);
  }, true);

  window.addEventListener('submit', function (event) {
    const editor = getEditor();
    if (editor && event.target === editor.closest('form')) intercept(event, editor);
  }, true);
})();
