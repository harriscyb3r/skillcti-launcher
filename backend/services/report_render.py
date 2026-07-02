"""Server-side report renderer.

The model outputs compact structured markdown (see MD_REPORT_FORMAT in
format_blocks.py); this module renders it into the fixed SkillCTI report
templates — the dark editorial theme for on-screen HTML and the white
consulting-brief theme for PDF export. Keeping the CSS/JS/markup here instead
of having the model regenerate it on every report cuts output tokens 30-50%.

No third-party dependencies: the markdown dialect is constrained by the
prompt, so a purpose-built converter is more predictable than a full parser.

Supported markdown subset:
  - front matter (--- title/subtitle/tlp/audience/date ---)
  - ## / ### / #### headings, paragraphs, --- horizontal rules
  - **bold**, *italic*, `code`, [text](url) links
  - - / * unordered and 1. ordered lists (one nesting level via indent)
  - GitHub-style tables
  - ``` fenced code blocks (language tag preserved as a class)
  - > blockquotes
  - ::: stats blocks ("VALUE | LABEL" lines)
  - ::: callout <title> blocks (inner content is markdown)
  - [[CRITICAL]] / [[HIGH]] / [[MEDIUM]] / [[LOW]] severity pills
  - [n] / [n,m] citation markers -> superscript anchors to #ref-N
  - "## References" + numbered list -> <ol class="references"> with ids
"""
from __future__ import annotations

import html as _h
import re
from datetime import datetime

# ─── Detection helpers ────────────────────────────────────────────────────────


def looks_like_html(text: str) -> bool:
    """True when the model returned a legacy full-HTML document."""
    head = text.lstrip()
    if head.startswith("```") and "\n" in head:
        head = head[head.find("\n") + 1:].lstrip()
    head = head[:300].lower()
    return head.startswith("<!doctype") or head.startswith("<html")


def unwrap_outer_fence(text: str) -> str:
    """Strip a single ``` fence wrapping the whole document, keeping inner fences."""
    t = text.strip()
    if not t.startswith("```"):
        return t
    first_nl = t.find("\n")
    if first_nl == -1 or not t.endswith("```"):
        return t
    return t[first_nl + 1: len(t) - 3].strip()


# ─── Front matter ─────────────────────────────────────────────────────────────

_FM_RE = re.compile(r"^\s*---\s*\n(.*?)\n---\s*\n?", re.DOTALL)


def parse_front_matter(text: str) -> tuple[dict, str]:
    m = _FM_RE.match(text)
    if not m:
        return {}, text
    meta: dict = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip().lower()] = v.strip()
    return meta, text[m.end():]


# ─── Inline formatting ────────────────────────────────────────────────────────

_SEV_CLASSES = {
    "CRITICAL": "sev-crit",
    "HIGH": "sev-high",
    "MEDIUM": "sev-med",
    "MED": "sev-med",
    "LOW": "sev-low",
}

_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")
_BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
_ITALIC_RE = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")
_PILL_RE = re.compile(r"\[\[([A-Za-z0-9 :+.\-]{2,24})\]\]")
_CITE_RE = re.compile(r"\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]")
_CODESPAN_RE = re.compile(r"`([^`]+)`")
_URL_RE = re.compile(r"(https?://[^\s<>\"]+[^\s<>\".,;:)])")


def _pill_sub(m: re.Match) -> str:
    label = m.group(1).strip()
    cls = _SEV_CLASSES.get(label.upper(), "")
    cls = f" {cls}" if cls else ""
    return f'<span class="pill{cls}">{label}</span>'


def _cite_sub(m: re.Match) -> str:
    nums = [n.strip() for n in m.group(1).split(",")]
    inner = ",".join(f'<a href="#ref-{n}">{n}</a>' for n in nums)
    return f'<sup class="cite">[{inner}]</sup>'


