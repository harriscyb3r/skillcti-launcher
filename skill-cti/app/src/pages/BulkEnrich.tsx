import { useState, useRef } from 'react'
import { api } from '../lib/api'
import type { BulkEnrichResult, EnrichResult, Verdict, IocType } from '../lib/types'

const VERDICT_STYLE: Record<Verdict, { bg: string; text: string; label: string }> = {
  malicious:  { bg: '#ef444420', text: '#ef4444', label: 'MALICIOUS' },
  suspicious: { bg: '#f59e0b20', text: '#f59e0b', label: 'SUSPICIOUS' },
  clean:      { bg: '#22c55e20', text: '#22c55e', label: 'CLEAN' },
  unknown:    { bg: '#6b728020', text: '#6b7280', label: 'UNKNOWN' },
}

const TYPE_STYLE: Record<IocType, { bg: string; text: string }> = {
  ip:      { bg: '#3b82f620', text: '#3b82f6' },
  domain:  { bg: '#06b6d420', text: '#06b6d4' },
  url:     { bg: '#f9731620', text: '#f97316' },
  md5:     { bg: '#a855f720', text: '#a855f7' },
  sha1:    { bg: '#a855f720', text: '#a855f7' },
  sha256:  { bg: '#a855f720', text: '#a855f7' },
  unknown: { bg: '#6b728020', text: '#6b7280' },
}

const MAX_IOCS = 100

