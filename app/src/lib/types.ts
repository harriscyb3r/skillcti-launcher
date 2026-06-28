export type Format = 'html' | 'pdf' | 'pptx'
export type FieldType = 'text' | 'textarea' | 'select' | 'file'
export type SkillCategory = 'reports' | 'ondemand' | 'dfir' | 'strategy' | 'tprm'

export interface SkillField {
  id: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  options?: string[]
  /** Accepted file extensions / MIME types for type:'file' inputs */
  accept?: string
  /** Only render this field when another field equals a specific value */
  showWhen?: { field: string; value: string }
}

export interface Skill {
  id: string
  name: string
  tagline: string
  badge: string
  badgeColor: string
  category: SkillCategory
  description: string
  inputs?: SkillField[]
  buildMsg?: (values: Record<string, string>) => string
  needsSearch?: boolean
  maxTokens?: number
  /** String path, or a function resolved at launch time from form values */
  skillPath?: string | ((values: Record<string, string>) => string)
  external?: boolean
  url?: string
  defaultModel?: string
  haikuWarning?: boolean
  /** Show an "under development" indicator on the skill card */
  underDevelopment?: boolean
  /** Hide from the Skills launcher (still usable via history) */
  hidden?: boolean
}

export interface ReportMeta {
  id: string
  skillId: string
  skillName: string
  badge: string
  badgeColor: string
  timestamp: string
  title: string
  inputs: Record<string, string>
  format?: 'html' | 'pdf' | 'pptx'
  bytes: number
  model?: string
  input_tokens?: number
  output_tokens?: number
  cache_read_tokens?: number
  cache_creation_tokens?: number
  cost_usd?: number
}

export interface Report {
  meta: ReportMeta
  html: string | null
}

export interface AppSettings {
  anthropic_api_key: string
  virustotal_api_key: string
  abuseipdb_api_key: string
  urlscan_api_key: string
  shodan_api_key: string
  threatfox_api_key: string
  hybrid_analysis_api_key: string
  hibp_api_key: string
  otx_api_key: string
  proxycheck_api_key: string
  misp_url: string
  misp_api_key: string
  default_tlp: string
  geography: string
}

export interface MispEvent {
  id: string | number
  uuid?: string
  info: string
  date: string
  threat_level: 'high' | 'medium' | 'low' | 'undefined'
  analysis: 'initial' | 'ongoing' | 'complete'
  attribute_count: number
  org: string
  tags: string[]
}

export interface MispAttribute {
  id: string | number
  type: string
  category: string
  value: string
  comment?: string
  timestamp?: number
  tags?: string[]
}

export interface MispStatus {
  status: 'ok' | 'no_key' | 'bad_key' | 'error'
  version?: string
  url?: string
  perm_auth?: boolean
  detail?: string
}

export interface MispEventsResponse {
  status: string
  events: MispEvent[]
  detail?: string
}

export interface MispEventDetailResponse {
  status: string
  event: MispEvent
  attributes: MispAttribute[]
  detail?: string
}

export interface MispSearchResponse {
  status: string
  query?: string
  events: MispEvent[]
  detail?: string
}

export interface MispContextResponse {
  context: string | null
  event_count: number
  has_data: boolean
  error?: string
}

export interface OtxPulse {
  id: string
  name: string
  description: string
  author: string
  created: string
  modified: string
  tlp: string
  ioc_count: number
  tags: string[]
  targeted_countries: string[]
  industries: string[]
  attack_ids: string[]
  malware_families: string[]
  references: string[]
}

export interface OtxFeedResponse {
  status: string
  pulses: OtxPulse[]
  detail?: string
}

export interface OtxStatusResponse {
  status: string
  username?: string
  pulse_count?: number
  member_since?: string
  follower_count?: number
  detail?: string
}

export interface OtxSearchResponse {
  status: string
  ioc_type?: string
  pulse_count?: number
  verdict?: string
  reputation?: number
  asn?: string
  country_name?: string
  city?: string
  malware_count?: number
  malware_samples?: Array<{ hash: string; name: string; date: string }>
  file_type?: string
  file_size?: number
  av_detections?: number
  pulses?: Array<{
    id: string
    name: string
    author: string
    created: string
    tlp: string
    tags: string[]
    malware_families: string[]
  }>
}

