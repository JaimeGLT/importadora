import { clsx } from 'clsx'

const DEFAULT_PAGE_SIZE_OPTIONS = [15, 25, 50, 100]

interface ServerPaginationProps {
  totalCount: number
  page: number
  pageSize: number
  hasNextPage: boolean
  loading?: boolean
  onPage: (page: number) => void
  onPageSize: (size: number) => void
  pageSizeOptions?: number[]
}

export function ServerPagination({
  totalCount,
  page,
  pageSize,
  hasNextPage,
  loading = false,
  onPage,
  onPageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: ServerPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = totalCount === 0 ? 0 : page * pageSize + 1
  const to   = Math.min((page + 1) * pageSize, totalCount)

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pages.push(i)
  } else {
    pages.push(0)
    if (page > 2) pages.push('…')
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i)
    if (page < totalPages - 3) pages.push('…')
    pages.push(totalPages - 1)
  }

  const canReach = (p: number) => {
    if (loading) return false
    if (p === page) return false
    if (p < page) return true
    if (p === page + 1 && hasNextPage) return true
    return false
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
      <div className="flex items-center gap-3">
        <span className="text-xs text-on-surface-variant tabular-nums">
          {totalCount === 0
            ? 'Sin resultados'
            : `${from}–${to} de ${totalCount}`}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-on-surface-variant/60">Mostrar</span>
          <select
            value={pageSize}
            onChange={e => onPageSize(Number(e.target.value))}
            disabled={loading}
            className="text-xs font-medium text-[#780e18] bg-[#F4ECDB] border border-[#D8D4D0] rounded-lg px-2 py-1 focus:outline-none focus:border-[#780e18] cursor-pointer disabled:opacity-50"
          >
            {pageSizeOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page === 0 || loading}
            title="Página anterior"
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-[#780e18] hover:bg-[#780e18]/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`e-${i}`} className="px-1 text-on-surface-variant/40 text-xs select-none">…</span>
            ) : (
              <button
                key={p}
                onClick={() => canReach(p as number) ? onPage(p as number) : undefined}
                disabled={!canReach(p as number)}
                className={clsx(
                  'min-w-[30px] h-7 rounded-lg text-xs font-semibold transition-colors',
                  p === page
                    ? 'bg-[#780e18] text-[#F4ECDB] shadow-sm'
                    : canReach(p as number)
                      ? 'text-[#780e18] hover:bg-[#780e18]/8 cursor-pointer'
                      : 'text-on-surface-variant/30 cursor-not-allowed',
                )}
              >
                {(p as number) + 1}
              </button>
            )
          )}

          <button
            onClick={() => onPage(page + 1)}
            disabled={!hasNextPage || loading}
            title="Página siguiente"
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-[#780e18] hover:bg-[#780e18]/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
