import {
  createContext, useContext, useState, useEffect, useLayoutEffect,
  useRef, useCallback, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MenuAction =
  | { label: string; icon?: ReactNode; action: () => void; disabled?: boolean }
  | { separator: true }

// ── Context ───────────────────────────────────────────────────────────────────

type ContextMenuCtxValue = {
  openMenu: (x: number, y: number, actions: MenuAction[]) => void
}

const ContextMenuCtx = createContext<ContextMenuCtxValue>({ openMenu: () => {} })

export function useContextMenu() {
  return useContext(ContextMenuCtx)
}

// ── Menu overlay ──────────────────────────────────────────────────────────────

function MenuOverlay({
  x, y, actions, onClose,
}: {
  x: number; y: number; actions: MenuAction[]; onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const [visible, setVisible] = useState(false)

  // Measure and adjust position so the menu stays inside the viewport
  useLayoutEffect(() => {
    if (!ref.current) return
    const { offsetWidth: w, offsetHeight: h } = ref.current
    const vw = window.innerWidth
    const vh = window.innerHeight
    setPos({
      x: x + w > vw - 8 ? Math.max(8, x - w) : x,
      y: y + h > vh - 8 ? Math.max(8, y - h) : y,
    })
    setVisible(true)
  }, [x, y])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <>
      {/* click-away backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        onMouseDown={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose() }}
      />
      {/* menu panel */}
      <div
        ref={ref}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          zIndex: 9999,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.08s ease-out',
        }}
        className="min-w-[176px] bg-surface border border-border2 rounded-xl shadow-elevated py-1 overflow-hidden"
      >
        {actions.map((item, i) =>
          'separator' in item ? (
            <div key={i} className="my-1 border-t border-border" />
          ) : (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => { item.action(); onClose() }}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-[7px] text-[12px] transition-colors',
                'bg-transparent border-none cursor-pointer text-left',
                item.disabled
                  ? 'opacity-40 cursor-not-allowed text-txt-3'
                  : 'text-txt-2 hover:bg-white/[0.06] hover:text-txt',
              ].join(' ')}
            >
              {item.icon && (
                <span className="flex-shrink-0 text-txt-3 w-3.5 h-3.5 flex items-center justify-center">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          )
        )}
      </div>
    </>,
    document.body,
  )
}

// ── Provider ──────────────────────────────────────────────────────────────────

type MenuState = { x: number; y: number; actions: MenuAction[] } | null

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MenuState>(null)

  const openMenu = useCallback((x: number, y: number, actions: MenuAction[]) => {
    setState({ x, y, actions })
  }, [])

  const closeMenu = useCallback(() => setState(null), [])

  return (
    <ContextMenuCtx.Provider value={{ openMenu }}>
      {children}
      {state && (
        <MenuOverlay
          x={state.x}
          y={state.y}
          actions={state.actions}
          onClose={closeMenu}
        />
      )}
    </ContextMenuCtx.Provider>
  )
}

// ── Convenience SVG icons used across context menus ───────────────────────────

export const MenuIcon = {
  Enrich: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Copy: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Case: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Attack: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Advisory: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Actor: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
}
