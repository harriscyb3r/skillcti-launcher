// =============================================================
// SkillCTI — skill catalogue + prompt overrides
// -------------------------------------------------------------
// This file is loaded BEFORE the main script in skill-cti.html
// All variables declared here are global (no module/export wrapper).
// When migrating to React/Supabase later, this file becomes the seed
// data for the skills table — each skill object maps directly to a row.
// =============================================================

// ── Global citation requirement ───────────────────────────────
// Prepended to every skill's system prompt (HTML and PDF mode alike) so that
// every report's in-text citation markers and reference URLs are clickable.
// The reader is fact-checking; one click on [3] should jump to ref 3, and one
// more click on the URL in ref 3 should open the source article in a new tab.
// Chromium preserves both internal anchors and external links in PDF export.

const CITATION_REQUIREMENT = `
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
`;

// ── PDF format override ───────────────────────────────────────
// Appended to the skill's system prompt when the user picks PDF mode in the
// drawer. Tells the model to override the dark-theme/screen-optimised styling
// from the base prompt with print-ready, client-deliverable styling.

const PDF_FORMAT_OVERRIDE = `

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
- @page { size: A4; margin: 20mm 16mm 20mm 16mm }
- ABSOLUTELY NO repeating page header or footer using position:fixed.
  Fixed elements overlap body content on every page during PDF export
  and ruin the look. Do not add any position:fixed elements at all.
- ABSOLUTELY NO "Generated by /<slug>" running header. The skill
  identity is already conveyed by the page-1 title block and the
  saved filename.
- Do NOT use CSS counter(page) or any page-number scheme. Skip
  pagination markers entirely.
- Let the browser handle page breaks naturally. Use
  page-break-inside: avoid on section cards and table rows where
  practical to prevent ugly mid-element splits.

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
- Horizontal grid of 4–5 metric cards via
  display:grid; grid-template-columns: repeat(N, 1fr); gap: 14px.
- Each card: large bold black value (28pt, centred), thin
  caption below in 9pt grey (centred, may wrap to two lines).
- 0.5pt #d4d4d8 horizontal rule above and below the strip.

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
──────────────────────────────────────────────────────────`;

// ── HTML editorial style override ─────────────────────────────
// Prepended to every skill's system prompt when the user picks HTML mode.
// Forces a refined editorial aesthetic — Bloomberg Terminal / Mandiant blog
// vibe rather than "cyberpunk SOC dashboard". The per-skill prompts still say
// things like "purple #a855f7, cyan #06b6d4, glowing pills" — this override
// supersedes that and applies a consistent restrained look across every report.

const HTML_STYLE_OVERRIDE = `
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
`;

// ── PowerPoint format override ────────────────────────────────
// When the user picks PPTX from the format selector, this override
// completely replaces the per-skill HTML style instructions and asks
// the model to emit a STRUCTURED JSON slide outline instead of HTML.
// The proxy's /generate-pptx endpoint renders that JSON into an actual
// .pptx file using python-pptx, applying the white + deep-purple
// professional template.

