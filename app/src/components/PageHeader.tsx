import type { ReactNode } from 'react'

export interface PageHeaderTab {
  id: string
  label: string
  badge?: number | string
}

interface PageHeaderProps {
  eyebrow?: string
  title: string
  actions?: ReactNode
  tabs?: PageHeaderTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
  /** Remove bottom padding — use when tabs handle the bottom edge themselves */
  flushBottom?: boolean
}

/**
 * Sticky glassmorphic page header shared across pages.
 * Sits at `top-0` inside each page's scroll container.
 */
export default function PageHeader({
  eyebrow,
  title,
  actions,
  tabs,
  activeTab,
  onTabChange,
  flushBottom = false,
}: PageHeaderProps) {
  return (
    <div
      className={[
        'sticky top-0 z-10 flex-shrink-0 border-b border-border px-6 pt-5',
        flushBottom ? 'pb-0' : 'pb-5',
        'glass-header',
      ].join(' ')}
    >
      {eyebrow && (
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-2">
          {eyebrow}
        </p>
      )}
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[20px] font-bold text-txt tracking-tight leading-none">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {tabs && (
        <div className="flex mt-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={[
                'flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold border-b-2 -mb-px',
                'bg-transparent border-l-0 border-r-0 border-t-0 cursor-pointer whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'border-b-purple text-txt'
                  : 'border-b-transparent text-txt-3 hover:text-txt-2',
              ].join(' ')}
            >
              {tab.label}
              {tab.badge != null && (
                <span className="text-[10px] font-bold px-1.5 py-[2px] rounded-full bg-purple/20 text-purple leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
