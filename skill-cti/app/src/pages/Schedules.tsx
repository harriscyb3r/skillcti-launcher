import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { SKILLS } from '../lib/skills'
import type { Schedule, CreateSchedule, ScheduleFrequency } from '../lib/types'

// ── Schedulable skills (those with a skillPath) ───────────────────────────────
const SCHEDULABLE = SKILLS.filter((s) => s.skillPath)

const FREQ_LABELS: Record<ScheduleFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOM_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i)

const MODEL_OPTS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku (fastest)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet (balanced)' },
  { id: 'claude-opus-4-7', label: 'Opus (strongest)' },
]

function formatUtcHour(h: number): string {
  const hh = h.toString().padStart(2, '0')
  return `${hh}:00 UTC`
}

function nextRunLabel(iso: string): string {
  const next = new Date(iso)
  const now = new Date()
  const diff = next.getTime() - now.getTime()
  if (diff < 0) return 'Overdue'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'tomorrow'
  return `in ${days}d`
}

function frequencyLine(s: Schedule): string {
  if (s.frequency === 'daily') return `Daily at ${formatUtcHour(s.hour)}`
  if (s.frequency === 'weekly')
    return `Every ${DOW_LABELS[s.day_of_week ?? 0]} at ${formatUtcHour(s.hour)}`
  return `Monthly on day ${s.day_of_month ?? 1} at ${formatUtcHour(s.hour)}`
}

// ── Badge chip ────────────────────────────────────────────────────────────────
function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="inline-block text-[8px] font-bold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded border leading-none flex-shrink-0"
      style={{ color, borderColor: color }}
    >
      {text}
    </span>
  )
}

// ── Schedule row in list ──────────────────────────────────────────────────────
function ScheduleRow({
  s,
  selected,
  onClick,
}: {
  s: Schedule
  selected: boolean
  onClick: () => void
}) {
  const overdue = new Date(s.next_run) < new Date()

  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-3 py-2.5 border-b border-border transition-all duration-150',
        'border-l-2',
        selected
          ? 'bg-purple/[0.08] border-l-purple'
          : 'border-l-transparent hover:bg-purple/[0.04]',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: s.enabled ? '#22c55e' : '#5f6368' }}
        />
        <Badge text={s.badge || s.format.toUpperCase()} color={s.badge_color} />
        <span className="text-[11px] font-semibold text-txt truncate">{s.skill_name}</span>
      </div>
      <p className="text-[10px] text-txt-3 ml-3.5">{frequencyLine(s)}</p>
      <p className={`text-[10px] ml-3.5 mt-0.5 ${overdue && s.enabled ? 'text-amber-400' : 'text-txt-3'}`}>
        Next: {nextRunLabel(s.next_run)}
        {s.last_run && (
          <span className="ml-2 opacity-60">
            · Last ran {nextRunLabel(s.last_run).replace('in ', '')} ago
          </span>
        )}
      </p>
    </button>
  )
}

