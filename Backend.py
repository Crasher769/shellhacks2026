import re
from flask import Flask, jsonify, request

app = Flask(__name__)

#Modules included: Phone number, Email, Social Security Number, IP address, Username

@app.route('/scan', methods=['POST'])
def scan():
    data = request.get_json()
    if not isinstance(data, dict) or not isinstance(data.get("text"), str):
        return jsonify({"error": "Provide a JSON object with a text string."}), 400

    # Check the prompt itself. All results belong to this request only.
    doc = data["text"]
    words = doc.split()
    email = []
    username = []
    phone = []

    # Phone number
    phone_pattern = r'\b\d{3}-\d{3}-\d{4}\b'
    phone_c = re.findall(phone_pattern, doc)
    phone.extend(phone_c)
    phone_c.clear()
    parenthesized_phone_pattern = r'\(\b\d{3}\)-\d{3}-\d{4}\b'
    phone.extend(re.findall(parenthesized_phone_pattern, doc))

    # Email
    for word in words:
        if '@' in word and '.' in word:
            email.append(word)

    # Social Security Number (SSN)
    ssn_pattern = r'\b\d{3}-\d{2}-\d{4}\b'
    ssn = re.findall(ssn_pattern, doc)

    # IP address
    ip_pattern = r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"
    ip = re.findall(ip_pattern, doc)

    # Username
    for word in words:
        if word.startswith('@'):
            username.append(word)

    # Record original positions using the same regexes and detected whole words.
    # Return only metadata; the frontend already has the original prompt.
    findings = []
    regex_checks = (   #dude plz check this, I don't know regex much
        ("phone", phone_pattern, phone),
        ("phone", parenthesized_phone_pattern, phone),
        ("ssn", ssn_pattern, ssn),
        ("ip", ip_pattern, ip),
    )
    for kind, pattern, detected in regex_checks:
        if detected:
            for match in re.finditer(pattern, doc):
                findings.append({"type": kind, "start": match.start(), "end": match.end()})

    token_checks = (
        ("email", set(email)),
        ("username", set(username)),
    )
    for match in re.finditer(r"\S+", doc):
        for kind, detected in token_checks:
            if match.group() in detected:
                findings.append({"type": kind, "start": match.start(), "end": match.end()})
    findings.sort(key=lambda finding: (finding["start"], finding["end"], finding["type"]))

    # Combine overlaps (e.g. a token detected as both email and username).
    spans = []
    for finding in findings:
        start, end = finding["start"], finding["end"]
        if spans and start < spans[-1][1]:
            spans[-1][1] = max(spans[-1][1], end)
        else:
            spans.append([start, end])

    # Work backwards so replacements cannot shift the remaining positions.
    sanitized_text = doc
    for start, end in reversed(spans):
        sanitized_text = sanitized_text[:start] + "[REDACTED]" + sanitized_text[end:]

    response_obj = {
        "sensitive": bool(findings),
        "findings": findings,
        "sanitizedText": sanitized_text,
    }
    return jsonify(response_obj)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000)