const PPTX_OUTLINE_OVERRIDE = `
══════════════════════════════════════════════════════════
POWERPOINT MODE — OUTPUT A SLIDE OUTLINE AS JSON, NOT HTML
══════════════════════════════════════════════════════════

DO NOT output HTML in this mode. The skill's content specification
below tells you WHAT sections the deliverable needs. Translate that
content into a structured deck and output ONLY a single JSON object
in the schema described here. The proxy will render that JSON into
a professional white + purple PowerPoint deck.

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
  "slides": [
    { "type": "title",     ...slide-specific fields },
    { "type": "section",   ...slide-specific fields },
    { "type": "content",   ...slide-specific fields },
    { "type": "stats",     ...slide-specific fields },
    { "type": "table",     ...slide-specific fields },
    { "type": "two_column",...slide-specific fields },
    { "type": "quote",     ...slide-specific fields },
    { "type": "references",...slide-specific fields },
    { "type": "closing",   ...slide-specific fields }
  ]
}

══════════════════════════════════════════════════════════
SLIDE TYPES — fields per type
══════════════════════════════════════════════════════════

"title" — opens the deck. Fields:
  { "type":"title", "title":"...", "subtitle":"..." }

"section" — section divider. Fields:
  { "type":"section", "title":"section name", "subtitle":"optional one-liner" }

"content" — bulleted content slide (most common). Fields:
  { "type":"content",
    "title":"slide title (short, < 9 words)",
    "subtitle":"optional one-line context",
    "bullets":[
      "Each bullet ≤ 18 words. Use plain prose, not telegram-speak.",
      "Lead phrases in **bold** at the start of a bullet are fine (render as bold).",
      "Cite sources inline with [n] markers where applicable."
    ],
    "footnote":"optional small-print line at the bottom"
  }

"stats" — by-the-numbers strip. Fields:
  { "type":"stats",
    "title":"slide title",
    "subtitle":"optional one-line context",
    "stats":[
      {"value":"1,200+", "label":"Incidents handled"},
      {"value":"11%",    "label":"YoY increase"},
      {"value":"83%",    "label":"Increase in malicious notifications"}
    ]
  }
  Max 5 stats per slide. Use short, bold values + concise labels.

"table" — clean tabular data. Fields:
  { "type":"table",
    "title":"slide title",
    "subtitle":"optional",
    "headers":["Col1","Col2","Col3"],
    "rows":[
      ["cell A1","cell B1","cell C1"],
      ["cell A2","cell B2","cell C2"]
    ]
  }
  Max 8 rows + 5 columns per slide. Split into multiple slides if more.

"two_column" — side-by-side comparison or before/after. Fields:
  { "type":"two_column",
    "title":"slide title",
    "left_title":"e.g. 'Immediate (30 days)'",
    "left_bullets":["...", "..."],
    "right_title":"e.g. 'Strategic (12 months)'",
    "right_bullets":["...", "..."]
  }

"quote" — pulled quote for impact. Fields:
  { "type":"quote",
    "quote":"The actual quote text, < 30 words.",
    "attribution":"Source — Author, Year"
  }
  Use sparingly — at most 1-2 per deck.

"references" — numbered references list. Fields:
  { "type":"references",
    "title":"References",
    "items":[
      {"n":1, "source":"ACSC", "title":"Annual Cyber Threat Report 2026", "url":"https://cyber.gov.au/..."},
      {"n":2, "source":"Mandiant", "title":"APT29 WINELOADER", "url":"https://..."}
    ]
  }
  Max 12 items per references slide; split if more.

"closing" — final slide. Fields:
  { "type":"closing",
    "title":"e.g. 'Questions?' or 'Thank you'",
    "subtitle":"optional one-liner, e.g. 'Contact your CISO for clarifications'"
  }

══════════════════════════════════════════════════════════
DECK STRUCTURE — ALWAYS IN THIS ORDER
══════════════════════════════════════════════════════════

1. title slide (always first)
2. section "Executive Summary" + 1-2 content slides
3. section "Key Findings" + 2-4 content slides (with stats where data points exist)
4. section per major thematic area (themes, sectors, recommendations) with content/table/two_column slides as appropriate
5. section "Recommendations" or "Next Steps" with two_column slides where appropriate
6. references slide(s)
7. closing slide (always last)

Total deck length: 10-18 slides for a typical report. Long-form reports
(operational monthlies, sector deep-dives) can run to 22-25 slides.
Daily briefs should stay 6-8 slides.

══════════════════════════════════════════════════════════
CONTENT RULES
══════════════════════════════════════════════════════════

- Title slide title: < 10 words. Subtitle: < 16 words.
- Content slide title: < 9 words.
- Bullets: ≤ 18 words each. Maximum 5 bullets per content slide.
  If you have more content, split into multiple slides under a single
  section divider.
- Stats: short numeric / percentage values + < 6-word labels.
- Quotes: < 30 words.
- Tables: ≤ 8 rows, ≤ 5 columns. Headers are short single-word labels
  where possible.
- Cite sources with inline [n] markers in bullets and table cells.
  Then list the sources in a references slide at the end.
- Use the client's region / sector vocabulary where the skill spec
  provides context.
- Use UK / Australian English where the skill is AU-flavoured.

══════════════════════════════════════════════════════════
WHAT TO AVOID
══════════════════════════════════════════════════════════

- DO NOT output HTML. DO NOT wrap the JSON in markdown fences. DO
  NOT include any prose before or after the JSON.
- DO NOT use emoji or unicode decorations.
- DO NOT include image_url or other media fields — the template is
  text-only.
- DO NOT use markdown formatting in field values (no **bold**,
  *italic*, etc.). Plain text only. The template handles emphasis.
  Exception: bullet lead phrases like "Why it matters:" should appear
  as plain text — the template renders the first phrase up to the
  first colon as bold automatically.
- DO NOT include slide notes / speaker notes — the template doesn't
  use them.

══════════════════════════════════════════════════════════
FINAL CHECK
══════════════════════════════════════════════════════════

Before output, mentally validate:
- The output is ONLY a JSON object, nothing else
- Every slide has a "type" field that matches one of the 9 allowed types
- Total slide count fits the deck length guidance
- Bullets and titles respect length limits
- A references slide exists if any [n] markers are used in content

Output ONLY the JSON. No preamble, no markdown fences, no prose.
`;

// ── Daily briefings — short, scannable 24h news roundup ───────

const DAILY_BRIEFS = [
  {
    id:'daily-brief-global', name:'Daily Brief (Global)',
    tagline:'One-page global cyber news brief — last 24 hours',
    badge:'DAILY', badgeColor:'#14b8a6',
    category:'reports',
    description:'A compact, single-page global cybersecurity news brief covering the last 24 hours. Optimised for a 3-5 minute morning-commute read: TLDR bullets, 4-6 top stories, CVE watch, ransomware watch, and what to expect in the next 24-48 hours. Pulls from BleepingComputer, The Record, Krebs, Reuters/Bloomberg/AP cyber, CISA / NCSC / ACSC / ENISA, vendor threat intel, and ransomware leak-site trackers.',
    inputs:[
      {id:'date',label:'Date (optional — defaults to last 24 hours)',type:'text',placeholder:'2026-05-15'},
      {id:'focus',label:'Regional weighting (optional)',type:'text',placeholder:'APAC · US · UK · EMEA — leave blank for true global'}
    ],
    buildMsg:v=>`${v.date?'Reporting date: '+v.date:'Reporting window: last 24 hours from now'}${v.focus?' [Regional weighting: '+v.focus+']':' [Truly global]'}`,
    needsSearch:true, maxTokens:6000,
    skillPath:'cti-daily-brief-global'
  }
];

