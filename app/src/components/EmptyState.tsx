import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  /** Internal router link */
  to?: string
  /** External href */
  href?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ icon, title, description, to, href, actionLabel, onAction }: Props) {
  const cta = actionLabel ? (
    to ? (
      <Link to={to} className="text-[11px] font-bold text-txt-3 hover:text-txt transition-colors mt-1 inline-block">
        {actionLabel} →
      </Link>
    ) : href ? (
      <a href={href} className="text-[11px] font-bold text-txt-3 hover:text-txt transition-colors mt-1 inline-block">
        {actionLabel} →
      </a>
    ) : onAction ? (
      <button onClick={onAction} className="text-[10px] font-bold text-txt-3 hover:text-txt transition-colors mt-1 bg-transparent border-none cursor-pointer font-mono">
        {actionLabel} →
      </button>
    ) : null
  ) : null

  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
      {icon && <div className="text-txt-3 mb-1 opacity-60">{icon}</div>}
      <div className="text-[12px] font-bold text-txt-2">{title}</div>
      {description && (
        <div className="text-[11px] text-txt-3 max-w-xs leading-relaxed">{description}</div>
      )}
      {cta}
    </div>
  )
}