def _inline(text: str, cite: bool = True) -> str:
    """Escape + convert inline markdown in one text run."""
    text = _h.escape(text, quote=False)

    # Protect code spans from further transforms
    codes: list[str] = []

    def _stash(m: re.Match) -> str:
        codes.append(m.group(1))
        return f"\x00{len(codes) - 1}\x00"

    text = _CODESPAN_RE.sub(_stash, text)
    text = _LINK_RE.sub(r'<a href="\2" target="_blank" rel="noopener">\1</a>', text)
    text = _BOLD_RE.sub(r"<strong>\1</strong>", text)
    text = _ITALIC_RE.sub(r"<em>\1</em>", text)
    text = _PILL_RE.sub(_pill_sub, text)
    if cite:
        text = _CITE_RE.sub(_cite_sub, text)
    text = re.sub(r"\x00(\d+)\x00", lambda m: f"<code>{codes[int(m.group(1))]}</code>", text)
    return text


# ─── Block-level conversion ───────────────────────────────────────────────────

_HEADING_RE = re.compile(r"^(#{1,4})\s+(.*)$")
_LIST_ITEM_RE = re.compile(r"^(\s*)(?:[-*]|(\d{1,3})\.)\s+(.*)$")
_TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-{2,}.*\|")
_REFS_HEADING_RE = re.compile(r"references\s*$", re.IGNORECASE)


def _render_stats(lines: list[str]) -> str:
    cells = []
    for raw in lines:
        s = raw.strip()
        if not s:
            continue
        value, _, label = s.partition("|")
        cells.append(
            '<div class="stat">'
            f'<div class="value">{_inline(value.strip())}</div>'
            f'<div class="label">{_inline(label.strip())}</div>'
            "</div>"
        )
    return f'<div class="stats">{"".join(cells)}</div>'


def _render_table(rows: list[str]) -> str:
    def _cells(row: str) -> list[str]:
        return [c.strip() for c in row.strip().strip("|").split("|")]

    header = _cells(rows[0])
    body = rows[2:] if len(rows) > 2 else []
    out = ["<table><thead><tr>"]
    out += [f"<th>{_inline(c)}</th>" for c in header]
    out.append("</tr></thead><tbody>")
    for row in body:
        out.append("<tr>" + "".join(f"<td>{_inline(c)}</td>" for c in _cells(row)) + "</tr>")
    out.append("</tbody></table>")
    return "".join(out)


def _render_list(items: list[tuple[int, str | None, str]], references: bool = False) -> str:
    """items: (indent, ordered_number_or_None, text). One nesting level supported."""
    if not items:
        return ""
    ordered = items[0][1] is not None
    if references:
        out = ['<ol class="references">']
        for n, (_, num, text) in enumerate(items, start=1):
            ref_n = num or str(n)
            body = _inline(text, cite=False)
            body = _URL_RE.sub(
                lambda m: f'<a href="{m.group(1)}" target="_blank" rel="noopener">'
                          f'{re.sub(r"^https?://", "", m.group(1))}</a>',
                body,
            )
            out.append(f'<li id="ref-{ref_n}">{body}</li>')
        out.append("</ol>")
        return "".join(out)

    base_indent = items[0][0]
    tag = "ol" if ordered else "ul"
    out = [f"<{tag}>"]
    i = 0
    while i < len(items):
        indent, _num, text = items[i]
        if indent > base_indent:
            # collect the nested run
            j = i
            while j < len(items) and items[j][0] > base_indent:
                j += 1
            nested = _render_list(items[i:j])
            # attach to the previous <li>
            if out[-1].endswith("</li>"):
                out[-1] = out[-1][:-5] + nested + "</li>"
            else:
                out.append(f"<li>{nested}</li>")
            i = j
            continue
        out.append(f"<li>{_inline(text)}</li>")
        i += 1
    out.append(f"</{tag}>")
    return "".join(out)


