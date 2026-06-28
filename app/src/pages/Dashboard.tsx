import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts'
import { api } from '../lib/api'
import { SKILLS } from '../lib/skills'
import LaunchDrawer from '../components/LaunchDrawer'
import ReportModal from '../components/ReportModal'
import NewsWidget from '../components/NewsWidget'
import EmptyState from '../components/EmptyState'
import {
  SkeletonStatCard, SkeletonLaunchTile, SkeletonReportRow,
  SkeletonSpotlightCard, SkeletonPulseCard, SkeletonTableRow,
} from '../components/Skeleton'
import { useContextMenu, MenuIcon } from '../components/ContextMenu'
import type { ReportMeta, ThreatActor, ThreatIncident, ThreatCVE, ThreatActorSpotlightData, WatchAlert, Skill, MispEvent } from '../lib/types'

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

const DEFAULT_LAUNCH_IDS = ['daily-brief-global', 'security-advisory', 'threat-actor-profile', 'operational']

// ── sparkline helpers ─────────────────────────────────────────────────────────

/** Returns an array of `n` daily counts, oldest-first, ending today. */
function buildDailyCounts(items: { timestamp: string }[], n = 7): number[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: n }, (_, i) => {
    const start = today.getTime() - (n - 1 - i) * 86_400_000
    const end   = start + 86_400_000
    return items.filter((x) => {
      const t = new Date(x.timestamp).getTime()
      return t >= start && t < end
    }).length
  })
}

/** Returns an array of `n` daily USD spend values, oldest-first, ending today. */
function buildDailySpend(reports: ReportMeta[], n = 7): number[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: n }, (_, i) => {
    const start = today.getTime() - (n - 1 - i) * 86_400_000
    const end   = start + 86_400_000
    return reports
      .filter((r) => { const t = new Date(r.timestamp).getTime(); return t >= start && t < end })
      .reduce((s, r) => s + (r.cost_usd ?? 0), 0)
  })
}

