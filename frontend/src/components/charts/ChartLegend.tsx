import { type ReactNode } from 'react'

export interface LegendItem {
  label: string
  color: string
  value?: string
  /** Si se provee, el item es clickeable y muestra un indicador de "active" */
  active?: boolean
}

interface ChartLegendProps {
  items: LegendItem[]
  onToggle?: (label: string) => void
  className?: string
}

/**
 * Leyenda horizontal/vertical para los charts multi-serie.
 * Si se pasa `onToggle`, los items son clickeables y bajan opacidad cuando inactivos.
 * Si no, es sólo presentación.
 */
export function ChartLegend({ items, onToggle, className = '' }: ChartLegendProps): ReactNode {
  const interactive = !!onToggle
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      {items.map((it, i) => {
        const isActive = it.active !== false
        const content = (
          <>
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0 transition-opacity"
              style={{
                background: it.color,
                opacity: interactive && !isActive ? 0.35 : 1,
              }}
            />
            <span
              className="text-[11px] text-steel-600 font-semibold transition-opacity tabular-nums"
              style={{ opacity: interactive && !isActive ? 0.45 : 1 }}
            >
              {it.label}
            </span>
            {it.value && (
              <span
                className="text-[10px] text-steel-400 tabular-nums transition-opacity"
                style={{ opacity: interactive && !isActive ? 0.45 : 1 }}
              >
                {it.value}
              </span>
            )}
          </>
        )
        if (!interactive) {
          return <div key={i} className="flex items-center gap-1.5">{content}</div>
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onToggle?.(it.label)}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition-colors ${
              isActive ? 'hover:bg-steel-50' : 'hover:bg-steel-50/60'
            }`}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
