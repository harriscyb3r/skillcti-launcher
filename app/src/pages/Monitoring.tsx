import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { WatchItem, WatchItemType } from '../lib/types'
import { usePagination } from '../lib/usePagination'
import Pagination from '../components/Pagination'

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const TYPE_META: Record<WatchItemType, { label: string; bg: string; color: string }> = {
  ioc:          { label: 'IOC',        bg: '#3b82f620', color: '#3b82f6' },
  cve:          { label: 'CVE',        bg: '#f9731620', color: '#f97316' },
  vendor:       { label: 'VENDOR',     bg: '#22c55e20', color: '#22c55e' },
  threat_actor: { label: 'ACTOR',      bg: '#a855f720', color: '#a855f7' },
  credential:   { label: 'CREDENTIAL', bg: '#ef444420', color: '#ef4444' },
}

const SEV_META: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: '#ef444420', color: '#ef4444', label: 'CRITICAL' },
  high:     { bg: '#f9731620', color: '#f97316', label: 'HIGH' },
  medium:   { bg: '#f59e0b20', color: '#f59e0b', label: 'MEDIUM' },
  info:     { bg: '#3b82f620', color: '#3b82f6', label: 'INFO' },
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  verdict_flip:       'Verdict Flip',
  new_kev:            'New KEV Entry',
  epss_spike:         'EPSS Spike',
  new_cve:            'New CVEs',
  score_change:       'Score Change',
  detection_increase: 'Detection Increase',
  actor_activity:     'Actor Activity',
  ransom_victim:      'New Victims',
  news_incident:      'Security Incident',
  new_stealer_hit:    'New Stealer Hits',
}

// ── Parse pasted/uploaded text into typed items ───────────────────────────────

const CVE_RE = /^CVE-\d{4}-\d{4,}$/i
const IP_RE  = /^\d{1,3}(\.\d{1,3}){3}$/
const HASH_RE = /^[a-fA-F0-9]{32,64}$/

function autoDetectType(value: string): WatchItemType {
  if (CVE_RE.test(value)) return 'cve'
  if (IP_RE.test(value) || value.includes('.') || value.startsWith('http')) return 'ioc'
  if (HASH_RE.test(value)) return 'ioc'
  return 'vendor'
}

function parseUpload(text: string, fallbackType: WatchItemType): { type: WatchItemType; value: string; label: string }[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'))
    .map((value) => ({
      type: fallbackType === 'ioc' || fallbackType === 'cve' || fallbackType === 'threat_actor' || fallbackType === 'credential' ? fallbackType : autoDetectType(value),
      value,
      label: '',
    }))
}

// ── Watch List tab ────────────────────────────────────────────────────────────

