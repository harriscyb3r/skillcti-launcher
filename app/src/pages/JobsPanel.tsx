import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Job } from '../lib/types'

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDuration(created: string, completed: string | null) {
  if (!completed) return null
  const secs = Math.round((new Date(completed).getTime() - new Date(created).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function fmtTokens(n: number) {
  if (n === 0) return null
  if (n < 1000) return `${n} tok`
  return `${(n / 1000).toFixed(1)}k tok`
}

function fmtCost(usd: number) {
  if (!usd || usd === 0) return null
  if (usd < 0.01) return '<$0.01 USD'
  return `$${usd.toFixed(2)} USD`
}

function StatusBadge({ status }: { status: Job['status'] }) {
  const map: Record<Job['status'], { label: string; cls: string }> = {
    pending: { label: 'Queued',  cls: 'border-txt-3 text-txt-3' },
    running: { label: 'Running', cls: 'border-purple text-purple' },
    done:    { label: 'Done',    cls: 'border-green text-green' },
    error:   { label: 'Failed',  cls: 'border-red text-red' },
  }
  const { label, cls } = map[status] ?? map.pending
  return (
    <span className={`text-[11px] font-bold uppercase tracking-[0.1em] px-2 py-[2px] rounded border ${cls} leading-none`}>
      {status === 'running' && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple animate-pulse mr-1 mb-[-1px]" />
      )}
      {label}
    </span>
  )
}

function ProgressBar({ job }: { job: Job }) {
  if (job.status === 'done') return (
    <div className="h-[3px] bg-border rounded-full"><div className="h-full bg-green rounded-full w-full" /></div>
  )
  if (job.status === 'error') return (
    <div className="h-[3px] bg-border rounded-full"><div className="h-full bg-red rounded-full w-full" /></div>
  )
  const pct = job.status === 'running'
    ? Math.min(90, (job.chars / (32000)) * 100 || 10)
    : 0
  return (
    <div className="h-[3px] bg-border rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-purple to-cyan rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function JobCard({ job, onDelete }: { job: Job; onDelete: (id: string) => void }) {
  const navigate = useNavigate()
  const duration = fmtDuration(job.created_at, job.completed_at)

  function handleView() {
    if (job.result_report_id) navigate(`/reports/${job.result_report_id}`)
  }

  function handleDownload() {
    if (job.download_path) {
      const a = document.createElement('a')
      a.href = job.download_path
      a.download = `${job.result_report_id ?? 'report'}.${job.format}`
      a.click()
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg shadow-card p-4 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div
          className="text-[11px] font-bold tracking-[0.12em] uppercase px-2 py-[3px] rounded border flex-shrink-0 mt-[1px]"
          style={{ color: job.badge_color, borderColor: job.badge_color + '55' }}
        >
          {job.badge}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-txt truncate">{job.skill_name}</div>
          <div className="text-[10px] text-txt-3 mt-0.5 font-mono">{fmtDate(job.created_at)}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase text-txt-3 font-mono">{job.format}</span>
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar job={job} />

      {/* Progress text / error */}
      {job.status === 'error' ? (
        <div className="text-[10px] text-red bg-red/10 border border-red/20 rounded-lg px-3 py-2 leading-relaxed font-mono">
          {job.error ?? 'Unknown error'}
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-txt-3">
          <span>{job.progress}</span>
          <span className="font-mono flex items-center gap-1.5">
            {job.status === 'done' && job.input_tokens > 0 ? (
              <>
                <span title={`Input: ${job.input_tokens.toLocaleString()} · Output: ${job.output_tokens.toLocaleString()}${job.cache_read_tokens > 0 ? ` · Cache read: ${job.cache_read_tokens.toLocaleString()}` : ''}`}>
                  {fmtTokens(job.input_tokens + job.output_tokens)}
                </span>
                {job.cost_usd > 0 && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="text-green/80">{fmtCost(job.cost_usd)}</span>
                  </>
                )}
                {duration && <><span className="opacity-40">·</span><span>{duration}</span></>}
              </>
            ) : (
              <>
                {job.chars > 0 ? `${job.chars.toLocaleString()} chars` : ''}
                {duration ? ` · ${duration}` : ''}
              </>
            )}
          </span>
        </div>
      )}

      {/* Actions */}
      {(job.status === 'done' || job.status === 'error') && (
        <div className="flex gap-2 pt-1 border-t border-border">
          {job.status === 'done' && job.format === 'html' && (
            <button
              onClick={handleView}
              className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20 transition-colors cursor-pointer"
            >
              View Report
            </button>
          )}
          {job.status === 'done' && job.download_path && (
            <button
              onClick={handleDownload}
              className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20 transition-colors cursor-pointer"
            >
              Download {job.format.toUpperCase()}
            </button>
          )}
          <button
            onClick={() => onDelete(job.id)}
            className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-border text-txt-3 hover:text-red hover:border-red/30 transition-colors cursor-pointer bg-transparent"
          >
            Remove
          </button>
        </div>
      )}

      {(job.status === 'pending' || job.status === 'running') && (
        <div className="flex justify-end pt-1 border-t border-border">
          <button
            onClick={() => onDelete(job.id)}
            className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-border text-txt-3 hover:text-red hover:border-red/30 transition-colors cursor-pointer bg-transparent flex items-center gap-1.5"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

export default function JobsPanel() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.listJobs(),
    refetchInterval: (query) => {
      const jobs: Job[] = query.state.data?.jobs ?? []
      const hasActive = jobs.some(j => j.status === 'pending' || j.status === 'running')
      return hasActive ? 2000 : 10000
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })

  // Keep sidebar job count in sync
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['active-job-count'] })
  }, [data, qc])

  const jobs: Job[] = data?.jobs ?? []
  const running = jobs.filter(j => j.status === 'pending' || j.status === 'running')
  const finished = jobs.filter(j => j.status === 'done' || j.status === 'error')

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      <div>
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Automation</p>
        <h1 className="text-[22px] font-bold text-txt tracking-tight mb-1">Background Jobs</h1>
        <p className="text-[11px] text-txt-3 mb-6">
          Reports generated server-side — generation continues even if your browser sleeps or closes.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-txt-3 text-[11px]">
          <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
          Loading jobs…
        </div>
      )}

      {!isLoading && jobs.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div>
            <p className="text-[13px] font-semibold text-txt-2">No jobs yet</p>
            <p className="text-[11px] text-txt-3 mt-1">Generate a report from any skill — it will appear here.</p>
          </div>
        </div>
      )}

      {running.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-txt-3 mb-3">
            Running ({running.length})
          </h2>
          <div className="flex flex-col gap-3">
            {running.map(j => (
              <JobCard key={j.id} job={j} onDelete={(id) => deleteMutation.mutate(id)} />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-txt-3 mb-3">
            Completed ({finished.length})
          </h2>
          <div className="flex flex-col gap-3">
            {finished.map(j => (
              <JobCard key={j.id} job={j} onDelete={(id) => deleteMutation.mutate(id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
