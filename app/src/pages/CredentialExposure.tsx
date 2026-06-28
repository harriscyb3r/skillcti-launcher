import { useState } from 'react'
import { Search, ShieldOff, AlertTriangle, CheckCircle2, Circle, ChevronDown, ChevronUp, Bug, Bell, BellOff } from 'lucide-react'
import { api } from '../lib/api'
import type { IdentityExposureResult, HIBPServiceBreach, HIBPEmailBreach, HudsonRockStealer, ExposureRiskLevel } from '../lib/types'

// ── risk styling ─────────────────────────────────────────────────────────────

const RISK_STYLE: Record<ExposureRiskLevel, { bg: string; border: string; text: string; label: string; Icon: typeof AlertTriangle }> = {
  critical: { bg: 'bg-red/10',    border: 'border-red/40',    text: 'text-red',    label: 'CRITICAL', Icon: ShieldOff },
  high:     { bg: 'bg-amber/10',  border: 'border-amber/40',  text: 'text-amber',  label: 'HIGH',     Icon: AlertTriangle },
  medium:   { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', label: 'MEDIUM', Icon: AlertTriangle },
  low:      { bg: 'bg-green/10',  border: 'border-green/40',  text: 'text-green',  label: 'LOW',      Icon: CheckCircle2 },
  none:     { bg: 'bg-surface2',  border: 'border-border',    text: 'text-txt-3',  label: 'NONE',     Icon: Circle },
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString()
}

function fmtDate(s: string): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

function DataClass({ label }: { label: string }) {
  return (
    <span className="inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-surface2 text-txt-3 border border-border leading-none">
      {label}
    </span>
  )
}

function StatCard({ value, label, color = 'text-txt' }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="bg-surface rounded-lg border border-border shadow-card p-4 flex flex-col gap-1">
      <div className={`text-[22px] font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[11px] font-medium uppercase tracking-widest text-txt-3">{label}</div>
    </div>
  )
}

// ── source status pill ────────────────────────────────────────────────────────

function SourcePill({ name, ok, configured, count, unit }: {
  name: string; ok: boolean; configured: boolean; count?: number; unit?: string
}) {
  const state = !configured ? 'unconfigured' : ok ? 'ok' : 'error'
  const style = {
    ok:            'bg-green/10 border-green/30 text-green',
    error:         'bg-red/10 border-red/30 text-red',
    unconfigured:  'bg-surface2 border-border text-txt-3',
  }[state]

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-[12px] font-medium ${style}`}>
      <span>{name}</span>
      {configured && ok && count != null && (
        <span className="font-mono font-bold text-[11px] opacity-80">{count} {unit}</span>
      )}
      {!configured && <span className="text-[10px] opacity-60">no key</span>}
      {configured && !ok && <span className="text-[10px] opacity-60">error</span>}
    </div>
  )
}

// ── HIBP breach card ──────────────────────────────────────────────────────────

