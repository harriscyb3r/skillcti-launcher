import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Case, CaseNote, CaseArtifact, CaseStatus, CasePriority, ArtifactType } from '../lib/types'

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<CaseStatus, { label: string; bg: string; color: string }> = {
  'open':        { label: 'Open',        bg: '#22c55e20', color: '#22c55e' },
  'in-progress': { label: 'In Progress', bg: '#a855f720', color: '#a855f7' },
  'closed':      { label: 'Closed',      bg: '#6b728020', color: '#6b7280' },
}

const PRIORITY_META: Record<CasePriority, { label: string; bg: string; color: string }> = {
  critical: { label: 'Critical', bg: '#ef444420', color: '#ef4444' },
  high:     { label: 'High',     bg: '#f59e0b20', color: '#f59e0b' },
  medium:   { label: 'Medium',   bg: '#3b82f620', color: '#3b82f6' },
  low:      { label: 'Low',      bg: '#6b728020', color: '#6b7280' },
}

const ARTIFACT_META: Record<ArtifactType, { label: string; bg: string; color: string }> = {
  ioc:    { label: 'IOC',    bg: '#ef444420', color: '#ef4444' },
  cve:    { label: 'CVE',    bg: '#f59e0b20', color: '#f59e0b' },
  domain: { label: 'Domain', bg: '#06b6d420', color: '#06b6d4' },
  hash:   { label: 'Hash',   bg: '#a855f720', color: '#a855f7' },
  url:    { label: 'URL',    bg: '#f9731620', color: '#f97316' },
  report: { label: 'Report', bg: '#3b82f620', color: '#3b82f6' },
  actor:  { label: 'Actor',  bg: '#8b5cf620', color: '#8b5cf6' },
  other:  { label: 'Other',  bg: '#6b728020', color: '#6b7280' },
}

const ARTIFACT_TYPES: ArtifactType[] = ['ioc', 'cve', 'domain', 'hash', 'url', 'report', 'actor', 'other']

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const m = STATUS_META[status]
  return (
    <span className="text-[11px] font-bold tracking-[0.1em] px-1.5 py-[2px] rounded"
      style={{ background: m.bg, color: m.color }}>
      {m.label.toUpperCase()}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: CasePriority }) {
  const m = PRIORITY_META[priority]
  return (
    <span className="text-[11px] font-bold tracking-[0.1em] px-1.5 py-[2px] rounded"
      style={{ background: m.bg, color: m.color }}>
      {m.label.toUpperCase()}
    </span>
  )
}

// ── new case modal ────────────────────────────────────────────────────────────

function NewCaseModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Case) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<CasePriority>('medium')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  const mutation = useMutation({
    mutationFn: () => api.createCase({ title: title.trim(), description, priority, status: 'open' }),
    onSuccess: (c) => { onCreate(c) },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-xl shadow-elevated w-full max-w-md p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-1">New Investigation</p>
          <h2 className="text-[16px] font-bold text-txt">Create Case</h2>
        </div>

        <div>
          <label className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 uppercase block mb-1.5">Title</label>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Suspected Cobalt Strike C2 Activity"
            className="w-full bg-bg border border-border rounded-md text-txt text-[12px] px-3 py-2 outline-none focus:border-purple transition-colors"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 uppercase block mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief summary of the investigation…"
            rows={3}
            className="w-full bg-bg border border-border rounded-md text-txt text-[12px] px-3 py-2 outline-none focus:border-purple transition-colors resize-none"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 uppercase block mb-1.5">Priority</label>
          <div className="flex gap-2">
            {(['critical', 'high', 'medium', 'low'] as CasePriority[]).map((p) => {
              const m = PRIORITY_META[p]
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded border transition-all cursor-pointer"
                  style={{
                    background: priority === p ? m.bg : 'transparent',
                    color: m.color,
                    borderColor: priority === p ? m.color + '80' : 'var(--border)',
                  }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || mutation.isPending}
            className="px-4 py-2 text-[11px] font-bold tracking-[0.08em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90"
          >
            {mutation.isPending ? 'Creating…' : 'Create Case'}
          </button>
          <button type="button" onClick={onClose} className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ── case list item ────────────────────────────────────────────────────────────

function CaseListItem({
  c,
  selected,
  onClick,
}: {
  c: Case
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3 border-b border-border/50 transition-colors',
        selected ? 'bg-purple/[0.08]' : 'hover:bg-bg/60 bg-transparent',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className={[
          'text-[12px] font-semibold leading-snug truncate flex-1',
          selected ? 'text-txt' : 'text-txt',
        ].join(' ')}>
          {c.title}
        </span>
        <PriorityBadge priority={c.priority} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={c.status} />
        {c.artifact_count > 0 && (
          <span className="text-[10px] text-txt-3 font-mono">
            {c.artifact_count} artifact{c.artifact_count !== 1 ? 's' : ''}
          </span>
        )}
        {c.note_count > 0 && (
          <span className="text-[10px] text-txt-3 font-mono">
            {c.note_count} note{c.note_count !== 1 ? 's' : ''}
          </span>
        )}
        <span className="text-[11px] text-txt-3 ml-auto">{timeAgo(c.updated_at)}</span>
      </div>
    </button>
  )
}

// ── artifact row ──────────────────────────────────────────────────────────────

function ArtifactRow({ a, onDelete }: { a: CaseArtifact; onDelete: () => void }) {
  const m = ARTIFACT_META[a.artifact_type]
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 group">
      <span className="text-[11px] font-bold px-1.5 py-[2px] rounded flex-shrink-0" style={{ background: m.bg, color: m.color }}>
        {m.label}
      </span>
      <span className="flex-1 text-[11px] font-mono text-txt truncate" title={a.value}>{a.value}</span>
      {a.label && a.label !== a.value && (
        <span className="text-[11px] text-txt-3 truncate max-w-[120px]">{a.label}</span>
      )}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-txt-3 hover:text-red bg-transparent border-none cursor-pointer p-0"
        title="Remove artifact"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ── note row ──────────────────────────────────────────────────────────────────

function NoteRow({ n, onDelete }: { n: CaseNote; onDelete: () => void }) {
  return (
    <div className="group relative px-4 py-3 border-b border-border/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-txt-3 font-mono">{new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-txt-3 hover:text-red bg-transparent border-none cursor-pointer p-0"
          title="Delete note"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <p className="text-[12px] text-txt leading-relaxed whitespace-pre-wrap">{n.content}</p>
    </div>
  )
}

// ── case detail ───────────────────────────────────────────────────────────────

function CaseDetail({ caseId, onDeleted }: { caseId: string; onDeleted: () => void }) {
  const qc = useQueryClient()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [artifactValue, setArtifactValue] = useState('')
  const [artifactLabel, setArtifactLabel] = useState('')
  const [artifactType, setArtifactType] = useState<ArtifactType>('ioc')
  const [showArtifactForm, setShowArtifactForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'artifacts' | 'notes' | 'timeline'>('overview')
  const titleInputRef = useRef<HTMLInputElement>(null)

  const { data: c, isLoading } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId),
  })

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus()
  }, [editingTitle])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['case', caseId] })
    qc.invalidateQueries({ queryKey: ['cases'] })
  }

  const updateMut = useMutation({
    mutationFn: (updates: Parameters<typeof api.updateCase>[1]) => api.updateCase(caseId, updates),
    onSuccess: invalidate,
  })

  const deleteCaseMut = useMutation({
    mutationFn: () => api.deleteCase(caseId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases'] }); onDeleted() },
  })

  const addNoteMut = useMutation({
    mutationFn: (content: string) => api.addCaseNote(caseId, content),
    onSuccess: () => { invalidate(); setNoteInput('') },
  })

  const deleteNoteMut = useMutation({
    mutationFn: (noteId: string) => api.deleteCaseNote(caseId, noteId),
    onSuccess: invalidate,
  })

  const addArtifactMut = useMutation({
    mutationFn: () => api.addCaseArtifact(caseId, artifactType, artifactValue.trim(), artifactLabel.trim()),
    onSuccess: () => { invalidate(); setArtifactValue(''); setArtifactLabel(''); setShowArtifactForm(false) },
  })

  const deleteArtifactMut = useMutation({
    mutationFn: (id: string) => api.deleteCaseArtifact(caseId, id),
    onSuccess: invalidate,
  })

  function commitTitle() {
    if (!c) return
    setEditingTitle(false)
    if (titleDraft.trim() && titleDraft.trim() !== c.title) {
      updateMut.mutate({ title: titleDraft.trim() })
    }
  }

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center gap-2 text-txt-3 text-[11px]">
      <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
      Loading case…
    </div>
  )

  if (!c) return (
    <div className="flex-1 flex items-center justify-center text-txt-3 text-[13px]">Case not found.</div>
  )

  // Build timeline: case created + artifacts + notes, sorted by date
  const timeline: { id: string; kind: 'created' | 'artifact' | 'note'; ts: string; data?: CaseArtifact | CaseNote }[] = [
    { id: 'created', kind: 'created', ts: c.created_at },
    ...(c.artifacts ?? []).map((a) => ({ id: a.id, kind: 'artifact' as const, ts: a.created_at, data: a })),
    ...(c.notes ?? []).map((n) => ({ id: n.id, kind: 'note' as const, ts: n.created_at, data: n })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Case header ── */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        {/* Title */}
        <div className="mb-3">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
              className="w-full text-[18px] font-bold text-txt bg-bg border border-purple rounded-md px-2 py-1 outline-none"
            />
          ) : (
            <h2
              className="text-[18px] font-bold text-txt cursor-text hover:text-txt-2 transition-colors leading-tight"
              onClick={() => { setTitleDraft(c.title); setEditingTitle(true) }}
              title="Click to edit"
            >
              {c.title}
            </h2>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status selector */}
          <select
            value={c.status}
            onChange={(e) => updateMut.mutate({ status: e.target.value as CaseStatus })}
            className="text-[11px] font-bold tracking-[0.1em] px-2 py-[3px] rounded border-none outline-none cursor-pointer"
            style={{ background: STATUS_META[c.status].bg, color: STATUS_META[c.status].color }}
          >
            <option value="open">OPEN</option>
            <option value="in-progress">IN PROGRESS</option>
            <option value="closed">CLOSED</option>
          </select>

          {/* Priority selector */}
          <select
            value={c.priority}
            onChange={(e) => updateMut.mutate({ priority: e.target.value as CasePriority })}
            className="text-[11px] font-bold tracking-[0.1em] px-2 py-[3px] rounded border-none outline-none cursor-pointer"
            style={{ background: PRIORITY_META[c.priority].bg, color: PRIORITY_META[c.priority].color }}
          >
            <option value="critical">CRITICAL</option>
            <option value="high">HIGH</option>
            <option value="medium">MEDIUM</option>
            <option value="low">LOW</option>
          </select>

          {/* TLP */}
          <select
            value={c.tlp}
            onChange={(e) => updateMut.mutate({ tlp: e.target.value })}
            className="text-[11px] font-bold tracking-[0.1em] px-2 py-[3px] rounded bg-bg border border-border text-txt-2 outline-none cursor-pointer"
          >
            {['TLP:WHITE', 'TLP:GREEN', 'TLP:AMBER', 'TLP:RED'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <span className="text-[10px] text-txt-3 font-mono ml-auto">
            Created {timeAgo(c.created_at)}
          </span>

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button onClick={() => deleteCaseMut.mutate()} className="text-[11px] font-bold text-red hover:opacity-80 bg-transparent border-none cursor-pointer">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[11px] text-txt-3 hover:text-red transition-colors bg-transparent border-none cursor-pointer"
            >
              Delete case
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-border flex-shrink-0 px-6">
        {(['overview', 'artifacts', 'notes', 'timeline'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'text-[11px] font-bold tracking-[0.08em] uppercase py-2.5 mr-5 border-b-2 transition-colors bg-transparent cursor-pointer',
              activeTab === tab
                ? 'border-purple text-purple'
                : 'border-transparent text-txt-3 hover:text-txt-2',
            ].join(' ')}
          >
            {tab}
            {tab === 'artifacts' && c.artifact_count > 0 && (
              <span className="ml-1.5 text-[11px] font-bold px-1 py-0.5 rounded-full bg-purple/15 text-purple leading-none">
                {c.artifact_count}
              </span>
            )}
            {tab === 'notes' && c.note_count > 0 && (
              <span className="ml-1.5 text-[11px] font-bold px-1 py-0.5 rounded-full bg-purple/15 text-purple leading-none">
                {c.note_count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="p-6 flex flex-col gap-5">
            {/* Description */}
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-2">Description</p>
              <DescriptionEditor
                value={c.description}
                onSave={(v) => updateMut.mutate({ description: v })}
              />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Artifacts', value: c.artifact_count },
                { label: 'Notes', value: c.note_count },
                { label: 'Status', value: STATUS_META[c.status].label },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface border border-border rounded-lg p-3">
                  <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-1">{label}</p>
                  <p className="text-[16px] font-bold text-txt">{value}</p>
                </div>
              ))}
            </div>

            {/* Recent artifacts preview */}
            {(c.artifacts ?? []).length > 0 && (
              <div>
                <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-2">Recent Artifacts</p>
                <div className="bg-surface border border-border rounded-lg overflow-hidden">
                  {(c.artifacts ?? []).slice(-3).reverse().map((a) => {
                    const m = ARTIFACT_META[a.artifact_type]
                    return (
                      <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0">
                        <span className="text-[11px] font-bold px-1.5 py-[2px] rounded" style={{ background: m.bg, color: m.color }}>{m.label}</span>
                        <span className="text-[11px] font-mono text-txt truncate">{a.value}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recent notes preview */}
            {(c.notes ?? []).length > 0 && (
              <div>
                <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-2">Latest Note</p>
                <div className="bg-surface border border-border rounded-lg p-4">
                  <p className="text-[10px] text-txt-3 font-mono mb-1">
                    {new Date((c.notes ?? []).at(-1)!.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[12px] text-txt leading-relaxed whitespace-pre-wrap">
                    {(c.notes ?? []).at(-1)!.content}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Artifacts */}
        {activeTab === 'artifacts' && (
          <div className="flex flex-col">
            {/* Add artifact form */}
            <div className="p-4 border-b border-border flex-shrink-0">
              {showArtifactForm ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {ARTIFACT_TYPES.map((t) => {
                      const m = ARTIFACT_META[t]
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setArtifactType(t)}
                          className="text-[11px] font-bold px-2 py-1 rounded border transition-all cursor-pointer"
                          style={{
                            background: artifactType === t ? m.bg : 'transparent',
                            color: m.color,
                            borderColor: artifactType === t ? m.color + '80' : 'var(--border)',
                          }}
                        >
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                  <input
                    value={artifactValue}
                    onChange={(e) => setArtifactValue(e.target.value)}
                    placeholder="Value (IP, hash, CVE-ID, domain…)"
                    className="w-full bg-bg border border-border rounded-md text-txt font-mono text-[11px] px-3 py-2 outline-none focus:border-purple transition-colors"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Escape') { setShowArtifactForm(false); setArtifactValue('') } }}
                  />
                  <input
                    value={artifactLabel}
                    onChange={(e) => setArtifactLabel(e.target.value)}
                    placeholder="Label (optional — human-readable name)"
                    className="w-full bg-bg border border-border rounded-md text-txt text-[11px] px-3 py-2 outline-none focus:border-purple transition-colors"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => addArtifactMut.mutate()}
                      disabled={!artifactValue.trim() || addArtifactMut.isPending}
                      className="px-3 py-1.5 text-[11px] font-bold rounded bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40"
                    >
                      {addArtifactMut.isPending ? 'Adding…' : 'Add Artifact'}
                    </button>
                    <button
                      onClick={() => { setShowArtifactForm(false); setArtifactValue(''); setArtifactLabel('') }}
                      className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowArtifactForm(true)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Artifact
                </button>
              )}
            </div>

            {/* Artifact list */}
            {(c.artifacts ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <div>
                  <p className="text-[13px] font-semibold text-txt-2">No artifacts yet</p>
                  <p className="text-[11px] text-txt-3 mt-1">Add IOCs, CVEs, domains, hashes, or other indicators.</p>
                </div>
              </div>
            ) : (
              <div className="bg-surface">
                {(c.artifacts ?? []).map((a) => (
                  <ArtifactRow key={a.id} a={a} onDelete={() => deleteArtifactMut.mutate(a.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {activeTab === 'notes' && (
          <div className="flex flex-col">
            {/* Add note */}
            <div className="p-4 border-b border-border flex-shrink-0">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && noteInput.trim()) addNoteMut.mutate(noteInput) }}
                placeholder="Add an analyst note… (Ctrl+Enter to submit)"
                rows={3}
                className="w-full bg-bg border border-border rounded-lg text-txt text-[12px] px-3 py-2.5 outline-none focus:border-purple transition-colors resize-none placeholder:text-txt-3"
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => { if (noteInput.trim()) addNoteMut.mutate(noteInput) }}
                  disabled={!noteInput.trim() || addNoteMut.isPending}
                  className="px-3 py-1.5 text-[11px] font-bold rounded bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40"
                >
                  {addNoteMut.isPending ? 'Adding…' : 'Add Note'}
                </button>
              </div>
            </div>

            {/* Note list */}
            {(c.notes ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                <div>
                  <p className="text-[13px] font-semibold text-txt-2">No notes yet</p>
                  <p className="text-[11px] text-txt-3 mt-1">Record findings, hypotheses, and analyst observations.</p>
                </div>
              </div>
            ) : (
              <div>
                {[...(c.notes ?? [])].reverse().map((n) => (
                  <NoteRow key={n.id} n={n} onDelete={() => deleteNoteMut.mutate(n.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        {activeTab === 'timeline' && (
          <div className="p-6">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />
              <div className="flex flex-col gap-4">
                {timeline.map((item) => {
                  const isNote = item.kind === 'note'
                  const isArtifact = item.kind === 'artifact'
                  const note = isNote ? (item.data as CaseNote) : null
                  const artifact = isArtifact ? (item.data as CaseArtifact) : null
                  const artifactMeta = artifact ? ARTIFACT_META[artifact.artifact_type] : null

                  return (
                    <div key={item.id} className="flex items-start gap-4">
                      {/* Dot */}
                      <div className={[
                        'w-[15px] h-[15px] rounded-full border-2 flex-shrink-0 mt-0.5',
                        item.kind === 'created' ? 'bg-green border-green/40' : item.kind === 'note' ? 'bg-purple border-purple/40' : 'bg-bg border-border2',
                      ].join(' ')} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {item.kind === 'created' && <span className="text-[11px] font-bold text-txt-2">Case opened</span>}
                          {isNote && <span className="text-[11px] font-bold text-txt-2">Note added</span>}
                          {isArtifact && artifactMeta && (
                            <>
                              <span className="text-[11px] font-bold px-1.5 py-[2px] rounded" style={{ background: artifactMeta.bg, color: artifactMeta.color }}>{artifactMeta.label}</span>
                              <span className="text-[11px] font-bold text-txt-2">artifact linked</span>
                            </>
                          )}
                          <span className="text-[10px] text-txt-3 font-mono ml-auto">
                            {new Date(item.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {note && <p className="text-[11px] text-txt-2 leading-relaxed line-clamp-3">{note.content}</p>}
                        {artifact && <p className="text-[11px] font-mono text-txt-2 truncate">{artifact.value}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── description editor ────────────────────────────────────────────────────────

function DescriptionEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  if (editing) {
    return (
      <div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          rows={4}
          autoFocus
          className="w-full bg-bg border border-purple rounded-lg text-txt text-[12px] px-3 py-2.5 outline-none resize-none"
        />
        <p className="text-[11px] text-txt-3 mt-1">Click outside to save</p>
      </div>
    )
  }

  return (
    <div
      onClick={() => { setDraft(value); setEditing(true) }}
      className={[
        'min-h-[56px] rounded-lg px-3 py-2.5 cursor-text transition-colors border',
        value ? 'border-transparent hover:border-border' : 'border-border border-dashed',
      ].join(' ')}
    >
      {value
        ? <p className="text-[12px] text-txt leading-relaxed whitespace-pre-wrap">{value}</p>
        : <p className="text-[12px] text-txt-3 italic">Click to add a description…</p>
      }
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | CaseStatus

export default function Cases() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewCase, setShowNewCase] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['cases', statusFilter],
    queryFn: () => api.listCases(statusFilter === 'all' ? undefined : statusFilter),
  })

  const cases = data?.cases ?? []

  const counts = {
    all: cases.length,
    open: cases.filter((c) => c.status === 'open').length,
    'in-progress': cases.filter((c) => c.status === 'in-progress').length,
    closed: cases.filter((c) => c.status === 'closed').length,
  }

  function handleCreate(c: Case) {
    qc.invalidateQueries({ queryKey: ['cases'] })
    setShowNewCase(false)
    setSelectedId(c.id)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {showNewCase && <NewCaseModal onClose={() => setShowNewCase(false)} onCreate={handleCreate} />}

      {/* ── Left panel — case list ── */}
      <div className="w-[300px] flex-shrink-0 border-r border-border flex flex-col h-full bg-surface/50">
        {/* Header */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">Investigations</p>
              <p className="text-[15px] font-bold text-txt">Cases</p>
            </div>
            <button
              onClick={() => setShowNewCase(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New
            </button>
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {([
              { key: 'all', label: 'All' },
              { key: 'open', label: 'Open' },
              { key: 'in-progress', label: 'Active' },
              { key: 'closed', label: 'Closed' },
            ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={[
                  'text-[11px] font-bold tracking-[0.08em] px-2.5 py-1 rounded border transition-all cursor-pointer',
                  statusFilter === key
                    ? 'border-purple text-purple bg-purple/10'
                    : 'border-border text-txt-3 bg-transparent hover:border-border2',
                ].join(' ')}
              >
                {label}
                {counts[key] > 0 && <span className="ml-1 opacity-70">{counts[key]}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Cases list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center gap-2 text-txt-3 text-[11px] p-4">
              <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
              Loading…
            </div>
          )}

          {!isLoading && cases.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <div>
                <p className="text-[13px] font-semibold text-txt-2">No cases yet</p>
                <p className="text-[11px] text-txt-3 mt-1">Create one to start tracking an investigation.</p>
              </div>
            </div>
          )}

          {cases.map((c) => (
            <CaseListItem
              key={c.id}
              c={c}
              selected={selectedId === c.id}
              onClick={() => setSelectedId(c.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel — detail ── */}
      {selectedId ? (
        <CaseDetail
          key={selectedId}
          caseId={selectedId}
          onDeleted={() => setSelectedId(null)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <div>
            <p className="text-[13px] font-semibold text-txt-2">Select a case</p>
            <p className="text-[11px] text-txt-3 mt-1">Or create a new investigation to get started.</p>
          </div>
        </div>
      )}
    </div>
  )
}
