import type { Skill } from './types'

const v = (vals: Record<string, string>, key: string) => vals[key] ?? ''

export const SKILLS: Skill[] = [
  // â”€â”€ Daily briefs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: 'daily-brief-global',
    name: 'Daily Brief (Global)',
    tagline: 'One-page global cyber news brief â€” last 24 hours',
    badge: 'DAILY', badgeColor: '#14b8a6', category: 'reports',
    description: 'Compact single-page global cybersecurity news brief covering the last 24 hours. TLDR bullets, 4-6 top stories, CVE watch, ransomware watch, and what to expect in the next 24-48 hours.',
    inputs: [
      { id: 'date', label: 'Date (optional â€” defaults to last 24 hours)', type: 'text', placeholder: '2026-05-15' },
      { id: 'focus', label: 'Regional weighting (optional)', type: 'text', placeholder: 'APAC Â· US Â· UK Â· EMEA â€” leave blank for true global' },
    ],
    buildMsg: (vals) => `${v(vals,'date') ? 'Reporting date: '+v(vals,'date') : 'Reporting window: last 24 hours from now'}${v(vals,'focus') ? ' [Regional weighting: '+v(vals,'focus')+']' : ' [Truly global]'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-daily-brief-global',
  },

  // â”€â”€ Monthly AU â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: 'operational-au',
    name: 'Operational CTI (AU)',
    tagline: 'Monthly AU report for SOC, IR, and vuln management',
    badge: 'OPERATIONAL', badgeColor: '#ef4444', category: 'reports',
    description: 'Dense monthly HTML for analysts. CVE deep-dives with exploitation status, ACSC advisories, public IOC table, DRAFT Sigma/KQL detection stubs, and global malware tooling shifts. Everything cited.',
    inputs: [
      { id: 'month', label: 'Month (optional â€” defaults to last 30 days)', type: 'text', placeholder: '2026-04' },
      { id: 'focus', label: 'Sector focus (optional)', type: 'text', placeholder: 'Finance, Healthcare, Critical Infrastructure' },
    ],
    buildMsg: (vals) => `${v(vals,'month') || 'Current month'}${v(vals,'focus') ? ' [Sector focus: '+v(vals,'focus')+']' : ''}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-monthly-report-operational-australia',
  },
  {
    id: 'tactical-au',
    name: 'Tactical CTI (AU)',
    tagline: 'Monthly AU brief for SOC managers and threat hunters',
    badge: 'TACTICAL', badgeColor: '#f59e0b', category: 'reports',
    description: 'Mid-depth monthly for practitioners fluent in ATT&CK. 5-bullet BLUF, AU incidents with TTP analysis, priority CVEs with detection notes, ACSC advisories mapped to Essential Eight, and 5 hunt hypotheses.',
    inputs: [
      { id: 'month', label: 'Month (optional)', type: 'text', placeholder: '2026-04' },
    ],
    buildMsg: (vals) => v(vals,'month') || 'Current month',
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-monthly-report-tactical-australia',
  },
  {
    id: 'strategic-au',
    name: 'Strategic CTI (AU)',
    tagline: 'Monthly AU brief for executives and the board',
    badge: 'STRATEGIC', badgeColor: '#a855f7', category: 'reports',
    description: 'Plain-English board-readable brief. 3-bullet BLUF, exec summary with stats, monthly themes with business impact, top 3 vulnerabilities in business terms, ACSC regulatory posture, board-level recommendations.',
    inputs: [
      { id: 'month', label: 'Month (optional)', type: 'text', placeholder: '2026-04' },
      { id: 'sector', label: 'Industry context (optional)', type: 'text', placeholder: 'Financial services, ASX-listed' },
    ],
    buildMsg: (vals) => `${v(vals,'month') || 'Current month'}${v(vals,'sector') ? ' [Industry: '+v(vals,'sector')+']' : ''}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-monthly-report-strategic-australia',
  },

  // â”€â”€ Monthly Global â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: 'operational-global',
    name: 'Operational CTI (Global)',
    tagline: 'Monthly global report for SOC, IR, and vuln management',
    badge: 'OPERATIONAL', badgeColor: '#ef4444', category: 'reports',
    description: 'Worldwide operational monthly. Optional country/region weighting. Dense CVE deep-dives, regulator/CERT advisories, consolidated IOCs, DRAFT detection stubs.',
    inputs: [
      { id: 'region', label: 'Country or region (optional â€” defaults to worldwide)', type: 'text', placeholder: 'USA Â· UK Â· Germany Â· APAC Â· Five Eyes' },
      { id: 'month', label: 'Month (optional)', type: 'text', placeholder: '2026-04' },
      { id: 'focus', label: 'Sector focus (optional)', type: 'text', placeholder: 'Finance, Critical Infrastructure' },
    ],
    buildMsg: (vals) => `${v(vals,'month') || 'Current month'}${v(vals,'region') ? ' [Region: '+v(vals,'region')+']' : ' [Worldwide synthesis]'}${v(vals,'focus') ? ' [Sector focus: '+v(vals,'focus')+']' : ''}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-monthly-report-operational-global',
  },
  {
    id: 'tactical-global',
    name: 'Tactical CTI (Global)',
    tagline: 'Monthly global brief for SOC managers and threat hunters',
    badge: 'TACTICAL', badgeColor: '#f59e0b', category: 'reports',
    description: 'Mid-depth monthly for practitioners fluent in ATT&CK. Optional country/region weighting. BLUF, incidents with TTP analysis, priority CVEs with detection notes, hunt hypotheses.',
    inputs: [
      { id: 'region', label: 'Country or region (optional)', type: 'text', placeholder: 'USA Â· UK Â· EMEA Â· APAC' },
      { id: 'month', label: 'Month (optional)', type: 'text', placeholder: '2026-04' },
    ],
    buildMsg: (vals) => `${v(vals,'month') || 'Current month'}${v(vals,'region') ? ' [Region: '+v(vals,'region')+']' : ' [Worldwide synthesis]'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-monthly-report-tactical-global',
  },
  {
    id: 'strategic-global',
    name: 'Strategic CTI (Global)',
    tagline: 'Monthly global brief for executives and the board',
    badge: 'STRATEGIC', badgeColor: '#a855f7', category: 'reports',
    description: 'Plain-English board brief covering global cyber activity. Optional country/region weighting with localised regulatory framing.',
    inputs: [
      { id: 'region', label: 'Country or region (optional)', type: 'text', placeholder: 'USA Â· UK Â· EU Â· APAC' },
      { id: 'month', label: 'Month (optional)', type: 'text', placeholder: '2026-04' },
      { id: 'sector', label: 'Industry context (optional)', type: 'text', placeholder: 'Financial services, SaaS, Healthcare' },
    ],
    buildMsg: (vals) => `${v(vals,'month') || 'Current month'}${v(vals,'region') ? ' [Region: '+v(vals,'region')+']' : ' [Worldwide synthesis]'}${v(vals,'sector') ? ' [Industry: '+v(vals,'sector')+']' : ''}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-monthly-report-strategic-global',
  },

  // â”€â”€ Sector reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: 'sector-au',
    name: 'Sector Report (AU)',
    tagline: 'Long-horizon AU industry vertical deep-dive',
    badge: 'SECTOR Â· AU', badgeColor: '#06b6d4', category: 'reports',
    description: 'Multi-month (default 12m) sector intelligence for Australia. Sector profile, threat actor landscape, notable incidents, MITRE TTP trends, CVE and supply-chain trends, ACSC/SOCI/APRA posture, outlook, recommendations.',
    inputs: [
      { id: 'sector', label: 'Industry sector', type: 'text', required: true, placeholder: 'Healthcare Â· Finance Â· Energy Â· Manufacturing Â· Defence Â· Education Â· Telecommunications Â· Transport Â· Water Â· Mining Â· Retail Â· Government Â· Technology' },
      { id: 'horizon', label: 'Horizon (optional â€” defaults to 12m)', type: 'select', options: ['12 months', '6 months', '18 months', '24 months'] },
    ],
    buildMsg: (vals) => `Sector: ${v(vals,'sector').trim()} [Horizon: ${v(vals,'horizon') || '12 months'}]`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-sector-report-australia',
  },
  {
    id: 'sector-global',
    name: 'Sector Report (Global)',
    tagline: 'Long-horizon global industry vertical deep-dive',
    badge: 'SECTOR Â· GLOBAL', badgeColor: '#06b6d4', category: 'reports',
    description: 'Multi-month (default 12m) global sector intelligence. Optional country/region weighting. Sector profile, threat actor landscape, incidents, TTP trends, CVE and supply-chain trends, regulator posture, outlook.',
    inputs: [
      { id: 'sector', label: 'Industry sector', type: 'text', required: true, placeholder: 'Healthcare Â· Finance Â· Energy Â· Manufacturing Â· Defence Â· Education Â· Telecom Â· Transport Â· Water Â· Mining Â· Retail Â· Government Â· Technology Â· Pharma Â· Oil and gas Â· Aviation' },
      { id: 'region', label: 'Country or region (optional)', type: 'text', placeholder: 'USA Â· UK Â· Germany Â· Japan Â· EMEA Â· APAC' },
      { id: 'horizon', label: 'Horizon (optional)', type: 'select', options: ['12 months', '6 months', '18 months', '24 months'] },
    ],
    buildMsg: (vals) => `Sector: ${v(vals,'sector').trim()}${v(vals,'region') ? ' [Region: '+v(vals,'region')+']' : ' [Worldwide synthesis]'} [Horizon: ${v(vals,'horizon') || '12 months'}]`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-sector-report-global',
  },

  // â”€â”€ On-demand CTI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: 'security-advisory',
    name: 'Security Advisory',
    tagline: 'Exec briefing on a breach, CVE, or cyber event',
    badge: 'ADVISORY', badgeColor: '#a855f7', category: 'ondemand',
    description: 'Produces a client-deliverable executive advisory on any cyber event, CVE, or breach. Vendor advisory analysis, affected versions, exploitation status, AU impact, recommended actions, regulatory context.',
    inputs: [
      { id: 'event', label: 'URL Â· CVE ID Â· Event Name', type: 'textarea', required: true, placeholder: 'CVE-2024-12345\nhttps://vendor.com/advisory\nMOVEit 2023 breach' },
      { id: 'region', label: 'Region', type: 'select', options: ['Global (AU context)', 'AU', 'USA', 'UK', 'EU', 'Canada', 'Japan', 'Singapore'] },
    ],
    buildMsg: (vals) => `${v(vals,'event').trim()}\n\nRegion: ${v(vals,'region') || 'Global (AU context)'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-security-advisory',
  },
  {
    id: 'threat-actor-profile',
    name: 'Threat Actor Profile',
    tagline: 'Structured actor profile from URL or report',
    badge: 'ACTOR', badgeColor: '#ec4899', category: 'ondemand',
    description: 'Structured threat actor profile using the Diamond Model. Covers adversary attribution, capabilities, infrastructure, victimology, MITRE ATT&CK TTP mapping, IOCs, campaign history, and AU relevance.',
    inputs: [
      { id: 'input', label: 'URL Â· Actor Name Â· Report Excerpt', type: 'textarea', required: true, placeholder: 'https://www.mandiant.com/resources/blog/apt29-wineloader\nAPT29 / Midnight Blizzard / Cozy Bear\nFIN7' },
      { id: 'context', label: 'Reader context (optional)', type: 'text', placeholder: 'Australian finance CISO Â· APAC SOC lead' },
    ],
    buildMsg: (vals) => `${v(vals,'input').trim()}${v(vals,'context') ? '\n\nReader context: '+v(vals,'context') : ''}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'threat-actor-profile',
  },
  {
    id: 'admiralty-assessment',
    name: 'Admiralty Assessment',
    tagline: 'Grade an intel report against the NATO Admiralty Code',
    badge: 'ADMIRALTY', badgeColor: '#0891b2', category: 'ondemand',
    description: 'Quality-assesses a CTI report using the NATO Admiralty Code (6x6 system). Grades source reliability A-F and information credibility 1-6, flags single-sourced claims, gives an overall report grade.',
    inputs: [
      { id: 'input', label: 'URL Â· pasted intelligence report Â· file content', type: 'textarea', required: true, placeholder: 'https://www.mandiant.com/resources/blog/...\nor paste the full report text here' },
      { id: 'context', label: 'Assessment context (optional)', type: 'text', placeholder: 'Internal SOC use Â· client briefing Â· pre-publication peer review' },
    ],
    buildMsg: (vals) => `${v(vals,'input').trim()}${v(vals,'context') ? '\n\nAssessment context: '+v(vals,'context') : ''}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-admiralty-assessment',
  },
  {
    id: 'stix-export',
    name: 'STIX Bundle Export',
    tagline: 'Extract IOCs from a report and emit STIX 2.1 JSON',
    badge: 'STIX', badgeColor: '#6366f1', category: 'ondemand',
    description: 'Parses a threat intel source, extracts every IOC, and emits a valid STIX 2.1 bundle ready for import into MISP, OpenCTI, Anomali, Sentinel TI, ThreatConnect, and others. Builds proper STIX SDOs and SROs with TLP markings.',
    inputs: [
      { id: 'input', label: 'URL Â· Pasted report Â· IOC list', type: 'textarea', required: true, placeholder: 'https://www.mandiant.com/resources/blog/apt29-wineloader\n\nor paste a vendor advisory / blog / report excerpt directly' },
      { id: 'attribution', label: 'Attribution context (optional)', type: 'text', placeholder: 'APT29 / Midnight Blizzard / WINELOADER campaign' },
      { id: 'tlp', label: 'TLP marking', type: 'select', options: ['AMBER+STRICT', 'AMBER', 'GREEN', 'CLEAR', 'RED'] },
    ],
    buildMsg: (vals) => `${v(vals,'input').trim()}${v(vals,'attribution') ? '\n\nAttribution context: '+v(vals,'attribution') : ''}\n\nTLP marking: ${v(vals,'tlp') || 'AMBER+STRICT'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-stix-export',
  },
  {
    id: 'attack-navigator',
    name: 'ATT&CK Navigator Layer',
    tagline: 'Renders the ATT&CK matrix inline + exports a Navigator JSON layer',
    badge: 'NAVIGATOR', badgeColor: '#dc2626', category: 'ondemand',
    description: 'Extracts MITRE ATT&CK techniques from a threat report or TTP list and renders a visual ATT&CK matrix inline in HTML, plus emits a valid Navigator JSON layer for upload to attack-navigator.mitre.org.',
    inputs: [
      { id: 'input', label: 'URL Â· Actor name Â· TTP list Â· Report excerpt', type: 'textarea', required: true, placeholder: 'https://attack.mitre.org/groups/G0016/\nAPT29 / Midnight Blizzard\nT1566.001, T1059.001, T1003.001' },
      { id: 'layerName', label: 'Layer name (optional)', type: 'text', placeholder: 'APT29 TTPs â€” May 2026' },
      { id: 'matrix', label: 'Matrix', type: 'select', options: ['Enterprise', 'Mobile', 'ICS'] },
    ],
    buildMsg: (vals) => `${v(vals,'input').trim()}${v(vals,'layerName') ? '\n\nLayer name: '+v(vals,'layerName') : ''}\n\nMatrix: ${v(vals,'matrix') || 'Enterprise'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-attack-navigator',
  },
  {
    id: 'detection-as-code',
    name: 'Detection as Code',
    tagline: 'Sigma rules + KQL from threat intel or TTPs',
    badge: 'DETECTIONS', badgeColor: '#06b6d4', category: 'ondemand',
    description: 'Converts a threat actor profile, report URL, or MITRE ATT&CK TTP list into Sigma rules and Sentinel/Defender KQL queries. MITRE tags, TTP coverage matrix, copy-on-click code blocks. All rules marked DRAFT.',
    inputs: [
      { id: 'input', label: 'URL Â· TTP List Â· Actor Description', type: 'textarea', required: true, placeholder: 'https://mandiant.com/apt29\nT1566.001, T1059.001, T1003.001\nAPT29 spearphishing with PowerShell' },
      { id: 'platform', label: 'Primary SIEM / EDR', type: 'select', options: ['Microsoft Sentinel', 'Microsoft Defender', 'Splunk', 'Elastic', 'Generic Sigma'] },
    ],
    buildMsg: (vals) => `${v(vals,'input').trim()}\n\nPrimary SIEM/EDR: ${v(vals,'platform') || 'Microsoft Sentinel'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-detection-as-code',
  },
  {
    id: 'yara-generator',
    name: 'YARA Rule Generator',
    tagline: 'Build DRAFT YARA rules from a report or malware description',
    badge: 'YARA', badgeColor: '#84cc16', category: 'ondemand',
    description: 'Builds DRAFT YARA rules from a malware analysis, vendor report, or sample writeup. Covers strings, byte patterns, PE metadata, and packer/obfuscator signatures. All rules marked DRAFT for analyst review.',
    inputs: [
      { id: 'input', label: 'URL Â· Report Â· Malware analysis', type: 'textarea', required: true, placeholder: 'https://www.mandiant.com/resources/blog/...\nor paste a malware analysis / sample writeup directly' },
      { id: 'family', label: 'Malware family name (optional)', type: 'text', placeholder: 'WINELOADER Â· BumbleBee Â· IcedID' },
      { id: 'scope', label: 'Detection scope', type: 'select', options: ['Process memory + disk', 'Disk-only', 'Memory-only', 'Email attachment scan'] },
    ],
    buildMsg: (vals) => `${v(vals,'input').trim()}${v(vals,'family') ? '\n\nMalware family: '+v(vals,'family') : ''}\n\nDetection scope: ${v(vals,'scope') || 'Process memory + disk'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-yara-generator',
  },

  // â”€â”€ DFIR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: 'log-analysis',
    name: 'Log Analysis (Sherlog Holmes)',
    tagline: 'Interactive SIEM-style log dashboard',
    badge: 'DFIR Â· LOGS', badgeColor: '#10b981', category: 'dfir',
    description: 'Standalone investigation dashboard for log triage â€” file upload, severity filters, IP correlation, AI-assisted summarisation. Opens in a new browser tab.',
    external: true,
    url: '../log-analysis/siem-dashboard.html',
  },
  {
    id: 'phishing-dfir',
    name: 'Phishing DFIR',
    tagline: 'Forensic analysis of a single suspicious email',
    badge: 'PHISHING', badgeColor: '#f97316', category: 'dfir',
    description: 'Full DFIR on one phishing email. Header analysis (SPF/DKIM/DMARC), sender infrastructure enrichment, URL redirect-chain, attachment hash sandbox lookups, phishing-kit identification, campaign attribution, and containment actions.',
    inputs: [
      { id: 'input', label: 'Headers + body Â· .eml content Â· URL to phish report', type: 'textarea', required: true, placeholder: 'Paste full email headers and body, or a URL to a published phishing report.' },
      { id: 'region', label: 'Reporting region', type: 'select', options: ['AU (ACSC ReportCyber)', 'USA (IC3/CISA)', 'UK (NCSC)', 'EU (national CERT)', 'Canada (CCCS)', 'Japan (JPCERT)', 'Other / Global'] },
    ],
    buildMsg: (vals) => `${v(vals,'input').trim()}\n\nReporting region: ${v(vals,'region') || 'AU (ACSC ReportCyber)'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'dfir-phishing-analysis',
  },
  {
    id: 'incident-timeline',
    name: 'Incident Timeline',
    tagline: 'Chronological UTC + Melbourne timeline from raw events',
    badge: 'TIMELINE', badgeColor: '#fb923c', category: 'dfir',
    description: 'Consolidates raw events (paste logs, IR notes, CSV slices, SIEM exports) into a clean chronological incident timeline in UTC and Melbourne local time (AEST/AEDT DST-aware), with source, confidence, phase classification, and anomaly callouts.',
    inputs: [
      { id: 'events', label: 'Raw events â€” paste logs, IR notes, CSV, or SIEM rows', type: 'textarea', required: true, placeholder: '2026-05-15T08:34:11Z auth.log: SSH login user=admin source=185.220.x.x\n2026-05-15T08:35:02Z proc: powershell.exe -EncodedCommand <b64>' },
      { id: 'incident', label: 'Incident name / reference (optional)', type: 'text', placeholder: 'INC-2026-0512 â€” suspected APT intrusion' },
      { id: 'anchor', label: 'Time-zero anchor (optional)', type: 'text', placeholder: '2026-05-15T08:34:11Z (first suspicious login)' },
    ],
    buildMsg: (vals) => `${v(vals,'incident') ? 'Incident: '+v(vals,'incident')+'\n\n' : ''}${v(vals,'anchor') ? 'Time-zero anchor: '+v(vals,'anchor')+'\n\n' : ''}Events:\n${v(vals,'events').trim()}`,
    needsSearch: false, maxTokens: 32000, skillPath: 'dfir-incident-timeline',
  },

  {
    id: 'ir-playbook',
    name: 'IR Playbook Generator',
    tagline: 'NIST 800-61r3 operator playbooks for 12 attack types',
    badge: 'IR PLAYBOOK', badgeColor: '#0891b2', category: 'dfir',
    description: 'Generates an interactive, operator-ready Incident Response Playbook aligned to the NIST SP 800-61r3 lifecycle (Preparation, Detection and Analysis, Containment, Eradication, Recovery, Post-Incident). Choose a single attack type or generate all 12 in one switchable HTML. Each playbook includes phase-by-phase checkbox task lists with localStorage persistence, decision trees, escalation paths, copy-on-click communication templates, evidence preservation checklists, regulatory notification guidance, MITRE ATT&CK mapping, an incident tracking panel (ID, severity, elapsed timer), and a JSON state export.',
    inputs: [
      {
        id: 'attacktype', label: 'Attack type', type: 'select',
        options: [
          'all (full interactive suite — all 13 attack types)',
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
          'Zero-Day Exploitation',
          'AI-Enabled Attack (Autonomous Agent / Claude Mythos)',
        ],
      },
      { id: 'orgcontext', label: 'Organisation context (optional)', type: 'text', placeholder: 'e.g. ASX-listed financial services, M365, hybrid Azure/on-prem' },
      { id: 'region', label: 'Regulatory region', type: 'select', options: ['AU', 'USA', 'UK', 'EU', 'Canada', 'Singapore', 'Japan', 'Global'] },
    ],
    buildMsg: (vals) => {
      const type = v(vals, 'attacktype')
      const slug = (!type || type.startsWith('all')) ? 'all' : type
      return [slug, v(vals, 'orgcontext').trim(), v(vals, 'region') || 'AU'].filter(Boolean).join(' ')
    },
    needsSearch: false, maxTokens: 32000, skillPath: 'dfir-ir-playbook',
  },

  // â”€â”€ Strategy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: 'threat-model',
    name: 'Threat Model',
    tagline: 'PASTA or STRIDE threat model from a system or architecture',
    badge: 'THREAT MODEL', badgeColor: '#f59e0b', category: 'strategy',
    description: 'Structured threat model in PASTA or STRIDE. Inline SVG data-flow diagram, MITRE ATT&CK / CWE / CAPEC mappings, threat register with likelihood x impact heatmap, prioritised mitigations mapped to NIST CSF 2.0 + ASD Essential Eight.',
    inputs: [
      { id: 'input', label: 'URL or System Description', type: 'textarea', required: true, placeholder: 'https://docs.company.com/architecture\nCloud SaaS HR platform using Azure AD, PostgreSQL, REST APIs' },
      { id: 'methodology', label: 'Methodology', type: 'select', options: ['PASTA', 'STRIDE'] },
      { id: 'context', label: 'Organisation context (optional)', type: 'text', placeholder: 'Australian financial services, 500 staff, hybrid Azure' },
    ],
    buildMsg: (vals) => `Methodology: ${v(vals,'methodology') || 'PASTA'}\n\n${v(vals,'input').trim()}${v(vals,'context') ? '\n\nOrganisation context: '+v(vals,'context') : ''}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-threat-model',
  },
  {
    id: 'tabletop',
    name: 'Tabletop Exercise',
    tagline: 'IR tabletop facilitator pack from threat intel',
    badge: 'TTX', badgeColor: '#22c55e', category: 'strategy',
    description: 'Facilitator-ready IR TTX from a threat actor URL or event. Six phased injects, facilitator notes, discussion questions, time budget, AU regulatory triggers (ACSC, SOCI, OAIC NDB, APRA CPS 234). Projectable.',
    inputs: [
      { id: 'input', label: 'Threat Intel URL or Actor Name', type: 'textarea', required: true, placeholder: 'https://mandiant.com/apt29-report\nFAMOUS CHOLLIMA / Lazarus Group\nRansomware targeting AU healthcare' },
      { id: 'duration', label: 'Duration', type: 'select', options: ['2 hours', '90 minutes', '3 hours', 'Half day (4 hours)'] },
      { id: 'audience', label: 'Audience', type: 'select', options: ['Executive / Board', 'CISO + IR Team', 'SOC + Technical', 'Mixed (Exec + Technical)'] },
    ],
    buildMsg: (vals) => `${v(vals,'input').trim()} [Duration: ${v(vals,'duration') || '2 hours'}] [Audience: ${v(vals,'audience') || 'CISO + IR Team'}]`,
    needsSearch: true, maxTokens: 60000, skillPath: 'cti-tabletop',
  },
  {
    id: 'bas-red-team',
    name: 'BAS / Red Team Plan',
    tagline: 'Breach and attack simulation campaign plan with MITRE coverage',
    badge: 'RED TEAM', badgeColor: '#dc2626', category: 'strategy',
    description: 'Structured breach and attack simulation (BAS) campaign plan in the style of Cymulate, AttackIQ, and SafeBreach. Produces 6-8 attack playbooks with kill chain narratives, atomic test cases (BLOCKED / ALERTED / LOGGED / MISSED), per-control-layer effectiveness matrix, MITRE ATT&CK coverage heatmap, animated posture score gauge, detection gap analysis, and a 3-horizon remediation roadmap.',
    inputs: [
      { id: 'target', label: 'Target description', type: 'textarea', required: true, placeholder: 'Mid-size Australian bank with M365, Defender for Endpoint, Sentinel, Proofpoint\n\nor just: "Australian healthcare provider on AWS" and we will derive the stack' },
      { id: 'stack', label: 'Security stack (optional)', type: 'text', placeholder: 'EDR: CrowdStrike · SIEM: Splunk · Email: Proofpoint · MFA: Okta' },
      { id: 'scope', label: 'Assessment scope', type: 'select', options: ['Full kill chain (all stages)', 'Email and phishing only', 'Endpoint and LOLBAS', 'Lateral movement and identity', 'Ransomware simulation', 'Exfiltration and C2'] },
      { id: 'threat', label: 'Threat actor profile (optional)', type: 'text', placeholder: 'APT29 · LockBit · FIN7 · financially motivated · insider threat' },
    ],
    buildMsg: (vals) => `Target: ${v(vals,'target').trim()}${v(vals,'stack') ? '\n\nSecurity stack: '+v(vals,'stack') : ''}${v(vals,'scope') ? '\n\nAssessment scope: '+v(vals,'scope') : '\n\nAssessment scope: Full kill chain (all stages)'}${v(vals,'threat') ? '\n\nThreat actor profile: '+v(vals,'threat') : ''}`,
    needsSearch: true, maxTokens: 60000, skillPath: 'bas-red-team-simulation',
  },
  {
    id: 'mythos-ready',
    name: 'Mythos-Ready Assessment',
    tagline: 'Strategic plan to prepare an org for Claude Mythos',
    badge: 'MYTHOS', badgeColor: '#b91c1c', category: 'strategy',
    description: 'Client-deliverable strategic recommendation report based on the Mythos-ready Security Program framework. Walks 6 Key Takeaways, 13-entry Risk Register (OWASP LLM Top 10, MITRE ATLAS, NIST CSF 2.0), 11 Priority Actions, and a 90-day board template.',
    inputs: [
      { id: 'org', label: 'Organisation context â€” sector, size, current maturity, key concerns', type: 'textarea', required: true, placeholder: 'Australian ASX-listed financial services, ~3,000 staff, mature on Essential Eight ML2, hybrid Azure + on-prem, growing AI/agent deployment.' },
      { id: 'currentMaturity', label: 'Current security maturity baseline (optional)', type: 'select', options: ['Not assessed', 'Essential Eight ML1', 'Essential Eight ML2', 'Essential Eight ML3', 'NIST CSF basic', 'NIST CSF managed', 'NIST CSF optimised', 'ISO 27001 certified'] },
      { id: 'region', label: 'Regulatory region (optional)', type: 'select', options: ['Australia', 'USA', 'UK', 'EU', 'Canada', 'Japan', 'Singapore', 'Global'] },
      { id: 'horizon', label: 'Roadmap horizon (optional)', type: 'select', options: ['90 days', '180 days', '12 months', '24 months'] },
    ],
    buildMsg: (vals) => `Organisation context:\n${v(vals,'org').trim()}\n\n${v(vals,'currentMaturity') ? 'Current maturity baseline: '+v(vals,'currentMaturity')+'\n' : ''}${v(vals,'region') ? 'Regulatory region: '+v(vals,'region')+'\n' : ''}Roadmap horizon: ${v(vals,'horizon') || '12 months'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-mythos-ready-assessment',
  },
]

export const CATEGORY_LABELS: Record<string, string> = {
  reports:  'CTI Reports',
  ondemand: 'On-Demand CTI',
  dfir:     'DFIR',
  strategy: 'Strategy',
}

export const CATEGORY_ORDER = ['reports', 'ondemand', 'dfir', 'strategy'] as const
