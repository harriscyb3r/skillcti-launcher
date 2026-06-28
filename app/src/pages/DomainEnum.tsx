import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { DomainEnumResult, DomainDNSRecord, DomainGeo } from '../lib/types'

// ── history ───────────────────────────────────────────────────────────────────

const HISTORY_KEY = 'skillcti-domain-history'
const MAX_HISTORY = 30

interface HistoryEntry {
  domain: string
  timestamp: string
  result: DomainEnumResult
}

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── DNS record colours ────────────────────────────────────────────────────────

const DNS_TYPE_STYLE: Record<string, string> = {
  A:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  AAAA:  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  MX:    'bg-purple/10 text-purple border-purple/20',
  NS:    'bg-cyan/10 text-cyan border-cyan/20',
  TXT:   'bg-amber/10 text-amber border-amber/20',
  CNAME: 'bg-green/10 text-green border-green/20',
  SOA:   'bg-orange-400/10 text-orange-400 border-orange-400/20',
}

function dnsTypeStyle(type: string) {
  return DNS_TYPE_STYLE[type] ?? 'bg-surface border-border text-txt-3'
}

// ── sub-components ────────────────────────────────────────────────────────────

function GeoCard({ geo }: { geo: DomainGeo }) {
  return (
    <div className="bg-surface border border-border rounded-lg shadow-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-bold text-txt">{geo.ip}</span>
        {geo.country_code && (
          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-bg border border-border text-txt-3">
            {geo.country_code}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {geo.country && (
          <Row label="Country" value={geo.country} />
        )}
        {geo.region && (
          <Row label="Region" value={geo.region} />
        )}
        {geo.city && (
          <Row label="City" value={geo.city} />
        )}
        {geo.timezone && (
          <Row label="Timezone" value={geo.timezone} />
        )}
        {geo.isp && (
          <Row label="ISP" value={geo.isp} full />
        )}
        {geo.org && geo.org !== geo.isp && (
          <Row label="Org" value={geo.org} full />
        )}
        {geo.as_info && (
          <Row label="AS" value={geo.as_info} full />
        )}
        {geo.lat != null && geo.lon != null && (
          <Row label="Coordinates" value={`${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}`} />
        )}
      </div>
    </div>
  )
}

function Row({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-[11px] font-bold tracking-[0.12em] text-txt-3 uppercase mb-0.5">{label}</div>
      <div className="text-[10px] text-txt font-mono break-all">{value}</div>
    </div>
  )
}

function DNSTable({ records }: { records: DomainDNSRecord[] }) {
  const types = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA']
  const grouped: Record<string, DomainDNSRecord[]> = {}
  for (const r of records) {
    ;(grouped[r.type] ??= []).push(r)
  }
  const orderedTypes = [
    ...types.filter((t) => grouped[t]),
    ...Object.keys(grouped).filter((t) => !types.includes(t)),
  ]

  if (orderedTypes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <p className="text-[12px] font-semibold text-txt-2">No DNS records found</p>
          <p className="text-[11px] text-txt-3 mt-0.5">No records were returned for this domain.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {orderedTypes.map((type) => (
        <div key={type}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-bold font-mono px-2 py-[3px] rounded border ${dnsTypeStyle(type)}`}>
              {type}
            </span>
            <span className="text-[10px] text-txt-3 font-mono">{grouped[type].length} record{grouped[type].length !== 1 ? 's' : ''}</span>
          </div>
          <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
            {grouped[type].map((r, i) => (
              <div
                key={i}
                className={[
                  'flex items-start gap-4 px-4 py-2.5',
                  i < grouped[type].length - 1 ? 'border-b border-border' : '',
                ].join(' ')}
              >
                {r.priority != null && (
                  <span className="text-[10px] font-mono text-txt-3 w-8 flex-shrink-0 pt-px">
                    {r.priority}
                  </span>
                )}
                <span className="text-[11px] font-mono text-txt break-all flex-1 leading-relaxed">
                  {r.value}
                </span>
                {r.ttl != null && (
                  <span className="text-[10px] font-mono text-txt-3 flex-shrink-0 pt-px">
                    TTL {r.ttl}s
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function WhoisSection({ whois }: { whois: NonNullable<DomainEnumResult['whois']> }) {
  if (whois.error) {
    return (
      <p className="text-[11px] text-amber font-mono bg-amber/5 border border-amber/20 rounded-lg px-3 py-2">
        WHOIS: {whois.error}
      </p>
    )
  }

  function fmtDate(s?: string) {
    if (!s) return null
    try {
      return new Date(s).toLocaleDateString([], { dateStyle: 'medium' })
    } catch {
      return s
    }
  }

  const rows: { label: string; value: string | string[] | null | undefined }[] = [
    { label: 'Registrar', value: whois.registrar },
    { label: 'Org', value: whois.org },
    { label: 'Country', value: whois.country },
    { label: 'Created', value: fmtDate(whois.created) },
    { label: 'Expires', value: fmtDate(whois.expires) },
    { label: 'Updated', value: fmtDate(whois.updated) },
    { label: 'DNSSEC', value: whois.dnssec },
  ].filter((r) => r.value && (typeof r.value === 'string' ? r.value.trim() : (r.value as string[]).length > 0))

  return (
    <div className="flex flex-col gap-4">
      {rows.length > 0 && (
        <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={[
                'flex items-start gap-4 px-4 py-2.5',
                i < rows.length - 1 ? 'border-b border-border' : '',
              ].join(' ')}
            >
              <span className="text-[11px] font-bold tracking-[0.12em] text-txt-3 uppercase w-20 flex-shrink-0 pt-px">{row.label}</span>
              <span className="text-[11px] text-txt font-mono flex-1 break-all">{row.value as string}</span>
            </div>
          ))}
        </div>
      )}

      {Array.isArray(whois.status) && whois.status.length > 0 && (
        <div>
          <div className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {whois.status.filter(Boolean).map((s) => (
              <span key={s} className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg border border-border text-txt-2">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(whois.nameservers) && whois.nameservers.length > 0 && (
        <div>
          <div className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Nameservers</div>
          <div className="flex flex-wrap gap-1.5">
            {whois.nameservers.map((ns) => (
              <span key={ns} className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan/8 text-cyan border border-cyan/20">
                {ns}
              </span>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(whois.emails) && whois.emails.length > 0 && (
        <div>
          <div className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Contact Emails</div>
          <div className="flex flex-col gap-1">
            {whois.emails.map((e) => (
              <span key={e} className="text-[10px] font-mono text-txt-2">{e}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── subdomains ────────────────────────────────────────────────────────────────

function SubdomainList({ subdomains, certCount }: { subdomains: string[]; certCount: number }) {
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)

  const filtered = filter
    ? subdomains.filter((s) => s.includes(filter.toLowerCase()))
    : subdomains

  const PAGE = 100
  const visible = showAll ? filtered : filtered.slice(0, PAGE)
  const hasMore = filtered.length > PAGE && !showAll

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-mono text-txt-3">
          {subdomains.length} unique subdomain{subdomains.length !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] font-mono text-txt-3 px-2 py-0.5 rounded bg-surface border border-border">
          from {certCount} cert{certCount !== 1 ? 's' : ''}
        </span>
      </div>

      {subdomains.length > 15 && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter subdomains…"
          className="bg-surface border border-border rounded-lg text-txt font-mono text-[11px] px-3 py-2 outline-none focus:border-purple transition-colors placeholder:text-txt-3 max-w-sm"
        />
      )}

      {filtered.length === 0 ? (
        <p className="text-[11px] text-txt-3 font-mono">No subdomains match.</p>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
              {visible.map((sub, i) => {
                const [prefix, ...rest] = sub.split('.')
                const parent = rest.join('.')
                return (
                  <div
                    key={sub}
                    className={[
                      'flex items-center gap-2 px-4 py-2',
                      i < visible.length - 1 ? 'border-b border-border' : '',
                    ].join(' ')}
                  >
                    <span className="text-[11px] font-mono text-txt">{prefix}</span>
                    <span className="text-[11px] font-mono text-txt-3">.{parent}</span>
                  </div>
                )
              })}
            </div>
          </div>
          {hasMore && (
            <button
              onClick={() => setShowAll(true)}
              className="text-[11px] text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer text-left"
            >
              Show all {filtered.length} subdomains…
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── history panel ─────────────────────────────────────────────────────────────

function HistoryPanel({
  entries,
  onSelect,
  onClear,
}: {
  entries: HistoryEntry[]
  onSelect: (e: HistoryEntry) => void
  onClear: () => void
}) {
  return (
    <div className="w-[240px] flex-shrink-0 border-l border-border flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">History</span>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="text-[11px] text-txt-3 hover:text-red transition-colors bg-transparent border-none cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {entries.length === 0 ? (
          <p className="text-[10px] text-txt-3 font-mono px-4 py-3">No history yet.</p>
        ) : (
          entries.map((e, i) => (
            <button
              key={i}
              onClick={() => onSelect(e)}
              className="w-full text-left px-4 py-2.5 hover:bg-bg/60 transition-colors border-none bg-transparent cursor-pointer border-b border-border last:border-0"
            >
              <div className="text-[10px] font-mono text-txt truncate">{e.domain}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-txt-3 font-mono">{timeAgo(e.timestamp)}</span>
                <span className="text-[10px] text-txt-3 font-mono">
                  {e.result.resolved_ips.length} IP{e.result.resolved_ips.length !== 1 ? 's' : ''}
                  {' · '}
                  {e.result.subdomains?.length ?? 0} subdomains
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function DomainEnum() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DomainEnumResult | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleLookup(domain = input.trim()) {
    if (!domain || loading) return
    setError('')
    setLoading(true)
    try {
      const res = await api.domainEnum(domain)
      setResult(res)
      if (!res.error) {
        const entry: HistoryEntry = { domain: res.domain, timestamp: new Date().toISOString(), result: res }
        const next = [entry, ...history.filter((h) => h.domain !== res.domain)].slice(0, MAX_HISTORY)
        setHistory(next)
        saveHistory(next)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  function restoreHistory(e: HistoryEntry) {
    setInput(e.domain)
    setResult(e.result)
    setError('')
  }

  function clearHistory() {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }

  const hasResult = result && !result.error

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main */}
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Reconnaissance</p>
        <h1 className="text-[22px] font-bold text-txt tracking-tight mb-1">Domain Enumeration</h1>
        <p className="text-[13px] text-txt-2 mb-6">MX records, WHOIS, DNS, geolocation and ISP lookup for any domain.</p>

        {/* Input */}
        <div className="flex gap-2 mb-8">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            placeholder="example.com"
            spellCheck={false}
            className="flex-1 bg-surface border border-border rounded-lg text-txt font-mono text-[13px] px-4 py-2.5 outline-none focus:border-purple transition-colors placeholder:text-txt-3"
          />
          <button
            onClick={() => handleLookup()}
            disabled={!input.trim() || loading}
            className="px-5 py-2.5 text-[11px] font-bold tracking-[0.1em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90 flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
                Looking up…
              </>
            ) : (
              'Enumerate'
            )}
          </button>
        </div>

        {error && (
          <div className="mb-6 text-[11px] text-red font-mono bg-red/5 border border-red/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {result?.error && (
          <div className="mb-6 text-[11px] text-amber font-mono bg-amber/5 border border-amber/20 rounded-lg px-4 py-3">
            {result.error}
          </div>
        )}

        {hasResult && (
          <div className="flex flex-col gap-8">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-[15px] font-semibold text-txt font-mono">{result.domain}</h2>
              <span className="text-[10px] font-mono text-txt-3 px-2 py-0.5 rounded bg-surface border border-border">
                {result.resolved_ips.length} IP{result.resolved_ips.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[10px] font-mono text-txt-3 px-2 py-0.5 rounded bg-surface border border-border">
                {result.dns_records.length} DNS records
              </span>
              {result.subdomains?.length > 0 && (
                <span className="text-[10px] font-mono text-txt-3 px-2 py-0.5 rounded bg-surface border border-border">
                  {result.subdomains.length} subdomains
                </span>
              )}
            </div>

            {/* Geolocation / ISP */}
            {result.geo.length > 0 && (
              <section>
                <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">
                  Geolocation &amp; ISP
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {result.geo.map((g) => (
                    <GeoCard key={g.ip} geo={g} />
                  ))}
                </div>
              </section>
            )}

            {/* DNS Records */}
            <section>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">DNS Records</p>
              <DNSTable records={result.dns_records} />
            </section>

            {/* Subdomains */}
            {result.subdomains?.length > 0 && (
              <section>
                <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">
                  Subdomains
                  <span className="ml-2 normal-case tracking-normal font-normal text-txt-3">· via certificate transparency</span>
                </p>
                <SubdomainList subdomains={result.subdomains} certCount={result.subdomain_cert_count} />
              </section>
            )}

            {/* No subdomains found note */}
            {result.subdomains?.length === 0 && result.subdomain_cert_count === 0 && (
              <section>
                <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Subdomains</p>
                <div className="flex items-center gap-2 text-txt-3 text-[11px]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  No subdomains found in certificate transparency logs.
                </div>
              </section>
            )}

            {/* WHOIS */}
            <section>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">WHOIS</p>
              {result.whois ? (
                <WhoisSection whois={result.whois} />
              ) : (
                <p className="text-[11px] text-txt-3 font-mono">WHOIS data unavailable (python-whois not installed).</p>
              )}
            </section>
          </div>
        )}
      </div>

      {/* History sidebar */}
      <HistoryPanel entries={history} onSelect={restoreHistory} onClear={clearHistory} />
    </div>
  )
}
