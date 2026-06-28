// ─── Markdown report mode (server-side rendering) ───────────────────────────
// The model outputs compact structured markdown; the backend renders it into
// the fixed dark HTML template or white PDF brief (services/report_render.py,
// POST /api/render). Cuts output tokens 30-50% versus full-HTML generation.
// Keep in sync with MD_REPORT_FORMAT in backend/services/format_blocks.py.

export const MD_REPORT_FORMAT = `
══════════════════════════════════════════════════════════
OUTPUT FORMAT — STRUCTURED MARKDOWN (THE PLATFORM RENDERS IT)
══════════════════════════════════════════════════════════

Do NOT output HTML. Do NOT write CSS, <style>, <script>, SVG, or any HTML
tags. The platform renders your markdown into a professionally styled report
template server-side. The skill spec below may describe HTML styling, colour
palettes, copy-on-click buttons, present mode, or inline SVG infographics —
IGNORE every rendering and styling instruction in it. Keep ONLY the content
requirements: sections, data, analysis, citations.

Your ENTIRE response is ONE markdown document with these conventions:

1. FRONT MATTER — the document MUST start with exactly this block:
---
title: <report title>
subtitle: <one line: audience, reporting window, prepared-by>
tlp: <TLP:CLEAR | TLP:GREEN | TLP:AMBER | TLP:AMBER+STRICT>
audience: <primary audience, e.g. SOC analysts and IR teams>
date: <publication date, e.g. 12 June 2026>
---

2. SECTIONS — numbered H2 headings: "## 1. Bottom Line Up Front",
   "## 2. Executive Summary", continuing through the final
   "## <n>. References". Sub-sections as "### ...". Lead-in phrases
   ("Business impact:", "What to do:", "Why it matters:") in **bold**
   run inline with the sentence.

3. CITATIONS — plain inline [n] markers in square brackets, per the
   citation rules. The renderer converts them to clickable superscripts.
   Do NOT write <sup> tags or anchor links.

4. REFERENCES — the final section is a numbered markdown list, one entry
   per line, each with the full URL:
   1. Source — Title — Date — https://full.url/path
   The renderer links every URL and wires the inline [n] markers to entries.

5. STATS — for a "by the numbers" stat strip use this block (3-5 entries,
   one "VALUE | LABEL" per line). Place it right after the BLUF:
::: stats
1,200 | INCIDENTS REPORTED [3]
11% | YOY INCREASE [3]
:::

6. CALLOUTS — for the 1-3 highlighted boxes per report (decisions needed,
   key risks, priority recommendations):
::: callout Decisions required this month
- First decision [2]
- Second decision [5]
:::

7. SEVERITY PILLS — write [[CRITICAL]], [[HIGH]], [[MEDIUM]] or [[LOW]]
   inline wherever a severity badge is needed (CVE tables, incident rows).

8. TABLES — GitHub-style markdown tables. Keep cell text short.

9. CODE — Sigma rules, KQL queries, and IOC lists go in fenced code blocks
   with a language tag (\`\`\`yaml, \`\`\`kql, \`\`\`text).

HARD RULES: no emoji or unicode decorations; no HTML tags anywhere; no
markdown fence wrapping the whole document; no text before the opening ---
or after the final section. Bold with **, italics with *, inline code with
\`backticks\`. Complete every required section — if approaching the token
limit, shorten prose per section rather than dropping sections.
`

export const MD_CITATION_REQUIREMENT = `
══════════════════════════════════════════════════════════
CITATIONS — MANDATORY
══════════════════════════════════════════════════════════

Every factual claim in the body MUST carry an inline [n] marker — not only
in the References section. Cite inline [n] on every: statistic, count, or
percentage · named organisation, agency, regulator, vendor, threat actor,
malware family, or campaign · CVE or regulatory reference · court case,
settlement, or judgment · quoted speech or executive statement · dollar
figure, penalty, dwell time, or specific date · direct factual claim about
who did what, when, or where · TTP, MITRE technique ID, IOC, or technical
detail attributed to a source.

Multiple sources in one sentence: cite each — e.g. [2,5,9]. One source
across consecutive sentences: cite once at paragraph end when unambiguous.
A sentence with a statistic or named entity ending without [n] is a defect —
drop it or add the citation. Applies to every section including the BLUF,
Executive Summary, and recommendations. Exceptions: front matter and
section headings.

SELF-CHECK: before finishing, scan the Executive Summary and first body
section. Any sentence with a statistic, named entity, or specific claim
ending without [n] — add one.
`

