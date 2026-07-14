import { useMemo, useState } from 'react'
import { paletteAt, prefersReducedMotion, truncate } from './chartUtils'

export interface HorizontalBarItem {
  label: string
  sublabel?: string
  value: number
  /** Valor formateado que se muestra a la derecha (ej: "Bs 12.500" o "32 uds") */
  displayValue?: string
  color?: string
  /** ID para usar como key si los labels se repiten */
  id?: string
}

interface HorizontalBarChartProps {
  items: HorizontalBarItem[]
  /** Ancho máximo del valor (auto si no se pasa) */
  maxValue?: number
  /** Formatea el valor cuando displayValue no viene en el item */
  formatValue?: (v: number) => string
  /** Callback al click en una fila */
  onItemClick?: (item: HorizontalBarItem) => void
  /** Label clickable actualmente "seleccionado" (lo resalta, baja opacidad del resto) */
  selectedLabel?: string
  /** Empty state */
  emptyText?: string
  /** Alto de cada fila en px (default 44) */
  rowHeight?: number
  /** Altura máxima total (para scroll interno si hay muchas filas) */
  maxHeight?: number | string
}

/**
 * Bar chart horizontal — ideal para rankings (top productos, top clientes, top marcas).
 *
 * Cada fila es una `<div>` HTML con barra absoluta animada de width 0 → final.
 * Soporta:
 *  - Hover → resalta la fila (sutil fondo)
 *  - Click → callback con el item
 *  - Modo "selección" → baja opacidad de las filas no seleccionadas (filtro cruzado)
 *  - Animación de crecimiento con `chart-grow`
 *  - prefers-reduced-motion (salta animaciones)
 */
export function HorizontalBarChart({
  items,
  maxValue,
  formatValue,
  onItemClick,
  selectedLabel,
  emptyText = 'Sin datos para mostrar',
  rowHeight = 44,
  maxHeight,
}: HorizontalBarChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const reducedMotion = useMemo(() => prefersReducedMotion(), [])

  const max = useMemo(
    () => maxValue ?? Math.max(...items.map(i => i.value), 0),
    [items, maxValue],
  )

  const fmt = formatValue ?? ((v: number) => v.toLocaleString('es-BO'))

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-steel-400" style={{ minHeight: 80 }}>
        {emptyText}
      </div>
    )
  }

  return (
    <div className="space-y-1.5 overflow-y-auto" style={maxHeight ? { maxHeight } : undefined}>
      {items.map((it, i) => {
        const pct = max > 0 ? (it.value / max) * 100 : 0
        const color = it.color ?? paletteAt(i)
        const isHovered = hoverIdx === i
        const isSelected = !selectedLabel || selectedLabel === it.label
        const dim = selectedLabel && !isSelected
        const animDelay = reducedMotion ? '0ms' : `${i * 50}ms`

        return (
          <div
            key={it.id ?? `${it.label}-${i}`}
            className={`relative flex items-center gap-3 rounded-lg transition-colors ${
              isHovered ? 'bg-steel-50' : ''
            } ${dim ? 'opacity-35' : ''} ${
              onItemClick ? 'cursor-pointer hover:bg-steel-50' : ''
            }`}
            style={{ minHeight: rowHeight, padding: '8px 10px' }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            onClick={() => onItemClick?.(it)}
          >
            {/* Rank badge */}
            <div className="shrink-0 w-5 text-right">
              <span className={`text-xs font-black tabular-nums ${i === 0 ? 'text-brand-600' : 'text-steel-300'}`}>
                {i + 1}
              </span>
            </div>

            {/* Label + sublabel */}
            <div className="shrink-0 w-44 min-w-0">
              <p className="text-xs font-semibold text-steel-800 truncate" title={it.label}>
                {truncate(it.label, 28)}
              </p>
              {it.sublabel && (
                <p className="text-[10px] text-steel-400 truncate tabular-nums" title={it.sublabel}>
                  {it.sublabel}
                </p>
              )}
            </div>

            {/* Barra (flex-1) */}
            <div className="flex-1 min-w-0 h-2 bg-steel-100 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full motion-safe:animate-[chart-grow_700ms_ease-out_both]"
                style={{
                  width: `${pct}%`,
                  background: color,
                  animationDelay: animDelay,
                  transformOrigin: 'left center',
                  transition: 'opacity 200ms ease-out',
                  opacity: isHovered ? 1 : 0.92,
                }}
              />
            </div>

            {/* Valor a la derecha */}
            <div className="shrink-0 text-right tabular-nums">
              <p className="text-xs font-bold text-steel-800">{it.displayValue ?? fmt(it.value)}</p>
              {it.displayValue && (
                <p className="text-[10px] text-steel-400">{fmt(it.value)}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