// ── Monthly reports — Australia ────────────────────────────────

const MONTHLY_AU = [
  {
    id:'operational-au', name:'Operational CTI (AU)',
    tagline:'Monthly AU report for SOC, IR, and vuln management',
    badge:'OPERATIONAL', badgeColor:'#ef4444',
    category:'reports',
    description:'Dense monthly HTML for analysts. CVE deep-dives with exploitation status, ACSC advisories, public IOC table, DRAFT Sigma/KQL detection stubs, and global malware tooling shifts. Everything cited.',
    inputs:[
      {id:'month',label:'Month (optional — defaults to last 30 days)',type:'text',placeholder:'2026-04'},
      {id:'focus',label:'Sector focus (optional)',type:'text',placeholder:'Finance, Healthcare, Critical Infrastructure'}
    ],
    buildMsg:v=>`${v.month||'Current month'}${v.focus?' [Sector focus: '+v.focus+']':''}`,
    needsSearch:true, maxTokens:12000,
    skillPath:'cti-monthly-report-operational-australia'
  },
  {
    id:'tactical-au', name:'Tactical CTI (AU)',
    tagline:'Monthly AU brief for SOC managers and threat hunters',
    badge:'TACTICAL', badgeColor:'#f59e0b',
    category:'reports',
    description:'Mid-depth monthly for practitioners fluent in ATT&CK. 5-bullet BLUF, AU incidents with TTP analysis, priority CVEs with detection notes, ACSC advisories mapped to Essential Eight, and 5 hunt hypotheses.',
    inputs:[
      {id:'month',label:'Month (optional)',type:'text',placeholder:'2026-04'}
    ],
    buildMsg:v=>v.month||'Current month',
    needsSearch:true, maxTokens:10000,
    skillPath:'cti-monthly-report-tactical-australia'
  },
  {
    id:'strategic-au', name:'Strategic CTI (AU)',
    tagline:'Monthly AU brief for executives and the board',
    badge:'STRATEGIC', badgeColor:'#a855f7',
    category:'reports',
    description:'Plain-English board-readable brief. 3-bullet BLUF, exec summary with stats, monthly themes with business impact, top 3 vulnerabilities in business terms, ACSC regulatory posture, board-level recommendations.',
    inputs:[
      {id:'month',label:'Month (optional)',type:'text',placeholder:'2026-04'},
      {id:'sector',label:'Industry context (optional)',type:'text',placeholder:'Financial services, ASX-listed'}
    ],
    buildMsg:v=>`${v.month||'Current month'}${v.sector?' [Industry: '+v.sector+']':''}`,
    needsSearch:true, maxTokens:8000,
    skillPath:'cti-monthly-report-strategic-australia'
  }
];

// ── Monthly reports — Global ───────────────────────────────────

const MONTHLY_GLOBAL = [
  {
    id:'operational-global', name:'Operational CTI (Global)',
    tagline:'Monthly global report for SOC, IR, and vuln management',
    badge:'OPERATIONAL', badgeColor:'#ef4444',
    category:'reports',
    description:'Worldwide operational monthly. Optional country/region weighting (USA, UK, Germany, Japan, EMEA, APAC, Five Eyes). Dense CVE deep-dives, regulator/CERT advisories, consolidated IOCs, DRAFT detection stubs.',
    inputs:[
      {id:'region',label:'Country or region (optional — defaults to worldwide)',type:'text',placeholder:'USA · UK · Germany · APAC · Five Eyes'},
      {id:'month',label:'Month (optional)',type:'text',placeholder:'2026-04'},
      {id:'focus',label:'Sector focus (optional)',type:'text',placeholder:'Finance, Critical Infrastructure'}
    ],
    buildMsg:v=>`${v.month||'Current month'}${v.region?' [Region: '+v.region+']':' [Worldwide synthesis]'}${v.focus?' [Sector focus: '+v.focus+']':''}`,
    needsSearch:true, maxTokens:12000,
    skillPath:'cti-monthly-report-operational-global'
  },
  {
    id:'tactical-global', name:'Tactical CTI (Global)',
    tagline:'Monthly global brief for SOC managers and threat hunters',
    badge:'TACTICAL', badgeColor:'#f59e0b',
    category:'reports',
    description:'Mid-depth monthly for practitioners fluent in ATT&CK. Optional country/region weighting. BLUF, incidents with TTP analysis, priority CVEs with detection notes, regulator advisories mapped to NIST CSF/CIS Controls, hunt hypotheses.',
    inputs:[
      {id:'region',label:'Country or region (optional)',type:'text',placeholder:'USA · UK · EMEA · APAC'},
      {id:'month',label:'Month (optional)',type:'text',placeholder:'2026-04'}
    ],
    buildMsg:v=>`${v.month||'Current month'}${v.region?' [Region: '+v.region+']':' [Worldwide synthesis]'}`,
    needsSearch:true, maxTokens:10000,
    skillPath:'cti-monthly-report-tactical-global'
  },
  {
    id:'strategic-global', name:'Strategic CTI (Global)',
    tagline:'Monthly global brief for executives and the board',
    badge:'STRATEGIC', badgeColor:'#a855f7',
    category:'reports',
    description:'Plain-English board brief covering global cyber activity. Optional country/region weighting (US → SEC/CISA, UK → NCSC, EU → GDPR/NIS2/DORA, Japan → APPI, Canada → PIPEDA, etc.).',
    inputs:[
      {id:'region',label:'Country or region (optional)',type:'text',placeholder:'USA · UK · EU · APAC'},
      {id:'month',label:'Month (optional)',type:'text',placeholder:'2026-04'},
      {id:'sector',label:'Industry context (optional)',type:'text',placeholder:'Financial services, SaaS, Healthcare'}
    ],
    buildMsg:v=>`${v.month||'Current month'}${v.region?' [Region: '+v.region+']':' [Worldwide synthesis]'}${v.sector?' [Industry: '+v.sector+']':''}`,
    needsSearch:true, maxTokens:8000,
    skillPath:'cti-monthly-report-strategic-global'
  }
];