function weekSum(data14: number[], half: 'this' | 'last'): number {
  return (half === 'last' ? data14.slice(0, 7) : data14.slice(7))
    .reduce((s, v) => s + v, 0)
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

type SparkDatum = { i: number; v: number }

function Sparkline({ values, color, gradId }: { values: number[]; color: string; gradId: string }) {
  const data: SparkDatum[] = values.map((v, i) => ({ i, v }))
  const allZero = values.every((v) => v === 0)

  if (allZero) {
    return (
      <div className="w-16 h-7 flex items-end pb-0.5">
        <div className="w-full border-t border-dashed" style={{ borderColor: color, opacity: 0.25 }} />
      </div>
    )
  }

  return (
    <ResponsiveContainer width={64} height={28}>
      <AreaChart data={data} margin={{ top: 3, right: 1, bottom: 0, left: 1 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── TrendBadge ────────────────────────────────────────────────────────────────

function TrendBadge({
  thisWeek, lastWeek, invert = false,
}: {
  thisWeek: number; lastWeek: number; invert?: boolean
}) {
  if (thisWeek === 0 && lastWeek === 0) return null
  if (lastWeek === 0) {
    return thisWeek > 0
      ? <span className="text-[10px] font-bold font-mono text-txt-3 leading-none">new</span>
      : null
  }
  const pct   = ((thisWeek - lastWeek) / lastWeek) * 100
  const isUp  = pct >  0.5
  const isDn  = pct < -0.5
  const isGood = invert ? isDn : isUp
  const isBad  = invert ? isUp : isDn
  const color = isGood ? 'text-green' : isBad ? 'text-red' : 'text-txt-3'
  const arrow = isUp ? '↑' : isDn ? '↓' : '→'
  const abs   = Math.min(Math.abs(Math.round(pct)), 999)
  return (
    <span className={`text-[10px] font-bold font-mono leading-none ${color}`}>
      {arrow}{abs}%
    </span>
  )
}

// ── quick-launch tiles ────────────────────────────────────────────────────────

function QuickLaunchTiles({
  reports,
  onLaunch,
}: {
  reports: ReportMeta[]
  onLaunch: (skill: Skill) => void
}) {
  const counts = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.skillId] = (acc[r.skillId] ?? 0) + 1
    return acc
  }, {})

  const usedTiles = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([id, count]) => ({ skill: SKILLS.find((s) => s.id === id), count }))
    .filter((t): t is { skill: Skill; count: number } => t.skill != null)
    .slice(0, 4)

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
            className="group bg-surface border border-border rounded-lg shadow-card p-4 flex flex-col gap-2 text-left hover:border-border2 hover:bg-surface2 hover:-translate-y-px hover:shadow-elevated active:scale-[0.98] transition-all duration-150 ease-out cursor-pointer w-full"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[11px] font-bold tracking-[0.14em] px-2 py-[3px] rounded flex-shrink-0"
                style={{ background: skill.badgeColor + '22', color: skill.badgeColor }}
              >
                {skill.badge}
              </span>
              {count > 0 && (
                <span className="text-[10px] text-txt-3 font-mono flex-shrink-0">
                  ×{count}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-txt group-hover:text-txt transition-colors leading-snug">
                {skill.name}
              </div>
              <div className="text-[11px] text-txt-3 mt-0.5 leading-relaxed line-clamp-2">
                {skill.tagline}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-txt-3 group-hover:text-txt transition-colors mt-auto pt-1">
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
    const weeks = 8
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return Array.from({ length: weeks }, (_, i) => {
      const weekStart = new Date(now.getTime() - (weeks - 1 - i) * 7 * 86_400_000)
      const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000)
      const lastDay = new Date(weekEnd.getTime() - 86_400_000)
      const fmt = (d: Date) => d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
      const label = weekStart.getMonth() === lastDay.getMonth()
        ? `${weekStart.toLocaleDateString('en', { month: 'short' })} ${weekStart.getDate()}–${lastDay.getDate()}`
        : `${fmt(weekStart)}–${fmt(lastDay)}`
      const count = reports.filter((r) => {
        const t = new Date(r.timestamp).getTime()
        return t >= weekStart.getTime() && t < weekEnd.getTime()
      }).length
      return { label, count }
    })
  }, [reports])

  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Report Activity · 8 Weeks</p>
      <div className="bg-surface border border-border rounded-lg shadow-card p-4">
        {reports.length === 0 ? (
          <EmptyState
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>}
            title="No activity yet"
            to="/skills"
            actionLabel="Generate a report"
          />
        ) : (
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 8, fill: 'var(--txt3)' }}
                axisLine={false}
                tickLine={false}
                interval={0}
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

// ── threat actor spotlight ────────────────────────────────────────────────────

function threatLevelStyle(level?: string) {
  if (level === 'Critical') return 'bg-red/10 text-red border-red/25'
  if (level === 'High') return 'bg-orange-400/10 text-orange-400 border-orange-400/25'
  return 'bg-amber/10 text-amber border-amber/25'
}

