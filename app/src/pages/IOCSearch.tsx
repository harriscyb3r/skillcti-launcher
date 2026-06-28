import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { ArtifactType, EnrichResult, EnrichSource, IocType, MalwareIntelResult, Verdict, Skill } from '../lib/types'
import { AddToCaseButton } from '../components/AddToCaseButton'
import LaunchDrawer from '../components/LaunchDrawer'
import ReportModal from '../components/ReportModal'
import { SKILLS } from '../lib/skills'
import DomainEnum from './DomainEnum'
import { SkeletonSourceBlock } from '../components/Skeleton'
import { useContextMenu, MenuIcon } from '../components/ContextMenu'
import PageHeader from '../components/PageHeader'

// ── helpers ──────────────────────────────────────────────────────────────────

function parseInput(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10)
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatBytes(n: number): string {
  if (n === 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function unixToDate(ts?: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

const VERDICT_STYLE: Record<Verdict, { bg: string; text: string; label: string }> = {
  malicious:  { bg: '#ef444420', text: '#ef4444', label: 'MALICIOUS' },
  suspicious: { bg: '#f59e0b20', text: '#f59e0b', label: 'SUSPICIOUS' },
  clean:      { bg: '#22c55e20', text: '#22c55e', label: 'CLEAN' },
  unknown:    { bg: '#6b728020', text: '#6b7280', label: 'UNKNOWN' },
}

const TYPE_STYLE: Record<IocType, { bg: string; text: string }> = {
  ip:      { bg: '#3b82f620', text: '#3b82f6' },
  domain:  { bg: '#06b6d420', text: '#06b6d4' },
  url:     { bg: '#f97316',   text: '#f97316' },
  md5:     { bg: '#a855f720', text: '#a855f7' },
  sha1:    { bg: '#a855f720', text: '#a855f7' },
  sha256:  { bg: '#a855f720', text: '#a855f7' },
  unknown: { bg: '#6b728020', text: '#6b7280' },
}

const RELEVANT: Record<IocType, string[]> = {
  ip:      ['virustotal', 'abuseipdb', 'shodan', 'proxycheck', 'threatfox', 'otx', 'misp'],
  domain:  ['virustotal', 'urlscan', 'threatfox', 'otx', 'misp'],
  url:     ['virustotal', 'urlscan', 'threatfox', 'otx', 'misp'],
  md5:     ['virustotal', 'threatfox', 'malwarebazaar', 'otx', 'misp'],
  sha1:    ['virustotal', 'threatfox', 'malwarebazaar', 'otx', 'misp'],
  sha256:  ['virustotal', 'threatfox', 'malwarebazaar', 'otx', 'misp'],
  unknown: ['virustotal', 'threatfox', 'otx', 'misp'],
}

const SOURCE_LABELS: Record<string, string> = {
  virustotal:    'VirusTotal',
  abuseipdb:     'AbuseIPDB',
  urlscan:       'urlscan.io',
  shodan:        'Shodan',
  proxycheck:    'VPN / Proxy',
  threatfox:     'ThreatFox',
  malwarebazaar: 'MalwareBazaar',
  otx:           'OTX',
  misp:          'MISP',
}

const HASH_TYPES: IocType[] = ['md5', 'sha1', 'sha256']

// ── history ───────────────────────────────────────────────────────────────────

type Entry = {
  id: string
  raw: string
  loading: boolean
  result?: EnrichResult
  error?: string
  malwareIntel?: MalwareIntelResult
  malwareIntelLoading?: boolean
  summary?: string
  summaryLoading?: boolean
  summaryError?: string
}

type HistoryItem = {
  id: string
  timestamp: string
  iocs: string[]
  entries: Omit<Entry, 'loading' | 'malwareIntelLoading'>[]
}

const HISTORY_KEY = 'skillcti-ioc-history'

function useIOCHistory() {
  const [items, setItems] = useState<HistoryItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
  })

  function save(iocs: string[], entries: Entry[]) {
    const item: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      iocs,
      entries: entries.map(({ id, raw, result, error, malwareIntel }) => ({ id, raw, result, error, malwareIntel })),
    }
    setItems((prev) => {
      const next = [item, ...prev].slice(0, 20)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }

  function remove(id: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }

  function clear() {
    setItems([])
    localStorage.removeItem(HISTORY_KEY)
  }

  return { items, save, remove, clear }
}

// ── shared sub-components ─────────────────────────────────────────────────────

function ExternalLinkIcon({ href }: { href?: string }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="ml-1 text-txt-3 hover:text-txt-2 transition-colors flex-shrink-0"
      title="Open in new tab"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  )
}

function ExternalLinkLabel({ href, label }: { href?: string; label: string }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-[10px] text-purple hover:underline font-mono"
    >
      {label}
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  )
}

function VerdictDot({ verdict }: { verdict?: Verdict }) {
  const color =
    verdict === 'malicious'  ? '#ef4444'
    : verdict === 'suspicious' ? '#f59e0b'
    : verdict === 'clean'      ? '#22c55e'
    : '#6b7280'
  return <span className="inline-block w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: color }} />
}

function Pill({ text, color }: { text: string; color?: string }) {
  return (
    <span
      className="inline-block text-[10px] font-bold font-mono px-2 py-[3px] rounded border leading-none"
      style={{ color: color ?? '#6b7280', borderColor: `${color ?? '#6b7280'}40`, background: `${color ?? '#6b7280'}12` }}
    >
      {text}
    </span>
  )
}

