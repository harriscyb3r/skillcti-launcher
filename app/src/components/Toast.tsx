import { useToasts, type ToastType } from '../lib/useToast'

const STYLES: Record<ToastType, string> = {
  success: 'bg-green/10 border-green/30 text-green',
  error:   'bg-red/10 border-red/30 text-red',
  warning: 'bg-amber/10 border-amber/30 text-amber',
  info:    'bg-purple/10 border-purple/30 text-purple',
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  warning: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
}

export default function ToastContainer() {
  const toasts = useToasts()
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'flex items-center gap-2.5 px-4 py-2.5 rounded-lg border backdrop-blur-sm',
            'shadow-lg font-mono text-[11px] font-semibold pointer-events-auto',
            'animate-[toastIn_0.2s_ease-out]',
            STYLES[t.type],
          ].join(' ')}
        >
          {ICONS[t.type]}
          {t.message}
        </div>
      ))}
    </div>
  )
}
