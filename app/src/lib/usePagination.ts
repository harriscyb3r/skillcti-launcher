import { useState, useEffect } from 'react'

export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [items.length])

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, total)
  const paged = items.slice((safePage - 1) * pageSize, safePage * pageSize)

  return {
    page: safePage,
    totalPages,
    paged,
    setPage,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
    total,
    from,
    to,
  }
}
