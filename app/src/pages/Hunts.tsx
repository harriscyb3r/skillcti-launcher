import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type {
  Hunt, HuntNote, HuntQuery, HuntFinding,
  HuntStatus, HuntPriority, HuntVerdict, FindingStatus,
  QueryPhase, QueryType, MitreTechnique, GeneratedHuntPlan, GeneratedHuntQuery,
} from '../lib/types'

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<HuntStatus, { label: string; bg: string; color: string }> = {
  'planning':    { label: 'Planning',    bg: '#3b82f620', color: '#3b82f6' },
  'in-progress': { label: 'In Progress', bg: '#f59e0b20', color: '#f59e0b' },
  'complete':    { label: 'Complete',    bg: '#22c55e20', color: '#22c55e' },
  'escalated':   { label: 'Escalated',   bg: '#ef444420', color: '#ef4444' },
}

const PRIORITY_META: Record<HuntPriority, { label: string; bg: string; color: string }> = {
  critical: { label: 'Critical', bg: '#ef444420', color: '#ef4444' },
  high:     { label: 'High',     bg: '#f59e0b20', color: '#f59e0b' },
  medium:   { label: 'Medium',   bg: '#3b82f620', color: '#3b82f6' },
  low:      { label: 'Low',      bg: '#6b728020', color: '#6b7280' },
}

const VERDICT_META: Record<HuntVerdict, { label: string; bg: string; color: string }> = {
  'not-found':   { label: 'Not Found',   bg: '#6b728020', color: '#6b7280' },
  'unconfirmed': { label: 'Unconfirmed', bg: '#3b82f620', color: '#3b82f6' },
  'suspicious':  { label: 'Suspicious',  bg: '#f59e0b20', color: '#f59e0b' },
  'confirmed':   { label: 'Confirmed',   bg: '#ef444420', color: '#ef4444' },
}

const FINDING_STATUS_META: Record<FindingStatus, { label: string; bg: string; color: string }> = {
  benign:     { label: 'Benign',     bg: '#22c55e20', color: '#22c55e' },
  suspicious: { label: 'Suspicious', bg: '#f59e0b20', color: '#f59e0b' },
  malicious:  { label: 'Malicious',  bg: '#ef444420', color: '#ef4444' },
}

const PHASE_META: Record<QueryPhase, { label: string; color: string }> = {
  'baseline':           { label: 'Baseline',    color: '#6b7280' },
  'anomaly-detection':  { label: 'Anomaly',     color: '#3b82f6' },
  'triage':             { label: 'Triage',      color: '#f59e0b' },
  'confirmation':       { label: 'Confirm',     color: '#a855f7' },
  'evidence-collection':{ label: 'Evidence',    color: '#ef4444' },
}

const TYPE_META: Record<QueryType, { label: string }> = {
  broad:   { label: 'BROAD' },
  focused: { label: 'FOCUSED' },
  pivot:   { label: 'PIVOT' },
}

const PLATFORMS = ['Microsoft Sentinel', 'Microsoft Defender', 'Splunk', 'Elastic', 'Generic']
const TIMEFRAMES = ['7d', '14d', '30d', '60d', '90d', '180d']

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

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

// ── badge components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: HuntStatus }) {
  const m = STATUS_META[status]
  return (
    <span className="text-[11px] font-bold tracking-[0.08em] px-1.5 py-[2px] rounded"
      style={{ background: m.bg, color: m.color }}>
      {m.label.toUpperCase()}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: HuntPriority }) {
  const m = PRIORITY_META[priority]
  return (
    <span className="text-[11px] font-bold tracking-[0.08em] px-1.5 py-[2px] rounded"
      style={{ background: m.bg, color: m.color }}>
      {m.label.toUpperCase()}
    </span>
  )
}

function VerdictBadge({ verdict }: { verdict: HuntVerdict | null }) {
  if (!verdict) return null
  const m = VERDICT_META[verdict]
  return (
    <span className="text-[11px] font-bold tracking-[0.08em] px-1.5 py-[2px] rounded border"
      style={{ borderColor: m.color + '60', color: m.color }}>
      {m.label.toUpperCase()}
    </span>
  )
}

// ── new hunt modal ────────────────────────────────────────────────────────────

