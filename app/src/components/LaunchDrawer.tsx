import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Skill, Format, Job, JobLogEntry } from '../lib/types'
import { submitBackgroundJob } from '../lib/generate'
import { api } from '../lib/api'
import { toast } from '../lib/useToast'

// ── File field component ──────────────────────────────────────────────────────
// Text files are read client-side via FileReader.
// PDF and DOCX are binary — they are POSTed to /extract-file on the backend
// which returns the extracted plain text.

const BINARY_EXTS = new Set(['pdf', 'docx', 'doc'])

interface FileFieldProps {
  fieldId: string
  accept?: string
  disabled: boolean
  values: Record<string, string>
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

function FileField({ fieldId, accept, disabled, values, setValues }: FileFieldProps) {
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')

  const nameKey = `${fieldId}__name`
  const filename = values[nameKey] ?? ''
  const hasContent = !!values[fieldId]

  function clear() {
    setValues((p) => { const n = { ...p }; delete n[fieldId]; delete n[nameKey]; return n })
    setExtractError('')
  }

  async function handleFile(file: File) {
    setExtractError('')
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

    if (BINARY_EXTS.has(ext)) {
      // Backend extraction for PDF / DOCX
      setExtracting(true)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/extract-file', { method: 'POST', body: form })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error((err as { detail?: string }).detail ?? res.statusText)
        }
        const data = await res.json() as { text: string; filename: string; chars: number }
        setValues((p) => ({ ...p, [fieldId]: data.text, [nameKey]: data.filename }))
      } catch (e) {
        setExtractError(e instanceof Error ? e.message : 'Extraction failed')
      } finally {
        setExtracting(false)
      }
    } else {
      // Plain-text files — read client-side
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        setValues((p) => ({ ...p, [fieldId]: text, [nameKey]: file.name }))
      }
      reader.readAsText(file, 'utf-8')
    }
  }

  const busy = disabled || extracting

  return (
    <div>
      <label
        htmlFor={`file-${fieldId}`}
        className={[
          'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-[11px] transition-colors select-none',
          hasContent
            ? 'border-purple text-purple bg-purple/[0.05]'
            : 'border-border text-txt-3 hover:border-border2 hover:text-txt-2 bg-bg',
          busy ? 'pointer-events-none opacity-50' : '',
        ].join(' ')}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        <span>
          {extracting
            ? 'Extracting text…'
            : hasContent
              ? `File attached (${Math.round(values[fieldId].length / 1024)} KB extracted)`
              : 'Attach file…'}
        </span>
      </label>
      <input
        id={`file-${fieldId}`}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      {filename && (
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[10px] text-txt-3 font-mono truncate max-w-[280px]">{filename}</span>
          <button
            type="button"
            onClick={clear}
            className="text-[10px] text-txt-3 hover:text-red transition-colors bg-transparent border-none cursor-pointer flex-shrink-0 ml-2"
          >
            Remove
          </button>
        </div>
      )}
      {extractError && (
        <p className="mt-1.5 text-[10px] text-red leading-snug">{extractError}</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  skill: Skill | null
  initialValues?: Record<string, string>
  /** When set, prepended to the user message as client engagement context */
  clientContext?: string
  onClose: () => void
  onReportReady: (html: string, reportId?: string) => void
}

const FORMAT_OPTS: { value: Format; label: string; hint: string }[] = [
  { value: 'html', label: 'HTML', hint: 'Dark editorial view, saved to reports' },
  { value: 'pdf', label: 'PDF', hint: 'Print-ready A4 brief, saved to reports' },
  { value: 'pptx', label: 'PPTX', hint: 'PowerPoint deck, saved to reports' },
]

const MODEL_OPTS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku',  hint: 'Fastest',   speed: '~5–15s'  },
  { id: 'claude-sonnet-4-6',         label: 'Sonnet', hint: 'Balanced',  speed: '~20–40s' },
  { id: 'claude-opus-4-7',           label: 'Opus',   hint: 'Strongest', speed: '~45–90s' },
]

const DEFAULT_MODEL = 'claude-sonnet-4-6'

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export default function LaunchDrawer({ skill, initialValues, clientContext, onClose, onReportReady }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [format, setFormat] = useState<Format>('html')
  const [model, setModel] = useState<string>(DEFAULT_MODEL)

  // Job state
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completedRef = useRef(false)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  const [elapsed, setElapsed] = useState(0)

  // Reset on skill change
  useEffect(() => {
    setValues(initialValues ?? {})
    setFormat('html')
    setModel(skill?.defaultModel ?? DEFAULT_MODEL)
    setJobId(null)
    setJob(null)
    setError('')
    setSubmitting(false)
    completedRef.current = false
    if (pollRef.current) clearInterval(pollRef.current)
  }, [skill, initialValues])

  // Escape to close (only when not running)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !jobId) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [jobId, onClose])

  // Poll active job
  const handleJobComplete = useCallback(async (j: Job) => {
    if (completedRef.current) return
    completedRef.current = true
    if (pollRef.current) clearInterval(pollRef.current)

    if (j.status === 'error') {
      setError(j.error ?? 'Generation failed.')
      setJobId(null)
      setJob(null)
      toast(j.error ?? 'Generation failed', 'error')
      return
    }

    if (j.format === 'html' && j.result_report_id) {
      try {
        const report = await api.getReport(j.result_report_id)
        toast('Report ready', 'success')
        onReportReady(report.html ?? '', j.result_report_id)
      } catch {
        setError('Report generated but failed to load. Check Reports page.')
        setJobId(null)
        setJob(null)
        toast('Report saved — check Reports page', 'warning')
      }
    } else if (j.download_path) {
      const ext = j.format
      // PDF and PPTX are both saved server-side in the reports folder — no browser dialog needed
      toast(`${ext.toUpperCase()} saved to reports folder`, 'success')
      onClose()
    }
  }, [onClose, onReportReady])

  useEffect(() => {
    if (!jobId) return
    completedRef.current = false

    pollRef.current = setInterval(async () => {
      try {
        const j = await api.getJob(jobId)
        setJob(j)
        if (j.status === 'done' || j.status === 'error') {
          clearInterval(pollRef.current!)
          await handleJobComplete(j)
        }
      } catch {
        // Transient network error — keep polling
      }
    }, 2000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobId, handleJobComplete])

  // Elapsed timer — starts when jobId is set, uses job.created_at as anchor
  useEffect(() => {
    if (!jobId) { setElapsed(0); return }
    const start = job?.created_at ? new Date(job.created_at).getTime() : Date.now()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [jobId, job?.created_at])

  // Auto-scroll log to bottom on each new entry
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [job?.log?.length])

  // Derive display log: milestone entries + a synthetic live line for in-between chars
  const logEntries: JobLogEntry[] = useMemo(() => job?.log ?? [], [job?.log])

  const running = !!jobId

  const lastMilestoneMsg = logEntries[logEntries.length - 1]?.msg
  const showLiveLine = running && job && job.progress !== lastMilestoneMsg && job.chars > 0

  if (!skill) return null

  const isValid = !skill.inputs?.some((f) => f.required && f.type !== 'file' && !values[f.id]?.trim())

  async function handleGenerate() {
    if (!skill || submitting || running) return
    setSubmitting(true)
    setError('')
    try {
      const baseMsg = skill.buildMsg ? skill.buildMsg(values) : ''
      const userMessage = clientContext ? `${clientContext}\n\n---\n\n${baseMsg}` : baseMsg
      // Resolve dynamic skillPath (function → string) before submission
      const resolvedPath = typeof skill.skillPath === 'function'
        ? skill.skillPath(values)
        : skill.skillPath
      const resolvedSkill = resolvedPath !== skill.skillPath
        ? { ...skill, skillPath: resolvedPath }
        : skill
      const { job_id } = await submitBackgroundJob({ skill: resolvedSkill, format, model, userMessage })
      setJobId(job_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start job.')
    } finally {
      setSubmitting(false)
    }
  }

  const progressPct = job
    ? job.status === 'done'
      ? 100
      : Math.min(92, (job.chars / ((skill.maxTokens ?? 8000) * 4)) * 100 || 12)
    : submitting ? 8 : 0

  return (
    <>
      {/* Backdrop scrim */}
      <div className="fixed inset-0 bg-black/60 z-40 animate-fadeIn" />

      {/* Modal wrapper — click outside to close */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        onClick={() => !running && onClose()}
      >
      {/* Modal */}
      <div
        className="w-[480px] max-h-[85vh] bg-surface border border-border rounded-xl shadow-elevated flex flex-col overflow-hidden animate-paletteIn"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div
              className="text-[11px] font-bold tracking-[0.12em] uppercase mb-1.5 inline-block px-2 py-[3px] rounded border"
              style={{ color: skill.badgeColor, borderColor: skill.badgeColor + '55' }}
            >
              {skill.badge}
            </div>
            <div className="text-[15px] font-bold text-txt leading-snug">{skill.name}</div>
            <div className="text-[11px] text-txt-3 mt-1 leading-relaxed">{skill.description}</div>
            {clientContext && (
              <div className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-purple/[0.08] border border-purple/20">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple flex-shrink-0">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="text-[10px] text-purple font-semibold truncate">
                  {clientContext.split('\n')[1]?.replace('Client: ', '') ?? 'Client context attached'}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer p-1 flex-shrink-0"
            title={running ? 'Close drawer — generation continues in background' : 'Close'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Inputs */}
          {skill.inputs && skill.inputs.length > 0 && (
            <div className="flex flex-col gap-4">
              {skill.inputs.filter((field) =>
                !field.showWhen || (values[field.showWhen.field] ?? '') === field.showWhen.value
              ).map((field) => (
                <div key={field.id}>
                  <label className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 block mb-[5px] uppercase">
                    {field.label}
                    {field.required && <span className="text-red ml-1">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      rows={5}
                      value={values[field.id] ?? ''}
                      onChange={(e) => setValues((p) => ({ ...p, [field.id]: e.target.value }))}
                      placeholder={field.placeholder}
                      disabled={running || submitting}
                      className="w-full bg-bg border border-border rounded-md text-txt text-[11px] px-3 py-2 outline-none focus:border-purple transition-colors resize-none disabled:opacity-50"
                    />
                  ) : field.type === 'file' ? (
                    <FileField
                      fieldId={field.id}
                      accept={field.accept}
                      disabled={running || submitting}
                      values={values}
                      setValues={setValues}
                    />
                  ) : field.type === 'select' && field.options ? (
                    <select
                      value={values[field.id] ?? ''}
                      onChange={(e) => setValues((p) => ({ ...p, [field.id]: e.target.value }))}
                      disabled={running || submitting}
                      className="w-full bg-bg border border-border rounded-md text-txt font-mono text-[11px] px-3 py-2 outline-none focus:border-purple transition-colors disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={values[field.id] ?? ''}
                      onChange={(e) => setValues((p) => ({ ...p, [field.id]: e.target.value }))}
                      placeholder={field.placeholder}
                      disabled={running || submitting}
                      className="w-full bg-bg border border-border rounded-md text-txt font-mono text-[11px] px-3 py-2 outline-none focus:border-purple transition-colors disabled:opacity-50"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Format selector */}
          {!running && (
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 mb-2 uppercase">Output format</p>
              <div className="flex flex-col gap-1.5">
                {FORMAT_OPTS.map((opt) => (
                  <label
                    key={opt.value}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                      format === opt.value
                        ? 'border-purple bg-purple/[0.06] text-txt'
                        : 'border-border hover:border-border2 text-txt-2',
                      submitting ? 'pointer-events-none opacity-50' : '',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={opt.value}
                      checked={format === opt.value}
                      onChange={() => setFormat(opt.value)}
                      className="accent-purple"
                    />
                    <div>
                      <span className="text-[11px] font-bold">{opt.label}</span>
                      <span className="text-[11px] text-txt-3 ml-2">{opt.hint}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Model selector */}
          {!running && (
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-txt-2 mb-2 uppercase">Model</p>
              <div className="grid grid-cols-3 gap-1.5">
                {MODEL_OPTS.map((opt) => {
                  const active = model === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setModel(opt.id)}
                      disabled={submitting}
                      className={[
                        'flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg border text-center transition-colors cursor-pointer bg-transparent disabled:pointer-events-none disabled:opacity-50',
                        active
                          ? 'border-purple bg-purple/[0.06] text-txt'
                          : 'border-border hover:border-border2 text-txt-3',
                      ].join(' ')}
                    >
                      <span className={['text-[11px] font-bold', active ? 'text-purple' : ''].join(' ')}>
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-txt-3 leading-none">{opt.hint}</span>
                      <span className="text-[10px] font-mono text-txt-3 leading-none mt-0.5">{opt.speed}</span>
                    </button>
                  )
                })}
              </div>
              {skill?.haikuWarning && model.includes('haiku') && (
                <p className="mt-2 text-[11px] text-amber-400/80 leading-snug">
                  This skill generates complex diagrams — Sonnet or Opus recommended for best results. Haiku will use table equivalents instead.
                </p>
              )}
            </div>
          )}

          {/* Step log — shown while running */}
          {(running || submitting) && (
            <div className="flex flex-col">
              {/* Submitting phase (before job exists) */}
              {submitting && !jobId && (
                <div className="flex items-center gap-3 py-2.5">
                  <span className="w-2 h-2 rounded-full bg-purple animate-pulse flex-shrink-0" />
                  <span className="text-[12px] text-txt-2">Loading skill &amp; submitting…</span>
                </div>
              )}

              {/* Milestone entries */}
              {logEntries.map((entry, i) => {
                const isLast  = i === logEntries.length - 1
                const isDone  = job?.status === 'done' || job?.status === 'error'
                const isActive = isLast && !isDone
                const jobStartSec = job?.created_at
                  ? new Date(job.created_at).getTime() / 1000
                  : entry.t
                const offset = Math.max(0, Math.round(entry.t - jobStartSec))

                return (
                  <div
                    key={i}
                    className={[
                      'flex items-start gap-3 py-2.5',
                      i < logEntries.length - 1 ? 'border-b border-border/40' : '',
                    ].join(' ')}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 w-4 flex justify-center pt-[3px]">
                      {isActive ? (
                        <span className="block w-2 h-2 rounded-full bg-purple animate-pulse" />
                      ) : job?.status === 'error' && isLast ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-txt-3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    {/* Message */}
                    <span className={[
                      'flex-1 min-w-0 text-[12px] leading-snug',
                      isActive ? 'text-txt' : job?.status === 'error' && isLast ? 'text-red' : 'text-txt-3',
                    ].join(' ')}>
                      {entry.msg}
                    </span>
                    {/* Timestamp offset */}
                    <span className="text-[10px] font-mono text-txt-3 flex-shrink-0 tabular-nums">
                      +{offset}s
                    </span>
                  </div>
                )
              })}

              {/* Live line — shows char count between milestone events */}
              {showLiveLine && (
                <div className="flex items-center gap-3 pt-3">
                  <div className="w-4 flex justify-center flex-shrink-0">
                    <span className="block w-1.5 h-1.5 rounded-full bg-purple/50 animate-pulse" />
                  </div>
                  <span className="flex-1 text-[11px] font-mono text-txt-2 truncate">{job!.progress}</span>
                  <span className="text-[10px] font-mono text-txt-3 tabular-nums">
                    {job!.chars.toLocaleString()} chars
                  </span>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={logEndRef} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-[11px] text-red bg-red/10 border border-red/20 rounded-lg px-3 py-2.5 leading-relaxed">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex-shrink-0">
          {running || submitting ? (
            <div className="flex flex-col gap-2.5">
              {/* Progress bar */}
              <div className="h-1 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple to-cyan rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Elapsed + token count */}
              <div className="flex items-center text-[10px] font-mono text-txt-3 tabular-nums">
                <span>{formatElapsed(elapsed)} elapsed</span>
                {(job?.output_tokens ?? 0) > 0 && (
                  <span className="ml-auto">{job!.output_tokens.toLocaleString()} tokens out</span>
                )}
              </div>

              {/* Background notice */}
              <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-bg border border-border">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-txt-3 flex-shrink-0 mt-[1px]">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="text-[10px] text-txt-3 leading-relaxed">
                  Runs server-side — safe to close. Will appear in <strong className="text-txt-2">Jobs</strong> when done.
                </span>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2 text-[11px] font-semibold tracking-[0.08em] rounded-lg border border-border text-txt-3 hover:text-txt-2 hover:border-border2 transition-colors bg-transparent cursor-pointer"
              >
                Close — generation continues in background
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!isValid}
              className="w-full py-[11px] text-[11px] font-bold tracking-[0.1em] rounded-lg bg-gradient-to-br from-purple to-purple-dark text-white border-none cursor-pointer disabled:opacity-40 transition-opacity hover:opacity-90"
            >
              Generate {format.toUpperCase()}
            </button>
          )}
        </div>
      </div>
      </div>
    </>
  )
}
