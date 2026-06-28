import { useState, useEffect, useRef } from 'react'
import { toast } from '../lib/useToast'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { SKILLS } from '../lib/skills'
import { submitBackgroundJob } from '../lib/generate'
import type {
  AttackGroup,
  AttackGroupDetail,
  TacticCoverage,
  GroupTechnique,
  RansomwareActorSummary,
  RansomwareActorDetail,
  RansomwareStatus,
  ThreatLevel,
  Job,
} from '../lib/types'

// ── constants ─────────────────────────────────────────────────────────────────

const TACTIC_COLOR: Record<string, string> = {
  'reconnaissance':       '#6366f1',
  'resource-development': '#8b5cf6',
  'initial-access':       '#ef4444',
  'execution':            '#f97316',
  'persistence':          '#f59e0b',
  'privilege-escalation': '#eab308',
  'defense-evasion':      '#84cc16',
  'credential-access':    '#22c55e',
  'discovery':            '#14b8a6',
  'lateral-movement':     '#06b6d4',
  'collection':           '#3b82f6',
  'command-and-control':  '#a855f7',
  'exfiltration':         '#ec4899',
  'impact':               '#ef4444',
}

function tacticColor(shortname: string) {
  return TACTIC_COLOR[shortname] ?? '#6b7280'
}

function cleanDesc(text: string, maxLen = 500): string {
  return text
    .replace(/\(Citation:[^)]+\)/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen)
}

// ── status / threat-level badges ──────────────────────────────────────────────

const STATUS_STYLE: Record<RansomwareStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: '#22c55e', bg: '#22c55e18' },
  disrupted: { label: 'Disrupted', color: '#f59e0b', bg: '#f59e0b18' },
  inactive:  { label: 'Inactive',  color: '#6b7280', bg: '#6b728018' },
  unknown:   { label: 'Unknown',   color: '#6b7280', bg: '#6b728018' },
}

const THREAT_STYLE: Record<ThreatLevel, { color: string; bg: string }> = {
  Critical: { color: '#ef4444', bg: '#ef444418' },
  High:     { color: '#f97316', bg: '#f9731618' },
  Medium:   { color: '#f59e0b', bg: '#f59e0b18' },
}

function StatusBadge({ status }: { status: RansomwareStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.unknown
  return (
    <span
      className="text-[11px] font-bold px-1.5 py-[3px] rounded leading-none"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}35` }}
    >
      {s.label}
    </span>
  )
}

function ThreatBadge({ level }: { level: ThreatLevel }) {
  const s = THREAT_STYLE[level]
  return (
    <span
      className="text-[11px] font-bold px-1.5 py-[3px] rounded leading-none"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}35` }}
    >
      {level}
    </span>
  )
}

// ── shared: tactic coverage pills ────────────────────────────────────────────

