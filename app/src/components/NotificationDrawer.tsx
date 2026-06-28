import { useEffect } from 'react'
import {
  useNotificationHistory,
  markAllNotificationsRead,
  clearNotifications,
  type NotificationRecord,
  type ToastType,
} from '../lib/useToast'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const TYPE_CONFIG: Record<ToastType, { bg: string; text: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-green/10',
    text: 'text-green',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  error: {
    bg: 'bg-red/10',
    text: 'text-red',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
  warning: {
    bg: 'bg-amber/10',
    text: 'text-amber',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    bg: 'bg-purple/10',
    text: 'text-purple',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
}

function NotifItem({ notif }: { notif: NotificationRecord }) {
  const cfg = TYPE_CONFIG[notif.type]
  return (
    <div className={[
      'flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0',
      !notif.read ? 'bg-purple/[0.035]' : '',
    ].join(' ')}>
      {/* type icon */}
      <div className={['flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5', cfg.bg, cfg.text].join(' ')}>
        {cfg.icon}
      </div>

      {/* message + timestamp */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-txt leading-snug break-words">{notif.message}</p>
        <p className="text-[10px] text-txt-3 mt-1 font-mono">{relativeTime(notif.timestamp)}</p>
      </div>

      {/* unread dot */}
      {!notif.read && (
        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-purple mt-2" />
      )}
    </div>
  )
}

export default function NotificationDrawer({ onClose }: { onClose: () => void }) {
  const history = useNotificationHistory()
  const unread = history.filter((n) => !n.read).length

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleMarkAll() {
    markAllNotificationsRead()
  }

  function handleClear() {
    clearNotifications()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[150] bg-black/30 animate-fadeIn"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-[160] w-[340px] flex flex-col bg-surface border-l border-border shadow-elevated animate-drawerIn">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-[13px] border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-txt tracking-[0.04em]">Notifications</span>
            {unread > 0 && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-purple/20 text-purple leading-none">
                {unread}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-[11px] text-txt-3 hover:text-txt-2 transition-colors px-2 py-1 rounded bg-transparent border-none cursor-pointer"
              >
                Mark all read
              </button>
            )}
            {history.length > 0 && (
              <button
                onClick={handleClear}
                className="text-[11px] text-txt-3 hover:text-red transition-colors px-2 py-1 rounded bg-transparent border-none cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="text-txt-3 hover:text-txt transition-colors bg-transparent border-none cursor-pointer p-1.5 rounded ml-1"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-3">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <div>
                <p className="text-[13px] font-semibold text-txt-2">No notifications</p>
                <p className="text-[11px] text-txt-3 mt-1">Events from skill runs, errors, and alerts will appear here.</p>
              </div>
            </div>
          ) : (
            history.map((n) => <NotifItem key={n.id} notif={n} />)
          )}
        </div>
      </div>
    </>
  )
}
