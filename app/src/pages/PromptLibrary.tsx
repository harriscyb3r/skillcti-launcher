import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/useToast'

// ── constants ─────────────────────────────────────────────────────────────────

const CUSTOM_KEY  = 'skillcti:prompt-library:custom'
const PENDING_KEY = 'skillcti:pending-prompt'

// ── types ─────────────────────────────────────────────────────────────────────

type Category =
  | 'All'
  | 'Threat Actors'
  | 'Investigation'
  | 'Detection Engineering'
  | 'Reporting'
  | 'Planning & Requirements'
  | 'Hunting'

interface LibraryPrompt {
  id: string
  title: string
  category: Exclude<Category, 'All'>
  description: string
  prompt: string
  tags: string[]
  isCustom?: boolean
}

interface FormState {
  id: string
  title: string
  category: Exclude<Category, 'All'>
  description: string
  prompt: string
  tags: string
}

// ── category styles ───────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<Exclude<Category, 'All'>, string> = {
  'Threat Actors':           'text-purple bg-purple/10 border-purple/30',
  'Investigation':           'text-cyan bg-cyan/10 border-cyan/30',
  'Detection Engineering':   'text-green bg-green/10 border-green/30',
  'Reporting':               'text-txt-2 bg-surface border-border',
  'Planning & Requirements': 'text-purple/80 bg-purple/5 border-purple/15',
  'Hunting':                 'text-red bg-red/10 border-red/30',
}

const CATEGORIES: Category[] = [
  'All',
  'Threat Actors',
  'Investigation',
  'Detection Engineering',
  'Reporting',
  'Planning & Requirements',
  'Hunting',
]

// ── storage ───────────────────────────────────────────────────────────────────

function loadCustom(): LibraryPrompt[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function saveCustom(prompts: LibraryPrompt[]) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(prompts)) } catch {}
}

// ── built-in prompts ──────────────────────────────────────────────────────────

