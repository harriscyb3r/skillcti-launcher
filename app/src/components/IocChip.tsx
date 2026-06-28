import { useNavigate } from 'react-router-dom'

type IocType = 'ip' | 'domain' | 'url' | 'hash' | 'unknown'

interface Props {
  value: string
  type?: IocType
  /** Shortened label — defaults to auto-truncation */
  label?: string
  className?: string
}

const COLORS: Record<IocType, { bg: string; text: string; border: string }> = {
  ip:      { bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6', border: 'rgba(59,130,246,0.3)'  },
  domain:  { bg: 'rgba(6,182,212,0.12)',   text: '#06b6d4', border: 'rgba(6,182,212,0.3)'   },
  url:     { bg: 'rgba(249,115,22,0.12)',  text: '#f97316', border: 'rgba(249,115,22,0.3)'  },
  hash:    { bg: 'rgba(168,85,247,0.12)',  text: '#a855f7', border: 'rgba(168,85,247,0.3)'  },
  unknown: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', border: 'rgba(107,114,128,0.3)' },
}

function detect(value: string): IocType {
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(value)) return 'ip'
  if (/^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/.test(value)) return 'hash'
  if (value.startsWith('http://') || value.startsWith('https://')) return 'url'
  if (value.includes('.') && !value.includes(' ') && value.length < 253) return 'domain'
  return 'unknown'
}

function truncate(value: string, max = 32): string {
  if (value.length <= max) return value
  // For hashes: show first 12 chars + ellipsis
  if (/^[a-fA-F0-9]{32,}$/.test(value)) return value.slice(0, 12) + '…'
  // For URLs: show domain + path start
  if (value.startsWith('http')) {
    try {
      const u = new URL(value)
      const path = u.pathname.length > 10 ? u.pathname.slice(0, 10) + '…' : u.pathname
      return u.hostname + path
    } catch { /* fall through */ }
  }
  return value.slice(0, max - 1) + '…'
}

export default function IocChip({ value, type, label, className = '' }: Props) {
  const navigate = useNavigate()
  const resolvedType = type ?? detect(value)
  const colors = COLORS[resolvedType]
  const display = label ?? truncate(value)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/ioc-search?q=${encodeURIComponent(value)}`)
      }}
      title={`Enrich: ${value}`}
      className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer transition-all hover:brightness-125 active:scale-95 bg-transparent flex-shrink-0 ${className}`}
      style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
    >
      {display}
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-70 flex-shrink-0">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </button>
  )
}