def md_to_html(body: str, _depth: int = 0) -> str:
    lines = body.splitlines()
    out: list[str] = []
    n = len(lines)
    i = 0
    refs_pending = False  # next ordered list renders as the references list

    while i < n:
        line = lines[i]
        s = line.strip()

        if not s:
            i += 1
            continue

        # Fenced code block
        if s.startswith("```"):
            lang = s[3:].strip()
            i += 1
            buf = []
            while i < n and not lines[i].strip().startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1  # closing fence
            cls = f' class="lang-{_h.escape(lang)}"' if lang else ""
            out.append(f"<pre><code{cls}>{_h.escape(chr(10).join(buf))}</code></pre>")
            continue

        # ::: stats / ::: callout blocks
        if s.startswith(":::"):
            head = s[3:].strip()
            i += 1
            buf = []
            while i < n and lines[i].strip() != ":::":
                buf.append(lines[i])
                i += 1
            i += 1  # closing :::
            if head.lower().startswith("stats"):
                out.append(_render_stats(buf))
            else:
                title = re.sub(r"^callout\s*", "", head, flags=re.IGNORECASE).strip()
                inner = md_to_html("\n".join(buf), _depth + 1) if _depth < 2 else _inline(" ".join(buf))
                title_html = f'<div class="callout-title">{_inline(title)}</div>' if title else ""
                out.append(f'<div class="callout">{title_html}{inner}</div>')
            continue

        # Heading
        m = _HEADING_RE.match(s)
        if m:
            level = max(2, len(m.group(1)))  # the H1 comes from front matter
            text = m.group(2).strip()
            if _REFS_HEADING_RE.search(text):
                refs_pending = True
            anchor = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]
            out.append(f'<h{level} id="{anchor}">{_inline(text, cite=False)}</h{level}>')
            i += 1
            continue

        # Horizontal rule
        if s in ("---", "***", "___"):
            out.append("<hr>")
            i += 1
            continue

        # Blockquote
        if s.startswith("> "):
            buf = []
            while i < n and lines[i].strip().startswith("> "):
                buf.append(lines[i].strip()[2:])
                i += 1
            out.append(f"<blockquote><p>{_inline(' '.join(buf))}</p></blockquote>")
            continue

        # Table
        if "|" in s and i + 1 < n and _TABLE_SEP_RE.match(lines[i + 1] or ""):
            rows = []
            while i < n and "|" in lines[i]:
                rows.append(lines[i])
                i += 1
            out.append(_render_table(rows))
            continue

        # List
        lm = _LIST_ITEM_RE.match(line)
        if lm:
            items: list[tuple[int, str | None, str]] = []
            while i < n:
                lm2 = _LIST_ITEM_RE.match(lines[i])
                if lm2:
                    items.append((len(lm2.group(1)), lm2.group(2), lm2.group(3)))
                    i += 1
                elif lines[i].strip() and lines[i].startswith((" ", "\t")) and items:
                    # continuation line of the previous item
                    indent, num, text = items[-1]
                    items[-1] = (indent, num, text + " " + lines[i].strip())
                    i += 1
                else:
                    break
            out.append(_render_list(items, references=refs_pending and items[0][1] is not None))
            if refs_pending and items[0][1] is not None:
                refs_pending = False
            continue

        # Paragraph — accumulate until a blank line or a special block
        buf = [s]
        i += 1
        while i < n:
            nxt = lines[i].strip()
            if (not nxt or nxt.startswith(("#", "```", ":::", "> ", "---"))
                    or _LIST_ITEM_RE.match(lines[i])
                    or ("|" in nxt and i + 1 < n and _TABLE_SEP_RE.match(lines[i + 1] or ""))):
                break
            buf.append(nxt)
            i += 1
        out.append(f"<p>{_inline(' '.join(buf))}</p>")

    return "\n".join(out)


# ─── Templates ────────────────────────────────────────────────────────────────

_PRESENT_JS = """
function togglePresent(){
  const on = document.body.classList.toggle('present-mode');
  if (on && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(()=>{});
  } else if (!on && document.fullscreenElement) {
    document.exitFullscreen();
  }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.classList.contains('present-mode')) {
    document.body.classList.remove('present-mode');
    if (document.fullscreenElement) document.exitFullscreen();
  }
});
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('present-mode');
});
"""

