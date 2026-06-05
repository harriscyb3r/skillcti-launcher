import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { NewsArticle } from '../lib/types'

const CATEGORY_COLOR: Record<string, string> = {
  government: '#3b82f6',
  news:       '#a855f7',
  research:   '#06b6d4',
}

const CATEGORY_LABEL: Record<string, string> = {
  government: 'GOV',
  news:       'NEWS',
  research:   'RSRCH',
}

function timeAgo(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function SourceBadge({ category, feed }: { category: string; feed: string }) {
  const color = CATEGORY_COLOR[category] ?? '#6b7280'
  const label = CATEGORY_LABEL[category] ?? category.toUpperCase().slice(0, 4)
  return (
    <span
      className="text-[6px] font-bold px-1 py-[1px] rounded flex-shrink-0 leading-none"
      style={{ color, background: `${color}20` }}
      title={feed}
    >
      {label}
    </span>
  )
}

function ArticleRow({ article }: { article: NewsArticle }) {
  const qc = useQueryClient()

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault()
    if (!article.read) {
      api.markArticleRead(article.id).then(() => {
        qc.invalidateQueries({ queryKey: ['news-widget'] })
        qc.invalidateQueries({ queryKey: ['news-unread-count'] })
      })
    }
    window.open(article.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={['flex items-center gap-2 px-3 py-2 hover:bg-bg/60 transition-colors rounded', !article.read ? 'bg-purple/[0.02]' : ''].join(' ')}>
      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: article.read ? 'transparent' : '#a855f7' }} />
      <SourceBadge category={article.category} feed={article.feed_name} />
      <a
        href={article.url}
        onClick={handleOpen}
        className="flex-1 min-w-0 text-[10px] text-txt font-bold truncate leading-snug"
      >
        {article.title}
      </a>
      <span className="text-[8px] text-txt-3 font-mono flex-shrink-0">{timeAgo(article.published || article.fetched_at)}</span>
    </div>
  )
}

export default function NewsWidget() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['news-widget'],
    queryFn: () => api.getRecentNews(8),
    refetchInterval: 120_000,
    retry: false,
  })

  const { data: countData } = useQuery({
    queryKey: ['news-unread-count'],
    queryFn: api.getNewsUnreadCount,
    refetchInterval: 60_000,
    retry: false,
  })

  const articles = data?.articles ?? []
  const unread = countData?.unread ?? 0

  if (isLoading) return null
  if (articles.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase">Recent News</p>
        {unread > 0 && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-purple/15 text-purple leading-none">
            {unread} unread
          </span>
        )}
        <button
          onClick={() => navigate('/feeds')}
          className="ml-auto text-[9px] font-bold text-txt-3 hover:text-txt-2 transition-colors bg-transparent border-none cursor-pointer"
        >
          View all →
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
        {articles.map((article) => (
          <ArticleRow key={article.id} article={article} />
        ))}
      </div>
    </div>
  )
}
