import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { CVEResult } from '../lib/types'
import LaunchDrawer from '../components/LaunchDrawer'
import ReportModal from '../components/ReportModal'
import { SKILLS } from '../lib/skills'
import { SkeletonCVECard } from '../components/Skeleton'
import { useContextMenu, MenuIcon } from '../components/ContextMenu'
import PageHeader from '../components/PageHeader'

// ── helpers ──────────────────────────────────────────────────────────────────

const ADVISORY_SKILL = SKILLS.find((s) => s.id === 'security-advisory')!

const CVE_RE = /^\d{4}-\d{4,}$|^CVE-\d{4}-\d{4,}$/i

function parseCVEIds(raw: string): string[] {
  return raw
    .split(/[\n,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => CVE_RE.test(s))
    .map((s) => (s.startsWith('CVE-') ? s : `CVE-${s}`))
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 10)
}

const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  CRITICAL: { bg: '#ef444420', color: '#ef4444' },
  HIGH:     { bg: '#f9731620', color: '#f97316' },
  MEDIUM:   { bg: '#f59e0b20', color: '#f59e0b' },
  LOW:      { bg: '#eab30820', color: '#eab308' },
  NONE:     { bg: '#6b728020', color: '#6b7280' },
}

function severityStyle(sev: string) {
  return SEVERITY_STYLE[sev.toUpperCase()] ?? SEVERITY_STYLE.NONE
}

function epssColor(score: number): string {
  if (score >= 0.5) return '#ef4444'
  if (score >= 0.1) return '#f59e0b'
  if (score >= 0.01) return '#3b82f6'
  return '#6b7280'
}

function refDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url.slice(0, 40)
  }
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

// ── history ───────────────────────────────────────────────────────────────────

type Entry = {
  id: string
  raw: string
  loading: boolean
  result?: CVEResult
  error?: string
}

type HistoryItem = {
  id: string
  timestamp: string
  queries: string[]
  entries: Omit<Entry, 'loading'>[]
}

const HISTORY_KEY = 'skillcti-cve-history'