function HIBPBreachCard({ breach }: { breach: HIBPServiceBreach | HIBPEmailBreach }) {
  const [expanded, setExpanded] = useState(false)
  const isService = 'breach_date' in breach

  const title       = isService ? breach.title       : (breach as HIBPEmailBreach).Title
  const domain      = isService ? breach.domain      : (breach as HIBPEmailBreach).Domain
  const date        = isService ? breach.breach_date : (breach as HIBPEmailBreach).BreachDate
  const count       = isService ? breach.pwn_count   : (breach as HIBPEmailBreach).PwnCount
  const dataClasses = isService ? breach.data_classes : (breach as HIBPEmailBreach).DataClasses
  const verified    = isService ? breach.is_verified  : (breach as HIBPEmailBreach).IsVerified
  const description = isService ? breach.description  : (breach as HIBPEmailBreach).Description

  return (
    <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-txt">{title}</span>
            {verified && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-red/15 text-red border border-red/25 leading-none">
                VERIFIED
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[12px] text-txt-3">
            {domain && <span className="font-mono">{domain}</span>}
            <span>{fmtDate(date)}</span>
            <span className="font-semibold text-amber">{fmt(count)} accounts</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {dataClasses.slice(0, 6).map(dc => <DataClass key={dc} label={dc} />)}
            {dataClasses.length > 6 && (
              <span className="text-[10px] text-txt-3">+{dataClasses.length - 6} more</span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-txt-3 flex-shrink-0 mt-1" /> : <ChevronDown size={14} className="text-txt-3 flex-shrink-0 mt-1" />}
      </button>
      {expanded && description && (
        <div className="px-4 pb-4 text-[12px] text-txt-2 border-t border-border pt-3">
          <div dangerouslySetInnerHTML={{ __html: description }} />
        </div>
      )}
    </div>
  )
}

// ── HudsonRock stealer card ───────────────────────────────────────────────────

function StealerCard({ stealer }: { stealer: HudsonRockStealer }) {
  const [expanded, setExpanded] = useState(false)
  const employees = stealer.employees ?? []
  const users     = stealer.users ?? []

  return (
    <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-8 h-8 rounded-md bg-red/10 border border-red/25 flex items-center justify-center flex-shrink-0">
          <Bug size={14} className="text-red" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-txt">{stealer.computer_name ?? 'Unknown Machine'}</span>
            {stealer.operating_system && (
              <span className="text-[10px] font-mono bg-surface2 border border-border text-txt-3 px-1.5 py-0.5 rounded-sm leading-none">
                {stealer.operating_system}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[12px] text-txt-3">
            {stealer.date_compromised && <span className="text-red font-semibold">{fmtDate(stealer.date_compromised)}</span>}
            {stealer.ip && <span className="font-mono">{stealer.ip}</span>}
            {stealer.country_code && <span>{stealer.country_code}</span>}
          </div>
          <div className="flex gap-3 mt-1.5 text-[11px] text-txt-3">
            {employees.length > 0 && <span className="text-amber font-semibold">{employees.length} employee credential{employees.length !== 1 ? 's' : ''}</span>}
            {users.length > 0     && <span>{users.length} user credential{users.length !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-txt-3 flex-shrink-0 mt-1" /> : <ChevronDown size={14} className="text-txt-3 flex-shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {stealer.malware_path && (
            <div className="text-[11px] text-txt-3">
              <span className="uppercase tracking-widest font-semibold mr-2">Malware path</span>
              <span className="font-mono text-txt-2">{stealer.malware_path}</span>
            </div>
          )}
          {employees.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-widest font-semibold text-amber mb-2">Employee Credentials</div>
              <div className="space-y-1.5">
                {employees.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] font-mono bg-surface2 rounded-md px-3 py-2 border border-border">
                    {e.email && <span className="text-txt-2">{e.email}</span>}
                    {e.url && <span className="text-txt-3 truncate text-[11px]">{e.url}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {users.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-widest font-semibold text-txt-3 mb-2">User Credentials</div>
              <div className="space-y-1.5">
                {users.slice(0, 5).map((u, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] font-mono bg-surface2 rounded-md px-3 py-2 border border-border">
                    {u.email && <span className="text-txt-2">{u.email}</span>}
                    {u.url && <span className="text-txt-3 truncate text-[11px]">{u.url}</span>}
                  </div>
                ))}
                {users.length > 5 && (
                  <div className="text-[11px] text-txt-3 px-3">+{users.length - 5} more</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── empty state ───────────────────────────────────────────────────────────────

function EmptyTab({ icon: Icon, message }: { icon: typeof AlertTriangle; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-txt-3">
      <Icon size={28} strokeWidth={1.5} />
      <p className="text-[13px]">{message}</p>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

type Tab = 'breaches' | 'stealers'

export default function CredentialExposure() {
  const [query, setQuery]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<IdentityExposureResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [tab, setTab]             = useState<Tab>('breaches')
  const [monitoring, setMonitoring]   = useState<string | null>(null) // watchlist item id
  const [monitorLoading, setMonitorLoading] = useState(false)
  const [monitorError, setMonitorError]   = useState<string | null>(null)

  async function toggleMonitor() {
    if (!result) return
    setMonitorLoading(true)
    setMonitorError(null)
    try {
      if (monitoring) {
        await api.removeWatchItem(monitoring)
        setMonitoring(null)
      } else {
        const item = await api.addWatchItem('credential', result.query, result.query)
        setMonitoring(item.id)
      }
    } catch (e: any) {
      setMonitorError(e?.message ?? 'Failed')
    } finally {
      setMonitorLoading(false)
    }
  }

  async function run() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setResult(null)
    setMonitoring(null)
    setMonitorError(null)
    try {
      const data = await api.identityExposure(q)
      if (data.error) { setError(data.error); return }
      setResult(data)
      // Auto-select first non-empty tab
      if (data.hudsonrock.total > 0) setTab('stealers')
      else setTab('breaches')
    } catch (e: any) {
      setError(e?.message ?? 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const risk = result?.summary.risk_level ?? 'none'
  const riskStyle = RISK_STYLE[risk]
  const RiskIcon  = riskStyle.Icon

  const totalBreaches = result
    ? result.hibp.service_breaches.length + result.hibp.email_breaches.length
    : 0

  const TABS: { id: Tab; label: string; count: number }[] = result
    ? [
        { id: 'breaches', label: 'Breaches',     count: totalBreaches },
        { id: 'stealers', label: 'Stealer Logs', count: result.hudsonrock.total },
      ]
    : []

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-6 py-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-[22px] font-bold text-txt">Identity &amp; Credential Exposure</h1>
          <p className="text-[13px] text-txt-3 mt-1">
            Search by domain or email to detect stealer log exposure and known breaches.
          </p>
        </div>

        {/* Search */}
        <div className="bg-surface rounded-lg border border-border shadow-card p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && run()}
                placeholder="example.com or user@example.com"
                className="w-full bg-bg border border-border rounded-md pl-9 pr-3 py-2.5 text-[13px] text-txt placeholder-txt-3 focus:outline-none focus:border-purple/60 focus:ring-1 focus:ring-purple/30"
              />
            </div>
            <button
              onClick={run}
              disabled={loading || !query.trim()}
              className="px-5 py-2.5 rounded-md text-[13px] font-semibold text-white bg-gradient-to-r from-purple to-cyan disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer flex-shrink-0"
            >
              {loading ? 'Scanning…' : 'Scan'}
            </button>
          </div>
          <p className="text-[11px] text-txt-3 mt-2 px-1">
            Sources: HIBP · HudsonRock Cavalier
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red/10 border border-red/30 rounded-lg px-4 py-3 text-[13px] text-red">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-surface rounded-lg border border-border shadow-card h-20 animate-pulse" />
            ))}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-5">

            {/* Risk banner */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${riskStyle.bg} ${riskStyle.border}`}>
              <RiskIcon size={16} className={riskStyle.text} />
              <span className={`text-[13px] font-bold ${riskStyle.text}`}>
                {riskStyle.label} RISK
              </span>
              <span className="text-[12px] text-txt-3 ml-1">
                for <span className="font-mono font-semibold text-txt-2">{result.query}</span>
              </span>
              <span className="ml-auto text-[11px] text-txt-3">
                checked {fmtDate(result.checked_at)}
              </span>
              <button
                onClick={toggleMonitor}
                disabled={monitorLoading}
                title={monitoring ? 'Stop monitoring this query' : 'Monitor for new stealer hits (checked every 24h)'}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer disabled:opacity-50',
                  monitoring
                    ? 'bg-purple/15 border-purple/40 text-purple hover:bg-purple/25'
                    : 'bg-surface border-border text-txt-3 hover:text-txt hover:border-purple/40',
                ].join(' ')}
              >
                {monitoring ? <BellOff size={11} /> : <Bell size={11} />}
                {monitoring ? 'Monitoring' : 'Monitor'}
              </button>
            </div>
            {monitorError && (
              <p className="text-[11px] text-red px-1">{monitorError}</p>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                value={result.summary.total_breaches}
                label="Known Breaches"
                color={result.summary.total_breaches > 0 ? 'text-amber' : 'text-txt'}
              />
              <StatCard
                value={result.summary.total_stealer_hits}
                label="Stealer Log Hits"
                color={result.summary.total_stealer_hits > 0 ? 'text-red' : 'text-txt'}
              />
              <StatCard
                value={result.summary.employees_compromised}
                label="Employees Exposed"
                color={result.summary.employees_compromised > 0 ? 'text-amber' : 'text-txt'}
              />
            </div>

            {/* Source coverage */}
            <div className="bg-surface rounded-lg border border-border shadow-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-txt-3 mb-3">Source Coverage</div>
              <div className="flex flex-wrap gap-2">
                <SourcePill
                  name="HIBP"
                  ok={true}
                  configured={true}
                  count={totalBreaches}
                  unit="breaches"
                />
                <SourcePill
                  name="HudsonRock"
                  ok={result.hudsonrock.ok}
                  configured={true}
                  count={result.hudsonrock.total}
                  unit="stealers"
                />
              </div>
              {result.hibp.credential_data?.requires_paid_plan && (
                <p className="text-[11px] text-txt-3 mt-3">
                  Per-email credential counts require a HIBP paid plan (Pwned 1+). Configure your key in Settings.
                </p>
              )}
              {result.hibp.credential_data?.found && result.hibp.credential_data.affected_emails != null && (
                <p className="text-[12px] text-amber mt-3 font-medium">
                  HIBP found {result.hibp.credential_data.affected_emails} email address{result.hibp.credential_data.affected_emails !== 1 ? 'es' : ''} from this domain in breach data
                  ({result.hibp.credential_data.breach_exposures} total breach exposures).
                </p>
              )}
            </div>

            {/* Tabs */}
            <div>
              <div className="flex border-b border-border gap-1 mb-4 -mx-0">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={[
                      'px-4 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 -mb-px',
                      tab === t.id
                        ? 'border-purple text-txt'
                        : 'border-transparent text-txt-3 hover:text-txt-2',
                    ].join(' ')}
                  >
                    {t.label}
                    {t.count > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                        tab === t.id ? 'bg-purple/20 text-purple' : 'bg-surface2 text-txt-3'
                      }`}>
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Breaches tab */}
              {tab === 'breaches' && (
                <div className="space-y-3">
                  {result.hibp.service_breaches.length === 0 && result.hibp.email_breaches.length === 0 ? (
                    <EmptyTab icon={CheckCircle2} message="No known breaches found in HIBP for this query." />
                  ) : (
                    <>
                      {!result.hibp.configured && (
                        <div className="text-[12px] text-txt-3 bg-surface2 rounded-md px-3 py-2 border border-border">
                          HIBP key not configured — only showing public service breach list. Add your key in Settings for per-email credential counts.
                        </div>
                      )}
                      {result.hibp.service_breaches.map(b => (
                        <HIBPBreachCard key={b.name} breach={b} />
                      ))}
                      {result.hibp.email_breaches.map(b => (
                        <HIBPBreachCard key={b.Name} breach={b} />
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Stealer logs tab */}
              {tab === 'stealers' && (
                <div className="space-y-3">
                  {result.hudsonrock.total === 0 ? (
                    result.hudsonrock.ok
                      ? <EmptyTab icon={CheckCircle2} message="No infostealer compromises found via HudsonRock Cavalier." />
                      : <EmptyTab icon={AlertTriangle} message={`HudsonRock query failed: ${result.hudsonrock.error ?? 'unknown error'}`} />
                  ) : (
                    <>
                      <div className="text-[12px] text-txt-3 bg-amber/5 border border-amber/20 rounded-md px-3 py-2">
                        HudsonRock Cavalier detected <span className="text-red font-semibold">{fmt(result.hudsonrock.total)}</span> stealer log hit{result.hudsonrock.total !== 1 ? 's' : ''} for this {result.query_type}.
                        {result.hudsonrock.employees_compromised > 0 && (
                          <> <span className="text-amber font-semibold">{fmt(result.hudsonrock.employees_compromised)} employee credential{result.hudsonrock.employees_compromised !== 1 ? 's' : ''}</span> exposed.</>
                        )}
                        {result.hudsonrock.last_compromised && (
                          <> Last compromise: <span className="font-semibold text-txt-2">{fmtDate(result.hudsonrock.last_compromised)}</span>.</>
                        )}
                      </div>

                      {/* Aggregate malware family breakdown (free-tier overview) */}
                      {result.hudsonrock.stealers.length === 0 && result.hudsonrock.stealer_families && Object.keys(result.hudsonrock.stealer_families).length > 0 && (
                        <div className="bg-surface rounded-lg border border-border shadow-card p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-widest text-txt-3 mb-3">Malware Families Detected</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(result.hudsonrock.stealer_families)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 12)
                              .map(([family, count]) => (
                                <div key={family} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red/5 border border-red/20 text-[12px]">
                                  <Bug size={11} className="text-red flex-shrink-0" />
                                  <span className="font-semibold text-txt-2">{family}</span>
                                  <span className="font-mono text-txt-3 text-[11px]">{fmt(count)}</span>
                                </div>
                              ))}
                          </div>
                          <p className="text-[11px] text-txt-3 mt-3">
                            Per-machine stealer records (compromised computer details, credential lists) are available via the HudsonRock Cavalier paid API.
                          </p>
                        </div>
                      )}

                      {/* Employee credential URLs */}
                      {result.hudsonrock.employees_urls && result.hudsonrock.employees_urls.length > 0 && (
                        <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
                          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber flex-shrink-0" />
                            <span className="text-[12px] font-semibold text-txt">Employee Credential Targets</span>
                            <span className="text-[11px] text-txt-3 ml-auto">{result.hudsonrock.employees_urls.length} endpoint{result.hudsonrock.employees_urls.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="divide-y divide-border">
                            {result.hudsonrock.employees_urls
                              .sort((a, b) => b.occurrence - a.occurrence)
                              .map((entry, i) => (
                                <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
                                  <span className="font-mono text-txt-2 flex-1 truncate">{entry.url}</span>
                                  <span className="font-mono font-bold text-amber text-[11px] flex-shrink-0">{fmt(entry.occurrence)}×</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* User/customer credential URLs */}
                      {result.hudsonrock.users_urls && result.hudsonrock.users_urls.length > 0 && (
                        <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
                          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-txt-3 flex-shrink-0" />
                            <span className="text-[12px] font-semibold text-txt">Customer Credential Targets</span>
                            <span className="text-[11px] text-txt-3 ml-auto">{result.hudsonrock.users_urls.length} endpoint{result.hudsonrock.users_urls.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="divide-y divide-border">
                            {result.hudsonrock.users_urls
                              .sort((a, b) => b.occurrence - a.occurrence)
                              .slice(0, 20)
                              .map((entry, i) => (
                                <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
                                  <span className="font-mono text-txt-2 flex-1 truncate">{entry.url}</span>
                                  <span className="font-mono font-bold text-txt-3 text-[11px] flex-shrink-0">{fmt(entry.occurrence)}×</span>
                                </div>
                              ))}
                            {result.hudsonrock.users_urls.length > 20 && (
                              <div className="px-4 py-2.5 text-[11px] text-txt-3">
                                +{result.hudsonrock.users_urls.length - 20} more endpoints
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {result.hudsonrock.stealers.map((s, i) => (
                        <StealerCard key={i} stealer={s} />
                      ))}
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* Zero-state */}
        {!result && !loading && !error && (
          <div className="flex flex-col items-center gap-4 py-20 text-txt-3">
            <ShieldOff size={36} strokeWidth={1.25} />
            <div className="text-center space-y-1">
              <p className="text-[14px] font-medium text-txt-2">Identity &amp; Credential Exposure</p>
              <p className="text-[13px]">
                Enter a domain (example.com) or email address to check for stealer logs and known breaches.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2 max-w-sm w-full text-left">
              {[
                { icon: Bug,          label: 'Stealer Logs',   desc: 'HudsonRock Cavalier infostealer data' },
                { icon: CheckCircle2, label: 'Known Breaches', desc: 'Have I Been Pwned breach database' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-surface rounded-lg border border-border p-3 flex gap-2.5">
                  <Icon size={14} className="text-txt-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[12px] font-semibold text-txt-2">{label}</div>
                    <div className="text-[11px] text-txt-3 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
