// IMPORT API FOR LATER FOR DOING READYING



const SENSITIVE_PATTERNS = [
    /\b\d{3}-\d{2}-\d{4}\b/,   // SSN
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // email
    /\b\d{10,}\b/             // long numbers
];

async function scanText(text) {
    const response = await chrome.runtime.sendMessage({
        type: "SCAN_PROMPT",
        text
    });

    if (!response?.ok) {
        throw new Error(response?.error || "Scanner unavailable");
    }

    return response.result;
}

function attachToTextarea(textarea) {
    if (!textarea.dataset.privacyScannerBound) {
        textarea.dataset.privacyScannerBound = "true";

        const form = textarea.closest("form");
        if (form) {
            form.addEventListener("submit", (event) => {
                const value = textarea.value || "";
                if (scanText(value)) {
                    event.preventDefault();
                    event.stopPropagation();
                    alert("Message blocked: sensitive content detected.");
                }
            }, true);
        }
    }
}

function scanExistingTextareas() {
    document.querySelectorAll("textarea").forEach(attachToTextarea);
}

scanExistingTextareas();

const observer = new MutationObserver(() => {
    scanExistingTextareas();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});