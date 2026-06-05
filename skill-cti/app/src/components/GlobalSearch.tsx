import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ReportMeta, WatchItem, WatchAlert, NewsArticle } from '../lib/types'

type ResultKind = 'report' | 'watchlist' | 'alert' | 'news'

interface SearchResult {
  kind: ResultKind
  id: string
  primary: string
  secondary: string
  badge?: string
  badgeColor?: string
  url?: string
}

const KIND_LABEL: Record<ResultKind, string> = {
  report:    'REPORT',
  watchlist: 'WATCH',
  alert:     'ALERT',
  news:      'NEWS',
}

const KIND_COLOR: Record<ResultKind, string> = {
  report:    '#a855f7',
  watchlist: '#3b82f6',
  alert:     '#ef4444',
  news:      '#06b6d4',
}

function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.toLowerCase()
  return fields.some((f) => f?.toLowerCase().includes(q))
}

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const buildResults = useCallback(
    (q: string): SearchResult[] => {
      if (!q.trim()) return []
      const out: SearchResult[] = []

      // Reports (use cached data if available)
      const reportsData = qc.getQueryData<{ reports: ReportMeta[] }>(['reports'])
      const reports = reportsData?.reports ?? []
      for (const r of reports) {
        if (matches(q, r.title, r.skillName)) {
          out.push({
            kind: 'report',
            id: r.id,
            primary: r.title,
            secondary: r.skillName,
            badge: r.badge,
            badgeColor: r.badgeColor,
          })
        }
      }

      // Watch items
      const watchData = qc.getQueryData<{ items: WatchItem[] }>(['watchlist'])
      const watchItems = watchData?.items ?? []
      for (const w of watchItems) {
        if (matches(q, w.value, w.label)) {
          out.push({
            kind: 'watchlist',
            id: w.id,
            primary: w.value,
            secondary: w.label && w.label !== w.value ? w.label : w.type,
          })
        }
      }

      // Alerts
      const alertsData = qc.getQueryData<{ alerts: WatchAlert[] }>(['alerts'])
      const alerts = alertsData?.alerts ?? []
      for (const a of alerts) {
        if (matches(q, a.title, a.item_value, a.detail)) {
          out.push({
            kind: 'alert',
            id: a.id,
            primary: a.title,
            secondary: a.item_value,
          })
        }
      }

      // News (separate stale-tolerant query)
      const newsData = qc.getQueryData<{ articles: NewsArticle[] }>(['news-articles-global'])
      const articles = newsData?.articles ?? []
      for (const n of articles) {
        if (matches(q, n.title, n.feed_name)) {
          out.push({
            kind: 'news',
            id: n.id,
            primary: n.title,
            secondary: n.feed_name,
            url: n.url,
          })
        }
      }

      return out.slice(0, 12)
    },
    [qc]
  )

  // Prefetch news in background on mount
  useEffect(() => {
    const cached = qc.getQueryData(['news-articles-global'])
    if (!cached) {
      qc.fetchQuery({
        queryKey: ['news-articles-global'],
        queryFn: () => api.getNewsArticles({ limit: 300 }),
        staleTime: 300_000,
      }).catch(() => {})
    }
  }, [qc])

  useEffect(() => {
    const r = buildResults(query)
    setResults(r)
    setIdx(0)
  }, [query, buildResults])

  function handleAction(result: SearchResult) {
    onClose()
    if (result.kind === 'news') {
      navigate(`/feeds?q=${encodeURIComponent(query)}`)
    } else if (result.kind === 'report') {
      navigate('/reports')
    } else if (result.kind === 'watchlist') {
      navigate('/watchlist')
    } else if (result.kind === 'alert') {
      navigate('/watchlist')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[idx]) { handleAction(results[idx]) }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm pt-[14vh]"
      onClick={onClose}
    >
      <div
        className="mx-auto max-w-xl bg-surface border border-border rounded-xl shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-txt-3 flex-shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search reports, watchlist, alerts, news…"
            className="flex-1 bg-transparent border-none outline-none text-txt text-[13px] placeholder:text-txt-3"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-txt-3 hover:text-txt-2 bg-transparent border-none cursor-pointer text-[14px] leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-[340px] overflow-y-auto">
            {results.map((r, i) => {
              const color = KIND_COLOR[r.kind]
              return (
                <button
                  key={`${r.kind}-${r.id}`}
                  onClick={() => handleAction(r)}
                  onMouseEnter={() => setIdx(i)}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-2.5 border-none cursor-pointer text-left transition-colors',
                    i === idx ? 'bg-purple/[0.08]' : 'bg-transparent hover:bg-bg/50',
                  ].join(' ')}
                >
                  <span
                    className="text-[8px] font-bold tracking-[0.1em] px-1.5 py-[2px] rounded flex-shrink-0"
                    style={{ background: color + '20', color }}
                  >
                    {KIND_LABEL[r.kind]}
                  </span>
                  {r.badge && (
                    <span
                      className="text-[8px] font-bold tracking-[0.1em] px-1.5 py-[2px] rounded flex-shrink-0"
                      style={{ background: (r.badgeColor ?? '#6b7280') + '22', color: r.badgeColor ?? '#6b7280' }}
                    >
                      {r.badge}
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="text-[12px] text-txt font-medium truncate block">{r.primary}</span>
                    {r.secondary && (
                      <span className="text-[10px] text-txt-3 truncate block">{r.secondary}</span>
                    )}
                  </span>
                  {r.kind === 'news' && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-txt-3 flex-shrink-0">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="px-4 py-8 text-center text-[11px] text-txt-3">
            No results for <span className="font-mono text-txt-2">"{query}"</span>
          </div>
        )}

        {!query && (
          <div className="px-4 py-5 text-[10px] text-txt-3 text-center">
            Search across reports, watchlist, alerts, and news
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[9px] text-txt-3">
          <span className="font-mono">↑↓ navigate</span>
          <span className="font-mono">↵ open</span>
          <span className="font-mono">esc close</span>
        </div>
      </div>
    </div>
  )
}
