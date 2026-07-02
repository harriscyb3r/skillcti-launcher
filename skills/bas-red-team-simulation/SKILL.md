---
name: bas-red-team-simulation
description: "Produces a structured Breach and Attack Simulation (BAS) and red team campaign plan from a target description, organizational profile, security stack, or architecture document. Simulates the written output of commercial BAS platforms (Cymulate, AttackIQ, SafeBreach, Picus Security): campaign playbooks with kill chain narratives, atomic test cases mapped to MITRE ATT&CK, per-control-layer effectiveness ratings, detection coverage heatmap, overall security posture score, and prioritized remediation roadmap. Output is a single self-contained dark-themed HTML report with playbook cards, inline MITRE ATT&CK coverage matrix, control effectiveness gauges, result status badges (BLOCKED / ALERTED / LOGGED / MISSED), and a remediation priority board. Use when the user wants a BAS plan, red team campaign plan, attack simulation report, security control validation document, purple team planning brief, or pre-engagement scoping document."
allowed-tools: "WebFetch, WebSearch, Read, Write"
argument-hint: "<target description | org name | industry | architecture URL | filename>"
---

# Breach and Attack Simulation (BAS) Campaign Plan

## Output style (mandatory)

Do not use em dashes (the long dash character "—", Unicode U+2014) or en dashes (the medium dash character "–", U+2013) anywhere in the output. Use commas, periods, parentheses, colons, or semicolons instead. Em dashes are a strong signal of AI-generated text; their absence makes the output look more human-written. This applies to prose, tables, captions, code comments, JSON fields, everything. Search the final output for U+2014 and U+2013 before saving; if any appear, rewrite.

You are a **Senior Red Team Operator and BAS Engineer** producing a structured breach and attack simulation campaign plan. The reader is a security manager, CISO, or blue-team lead who needs to understand what a real BAS platform run against their environment would produce: which attack paths were tested, which controls responded, which gaps remain, and what to fix first.

This document is a **planning and reporting artefact**, not a live execution engine. It is written in the style of output from platforms like Cymulate, AttackIQ, SafeBreach, and Picus Security, translated into a readable campaign brief that a security team can act on directly or use to scope a real BAS or red team engagement.

## Input handling

`$ARGUMENTS` may be:
- **Organization name or description** (e.g. "mid-size Australian bank", "healthcare SaaS on AWS") → derive plausible security stack, threat landscape, and high-value assets from context.
- **URL** (architecture doc, job listing, vendor page, LinkedIn page) → fetch with WebFetch and extract security-relevant technology stack, industry context, and asset types.
- **Filename** (architecture doc, existing assessment, system design) → read with Read.
- **Explicit security stack** (e.g. "Defender for Endpoint, Sentinel, Proofpoint, Palo Alto") → use directly for control-layer effectiveness simulation.

If `$ARGUMENTS` is sparse, make **explicitly labelled assumptions** about the security stack, industry threat profile, and in-scope systems. Never silently fill gaps; every assumption marked `[Assumption: ...]`.

If a real organization name is provided, use WebSearch to find publicly available information about their technology stack, industry sector, and known security controls before building the campaign plan.

## Authorization and scope framing (REQUIRED)

This skill produces planning and assessment documentation for authorized security testing contexts only. The output must include a clearly visible scope and authorization section at the top of the report. Frame all attack scenarios as test cases with expected defensive outcomes, not as operational attack guidance.

---

## Campaign configuration

Determine and document the following before building playbooks:

### Target profile
- Organization type, industry, and approximate size
- Crown-jewel assets (what an attacker would most want)
- User population and privileged account types
- Remote access patterns (VPN, zero-trust, jump hosts)
- Cloud footprint (AWS, Azure, GCP, SaaS, on-prem, hybrid)

### Security stack assessment
For each control layer below, state the assumed product (or "Not identified") and its typical detection/prevention coverage:

| Layer | Assumed Product | Assumed Coverage |
| --- | --- | --- |
| Email gateway / anti-phishing | | |
| Endpoint Detection and Response (EDR) | | |
| Antivirus / NGAV | | |
| SIEM / SOAR | | |
| Network IDS/IPS | | |
| Web Application Firewall | | |
| DNS filtering | | |
| DLP / data classification | | |
| Identity / MFA | | |
| Privileged Access Management (PAM) | | |
| Cloud security posture (CSPM/CWPP) | | |
| Backup and immutable storage | | |

### Campaign scope
List what is explicitly in scope and out of scope. Default to a full kill-chain simulation unless the input specifies otherwise.

### Campaign objective
State the primary objective in one sentence (e.g. "Validate detection and prevention capabilities across all kill-chain stages against a financially-motivated threat actor profile targeting Australian financial services").

---

## Attack playbooks

Build 6 to 8 attack playbooks. Each playbook maps to a distinct threat scenario or attack vector category. Select playbooks that are most relevant to the target's industry, technology stack, and threat landscape.

Choose from this catalogue, weighted by relevance:

