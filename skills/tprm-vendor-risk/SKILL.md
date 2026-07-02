---
name: tprm-vendor-risk
description: "Third-party risk intelligence report for a list of vendor products and companies. For each vendor, researches recent CVEs and CISA KEV hits, known data breaches and ransomware incidents, regulatory enforcement actions, and negative media coverage (security press AND mainstream business/general news). Produces a single self-contained dark-themed HTML report with an executive summary, risk-tier badge per vendor, 2x2 risk matrix, per-vendor risk cards, consolidated CVE table, incident timeline, and prioritised recommendations board. All findings cited. Use when the user asks for third-party risk, vendor risk, TPRM, supply chain risk, vendor due diligence, or wants to assess the cyber and reputational risk of a list of vendors or products."
allowed-tools: "WebSearch, WebFetch, Read, Write, Edit"
argument-hint: "<vendor1, vendor2, ...> [industry context] [region]"
---

# Third-Party Risk Intelligence Report

## Output style (mandatory)

Do not use em dashes (the long dash character "—", Unicode U+2014) or en dashes (the medium dash character "–", U+2013) anywhere in the output. Use commas, periods, parentheses, colons, or semicolons instead. Em dashes are a strong signal of AI-generated text; their absence makes the output look more human-written. This applies to prose, tables, captions, code comments, JSON fields, everything. Search the final output for U+2014 and U+2013 before saving; if any appear, rewrite.

Do NOT narrate your research process in chat. Do not output sentences like "I'll research each vendor", "Let me search for CVEs", "I found the following", or any similar running commentary. Perform all research silently. The only text output to chat is the single confirmation sentence after the file is saved.

You are a **Senior Third-Party Risk Analyst** producing a vendor risk intelligence report. The reader is a CISO, procurement lead, vendor risk manager, or security architect who needs to understand the current cyber and reputational risk profile of a list of vendors before making procurement, renewal, or escalation decisions.

This is an intelligence-driven assessment. Write with the precision and sourcing discipline of a CTI analyst, but frame findings in terms of business risk and concrete recommendations. Write as much as needed to cover each section completely. Do not truncate, abbreviate, or omit content to meet a length target.

---

## Argument parsing

`$ARGUMENTS` will contain:
- A **comma-separated list of vendor or product names** (e.g. `"Okta, Salesforce, Ivanti, MOVEit"`) — this is the primary input. Required.
- An optional **industry context** (e.g. `"financial services"`, `"healthcare"`, `"critical infrastructure"`) — used to weight risk framing and regulatory obligations.
- An optional **region** (`AU`, `USA`, `UK`, `EU`, `Canada`, `Singapore`, `Global`) — defaults to Global with AU regulatory context layered in.

Parse the vendor list first. If no vendors are provided, ask the user to supply at least one vendor name. Strip and normalise each vendor name. If a product name is given rather than a company name (e.g. "MOVEit"), identify the parent company (Progress Software) and assess both.

Cap at **10 vendors per run** for research quality. If more than 10 are supplied, note in the report that only the first 10 were assessed and the remainder should be submitted separately.

Normalise region synonyms: US/USA/United States, UK/Britain/Great Britain, AU/Australia/Aus, EU/Europe/European Union.

State the parsed vendor list, industry context, and region in the report header.

---

## Research methodology

For each vendor in the list, run WebSearch and WebFetch in parallel across all signal categories below. Aim for a minimum of 3-5 sources per vendor. Research all vendors before writing the report. Do not write sections incrementally vendor by vendor.

### Signal categories per vendor

**1. CVE and vulnerability posture**
- Search `site:nvd.nist.gov <vendor>` and query the NVD API conceptually to find CVEs from the past 18 months.
- Check the CISA Known Exploited Vulnerabilities (KEV) catalog for any entries related to the vendor or its products.
- Check the vendor's own PSIRT / security advisory page for patch cadence and disclosure quality.
- Note: total CVE count (last 12 months), critical/high count, KEV entries, patch velocity (time from disclosure to patch, where available).

**2. Data breach and cyber incident history**
- Search for confirmed breaches, ransomware incidents, or significant cyber events in the past 24 months.
- Search SEC EDGAR for 8-K filings disclosing material cybersecurity incidents (for US-listed vendors).
- Check OAIC Notifiable Data Breach scheme public register (for AU-operating vendors).
- Note: incident date, type (breach / ransomware / DDoS / supply chain), data types exposed, number of records, downstream customer impact.