function WatchListTab() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [addType, setAddType] = useState<WatchItemType>('ioc')
  const [addText, setAddText] = useState('')
  const [addError, setAddError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.getWatchlist,
    refetchInterval: 30_000,
  })

  const addMutation = useMutation({
    mutationFn: (items: { type: WatchItemType; value: string; label: string }[]) =>
      items.length === 1
        ? api.addWatchItem(items[0].type, items[0].value, items[0].label).then((r) => ({ added: [r], skipped: [] }))
        : api.bulkAddWatchItems(items),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['watchlist'] })
      setAddText('')
      setAddError('')
      if (result.skipped.length > 0) {
        setAddError(`${result.skipped.length} item(s) already in watch list or limit reached.`)
      }
    },
    onError: (e: Error) => setAddError(e.message),
  })

  const removeMutation = useMutation({
    mutationFn: api.removeWatchItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const checkMutation = useMutation({
    mutationFn: api.forceCheckItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist'] })
      qc.invalidateQueries({ queryKey: ['alerts'] })
      qc.invalidateQueries({ queryKey: ['alerts-dashboard'] })
      qc.invalidateQueries({ queryKey: ['alert-count'] })
    },
  })

  function handleAdd() {
    const items = parseUpload(addText, addType)
    if (!items.length) return
    setAddError('')
    addMutation.mutate(items)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const items = parseUpload(text, addType)
      if (items.length) addMutation.mutate(items)
      if (fileRef.current) fileRef.current.value = ''
    }
    reader.readAsText(file)
  }

  const items = data?.items ?? []

  const grouped: Record<WatchItemType, WatchItem[]> = { ioc: [], cve: [], vendor: [], threat_actor: [], credential: [] }
  items.forEach((item) => { grouped[item.type]?.push(item) })

  return (
    <div className="flex flex-col gap-6">
      {/* Add items */}
      <div className="bg-surface border border-border rounded-lg shadow-card p-4">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Add Items</p>
        <div className="flex gap-2 mb-3">
          {(['ioc', 'cve', 'vendor', 'threat_actor', 'credential'] as WatchItemType[]).map((t) => {
            const m = TYPE_META[t]
            return (
              <button
                key={t}
                onClick={() => setAddType(t)}
                className="text-[11px] font-bold px-3 py-1.5 rounded border transition-colors cursor-pointer bg-transparent"
                style={
                  addType === t
                    ? { background: m.bg, color: m.color, borderColor: m.color + '60' }
                    : { color: 'var(--txt3)', borderColor: 'var(--border)' }
                }
              >
                {m.label}
              </button>
            )
          })}
        </div>
        <textarea
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd() }}
          placeholder={
            addType === 'ioc'
              ? 'Paste IPs, domains, URLs, or hashes — one per line'
              : addType === 'cve'
              ? 'Paste CVE IDs — one per line (e.g. CVE-2024-21413)'
              : addType === 'threat_actor'
              ? 'Paste threat actor names — one per line (e.g. APT28, LockBit, Lazarus Group)'
              : addType === 'credential'
              ? 'Paste domains or email addresses — one per line (e.g. example.com, user@example.com)'
              : 'Paste vendor / company / software names — one per line'
          }
          rows={4}
          className="w-full bg-bg border border-border rounded-lg text-txt font-mono text-[11px] px-3 py-2.5 outline-none focus:border-purple transition-colors resize-none placeholder:text-txt-3 mb-3"
          spellCheck={false}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleAdd}
            disabled={!addText.trim() || addMutation.isPending}
            className="px-4 py-2 text-[11px] font-bold tracking-[0.1em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90"
          >
            {addMutation.isPending ? 'Adding…' : 'Add to Watch List'}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 text-[11px] font-bold tracking-[0.1em] rounded-lg border border-border text-txt-2 bg-transparent hover:border-border2 cursor-pointer transition-colors flex items-center gap-2"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload File
          </button>
          <input ref={fileRef} type="file" accept=".txt,.csv,.json" className="hidden" onChange={handleFile} />
          <span className="text-[10px] text-txt-3 font-mono">Ctrl+Enter to add · .txt / .csv supported</span>
        </div>
        {addError && <p className="text-[10px] text-amber mt-2 font-mono">{addError}</p>}
      </div>

      {/* Items list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-txt-3 text-[11px]">
          <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <div>
            <p className="text-[13px] font-semibold text-txt-2">No items being monitored</p>
            <p className="text-[11px] text-txt-3 mt-1">Add IOCs, CVEs, vendor names, or threat actor names above. To monitor a domain or email for stealer log hits, scan it in <strong>Investigate → Credentials</strong> and click Monitor.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {(['credential', 'ioc', 'cve', 'vendor', 'threat_actor'] as WatchItemType[]).map((type) => {
            const typeItems = grouped[type]
            if (!typeItems.length) return null
            const m = TYPE_META[type]
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold font-mono px-2 py-[3px] rounded" style={{ background: m.bg, color: m.color }}>
                    {m.label}
                  </span>
                  <span className="text-[10px] text-txt-3 font-mono">{typeItems.length} item{typeItems.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase px-4 py-2 border-b border-border bg-bg">
                    <span>Value</span>
                    <span className="text-right pr-6">Last Checked</span>
                    <span className="text-right pr-6">Status</span>
                    <span />
                  </div>
                  {typeItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className={[
                        'grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5 gap-4',
                        idx < typeItems.length - 1 ? 'border-b border-border' : '',
                      ].join(' ')}
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-txt truncate">{item.value}</div>
                        {item.label && item.label !== item.value && (
                          <div className="text-[11px] text-txt-3 truncate">{item.label}</div>
                        )}
                      </div>
                      <div className="text-[10px] text-txt-3 font-mono text-right flex-shrink-0">
                        {item.last_checked ? timeAgo(item.last_checked) : 'Never'}
                      </div>
                      <div className="flex-shrink-0">
                        {item.last_state ? (
                          <span className="text-[10px] font-mono text-green px-1.5 py-[2px] rounded bg-green/10 border border-green/20">
                            Checked
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-txt-3 px-1.5 py-[2px] rounded bg-surface border border-border">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => checkMutation.mutate(item.id)}
                          disabled={checkMutation.isPending}
                          title="Force check now"
                          className="text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer p-1 disabled:opacity-40"
                        >
                          {checkMutation.isPending && checkMutation.variables === item.id ? (
                            <span className="w-[11px] h-[11px] rounded-full border border-purple border-t-transparent animate-spin block" />
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="23 4 23 10 17 10" />
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => removeMutation.mutate(item.id)}
                          title="Remove"
                          className="text-txt-3 hover:text-red transition-colors bg-transparent border-none cursor-pointer p-1"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Alerts tab ────────────────────────────────────────────────────────────────

function AlertsTab() {
  const qc = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.getAlerts(),
    refetchInterval: 30_000,
  })

  function invalidateAlerts() {
    qc.invalidateQueries({ queryKey: ['alerts'] })
    qc.invalidateQueries({ queryKey: ['alert-count'] })
  }

  const markAllMutation = useMutation({
    mutationFn: api.markAllAlertsRead,
    onSuccess: invalidateAlerts,
  })

  const dismissMutation = useMutation({
    mutationFn: api.dismissAlert,
    onSuccess: invalidateAlerts,
  })

  const markReadMutation = useMutation({
    mutationFn: api.markAlertRead,
    onSuccess: invalidateAlerts,
  })

  const clearMutation = useMutation({
    mutationFn: api.clearAlerts,
    onSuccess: invalidateAlerts,
  })

  const alerts = data?.alerts ?? []
  const unread = data?.unread_count ?? 0
  const pg = usePagination(alerts, 20)

  if (isLoading) return (
    <div className="flex items-center gap-2 text-txt-3 text-[11px]">
      <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
      Loading alerts…
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {alerts.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={unread === 0 || markAllMutation.isPending}
            className="text-[11px] font-bold text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer disabled:opacity-40 transition-colors"
          >
            Mark all read
          </button>
          <span className="text-txt-3">·</span>
          <button
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            className="text-[11px] font-bold text-txt-3 hover:text-red bg-transparent border-none cursor-pointer disabled:opacity-40 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg shadow-card p-8 text-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3 mx-auto mb-3">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-[13px] text-txt-2">No alerts yet.</p>
          <p className="text-[11px] text-txt-3 mt-1">Changes detected during monitoring will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pg.paged.map((alert) => {
            const sev = SEV_META[alert.severity] ?? SEV_META.info
            const typeMeta = TYPE_META[alert.item_type]

            const displayMatches: { title: string; url: string }[] =
              alert.matches && alert.matches.length > 0
                ? alert.matches
                : alert.detail
                    .split('\n')
                    .filter((l) => l.trim().startsWith('•'))
                    .map((l) => {
                      const title = l.replace(/^[\s•]+/, '').trim()
                      return {
                        title,
                        url: `https://www.google.com/search?q=${encodeURIComponent(title)}`,
                      }
                    })

            const displayDetail =
              alert.matches !== undefined
                ? alert.detail
                : alert.detail.split('\n')[0].replace(/:$/, '.').trim()

            const hasMatches = displayMatches.length > 0
            const isExpanded = expandedId === alert.id
            return (
              <div
                key={alert.id}
                className={[
                  'bg-surface border rounded-lg p-4 transition-colors',
                  alert.read ? 'border-border opacity-60' : 'border-border hover:border-border2',
                ].join(' ')}
              >
                <div
                  className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => { if (!alert.read) markReadMutation.mutate(alert.id) }}
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {!alert.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple flex-shrink-0 mt-[3px]" />
                    )}
                    <span
                      className="text-[10px] font-bold font-mono px-1.5 py-[2px] rounded flex-shrink-0"
                      style={{ background: sev.bg, color: sev.color }}
                    >
                      {sev.label}
                    </span>
                    <span
                      className="text-[10px] font-mono px-1.5 py-[2px] rounded flex-shrink-0"
                      style={{ background: typeMeta?.bg, color: typeMeta?.color }}
                    >
                      {ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-txt-3 font-mono">{timeAgo(alert.created_at)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissMutation.mutate(alert.id) }}
                      className="text-txt-3 hover:text-red transition-colors bg-transparent border-none cursor-pointer p-0 text-[14px] leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <p className="text-[13px] font-bold text-txt mt-2 leading-snug">{alert.title}</p>
                <p className="text-[11px] text-txt-2 mt-1 leading-relaxed">{displayDetail}</p>
                <p className="text-[10px] text-txt-3 font-mono mt-2">{alert.item_value}</p>

                {hasMatches && (
                  <div className="mt-3 border-t border-border pt-2.5">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-txt-3 hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-0"
                    >
                      <svg
                        width="8" height="8" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="3"
                        className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      {displayMatches.length} article{displayMatches.length !== 1 ? 's' : ''} matched
                    </button>

                    {isExpanded && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {displayMatches.map((m, i) => (
                          <a
                            key={i}
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 text-[11px] text-accent hover:text-txt transition-colors group"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg
                              width="9" height="9" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2"
                              className="flex-shrink-0 mt-[2px] opacity-50 group-hover:opacity-100"
                            >
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                            <span className="leading-snug">{m.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <Pagination
        page={pg.page}
        totalPages={pg.totalPages}
        total={pg.total}
        from={pg.from}
        to={pg.to}
        hasPrev={pg.hasPrev}
        hasNext={pg.hasNext}
        onPage={pg.setPage}
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Monitoring() {
  const [tab, setTab] = useState<'watchlist' | 'alerts'>('watchlist')

  const { data: countData } = useQuery({
    queryKey: ['alert-count'],
    queryFn: api.getAlertCount,
    refetchInterval: 30_000,
  })

  const unread = countData?.unread ?? 0

  return (
    <div className="p-6 overflow-y-auto h-full">
      <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Workspace</p>
      <h1 className="text-[22px] font-bold text-txt tracking-tight mb-1">Monitoring</h1>
      <p className="text-[13px] text-txt-2 mb-6">
        Pin IOCs, CVEs, vendors, threat actors, and domains/emails to monitor for changes and receive alerts when new intelligence surfaces. Add credential monitors from <strong>Investigate → Credentials</strong>.
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {([
          { id: 'watchlist', label: 'Watch List' },
          { id: 'alerts',    label: 'Alerts' },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              'px-4 py-2.5 text-[11px] font-bold tracking-[0.1em] uppercase border-none bg-transparent cursor-pointer transition-colors flex items-center gap-2 -mb-px border-b-2',
              tab === id
                ? 'text-purple border-b-purple'
                : 'text-txt-3 border-b-transparent hover:text-txt-2',
            ].join(' ')}
          >
            {label}
            {id === 'alerts' && unread > 0 && (
              <span className="text-[11px] font-bold px-1.5 py-[1px] rounded-full bg-red/15 text-red border border-red/25">
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'watchlist' && <WatchListTab />}
      {tab === 'alerts' && <AlertsTab />}
    </div>
  )
}
