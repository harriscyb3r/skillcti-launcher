import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { api } from '../lib/api'
import type { MispEvent, MispAttribute } from '../lib/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function threatColor(level: string) {
  return level === 'high' ? '#ef4444' : level === 'medium' ? '#f59e0b' : level === 'low' ? '#22c55e' : '#6b7280'
}

function analysisLabel(a: string) {
  return a === 'complete' ? 'Complete' : a === 'ongoing' ? 'Ongoing' : 'Initial'
}

function ExternalLinkIcon({ href }: { href?: string }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-txt-3 hover:text-txt-2 transition-colors flex-shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  )
}

// ── EventRow ──────────────────────────────────────────────────────────────────

function EventRow({ event, mispUrl }: { event: MispEvent; mispUrl: string }) {
  const [expanded, setExpanded] = useState(false)
  const { data: detail, isLoading } = useQuery({
    queryKey: ['misp-event', event.id],
    queryFn: () => api.getMispEvent(String(event.id)),
    enabled: expanded,
    staleTime: 60_000,
  })

  const eventUrl = mispUrl ? `${mispUrl.replace(/\/$/, '')}/events/view/${event.id}` : undefined

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-3 hover:bg-surface/60 transition-colors flex items-start gap-3 bg-transparent border-none cursor-pointer"
      >
        {/* Threat level indicator */}
        <span
          className="mt-[3px] flex-shrink-0 w-[7px] h-[7px] rounded-full"
          style={{ background: threatColor(event.threat_level) }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-bold text-txt truncate">{event.info}</span>
            <ExternalLinkIcon href={eventUrl} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span
              className="text-[10px] font-bold font-mono uppercase"
              style={{ color: threatColor(event.threat_level) }}
            >
              {event.threat_level}
            </span>
            <span className="text-[10px] text-txt-3 font-mono">{event.date}</span>
            {event.org && <span className="text-[10px] text-txt-3">{event.org}</span>}
            <span className="text-[10px] text-txt-3">{event.attribute_count} attr</span>
            <span className="text-[10px] text-txt-3">{analysisLabel(event.analysis)}</span>
          </div>
          {event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {event.tags.slice(0, 5).map((t) => (
                <span key={t} className="text-[10px] font-mono px-1.5 py-[2px] rounded bg-bg border border-border text-txt-3">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`flex-shrink-0 text-txt-3 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-3 border-t border-border/30 bg-bg/40">
          {isLoading ? (
            <div className="flex items-center gap-2 py-3 text-txt-3 text-[11px]">
              <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
              Loading attributes…
            </div>
          ) : detail?.status === 'ok' && detail.attributes.length > 0 ? (
            <AttributeTable attributes={detail.attributes} />
          ) : (
            <div className="py-3 text-[11px] text-txt-3">No attributes found.</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── AttributeTable ────────────────────────────────────────────────────────────

function AttributeTable({ attributes }: { attributes: MispAttribute[] }) {
  const navigate = useNavigate()

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-txt-3 uppercase tracking-wider text-[10px] font-bold border-b border-border/40">
            <th className="text-left py-1.5 pr-4 font-semibold">Category</th>
            <th className="text-left py-1.5 pr-4 font-semibold">Type</th>
            <th className="text-left py-1.5 pr-4 font-semibold">Value</th>
            <th className="text-left py-1.5 font-semibold">Tags</th>
          </tr>
        </thead>
        <tbody>
          {attributes.slice(0, 50).map((attr) => {
            const isIoc = ['ip-dst', 'ip-src', 'domain', 'hostname', 'url', 'md5', 'sha1', 'sha256'].includes(attr.type)
            return (
              <tr key={String(attr.id)} className="border-b border-border/20 last:border-0 hover:bg-surface/40">
                <td className="py-1.5 pr-4 text-txt-3 whitespace-nowrap">{attr.category}</td>
                <td className="py-1.5 pr-4 font-mono text-txt-3 whitespace-nowrap">{attr.type}</td>
                <td className="py-1.5 pr-4 font-mono text-txt max-w-[260px] truncate">
                  {isIoc ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/ioc-search?q=${encodeURIComponent(attr.value)}`)}
                      className="text-purple hover:underline bg-transparent border-none cursor-pointer font-mono text-[11px] p-0"
                      title="Search this IOC"
                    >
                      {attr.value}
                    </button>
                  ) : (
                    <span className="text-txt-2">{attr.value}</span>
                  )}
                </td>
                <td className="py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {(attr.tags ?? []).slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] font-mono px-1.5 py-[1px] rounded bg-bg border border-border text-txt-3">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {attributes.length > 50 && (
        <div className="text-[10px] text-txt-3 mt-2 pl-1">
          Showing 50 of {attributes.length} attributes.
        </div>
      )}
    </div>
  )
}