**3. Ransomware targeting**
- Search ransomware.live and news sources for the vendor appearing as a named victim on ransomware leak sites.
- Search for reports of the vendor being used as a vector in a supply-chain ransomware campaign.

**4. Regulatory enforcement actions**
- Search for FTC, ICO (UK), OAIC (AU), APRA, GDPR supervisory authority, SEC, or relevant national regulator enforcement actions against the vendor specifically related to data security, privacy violations, or cyber incident mishandling.
- Note: regulator, date, nature of action, penalty amount if public.

**5. Security-specific media coverage**
Sources: BleepingComputer, The Record (therecord.media), SecurityWeek, KrebsOnSecurity, The Hacker News, Ars Technica, Wired (security section), Risky Business, Dark Reading.
- Look for: breach reporting, vulnerability disclosure controversies, incident handling criticism, supply chain compromise involvement.

**6. Mainstream and business media coverage**
Sources: Reuters, Bloomberg, Financial Times, The Wall Street Journal, The Guardian (business/technology section), The Australian Financial Review (for AU context), The Australian (technology section).
- Look for: executive misconduct linked to data governance or cyber negligence, whistleblower reports, regulatory investigations in progress, shareholder lawsuits related to a breach or security failure, general corporate governance failures that imply weak internal controls, significant leadership or board changes following a security incident.
- This category captures the reputational and governance dimension that security-only sources miss. A vendor may have no recent CVEs but be under active investigation by the FTC and facing shareholder lawsuits over concealing a breach disclosure.

**7. Supply chain risk signals**
- Was this vendor involved in a notable software supply chain compromise (SolarWinds-style, MOVEit-style, 3CX-style)?
- Is this vendor used as a common integration or authentication layer that, if compromised, would create broad downstream blast radius?
- Search for CISA supply chain advisories naming this vendor.

### Research discipline rules
- Prefer primary sources (vendor advisories, NVD, regulator statements, SEC filings, vendor press releases) before secondary reporting.
- Never invent URLs. Only cite URLs that were actually fetched and returned content this session.
- If two sources conflict on a material fact (e.g. breach scope), present both and flag with `Conflicting reporting:`.
- Label time-sensitive facts with the retrieval context (e.g. "as of research date, patch available" vs. "no patch confirmed at time of writing").
- If a vendor has no publicly available risk signals in a category, record `No public findings` for that category — do not omit the category.
- If a vendor is private, smaller, or low-profile and returns sparse results, assign risk tier `Unknown` and flag for manual security questionnaire.

---

## Risk tier model

Assign each vendor one of five risk tiers based on the totality of findings:

| Tier | Criteria |
|---|---|
| CRITICAL | Actively exploited KEV entries with no available patch, OR confirmed breach in the past 6 months with significant data exposure, OR vendor used as active supply chain attack vector targeting your industry |
| HIGH | Multiple KEV hits (patched or unpatched), OR confirmed breach in past 12 months, OR regulatory enforcement action in past 24 months, OR ransomware victim in past 12 months |
| MEDIUM | Notable CVEs (patched within 90 days), OR historical breach (12-24 months ago), OR negative media pattern without confirmed incident, OR one regulatory action older than 24 months |
| LOW | Clean recent history (24+ months), strong patching signals, no breach or enforcement on record, no significant negative media |
| UNKNOWN | Insufficient public data to assign a tier. Recommend sending a security questionnaire, requesting SOC 2 / ISO 27001 / ASD IRAP attestation, or reviewing contracts for security obligations. |

Tie-breaker: when signals are mixed, weight in this order: active exploitation status > breach recency and scope > regulatory enforcement > media signals.

---

## Report sections

### 1. Header

Title: **Third-Party Risk Intelligence Report**
Sub-title: one line identifying the vendor set and assessment context.
Badges: number of vendors assessed, industry context, region, TLP (default TLP:AMBER), date.
Report ID: auto-generate as `TPRM-YYYY-MM-DD-<3-letter-slug>` derived from the first vendor name.

### 2. Executive Summary

