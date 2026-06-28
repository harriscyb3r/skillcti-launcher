import { useEffect, useRef, useState, useMemo } from 'react'

interface Props {
  html: string
  reportId?: string
  onClose: () => void
}

export default function ReportModal({ html, reportId, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [scrollPct, setScrollPct] = useState(0)
  const [fontSize, setFontSize] = useState(100)

  const src = useMemo(() => {
    const blob = new Blob([html], { type: 'text/html' })
    return URL.createObjectURL(blob)
  }, [html])

  useEffect(() => () => URL.revokeObjectURL(src), [src])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleLoad() {
    const win = iframeRef.current?.contentWindow
    const doc = iframeRef.current?.contentDocument
    if (!win || !doc) return

    win.addEventListener('scroll', () => {
      const el = doc.documentElement
      const total = el.scrollHeight - el.clientHeight
      setScrollPct(total > 0 ? Math.round((el.scrollTop / total) * 100) : 0)
    })
  }

  function adjustFont(delta: number) {
    setFontSize((prev) => {
      const next = Math.max(70, Math.min(150, prev + delta))
      const doc = iframeRef.current?.contentDocument
      if (doc) {
        let style = doc.getElementById('__skfont__') as HTMLStyleElement | null
        if (!style) {
          style = doc.createElement('style') as HTMLStyleElement
          style.id = '__skfont__'
          doc.head.appendChild(style)
        }
        style.textContent = `html { font-size: ${next}% !important; }`
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">

      {/* Scroll progress bar */}
      <div className="h-[3px] bg-border flex-shrink-0">
        <div
          className="h-full bg-gradient-to-r from-purple to-cyan transition-[width] duration-75 ease-out"
          style={{ width: `${scrollPct}%` }}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold tracking-[0.1em] text-txt-3 uppercase">Report</span>
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
          {/* Font size controls */}
          <div className="flex items-center border border-border rounded overflow-hidden">
            <button
              onClick={() => adjustFont(-10)}
              title="Decrease font size"
              className="px-2 py-1 text-[10px] font-bold text-txt-3 hover:text-txt hover:bg-surface2 transition-colors bg-transparent border-none cursor-pointer font-mono leading-none"
            >
              A−
            </button>
            <span className="text-[10px] text-txt-3 font-mono px-1.5 border-x border-border select-none w-[38px] text-center tabular-nums">
              {fontSize}%
            </span>
            <button
              onClick={() => adjustFont(+10)}
              title="Increase font size"
              className="px-2 py-1 text-[10px] font-bold text-txt-3 hover:text-txt hover:bg-surface2 transition-colors bg-transparent border-none cursor-pointer font-mono leading-none"
            >
              A+
            </button>
          </div>

          {reportId && (
            <a
              href={`/reports/${reportId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-txt-2 border border-border rounded hover:border-border2 hover:text-txt transition-colors no-underline"
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-txt-2 border border-border rounded hover:border-border2 hover:text-txt transition-colors bg-transparent cursor-pointer"
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
        ref={iframeRef}
        src={src}
        className="flex-1 w-full border-none bg-bg"
        title="Generated report"
        onLoad={handleLoad}
      />
    </div>
  )
}