export interface ThreatActor {
  name: string
  aliases: string[]
  origin: string
  targeting: string
  ttps: string[]
  recent_activity: string
}

export interface ThreatIncident {
  date: string
  title: string
  summary: string
  threat_actor: string | null
}

export interface ThreatCVE {
  cve_id: string
  cvss: number
  product: string
  description: string
  actively_exploited: boolean
}

export interface ThreatPulseData {
  status: 'ready' | 'empty' | 'error'
  geography: string | null
  current_geography: string
  generated_at?: string
  summary?: string
  threat_actors?: ThreatActor[]
  recent_incidents?: ThreatIncident[]
  relevant_cves?: ThreatCVE[]
  error?: string
}

export type WatchItemType = 'ioc' | 'cve' | 'vendor' | 'threat_actor' | 'credential'

export interface WatchItem {
  id: string
  type: WatchItemType
  value: string
  label: string
  added_at: string
  last_checked: string | null
  last_state: Record<string, unknown> | null
  check_interval_hours: number
}

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'info'
export type AlertType = 'verdict_flip' | 'new_kev' | 'epss_spike' | 'new_cve' | 'score_change' | 'detection_increase' | 'actor_activity' | 'ransom_victim' | 'news_incident'

export interface WatchAlert {
  id: string
  item_id: string
  item_value: string
  item_type: WatchItemType
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  detail: string
  matches?: { title: string; url: string }[]
  created_at: string
  read: boolean
}

export interface AlertsResponse {
  alerts: WatchAlert[]
  unread_count: number
}

export interface ThreatActorSpotlightData {
  status: 'ready' | 'empty'
  actor_name?: string
  also_known_as?: string[]
  origin?: string
  motivation?: string
  active_since?: string
  targets?: string[]
  summary?: string
  recent_activity?: string
  signature_techniques?: string[]
  notable_tools?: string[]
  threat_level?: 'Critical' | 'High' | 'Medium'
  generated_at?: string
}

export interface HealthStatus {
  ok: boolean
  api_key_set: boolean
}

export type IocType = 'ip' | 'domain' | 'url' | 'md5' | 'sha1' | 'sha256' | 'unknown'
export type Verdict = 'malicious' | 'suspicious' | 'clean' | 'unknown'
export type SourceStatus = 'ok' | 'error' | 'no_key' | 'bad_key' | 'not_found' | 'unsupported'

export interface EnrichSource {
  status: SourceStatus
  verdict?: Verdict
  // VirusTotal
  malicious?: number
  suspicious?: number
  total?: number
  country?: string
  as_owner?: string
  categories?: string[]
  file_name?: string
  file_type?: string
  // AbuseIPDB
  score?: number
  total_reports?: number
  isp?: string
  usage_type?: string
  is_tor?: boolean
  // urlscan
  tags?: string[]
  // Shodan
  ports?: number[]
  services?: string[]
  hostnames?: string[]
  org?: string
  os?: string
  // ThreatFox
  malware?: string
  threat_type?: string
  confidence?: number
  first_seen?: string
  // MalwareBazaar
  file_size?: number
  signature?: string
  // OTX
  pulse_count?: number
  malware_families?: string[]
  malware_count?: number
  av_detections?: number
  city?: string
  // proxycheck.io
  is_proxy?: boolean
  proxy_type?: string
  provider?: string
  risk?: number
  // MISP
  event_count?: number
  attribute_count?: number
  events?: Array<{ id: string | number; info: string; date: string; threat_level: string; org: string }>
  // Shared
  link?: string
  detail?: string
}

export interface EnrichResult {
  ioc: string
  type: IocType
  verdict: Verdict
  sources: {
    virustotal: EnrichSource
    abuseipdb: EnrichSource
    urlscan: EnrichSource
    shodan: EnrichSource
    threatfox: EnrichSource
    malwarebazaar: EnrichSource
    otx: EnrichSource
    proxycheck: EnrichSource
    misp: EnrichSource
  }
}

