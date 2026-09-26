chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "SCAN_PROMPT" || typeof message.text !== "string") {
    return;
    }

  fetch("http://127.0.0.1:8000/scan",
    {
    method: "POST",
    headers: {
            "Content-Type": "application/json"
        },
    body: JSON.stringify({ text: message.text
        })
    })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Scan failed: ${response.status
        }`);
      return response.json();
    })
    .then((result) => sendResponse({ ok: true, result
    }))
    .catch((error) => sendResponse({ ok: false, error: error.message
    }));

  return true; // Keep the message channel open for the async fetch.
});