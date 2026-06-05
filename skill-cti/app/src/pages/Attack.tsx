import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { AttackTactic, AttackTechnique, AttackTechniqueDetail } from '../lib/types'

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

// ── helpers ───────────────────────────────────────────────────────────────────

function cleanDesc(text: string, maxLen = 600): string {
  return text
    .replace(/\(Citation:[^)]+\)/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen)
}

function PlatformTag({ p }: { p: string }) {
  return (
    <span className="text-[10px] font-bold font-mono px-1.5 py-[2px] rounded bg-bg border border-border text-txt-3">
      {p}
    </span>
  )
}

function TacticBadge({ shortname, name }: { shortname: string; name?: string }) {
  const color = tacticColor(shortname)
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-[2px] rounded leading-none"
      style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}
    >
      {name ?? shortname}
    </span>
  )
}

// ── loading / empty states ────────────────────────────────────────────────────

function LoadingState({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-8 h-8 border-2 border-purple border-t-transparent rounded-full animate-spin" />
      <div>
        <p className="text-[13px] font-bold text-txt mb-1">Loading ATT&CK Data</p>
        <p className="text-[11px] text-txt-3">
          Downloading MITRE ATT&CK Enterprise bundle (~20 MB). This happens once and then refreshes weekly.
        </p>
      </div>
    </div>
  )
}

// ── technique list item ───────────────────────────────────────────────────────

function TechniqueRow({
  technique,
  selected,
  onClick,
}: {
  technique: AttackTechnique
  selected: boolean
  onClick: () => void
}) {
  const tactic = technique.tactic_shortnames[0] ?? ''
  const color = tacticColor(tactic)
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left flex items-center gap-3 px-4 py-2.5 border-b border-border/40 transition-colors cursor-pointer bg-transparent border-none',
        selected ? 'bg-purple/[0.07]' : 'hover:bg-bg/60',
      ].join(' ')}
    >
      <span
        className="text-[9px] font-bold font-mono flex-shrink-0 w-[58px]"
        style={{ color }}
      >
        {technique.attack_id}
      </span>
      <span className={['text-[11px] font-bold truncate flex-1', selected ? 'text-purple' : 'text-txt'].join(' ')}>
        {technique.name}
      </span>
      {technique.platforms.length > 0 && (
        <span className="text-[8px] text-txt-3 font-mono flex-shrink-0 hidden sm:block">
          {technique.platforms.slice(0, 2).join(' · ')}
          {technique.platforms.length > 2 ? ` +${technique.platforms.length - 2}` : ''}
        </span>
      )}
    </button>
  )
}

// ── technique detail panel ────────────────────────────────────────────────────