export interface CVSSData {
  version: string
  score: number
  severity: string
  vector: string
}

export interface EPSSData {
  score: number
  percentile: number
}

export interface KEVData {
  in_catalog: boolean
  vendor: string
  product: string
  date_added: string
  due_date: string
  required_action: string
  ransomware: 'Known' | 'Unknown'
}

export interface CVEResult {
  cve_id: string
  published: string
  modified: string
  status: string
  description: string
  cvss: CVSSData | null
  epss: EPSSData | null
  kev: KEVData | null
  affected: { vendor: string; product: string }[]
  references: { url: string; tags: string[] }[]
}

export interface DomainDNSRecord {
  type: string
  value: string
  priority?: number
  ttl?: number
}

export interface DomainWhois {
  registrar?: string
  created?: string
  expires?: string
  updated?: string
  status?: string[]
  nameservers?: string[]
  emails?: string[]
  org?: string
  country?: string
  dnssec?: string
  error?: string
}

export interface DomainGeo {
  ip: string
  country?: string
  country_code?: string
  region?: string
  city?: string
  isp?: string
  org?: string
  as_info?: string
  lat?: number
  lon?: number
  timezone?: string
}

export interface DomainEnumResult {
  domain: string
  resolved_ips: string[]
  dns_records: DomainDNSRecord[]
  whois: DomainWhois | null
  geo: DomainGeo[]
  subdomains: string[]
  subdomain_cert_count: number
  error?: string
}

export type JobStatus = 'pending' | 'running' | 'done' | 'error'

export interface JobLogEntry {
  t: number   // Unix timestamp (seconds) from Python time.time()
  msg: string
}

export interface Job {
  id: string
  report_id: string
  status: JobStatus
  format: 'html' | 'pdf' | 'pptx'
  skill_id: string
  skill_name: string
  badge: string
  badge_color: string
  progress: string
  chars: number
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
  cost_usd: number
  created_at: string
  completed_at: string | null
  result_report_id: string | null
  download_path: string | null
  error: string | null
  log?: JobLogEntry[]
}

export interface RansomGroup {
  group_name: string
  count: number
  latest_victim: string
  latest_date: string
}

export interface RansomFeed {
  groups: RansomGroup[]
  total_recent: number
  period_days: number
}

// ── Bulk Enrich ───────────────────────────────────────────────────────────────

export interface BulkEnrichResult {
  results: EnrichResult[]
  total: number
  malicious: number
  suspicious: number
  clean: number
  unknown: number
}

// ── Malware Intel ─────────────────────────────────────────────────────────────

export interface VTDetection {
  engine: string
  result: string
}

export interface VTSandboxVerdict {
  sandbox: string
  verdict: string
  malware_names: string[]
}

export interface MalwareIntelVT {
  status: string
  verdict?: Verdict
  malicious?: number
  suspicious?: number
  total?: number
  file_name?: string
  file_type?: string
  file_size?: number
  first_submission?: number
  last_analysis_date?: number
  popular_threat_name?: string
  popular_threat_category?: string
  top_detections?: VTDetection[]
  sandbox_verdicts?: VTSandboxVerdict[]
  contacted_ips?: string[]
  contacted_domains?: string[]
  link?: string
}

export interface MalwareIntelMB {
  status: string
  verdict?: Verdict
  file_name?: string
  file_type?: string
  file_type_mime?: string
  file_size?: number
  signature?: string
  tags?: string[]
  first_seen?: string
  last_seen?: string
  delivery_method?: string
  yara_rules?: string[]
  c2?: string[]
  sha256?: string
  sha1?: string
  md5?: string
  link?: string
}

export interface MitreAttck {
  id: string
  tactic: string
  technique: string
}