export const MD_REFERENCES_REMINDER =
  'FINAL REMINDER: The document MUST end with a numbered References section ' +
  'listing every source with [n] numbers matching the inline citations and ' +
  'full https:// URLs. Do not omit references to shorten the document.'

export const MD_HAIKU_ADDENDUM = `
── HAIKU GENERATION RULES ─────────────────────────────────
You are generating at a token-efficient model tier.
SECTION COMPLETENESS: Complete every required section. If approaching your
token limit, shorten prose in each section rather than omitting sections.
A concise complete report beats a detailed truncated one.
Tables are preferred over long prose for dense data (CVEs, IOCs, timelines).
`

export const CITATION_REQUIREMENT = `
══════════════════════════════════════════════════════════
CITATIONS — MANDATORY
══════════════════════════════════════════════════════════

Every factual claim in the body MUST carry an inline [n] marker — not only in a References section. A reader who cannot click [3] in the body to verify a specific claim cannot fact-check the report.

Cite inline [n] on every: statistic, count, or percentage · named organisation, agency, regulator, vendor, threat actor, malware family, or campaign · CVE or regulatory reference · court case, settlement, or judgment · quoted speech or executive statement · dollar figure, penalty, dwell time, or specific date · direct factual claim about who did what, when, or where · TTP, MITRE technique ID, IOC, or technical detail attributed to a source.

Multiple sources per sentence: cite each — e.g. [2,5,9]. One source across consecutive sentences: cite once at paragraph end when unambiguous. A sentence with a statistic or named entity ending without [n] is a defect — drop it or add the citation. Applies to every section including Executive Summary, BLUF, recommendations. Exceptions: TLP block, page title, section headings.

── CITATION HTML ──────────────────────────────────────────

Inline [n]:
  <sup><a href="#ref-1" style="color:inherit;text-decoration:none">[1]</a></sup>

Grouped [1,2,5]:
  <sup>[<a href="#ref-1" style="color:inherit;text-decoration:none">1</a>,<a href="#ref-2" style="color:inherit;text-decoration:none">2</a>,<a href="#ref-5" style="color:inherit;text-decoration:none">5</a>]</sup>

References list — every entry MUST have id="ref-N" matching its inline marker:
  <ol class="references">
    <li id="ref-1">Source — Title — Date — <a href="https://example.com/..." target="_blank" rel="noopener">example.com/...</a></li>
  </ol>
URL display may omit https://; href must always include it.

── SELF-CHECK ─────────────────────────────────────────────

Before emitting HTML, scan the Executive Summary and first body section. Any sentence with a statistic, named entity, or specific claim ending without <sup>[n]</sup> — add one. Do not output a report where the body reads like opinion.
`

