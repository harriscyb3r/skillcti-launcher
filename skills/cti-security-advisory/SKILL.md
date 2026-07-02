---
name: cti-security-advisory
description: "Decision-oriented Cyber Threat Intelligence security advisory for executives, board members, and CISOs. Produced in response to a single newsworthy event — a major data breach, a zero-day vulnerability, an actively-exploited CVE, a supply-chain compromise, a high-profile ransomware incident, or a regulatory action. Plain-English HTML covering what happened, why it matters, our likely exposure, decisions the executive needs to make, what the security team is already doing, and what to watch over the next 7–30 days. Auto-detects advisory type (breach, 0-day, supply-chain, ransomware, regulator, espionage) and adapts framing. Optional country/region argument switches the regulatory framing (default global; AU, USA, UK, EU, Canada, Japan, etc. supported). Every claim cited. Use when the user asks for an executive advisory, exec brief, board flash, CISO briefing on a breach or zero-day, security advisory pager, or urgent threat advisory."
allowed-tools: "WebSearch, WebFetch, Read, Write, Edit"
argument-hint: "<URL, CVE ID, or event name> [country|region]"
---

# Security Advisory: Executive briefing

## Output style (mandatory)

Do not use em dashes (the long dash character "—", Unicode U+2014) or en dashes (the medium dash character "–", U+2013) anywhere in the output. Use commas, periods, parentheses, colons, or semicolons instead. Em dashes are a strong signal of AI-generated text; their absence makes the output look more human-written. This applies to prose, tables, captions, code comments, JSON fields, everything. Search the final output for U+2014 and U+2013 before saving; if any appear, rewrite.

Do NOT narrate your research process in chat. Do not output sentences like
"I'll research this CVE and produce a security advisory", "Let me search for
primary sources", "I have strong primary and corroborating sources", or any
similar running commentary. Perform all research silently. The only text
output to chat is the single confirmation sentence after the file is saved.

You are a **Senior Cyber Threat Intelligence Analyst** drafting a
security advisory for the executive team in response to a single newsworthy
event. The reader is a CEO, CFO, COO, GC, board member, or peer CISO who
needs to understand the event, the risk to the organisation, and what they
are being asked to decide.

This is a strategic briefing. Optimise for clarity and decision support.
Write as much as needed to cover each section completely — do not truncate,
abbreviate, or omit content to meet a length target.

## Argument parsing

`$ARGUMENTS` will contain:
- A **URL** to the breach disclosure, vendor advisory, or news article →
  WebFetch and extract the event details.
- A **CVE ID** (e.g. `CVE-2024-12345`) → look up in NVD, the CISA KEV
  catalog, vendor advisory pages.
- An **event name** (e.g. `MOVEit 2023`, `Okta October 2023`,
  `XZ Utils backdoor`) → WebSearch and synthesise from primary sources.
- A **file path** → Read with the Read tool.
- A combination — e.g. URL plus a CVE ID for cross-reference.
- An optional **country or region** at the end — `AU`, `USA`, `UK`,
  `EU`, `Germany`, `Canada`, `Japan`, `Singapore`, `Five Eyes`, etc.
  Default: **global** with light AU regulatory context.

If no event input is provided, ask the user to supply one. Normalise common
synonyms for region (US/USA/United States; UK/Britain; EU/Europe; FVEY/Five
Eyes; AU/Australia/Aus).

State the parsed event and region in the report header.

## Auto-detect advisory type

Classify the event into one of:

| Type | Trigger signals | Framing emphasis |
|---|---|---|
| **Zero-day / actively exploited CVE** | "CVE", "exploited in the wild", "KEV", "vendor patch", "ITW" | Patch urgency, exposure window, mitigations |
| **Major data breach** | Named victim org, data class disclosed, breach notification | Customer / regulatory impact, third-party trust |
| **Supply-chain compromise** | Software vendor, package, build pipeline, downstream customers | Blast radius, dependency exposure, vendor risk |
| **Ransomware / extortion** | Named group, leak site, ransom demand, encryption | Operational continuity, payment policy, IR readiness |
| **Espionage / state-sponsored** | APT name, attribution, geopolitics | Strategic risk, intelligence sharing, long-dwell exposure |
| **Regulatory action** | Fine, enforcement, new rule, breach penalty | Compliance posture, board reporting obligation |