// ── Sector reports — long-horizon ──────────────────────────────

const SECTOR_REPORTS = [
  {
    id:'sector-au', name:'Sector Report (AU)',
    tagline:'Long-horizon AU industry vertical deep-dive',
    badge:'SECTOR · AU', badgeColor:'#06b6d4',
    category:'reports',
    description:'Multi-month (default 12m) sector intelligence for Australia. Sector profile, threat actor landscape, notable incidents, MITRE TTP trends, CVE and supply-chain trends, ACSC/SOCI/APRA posture, outlook, recommendations.',
    inputs:[
      {id:'sector',label:'Industry sector',type:'text',required:true,placeholder:'Healthcare · Finance · Energy · Manufacturing · Defence · Education · Telecommunications · Transport · Water · Mining · Retail · Government · Technology · Food and grocery · Space'},
      {id:'horizon',label:'Horizon (optional — defaults to 12m)',type:'select',options:['12 months','6 months','18 months','24 months']}
    ],
    buildMsg:v=>`Sector: ${v.sector.trim()} [Horizon: ${v.horizon||'12 months'}]`,
    needsSearch:true, maxTokens:14000,
    skillPath:'cti-sector-report-australia'
  },
  {
    id:'sector-global', name:'Sector Report (Global)',
    tagline:'Long-horizon global industry vertical deep-dive',
    badge:'SECTOR · GLOBAL', badgeColor:'#06b6d4',
    category:'reports',
    description:'Multi-month (default 12m) global sector intelligence. Optional country/region weighting. Sector profile, threat actor landscape, incidents, TTP trends, CVE and supply-chain trends, regulator and CERT posture, outlook.',
    inputs:[
      {id:'sector',label:'Industry sector',type:'text',required:true,placeholder:'Healthcare · Finance · Energy · Manufacturing · Defence · Education · Telecom · Transport · Water · Mining · Retail · Government · Technology · Pharma · Oil and gas · Aviation · Maritime · Automotive · Space'},
      {id:'region',label:'Country or region (optional)',type:'text',placeholder:'USA · UK · Germany · Japan · EMEA · APAC'},
      {id:'horizon',label:'Horizon (optional)',type:'select',options:['12 months','6 months','18 months','24 months']}
    ],
    buildMsg:v=>`Sector: ${v.sector.trim()}${v.region?' [Region: '+v.region+']':' [Worldwide synthesis]'} [Horizon: ${v.horizon||'12 months'}]`,
    needsSearch:true, maxTokens:14000,
    skillPath:'cti-sector-report-global'
  }
];

// ── On-demand CTI — ad-hoc, single-event, investigation-driven ─

