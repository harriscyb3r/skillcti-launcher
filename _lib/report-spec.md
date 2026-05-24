# Shared CTI report specification

This file is the single source of truth for the visual, structural, and quality rules applied to **every CTI report skill** (monthly × strategic / tactical / operational × AU / global, plus sector reports). Each skill SKILL.md is responsible for:

- The report's tone, audience, and section list.
- Which source categories from `_lib/report-sources.md` to consult.
- The save filename and the footer text.
- Any skill-specific acronyms or skill-specific quality items.

Everything below is universal and must not be overridden in individual SKILL.md files unless explicitly noted.

---

## Output style: avoid AI-tell punctuation (mandatory)

Do NOT use em dashes (the long dash character, Unicode U+2014) or en dashes (the medium dash character, U+2013) anywhere in the report output. Em dashes have become a strong signal that text is AI-generated. Their absence makes the report look more human-written.

Substitute one of these instead:

- A period, then start a new sentence.
- A comma, for short parenthetical phrases.
- Parentheses, for true asides.
- A colon, for elaboration that follows.
- A semicolon, for two linked independent clauses.

Rewrite examples:

| Avoid (with em dash) | Use instead |
| --- | --- |
| `The incident, attributed by Mandiant to FIN7, affected 12 organisations.` (already correct, no em dash) | n/a |
| `Patch within 7 days. Out-of-band patching is acceptable.` (already correct, no em dash) | n/a |

If you find yourself reaching for a dash, ask: would a comma, period, colon, semicolon, or pair of parentheses do the same job? Almost always yes.

Apply to every output. This includes prose, table cells, headings, captions, footers, alt text, ARIA descriptions, comments inside code blocks (YAML, KQL, SQL, SVG titles), JSON description fields, badge labels, everything.

Before producing the final HTML, search the output for U+2014 and U+2013. If any are present, rewrite those sentences. The same rule applies to triple-hyphen sequences (`---`) used as a sentence dash; reserve `---` for horizontal-rule separators only.

---

## Reporting window

Use today's date (provided in the conversation context) to compute the window.

- **Monthly reports** — Default: trailing 30 days ending today. If a `YYYY-MM` argument was supplied: first → last day of that month.
- **Sector reports** — Default: trailing 12 months ending today. Accept `6m`, `12m`, `24m`, `2y`, or an explicit `YYYY-MM..YYYY-MM` window.

State the exact window (e.g. `2026-04-11 → 2026-05-11`) in the report header.

---

## Source rules

- **Only include articles published within the reporting window.** Older pieces may be cited as background only — label `(background, pre-window)`.
- Prefer primary sources (regulator, vendor, original researcher) over aggregators.
- If two sources conflict, present both and flag the discrepancy.
- **Never invent URLs.** If a URL cannot be verified via WebFetch this session, drop the claim.
- If a WebFetch fails (paywall, JS render, 403) but WebSearch surfaced the result, you may cite it with `(WebSearch result, page not directly retrieved)` rather than silently dropping it.
- If a search returns nothing usable, say so explicitly (e.g. *"No ACSC advisories published in this window"*) rather than fabricating content.
- For region-scoped reports, when the region has limited public reporting in the window, broaden to the parent region and note the broadening explicitly.

---

## Citations

Inline numbered footnotes `[n]` resolving in a final **References** section.

Format: `[n] Publisher — "Title" — YYYY-MM-DD — URL`.

Group references by category (regulator/CERT, AU gov, AU media, global media, regional media, sector ISAC, vendor, vuln DB) — the grouping should mirror the source categories the skill consumed from `_lib/report-sources.md`.

---

## Vulnerability prioritisation vocabulary

When reporting on CVEs, use the modern prioritisation triad — **severity** (CVSS), **exploit probability** (EPSS), **known-exploited status** (CISA KEV), and **stakeholder decision** (SSVC). A CVE table or recommendation that uses only CVSS is incomplete.

### CVSS 4.0