function DetectionBar({ malicious, total }: { malicious: number; total: number }) {
  const pct = total > 0 ? (malicious / total) * 100 : 0
  const color = malicious >= 3 ? '#ef4444' : malicious > 0 ? '#f59e0b' : '#22c55e'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-bg rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-mono font-bold flex-shrink-0" style={{ color }}>
        {malicious}/{total}
      </span>
    </div>
  )
}

// ── SourceBlock ───────────────────────────────────────────────────────────────

function SourceBlock({ name, src, loading }: { name: string; src: EnrichSource | undefined; loading: boolean }) {
  const label = SOURCE_LABELS[name] ?? name

  const inner = () => {
    if (src.status === 'unsupported') return null
    if (src.status === 'no_key' || src.status === 'bad_key') {
      return (
        <div className="flex items-center gap-1">
          <span className="text-txt-3 text-[11px]">No API key</span>
          <a href="/settings" className="text-[10px] text-purple hover:underline font-mono" onClick={(e) => e.stopPropagation()}>
            Configure →
          </a>
        </div>
      )
    }
    if (src.status === 'not_found') return <span className="text-txt-3 text-[11px]">Not found</span>
    if (src.status === 'error') return <span className="text-red text-[11px]">Error</span>

    switch (name) {
      case 'virustotal': {
        const vtColor = (src.malicious ?? 0) >= 3 ? '#ef4444' : (src.malicious ?? 0) > 0 ? '#f59e0b' : '#22c55e'
        const vtPct = src.total ? ((src.malicious ?? 0) / src.total) * 100 : 0
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <VerdictDot verdict={src.verdict} />
              <span className="text-[11px] font-mono font-bold" style={{ color: vtColor }}>
                {src.malicious}/{src.total}
              </span>
              <span className="text-txt-3 text-[11px]">engines</span>
              {(src.suspicious ?? 0) > 0 && (
                <span className="text-[10px] text-amber-400 font-mono">+{src.suspicious} susp.</span>
              )}
              <ExternalLinkIcon href={src.link} />
            </div>
            <div className="w-full h-1 bg-bg rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${vtPct}%`, background: vtColor }} />
            </div>
            {src.categories && src.categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {src.categories.slice(0, 3).map((c) => (
                  <span key={c} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3 capitalize">
                    {c}
                  </span>
                ))}
              </div>
            )}
            {(src.as_owner || src.country) && (
              <div className="text-[11px] text-txt-3 truncate">
                {[src.as_owner, src.country].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        )
      }
      case 'abuseipdb':
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <VerdictDot verdict={src.verdict} />
              <span className="text-[11px] font-mono font-bold" style={{ color: VERDICT_STYLE[src.verdict ?? 'unknown'].text }}>
                {src.score}%
              </span>
              <span className="text-txt-3 text-[11px]">abuse confidence</span>
              <ExternalLinkIcon href={src.link} />
            </div>
            <div className="w-full h-1 bg-bg rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${src.score ?? 0}%`, background: (src.score ?? 0) >= 50 ? '#ef4444' : (src.score ?? 0) > 0 ? '#f59e0b' : '#22c55e' }} />
            </div>
            <div className="text-[11px] text-txt-3">
              {src.total_reports} report{src.total_reports !== 1 ? 's' : ''}
              {src.is_tor ? ' · TOR exit node' : ''}
            </div>
            {(src.isp || src.country) && (
              <div className="text-[11px] text-txt-3 truncate">
                {[src.isp, src.country].filter(Boolean).join(' · ')}
              </div>
            )}
            {src.usage_type && (
              <span className="self-start text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3">
                {src.usage_type}
              </span>
            )}
          </div>
        )
      case 'urlscan':
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <VerdictDot verdict={src.verdict} />
              <span className="text-[11px] font-bold" style={{ color: VERDICT_STYLE[src.verdict ?? 'unknown'].text }}>
                {src.verdict?.toUpperCase()}
              </span>
              <ExternalLinkIcon href={src.link} />
            </div>
            {src.tags && src.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {src.tags.slice(0, 5).map((t) => (
                  <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      case 'shodan':
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-txt-3 text-[11px] uppercase tracking-wide">Ports</span>
              <span className="text-[10px] font-mono text-txt">
                {src.ports && src.ports.length > 0 ? src.ports.slice(0, 8).join(', ') : '—'}
              </span>
              <ExternalLinkIcon href={src.link} />
            </div>
            {src.services && src.services.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {src.services.slice(0, 5).map((s) => (
                  <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {src.org && <div className="text-[11px] text-txt-3 truncate">{src.org}</div>}
            {src.os && <div className="text-[11px] text-txt-3">OS: {src.os}</div>}
            {src.hostnames && src.hostnames.length > 0 && (
              <div className="text-[11px] text-txt-3 truncate">
                {src.hostnames.slice(0, 2).join(', ')}
              </div>
            )}
          </div>
        )
      case 'threatfox':
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <VerdictDot verdict={src.verdict} />
              <span className="text-[11px] font-bold" style={{ color: VERDICT_STYLE[src.verdict ?? 'unknown'].text }}>
                {src.malware || src.verdict?.toUpperCase()}
              </span>
              <ExternalLinkIcon href={src.link} />
            </div>
            {src.threat_type && (
              <div className="text-[11px] text-txt-3 mt-0.5">
                {src.threat_type}
                {src.confidence ? ` · ${src.confidence}% confidence` : ''}
                {src.first_seen ? ` · ${src.first_seen}` : ''}
              </div>
            )}
          </div>
        )
      case 'malwarebazaar':
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <VerdictDot verdict={src.verdict} />
              <span className="text-[11px] font-bold" style={{ color: VERDICT_STYLE[src.verdict ?? 'unknown'].text }}>
                {src.signature || src.file_type || 'Malicious'}
              </span>
              <ExternalLinkIcon href={src.link} />
            </div>
            {src.file_name && (
              <div className="text-[10px] text-txt-3 truncate font-mono">{src.file_name}</div>
            )}
            <div className="flex flex-wrap gap-1.5 items-center">
              {src.file_type && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3">
                  {src.file_type}
                </span>
              )}
              {src.file_size != null && src.file_size > 0 && (
                <span className="text-[10px] text-txt-3 font-mono">{formatBytes(src.file_size)}</span>
              )}
            </div>
            {src.tags && src.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {src.tags.slice(0, 4).map((t) => (
                  <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      case 'proxycheck': {
        const isProxy = src.is_proxy ?? false
        const label = isProxy ? (src.proxy_type || 'Proxy') : 'No VPN / Proxy'
        const isActualVpn = isProxy && ['VPN', 'TOR'].includes(src.proxy_type ?? '')
        const labelColor = isActualVpn ? '#ef4444' : isProxy ? '#f59e0b' : '#22c55e'
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <VerdictDot verdict={isActualVpn ? 'malicious' : isProxy ? 'suspicious' : 'clean'} />
              <span className="text-[11px] font-bold font-mono" style={{ color: labelColor }}>
                {label}
              </span>
            </div>
            {isProxy && src.provider && (
              <div className="text-[10px] text-txt-3 font-mono">{src.provider}</div>
            )}
          </div>
        )
      }
      case 'otx': {
        const pulseCount = src.pulse_count ?? 0
        const hasCommunityIntel = pulseCount > 0
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <VerdictDot verdict={src.verdict} />
              <span className="text-[11px] font-bold font-mono" style={{ color: VERDICT_STYLE[src.verdict ?? 'unknown'].text }}>
                {hasCommunityIntel
                  ? `${pulseCount} community pulse${pulseCount !== 1 ? 's' : ''}`
                  : 'No community pulses'}
              </span>
              <ExternalLinkIcon href={src.link} />
            </div>
            {(src.as_owner || src.country) && (
              <div className="text-[11px] text-txt-3 leading-relaxed">
                {[src.as_owner, src.country, src.city].filter(Boolean).join(' · ')}
              </div>
            )}
            {src.malware_families && src.malware_families.length > 0 && (
              <div className="text-[11px] text-amber truncate">
                {src.malware_families.join(', ')}
              </div>
            )}
            {src.malware_count != null && src.malware_count > 0 && (
              <div className="text-[11px] text-txt-3">
                <span className="text-red font-bold">{src.malware_count}</span> malware sample{src.malware_count !== 1 ? 's' : ''} associated
              </div>
            )}
            {src.av_detections != null && src.av_detections > 0 && (
              <div className="text-[11px] text-txt-3">
                <span className="text-red font-bold">{src.av_detections}</span> AV engine{src.av_detections !== 1 ? 's' : ''} detected
              </div>
            )}
            {src.tags && src.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {src.tags.slice(0, 5).map((t) => (
                  <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      }
      case 'misp': {
        const eventCount = src.event_count ?? 0
        const hasEvents = eventCount > 0
        const threatColor =
          src.verdict === 'malicious'  ? '#ef4444'
          : src.verdict === 'suspicious' ? '#f59e0b'
          : src.verdict === 'clean'      ? '#22c55e'
          : '#6b7280'
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <VerdictDot verdict={src.verdict} />
              <span className="text-[11px] font-bold font-mono" style={{ color: threatColor }}>
                {hasEvents
                  ? `${eventCount} event${eventCount !== 1 ? 's' : ''}`
                  : 'No events found'}
              </span>
              {src.attribute_count != null && src.attribute_count > 0 && (
                <span className="text-[10px] text-txt-3 font-mono">
                  · {src.attribute_count} attr
                </span>
              )}
              <ExternalLinkIcon href={src.link} />
            </div>
            {src.events && src.events.length > 0 && (
              <div className="flex flex-col gap-1">
                {src.events.slice(0, 3).map((ev) => (
                  <div key={String(ev.id)} className="text-[10px] text-txt-3 leading-tight">
                    <span
                      className="font-bold font-mono mr-1"
                      style={{
                        color: ev.threat_level === 'high' ? '#ef4444'
                          : ev.threat_level === 'medium' ? '#f59e0b'
                          : '#6b7280',
                      }}
                    >
                      {ev.threat_level?.toUpperCase()}
                    </span>
                    <span className="truncate">{ev.info}</span>
                  </div>
                ))}
              </div>
            )}
            {src.tags && src.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {src.tags.slice(0, 4).map((t) => (
                  <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      }
      default:
        return null
    }
  }

  // Skeleton bypasses the label wrapper — it renders its own shaped placeholder
  if (loading || !src) return <SkeletonSourceBlock />

  const content = inner()
  if (content === null) return null

  return (
    <div className="bg-bg border border-border rounded-lg p-3">
      <div className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-1.5">{label}</div>
      {content}
    </div>
  )
}

// ── HashDeepAnalysis ──────────────────────────────────────────────────────────
// Rendered inside hash IOCCards — shows full malware intel (VT sandbox,
// MalwareBazaar YARA, Hybrid Analysis behavioural data).

function HashDeepAnalysis({ result, loading }: { result?: MalwareIntelResult; loading: boolean }) {
  const [expanded, setExpanded] = useState(false)

  if (loading) {
    return (
      <div className="border-t border-border px-4 py-2.5 flex items-center gap-2 text-[11px] text-txt-3">
        <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
        Loading deep analysis…
      </div>
    )
  }

  if (!result || result.error) return null

  const vt = result.virustotal
  const mb = result.malwarebazaar
  const ha = result.hybrid_analysis

  const hasVT = vt?.status === 'ok'
  const hasMB = mb?.status === 'ok'
  const hasHA = ha?.status === 'ok'

  if (!hasVT && !hasMB && !hasHA) return null

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left bg-transparent border-none cursor-pointer hover:bg-white/[0.02] transition-colors group"
      >
        <span className="text-[11px] font-semibold text-txt-3 group-hover:text-txt-2 transition-colors">
          Deep Analysis
        </span>
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={['text-txt-3 transition-transform', expanded ? 'rotate-180' : ''].join(' ')}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-5">

          {/* File info summary */}
          {(hasVT || hasMB) && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
              {[
                { label: 'File Name', value: vt?.file_name || mb?.file_name },
                { label: 'File Type', value: vt?.file_type || mb?.file_type },
                { label: 'File Size', value: formatBytes((hasVT ? vt!.file_size : 0) ?? (hasMB ? mb!.file_size : 0) ?? 0) },
                { label: 'First Seen', value: mb?.first_seen || unixToDate(vt?.first_submission) },
              ].map(({ label, value }) =>
                value && value !== '0 B' ? (
                  <div key={label}>
                    <p className="text-[11px] text-txt-3 uppercase tracking-wide">{label}</p>
                    <p className="text-[10px] text-txt font-mono truncate" title={value}>{value}</p>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* VirusTotal deep */}
          {hasVT && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">VirusTotal</p>

              <DetectionBar malicious={vt!.malicious ?? 0} total={vt!.total ?? 0} />

              {(vt!.popular_threat_name || vt!.popular_threat_category) && (
                <div className="flex gap-2 flex-wrap">
                  {vt!.popular_threat_category && <Pill text={vt!.popular_threat_category} color="#f97316" />}
                  {vt!.popular_threat_name && <Pill text={vt!.popular_threat_name} color="#ef4444" />}
                </div>
              )}

              {vt!.top_detections && vt!.top_detections.length > 0 && (
                <div>
                  <p className="text-[11px] text-txt-3 uppercase tracking-wide mb-1.5">Top Detections</p>
                  <div className="grid grid-cols-2 gap-1">
                    {vt!.top_detections.slice(0, 8).map((d, i) => (
                      <div key={i} className="bg-bg rounded p-2">
                        <p className="text-[11px] font-bold text-txt-2">{d.engine}</p>
                        <p className="text-[10px] text-red font-mono truncate" title={d.result}>{d.result}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {vt!.sandbox_verdicts && vt!.sandbox_verdicts.length > 0 && (
                <div>
                  <p className="text-[11px] text-txt-3 uppercase tracking-wide mb-1.5">Sandbox Verdicts</p>
                  <div className="flex flex-col gap-1">
                    {vt!.sandbox_verdicts.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 bg-bg rounded px-3 py-1.5">
                        <span className="text-[10px] text-txt-2 font-mono flex-1">{s.sandbox}</span>
                        <span className="text-[11px] font-bold" style={{ color: s.verdict === 'malicious' ? '#ef4444' : '#6b7280' }}>
                          {s.verdict.toUpperCase()}
                        </span>
                        {s.malware_names.length > 0 && (
                          <span className="text-[10px] text-txt-3 font-mono">{s.malware_names.join(', ')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {((vt!.contacted_ips?.length ?? 0) > 0 || (vt!.contacted_domains?.length ?? 0) > 0) && (
                <div>
                  <p className="text-[11px] text-txt-3 uppercase tracking-wide mb-1.5">C2 Infrastructure</p>
                  <div className="grid grid-cols-2 gap-4">
                    {(vt!.contacted_ips?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[11px] text-txt-3 mb-1">Contacted IPs</p>
                        {vt!.contacted_ips!.map((ip) => (
                          <p key={ip} className="text-[10px] font-mono text-red">{ip}</p>
                        ))}
                      </div>
                    )}
                    {(vt!.contacted_domains?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[11px] text-txt-3 mb-1">Contacted Domains</p>
                        {vt!.contacted_domains!.map((d) => (
                          <p key={d} className="text-[10px] font-mono text-amber-400">{d}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <ExternalLinkLabel href={vt!.link} label="View on VirusTotal" />
            </div>
          )}

          {/* MalwareBazaar deep */}
          {hasMB && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">MalwareBazaar</p>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                {[
                  { label: 'Signature', value: mb!.signature },
                  { label: 'MIME Type', value: mb!.file_type_mime },
                  { label: 'Delivery',  value: mb!.delivery_method },
                  { label: 'Last Seen', value: mb!.last_seen },
                ].map(({ label, value }) =>
                  value ? (
                    <div key={label}>
                      <p className="text-[11px] text-txt-3 uppercase tracking-wide">{label}</p>
                      <p className="text-[10px] text-txt font-mono">{value}</p>
                    </div>
                  ) : null
                )}
              </div>

              {mb!.tags && mb!.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {mb!.tags.map((t) => <Pill key={t} text={t} color="#a855f7" />)}
                </div>
              )}

              {mb!.yara_rules && mb!.yara_rules.length > 0 && (
                <div>
                  <p className="text-[11px] text-txt-3 uppercase tracking-wide mb-1.5">YARA Rules</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mb!.yara_rules.map((y) => <Pill key={y} text={y} color="#06b6d4" />)}
                  </div>
                </div>
              )}

              {mb!.c2 && mb!.c2.length > 0 && (
                <div>
                  <p className="text-[11px] text-txt-3 uppercase tracking-wide mb-1.5">C2 URLs</p>
                  {mb!.c2.map((c) => (
                    <p key={c} className="text-[10px] font-mono text-red break-all">{c}</p>
                  ))}
                </div>
              )}

              <ExternalLinkLabel href={mb!.link} label="View on MalwareBazaar" />
            </div>
          )}

          {/* Hybrid Analysis */}
          {hasHA && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">Hybrid Analysis</p>

              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-[11px] text-txt-3 uppercase tracking-wide mb-1">Threat Score</p>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-bg rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${ha!.threat_score ?? 0}%`,
                          background: (ha!.threat_score ?? 0) >= 70 ? '#ef4444' : (ha!.threat_score ?? 0) >= 40 ? '#f59e0b' : '#22c55e',
                        }}
                      />
                    </div>
                    <span className="text-[12px] font-bold font-mono text-txt">{ha!.threat_score ?? 0}/100</span>
                  </div>
                </div>
                {ha!.malware_family && (
                  <div>
                    <p className="text-[11px] text-txt-3 uppercase tracking-wide">Malware Family</p>
                    <p className="text-[12px] font-bold text-red font-mono">{ha!.malware_family}</p>
                  </div>
                )}
                {ha!.environment && (
                  <div>
                    <p className="text-[11px] text-txt-3 uppercase tracking-wide">Environment</p>
                    <p className="text-[10px] text-txt font-mono">{ha!.environment}</p>
                  </div>
                )}
              </div>

              {ha!.signatures && ha!.signatures.length > 0 && (
                <div>
                  <p className="text-[11px] text-txt-3 uppercase tracking-wide mb-1.5">Behavioural Signatures</p>
                  <div className="flex flex-col gap-1">
                    {ha!.signatures.map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 flex-shrink-0 text-[11px] mt-px">▸</span>
                        <span className="text-[10px] text-txt-2 font-mono">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ha!.mitre_attcks && ha!.mitre_attcks.length > 0 && (
                <div>
                  <p className="text-[11px] text-txt-3 uppercase tracking-wide mb-1.5">MITRE ATT&CK</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ha!.mitre_attcks.map((m, i) => (
                      <Link
                        key={i}
                        to={`/attack?t=${m.id}`}
                        className="bg-bg rounded p-2 block hover:bg-surface transition-colors no-underline"
                      >
                        <span className="text-[10px] font-bold text-purple font-mono">{m.id}</span>
                        <p className="text-[11px] text-txt-2 truncate">{m.technique}</p>
                        <p className="text-[11px] text-txt-3">{m.tactic}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {((ha!.network_ips?.length ?? 0) > 0 || (ha!.network_domains?.length ?? 0) > 0) && (
                <div>
                  <p className="text-[11px] text-txt-3 uppercase tracking-wide mb-1.5">Network Indicators</p>
                  <div className="grid grid-cols-2 gap-4">
                    {(ha!.network_ips?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[11px] text-txt-3 mb-1">IPs</p>
                        {ha!.network_ips!.map((ip) => (
                          <p key={ip} className="text-[10px] font-mono text-red">{ip}</p>
                        ))}
                      </div>
                    )}
                    {(ha!.network_domains?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[11px] text-txt-3 mb-1">Domains</p>
                        {ha!.network_domains!.map((d) => (
                          <p key={d} className="text-[10px] font-mono text-amber-400">{d}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <ExternalLinkLabel href={ha!.link} label="View on Hybrid Analysis" />
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ── IOCCard ───────────────────────────────────────────────────────────────────

// ── AI Summary ────────────────────────────────────────────────────────────────

function AISummarySection({
  result,
  malwareIntel,
  summary,
  loading,
  error,
  onRequest,
}: {
  result: EnrichResult
  malwareIntel?: MalwareIntelResult
  summary?: string
  loading?: boolean
  error?: string
  onRequest: () => void
}) {
  if (loading) {
    return (
      <div className="border-t border-border px-4 py-3 flex items-center gap-2">
        <div className="w-3 h-3 border border-purple border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="text-[11px] text-txt-3">Generating summary…</span>
      </div>
    )
  }

  if (summary) {
    return (
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-1.5 mb-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple flex-shrink-0">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="text-[11px] font-bold tracking-[0.15em] text-purple uppercase">AI Summary</span>
          <button
            onClick={onRequest}
            title="Regenerate"
            className="ml-auto text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer transition-colors"
          >
            ↺
          </button>
        </div>
        <p className="text-[11px] text-txt-2 leading-relaxed">{summary}</p>
      </div>
    )
  }

  return (
    <div className="border-t border-border px-4 py-2.5 flex items-center gap-2">
      {error && <span className="text-[10px] text-red font-mono flex-1 truncate">{error}</span>}
      <button
        onClick={onRequest}
        className={[
          'flex items-center gap-1.5 text-[11px] font-semibold transition-colors bg-transparent border-none cursor-pointer',
          error ? 'text-txt-3 hover:text-txt-2' : 'text-purple/70 hover:text-purple',
        ].join(' ')}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        {error ? 'Retry AI summary' : 'AI summary'}
      </button>
    </div>
  )
}

function SaveToLibraryButton({ result }: { result: EnrichResult }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  async function handleSave() {
    if (state !== 'idle') return
    setState('saving')
    try {
      await api.createLibraryItem({
        type: 'ioc',
        title: result.ioc,
        summary: `${result.type.toUpperCase()} · ${result.verdict}`,
        verdict: result.verdict,
        source: 'IOC Lookup',
        tags: [result.type, result.verdict],
        content: result.sources as unknown as Record<string, unknown>,
      })
      setState('saved')
    } catch {
      setState('idle')
    }
  }
  return (
    <button
      onClick={handleSave}
      title={state === 'saved' ? 'Saved to Library' : 'Save to Library'}
      className="flex items-center gap-1 text-[11px] font-bold bg-transparent border-none cursor-pointer transition-colors"
      style={{ color: state === 'saved' ? '#22c55e' : '#6b7280' }}
    >
      {state === 'saving' ? (
        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill={state === 'saved' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      )}
      {state === 'saved' ? 'Saved' : 'Save'}
    </button>
  )
}

function iocArtifactType(t: IocType): ArtifactType {
  if (t === 'domain') return 'domain'
  if (t === 'url') return 'url'
  if (t === 'md5' || t === 'sha1' || t === 'sha256') return 'hash'
  return 'ioc'
}

function IOCCard({
  raw, loading, result, error, malwareIntel, malwareIntelLoading,
  summary, summaryLoading, summaryError, onSummarise,
}: {
  raw: string
  loading: boolean
  result?: EnrichResult
  error?: string
  malwareIntel?: MalwareIntelResult
  malwareIntelLoading?: boolean
  summary?: string
  summaryLoading?: boolean
  summaryError?: string
  onSummarise?: () => void
}) {
  const iocType: IocType = result?.type ?? 'unknown'
  const verdict: Verdict = result?.verdict ?? 'unknown'
  const vs = VERDICT_STYLE[verdict]
  const ts = TYPE_STYLE[iocType]
  const relevantSources = RELEVANT[iocType]
  const isHash = HASH_TYPES.includes(iocType)
  const navigate = useNavigate()
  const { openMenu } = useContextMenu()

  function handleIOCContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    openMenu(e.clientX, e.clientY, [
      { label: 'Enrich IOC', icon: MenuIcon.Enrich, action: () => navigate(`/ioc-search?q=${encodeURIComponent(raw)}`) },
      { label: 'Search ATT&CK', icon: MenuIcon.Attack, action: () => navigate(`/attack?q=${encodeURIComponent(raw)}`) },
      { separator: true },
      { label: 'Copy to clipboard', icon: MenuIcon.Copy, action: () => navigator.clipboard.writeText(raw) },
    ])
  }

  return (
    <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-wrap">
        <span
          className="font-mono text-[13px] text-txt font-bold truncate min-w-0 flex-1 cursor-default select-all"
          onContextMenu={handleIOCContextMenu}
          title="Right-click for actions"
        >{raw}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {result && (
            <span className="text-[11px] font-bold tracking-[0.15em] uppercase px-2 py-[3px] rounded" style={{ background: ts.bg, color: ts.text }}>
              {iocType.toUpperCase()}
            </span>
          )}
          {loading ? (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px] text-txt-3">Enriching...</span>
            </div>
          ) : error ? (
            <span className="text-[11px] text-red">{error}</span>
          ) : result ? (
            <>
              <span className="text-[11px] font-bold tracking-[0.15em] uppercase px-2 py-[3px] rounded" style={{ background: vs.bg, color: vs.text }}>
                {vs.label}
              </span>
              <SaveToLibraryButton result={result} />
              <AddToCaseButton
                artifactType={iocArtifactType(iocType)}
                value={result.ioc}
                label={result.ioc}
                variant="compact"
              />
            </>
          ) : null}
        </div>
      </div>

      {!error && (
        <div className="p-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {relevantSources.map((srcKey) => (
            <SourceBlock
              key={srcKey}
              name={srcKey}
              src={result?.sources[srcKey as keyof EnrichResult['sources']]}
              loading={loading}
            />
          ))}
        </div>
      )}

      {!error && isHash && (
        <HashDeepAnalysis result={malwareIntel} loading={malwareIntelLoading ?? false} />
      )}

      {!error && result && onSummarise && (
        <AISummarySection
          result={result}
          malwareIntel={malwareIntel}
          summary={summary}
          loading={summaryLoading}
          error={summaryError}
          onRequest={onSummarise}
        />
      )}
    </div>
  )
}

// ── History panel ─────────────────────────────────────────────────────────────

function HistoryPanel({
  items,
  onRestore,
  onRemove,
  onClear,
}: {
  items: HistoryItem[]
  onRestore: (item: HistoryItem) => void
  onRemove: (id: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">Search History</p>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-[10px] text-txt-3 font-mono">No searches yet.</p>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto flex-1">
          {items.map((item) => {
            const verdicts = item.entries.map((e) => e.result?.verdict).filter(Boolean) as Verdict[]
            const topVerdict = (['malicious', 'suspicious', 'clean'] as Verdict[]).find((v) => verdicts.includes(v))
            const vs = topVerdict ? VERDICT_STYLE[topVerdict] : null

            return (
              <div key={item.id} className="group bg-surface border border-border rounded-lg shadow-card p-3 hover:border-border2 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => onRestore(item)}
                    className="flex-1 text-left bg-transparent border-none cursor-pointer p-0 min-w-0"
                  >
                    <div className="text-[10px] text-txt-3 font-mono mb-1">{timeAgo(item.timestamp)}</div>
                    <div className="text-[10px] text-txt font-mono truncate">
                      {item.iocs.slice(0, 2).join(', ')}
                      {item.iocs.length > 2 && <span className="text-txt-3"> +{item.iocs.length - 2}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      {vs && (
                        <span className="text-[10px] font-bold font-mono px-1.5 py-[2px] rounded" style={{ background: vs.bg, color: vs.text }}>
                          {vs.label}
                        </span>
                      )}
                      <span className="text-[10px] text-txt-3 font-mono">
                        {item.entries.length} IOC{item.entries.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-txt-3 hover:text-red transition-all bg-transparent border-none cursor-pointer p-0 text-[14px] leading-none flex-shrink-0 mt-0.5"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── IOC → Skill pipeline ─────────────────────────────────────────────────────

const REPORT_SKILL_IDS = ['security-advisory', 'threat-actor-profile', 'detection-as-code', 'attack-navigator']

function buildIocContext(entries: Entry[]): string {
  const done = entries.filter((e) => !e.loading && e.result)
  if (!done.length) return ''

  const lines: string[] = [
    'IOC ENRICHMENT ANALYSIS',
    `Analyzed: ${done.length} indicator${done.length !== 1 ? 's' : ''}`,
    '',
  ]

  for (const e of done) {
    const r = e.result!
    const vs = VERDICT_STYLE[r.verdict]
    lines.push(`[${vs.label}] ${r.ioc} (${r.type.toUpperCase()})`)

    const vt = r.sources.virustotal
    if (vt?.status === 'ok' && vt.total) {
      lines.push(`  · VirusTotal: ${vt.malicious}/${vt.total} engines`)
    }
    const ab = r.sources.abuseipdb
    if (ab?.status === 'ok' && ab.score != null) {
      lines.push(`  · AbuseIPDB: ${ab.score}% abuse confidence`)
    }
    const tf = r.sources.threatfox
    if (tf?.status === 'ok' && tf.malware) {
      lines.push(`  · ThreatFox: ${tf.malware}${tf.threat_type ? ' · ' + tf.threat_type : ''}`)
    }
    const misp = r.sources.misp
    if (misp?.status === 'ok' && (misp.event_count ?? 0) > 0) {
      lines.push(`  · MISP: ${misp.event_count} event${misp.event_count !== 1 ? 's' : ''}`)
      misp.events?.slice(0, 2).forEach((ev) => {
        lines.push(`    – [${ev.threat_level?.toUpperCase()}] ${ev.info}`)
      })
    }
    const otx = r.sources.otx
    if (otx?.status === 'ok' && (otx.pulse_count ?? 0) > 0) {
      lines.push(`  · OTX: ${otx.pulse_count} community pulse${otx.pulse_count !== 1 ? 's' : ''}`)
      if (otx.malware_families?.length) lines.push(`    Families: ${otx.malware_families.slice(0, 3).join(', ')}`)
    }
  }

  return lines.join('\n')
}

const SKILL_FIELD_MAP: Record<string, string> = {
  'security-advisory':   'event',
  'threat-actor-profile': 'input',
  'detection-as-code':   'input',
  'attack-navigator':    'input',
}

function GenerateReportButton({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState(false)
  const [launchSkill, setLaunchSkill] = useState<Skill | null>(null)
  const [reportHtml, setReportHtml] = useState<string>('')

  const allDone = entries.length > 0 && entries.every((e) => !e.loading)
  const reportSkills = SKILLS.filter((s) => REPORT_SKILL_IDS.includes(s.id))
  const iocContext = buildIocContext(entries)

  if (!allDone) return null

  function pickSkill(skill: Skill) {
    setOpen(false)
    setLaunchSkill(skill)
  }

  const fieldId = launchSkill ? (SKILL_FIELD_MAP[launchSkill.id] ?? 'input') : 'input'
  const initialValues = launchSkill ? { [fieldId]: iocContext } : {}

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-purple/40 text-purple hover:bg-purple/10 transition-colors bg-transparent cursor-pointer"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Generate Report
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-40 bg-surface border border-border rounded-lg shadow-elevated p-2 w-[260px]">
              <p className="text-[10px] font-bold tracking-[0.15em] text-txt-3 uppercase px-2 py-1.5 mb-1">
                Pre-filled with {entries.filter(e => e.result).length} enriched IOC{entries.filter(e => e.result).length !== 1 ? 's' : ''}
              </p>
              {reportSkills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => pickSkill(skill)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg text-left bg-transparent border-none cursor-pointer transition-colors"
                >
                  <span
                    className="text-[9px] font-bold px-1.5 py-[3px] rounded border flex-shrink-0 leading-none"
                    style={{ color: skill.badgeColor, borderColor: skill.badgeColor + '55', background: skill.badgeColor + '12' }}
                  >
                    {skill.badge}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-txt">{skill.name}</div>
                    <div className="text-[10px] text-txt-3 truncate">{skill.tagline}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {launchSkill && (
        <LaunchDrawer
          skill={launchSkill}
          initialValues={initialValues}
          onClose={() => setLaunchSkill(null)}
          onReportReady={(html) => {
            setLaunchSkill(null)
            setReportHtml(html)
          }}
        />
      )}

      {reportHtml && (
        <ReportModal html={reportHtml} onClose={() => setReportHtml('')} />
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PLACEHOLDER = `8.8.8.8
evil-c2.example.com
https://phishing.example/login
d41d8cd98f00b204e9800998ecf8427e`

const TABS = [
  {
    id: 'ioc' as const,
    label: 'IOC Lookup',
    desc: 'Enrich IPs, domains, URLs, and file hashes across VirusTotal, AbuseIPDB, Shodan, ThreatFox, and more. File hashes automatically include deep malware analysis.',
  },
  {
    id: 'domain' as const,
    label: 'Domain Enum',
    desc: 'DNS records, WHOIS, geolocation, ISP lookup, and subdomain enumeration via certificate transparency.',
  },
]

type TabId = typeof TABS[number]['id']

export default function IOCSearch() {
  const [input, setInput] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [searchParams, setSearchParams] = useSearchParams()

  const history = useIOCHistory()
  const iocs = parseInput(input)
  const overLimit = input.split(/[\n,]+/).filter((s) => s.trim()).length > 10

  const tab = (searchParams.get('tab') ?? 'ioc') as TabId

  function setTab(t: TabId) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', t)
    setSearchParams(next, { replace: true })
  }

  function runEnrich(targetIocs: string[]) {
    if (!targetIocs.length) return
    const initial: Entry[] = targetIocs.map((raw, i) => ({
      id: `${raw}-${i}-${Date.now()}`,
      raw,
      loading: true,
    }))
    setEntries(initial)
    let completed = 0
    const results: Entry[] = [...initial]

    targetIocs.forEach((raw, i) => {
      api
        .enrich(raw)
        .then((result) => {
          results[i] = { ...results[i], loading: false, result }
          // kick off deep analysis for hashes
          if (HASH_TYPES.includes(result.type)) {
            results[i].malwareIntelLoading = true
            setEntries([...results])
            api.malwareIntel(raw.trim().toLowerCase())
              .then((mi) => {
                results[i] = { ...results[i], malwareIntel: mi, malwareIntelLoading: false }
                setEntries([...results])
              })
              .catch(() => {
                results[i] = { ...results[i], malwareIntelLoading: false }
                setEntries([...results])
              })
          } else {
            setEntries([...results])
          }
          if (++completed === targetIocs.length) history.save(targetIocs, results)
        })
        .catch((err: Error) => {
          results[i] = { ...results[i], loading: false, error: err.message }
          setEntries([...results])
          if (++completed === targetIocs.length) history.save(targetIocs, results)
        })
    })
  }

  function handleEnrich() {
    runEnrich(parseInput(input))
  }

  function handleSummarise(entryId: string) {
    const entry = entries.find((e) => e.id === entryId)
    if (!entry?.result || entry.summaryLoading) return
    setEntries((prev) =>
      prev.map((e) => e.id === entryId ? { ...e, summaryLoading: true, summaryError: undefined } : e)
    )
    api.iocSummary(entry.result, entry.malwareIntel ?? null)
      .then(({ summary }) => {
        setEntries((prev) =>
          prev.map((e) => e.id === entryId ? { ...e, summary, summaryLoading: false } : e)
        )
      })
      .catch((err: Error) => {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? { ...e, summaryLoading: false, summaryError: err.message ?? 'Summary failed' }
              : e
          )
        )
      })
  }

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      const iocList = parseInput(q)
      setInput(iocList.join('\n'))
      runEnrich(iocList)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEnrich()
  }

  function restoreHistory(item: HistoryItem) {
    setEntries(item.entries.map((e) => ({ ...e, loading: false })))
    setInput(item.iocs.join('\n'))
  }

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        eyebrow="Threat Intelligence"
        title="IOC Lookup"
        tabs={TABS.map((t) => ({ id: t.id, label: t.label }))}
        activeTab={tab}
        onTabChange={(id) => setTab(id as TabId)}
        flushBottom
      />

      {/* Tab panels */}
      <div className="flex-1 overflow-hidden">
        {tab === 'ioc' && (
          <div className="flex h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-[13px] text-txt-2 mb-6">{activeTab.desc}</p>

              <div className="max-w-2xl mb-8">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={PLACEHOLDER}
                  rows={6}
                  className="w-full bg-bg border border-border rounded-lg text-txt font-mono text-[11px] px-4 py-3 outline-none focus:border-purple transition-colors resize-none placeholder:text-txt-3"
                  spellCheck={false}
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleEnrich}
                      disabled={!iocs.length}
                      className="px-5 py-[10px] text-[11px] font-bold tracking-[0.1em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90"
                    >
                      Enrich {iocs.length > 0 ? `(${iocs.length})` : ''}
                    </button>
                    {entries.length > 0 && (
                      <button
                        onClick={() => { setEntries([]); setInput('') }}
                        className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-txt-3">
                    {overLimit && <span className="text-amber-400">Max 10 IOCs</span>}
                    <span>Ctrl+Enter to run</span>
                  </div>
                </div>
              </div>

              {entries.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">
                      Results ({entries.length})
                    </p>
                    <GenerateReportButton entries={entries} />
                  </div>
                  <div className="flex flex-col gap-4">
                    {entries.map((entry) => (
                      <IOCCard
                        key={entry.id}
                        raw={entry.raw}
                        loading={entry.loading}
                        result={entry.result}
                        error={entry.error}
                        malwareIntel={entry.malwareIntel}
                        malwareIntelLoading={entry.malwareIntelLoading}
                        summary={entry.summary}
                        summaryLoading={entry.summaryLoading}
                        summaryError={entry.summaryError}
                        onSummarise={() => handleSummarise(entry.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-[240px] flex-shrink-0 border-l border-border p-4 overflow-hidden flex flex-col">
              <HistoryPanel
                items={history.items}
                onRestore={restoreHistory}
                onRemove={history.remove}
                onClear={history.clear}
              />
            </div>
          </div>
        )}

        {tab === 'domain' && <DomainEnum />}
      </div>
    </div>
  )
}
