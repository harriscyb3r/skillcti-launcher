import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { api } from '../lib/api'
import { SKILLS } from '../lib/skills'
import LaunchDrawer from '../components/LaunchDrawer'
import ReportModal from '../components/ReportModal'
import NewsWidget from '../components/NewsWidget'
import type { ReportMeta, ThreatActor, ThreatIncident, ThreatCVE, ThreatActorSpotlightData, WatchAlert, Skill } from '../lib/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function cvssColor(score: number): string {
  if (score >= 9.0) return 'text-red bg-red/10 border-red/20'
  if (score >= 7.0) return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
  if (score >= 4.0) return 'text-amber bg-amber/10 border-amber/20'
  return 'text-green bg-green/10 border-green/20'
}

// Skills shown when there is no report history yet
const DEFAULT_LAUNCH_IDS = ['daily-brief-global', 'security-advisory', 'threat-actor-profile', 'operational-au']

// ── quick-launch tiles ────────────────────────────────────────────────────────

function QuickLaunchTiles({
  reports,
  onLaunch,
}: {
  reports: ReportMeta[]
  onLaunch: (skill: Skill) => void
}) {
  // Count reports per skill
  const counts = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.skillId] = (acc[r.skillId] ?? 0) + 1
    return acc
  }, {})

  // Top skills by usage — filter out deleted skills before slicing to 4
  const usedTiles = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([id, count]) => ({ skill: SKILLS.find((s) => s.id === id), count }))
    .filter((t): t is { skill: Skill; count: number } => t.skill != null)
    .slice(0, 4)

  // Pad with defaults for any remaining empty slots
  const usedSkillIds = new Set(usedTiles.map((t) => t.skill.id))
  const defaultPad = DEFAULT_LAUNCH_IDS
    .filter((id) => !usedSkillIds.has(id))
    .map((id) => ({ skill: SKILLS.find((s) => s.id === id), count: 0 }))
    .filter((t): t is { skill: Skill; count: number } => t.skill != null)

  const tiles = [...usedTiles, ...defaultPad].slice(0, 4)

  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Quick Launch</p>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ skill, count }) => (
          <button
            key={skill.id}
            onClick={() => onLaunch(skill)}
            className="group bg-surface border border-border rounded-lg shadow-card p-4 flex flex-col gap-2 text-left hover:border-border2 hover:bg-surface2 transition-colors cursor-pointer w-full"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[8px] font-bold tracking-[0.14em] px-2 py-[3px] rounded flex-shrink-0"
                style={{ background: skill.badgeColor + '22', color: skill.badgeColor }}
              >
                {skill.badge}
              </span>
              {count > 0 && (
                <span className="text-[8px] text-txt-3 font-mono flex-shrink-0">
                  ×{count}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-txt group-hover:text-txt transition-colors leading-snug">
                {skill.name}
              </div>
              <div className="text-[10px] text-txt-3 mt-0.5 leading-relaxed line-clamp-2">
                {skill.tagline}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[9px] font-bold text-txt-3 group-hover:text-txt transition-colors mt-auto pt-1">
              Launch
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── skill usage chart ─────────────────────────────────────────────────────────

function SkillUsageChart({ reports }: { reports: ReportMeta[] }) {
  const counts = reports.reduce<Record<string, { name: string; badge: string; color: string; count: number }>>(
    (acc, r) => {
      if (!acc[r.skillId]) {
        acc[r.skillId] = { name: r.skillName, badge: r.badge, color: r.badgeColor, count: 0 }
      }
      acc[r.skillId].count += 1
      return acc
    },
    {},
  )

  const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 8)
  const max = sorted[0]?.count ?? 1

  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Skill Usage</p>
      <div className="bg-surface border border-border rounded-lg shadow-card p-4 flex flex-col gap-1 h-[calc(100%-28px)]">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center py-6">
            <p className="text-[11px] text-txt-3">No reports yet.</p>
            <Link to="/skills" className="text-[10px] font-bold text-txt-3 hover:text-txt transition-colors">
              Generate your first →
            </Link>
          </div>
        ) : (
          sorted.map((item) => (
            <div key={item.name} className="flex items-center gap-3 py-1.5">
              <span
                className="text-[10px] font-bold tracking-[0.1em] px-1.5 py-[2px] rounded flex-shrink-0 whitespace-nowrap"
                style={{ background: item.color + '22', color: item.color }}
              >
                {item.badge}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-txt-2 truncate mb-1">{item.name}</div>
                <div className="h-[4px] bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(item.count / max) * 100}%`,
                      background: item.color,
                      opacity: 0.75,
                    }}
                  />
                </div>
              </div>
              <span className="text-[9px] font-bold font-mono text-txt-3 w-5 text-right flex-shrink-0">
                {item.count}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── report activity chart ─────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  background: 'var(--surface2)',
  border: '1px solid var(--border2)',
  borderRadius: '6px',
  fontSize: '10px',
  color: 'var(--txt)',
  padding: '4px 8px',
  boxShadow: 'none',
}

function ReportActivityChart({ reports }: { reports: ReportMeta[] }) {
  const data = useMemo(() => {
    const days = 14
    const now = Date.now()
    return Array.from({ length: days }, (_, i) => {
      const dayStart = new Date(now - (days - 1 - i) * 86_400_000)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart.getTime() + 86_400_000)
      const label = dayStart.toLocaleDateString('en', { weekday: 'short', day: 'numeric' })
      const count = reports.filter((r) => {
        const t = new Date(r.timestamp).getTime()
        return t >= dayStart.getTime() && t < dayEnd.getTime()
      }).length
      return { label, count }
    })
  }, [reports])

  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Report Activity · 14 Days</p>
      <div className="bg-surface border border-border rounded-lg shadow-card p-4">
        {reports.length === 0 ? (
          <div className="flex items-center justify-center h-[110px]">
            <p className="text-[11px] text-txt-3">No reports yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 8, fill: 'var(--txt3)' }}
                axisLine={false}
                tickLine={false}
                interval={1}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 8, fill: 'var(--txt3)' }}
                axisLine={false}
                tickLine={false}
                width={18}
              />
              <Tooltip
                cursor={{ fill: 'rgba(168, 85, 247, 0.08)' }}
                contentStyle={TOOLTIP_STYLE}
                itemStyle={{ color: 'var(--txt)' }}
                labelStyle={{ color: 'var(--txt3)', marginBottom: '2px' }}
              />
              <Bar dataKey="count" fill="#a855f7" radius={[2, 2, 0, 0]} opacity={0.8} name="Reports" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ── report types donut ────────────────────────────────────────────────────────

