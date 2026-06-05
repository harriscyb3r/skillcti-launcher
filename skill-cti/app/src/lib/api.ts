import type { Report, ReportMeta, AppSettings, HealthStatus, RansomFeed, EnrichResult, CVEResult, ThreatPulseData, ThreatActorSpotlightData, WatchItem, WatchItemType, WatchAlert, AlertsResponse, DomainEnumResult, Job, BulkEnrichResult, MalwareIntelResult, BreachResult, LibraryItem, LibraryListResponse, CreateLibraryItem, UpdateLibraryItem, NewsFeed, NewsArticle, NewsFeedsResponse, NewsArticlesResponse, AttackStatus, AttackTactic, AttackTechnique, AttackTechniqueDetail, AttackGroup, AttackGroupDetail, RansomwareActorSummary, RansomwareActorDetail, Schedule, CreateSchedule, UpdateSchedule, Case, CaseNote, CaseArtifact, CreateCaseRequest, UpdateCaseRequest, ArtifactType } from './types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  health(): Promise<HealthStatus> {
    return request<HealthStatus>('/health')
  },

  listReports(): Promise<{ reports: ReportMeta[] }> {
    return request<{ reports: ReportMeta[] }>('/reports')
  },

  getReport(id: string): Promise<Report> {
    return request<Report>(`/reports/${id}`)
  },

  deleteReport(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/reports/${id}`, { method: 'DELETE' })
  },

  getSettings(): Promise<AppSettings> {
    return request<AppSettings>('/api/settings')
  },

  saveSettings(settings: Partial<AppSettings>): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
  },

  lookupCVE(cveId: string): Promise<CVEResult> {
    return request<CVEResult>('/cve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cve_id: cveId }),
    })
  },

  enrich(ioc: string): Promise<EnrichResult> {
    return request<EnrichResult>('/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ioc }),
    })
  },

  getThreatPulse(): Promise<ThreatPulseData> {
    return request<ThreatPulseData>('/api/threat-pulse')
  },

  refreshThreatPulse(): Promise<ThreatPulseData> {
    return request<ThreatPulseData>('/api/threat-pulse/refresh', { method: 'POST' })
  },

  getThreatActorSpotlight(): Promise<ThreatActorSpotlightData> {
    return request<ThreatActorSpotlightData>('/api/threat-actor-spotlight')
  },

  refreshThreatActorSpotlight(): Promise<ThreatActorSpotlightData> {
    return request<ThreatActorSpotlightData>('/api/threat-actor-spotlight/refresh', { method: 'POST' })
  },

  ransomwareFeed(days = 30): Promise<RansomFeed> {
    return request<RansomFeed>(`/ransomware-feed?days=${days}`)
  },

  // Watchlist
  getWatchlist(): Promise<{ items: WatchItem[] }> {
    return request('/api/watchlist')
  },
  addWatchItem(type: WatchItemType, value: string, label?: string): Promise<WatchItem> {
    return request('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value, label: label ?? '' }),
    })
  },
  bulkAddWatchItems(items: { type: WatchItemType; value: string; label?: string }[]): Promise<{ added: WatchItem[]; skipped: string[] }> {
    return request('/api/watchlist/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
  },
  removeWatchItem(id: string): Promise<{ ok: boolean }> {
    return request(`/api/watchlist/${id}`, { method: 'DELETE' })
  },
  clearWatchlist(): Promise<{ ok: boolean }> {
    return request('/api/watchlist', { method: 'DELETE' })
  },
  forceCheckItem(id: string): Promise<{ ok: boolean }> {
    return request(`/api/watchlist/${id}/check-now`, { method: 'POST' })
  },

  // Alerts
  getAlerts(unreadOnly = false): Promise<AlertsResponse> {
    return request(`/api/alerts${unreadOnly ? '?unread_only=true' : ''}`)
  },
  getAlertCount(): Promise<{ unread: number; total: number }> {
    return request('/api/alerts/count')
  },
  markAlertRead(id: string): Promise<{ ok: boolean }> {
    return request(`/api/alerts/${id}/read`, { method: 'POST' })
  },
  markAllAlertsRead(): Promise<{ ok: boolean }> {
    return request('/api/alerts/read-all', { method: 'POST' })
  },
  dismissAlert(id: string): Promise<{ ok: boolean }> {
    return request(`/api/alerts/${id}`, { method: 'DELETE' })
  },
  clearAlerts(): Promise<{ ok: boolean }> {
    return request('/api/alerts', { method: 'DELETE' })
  },

  domainEnum(domain: string): Promise<DomainEnumResult> {
    return request<DomainEnumResult>('/domain-enum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    })
  },

  generateReport(skillId: string, systemPrompt: string, userInput: string, meta: Partial<ReportMeta>) {
    return request<{ html: string; meta: ReportMeta }>('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId, systemPrompt, userInput, meta }),
    })
  },

  // Background jobs
  createJob(payload: {
    skill_id: string
    skill_name: string
    badge: string
    badge_color: string
    format: string
    anthropic_body: Record<string, unknown>
  }): Promise<{ job_id: string; report_id: string }> {
    return request('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },

  listJobs(): Promise<{ jobs: Job[] }> {
    return request<{ jobs: Job[] }>('/api/jobs')
  },

  getJob(jobId: string): Promise<Job> {
    return request<Job>(`/api/jobs/${jobId}`)
  },

  getActiveJobCount(): Promise<{ running: number }> {
    return request<{ running: number }>('/api/jobs/active-count')
  },

  deleteJob(jobId: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/jobs/${jobId}`, { method: 'DELETE' })
  },

  bulkEnrich(iocs: string[]): Promise<BulkEnrichResult> {
    return request<BulkEnrichResult>('/bulk-enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iocs }),
    })
  },

  malwareIntel(hash: string): Promise<MalwareIntelResult> {
    return request<MalwareIntelResult>('/malware-intel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash }),
    })
  },

  breachCheck(domain: string): Promise<BreachResult> {
    return request<BreachResult>('/breach-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    })
  },

  // Intelligence Library
  listLibrary(params?: { q?: string; type?: string; tag?: string; verdict?: string }): Promise<LibraryListResponse> {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.type) qs.set('type', params.type)
    if (params?.tag) qs.set('tag', params.tag)
    if (params?.verdict) qs.set('verdict', params.verdict)
    const query = qs.toString()
    return request<LibraryListResponse>(`/api/library${query ? '?' + query : ''}`)
  },

  createLibraryItem(item: CreateLibraryItem): Promise<LibraryItem> {
    return request<LibraryItem>('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
  },

  updateLibraryItem(id: string, updates: UpdateLibraryItem): Promise<LibraryItem> {
    return request<LibraryItem>(`/api/library/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  },

  deleteLibraryItem(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/library/${id}`, { method: 'DELETE' })
  },

  // News feeds
  getNewsFeeds(): Promise<NewsFeedsResponse> {
    return request<NewsFeedsResponse>('/api/news/feeds')
  },

  addNewsFeed(name: string, url: string, category?: string): Promise<NewsFeed> {
    return request<NewsFeed>('/api/news/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, category: category ?? 'news' }),
    })
  },

  deleteNewsFeed(id: number): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/news/feeds/${id}`, { method: 'DELETE' })
  },

  toggleNewsFeed(id: number, enabled: boolean): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/news/feeds/${id}/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
  },

  refreshNewsFeeds(): Promise<{ ok: boolean; message: string }> {
    return request('/api/news/refresh', { method: 'POST' })
  },

  getNewsArticles(params?: { feed_id?: number; unread_only?: boolean; limit?: number; offset?: number }): Promise<NewsArticlesResponse> {
    const qs = new URLSearchParams()
    if (params?.feed_id != null) qs.set('feed_id', String(params.feed_id))
    if (params?.unread_only) qs.set('unread_only', 'true')
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.offset != null) qs.set('offset', String(params.offset))
    const q = qs.toString()
    return request<NewsArticlesResponse>(`/api/news/articles${q ? '?' + q : ''}`)
  },

  markArticleRead(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/news/articles/${id}/read`, { method: 'POST' })
  },

  markAllNewsRead(feed_id?: number): Promise<{ ok: boolean; marked: number }> {
    const q = feed_id != null ? `?feed_id=${feed_id}` : ''
    return request(`/api/news/articles/read-all${q}`, { method: 'POST' })
  },

  getNewsUnreadCount(): Promise<{ unread: number }> {
    return request<{ unread: number }>('/api/news/unread-count')
  },

  getRecentNews(limit?: number): Promise<{ articles: NewsArticle[] }> {
    return request<{ articles: NewsArticle[] }>(`/api/news/recent${limit ? '?limit=' + limit : ''}`)
  },

  // MITRE ATT&CK
  getAttackStatus(): Promise<AttackStatus> {
    return request<AttackStatus>('/api/attack/status')
  },

  getAttackTactics(): Promise<{ tactics: AttackTactic[] }> {
    return request<{ tactics: AttackTactic[] }>('/api/attack/tactics')
  },

  getAttackTechniques(params?: { tactic?: string; q?: string; limit?: number }): Promise<{ techniques: AttackTechnique[]; total: number }> {
    const qs = new URLSearchParams()
    if (params?.tactic) qs.set('tactic', params.tactic)
    if (params?.q) qs.set('q', params.q)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const q = qs.toString()
    return request<{ techniques: AttackTechnique[]; total: number }>(`/api/attack/techniques${q ? '?' + q : ''}`)
  },

  getAttackTechnique(attackId: string): Promise<AttackTechniqueDetail> {
    return request<AttackTechniqueDetail>(`/api/attack/techniques/${attackId}`)
  },

  getAttackGroups(q?: string): Promise<{ groups: AttackGroup[] }> {
    return request<{ groups: AttackGroup[] }>(`/api/attack/groups${q ? '?q=' + encodeURIComponent(q) : ''}`)
  },

  getAttackGroupDetail(attackId: string): Promise<AttackGroupDetail> {
    return request<AttackGroupDetail>(`/api/attack/groups/${encodeURIComponent(attackId)}`)
  },

  // Ransomware actors
  getRansomwareActors(q?: string): Promise<{ actors: RansomwareActorSummary[] }> {
    return request<{ actors: RansomwareActorSummary[] }>(`/api/ransomware-actors${q ? '?q=' + encodeURIComponent(q) : ''}`)
  },

  getRansomwareActor(slug: string): Promise<RansomwareActorDetail> {
    return request<RansomwareActorDetail>(`/api/ransomware-actors/${encodeURIComponent(slug)}`)
  },

  refreshAttack(): Promise<{ ok: boolean }> {
    return request('/api/attack/refresh', { method: 'POST' })
  },

  // Scheduled Reports
  listSchedules(): Promise<{ schedules: Schedule[] }> {
    return request<{ schedules: Schedule[] }>('/api/schedules')
  },

  createSchedule(data: CreateSchedule): Promise<Schedule> {
    return request<Schedule>('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  updateSchedule(id: string, updates: UpdateSchedule): Promise<Schedule> {
    return request<Schedule>(`/api/schedules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  },

  deleteSchedule(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/schedules/${id}`, { method: 'DELETE' })
  },

  triggerSchedule(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/schedules/${id}/trigger`, { method: 'POST' })
  },

  // Cases
  listCases(status?: string): Promise<{ cases: Case[] }> {
    const q = status ? `?status=${encodeURIComponent(status)}` : ''
    return request<{ cases: Case[] }>(`/api/cases${q}`)
  },

  createCase(data: CreateCaseRequest): Promise<Case> {
    return request<Case>('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },

  getCase(id: string): Promise<Case> {
    return request<Case>(`/api/cases/${id}`)
  },

  updateCase(id: string, updates: UpdateCaseRequest): Promise<Case> {
    return request<Case>(`/api/cases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  },

  deleteCase(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/cases/${id}`, { method: 'DELETE' })
  },

  addCaseNote(caseId: string, content: string): Promise<CaseNote> {
    return request<CaseNote>(`/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  },

  deleteCaseNote(caseId: string, noteId: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/cases/${caseId}/notes/${noteId}`, { method: 'DELETE' })
  },

  addCaseArtifact(caseId: string, artifact_type: ArtifactType, value: string, label?: string): Promise<CaseArtifact> {
    return request<CaseArtifact>(`/api/cases/${caseId}/artifacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifact_type, value, label: label ?? '' }),
    })
  },

  deleteCaseArtifact(caseId: string, artifactId: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/cases/${caseId}/artifacts/${artifactId}`, { method: 'DELETE' })
  },
}