_DARK_CSS = """
:root{
  --bg:#0d1014;--surface:#14181f;--raised:#1a1f28;--text:#e8eaed;--text-2:#9aa0a6;
  --text-3:#5f6368;--border:#232831;--rule:#2a3038;--accent:#93c5fd;--link:#93c5fd;
  --cite:#fca5a5;--sev-crit:#f87171;--sev-high:#fb923c;--sev-med:#fbbf24;--sev-low:#34d399;
}
*{box-sizing:border-box}
body{font-family:'Inter',-apple-system,'Segoe UI',system-ui,sans-serif;font-size:14px;
  line-height:1.6;color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased;
  max-width:880px;margin:0 auto;padding:32px 40px}
h1{font-size:22px;font-weight:700;letter-spacing:-0.01em;line-height:1.25;margin:8px 0 6px}
h2{font-size:17px;font-weight:700;letter-spacing:-0.005em;margin-top:32px;padding-top:18px;
  border-top:1px solid var(--rule)}
h3{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.10em;
  color:var(--text-2);margin-top:20px}
h4{font-size:13px;font-weight:600;margin-top:16px}
p{margin:10px 0}
a{color:var(--link);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}
hr{border:0;border-top:1px solid var(--rule);margin:32px 0}
.subtitle{color:var(--text-2);margin:0 0 4px}
.meta-strip{display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:11px;
  color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:18px}
.pill{display:inline-block;border:1px solid var(--border);color:var(--text-2);font-size:10px;
  font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding:2px 8px;
  border-radius:3px;background:transparent}
.pill.sev-crit{border-color:var(--sev-crit);color:var(--sev-crit)}
.pill.sev-high{border-color:var(--sev-high);color:var(--sev-high)}
.pill.sev-med{border-color:var(--sev-med);color:var(--sev-med)}
.pill.sev-low{border-color:var(--sev-low);color:var(--sev-low)}
.pill.tlp{border-color:#fb923c;color:#fb923c}
table{border-collapse:collapse;width:100%;margin:14px 0}
th{font-size:10px;text-transform:uppercase;font-weight:600;color:var(--text-2);text-align:left;
  border-bottom:1px solid var(--rule);padding:10px 12px}
td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top}
tbody tr:hover{background:var(--surface)}
pre{background:var(--surface);border:1px solid var(--border);border-radius:4px;
  padding:12px 14px;font-size:12.5px;overflow-x:auto}
code,pre,sup.cite{font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace}
code{font-size:12.5px}
p code,li code,td code{background:var(--surface);border:1px solid var(--border);
  border-radius:3px;padding:1px 5px}
sup.cite a{color:var(--cite);text-decoration:none;font-weight:700}
.stats{display:flex;flex-wrap:wrap;margin:22px 0}
.stat{padding:0 32px;border-left:1px solid var(--border)}
.stat:first-child{border-left:0;padding-left:0}
.stat .value{font-size:32px;font-weight:700;color:var(--text);line-height:1.2}
.stat .label{font-size:10px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--text-3);margin-top:4px}
.callout{border:1px solid var(--border);border-radius:6px;padding:18px 20px;
  background:var(--surface);margin:22px 0}
.callout-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.10em;
  color:var(--accent);margin-bottom:8px}
ol.references{font-size:12.5px;color:var(--text-2);padding-left:22px}
ol.references li{margin:6px 0}
blockquote{border-left:2px solid var(--rule);margin:14px 0;padding:2px 16px;color:var(--text-2)}
ul,ol{margin:10px 0;padding-left:24px}
li{margin:4px 0}
#presentBtn{position:fixed;top:14px;right:14px;z-index:1000;
  background:var(--surface);border:1px solid var(--border);
  color:var(--text-2);font-family:inherit;font-size:10px;font-weight:700;
  letter-spacing:.1em;padding:7px 12px;border-radius:5px;cursor:pointer;
  transition:color .2s,border-color .2s,background .2s}
#presentBtn:hover{color:var(--accent);border-color:var(--accent);background:var(--raised)}
body.present-mode{font-size:18px;line-height:1.7;padding:50px 80px;max-width:1100px}
body.present-mode h1{font-size:34px;line-height:1.2;margin-bottom:24px}
body.present-mode h2{font-size:24px;margin-top:48px;padding-top:24px}
body.present-mode h3{font-size:13px;margin-top:24px}
body.present-mode #presentBtn,
body.present-mode .meta-strip{display:none}
body.present-mode .stat .value{font-size:42px}
body.present-mode pre,body.present-mode code{font-size:14px}
body.present-mode table{font-size:15px}
body.present-mode .references{font-size:13px;opacity:.85}
"""