export const PDF_FORMAT_OVERRIDE = `
──────────────────────────────────────────────────────────
PDF MODE OVERRIDE — IGNORE all styling and theme instructions in the spec above. Keep the SECTION STRUCTURE but render as a professional Australian CTI consulting brief for a client board or executive risk committee.
──────────────────────────────────────────────────────────

── TYPOGRAPHY ─────────────────────────────────────────────
  100% sans-serif: font-family:'Helvetica Neue',Arial,'Segoe UI',sans-serif. No serif, no decorative fonts, no @import.
  Body: 10pt, line-height 1.45, justified or left-aligned. Never centred body text.
  H1 (title): 24pt bold #1a1a1a. May wrap to two lines.
  H2 (sections): 14pt bold #1a1a1a. ALWAYS numbered: "1. Bottom Line Up Front", "2. Executive Summary", etc. Continue numbering through to the final "References" section.
  H3 (sub-sections): 11pt bold #1e40af (deep blue).

── COLOUR PALETTE ─────────────────────────────────────────
  Background #ffffff. Body text #1a1a1a. Muted/caption #6b7280.
  H3 accent #1e40af. Citation superscripts #b91c1c bold. TLP pill #ea580c text+border on white background, bold uppercase, padded.
  Hyperlinks #1e40af underlined. Rules/borders #d4d4d8, 0.5pt.

── PAGE ───────────────────────────────────────────────────
  @page { size:A4; margin:20mm 20mm 20mm 16mm }
  ABSOLUTELY NO position:fixed elements — they overlap body content on every page in PDF export. No running headers/footers, no page numbers, no "Generated by" header.

  PAGE BREAK RULES:
  body{orphans:3;widows:3} h2,h3{page-break-after:avoid;page-break-inside:avoid}
  NEVER page-break-inside:avoid on large containers (section divs, anything spanning >4 lines) — forces blank half-pages.
  Apply page-break-inside:avoid ONLY on small self-contained units: individual list items (decisions list only), individual <tr>, stat cards, three-column card items.
  NEVER page-break-before:always or break-before:page on any heading or container.

  OVERFLOW CONTROL:
  *{box-sizing:border-box} body{max-width:100%;overflow-x:hidden} table{width:100%;table-layout:auto;word-break:break-word}
  All flex rows: flex-wrap:wrap; children max-width fits within container. Title block right column: max-width:25%.

── TITLE BLOCK (page 1 only — no separate cover page) ────
  Two-column flex at top of document.
  LEFT ~75%: H1 title (24pt bold) + 10pt subtitle (audience description, reporting window, prepared-by, published date — bold the key terms inline).
  RIGHT ~25%, right-aligned: Orange TLP pill "TLP:AMBER+STRICT" (#ea580c text+border, white bg, padding 4px 10px, bold uppercase) + 9pt grey uppercase audience label below (e.g. "AUDIENCE: STRATEGIC" — adapt to skill).
  Solid 1pt #1a1a1a rule directly below. Section "1." starts immediately after.

── CONTENT PATTERNS ───────────────────────────────────────

INLINE LEAD PHRASES ("Business impact:", "Why it matters:", "What to do:", "Confidence:", "Action:"): always BOLD, run inline with body text.

STAT STRIP (for by-the-numbers stats):
  Place immediately after BLUF closing tag, before the next <h2>. NOT mid-document.
  display:grid; grid-template-columns:repeat(N,1fr); gap:14px. Each card: 28pt bold centred value, 9pt grey centred caption. 0.5pt #d4d4d8 rules above and below. page-break-inside:avoid; page-break-before:avoid.

THREE-COLUMN CARDS (top-3 items):
  display:grid; grid-template-columns:repeat(3,1fr); gap:12px. Each card: 0.5pt top border #d4d4d8, padding 12px, page-break-inside:avoid. Card title: 11pt bold; sub-line: 9pt grey; body uses bold inline lead phrases.

KEY-VALUE TABLE (analyst notes, metadata):
  Two-column: first ~22% bold (key), second normal (value). Row separator: 0.5pt #e4e4e7 bottom border only. No outer borders. Cell padding: 6px 10px.

── CITATIONS & REFERENCES ─────────────────────────────────
  Inline: <sup style="color:#b91c1c;font-weight:700">[1,2]</sup>
  Final numbered section: "<n>. References". Group under bold sub-headings by source category (e.g. "AU government and regulators", "Global media and analysis", "Background (pre-window, cited for context)").
  Each entry: bold [n] then "Source — Title — Date — url" on one line. URL in #1e40af underlined.
  Short italic disclaimer at very bottom about URL verification.
  References section MUST be visible in the rendered PDF — no display:none, visibility:hidden, max-height, overflow:hidden, or @media print rules that hide it.

── HARD RULES ─────────────────────────────────────────────
  No JavaScript. No interactive UI (no copy-on-click, no collapsibles, no sticky elements, no sortable tables). All content statically visible on first paint.
  No emoji, no unicode decorations (✓ ✗ ⚡ etc.). Plain text or • only. Arrow → acceptable in date ranges.
  No dark backgrounds. No neon/glow/gradient. No @import of fonts.

OUTPUT: Single self-contained HTML. All CSS in <style> in <head>. No external dependencies. No markdown fences, no preamble. HTML only.
`

