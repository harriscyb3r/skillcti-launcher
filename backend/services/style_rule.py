import json
import re

STYLE_RULE = (
    "Output style (mandatory): Do not use em dashes (Unicode U+2014, "
    "the long dash character) or en dashes (U+2013, the medium dash "
    "character) anywhere in the output. Em dashes are a strong signal "
    "that text is AI-generated; their absence makes the output look more "
    "human-written. Substitute a period, comma, parentheses, colon, or "
    "semicolon instead. This applies to prose, table cells, headings, "
    "captions, footers, alt text, code comments, JSON description "
    "fields, badge labels, everything. Before producing the final "
    "output, search for U+2014 and U+2013 and rewrite any occurrences. "
    "Reserve triple-hyphen sequences for horizontal-rule separators in "
    "markdown only. "
    "Output format (mandatory): Begin your response with the first "
    "character of the deliverable itself — no preamble, no "
    "acknowledgement, no 'Here is the report', no 'Let me generate', "
    "no narration of what you are about to do. For Markdown reports start "
    "with the opening --- of the front matter. For HTML output start "
    "with <!DOCTYPE html> or <html. For JSON output start with {. "
    "For plain text start with the first word of the content."
)


_CSP_META = (
    '<meta http-equiv="Content-Security-Policy" '
    'content="default-src \'self\' \'unsafe-inline\'; connect-src \'none\';">'
)


def inject_report_csp(html: str) -> str:
    """Insert a CSP <meta> tag into a report's <head> so outbound fetch is blocked
    even if the iframe sandbox attribute is somehow absent."""
    if _CSP_META in html:
        return html
    # Insert after the opening <head> tag
    patched = re.sub(r'(<head[^>]*>)', r'\1\n  ' + _CSP_META, html, count=1, flags=re.IGNORECASE)
    if patched == html:
        # No <head> found — prepend to document
        patched = _CSP_META + "\n" + html
    return patched


def inject_style_rule(body: bytes) -> bytes:
    """Prepend STYLE_RULE to the system field of an Anthropic /v1/messages body."""
    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        return body
    if not isinstance(payload, dict):
        return body
    existing = payload.get("system")
    if existing is None:
        payload["system"] = STYLE_RULE
    elif isinstance(existing, str):
        payload["system"] = STYLE_RULE + "\n\n" + existing
    elif isinstance(existing, list):
        payload["system"] = [{"type": "text", "text": STYLE_RULE}] + existing
    else:
        return body
    return json.dumps(payload).encode("utf-8")