function ThreatActorSpotlightWidget() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { openMenu } = useContextMenu()

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
            <span className="text-[10px] text-txt-3 font-mono">· {timeAgo(spot.generated_at)}</span>
          )}
        </div>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-border hover:border-border2 text-txt-3 hover:text-txt-2 bg-transparent cursor-pointer disabled:opacity-40 transition-colors"
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
        <div className="mb-3 text-[11px] text-red bg-red/5 border border-red/20 rounded-lg px-3 py-2">
          {refresh.error instanceof Error ? refresh.error.message : 'Refresh failed'}
        </div>
      )}

      {(isLoading || refresh.isPending) && <SkeletonSpotlightCard />}

      {!isLoading && !refresh.isPending && data?.status === 'empty' && (
        <div className="bg-surface border border-border rounded-lg shadow-card p-6 flex flex-col items-center gap-3 text-center">
          <p className="text-[11px] text-txt-2">No spotlight generated yet.</p>
          <button
            onClick={() => refresh.mutate()}
            className="text-[11px] font-bold text-txt-3 hover:text-txt transition-colors bg-transparent border-none cursor-pointer"
          >
            Generate now →
          </button>
        </div>
      )}

      {!isLoading && !refresh.isPending && spot && (
        <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                <h2
                  className="text-[15px] font-semibold text-txt tracking-tight leading-none cursor-default select-text"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    openMenu(e.clientX, e.clientY, [
                      { label: 'View Actor Profile', icon: MenuIcon.Actor, action: () => navigate(`/actors?q=${encodeURIComponent(spot.actor_name)}`) },
                      { label: 'Search ATT&CK', icon: MenuIcon.Attack, action: () => navigate(`/attack?q=${encodeURIComponent(spot.actor_name)}`) },
                      { separator: true },
                      { label: 'Copy Name', icon: MenuIcon.Copy, action: () => navigator.clipboard.writeText(spot.actor_name) },
                    ])
                  }}
                >{spot.actor_name}</h2>
                {spot.threat_level && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono tracking-wider ${threatLevelStyle(spot.threat_level)}`}>
                    {spot.threat_level.toUpperCase()}
                  </span>
                )}
              </div>
              {spot.also_known_as && spot.also_known_as.length > 0 && (
                <div className="text-[10px] text-txt-3 font-mono">
                  aka {spot.also_known_as.slice(0, 4).join(' · ')}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              {spot.origin && (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-bg border border-border text-txt-3">
                  {spot.origin}
                </span>
              )}
              {spot.active_since && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg border border-border text-txt-3">
                  Since {spot.active_since}
                </span>
              )}
              {spot.motivation && (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-bg text-txt-3 border border-border">
                  {spot.motivation}
                </span>
              )}
            </div>
          </div>

          <div className="px-5 py-4 border-b border-border">
            {spot.summary && (
              <p className="text-[11px] text-txt-2 leading-relaxed mb-3">{spot.summary}</p>
            )}
            {spot.targets && spot.targets.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">Targets:</span>
                {spot.targets.map((t) => (
                  <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded bg-red/8 text-red border border-red/20">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr_1fr_2fr] divide-x divide-border">
            <div className="px-4 py-3">
              <div className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Signature Techniques</div>
              <div className="flex flex-col gap-1.5">
                {spot.signature_techniques?.map((t) => (
                  <span key={t} className="text-[10px] font-mono px-2 py-1 rounded bg-bg text-txt-3 border border-border leading-tight">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Notable Tools</div>
              <div className="flex flex-wrap gap-1.5">
                {spot.notable_tools?.map((tool) => (
                  <span key={tool} className="text-[10px] font-mono px-2 py-1 rounded bg-cyan/8 text-cyan border border-cyan/20">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Recent Activity</div>
              <p className="text-[11px] text-txt-2 leading-relaxed">{spot.recent_activity}</p>
            </div>
          </div>

          <div className="px-5 py-2 border-t border-border flex items-center">
            <span className="text-[11px] text-txt-3">Based on model training knowledge · Auto-refreshes weekly</span>
            <span className="text-[10px] text-txt-3 font-mono ml-auto">
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
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red text-white leading-none">
          {unread}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => markAllRead.mutate()}
            className="text-[11px] text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer"
          >
            Mark all read
          </button>
          <button
            onClick={() => navigate('/watchlist')}
            className="text-[11px] font-bold text-txt-3 hover:text-txt transition-colors bg-transparent border-none cursor-pointer"
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
              <div className="text-[10px] text-txt-3 font-mono truncate mt-0.5">{alert.detail}</div>
            </div>
            <span className="text-[10px] text-txt-3 font-mono flex-shrink-0">{timeAgo(alert.created_at)}</span>
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
            className="text-[11px] text-txt-3 hover:text-txt-2 transition-colors text-center bg-transparent border-none cursor-pointer py-1"
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
  const navigate = useNavigate()
  const { openMenu } = useContextMenu()

  function handleActorContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    openMenu(e.clientX, e.clientY, [
      { label: 'View Actor Profile', icon: MenuIcon.Actor, action: () => navigate(`/actors?q=${encodeURIComponent(actor.name)}`) },
      { label: 'Search ATT&CK', icon: MenuIcon.Attack, action: () => navigate(`/attack?q=${encodeURIComponent(actor.name)}`) },
      { separator: true },
      { label: 'Copy Name', icon: MenuIcon.Copy, action: () => navigator.clipboard.writeText(actor.name) },
    ])
  }

  return (
    <div className="border border-border rounded-lg p-3 flex flex-col gap-2 bg-bg">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className="text-[11px] font-bold text-txt font-mono leading-tight cursor-default select-text"
            onContextMenu={handleActorContextMenu}
          >{actor.name}</div>
          {actor.aliases?.length > 0 && (
            <div className="text-[10px] text-txt-3 font-mono mt-0.5 truncate">
              {actor.aliases.slice(0, 3).join(' · ')}
            </div>
          )}
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3 flex-shrink-0 font-mono">
          {actor.origin}
        </span>
      </div>
      <p className="text-[11px] text-txt-2 leading-relaxed">{actor.targeting}</p>
      {actor.ttps?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {actor.ttps.slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg text-txt-3 border border-border">
              {t}
            </span>
          ))}
          {actor.ttps.length > 4 && (
            <span className="text-[10px] text-txt-3 font-mono px-1 py-0.5">+{actor.ttps.length - 4}</span>
          )}
        </div>
      )}
      {actor.recent_activity && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-left text-[11px] text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer p-0"
        >
          {expanded ? '▲ Hide activity' : '▼ Recent activity'}
        </button>
      )}
      {expanded && (
        <p className="text-[11px] text-txt-2 leading-relaxed border-t border-border pt-2">
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
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface border border-border text-txt-3 flex-shrink-0">
          {incident.date}
        </span>
        {incident.threat_actor && (
          <span className="text-[10px] text-txt-2 font-mono truncate">{incident.threat_actor}</span>
        )}
      </div>
      <div className="text-[11px] font-bold text-txt leading-tight">{incident.title}</div>
      <p className="text-[11px] text-txt-2 leading-relaxed">{incident.summary}</p>
    </div>
  )
}

function CVECard({ cve }: { cve: ThreatCVE }) {
  const navigate = useNavigate()
  const { openMenu } = useContextMenu()

  function handleCVEContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    openMenu(e.clientX, e.clientY, [
      { label: 'Search CVE', icon: MenuIcon.Enrich, action: () => navigate(`/cve-search?q=${encodeURIComponent(cve.cve_id)}`) },
      { label: 'Generate Advisory', icon: MenuIcon.Advisory, action: () => navigate(`/cve-search?q=${encodeURIComponent(cve.cve_id)}&advisory=1`) },
      { separator: true },
      { label: 'Copy CVE ID', icon: MenuIcon.Copy, action: () => navigator.clipboard.writeText(cve.cve_id) },
    ])
  }

  return (
    <div className="border border-border rounded-lg p-3 flex flex-col gap-1.5 bg-bg">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[10px] font-bold font-mono text-txt cursor-default select-text"
          onContextMenu={handleCVEContextMenu}
        >{cve.cve_id}</span>
        {cve.cvss > 0 && (
          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${cvssColor(cve.cvss)}`}>
            {cve.cvss.toFixed(1)}
          </span>
        )}
        {cve.actively_exploited && (
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-red/10 text-red border border-red/20">
            EXPLOITED
          </span>
        )}
      </div>
      <div className="text-[10px] text-txt-3 font-mono">{cve.product}</div>
      <p className="text-[11px] text-txt-2 leading-relaxed">{cve.description}</p>
    </div>
  )
}

