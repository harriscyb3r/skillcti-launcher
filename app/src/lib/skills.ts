import type { Skill } from './types'

const v = (vals: Record<string, string>, key: string) => vals[key] ?? ''

export const SKILLS: Skill[] = [
  // ── Daily briefs ──────────────────────────────────────────────
  {
    id: 'daily-brief-global',
    name: 'Daily Brief (Global)',
    tagline: 'One-page global cyber news brief — last 24 hours',
    badge: 'DAILY', badgeColor: '#14b8a6', category: 'reports',
    description: 'Compact single-page global cybersecurity news brief covering the last 24 hours. TLDR bullets, 4-6 top stories, CVE watch, ransomware watch, and what to expect in the next 24-48 hours.',
    inputs: [
      { id: 'date', label: 'Date (optional — defaults to last 24 hours)', type: 'text', placeholder: '2026-05-15' },
      { id: 'focus', label: 'Regional weighting (optional)', type: 'text', placeholder: 'APAC · US · UK · EMEA — leave blank for true global' },
    ],
    buildMsg: (vals) => `${v(vals,'date') ? 'Reporting date: '+v(vals,'date') : 'Reporting window: last 24 hours from now'}${v(vals,'focus') ? ' [Regional weighting: '+v(vals,'focus')+']' : ' [Truly global]'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-daily-brief-global',
  },

  // ── Monthly reports — consolidated (4 cards, 8 underlying skills) ───────────
  {
    id: 'operational',
    name: 'Operational CTI',
    tagline: 'Monthly brief for SOC, IR, and vulnerability management',
    badge: 'OPERATIONAL', badgeColor: '#ef4444', category: 'reports',
    description: 'Dense monthly brief for analysts. CVE deep-dives, IOC table, DRAFT Sigma/KQL detection stubs, malware tooling shifts. Australia mode: ACSC advisories, Essential Eight framing, SOCI Act context. Global mode: multi-CERT coverage with optional country/region weighting.',
    inputs: [
      { id: 'geography', label: 'Geography', type: 'select', required: true, options: ['Australia', 'Global'] },
      { id: 'region', label: 'Country or region (optional)', type: 'text', placeholder: 'USA · UK · Germany · APAC · Five Eyes', showWhen: { field: 'geography', value: 'Global' } },
      { id: 'month', label: 'Month (optional — defaults to last 30 days)', type: 'text', placeholder: '2026-04' },
      { id: 'focus', label: 'Sector focus (optional)', type: 'text', placeholder: 'Finance · Healthcare · Critical Infrastructure' },
    ],
    buildMsg: (vals) => {
      const au = (vals.geography || 'Australia') !== 'Global'
      const base = `${vals.month || 'Current month'}${vals.focus ? ' [Sector focus: ' + vals.focus + ']' : ''}`
      return au ? base : base + (vals.region ? ' [Region: ' + vals.region + ']' : ' [Worldwide synthesis]')
    },
    skillPath: (vals) => (vals.geography || 'Australia') === 'Global'
      ? 'cti-monthly-report-operational-global'
      : 'cti-monthly-report-operational-australia',
    needsSearch: true, maxTokens: 32000,
  },
  {
    id: 'tactical',
    name: 'Tactical CTI',
    tagline: 'Monthly brief for SOC managers and threat hunters',
    badge: 'TACTICAL', badgeColor: '#f59e0b', category: 'reports',
    description: 'Mid-depth monthly for practitioners fluent in ATT&CK. BLUF, incidents with TTP analysis, priority CVEs with detection notes, hunt hypotheses. Australia mode: ACSC advisories mapped to Essential Eight. Global mode: optional country/region weighting.',
    inputs: [
      { id: 'geography', label: 'Geography', type: 'select', required: true, options: ['Australia', 'Global'] },
      { id: 'region', label: 'Country or region (optional)', type: 'text', placeholder: 'USA · UK · EMEA · APAC', showWhen: { field: 'geography', value: 'Global' } },
      { id: 'month', label: 'Month (optional)', type: 'text', placeholder: '2026-04' },
    ],
    buildMsg: (vals) => {
      const au = (vals.geography || 'Australia') !== 'Global'
      const base = vals.month || 'Current month'
      return au ? base : base + (vals.region ? ' [Region: ' + vals.region + ']' : ' [Worldwide synthesis]')
    },
    skillPath: (vals) => (vals.geography || 'Australia') === 'Global'
      ? 'cti-monthly-report-tactical-global'
      : 'cti-monthly-report-tactical-australia',
    needsSearch: true, maxTokens: 32000,
  },
  {
    id: 'strategic',
    name: 'Strategic CTI',
    tagline: 'Monthly brief for executives and the board',
    badge: 'STRATEGIC', badgeColor: '#a855f7', category: 'reports',
    description: 'Plain-English board brief. BLUF, exec summary with stats, monthly themes with business impact, top vulnerabilities in business terms, regulatory posture, board-level recommendations. Australia mode: ACSC/SOCI framing. Global mode: localised to the selected country/region.',
    inputs: [
      { id: 'geography', label: 'Geography', type: 'select', required: true, options: ['Australia', 'Global'] },
      { id: 'region', label: 'Country or region (optional)', type: 'text', placeholder: 'USA · UK · EU · APAC', showWhen: { field: 'geography', value: 'Global' } },
      { id: 'month', label: 'Month (optional)', type: 'text', placeholder: '2026-04' },
      { id: 'sector', label: 'Industry context (optional)', type: 'text', placeholder: 'Financial services · ASX-listed · Healthcare' },
    ],
    buildMsg: (vals) => {
      const au = (vals.geography || 'Australia') !== 'Global'
      const base = `${vals.month || 'Current month'}${vals.sector ? ' [Industry: ' + vals.sector + ']' : ''}`
      return au ? base : base + (vals.region ? ' [Region: ' + vals.region + ']' : ' [Worldwide synthesis]')
    },
    skillPath: (vals) => (vals.geography || 'Australia') === 'Global'
      ? 'cti-monthly-report-strategic-global'
      : 'cti-monthly-report-strategic-australia',
    needsSearch: true, maxTokens: 32000,
  },
  {
    id: 'sector',
    name: 'Sector Report',
    tagline: 'Long-horizon industry vertical deep-dive',
    badge: 'SECTOR', badgeColor: '#06b6d4', category: 'reports',
    description: 'Multi-month sector intelligence report. Threat actor landscape, notable incidents, MITRE TTP trends, CVE and supply-chain trends, regulator posture, outlook. Australia mode: ACSC/SOCI/APRA framing. Global mode: optional country/region weighting with appropriate regulatory context.',
    inputs: [
      { id: 'geography', label: 'Geography', type: 'select', required: true, options: ['Australia', 'Global'] },
      { id: 'sector', label: 'Industry sector', type: 'text', required: true, placeholder: 'Healthcare · Finance · Energy · Manufacturing · Defence · Education · Telco · Transport · Government' },
      { id: 'region', label: 'Country or region (optional)', type: 'text', placeholder: 'USA · UK · Germany · Japan · EMEA · APAC', showWhen: { field: 'geography', value: 'Global' } },
      { id: 'horizon', label: 'Horizon (optional — defaults to 12 months)', type: 'select', options: ['12 months', '6 months', '18 months', '24 months'] },
    ],
    buildMsg: (vals) => {
      const au = (vals.geography || 'Australia') !== 'Global'
      const base = `Sector: ${(vals.sector || '').trim()} [Horizon: ${vals.horizon || '12 months'}]`
      return au ? base : base + (vals.region ? ' [Region: ' + vals.region + ']' : ' [Worldwide synthesis]')
    },
    skillPath: (vals) => (vals.geography || 'Australia') === 'Global'
      ? 'cti-sector-report-global'
      : 'cti-sector-report-australia',
    needsSearch: true, maxTokens: 32000,
  },

  // ── Monthly AU (hidden — kept for history references) ─────────────────────
  {
    id: 'operational-au',
    hidden: true,
    name: 'Operational CTI (AU)',
    tagline: 'Monthly AU report for SOC, IR, and vuln management',
    badge: 'OPERATIONAL', badgeColor: '#ef4444', category: 'reports',
    description: 'Dense monthly HTML for analysts. CVE deep-dives with exploitation status, ACSC advisories, public IOC table, DRAFT Sigma/KQL detection stubs, and global malware tooling shifts. Everything cited.',
    inputs: [
      { id: 'month', label: 'Month (optional — defaults to last 30 days)', type: 'text', placeholder: '2026-04' },
      { id: 'focus', label: 'Sector focus (optional)', type: 'text', placeholder: 'Finance, Healthcare, Critical Infrastructure' },
    ],
    buildMsg: (vals) => `${v(vals,'month') || 'Current month'}${v(vals,'focus') ? ' [Sector focus: '+v(vals,'focus')+']' : ''}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-monthly-report-operational-australia',
  },
  {
    id: 'tactical-au',
    hidden: true,
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
    hidden: true,
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

  // ── Monthly Global (hidden — kept for history references) ────────────────────
  {
    id: 'operational-global',
    hidden: true,
    name: 'Operational CTI (Global)',
    tagline: 'Monthly global report for SOC, IR, and vuln management',
    badge: 'OPERATIONAL', badgeColor: '#ef4444', category: 'reports',
    description: 'Worldwide operational monthly. Optional country/region weighting. Dense CVE deep-dives, regulator/CERT advisories, consolidated IOCs, DRAFT detection stubs.',
    inputs: [
      { id: 'region', label: 'Country or region (optional — defaults to worldwide)', type: 'text', placeholder: 'USA · UK · Germany · APAC · Five Eyes' },
      { id: 'month', label: 'Month (optional)', type: 'text', placeholder: '2026-04' },
      { id: 'focus', label: 'Sector focus (optional)', type: 'text', placeholder: 'Finance, Critical Infrastructure' },
    ],
    buildMsg: (vals) => `${v(vals,'month') || 'Current month'}${v(vals,'region') ? ' [Region: '+v(vals,'region')+']' : ' [Worldwide synthesis]'}${v(vals,'focus') ? ' [Sector focus: '+v(vals,'focus')+']' : ''}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-monthly-report-operational-global',
  },
  {
    id: 'tactical-global',
    hidden: true,
    name: 'Tactical CTI (Global)',
    tagline: 'Monthly global brief for SOC managers and threat hunters',
    badge: 'TACTICAL', badgeColor: '#f59e0b', category: 'reports',
    description: 'Mid-depth monthly for practitioners fluent in ATT&CK. Optional country/region weighting. BLUF, incidents with TTP analysis, priority CVEs with detection notes, hunt hypotheses.',
    inputs: [
      { id: 'region', label: 'Country or region (optional)', type: 'text', placeholder: 'USA · UK · EMEA · APAC' },
      { id: 'month', label: 'Month (optional)', type: 'text', placeholder: '2026-04' },
    ],
    buildMsg: (vals) => `${v(vals,'month') || 'Current month'}${v(vals,'region') ? ' [Region: '+v(vals,'region')+']' : ' [Worldwide synthesis]'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-monthly-report-tactical-global',
  },
  {
    id: 'strategic-global',
    hidden: true,
    name: 'Strategic CTI (Global)',
    tagline: 'Monthly global brief for executives and the board',
    badge: 'STRATEGIC', badgeColor: '#a855f7', category: 'reports',
    description: 'Plain-English board brief covering global cyber activity. Optional country/region weighting with localised regulatory framing.',
    inputs: [
      { id: 'region', label: 'Country or region (optional)', type: 'text', placeholder: 'USA · UK · EU · APAC' },
      { id: 'month', label: 'Month (optional)', type: 'text', placeholder: '2026-04' },
      { id: 'sector', label: 'Industry context (optional)', type: 'text', placeholder: 'Financial services, SaaS, Healthcare' },
    ],
    buildMsg: (vals) => `${v(vals,'month') || 'Current month'}${v(vals,'region') ? ' [Region: '+v(vals,'region')+']' : ' [Worldwide synthesis]'}${v(vals,'sector') ? ' [Industry: '+v(vals,'sector')+']' : ''}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-monthly-report-strategic-global',
  },

  // ── Sector reports (hidden — kept for history references) ────────────────────
  {
    id: 'sector-au',
    hidden: true,
    name: 'Sector Report (AU)',
    tagline: 'Long-horizon AU industry vertical deep-dive',
    badge: 'SECTOR · AU', badgeColor: '#06b6d4', category: 'reports',
    description: 'Multi-month (default 12m) sector intelligence for Australia. Sector profile, threat actor landscape, notable incidents, MITRE TTP trends, CVE and supply-chain trends, ACSC/SOCI/APRA posture, outlook, recommendations.',
    inputs: [
      { id: 'sector', label: 'Industry sector', type: 'text', required: true, placeholder: 'Healthcare · Finance · Energy · Manufacturing · Defence · Education · Telecommunications · Transport · Water · Mining · Retail · Government · Technology' },
      { id: 'horizon', label: 'Horizon (optional — defaults to 12m)', type: 'select', options: ['12 months', '6 months', '18 months', '24 months'] },
    ],
    buildMsg: (vals) => `Sector: ${v(vals,'sector').trim()} [Horizon: ${v(vals,'horizon') || '12 months'}]`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-sector-report-australia',
  },
  {
    id: 'sector-global',
    hidden: true,
    name: 'Sector Report (Global)',
    tagline: 'Long-horizon global industry vertical deep-dive',
    badge: 'SECTOR · GLOBAL', badgeColor: '#06b6d4', category: 'reports',
    description: 'Multi-month (default 12m) global sector intelligence. Optional country/region weighting. Sector profile, threat actor landscape, incidents, TTP trends, CVE and supply-chain trends, regulator posture, outlook.',
    inputs: [
      { id: 'sector', label: 'Industry sector', type: 'text', required: true, placeholder: 'Healthcare · Finance · Energy · Manufacturing · Defence · Education · Telecom · Transport · Water · Mining · Retail · Government · Technology · Pharma · Oil and gas · Aviation' },
      { id: 'region', label: 'Country or region (optional)', type: 'text', placeholder: 'USA · UK · Germany · Japan · EMEA · APAC' },
      { id: 'horizon', label: 'Horizon (optional)', type: 'select', options: ['12 months', '6 months', '18 months', '24 months'] },
    ],
    buildMsg: (vals) => `Sector: ${v(vals,'sector').trim()}${v(vals,'region') ? ' [Region: '+v(vals,'region')+']' : ' [Worldwide synthesis]'} [Horizon: ${v(vals,'horizon') || '12 months'}]`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-sector-report-global',
  },

  // ── On-demand CTI ─────────────────────────────────────────────
  {
    id: 'security-advisory',
    name: 'Security Advisory',
    tagline: 'Exec briefing on a breach, CVE, or cyber event',
    badge: 'ADVISORY', badgeColor: '#a855f7', category: 'ondemand',
    description: 'Produces a client-deliverable executive advisory on any cyber event, CVE, or breach. Vendor advisory analysis, affected versions, exploitation status, AU impact, recommended actions, regulatory context.',
    inputs: [
      { id: 'event', label: 'URL · CVE ID · Event Name', type: 'textarea', required: true, placeholder: 'CVE-2024-12345\nhttps://vendor.com/advisory\nMOVEit 2023 breach' },
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
      { id: 'input', label: 'URL · Actor Name · Report Excerpt', type: 'textarea', required: true, placeholder: 'https://www.mandiant.com/resources/blog/apt29-wineloader\nAPT29 / Midnight Blizzard / Cozy Bear\nFIN7' },
      { id: 'context', label: 'Reader context (optional)', type: 'text', placeholder: 'Australian finance CISO · APAC SOC lead' },
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
      { id: 'input', label: 'URL · pasted intelligence report · file content', type: 'textarea', required: true, placeholder: 'https://www.mandiant.com/resources/blog/...\nor paste the full report text here' },
      { id: 'context', label: 'Assessment context (optional)', type: 'text', placeholder: 'Internal SOC use · client briefing · pre-publication peer review' },
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
      { id: 'input', label: 'URL · Pasted report · IOC list', type: 'textarea', required: true, placeholder: 'https://www.mandiant.com/resources/blog/apt29-wineloader\n\nor paste a vendor advisory / blog / report excerpt directly' },
      { id: 'attribution', label: 'Attribution context (optional)', type: 'text', placeholder: 'APT29 / Midnight Blizzard / WINELOADER campaign' },
      { id: 'tlp', label: 'TLP marking', type: 'select', options: ['AMBER+STRICT', 'AMBER', 'GREEN', 'CLEAR', 'RED'] },
    ],
    buildMsg: (vals) => `${v(vals,'input').trim()}${v(vals,'attribution') ? '\n\nAttribution context: '+v(vals,'attribution') : ''}\n\nTLP marking: ${v(vals,'tlp') || 'AMBER+STRICT'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-stix-export', underDevelopment: true,
  },
  {
    id: 'attack-navigator',
    name: 'ATT&CK Navigator Layer',
    tagline: 'Renders the ATT&CK matrix inline + exports a Navigator JSON layer',
    badge: 'NAVIGATOR', badgeColor: '#dc2626', category: 'ondemand',
    description: 'Extracts MITRE ATT&CK techniques from a threat report or TTP list and renders a visual ATT&CK matrix inline in HTML, plus emits a valid Navigator JSON layer for upload to attack-navigator.mitre.org.',
    inputs: [
      { id: 'input', label: 'URL · Actor name · TTP list · Report excerpt', type: 'textarea', required: true, placeholder: 'https://attack.mitre.org/groups/G0016/\nAPT29 / Midnight Blizzard\nT1566.001, T1059.001, T1003.001' },
      { id: 'layerName', label: 'Layer name (optional)', type: 'text', placeholder: 'APT29 TTPs — May 2026' },
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
      { id: 'input', label: 'URL · TTP List · Actor Description', type: 'textarea', required: true, placeholder: 'https://mandiant.com/apt29\nT1566.001, T1059.001, T1003.001\nAPT29 spearphishing with PowerShell' },
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
      { id: 'input', label: 'URL · Report · Malware analysis', type: 'textarea', required: true, placeholder: 'https://www.mandiant.com/resources/blog/...\nor paste a malware analysis / sample writeup directly' },
      { id: 'family', label: 'Malware family name (optional)', type: 'text', placeholder: 'WINELOADER · BumbleBee · IcedID' },
      { id: 'scope', label: 'Detection scope', type: 'select', options: ['Process memory + disk', 'Disk-only', 'Memory-only', 'Email attachment scan'] },
    ],
    buildMsg: (vals) => `${v(vals,'input').trim()}${v(vals,'family') ? '\n\nMalware family: '+v(vals,'family') : ''}\n\nDetection scope: ${v(vals,'scope') || 'Process memory + disk'}`,
    needsSearch: true, maxTokens: 32000, skillPath: 'cti-yara-generator', underDevelopment: true,
  },

  {
    id: 'post-incident-review',
    name: 'Post-Incident Review',
    tagline: 'Structured lessons-learned review from an incident report',
    badge: 'PIR', badgeColor: '#8b5cf6', category: 'strategy',
    description: 'Takes a cyber security incident report (URL, PDF, or pasted text) and produces a structured Post-Incident Review. Covers timeline reconstruction, root cause analysis (5 Whys), MITRE ATT&CK TTP mapping, detection gap analysis, containment effectiveness, lessons learned, control improvements mapped to NIST CSF / Essential Eight / ISO 27001, DRAFT Sigma/KQL detection stubs, and a prioritised action register.',
    inputs: [
      { id: 'file_upload', label: 'Attach incident report (.pdf .docx .txt .html .md)', type: 'file', accept: '.pdf,.docx,.doc,.txt,.html,.htm,.md,.json,.csv,.log' },
      { id: 'input', label: 'Or paste report text / URL', type: 'textarea', placeholder: 'https://company.com/incident-report\nor paste the incident report / after-action review text directly' },
      { id: 'incident', label: 'Incident name / reference (optional)', type: 'text', placeholder: 'INC-2026-0512 — Ransomware — Finance Division' },
      { id: 'severity', label: 'Incident severity', type: 'select', options: ['Critical', 'High', 'Medium', 'Low'] },
      { id: 'region', label: 'Regulatory region', type: 'select', options: ['AU', 'USA', 'UK', 'EU', 'Canada', 'Singapore', 'Japan', 'Global'] },
    ],
    buildMsg: (vals) => {
      const reportContent = v(vals,'file_upload') || v(vals,'input').trim()
      const filename = v(vals,'file_upload__name')
      return [
        v(vals,'incident') ? 'Incident: '+v(vals,'incident') : '',
        v(vals,'severity') ? 'Severity: '+v(vals,'severity') : '',
        'Regulatory region: '+(v(vals,'region') || 'AU'),
        filename ? 'Source file: '+filename : '',
        '',
        'Incident report:',
        reportContent,
      ].filter((l, i) => i >= 5 || l !== '').join('\n')
    },
    needsSearch: true, maxTokens: 32000, skillPath: 'dfir-post-incident-review',
  },
  {
    id: 'ir-playbook',
    name: 'IR Playbook Generator',
    tagline: 'NIST 800-61r3 operator playbooks for 12 attack types',
    badge: 'IR PLAYBOOK', badgeColor: '#0891b2', category: 'strategy',
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

  // ── Strategy ──────────────────────────────────────────────────
  {
    id: 'tprm-vendor-risk',
    name: 'Thirdy Party Risk Intelligence',
    tagline: 'CVEs, breaches, enforcement, and media signals for a vendor list',
    badge: 'TPRM', badgeColor: '#0891b2', category: 'tprm',
    description: 'Third-party risk intelligence report for a list of vendor products and companies. For each vendor: recent CVEs and CISA KEV hits, confirmed breaches and ransomware incidents, regulatory enforcement actions, and negative media across security press AND mainstream business outlets (Reuters, Bloomberg, FT, WSJ, AFR, Guardian). Catches governance failures, whistleblower stories, and executive misconduct that surface in general news before security media. Output: executive summary, 2x2 risk matrix, per-vendor cards (6 signal categories each), sortable CVE table, cross-vendor incident timeline, P1/P2/P3 recommendations board. Risk tiers: CRITICAL / HIGH / MEDIUM / LOW / UNKNOWN. Capped at 10 vendors per run.',
    inputs: [
      { id: 'vendors', label: 'Vendors and products (comma-separated)', type: 'textarea', required: true, placeholder: 'Okta, Salesforce, Ivanti, ServiceNow\n\nor include products: MOVEit, Citrix ADC, Fortinet FortiGate' },
      { id: 'industry', label: 'Industry context (optional)', type: 'text', placeholder: 'Financial services · Healthcare · Critical infrastructure · Government' },
      { id: 'region', label: 'Region', type: 'select', options: ['Global (AU context)', 'AU', 'USA', 'UK', 'EU', 'Canada', 'Singapore', 'Japan'] },
    ],
    buildMsg: (vals) => `${v(vals,'vendors').trim()}${v(vals,'industry') ? '\n\nIndustry context: '+v(vals,'industry') : ''}\n\nRegion: ${v(vals,'region') || 'Global (AU context)'}`,
    needsSearch: true, maxTokens: 64000, skillPath: 'tprm-vendor-risk', haikuWarning: true, underDevelopment: true,
  },

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
    needsSearch: true, maxTokens: 64000, skillPath: 'cti-threat-model', haikuWarning: true,
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
    needsSearch: true, maxTokens: 60000, skillPath: 'cti-tabletop', haikuWarning: true,
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
    needsSearch: true, maxTokens: 60000, skillPath: 'bas-red-team-simulation', haikuWarning: true, underDevelopment: true,
  },
  {
    id: 'mythos-ready',
    name: 'Mythos-Ready Assessment',
    tagline: 'Strategic plan to prepare an org for Claude Mythos',
    badge: 'MYTHOS', badgeColor: '#b91c1c', category: 'strategy',
    description: 'Client-deliverable strategic recommendation report based on the Mythos-ready Security Program framework. Walks 6 Key Takeaways, 13-entry Risk Register (OWASP LLM Top 10, MITRE ATLAS, NIST CSF 2.0), 11 Priority Actions, and a 90-day board template.',
    inputs: [
      { id: 'org', label: 'Organisation context — sector, size, current maturity, key concerns', type: 'textarea', required: true, placeholder: 'Australian ASX-listed financial services, ~3,000 staff, mature on Essential Eight ML2, hybrid Azure + on-prem, growing AI/agent deployment.' },
      { id: 'currentMaturity', label: 'Current security maturity baseline (optional)', type: 'select', options: ['Not assessed', 'Essential Eight ML1', 'Essential Eight ML2', 'Essential Eight ML3', 'NIST CSF basic', 'NIST CSF managed', 'NIST CSF optimised', 'ISO 27001 certified'] },
      { id: 'region', label: 'Regulatory region (optional)', type: 'select', options: ['Australia', 'USA', 'UK', 'EU', 'Canada', 'Japan', 'Singapore', 'Global'] },
      { id: 'horizon', label: 'Roadmap horizon (optional)', type: 'select', options: ['90 days', '180 days', '12 months', '24 months'] },
    ],
    buildMsg: (vals) => `Organisation context:\n${v(vals,'org').trim()}\n\n${v(vals,'currentMaturity') ? 'Current maturity baseline: '+v(vals,'currentMaturity')+'\n' : ''}${v(vals,'region') ? 'Regulatory region: '+v(vals,'region')+'\n' : ''}Roadmap horizon: ${v(vals,'horizon') || '12 months'}`,
    needsSearch: true, maxTokens: 64000, skillPath: 'cti-mythos-ready-assessment', haikuWarning: true,
  },
]

export const CATEGORY_LABELS: Record<string, string> = {
  reports:  'CTI Reports',
  ondemand: 'On-Demand CTI',
  strategy: 'Strategy',
  tprm:     'TPRM',
}

export const CATEGORY_ORDER = ['reports', 'ondemand', 'strategy', 'tprm'] as const