// ── EventsList ────────────────────────────────────────────────────────────────

function EventsList({ mispUrl }: { mispUrl: string }) {
  const [page, setPage] = useState(1)
  const limit = 50

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['misp-events', page],
    queryFn: () => api.getMispEvents(limit, page),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-txt-3 text-[12px]">
        <div className="w-4 h-4 border border-txt-3 border-t-transparent rounded-full animate-spin" />
        Loading events…
      </div>
    )
  }

  if (isError || data?.status === 'no_key' || data?.status === 'bad_key') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </svg>
        <div className="text-[12px] font-bold text-txt-2">MISP not connected</div>
        <div className="text-[11px] text-txt-3">
          {data?.status === 'bad_key' ? 'Invalid API key.' : 'Add your MISP URL and API key in'}{' '}
          <a href="/settings" className="text-purple hover:underline">Settings</a>.
        </div>
      </div>
    )
  }

  const events = data?.events ?? []

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <div className="text-[12px] font-bold text-txt-2">No events found</div>
        <div className="text-[11px] text-txt-3">Your MISP instance has no events yet.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2 border-b border-border flex-shrink-0">
        <span className="text-[11px] text-txt-3">
          {events.length} event{events.length !== 1 ? 's' : ''} · page {page}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-[11px] font-bold text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer disabled:opacity-50"
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
            className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border border-border rounded px-2 py-1 cursor-pointer disabled:opacity-40"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={events.length < limit || isFetching}
            className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border border-border rounded px-2 py-1 cursor-pointer disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {events.map((ev) => (
          <EventRow key={String(ev.id)} event={ev} mispUrl={mispUrl} />
        ))}
      </div>
    </div>
  )
}

// ── SearchView ────────────────────────────────────────────────────────────────

function SearchView({ mispUrl }: { mispUrl: string }) {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['misp-search', query],
    queryFn: () => api.searchMisp(query, 30),
    enabled: query.length > 0,
    staleTime: 30_000,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = input.trim()
    if (q) setQuery(q)
  }

  const events = data?.events ?? []

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search MISP events — keyword, threat actor, malware family…"
            className="flex-1 bg-bg border border-border rounded-md text-txt font-mono text-[12px] px-3 py-2 outline-none focus:border-purple transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isFetching}
            className="px-4 py-2 text-[11px] font-bold tracking-wider rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-50 transition-opacity hover:opacity-90 whitespace-nowrap"
          >
            {isFetching ? 'Searching…' : 'Search'}
          </button>
        </form>
        <p className="text-[11px] text-txt-3 mt-1.5">
          Searches across event titles and descriptions. For IOC lookups, use{' '}
          <button
            type="button"
            onClick={() => navigate('/ioc-search')}
            className="text-purple hover:underline bg-transparent border-none cursor-pointer p-0 text-[11px]"
          >
            IOC Lookup
          </button>{' '}
          — MISP is queried automatically alongside all other sources.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!query && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center text-txt-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <div className="text-[12px]">Enter a keyword to search MISP events</div>
          </div>
        )}

        {query && isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-txt-3 text-[12px]">
            <div className="w-4 h-4 border border-txt-3 border-t-transparent rounded-full animate-spin" />
            Searching…
          </div>
        )}

        {query && !isLoading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <div className="text-[12px] font-bold text-txt-2">No events matched "{query}"</div>
          </div>
        )}

        {events.map((ev) => (
          <EventRow key={String(ev.id)} event={ev} mispUrl={mispUrl} />
        ))}
      </div>
    </div>
  )
}