_PDF_CSS = """
@page{size:A4;margin:20mm 20mm 20mm 16mm}
*{box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,'Segoe UI',sans-serif;font-size:10pt;line-height:1.45;
  color:#1a1a1a;background:#fff;max-width:100%;overflow-x:hidden;margin:0;orphans:3;widows:3}
h1{font-size:24pt;font-weight:700;margin:0 0 6pt;color:#1a1a1a}
h2{font-size:14pt;font-weight:700;color:#1a1a1a;margin-top:18pt;
  page-break-after:avoid;page-break-inside:avoid}
h3{font-size:11pt;font-weight:700;color:#1e40af;margin-top:12pt;page-break-after:avoid}
h4{font-size:10pt;font-weight:700;margin-top:10pt}
p{margin:6pt 0}
a{color:#1e40af;text-decoration:underline}
hr{border:0;border-top:.5pt solid #d4d4d8;margin:10pt 0}
.title-block{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12pt}
.tb-left{flex:1 1 60%}
.tb-right{max-width:25%;text-align:right}
.subtitle{font-size:10pt;color:#6b7280;margin:4pt 0 0}
.tlp-pill{display:inline-block;color:#ea580c;border:1pt solid #ea580c;background:#fff;
  padding:4px 10px;font-weight:700;text-transform:uppercase;font-size:9pt}
.audience{font-size:9pt;color:#6b7280;text-transform:uppercase;margin-top:6pt}
.title-rule{border:0;border-top:1pt solid #1a1a1a;margin:10pt 0 14pt}
table{width:100%;table-layout:auto;word-break:break-word;border-collapse:collapse;margin:8pt 0}
th{font-size:9pt;text-transform:uppercase;text-align:left;color:#1a1a1a;
  border-bottom:.5pt solid #d4d4d8;padding:5pt 8pt}
td{padding:5pt 8pt;border-bottom:.5pt solid #e4e4e7;vertical-align:top}
tr{page-break-inside:avoid}
pre{background:#f7f7f8;border:.5pt solid #d4d4d8;padding:8pt 10pt;font-size:8.5pt;
  font-family:Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word}
code{font-family:Menlo,Consolas,monospace;font-size:9pt}
sup.cite a{color:#b91c1c;font-weight:700;text-decoration:none}
sup.cite{color:#b91c1c;font-weight:700}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(90pt,1fr));gap:14px;
  border-top:.5pt solid #d4d4d8;border-bottom:.5pt solid #d4d4d8;padding:10pt 0;
  margin:12pt 0;page-break-inside:avoid}
.stat{text-align:center}
.stat .value{font-size:28pt;font-weight:700}
.stat .label{font-size:9pt;color:#6b7280;text-transform:uppercase;margin-top:2pt}
.callout{border:.5pt solid #d4d4d8;border-left:3pt solid #1e40af;padding:10pt 12pt;
  margin:10pt 0;page-break-inside:avoid}
.callout-title{font-weight:700;font-size:10pt;margin-bottom:4pt;color:#1a1a1a}
.pill{display:inline-block;border:1pt solid #6b7280;color:#6b7280;font-size:8pt;
  font-weight:700;text-transform:uppercase;padding:1pt 5pt;border-radius:2pt}
.pill.sev-crit{border-color:#b91c1c;color:#b91c1c}
.pill.sev-high{border-color:#ea580c;color:#ea580c}
.pill.sev-med{border-color:#b45309;color:#b45309}
.pill.sev-low{border-color:#15803d;color:#15803d}
ol.references{font-size:8.5pt;padding-left:16pt}
ol.references li{margin:3pt 0}
ul,ol{margin:6pt 0;padding-left:18pt}
li{margin:2pt 0}
blockquote{border-left:2pt solid #d4d4d8;margin:8pt 0;padding:1pt 10pt;color:#6b7280}
"""


