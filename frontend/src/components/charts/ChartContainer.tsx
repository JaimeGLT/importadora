import { forwardRef, type ReactNode, useState, useRef, useEffect } from 'react'
import { useChartExport } from './useChartExport'

interface ChartContainerProps {
  title?: string
  subtitle?: ReactNode
  /** Skeleton con animate-pulse mientras carga */
  loading?: boolean
  /** Slot libre a la derecha del header (links, badges, etc.) */
  headerAction?: ReactNode
  /** Habilita el menú Exportar PNG/PDF en el header */
  enableExport?: boolean
  /** Nombre base del archivo al exportar (sin extensión) */
  exportFilename?: string
  /** Altura mínima del área del chart */
  minHeight?: number | string
  /** Clases adicionales para el contenedor externo */
  className?: string
  children: ReactNode
}

/**
 * Wrapper común para todos los charts SVG. Aporta:
 *  - Header con título + subtítulo + slot de acción
 *  - Skeleton de carga con `animate-pulse`
 *  - Menú Exportar PNG/PDF opcional (botón con dropdown)
 *  - `forwardRef` hacia el contenedor para que `useChartExport` pueda serializar el SVG
 *
 * Estética consistente con `Card` de las páginas de reportes:
 * `bg-white rounded-2xl shadow-sm border border-steel-100 p-5`.
 */
export const ChartContainer = forwardRef<HTMLDivElement, ChartContainerProps>(function ChartContainer(
  { title, subtitle, loading, headerAction, enableExport, exportFilename, minHeight = 240, className = '', children },
  ref,
) {
  const { exportPNG, exportPDF } = useChartExport()
  const innerRef = useRef<HTMLDivElement | null>(null)

  // Sincronizar el forwardRef con el innerRef para que useChartExport funcione
  const setRefs = (node: HTMLDivElement | null) => {
    innerRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
  }

  const [exportOpen, setExportOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)

  // Cerrar el menú al click fuera
  useEffect(() => {
    if (!exportOpen) return
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportOpen])

  const filename = exportFilename ?? (title ? title.toLowerCase().replace(/\s+/g, '-') : 'chart')

  return (
    <div ref={setRefs} className={`bg-white rounded-2xl shadow-sm border border-steel-100 p-5 ${className}`}>
      {(title || headerAction || enableExport) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-sm font-bold text-steel-800 truncate">{title}</h2>}
            {subtitle && <div className="text-xs text-steel-400 mt-0.5">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerAction}
            {enableExport && (
              <div ref={exportMenuRef} className="relative">
                <button
                  onClick={() => setExportOpen(o => !o)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-steel-500 hover:bg-steel-50 hover:text-steel-700 transition-colors"
                  title="Exportar"
                  aria-label="Exportar"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Exportar
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-steel-100 py-1 min-w-[140px]">
                    <button
                      onClick={() => { exportPNG(innerRef, filename); setExportOpen(false) }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-steel-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="h-3.5 w-3.5 text-steel-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Descargar PNG</span>
                    </button>
                    <button
                      onClick={() => { exportPDF(innerRef, filename, title); setExportOpen(false) }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-steel-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="h-3.5 w-3.5 text-steel-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span>Descargar PDF</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse" style={{ minHeight }}>
          <div className="h-full w-full bg-steel-50 rounded-lg" />
        </div>
      ) : (
        <div style={{ minHeight }} className="relative">
          {children}
        </div>
      )}
    </div>
  )
})
