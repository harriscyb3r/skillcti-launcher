"""Python equivalents of the TypeScript format block constants in app/src/lib/formatBlocks.ts.

Used by the scheduler runner to build system prompts server-side without the browser.
Keep in sync with formatBlocks.ts when either file changes.
"""
from __future__ import annotations
import re
from pathlib import Path

# ─── Format block constants ───────────────────────────────────────────────────

CITATION_REQUIREMENT = r"""
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
"""

HTML_STYLE_OVERRIDE = r"""
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
  monospace stack. NO copy buttons in the rendered HTML.

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
"""

PDF_FORMAT_OVERRIDE = r"""
──────────────────────────────────────────────────────────
PDF MODE OVERRIDE — IGNORE all styling, theme, and colour
instructions in the spec above. Keep the SECTION STRUCTURE from
the spec, but render the document as a professional Australian
CTI consulting brief — the kind a Senior Analyst would deliver
to a client board or executive risk committee.

═══════════════════════════════════════════════════════
TYPOGRAPHY
═══════════════════════════════════════════════════════
- 100% sans-serif. Use a system stack only:
  font-family: 'Helvetica Neue', Arial, 'Segoe UI', sans-serif;
- Body 10pt, line-height 1.45.
- H1 (document title): 24pt, bold, #1a1a1a.
- H2 (top-level sections): 14pt bold #1a1a1a. ALWAYS NUMBERED.
- H3 (sub-section): 11pt bold, colour #1e40af (deep blue).
- Body text justified or left-aligned. Never centred body text.

═══════════════════════════════════════════════════════
COLOUR PALETTE — USE ONLY THESE
═══════════════════════════════════════════════════════
- Background: pure white #ffffff.
- Body text: #1a1a1a (near-black).
- Muted / meta / caption text: #6b7280 (mid-grey).
- H3 sub-heading accent: #1e40af (deep blue).
- Citation superscripts: #b91c1c (dark red), bold.
- TLP / classification pill: text + border #ea580c (orange) on white.
- Hyperlinks: #1e40af, underlined.
- Rules / borders: #d4d4d8 (light grey), 0.5pt.

═══════════════════════════════════════════════════════
PAGE
═══════════════════════════════════════════════════════
- @page { size: A4; margin: 20mm 20mm 20mm 16mm }
- ABSOLUTELY NO repeating page header or footer using position:fixed.
- ABSOLUTELY NO "Generated by /<slug>" running header.
- Let the browser handle page breaks naturally.
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
- LEFT (~75%): H1 title (24pt bold). Subtitle on next line.
- RIGHT (~25%): Orange TLP pill + audience label.
- Solid 1pt #1a1a1a horizontal rule directly under this block.
- Section "1." starts immediately below the rule.

═══════════════════════════════════════════════════════
CITATIONS & REFERENCES
═══════════════════════════════════════════════════════
- Inline citations as superscript bold dark red.
- The final numbered section is "<n>. References".
- Each reference entry: bold [n], then Source — Title — Date — url.

═══════════════════════════════════════════════════════
HARD RULES
═══════════════════════════════════════════════════════
- ABSOLUTELY NO JavaScript-driven UI.
- NO emoji, NO unicode decorations.
- NO dark backgrounds anywhere.
- Single self-contained HTML file with all CSS inline in a <style> block.
- No external dependencies, no remote resources, no @import, no <script> tags.
- No markdown fences, no preamble. HTML only.

═══════════════════════════════════════════════════════
REFERENCES SECTION — MANDATORY, NEVER OMIT
═══════════════════════════════════════════════════════
The document MUST end with a numbered References section.
──────────────────────────────────────────────────────────"""