// ── threat pulse widget ───────────────────────────────────────────────────────

function ThreatPulseWidget() {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)

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
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-bg text-txt-3 border border-border">
              {pulse.geography}
            </span>
          )}
          {pulse?.generated_at && (
            <span className="text-[10px] text-txt-3 font-mono">· {timeAgo(pulse.generated_at)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pulse && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-border hover:border-border2 text-txt-3 hover:text-txt-2 bg-transparent cursor-pointer transition-colors"
            >
              {expanded ? (
                <>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                  Collapse
                </>
              ) : (
                <>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  Expand
                </>
              )}
            </button>
          )}
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending || noGeography}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-border hover:border-border2 text-txt-3 hover:text-txt-2 bg-transparent cursor-pointer disabled:opacity-40 transition-colors"
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

      {(refresh.isPending || (isLoading && !refresh.isPending)) && <SkeletonPulseCard />}

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
            className="text-[11px] font-bold text-txt-3 hover:text-txt transition-colors bg-transparent border-none cursor-pointer"
          >
            Generate now →
          </button>
        </div>
      )}

      {/* Compact summary — shown when pulse is ready and not expanded */}
      {!refresh.isPending && pulse && !expanded && (
        <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
          {pulse.summary && (
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[11px] text-txt-2 leading-relaxed italic">{pulse.summary}</p>
            </div>
          )}
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            {(pulse.threat_actors?.length ?? 0) > 0 && (
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-red/8 text-red border border-red/20">
                {pulse.threat_actors!.length} Threat Actor{pulse.threat_actors!.length !== 1 ? 's' : ''}
              </span>
            )}
            {(pulse.recent_incidents?.length ?? 0) > 0 && (
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-amber/8 text-amber border border-amber/20">
                {pulse.recent_incidents!.length} Incident{pulse.recent_incidents!.length !== 1 ? 's' : ''}
              </span>
            )}
            {(pulse.relevant_cves?.length ?? 0) > 0 && (
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-surface2 text-txt-2 border border-border">
                {pulse.relevant_cves!.length} CVE{pulse.relevant_cves!.length !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={() => setExpanded(true)}
              className="ml-auto text-[11px] font-bold text-txt-3 hover:text-txt transition-colors bg-transparent border-none cursor-pointer"
            >
              View full pulse →
            </button>
          </div>
        </div>
      )}

      {/* Full detail — shown when expanded */}
      {!refresh.isPending && pulse && expanded && (
        <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
          {pulse.summary && (
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[11px] text-txt-2 leading-relaxed italic">{pulse.summary}</p>
            </div>
          )}

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
                <div className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">CVE Risk Profile</div>
                <div className="flex flex-col gap-1.5">
                  {buckets.map(b => (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-txt-3 w-12 flex-shrink-0">{b.label}</span>
                      <div className="flex-1 h-[5px] bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(b.count / max) * 100}%`, background: b.color, opacity: 0.8 }}
                        />
                      </div>
                      <span className="text-[10px] font-bold font-mono w-3 text-right flex-shrink-0" style={{ color: b.color }}>
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
                <span className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">Threat Actors</span>
                <span className="text-[10px] text-txt-3 font-mono ml-auto">{pulse.threat_actors?.length ?? 0}</span>
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
                <span className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">Recent Incidents</span>
                <span className="text-[10px] text-txt-3 font-mono ml-auto">{pulse.recent_incidents?.length ?? 0}</span>
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
                <span className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">Relevant CVEs</span>
                <span className="text-[10px] text-txt-3 font-mono ml-auto">{pulse.relevant_cves?.length ?? 0}</span>
              </div>
              <div className="flex flex-col gap-2 p-3 overflow-y-auto" style={{ maxHeight: '340px' }}>
                {pulse.relevant_cves?.map((c) => <CVECard key={c.cve_id} cve={c} />)}
              </div>
            </div>
          </div>
          <div className="px-4 py-2 border-t border-border flex items-center">
            <span className="text-[10px] text-txt-3 font-mono">
              Based on model training knowledge · Auto-refreshes weekly
            </span>
            <span className="text-[10px] text-txt-3 font-mono ml-auto">
              {pulse.generated_at && new Date(pulse.generated_at).toLocaleDateString([], { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── misp events widget ────────────────────────────────────────────────────────

function threatDot(level: string) {
  if (level === 'high') return '#ef4444'
  if (level === 'medium') return '#f59e0b'
  if (level === 'low') return '#22c55e'
  return '#6b7280'
}

function MispEventsWidget() {
  const navigate = useNavigate()

  const { data: status } = useQuery({
    queryKey: ['misp-status'],
    queryFn: api.getMispStatus,
    staleTime: 60_000,
    retry: false,
  })

  const { data } = useQuery({
    queryKey: ['misp-events-dashboard'],
    queryFn: () => api.getMispEvents(5, 1),
    staleTime: 60_000,
    retry: false,
    enabled: status?.status === 'ok',
  })

  const events = data?.events ?? []
  if (status?.status !== 'ok' || events.length === 0) return null

  return (
    <div className="mb-6 animate-cardEnter">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">MISP Events</p>
        <button
          type="button"
          onClick={() => navigate('/misp')}
          className="text-[11px] font-bold text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer"
        >
          View all →
        </button>
      </div>
      <div className="bg-surface border border-border rounded-lg shadow-card divide-y divide-border/50">
        {events.map((ev: MispEvent) => (
          <button
            key={String(ev.id)}
            type="button"
            onClick={() => navigate('/misp')}
            className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-bg/60 transition-colors bg-transparent border-none cursor-pointer"
          >
            <span
              className="flex-shrink-0 w-[7px] h-[7px] rounded-full"
              style={{ background: threatDot(ev.threat_level) }}
            />
            <span className="flex-1 min-w-0 text-[11px] font-bold text-txt truncate">{ev.info}</span>
            {ev.org && (
              <span className="text-[10px] text-txt-3 flex-shrink-0 hidden sm:block">{ev.org}</span>
            )}
            <span className="text-[10px] font-mono text-txt-3 flex-shrink-0">{ev.date}</span>
            <span className="text-[10px] font-mono text-txt-3 flex-shrink-0">{ev.attribute_count} attr</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── AU ransomware victims widget ──────────────────────────────────────────────

interface AUVictim {
  post_title?: string
  website?: string
  group_name?: string
  activity?: string
  discovered?: string
}

function AURansomwareWidget() {
  const navigate = useNavigate()

  const { data, isLoading, isError, error } = useQuery<AUVictim[]>({
    queryKey: ['rl-au-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/ransomware-live/countryvictims/AU')
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(body.detail ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      return (Array.isArray(json) ? json : []) as AUVictim[]
    },
    staleTime: 65_000,
    retry: false,
  })

  const victims = data?.slice(0, 5) ?? []

  return (
    <div className="mb-6 animate-cardEnter">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">
            🇦🇺 Recent AU Victims
          </p>
          <span className="text-[10px] font-mono text-txt-3">· ransomware</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/ransomware')}
          className="text-[11px] font-bold text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer"
        >
          View all →
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
        {isLoading && (
          <div className="divide-y divide-border/50">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonTableRow key={i} />)}
          </div>
        )}

        {isError && (
          <div className="px-4 py-5 text-center">
            <p className="text-[11px] text-txt-3">
              {/failed to fetch|networkerror|load failed/i.test((error as Error)?.message ?? '')
                ? 'Backend offline — start the SkillCTI server to see AU ransomware victims.'
                : `Could not load data: ${(error as Error)?.message}`}
            </p>
          </div>
        )}

        {!isLoading && !isError && victims.length === 0 && (
          <div className="px-4 py-5 text-center">
            <p className="text-[11px] text-txt-3">No Australian victims found in the dataset.</p>
          </div>
        )}

        {victims.length > 0 && (
          <div className="divide-y divide-border/50">
            {victims.map((v, i) => (
              <button
                key={i}
                type="button"
                onClick={() => navigate('/ransomware')}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-bg/60 transition-colors bg-transparent border-none cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-txt truncate block">
                    {v.post_title || v.website || '(unnamed)'}
                  </span>
                  {v.website && v.post_title && (
                    <span className="text-[10px] font-mono text-txt-3 truncate block mt-0.5">{v.website}</span>
                  )}
                </div>
                {v.group_name && (
                  <span
                    className="flex-shrink-0 text-[10px] font-bold tracking-[0.06em] px-1.5 py-[3px] rounded leading-none whitespace-nowrap"
                    style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}
                  >
                    {v.group_name}
                  </span>
                )}
                {v.activity && v.activity !== 'Not Found' && (
                  <span className="flex-shrink-0 hidden sm:block text-[10px] font-bold px-1.5 py-[3px] rounded bg-cyan/10 text-cyan border border-cyan/20 leading-none whitespace-nowrap">
                    {v.activity}
                  </span>
                )}
                <span className="text-[10px] font-mono text-txt-3 flex-shrink-0">
                  {v.discovered?.slice(0, 10) ?? '—'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [viewing, setViewing] = useState<{ html: string; reportId: string } | null>(null)
  const [loadingReport, setLoadingReport] = useState<string | null>(null)
  const [drawerSkill, setDrawerSkill] = useState<Skill | null>(null)

  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: api.listReports,
  })

  const { data: alertsData } = useQuery({
    queryKey: ['alerts-dashboard'],
    queryFn: () => api.getAlerts(true),
    refetchInterval: 30_000,
    retry: false,
  })

  const { data: spend } = useQuery({
    queryKey: ['spend-summary'],
    queryFn: api.spendSummary,
    refetchInterval: 60_000,
  })

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 10_000,
    retry: false,
  })

  const reports = reportsData?.reports ?? []
  const recentReports = reports.slice(0, 8)
  const unreadAlerts = alertsData?.unread_count ?? 0

  // ── Sparkline data ───────────────────────────────────────────────────────────
  const reportItems = useMemo(
    () => reports.map((r) => ({ timestamp: r.timestamp })),
    [reports],
  )
  const alertItems = useMemo(
    () => (alertsData?.alerts ?? []).map((a: WatchAlert) => ({ timestamp: a.created_at })),
    [alertsData],
  )

  const reportSpark7  = useMemo(() => buildDailyCounts(reportItems, 7),  [reportItems])
  const alertSpark7   = useMemo(() => buildDailyCounts(alertItems, 7),   [alertItems])
  const spendSpark7   = useMemo(() => buildDailySpend(reports, 7),       [reports])

  const report14 = useMemo(() => buildDailyCounts(reportItems, 14), [reportItems])
  const alert14  = useMemo(() => buildDailyCounts(alertItems, 14),  [alertItems])
  const spend14  = useMemo(() => buildDailySpend(reports, 14),      [reports])

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
      {/* Stat row */}
      <div className="flex gap-3 mb-6 animate-cardEnter" style={{ animationDelay: '0ms' }}>
        {reportsLoading ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          <>
            {/* Reports Generated */}
            <div className="bg-surface border border-border rounded-lg shadow-card px-4 py-3 flex-shrink-0 flex items-center gap-4 min-w-[156px]">
              <div className="min-w-0">
                <div className="text-[20px] font-bold text-txt leading-none">{reports.length}</div>
                <div className="text-[11px] text-txt-3 uppercase tracking-[0.1em] mt-1">Reports Generated</div>
              </div>
              <Sparkline values={reportSpark7} color="#a855f7" gradId="spark-reports" />
            </div>

            {/* Unread Alerts */}
            <div className="bg-surface border border-border rounded-lg shadow-card px-4 py-3 flex-shrink-0 flex items-center gap-4 min-w-[156px]">
              <div className="min-w-0">
                <div className={`text-[20px] font-bold leading-none ${unreadAlerts > 0 ? 'text-red' : 'text-txt'}`}>
                  {unreadAlerts}
                </div>
                <div className="text-[11px] text-txt-3 uppercase tracking-[0.1em] mt-1">Unread Alerts</div>
              </div>
              <Sparkline values={alertSpark7} color="#ef4444" gradId="spark-alerts" />
            </div>

            {/* Total API Spend */}
            <div
              className="bg-surface border border-border rounded-lg shadow-card px-4 py-3 flex-shrink-0 flex items-center gap-4 min-w-[156px] cursor-default"
              title={spend ? `Reports: $${spend.reports_total.toFixed(4)}${spend.activity_total > 0 ? ` · Activity: $${spend.activity_total.toFixed(4)}` + (Object.entries(spend.activity_by_source).map(([k, v]) => ` (${k}: $${v.toFixed(4)})`).join('')) : ''}` : ''}
            >
              <div className="min-w-0">
                <div className="text-[20px] font-bold text-txt leading-none">
                  ${spend ? spend.grand_total.toFixed(2) : reports.reduce((s, r) => s + (r.cost_usd ?? 0), 0).toFixed(2)}
                </div>
                <div className="text-[11px] text-txt-3 uppercase tracking-[0.1em] mt-1">Total API Spend</div>
                {spend && spend.activity_total > 0 && (
                  <div className="text-[10px] text-txt-3 mt-0.5 font-mono">
                    <span className="text-green/60">${spend.reports_total.toFixed(2)}</span>
                    <span className="opacity-40 mx-1">+</span>
                    <span className="text-green/60">${spend.activity_total.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <Sparkline values={spendSpark7} color="#22c55e" gradId="spark-spend" />
            </div>

            {/* Backend Status — binary, no sparkline */}
            <div className="bg-surface border border-border rounded-lg shadow-card px-4 py-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className={['text-[20px] font-bold leading-none', health?.ok ? 'text-green' : 'text-red'].join(' ')}>
                  {health?.ok ? 'Online' : 'Offline'}
                </div>
                {health?.ok && (
                  <span
                    className="w-2 h-2 rounded-full bg-green flex-shrink-0"
                    style={{ boxShadow: '0 0 0 3px rgba(34,197,94,0.15)' }}
                  />
                )}
              </div>
              <div className="text-[11px] text-txt-3 uppercase tracking-[0.1em] mt-1">Backend Status</div>
            </div>
          </>
        )}
      </div>

      {/* Active alerts — only renders when there are unread alerts */}
      <AlertsWidget />

      {/* Quick launch + recent reports */}
      <div className="grid grid-cols-[3fr_3fr] gap-4 mb-6 animate-cardEnter" style={{ animationDelay: '50ms' }}>
        {reportsLoading ? (
          <>
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Quick Launch</p>
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => <SkeletonLaunchTile key={i} />)}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Recent Reports</p>
              <div className="bg-surface border border-border rounded-lg shadow-card p-2 flex flex-col">
                {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonReportRow key={i} />)}
              </div>
            </div>
          </>
        ) : (
          <>
            <QuickLaunchTiles reports={reports} onLaunch={setDrawerSkill} />
            <div className="flex flex-col">
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Recent Reports</p>
              {recentReports.length === 0 ? (
                <div className="bg-surface border border-border rounded-lg shadow-card flex-1 flex items-center justify-center">
                  <EmptyState
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                    title="No reports yet"
                    to="/skills"
                    actionLabel="Generate your first"
                  />
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
                        className="text-[11px] font-bold tracking-[0.1em] px-1.5 py-[2px] rounded flex-shrink-0"
                        style={{ background: r.badgeColor + '22', color: r.badgeColor }}
                      >
                        {r.badge}
                      </span>
                      <span className="text-[11px] text-txt truncate flex-1 group-hover:text-txt transition-colors">
                        {loadingReport === r.id ? 'Loading…' : r.title}
                      </span>
                      <span className="text-[10px] text-txt-3 font-mono flex-shrink-0">{timeAgo(r.timestamp)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* AU Ransomware Victims — only renders when backend is live */}
      <AURansomwareWidget />

      {/* Threat intelligence — pulse and spotlight */}
      <div className="animate-cardEnter" style={{ animationDelay: '100ms' }}>
        <ThreatPulseWidget />
        <ThreatActorSpotlightWidget />
      </div>

      {/* Recent news */}
      <div className="animate-cardEnter" style={{ animationDelay: '150ms' }}>
        <NewsWidget />
      </div>

      {/* MISP Events — only renders when connected and has events */}
      <MispEventsWidget />

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