export interface MalwareIntelHA {
  status: string
  verdict?: Verdict
  threat_score?: number
  verdict_label?: string
  malware_family?: string
  environment?: string
  analysis_start_time?: string
  signatures?: string[]
  network_domains?: string[]
  network_ips?: string[]
  mitre_attcks?: MitreAttck[]
  link?: string
}

export interface MalwareIntelResult {
  hash: string
  hash_type: 'md5' | 'sha1' | 'sha256' | 'unknown'
  verdict: Verdict
  virustotal: MalwareIntelVT
  malwarebazaar: MalwareIntelMB
  hybrid_analysis: MalwareIntelHA
  error?: string
}

// ── Breach Monitor ────────────────────────────────────────────────────────────

export interface ServiceBreach {
  name: string
  title: string
  domain: string
  breach_date: string
  added_date: string
  pwn_count: number
  description: string
  data_classes: string[]
  is_verified: boolean
  is_sensitive: boolean
  is_fabricated: boolean
}

export interface CredentialData {
  found?: boolean
  affected_emails?: number
  breach_exposures?: number
  requires_paid_plan?: boolean
  bad_key?: boolean
}

export interface BreachResult {
  domain: string
  checked_at: string
  service_breach_count: number
  service_breaches: ServiceBreach[]
  total_accounts_exposed: number
  total_known_breaches_checked: number
  hibp_key_configured: boolean
  credential_data: CredentialData | null
  error?: string
}

// ── Intelligence Library ──────────────────────────────────────────────────────

export type LibraryItemType = 'ioc' | 'actor' | 'note' | 'report'

export interface LibraryItem {
  id: string
  type: LibraryItemType
  title: string
  summary: string
  content: Record<string, unknown>
  notes: string
  tags: string[]
  source: string
  tlp: string
  verdict: Verdict | null
  created_at: string
  updated_at: string
}

export interface LibraryListResponse {
  items: LibraryItem[]
  tags: string[]
  counts: Record<string, number>
}

export interface CreateLibraryItem {
  type?: LibraryItemType
  title: string
  summary?: string
  content?: Record<string, unknown>
  notes?: string
  tags?: string[]
  source?: string
  tlp?: string
  verdict?: Verdict | null
}

export interface UpdateLibraryItem {
  type?: LibraryItemType
  title?: string
  summary?: string
  content?: Record<string, unknown>
  notes?: string
  tags?: string[]
  source?: string
  tlp?: string
  verdict?: Verdict | null
}

// ── News Feeds ────────────────────────────────────────────────────────────────

export type FeedCategory = 'government' | 'news' | 'research'

export interface NewsFeed {
  id: number
  name: string
  url: string
  category: FeedCategory
  enabled: boolean
  added_at: string
  last_fetched: string | null
  fetch_error: string | null
  error_count: number
  article_count: number
  unread_count: number
}

export interface NewsArticle {
  id: string
  feed_id: number
  feed_name: string
  category: FeedCategory
  title: string
  url: string
  summary: string
  published: string
  fetched_at: string
  read: boolean
}

export interface NewsFeedsResponse {
  feeds: NewsFeed[]
}

export interface NewsArticlesResponse {
  articles: NewsArticle[]
  unread_count: number
}

// ── MITRE ATT&CK ─────────────────────────────────────────────────────────────

export interface AttackTactic {
  id: string
  attack_id: string
  name: string
  shortname: string
  description: string
  position: number
  technique_count: number
}

export interface AttackTechnique {
  id: string
  attack_id: string
  name: string
  description: string
  platforms: string[]
  data_sources: string[]
  detection: string
  is_subtechnique: boolean
  parent_id: string | null
  revoked: boolean
  deprecated: boolean
  tactic_shortnames: string[]
}

export interface AttackGroup {
  attack_id: string
  name: string
  aliases: string[]
  description?: string
  url?: string
}

export interface AttackTechniqueDetail extends AttackTechnique {
  tactics: { name: string; shortname: string; attack_id: string }[]
  subtechniques: AttackTechnique[]
  groups: AttackGroup[]
  parent: { attack_id: string; name: string } | null
}

