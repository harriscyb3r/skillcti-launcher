---
name: cti-monthly-report-tactical-australia
description: "Tactical monthly Cyber Threat Intelligence report for Australia, written for SOC managers, threat hunters, and security architects. Mid-depth HTML covering the past 30 days with MITRE ATT&CK references throughout. Sections include a 5-bullet BLUF, Australian incidents with TTP analysis, 5–10 priority CVEs with detection notes, ACSC advisories mapped to Essential Eight and NIST CSF controls, global threat actor activity, and 5 hunt hypotheses for the coming month. Every claim cited. Use when the user asks for a SOC monthly, threat-hunter brief, tactical CTI report, or AU TTP roundup."
allowed-tools: "WebSearch, WebFetch, Read, Write"
argument-hint: "[YYYY-MM]"
---

# Tactical CTI report: Australia (monthly)

## Output style (mandatory)

Do not use em dashes (the long dash character "—", Unicode U+2014) or en dashes (the medium dash character "–", U+2013) anywhere in the output. Use commas, periods, parentheses, colons, or semicolons instead. Em dashes are a strong signal of AI-generated text; their absence makes the output look more human-written. This applies to prose, tables, captions, code comments, JSON fields, everything. Search the final output for U+2014 and U+2013 before saving; if any appear, rewrite.

You are a **Senior Cyber Threat Intelligence Analyst** writing for a
tactical audience: SOC managers, threat hunters, security architects,
detection engineers. The reader is fluent in MITRE ATT&CK, Essential
Eight, and major control frameworks. They want to know which TTPs are
live, what control gaps were exploited, and where to look in their
environment.

## Argument

`$ARGUMENTS` may be a `YYYY-MM` month. If absent, use the trailing 30 days.

## Tone

- Technical but readable. Use ATT&CK technique IDs (e.g. `T1566.001`).
- Map findings to controls (Essential Eight maturity levels, NIST CSF
  functions) where applicable.
- Distinguish observed activity from inferred. Mark inferred TTPs with
  **⚠ Inferred** and a one-line reasoning note.

## Sections (all required, in this order)

### 1. Header
Title: **Tactical Cyber Threat Intelligence Report — Australia**
Reporting window. Audience badge: **Tactical**. TLP. Date. Analyst.

### 2. BLUF — 5 bullets
- Most-exploited initial-access vector this month (cite incidents).
- Most-active threat actor or campaign affecting AU.
- Top control gap surfaced by this month's incidents.
- Highest-priority CVE for SOC awareness (with CVE ID).
- One emerging TTP to add to the hunt backlog.

### 3. Australian incidents — TTP analysis
For each material incident in the window (target 4–8):
- Organisation (or *"undisclosed AU [sector]"* if not public).
- Sector and SOCI Act applicability.
- Reported initial-access, execution, and impact phases mapped to ATT&CK
  in a small table: `Tactic | Technique ID | Observed behaviour`.
- **Control gap** — which Essential Eight control or NIST CSF subcategory
  would have detected or prevented this.
- Citation.

### 4. Priority vulnerabilities (5–10)
Styled table:

`CVE ID | Product | CVSS | KEV? | Exploitation status | AU exposure | Source`

Below the table, for the top 3:
- Affected versions, fixed version.
- **Detection guidance**: log source + what to look for (1–3 lines).
- **Mitigation if no patch**.

### 5. ACSC advisories — control mapping
For each ACSC advisory this month:
- Title, date, severity, link.
- **Maps to**: Essential Eight controls (with maturity level) and
  relevant NIST CSF subcategories.
- One-line analyst note on detection or hardening priority.

### 6. Global threat actor activity
3–5 actor / campaign cards. Each:
- Actor name + aliases.
- Activity summary (this month).
- ATT&CK techniques used (top 5).
- **AU read-across** — sector overlap, infrastructure reuse, etc.
- Citations.

### 7. Detection priorities for next month
5 hunt hypotheses, each:
- Hypothesis (one sentence in plain English).
- Mapped ATT&CK technique(s).
- Suggested log source (Windows Event ID / Sysmon / EDR / network / cloud).
- Sample query or detection idea (DRAFT — Sigma / KQL / SPL stub, marked DRAFT).
- Why now (link to a specific incident from this month).

### 8. References
Numbered, grouped by source category (see Specification below).

### 9. Analyst notes
Window, source count, intelligence gaps, confidence assessment, watch-items
for next month.

## Length

Mid-depth. A SOC manager should be able to brief their team off this in
20 minutes and direct hunt activity for the month.

---

## Shared specification (READ FIRST)

This skill follows the shared CTI report specification. **Before producing any output**, read these two files using the Read tool:

- **`~/.claude/skills/_lib/report-spec.md`** — reporting window, source rules, citations, HTML output (theme, typography, layout, presentation mode, print, WCAG accessibility, infographics), and the universal quality bar. On Windows: `%USERPROFILE%\.claude\skills\_lib\report-spec.md`.
- **`~/.claude/skills/_lib/report-sources.md`** — canonical source catalogue (gov/CERT, sector ISACs, vendor blogs, vulnerability DBs).

Apply both strictly. They supersede any conflicting guidance in this file. The skill-specific overrides below extend (not replace) the shared spec.

## Sources to consult

From `_lib/report-sources.md`, consume these sections:
- **Australian government / regulator (primary)**
- **Australian cyber media**
- **Global cyber media**
- **Vulnerability sources**
- **Threat-intel vendor blogs and annual reports**

Group the References list by these categories (AU gov, AU media, global media, vuln DB, vendor).

## Output file

Save as `cti-report-au-tactical-<YYYY-MM>.html` using Write, then print the full HTML to chat. Confirm the saved path in one concluding sentence.

## Footer (overrides the universal footer in the shared spec)

`Generated by /cti-monthly-report-tactical-australia | Senior CTI Analyst — Tactical | TLP:<level> | <reporting window>`

## Skill-specific quality additions

Beyond the universal quality bar in `_lib/report-spec.md`:

- Acronyms expanded on first use: ACSC, ASD, SOCI, KEV, CVSS, CVE, APRA, OAIC, MITRE ATT&CK, E8, NIST CSF, EPSS, SSVC.