function TechniqueDetail({
  attackId,
  onClose,
}: {
  attackId: string
  onClose: () => void
}) {
  const [showFullDesc, setShowFullDesc] = useState(false)
  const [showFullDetection, setShowFullDetection] = useState(false)
  const prevId = useRef('')

  useEffect(() => {
    if (attackId !== prevId.current) {
      setShowFullDesc(false)
      setShowFullDetection(false)
      prevId.current = attackId
    }
  }, [attackId])

  const { data: t, isLoading, isError } = useQuery<AttackTechniqueDetail>({
    queryKey: ['attack-detail', attackId],
    queryFn: () => api.getAttackTechnique(attackId),
    enabled: !!attackId,
    staleTime: 10 * 60_000,
  })

  const mitreUrl = t
    ? `https://attack.mitre.org/techniques/${t.attack_id.replace('.', '/')}/`
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden border-l border-border">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 flex-shrink-0">
        <div className="min-w-0">
          {t ? (
            <>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-bold font-mono text-purple">{t.attack_id}</span>
                {t.is_subtechnique && t.parent && (
                  <span className="text-[9px] text-txt-3 font-mono">
                    ↳ {t.parent.attack_id} {t.parent.name}
                  </span>
                )}
              </div>
              <h2 className="text-[14px] font-bold text-txt leading-tight">{t.name}</h2>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {t.tactics.map((tac) => (
                  <TacticBadge key={tac.shortname} shortname={tac.shortname} name={tac.name} />
                ))}
              </div>
            </>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-txt-3 text-[11px]">
              <div className="w-3 h-3 border border-purple border-t-transparent rounded-full animate-spin" />
              Loading…
            </div>
          ) : (
            <p className="text-[11px] text-red">Failed to load technique</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer p-1 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {t && (
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Platforms */}
          {t.platforms.length > 0 && (
            <div>
              <p className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Platforms</p>
              <div className="flex flex-wrap gap-1.5">
                {t.platforms.map((p) => <PlatformTag key={p} p={p} />)}
              </div>
            </div>
          )}

          {/* Description */}
          {t.description && (
            <div>
              <p className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Description</p>
              <p className="text-[11px] text-txt-2 leading-relaxed">
                {showFullDesc ? cleanDesc(t.description, 4000) : cleanDesc(t.description, 500)}
              </p>
              {t.description.length > 500 && (
                <button
                  onClick={() => setShowFullDesc((v) => !v)}
                  className="text-[9px] text-txt-3 hover:text-txt-2 hover:underline bg-transparent border-none cursor-pointer p-0 mt-1"
                >
                  {showFullDesc ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}

          {/* Sub-techniques */}
          {t.subtechniques.length > 0 && (
            <div>
              <p className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">
                Sub-techniques ({t.subtechniques.length})
              </p>
              <div className="flex flex-col gap-1">
                {t.subtechniques.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 py-1 border-b border-border/30">
                    <span className="text-[9px] font-bold font-mono text-purple/80 w-[68px] flex-shrink-0">
                      {sub.attack_id}
                    </span>
                    <span className="text-[10px] text-txt">{sub.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {t.groups.length > 0 && (
            <div>
              <p className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">
                Threat Groups ({t.groups.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {t.groups.map((g) => (
                  <span
                    key={g.attack_id}
                    className="text-[8px] font-bold font-mono px-2 py-[3px] rounded bg-purple/10 text-purple border border-purple/20"
                    title={g.aliases.length > 0 ? `Also known as: ${g.aliases.join(', ')}` : undefined}
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Data sources */}
          {t.data_sources.length > 0 && (
            <div>
              <p className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Data Sources</p>
              <div className="flex flex-wrap gap-1.5">
                {t.data_sources.map((ds) => (
                  <span key={ds} className="text-[8px] font-mono text-txt-3 px-1.5 py-[2px] rounded bg-bg border border-border">
                    {ds}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detection */}
          {t.detection && (
            <div>
              <p className="text-[8px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-2">Detection</p>
              <p className="text-[11px] text-txt-2 leading-relaxed">
                {showFullDetection ? cleanDesc(t.detection, 3000) : cleanDesc(t.detection, 400)}
              </p>
              {t.detection.length > 400 && (
                <button
                  onClick={() => setShowFullDetection((v) => !v)}
                  className="text-[9px] text-txt-3 hover:text-txt-2 hover:underline bg-transparent border-none cursor-pointer p-0 mt-1"
                >
                  {showFullDetection ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}

          {/* MITRE link */}
          {mitreUrl && (
            <a
              href={mitreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[9px] font-bold font-mono text-purple hover:underline w-fit"
            >
              View on MITRE ATT&CK
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ── tactic overview tiles ─────────────────────────────────────────────────────

function TacticOverview({
  tactics,
  onSelect,
}: {
  tactics: AttackTactic[]
  onSelect: (shortname: string) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-4">
        Enterprise ATT&CK — {tactics.length} Tactics
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-3xl lg:grid-cols-3 xl:grid-cols-4">
        {tactics.map((tac) => {
          const color = tacticColor(tac.shortname)
          return (
            <button
              key={tac.id}
              onClick={() => onSelect(tac.shortname)}
              className="text-left p-4 rounded-lg border border-border bg-surface shadow-card hover:border-opacity-80 transition-all cursor-pointer group"
              style={{ borderColor: `${color}30` }}
            >
              <div className="text-[8px] font-bold font-mono mb-1.5" style={{ color }}>
                {tac.attack_id}
              </div>
              <div className="text-[13px] font-bold text-txt leading-tight mb-2 group-hover:text-txt transition-colors">
                {tac.name}
              </div>
              <div className="text-[20px] font-bold font-mono" style={{ color }}>
                {tac.technique_count}
              </div>
              <div className="text-[8px] text-txt-3 uppercase tracking-wide">techniques</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Attack() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedTactic, setSelectedTactic] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('t'))
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Sync URL param → selection on mount
  useEffect(() => {
    const t = searchParams.get('t')
    if (t) {
      setSelectedId(t.toUpperCase())
      setSelectedTactic('')
    }
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const statusQuery = useQuery({
    queryKey: ['attack-status'],
    queryFn: api.getAttackStatus,
    refetchInterval: 5_000,
    retry: false,
  })

  const tacticsQuery = useQuery({
    queryKey: ['attack-tactics'],
    queryFn: api.getAttackTactics,
    staleTime: 10 * 60_000,
    enabled: statusQuery.data?.is_ready,
  })

  const techniquesQuery = useQuery({
    queryKey: ['attack-techniques', selectedTactic, debouncedSearch],
    queryFn: () => api.getAttackTechniques({
      tactic: selectedTactic || undefined,
      q: debouncedSearch || undefined,
    }),
    staleTime: 5 * 60_000,
    enabled: statusQuery.data?.is_ready && (!!selectedTactic || !!debouncedSearch),
  })

  const refreshMut = useMutation({
    mutationFn: api.refreshAttack,
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['attack-status'] })
        qc.invalidateQueries({ queryKey: ['attack-tactics'] })
        qc.invalidateQueries({ queryKey: ['attack-techniques'] })
      }, 5000)
    },
  })

  const status = statusQuery.data
  const isLoading = status?.is_loading || refreshMut.isPending
  const isReady = status?.is_ready
  const tactics = tacticsQuery.data?.tactics ?? []
  const techniques = techniquesQuery.data?.techniques ?? []

  const showTechniqueList = !!selectedTactic || !!debouncedSearch
  const showDetail = !!selectedId

  function handleTacticSelect(shortname: string) {
    setSelectedTactic(shortname)
    setSelectedId(null)
    setSearch('')
    setDebouncedSearch('')
  }

  function handleTechniqueSelect(attackId: string) {
    setSelectedId(attackId)
    setSearchParams(attackId ? { t: attackId } : {})
  }

  function handleCloseDetail() {
    setSelectedId(null)
    setSearchParams({})
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* Left sidebar — tactic navigation */}
      <div className="w-[220px] flex-shrink-0 border-r border-border flex flex-col h-full bg-surface/40">
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-bold text-txt">ATT&CK</span>
            <div className="flex items-center gap-2">
              {status && !isLoading && (
                <span className="text-[8px] text-txt-3 font-mono">
                  {status.technique_count} techniques
                </span>
              )}
              <button
                onClick={() => refreshMut.mutate()}
                disabled={isLoading}
                title="Refresh ATT&CK data"
                className="text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer p-0.5 transition-colors disabled:opacity-40"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={isLoading ? 'animate-spin' : ''}>
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedTactic('') }}
              placeholder="Search techniques…"
              className="w-full bg-bg border border-border rounded-lg text-txt text-[10px] pl-7 pr-3 py-2 outline-none focus:border-purple transition-colors"
            />
          </div>
        </div>

        {/* Tactic list */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* All overview */}
          <button
            onClick={() => { setSelectedTactic(''); setSelectedId(null); setSearch(''); setDebouncedSearch('') }}
            className={[
              'w-full flex items-center gap-2 px-4 py-2 text-left transition-colors bg-transparent border-none cursor-pointer',
              !selectedTactic && !search ? 'text-purple bg-purple/[0.06]' : 'text-txt-3 hover:text-txt-2 hover:bg-bg/40',
            ].join(' ')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span className="text-[10px] font-bold">Overview</span>
          </button>

          {tactics.map((tac) => {
            const color = tacticColor(tac.shortname)
            const active = selectedTactic === tac.shortname
            return (
              <button
                key={tac.id}
                onClick={() => handleTacticSelect(tac.shortname)}
                className={[
                  'w-full flex items-center gap-2 px-4 py-2 text-left transition-colors bg-transparent border-none cursor-pointer border-l-2',
                  active ? 'bg-bg/40' : 'border-l-transparent hover:bg-bg/30',
                ].join(' ')}
                style={active ? { borderLeftColor: color } : {}}
              >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className={['text-[10px] font-bold flex-1 text-left', active ? 'text-txt' : 'text-txt-3'].join(' ')}>
                  {tac.name}
                </span>
                <span className="text-[8px] font-mono flex-shrink-0" style={{ color: active ? color : '#6b7280' }}>
                  {tac.technique_count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Center — technique list or overview */}
      <div className={[
        'flex flex-col overflow-hidden border-r border-border',
        showDetail ? 'w-[300px] flex-shrink-0' : 'flex-1',
      ].join(' ')}>

        {!isReady ? (
          <LoadingState isLoading={isLoading} />
        ) : !showTechniqueList ? (
          <TacticOverview tactics={tactics} onSelect={handleTacticSelect} />
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-shrink-0">
              {selectedTactic && (
                <TacticBadge
                  shortname={selectedTactic}
                  name={tactics.find((t) => t.shortname === selectedTactic)?.name}
                />
              )}
              {debouncedSearch && !selectedTactic && (
                <span className="text-[9px] font-mono text-txt-3">
                  Search: <span className="text-txt">&ldquo;{debouncedSearch}&rdquo;</span>
                </span>
              )}
              <span className="text-[9px] text-txt-3 font-mono ml-auto">
                {techniquesQuery.isLoading ? '…' : `${techniques.length} techniques`}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {techniquesQuery.isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-txt-3 text-[11px]">
                  <div className="w-3 h-3 border border-purple border-t-transparent rounded-full animate-spin" />
                  Loading…
                </div>
              ) : techniques.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <p className="text-[11px] text-txt-3">No techniques found</p>
                </div>
              ) : (
                techniques.map((tech) => (
                  <TechniqueRow
                    key={tech.id}
                    technique={tech}
                    selected={selectedId === tech.attack_id}
                    onClick={() => handleTechniqueSelect(tech.attack_id)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Right — technique detail */}
      {showDetail && (
        <div className="flex-1 overflow-hidden">
          <TechniqueDetail attackId={selectedId!} onClose={handleCloseDetail} />
        </div>
      )}
    </div>
  )
}
