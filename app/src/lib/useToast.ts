import { useState, useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

export interface NotificationRecord {
  id: string
  message: string
  type: ToastType
  timestamp: string
  read: boolean
}

// ── Active toasts (auto-dismiss) ─────────────────────────────────────────────
let _toasts: Toast[] = []
const _toastListeners = new Set<(t: Toast[]) => void>()

function _notifyToasts() {
  _toastListeners.forEach((fn) => fn([..._toasts]))
}

// ── Persistent notification history (max 50) ─────────────────────────────────
let _history: NotificationRecord[] = []
const _historyListeners = new Set<(h: NotificationRecord[]) => void>()

function _notifyHistory() {
  _historyListeners.forEach((fn) => fn([..._history]))
}

export function toast(message: string, type: ToastType = 'info', duration = 4000) {
  const id = Math.random().toString(36).slice(2, 9)

  _toasts = [..._toasts, { id, message, type }]
  _notifyToasts()
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id)
    _notifyToasts()
  }, duration)

  _history = [
    { id, message, type, timestamp: new Date().toISOString(), read: false },
    ..._history,
  ].slice(0, 50)
  _notifyHistory()
}

export function markAllNotificationsRead() {
  _history = _history.map((n) => ({ ...n, read: true }))
  _notifyHistory()
}

export function clearNotifications() {
  _history = []
  _notifyHistory()
}

export function useToasts(): Toast[] {
  const [toasts, setToasts] = useState<Toast[]>(_toasts)
  useEffect(() => {
    _toastListeners.add(setToasts)
    return () => { _toastListeners.delete(setToasts) }
  }, [])
  return toasts
}

export function useNotificationHistory(): NotificationRecord[] {
  const [history, setHistory] = useState<NotificationRecord[]>(_history)
  useEffect(() => {
    _historyListeners.add(setHistory)
    return () => { _historyListeners.delete(setHistory) }
  }, [])
  return history
}

export function useUnreadNotificationCount(): number {
  const history = useNotificationHistory()
  return history.filter((n) => !n.read).length
}