export interface AttackStatus {
  last_updated: string | null
  technique_count: number
  group_count: number
  is_ready: boolean
  is_loading: boolean
}

export interface GroupTechnique {
  id: string
  attack_id: string
  name: string
  description: string
  platforms: string[]
  is_subtechnique: boolean
  tactic_shortnames: string[]
}

export interface TacticCoverage {
  shortname: string
  name: string
  attack_id: string
  count: number
}

export interface AttackGroupDetail extends AttackGroup {
  technique_count: number
  techniques: GroupTechnique[]
  tactic_coverage: TacticCoverage[]
}

// ── Ransomware actors ─────────────────────────────────────────────────────────

export type RansomwareStatus = 'active' | 'disrupted' | 'inactive' | 'unknown'
export type ThreatLevel = 'Critical' | 'High' | 'Medium'

export interface RansomwareActorSummary {
  slug: string
  name: string
  aliases: string[]
  origin: string
  status: RansomwareStatus
  threat_level: ThreatLevel
  first_seen: string
  technique_count: number
}

export interface RansomwareActorDetail {
  slug: string
  name: string
  aliases: string[]
  origin: string
  status: RansomwareStatus
  threat_level: ThreatLevel
  first_seen: string
  description: string
  ransomware_family: string
  extortion_methods: string[]
  target_sectors: string[]
  target_regions: string[]
  notable_tools: string[]
  notable_campaigns: string[]
  references: string[]
  techniques: GroupTechnique[]
  tactic_coverage: TacticCoverage[]
}

// ── Scheduled Reports ─────────────────────────────────────────────────────────

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'

export interface Schedule {
  id: string
  skill_id: string
  skill_name: string
  skill_path: string
  badge: string
  badge_color: string
  user_message: string
  format: 'html' | 'pdf' | 'pptx'
  model: string
  max_tokens: number
  needs_search: boolean
  frequency: ScheduleFrequency
  hour: number
  day_of_week: number | null
  day_of_month: number | null
  enabled: boolean
  last_run: string | null
  next_run: string
  created_at: string
}

export interface CreateSchedule {
  skill_id: string
  skill_name: string
  skill_path: string
  badge: string
  badge_color: string
  user_message: string
  format?: 'html' | 'pdf' | 'pptx'
  model?: string
  max_tokens?: number
  needs_search?: boolean
  frequency: ScheduleFrequency
  hour: number
  day_of_week?: number | null
  day_of_month?: number | null
  enabled?: boolean
}

export interface UpdateSchedule {
  user_message?: string
  format?: 'html' | 'pdf' | 'pptx'
  model?: string
  max_tokens?: number
  needs_search?: boolean
  frequency?: ScheduleFrequency
  hour?: number
  day_of_week?: number | null
  day_of_month?: number | null
  enabled?: boolean
}

// ── Priority Intelligence Requirements ───────────────────────────────────────

export type PirStatus = 'active' | 'on_hold' | 'answered' | 'closed'
export type PirPriority = 'critical' | 'high' | 'medium' | 'low'
export type PirCategory = 'threat_actor' | 'malware' | 'vulnerability' | 'geopolitical' | 'sector' | 'general'

export interface PirFinding {
  id: string
  pir_id: string
  content: string
  source: string
  created_at: string
}

export interface Pir {
  id: string
  title: string
  description: string
  category: PirCategory
  priority: PirPriority
  status: PirStatus
  rescan_days: number
  owner: string
  tags: string[]
  created_at: string
  updated_at: string
  last_reviewed_at: string | null
  finding_count: number
  findings?: PirFinding[]
}

export interface CreatePirRequest {
  title: string
  description?: string
  category?: PirCategory
  priority?: PirPriority
  status?: PirStatus
  rescan_days?: number
  owner?: string
  tags?: string[]
}

export interface UpdatePirRequest {
  title?: string
  description?: string
  category?: PirCategory
  priority?: PirPriority
  status?: PirStatus
  rescan_days?: number
  owner?: string
  tags?: string[]
}

// ── Case Management ───────────────────────────────────────────────────────────