function ReportTypesDonut({ reports }: { reports: ReportMeta[] }) {
  const data = useMemo(() => {
    const counts: Record<string, { name: string; value: number; color: string }> = {}
    for (const r of reports) {
      if (!counts[r.skillId]) {
        counts[r.skillId] = { name: r.badge, value: 0, color: r.badgeColor }
      }
      counts[r.skillId].value += 1
    }
    return Object.values(counts).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [reports])

  if (data.length === 0) {
    return (
      <div>
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Report Types</p>
        <div className="bg-surface border border-border rounded-lg shadow-card p-4 flex items-center justify-center h-[142px]">
          <p className="text-[11px] text-txt-3">No reports yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Report Types</p>
      <div className="bg-surface border border-border rounded-lg shadow-card p-4">
        <ResponsiveContainer width="100%" height={110}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={48}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} opacity={0.85} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
          {data.slice(0, 5).map((d) => (
            <div key={d.name} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-[9px] text-txt-3 font-mono">{d.name} · {d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── threat actor spotlight ────────────────────────────────────────────────────

function threatLevelStyle(level?: string) {
  if (level === 'Critical') return 'bg-red/10 text-red border-red/25'
  if (level === 'High') return 'bg-orange-400/10 text-orange-400 border-orange-400/25'
  return 'bg-amber/10 text-amber border-amber/25'
}

function ThreatActorSpotlightWidget() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['threat-actor-spotlight'],
    queryFn: api.getThreatActorSpotlight,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const refresh = useMutation({
    mutationFn: api.refreshThreatActorSpotlight,
    onSuccess: (result) => {
      queryClient.setQueryData(['threat-actor-spotlight'], result)
    },
  })

  const spot = data?.status === 'ready' ? data as ThreatActorSpotlightData : null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">Threat Actor of the Week</p>
          {spot?.generated_at && (
            <span className="text-[9px] text-txt-3 font-mono">· {timeAgo(spot.generated_at)}</span>
          )}
        </div>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-border hover:border-border2 text-txt-3 hover:text-txt-2 bg-transparent cursor-pointer disabled:opacity-40 transition-colors"
        >
          {refresh.isPending ? (
            <>
              <span className="w-2 h-2 rounded-full border border-purple border-t-transparent animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>

      {refresh.isError && (
        <div className="mb-3 text-[10px] text-red bg-red/5 border border-red/20 rounded-lg px-3 py-2">
          {refresh.error instanceof Error ? refresh.error.message : 'Refresh failed'}
        </div>
      )}

      {(isLoading || refresh.isPending) && (
        <div className="bg-surface border border-border rounded-lg shadow-card p-8 flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 150, 300].map((d) => (
              <span key={d} className="w-2 h-2 rounded-full bg-purple animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
          <p className="text-[11px] text-txt-2">
            {refresh.isPending ? 'Generating threat actor spotlight…' : 'Loading…'}
          </p>
        </div>
      )}

      {!isLoading && !refresh.isPending && data?.status === 'empty' && (
        <div className="bg-surface border border-border rounded-lg shadow-card p-6 flex flex-col items-center gap-3 text-center">
          <p className="text-[11px] text-txt-2">No spotlight generated yet.</p>
          <button
            onClick={() => refresh.mutate()}
            className="text-[10px] font-bold text-txt-3 hover:text-txt transition-colors bg-transparent border-none cursor-pointer"
          >
            Generate now →
          </button>
        </div>
      )}

      {!isLoading && !refresh.isPending && spot && (
        <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
          {/* Header row */}
          <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                <h2 className="text-[15px] font-semibold text-txt tracking-tight leading-none">{spot.actor_name}</h2>
                {spot.threat_level && (
                  <span className={`text-[8px] font-bold px-2 py-0.5 rounded border font-mono tracking-wider ${threatLevelStyle(spot.threat_level)}`}>
                    {spot.threat_level.toUpperCase()}
                  </span>
                )}
              </div>
              {spot.also_known_as && spot.also_known_as.length > 0 && (
                <div className="text-[9px] text-txt-3 font-mono">
                  aka {spot.also_known_as.slice(0, 4).join(' · ')}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              {spot.origin && (
                <span className="text-[8px] font-bold font-mono px-2 py-0.5 rounded bg-bg border border-border text-txt-3">
                  {spot.origin}
                </span>
              )}
              {spot.active_since && (
                <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-bg border border-border text-txt-3">
                  Since {spot.active_since}
                </span>
              )}
              {spot.motivation && (
                <span className="text-[8px] font-bold font-mono px-2 py-0.5 rounded bg-bg text-txt-3 border border-border">
                  {spot.motivation}
                </span>
              )}
            </div>
          </div>

          {/* Summary + targets */}
          <div className="px-5 py-4 border-b border-border">
            {spot.summary && (
              <p className="text-[11px] text-txt-2 leading-relaxed mb-3">{spot.summary}</p>
            )}
            {spot.targets && spot.targets.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase">Targets:</span>
                {spot.targets.map((t) => (
                  <span key={t} className="text-[8px] font-mono px-2 py-0.5 rounded bg-red/8 text-red border border-red/20">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Techniques / Tools / Recent activity */}
          <div className="grid grid-cols-[1fr_1fr_2fr] divide-x divide-border">
            <div className="px-4 py-3">
              <div className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Signature Techniques</div>
              <div className="flex flex-col gap-1.5">
                {spot.signature_techniques?.map((t) => (
                  <span key={t} className="text-[9px] font-mono px-2 py-1 rounded bg-bg text-txt-3 border border-border leading-tight">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Notable Tools</div>
              <div className="flex flex-wrap gap-1.5">
                {spot.notable_tools?.map((tool) => (
                  <span key={tool} className="text-[9px] font-mono px-2 py-1 rounded bg-cyan/8 text-cyan border border-cyan/20">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Recent Activity</div>
              <p className="text-[10px] text-txt-2 leading-relaxed">{spot.recent_activity}</p>
            </div>
          </div>

          <div className="px-5 py-2 border-t border-border flex items-center">
            <span className="text-[9px] text-txt-3">Based on model training knowledge · Auto-refreshes weekly</span>
            <span className="text-[9px] text-txt-3 font-mono ml-auto">
              {spot.generated_at && new Date(spot.generated_at).toLocaleDateString([], { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── alerts widget ─────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red/10 text-red border-red/25',
  high: 'bg-orange-400/10 text-orange-400 border-orange-400/25',
  medium: 'bg-amber/10 text-amber border-amber/25',
  info: 'bg-blue-400/10 text-blue-400 border-blue-400/25',
}

function AlertsWidget() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['alerts-dashboard'],
    queryFn: () => api.getAlerts(true),
    refetchInterval: 30_000,
    retry: false,
  })

  const markAllRead = useMutation({
    mutationFn: api.markAllAlertsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['alert-count'] })
    },
  })

  const dismiss = useMutation({
    mutationFn: (id: string) => api.dismissAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['alert-count'] })
    },
  })

  const alerts = (data?.alerts ?? []).slice(0, 5)
  const unread = data?.unread_count ?? 0

  if (unread === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">Active Alerts</p>
        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red text-white leading-none">
          {unread}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => markAllRead.mutate()}
            className="text-[9px] text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer"
          >
            Mark all read
          </button>
          <button
            onClick={() => navigate('/watchlist')}
            className="text-[9px] font-bold text-txt-3 hover:text-txt transition-colors bg-transparent border-none cursor-pointer"
          >
            View all →
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {alerts.map((alert: WatchAlert) => (
          <div
            key={alert.id}
            className="bg-surface border border-border rounded-lg shadow-card px-4 py-3 flex items-center gap-3"
          >
            <span className={`text-[10px] font-bold tracking-[0.1em] px-1.5 py-0.5 rounded border flex-shrink-0 font-mono ${SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.info}`}>
              {alert.severity.toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-txt truncate">{alert.title}</div>
              <div className="text-[9px] text-txt-3 font-mono truncate mt-0.5">{alert.detail}</div>
            </div>
            <span className="text-[9px] text-txt-3 font-mono flex-shrink-0">{timeAgo(alert.created_at)}</span>
            <button
              onClick={() => dismiss.mutate(alert.id)}
              className="text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer p-1 flex-shrink-0"
              title="Dismiss"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
        {unread > 5 && (
          <button
            onClick={() => navigate('/watchlist')}
            className="text-[9px] text-txt-3 hover:text-txt-2 transition-colors text-center bg-transparent border-none cursor-pointer py-1"
          >
            +{unread - 5} more alerts
          </button>
        )}
      </div>
    </div>
  )
}

// ── threat pulse sub-components ───────────────────────────────────────────────

function ActorCard({ actor }: { actor: ThreatActor }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border border-border rounded-lg p-3 flex flex-col gap-2 bg-bg">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-txt font-mono leading-tight">{actor.name}</div>
          {actor.aliases?.length > 0 && (
            <div className="text-[9px] text-txt-3 font-mono mt-0.5 truncate">
              {actor.aliases.slice(0, 3).join(' · ')}
            </div>
          )}
        </div>
        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3 flex-shrink-0 font-mono">
          {actor.origin}
        </span>
      </div>
      <p className="text-[10px] text-txt-2 leading-relaxed">{actor.targeting}</p>
      {actor.ttps?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {actor.ttps.slice(0, 4).map((t) => (
            <span key={t} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-bg text-txt-3 border border-border">
              {t}
            </span>
          ))}
          {actor.ttps.length > 4 && (
            <span className="text-[8px] text-txt-3 font-mono px-1 py-0.5">+{actor.ttps.length - 4}</span>
          )}
        </div>
      )}
      {actor.recent_activity && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-left text-[9px] text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer p-0"
        >
          {expanded ? '▲ Hide activity' : '▼ Recent activity'}
        </button>
      )}
      {expanded && (
        <p className="text-[10px] text-txt-2 leading-relaxed border-t border-border pt-2">
          {actor.recent_activity}
        </p>
      )}
    </div>
  )
}

function IncidentCard({ incident }: { incident: ThreatIncident }) {
  return (
    <div className="border border-border rounded-lg p-3 flex flex-col gap-1.5 bg-bg">
      <div className="flex items-center gap-2">
        <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3 flex-shrink-0">
          {incident.date}
        </span>
        {incident.threat_actor && (
          <span className="text-[9px] text-txt-2 font-mono truncate">{incident.threat_actor}</span>
        )}
      </div>
      <div className="text-[11px] font-bold text-txt leading-tight">{incident.title}</div>
      <p className="text-[10px] text-txt-2 leading-relaxed">{incident.summary}</p>
    </div>
  )
}

function CVECard({ cve }: { cve: ThreatCVE }) {
  return (
    <div className="border border-border rounded-lg p-3 flex flex-col gap-1.5 bg-bg">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold font-mono text-txt">{cve.cve_id}</span>
        {cve.cvss > 0 && (
          <span className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded border ${cvssColor(cve.cvss)}`}>
            {cve.cvss.toFixed(1)}
          </span>
        )}
        {cve.actively_exploited && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red/10 text-red border border-red/20">
            EXPLOITED
          </span>
        )}
      </div>
      <div className="text-[9px] text-txt-3 font-mono">{cve.product}</div>
      <p className="text-[10px] text-txt-2 leading-relaxed">{cve.description}</p>
    </div>
  )
}

// ── threat pulse widget ───────────────────────────────────────────────────────

function ThreatPulseWidget() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['threat-pulse'],
    queryFn: api.getThreatPulse,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const refresh = useMutation({
    mutationFn: api.refreshThreatPulse,
    onSuccess: (result) => {
      queryClient.setQueryData(['threat-pulse'], { ...result, current_geography: result.geography })
    },
  })

  const noGeography = !data?.current_geography
  const geographyMismatch =
    data?.status === 'ready' &&
    data.geography &&
    data.current_geography &&
    data.geography !== data.current_geography

  const pulse = data?.status === 'ready' ? data : null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">Regional Threat Pulse</p>
          {pulse?.geography && (
            <span className="text-[8px] font-bold font-mono px-2 py-0.5 rounded-full bg-bg text-txt-3 border border-border">
              {pulse.geography}
            </span>
          )}
          {pulse?.generated_at && (
            <span className="text-[9px] text-txt-3 font-mono">· {timeAgo(pulse.generated_at)}</span>
          )}
        </div>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending || noGeography}
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-border hover:border-border2 text-txt-3 hover:text-txt-2 bg-transparent cursor-pointer disabled:opacity-40 transition-colors"
        >
          {refresh.isPending ? (
            <>
              <span className="w-2 h-2 rounded-full border border-purple border-t-transparent animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>

      {geographyMismatch && (
        <div className="mb-3 flex items-center gap-2 text-[10px] text-amber font-mono bg-amber/5 border border-amber/20 rounded-lg px-3 py-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Geography changed to <strong className="mx-1">{data?.current_geography}</strong> — click Refresh to update the pulse.
        </div>
      )}

      {refresh.isError && (
        <div className="mb-3 text-[10px] text-red font-mono bg-red/5 border border-red/20 rounded-lg px-3 py-2">
          {refresh.error instanceof Error ? refresh.error.message : 'Refresh failed'}
        </div>
      )}

      {refresh.isPending && (
        <div className="bg-surface border border-border rounded-lg shadow-card p-8 flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 150, 300].map((d) => (
              <span key={d} className="w-2 h-2 rounded-full bg-purple animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
          <p className="text-[11px] text-txt-2 font-mono">
            Generating threat intelligence for {data?.current_geography}…
          </p>
          <p className="text-[10px] text-txt-3">This may take up to a minute.</p>
        </div>
      )}

      {isLoading && !refresh.isPending && (
        <div className="bg-surface border border-border rounded-lg shadow-card p-6 text-center text-txt-3 text-[11px] font-mono animate-pulse">
          Loading threat pulse…
        </div>
      )}

      {!isLoading && !refresh.isPending && noGeography && (
        <div className="bg-surface border border-border rounded-lg shadow-card p-6 flex flex-col items-center gap-3 text-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-[11px] text-txt-2">
            Set your <strong>Region / Geography</strong> in Settings to enable the Threat Pulse.
          </p>
          <Link to="/settings" className="text-[10px] font-bold font-mono text-txt-3 hover:text-txt transition-colors">
            Go to Settings →
          </Link>
        </div>
      )}

      {!isLoading && !refresh.isPending && !noGeography && data?.status === 'empty' && (
        <div className="bg-surface border border-border rounded-lg shadow-card p-6 flex flex-col items-center gap-3 text-center">
          <p className="text-[11px] text-txt-2">
            No threat pulse data yet for <strong>{data.current_geography}</strong>.
          </p>
          <button
            onClick={() => refresh.mutate()}
            className="text-[10px] font-bold text-txt-3 hover:text-txt transition-colors bg-transparent border-none cursor-pointer"
          >
            Generate now →
          </button>
        </div>
      )}

      {!refresh.isPending && pulse && (
        <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
          {pulse.summary && (
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[11px] text-txt-2 leading-relaxed italic">{pulse.summary}</p>
            </div>
          )}

          {/* CVE risk profile */}
          {pulse.relevant_cves && pulse.relevant_cves.length > 0 && (() => {
            const cves = pulse.relevant_cves!
            const buckets = [
              { label: 'Critical', count: cves.filter(c => c.cvss >= 9.0).length, color: '#ef4444' },
              { label: 'High',     count: cves.filter(c => c.cvss >= 7.0 && c.cvss < 9.0).length, color: '#f97316' },
              { label: 'Medium',   count: cves.filter(c => c.cvss >= 4.0 && c.cvss < 7.0).length, color: '#f59e0b' },
              { label: 'Low',      count: cves.filter(c => c.cvss > 0 && c.cvss < 4.0).length,    color: '#22c55e' },
            ].filter(b => b.count > 0)
            const max = Math.max(...buckets.map(b => b.count), 1)
            return (
              <div className="px-4 py-3 border-b border-border">
                <div className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">CVE Risk Profile</div>
                <div className="flex flex-col gap-1.5">
                  {buckets.map(b => (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="text-[8px] font-mono text-txt-3 w-12 flex-shrink-0">{b.label}</span>
                      <div className="flex-1 h-[5px] bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(b.count / max) * 100}%`, background: b.color, opacity: 0.8 }}
                        />
                      </div>
                      <span className="text-[8px] font-bold font-mono w-3 text-right flex-shrink-0" style={{ color: b.color }}>
                        {b.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="flex flex-col">
              <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red flex-shrink-0">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase">Threat Actors</span>
                <span className="text-[8px] text-txt-3 font-mono ml-auto">{pulse.threat_actors?.length ?? 0}</span>
              </div>
              <div className="flex flex-col gap-2 p-3 overflow-y-auto" style={{ maxHeight: '340px' }}>
                {pulse.threat_actors?.map((a) => <ActorCard key={a.name} actor={a} />)}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber flex-shrink-0">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase">Recent Incidents</span>
                <span className="text-[8px] text-txt-3 font-mono ml-auto">{pulse.recent_incidents?.length ?? 0}</span>
              </div>
              <div className="flex flex-col gap-2 p-3 overflow-y-auto" style={{ maxHeight: '340px' }}>
                {pulse.recent_incidents?.map((inc, i) => <IncidentCard key={i} incident={inc} />)}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-txt-3 flex-shrink-0">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase">Relevant CVEs</span>
                <span className="text-[8px] text-txt-3 font-mono ml-auto">{pulse.relevant_cves?.length ?? 0}</span>
              </div>
              <div className="flex flex-col gap-2 p-3 overflow-y-auto" style={{ maxHeight: '340px' }}>
                {pulse.relevant_cves?.map((c) => <CVECard key={c.cve_id} cve={c} />)}
              </div>
            </div>
          </div>
          <div className="px-4 py-2 border-t border-border flex items-center">
            <span className="text-[9px] text-txt-3 font-mono">
              Based on model training knowledge · Auto-refreshes weekly
            </span>
            <span className="text-[9px] text-txt-3 font-mono ml-auto">
              {pulse.generated_at && new Date(pulse.generated_at).toLocaleDateString([], { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [viewing, setViewing] = useState<{ html: string; reportId: string } | null>(null)
  const [loadingReport, setLoadingReport] = useState<string | null>(null)
  const [drawerSkill, setDrawerSkill] = useState<Skill | null>(null)

  const { data: reportsData } = useQuery({
    queryKey: ['reports'],
    queryFn: api.listReports,
  })

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 10_000,
    retry: false,
  })

  const reports = reportsData?.reports ?? []
  const recentReports = reports.slice(0, 8)

  async function openReport(r: ReportMeta) {
    if (loadingReport) return
    setLoadingReport(r.id)
    try {
      const data = await api.getReport(r.id)
      if (data.html) {
        setViewing({ html: data.html, reportId: r.id })
      } else {
        window.open(`/reports/${r.id}/${r.format ?? 'pdf'}`, '_blank')
      }
    } finally {
      setLoadingReport(null)
    }
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Overview</p>
        <h1 className="text-[22px] font-bold text-txt tracking-tight">SkillCTI</h1>
        <p className="text-[13px] text-txt-2 mt-1">Cyber Threat Intelligence Platform</p>
      </div>

      {/* Compact stat row */}
      <div className="flex gap-3 mb-6">
        <div className="bg-surface border border-border rounded-lg shadow-card px-4 py-3">
          <div className="text-[20px] font-bold text-txt">{reports.length}</div>
          <div className="text-[9px] text-txt-3 uppercase tracking-[0.1em] mt-0.5">Reports Generated</div>
        </div>
        <div className="bg-surface border border-border rounded-lg shadow-card px-4 py-3">
          <div className="text-[20px] font-bold text-txt">
            {reports.filter((r) => Date.now() - new Date(r.timestamp).getTime() < 7 * 86_400_000).length}
          </div>
          <div className="text-[9px] text-txt-3 uppercase tracking-[0.1em] mt-0.5">This Week</div>
        </div>
        <div className="bg-surface border border-border rounded-lg shadow-card px-4 py-3">
          <div className={['text-[20px] font-bold', health?.ok ? 'text-green' : 'text-red'].join(' ')}>
            {health?.ok ? 'Online' : 'Offline'}
          </div>
          <div className="text-[9px] text-txt-3 uppercase tracking-[0.1em] mt-0.5">Backend Status</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-[2fr_1fr] gap-4 mb-6">
        <ReportActivityChart reports={reports} />
        <ReportTypesDonut reports={reports} />
      </div>

      {/* Active alerts — only renders when there are unread alerts */}
      <AlertsWidget />

      {/* Quick launch + recent reports */}
      <div className="grid grid-cols-[3fr_3fr] gap-4 mb-6">
        <QuickLaunchTiles reports={reports} onLaunch={setDrawerSkill} />
        <div className="flex flex-col">
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Recent Reports</p>
          {recentReports.length === 0 ? (
            <div className="bg-surface border border-border rounded-lg shadow-card p-4 text-center flex-1">
              <Link to="/skills" className="text-[10px] font-bold font-mono text-txt-3 hover:text-txt transition-colors">
                Generate your first →
              </Link>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-lg shadow-card p-2 flex flex-col flex-1">
              {recentReports.slice(0, 12).map((r) => (
                <button
                  key={r.id}
                  onClick={() => openReport(r)}
                  disabled={loadingReport === r.id}
                  className="flex items-center gap-2 w-full text-left hover:bg-bg rounded px-2 py-2 transition-colors cursor-pointer bg-transparent border-none disabled:opacity-60 group min-w-0"
                >
                  <span
                    className="text-[10px] font-bold tracking-[0.1em] px-1.5 py-[2px] rounded flex-shrink-0"
                    style={{ background: r.badgeColor + '22', color: r.badgeColor }}
                  >
                    {r.badge}
                  </span>
                  <span className="text-[10px] text-txt truncate flex-1 group-hover:text-txt transition-colors">
                    {loadingReport === r.id ? 'Loading…' : r.title}
                  </span>
                  <span className="text-[9px] text-txt-3 font-mono flex-shrink-0">{timeAgo(r.timestamp)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent News */}
      <NewsWidget />

      {/* Skill Usage */}
      <div className="mb-6">
        <SkillUsageChart reports={reports} />
      </div>

      {/* Threat Pulse */}
      <ThreatPulseWidget />

      {/* Threat Actor Spotlight */}
      <ThreatActorSpotlightWidget />

      {/* Drawers / modals */}
      <LaunchDrawer
        skill={drawerSkill}
        onClose={() => setDrawerSkill(null)}
        onReportReady={(html, reportId) => {
          setDrawerSkill(null)
          if (reportId) setViewing({ html, reportId })
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