const ONDEMAND_SKILLS = [
  {
    id:'security-advisory', name:'Security Advisory',
    tagline:'Exec briefing on a breach, CVE, or cyber event',
    badge:'ADVISORY', badgeColor:'#a855f7',
    category:'ondemand',
    description:'Decision-oriented 1–2 page advisory for executives or the board. Auto-detects advisory type (zero-day, breach, supply-chain, ransomware, espionage, regulatory). AU regulatory context by default.',
    inputs:[
      {id:'event',label:'URL · CVE ID · Event Name',type:'textarea',required:true,placeholder:'CVE-2024-12345\nhttps://vendor.com/advisory\nMOVEit 2023 breach'},
      {id:'region',label:'Region',type:'select',options:['Global (AU context)','AU','USA','UK','EU','Canada','Japan','Singapore']}
    ],
    buildMsg:v=>`${v.event.trim()}${v.region&&!v.region.startsWith('Global')?' '+v.region:''}`,
    needsSearch:true, maxTokens:8000,
    skillPath:'cti-security-advisory'
  },
  {
    id:'threat-actor-profile', name:'Threat Actor Profile',
    tagline:'Structured actor profile from URL or report',
    badge:'ACTOR', badgeColor:'#ec4899',
    category:'ondemand',
    description:'Structured HTML profile of a named threat actor or group. BLUF, actor metadata, Diamond Model overlay, MITRE ATT&CK TTPs (technique IDs), IOCs, targeted sectors and geographies, SOCI Act relevance, recommended detections.',
    inputs:[
      {id:'input',label:'URL · Actor Name · Report Excerpt',type:'textarea',required:true,placeholder:'https://www.mandiant.com/resources/blog/apt29-wineloader\nAPT29 / Midnight Blizzard / Cozy Bear\nFIN7'},
      {id:'context',label:'Reader context (optional)',type:'text',placeholder:'Australian finance CISO · APAC SOC lead'}
    ],
    buildMsg:v=>`${v.input.trim()}${v.context?'\n\nReader context: '+v.context:''}`,
    needsSearch:true, maxTokens:10000,
    skillPath:'threat-actor-profile'
  },
  {
    id:'admiralty-assessment', name:'Admiralty Assessment',
    tagline:'Grade an intel report against the NATO Admiralty Code',
    badge:'ADMIRALTY', badgeColor:'#0891b2',
    category:'ondemand',
    description:'Quality-assesses a CTI report using the NATO Admiralty Code (6×6 system). Extracts each major claim, identifies the cited source, grades source reliability A–F and information credibility 1–6, flags single-sourced or unverifiable claims, and gives an overall report grade with recommendations to strengthen tradecraft.',
    inputs:[
      {id:'input',label:'URL · pasted intelligence report · file content',type:'textarea',required:true,placeholder:'https://www.mandiant.com/resources/blog/...\nor paste the full report text here'},
      {id:'context',label:'Assessment context (optional)',type:'text',placeholder:'Internal SOC use · client briefing · pre-publication peer review'}
    ],
    buildMsg:v=>`${v.input.trim()}${v.context?'\n\nAssessment context: '+v.context:''}`,
    needsSearch:true, maxTokens:12000,
    skillPath:'cti-admiralty-assessment'
  },
  {
    id:'stix-export', name:'STIX Bundle Export',
    tagline:'Extract IOCs from a report and emit STIX 2.1 JSON',
    badge:'STIX', badgeColor:'#6366f1',
    category:'ondemand',
    description:'Parses a threat intel source (URL or pasted report), extracts every IOC (IPs, domains, URLs, MD5/SHA1/SHA256/SHA512 hashes, emails, registry keys, mutexes, JA3, user-agents, ASNs, CVEs, ATT&CK technique IDs), and emits a valid STIX 2.1 bundle ready for import into MISP, OpenCTI, Anomali, Sentinel TI, ThreatConnect, ThreatQuotient, Recorded Future, EclecticIQ. Builds proper STIX SDOs (indicator, threat-actor, intrusion-set, malware, campaign, identity, marking-definition) and SROs with valid patterns and TLP markings. Output is a dark-themed HTML viewer wrapping the bundle, with one-click .json download and copy-on-click per indicator.',
    inputs:[
      {id:'input',label:'URL · Pasted report · IOC list',type:'textarea',required:true,placeholder:'https://www.mandiant.com/resources/blog/apt29-wineloader\n\nor paste a vendor advisory / blog / report excerpt directly'},
      {id:'attribution',label:'Attribution context (optional)',type:'text',placeholder:'APT29 / Midnight Blizzard / WINELOADER campaign'},
      {id:'tlp',label:'TLP marking',type:'select',options:['AMBER+STRICT','AMBER','GREEN','CLEAR','RED']}
    ],
    buildMsg:v=>`${v.input.trim()}${v.attribution?'\n\nAttribution context: '+v.attribution:''}\n\nTLP marking: ${v.tlp||'AMBER+STRICT'}`,
    needsSearch:true, maxTokens:14000,
    skillPath:'cti-stix-export'
  },
  {
    id:'attack-navigator', name:'ATT&CK Navigator Layer',
    tagline:'Renders the ATT&CK matrix inline + exports a Navigator JSON layer',
    badge:'NAVIGATOR', badgeColor:'#dc2626',
    category:'ondemand',
    description:'Extracts MITRE ATT&CK techniques from a threat report, actor profile, or TTP list and (1) renders a visual ATT&CK matrix inline in the HTML report — tactic columns with colour-coded technique cells per score — so you see the heatmap immediately without leaving the report; and (2) also emits a valid Navigator JSON layer file you can download and upload to attack-navigator.mitre.org for the full official matrix view, gap analysis, and stack comparison. Per-technique score, citation comments, source metadata.',
    inputs:[
      {id:'input',label:'URL · Actor name · TTP list · Report excerpt',type:'textarea',required:true,placeholder:'https://attack.mitre.org/groups/G0016/\nAPT29 / Midnight Blizzard\nT1566.001, T1059.001, T1003.001'},
      {id:'layerName',label:'Layer name (optional)',type:'text',placeholder:'APT29 TTPs — May 2026'},
      {id:'matrix',label:'Matrix',type:'select',options:['Enterprise','Mobile','ICS']}
    ],
    buildMsg:v=>`${v.input.trim()}${v.layerName?'\n\nLayer name: '+v.layerName:''}\n\nMatrix: ${v.matrix||'Enterprise'}`,
    needsSearch:true, maxTokens:14000,
    skillPath:'cti-attack-navigator'
  },
];

// ── DFIR Activities — investigation, detection engineering, exercises ─

