import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ReportMeta } from '../lib/types'
import { usePagination } from '../lib/usePagination'
import Pagination from '../components/Pagination'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ReportViewer({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => api.getReport(reportId),
  })

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-[18px] py-[10px] bg-surface border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          {data?.meta && (
            <span
              className="text-[9px] font-bold tracking-[0.14em] px-2 py-[3px] rounded"
              style={{ background: data.meta.badgeColor + '22', color: data.meta.badgeColor }}
            >
              {data.meta.badge}
            </span>
          )}
          <span className="text-[13px] font-bold text-txt">
            {data?.meta?.title ?? reportId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data?.meta?.format === 'pdf' ? (
            <a
              href={`/reports/${reportId}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-[6px] text-[10px] font-bold tracking-[0.08em] rounded-md bg-gradient-to-br from-purple to-purple-dark text-white"
            >
              Open PDF
            </a>
          ) : null}
          <button
            onClick={onClose}
            className="px-3 py-[6px] text-[10px] font-bold tracking-[0.08em] rounded-md border border-border2 text-txt-2 hover:opacity-80 transition-opacity bg-transparent"
          >
            Close
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-txt-3 text-[11px]">
          <div className="w-4 h-4 border border-txt-3 border-t-transparent rounded-full animate-spin" />
          Loading report…
        </div>
      )}
      {isError && (
        <div className="flex-1 flex items-center justify-center text-red text-[13px]">
          Failed to load report.
        </div>
      )}
      {data?.html && (
        <iframe
          srcDoc={data.html}
          className="flex-1 border-none w-full"
          title="Report"
          sandbox="allow-scripts allow-popups allow-fullscreen"
        />
      )}
      {data && !data.html && data.meta?.format !== 'pdf' && (
        <div className="flex-1 flex items-center justify-center text-txt-3 text-[13px]">
          No HTML content for this report.
        </div>
      )}
    </div>
  )
}

function ReportRow({
  report,
  onOpen,
  onDelete,
}: {
  report: ReportMeta
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="bg-surface border border-border rounded-lg shadow-card p-4 flex items-center justify-between gap-4 hover:border-border2 transition-colors">
      <div
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        onClick={() => onOpen(report.id)}
      >
        <span
          className="text-[9px] font-bold tracking-[0.14em] px-2 py-[3px] rounded flex-shrink-0"
          style={{ background: report.badgeColor + '22', color: report.badgeColor }}
        >
          {report.badge}
        </span>
        <div className="min-w-0">
          <div className="text-[13px] text-txt truncate">{report.title}</div>
          <div className="text-[10px] text-txt-3 mt-0.5">
            {report.skillName} &middot; {formatBytes(report.bytes)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[10px] text-txt-3">{formatDate(report.timestamp)}</span>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(report.id)}
              className="text-[10px] font-bold text-red hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-[10px] text-txt-3 hover:opacity-80 transition-opacity bg-transparent border-none cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-[10px] text-txt-3 hover:text-red transition-colors bg-transparent border-none cursor-pointer"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

export default function Reports() {
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')

  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports'],
    queryFn: api.listReports,
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteReport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  })

  const reports = data?.reports ?? []

  // Unique skill names for the type filter
  const skillNames = Array.from(new Set(reports.map((r) => r.skillName))).sort()

  const filtered = reports
    .filter((r) => {
      const matchesSearch =
        search === '' ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.skillName.toLowerCase().includes(search.toLowerCase())
      const matchesType = typeFilter === '' || r.skillName === typeFilter
      return matchesSearch && matchesType
    })
    .sort((a, b) => {
      const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      return sort === 'newest' ? -diff : diff
    })

  const pg = usePagination(filtered, 25)

  return (
    <>
      {viewingId && (
        <ReportViewer reportId={viewingId} onClose={() => setViewingId(null)} />
      )}

      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">Report History</p>
          <div className="text-[10px] text-txt-3">{filtered.length} / {reports.length} reports</div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] max-w-xs bg-bg border border-border rounded-md text-txt text-[11px] px-3 py-[7px] outline-none focus:border-purple transition-colors"
          />

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-bg border border-border rounded-md text-txt text-[11px] px-3 py-[7px] outline-none focus:border-purple transition-colors cursor-pointer"
          >
            <option value="">All report types</option>
            {skillNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* Sort toggle */}
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setSort('newest')}
              className={[
                'px-3 py-[7px] text-[10px] font-bold tracking-[0.08em] border-none cursor-pointer transition-colors',
                sort === 'newest'
                  ? 'bg-purple/[0.15] text-purple'
                  : 'bg-bg text-txt-3 hover:text-txt-2',
              ].join(' ')}
            >
              Newest
            </button>
            <div className="w-px h-5 bg-border" />
            <button
              onClick={() => setSort('oldest')}
              className={[
                'px-3 py-[7px] text-[10px] font-bold tracking-[0.08em] border-none cursor-pointer transition-colors',
                sort === 'oldest'
                  ? 'bg-purple/[0.15] text-purple'
                  : 'bg-bg text-txt-3 hover:text-txt-2',
              ].join(' ')}
            >
              Oldest
            </button>
          </div>

          {/* Clear filters */}
          {(search || typeFilter) && (
            <button
              onClick={() => { setSearch(''); setTypeFilter('') }}
              className="text-[10px] text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-txt-3 text-[11px]">
            <div className="w-3 h-3 border border-txt-3 border-t-transparent rounded-full animate-spin" />
            Loading reports…
          </div>
        )}
        {isError && (
          <div className="text-red text-[13px]">Failed to load reports. Is the backend running?</div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <div>
              <p className="text-[13px] font-semibold text-txt-2">{search ? 'No matching reports' : 'No reports yet'}</p>
              <p className="text-[11px] text-txt-3 mt-1">{search ? 'Try a different search term.' : 'Generate one from the Skills page.'}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {pg.paged.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              onOpen={setViewingId}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
        <Pagination
          page={pg.page}
          totalPages={pg.totalPages}
          total={pg.total}
          from={pg.from}
          to={pg.to}
          hasPrev={pg.hasPrev}
          hasNext={pg.hasNext}
          onPage={pg.setPage}
        />
      </div>
    </>
  )
}