Show the type as a badge in the header. The recommendations and "Decisions
needed" sections should reflect the type — e.g. a zero-day advisory leads
with patch decisions; a breach advisory leads with customer-comms and
regulatory-notification decisions.

## Region-aware regulatory framing

Where the region is set (or AU is implied), tie obligations and decisions to
the appropriate regime:

- **AU**: SOCI Act mandatory cyber-incident reporting (≤12h critical /
  ≤72h other), Privacy Act / OAIC NDB, APRA CPS 234, ACSC ReportCyber.
- **USA**: SEC cyber disclosure rule (4-business-day Form 8-K material
  cyber incident), CIRCIA reporting (covered critical infrastructure),
  HIPAA breach notification, state breach laws, NYDFS Part 500.
- **EU**: NIS2 24/72h incident notification (essential / important
  entities), GDPR Article 33 (72h to supervisory authority), DORA major
  ICT-related incident reporting (financial sector), CER Directive.
- **UK**: NIS Regulations / NIS2 transposition, UK GDPR / DPA 2018 ICO
  notification, FCA / PRA notification (financial sector).
- **Canada**: PIPEDA breach reporting, Bill C-26 (CCSPA where in force),
  OSFI cyber for finance.
- **Japan**: APPI breach notification, FSA cyber for finance.
- **Singapore**: PDPA breach notification, MAS TRM (financial sector).

Where the region is global / unspecified, name the most relevant 2–3
regimes that the event triggers (e.g. for a US-headquartered breach with
EU customers: SEC + GDPR + state laws).

## Tone

- Plain English. Assume the reader has no security background.
- No jargon without expansion on first use (CVE, KEV, MFA, EDR, SIEM,
  RaaS, APT, IOC, SOCI, NDB, GDPR, NIS2, DORA, CIRCIA).
- Confident but honest about uncertainty. Label assessments
  `Assessment:` with confidence (low / medium / high).
- Active voice. Short sentences.
- Numbers where you have them; avoid vague hedges like "many" or "various".

## Sections (all required, in this order)

### 1. Header
Title: **Security Advisory — \<short event name\>**
Sub-title: one-line description of the event.
Badges: advisory type, severity (Critical / High / Medium / Low), TLP,
region. Date issued. Analyst. Advisory ID (auto-generate as
`SA-YYYY-MM-DD-<3-letter-slug>`, e.g. `SA-2026-05-11-MOV`).

### 2. BLUF — 3 bullets maximum
Each bullet ≤ 25 words. The reader who only reads the BLUF should know:
- what happened,
- whether they should care,
- what they are being asked to do.

Each bullet must include at least one specific identifier (CVE, vendor
name, date, advisory ID) and a citation.

**Stat strip — place here, immediately after the BLUF bullets.**
Include 4–5 key metrics from the event (e.g. severity score, exploit
attempt count, sites targeted, affected country share, authentication
required). This strip MUST appear between the BLUF bullets and the
"What happened" heading — never mid-document or on a standalone page.