function NewHuntModal({ onClose, onCreate }: { onClose: () => void; onCreate: (h: Hunt) => void }) {
  const [title, setTitle] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [priority, setPriority] = useState<HuntPriority>('medium')
  const [platform, setPlatform] = useState('Microsoft Sentinel')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  const mutation = useMutation({
    mutationFn: () => api.createHunt({ title: title.trim(), hypothesis, priority, platform }),
    onSuccess: onCreate,
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
        className="bg-surface border border-border rounded-xl shadow-elevated w-full max-w-lg p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-1">New Threat Hunt</p>
          <h2 className="text-[16px] font-bold text-txt">Create Hunt</h2>
        </div>

        <div>
          <label className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 uppercase block mb-1.5">Title</label>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Suspected WMI Lateral Movement — Finance Segment"
            className="w-full bg-bg border border-border rounded-md text-txt text-[12px] px-3 py-2 outline-none focus:border-accent transition-colors"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 uppercase block mb-1.5">Hypothesis</label>
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            placeholder="Are there signs of living-off-the-land lateral movement via WMI in the finance network segment?"
            rows={2}
            className="w-full bg-bg border border-border rounded-md text-txt text-[12px] px-3 py-2 outline-none focus:border-accent transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 uppercase block mb-1.5">Priority</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['critical', 'high', 'medium', 'low'] as HuntPriority[]).map((p) => {
                const m = PRIORITY_META[p]
                return (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className="text-[11px] font-bold px-2 py-1 rounded border transition-all cursor-pointer"
                    style={{
                      background: priority === p ? m.bg : 'transparent',
                      color: m.color,
                      borderColor: priority === p ? m.color + '80' : 'var(--border)',
                    }}>
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 uppercase block mb-1.5">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-bg border border-border rounded-md text-txt text-[12px] px-3 py-2 outline-none focus:border-accent transition-colors"
            >
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || mutation.isPending}
            className="px-4 py-2 text-[11px] font-bold tracking-[0.08em] rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90"
          >
            {mutation.isPending ? 'Creating…' : 'Create Hunt'}
          </button>
          <button type="button" onClick={onClose} className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ── hunt list item ────────────────────────────────────────────────────────────

function HuntListItem({ h, selected, onClick }: { h: Hunt; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3 border-b border-border/50 transition-colors',
        selected ? 'bg-[#3b82f6]/[0.08]' : 'hover:bg-bg/60 bg-transparent',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[12px] font-semibold leading-snug truncate flex-1 text-txt">{h.title}</span>
        <PriorityBadge priority={h.priority} />
      </div>
      {h.hypothesis && (
        <p className="text-[11px] text-txt-3 leading-snug mb-1.5 line-clamp-2">{h.hypothesis}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={h.status} />
        {h.verdict && <VerdictBadge verdict={h.verdict} />}
        {h.query_count > 0 && (
          <span className="text-[10px] text-txt-3 font-mono">{h.query_count}q</span>
        )}
        {h.finding_count > 0 && (
          <span className="text-[10px] text-txt-3 font-mono">{h.finding_count}f</span>
        )}
        <span className="text-[11px] text-txt-3 ml-auto">{timeAgo(h.updated_at)}</span>
      </div>
    </button>
  )
}

// ── query card ────────────────────────────────────────────────────────────────

function QueryCard({ q, onDelete }: { q: HuntQuery; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const phase = PHASE_META[q.phase] ?? { label: q.phase, color: '#6b7280' }
  const qtype = TYPE_META[q.query_type] ?? { label: q.query_type.toUpperCase() }

  function handleCopy() {
    copyToClipboard(q.query_text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <button onClick={() => setExpanded((v) => !v)} className="text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer p-0 flex-shrink-0">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={['transition-transform', expanded ? '' : '-rotate-90'].join(' ')}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <span className="text-[12px] font-semibold text-txt flex-1 truncate">{q.title}</span>
        <span className="text-[10px] font-bold px-1.5 py-[2px] rounded"
          style={{ color: phase.color, background: phase.color + '20' }}>
          {phase.label.toUpperCase()}
        </span>
        <span className="text-[10px] font-bold tracking-[0.08em] text-txt-3 border border-border px-1.5 py-[2px] rounded">
          {qtype.label}
        </span>
        {q.technique_id && (
          <a href={`https://attack.mitre.org/techniques/${q.technique_id.replace('.', '/')}/`}
            target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-mono text-accent hover:opacity-80 no-underline">
            {q.technique_id}
          </a>
        )}
        <button
          onClick={onDelete}
          className="text-txt-3 hover:text-red transition-colors bg-transparent border-none cursor-pointer p-0 ml-1"
          title="Delete query"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {expanded && (
        <div className="p-3">
          <div className="relative">
            <pre className="bg-bg border border-border rounded p-3 text-[11.5px] font-mono text-txt leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {q.query_text}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded bg-surface border border-border text-txt-3 hover:text-accent hover:border-accent transition-colors cursor-pointer"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {q.false_positives && (
            <p className="text-[11px] text-txt-3 mt-2">
              <span className="font-semibold text-txt-2">FP note:</span> {q.false_positives}
            </p>
          )}
          {q.notes && (
            <p className="text-[11px] text-txt-3 mt-1">
              <span className="font-semibold text-txt-2">Tuning:</span> {q.notes}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── finding row ───────────────────────────────────────────────────────────────

function FindingRow({ f, onDelete, onStatusChange }: {
  f: HuntFinding
  onDelete: () => void
  onStatusChange: (status: FindingStatus) => void
}) {
  const m = FINDING_STATUS_META[f.status]
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border/50 group text-[11px]">
      <div className="flex-shrink-0 mt-0.5">
        <select
          value={f.status}
          onChange={(e) => onStatusChange(e.target.value as FindingStatus)}
          className="text-[10px] font-bold px-1.5 py-[2px] rounded border-none outline-none cursor-pointer"
          style={{ background: m.bg, color: m.color }}
        >
          <option value="benign">BENIGN</option>
          <option value="suspicious">SUSPICIOUS</option>
          <option value="malicious">MALICIOUS</option>
        </select>
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-4 gap-y-0.5">
        {f.timestamp_utc && (
          <span className="font-mono text-txt-3 col-span-2">{f.timestamp_utc}</span>
        )}
        {f.host && <span><span className="text-txt-3">host:</span> <span className="font-mono text-txt">{f.host}</span></span>}
        {f.user_field && <span><span className="text-txt-3">user:</span> <span className="font-mono text-txt">{f.user_field}</span></span>}
        {f.indicator && <span className="col-span-2"><span className="text-txt-3">indicator:</span> <span className="font-mono text-txt break-all">{f.indicator}</span></span>}
        {f.tactic && <span><span className="text-txt-3">tactic:</span> <span className="text-txt">{f.tactic}</span></span>}
        {f.notes && <span className="col-span-2 text-txt-2 mt-1">{f.notes}</span>}
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-txt-3 hover:text-red bg-transparent border-none cursor-pointer p-0 flex-shrink-0 mt-0.5"
        title="Delete finding"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ── add query form ────────────────────────────────────────────────────────────

function AddQueryForm({ huntId, platform, onSaved, onCancel }: {
  huntId: string
  platform: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [phase, setPhase] = useState<QueryPhase>('anomaly-detection')
  const [queryType, setQueryType] = useState<QueryType>('broad')
  const [techniqueId, setTechniqueId] = useState('')
  const [queryText, setQueryText] = useState('')
  const [falsePosNote, setFalsePosNote] = useState('')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.addHuntQuery(huntId, {
      title: title.trim(),
      phase,
      query_type: queryType,
      technique_id: techniqueId.trim(),
      query_text: queryText.trim(),
      platform,
      false_positives: falsePosNote.trim(),
      notes: notes.trim(),
    }),
    onSuccess: onSaved,
  })

  return (
    <div className="p-4 border border-border rounded-lg bg-surface flex flex-col gap-3">
      <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">Add Query</p>

      <input value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Query title"
        className="w-full bg-bg border border-border rounded text-txt text-[12px] px-3 py-2 outline-none focus:border-accent" />

      <div className="flex gap-2 flex-wrap">
        {(Object.keys(PHASE_META) as QueryPhase[]).map((p) => (
          <button key={p} type="button" onClick={() => setPhase(p)}
            className="text-[11px] font-bold px-2 py-1 rounded border cursor-pointer transition-all"
            style={{
              background: phase === p ? PHASE_META[p].color + '20' : 'transparent',
              color: PHASE_META[p].color,
              borderColor: phase === p ? PHASE_META[p].color + '80' : 'var(--border)',
            }}>
            {PHASE_META[p].label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(['broad', 'focused', 'pivot'] as QueryType[]).map((t) => (
          <button key={t} type="button" onClick={() => setQueryType(t)}
            className="text-[11px] font-bold px-2 py-1 rounded border cursor-pointer transition-all"
            style={{
              background: queryType === t ? '#6b728020' : 'transparent',
              color: queryType === t ? 'var(--text)' : 'var(--text-3)',
              borderColor: queryType === t ? 'var(--border2)' : 'var(--border)',
            }}>
            {t.toUpperCase()}
          </button>
        ))}
        <input value={techniqueId} onChange={(e) => setTechniqueId(e.target.value)}
          placeholder="T1059.001"
          className="ml-auto bg-bg border border-border rounded text-txt font-mono text-[11px] px-2 py-1 outline-none focus:border-accent w-28" />
      </div>

      <textarea value={queryText} onChange={(e) => setQueryText(e.target.value)}
        placeholder={`Enter your ${platform} query here…`}
        rows={6}
        className="w-full bg-bg border border-border rounded text-txt font-mono text-[11.5px] px-3 py-2 outline-none focus:border-accent resize-y" />

      <input value={falsePosNote} onChange={(e) => setFalsePosNote(e.target.value)}
        placeholder="False positive scenarios (optional)"
        className="w-full bg-bg border border-border rounded text-txt text-[12px] px-3 py-2 outline-none focus:border-accent" />

      <input value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Tuning notes (optional)"
        className="w-full bg-bg border border-border rounded text-txt text-[12px] px-3 py-2 outline-none focus:border-accent" />

      <div className="flex items-center gap-3">
        <button
          onClick={() => mutation.mutate()}
          disabled={!title.trim() || !queryText.trim() || mutation.isPending}
          className="px-3 py-1.5 text-[11px] font-bold rounded bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white border-none cursor-pointer disabled:opacity-40"
        >
          {mutation.isPending ? 'Saving…' : 'Save Query'}
        </button>
        <button onClick={onCancel} className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── add finding form ──────────────────────────────────────────────────────────

function AddFindingForm({ huntId, onSaved, onCancel }: {
  huntId: string; onSaved: () => void; onCancel: () => void
}) {
  const [host, setHost] = useState('')
  const [user, setUser] = useState('')
  const [indicator, setIndicator] = useState('')
  const [tactic, setTactic] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<FindingStatus>('suspicious')

  const mutation = useMutation({
    mutationFn: () => api.addHuntFinding(huntId, { host, user_field: user, indicator, tactic, notes, status }),
    onSuccess: onSaved,
  })

  return (
    <div className="p-4 border border-border rounded-lg bg-surface flex flex-col gap-3">
      <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase">Add Finding</p>
      <div className="grid grid-cols-2 gap-3">
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="Host / device"
          className="bg-bg border border-border rounded text-txt text-[12px] px-3 py-2 outline-none focus:border-accent" />
        <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="User account"
          className="bg-bg border border-border rounded text-txt text-[12px] px-3 py-2 outline-none focus:border-accent" />
      </div>
      <input value={indicator} onChange={(e) => setIndicator(e.target.value)} placeholder="Process, IOC, command line, or indicator"
        className="w-full bg-bg border border-border rounded text-txt font-mono text-[11px] px-3 py-2 outline-none focus:border-accent" />
      <input value={tactic} onChange={(e) => setTactic(e.target.value)} placeholder="MITRE tactic / technique (optional)"
        className="w-full bg-bg border border-border rounded text-txt text-[12px] px-3 py-2 outline-none focus:border-accent" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Analyst notes" rows={2}
        className="w-full bg-bg border border-border rounded text-txt text-[12px] px-3 py-2 outline-none focus:border-accent resize-none" />
      <div className="flex gap-2">
        {(['benign', 'suspicious', 'malicious'] as FindingStatus[]).map((s) => {
          const m = FINDING_STATUS_META[s]
          return (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className="text-[11px] font-bold px-2 py-1 rounded border cursor-pointer transition-all"
              style={{
                background: status === s ? m.bg : 'transparent',
                color: m.color,
                borderColor: status === s ? m.color + '80' : 'var(--border)',
              }}>
              {m.label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => mutation.mutate()}
          disabled={(!host && !indicator) || mutation.isPending}
          className="px-3 py-1.5 text-[11px] font-bold rounded bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white border-none cursor-pointer disabled:opacity-40"
        >
          {mutation.isPending ? 'Saving…' : 'Add Finding'}
        </button>
        <button onClick={onCancel} className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── generated query card (used in GeneratePanel to avoid hook-in-map) ────────

function GeneratedQueryCard({ q, index, saving, saved, onSave }: {
  q: GeneratedHuntQuery
  index: number
  saving: boolean
  saved: boolean
  onSave: () => void
}) {
  const [copied, setCopied] = useState(false)
  const phase = PHASE_META[q.phase] ?? { label: q.phase, color: '#6b7280' }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <span className="text-[12px] font-semibold text-txt flex-1 truncate">{q.title}</span>
        <span className="text-[10px] font-bold px-1.5 py-[2px] rounded"
          style={{ color: phase.color, background: phase.color + '20' }}>
          {phase.label.toUpperCase()}
        </span>
        {q.technique_id && (
          <span className="text-[10px] font-mono text-accent">{q.technique_id}</span>
        )}
        <button
          onClick={onSave}
          disabled={saving || saved}
          className="text-[11px] font-bold px-2 py-1 rounded border cursor-pointer transition-all disabled:opacity-40"
          style={{
            color: saved ? '#22c55e' : 'var(--accent)',
            borderColor: saved ? '#22c55e80' : 'var(--accent)60',
          }}
        >
          {saved ? 'Saved' : saving ? '…' : 'Save'}
        </button>
      </div>
      <div className="p-3">
        <div className="relative">
          <pre className="bg-bg border border-border rounded p-3 text-[11.5px] font-mono text-txt leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {q.query_text}
          </pre>
          <button
            onClick={() => { copyToClipboard(q.query_text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
            className="absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded bg-surface border border-border text-txt-3 hover:text-accent hover:border-accent transition-colors cursor-pointer"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {q.false_positives && (
          <p className="text-[11px] text-txt-3 mt-2">
            <span className="font-semibold text-txt-2">FP note:</span> {q.false_positives}
          </p>
        )}
      </div>
    </div>
  )
}

// ── generate panel ────────────────────────────────────────────────────────────

function GeneratePanel({ hunt, onPlanSaved }: { hunt: Hunt; onPlanSaved: () => void }) {
  const qc = useQueryClient()
  const [additionalContext, setAdditionalContext] = useState('')
  const [plan, setPlan] = useState<GeneratedHuntPlan | null>(null)
  const [savingQueries, setSavingQueries] = useState<Set<number>>(new Set())
  const [savedQueries, setSavedQueries] = useState<Set<number>>(new Set())

  const generateMut = useMutation({
    mutationFn: () => api.generateHuntPlan(hunt.id, additionalContext),
    onSuccess: (data) => { setPlan(data); setSavedQueries(new Set()) },
  })

  async function saveQuery(index: number, q: GeneratedHuntQuery) {
    setSavingQueries((prev) => new Set(prev).add(index))
    try {
      await api.addHuntQuery(hunt.id, {
        title: q.title,
        phase: q.phase,
        query_type: q.query_type,
        technique_id: q.technique_id,
        query_text: q.query_text,
        platform: hunt.platform,
        false_positives: q.false_positives,
        notes: q.notes,
      })
      setSavedQueries((prev) => new Set(prev).add(index))
      qc.invalidateQueries({ queryKey: ['hunt', hunt.id] })
      qc.invalidateQueries({ queryKey: ['hunts'] })
      onPlanSaved()
    } finally {
      setSavingQueries((prev) => { const s = new Set(prev); s.delete(index); return s })
    }
  }

  async function saveMitre() {
    if (!plan) return
    const existing = hunt.mitre_techniques.map((t) => t.id)
    const newTechs = plan.mitre_techniques.filter((t) => !existing.includes(t.id))
    if (!newTechs.length) return
    await api.updateHunt(hunt.id, { mitre_techniques: [...hunt.mitre_techniques, ...newTechs] })
    qc.invalidateQueries({ queryKey: ['hunt', hunt.id] })
    qc.invalidateQueries({ queryKey: ['hunts'] })
  }

  async function saveAllQueries() {
    if (!plan) return
    for (let i = 0; i < plan.queries.length; i++) {
      if (!savedQueries.has(i)) await saveQuery(i, plan.queries[i])
    }
  }

  return (
    <div className="p-6 flex flex-col gap-5">
      <div>
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-1">AI-Assisted</p>
        <h3 className="text-[15px] font-bold text-txt">Generate Hunt Plan</h3>
        <p className="text-[12px] text-txt-3 mt-1">
          Claude will analyse the hunt hypothesis and intel source, then generate hypotheses, MITRE mappings, and platform-specific hunt queries.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4 grid grid-cols-2 gap-3 text-[12px]">
        <div><span className="text-txt-3">Hypothesis:</span> <span className="text-txt">{hunt.hypothesis || '(not set)'}</span></div>
        <div><span className="text-txt-3">Platform:</span> <span className="text-txt">{hunt.platform}</span></div>
        {hunt.intel_source && (
          <div className="col-span-2"><span className="text-txt-3">Intel source:</span> <span className="text-txt truncate">{hunt.intel_source}</span></div>
        )}
      </div>

      <div>
        <label className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 uppercase block mb-1.5">Additional Context (optional)</label>
        <textarea
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          placeholder="Paste threat intel, IOCs, actor TTPs, or any additional context to improve the generated queries…"
          rows={4}
          className="w-full bg-bg border border-border rounded-lg text-txt text-[12px] px-3 py-2.5 outline-none focus:border-accent transition-colors resize-none placeholder:text-txt-3"
        />
      </div>

      <button
        onClick={() => generateMut.mutate()}
        disabled={generateMut.isPending}
        className="self-start flex items-center gap-2 px-4 py-2 text-[12px] font-bold rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white border-none cursor-pointer disabled:opacity-50 transition-opacity hover:opacity-90"
      >
        {generateMut.isPending ? (
          <>
            <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Generate Hunt Plan
          </>
        )}
      </button>

      {generateMut.isError && (
        <div className="text-[12px] text-red bg-red/10 border border-red/20 rounded-lg px-4 py-3">
          Generation failed. Check that your Anthropic API key is configured in Settings.
        </div>
      )}

      {/* Results */}
      {plan && (
        <div className="flex flex-col gap-5 border-t border-border pt-5">
          {/* Hypotheses */}
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Generated Hypotheses</p>
            <div className="flex flex-col gap-3">
              {plan.hypotheses.map((h, i) => (
                <div key={i} className="bg-surface border border-border rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className={['text-[10px] font-bold px-1.5 py-[2px] rounded flex-shrink-0', i === 0 ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'bg-[#6b7280]/20 text-[#6b7280]'].join(' ')}>
                      {i === 0 ? 'PRIMARY' : 'BACKLOG'}
                    </span>
                    <p className="text-[12px] font-semibold text-txt leading-snug">{h.title}</p>
                  </div>
                  <p className="text-[11px] text-txt-3 mb-2">{h.rationale}</p>
                  <div className="flex gap-2 flex-wrap">
                    <a href={`https://attack.mitre.org/techniques/${h.mitre_id.replace('.', '/')}/`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-mono text-accent no-underline hover:opacity-80">
                      {h.mitre_id}
                    </a>
                    <span className="text-[10px] text-txt-3">{h.mitre_name}</span>
                    <span className="text-[10px] text-txt-3">{h.tactic}</span>
                    <span className="text-[10px] font-bold ml-auto" style={{ color: h.priority === 'high' ? '#f59e0b' : h.priority === 'low' ? '#6b7280' : '#3b82f6' }}>
                      {h.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MITRE */}
          {plan.mitre_techniques.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">MITRE Techniques</p>
                <button onClick={saveMitre}
                  className="text-[11px] font-bold text-accent hover:opacity-80 bg-transparent border-none cursor-pointer">
                  + Add to hunt
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {plan.mitre_techniques.map((t) => (
                  <span key={t.id} className="text-[11px] font-mono bg-surface border border-border rounded px-2 py-1">
                    <span className="text-accent">{t.id}</span>
                    <span className="text-txt-3 ml-1">{t.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Methodology */}
          {plan.methodology && (
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-2">Hunt Methodology</p>
              <div className="bg-surface border border-border rounded-lg p-4">
                {plan.methodology.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className="text-[12px] text-txt leading-relaxed mb-1 last:mb-0">{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* Queries */}
          {plan.queries.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">Hunt Queries ({plan.queries.length})</p>
                <button onClick={saveAllQueries}
                  className="text-[11px] font-bold text-accent hover:opacity-80 bg-transparent border-none cursor-pointer">
                  Save all to hunt
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {plan.queries.map((q, i) => (
                  <GeneratedQueryCard
                    key={i}
                    q={q}
                    index={i}
                    saving={savingQueries.has(i)}
                    saved={savedQueries.has(i)}
                    onSave={() => saveQuery(i, q)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── hunt detail ───────────────────────────────────────────────────────────────

type HuntTab = 'overview' | 'queries' | 'findings' | 'notes' | 'generate' | 'timeline'

function HuntDetail({ huntId, onDeleted }: { huntId: string; onDeleted: () => void }) {
  const qc = useQueryClient()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [showAddQuery, setShowAddQuery] = useState(false)
  const [showAddFinding, setShowAddFinding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeTab, setActiveTab] = useState<HuntTab>('overview')
  const [phaseFilter, setPhaseFilter] = useState<QueryPhase | 'all'>('all')
  const [addMitreInput, setAddMitreInput] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  const { data: hunt, isLoading } = useQuery({
    queryKey: ['hunt', huntId],
    queryFn: () => api.getHunt(huntId),
  })

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus()
  }, [editingTitle])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hunt', huntId] })
    qc.invalidateQueries({ queryKey: ['hunts'] })
  }

  const updateMut = useMutation({
    mutationFn: (updates: Parameters<typeof api.updateHunt>[1]) => api.updateHunt(huntId, updates),
    onSuccess: invalidate,
  })

  const deleteHuntMut = useMutation({
    mutationFn: () => api.deleteHunt(huntId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hunts'] }); onDeleted() },
  })

  const addNoteMut = useMutation({
    mutationFn: (content: string) => api.addHuntNote(huntId, content),
    onSuccess: () => { invalidate(); setNoteInput('') },
  })

  const deleteNoteMut = useMutation({
    mutationFn: (noteId: string) => api.deleteHuntNote(huntId, noteId),
    onSuccess: invalidate,
  })

  const deleteQueryMut = useMutation({
    mutationFn: (queryId: string) => api.deleteHuntQuery(huntId, queryId),
    onSuccess: invalidate,
  })

  const updateFindingMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<HuntFinding> }) =>
      api.updateHuntFinding(huntId, id, updates),
    onSuccess: invalidate,
  })

  const deleteFindingMut = useMutation({
    mutationFn: (findingId: string) => api.deleteHuntFinding(huntId, findingId),
    onSuccess: invalidate,
  })

  function commitTitle() {
    if (!hunt) return
    setEditingTitle(false)
    if (titleDraft.trim() && titleDraft.trim() !== hunt.title) {
      updateMut.mutate({ title: titleDraft.trim() })
    }
  }

  function addMitreTechnique() {
    if (!hunt || !addMitreInput.trim()) return
    const id = addMitreInput.trim().toUpperCase()
    if (hunt.mitre_techniques.some((t) => t.id === id)) { setAddMitreInput(''); return }
    const newTech: MitreTechnique = { id, name: '', tactic: '' }
    updateMut.mutate({ mitre_techniques: [...hunt.mitre_techniques, newTech] })
    setAddMitreInput('')
  }

  function removeMitreTechnique(id: string) {
    if (!hunt) return
    updateMut.mutate({ mitre_techniques: hunt.mitre_techniques.filter((t) => t.id !== id) })
  }

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center gap-2 text-txt-3 text-[11px]">
      <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
      Loading hunt…
    </div>
  )

  if (!hunt) return (
    <div className="flex-1 flex items-center justify-center text-txt-3 text-[13px]">Hunt not found.</div>
  )

  const filteredQueries = phaseFilter === 'all'
    ? (hunt.queries ?? [])
    : (hunt.queries ?? []).filter((q) => q.phase === phaseFilter)

  const timeline: { id: string; kind: 'created' | 'note' | 'query' | 'finding'; ts: string; data?: HuntNote | HuntQuery | HuntFinding }[] = [
    { id: 'created', kind: 'created', ts: hunt.created_at },
    ...(hunt.notes ?? []).map((n) => ({ id: n.id, kind: 'note' as const, ts: n.created_at, data: n })),
    ...(hunt.queries ?? []).map((q) => ({ id: q.id, kind: 'query' as const, ts: q.created_at, data: q })),
    ...(hunt.findings ?? []).map((f) => ({ id: f.id, kind: 'finding' as const, ts: f.created_at, data: f })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  const TABS: { key: HuntTab; label: string; count?: number }[] = [
    { key: 'overview',  label: 'Overview' },
    { key: 'queries',   label: 'Queries',  count: hunt.query_count },
    { key: 'findings',  label: 'Findings', count: hunt.finding_count },
    { key: 'notes',     label: 'Notes',    count: hunt.note_count },
    { key: 'generate',  label: 'Generate' },
    { key: 'timeline',  label: 'Timeline' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Hunt header ── */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
            className="w-full text-[18px] font-bold text-txt bg-bg border border-accent rounded-md px-2 py-1 outline-none mb-3"
          />
        ) : (
          <h2
            className="text-[18px] font-bold text-txt cursor-text hover:text-txt-2 transition-colors leading-tight mb-2"
            onClick={() => { setTitleDraft(hunt.title); setEditingTitle(true) }}
            title="Click to edit"
          >
            {hunt.title}
          </h2>
        )}

        {/* Hypothesis */}
        {hunt.hypothesis && (
          <p className="text-[12px] text-txt-2 italic mb-3 leading-snug">{hunt.hypothesis}</p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={hunt.status}
            onChange={(e) => updateMut.mutate({ status: e.target.value as HuntStatus })}
            className="text-[11px] font-bold tracking-[0.08em] px-2 py-[3px] rounded border-none outline-none cursor-pointer"
            style={{ background: STATUS_META[hunt.status].bg, color: STATUS_META[hunt.status].color }}>
            <option value="planning">PLANNING</option>
            <option value="in-progress">IN PROGRESS</option>
            <option value="complete">COMPLETE</option>
            <option value="escalated">ESCALATED</option>
          </select>

          <select value={hunt.priority}
            onChange={(e) => updateMut.mutate({ priority: e.target.value as HuntPriority })}
            className="text-[11px] font-bold tracking-[0.08em] px-2 py-[3px] rounded border-none outline-none cursor-pointer"
            style={{ background: PRIORITY_META[hunt.priority].bg, color: PRIORITY_META[hunt.priority].color }}>
            <option value="critical">CRITICAL</option>
            <option value="high">HIGH</option>
            <option value="medium">MEDIUM</option>
            <option value="low">LOW</option>
          </select>

          <select value={hunt.verdict ?? ''}
            onChange={(e) => updateMut.mutate({ verdict: (e.target.value || null) as HuntVerdict | null })}
            className="text-[11px] font-bold tracking-[0.08em] px-2 py-[3px] rounded border border-border outline-none cursor-pointer bg-bg text-txt-2">
            <option value="">Verdict: none</option>
            <option value="not-found">NOT FOUND</option>
            <option value="unconfirmed">UNCONFIRMED</option>
            <option value="suspicious">SUSPICIOUS</option>
            <option value="confirmed">CONFIRMED</option>
          </select>

          <span className="text-[11px] text-txt-3 font-mono px-2 py-[3px] rounded bg-surface border border-border">
            {hunt.platform}
          </span>

          <span className="text-[10px] text-txt-3 font-mono ml-auto">{timeAgo(hunt.created_at)}</span>

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button onClick={() => deleteHuntMut.mutate()} className="text-[11px] font-bold text-red hover:opacity-80 bg-transparent border-none cursor-pointer">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-[11px] text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-[11px] text-txt-3 hover:text-red transition-colors bg-transparent border-none cursor-pointer">
              Delete hunt
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-border flex-shrink-0 px-6">
        {TABS.map(({ key, label, count }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={[
              'text-[11px] font-bold tracking-[0.08em] uppercase py-2.5 mr-5 border-b-2 transition-colors bg-transparent cursor-pointer',
              activeTab === key ? 'border-[#3b82f6] text-[#3b82f6]' : 'border-transparent text-txt-3 hover:text-txt-2',
            ].join(' ')}>
            {label}
            {count != null && count > 0 && (
              <span className="ml-1.5 text-[11px] font-bold px-1 py-0.5 rounded-full bg-[#3b82f6]/15 text-[#3b82f6] leading-none">
                {count}
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
            {/* Hypothesis editor */}
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-2">Hypothesis</p>
              <HypothesisEditor value={hunt.hypothesis} onSave={(v) => updateMut.mutate({ hypothesis: v })} />
            </div>

            {/* Description */}
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-2">Description / Context</p>
              <DescriptionEditor value={hunt.description} onSave={(v) => updateMut.mutate({ description: v })} />
            </div>

            {/* Intel source */}
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-2">Intel Source</p>
              <IntelSourceEditor value={hunt.intel_source} onSave={(v) => updateMut.mutate({ intel_source: v })} />
            </div>

            {/* Settings row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-1.5">Platform</p>
                <select value={hunt.platform} onChange={(e) => updateMut.mutate({ platform: e.target.value })}
                  className="w-full bg-bg border border-border rounded-md text-txt text-[12px] px-3 py-2 outline-none focus:border-accent">
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-1.5">Timeframe</p>
                <select value={hunt.timeframe} onChange={(e) => updateMut.mutate({ timeframe: e.target.value })}
                  className="w-full bg-bg border border-border rounded-md text-txt text-[12px] px-3 py-2 outline-none focus:border-accent">
                  {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* MITRE techniques */}
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-2">MITRE ATT&amp;CK Techniques</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {hunt.mitre_techniques.length === 0 && (
                  <span className="text-[11px] text-txt-3 italic">No techniques mapped yet.</span>
                )}
                {hunt.mitre_techniques.map((t) => (
                  <div key={t.id} className="flex items-center gap-1 bg-surface border border-border rounded px-2 py-1">
                    <a href={`https://attack.mitre.org/techniques/${t.id.replace('.', '/')}/`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[11px] font-mono text-accent no-underline hover:opacity-80">
                      {t.id}
                    </a>
                    {t.name && <span className="text-[11px] text-txt-3">{t.name}</span>}
                    {t.tactic && <span className="text-[10px] text-txt-3">({t.tactic})</span>}
                    <button onClick={() => removeMitreTechnique(t.id)}
                      className="text-txt-3 hover:text-red bg-transparent border-none cursor-pointer p-0 ml-1">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={addMitreInput}
                  onChange={(e) => setAddMitreInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addMitreTechnique() }}
                  placeholder="T1059.001"
                  className="bg-bg border border-border rounded text-txt font-mono text-[11px] px-2 py-1 outline-none focus:border-accent w-28"
                />
                <button onClick={addMitreTechnique}
                  className="text-[11px] font-bold text-accent hover:opacity-80 bg-transparent border-none cursor-pointer">
                  + Add
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Queries',  value: hunt.query_count },
                { label: 'Findings', value: hunt.finding_count },
                { label: 'Notes',    value: hunt.note_count },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface border border-border rounded-lg p-3">
                  <p className="text-[11px] font-bold tracking-[0.15em] text-txt-3 uppercase mb-1">{label}</p>
                  <p className="text-[16px] font-bold text-txt">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Queries tab */}
        {activeTab === 'queries' && (
          <div className="flex flex-col">
            {/* Phase filter */}
            <div className="px-4 py-3 border-b border-border flex gap-2 flex-wrap">
              <button onClick={() => setPhaseFilter('all')}
                className={['text-[11px] font-bold px-2 py-1 rounded border cursor-pointer transition-all', phaseFilter === 'all' ? 'border-border2 text-txt bg-surface' : 'border-border text-txt-3 hover:border-border2'].join(' ')}>
                All
              </button>
              {(Object.keys(PHASE_META) as QueryPhase[]).map((p) => (
                <button key={p} onClick={() => setPhaseFilter(p)}
                  className="text-[11px] font-bold px-2 py-1 rounded border cursor-pointer transition-all"
                  style={{
                    background: phaseFilter === p ? PHASE_META[p].color + '20' : 'transparent',
                    color: phaseFilter === p ? PHASE_META[p].color : 'var(--text-3)',
                    borderColor: phaseFilter === p ? PHASE_META[p].color + '80' : 'var(--border)',
                  }}>
                  {PHASE_META[p].label}
                </button>
              ))}
              <button onClick={() => setShowAddQuery(true)}
                className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Query
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {showAddQuery && (
                <AddQueryForm
                  huntId={huntId}
                  platform={hunt.platform}
                  onSaved={() => { invalidate(); setShowAddQuery(false) }}
                  onCancel={() => setShowAddQuery(false)}
                />
              )}
              {filteredQueries.length === 0 && !showAddQuery && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <div>
                    <p className="text-[13px] font-semibold text-txt-2">No queries yet</p>
                    <p className="text-[11px] text-txt-3 mt-1">Use the Generate tab to create AI-powered hunt queries, or add one manually.</p>
                  </div>
                </div>
              )}
              {filteredQueries.map((q) => (
                <QueryCard key={q.id} q={q} onDelete={() => deleteQueryMut.mutate(q.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Findings tab */}
        {activeTab === 'findings' && (
          <div className="flex flex-col">
            <div className="p-4 border-b border-border">
              {showAddFinding ? (
                <AddFindingForm
                  huntId={huntId}
                  onSaved={() => { invalidate(); setShowAddFinding(false) }}
                  onCancel={() => setShowAddFinding(false)}
                />
              ) : (
                <button onClick={() => setShowAddFinding(true)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Record Finding
                </button>
              )}
            </div>
            {(hunt.findings ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <div>
                  <p className="text-[13px] font-semibold text-txt-2">No findings yet</p>
                  <p className="text-[11px] text-txt-3 mt-1">Record evidence, anomalies, or confirmed activity found during the hunt.</p>
                </div>
              </div>
            ) : (
              <div>
                {[...(hunt.findings ?? [])].reverse().map((f) => (
                  <FindingRow
                    key={f.id}
                    f={f}
                    onDelete={() => deleteFindingMut.mutate(f.id)}
                    onStatusChange={(status) => updateFindingMut.mutate({ id: f.id, updates: { status } })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes tab */}
        {activeTab === 'notes' && (
          <div className="flex flex-col">
            <div className="p-4 border-b border-border flex-shrink-0">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && noteInput.trim()) addNoteMut.mutate(noteInput) }}
                placeholder="Add an observation or analyst note… (Ctrl+Enter to submit)"
                rows={3}
                className="w-full bg-bg border border-border rounded-lg text-txt text-[12px] px-3 py-2.5 outline-none focus:border-accent transition-colors resize-none placeholder:text-txt-3"
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => { if (noteInput.trim()) addNoteMut.mutate(noteInput) }}
                  disabled={!noteInput.trim() || addNoteMut.isPending}
                  className="px-3 py-1.5 text-[11px] font-bold rounded bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white border-none cursor-pointer disabled:opacity-40"
                >
                  {addNoteMut.isPending ? 'Adding…' : 'Add Note'}
                </button>
              </div>
            </div>
            {(hunt.notes ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <div>
                  <p className="text-[13px] font-semibold text-txt-2">No notes yet</p>
                  <p className="text-[11px] text-txt-3 mt-1">Record hypotheses, observations, and analyst commentary.</p>
                </div>
              </div>
            ) : (
              <div>
                {[...(hunt.notes ?? [])].reverse().map((n) => (
                  <div key={n.id} className="group relative px-4 py-3 border-b border-border/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-txt-3 font-mono">
                        {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button onClick={() => deleteNoteMut.mutate(n.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-txt-3 hover:text-red bg-transparent border-none cursor-pointer p-0">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-[12px] text-txt leading-relaxed whitespace-pre-wrap">{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Generate tab */}
        {activeTab === 'generate' && (
          <GeneratePanel hunt={hunt} onPlanSaved={invalidate} />
        )}

        {/* Timeline tab */}
        {activeTab === 'timeline' && (
          <div className="p-6">
            <div className="relative">
              <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />
              <div className="flex flex-col gap-4">
                {timeline.map((item) => {
                  const note = item.kind === 'note' ? (item.data as HuntNote) : null
                  const query = item.kind === 'query' ? (item.data as HuntQuery) : null
                  const finding = item.kind === 'finding' ? (item.data as HuntFinding) : null
                  const dotColor =
                    item.kind === 'created' ? 'bg-green border-green/40'
                    : item.kind === 'note' ? 'bg-[#3b82f6] border-[#3b82f6]/40'
                    : item.kind === 'query' ? 'bg-[#a855f7] border-[#a855f7]/40'
                    : 'bg-[#f59e0b] border-[#f59e0b]/40'
                  return (
                    <div key={item.id} className="flex items-start gap-4">
                      <div className={`w-[15px] h-[15px] rounded-full border-2 flex-shrink-0 mt-0.5 ${dotColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {item.kind === 'created' && <span className="text-[11px] font-bold text-txt-2">Hunt created</span>}
                          {item.kind === 'note' && <span className="text-[11px] font-bold text-txt-2">Note added</span>}
                          {item.kind === 'query' && <span className="text-[11px] font-bold text-txt-2">Query saved</span>}
                          {item.kind === 'finding' && <span className="text-[11px] font-bold text-txt-2">Finding recorded</span>}
                          <span className="text-[10px] text-txt-3 font-mono ml-auto">
                            {new Date(item.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {note && <p className="text-[11px] text-txt-2 leading-relaxed line-clamp-2">{note.content}</p>}
                        {query && <p className="text-[11px] font-mono text-txt-2 truncate">{query.title}</p>}
                        {finding && (
                          <p className="text-[11px] font-mono text-txt-2 truncate">
                            {[finding.host, finding.indicator].filter(Boolean).join(' — ')}
                          </p>
                        )}
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

// ── inline editors ────────────────────────────────────────────────────────────

function HypothesisEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() { setEditing(false); if (draft !== value) onSave(draft) }

  if (editing) {
    return (
      <div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          rows={3} autoFocus
          className="w-full bg-bg border border-accent rounded-lg text-txt text-[12px] px-3 py-2.5 outline-none resize-none italic" />
        <p className="text-[11px] text-txt-3 mt-1">Click outside to save</p>
      </div>
    )
  }

  return (
    <div onClick={() => { setDraft(value); setEditing(true) }}
      className={['min-h-[44px] rounded-lg px-3 py-2.5 cursor-text transition-colors border', value ? 'border-transparent hover:border-border' : 'border-border border-dashed'].join(' ')}>
      {value
        ? <p className="text-[12px] text-txt-2 leading-relaxed italic whitespace-pre-wrap">{value}</p>
        : <p className="text-[12px] text-txt-3 italic">Click to enter the hunt hypothesis…</p>
      }
    </div>
  )
}

function DescriptionEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() { setEditing(false); if (draft !== value) onSave(draft) }

  if (editing) {
    return (
      <div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          rows={4} autoFocus
          className="w-full bg-bg border border-accent rounded-lg text-txt text-[12px] px-3 py-2.5 outline-none resize-none" />
        <p className="text-[11px] text-txt-3 mt-1">Click outside to save</p>
      </div>
    )
  }

  return (
    <div onClick={() => { setDraft(value); setEditing(true) }}
      className={['min-h-[56px] rounded-lg px-3 py-2.5 cursor-text transition-colors border', value ? 'border-transparent hover:border-border' : 'border-border border-dashed'].join(' ')}>
      {value
        ? <p className="text-[12px] text-txt leading-relaxed whitespace-pre-wrap">{value}</p>
        : <p className="text-[12px] text-txt-3 italic">Click to add context, intel notes, or scope…</p>
      }
    </div>
  )
}

function IntelSourceEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() { setEditing(false); if (draft !== value) onSave(draft) }

  if (editing) {
    return (
      <div>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} autoFocus
          placeholder="URL, threat actor name, TTP list, or IOCs…"
          className="w-full bg-bg border border-accent rounded-lg text-txt text-[12px] px-3 py-2 outline-none" />
        <p className="text-[11px] text-txt-3 mt-1">Click outside to save</p>
      </div>
    )
  }

  const isUrl = value.startsWith('http://') || value.startsWith('https://')

  return (
    <div onClick={!isUrl ? () => { setDraft(value); setEditing(true) } : undefined}
      className={['min-h-[36px] rounded-lg px-3 py-2 transition-colors border', value ? 'border-transparent hover:border-border' : 'border-border border-dashed', !isUrl ? 'cursor-text' : ''].join(' ')}>
      {value ? (
        isUrl
          ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent break-all"
              onClick={(e) => e.stopPropagation()}>{value}</a>
          : <p className="text-[12px] text-txt">{value}</p>
      ) : (
        <p className="text-[12px] text-txt-3 italic cursor-text" onClick={() => { setDraft(value); setEditing(true) }}>
          Click to set intel source (URL, actor name, or context)…
        </p>
      )}
      {value && (
        <button onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true) }}
          className="text-[10px] text-txt-3 hover:text-accent ml-2 bg-transparent border-none cursor-pointer">
          edit
        </button>
      )}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | HuntStatus

export default function Hunts() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewHunt, setShowNewHunt] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['hunts', statusFilter],
    queryFn: () => api.listHunts(statusFilter === 'all' ? undefined : statusFilter),
  })

  const hunts = data?.hunts ?? []

  const counts = {
    all: hunts.length,
    'planning':    hunts.filter((h) => h.status === 'planning').length,
    'in-progress': hunts.filter((h) => h.status === 'in-progress').length,
    'complete':    hunts.filter((h) => h.status === 'complete').length,
    'escalated':   hunts.filter((h) => h.status === 'escalated').length,
  }

  function handleCreate(h: Hunt) {
    qc.invalidateQueries({ queryKey: ['hunts'] })
    setShowNewHunt(false)
    setSelectedId(h.id)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {showNewHunt && <NewHuntModal onClose={() => setShowNewHunt(false)} onCreate={handleCreate} />}

      {/* ── Left panel ── */}
      <div className="w-[300px] flex-shrink-0 border-r border-border flex flex-col h-full bg-surface/50">
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">Proactive</p>
              <p className="text-[15px] font-bold text-txt">Threat Hunts</p>
            </div>
            <button
              onClick={() => setShowNewHunt(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New
            </button>
          </div>

          <div className="flex gap-1 flex-wrap">
            {([
              { key: 'all',         label: 'All' },
              { key: 'planning',    label: 'Planning' },
              { key: 'in-progress', label: 'Active' },
              { key: 'complete',    label: 'Done' },
              { key: 'escalated',   label: 'Escalated' },
            ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={[
                  'text-[11px] font-bold tracking-[0.08em] px-2 py-1 rounded border transition-all cursor-pointer',
                  statusFilter === key
                    ? 'border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/10'
                    : 'border-border text-txt-3 bg-transparent hover:border-border2',
                ].join(' ')}
              >
                {label}
                {counts[key] > 0 && <span className="ml-1 opacity-70">{counts[key]}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center gap-2 text-txt-3 text-[11px] p-4">
              <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
              Loading…
            </div>
          )}
          {!isLoading && hunts.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              <div>
                <p className="text-[13px] font-semibold text-txt-2">No hunts yet</p>
                <p className="text-[11px] text-txt-3 mt-1">Create a hunt to start tracking a hypothesis-driven investigation.</p>
              </div>
            </div>
          )}
          {hunts.map((h) => (
            <HuntListItem
              key={h.id}
              h={h}
              selected={selectedId === h.id}
              onClick={() => setSelectedId(h.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      {selectedId ? (
        <HuntDetail
          key={selectedId}
          huntId={selectedId}
          onDeleted={() => setSelectedId(null)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <div>
            <p className="text-[13px] font-semibold text-txt-2">Select a hunt</p>
            <p className="text-[11px] text-txt-3 mt-1">Or create a new hunt to start tracking a hypothesis.</p>
          </div>
        </div>
      )}
    </div>
  )
}