PPTX_OUTLINE_OVERRIDE = r"""
══════════════════════════════════════════════════════════
POWERPOINT MODE — OUTPUT A SLIDE OUTLINE AS JSON, NOT HTML
══════════════════════════════════════════════════════════

DO NOT output HTML in this mode. Translate the skill's content into a
visually rich, professionally structured deck and output ONLY a single
JSON object matching the schema below.

CRITICAL DESIGN REQUIREMENT: A professional deck is NOT a sequence of
bullet-point slides. Aim for no more than 40% "content" (bullet) slides.
Every deck MUST include at least one "stats" slide, one "callout" or
"highlight" slide, and one "two_column" slide where the content permits.

══════════════════════════════════════════════════════════
JSON OUTPUT SCHEMA — STRICT
══════════════════════════════════════════════════════════

{
  "meta": {
    "title": "string",
    "subtitle": "string",
    "client": "string",
    "date": "string",
    "classification": "string",
    "author": "string — typically 'SkillCTI / Senior CTI Analyst'"
  },
  "slides": [ ...slide objects... ]
}

Slide types: "title", "section", "closing", "content", "agenda",
"quote", "stats", "table", "callout", "highlight", "two_column",
"timeline", "references".

Deck structure: title → agenda → section + slides per major theme →
recommendations section → references → closing.
Total: 10–18 slides typical. Daily briefs: 6–8.

WHAT TO AVOID:
- DO NOT output HTML. DO NOT wrap JSON in markdown fences.
- DO NOT add prose before or after the JSON object.
- DO NOT build a deck of only "content" bullet slides.
- DO NOT use emoji or unicode decorations in any field value.
- DO NOT use markdown formatting (**bold**, *italic*).

Output ONLY the JSON. No preamble, no markdown fences, no prose.
"""

PDF_REFERENCES_REMINDER = (
    "FINAL REMINDER: Your output MUST include a References section as the last section "
    "of the document. List every source you used with [n] numbers matching the inline "
    "citations. Do not omit references to shorten the document. The references section "
    "must be visible in the PDF — do not hide it with CSS."
)

# ─── Markdown report mode (server-side rendering) ─────────────────────────────
# The model outputs compact structured markdown; services/report_render.py
# renders it into the fixed dark HTML template or the white PDF brief template.
# This cuts output tokens 30-50% per report versus full-HTML generation.

MD_REPORT_FORMAT = r"""
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
   with a language tag (```yaml, ```kql, ```text).

HARD RULES: no emoji or unicode decorations; no HTML tags anywhere; no
markdown fence wrapping the whole document; no text before the opening ---
or after the final section. Bold with **, italics with *, inline code with
`backticks`. Complete every required section — if approaching the token
limit, shorten prose per section rather than dropping sections.
"""

MD_CITATION_REQUIREMENT = r"""
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
"""

MD_REFERENCES_REMINDER = (
    "FINAL REMINDER: The document MUST end with a numbered References "
    "section listing every source with [n] numbers matching the inline "
    "citations and full https:// URLs. Do not omit references to shorten "
    "the document."
)

_CONTENT_SPEC_HEADER = (
    "══════════════════════════════════════════════════════════\n"
    "CONTENT SPECIFICATION FOR THIS SKILL\n"
    "══════════════════════════════════════════════════════════\n\n"
)


def _strip_frontmatter(text: str) -> str:
    return re.sub(r"^---[\s\S]*?---\s*", "", text, count=1).strip()


def build_system_prompt(skill_path: str, fmt: str, skills_root: Path) -> list[dict]:
    """Build the Anthropic system prompt blocks for a scheduled report job.

    Mirrors the TypeScript buildSystemPrompt() in app/src/lib/generate.ts.
    """
    skill_md_path = skills_root / skill_path / "SKILL.md"
    if not skill_md_path.exists():
        raise FileNotFoundError(f"SKILL.md not found: {skill_path}")
    skill_md = _strip_frontmatter(skill_md_path.read_text(encoding="utf-8"))

    if fmt == "pptx":
        format_block = PPTX_OUTLINE_OVERRIDE
    else:
        # html and pdf both use markdown mode — the backend renders the
        # template server-side (services/report_render.py)
        format_block = MD_REPORT_FORMAT + "\n\n" + MD_CITATION_REQUIREMENT

    content_spec = _CONTENT_SPEC_HEADER + skill_md

    blocks: list[dict] = [
        {"type": "text", "text": format_block, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": content_spec, "cache_control": {"type": "ephemeral"}},
    ]

    if fmt == "pdf":
        blocks.append({"type": "text", "text": MD_REFERENCES_REMINDER})

    return blocks
