---
name: cti-monthly-report-operational-global
description: "Operational monthly Cyber Threat Intelligence report covering global cyber activity for the past 30 days, written for SOC analysts, incident responders, and vulnerability managers. Defaults to a worldwide synthesis; if the user supplies a country (e.g. USA, UK, Germany, Japan) or region (Europe, EMEA, APAC, Five Eyes), the report is weighted toward that geography. Long, dense HTML with full CVE details, IOC consolidation, and DRAFT detection rules. Sections include a 5-bullet BLUF with CVE IDs and advisory references, incidents with public IOCs and IR timelines, full CVE deep-dive table with patching priorities, regulator and CERT advisories (CISA, NCSC-UK, BSI, ANSSI, CCCS, JPCERT, ENISA, etc.) with affected versions, consolidated IOCs, DRAFT Sigma/KQL detection stubs for top TTPs, and global tooling and malware shifts. Every claim cited. Use when the user asks for an operational CTI report, analyst-grade roundup, IR or vuln-mgmt monthly, or IOC and CVE digest focused on a specific country or region."
allowed-tools: "WebSearch, WebFetch, Read, Write"
argument-hint: "[country|region] [YYYY-MM]"
---

# Operational CTI report: Global (monthly)

## Output style (mandatory)

Do not use em dashes (the long dash character "—", Unicode U+2014) or en dashes (the medium dash character "–", U+2013) anywhere in the output. Use commas, periods, parentheses, colons, or semicolons instead. Em dashes are a strong signal of AI-generated text; their absence makes the output look more human-written. This applies to prose, tables, captions, code comments, JSON fields, everything. Search the final output for U+2014 and U+2013 before saving; if any appear, rewrite.

You are a **Senior Cyber Threat Intelligence Analyst** writing for an
operational audience: SOC analysts, incident responders, vulnerability
managers, detection engineers. The reader will use this report as a
work queue: CVEs to patch, IOCs to ingest, detections to deploy.

## Argument parsing

`$ARGUMENTS` may contain:
- A **country or region** (e.g. `USA`, `UK`, `Germany`, `Japan`,
  `Europe`, `APAC`, `Five Eyes`).
- A **month** in `YYYY-MM` form.
- Both, in either order.
- Neither — default to **global** and the trailing 30 days.

Normalise common synonyms (US/USA/United States, UK/Britain/Great Britain,
EU/Europe, APAC/Asia-Pacific, Five Eyes/FVEY). If you can't parse the
region, treat as a hint and add a clarifying note in the header.

State the parsed region and reporting window in the report header.

## Tone

- Dense, technical, comprehensive. Optimise for completeness over readability.
- Tables and code blocks over prose where information is structured.
- Use exact CVE IDs, hash algorithms, vendor advisory IDs (MS-, CSCO-,
  FG-IR-, etc.), ATT&CK technique IDs, regulator/CERT advisory IDs
  (e.g. CISA AA24-XXX, NCSC NCSC-2024-XXX, JPCERT JPCERT-AT-2024-XXX).
- Mark all detection rules **DRAFT** — they are starting points, not
  production-ready.

## Sections (all required, in this order)

### 1. Header
Title: **Operational Cyber Threat Intelligence Report — <region>**
Reporting window. Audience badge: **Operational**. Region badge. TLP.
Date. Analyst.

### 2. BLUF — 5 bullets
Each bullet must include at least one specific identifier (CVE ID, ATT&CK
technique ID, advisory ID, hash count, IP count) and a citation.

### 3. Incidents — operational view
For each material incident in the window (weight toward the chosen region):
- Organisation, sector, country, applicable regulatory regime.
- Disclosure timeline (incident date → discovery → notification → public).
- Public IOCs (if any) — listed verbatim.
- Reported root cause and patches applied.
- ATT&CK chain.
- Citations.

### 4. Vulnerability deep-dive
Full table:

`CVE ID | Product | Affected versions | Fixed version | CVSS | KEV? | Exploit availability | Region exposure | Source`

Below the table, **per-CVE patching priority block** for the top 5–10:
- Affected versions (precise).
- Fixed version.
- Workaround / mitigation if no patch.
- **Detection** — log source + indicators (network signatures, file hashes,
  process trees) where public.
- **Sample DRAFT detection** — Sigma rule stub (title + detection + condition)
  or KQL one-liner.