function parseIocs(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function countVerdict(results: EnrichResult[], v: Verdict) {
  return results.filter((r) => r.verdict === v).length
}

function vtSummary(r: EnrichResult): string {
  const vt = r.sources?.virustotal
  if (!vt || vt.status !== 'ok') return '—'
  return `${vt.malicious}/${vt.total}`
}

function exportCsv(results: EnrichResult[]) {
  const header = 'IOC,Type,Verdict,VT Detections,AbuseIPDB Score,ThreatFox Malware,MalwareBazaar Signature'
  const rows = results.map((r) => {
    const vt = r.sources?.virustotal
    const ab = r.sources?.abuseipdb
    const tf = r.sources?.threatfox
    const mb = r.sources?.malwarebazaar
    return [
      `"${r.ioc}"`,
      r.type,
      r.verdict,
      vt?.status === 'ok' ? `${vt.malicious}/${vt.total}` : '',
      ab?.status === 'ok' ? `${ab.score}%` : '',
      tf?.status === 'ok' ? (tf.malware ?? '') : '',
      mb?.status === 'ok' ? (mb.signature ?? '') : '',
    ].join(',')
  })
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bulk-enrich-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type FilterType = 'all' | Verdict

export default function BulkEnrich() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BulkEnrichResult | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortByVerdict, setSortByVerdict] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const iocs = parseIocs(input)
  const overLimit = iocs.length > MAX_IOCS
  const canSubmit = iocs.length > 0 && !overLimit && !loading

  async function handleEnrich() {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    setResult(null)
    setFilter('all')
    try {
      const res = await api.bulkEnrich(iocs.slice(0, MAX_IOCS))
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enrichment failed')
    } finally {
      setLoading(false)
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setInput(text ?? '')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const VERDICT_ORDER: Record<Verdict, number> = { malicious: 0, suspicious: 1, unknown: 2, clean: 3 }

  const displayed = result
    ? result.results
        .filter((r) => filter === 'all' || r.verdict === filter)
        .slice()
        .sort((a, b) =>
          sortByVerdict
            ? (VERDICT_ORDER[a.verdict] ?? 4) - (VERDICT_ORDER[b.verdict] ?? 4)
            : 0
        )
    : []

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Threat Intelligence</p>
        <h1 className="text-[22px] font-bold text-txt tracking-tight mb-1">Bulk IOC Enrichment</h1>
        <p className="text-[13px] text-txt-2 mb-6">
          Paste up to {MAX_IOCS} indicators (one per line or comma-separated), or upload a CSV. Results are enriched across VirusTotal, AbuseIPDB, ThreatFox, MalwareBazaar, urlscan, and Shodan.
        </p>

        {/* Input area */}
        <div className="max-w-3xl mb-6">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEnrich() }}
            placeholder={`8.8.8.8\nevil-c2.example.com\nd41d8cd98f00b204e9800998ecf8427e\nhxxps://phishing[.]example/login`}
            rows={7}
            className="w-full bg-bg border border-border rounded-lg text-txt font-mono text-[11px] px-4 py-3 outline-none focus:border-purple transition-colors resize-none placeholder:text-txt-3"
            spellCheck={false}
          />
          <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleEnrich}
                disabled={!canSubmit}
                className="px-5 py-[10px] text-[11px] font-bold tracking-[0.1em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90"
              >
                {loading ? 'Enriching…' : `Enrich${iocs.length > 0 ? ` (${iocs.length})` : ''}`}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-4 py-[10px] text-[11px] font-bold tracking-[0.1em] rounded-lg border border-border text-txt-2 bg-transparent cursor-pointer hover:border-purple transition-colors"
              >
                Upload CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
              {(result || input) && (
                <button
                  onClick={() => { setInput(''); setResult(null); setError('') }}
                  className="text-[10px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-txt-3">
              {overLimit && <span className="text-red">Max {MAX_IOCS} IOCs (detected {iocs.length})</span>}
              {!overLimit && iocs.length > 0 && <span>{iocs.length} IOC{iocs.length !== 1 ? 's' : ''} detected</span>}
              <span>Ctrl+Enter to run</span>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 text-txt-2 text-[13px] py-8">
            <div className="w-4 h-4 border-2 border-purple border-t-transparent rounded-full animate-spin" />
            <span>Enriching {iocs.length} IOC{iocs.length !== 1 ? 's' : ''} across 6 sources…</span>
          </div>
        )}

        {error && (
          <div className="text-red text-[13px] mb-4">{error}</div>
        )}

        {/* Summary + filters */}
        {result && (
          <>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mr-2">
                {result.total} results
              </div>
              {(['all', 'malicious', 'suspicious', 'clean', 'unknown'] as FilterType[]).map((f) => {
                const count = f === 'all' ? result.total : countVerdict(result.results, f as Verdict)
                const vs = f !== 'all' ? VERDICT_STYLE[f as Verdict] : null
                const active = filter === f
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={[
                      'text-[9px] font-bold tracking-[0.12em] uppercase px-3 py-[5px] rounded-full border transition-all cursor-pointer',
                      active
                        ? 'border-purple text-purple bg-purple/10'
                        : 'border-border text-txt-3 bg-transparent hover:border-border2',
                    ].join(' ')}
                    style={active && vs ? { borderColor: vs.text, color: vs.text, background: vs.bg } : undefined}
                  >
                    {f === 'all' ? 'All' : VERDICT_STYLE[f as Verdict].label} ({count})
                  </button>
                )
              })}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setSortByVerdict((s) => !s)}
                  className="text-[9px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
                >
                  {sortByVerdict ? 'Sorted by verdict' : 'Original order'}
                </button>
                <button
                  onClick={() => exportCsv(result.results)}
                  className="text-[9px] font-bold px-3 py-[5px] rounded border border-border text-txt-2 bg-transparent hover:border-purple cursor-pointer transition-colors"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* Results table */}
            <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden max-w-5xl">
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="border-b border-border text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase">
                    <th className="text-left px-4 py-2">IOC</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Verdict</th>
                    <th className="text-left px-3 py-2">VT</th>
                    <th className="text-left px-3 py-2">AbuseIPDB</th>
                    <th className="text-left px-3 py-2">ThreatFox</th>
                    <th className="text-left px-3 py-2">MB</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r, i) => {
                    const vs = VERDICT_STYLE[r.verdict]
                    const ts = TYPE_STYLE[r.type]
                    const vt = r.sources?.virustotal
                    const ab = r.sources?.abuseipdb
                    const tf = r.sources?.threatfox
                    const mb = r.sources?.malwarebazaar
                    return (
                      <tr key={`${r.ioc}-${i}`} className="border-b border-border/50 hover:bg-bg/50 transition-colors">
                        <td className="px-4 py-2.5 max-w-[260px]">
                          <span className="truncate block text-txt font-bold text-[11px]" title={r.ioc}>{r.ioc}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[8px] font-bold px-1.5 py-[2px] rounded" style={{ background: ts.bg, color: ts.text }}>
                            {r.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[8px] font-bold px-1.5 py-[2px] rounded" style={{ background: vs.bg, color: vs.text }}>
                            {vs.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-txt-2">
                          {vt?.status === 'ok'
                            ? <span style={{ color: VERDICT_STYLE[vt.verdict ?? 'unknown'].text }}>{vt.malicious}/{vt.total}</span>
                            : <span className="text-txt-3">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-txt-2">
                          {ab?.status === 'ok'
                            ? <span style={{ color: VERDICT_STYLE[ab.verdict ?? 'unknown'].text }}>{ab.score}%</span>
                            : <span className="text-txt-3">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-txt-2">
                          {tf?.status === 'ok'
                            ? <span className="text-red">{tf.malware || 'Malicious'}</span>
                            : <span className="text-txt-3">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-txt-2">
                          {mb?.status === 'ok'
                            ? <span className="text-red">{mb.signature || mb.file_type || '✓'}</span>
                            : <span className="text-txt-3">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {displayed.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <p className="text-[11px] text-txt-3">No results match this filter.</p>
                </div>
              )}
            </div>

            {/* Summary stats */}
            <div className="flex gap-4 mt-4 max-w-5xl">
              {[
                { label: 'Malicious', count: result.malicious, color: '#ef4444' },
                { label: 'Suspicious', count: result.suspicious, color: '#f59e0b' },
                { label: 'Clean', count: result.clean, color: '#22c55e' },
                { label: 'Unknown', count: result.unknown, color: '#6b7280' },
              ].map(({ label, count, color }) => (
                <div key={label} className="bg-surface border border-border rounded-lg shadow-card px-4 py-3 flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase">{label}</span>
                  <span className="text-[20px] font-bold font-mono" style={{ color }}>{count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
