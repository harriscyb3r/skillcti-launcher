import { useState } from 'react'
import { api } from '../lib/api'
import type { EnrichResult, EnrichSource, IocType, Verdict } from '../lib/types'

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
  ip:      ['virustotal', 'abuseipdb', 'shodan', 'threatfox'],
  domain:  ['virustotal', 'urlscan', 'threatfox'],
  url:     ['virustotal', 'urlscan', 'threatfox'],
  md5:     ['virustotal', 'threatfox', 'malwarebazaar'],
  sha1:    ['virustotal', 'threatfox', 'malwarebazaar'],
  sha256:  ['virustotal', 'threatfox', 'malwarebazaar'],
  unknown: ['virustotal', 'threatfox'],
}

const SOURCE_LABELS: Record<string, string> = {
  virustotal:   'VirusTotal',
  abuseipdb:    'AbuseIPDB',
  urlscan:      'urlscan.io',
  shodan:       'Shodan',
  threatfox:    'ThreatFox',
  malwarebazaar:'MalwareBazaar',
}

// ── history ───────────────────────────────────────────────────────────────────

type Entry = {
  id: string
  raw: string
  loading: boolean
  result?: EnrichResult
  error?: string
}

type HistoryItem = {
  id: string
  timestamp: string
  iocs: string[]
  entries: Omit<Entry, 'loading'>[]
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

// ── sub-components ────────────────────────────────────────────────────────────

function ExternalLink({ href }: { href?: string }) {
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

function VerdictDot({ verdict }: { verdict?: Verdict }) {
  const color =
    verdict === 'malicious'  ? '#ef4444'
    : verdict === 'suspicious' ? '#f59e0b'
    : verdict === 'clean'      ? '#22c55e'
    : '#6b7280'
  return <span className="inline-block w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: color }} />
}

function SourceBlock({ name, src, loading }: { name: string; src: EnrichSource | undefined; loading: boolean }) {
  const label = SOURCE_LABELS[name] ?? name

  const inner = () => {
    if (loading || !src) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
          <span className="text-txt-3 text-[10px]">Checking...</span>
        </div>
      )
    }
    if (src.status === 'unsupported') return null
    if (src.status === 'no_key' || src.status === 'bad_key') {
      return (
        <div className="flex items-center gap-1">
          <span className="text-txt-3 text-[10px]">No API key</span>
          <a href="/settings" className="text-[9px] text-purple hover:underline font-mono" onClick={(e) => e.stopPropagation()}>
            Configure →
          </a>
        </div>
      )
    }
    if (src.status === 'not_found') return <span className="text-txt-3 text-[10px]">Not found</span>
    if (src.status === 'error') return <span className="text-red text-[10px]">Error</span>

    switch (name) {
      case 'virustotal':
        return (
          <div className="flex items-center gap-1.5">
            <VerdictDot verdict={src.verdict} />
            <span className="text-[11px] font-mono font-bold" style={{ color: VERDICT_STYLE[src.verdict ?? 'unknown'].text }}>
              {src.malicious}/{src.total}
            </span>
            <span className="text-txt-3 text-[10px]">engines</span>
            <ExternalLink href={src.link} />
          </div>
        )
      case 'abuseipdb':
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <VerdictDot verdict={src.verdict} />
              <span className="text-[11px] font-mono font-bold" style={{ color: VERDICT_STYLE[src.verdict ?? 'unknown'].text }}>
                {src.score}%
              </span>
              <span className="text-txt-3 text-[10px]">abuse · {src.total_reports} reports</span>
              <ExternalLink href={src.link} />
            </div>
            {src.isp && (
              <div className="text-[9px] text-txt-3 mt-0.5 truncate">
                {src.isp}{src.country ? ` · ${src.country}` : ''}{src.is_tor ? ' · TOR' : ''}
              </div>
            )}
          </div>
        )
      case 'urlscan':
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <VerdictDot verdict={src.verdict} />
            <span className="text-[10px] font-bold" style={{ color: VERDICT_STYLE[src.verdict ?? 'unknown'].text }}>
              {src.verdict?.toUpperCase()}
            </span>
            {src.tags && src.tags.length > 0 && (
              <span className="text-[9px] text-txt-3">{src.tags.join(', ')}</span>
            )}
            <ExternalLink href={src.link} />
          </div>
        )
      case 'shodan':
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-txt-3 text-[9px] uppercase tracking-wide">Ports</span>
              <span className="text-[10px] font-mono text-txt">
                {src.ports && src.ports.length > 0 ? src.ports.join(', ') : '—'}
              </span>
              <ExternalLink href={src.link} />
            </div>
            {src.org && <div className="text-[9px] text-txt-3 mt-0.5 truncate">{src.org}</div>}
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
              <ExternalLink href={src.link} />
            </div>
            {src.threat_type && (
              <div className="text-[9px] text-txt-3 mt-0.5">
                {src.threat_type}
                {src.confidence ? ` · ${src.confidence}% confidence` : ''}
                {src.first_seen ? ` · ${src.first_seen}` : ''}
              </div>
            )}
          </div>
        )
      case 'malwarebazaar':
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <VerdictDot verdict={src.verdict} />
              <span className="text-[11px] font-bold" style={{ color: VERDICT_STYLE[src.verdict ?? 'unknown'].text }}>
                {src.signature || src.file_type || 'Malicious'}
              </span>
              <ExternalLink href={src.link} />
            </div>
            {(src.file_name || src.tags?.length) && (
              <div className="text-[9px] text-txt-3 mt-0.5 truncate">
                {src.file_name}
                {src.tags && src.tags.length > 0 ? ` · ${src.tags.slice(0, 3).join(', ')}` : ''}
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }

  const content = inner()
  if (content === null) return null

  return (
    <div className="bg-bg border border-border rounded-lg p-3">
      <div className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-1.5">{label}</div>
      {content}
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
        source: 'IOC Search',
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
      className="flex items-center gap-1 text-[8px] font-bold bg-transparent border-none cursor-pointer transition-colors"
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

function IOCCard({ raw, loading, result, error }: { raw: string; loading: boolean; result?: EnrichResult; error?: string }) {
  const iocType: IocType = result?.type ?? 'unknown'
  const verdict: Verdict = result?.verdict ?? 'unknown'
  const vs = VERDICT_STYLE[verdict]
  const ts = TYPE_STYLE[iocType]
  const relevantSources = RELEVANT[iocType]

  return (
    <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-wrap">
        <span className="font-mono text-[13px] text-txt font-bold truncate min-w-0 flex-1">{raw}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {result && (
            <span className="text-[8px] font-bold tracking-[0.15em] uppercase px-2 py-[3px] rounded" style={{ background: ts.bg, color: ts.text }}>
              {iocType.toUpperCase()}
            </span>
          )}
          {loading ? (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] text-txt-3">Enriching...</span>
            </div>
          ) : error ? (
            <span className="text-[10px] text-red">{error}</span>
          ) : result ? (
            <>
              <span className="text-[8px] font-bold tracking-[0.15em] uppercase px-2 py-[3px] rounded" style={{ background: vs.bg, color: vs.text }}>
                {vs.label}
              </span>
              <SaveToLibraryButton result={result} />
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
            className="text-[9px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
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
                    <div className="text-[9px] text-txt-3 font-mono mb-1">{timeAgo(item.timestamp)}</div>
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
                      <span className="text-[8px] text-txt-3 font-mono">
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

// ── Page ──────────────────────────────────────────────────────────────────────

const PLACEHOLDER = `8.8.8.8
evil-c2.example.com
https://phishing.example/login
d41d8cd98f00b204e9800998ecf8427e`

export default function IOCSearch() {
  const [input, setInput] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])

  const history = useIOCHistory()
  const iocs = parseInput(input)
  const overLimit = input.split(/[\n,]+/).filter((s) => s.trim()).length > 10

  function handleEnrich() {
    if (!iocs.length) return
    const currentIocs = iocs

    const initial: Entry[] = currentIocs.map((raw, i) => ({
      id: `${raw}-${i}-${Date.now()}`,
      raw,
      loading: true,
    }))
    setEntries(initial)

    let completed = 0
    const results: Entry[] = [...initial]

    currentIocs.forEach((raw, i) => {
      api
        .enrich(raw)
        .then((result) => {
          results[i] = { ...results[i], loading: false, result }
          setEntries([...results])
          if (++completed === currentIocs.length) history.save(currentIocs, results)
        })
        .catch((err: Error) => {
          results[i] = { ...results[i], loading: false, error: err.message }
          setEntries([...results])
          if (++completed === currentIocs.length) history.save(currentIocs, results)
        })
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEnrich()
  }

  function restoreHistory(item: HistoryItem) {
    setEntries(item.entries.map((e) => ({ ...e, loading: false })))
    setInput(item.iocs.join('\n'))
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Threat Intelligence</p>
        <h1 className="text-[22px] font-bold text-txt tracking-tight mb-1">IOC Search</h1>
        <p className="text-[13px] text-txt-2 mb-6">
          Paste indicators below — one per line. IPs, domains, URLs, and hashes (MD5/SHA1/SHA256) are supported.
          Defanged IOCs are automatically normalised.
        </p>

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
                  className="text-[10px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-txt-3">
              {overLimit && <span className="text-amber-400">Max 10 IOCs</span>}
              <span>Ctrl+Enter to run</span>
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
                <IOCCard
                  key={entry.id}
                  raw={entry.raw}
                  loading={entry.loading}
                  result={entry.result}
                  error={entry.error}
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
  )
}