export const HTML_STYLE_OVERRIDE = `
══════════════════════════════════════════════════════════
HTML VISUAL STYLE
══════════════════════════════════════════════════════════

OVERRIDE all styling in the spec below. Editorial aesthetic — Mandiant / Bloomberg / Stratfor analyst reports — not a "cyberpunk SOC dashboard". Reader: CISO, board member, or senior analyst in a browser.

── PALETTE — declare in :root ─────────────────────────────
  --bg:#0d1014; --surface:#14181f; --raised:#1a1f28;
  --text:#e8eaed; --text-2:#9aa0a6; --text-3:#5f6368;
  --border:#232831; --rule:#2a3038;
  --accent:#93c5fd; --link:#93c5fd; --cite:#fca5a5;
  --sev-crit:#f87171; --sev-high:#fb923c; --sev-med:#fbbf24; --sev-low:#34d399;
No purple (#a855f7), magenta, hot pink, neon green, or cyan accents. No coloured glows, gradient borders, or box-shadow with offset >4px or blur >12px. Greyscale + one soft blue (#93c5fd) + severity colours only. No emoji as decoration (✨ ⚡ 🔥 🚀 — never).

── TYPOGRAPHY ─────────────────────────────────────────────
  body{font-family:'Inter',-apple-system,'Segoe UI',system-ui,sans-serif;font-size:14px;line-height:1.6;color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased}
  Monospace (citations, IOCs, code): 'JetBrains Mono','SF Mono',Menlo,Consolas,monospace; 12.5px.
  H1: 22px 700, letter-spacing -0.01em, line-height 1.25.
  H2: 17px 700, letter-spacing -0.005em, margin-top 32px, padding-top 18px, border-top 1px solid var(--rule).
  H3: 11px 600, uppercase, letter-spacing 0.10em, color var(--text-2), margin-top 20px, no underline.
  Lead-in phrases ("Business implication:", "What to do:") bold inline — NOT on a new line.
  No ALL CAPS body text. No letter-spacing on body. No centred body paragraphs. No font-size >36px for anything including H1.

── LAYOUT — editorial, not dashboard ──────────────────────
  Single column. max-width:880px. margin:0 auto. padding:32px 40px.
  Sections separated by whitespace + border-top rule on each H2. Do NOT card-wrap every section.
  Bordered cards (border:1px solid var(--border); border-radius:6px; padding:18px 20px; background:var(--surface)) reserved for callout content only — 1–3 per report max.
  Optional sticky sidebar TOC: 180px wide, text-only links. Active link → 2px left border in var(--accent). Drop on viewports <1100px.

── COMPONENTS ─────────────────────────────────────────────

Stat blocks: 32px 700 var(--text) value above 10px uppercase var(--text-3) label (letter-spacing 0.08em). No coloured backgrounds. Horizontal flex row, 32px gaps, 1px var(--border) vertical divider between each. No badges or cards.

Tables: borderless; 1px solid var(--border) bottom-border per row only. Header: 10px uppercase 600 var(--text-2), no background fill, border-bottom 1px solid var(--rule). Hover: var(--surface). Cells: padding 10px 12px. Numeric columns right-aligned.

Badges/pills: 1px border, transparent background, text colour = border colour. 10px 600 uppercase, letter-spacing 0.06em, padding 2px 8px, border-radius 3px. Severity → --sev-* colours; else → border 1px solid var(--border), color var(--text-2).

Code/pre: background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:12px 14px; 12.5px monospace. No copy buttons in normal report cards — exception: STIX/Navigator/YARA skills where the artefact IS the deliverable.

Citations: <sup><a href="#ref-N" style="color:var(--cite);text-decoration:none;font-weight:700;font-family:'JetBrains Mono',monospace">[N]</a></sup>

Links: color:var(--link); text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:2px.

Rules: border:0; border-top:1px solid var(--rule); margin:32px 0.

── INTERACTIVITY (vanilla JS only) ────────────────────────
  ✓ Sticky sidebar nav with scroll-spy highlighting active section
  ✓ Collapsible long sub-sections (e.g. lengthy reference list)
  ✗ No copy-on-click in normal report cards (exception: STIX/Navigator/YARA)
  ✗ No animations beyond opacity/colour transitions (.2s ease)
  ✗ No modals, tooltips, or popovers

── PRESENT MODE — MANDATORY ON EVERY REPORT ───────────────

The PRESENT button is the ONE allowed position:fixed element. Include verbatim:

Button:
  <button id="presentBtn" onclick="togglePresent()" title="Present (fullscreen, larger type, hides chrome) — press Esc to exit">▶ PRESENT</button>

CSS (in <style>):
  #presentBtn{position:fixed;top:14px;right:14px;z-index:1000;background:var(--surface);border:1px solid var(--border);color:var(--text-2);font-family:inherit;font-size:10px;font-weight:700;letter-spacing:.1em;padding:7px 12px;border-radius:5px;cursor:pointer;transition:color .2s,border-color .2s,background .2s}
  #presentBtn:hover{color:var(--accent);border-color:var(--accent);background:var(--raised)}
  body.present-mode{font-size:18px;line-height:1.7;padding:50px 80px;max-width:1100px}
  body.present-mode h1{font-size:34px;line-height:1.2;margin-bottom:24px}
  body.present-mode h2{font-size:24px;margin-top:48px;padding-top:24px}
  body.present-mode h3{font-size:13px;margin-top:24px}
  body.present-mode #presentBtn,body.present-mode .sidebar-nav,body.present-mode .toc,body.present-mode .meta-strip{display:none}
  body.present-mode .stat-block .value{font-size:42px}
  body.present-mode pre,body.present-mode code{font-size:14px}
  body.present-mode table{font-size:15px}
  body.present-mode .references{font-size:13px;opacity:.85}

JS (inline <script> at end of <body>):
  <script>
  function togglePresent(){
    const on=document.body.classList.toggle('present-mode');
    if(on&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{});
    else if(!on&&document.fullscreenElement)document.exitFullscreen();
  }
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&document.body.classList.contains('present-mode')){
      document.body.classList.remove('present-mode');
      if(document.fullscreenElement)document.exitFullscreen();
    }
  });
  document.addEventListener('fullscreenchange',()=>{
    if(!document.fullscreenElement)document.body.classList.remove('present-mode');
  });
  <\/script>

── OUTPUT FORMAT — CRITICAL ───────────────────────────────
Single self-contained HTML. All CSS in <style> in <head>. All JS in <script> at end of body. No external dependencies, no @import, no remote resources.
Your ENTIRE response must be ONLY the HTML document. Start with <!DOCTYPE html>. End with </html>. No markdown fences, no preamble, no commentary outside the HTML tags.
`