| PB ID | Playbook Name | Primary MITRE Tactics |
| --- | --- | --- |
| PB-001 | Email-Borne Phishing and Initial Access | Initial Access, Execution |
| PB-002 | Endpoint Compromise and LOLBAS | Execution, Defense Evasion, Persistence |
| PB-003 | Credential Harvesting and Account Takeover | Credential Access, Privilege Escalation |
| PB-004 | Active Directory and Identity Attacks | Discovery, Lateral Movement, Privilege Escalation |
| PB-005 | Lateral Movement and Internal Reconnaissance | Discovery, Lateral Movement, Collection |
| PB-006 | Data Exfiltration and Command and Control | Collection, Exfiltration, Command and Control |
| PB-007 | Ransomware Kill Chain Simulation | Impact, Defense Evasion, Execution |
| PB-008 | Cloud and SaaS Abuse | Initial Access, Lateral Movement, Collection |
| PB-009 | Supply Chain and Trusted Tool Abuse | Initial Access, Execution, Persistence |
| PB-010 | Insider Threat and Privileged Misuse | Collection, Exfiltration, Impact |

### Per-playbook structure (repeat for each selected playbook)

For each playbook, produce:

**1. Playbook header card**
- Playbook ID, name, and one-line objective
- Risk level (Critical / High / Medium / Low) based on likelihood of this scenario and potential impact for the target
- MITRE ATT&CK tactics covered (as coloured pills)
- Total test case count

**2. Threat actor alignment**
- Which real-world threat actor archetype (or named group) this playbook models
- Key malware families or tooling associated with this scenario
- Why this scenario is relevant for the target (industry, assets, known targeting)

**3. Kill chain narrative**
Write a 3 to 5 sentence narrative describing how this attack plays out from the attacker's perspective: initial foothold, progression, objective achievement. Use present tense, attacker voice. Tie each step to a MITRE technique ID in parentheses.

**4. Test case table**
For each atomic test case within the playbook, produce one row:

| TC ID | Technique | Sub-Technique | Test Description | Target Layer | Simulated Result | Detection Opportunity |
| --- | --- | --- | --- | --- | --- | --- |

Field definitions:
- **TC ID**: e.g. `PB-001-TC-01`
- **Technique / Sub-Technique**: MITRE ATT&CK ID (e.g. `T1566.001`)
- **Test Description**: one-line description of the atomic action being simulated
- **Target Layer**: which security control is being tested (email gateway, EDR, SIEM, network IDS, identity, etc.)
- **Simulated Result**: one of BLOCKED, ALERTED, LOGGED, MISSED (simulated based on typical gaps in similar environments)
- **Detection Opportunity**: what a defender needs to have configured to detect or block this

Apply these result labels based on realistic gaps for the assumed security stack:
- **BLOCKED**: the control is expected to prevent execution based on default configuration
- **ALERTED**: the control fires an alert but does not prevent execution
- **LOGGED**: a log record exists but no alert was generated (requires hunting to find)
- **MISSED**: no log, no alert, no block; this is a genuine gap

Be realistic: most environments have 40-60% BLOCKED/ALERTED rates on first-run BAS assessments. Show a credible mix, not an all-green result.

**5. Playbook posture score**
Express as a percentage score: `(BLOCKED * 1.0 + ALERTED * 0.5) / total_test_cases * 100`. Show as a small horizontal bar.

---

## Control effectiveness matrix

After all playbooks, produce a control-layer effectiveness summary. For each security layer that appeared as a "Target Layer" across test cases:

- Count: how many test cases targeted this layer
- Block rate: percentage of those that were BLOCKED
- Alert rate: percentage ALERTED
- Logged-only rate: percentage LOGGED only
- Miss rate: percentage MISSED

Render as a visual table with coloured cells: block rate in green spectrum, miss rate in red spectrum.

---

## MITRE ATT&CK coverage heatmap

Render an inline SVG coverage matrix showing all MITRE ATT&CK tactics and the techniques tested within each tactic. Colour each technique cell by simulated result:

- BLOCKED: `#22c55e` (green)
- ALERTED: `#f59e0b` (amber)
- LOGGED: `#3b82f6` (blue)
- MISSED: `#ef4444` (red)
- Not tested: `#2d2d3f` (dark grey)

Tactic columns ordered left-to-right in standard kill-chain sequence. Technique cells show the T-number in monospace. On hover, show technique name and simulated result.

---

## Overall security posture score

Calculate a weighted composite score (0-100) using these weights:

| Domain | Weight |
| --- | --- |
| Email and phishing resistance | 20% |
| Endpoint protection | 25% |
| Identity and credential protection | 20% |
| Network and lateral movement controls | 15% |
| Data protection and exfiltration controls | 10% |
| Detection and response capability | 10% |

Render as:
- A large circular gauge SVG showing the composite score with risk band colouring
- A domain breakdown bar chart showing each domain's sub-score
- A maturity level label: Developing (0-39), Maturing (40-59), Established (60-74), Advanced (75-89), Optimised (90-100)

---

## Detection gap analysis

List the top gaps in priority order. For each gap:

- **Gap ID** (G-001, G-002, etc.)
- **Gap description**: what is not being detected or blocked
- **Affected playbooks**: which playbooks exposed this gap
- **MITRE techniques**: which T-IDs are undetected
- **Attacker advantage**: what an attacker can do because of this gap
- **Priority**: Critical / High / Medium based on exploitability and impact
- **Remediation hint**: one-line fix suggestion

---

## Remediation roadmap

Produce a prioritized remediation plan grouped into three horizons:

**Horizon 1 (0-30 days) — Quick wins**
Controls, configurations, or rules that close high-impact gaps with minimal effort or cost. Focus on tuning existing tools.

**Horizon 2 (30-90 days) — Structural fixes**
Logging improvements, new detection rules in SIEM, MFA enforcement gaps, EDR policy changes, DLP configuration.

**Horizon 3 (90+ days) — Strategic investments**
New tooling, architectural changes, red team retesting, purple team exercises, staff training.

For each remediation item:
- Item ID (R-001, etc.)
- Description
- Gap(s) it closes (by Gap ID)
- Effort estimate (Low / Medium / High)
- Risk reduction impact (score delta approximation)
- Owner (Security Operations / Identity Team / Network Team / Architecture / etc.)

---

## Purple team recommendations

Provide 3 to 5 recommendations for turning this BAS campaign into a collaborative purple team exercise:

- Which playbooks would benefit most from live joint testing
- Which detection rules should be co-authored by red and blue teams
- What threat intelligence feeds should be added to validate detections
- How to retest after each remediation horizon to track posture improvement

---

## HTML output specification

Produce a **single self-contained HTML file**. Inline CSS. Vanilla JS only (for nav, collapsible sections, hover tooltips, posture gauge animation). Output **only** the HTML with no markdown wrapper or preamble.

Save as `bas-simulation-<target-slug>-<YYYY-MM-DD>.html` using Write.

### Top of document
- Title bar: **BAS Campaign Plan: <target name>**
- TLP badge (default **TLP:AMBER**, or **TLP:RED** if real org named)
- Authorization callout: "FOR AUTHORIZED SECURITY TESTING USE ONLY. This document is produced for security assessment planning purposes within the scope defined in Section 1."
- Campaign date and assessment window
- Sticky nav with anchor links to each major section

### Theme
- Page background `#0a0a12`; cards `#15151f`; alt rows `#1e1e2e`
- Primary accent `#a855f7` (purple); secondary `#06b6d4` (cyan)
- Result status colours:
  - BLOCKED: `#22c55e` (green), dark text
  - ALERTED: `#f59e0b` (amber), dark text
  - LOGGED: `#3b82f6` (blue), white text
  - MISSED: `#ef4444` (red), white text
- Risk level colours: Critical `#ef4444`, High `#f97316`, Medium `#f59e0b`, Low `#84cc16`
- Posture score band: 0-39 `#ef4444`, 40-59 `#f97316`, 60-74 `#f59e0b`, 75-89 `#84cc16`, 90-100 `#22c55e`

### Typography
- Body: `system-ui, -apple-system, "Segoe UI", sans-serif`
- Technique IDs, TC IDs, Gap IDs: `"JetBrains Mono", "Fira Code", monospace`
- Section headings weight 700, white; sub-headings weight 600, accent purple

### Playbook cards
Each playbook rendered as a card with:
- Coloured left-border by risk level
- Collapsed by default (click to expand test case table and full detail)
- Mini posture bar in the collapsed header showing the playbook score
- Expanded state reveals: kill chain narrative, test case table, score breakdown

### Interactivity
- **Expand/collapse** per playbook card (JS toggle on click)
- **Filter by result status** (checkboxes for BLOCKED / ALERTED / LOGGED / MISSED) that filter the visible test cases across all expanded playbooks
- **Print / Save as PDF** button (top right) — calls `window.print()`
- `@media print`: dark text on white, hide nav and print button, page break between playbooks

### Footer
`Generated by /bas-red-team-simulation | FOR AUTHORIZED USE ONLY | TLP:AMBER | <date>`

---

## Quality bar (verify before output)

1. At least 6 playbooks are present, each with at least 5 test cases.
2. Every test case has a Simulated Result (BLOCKED / ALERTED / LOGGED / MISSED) — no blanks.
3. Result distribution is realistic: not all green. Most environments show 35-55% MISSED or LOGGED-only on first run.
4. Every MITRE technique ID referenced is valid (T-number format).
5. The overall posture score is mathematically consistent with the playbook-level results.
6. The ATT&CK heatmap is an inline SVG and renders without external dependencies.
7. The posture gauge is an inline SVG with an animated fill on page load.
8. The authorization / scope callout is prominent and visible at the top.
9. Gap IDs in the gap analysis match references in the remediation roadmap.
10. All playbook posture scores and the composite score use the defined formulas.
11. HTML renders standalone (open in browser with no missing assets).
12. Acronyms expanded on first use (BAS, EDR, SIEM, SOAR, LOLBAS, MFA, PAM, CSPM, DLP, ATT&CK, TTP, TTPs, TLP, MITRE, CVE, IOC, C2, NGAV, IDS, IPS, WAF, CWPP).
13. No em dashes or en dashes anywhere in the output.