// ── StatusBanner ──────────────────────────────────────────────────────────────

function StatusBanner() {
  const { data } = useQuery({
    queryKey: ['misp-status'],
    queryFn: api.getMispStatus,
    staleTime: 60_000,
    retry: false,
  })

  if (!data || data.status === 'no_key') return null

  const ok = data.status === 'ok'
  return (
    <div
      className="flex items-center gap-2 px-5 py-2 border-b border-border text-[11px] flex-shrink-0"
      style={{ background: ok ? '#22c55e08' : '#ef444408' }}
    >
      <span
        className="w-[7px] h-[7px] rounded-full flex-shrink-0"
        style={{ background: ok ? '#22c55e' : '#ef4444' }}
      />
      {ok ? (
        <span className="text-txt-3">
          Connected to <span className="font-mono text-txt">{data.url}</span>
          {data.version && <> · MISP <span className="font-mono">{data.version}</span></>}
        </span>
      ) : (
        <span className="text-txt-3">
          {data.status === 'bad_key' ? 'Invalid API key — ' : 'Connection error — '}
          <a href="/settings" className="text-purple hover:underline">check Settings</a>
        </span>
      )}
    </div>
  )
}

// ── StatsView ─────────────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function formatWeekLabel(monday: Date): string {
  return monday.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function computeWeeklyBins(events: MispEvent[], numWeeks: number) {
  type Bin = { week: string; High: number; Medium: number; Low: number; total: number }
  const bins: Record<string, Bin> = {}

  for (let i = numWeeks - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    const monday = getMondayOf(d)
    const key = monday.toISOString().slice(0, 10)
    if (!bins[key]) bins[key] = { week: formatWeekLabel(monday), High: 0, Medium: 0, Low: 0, total: 0 }
  }

  for (const ev of events) {
    if (!ev.date) continue
    const d = new Date(ev.date)
    const monday = getMondayOf(d)
    const key = monday.toISOString().slice(0, 10)
    if (bins[key]) {
      bins[key].total++
      if (ev.threat_level === 'high') bins[key].High++
      else if (ev.threat_level === 'medium') bins[key].Medium++
      else bins[key].Low++
    }
  }

  return Object.values(bins)
}