// ── Create schedule form ──────────────────────────────────────────────────────
function CreateForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()

  const [skillId, setSkillId] = useState(SCHEDULABLE[0]?.id ?? '')
  const [message, setMessage] = useState('')
  const [format, setFormat] = useState<'html' | 'pdf' | 'pptx'>('html')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily')
  const [hour, setHour] = useState(8)
  const [dow, setDow] = useState(0)
  const [dom, setDom] = useState(1)
  const [enabled, setEnabled] = useState(true)
  const [err, setErr] = useState('')

  const selectedSkill = SCHEDULABLE.find((s) => s.id === skillId)

  const { mutate: create, isPending } = useMutation({
    mutationFn: (data: CreateSchedule) => api.createSchedule(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      onDone()
    },
    onError: (e: Error) => setErr(e.message),
  })

  function submit() {
    if (!selectedSkill) return
    if (!message.trim()) { setErr('User message is required'); return }
    setErr('')
    create({
      skill_id: selectedSkill.id,
      skill_name: selectedSkill.name,
      skill_path: selectedSkill.skillPath!,
      badge: selectedSkill.badge,
      badge_color: selectedSkill.badgeColor,
      user_message: message.trim(),
      format,
      model,
      max_tokens: selectedSkill.maxTokens ?? 8000,
      needs_search: selectedSkill.needsSearch ?? true,
      frequency,
      hour,
      day_of_week: frequency === 'weekly' ? dow : null,
      day_of_month: frequency === 'monthly' ? dom : null,
      enabled,
    })
  }

  const inputCls =
    'w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-[13px] text-txt focus:outline-none focus:border-purple/50'
  const labelCls = 'block text-[10px] font-bold tracking-[0.08em] text-txt-3 uppercase mb-1'

  return (
    <div className="p-5 flex flex-col gap-4">
      <div>
        <p className="text-[9px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-1">New Schedule</p>
        <h2 className="text-[14px] font-bold text-txt">Schedule a Report</h2>
        <p className="text-[11px] text-txt-2 mt-1">
          The backend will automatically generate and save this report at the configured time.
        </p>
      </div>

      {/* Skill */}
      <div>
        <label className={labelCls}>Skill</label>
        <select
          value={skillId}
          onChange={(e) => {
            setSkillId(e.target.value)
            setMessage('')
          }}
          className={inputCls}
        >
          {SCHEDULABLE.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {selectedSkill && (
          <p className="text-[10px] text-txt-3 mt-1">{selectedSkill.tagline}</p>
        )}
      </div>

      {/* User message */}
      <div>
        <label className={labelCls}>Report instructions</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder={
            selectedSkill?.id.includes('daily')
              ? 'Reporting window: last 24 hours from now'
              : selectedSkill?.id.includes('sector')
              ? 'Sector: Financial Services [Horizon: 12 months]'
              : 'Current month'
          }
          className={inputCls + ' resize-none'}
        />
        <p className="text-[10px] text-txt-3 mt-1">
          This message is sent verbatim to Claude each time the schedule fires.
          Write it as if you were telling Claude what report to generate — it will always refer
          to "current month" or "last 24 hours" relative to when it runs.
        </p>
      </div>

      {/* Format + Model */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as 'html' | 'pdf' | 'pptx')} className={inputCls}>
            <option value="html">HTML (saved to Reports)</option>
            <option value="pdf">PDF (download)</option>
            <option value="pptx">PPTX (download)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Model</label>
          <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
            {MODEL_OPTS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Frequency */}
      <div>
        <label className={labelCls}>Frequency</label>
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly'] as ScheduleFrequency[]).map((f) => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              className={[
                'flex-1 py-1.5 text-[10px] font-bold tracking-[0.08em] uppercase rounded border transition-colors',
                frequency === f
                  ? 'bg-purple/10 border-purple/40 text-purple'
                  : 'border-border text-txt-3 hover:border-border hover:text-txt-2',
              ].join(' ')}
            >
              {FREQ_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Timing */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>UTC Hour</label>
          <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className={inputCls}>
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>{formatUtcHour(h)}</option>
            ))}
          </select>
        </div>
        {frequency === 'weekly' && (
          <div>
            <label className={labelCls}>Day of week</label>
            <select value={dow} onChange={(e) => setDow(Number(e.target.value))} className={inputCls}>
              {DOW_LABELS.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
        )}
        {frequency === 'monthly' && (
          <div>
            <label className={labelCls}>Day of month</label>
            <select value={dom} onChange={(e) => setDom(Number(e.target.value))} className={inputCls}>
              {DOM_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Enabled */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setEnabled((v) => !v)}
          className={[
            'w-9 h-5 rounded-full transition-colors relative flex-shrink-0',
            enabled ? 'bg-purple/60' : 'bg-surface border border-border',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
              enabled ? 'left-[18px]' : 'left-0.5',
            ].join(' ')}
          />
        </button>
        <span className="text-[11px] text-txt-2">
          {enabled ? 'Enabled — will run automatically' : 'Disabled — will not run automatically'}
        </span>
      </div>

      {err && <p className="text-[11px] text-red-400">{err}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={isPending}
          className="flex-1 py-2 text-[11px] font-bold tracking-[0.08em] uppercase bg-purple/80 hover:bg-purple text-white rounded transition-colors disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create Schedule'}
        </button>
        <button
          onClick={onDone}
          className="px-4 py-2 text-[11px] font-bold tracking-[0.08em] uppercase border border-border text-txt-3 rounded hover:text-txt-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Schedule detail panel ─────────────────────────────────────────────────────
function ScheduleDetail({ s, onDeleted }: { s: Schedule; onDeleted: () => void }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState(s.user_message)
  const [frequency, setFrequency] = useState<ScheduleFrequency>(s.frequency)
  const [hour, setHour] = useState(s.hour)
  const [dow, setDow] = useState(s.day_of_week ?? 0)
  const [dom, setDom] = useState(s.day_of_month ?? 1)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState('')

  const { mutate: update } = useMutation({
    mutationFn: (updates: Parameters<typeof api.updateSchedule>[1]) =>
      api.updateSchedule(s.id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const { mutate: doDelete } = useMutation({
    mutationFn: () => api.deleteSchedule(s.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
      onDeleted()
    },
  })

  const { mutate: trigger, isPending: triggering } = useMutation({
    mutationFn: () => api.triggerSchedule(s.id),
    onSuccess: () => {
      setTriggerMsg('Job queued — check Jobs panel for progress.')
      setTimeout(() => setTriggerMsg(''), 5000)
    },
    onError: (e: Error) => setTriggerMsg(e.message),
  })

  function saveEdits() {
    update({
      user_message: message.trim() || s.user_message,
      frequency,
      hour,
      day_of_week: frequency === 'weekly' ? dow : undefined,
      day_of_month: frequency === 'monthly' ? dom : undefined,
    })
    setEditing(false)
  }

  const inputCls =
    'w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-[13px] text-txt focus:outline-none focus:border-purple/50'
  const labelCls = 'block text-[10px] font-bold tracking-[0.08em] text-txt-3 uppercase mb-1'

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge text={s.badge || s.format.toUpperCase()} color={s.badge_color} />
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: s.enabled ? '#22c55e' : '#5f6368' }}
              title={s.enabled ? 'Enabled' : 'Disabled'}
            />
          </div>
          <h2 className="text-[14px] font-bold text-txt">{s.skill_name}</h2>
          <p className="text-[11px] text-txt-2 mt-0.5">{frequencyLine(s)}</p>
        </div>
        {/* Enable/disable toggle */}
        <button
          onClick={() => update({ enabled: !s.enabled })}
          className={[
            'w-9 h-5 rounded-full transition-colors relative flex-shrink-0 mt-1',
            s.enabled ? 'bg-purple/60' : 'bg-surface border border-border',
          ].join(' ')}
          title={s.enabled ? 'Click to disable' : 'Click to enable'}
        >
          <span
            className={[
              'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
              s.enabled ? 'left-[18px]' : 'left-0.5',
            ].join(' ')}
          />
        </button>
      </div>

      {/* Timing info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-md p-3 border border-border">
          <p className="text-[9px] font-bold tracking-[0.12em] text-txt-3 uppercase mb-1">Next Run</p>
          <p className="text-[13px] text-txt font-medium">{nextRunLabel(s.next_run)}</p>
          <p className="text-[10px] text-txt-3">
            {new Date(s.next_run).toLocaleString(undefined, { timeZoneName: 'short' })}
          </p>
        </div>
        <div className="bg-surface rounded-md p-3 border border-border">
          <p className="text-[9px] font-bold tracking-[0.12em] text-txt-3 uppercase mb-1">Last Run</p>
          {s.last_run ? (
            <>
              <p className="text-[13px] text-txt font-medium">{nextRunLabel(s.last_run).replace('in ', '')} ago</p>
              <p className="text-[10px] text-txt-3">
                {new Date(s.last_run).toLocaleString(undefined, { timeZoneName: 'short' })}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-txt-3">Never run</p>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-[10px] px-2 py-0.5 rounded border border-border text-txt-3">
          {s.format.toUpperCase()}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded border border-border text-txt-3">
          {s.model.includes('haiku') ? 'Haiku' : s.model.includes('opus') ? 'Opus' : 'Sonnet'}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded border border-border text-txt-3">
          {(s.max_tokens / 1000).toFixed(0)}k tokens
        </span>
        {s.needs_search && (
          <span className="text-[10px] px-2 py-0.5 rounded border border-border text-txt-3">
            Web search
          </span>
        )}
      </div>

      {/* User message */}
      {!editing ? (
        <div>
          <p className={labelCls}>Report instructions</p>
          <div className="bg-surface border border-border rounded-md p-3 text-[13px] text-txt-2 whitespace-pre-wrap leading-relaxed">
            {s.user_message}
          </div>
          <button
            onClick={() => { setMessage(s.user_message); setEditing(true) }}
            className="mt-2 text-[10px] font-bold tracking-[0.08em] uppercase text-txt-3 hover:text-txt-2 transition-colors"
          >
            Edit schedule
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 border border-border rounded-md p-3 bg-bg/40">
          <div>
            <label className={labelCls}>Report instructions</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className={inputCls + ' resize-none'}
            />
          </div>
          <div>
            <label className={labelCls}>Frequency</label>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as ScheduleFrequency[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={[
                    'flex-1 py-1.5 text-[10px] font-bold tracking-[0.08em] uppercase rounded border transition-colors',
                    frequency === f
                      ? 'bg-purple/10 border-purple/40 text-purple'
                      : 'border-border text-txt-3 hover:text-txt-2',
                  ].join(' ')}
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>UTC Hour</label>
              <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className={inputCls}>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{formatUtcHour(h)}</option>
                ))}
              </select>
            </div>
            {frequency === 'weekly' && (
              <div>
                <label className={labelCls}>Day of week</label>
                <select value={dow} onChange={(e) => setDow(Number(e.target.value))} className={inputCls}>
                  {DOW_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            {frequency === 'monthly' && (
              <div>
                <label className={labelCls}>Day of month</label>
                <select value={dom} onChange={(e) => setDom(Number(e.target.value))} className={inputCls}>
                  {DOM_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveEdits}
              className="flex-1 py-1.5 text-[10px] font-bold tracking-[0.08em] uppercase bg-purple/80 hover:bg-purple text-white rounded transition-colors"
            >
              Save changes
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-[10px] font-bold tracking-[0.08em] uppercase border border-border text-txt-3 rounded hover:text-txt-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => trigger()}
          disabled={triggering}
          className="flex-1 py-2 text-[10px] font-bold tracking-[0.08em] uppercase border border-border text-txt-2 hover:border-border2 hover:text-txt rounded transition-colors disabled:opacity-50"
        >
          {triggering ? 'Triggering…' : 'Run Now'}
        </button>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 text-[10px] font-bold tracking-[0.08em] uppercase border border-border text-txt-3 hover:border-red-500/40 hover:text-red-400 rounded transition-colors"
          >
            Delete
          </button>
        ) : (
          <button
            onClick={() => doDelete()}
            className="px-4 py-2 text-[10px] font-bold tracking-[0.08em] uppercase bg-red-500/10 border border-red-500/40 text-red-400 rounded transition-colors"
          >
            Confirm delete
          </button>
        )}
      </div>

      {triggerMsg && (
        <p className="text-[11px] text-txt-2 bg-bg border border-border rounded px-3 py-2">
          {triggerMsg}
        </p>
      )}

      <p className="text-[10px] text-txt-3">
        Created {new Date(s.created_at).toLocaleDateString()}
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Schedules() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: api.listSchedules,
    refetchInterval: 60_000,
  })

  const schedules = data?.schedules ?? []
  const selected = schedules.find((s) => s.id === selectedId) ?? null

  function openCreate() {
    setSelectedId(null)
    setCreating(true)
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Left panel — schedule list */}
      <div className="w-[280px] flex-shrink-0 border-r border-border flex flex-col h-full">
        <div className="p-3 border-b border-border flex items-center justify-between gap-2 flex-shrink-0">
          <div>
            <p className="text-[9px] font-bold tracking-[0.2em] text-txt-3 uppercase">Schedules</p>
            <p className="text-[13px] font-bold text-txt">{schedules.length} configured</p>
          </div>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 text-[10px] font-bold tracking-[0.08em] uppercase bg-purple/80 hover:bg-purple text-white rounded transition-colors flex-shrink-0"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-txt-3 text-[11px]">
              <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
              Loading…
            </div>
          )}

          {!isLoading && schedules.length === 0 && (
            <div className="p-5 text-center">
              <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center mx-auto mb-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <p className="text-[11px] font-bold text-txt-2 mb-1">No schedules yet</p>
              <p className="text-[10px] text-txt-3">
                Create a schedule to automatically generate reports on a daily, weekly, or monthly cadence.
              </p>
              <button
                onClick={openCreate}
                className="mt-3 px-4 py-2 text-[10px] font-bold tracking-[0.08em] uppercase bg-purple/80 hover:bg-purple text-white rounded transition-colors"
              >
                Create first schedule
              </button>
            </div>
          )}

          {schedules.map((s) => (
            <ScheduleRow
              key={s.id}
              s={s}
              selected={selectedId === s.id}
              onClick={() => { setSelectedId(s.id); setCreating(false) }}
            />
          ))}
        </div>

        {/* Info footer */}
        <div className="p-3 border-t border-border flex-shrink-0">
          <p className="text-[10px] text-txt-3 leading-relaxed">
            Schedules run server-side. HTML reports are saved to Reports. PDF/PPTX jobs appear in the Jobs panel.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto">
        {creating ? (
          <CreateForm onDone={() => setCreating(false)} />
        ) : selected ? (
          <ScheduleDetail
            key={selected.id}
            s={selected}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-[14px] font-bold text-txt-2 mb-2">Scheduled Reports</p>
            <p className="text-[13px] text-txt-3 max-w-xs leading-relaxed">
              Automatically generate and save CTI reports on a recurring schedule. Reports run server-side — they work even when the browser is closed.
            </p>
            <button
              onClick={openCreate}
              className="mt-5 px-5 py-2 text-[11px] font-bold tracking-[0.08em] uppercase bg-purple/80 hover:bg-purple text-white rounded transition-colors"
            >
              Create schedule
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
