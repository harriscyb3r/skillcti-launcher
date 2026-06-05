import { useEffect } from 'react'

interface Props {
  html: string
  reportId?: string
  onClose: () => void
}

export default function ReportModal({ html, reportId, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const blob = new Blob([html], { type: 'text/html' })
  const src = URL.createObjectURL(blob)

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold tracking-[0.1em] text-txt-3 uppercase">Report</span>
          {reportId && (
            <a
              href={`/reports/${reportId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-txt-3 hover:text-txt-2 transition-colors font-mono"
            >
              {reportId}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          {reportId && (
            <a
              href={`/reports/${reportId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-txt-2 border border-border rounded hover:border-border2 hover:text-txt transition-colors no-underline"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open in tab
            </a>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-txt-2 border border-border rounded hover:border-border2 hover:text-txt transition-colors bg-transparent cursor-pointer"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Close
          </button>
        </div>
      </div>

      {/* iframe */}
      <iframe
        src={src}
        className="flex-1 w-full border-none bg-white"
        title="Generated report"
        onLoad={() => URL.revokeObjectURL(src)}
      />
    </div>
  )
}