const DFIR_SKILLS = [
  {
    id:'log-analysis', name:'Log Analysis (Sherlog Holmes)',
    tagline:'Interactive SIEM-style log dashboard',
    badge:'DFIR · LOGS', badgeColor:'#10b981',
    category:'dfir',
    external:true,
    url:'../log-analysis/siem-dashboard.html',
    description:'Standalone investigation dashboard for log triage — file upload, severity filters, IP correlation, AI-assisted summarisation. Opens in a new browser tab and runs against the same proxy on :8765.'
  },
  {
    id:'phishing-dfir', name:'Phishing DFIR',
    tagline:'Forensic analysis of a single suspicious email',
    badge:'PHISHING', badgeColor:'#f97316',
    category:'dfir',
    description:'Full DFIR on one phishing email. Header analysis (SPF/DKIM/DMARC, Received chain), sender infrastructure enrichment, URL redirect-chain, attachment hash sandbox lookups, phishing-kit identification (EvilProxy, Tycoon, Mamba2FA), campaign attribution, victim-impact, containment actions.',
    inputs:[
      {id:'input',label:'Headers + body · .eml content · URL to phish report',type:'textarea',required:true,placeholder:'Paste full email headers and body, or a URL to a published phishing report.'},
      {id:'region',label:'Reporting region',type:'select',options:['AU (ACSC ReportCyber)','USA (IC3/CISA)','UK (NCSC)','EU (national CERT)','Canada (CCCS)','Japan (JPCERT)','Other / Global']}
    ],
    buildMsg:v=>`${v.input.trim()}\n\nReporting region: ${v.region||'AU (ACSC ReportCyber)'}`,
    needsSearch:true, maxTokens:14000,
    skillPath:'dfir-phishing-analysis'
  },
  {
    id:'detection-as-code', name:'Detection as Code',
    tagline:'Sigma rules + KQL from threat intel or TTPs',
    badge:'DETECTIONS', badgeColor:'#06b6d4',
    category:'ondemand',
    description:'Converts a threat actor profile, report URL, or MITRE ATT&CK TTP list into Sigma rules and Sentinel/Defender KQL queries. MITRE tags, TTP coverage matrix, copy-on-click code blocks. All rules marked DRAFT.',
    inputs:[
      {id:'input',label:'URL · TTP List · Actor Description',type:'textarea',required:true,placeholder:'https://mandiant.com/apt29\nT1566.001, T1059.001, T1003.001\nAPT29 spearphishing with PowerShell'},
      {id:'platform',label:'Primary SIEM / EDR',type:'select',options:['Microsoft Sentinel','Microsoft Defender','Splunk','Elastic','Generic Sigma']}
    ],
    buildMsg:v=>`${v.input.trim()}${v.platform?' [Target platform: '+v.platform+']':''}`,
    needsSearch:false, maxTokens:10000,
    skillPath:'cti-detection-as-code'
  },
  {
    id:'yara-generator', name:'YARA Rule Generator',
    tagline:'Build DRAFT YARA rules from a report or malware description',
    badge:'YARA', badgeColor:'#84cc16',
    category:'dfir',
    description:'Converts a malware family description, threat intel report, or sample analysis into a reviewable YARA ruleset. Each rule has author + version + condition logic, with strings extracted from the source (ASCII + hex), MITRE ATT&CK tags, false-positive notes, and a severity rating. All rules marked DRAFT pending sandbox validation.',
    inputs:[
      {id:'input',label:'URL · Report · Malware analysis',type:'textarea',required:true,placeholder:'https://www.mandiant.com/resources/blog/...\nor paste a malware analysis / sample writeup directly'},
      {id:'family',label:'Malware family name (optional)',type:'text',placeholder:'WINELOADER · BumbleBee · IcedID'},
      {id:'scope',label:'Detection scope',type:'select',options:['Process memory + disk','Disk-only','Memory-only','Email attachment scan']}
    ],
    buildMsg:v=>`${v.input.trim()}${v.family?'\n\nFamily: '+v.family:''}\n\nDetection scope: ${v.scope||'Process memory + disk'}`,
    needsSearch:true, maxTokens:12000,
    skillPath:'cti-yara-generator'
  },
  {
    id:'incident-timeline', name:'Incident Timeline',
    tagline:'Chronological UTC + Melbourne timeline from raw events',
    badge:'TIMELINE', badgeColor:'#fb923c',
    category:'dfir',
    description:'Consolidates raw events (paste logs, IR notes, CSV slices, SIEM exports) into a clean chronological incident timeline. Each event shown in UTC AND Melbourne local time (AEST UTC+10 / AEDT UTC+11, DST-aware), with source, confidence, phase classification (recon, initial access, persistence, lateral, exfil, impact), and anomaly callouts. Includes a visual swimlane and a downloadable CSV.',
    inputs:[
      {id:'events',label:'Raw events — paste logs, IR notes, CSV, or SIEM rows',type:'textarea',required:true,placeholder:'2026-05-15T08:34:11Z auth.log: SSH login user=admin source=185.220.x.x\n2026-05-15T08:35:02Z proc: powershell.exe -EncodedCommand <b64>\n2026-05-15T08:36:44Z net: outbound 443 to evil-c2[.]xyz'},
      {id:'incident',label:'Incident name / reference (optional)',type:'text',placeholder:'INC-2026-0512 — suspected APT intrusion'},
      {id:'anchor',label:'Time-zero anchor (optional)',type:'text',placeholder:'2026-05-15T08:34:11Z (first suspicious login)'}
    ],
    buildMsg:v=>`${v.incident?'Incident: '+v.incident+'\n\n':''}${v.anchor?'Time-zero anchor: '+v.anchor+'\n\n':''}Events:\n${v.events.trim()}`,
    needsSearch:false, maxTokens:14000,
    skillPath:'dfir-incident-timeline'
  },
  {
    id:'ir-playbook', name:'IR Playbook Generator',
    tagline:'NIST 800-61r3 operator playbooks for 12 attack types',
    badge:'IR PLAYBOOK', badgeColor:'#0891b2',
    category:'dfir',
    description:'Generates an interactive, operator-ready Incident Response Playbook aligned to the NIST SP 800-61r3 lifecycle (Preparation, Detection and Analysis, Containment, Eradication, Recovery, Post-Incident). Choose a single attack type or generate all 12 in one switchable HTML. Each playbook includes phase-by-phase checkbox task lists (with localStorage persistence), decision trees, escalation paths, copy-on-click communication templates, evidence preservation checklists, regulatory notification guidance, MITRE ATT&CK mapping, an incident tracking panel (ID, severity, elapsed timer), and a JSON state export. Designed to complement pre-existing IR plans.',
    inputs:[
      {id:'attacktype',label:'Attack type',type:'select',options:[
        'all (full interactive suite)',
        'Ransomware',
        'Phishing / Credential Harvest',
        'Business Email Compromise (BEC)',
        'Insider Threat',
        'Data Breach / Exfiltration',
        'Supply Chain Compromise',
        'Web Application Attack',
        'Credential Stuffing / Account Takeover',
        'Malware Infection',
        'DDoS / Availability Attack',
        'Social Engineering',
        'Zero-Day Exploitation'
      ]},
      {id:'orgcontext',label:'Organisation context (optional)',type:'text',placeholder:'e.g. ASX-listed financial services, M365, hybrid Azure/on-prem'},
      {id:'region',label:'Regulatory region',type:'select',options:['AU','USA','UK','EU','Canada','Singapore','Japan','Global']}
    ],
    buildMsg:v=>{
      const type = v.attacktype && !v.attacktype.startsWith('all') ? v.attacktype : 'all';
      return [
        type === 'all' ? 'all' : type,
        v.orgcontext ? v.orgcontext.trim() : '',
        v.region || 'AU'
      ].filter(Boolean).join(' ');
    },
    needsSearch:false, maxTokens:20000,
    skillPath:'dfir-ir-playbook'
  }
];
// ── Strategy — forward-looking advisory, planning, exercises ───

