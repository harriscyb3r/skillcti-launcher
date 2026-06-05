import { useState, useEffect, useRef, useCallback } from 'react'
import type { Skill, Format, Job } from '../lib/types'
import { submitBackgroundJob } from '../lib/generate'
import { api } from '../lib/api'

interface Props {
  skill: Skill | null
  initialValues?: Record<string, string>
  onClose: () => void
  onReportReady: (html: string, reportId?: string) => void
}

const FORMAT_OPTS: { value: Format; label: string; hint: string }[] = [
  { value: 'html', label: 'HTML', hint: 'Dark editorial view, saved to reports' },
  { value: 'pdf', label: 'PDF', hint: 'Print-ready A4 brief, browser download' },
  { value: 'pptx', label: 'PPTX', hint: 'PowerPoint deck, browser download' },
]

const MODEL_OPTS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku',  hint: 'Fastest',   speed: '~5–15s'  },
  { id: 'claude-sonnet-4-6',         label: 'Sonnet', hint: 'Balanced',  speed: '~20–40s' },
  { id: 'claude-opus-4-7',           label: 'Opus',   hint: 'Strongest', speed: '~45–90s' },
]

const DEFAULT_MODEL = 'claude-sonnet-4-6'

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export default function LaunchDrawer({ skill, initialValues, onClose, onReportReady }: Props) {
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
      return
    }

    if (j.format === 'html' && j.result_report_id) {
      try {
        const report = await api.getReport(j.result_report_id)
        onReportReady(report.html ?? '', j.result_report_id)
      } catch {
        setError('Report generated but failed to load. Check Reports page.')
        setJobId(null)
        setJob(null)
      }
    } else if (j.download_path) {
      const ext = j.format
      triggerDownload(j.download_path, `${j.result_report_id ?? 'report'}.${ext}`)
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

  if (!skill) return null

  const isValid = !skill.inputs?.some((f) => f.required && !values[f.id]?.trim())
  const running = !!jobId

  async function handleGenerate() {
    if (!skill || submitting || running) return
    setSubmitting(true)
    setError('')
    try {
      const userMessage = skill.buildMsg ? skill.buildMsg(values) : ''
      const { job_id } = await submitBackgroundJob({ skill, format, model, userMessage })
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
      {/* Backdrop — clicking away doesn't cancel a running job */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !running && onClose()}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-surface border-l border-border shadow-elevated z-50 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div
              className="text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5 inline-block px-2 py-[3px] rounded border"
              style={{ color: skill.badgeColor, borderColor: skill.badgeColor + '55' }}
            >
              {skill.badge}
            </div>
            <div className="text-[15px] font-bold text-txt leading-snug">{skill.name}</div>
            <div className="text-[11px] text-txt-3 mt-1 leading-relaxed">{skill.description}</div>
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
              {skill.inputs.map((field) => (
                <div key={field.id}>
                  <label className="text-[10px] font-semibold tracking-[0.08em] text-txt-2 block mb-[5px] uppercase">
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
              <p className="text-[10px] font-semibold tracking-[0.08em] text-txt-2 mb-2 uppercase">Output format</p>
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
                      <span className="text-[10px] text-txt-3 ml-2">{opt.hint}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Model selector */}
          {!running && (
            <div>
              <p className="text-[10px] font-semibold tracking-[0.08em] text-txt-2 mb-2 uppercase">Model</p>
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
                      <span className="text-[8px] text-txt-3 leading-none">{opt.hint}</span>
                      <span className="text-[8px] font-mono text-txt-3 leading-none mt-0.5">{opt.speed}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Background notice while running */}
          {running && (
            <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg bg-bg border border-border text-[10px] text-txt-2 leading-relaxed">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-txt-3 flex-shrink-0 mt-[1px]">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Generation is running <strong>server-side</strong>. You can safely close this drawer or let your screen sleep — it will continue and appear in <strong>Jobs</strong> when done.</span>
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
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[11px] text-txt-2">
                <span className="inline-block w-2 h-2 rounded-full bg-purple animate-pulse flex-shrink-0" />
                <span>{submitting ? 'Starting...' : (job?.progress ?? 'Waiting...')}</span>
                {(job?.chars ?? 0) > 0 && (
                  <span className="ml-auto text-txt-3 font-mono">{job!.chars.toLocaleString()} chars</span>
                )}
              </div>
              <div className="h-1 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple to-cyan rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <button
                onClick={onClose}
                className="mt-1 w-full py-2 text-[10px] font-semibold tracking-[0.08em] rounded-lg border border-border text-txt-3 hover:text-txt-2 hover:border-border2 transition-colors bg-transparent cursor-pointer"
              >
                Close drawer — generation continues in background
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
    </>
  )
}