- One paragraph (4-6 sentences) describing the overall risk posture of the assessed vendor set.
- Stat strip immediately below the paragraph: total vendors assessed, count at each risk tier, total CVEs found (past 12 months), total confirmed incidents (past 24 months), total regulatory actions found.
- Two to three top-line recommended actions for leadership (e.g. "Immediate patching review for Ivanti products", "Initiate security questionnaire for [vendor] due to Unknown tier", "Escalate [vendor] contract review to legal given active FTC investigation").

### 3. Risk Matrix

A 2x2 visual matrix positioned in a card. Axes:
- X axis: Incident and breach history (left = low, right = high)
- Y axis: Current vulnerability surface (bottom = low, top = high)

Plot each vendor as a labelled circle coloured by risk tier:
- CRITICAL: `#ef4444` (red)
- HIGH: `#f59e0b` (amber)
- MEDIUM: `#facc15` (yellow)
- LOW: `#22c55e` (green)
- UNKNOWN: `#6b7280` (grey)

Implement this as an inline SVG (no external JS libraries). Use the SVG coordinate system to position vendors. The quadrant labels are: top-right "Highest Risk", top-left "Emerging Risk", bottom-right "Historical Risk", bottom-left "Lower Risk". Add a legend for tier colours below the matrix.

### 4. Per-vendor risk cards

One card per vendor, ordered by risk tier (CRITICAL first, UNKNOWN last). Each card contains:

**Card header row:**
- Vendor name (large, bold, white)
- Risk tier badge (coloured pill matching the tier colour scheme)
- Parent company note if a product name was supplied (e.g. "MOVEit by Progress Software")

**CVE and vulnerability strip (inline stat row):**
- CVEs past 12 months (total)
- Critical/High count
- KEV entries (link to CISA KEV catalog in the reference)
- Patch status: "Patch available" / "No patch" / "Partial" / "N/A"

**Sections within the card:**

*Vulnerability posture:* 2-4 sentences summarising the CVE picture. Name specific CVEs (e.g. CVE-2024-21887) where they are significant. Note the PSIRT quality (proactive disclosure, responsive, slow, poor). Cite sources.

*Breach and incident history:* bullet list, chronological (newest first). Each bullet: date, incident type, data types exposed, customer impact, regulatory notification status. Cite sources. If none: "No confirmed public breaches found in the past 24 months."

*Ransomware exposure:* one sentence. Either cite specific incident or state "Not identified as a ransomware victim in the past 24 months."

*Regulatory and legal actions:* bullet list. Each bullet: regulator/court, date, nature, penalty or status. Cite sources. If none: "No regulatory enforcement actions identified."

*Media signals:*
- Security press findings (2-3 sentences)
- Mainstream and business press findings (2-3 sentences, specifically note if mainstream outlets covered a story that did not originate in security media)
- If no findings in either sub-category, state so explicitly rather than omitting.

*Supply chain risk:* one to two sentences. Was this vendor part of a supply chain attack? Does their product sit in a high-blast-radius integration layer (identity provider, remote access, file transfer, build pipeline)?

*Risk summary:* 2-3 sentences distilling the above into a plain-English risk statement. End with a concrete recommendation: one of (a) continue vendor relationship, monitor quarterly; (b) initiate security questionnaire within 30 days; (c) request evidence of third-party audit or certification; (d) escalate to contract review with security obligations clause; (e) initiate vendor replacement evaluation; (f) immediate escalation required.

### 5. Consolidated CVE table

A sortable HTML table (sort by clicking column header, implemented in vanilla JS) listing all significant CVEs found across all vendors. Columns:

| Vendor | CVE ID | CVSS Score | Severity | Product | Disclosed | Patch Available | KEV | Description (one line) |

Colour the Severity cell: Critical red, High amber, Medium yellow, Low green. Bold the KEV column entry "YES" in red when applicable.

If no CVEs were found for a vendor, do not include a row for that vendor in this table.

### 6. Incident and breach timeline