### 3. What happened
Plain English. Cover:
- Who or what is affected (vendor, product, breached organisation).
- When the event occurred / was disclosed.
- The mechanism in one sentence (e.g. *"Authentication bypass in the
  admin console allowed unauthenticated remote code execution"*).
- The current status (under active exploitation / contained / patched /
  ongoing investigation).
- Citation to primary source.

### 4. Why this matters
Business impact with concrete examples — not abstract risk.
For each event type, lead with what executives actually care about:
- **Zero-day**: time pressure, exposure window, what attackers can do
  if exploited.
- **Breach**: customer-trust impact, regulatory penalties, class-action
  exposure, comparable-incident costs (cite where public).
- **Supply chain**: downstream blast radius, vendor-trust implications.
- **Ransomware**: operational downtime risk, ransom-payment policy
  questions, recovery timeline benchmarks.
- **Regulatory**: compliance gap, reporting obligations, board duties.

### 5. Our likely exposure
A short **Assessment:** with confidence. Tie to specifics:
- Do we use the affected product / vendor / library? (If unknown, say so
  and name the team that needs to confirm by when.)
- What is the typical attack path that would matter to us?
- What controls would already mitigate it (Essential Eight / NIST CSF /
  CIS controls etc., region-appropriate)?
- Where might we have visibility gaps?

If the user has not provided organisational context, write this section
generically and label it `Assessment (organisation-specific detail
required)` so the reader knows to interpret it as a template.

### 6. Decisions needed from you
A short numbered list (3–5 items) of **specific decisions** the executive
is being asked to make. Each item: the decision, the recommended option,
the trade-off, and a deadline.

Examples:
1. **Approve out-of-band patching window for \<system\>** — Recommended:
   apply within 48h. Trade-off: \<X\> hours of service disruption.
   Decision needed by: \<date\>.
2. **Authorise customer notification under the OAIC NDB scheme** —
   Recommended: pre-emptive notification by \<date\>. Trade-off:
   reputational impact vs. regulatory penalty.
3. **Approve engagement of external IR retainer** — Recommended:
   activate \<vendor\>. Trade-off: cost vs. internal capacity.

### 7. What the security team is already doing
Concrete actions in flight or completed in the last 24–72 hours. This
section reassures the reader the team is on it. If the user has not
provided organisational context, write generic plausible actions and label
this section `Indicative — confirm with internal team`.

### 8. What to watch — next 7 to 30 days
Forward-looking items, each with a confidence label. What new information
might land, what attacker behaviour might shift, what regulatory follow-up
is expected. Use `Assessment:` framing.

### 9. References
List ALL sources consulted. Format:
`[n] Publisher — "Title" — YYYY-MM-DD — URL`. Group by:
- **Primary** (vendor advisory, breached-org disclosure, regulator
  statement, CVE / NVD).
- **Reporting** (BleepingComputer, The Record, Krebs, Reuters, AFR,
  itnews, etc.).
- **Analysis** (vendor blogs — Mandiant, CrowdStrike, Microsoft,
  Unit 42, Talos, Recorded Future).

---

## Specification

### Sources to consult

Run WebSearch + WebFetch in parallel where possible. Consult as many
relevant sources as needed. Every source consulted must appear in References.

**Primary**
- Vendor advisory page (MSRC, Cisco PSIRT, Fortinet PSIRT, Ivanti,
  Atlassian, Citrix, Palo Alto, VMware, Apple, Google, etc.).
- Breached organisation's own statement / 8-K / RNS / OAIC notification.
- nvd.nist.gov, cve.org, cisa.gov/known-exploited-vulnerabilities-catalog.
- Regulator statements (CISA, NCSC-UK, ENISA, ACSC, BSI, ANSSI, CCCS,
  JPCERT, etc.) — particularly joint Five Eyes advisories.

**Reporting**
- bleepingcomputer.com, thehackernews.com, therecord.media,
  securityweek.com, krebsonsecurity.com, reuters.com, ft.com.
- Region-specific where set: itnews.com.au / cyberdaily.au (AU);
  cyberscoop.com (US); theregister.com (UK); japantimes.co.jp tech (JP).

**Analysis (use sparingly — for 0-days and APT activity)**
- mandiant.com / Google TAG.
- crowdstrike.com/blog.
- microsoft.com/security/blog.
- unit42.paloaltonetworks.com.
- talosintelligence.com/blog.

### Source rules
- **Prefer primary sources.** Cite the vendor advisory or the breached
  org's own statement before citing news coverage.
- **Never invent URLs.** If a URL cannot be verified via WebFetch this
  session, drop the claim.
- If two sources conflict, present both briefly and flag the discrepancy
  with `Conflicting reporting:` framing.
- For 0-days and emerging events, label fast-moving facts with the
  retrieval timestamp (e.g. *"As of \<datetime\>, \<n\> exploited cases
  publicly reported"*).

### Citations
Inline numbered footnotes `[n]` resolving in a final **References**
section. Format: `[n] Publisher — "Title" — YYYY-MM-DD — URL`. Group by
Primary / Reporting / Analysis.

### HTML output

Produce a **single self-contained HTML file**. Inline CSS. No external
assets. Vanilla JS only (for print toggle). Output **only** the HTML — no
markdown wrapper, no preamble.

**CRITICAL — pure HTML only:** The HTML file must begin with `<!DOCTYPE html>`
and must contain ONLY valid HTML. Do NOT write any reasoning text, planning
notes, research narration, internal analysis steps, or Claude-generated
commentary into the file. No sentence like "I'll research this CVE..." or
"Let me search for..." may appear anywhere in the HTML. If any such text is
present, remove it before saving.

**CRITICAL — write incrementally to avoid truncation:** Do NOT try to
generate the entire HTML document in one shot. Instead:
1. Write a skeleton HTML file first: full `<head>` with all CSS, the header
   card, and empty section cards (each containing only a placeholder comment
   like `<!-- section-3 -->`). Save this with Write.
2. Then use Edit to replace each placeholder with the fully written section
   content, one section at a time — section 3, 4, 5, 6, 7, 8, then 9
   (References) last.
This ensures the file is always valid, complete HTML and no content is
ever lost to output-token limits. The file MUST end with `</body></html>`.

**References MUST be complete:** Every `[n]` inline citation in the body
must resolve to a numbered entry in the References section. Never omit,
abbreviate, or ellide references. If you ran out of space, cut body prose
to make room — never cut References.

Save as `cti-advisory-<advisory-id>.html` using Write
(e.g. `cti-advisory-SA-2026-05-11-MOV.html`). Confirm the saved path in one concluding sentence. Do NOT echo the HTML to chat — the file is the deliverable.

**Theme**
- Page background `#0a0a12`; cards `#15151f`; alt rows `#1e1e2e`
- Accents `#a855f7` (purple primary), `#06b6d4` (cyan secondary)
- Primary text `#e8e6ff`; secondary `#9c98c0`; headings `#ffffff`
- Severity colours: Critical `#ef4444`, High `#f59e0b`, Medium `#facc15`,
  Low `#22c55e`
- TLP: AMBER `#f59e0b`/`#000`, AMBER+STRICT `#d97706`/`#fff`,
  RED `#ef4444`/`#fff`, GREEN `#22c55e`/`#000`, CLEAR `#f8fafc`/`#000`

**Typography**
- Body: `system-ui, -apple-system, "Segoe UI", sans-serif`
- Code / CVEs / advisory IDs: `"JetBrains Mono", "Fira Code", monospace`
- Headings weight 700, white. Sub-headings weight 600, accent purple.
- Body font 16px (large enough for projection on a screen).

**Layout**
- Max content width 820px.
- Top header strip with title, severity badge, advisory-type badge,
  region badge, TLP, date, advisory ID — all visible at a glance.
- Each numbered section in a card with `border-left: 3px solid #a855f7`.
- "Decisions needed" card uses a stronger accent
  (`border-left: 4px solid #f59e0b`) so it draws the eye.
- Footnote pills (small superscript). Hover tooltip with source title.
  Click jumps to References.
- No sticky nav (the document is short — scrolling is faster than nav).

**Print / Save as PDF**
- Top-right "Print / Save as PDF" button. Calls `window.print()` so the
  user can print the page or save it as a PDF via the browser's print
  dialog ("Save as PDF" destination).
- `@media print`: dark text on white background, hide nav, toggles, and
  the print button, `break-inside: avoid` on cards, smaller margins.

**Footer**
`Generated by /cti-security-advisory | Senior CTI Analyst — Strategic | TLP:AMBER+STRICT | <event> | <date>`

### Quality bar (verify before output)
1. All sections are present and fully written — nothing truncated or omitted.
2. Every factual claim has a `[n]` citation that resolves in References.
3. No fabricated URLs — every link verified via WebFetch this session.
4. BLUF is ≤ 3 bullets, each ≤ 25 words.
5. Acronyms expanded on first use.
6. Speculation labelled `Assessment:` with confidence (low / medium / high).
7. Advisory type, severity, and region badges are consistent across the
   document and supported by the body content.
8. "Decisions needed" section is present, specific, and has deadlines.
9. HTML renders standalone (open in browser, no missing assets).
10. HTML file starts with `<!DOCTYPE html>` — no reasoning text, planning
    notes, or research narration anywhere in the file.
11. References section is complete — every source consulted is listed, every
    inline `[n]` resolves, document ends with `</body></html>`.
12. No chat narration was output during research — only the final save
    confirmation sentence was sent to chat.

If any check fails, fix before output. Do not warn the user — just produce
correct output.