- Cite the **CVSS 4.0** Base score where the vendor or NVD has published one. Fall back to **CVSS 3.1** when 4.0 is not available; show both when both exist (e.g. *"CVSS 4.0: 9.3 / 3.1: 9.8"*).
- For top-3 priority CVEs in operational or tactical reports, include the **vector string** (e.g. `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N`) so readers can apply environmental overlays.
- Severity bands: 9.0–10.0 Critical · 7.0–8.9 High · 4.0–6.9 Medium · 0.1–3.9 Low.
- Reference: <https://www.first.org/cvss/v4-0/>.

### EPSS — Exploit Prediction Scoring System

- For every priority CVE, include the **EPSS score** (`0.00`–`1.00`) and the **EPSS percentile** (e.g. *"0.87 — top 5%"*).
- EPSS is recomputed daily by FIRST.org. Retrieve via WebFetch from `https://api.first.org/data/v1/epss?cve=CVE-YYYY-XXXX`, or pull the bulk CSV at `https://www.first.org/epss/csv` for batches.
- Interpretation guide: EPSS ≥ 0.7 (top ~5%) = expect in-the-wild exploitation soon; EPSS 0.1–0.7 = elevated watchlist; EPSS ≤ 0.05 (bottom 50%) = exploitation unlikely within 30 days.
- Reference: <https://www.first.org/epss/>.

### KEV — CISA Known Exploited Vulnerabilities

- Flag every CVE that appears in the CISA KEV catalogue with the date added.
- A KEV addition inside the reporting window is a strong operational signal — call it out in the BLUF.
- Source: <https://www.cisa.gov/known-exploited-vulnerabilities-catalog>.

### SSVC — Stakeholder-Specific Vulnerability Categorization

- For each priority CVE, compute an SSVC decision using the **CISA stakeholder profile**. The decision is one of four outcomes:

| Decision | Meaning | Indicative action |
| --- | --- | --- |
| **Track** | Standard patching cycle | Patch in next normal window (≈ 30 days) |
| **Track\*** | Closer monitoring | Watch for status change; ready to escalate |
| **Attend** | Elevated priority | Action this week; assign owner |
| **Act** | Drop everything | Patch within 7 days; out-of-band acceptable |

- Render the decision plus a one-sentence action: *"SSVC: Act — patch within 7 days per CISA stakeholder profile."*
- SSVC decision inputs (use these to walk the tree): Exploitation status (`none` / `PoC` / `active`), Automatable (`no` / `yes`), Technical impact (`partial` / `total`), Mission prevalence (`minimal` / `support` / `essential`), Public well-being impact (`minimal` / `material` / `irreversible`).
- Reference: <https://www.cisa.gov/ssvc>.

### Suggested CVE table format

**Operational + tactical reports:**

`CVE ID | Product | Affected versions | Fixed version | CVSS 4.0 / 3.1 | EPSS | KEV | SSVC | Source`

**Strategic briefs (plain English inline):** *"CVE-2026-XXXX in [Product] (CVSS 4.0: 9.3, EPSS top 5%, KEV-listed since 02 May 2026, SSVC: Act) — patch within 7 days."*

---

## Analytic confidence and probability (ICD 203 / WEP)

Intelligence judgements have **two independent dimensions** that must be reported separately:

1. **Probability of the event** — expressed using **Words of Estimative Probability (WEP)** per the table below.
2. **Confidence in the source/evidence** — expressed as `high`, `medium`, or `low`, with a one-line rationale (number of independent sources, primary vs. secondary, recency).

A WEP phrase alone, or a confidence label alone, is insufficient for any forecast.

### Words of Estimative Probability — ICD 203 standard

| Phrase | Probability band |
| --- | --- |
| almost no chance | 0–5% |
| very unlikely | 5–20% |
| unlikely | 20–45% |
| roughly even chance | 45–55% |
| likely | 55–80% |
| very likely | 80–95% |
| almost certain | 95–99% |

