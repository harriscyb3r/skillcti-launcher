interface PaginationProps {
  page: number
  totalPages: number
  total: number
  from: number
  to: number
  hasPrev: boolean
  hasNext: boolean
  onPage: (p: number) => void
}

export default function Pagination({ page, totalPages, total, from, to, hasPrev, hasNext, onPage }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="border-t border-border mt-1 pt-3 flex items-center justify-between">
      <span className="text-[10px] text-txt-3 font-mono">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={!hasPrev}
          className="text-[11px] font-bold px-3 py-1.5 rounded border border-border text-txt-2 bg-transparent cursor-pointer disabled:opacity-30 hover:border-purple transition-colors"
        >
          Prev
        </button>
        <span className="text-[10px] text-txt-3 font-mono tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={!hasNext}
          className="text-[11px] font-bold px-3 py-1.5 rounded border border-border text-txt-2 bg-transparent cursor-pointer disabled:opacity-30 hover:border-purple transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