const BUILTIN_PROMPTS: LibraryPrompt[] = [
  {
    id: 'b1',
    title: 'Threat Actor Profile',
    category: 'Threat Actors',
    description: 'Full intelligence profile with attribution, TTPs, campaigns, IOCs, and detection recommendations.',
    tags: ['APT', 'profiling', 'attribution', 'TTPs'],
    prompt: `Provide a comprehensive intelligence profile of [THREAT ACTOR NAME]. Structure your response as follows:

## Overview
- Attribution (nation-state, criminal, hacktivist, IAB) and confidence level
- Known aliases and tracking IDs (Mandiant, CrowdStrike, Microsoft naming conventions)
- Motivation and strategic objectives
- Active since / first observed
- Primary targeted sectors and geographies

## Capabilities & TTPs (MITRE ATT&CK)
Map their techniques across the full attack lifecycle with ATT&CK technique IDs:
- Initial Access (T1xxx)
- Execution, Persistence, Privilege Escalation
- Defense Evasion, Credential Access, Discovery, Lateral Movement
- Collection, C2, Exfiltration, Impact

## Toolset & Infrastructure
- Preferred malware families (custom vs. off-the-shelf)
- C2 infrastructure patterns and hosting preferences
- Domain registration and certificate patterns
- Known exploit preferences (CVE IDs where applicable)

## Notable Campaigns
For each of the top 3–5 attributed campaigns:
- Campaign name/codename, date range, targets
- Key TTPs and tooling used
- Outcome and significance
- Published IOC references

## Detection & Hunting Opportunities
- Most distinctive behavioural indicators for hunting
- Recommended log sources
- 2–3 Sigma rule stubs for highest-value techniques

## Recommendations
- Top 5 mitigations prioritised by effectiveness against this actor
- Intelligence gaps and suggested collection requirements`,
  },
  {
    id: 'b2',
    title: 'IOC Triage & Attribution',
    category: 'Investigation',
    description: 'Structured triage assessment for a set of IOCs including attribution, active status, and blocking priority.',
    tags: ['IOC', 'triage', 'attribution', 'incident response'],
    prompt: `Analyse the following indicators of compromise and provide a structured triage assessment:

[PASTE IOCs HERE — IPs, domains, URLs, hashes, email addresses]

For each indicator provide:

## Per-IOC Analysis
- **Indicator type** and format validation
- **Triage verdict**: Malicious / Suspicious / Clean / Unknown with confidence (High/Medium/Low)
- **Threat actor attribution** (if possible) with supporting evidence
- **Malware family / campaign** association
- **Active status** — is it still serving malicious content or has infrastructure been sinkholed/taken down?
- **First/last seen** dates from threat intel sources
- **Context** — what role does this IOC play (C2, payload delivery, phishing, exfiltration)?

## Aggregated Assessment
- Most likely threat actor or campaign cluster
- Confidence in attribution and key evidence points
- Recommended blocking priority (Critical / High / Medium / Low)
- Suggested SIEM/EDR detection rules for these specific indicators

## Evidence Gaps
- What additional information would increase attribution confidence?
- Recommended OSINT or platform queries to fill gaps`,
  },
  {
    id: 'b3',
    title: 'CVE Threat Landscape Assessment',
    category: 'Investigation',
    description: 'Exploitation risk, active threat actors, and detection opportunities for a specific CVE.',
    tags: ['CVE', 'vulnerability', 'exploitation', 'patching'],
    prompt: `Provide a comprehensive threat landscape assessment for [CVE-XXXX-XXXXX].

## Vulnerability Summary
- Affected products and versions
- Vulnerability class (e.g. RCE, LPE, SSRF, SQLi, auth bypass)
- CVSS v3.1 base score with vector string interpretation
- EPSS score and percentile (flag if you don't have current data)
- CWE classification

## Exploitation Context
- Is there a public PoC? When was it released relative to the patch?
- Evidence of exploitation in the wild — cite reports and dates
- Exploitation complexity and required conditions (auth required, network position, user interaction)
- CISA KEV listing status

## Threat Actor Activity
- Which threat actors or ransomware groups are known to exploit this CVE?
- Is it part of a commonly used initial access toolkit or exploitation framework?
- Associated campaigns or incidents (with dates and victim sectors)
- Any mass-exploitation events observed?

## Detection Opportunities
- Key log sources that would capture exploitation attempts
- Specific IoCs or behavioural signatures associated with exploitation
- Sigma rule stub for exploitation detection
- WAF/IDS rules if applicable

## Remediation Guidance
- Patch availability and recommended action (patch/mitigate/compensate)
- Workarounds or compensating controls if patching is not immediately possible
- Priority guidance based on asset exposure and known threat actor targeting`,
  },
  {
    id: 'b4',
    title: 'Malware Family Deep Dive',
    category: 'Investigation',
    description: 'Full intelligence profile of a malware family including capabilities, C2 architecture, and detection rules.',
    tags: ['malware', 'analysis', 'C2', 'detection', 'YARA'],
    prompt: `Provide a comprehensive intelligence profile of the [MALWARE FAMILY NAME] malware family.

## Classification & Overview
- Malware type (RAT, loader, infostealer, ransomware, wiper, botnet, etc.)
- First observed and development timeline
- Associated threat actors or criminal ecosystem (MaaS, private, nation-state)
- Target platforms and operating systems

## Infection Vector & Initial Access
- Primary delivery mechanisms (phishing, drive-by, supply chain, etc.)
- Typical lure themes and document types
- Exploitation of specific CVEs for initial delivery

## Technical Capabilities (MITRE ATT&CK IDs)
- Persistence mechanisms
- Privilege escalation techniques
- Defense evasion and anti-analysis techniques
- Credential harvesting capabilities
- Lateral movement methods
- Data collection and exfiltration

## C2 Architecture
- C2 protocol (HTTP/S, DNS, custom)
- Encoding and encryption of C2 communications
- Infrastructure patterns (hosting, DGA, fast-flux)
- Beacon interval and jitter behaviour

## MITRE ATT&CK Mapping
List all confirmed technique IDs across the full kill chain.

## Detection Opportunities
- Key behavioural indicators for EDR/SIEM
- Network signatures (JA3/JA3S hashes, URI patterns, user-agents, beacon intervals)
- File-based artifacts (paths, mutex names, registry keys, scheduled tasks)
- 2–3 Sigma rules targeting the most distinctive behaviours
- YARA rule logic description (key byte patterns, strings, or structural features)

## Recommended Mitigations
- Top 5 controls that disrupt this malware's execution chain`,
  },
  {
    id: 'b5',
    title: 'Sector Threat Landscape Brief',
    category: 'Reporting',
    description: 'Current threat intelligence brief for a specific industry sector and geographic region.',
    tags: ['sector', 'regional', 'threat brief', 'targeting'],
    prompt: `Produce a current threat intelligence landscape brief for the [SECTOR] sector in [REGION/COUNTRY].

## Sector Overview
- Why is this sector a high-value target? What assets or data are most sought?
- Regulatory environment and compliance obligations relevant to cyber threats (e.g. SOCI, APRA CPS 234, NIS2, HIPAA)

## Active Threat Actors
For the top 3–5 most relevant threat actors currently targeting this sector:
- Actor name, type (nation-state, criminal, hacktivist), and motivation
- Specific campaigns or incidents against this sector in the past 12 months
- Preferred initial access vectors
- TTPs most relevant to this sector's typical technology stack

## Prevalent Attack Types
- Most common attack patterns (ransomware, BEC, supply chain, espionage, DDoS)
- Qualitative breakdown of frequency and severity
- Recent public incidents illustrating key trends

## Vulnerability Exposure
- CVEs most actively exploited against technology commonly deployed in this sector
- Systemic weaknesses (OT/ICS, third-party risk, legacy systems, remote access)

## Emerging Threats
- New or escalating threats specific to this sector
- AI-enabled attack trends (deepfake BEC, AI-assisted phishing)
- Geopolitical drivers affecting the current threat level

## Recommendations
- Top 5 defensive priorities tailored to this sector
- Relevant ISACs, government advisories, and intelligence sharing communities
- SOC monitoring and detection priorities`,
  },
  {
    id: 'b6',
    title: 'TTP-to-Detection Engineering',
    category: 'Detection Engineering',
    description: 'Convert MITRE ATT&CK technique IDs into Sigma rules and KQL queries with false positive guidance.',
    tags: ['detection', 'Sigma', 'KQL', 'ATT&CK', 'SIEM'],
    prompt: `For each of the following MITRE ATT&CK techniques, provide full detection engineering guidance and rule stubs:

[LIST TECHNIQUE IDs — e.g. T1566.001, T1059.001, T1078, T1486]

For each technique provide:

---

## [Technique Name] — [T1xxx.xxx]

**Adversary Behaviour**
How adversaries use this technique in practice, with real-world examples from known campaigns.

**Detection Strategy**
- Primary log source(s) required (Windows Event Log, Sysmon, EDR telemetry, network, cloud audit logs)
- Key fields and values to monitor
- Baseline considerations — what normal looks like vs. malicious

**Sigma Rule**
\`\`\`yaml
title: Detect [Technique]
status: experimental
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    # key fields here
  condition: selection
falsepositives:
  - Legitimate admin tools
level: high
tags:
  - attack.[tactic]
  - attack.t[technique_id]
\`\`\`

**KQL (Microsoft Sentinel / Defender XDR)**
\`\`\`kql
// [Technique Name] — [T1xxx.xxx]
// Adjust timeframe and thresholds for your environment
[KQL query here]
\`\`\`

**False Positive Tuning**
Common false positive sources and recommended exclusion logic.

**Coverage Gaps**
What attacker variations would evade this detection, and what complementary rules would improve coverage?`,
  },
  {
    id: 'b7',
    title: 'Threat Hunt Hypotheses',
    category: 'Hunting',
    description: 'Generate 5 structured threat hunting hypotheses from a threat actor or campaign\'s TTPs.',
    tags: ['threat hunting', 'hypotheses', 'proactive', 'TTPs', 'KQL'],
    prompt: `Generate 5 structured threat hunting hypotheses based on the TTPs of [THREAT ACTOR NAME / CAMPAIGN NAME].

For each hypothesis:

---

## Hunt [N]: [Hypothesis Title]

**Hypothesis Statement**
"We believe that [actor/technique] may be present in our environment because [rationale], which would be evidenced by [observable behaviour]."

**ATT&CK Technique(s)**
- Primary: T1xxx.xxx — Technique Name
- Related: T1xxx.xxx — Technique Name

**Data Sources Required**
- Log types and minimum retention needed
- EDR, SIEM, network, cloud, or identity telemetry required

**Hunt Procedure**
1. Initial broad query to surface anomalous activity
2. Pivot points to narrow scope and enrich findings
3. Validation steps to confirm or refute the hypothesis

**Hunt Query (KQL or SPL)**
\`\`\`kql
// Hunt: [technique] — adjust thresholds for your baseline
[query here]
\`\`\`

**True Positive Indicators**
Specific artifacts that confirm the hypothesis (smoking guns).

**False Positive Considerations**
Common benign activities that mimic this behaviour and how to distinguish them.

**Scope & Priority**
- Estimated hunt duration
- Priority: Critical / High / Medium — with justification
- Recommended asset scope (internet-facing, privileged accounts, IT admin hosts)`,
  },
  {
    id: 'b8',
    title: 'Incident Attribution Analysis',
    category: 'Investigation',
    description: 'Structured attribution assessment from observed intrusion artifacts using Analysis of Competing Hypotheses.',
    tags: ['attribution', 'incident response', 'DFIR', 'ACH'],
    prompt: `I am investigating a potential intrusion. Assess possible threat actor attribution and provide a structured analytical judgment.

**Observed Artifacts & TTPs:**
[PASTE YOUR OBSERVATIONS — malware hashes, C2 IPs/domains, techniques observed, tools used, victim targeting profile, timeframes, geographic context, dwell time]

---

## Attribution Assessment

**Candidate Threat Actors**
For each of the top 2–3 candidates:
- Actor name and type
- Overlapping TTPs and artifacts that support this candidate
- Confidence level (High/Medium/Low) with explicit reasoning
- Alternative explanations for the overlap (false flag, shared tooling, coincidence)

**Most Likely Attribution**
- Assessed most probable actor with overall confidence level
- The 3–5 strongest evidence points supporting this assessment
- Key evidence that argues against or complicates this attribution

**Analysis of Competing Hypotheses (ACH)**
Brief ACH matrix rating each candidate against each key piece of evidence.

## Intelligence Gaps
- What critical forensic artifacts are missing?
- What additional collection would most increase attribution confidence?
- Specific OSINT pivots, sandbox lookups, or platform queries to run next

## Analytical Caveats
- Deception considerations — could an actor be mimicking another's TTPs?
- Any TTPs consistent with multiple actors (commodity tooling, shared infrastructure)?

## Recommended Next Steps
- Immediate containment priorities based on assessed actor capability
- Additional evidence collection tasks ranked by intelligence value
- Threat intelligence sharing recommendations (ISAC, CISA, ASD/ACSC)`,
  },
  {
    id: 'b9',
    title: 'Executive / Board Threat Brief',
    category: 'Reporting',
    description: 'Plain-English board-level brief on a cyber threat or emerging risk — no jargon, actionable recommendations.',
    tags: ['executive', 'board', 'CISO', 'strategic', 'briefing'],
    prompt: `Write a concise executive threat brief suitable for a CISO or board audience on the following topic:

[TOPIC — e.g. "Rising ransomware risk to Australian critical infrastructure", "Recent supply chain attacks targeting our sector", "Impact of [specific CVE] on our technology stack"]

---

## Bottom Line Up Front (BLUF)
3 bullet points maximum. What does leadership need to know right now?

## Threat Overview
Plain English (no jargon):
- What the threat is and who is behind it
- Why it matters to this organisation specifically
- What has happened recently that makes this timely

## Business Impact
- Potential operational, financial, reputational, and regulatory consequences
- Quantify risk where possible (downtime costs, regulatory fine ranges, average ransom demands)
- Comparable incidents from peer organisations or similar sectors

## Current Exposure
- Are we currently exposed? (High / Medium / Low)
- What controls are already in place?
- What gaps increase our risk?

## Recommended Actions
1. **Immediate (0–7 days):** [action]
2. **Short-term (7–30 days):** [action]
3. **Medium-term (1–3 months):** [action]
4. **Strategic (3–12 months):** [action]
5. **Governance / Policy:** [action]

## Key References
Relevant public advisories (ACSC, CISA, NCSC) or vendor reports that leadership should be aware of.`,
  },
  {
    id: 'b10',
    title: 'Ransomware Group Intelligence Assessment',
    category: 'Threat Actors',
    description: 'Detailed intelligence on a ransomware operation: affiliate model, targeting, TTPs, and extortion tactics.',
    tags: ['ransomware', 'RaaS', 'criminal', 'extortion', 'TTPs'],
    prompt: `Provide a detailed intelligence assessment of the [RANSOMWARE GROUP NAME] ransomware operation.

## Group Profile
- Operational model (RaaS vs. private, affiliate structure and vetting)
- Estimated first activity date and key evolution milestones
- Suspected geographic base of operations
- Relationships with IABs, crypter services, money laundering networks

## Targeting Profile
- Preferred sectors and geographies (with victim count data if available)
- Organisation size preference (SMB vs. enterprise vs. critical infrastructure)
- Known victims from public disclosures or leak site observations
- Exclusion lists — sectors or countries they avoid and why

## Initial Access Methods
- Preferred initial access techniques with ATT&CK IDs
- CVEs commonly exploited (with CVE IDs)
- IAB relationships — which access brokers supply this group?
- Phishing lure themes and tooling

## Attack Lifecycle & TTPs
End-to-end attack chain with ATT&CK technique IDs:
- Post-compromise tools and LOLBins used
- Lateral movement approach and average dwell time before encryption
- Data exfiltration before encryption (double extortion mechanics)
- Ransomware: encryption algorithm, file targeting, ransom note characteristics
- Anti-recovery techniques (shadow copy deletion, backup targeting)

## Extortion Tactics
- Single / double / triple extortion model
- Negotiation behaviour and average ransom demand / payment ranges
- Data leak site activity and victim publication timeline
- DDoS or customer/partner harassment observed?

## Detection & Hunting
- Most distinctive pre-encryption behaviours to hunt for
- Key IOCs (infrastructure patterns, tool hashes, mutex names)
- 2–3 Sigma rules for the highest-priority TTPs

## Defensive Recommendations
- Top controls to disrupt this group's attack chain
- Backup architecture recommendations given their anti-recovery TTPs`,
  },
  {
    id: 'b11',
    title: 'Attack-Path Reconstruction & ATT&CK Mapping',
    category: 'Investigation',
    description: 'Map observed attack activity to MITRE ATT&CK with detection gap analysis and lessons learned.',
    tags: ['kill chain', 'ATT&CK', 'DFIR', 'reconstruction', 'detection gaps'],
    prompt: `Map the following attack activity to the MITRE ATT&CK framework and identify detection gaps.

**Attack Activity Description:**
[DESCRIBE THE ATTACK — timeline, observed tools, techniques, evidence sources, affected systems, entry points, lateral movement path, objectives]

---

## ATT&CK Mapping Table

| Phase | Observed Activity | ATT&CK ID | Technique Name | Evidence Source |
|-------|-------------------|------------|----------------|-----------------|
| Initial Access | ... | T1xxx | ... | ... |
| Execution | ... | | | |
| Persistence | ... | | | |
| Privilege Escalation | ... | | | |
| Defense Evasion | ... | | | |
| Credential Access | ... | | | |
| Discovery | ... | | | |
| Lateral Movement | ... | | | |
| Collection | ... | | | |
| C2 | ... | | | |
| Exfiltration | ... | | | |
| Impact | ... | | | |

## Detection Gap Analysis
For each phase:
- Was this activity logged and by which source?
- Was an alert generated? If not — missing log source, no rule, or tuned out?
- What detection rule would have caught this?

## Timeline Reconstruction
Narrative timeline from first access through to detection (or assumed objective completion).

## Attacker Objective Assessment
What was the likely objective and was it achieved?

## Lessons Learned
Top 5 defensive improvements that would have disrupted or detected this attack chain earlier.`,
  },
  {
    id: 'b12',
    title: 'Priority Intelligence Requirements (PIR) Development',
    category: 'Planning & Requirements',
    description: 'Develop structured PIRs with intelligence questions, collection sources, cadence, and governance.',
    tags: ['PIR', 'intelligence requirements', 'planning', 'strategic'],
    prompt: `Help me develop Priority Intelligence Requirements (PIRs) for the following organisation:

- **Sector:** [SECTOR]
- **Geography:** [REGION/COUNTRY]
- **Organisation Size:** [SIZE — e.g. ASX200, mid-market, critical infrastructure operator]
- **Key Assets / Concerns:** [e.g. customer PII, OT/ICS systems, financial data, M&A activity, IP]
- **Existing Threat Awareness:** [WHAT THREATS ARE ALREADY MONITORED OR KNOWN]

---

Develop 5–8 PIRs. For each:

## PIR [N]: [Title]

**Intelligence Question**
The specific, answerable question this PIR addresses (who/what/when/where/how).

**Rationale**
Why this is a priority — business risk, regulatory driver, prior incident, or board concern.

**Indicators to Monitor**
Specific observables, events, or data points that would answer this PIR.

**Collection Sources**
- Technical: threat feeds, SIEM alerts, dark web monitoring, OSINT platforms
- Contextual: ISAC memberships, vendor advisories, government advisories (ACSC, CISA)

**Reporting Cadence**
Continuous alert / Weekly summary / Monthly review

**Success Criteria**
How do we know this PIR is being adequately answered?

**Dissemination**
Who receives reporting? (SOC analyst / CISO / board / operations)

---

Conclude with a brief note on PIR governance: how to review, prioritise, update, and retire PIRs quarterly.`,
  },
  {
    id: 'b13',
    title: 'OSINT Collection Plan',
    category: 'Planning & Requirements',
    description: 'Structured OSINT collection plan with source categories, prioritised tasks, and OPSEC considerations.',
    tags: ['OSINT', 'collection', 'investigation', 'OPSEC'],
    prompt: `Develop a structured OSINT collection plan for investigating the following:

**Collection Target:** [THREAT ACTOR / CAMPAIGN / DOMAIN / ORGANISATION / INDIVIDUAL]
**Collection Objective:** [WHAT INTELLIGENCE QUESTION ARE YOU TRYING TO ANSWER?]
**Time Constraint:** [IMMEDIATE (<4h) / SHORT (1–3 days) / ONGOING]
**Legal Jurisdiction:** [RELEVANT JURISDICTION — affects permissible collection methods]

---

## Specific Collection Requirements
Break the objective into 4–6 specific intelligence requirements (IRs).

## Collection Plan by Source Category

### Technical OSINT
- Domain/IP investigation (WHOIS history, passive DNS, certificate transparency logs)
- Search queries and Google dorks
- Recommended platforms (Shodan, Censys, SecurityTrails, VirusTotal Graph)
- Expected intelligence yield for this target

### Open Web & Social Media
- Platforms, search operators, hashtags to use
- Forums, communities, or code repositories relevant to this target
- Expected intelligence yield

### Dark Web & Underground Sources
- Relevant markets, forums, or channels
- Safe collection methodology and OPSEC controls
- Indicators of data exposure or active targeting

### Commercial & Subscription Platforms
- Recommended platforms (Recorded Future, Flashpoint, Mandiant Advantage)
- Specific modules or searches within each

## OPSEC & Legal Considerations
- Collection activities requiring legal review
- OPSEC controls to protect investigator identity
- Evidence handling if this may support legal action
- Passive vs. active collection boundary

## Prioritised Task List
Ranked tasks with estimated time and assigned responsibility.

## Deliverables & Dissemination
Format of intelligence products and who receives them.`,
  },
  {
    id: 'b14',
    title: 'Weekly Intelligence Synthesis',
    category: 'Reporting',
    description: 'Synthesise raw intelligence items into a structured weekly CTI digest for a security team.',
    tags: ['reporting', 'synthesis', 'weekly', 'digest', 'summary'],
    prompt: `Synthesise the following raw intelligence items into a structured weekly CTI summary.

**Raw Intelligence Items:**
[PASTE YOUR ITEMS — news articles, government advisories, vendor reports, CVE notifications, threat feed highlights, internal observations, dark web alerts]

**Organisation Context:**
- Sector: [SECTOR]
- Geography: [REGION]
- Key technology stack: [PRIMARY PLATFORMS AND VENDORS IN USE]

---

## Bottom Line Up Front (BLUF)
3 bullets: the most critical items requiring immediate attention this week.

## Critical Vulnerabilities
| CVE ID | CVSS | Affected Product | ITW Exploitation | Priority | Action Required |
|--------|------|------------------|-----------------|----------|-----------------|

## Active Threat Actor Activity
New campaigns, TTP changes, or group activity relevant to our sector and region this week.

## Malware & Tooling Updates
New variants, C2 infrastructure changes, or adversary tooling developments of note.

## Sector-Specific Incidents
Publicly disclosed incidents affecting our sector or region this week.

## Government & Regulatory Advisories
ACSC, CISA, NCSC, or other authority advisories issued or updated this week.

## Items Requiring Further Investigation
Unconfirmed or emerging items that warrant deeper analysis next week.

## Weekly Metrics
- Total items reviewed: [N]
- Critical / High items actioned: [N]
- New IOCs added to blocklist: [N]
- PIRs addressed this week: [list]`,
  },
  {
    id: 'b15',
    title: 'Diamond Model Intrusion Analysis',
    category: 'Investigation',
    description: 'Apply the Diamond Model across all four vertices to structure a campaign or intrusion event assessment.',
    tags: ['Diamond Model', 'intrusion analysis', 'methodology', 'attribution'],
    prompt: `Apply the Diamond Model of Intrusion Analysis to the following intrusion event or campaign:

**Event/Campaign Description:**
[DESCRIBE THE INTRUSION — observed activity, timeline, affected victims, available artifacts, data sources used]

---

## Adversary Vertex
- **Identity:** Confirmed, suspected, or unknown — state your reasoning
- **Type:** Nation-state / criminal / hacktivist / insider / unknown
- **Motivation:** Financial, espionage, disruption, ideological, competitive intelligence
- **Persona:** How does the adversary present externally (targeting choices, pace, TTP signature)?
- **Attribution Confidence:** High / Medium / Low — list key evidence for each level

## Capability Vertex
- **Tools Used:** Malware families, exploitation frameworks, custom tools, LOLBins
- **Techniques:** MITRE ATT&CK technique IDs across the kill chain
- **Sophistication:** Opportunistic / Capable / Advanced — with justification
- **Capability Source:** Custom-developed, purchased, open-source, or combination

## Infrastructure Vertex
- **Type 1** (adversary-controlled): C2 servers, staging hosts, exfil endpoints
- **Type 2** (adversary-leveraged): Compromised hosts, bulletproof hosting, CDN abuse
- **Indicators:** IPs, domains, ASNs, certificate subjects, hosting patterns
- **Infrastructure Reuse:** Overlap with previously tracked actor infrastructure?

## Victim Vertex
- **Victim Persona:** Why is this organisation valuable to this adversary?
- **Victim Assets:** What is specifically targeted (data type, systems, personnel)?
- **Confirmed Impact:** What was achieved or compromised?
- **Targeting Type:** Opportunistic or deliberate, researched selection?

## Meta-Features Analysis
- **Timestamp:** Time-zone patterns suggesting operator location?
- **Phase:** Where in the kill chain was activity observed? What phases are missing?
- **Result:** Successful / Failed / Partial — from the adversary's perspective
- **Direction:** External→Internal, Internal→External, or lateral?

## Activity Thread Correlation
Other events sharing vertices that suggest a broader campaign?

## Intelligence Conclusions & Recommendations
- Most confident adversary assessment from the full model
- Detection and hunting priorities derived from each vertex
- Collection gaps and how to address them`,
  },
]