function StatsView({ mispUrl }: { mispUrl: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['misp-stats'],
    queryFn: () => api.getMispEvents(200, 1),
    staleTime: 5 * 60_000,
  })

  if (!mispUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="text-[12px] font-bold text-txt-2">MISP not connected</div>
        <div className="text-[11px] text-txt-3">
          Add your MISP URL and API key in{' '}
          <a href="/settings" className="text-purple hover:underline">Settings</a>.
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-txt-3 text-[12px]">
        <div className="w-4 h-4 border border-txt-3 border-t-transparent rounded-full animate-spin" />
        Computing stats…
      </div>
    )
  }

  if (isError || data?.status === 'no_key' || data?.status === 'bad_key') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <div className="text-[12px] font-bold text-txt-2">Could not load stats</div>
        <div className="text-[11px] text-txt-3">
          {data?.status === 'bad_key' ? 'Invalid API key.' : 'Check Settings.'}
        </div>
      </div>
    )
  }

  const events = data?.events ?? []
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <div className="text-[12px] font-bold text-txt-2">No events to analyze</div>
        <div className="text-[11px] text-txt-3">Add events to your MISP instance to see analytics.</div>
      </div>
    )
  }

  // Compute stats
  const threatCounts = { high: 0, medium: 0, low: 0, undefined: 0 }
  const tagCounts: Record<string, number> = {}

  for (const ev of events) {
    const tl = ev.threat_level in threatCounts ? ev.threat_level : 'undefined'
    threatCounts[tl as keyof typeof threatCounts]++
    for (const tag of ev.tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
    }
  }

  const topTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  const weeklyData = computeWeeklyBins(events, 8)

  const donutData = [
    { name: 'High',      value: threatCounts.high,      color: '#ef4444' },
    { name: 'Medium',    value: threatCounts.medium,    color: '#f59e0b' },
    { name: 'Low',       value: threatCounts.low,       color: '#22c55e' },
    { name: 'Undefined', value: threatCounts.undefined, color: '#6b7280' },
  ].filter((d) => d.value > 0)

  const maxTagCount = topTags[0]?.[1] ?? 1

  const statCards = [
    { label: 'Total Events',  value: events.length,            color: '#a855f7' },
    { label: 'High Threat',   value: threatCounts.high,        color: '#ef4444' },
    { label: 'Medium Threat', value: threatCounts.medium,      color: '#f59e0b' },
    { label: 'Unique Tags',   value: Object.keys(tagCounts).length, color: '#06b6d4' },
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-surface border border-border rounded-lg px-3 py-2 text-[11px] shadow-elevated">
        <div className="font-bold text-txt mb-1">{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-txt-3">{p.name}:</span>
            <span className="font-mono font-bold text-txt">{p.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {statCards.map((c) => (
          <div key={c.label} className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[22px] font-bold font-mono" style={{ color: c.color }}>{c.value}</div>
            <div className="text-[11px] text-txt-3 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly events bar chart */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-4">
          Events per Week (last 8 weeks)
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weeklyData} barSize={14} barGap={2}>
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="High"   stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Medium" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Low"    stackId="a" fill="#22c55e" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Threat level donut + Top tags */}
      <div className="grid grid-cols-2 gap-4">

        {/* Threat level donut */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Threat Level</p>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <PieChart width={100} height={100}>
                <Pie
                  data={donutData}
                  cx={50} cy={50}
                  innerRadius={30} outerRadius={46}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {donutData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-[11px] text-txt-2 flex-1">{d.name}</span>
                  <span className="text-[12px] font-mono font-bold text-txt">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top tags */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">
            Top Tags {topTags.length > 0 && <span className="font-normal normal-case text-txt-3">(top {topTags.length})</span>}
          </p>
          {topTags.length === 0 ? (
            <div className="text-[11px] text-txt-3">No tags on events.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {topTags.map(([tag, count]) => (
                <div key={tag} className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-mono text-txt-2 truncate"
                    style={{ width: '140px', flexShrink: 0 }}
                    title={tag}
                  >
                    {tag}
                  </span>
                  <div className="flex-1 h-1 bg-bg rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple"
                      style={{ width: `${(count / maxTagCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-txt-3 w-5 text-right flex-shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <p className="text-[10px] text-txt-3 text-center">
        Based on {events.length} most recent events · {new Date().toLocaleDateString()}
      </p>
    </div>
  )
}

// ── MISP page ─────────────────────────────────────────────────────────────────

type Tab = 'events' | 'search' | 'stats'

export default function MISP() {
  const [tab, setTab] = useState<Tab>('events')

  const { data: status } = useQuery({
    queryKey: ['misp-status'],
    queryFn: api.getMispStatus,
    staleTime: 60_000,
    retry: false,
  })

  const mispUrl = status?.url ?? ''

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-0.5">Intelligence</p>
          <h1 className="text-[18px] font-bold text-txt tracking-tight">MISP</h1>
        </div>
        {mispUrl && (
          <a
            href={mispUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-bold text-txt-3 hover:text-txt-2 transition-colors no-underline"
          >
            Open MISP
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>

      {/* Connection status */}
      <StatusBanner />

      {/* Tabs */}
      <div className="flex border-b border-border flex-shrink-0 px-5">
        {([
          { id: 'events', label: 'Events' },
          { id: 'search', label: 'Search' },
          { id: 'stats',  label: 'Analytics' },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              'px-4 py-2.5 text-[12px] font-bold border-b-2 transition-colors bg-transparent border-none cursor-pointer -mb-px',
              tab === id
                ? 'border-purple text-txt'
                : 'border-transparent text-txt-3 hover:text-txt-2',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'events' && <EventsList mispUrl={mispUrl} />}
      {tab === 'search' && <SearchView mispUrl={mispUrl} />}
      {tab === 'stats'  && <StatsView  mispUrl={mispUrl} />}
    </div>
  )
}
