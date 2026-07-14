import type { Table } from '@tanstack/react-table'
import { clsx } from 'clsx'

export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 0] // 0 = todos

interface TablePaginationProps<T> {
  table: Table<T>
  totalRows: number
  pageSizeOptions?: number[]
}

export function TablePagination<T>({
  table,
  totalRows,
  pageSizeOptions = TABLE_PAGE_SIZE_OPTIONS,
}: TablePaginationProps<T>) {
  const { pageIndex, pageSize } = table.getState().pagination
  const isAll = pageSize >= totalRows && totalRows > 0
  const pageCount = table.getPageCount()

  const from = isAll ? 1 : pageIndex * pageSize + 1
  const to   = isAll ? totalRows : Math.min((pageIndex + 1) * pageSize, totalRows)

  // Build page window: at most 5 pages around current
  const pages: (number | '…')[] = []
  if (pageCount <= 7) {
    for (let i = 0; i < pageCount; i++) pages.push(i)
  } else {
    pages.push(0)
    if (pageIndex > 2) pages.push('…')
    for (let i = Math.max(1, pageIndex - 1); i <= Math.min(pageCount - 2, pageIndex + 1); i++) pages.push(i)
    if (pageIndex < pageCount - 3) pages.push('…')
    pages.push(pageCount - 1)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      {/* Info + page size */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-steel-400 tabular-nums">
          {totalRows === 0
            ? 'Sin resultados'
            : isAll
            ? `${totalRows} producto${totalRows !== 1 ? 's' : ''}`
            : `${from}–${to} de ${totalRows}`}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-steel-400">Mostrar</span>
          <select
            value={isAll ? 0 : pageSize}
            onChange={(e) => {
              const val = Number(e.target.value)
              table.setPageIndex(0)
              table.setPageSize(val === 0 ? 999999 : val)
            }}
            className="text-xs font-semibold text-steel-700 bg-steel-50 border border-steel-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent cursor-pointer"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s === 0 ? 'Todos' : s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Page buttons — hidden when all rows fit */}
      {!isAll && pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-lg text-steel-400 hover:text-steel-700 hover:bg-steel-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`e-${i}`} className="px-1 text-steel-300 text-xs select-none">…</span>
            ) : (
              <button
                key={p}
                onClick={() => table.setPageIndex(p as number)}
                className={clsx(
                  'min-w-[30px] h-7 rounded-lg text-xs font-semibold transition-colors',
                  p === pageIndex
                    ? 'bg-brand-600 text-white'
                    : 'text-steel-600 hover:bg-steel-100',
                )}
              >
                {(p as number) + 1}
              </button>
            )
          )}

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-lg text-steel-400 hover:text-steel-700 hover:bg-steel-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