const BLANK_FORM: FormState = {
  id: '', title: '', category: 'Threat Actors', description: '', prompt: '', tags: '',
}

// ── form modal ────────────────────────────────────────────────────────────────

function PromptForm({ initial, onSave, onClose }: { initial: FormState; onSave: (f: FormState) => void; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(initial)
  const set = (field: keyof FormState, value: string) => setForm((p) => ({ ...p, [field]: value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">{form.id ? 'Edit Prompt' : 'New Prompt'}</p>
          <button onClick={onClose} className="text-txt-3 hover:text-txt bg-transparent border-none cursor-pointer p-1 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-txt-3 uppercase tracking-wider">Title *</label>
            <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Threat Actor Profile" required className="bg-bg border border-border rounded-lg text-txt text-[13px] px-3 py-2 outline-none focus:border-purple transition-colors placeholder:text-txt-3" />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] font-bold text-txt-3 uppercase tracking-wider">Category *</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value as Exclude<Category, 'All'>)} className="bg-bg border border-border rounded-lg text-txt text-[13px] px-3 py-2 outline-none focus:border-purple transition-colors">
                {CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] font-bold text-txt-3 uppercase tracking-wider">Tags</label>
              <input type="text" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="APT, attribution, TTPs" className="bg-bg border border-border rounded-lg text-txt text-[13px] px-3 py-2 outline-none focus:border-purple transition-colors placeholder:text-txt-3" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-txt-3 uppercase tracking-wider">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="One sentence describing what this prompt produces…" rows={2} className="bg-bg border border-border rounded-lg text-txt text-[13px] px-3 py-2 outline-none focus:border-purple transition-colors placeholder:text-txt-3 resize-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-txt-3 uppercase tracking-wider">Prompt *</label>
            <textarea value={form.prompt} onChange={(e) => set('prompt', e.target.value)} placeholder="Write your prompt here. Use [PLACEHOLDERS] for fields the analyst should fill in…" required rows={12} className="bg-bg border border-border rounded-lg text-txt font-mono text-[12px] px-3 py-2 outline-none focus:border-purple transition-colors placeholder:text-txt-3 resize-none leading-relaxed" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="text-[12px] font-bold text-txt-3 hover:text-txt px-4 py-2 rounded-lg border border-border hover:border-border2 bg-transparent cursor-pointer transition-colors">Cancel</button>
          <button onClick={() => { if (!form.title.trim() || !form.prompt.trim()) return; onSave(form) }} disabled={!form.title.trim() || !form.prompt.trim()} className="text-[12px] font-bold text-white px-4 py-2 rounded-lg bg-gradient-to-br from-purple to-purple-dark border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90">
            {form.id ? 'Save Changes' : 'Add Prompt'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── prompt card ───────────────────────────────────────────────────────────────

function PromptCard({
  prompt,
  onCopy,
  onUseInChat,
  onEdit,
  onDelete,
}: {
  prompt: LibraryPrompt
  onCopy: (p: LibraryPrompt) => void
  onUseInChat: (p: LibraryPrompt) => void
  onEdit?: (p: LibraryPrompt) => void
  onDelete?: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(prompt.prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => onCopy(prompt))
  }

  return (
    <div className="border border-border rounded-xl bg-surface overflow-hidden">
      {/* Card header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-txt leading-snug mb-2">{prompt.title}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${CATEGORY_STYLE[prompt.category]}`}>
                {prompt.category}
              </span>
              {prompt.isCustom && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border text-txt-3 border-border bg-bg">
                  Custom
                </span>
              )}
              {prompt.tags.map((tag) => (
                <span key={tag} className="text-[10px] text-txt-3 font-mono">· {tag}</span>
              ))}
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {prompt.isCustom && onEdit && onDelete && (
              <>
                <button onClick={() => onEdit(prompt)} title="Edit" className="p-1.5 text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer transition-colors rounded">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => onDelete(prompt.id)} title="Delete" className="p-1.5 text-txt-3 hover:text-red bg-transparent border-none cursor-pointer transition-colors rounded">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded border border-border text-txt-3 hover:text-txt hover:border-border2 bg-transparent cursor-pointer transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => onUseInChat(prompt)}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded border border-purple/40 text-purple hover:bg-purple/10 bg-transparent cursor-pointer transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Use in Chat
            </button>
          </div>
        </div>
      </div>

      {/* Prompt text */}
      <div className="border-t border-border bg-bg/60 px-5 py-4">
        <pre className="font-mono text-[11.5px] text-txt-2 leading-relaxed whitespace-pre-wrap break-words">
          {prompt.prompt}
        </pre>
      </div>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function PromptLibrary() {
  const navigate = useNavigate()

  const [customPrompts, setCustomPrompts] = useState<LibraryPrompt[]>(loadCustom)
  const [search, setSearch]               = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [showForm, setShowForm]           = useState(false)
  const [editingForm, setEditingForm]     = useState<FormState>(BLANK_FORM)

  const allPrompts = useMemo(() => [...BUILTIN_PROMPTS, ...customPrompts], [customPrompts])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allPrompts.filter((p) => {
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.prompt.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [allPrompts, search, activeCategory])

  function handleUseInChat(p: LibraryPrompt) {
    sessionStorage.setItem(PENDING_KEY, p.prompt)
    navigate('/analyst')
  }

  function handleEdit(p: LibraryPrompt) {
    setEditingForm({ id: p.id, title: p.title, category: p.category, description: p.description, prompt: p.prompt, tags: p.tags.join(', ') })
    setShowForm(true)
  }

  function handleSavePrompt(form: FormState) {
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
    if (form.id) {
      setCustomPrompts((prev) => {
        const updated = prev.map((p) => p.id === form.id ? { ...p, title: form.title, category: form.category, description: form.description, prompt: form.prompt, tags } : p)
        saveCustom(updated)
        return updated
      })
      toast('Prompt updated', 'success')
    } else {
      const newPrompt: LibraryPrompt = { id: `custom-${Date.now()}`, title: form.title, category: form.category, description: form.description, prompt: form.prompt, tags, isCustom: true }
      setCustomPrompts((prev) => { const updated = [...prev, newPrompt]; saveCustom(updated); return updated })
      toast('Prompt saved to library', 'success')
    }
    setShowForm(false)
  }

  function handleDeleteCustom(id: string) {
    setCustomPrompts((prev) => { const updated = prev.filter((p) => p.id !== id); saveCustom(updated); return updated })
    toast('Prompt deleted', 'success')
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Sticky top bar ── */}
      <div className="flex-shrink-0 border-b border-border bg-surface/90 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts…"
            className="w-full bg-bg border border-border rounded-lg text-txt text-[12px] pl-8 pr-3 py-1.5 outline-none focus:border-purple transition-colors placeholder:text-txt-3"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={[
                'text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors bg-transparent cursor-pointer whitespace-nowrap',
                activeCategory === cat
                  ? 'text-purple border-purple/50 bg-purple/10'
                  : 'text-txt-3 border-border hover:border-border2 hover:text-txt-2',
              ].join(' ')}
            >
              {cat === 'Planning & Requirements' ? 'Planning' : cat === 'Detection Engineering' ? 'Detection' : cat}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Count + New button */}
        <span className="text-[11px] text-txt-3 font-mono whitespace-nowrap">{filtered.length} prompts</span>
        <button
          onClick={() => { setEditingForm(BLANK_FORM); setShowForm(true) }}
          className="flex items-center gap-1.5 text-[12px] font-bold text-white px-3 py-1.5 rounded-lg bg-gradient-to-br from-purple to-purple-dark border-none cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Prompt
        </button>
      </div>

      {/* ── Scrollable feed ── */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p className="text-[13px] text-txt-2">No prompts match your search.</p>
            <button onClick={() => { setSearch(''); setActiveCategory('All') }} className="text-[12px] text-purple hover:underline bg-transparent border-none cursor-pointer">Clear filters</button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-5">
            {filtered.map((p) => (
              <PromptCard
                key={p.id}
                prompt={p}
                onCopy={(pr) => toast(`${pr.title} copied`, 'success')}
                onUseInChat={handleUseInChat}
                onEdit={p.isCustom ? handleEdit : undefined}
                onDelete={p.isCustom ? handleDeleteCustom : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && <PromptForm initial={editingForm} onSave={handleSavePrompt} onClose={() => setShowForm(false)} />}
    </div>
  )
}
