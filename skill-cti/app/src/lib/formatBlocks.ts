export const CITATION_REQUIREMENT = `
══════════════════════════════════════════════════════════
CITATIONS — MANDATORY, NON-NEGOTIABLE
══════════════════════════════════════════════════════════

The body of this report MUST contain in-text citation markers
THROUGHOUT — not only in a References section at the end. A
references list with NO inline markers is a defect. A reader who
cannot click [3] in the body to verify a specific claim cannot fact-
check the report; that is the entire purpose of citing.

REQUIRED — every one of the following MUST carry an inline [n] marker:

- Every statistic, count, or percentage ("1,200 incidents",
  "11% increase", "55% compromised assets")
- Every named organisation, agency, regulator, vendor, threat actor,
  intrusion set, malware family, or campaign mentioned by name
- Every CVE identifier and every regulatory reference (SOCI Act,
  Privacy Act, APRA CPS 234, AML/CTF Act section X, etc.)
- Every court case, settlement, prosecution, judgment, sentence
- Every quoted speech, official statement, or named executive's
  remark
- Every dollar figure, penalty amount, dwell time, or specific date
- Every direct factual claim about who did what, when, or where
- Every TTP, MITRE technique ID, IOC, or technical detail attributed
  to a specific source

If a sentence synthesises multiple sources, cite each — for example
[2,5,9]. If a paragraph relies on a single source for several
consecutive sentences, you may cite once at the END of the paragraph
with [n] covering all of it, but only when it is unambiguous.

A factual sentence that ends WITHOUT a [n] marker is a defect —
either drop the sentence or add the citation. The same applies in
the Executive Summary, BLUF, themes, recommendations, watch items,
analyst notes — every section. The TLP / classification block, page
title, and section headings themselves do not need citations.

══════════════════════════════════════════════════════════
CITATION HTML — RENDERING SPEC
══════════════════════════════════════════════════════════

Render every in-text [n] as a clickable superscript anchor:
  <sup><a href="#ref-1" style="color:inherit;text-decoration:none">[1]</a></sup>

For groups like [1,2,5], wrap each number separately:
  <sup>[<a href="#ref-1" style="color:inherit;text-decoration:none">1</a>,<a href="#ref-2" style="color:inherit;text-decoration:none">2</a>,<a href="#ref-5" style="color:inherit;text-decoration:none">5</a>]</sup>

References list — every numbered entry MUST have id="ref-N" matching
the inline marker. Every URL MUST be wrapped in a clickable anchor:
  <ol class="references">
    <li id="ref-1">Source — Title — Date — <a href="https://example.com/..." target="_blank" rel="noopener">example.com/...</a></li>
    <li id="ref-2">...</li>
  </ol>

The visible URL text may show without the https:// protocol for
brevity, but the href must always include https:// so the link opens
the source.

This works in both the on-screen HTML view and the exported PDF
(Chromium preserves internal #anchor links and external https://
links in PDF export).

══════════════════════════════════════════════════════════
SELF-CHECK BEFORE OUTPUT
══════════════════════════════════════════════════════════

Before emitting the HTML, mentally scan the Executive Summary and
the first body section. If any sentence with a statistic, a named
entity, or a specific factual claim ends without a <sup>[n]</sup>
marker, ADD ONE pointing to the most relevant reference. Do not
output a report where the body narrative reads like opinion. Every
fact in the body must trace back to a numbered reference via a
clickable inline marker.
`