def _default_date() -> str:
    d = datetime.now()
    return f"{d.day} {d.strftime('%B %Y')}"


def render_report_html(
    md_text: str,
    mode: str = "dark",
    fallback_title: str = "CTI Report",
    badge: str = "",
) -> tuple[str, str]:
    """Render structured markdown into a full report HTML document.

    Returns (html, title). mode is "dark" (on-screen) or "pdf" (white brief).
    """
    md = unwrap_outer_fence(md_text)
    fm, body = parse_front_matter(md)

    # When the Write tool is unavailable (web-app job path), the model may
    # emit narration/thinking prose before the YAML front-matter block.
    # parse_front_matter requires --- at the very start, so it returns {} and
    # the narration leaks into the rendered output.  Search for the first
    # ^---\ntitle: block and discard everything before it.
    if not fm:
        narration_skip = re.search(r'(?m)^---[ \t]*\ntitle:', md)
        if narration_skip and narration_skip.start() > 0:
            md = md[narration_skip.start():]
            fm, body = parse_front_matter(md)

    title = fm.get("title") or fallback_title
    subtitle = fm.get("subtitle", "")
    tlp = fm.get("tlp", "TLP:CLEAR")
    audience = fm.get("audience", "")
    date = fm.get("date") or _default_date()

    content = md_to_html(body)

    esc = lambda s: _h.escape(s, quote=False)  # noqa: E731

    if mode == "pdf":
        header = (
            '<header class="title-block">'
            f'<div class="tb-left"><h1>{esc(title)}</h1>'
            + (f'<p class="subtitle">{esc(subtitle)}</p>' if subtitle else "")
            + "</div>"
            f'<div class="tb-right"><span class="tlp-pill">{esc(tlp)}</span>'
            + (f'<div class="audience">AUDIENCE: {esc(audience)}</div>' if audience else "")
            + "</div></header>"
            '<hr class="title-rule">'
        )
        doc = (
            "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            f"<title>{esc(title)}</title>\n<style>{_PDF_CSS}</style>\n</head>\n<body>\n"
            f"{header}\n{content}\n</body>\n</html>"
        )
        return doc, title

    meta_bits = []
    if badge:
        meta_bits.append(f'<span class="pill">{esc(badge)}</span>')
    meta_bits.append(f'<span class="pill tlp">{esc(tlp)}</span>')
    if audience:
        meta_bits.append(f"<span>{esc(audience)}</span>")
    meta_bits.append(f"<span>{esc(date)}</span>")

    header = (
        '<header>'
        f'<div class="meta-strip">{"".join(meta_bits)}</div>'
        f"<h1>{esc(title)}</h1>"
        + (f'<p class="subtitle">{esc(subtitle)}</p>' if subtitle else "")
        + "</header>"
    )
    doc = (
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"<title>{esc(title)}</title>\n<style>{_DARK_CSS}</style>\n</head>\n<body>\n"
        '<button id="presentBtn" onclick="togglePresent()" '
        'title="Present (fullscreen, larger type) — press Esc to exit">▶ PRESENT</button>\n'
        f"{header}\n<main>\n{content}\n</main>\n"
        f"<script>{_PRESENT_JS}</script>\n</body>\n</html>"
    )
    return doc, title