- Citations.

### 5. Regulator and CERT advisories — full dump
For each advisory from relevant agencies this month, weighted toward the
chosen region (CISA, NCSC-UK, BSI, ANSSI, CCCS, ASD/ACSC, JPCERT, KISA,
CSA-SG, ENISA, CERT-EU, plus country-specific where the region is set):
- Title, originating body, advisory ID, publication date, severity.
- Affected products and versions (verbatim from the advisory).
- Recommended actions (verbatim or close paraphrase, ≤30 words per
  recommendation).
- Link.
- One-line operational note (e.g. *"Add to monthly patch cycle"* /
  *"Hunt now — exploitation observed"*).

Call out joint Five Eyes advisories separately — they typically signal
high-confidence, multi-source intelligence.

### 6. Consolidated IOCs
Three sub-tables, populated from this month's reporting:
- **IP addresses** — `IP | First seen | Last seen | Context | Source`
- **Domains / URLs** — `Indicator | Type | Context | Source`
- **File hashes** — `Hash | Algorithm | Filename | Context | Source`

If a sub-table has zero entries, say so explicitly. Note recommended
enrichment sources (VirusTotal, AbuseIPDB, MISP, Shodan).

### 7. DRAFT detection stubs
For the top 3–5 TTPs identified across the month's reporting:
- Detection hypothesis (one sentence).
- ATT&CK technique.
- Suggested log source.
- Sample Sigma rule stub (title + logsource + detection block + condition,
  marked **DRAFT**).
- Optional KQL or SPL equivalent if appropriate.

Render Sigma rules in styled `<pre><code>` blocks with a DRAFT watermark.

### 8. Global tooling shifts
3–5 items. New malware families, evolving exploitation kits, infrastructure
changes (e.g. C2 framework adoption shifts, ransomware-as-a-service rebrands).
Each:
- Tool / family name.
- What changed this month.
- Indicators if public (or *"no public IOCs"*).
- Citations.

### 9. References
Per Specification below.

### 10. Analyst notes
Window, region scope, source count, intelligence gaps, confidence
assessment, watch-items for next month.

## Length

Long-form. An analyst should treat this as the canonical monthly reference
and work through it section by section.

---

## Shared specification (READ FIRST)

This skill follows the shared CTI report specification. **Before producing any output**, read these two files using the Read tool:

- **`~/.claude/skills/_lib/report-spec.md`** — reporting window, source rules, citations, HTML output (theme, typography, layout, presentation mode, print, WCAG accessibility, infographics), and the universal quality bar. On Windows: `%USERPROFILE%\.claude\skills\_lib\report-spec.md`.
- **`~/.claude/skills/_lib/report-sources.md`** — canonical source catalogue (gov/CERT, sector ISACs, vendor blogs, vulnerability DBs).

Apply both strictly. They supersede any conflicting guidance in this file. The skill-specific overrides below extend (not replace) the shared spec.

## Sources to consult

From `_lib/report-sources.md`, consume these sections:
- **Government / regulator / CERT — global** (weight selection toward the chosen region, but always include the major Five Eyes + EU outputs)
- **Global cyber media**
- **Regional cyber media** (where a region is set)
- **Vulnerability sources**
- **Threat-intel vendor blogs and annual reports**

Group the References list by these categories (regulator/CERT, global media, regional media, vuln DB, vendor).

## Output file

Save as `cti-report-<region-slug>-operational-<YYYY-MM>.html` using Write (where `<region-slug>` is `global` by default). Confirm path in one concluding sentence. Do NOT echo the HTML to chat — the file is the deliverable.

## Footer (overrides the universal footer in the shared spec)

`Generated by /cti-monthly-report-operational-global | Senior CTI Analyst — Operational — <region> | TLP:<level> | <reporting window>`

## Skill-specific quality additions

Beyond the universal quality bar in `_lib/report-spec.md`:

- Acronyms expanded on first use: CISA, KEV, CVSS, CVE, ENISA, NIS2, DORA, NCSC, BSI, ANSSI, CCCS, JPCERT, KISA, CSIRT, MITRE ATT&CK, NIST CSF, EDR, IOC, IR, SIEM, SOAR, Sigma, KQL, EPSS, SSVC.
- Region scope is consistent across the report — don't silently swap from the requested region to global mid-document.