export const PDF_FORMAT_OVERRIDE = `

──────────────────────────────────────────────────────────
PDF MODE OVERRIDE — IGNORE all styling, theme, and colour
instructions in the spec above. Keep the SECTION STRUCTURE from
the spec, but render the document as a professional Australian
CTI consulting brief — the kind a Senior Analyst would deliver
to a client board or executive risk committee. Match this
visual specification PRECISELY.

═══════════════════════════════════════════════════════
TYPOGRAPHY
═══════════════════════════════════════════════════════
- 100% sans-serif. Use a system stack only:
  font-family: 'Helvetica Neue', Arial, 'Segoe UI', sans-serif;
- NO serif fonts anywhere. NO decorative fonts. NO @import of
  web fonts (they slow print and may not render).
- Body 10pt, line-height 1.45.
- H1 (document title): 24pt, bold, #1a1a1a. May wrap to two lines.
- H2 (top-level sections): 14pt bold #1a1a1a. ALWAYS NUMBERED with
  Arabic numerals: "1. Bottom Line Up Front", "2. Executive summary",
  "3. <Theme block>", etc. Continue numbering through to the final
  "References" section.
- H3 (sub-section / theme heading inside an H2): 11pt bold,
  colour #1e40af (deep blue). Used for thematic sub-headings only.
- Body text justified or left-aligned. Never centred body text.

═══════════════════════════════════════════════════════
COLOUR PALETTE — USE ONLY THESE
═══════════════════════════════════════════════════════
- Background: pure white #ffffff.
- Body text: #1a1a1a (near-black).
- Muted / meta / caption text: #6b7280 (mid-grey).
- H3 sub-heading accent: #1e40af (deep blue).
- Citation superscripts: #b91c1c (dark red), bold.
- TLP / classification pill: text + border #ea580c (orange) on
  white background, bold uppercase, padded.
- Hyperlinks: #1e40af, underlined.
- Rules / borders: #d4d4d8 (light grey), 0.5pt.

═══════════════════════════════════════════════════════
PAGE
═══════════════════════════════════════════════════════
- @page { size: A4; margin: 20mm 20mm 20mm 16mm }
- ABSOLUTELY NO repeating page header or footer using position:fixed.
  Fixed elements overlap body content on every page during PDF export
  and ruin the look. Do not add any position:fixed elements at all.
- ABSOLUTELY NO "Generated by /<slug>" running header. The skill
  identity is already conveyed by the page-1 title block and the
  saved filename.
- Do NOT use CSS counter(page) or any page-number scheme. Skip
  pagination markers entirely.
- PAGE BREAK RULES — follow these exactly to prevent blank half-pages:
  * body { orphans: 3; widows: 3; }
  * h2, h3 { page-break-after: avoid; page-break-inside: avoid; }
    This keeps each heading glued to the first line of its following
    paragraph — preventing a lone heading stranded at the bottom of a page.
  * NEVER apply page-break-inside: avoid to top-level section containers,
    section divs, or any element that spans more than ~4 lines of text.
    Doing so forces the entire block to a new page and leaves a blank gap.
  * ONLY apply page-break-inside: avoid to small self-contained units:
    individual numbered decision items, individual table rows (<tr>),
    individual stat cards, key-value rows, and three-column card items.
  * NEVER use page-break-before: always or break-before: page on any
    section heading or container. Let content flow naturally.
  * page-break-inside: avoid on <li> inside the decisions list only —
    not on the parent <ol> or <ul>.
- OVERFLOW CONTROL (required to prevent content being clipped at the right edge during PDF export):
  * { box-sizing: border-box; }
  body { max-width: 100%; overflow-x: hidden; }
  table { width: 100%; table-layout: auto; word-break: break-word; }
  All flex rows must use flex-wrap: wrap and each child must have a max-width that fits within the container.
  The title block right column MUST be capped at 25% of the body width — use max-width: 25%.

═══════════════════════════════════════════════════════
TITLE BLOCK (page 1 only — NO separate cover page)
═══════════════════════════════════════════════════════
- Two-column flex layout at the very top of the document.
- LEFT (~75% width):
  · H1 title (24pt bold). Adapt to the skill — e.g.
    "Strategic Cyber Threat Intelligence Brief — Australia",
    "Phishing Email Investigation Report",
    "IOC Enrichment Report", etc.
  · Subtitle on the next line in 10pt: audience description,
    reporting window or date, prepared-by line, published date.
    Bold the key terms inline (the dates, the role).
- RIGHT (~25% width, right-aligned):
  · Orange TLP pill at top: "TLP:AMBER+STRICT" (white background,
    #ea580c text and 1px border, padding 4px 10px, bold uppercase).
  · Audience label below the pill in 9pt grey uppercase, e.g.
    "AUDIENCE: STRATEGIC", "AUDIENCE: SOC ANALYST",
    "AUDIENCE: CISO + IR TEAM" — adapt to skill.
- Solid 1pt #1a1a1a horizontal rule directly under this title block.
- Section "1." starts immediately below the rule.

═══════════════════════════════════════════════════════
CONTENT PATTERNS — apply where the spec calls for them
═══════════════════════════════════════════════════════
BULLET LISTS
- Standard • marker, standard indent.

INLINE LEAD PHRASES
- Phrases like "Business impact:", "Why it matters here:",
  "What it is.", "Who cares.", "What to do.", "Confidence:",
  "Action:" — always BOLD and run inline with the body text.

STAT STRIP (use when the spec includes by-the-numbers stats)
- PLACEMENT: The stat strip MUST appear immediately after the BLUF / Bottom
  Line Up Front section (section 1) and before the "What Happened" section
  heading (section 2). It must NOT appear mid-document or on a standalone page.
  Place it in the HTML directly after the closing </ul> or </ol> of the BLUF
  bullets and before the next <h2>.
- Horizontal grid of 4–5 metric cards via
  display:grid; grid-template-columns: repeat(N, 1fr); gap: 14px.
- Each card: large bold black value (28pt, centred), thin
  caption below in 9pt grey (centred, may wrap to two lines).
- 0.5pt #d4d4d8 horizontal rule above and below the strip.
- Add page-break-inside: avoid and page-break-before: avoid so the strip
  never floats to its own page.

THREE-COLUMN CARDS (use when the spec has 3 parallel items —
top 3 vulnerabilities, top 3 hunts, top 3 actions, etc.)
- display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px.
- Each card: 0.5pt top border #d4d4d8, internal padding 12px,
  page-break-inside: avoid.
- Card title in bold 11pt, sub-line in 9pt grey, body uses
  the bold inline lead phrases pattern above.

KEY-VALUE TABLE (use for Analyst Notes, metadata blocks)
- Two-column table: first column ~22% width and bold (key),
  second column normal (value).
- Row separator only: 0.5pt #e4e4e7 bottom border per row.
- No outer borders. Cell padding 6px 10px.

═══════════════════════════════════════════════════════
CITATIONS & REFERENCES
═══════════════════════════════════════════════════════
- Inline citations as superscript bold dark red, e.g.
  <sup style="color:#b91c1c;font-weight:700">[1,2]</sup>.
- The final numbered section is "<n>. References".
- Group references under bold sub-headings by source CATEGORY,
  e.g. "AU government and regulators", "AU media",
  "Global media and analysis", "Background (pre-window, cited
  for context)" — use whatever categories fit the actual sources.
- Each reference entry: bold [n], then
  "Source — Title — Date — url-without-protocol" on one line.
  URL in #1e40af underlined.
- A short italic disclaimer paragraph at the very bottom, e.g.
  "All citations were verified accessible during the research
  session for this brief. URL paths are shown without protocol
  for brevity."

═══════════════════════════════════════════════════════
HARD RULES — DO NOT VIOLATE
═══════════════════════════════════════════════════════
- ABSOLUTELY NO JavaScript-driven UI: no copy-on-click, no
  collapsibles, no sticky sidebars, no sortable tables, no
  scroll-spy, no print buttons. ALL content statically visible
  on first paint.
- NO emoji, NO unicode decorations (no ✓ ✗ → ⚡ etc.). Use plain
  text or the • bullet marker only. Arrow → is acceptable in
  date ranges.
- NO dark backgrounds anywhere. NO neon / glow / gradient.
- NO @import of fonts.
- The visual style above is FIXED across all skills — only the
  content sections, title text, audience label, and stat numbers
  change per skill.

═══════════════════════════════════════════════════════
OUTPUT
═══════════════════════════════════════════════════════
- Single self-contained HTML file with all CSS inline in a
  <style> block in the <head>.
- No external dependencies, no remote resources, no @import,
  no <script> tags.
- No markdown fences, no preamble. HTML only.

═══════════════════════════════════════════════════════
REFERENCES SECTION — MANDATORY, NEVER OMIT
═══════════════════════════════════════════════════════
The document MUST end with a numbered References section.
This is non-negotiable regardless of document length or the
skill spec's length guidance. Do NOT omit it to save space.

- The references section MUST be visible in the rendered PDF.
  Do NOT apply display:none, visibility:hidden, or any other
  CSS that would hide it — including inside @media print rules.
- Do NOT use position:fixed, overflow:hidden, max-height, or
  any truncation on the references list.
- Every [n] inline citation in the body MUST resolve to a
  numbered entry here.
- Format each entry on one line:
  [n] Source — "Title" — YYYY-MM-DD — url
  with the URL as a clickable <a href="..."> anchor.
──────────────────────────────────────────────────────────`