const STRATEGY_SKILLS = [
  {
    id:'mythos-ready', name:'Mythos-Ready Assessment',
    tagline:'Strategic plan to prepare an org for Claude Mythos',
    badge:'MYTHOS', badgeColor:'#b91c1c',
    category:'strategy',
    description:'Produces a client-deliverable strategic recommendation report based on "The AI Vulnerability Storm: Building a Mythos-ready Security Program" v1.0 (CSA CISO Community + SANS + [un]prompted + OWASP Gen AI Security Project, 12 April 2026, updated 1 May 2026). Walks the document\'s 6 Key Takeaways, 10-question program-state assessment, 13-entry Risk Register (mapped to OWASP LLM Top 10, OWASP Agentic Top 10 2026, MITRE ATLAS, NIST CSF 2.0, CSA AICM V1.0.3), 11 named Priority Actions (PA1-11) with cadence, and the board-briefing 90-day template. Adds region-specific regulatory framing (Essential Eight + SOCI for AU; CIRCIA + SEC for US; EU AI Act + NIS2 + DORA; NCSC CAF for UK).',
    inputs:[
      {id:'org',label:'Organisation context — sector, size, current maturity, key concerns',type:'textarea',required:true,placeholder:'Australian ASX-listed financial services, ~3,000 staff, mature on Essential Eight ML2, hybrid Azure + on-prem, growing AI/agent deployment. Key concerns: customer data, AML/CTF compliance.'},
      {id:'currentMaturity',label:'Current security maturity baseline (optional)',type:'select',options:['Not assessed','Essential Eight ML1','Essential Eight ML2','Essential Eight ML3','NIST CSF basic','NIST CSF managed','NIST CSF optimised','ISO 27001 certified']},
      {id:'sector',label:'Sector (optional)',type:'text',placeholder:'Financial services · Healthcare · Energy · Government · Tech · Critical infrastructure'},
      {id:'region',label:'Regulatory region (optional)',type:'select',options:['Australia','USA','UK','EU','Canada','Japan','Singapore','Global']},
      {id:'horizon',label:'Roadmap horizon (optional)',type:'select',options:['90 days','180 days','12 months','24 months']}
    ],
    buildMsg:v=>`Organisation context:\n${v.org.trim()}\n\n${v.currentMaturity?'Current maturity baseline: '+v.currentMaturity+'\n':''}${v.sector?'Sector: '+v.sector+'\n':''}${v.region?'Regulatory region: '+v.region+'\n':''}${v.horizon?'Roadmap horizon: '+v.horizon:'Roadmap horizon: 12 months'}`,
    needsSearch:true, maxTokens:18000,
    skillPath:'cti-mythos-ready-assessment'
  },
  {
    id:'threat-model', name:'Threat Model',
    tagline:'PASTA or STRIDE threat model from a system or architecture',
    badge:'THREAT MODEL', badgeColor:'#f59e0b',
    category:'strategy',
    description:'Produces a structured threat model in your choice of methodology — PASTA (7-stage attack-simulation framework) or STRIDE (Microsoft\'s 6-category threat taxonomy: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege). Output includes inline SVG data-flow diagram, MITRE ATT&CK / CWE / CAPEC mappings, threat register with likelihood × impact heatmap, prioritised mitigations mapped to NIST CSF 2.0 + ASD Essential Eight + ISO 27001, and AU regulatory context (SOCI Act, OAIC, APRA CPS 234) where relevant.',
    inputs:[
      {id:'input',label:'URL or System Description',type:'textarea',required:true,placeholder:'https://docs.company.com/architecture\nCloud SaaS HR platform using Azure AD, PostgreSQL, REST APIs'},
      {id:'methodology',label:'Methodology',type:'select',options:['PASTA','STRIDE']},
      {id:'context',label:'Organisation context (optional)',type:'text',placeholder:'Australian financial services, 500 staff, hybrid Azure'}
    ],
    buildMsg:v=>`Methodology: ${v.methodology||'PASTA'}\n\n${v.input.trim()}${v.context?'\n\nOrganisation context: '+v.context:''}`,
    needsSearch:true, maxTokens:14000,
    skillPath:'cti-threat-model'
  },
  {
    id:'tabletop', name:'Tabletop Exercise',
    tagline:'IR tabletop facilitator pack from threat intel',
    badge:'TTX', badgeColor:'#22c55e',
    category:'strategy',
    description:'Facilitator-ready IR TTX from a threat actor URL or event. Six phased injects, facilitator notes, discussion questions, time budget, AU regulatory triggers (ACSC, SOCI, OAIC NDB, APRA CPS 234). Projectable.',
    inputs:[
      {id:'input',label:'Threat Intel URL or Actor Name',type:'textarea',required:true,placeholder:'https://mandiant.com/apt29-report\nFAMOUS CHOLLIMA / Lazarus Group\nRansomware targeting AU healthcare'},
      {id:'duration',label:'Duration',type:'select',options:['2 hours','90 minutes','3 hours','Half day (4 hours)']},
      {id:'audience',label:'Audience',type:'select',options:['Executive / Board','CISO + IR Team','SOC + Technical','Mixed (Exec + Technical)']}
    ],
    buildMsg:v=>`${v.input.trim()} [Duration: ${v.duration||'2 hours'}] [Audience: ${v.audience||'CISO + IR Team'}]`,
    needsSearch:true, maxTokens:12000,
    skillPath:'cti-tabletop'
  },
];