export const HAIKU_ADDENDUM = `
── HAIKU GENERATION RULES ─────────────────────────────────
You are generating at a token-efficient model tier. Apply these rules exactly:

DATA DIAGRAMS: Do NOT generate inline SVG under any circumstances — it causes rendering
errors at this tier. Replace every diagram with an HTML equivalent:
  Risk or threat heatmap  → HTML table, cells colour-coded with inline background styles
  Attack tree / kill chain → nested <ul> with inline colour on severity items
  Data-flow diagram        → two-column table (Source | Destination) with trust-boundary rows
An HTML table equivalent is always preferred over partial or invalid SVG.

SECTION COMPLETENESS: Complete every required section. If approaching your token limit,
shorten prose in each section rather than omitting sections. A concise complete report
beats a detailed truncated one.

PRESENT BUTTON: Copy the PRESENT button CSS and JS from the HTML VISUAL STYLE section
exactly as written — character for character. Do not modify or simplify the script.
It is the only JS in the document.
Sidebar scroll-spy and collapsible sections are optional — omit both if they add complexity.

HTML STRUCTURE: Close every opened tag. The document must end with </html>.
Never stop mid-section. Never add commentary after </html>.
`

export const PPTX_OUTLINE_OVERRIDE = `
══════════════════════════════════════════════════════════
POWERPOINT MODE — OUTPUT A SLIDE OUTLINE AS JSON, NOT HTML
══════════════════════════════════════════════════════════

DO NOT output HTML. Translate the skill's content into a visually rich professional deck and output ONLY a single JSON object matching the schema below. The renderer turns that JSON into a polished white + purple PowerPoint for a C-suite or board audience.

DESIGN PRINCIPLE: A professional deck is NOT a sequence of bullet-point slides. Use varied slide types for visual rhythm. No more than 40% "content" (bullet) slides. Every deck MUST include at least one "stats", one "callout" or "highlight", and one "two_column" slide.

── META SCHEMA ────────────────────────────────────────────
{
  "meta": {
    "title":          "main deck title, e.g. 'Strategic CTI Brief — Australia, May 2026'",
    "subtitle":       "one-line context",
    "client":         "client/org name if mentioned, otherwise empty",
    "date":           "friendly date, e.g. '20 May 2026'",
    "classification": "TLP marking, e.g. 'TLP:AMBER+STRICT'",
    "author":         "typically 'SkillCTI / Senior CTI Analyst'"
  },
  "slides": [ ...slide objects... ]
}

── SLIDE TYPES ────────────────────────────────────────────

STRUCTURAL (always present):

"title" — cover slide, always first.
  { "type":"title", "title":"...", "subtitle":"..." }

"section" — divider before every major section. Always include "number".
  { "type":"section", "title":"Section Name", "subtitle":"optional one-liner", "number":"1" }

"closing" — final slide, always last.
  { "type":"closing", "title":"Questions? / Thank you", "subtitle":"optional contact or next-step line" }

NARRATIVE:

"content" — bulleted slide. MAX 5 bullets, each ≤18 words. Lead phrase before first colon is auto-bolded. Do NOT use for data points — use "stats" or "callout" instead.
  { "type":"content", "title":"Slide Title (< 9 words)", "subtitle":"optional", "bullets":["Lead phrase: supporting detail..."], "footnote":"optional" }

"agenda" — numbered section overview. Use after title slide for decks 12+ slides. Max 8 items.
  { "type":"agenda", "title":"Agenda", "items":["Executive Summary","Key Findings","Threat Landscape","Recommendations","Next Steps"] }

"quote" — large pulled quote for emotional impact. Use sparingly (1–2 per deck).
  { "type":"quote", "quote":"The quote text, under 30 words.", "attribution":"Source — Author, Year" }

DATA VISUALISATION:

"stats" — by-the-numbers metric cards. Use whenever there are 2+ numeric data points. Max 5 stats per slide.
  severity: "critical"|"high"|"medium"|"low"|"info"|"neutral" (default). trend: "up"|"down" (optional).
  { "type":"stats", "title":"...", "subtitle":"optional",
    "stats":[
      {"value":"1,200+","label":"Incidents Handled","severity":"neutral","trend":"up"},
      {"value":"83%","label":"Increase in Phishing","severity":"high","trend":"up"},
      {"value":"$4.2M","label":"Avg. Breach Cost","severity":"critical"},
      {"value":"22 days","label":"Mean Dwell Time","severity":"medium"},
      {"value":"3x","label":"Ransomware Surge","severity":"high","trend":"up"}
    ]
  }

"table" — comparison or data table. Max 8 rows, 5 columns. First-column severity keywords auto-coloured.
  { "type":"table", "title":"...", "subtitle":"optional",
    "headers":["Threat Actor","Origin","Primary Target","Severity"],
    "rows":[["APT29","Russia","Government","Critical"],["Lazarus","North Korea","Finance","High"]]
  }

VISUAL EMPHASIS:

"callout" — 2–4 severity-coded impact boxes. PREFERRED over "content" for findings, risks, or actions.
  2 callouts → side-by-side. 3–4 → 2×2 grid. severity: "critical"|"high"|"medium"|"low"|"info"|"neutral".
  { "type":"callout", "title":"Key Findings / Critical Risks / Priority Actions", "subtitle":"optional",
    "callouts":[
      {"title":"Ransomware Targeting Critical Infrastructure","body":"35% increase in attacks against energy and utilities sectors. Cl0p and LockBit 3.0 are primary operators.","severity":"critical"},
      {"title":"BEC Campaigns on the Rise","body":"Business email compromise losses exceeded $2.9B globally. Finance and HR teams remain primary targets.","severity":"high"},
      {"title":"Patch Lag Creating Exposure","body":"Three actively exploited CVEs remain unpatched in >60% of assessed environments.","severity":"medium"},
      {"title":"Threat Intelligence Coverage Improved","body":"New feed integrations provide 40% broader IOC coverage than Q1 baseline.","severity":"low"}
    ]
  }

"highlight" — single large impact statement. Split layout: dark panel (left) with value, white area (right) with context. Use "value" for a number/stat, or "message" for a short phrase. Include "context" OR "bullets", not both.
  { "type":"highlight", "title":"Context label (e.g. 'Key Finding')",
    "value":"83%", "label":"of breaches involved phishing",
    "context":"Extended 2–4 sentence 'so what' on the right side of the slide."
  }

"two_column" — side-by-side comparison. Max 5 bullets per column.
  { "type":"two_column", "title":"...",
    "left_title":"Immediate Actions (30 days)", "left_bullets":["Action one with rationale","..."],
    "right_title":"Strategic Priorities (12 months)", "right_bullets":["Strategic item one","..."]
  }

NARRATIVE FLOW:

"timeline" — horizontal timeline for incident sequences or kill-chain phases. Up to 6 events. severity colours the dot.
  { "type":"timeline", "title":"Incident Timeline / Attack Progression", "subtitle":"optional",
    "events":[
      {"date":"Jan 2026","label":"Initial Access","detail":"Phishing email with malicious macro","severity":"high"},
      {"date":"Feb 2026","label":"Lateral Movement","detail":"Credential dumping via Mimikatz","severity":"critical"},
      {"date":"Mar 2026","label":"Data Exfiltration","detail":"120 GB sent to C2 via HTTPS tunnel","severity":"critical"},
      {"date":"Apr 2026","label":"Ransomware Deployed","detail":"LockBit 3.0 encrypts 4,200 hosts","severity":"critical"},
      {"date":"May 2026","label":"Containment","detail":"IR team isolates environment","severity":"low"}
    ]
  }

CITATIONS:

"references" — numbered source list. Required if any [n] markers used. Max 14 items per slide; add a second slide if needed.
  { "type":"references", "title":"References",
    "items":[
      {"n":1,"source":"ACSC","title":"Annual Cyber Threat Report 2026","url":"https://cyber.gov.au/..."},
      {"n":2,"source":"Mandiant","title":"APT29 WINELOADER Campaign","url":"https://..."}
    ]
  }

── WHEN TO USE (quick reference) ──────────────────────────
  callout   → key findings, risks, recommended actions (2–4 items with label + explanation) — PREFER over "content"
  highlight → one standout number or phrase that IS the story; once per major section if available
  stats     → any 2+ numeric data points; replace "content" slides that just list numbers as bullets
  timeline  → incident reconstruction, kill-chain phases, month-by-month event sequences
  two_column→ comparisons, before/after, immediate vs. strategic
  table     → actor comparisons, CVE lists, sector breakdowns with header + rows
  content   → explanatory prose that fits no other type; max 5 bullets, never for raw data
  quote     → one compelling named statement per deck (use sparingly)
  section   → before EVERY major section; always include "number" field

── DECK STRUCTURE ─────────────────────────────────────────
  1. "title"   — required, always first
  2. "agenda"  — for decks 12+ slides, placed after title
  3. "section" "Executive Summary" (number:"1") + 1–2 slides — use "highlight" or "stats", not just bullets
  4. "section" "Key Findings" (number:"2") + 2–4 slides — MUST include at least one "callout"; use "stats" if numeric data available
  5. One "section" per major theme (number:"3","4"…) — mix content/table/two_column/timeline as appropriate
  6. "section" "Recommendations" or "Next Steps" — "callout" for priority actions; "two_column" for immediate vs. strategic split
  7. "references" slide(s) — required if any [n] markers used
  8. "closing"  — required, always last

  Total: 10–18 slides typical. Daily briefs: 6–8. Deep-dives: up to 25.
  Never repeat the same slide type more than 3 times in a row.
  Model deck rhythm: title → agenda → section → highlight → stats → callout → content → table → two_column → section → timeline → callout → references → closing

── OUTPUT RULES ───────────────────────────────────────────
  Output ONLY the JSON object — no markdown fences, no prose before or after.
  All "type" values must be one of the 13 defined types above.
  No emoji or markdown formatting (**bold**, *italic*) in any field value — the renderer handles emphasis via the colon-lead pattern automatically.
  Content limits: "content" bullets ≤18 words each, max 5 per slide · "stats" values short ("47%","$3.2B","22 days"), labels <6 words · "callout" body ≤40 words per box · "highlight" value <6 words · "timeline" labels <5 words, detail <10 words · "table" max 8 rows 5 columns.
  Cite with inline [n] in bullets, callout bodies, and table cells. Always include a "references" slide if [n] used.

── FINAL CHECK ────────────────────────────────────────────
  1. Output is ONLY a JSON object — no fences, no prose?
  2. Every slide has a valid "type" (one of the 13 defined types)?
  3. At least one "stats", one "callout" or "highlight", one "two_column" present?
  4. All "content" bullet counts within limits (max 5 per slide)?
  5. All "section" slides include a "number" field?
  6. A "references" slide present if any [n] markers were used?
  7. "title" and "closing" slides present as first and last slides?
`
