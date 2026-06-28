import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Pir, PirCategory, PirPriority, PirStatus, CreatePirRequest } from '../lib/types'

// ── Meta maps ─────────────────────────────────────────────────────────────────

const PRIORITY_META: Record<PirPriority, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#ef4444', bg: '#ef444420' },
  high:     { label: 'High',     color: '#f97316', bg: '#f9731620' },
  medium:   { label: 'Medium',   color: '#f59e0b', bg: '#f59e0b20' },
  low:      { label: 'Low',      color: '#6b7280', bg: '#6b728020' },
}

const STATUS_META: Record<PirStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: '#22c55e', bg: '#22c55e20' },
  on_hold:   { label: 'On Hold',   color: '#f59e0b', bg: '#f59e0b20' },
  answered:  { label: 'Answered',  color: '#a855f7', bg: '#a855f720' },
  closed:    { label: 'Closed',    color: '#6b7280', bg: '#6b728020' },
}

const CATEGORY_META: Record<PirCategory, { label: string; color: string }> = {
  threat_actor:  { label: 'Threat Actor',  color: '#ef4444' },
  malware:       { label: 'Malware',       color: '#f97316' },
  vulnerability: { label: 'Vulnerability', color: '#a855f7' },
  geopolitical:  { label: 'Geopolitical',  color: '#3b82f6' },
  sector:        { label: 'Sector',        color: '#06b6d4' },
  general:       { label: 'General',       color: '#6b7280' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOverdue(pir: Pir): boolean {
  if (pir.status === 'closed' || pir.status === 'answered') return false
  const base = pir.last_reviewed_at ?? pir.created_at
  const dueMs = new Date(base).getTime() + pir.rescan_days * 86_400_000
  return Date.now() > dueMs
}

function daysUntilDue(pir: Pir): number {
  const base = pir.last_reviewed_at ?? pir.created_at
  const dueMs = new Date(base).getTime() + pir.rescan_days * 86_400_000
  return Math.round((dueMs - Date.now()) / 86_400_000)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── New PIR modal ─────────────────────────────────────────────────────────────

function NewPirModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: CreatePirRequest) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<PirCategory>('general')
  const [priority, setPriority] = useState<PirPriority>('medium')
  const [rescanDays, setRescanDays] = useState(30)
  const [owner, setOwner] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onCreate({ title: title.trim(), description, category, priority, rescan_days: rescanDays, owner, tags })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold text-txt">New Priority Intelligence Requirement</h2>
          <button onClick={onClose} className="text-txt-3 hover:text-txt transition-colors bg-transparent border-none cursor-pointer p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-medium text-txt-2 mb-1">Requirement *</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What intelligence do you need to answer?"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-[13px] text-txt placeholder-txt-3 focus:outline-none focus:border-purple"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-txt-2 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Why is this intelligence needed? What decisions does it support?"
              rows={3}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-[13px] text-txt placeholder-txt-3 focus:outline-none focus:border-purple resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-txt-2 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as PirCategory)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-[13px] text-txt focus:outline-none focus:border-purple"
              >
                {(Object.keys(CATEGORY_META) as PirCategory[]).map(c => (
                  <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-txt-2 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as PirPriority)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-[13px] text-txt focus:outline-none focus:border-purple"
              >
                {(Object.keys(PRIORITY_META) as PirPriority[]).map(p => (
                  <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-txt-2 mb-1">Review cycle (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={rescanDays}
                onChange={e => setRescanDays(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-[13px] text-txt focus:outline-none focus:border-purple"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-txt-2 mb-1">Owner</label>
              <input
                value={owner}
                onChange={e => setOwner(e.target.value)}
                placeholder="Analyst name or team"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-[13px] text-txt placeholder-txt-3 focus:outline-none focus:border-purple"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-txt-2 mb-1">Tags</label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Add tag…"
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-[13px] text-txt placeholder-txt-3 focus:outline-none focus:border-purple"
              />
              <button type="button" onClick={addTag} className="px-3 py-2 rounded-lg border border-border text-txt-2 hover:text-txt text-[12px] bg-transparent cursor-pointer">Add</button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map(t => (
                  <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple/10 text-purple text-[11px] font-medium">
                    {t}
                    <button type="button" onClick={() => setTags(tags.filter(x => x !== t))} className="bg-transparent border-none cursor-pointer text-purple hover:text-red leading-none p-0">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-txt-2 hover:text-txt text-[13px] bg-transparent cursor-pointer transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 rounded-lg bg-purple text-white text-[13px] font-medium hover:bg-purple/90 disabled:opacity-40 cursor-pointer transition-colors border-none"
            >
              Create PIR
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── PIR list item ─────────────────────────────────────────────────────────────

function PirListItem({ pir, selected, onClick }: { pir: Pir; selected: boolean; onClick: () => void }) {
  const overdue = isOverdue(pir)
  const days = daysUntilDue(pir)
  const pm = PRIORITY_META[pir.priority]
  const sm = STATUS_META[pir.status]
  const cm = CATEGORY_META[pir.category]

  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3 border-b border-border transition-colors',
        selected ? 'bg-purple/[0.08] border-l-2 border-l-purple' : 'hover:bg-white/[0.03] border-l-2 border-l-transparent',
      ].join(' ')}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <span className="flex-1 text-[13px] font-medium text-txt leading-snug line-clamp-2">{pir.title}</span>
        {overdue && (
          <span className="flex-shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red/20 text-red leading-none">OVERDUE</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: pm.bg, color: pm.color }}>
          {pm.label}
        </span>
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: sm.bg, color: sm.color }}>
          {sm.label}
        </span>
        <span className="text-[11px] text-txt-3" style={{ color: cm.color }}>{cm.label}</span>
        {pir.finding_count > 0 && (
          <span className="ml-auto text-[11px] text-txt-3">{pir.finding_count} finding{pir.finding_count !== 1 ? 's' : ''}</span>
        )}
      </div>
      {pir.status === 'active' && !overdue && (
        <div className="mt-1 text-[11px] text-txt-3">
          Due in {days} day{days !== 1 ? 's' : ''}
        </div>
      )}
    </button>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function PirDetail({ pir, onDeleted }: { pir: Pir; onDeleted: () => void }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'overview' | 'findings'>('overview')
  const [findingContent, setFindingContent] = useState('')
  const [findingSource, setFindingSource] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const findingRef = useRef<HTMLTextAreaElement>(null)

  const { data: detail } = useQuery({
    queryKey: ['pir', pir.id],
    queryFn: () => api.getPir(pir.id),
  })

  const updateMutation = useMutation({
    mutationFn: (updates: Parameters<typeof api.updatePir>[1]) => api.updatePir(pir.id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pirs'] })
      qc.invalidateQueries({ queryKey: ['pir', pir.id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deletePir(pir.id),
    onSuccess: onDeleted,
  })

  const addFindingMutation = useMutation({
    mutationFn: () => api.addPirFinding(pir.id, findingContent.trim(), findingSource.trim()),
    onSuccess: () => {
      setFindingContent('')
      setFindingSource('')
      qc.invalidateQueries({ queryKey: ['pir', pir.id] })
      qc.invalidateQueries({ queryKey: ['pirs'] })
    },
  })

  const deleteFindingMutation = useMutation({
    mutationFn: (fid: string) => api.deletePirFinding(pir.id, fid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pir', pir.id] })
      qc.invalidateQueries({ queryKey: ['pirs'] })
    },
  })

  const current = detail ?? pir
  const overdue = isOverdue(current)
  const pm = PRIORITY_META[current.priority]
  const sm = STATUS_META[current.status]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-start gap-3 mb-3">
          <h2 className="flex-1 text-[16px] font-semibold text-txt leading-snug">{current.title}</h2>
          {overdue && (
            <span className="flex-shrink-0 text-[11px] font-bold px-2 py-1 rounded-full bg-red/20 text-red">OVERDUE</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority selector */}
          <select
            value={current.priority}
            onChange={e => updateMutation.mutate({ priority: e.target.value as PirPriority })}
            className="text-[11px] font-semibold px-2 py-1 rounded border-none cursor-pointer focus:outline-none"
            style={{ background: pm.bg, color: pm.color }}
          >
            {(Object.keys(PRIORITY_META) as PirPriority[]).map(p => (
              <option key={p} value={p}>{PRIORITY_META[p].label}</option>
            ))}
          </select>

          {/* Status selector */}
          <select
            value={current.status}
            onChange={e => updateMutation.mutate({ status: e.target.value as PirStatus })}
            className="text-[11px] font-semibold px-2 py-1 rounded border-none cursor-pointer focus:outline-none"
            style={{ background: sm.bg, color: sm.color }}
          >
            {(Object.keys(STATUS_META) as PirStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>

          <span className="text-[11px] text-txt-3">
            {CATEGORY_META[current.category].label}
          </span>

          {current.owner && (
            <span className="text-[11px] text-txt-3 ml-1">· {current.owner}</span>
          )}

          <div className="flex-1" />

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-txt-3">Delete?</span>
              <button
                onClick={() => deleteMutation.mutate()}
                className="text-[11px] text-red hover:underline bg-transparent border-none cursor-pointer"
              >Confirm</button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[11px] text-txt-3 hover:text-txt bg-transparent border-none cursor-pointer"
              >Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-txt-3 hover:text-red transition-colors bg-transparent border-none cursor-pointer p-1"
              title="Delete PIR"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          )}
        </div>

        {/* Tags */}
        {current.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {current.tags.map(t => (
              <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full bg-purple/10 text-purple">{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border flex-shrink-0">
        {(['overview', 'findings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-5 py-2.5 text-[12px] font-medium border-none bg-transparent cursor-pointer border-b-2 transition-colors',
              tab === t
                ? 'text-purple border-b-purple'
                : 'text-txt-3 border-b-transparent hover:text-txt-2',
            ].join(' ')}
          >
            {t === 'overview' ? 'Overview' : `Findings${current.finding_count > 0 ? ` (${current.finding_count})` : ''}`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && (
          <div className="px-6 py-4 flex flex-col gap-5">
            {current.description && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-txt-3 mb-1">Description</div>
                <p className="text-[13px] text-txt-2 leading-relaxed whitespace-pre-wrap">{current.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-txt-3 mb-1">Review Cycle</div>
                <div className="text-[13px] text-txt">Every {current.rescan_days} day{current.rescan_days !== 1 ? 's' : ''}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-txt-3 mb-1">Next Review</div>
                <div className={['text-[13px]', overdue ? 'text-red font-medium' : 'text-txt'].join(' ')}>
                  {overdue
                    ? `${Math.abs(daysUntilDue(current))}d overdue`
                    : `In ${daysUntilDue(current)}d`}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-txt-3 mb-1">Last Reviewed</div>
                <div className="text-[13px] text-txt">
                  {current.last_reviewed_at ? fmtDate(current.last_reviewed_at) : 'Never'}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-txt-3 mb-1">Created</div>
                <div className="text-[13px] text-txt">{fmtDate(current.created_at)}</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'findings' && (
          <div className="flex flex-col h-full">
            {/* Add finding form */}
            <div className="px-6 py-4 border-b border-border flex-shrink-0">
              <div className="text-[11px] font-medium text-txt-2 mb-2">Add Intelligence Finding</div>
              <textarea
                ref={findingRef}
                value={findingContent}
                onChange={e => setFindingContent(e.target.value)}
                placeholder="Describe what intelligence you found in response to this requirement…"
                rows={3}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-[13px] text-txt placeholder-txt-3 focus:outline-none focus:border-purple resize-none mb-2"
              />
              <div className="flex items-center gap-2">
                <input
                  value={findingSource}
                  onChange={e => setFindingSource(e.target.value)}
                  placeholder="Source (e.g. OSINT, internal, vendor report)"
                  className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 text-[12px] text-txt placeholder-txt-3 focus:outline-none focus:border-purple"
                />
                <button
                  onClick={() => addFindingMutation.mutate()}
                  disabled={!findingContent.trim() || addFindingMutation.isPending}
                  className="px-4 py-1.5 rounded-lg bg-purple text-white text-[12px] font-medium hover:bg-purple/90 disabled:opacity-40 cursor-pointer border-none transition-colors"
                >
                  {addFindingMutation.isPending ? 'Adding…' : 'Add Finding'}
                </button>
              </div>
            </div>

            {/* Findings list */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              {(!detail?.findings || detail.findings.length === 0) ? (
                <div className="text-center py-10 text-txt-3 text-[13px]">No findings yet</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {detail.findings.map(f => (
                    <div key={f.id} className="bg-bg border border-border rounded-lg px-4 py-3 group">
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-[13px] text-txt leading-relaxed whitespace-pre-wrap">{f.content}</p>
                        <button
                          onClick={() => deleteFindingMutation.mutate(f.id)}
                          className="opacity-0 group-hover:opacity-100 text-txt-3 hover:text-red transition-all bg-transparent border-none cursor-pointer p-0.5 flex-shrink-0"
                          title="Delete finding"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        {f.source && (
                          <span className="text-[11px] text-txt-3 font-medium">{f.source}</span>
                        )}
                        <span className="text-[11px] text-txt-3 ml-auto">{fmtDateTime(f.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PIR() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['pirs', statusFilter, priorityFilter, categoryFilter],
    queryFn: () => api.listPirs({
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      category: categoryFilter || undefined,
    }),
    refetchInterval: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: (req: CreatePirRequest) => api.createPir(req),
    onSuccess: (pir) => {
      qc.invalidateQueries({ queryKey: ['pirs'] })
      setSelectedId(pir.id)
      setShowNew(false)
    },
  })

  const pirs = data?.pirs ?? []
  const selected = pirs.find(p => p.id === selectedId) ?? null

  const overdue = pirs.filter(p => isOverdue(p))
  const active = pirs.filter(p => p.status === 'active')

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel ── */}
      <div className="w-[320px] flex-shrink-0 flex flex-col border-r border-border h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-[14px] font-semibold text-txt">PIR</h1>
              <p className="text-[11px] text-txt-3">Priority Intelligence Requirements</p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple text-white text-[12px] font-medium hover:bg-purple/90 transition-colors border-none cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New
            </button>
          </div>

          {/* Summary stats */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1 bg-bg rounded-lg px-3 py-2 text-center">
              <div className="text-[18px] font-bold text-txt">{active.length}</div>
              <div className="text-[11px] text-txt-3">Active</div>
            </div>
            <div className="flex-1 bg-bg rounded-lg px-3 py-2 text-center">
              <div className={['text-[18px] font-bold', overdue.length > 0 ? 'text-red' : 'text-txt'].join(' ')}>
                {overdue.length}
              </div>
              <div className="text-[11px] text-txt-3">Overdue</div>
            </div>
            <div className="flex-1 bg-bg rounded-lg px-3 py-2 text-center">
              <div className="text-[18px] font-bold text-txt">{pirs.length}</div>
              <div className="text-[11px] text-txt-3">Total</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-1.5">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-[11px] text-txt focus:outline-none focus:border-purple"
            >
              <option value="">All statuses</option>
              {(Object.keys(STATUS_META) as PirStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="flex-1 bg-bg border border-border rounded-lg px-2 py-1.5 text-[11px] text-txt focus:outline-none focus:border-purple"
              >
                <option value="">All priorities</option>
                {(Object.keys(PRIORITY_META) as PirPriority[]).map(p => (
                  <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="flex-1 bg-bg border border-border rounded-lg px-2 py-1.5 text-[11px] text-txt focus:outline-none focus:border-purple"
              >
                <option value="">All categories</option>
                {(Object.keys(CATEGORY_META) as PirCategory[]).map(c => (
                  <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="text-center py-10 text-txt-3 text-[13px]">Loading…</div>
          )}
          {!isLoading && pirs.length === 0 && (
            <div className="text-center py-10 px-4">
              <div className="text-txt-3 text-[13px] mb-2">No requirements found</div>
              <button onClick={() => setShowNew(true)} className="text-purple text-[12px] hover:underline bg-transparent border-none cursor-pointer">
                Create your first PIR
              </button>
            </div>
          )}
          {/* Overdue first, then rest */}
          {[...pirs].sort((a, b) => {
            const ao = isOverdue(a) ? 0 : 1
            const bo = isOverdue(b) ? 0 : 1
            if (ao !== bo) return ao - bo
            const pp: Record<PirPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
            return pp[a.priority] - pp[b.priority]
          }).map(pir => (
            <PirListItem
              key={pir.id}
              pir={pir}
              selected={pir.id === selectedId}
              onClick={() => setSelectedId(pir.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <PirDetail
            key={selected.id}
            pir={selected}
            onDeleted={() => {
              setSelectedId(null)
              qc.invalidateQueries({ queryKey: ['pirs'] })
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-4">
            <div className="w-14 h-14 rounded-full bg-purple/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <div className="text-[14px] font-medium text-txt mb-1">Select a PIR</div>
              <div className="text-[12px] text-txt-3">Choose a requirement from the list or create a new one</div>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="px-4 py-2 rounded-lg bg-purple text-white text-[13px] font-medium hover:bg-purple/90 border-none cursor-pointer transition-colors"
            >
              New PIR
            </button>
          </div>
        )}
      </div>

      {showNew && (
        <NewPirModal
          onClose={() => setShowNew(false)}
          onCreate={data => createMutation.mutate(data)}
        />
      )}
    </div>
  )
}