Reference: US Intelligence Community Directive 203, *Analytic Standards* (<https://www.dni.gov/files/documents/ICD/ICD%20203%20Analytic%20Standards.pdf>). The same vocabulary is used by NCSC-UK, ASIO/ASD, and major commercial CTI vendors (Mandiant, Microsoft Threat Intelligence, Recorded Future, CrowdStrike).

### Required format for assessments

> *"**Assessment:** [outcome statement] is **[WEP phrase]** ([probability band]) [over the relevant time window]. **Source confidence:** [high/medium/low] — [one-line rationale]."*

**Example:**

> Assessment: Russian state-aligned APT targeting of Australian energy infrastructure is **likely** (55–80%) to increase over the next 90 days. Source confidence: medium — corroborated across two vendor reports and one ACSC advisory, but no first-hand visibility into ASD telemetry.

### When to apply

- **Outlook / what-to-watch / forecast sections** — WEP + source confidence (mandatory).
- **Trend assertions** ("rising", "shifting") — WEP for the trend continuing + horizon evidence supporting it.
- **Attribution claims** — source confidence with reasoning; WEP optional when the attribution is binary.
- **Single observed events** — no WEP (the event happened or it didn't); cite source.
- **Recommendations** — no WEP needed; cite the supporting incident.

---

## Control framework references

When mapping advisories, incidents, or recommendations to controls, use **current framework versions explicitly** — never bare framework names.

- **NIST Cybersecurity Framework 2.0** (Feb 2024). Six functions, in order: **Govern** (`GV.*`) · Identify (`ID.*`) · Protect (`PR.*`) · Detect (`DE.*`) · Respond (`RS.*`) · Recover (`RC.*`). Always write "**NIST CSF 2.0**" to disambiguate from the 1.1 era. Strategic and tactical reports should preferentially use `GV.*` subcategories when an advisory or recommendation has board-level, policy, oversight, supply-chain, or governance implications. Reference: <https://www.nist.gov/cyberframework>.
- **MITRE ATT&CK** — current Enterprise / Mobile / ICS matrices. Fetch the live version where possible; do not hardcode `v15`. Reference: <https://attack.mitre.org/resources/versions/>.
- **MITRE D3FEND** — defensive technique counter-mapping for top ATT&CK techniques in detection-engineering content.
- **ASD Essential Eight** — current ML1 / ML2 / ML3 definitions. AU skills only.
- **CIS Controls v8** — for US-leaning tactical reports as the universal baseline alongside CSF 2.0.
- **NCSC CAF** — UK tactical and sector reports.
- **NIS2 Annex II** — EU sector reports.
- **IEC 62443** — sector reports covering OT / industrial control systems.
- **CSA AI Control Matrix V1.0.3** — for AI-related risk discussion (Mythos-Ready Assessment uses this).

---

## HTML output — universal rules

- Produce a **single self-contained HTML file**. Inline CSS. No external assets. Vanilla JS only (for nav / print / presentation toggle).
- Output **only** the HTML — no markdown wrapper, no preamble.
- Use Write to save to the path the skill defines; then print the full HTML to chat. Confirm the saved path in one concluding sentence.

### Theme (dark)

| Token | Value | Use |
| --- | --- | --- |
| Page background | `#0a0a12` | Outer page |
| Card background | `#15151f` | Section cards |
| Alternate-row background | `#1e1e2e` | Table zebra |
| Purple primary | `#a855f7` | Section borders, headings, primary accent |
| Cyan secondary | `#06b6d4` | Secondary accent, links |
| Primary text | `#e8e6ff` | Body text |
| Secondary text | `#9c98c0` | Captions, footnote pills |
| Headings | `#ffffff` | All section titles |
| Success / patched | `#22c55e` | Resolved, low severity |
| Warning / KEV | `#f59e0b` | Medium severity, KEV badge |
| Critical | `#ef4444` | Critical severity |

### TLP badge palette (TLP 2.0 — FIRST.org, Aug 2022)

| Marking | Background | Text |
| --- | --- | --- |
| `TLP:CLEAR` | `#f8fafc` | `#000` |
| `TLP:GREEN` | `#22c55e` | `#000` |
| `TLP:AMBER` | `#f59e0b` | `#000` |
| `TLP:AMBER+STRICT` | `#d97706` | `#fff` |
| `TLP:RED` | `#ef4444` | `#fff` |

Default for analyst-grade output: `TLP:AMBER+STRICT`. Strategic/board briefs may downgrade to `TLP:AMBER` so they can circulate inside the executive team — accept an optional `[--tlp clear|green|amber|amber+strict]` argument if provided.

### Typography

- Body: `system-ui, -apple-system, "Segoe UI", sans-serif`.
- Code / IOCs / CVEs / hashes / technique IDs: `"JetBrains Mono", "Fira Code", monospace`.
- Section headings weight 700, white. Sub-headings weight 600, accent purple.

### Layout

- Max content width 1100px (820px for security-advisory-style one-pagers; 1400px for the incident timeline; 1280px for the ATT&CK Navigator matrix).
- Centered, generous padding.
- Sticky top nav with anchor links to each numbered section.
- Each section in a card with `border-left: 3px solid #a855f7`.
- Tables: zebra rows, monospace technical columns, sticky headers.
- Footnote pills (small superscript), hover tooltip with source title, click jumps to the References section.

### Presentation mode

- Top-right toggle button labelled **Presentation mode**.
- When active: each top-level section becomes a full-viewport slide via CSS scroll-snap; nav hidden; larger base font; slide number bottom-right.
- Esc returns to document mode.
- Implement via vanilla JS toggling `body.presentation-mode` class.

### Print / Save as PDF

- Top-right **Print / Save as PDF** button. Calls `window.print()` so the user can print the page or save it as a PDF via the browser's print dialog ("Save as PDF" destination).
- `@media print`: dark text on white, hide nav, presentation toggle, and the print button; `break-inside: avoid` on tables and SVGs.

### Inline SVG infographics

Lightweight, no external chart libraries:

- "By the numbers" stat row (3–5 large numerals + labels).
- CVE severity distribution bars.
- Affected-sector pills.
- Donut/ring splits where useful.
- For sector reports: a "sector at a glance" stat row, an incident timeline (horizontal axis = horizon, dots per incident), an ATT&CK-style mini-heatmap (tactic columns × top techniques, intensity by frequency), and a recommendation priority pyramid.

All SVG must be self-contained, accessible (`<title>` tag, `<desc>` for complex figures, ARIA roles where the figure conveys information), and themed.

### Accessibility — WCAG 2.2 Level AA

Target conformance: **WCAG 2.2 Level AA** (<https://www.w3.org/WAI/WCAG22/quickref/?levels=aa>). Reports may be forwarded to readers in government, EU, or accessibility-mandated procurement contexts; AA compliance is the bar.

**Contrast**

- Body text and primary UI: ≥ 4.5:1 contrast in both the dark theme and the `@media print` light theme.
- Large text (≥ 18pt or ≥ 14pt bold): ≥ 3:1.
- Verified ratios on the standard palette: `#e8e6ff` on `#15151f` ≈ 14:1 ✓ · `#9c98c0` on `#15151f` ≈ 6.3:1 ✓ · `#9c98c0` on `#1e1e2e` ≈ 5.6:1 ✓. All pass AA. For primary content using secondary text, prefer `#cfccea` (≈ 9:1) for extra headroom.

**Never convey information by colour alone**

- **Severity, verdict, and TLP badges must combine three signals**: (a) colour, (b) text label, and (c) shape or icon. Examples:
  - `🔴 CRITICAL` — acceptable
  - `🟠 HIGH` — acceptable
  - `🟡 MEDIUM` — acceptable
  - `🟢 LOW` — acceptable
  - Red square with no text — **not acceptable**.
- Status pills (`KEV`, `DRAFT`, `PATCHED`, `ACT`, `TRACK`, `ATTEND`) always carry their text.
- Charts (donut splits, severity bars, ATT&CK heatmaps) distinguish categories by **both colour and pattern/label** so monochrome print, projectors, and colour-blind readers can still parse them. Always include a labelled legend.

**SVG accessibility**

- Every SVG infographic includes `<title>` (concise figure name) **and** `<desc>` (data-rich — e.g. *"5 critical CVEs, 12 high, 8 medium, 3 low across April 2026"*) so screen readers convey the actual data, not just the chart name.
- Use `role="img"` plus `aria-labelledby` referencing both title and desc IDs:
  ```html
  <svg role="img" aria-labelledby="cve-title cve-desc">
    <title id="cve-title">CVE severity distribution</title>
    <desc id="cve-desc">5 critical, 12 high, 8 medium, 3 low across April 2026.</desc>
    ...
  </svg>
  ```
- Decorative-only SVG (divider flourishes, background ornaments) uses `aria-hidden="true"`.

**Keyboard and focus**

- Every interactive control (presentation toggle, print button, copy-on-click, filter chips, accordion headers, detail expanders) is reachable by Tab in DOM order.
- Visible focus ring on `:focus-visible`: `outline: 2px solid #06b6d4; outline-offset: 2px`. Never `outline: none` without a replacement.
- Long reports include a skip-to-content link at the top for keyboard users.

**Semantic structure**

- DOM order matches visual order — never use CSS to re-sequence content in a way screen readers would mis-narrate.
- Tables include `<caption>` and `<th scope="col">` / `<th scope="row">` correctly.
- Heading hierarchy is sequential (h1 → h2 → h3) without skipping levels.

### Clickable citations

- Every in-text `[n]` superscript is a clickable anchor jumping to the corresponding reference list entry.
- Every reference URL is a clickable link opening the source in a new tab (`target="_blank" rel="noopener"`).

---

## Universal quality bar (verify before output)

1. Every factual claim has a `[n]` citation that resolves in References.
2. No fabricated URLs — every link verified via WebFetch this session (or labelled per the source rules above).
3. All dates inside the reporting window (or explicitly labelled background).
4. **Forecasts, outlook, and trend assessments** use the WEP + source-confidence format defined in "Analytic confidence and probability" (ICD 203). Single observed events do not require WEP.
5. TLP marking is consistent across the document, matches the requested level, and cites TLP 2.0 (FIRST.org, Aug 2022) in the footer.
6. HTML renders standalone (open in browser, no missing assets).
7. Presentation toggle JS works.
8. Print rules render correctly (test mentally: would this fit on A4?).
9. **WCAG 2.2 Level AA** achieved: contrast verified, no colour-only conveyance (severity / verdict / TLP badges carry text + icon + colour), every SVG has `<title>` + `<desc>` + `role="img"`, focus rings visible on `:focus-visible`.
10. Region/sector/window scope is consistent across the report — no silent mid-document drift.
11. **CVE prioritisation** — every priority CVE shown with CVSS 4.0 (or 3.1 with note), EPSS score + percentile, KEV status (with KEV add date when in-window), and SSVC decision per "Vulnerability prioritisation vocabulary". Bare CVSS-only listings are not acceptable.
12. **Framework versions explicit** — "NIST CSF 2.0" (never bare "NIST CSF"), "MITRE ATT&CK v<live>" (never hardcoded), "CVSS 4.0" (or labelled fallback). Strategic and tactical reports use `GV.*` subcategories where governance is implicated.

If any check fails, fix before output. Do not warn the user — just produce correct output.

---

## Skill-specific overrides

Each SKILL.md may add or override:
- **Sources to use** — selects which sections of `_lib/report-sources.md` to consume.
- **Output file** — the Write path (e.g. `cti-report-au-strategic-<YYYY-MM>.html`).
- **Footer text** — the generator-name + audience tier line.
- **Acronym list for quality item 4 (Acronyms expanded on first use)** — skill-specific terms (AU skills add ACSC, ASD, SOCI, APRA, OAIC, E8, NDB; global skills add CISA, ENISA, NIS2, DORA, GDPR, etc.).
- **Skill-specific quality items** — any additional checks beyond the universal 10.

Everything else in this file is shared and immutable per-skill.