export type CaseStatus = 'open' | 'in-progress' | 'closed'
export type CasePriority = 'critical' | 'high' | 'medium' | 'low'
export type ArtifactType = 'ioc' | 'cve' | 'domain' | 'hash' | 'url' | 'report' | 'actor' | 'other'

export interface CaseNote {
  id: string
  case_id: string
  content: string
  created_at: string
}

export interface CaseArtifact {
  id: string
  case_id: string
  artifact_type: ArtifactType
  value: string
  label: string
  created_at: string
}

export interface Case {
  id: string
  title: string
  description: string
  status: CaseStatus
  priority: CasePriority
  tlp: string
  tags: string[]
  created_at: string
  updated_at: string
  closed_at: string | null
  note_count: number
  artifact_count: number
  notes?: CaseNote[]
  artifacts?: CaseArtifact[]
}

export interface CreateCaseRequest {
  title: string
  description?: string
  status?: CaseStatus
  priority?: CasePriority
  tlp?: string
  tags?: string[]
}

export interface UpdateCaseRequest {
  title?: string
  description?: string
  status?: CaseStatus
  priority?: CasePriority
  tlp?: string
  tags?: string[]
}

// ── Client / Engagement Manager ──────────────────────────────────────────────

export type ClientStatus = 'active' | 'prospecting' | 'on_hold' | 'completed'

export interface Client {
  id: string
  name: string
  industry: string
  engagement_ref: string
  status: ClientStatus
  key_assets: string
  threat_context: string
  contact_name: string
  contact_email: string
  notes: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface CreateClientRequest {
  name: string
  industry?: string
  engagement_ref?: string
  status?: ClientStatus
  key_assets?: string
  threat_context?: string
  contact_name?: string
  contact_email?: string
  notes?: string
  tags?: string[]
}

export interface UpdateClientRequest {
  name?: string
  industry?: string
  engagement_ref?: string
  status?: ClientStatus
  key_assets?: string
  threat_context?: string
  contact_name?: string
  contact_email?: string
  notes?: string
  tags?: string[]
}

// ── Identity & Credential Exposure ───────────────────────────────────────────

export type ExposureRiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none'

export interface HIBPServiceBreach {
  name: string
  title: string
  domain: string
  breach_date: string
  added_date: string
  pwn_count: number
  description: string
  data_classes: string[]
  is_verified: boolean
  logo_path?: string
}

export interface HIBPEmailBreach {
  Name: string
  Title: string
  Domain: string
  BreachDate: string
  AddedDate: string
  PwnCount: number
  Description: string
  DataClasses: string[]
  IsVerified: boolean
}

export interface HIBPCredentialData {
  found?: boolean
  affected_emails?: number
  breach_exposures?: number
  requires_paid_plan?: boolean
  bad_key?: boolean
  by_alias?: Record<string, string[]>
}

export interface HudsonRockEmployee {
  email?: string
  url?: string
  username?: string
}

export interface HudsonRockStealer {
  computer_name?: string
  operating_system?: string
  date_compromised?: string
  malware_path?: string
  antiviruses?: string[]
  ip?: string
  country_code?: string
  employees?: HudsonRockEmployee[]
  users?: HudsonRockEmployee[]
}

export interface IdentityExposureResult {
  query: string
  query_type: 'email' | 'domain'
  domain: string
  checked_at: string
  summary: {
    total_breaches: number
    total_stealer_hits: number
    employees_compromised: number
    risk_level: ExposureRiskLevel
  }
  hibp: {
    configured: boolean
    service_breaches: HIBPServiceBreach[]
    email_breaches: HIBPEmailBreach[]
    credential_data: HIBPCredentialData | null
  }
  hudsonrock: {
    ok: boolean
    error?: string
    stealers: HudsonRockStealer[]
    total: number
    employees_compromised: number
    stealer_families?: Record<string, number>
    last_compromised?: string
    employees_urls?: Array<{ url: string; occurrence: number; type: string }>
    users_urls?: Array<{ url: string; occurrence: number; type: string }>
  }
  error?: string
}