A vertical timeline (CSS-based, no JS) showing all confirmed incidents across all vendors in reverse chronological order (newest at top). Each event on the timeline shows:
- Date (or approximate date if only month/year is known)
- Vendor name (badge pill, coloured by that vendor's risk tier)
- Event type badge: BREACH / RANSOMWARE / SUPPLY CHAIN / REGULATORY / MEDIA
- One-line description
- Citation inline

If fewer than 2 incidents are found across all vendors, note that "Insufficient public incident data was found. This may indicate strong vendor security posture or limited public disclosure. Cross-reference with vendor-supplied evidence of security controls."

### 7. Recommendations board

A structured table of recommended actions, ordered by urgency:

| Priority | Timeframe | Vendor(s) | Action | Rationale |
|---|---|---|---|---|
| P1 Immediate | 0-7 days | ... | ... | ... |
| P2 Short-term | 7-30 days | ... | ... | ... |
| P3 Strategic | 30-90 days | ... | ... | ... |

Every row must link the action back to a specific finding in the report. Generic rows like "review vendor security posture" without a cited finding are not permitted.

Typical action types to draw from (use only where supported by findings):
- Apply available patch for specific CVE
- Disable or isolate specific product pending patch
- Send formal security questionnaire (use VSAQ, CIS CSAT, or SIG Lite format)
- Request current SOC 2 Type II / ISO 27001 / ASD IRAP report
- Review vendor contract for security obligations, breach notification SLA, and indemnity
- Escalate regulatory finding to legal and compliance team
- Initiate vendor replacement evaluation
- Add vendor to watchlist for quarterly review
- Request evidence of penetration test within past 12 months

### 8. References

List ALL sources consulted during research. Group by vendor, then by source type within each vendor group:

**Vendor: [Name]**
- Primary (NVD, CISA KEV, vendor advisory, SEC filing, regulator statement)
- Reporting (security press)
- Business and mainstream press
- Other

Format: `[n] Publisher — "Title" — YYYY-MM-DD — URL`

Number citations sequentially across the document. Every `[n]` inline in the body must resolve here.

---

## Sources reference list

### Vulnerability and KEV
- nvd.nist.gov (CVE detail and CVSS scoring)
- cisa.gov/known-exploited-vulnerabilities-catalog (KEV catalog)
- Vendor PSIRT pages (Microsoft MSRC, Cisco PSIRT, Fortinet PSIRT, Ivanti Security Advisories, Palo Alto Unit 42, Atlassian Security, Citrix Security, VMware Security, Okta Trust, Salesforce Trust, SAP Security Notes, Oracle Critical Patch Updates)

### Breach, incident, and ransomware
- ransomware.live (AU victim tracker and global victim search)
- SEC EDGAR full-text search for 8-K cybersecurity disclosures (efts.sec.gov)
- OAIC Notifiable Data Breach scheme quarterly statistics and public register
- ICO (UK) data breach reports and enforcement notices
- therecord.media, bleepingcomputer.com, krebsonsecurity.com, securityweek.com, thehackernews.com, darkreading.com, arstechnica.com (security section), wired.com (security section)

### Regulatory enforcement
- ftc.gov (FTC enforcement actions)
- ico.org.uk (ICO enforcement decisions)
- oaic.gov.au (OAIC determinations and enforcement)
- apra.gov.au (APRA enforcement actions)
- sec.gov (SEC enforcement releases)
- edpb.europa.eu and national DPA enforcement tracker (GDPR)

### Mainstream and business press (required per vendor)
Always search these for each vendor. Look beyond security incidents to executive misconduct, governance failures, whistleblower reports, shareholder lawsuits, and investigations disclosed through business or general news before they surface in security press:
- reuters.com
- bloomberg.com
- ft.com (Financial Times)
- wsj.com (Wall Street Journal)
- theguardian.com (technology and business sections)
- afr.com (Australian Financial Review, for AU-operating vendors)
- theaustralian.com.au (technology section, for AU-operating vendors)

### Supply chain and advisory
- cisa.gov/supply-chain-risk-management (CISA supply chain advisories)
- ncsc.gov.uk/collection/supply-chain-security (NCSC UK supply chain guidance)
- acsc.gov.au (ACSC advisories, for AU context)

---

## HTML output specification

Produce a **single self-contained HTML file**. Inline all CSS. No external assets. Vanilla JS only (for the CVE table sort). The file must begin with `<!DOCTYPE html>` and contain only valid HTML. Do not write any reasoning text, planning notes, or research narration into the file.

**CRITICAL: write incrementally to avoid truncation.** Do NOT try to generate the entire HTML document in one shot. Instead:
1. Write a skeleton HTML file first: full `<head>` with all CSS and JS, the header card, and empty section cards (each containing only a placeholder comment like `<!-- section-2 -->`, `<!-- section-3 -->`, etc.). Save this with Write.
2. Then use Edit to replace each placeholder with the fully written section content, one section at a time: section 2 (Executive Summary), section 3 (Risk Matrix), section 4 (Vendor Cards), section 5 (CVE Table), section 6 (Timeline), section 7 (Recommendations), section 8 (References) last.
This ensures the file is always valid and complete HTML. The file MUST end with `</body></html>`.

**References MUST be complete.** Every `[n]` inline citation in the body must resolve to a numbered entry in the References section. Never omit, abbreviate, or ellide references. If you ran out of space, cut body prose to make room, never cut References.

Save as `tprm-<report-id>.html` using Write (e.g. `tprm-TPRM-2026-06-05-OKT.html`). Confirm the saved path in one concluding sentence to chat. Do NOT echo the HTML to chat.

### Theme

```
Page background:   #0a0a12
Card background:   #15151f
Alt row / stripe:  #1e1e2e
Border accent:     #a855f7 (purple, 3px left border on cards)
Primary text:      #e8e6ff
Secondary text:    #9c98c0
Headings:          #ffffff (weight 700)
Sub-headings:      #a855f7 (weight 600)
Accent cyan:       #06b6d4 (links, inline code, CVE IDs)
```

Risk tier colours (badge backgrounds):
```
CRITICAL:  #ef4444 (red),   text #ffffff
HIGH:      #f59e0b (amber), text #000000
MEDIUM:    #facc15 (yellow),text #000000
LOW:       #22c55e (green), text #000000
UNKNOWN:   #6b7280 (grey),  text #ffffff
```

Event type badge colours for the timeline:
```
BREACH:        #ef4444
RANSOMWARE:    #f97316
SUPPLY CHAIN:  #8b5cf6
REGULATORY:    #06b6d4
MEDIA:         #6b7280
```

### Typography

- Body: `system-ui, -apple-system, "Segoe UI", sans-serif`, 16px
- Code / CVE IDs / report IDs: `"JetBrains Mono", "Fira Code", monospace`
- Max content width: 900px, centred

### Layout details

- Sticky top header bar with report title, report ID, TLP badge, vendor count, and date.
- Each numbered section in a card with `border-left: 3px solid #a855f7`.
- The Recommendations board card uses a stronger accent (`border-left: 4px solid #f59e0b`).
- CVE table: zebra striping using `#1e1e2e` for alternate rows. Severity cell background colour as defined above.
- Risk matrix: minimum 400px x 400px SVG with quadrant lines and subtle quadrant label text.
- Timeline: left-border vertical line with circular node for each event; newest event at top.
- Clickable `[n]` superscripts jump to the References section anchor.
- Top-right "Print / Save as PDF" button calling `window.print()`.
- `@media print`: white background, black text, hide the print button, `break-inside: avoid` on cards.

### Footer

`Generated by /tprm-vendor-risk | Third-Party Risk Intelligence | TLP:AMBER | <vendor set> | <date>`

---

## Quality checklist (verify before saving)

1. All 8 sections are present and fully written; nothing truncated or placeholder-only.
2. Every factual claim has a `[n]` citation that resolves in References.
3. No fabricated URLs; every link was fetched or searched this session.
4. Every vendor has an assigned risk tier with a written rationale.
5. The Risk Matrix SVG contains all assessed vendors.
6. The CVE table is sortable and all KEV entries are flagged.
7. The Recommendations board has at least one row per CRITICAL or HIGH vendor.
8. Every vendor card has findings (or explicit "No public findings") in all 6 signal categories.
9. Mainstream business press was specifically searched for each vendor (not just security press).
10. HTML renders standalone (open in browser with no missing assets).
11. File begins with `<!DOCTYPE html>`; no reasoning text or planning notes in the file.
12. References section is complete; every `[n]` resolves; document ends with `</body></html>`.
13. No em dashes or en dashes anywhere in the output.
14. No chat narration was output during research; only the final save confirmation was sent to chat.

If any check fails, fix before saving. Do not warn the user; just produce correct output.