function TacticCoverageBar({ coverage }: { coverage: TacticCoverage[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {coverage.map((tac) => {
        const color = tacticColor(tac.shortname)
        return (
          <div
            key={tac.shortname}
            className="flex items-center gap-1.5 px-2 py-[5px] rounded text-[11px] font-bold leading-none"
            style={{ background: `${color}18`, border: `1px solid ${color}35`, color }}
          >
            <span>{tac.name}</span>
            <span
              className="font-mono text-[10px] px-1 py-[1px] rounded leading-none"
              style={{ background: `${color}25` }}
            >
              {tac.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── shared: technique row ─────────────────────────────────────────────────────

function TechRow({ tech }: { tech: GroupTechnique }) {
  const color = tacticColor(tech.tactic_shortnames[0] ?? '')
  return (
    <Link
      to={`/attack?t=${tech.attack_id}`}
      className="flex items-center gap-3 py-[7px] px-3 rounded hover:bg-purple/[0.05] transition-colors group"
    >
      <span className="text-[10px] font-bold font-mono w-[68px] flex-shrink-0 leading-none" style={{ color }}>
        {tech.attack_id}
      </span>
      <span className="text-[11px] text-txt group-hover:text-purple transition-colors truncate flex-1">
        {tech.name}
      </span>
      {tech.is_subtechnique && (
        <span className="text-[10px] text-txt-3 font-mono flex-shrink-0">sub</span>
      )}
    </Link>
  )
}

// ── shared: techniques grouped by tactic ─────────────────────────────────────

function TechniquesByTactic({
  techniques,
  tactic_coverage,
}: {
  techniques: GroupTechnique[]
  tactic_coverage: TacticCoverage[]
}) {
  const [expandedTactics, setExpandedTactics] = useState<Set<string>>(
    () => new Set(tactic_coverage.map((t) => t.shortname))
  )

  useEffect(() => {
    setExpandedTactics(new Set(tactic_coverage.map((t) => t.shortname)))
  }, [tactic_coverage.map((t) => t.shortname).join(',')])

  const byTactic = tactic_coverage.map((tac) => ({
    ...tac,
    techniques: techniques.filter((t) => t.tactic_shortnames.includes(tac.shortname)),
  }))
  const uncategorized = techniques.filter((t) => t.tactic_shortnames.length === 0)
  const allExpanded = expandedTactics.size === tactic_coverage.length

  function toggle(sn: string) {
    setExpandedTactics((prev) => {
      const next = new Set(prev)
      if (next.has(sn)) next.delete(sn)
      else next.add(sn)
      return next
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">ATT&CK Techniques</p>
        <button
          onClick={() =>
            allExpanded
              ? setExpandedTactics(new Set())
              : setExpandedTactics(new Set(tactic_coverage.map((t) => t.shortname)))
          }
          className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer p-0"
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {byTactic.map((tac) => {
          const color = tacticColor(tac.shortname)
          const expanded = expandedTactics.has(tac.shortname)
          return (
            <div key={tac.shortname} className="rounded-lg border border-border/60 overflow-hidden">
              <button
                onClick={() => toggle(tac.shortname)}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-transparent border-none cursor-pointer hover:bg-bg/50 transition-colors"
              >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-[11px] font-bold flex-1 text-left" style={{ color }}>
                  {tac.name}
                </span>
                <span className="text-[10px] font-mono text-txt-3">{tac.techniques.length}</span>
                <svg
                  width="9" height="9" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  className={['text-txt-3 transition-transform flex-shrink-0', expanded ? 'rotate-180' : ''].join(' ')}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {expanded && (
                <div className="border-t border-border/40 py-1 px-1">
                  {tac.techniques.map((tech) => <TechRow key={tech.attack_id} tech={tech} />)}
                </div>
              )}
            </div>
          )
        })}
        {uncategorized.length > 0 && (
          <div className="flex flex-col gap-0.5 px-1 mt-1">
            {uncategorized.map((tech) => <TechRow key={tech.attack_id} tech={tech} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── generate detections button ───────────────────────────────────────────────

const DETECTION_SKILL = SKILLS.find(s => s.id === 'detection-as-code')!

function GenerateDetectionsButton({
  actorName,
  techniques,
}: {
  actorName: string
  techniques: Array<{ attack_id: string }>
}) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId || job?.status === 'done' || job?.status === 'error') return
    intervalRef.current = setInterval(async () => {
      try {
        const updated = await api.getJob(jobId)
        setJob(updated)
        if (updated.status === 'done' || updated.status === 'error') {
          clearInterval(intervalRef.current!)
        }
      } catch { /* transient */ }
    }, 2000)
    return () => clearInterval(intervalRef.current!)
  }, [jobId, job?.status])

  // Reset when actor changes
  useEffect(() => {
    setJobId(null)
    setJob(null)
    setErr(null)
    setSubmitting(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [actorName])

  async function launch() {
    if (!techniques.length || !DETECTION_SKILL) return
    setSubmitting(true)
    setErr(null)
    try {
      const ttpList = techniques.map(t => t.attack_id).join(', ')
      const userMessage = `Actor: ${actorName}\nTTPs: ${ttpList}\n\nPrimary SIEM/EDR: Microsoft Sentinel`
      const { job_id } = await submitBackgroundJob({
        skill: DETECTION_SKILL,
        format: 'html',
        userMessage,
      })
      setJobId(job_id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start job'
      setErr(msg)
      toast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const status = job?.status

  if (status === 'done' && job?.result_report_id) {
    return (
      <Link
        to={`/reports/${job.result_report_id}`}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
        style={{ background: '#06b6d418', color: '#06b6d4', border: '1px solid #06b6d435' }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        View Detections
      </Link>
    )
  }

  if (status === 'pending' || status === 'running') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
        style={{ background: '#06b6d410', color: '#06b6d4', border: '1px solid #06b6d425' }}>
        <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="truncate max-w-[120px]">{job?.progress || 'Queued...'}</span>
      </div>
    )
  }

  if (err || status === 'error') {
    return (
      <button
        onClick={launch}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border transition-colors hover:opacity-80"
        style={{ background: '#ef444418', color: '#ef4444', borderColor: '#ef444435' }}
        title={err ?? 'Job failed'}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Retry Detections
      </button>
    )
  }

  return (
    <button
      onClick={launch}
      disabled={submitting || !techniques.length}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border transition-colors hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: '#06b6d418', color: '#06b6d4', borderColor: '#06b6d435' }}
    >
      {submitting ? (
        <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
      ) : (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )}
      {submitting ? 'Starting...' : 'Generate Detections'}
    </button>
  )
}

// ── APT group profile (MITRE ATT&CK source) ──────────────────────────────────

function AptProfile({ attackId }: { attackId: string }) {
  const [showFullDesc, setShowFullDesc] = useState(false)

  const { data: group, isLoading, isError } = useQuery<AttackGroupDetail>({
    queryKey: ['attack-group-detail', attackId],
    queryFn: () => api.getAttackGroupDetail(attackId),
    staleTime: 10 * 60_000,
  })

  useEffect(() => { setShowFullDesc(false) }, [attackId])

  if (isLoading) return <ProfileLoading />
  if (isError || !group) return <ProfileError />

  const desc = group.description ? cleanDesc(group.description, showFullDesc ? 4000 : 480) : ''
  const mitreUrl = `https://attack.mitre.org/groups/${group.attack_id}/`

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5 border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-bold font-mono text-purple">{group.attack_id}</span>
              <span className="text-[11px] font-bold px-1.5 py-[3px] rounded leading-none bg-purple/10 text-purple border border-purple/20">
                MITRE ATT&CK
              </span>
              <span className="text-[10px] text-txt-3 font-mono">{group.technique_count} techniques</span>
            </div>
            <h2 className="text-[20px] font-bold text-txt leading-tight mb-3">{group.name}</h2>
            {group.aliases.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {group.aliases.map((a) => (
                  <span key={a} className="text-[10px] font-mono px-2 py-[3px] rounded-full bg-purple/10 text-purple border border-purple/20">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <a href={mitreUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-bold font-mono text-purple hover:underline">
              MITRE ATT&CK
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
            <GenerateDetectionsButton actorName={group.name} techniques={group.techniques} />
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-6">
        {group.description && (
          <div>
            <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Overview</p>
            <p className="text-[11px] text-txt-2 leading-relaxed">{desc}</p>
            {(group.description?.length ?? 0) > 480 && (
              <button onClick={() => setShowFullDesc((v) => !v)}
                className="text-[11px] text-txt-3 hover:text-txt-2 hover:underline bg-transparent border-none cursor-pointer p-0 mt-1.5">
                {showFullDesc ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
        {group.tactic_coverage.length > 0 && (
          <div>
            <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Kill-Chain Coverage</p>
            <TacticCoverageBar coverage={group.tactic_coverage} />
          </div>
        )}
        {group.tactic_coverage.length > 0 && (
          <TechniquesByTactic techniques={group.techniques} tactic_coverage={group.tactic_coverage} />
        )}
      </div>
    </div>
  )
}

// ── Ransomware actor profile ──────────────────────────────────────────────────

function RansomwareProfile({ slug }: { slug: string }) {
  const [showFullDesc, setShowFullDesc] = useState(false)

  const { data: actor, isLoading, isError } = useQuery<RansomwareActorDetail>({
    queryKey: ['ransomware-actor', slug],
    queryFn: () => api.getRansomwareActor(slug),
    staleTime: 60 * 60_000,
  })

  useEffect(() => { setShowFullDesc(false) }, [slug])

  if (isLoading) return <ProfileLoading />
  if (isError || !actor) return <ProfileError />

  const desc = cleanDesc(actor.description, showFullDesc ? 4000 : 480)

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className="text-[11px] font-bold px-1.5 py-[3px] rounded leading-none"
                style={{ color: '#f97316', background: '#f9731618', border: '1px solid #f9731635' }}
              >
                Ransomware
              </span>
              <StatusBadge status={actor.status} />
              <ThreatBadge level={actor.threat_level} />
              <span className="text-[10px] text-txt-3 font-mono">{actor.technique_count} techniques</span>
            </div>
            <h2 className="text-[20px] font-bold text-txt leading-tight mb-3">{actor.name}</h2>
            {actor.aliases.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {actor.aliases.map((a) => (
                  <span key={a} className="text-[10px] font-mono px-2 py-[3px] rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            {actor.references.length > 0 && (
              <a href={actor.references[0]} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold font-mono text-purple hover:underline">
                Advisory
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )}
            <GenerateDetectionsButton actorName={actor.name} techniques={actor.techniques} />
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-6">

        {/* Key metadata */}
        <div className="grid grid-cols-2 gap-3">
          <MetaCell label="Origin" value={actor.origin} />
          <MetaCell label="Active Since" value={actor.first_seen} />
          <MetaCell label="Encryptor" value={actor.ransomware_family} colSpan />
        </div>

        {/* Description */}
        <div>
          <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Overview</p>
          <p className="text-[11px] text-txt-2 leading-relaxed">{desc}</p>
          {actor.description.length > 480 && (
            <button onClick={() => setShowFullDesc((v) => !v)}
              className="text-[11px] text-txt-3 hover:text-txt-2 hover:underline bg-transparent border-none cursor-pointer p-0 mt-1.5">
              {showFullDesc ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Extortion methods */}
        <div>
          <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Extortion Methods</p>
          <div className="flex flex-wrap gap-1.5">
            {actor.extortion_methods.map((m) => (
              <span key={m} className="text-[11px] px-2 py-[4px] rounded bg-red/10 text-red border border-red/20 font-medium">
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Target sectors + regions */}
        <div className="grid grid-cols-2 gap-4">
          {actor.target_sectors.length > 0 && (
            <div>
              <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Target Sectors</p>
              <div className="flex flex-col gap-1">
                {actor.target_sectors.map((s) => (
                  <span key={s} className="text-[11px] text-txt-2 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-txt-3 flex-shrink-0" />
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {actor.target_regions.length > 0 && (
            <div>
              <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Target Regions</p>
              <div className="flex flex-col gap-1">
                {actor.target_regions.map((r) => (
                  <span key={r} className="text-[11px] text-txt-2 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-txt-3 flex-shrink-0" />
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notable tools */}
        {actor.notable_tools.length > 0 && (
          <div>
            <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Notable Tools</p>
            <div className="flex flex-wrap gap-1.5">
              {actor.notable_tools.map((t) => (
                <span key={t} className="text-[10px] font-mono px-2 py-[3px] rounded bg-bg border border-border text-txt-2">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notable campaigns */}
        {actor.notable_campaigns.length > 0 && (
          <div>
            <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Notable Campaigns</p>
            <div className="flex flex-col gap-1.5">
              {actor.notable_campaigns.map((c) => (
                <div key={c} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-orange-400 flex-shrink-0 mt-[6px]" />
                  <span className="text-[11px] text-txt-2 leading-relaxed">{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kill-chain coverage */}
        {actor.tactic_coverage.length > 0 && (
          <div>
            <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Kill-Chain Coverage</p>
            <TacticCoverageBar coverage={actor.tactic_coverage} />
          </div>
        )}

        {/* Techniques */}
        {actor.tactic_coverage.length > 0 && (
          <TechniquesByTactic techniques={actor.techniques} tactic_coverage={actor.tactic_coverage} />
        )}

        {/* Additional references */}
        {actor.references.length > 1 && (
          <div>
            <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">References</p>
            <div className="flex flex-col gap-1">
              {actor.references.map((ref) => (
                <a key={ref} href={ref} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] font-mono text-purple hover:underline truncate">
                  {ref}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetaCell({ label, value, colSpan }: { label: string; value: string; colSpan?: boolean }) {
  return (
    <div className={colSpan ? 'col-span-2' : ''}>
      <p className="text-[11px] font-bold tracking-[0.1em] text-txt-3 uppercase mb-1">{label}</p>
      <p className="text-[11px] text-txt font-medium">{value || 'Unknown'}</p>
    </div>
  )
}

// ── shared profile loading / error ────────────────────────────────────────────

function ProfileLoading() {
  return (
    <div className="flex items-center justify-center h-full gap-2 text-txt-3 text-[11px]">
      <div className="w-3 h-3 border border-purple border-t-transparent rounded-full animate-spin" />
      Loading profile...
    </div>
  )
}

function ProfileError() {
  return (
    <div className="flex items-center justify-center h-full text-[11px] text-txt-3">
      Failed to load profile
    </div>
  )
}

// ── list items ────────────────────────────────────────────────────────────────

function AptListItem({ group, selected, onClick }: { group: AttackGroup; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3 border-b border-border/40 transition-colors cursor-pointer bg-transparent border-none',
        selected ? 'bg-purple/[0.07]' : 'hover:bg-bg/60',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[10px] font-bold font-mono text-purple flex-shrink-0">{group.attack_id}</span>
        <span className={['text-[11px] font-bold truncate flex-1', selected ? 'text-purple' : 'text-txt'].join(' ')}>
          {group.name}
        </span>
      </div>
      {group.aliases.length > 0 && (
        <p className="text-[11px] text-txt-3 truncate pl-[2px]">
          {group.aliases.slice(0, 3).join(' · ')}
          {group.aliases.length > 3 ? ` +${group.aliases.length - 3}` : ''}
        </p>
      )}
    </button>
  )
}

function RansomListItem({
  actor,
  selected,
  onClick,
}: {
  actor: RansomwareActorSummary
  selected: boolean
  onClick: () => void
}) {
  const statusStyle = STATUS_STYLE[actor.status] ?? STATUS_STYLE.unknown
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3 border-b border-border/40 transition-colors cursor-pointer bg-transparent border-none',
        selected ? 'bg-orange-500/[0.06]' : 'hover:bg-bg/60',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className={['text-[11px] font-bold truncate flex-1', selected ? 'text-orange-400' : 'text-txt'].join(' ')}
        >
          {actor.name}
        </span>
        <span
          className="text-[11px] font-bold px-1 py-[2px] rounded flex-shrink-0 leading-none"
          style={{ color: statusStyle.color, background: statusStyle.bg }}
        >
          {statusStyle.label}
        </span>
      </div>
      {actor.aliases.length > 0 && (
        <p className="text-[11px] text-txt-3 truncate">
          {actor.aliases.slice(0, 2).join(' · ')}
          {actor.aliases.length > 2 ? ` +${actor.aliases.length - 2}` : ''}
        </p>
      )}
    </button>
  )
}

// ── source filter tabs ────────────────────────────────────────────────────────

type SourceFilter = 'all' | 'apt' | 'ransomware'

function FilterTabs({ value, onChange }: { value: SourceFilter; onChange: (v: SourceFilter) => void }) {
  const tabs: { id: SourceFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'apt', label: 'APT' },
    { id: 'ransomware', label: 'Ransomware' },
  ]
  return (
    <div className="flex gap-1 p-1 bg-bg rounded-lg border border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            'flex-1 text-[11px] font-bold py-1.5 rounded-md transition-colors cursor-pointer border-none',
            value === t.id
              ? 'bg-surface text-txt shadow-sm'
              : 'bg-transparent text-txt-3 hover:text-txt-2',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-txt-3">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <div>
        <p className="text-[14px] font-bold text-txt mb-1.5">Threat Actor Profiles</p>
        <p className="text-[11px] text-txt-3 leading-relaxed max-w-[280px]">
          Select an actor to view their profile, aliases, and full ATT&CK TTP breakdown.
          Technique links open in the ATT&CK browser.
        </p>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

type Selection =
  | { source: 'apt'; id: string }
  | { source: 'ransomware'; id: string }
  | null

export default function ThreatActors() {
  const [filter, setFilter] = useState<SourceFilter>('all')
  const [selection, setSelection] = useState<Selection>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 220)
    return () => clearTimeout(timer)
  }, [search])

  // Clear selection when filter hides the current source
  useEffect(() => {
    if (!selection) return
    if (filter === 'apt' && selection.source === 'ransomware') setSelection(null)
    if (filter === 'ransomware' && selection.source === 'apt') setSelection(null)
  }, [filter])

  const statusQuery = useQuery({
    queryKey: ['attack-status'],
    queryFn: api.getAttackStatus,
    refetchInterval: 10_000,
    retry: false,
  })

  const aptQuery = useQuery({
    queryKey: ['attack-groups', debouncedSearch],
    queryFn: () => api.getAttackGroups(debouncedSearch || undefined),
    staleTime: 5 * 60_000,
    enabled: !!statusQuery.data?.is_ready && filter !== 'ransomware',
  })

  const ransomQuery = useQuery({
    queryKey: ['ransomware-actors', debouncedSearch],
    queryFn: () => api.getRansomwareActors(debouncedSearch || undefined),
    staleTime: 60 * 60_000,
    enabled: filter !== 'apt',
  })

  const isAttackReady = statusQuery.data?.is_ready ?? false
  const isAttackLoading = statusQuery.data?.is_loading ?? false

  const aptGroups = aptQuery.data?.groups ?? []
  const ransomActors = ransomQuery.data?.actors ?? []

  const showApt = filter === 'all' || filter === 'apt'
  const showRansom = filter === 'all' || filter === 'ransomware'

  const totalCount = (showApt ? aptGroups.length : 0) + (showRansom ? ransomActors.length : 0)
  const isListLoading = (showApt && aptQuery.isLoading) || (showRansom && ransomQuery.isLoading)

  return (
    <div className="flex h-full overflow-hidden">

      {/* Left panel */}
      <div className="w-[260px] flex-shrink-0 border-r border-border flex flex-col h-full bg-surface/40">
        <div className="p-4 border-b border-border flex-shrink-0 flex flex-col gap-2.5">
          <p className="text-[13px] font-bold text-txt">Threat Actors</p>
          <FilterTabs value={filter} onChange={(v) => { setFilter(v); setSearch(''); setDebouncedSearch('') }} />
          <div className="relative">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, alias, or ID..."
              className="w-full bg-bg border border-border rounded-lg text-txt text-[11px] pl-7 pr-3 py-2 outline-none focus:border-purple transition-colors"
            />
          </div>
          <p className="text-[10px] text-txt-3 font-mono h-[12px]">
            {isListLoading ? '' : `${totalCount} actors`}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ATT&CK not loaded yet */}
          {showApt && !isAttackReady && (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-txt-3 px-4">
              {isAttackLoading ? (
                <>
                  <div className="w-4 h-4 border border-purple border-t-transparent rounded-full animate-spin" />
                  <p className="text-[11px] text-center">Downloading ATT&CK bundle...</p>
                </>
              ) : (
                <p className="text-[11px] text-center text-txt-3">ATT&CK data not yet loaded</p>
              )}
            </div>
          )}

          {/* Ransomware section header */}
          {showRansom && filter === 'all' && ransomActors.length > 0 && (
            <div className="px-4 py-2 border-b border-border/40 bg-bg/40">
              <span className="text-[11px] font-bold tracking-[0.15em] text-orange-400 uppercase">
                Ransomware Groups
              </span>
            </div>
          )}

          {showRansom && ransomActors.map((a) => (
            <RansomListItem
              key={a.slug}
              actor={a}
              selected={selection?.source === 'ransomware' && selection.id === a.slug}
              onClick={() => setSelection({ source: 'ransomware', id: a.slug })}
            />
          ))}

          {/* APT section header */}
          {showApt && filter === 'all' && aptGroups.length > 0 && (
            <div className="px-4 py-2 border-b border-border/40 bg-bg/40">
              <span className="text-[11px] font-bold tracking-[0.15em] text-purple uppercase">
                MITRE ATT&CK Groups
              </span>
            </div>
          )}

          {showApt && isAttackReady && aptGroups.map((g) => (
            <AptListItem
              key={g.attack_id}
              group={g}
              selected={selection?.source === 'apt' && selection.id === g.attack_id}
              onClick={() => setSelection({ source: 'apt', id: g.attack_id })}
            />
          ))}

          {!isListLoading && totalCount === 0 && (isAttackReady || filter === 'ransomware') && (
            <div className="flex flex-col items-center gap-2 py-8 text-center px-4">
              <p className="text-[11px] text-txt-3">No actors found</p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-hidden">
        {selection === null ? (
          <EmptyState />
        ) : selection.source === 'apt' ? (
          <AptProfile attackId={selection.id} />
        ) : (
          <RansomwareProfile slug={selection.id} />
        )}
      </div>
    </div>
  )
}