function useCVEHistory() {
  const [items, setItems] = useState<HistoryItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
  })

  function save(queries: string[], entries: Entry[]) {
    const item: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      queries,
      entries: entries.map(({ id, raw, result, error }) => ({ id, raw, result, error })),
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

// ── CVE card ─────────────────────────────────────────────────────────────────

function CVECard({
  entry,
  onGenerateAdvisory,
}: {
  entry: Entry
  onGenerateAdvisory: (cveId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { raw, loading, result, error } = entry
  const navigate = useNavigate()
  const { openMenu } = useContextMenu()

  function handleCVEContextMenu(e: React.MouseEvent, cveId: string) {
    e.preventDefault()
    openMenu(e.clientX, e.clientY, [
      { label: 'Generate Advisory', icon: MenuIcon.Advisory, action: () => onGenerateAdvisory(cveId) },
      { label: 'Search ATT&CK', icon: MenuIcon.Attack, action: () => navigate(`/attack?q=${encodeURIComponent(cveId)}`) },
      { separator: true },
      { label: 'Copy CVE ID', icon: MenuIcon.Copy, action: () => navigator.clipboard.writeText(cveId) },
    ])
  }

  if (loading) {
    return <SkeletonCVECard />
  }

  if (error) {
    return (
      <div className="bg-surface border border-border rounded-lg shadow-card p-5 flex items-center gap-3">
        <span className="font-mono text-[13px] text-txt">{raw}</span>
        <span className="text-[11px] text-red">{error}</span>
      </div>
    )
  }

  if (!result) return null

  const { cvss, epss, kev } = result
  const sevStyle = cvss ? severityStyle(cvss.severity) : SEVERITY_STYLE.NONE
  const descLimit = 280
  const descTruncated = result.description.length > descLimit && !expanded

  return (
    <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border">
        <span
          className="font-mono text-[13px] font-bold text-txt tracking-wide mr-1 cursor-default select-text"
          onContextMenu={(e) => handleCVEContextMenu(e, result.cve_id)}
          title="Right-click for actions"
        >
          {result.cve_id}
        </span>
        {cvss && (
          <span
            className="text-[10px] font-bold tracking-[0.15em] uppercase px-2 py-[3px] rounded font-mono"
            style={{ background: sevStyle.bg, color: sevStyle.color }}
          >
            {cvss.severity} {cvss.score.toFixed(1)}
          </span>
        )}
        {epss && (
          <span
            className="text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-[3px] rounded font-mono"
            style={{ background: epssColor(epss.score) + '20', color: epssColor(epss.score) }}
            title={`${(epss.percentile * 100).toFixed(0)}th percentile — probability of exploitation in the next 30 days`}
          >
            EPSS {(epss.score * 100).toFixed(1)}%
          </span>
        )}
        {kev && (
          <span
            className="text-[10px] font-bold tracking-[0.15em] uppercase px-2 py-[3px] rounded font-mono"
            style={{ background: '#ef444420', color: '#ef4444' }}
            title="In CISA Known Exploited Vulnerabilities catalog"
          >
            CISA KEV{kev.ransomware === 'Known' ? ' · RANSOMWARE' : ''}
          </span>
        )}
        <span className="ml-auto text-[10px] text-txt-3 font-mono">
          {result.published && `Published ${result.published}`}
          {result.modified && result.modified !== result.published && ` · Modified ${result.modified}`}
          {result.status && ` · ${result.status}`}
        </span>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {result.description && (
          <div>
            <p className="text-[11px] text-txt-2 leading-relaxed">
              {descTruncated ? result.description.slice(0, descLimit) + '…' : result.description}
            </p>
            {result.description.length > descLimit && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-[11px] text-txt-3 hover:text-txt-2 hover:underline bg-transparent border-none cursor-pointer mt-1 p-0"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
        {cvss?.vector && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">
              CVSS v{cvss.version}
            </span>
            <span className="font-mono text-[10px] text-txt-3 break-all">{cvss.vector}</span>
          </div>
        )}
        {result.affected.length > 0 && (
          <div>
            <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">
              Affected Products
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.affected.map((p, i) => (
                <span
                  key={i}
                  className="text-[10px] font-mono bg-bg border border-border px-2 py-[3px] rounded text-txt-2"
                >
                  {p.vendor} · {p.product}
                </span>
              ))}
            </div>
          </div>
        )}
        {kev && (
          <div className="bg-bg border border-border rounded-lg p-3">
            <p className="text-[11px] font-bold tracking-[0.15em] text-red uppercase mb-2">
              CISA Known Exploited Vulnerability
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] mb-2">
              <div>
                <span className="text-txt-3">Added </span>
                <span className="text-txt font-mono">{kev.date_added}</span>
              </div>
              <div>
                <span className="text-txt-3">Due </span>
                <span className="text-txt font-mono">{kev.due_date}</span>
              </div>
              <div>
                <span className="text-txt-3">Product </span>
                <span className="text-txt">{kev.vendor} {kev.product}</span>
              </div>
              <div>
                <span className="text-txt-3">Ransomware </span>
                <span
                  className="font-bold"
                  style={{ color: kev.ransomware === 'Known' ? '#ef4444' : '#6b7280' }}
                >
                  {kev.ransomware}
                </span>
              </div>
            </div>
            {kev.required_action && (
              <p className="text-[11px] text-txt-2 italic leading-relaxed">{kev.required_action}</p>
            )}
          </div>
        )}
        {result.references.length > 0 && (
          <div>
            <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">
              References
            </p>
            <div className="flex flex-wrap gap-2">
              {result.references.map((ref, i) => (
                <a
                  key={i}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-txt-2 hover:text-txt font-mono bg-bg border border-border px-2 py-[3px] rounded transition-colors"
                  title={ref.url}
                >
                  {refDomain(ref.url)}
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="pt-1 border-t border-border">
          <button
            onClick={() => onGenerateAdvisory(result.cve_id)}
            className="flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-txt-2 hover:text-txt transition-colors bg-transparent border-none cursor-pointer p-0 uppercase"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Generate Security Advisory
          </button>
        </div>
      </div>
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
            const hasErrors = item.entries.some((e) => e.error)
            const severities = item.entries
              .map((e) => e.result?.cvss?.severity?.toUpperCase())
              .filter(Boolean) as string[]
            const topSev = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].find((s) => severities.includes(s))
            const sevColor = topSev ? (SEVERITY_STYLE[topSev]?.color ?? '#6b7280') : '#6b7280'

            return (
              <div
                key={item.id}
                className="group bg-surface border border-border rounded-lg shadow-card p-3 hover:border-border2 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => onRestore(item)}
                    className="flex-1 text-left bg-transparent border-none cursor-pointer p-0 min-w-0"
                  >
                    <div className="text-[10px] text-txt-3 font-mono mb-1">{timeAgo(item.timestamp)}</div>
                    <div className="text-[10px] text-txt font-mono truncate">
                      {item.queries.slice(0, 2).join(', ')}
                      {item.queries.length > 2 && (
                        <span className="text-txt-3"> +{item.queries.length - 2}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      {topSev && (
                        <span
                          className="text-[10px] font-bold font-mono px-1.5 py-[2px] rounded"
                          style={{ background: sevColor + '20', color: sevColor }}
                        >
                          {topSev}
                        </span>
                      )}
                      {hasErrors && (
                        <span className="text-[10px] text-red font-mono">errors</span>
                      )}
                      <span className="text-[10px] text-txt-3 font-mono">
                        {item.entries.length} CVE{item.entries.length !== 1 ? 's' : ''}
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

// ── Page ─────────────────────────────────────────────────────────────────────

const PLACEHOLDER = `CVE-2024-21413
CVE-2023-44487
CVE-2021-44228`

export default function CVESearch() {
  const [input, setInput] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [drawerInitial, setDrawerInitial] = useState<Record<string, string>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [viewing, setViewing] = useState<{ html: string; reportId: string } | null>(null)

  const history = useCVEHistory()
  const parsedIds = parseCVEIds(input)
  const inputCount = input.split(/[\n,\s]+/).filter((s) => s.trim()).length

  function handleSearch() {
    if (!parsedIds.length) return
    const ids = parsedIds

    const initial: Entry[] = ids.map((raw, i) => ({
      id: `${raw}-${i}-${Date.now()}`,
      raw,
      loading: true,
    }))
    setEntries(initial)

    let completed = 0
    const results: Entry[] = [...initial]

    ids.forEach((raw, i) => {
      api
        .lookupCVE(raw)
        .then((result) => {
          results[i] = { ...results[i], loading: false, result }
          setEntries([...results])
          if (++completed === ids.length) history.save(ids, results)
        })
        .catch((err: Error) => {
          results[i] = { ...results[i], loading: false, error: err.message }
          setEntries([...results])
          if (++completed === ids.length) history.save(ids, results)
        })
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSearch()
  }

  function handleGenerateAdvisory(cveId: string) {
    setDrawerInitial({ event: cveId, region: 'Global (AU context)' })
    setDrawerOpen(true)
  }

  function restoreHistory(item: HistoryItem) {
    setEntries(item.entries.map((e) => ({ ...e, loading: false })))
    setInput(item.queries.join('\n'))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader eyebrow="Vulnerability Intelligence" title="CVE Search" />
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-[13px] text-txt-2 mb-6">
          Look up CVEs from NVD, EPSS exploit probability, and the CISA Known Exploited Vulnerabilities catalog.
          Paste one or more CVE IDs below.
        </p>

        <div className="max-w-2xl mb-8">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            rows={4}
            className="w-full bg-bg border border-border rounded-lg text-txt font-mono text-[11px] px-4 py-3 outline-none focus:border-purple transition-colors resize-none placeholder:text-txt-3"
            spellCheck={false}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSearch}
                disabled={!parsedIds.length}
                className="px-5 py-[10px] text-[11px] font-bold tracking-[0.1em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90"
              >
                Search {parsedIds.length > 0 ? `(${parsedIds.length})` : ''}
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
              {inputCount > 10 && <span className="text-amber-400">Max 10 CVEs</span>}
              <span>Ctrl+Enter to search</span>
            </div>
          </div>
        </div>

        {entries.length > 0 && (
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-4">
              Results ({entries.length})
            </p>
            <div className="flex flex-col gap-4">
              {entries.map((entry) => (
                <CVECard
                  key={entry.id}
                  entry={entry}
                  onGenerateAdvisory={handleGenerateAdvisory}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History sidebar */}
      <div className="w-[240px] flex-shrink-0 border-l border-border p-4 overflow-hidden flex flex-col">
        <HistoryPanel
          items={history.items}
          onRestore={restoreHistory}
          onRemove={history.remove}
          onClear={history.clear}
        />
      </div>
      </div>

      <LaunchDrawer
        skill={drawerOpen ? ADVISORY_SKILL : null}
        initialValues={drawerInitial}
        onClose={() => setDrawerOpen(false)}
        onReportReady={(html, reportId) => {
          setDrawerOpen(false)
          if (html && reportId) setViewing({ html, reportId })
        }}
      />
      {viewing && (
        <ReportModal
          html={viewing.html}
          reportId={viewing.reportId}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