export const HTML_STYLE_OVERRIDE = `
══════════════════════════════════════════════════════════
HTML VISUAL STYLE — APPLIES TO THIS REPORT
══════════════════════════════════════════════════════════

OVERRIDE every styling instruction in the spec below. Use this refined
editorial aesthetic — modelled on Mandiant / Bloomberg / Stratfor
analyst reports — not a "cyberpunk SOC dashboard". The reader is a
CISO, board member, or senior analyst viewing this in a browser.

══════════════════════════════════════════════════════════
PALETTE — restrained, professional, dark editorial
══════════════════════════════════════════════════════════

CSS variables to declare in :root:
  --bg:       #0d1014;   /* warm near-black, NOT pure black */
  --surface:  #14181f;   /* subtle elevation, barely perceptible */
  --raised:   #1a1f28;   /* one more level for callouts */
  --text:     #e8eaed;   /* warm white, NOT pure white */
  --text-2:   #9aa0a6;   /* secondary text */
  --text-3:   #5f6368;   /* muted captions */
  --border:   #232831;   /* subtle, never strident */
  --rule:     #2a3038;   /* slightly stronger for horizontal section rules */
  --accent:   #93c5fd;   /* sky-300 — ONE soft accent, used sparingly */
  --link:     #93c5fd;
  --cite:     #fca5a5;   /* dark red for citation superscripts, restrained */
  /* Severity — use ONLY on severity indicators, nothing else */
  --sev-crit: #f87171;
  --sev-high: #fb923c;
  --sev-med:  #fbbf24;
  --sev-low:  #34d399;

ABSOLUTELY NO purple (#a855f7), magenta, hot pink, neon green, or cyan
accents anywhere. NO glowing gradients. NO box-shadow with coloured glow.
The page is greyscale + ONE soft blue + severity colours where needed.

══════════════════════════════════════════════════════════
TYPOGRAPHY
══════════════════════════════════════════════════════════

body {
  font-family: 'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif;
  font-size: 14px; line-height: 1.6; color: var(--text);
  background: var(--bg); -webkit-font-smoothing: antialiased;
}
Monospace stack (citations, IOCs, code, STIX): 'JetBrains Mono',
'SF Mono', Menlo, Consolas, monospace, 12.5px.

H1 — 22px, weight 700, letter-spacing -0.01em, line-height 1.25
H2 — 17px, weight 700, letter-spacing -0.005em, margin-top 32px,
     padding-top 18px, border-top 1px solid var(--rule)
H3 — 11px, weight 600, uppercase, letter-spacing 0.10em,
     colour var(--text-2), margin-top 20px, NO underline

Lead-in phrases ("Business implication:", "What to do:", "Why it matters:")
in bold inline, NOT broken onto a new line as a separate bullet.

NO ALL CAPS for body text. NO letter-spacing on body. NO centred body paragraphs.

══════════════════════════════════════════════════════════
LAYOUT — editorial, NOT dashboard
══════════════════════════════════════════════════════════

- Single column. max-width: 880px. margin: 0 auto. padding: 32px 40px.
  Reports are long-form documents, not dashboards.
- Sections separated by white space + a single border-top rule on each H2.
  DO NOT wrap every section in a bordered card.
- Bordered cards (border: 1px solid var(--border); border-radius: 6px;
  padding: 18px 20px; background: var(--surface)) are RESERVED for
  callout content only — typically decisions-needed, key risks, or
  prioritised recommendations. Use sparingly: 1-3 per report, not
  one per section.
- Optional sticky sidebar table-of-contents at the left: 180px wide,
  text-only links in a column, no decoration. Active link gets a 2px
  left border in var(--accent). On narrow viewports (<1100px), drop
  the sidebar entirely.

══════════════════════════════════════════════════════════
COMPONENTS
══════════════════════════════════════════════════════════

Stat blocks (the "by the numbers" stats):
  Large bold value (32px, weight 700, var(--text)) above a small
  uppercase label (10px, letter-spacing 0.08em, var(--text-3)).
  NO coloured backgrounds. Grouped 3-5 in a horizontal flex row
  separated by 32px gaps and a thin vertical 1px var(--border)
  divider between each. NO badges, NO cards around them.

Tables:
  Borderless. Use 1px solid var(--border) ONLY as a horizontal
  bottom-border per row. Header row: 10px uppercase, weight 600,
  var(--text-2), NO background fill, border-bottom 1px solid
  var(--rule). Body row hover: subtle background var(--surface).
  Cells: padding 10px 12px. Numeric columns right-aligned.

Badges / pills:
  Thin border (1px), TRANSPARENT background, text colour matches
  border colour. 10px, weight 600, uppercase, letter-spacing 0.06em,
  padding 2px 8px, border-radius 3px. e.g. a critical CVE badge is
  red text + red border on transparent — NOT solid red on white.
  Severity pills use --sev-* colours; everything else uses border:
  1px solid var(--border); color: var(--text-2);

Code / pre blocks:
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 4px; padding: 12px 14px; font-size: 12.5px;
  monospace stack. NO copy buttons in the rendered HTML — the
  proxy-side copy is one tap on mobile / Cmd+A in browser.
  (Exception: keep copy buttons ONLY for STIX bundle / Navigator
  layer / YARA pack export skills where the entire artefact IS
  the deliverable.)

Citations:
  <sup><a href="#ref-N" style="color:var(--cite);text-decoration:none;
  font-weight:700;font-family:'JetBrains Mono',monospace">[N]</a></sup>
  Per the citation requirement below.

Links:
  color: var(--link); text-decoration: underline;
  text-decoration-thickness: 1px; text-underline-offset: 2px.

Horizontal rules (separating major sections):
  border: 0; border-top: 1px solid var(--rule); margin: 32px 0;

══════════════════════════════════════════════════════════
WHAT TO ELIMINATE
══════════════════════════════════════════════════════════

- ANY use of purple, magenta, hot pink, neon cyan, or lime green
- Card "glow" effects (linear-gradient borders, coloured box-shadows)
- Solid-coloured pill backgrounds (use thin-bordered transparent pills)
- Card-wrapping EVERY section (use rules + white space instead)
- Emoji as decoration (✨ ⚡ 🔥 🚀 — never)
- Centred body paragraphs
- Background fills on entire sections
- More than ONE accent colour
- Letter-spacing on body text
- ALL CAPS for body text
- font-size > 36px for anything (including H1)
- box-shadow with offset > 4px or blur > 12px

══════════════════════════════════════════════════════════
INTERACTIVITY (vanilla JS only, optional)
══════════════════════════════════════════════════════════

- Sticky sidebar nav with scroll-spy highlighting active section ✓
- Collapsible long sub-sections (e.g. lengthy reference list) ✓
- NO copy-on-click buttons in normal report cards (see exception above)
- NO animations beyond subtle opacity/colour transitions (.2s ease)
- NO modal dialogs, tooltips, popovers

══════════════════════════════════════════════════════════
PRESENT MODE — MANDATORY ON EVERY REPORT
══════════════════════════════════════════════════════════

Every report MUST include a "PRESENT" button so the reader can drop
straight into a projector-ready view in a meeting — no slide-deck
export required. The pattern below is non-negotiable; include it
verbatim (or functionally equivalent) in every HTML report.

1. PRESENT BUTTON — fixed in the top-right of the viewport:

  <button id="presentBtn" onclick="togglePresent()" title="Present (fullscreen, larger type, hides chrome) — press Esc to exit">▶ PRESENT</button>

  CSS:
  #presentBtn{position:fixed;top:14px;right:14px;z-index:1000;
    background:var(--surface);border:1px solid var(--border);
    color:var(--text-2);font-family:inherit;font-size:10px;font-weight:700;
    letter-spacing:.1em;padding:7px 12px;border-radius:5px;cursor:pointer;
    transition:color .2s,border-color .2s,background .2s}
  #presentBtn:hover{color:var(--accent);border-color:var(--accent);background:var(--raised)}

2. PRESENT MODE JS — drop this exact function into a <script> at end of body:

  <script>
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
  <\/script>

3. PRESENT-MODE CSS — increases type, hides chrome, optimises for projection:

  body.present-mode{font-size:18px;line-height:1.7;padding:50px 80px;max-width:1100px}
  body.present-mode h1{font-size:34px;line-height:1.2;margin-bottom:24px}
  body.present-mode h2{font-size:24px;margin-top:48px;padding-top:24px}
  body.present-mode h3{font-size:13px;margin-top:24px}
  body.present-mode #presentBtn,
  body.present-mode .sidebar-nav,
  body.present-mode .toc,
  body.present-mode .meta-strip{display:none}
  body.present-mode .stat-block .value{font-size:42px}
  body.present-mode pre,body.present-mode code{font-size:14px}
  body.present-mode table{font-size:15px}
  body.present-mode .references{font-size:13px;opacity:.85}

The PRESENT button is the ONE allowed fixed-position element in the
report (despite the global "no position:fixed" rule). It must always
be visible so the reader can enter present mode at any time.

══════════════════════════════════════════════════════════

OUTPUT REMAINS: single self-contained HTML file with all CSS in an
inline <style> block, all JS in an inline <script> block. No remote
resources, no @import.

══════════════════════════════════════════════════════════
OUTPUT FORMAT — CRITICAL
══════════════════════════════════════════════════════════

Your ENTIRE response must be ONLY the HTML document.
- Start with <!DOCTYPE html>
- End with </html>
- DO NOT write any text, summary, explanation, or commentary
  before <!DOCTYPE html> or after </html>
- DO NOT wrap the HTML in markdown code fences
- If you need to explain your sources, embed that in an HTML comment
  inside the document — never as plain text outside the HTML tags
`