// ── All CTI skills combined ────────────────────────────────────

const CTI_SKILLS = [...DAILY_BRIEFS, ...MONTHLY_AU, ...MONTHLY_GLOBAL, ...SECTOR_REPORTS, ...ONDEMAND_SKILLS, ...DFIR_SKILLS, ...STRATEGY_SKILLS];

// ── Document tools — not launchable from here ──────────────────

const DOC_SKILLS = [
  {id:'docx',name:'Word Document',tagline:'Produce styled .docx files',badge:'DOCX',badgeColor:'#2563eb',description:'Professional Word documents with headings, tables of contents, page numbers, and branded formatting.',howToUse:'Ask Claude: "Create a [report/memo/letter] as a Word document covering..."'},
  {id:'pptx',name:'PowerPoint Deck',tagline:'Build slide presentations as .pptx',badge:'PPTX',badgeColor:'#dc2626',description:'Slide decks with branded layouts, speaker notes, and consistent formatting. Supports custom template schemas.',howToUse:'Ask Claude: "Create a PowerPoint on [topic] with X slides..."'},
  {id:'xlsx',name:'Excel Spreadsheet',tagline:'Generate .xlsx with formulas and charts',badge:'XLSX',badgeColor:'#15803d',description:'Spreadsheets with formulas, pivot tables, charts, and structured data from messy inputs or trackers.',howToUse:'Ask Claude: "Build a [budget/tracker/model] as an Excel file..."'},
  {id:'pdf',name:'PDF Operations',tagline:'Create, fill, merge, split, or extract',badge:'PDF',badgeColor:'#b45309',description:'All PDF operations: text extraction, merging, form filling, watermarking, encryption, OCR on scanned docs.',howToUse:'Attach a PDF and ask: "Extract tables from this PDF" or "Merge these PDFs..."'},
  {id:'pdf-reading',name:'PDF Reading',tagline:'Smart extraction and analysis from PDFs',badge:'PDF-R',badgeColor:'#7c3aed',description:'Intelligent PDF reading — chooses the right strategy for text-heavy, scanned, slide deck, or form documents.',howToUse:'Attach a PDF in the main Claude chat. It reads it automatically.'},
  {id:'file-reading',name:'File Reading',tagline:'Read any uploaded file type',badge:'FILES',badgeColor:'#0891b2',description:'Routes uploaded files to the right reader: PDF, DOCX, XLSX, CSV, JSON, images, archives, ebooks.',howToUse:'Upload any file in the main Claude chat — type is auto-detected.'},
  {id:'frontend-design',name:'Frontend Design',tagline:'Production-grade web UI and components',badge:'UI',badgeColor:'#0d9488',description:'Distinctive, opinionated frontend — React, HTML/CSS/JS, dashboards, landing pages. Bold aesthetic, not generic output.',howToUse:'Ask Claude: "Build a [dashboard/component/page] for [purpose]..."'},
  {id:'product-knowledge',name:'Anthropic Product Info',tagline:'Accurate Claude/API/product facts',badge:'META',badgeColor:'#6b7280',description:'Consults verified Anthropic product docs for accurate details about models, API features, pricing, and rate limits.',howToUse:'Claude uses this automatically when you ask about Anthropic products.'}
];

