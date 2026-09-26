const API_URL = "http://127.0.0.1:8000/scan";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "SCAN_PROMPT") return;

  if (
    typeof message.text !== "string" ||
    message.text.length > 100_000
  ) {
    sendResponse({ ok: false });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  (async () => {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: message.text }),
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        redirect: "error"
      });

      if (!response.ok) {
        throw new Error("Scan request failed");
      }

      const result = await response.json();

      sendResponse({
        ok: true,
        result
      });
    } catch {
      sendResponse({ ok: false });
    } finally {
      clearTimeout(timeout);
    }
  })();

  return true;
});