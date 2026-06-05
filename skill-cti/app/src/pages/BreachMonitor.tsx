import { useState } from 'react'
import { api } from '../lib/api'
import type { BreachResult, ServiceBreach } from '../lib/types'

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function cleanDescription(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const DATA_CLASS_COLORS: Record<string, string> = {
  'Passwords': '#ef4444',
  'Email addresses': '#f97316',
  'Usernames': '#f59e0b',
  'Phone numbers': '#a855f7',
  'Physical addresses': '#06b6d4',
  'Credit cards': '#ef4444',
  'Social security numbers': '#ef4444',
  'Dates of birth': '#6b7280',
  'IP addresses': '#3b82f6',
}

function DataClassPill({ cls }: { cls: string }) {
  const color = DATA_CLASS_COLORS[cls] ?? '#6b7280'
  return (
    <span
      className="inline-block text-[8px] font-bold font-mono px-2 py-[2px] rounded leading-none"
      style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}
    >
      {cls}
    </span>
  )
}

function BreachCard({ breach }: { breach: ServiceBreach }) {
  const [expanded, setExpanded] = useState(false)
  const severity = breach.pwn_count > 10_000_000 ? 'high' : breach.pwn_count > 1_000_000 ? 'medium' : 'low'
  const severityColor = severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f59e0b' : '#6b7280'

  return (
    <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
      <div
        className="flex items-start gap-4 px-4 py-3 cursor-pointer hover:bg-bg/40 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[13px] font-bold text-txt">{breach.title || breach.name}</span>
            {breach.is_verified && (
              <span className="text-[8px] font-bold px-1.5 py-[2px] rounded bg-green/15 text-green border border-green/30">VERIFIED</span>
            )}
            {breach.is_sensitive && (
              <span className="text-[8px] font-bold px-1.5 py-[2px] rounded bg-red/15 text-red border border-red/30">SENSITIVE</span>
            )}
            {breach.is_fabricated && (
              <span className="text-[8px] font-bold px-1.5 py-[2px] rounded bg-amber-400/15 text-amber-400 border border-amber-400/30">FABRICATED</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-txt-3 font-mono">
            <span>{breach.breach_date || 'Unknown date'}</span>
            {breach.domain && <span>· {breach.domain}</span>}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-[20px] font-bold font-mono" style={{ color: severityColor }}>
            {formatCount(breach.pwn_count)}
          </p>
          <p className="text-[8px] text-txt-3 uppercase tracking-wide">accounts</p>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`flex-shrink-0 text-txt-3 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 flex flex-col gap-3">
          {breach.description && (
            <p className="text-[11px] text-txt-2 leading-relaxed">
              {cleanDescription(breach.description)}
            </p>
          )}
          {breach.data_classes.length > 0 && (
            <div>
              <p className="text-[8px] text-txt-3 uppercase tracking-wide mb-1.5">Compromised Data</p>
              <div className="flex flex-wrap gap-1.5">
                {breach.data_classes.map((c) => <DataClassPill key={c} cls={c} />)}
              </div>
            </div>
          )}
          {breach.added_date && (
            <p className="text-[9px] text-txt-3 font-mono">Added to HIBP: {breach.added_date}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function BreachMonitor() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BreachResult | null>(null)
  const [error, setError] = useState('')

  const canSubmit = input.trim().length > 0 && input.includes('.') && !loading

  async function handleCheck() {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await api.breachCheck(input.trim())
      if (res.error) {
        setError(res.error)
      } else {
        setResult(res)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  const cred = result?.credential_data

  return (
    <div className="overflow-y-auto h-full p-6">
      <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Threat Intelligence</p>
      <h1 className="text-[22px] font-bold text-txt tracking-tight mb-1">Breach Monitor</h1>
      <p className="text-[13px] text-txt-2 mb-6">
        Check if an organisation's domain appears in known data breaches via HaveIBeenPwned.
        Checks {result?.total_known_breaches_checked ? `${result.total_known_breaches_checked.toLocaleString()} known breaches` : 'all known public breaches'}.
      </p>

      <div className="max-w-xl mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCheck() }}
            placeholder="adobe.com, linkedin.com, yourcompany.com…"
            className="flex-1 bg-bg border border-border rounded-lg text-txt font-mono text-[11px] px-4 py-3 outline-none focus:border-purple transition-colors"
            spellCheck={false}
          />
          <button
            onClick={handleCheck}
            disabled={!canSubmit}
            className="px-5 py-[10px] text-[11px] font-bold tracking-[0.1em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90 flex-shrink-0"
          >
            {loading ? 'Checking…' : 'Check'}
          </button>
        </div>
        <p className="text-[10px] text-txt-3 mt-2">
          Enter the domain of the organisation to check (not an email address).
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-txt-2 text-[13px] py-4">
          <div className="w-4 h-4 border-2 border-purple border-t-transparent rounded-full animate-spin" />
          <span>Querying HaveIBeenPwned breach database…</span>
        </div>
      )}

      {error && <p className="text-red text-[13px] mb-4">{error}</p>}

      {result && (
        <div className="max-w-3xl">

          {/* Summary banner */}
          <div className={[
            'rounded-lg p-4 mb-6 border flex items-center gap-4',
            result.service_breach_count > 0
              ? 'bg-red/8 border-red/30'
              : 'bg-green/8 border-green/30',
          ].join(' ')}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${result.service_breach_count > 0 ? 'bg-red/20' : 'bg-green/20'}`}>
              {result.service_breach_count > 0 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-[13px] font-bold text-txt">
                {result.service_breach_count > 0
                  ? `${result.service_breach_count} known breach${result.service_breach_count !== 1 ? 'es' : ''} found for ${result.domain}`
                  : `No known service breaches found for ${result.domain}`}
              </p>
              {result.service_breach_count > 0 && result.total_accounts_exposed > 0 && (
                <p className="text-[11px] text-txt-3 mt-0.5">
                  ~{formatCount(result.total_accounts_exposed)} accounts exposed across all incidents
                </p>
              )}
            </div>
          </div>

          {/* Credential exposure (paid HIBP) */}
          {result.hibp_key_configured && cred && (
            <div className="bg-surface border border-border rounded-lg shadow-card p-4 mb-6">
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Credential Exposure</p>
              {cred.requires_paid_plan && (
                <p className="text-[11px] text-amber-400 font-mono">
                  Domain credential search requires a HIBP paid subscription (Pwned 1+).
                </p>
              )}
              {cred.bad_key && (
                <p className="text-[11px] text-red font-mono">HIBP API key rejected — check your key in Settings.</p>
              )}
              {cred.found === false && (
                <p className="text-[11px] text-green font-mono">No exposed credentials found for @{result.domain} email addresses.</p>
              )}
              {cred.found === true && (
                <div className="flex gap-6">
                  <div>
                    <p className="text-[8px] text-txt-3 uppercase tracking-wide">Affected Email Accounts</p>
                    <p className="text-[22px] font-bold font-mono text-red">{formatCount(cred.affected_emails ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-txt-3 uppercase tracking-wide">Breach Exposures</p>
                    <p className="text-[22px] font-bold font-mono text-amber-400">{formatCount(cred.breach_exposures ?? 0)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!result.hibp_key_configured && (
            <div className="bg-surface border border-border rounded-lg shadow-card p-4 mb-6 flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <p className="text-[11px] font-bold text-txt-2 mb-0.5">Full Credential Monitoring Unavailable</p>
                <p className="text-[10px] text-txt-3 leading-relaxed">
                  To check how many email addresses from <span className="font-mono text-txt">{result.domain}</span> appear in breach data, add a HIBP API key in{' '}
                  <a href="/settings" className="text-purple hover:underline">Settings</a>.
                  Free API keys are available at{' '}
                  <a href="https://haveibeenpwned.com/API/Key" target="_blank" rel="noopener noreferrer" className="text-purple hover:underline">haveibeenpwned.com/API/Key</a>.
                  Domain credential search requires a paid plan (Pwned 1, ~$3.50/month).
                </p>
              </div>
            </div>
          )}

          {/* Breach list */}
          {result.service_breaches.length > 0 && (
            <>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">
                Service Breaches — {result.domain}
              </p>
              <div className="flex flex-col gap-2">
                {result.service_breaches.map((b) => (
                  <BreachCard key={b.name} breach={b} />
                ))}
              </div>
            </>
          )}

          <p className="text-[9px] text-txt-3 font-mono mt-4">
            Data sourced from HaveIBeenPwned · Checked {new Date(result.checked_at).toLocaleString()} ·{' '}
            {result.total_known_breaches_checked.toLocaleString()} breaches scanned
          </p>
        </div>
      )}
    </div>
  )
}
