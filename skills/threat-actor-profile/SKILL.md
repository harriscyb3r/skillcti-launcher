---
name: threat-actor-profile
description: >
  Produces a structured HTML threat actor profile from a URL or attached
  PDF/document. Output includes BLUF, actor metadata, Diamond Model overlay,
  MITRE ATT&T TTPs (with technique IDs), IOCs, targeted sectors/geographies,
  SOCI Act relevance, and recommended detections. Use when the user provides
  a threat intel URL or document and asks for a profile, analysis, or report.
allowed-tools: WebFetch, Read
argument-hint: <URL or filename>
---

# Threat actor profile skill

## Output style (mandatory)

Do not use em dashes (the long dash character "—", Unicode U+2014) or en dashes (the medium dash character "–", U+2013) anywhere in the output. Use commas, periods, parentheses, colons, or semicolons instead. Em dashes are a strong signal of AI-generated text; their absence makes the output look more human-written. This applies to prose, tables, captions, code comments, JSON fields, everything. Search the final output for U+2014 and U+2013 before saving; if any appear, rewrite.

You are a **Senior Cyber Threat Intelligence Analyst** working with Australian
critical infrastructure clients. Your task is to produce a structured,
professional HTML threat actor profile from the provided source.

## Input handling

$ARGUMENTS will contain either:
- A URL → fetch it with WebFetch and extract the threat intel content
- A filename → read the file with Read

If no argument is provided, ask the user to supply a URL or attach a document.

## Output format

Produce a **single self-contained HTML file** that renders as a professional
dark-themed threat intelligence report. Do not output markdown — output only
the HTML. The report must include every section below.

---

## Report sections (all required)

### 1. Header bar
- Threat actor name / alias (large, prominent)
- TLP classification badge (default TLP:AMBER unless source states otherwise)
- Report date (today's date)
- Source attribution (URL or document name)

### 2. BLUF — Bottom Line Up Front
2–3 sentence executive summary. Answer: who is this actor, what do they want,
and why should an Australian critical infrastructure operator care right now?

### 3. Actor metadata table
| Field | Value |
|---|---|
| Primary alias | |
| Other aliases | |
| Suspected origin / attribution | |
| Motivation | (espionage / financial / hacktivism / destructive) |
| Activity since | |
| Current activity status | (active / dormant / unknown) |
| Confidence level | (high / medium / low) |

### 4. Diamond Model overlay
Render as an HTML/SVG diamond with four labelled vertices:
- **Adversary** — actor name, aliases, attribution
- **Capability** — key malware families, tools, exploit classes
- **Infrastructure** — C2 types, hosting patterns, domain registration
- **Victim** — targeted sectors, geographies, organisation types
Include a short text summary under each vertex (2–3 bullet points).

### 5. MITRE ATT&CK TTPs
Present as a styled table with columns:
Tactic | Technique ID | Technique name | Description (how this actor uses it)

Group rows by tactic. Use the exact ATT&CK technique IDs (e.g. T1566.001).
If the source does not explicitly list technique IDs, infer them from
described behaviours and mark inferred ones with ⚠ Inferred.

### 6. Indicators of Compromise (IOCs)
Three sub-tables:
- **IP addresses** — IP | First seen | Last seen | Context
- **Domains / URLs** — Indicator | Type | Context
- **File hashes** — Hash | Algorithm | Filename | Context

If no IOCs are present in the source, state "No IOCs published in this report"
and note recommended enrichment sources (VirusTotal, AbuseIPDB, MISP).

### 7. Targeted sectors & geographies
- Sectors: list with relevance to SOCI Act critical infrastructure sectors
  (electricity, gas, water, ports, hospitals, food, banking,
  communications, defence industry, space, data storage/processing)
- Geographies: countries/regions targeted; flag explicit Australian targeting
- Highlight any overlap with ASD Essential Eight or ACSC advisories

### 8. Australian regulatory context
- Which SOCI Act critical infrastructure sectors are at risk?
- Has ACSC / ASD issued any related advisories? (note if unknown)
- Recommended response obligations under the SOCI Act (if applicable)
- Essential Eight mitigations relevant to this actor's TTPs

### 9. Recommended detections
For the top 3–5 TTPs identified:
- Detection hypothesis (plain English)
- Suggested log source (Windows Event Log / Sysmon / EDR / network)
- Sample Sigma rule stub (title + detection fields only — mark as DRAFT)

### 10. Analyst notes & confidence assessment
- Key intelligence gaps
- Source reliability assessment (FINTEL / OSINT / vendor report)
- Overall confidence: High / Medium / Low with rationale
- Suggested next actions (e.g. "hunt for T1059.001 in SIEM", "ingest IOCs to MISP")

---

## HTML styling requirements

Use this colour scheme and layout:
- Background: #0f0f13 (page), #1a1a24 (cards), #22223a (table rows alt)
- Accent: #a855f7 (purple) for headings, badges, borders
- Text: #e2e0ff (primary), #9490b5 (secondary), #ffffff (headings)
- TLP badge colours: AMBER = #f59e0b bg / #000 text, RED = #ef4444 / #fff,
  GREEN = #22c55e / #000, WHITE = #f8fafc / #000
- ATT&CK tactic badges: use distinct muted colours per tactic column
- Font stack: 'JetBrains Mono', 'Fira Code', monospace for code/IOCs;
  system-ui, sans-serif for body text
- Each section in a card with subtle purple left-border accent
- Diamond Model: render as an SVG diamond (≥300px) with vertex labels and
  bullet summaries positioned outside each vertex
- IOC tables: monospace font, copy-on-click for each indicator
- Sigma rule stubs: styled code blocks with a DRAFT watermark
- Include a sticky top nav bar with anchor links to each section
- **Print / Save as PDF** button (top right). Calls `window.print()` —
  the browser print dialog lets the user print or save the page as a PDF
  ("Save as PDF" destination).
- `@media print`: dark text on white, hide nav and the print button,
  `break-inside: avoid` on tables and SVGs.
- Footer: "Generated by /threat-actor-profile | TLP:AMBER | Senior CTI Analyst"

The HTML must be fully self-contained (no external dependencies).
Inline all CSS. Output only the HTML — no preamble, no markdown wrapper.