export const PPTX_OUTLINE_OVERRIDE = `
══════════════════════════════════════════════════════════
POWERPOINT MODE — OUTPUT A SLIDE OUTLINE AS JSON, NOT HTML
══════════════════════════════════════════════════════════

DO NOT output HTML in this mode. Translate the skill's content into a
visually rich, professionally structured deck and output ONLY a single
JSON object matching the schema below. The renderer will turn that JSON
into a polished white + purple PowerPoint suitable for a C-suite or
board-level audience.

CRITICAL DESIGN REQUIREMENT: A professional deck is NOT a sequence of
bullet-point slides. It uses varied slide types to create visual rhythm
and emphasis. Aim for no more than 40% "content" (bullet) slides.
Every deck MUST include at least one "stats" slide, one "callout" or
"highlight" slide, and one "two_column" slide where the content permits.

══════════════════════════════════════════════════════════
JSON OUTPUT SCHEMA — STRICT
══════════════════════════════════════════════════════════

{
  "meta": {
    "title": "string — main deck title, e.g. 'Strategic CTI Brief — Australia, May 2026'",
    "subtitle": "string — one-line context, e.g. 'Monthly board briefing for Acme Corp'",
    "client": "string — client / org name if mentioned, otherwise empty",
    "date": "string — friendly date, e.g. '20 May 2026'",
    "classification": "string — TLP marking, e.g. 'TLP:AMBER+STRICT'",
    "author": "string — typically 'SkillCTI / Senior CTI Analyst'"
  },
  "slides": [ ...slide objects... ]
}

══════════════════════════════════════════════════════════
SLIDE TYPES — ALL 13 AVAILABLE TYPES
══════════════════════════════════════════════════════════

── STRUCTURAL (always present) ──────────────────────────

"title" — cover slide. Always first.
  { "type":"title", "title":"...", "subtitle":"..." }

"section" — section divider slide. Use before every major section.
  Include "number" to show a large decorative section number.
  { "type":"section", "title":"Section Name", "subtitle":"optional one-liner", "number":"1" }

"closing" — final slide. Always last.
  { "type":"closing",
    "title":"Questions? / Thank you",
    "subtitle":"optional contact or next-step line"
  }

── NARRATIVE / CONTENT ──────────────────────────────────

"content" — bulleted slide. Use for explanatory prose only.
  MAX 5 bullets. Each bullet <= 18 words. Lead phrase before first
  colon is auto-bolded (e.g. "Business impact: ...").
  Do NOT use for data points — use "stats" or "callout" instead.
  { "type":"content",
    "title":"Slide Title (< 9 words)",
    "subtitle":"optional one-liner",
    "bullets":["Lead phrase: supporting detail...", "..."],
    "footnote":"optional small-print note"
  }

"agenda" — numbered section overview. Use after the title slide for
  decks of 12+ slides.
  { "type":"agenda",
    "title":"Agenda",
    "items":["Executive Summary", "Key Findings", "Threat Landscape",
             "Recommendations", "Next Steps"]
  }
  Max 8 items. Supports two-column layout automatically for 5+ items.

"quote" — large pulled quote for emotional impact. Use sparingly (1–2 per deck).
  { "type":"quote",
    "quote":"The quote text, under 30 words.",
    "attribution":"Source — Author, Year"
  }

── DATA VISUALISATION ───────────────────────────────────

"stats" — by-the-numbers metric cards. ALWAYS use when there are 2+
  numeric data points. This is one of the most impactful slide types.
  Each stat supports optional severity color coding and trend arrows.
  { "type":"stats",
    "title":"Slide Title",
    "subtitle":"optional",
    "stats":[
      {"value":"1,200+", "label":"Incidents Handled",   "severity":"neutral", "trend":"up"},
      {"value":"83%",    "label":"Increase in Phishing", "severity":"high",    "trend":"up"},
      {"value":"$4.2M",  "label":"Avg. Breach Cost",    "severity":"critical"},
      {"value":"22 days","label":"Mean Dwell Time",      "severity":"medium"},
      {"value":"3x",     "label":"Ransomware Surge",    "severity":"high",    "trend":"up"}
    ]
  }
  Severity values: "critical" (red), "high" (orange), "medium" (amber),
  "low" (green), "info" (blue), "neutral" (purple, default).
  Trend values: "up", "down", or omit.
  Max 5 stats per slide.

"table" — structured comparison or data table.
  { "type":"table",
    "title":"Slide Title",
    "subtitle":"optional",
    "headers":["Threat Actor","Origin","Primary Target","Severity"],
    "rows":[
      ["APT29","Russia","Government","Critical"],
      ["Lazarus","North Korea","Finance","High"]
    ]
  }
  Max 8 rows, 5 columns. If first-column value matches a severity
  keyword (critical/high/medium/low), it is auto-colored.

── VISUAL EMPHASIS ──────────────────────────────────────

"callout" — 2–4 severity-coded impact boxes. PREFERRED over a plain
  "content" slide when highlighting risks, findings, or action items.
  Each box has a colored top bar, bold title, and body text.
  { "type":"callout",
    "title":"Key Findings / Critical Risks / Priority Actions",
    "subtitle":"optional",
    "callouts":[
      {
        "title":"Ransomware Targeting Critical Infrastructure",
        "body":"35% increase in attacks against energy and utilities sectors. Cl0p and LockBit 3.0 are primary operators.",
        "severity":"critical"
      },
      {
        "title":"BEC Campaigns on the Rise",
        "body":"Business email compromise losses exceeded $2.9B globally. Finance and HR teams remain primary targets.",
        "severity":"high"
      },
      {
        "title":"Patch Lag Creating Exposure",
        "body":"Three actively exploited CVEs remain unpatched in >60% of assessed environments.",
        "severity":"medium"
      },
      {
        "title":"Threat Intelligence Coverage Improved",
        "body":"New feed integrations provide 40% broader IOC coverage than Q1 baseline.",
        "severity":"low"
      }
    ]
  }
  Severity: "critical", "high", "medium", "low", "info", "neutral".
  2 callouts → side by side. 3–4 → 2x2 grid.

"highlight" — single large impact statement. Use for a key statistic,
  headline finding, or executive takeaway that deserves a full slide.
  Split layout: dark purple panel (left) with big value/stat,
  white area (right) with context.
  { "type":"highlight",
    "title":"Context label shown top-right (e.g. 'Key Finding')",
    "value":"83%",
    "label":"of breaches involved phishing",
    "context":"Extended context sentence or two. This appears on the right side of the slide and gives the audience the 'so what'. Keep to 2–4 sentences.",
    "bullets":["Alternative: use bullets instead of context if multiple points"]
  }
  Use "value" for a number/stat, or "message" for a short phrase.
  Include either "context" (paragraph) or "bullets" (list), not both.

"two_column" — side-by-side comparison. Use for before/after,
  immediate vs. strategic, threat actor A vs. B, etc.
  { "type":"two_column",
    "title":"Slide Title",
    "left_title":"Immediate Actions (30 days)",
    "left_bullets":["Action one with rationale", "..."],
    "right_title":"Strategic Priorities (12 months)",
    "right_bullets":["Strategic item one", "..."]
  }
  Max 5 bullets per column.

── NARRATIVE FLOW ───────────────────────────────────────

"timeline" — horizontal timeline for incident sequences, kill-chain
  phases, or chronological events. Up to 6 events.
  { "type":"timeline",
    "title":"Incident Timeline / Attack Progression",
    "subtitle":"optional",
    "events":[
      {"date":"Jan 2026",  "label":"Initial Access",      "detail":"Phishing email with malicious macro", "severity":"high"},
      {"date":"Feb 2026",  "label":"Lateral Movement",    "detail":"Credential dumping via Mimikatz",     "severity":"critical"},
      {"date":"Mar 2026",  "label":"Data Exfiltration",   "detail":"120 GB sent to C2 via HTTPS tunnel",  "severity":"critical"},
      {"date":"Apr 2026",  "label":"Ransomware Deployed", "detail":"LockBit 3.0 encrypts 4,200 hosts",    "severity":"critical"},
      {"date":"May 2026",  "label":"Containment",         "detail":"IR team isolates environment",        "severity":"low"}
    ]
  }
  Date labels alternate above/below the timeline. Severity colors the
  event dot. Include "detail" for a short sub-label (< 10 words).

── CITATIONS ────────────────────────────────────────────

"references" — numbered source list. Required if any [n] markers used.
  { "type":"references",
    "title":"References",
    "items":[
      {"n":1, "source":"ACSC", "title":"Annual Cyber Threat Report 2026", "url":"https://cyber.gov.au/..."},
      {"n":2, "source":"Mandiant", "title":"APT29 WINELOADER Campaign", "url":"https://..."}
    ]
  }
  Max 14 items per slide; add a second references slide if needed.

══════════════════════════════════════════════════════════
VISUAL DESIGN GUIDANCE — BUILD A VARIED, PROFESSIONAL DECK
══════════════════════════════════════════════════════════

A good deck alternates between slide types to maintain visual interest
and emphasise key information. Use this rhythm as a model:

  title → agenda → section → highlight (key stat) → stats →
  callout (key findings) → content → table → two_column →
  section → timeline → callout (actions) → references → closing

WHEN TO USE EACH TYPE:
- "callout"   → Key findings, risks, threats, recommended actions — anytime
               you have 2–4 items that each deserve a label + explanation.
               PREFER this over "content" for findings-oriented slides.
- "highlight" → One number or phrase that is THE story of the report.
               Use once per major section if a standout stat exists.
- "stats"     → Any slide with 2+ numeric data points. Replace a
               "content" slide that would just list numbers as bullets.
- "timeline"  → Incident reconstruction, kill-chain, attack phases,
               month-by-month event sequences.
- "agenda"    → Decks of 12+ slides. Place immediately after title.
- "two_column"→ Comparisons, before/after, short-term vs. long-term.
- "table"     → Threat actor comparisons, CVE lists, sector breakdowns,
               anything with a header + rows structure.
- "content"   → Explanatory prose that does not fit another type.
               Maximum 5 bullets. Never use for raw data.
- "quote"     → A compelling statement from a named source. Use once.
- "section"   → Before EVERY major section. Include "number" field.

══════════════════════════════════════════════════════════
DECK STRUCTURE — ALWAYS IN THIS ORDER
══════════════════════════════════════════════════════════

1. title slide (required, always first)
2. agenda slide (for decks 12+ slides)
3. section "Executive Summary" (number:"1") + 1–2 slides
   — Use a "highlight" or "stats" slide here, not just bullets
4. section "Key Findings" (number:"2") + 2–4 slides
   — MUST include at least one "callout" slide
   — Use "stats" if numeric data is available
5. One section per major theme / area (number:"3", "4" …)
   — Mix content / table / two_column / timeline as appropriate
6. section "Recommendations" or "Next Steps"
   — Use "callout" for priority actions with severity levels
   — Use "two_column" for immediate vs. strategic split
7. references slide(s) (required if any [n] markers used)
8. closing slide (required, always last)

Total: 10–18 slides typical. Daily briefs: 6–8. Deep-dives: up to 25.

══════════════════════════════════════════════════════════
CONTENT RULES
══════════════════════════════════════════════════════════

- Title slide title: < 10 words. Subtitle: < 16 words.
- Slide titles: < 9 words, punchy and specific.
- "content" bullets: <= 18 words each. Max 5 per slide.
  Lead phrase before first colon is auto-bolded — use this pattern.
- "stats" values: short and bold (e.g. "47%", "$3.2B", "22 days").
  Labels: < 6 words. Sublabel: optional tiny caption.
- "callout" body: 2–3 sentences, plain prose. < 40 words per box.
- "highlight" value: a number, % or short phrase (< 6 words).
  Context: 2–4 sentences of the "so what".
- "timeline" labels: < 5 words. Detail: < 10 words.
- "table": max 8 rows, 5 columns. Short cell values preferred.
- Cite sources with inline [n] in bullets, callout bodies, table
  cells. List them in a "references" slide at the end.
- Use sector / regional vocabulary from the skill spec.
- UK / Australian English for AU-flavoured skills.

══════════════════════════════════════════════════════════
WHAT TO AVOID
══════════════════════════════════════════════════════════

- DO NOT output HTML. DO NOT wrap JSON in markdown fences.
  DO NOT add prose before or after the JSON object.
- DO NOT build a deck of only "content" bullet slides — this produces
  a flat, unprofessional result. Use the full range of types.
- DO NOT use emoji or unicode decorations in any field value.
- DO NOT use markdown formatting (**bold**, *italic*) — the renderer
  handles emphasis automatically via the colon-lead pattern.
- DO NOT include "image_url", "speaker_notes", or any unsupported fields.
- DO NOT repeat the same slide type more than 3 times in a row.

══════════════════════════════════════════════════════════
FINAL CHECK — BEFORE EMITTING JSON
══════════════════════════════════════════════════════════

1. Is the output ONLY a JSON object — no markdown fences, no prose?
2. Does every slide have a valid "type" field (one of the 13 types)?
3. Is there at least one "stats", one "callout" or "highlight", and
   one "two_column" slide (unless content truly doesn't support it)?
4. Are bullet counts within limits (max 5 per "content" slide)?
5. Do "section" slides include a "number" field?
6. Is there a "references" slide if [n] markers were used?
7. Are "title" and "closing" slides present?

Output ONLY the JSON. No preamble, no markdown fences, no prose.
`
