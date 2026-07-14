import { useMemo, useRef, useState } from 'react'
import { CHART_PALETTE, getTicks, linearScale, prefersReducedMotion } from './chartUtils'
import { ChartTooltip, type TooltipRow } from './ChartTooltip'

export interface BarSeries {
  name: string
  /** Color (si se omite, se asigna de la paleta) */
  color?: string
  data: number[]
}

export type BarMode = 'grouped' | 'stacked'

interface BarChartProps {
  labels: string[]
  series: BarSeries[]
  height?: number
  mode?: BarMode
  /** Formatea valores para tooltip/ejes */
  formatValue?: (v: number) => string
  showGrid?: boolean
  showLegend?: boolean
  /** Si se omite, las series se ocultan en orden inverso (la primera queda al frente en stacked) */
  onBarClick?: (label: string, seriesName: string, value: number) => void
  /** Empty state */
  emptyText?: string
}

/**
 * Bar chart vertical SVG.
 *
 * Soporta dos modos:
 *  - **grouped**: cada serie tiene su propia barra por categoría (lado a lado)
 *  - **stacked**: las series se apilan en una sola barra por categoría
 *
 * Cada barra es un `<rect>` con animación de crecimiento (height 0 → final) usando
 * `chart-grow`. Hover muestra tooltip con todas las series en esa categoría.
 *
 * Click opcional por barra → callback con label, serie y valor.
 */
export function BarChart({
  labels,
  series,
  height = 260,
  mode = 'grouped',
  formatValue,
  showGrid = true,
  showLegend = true,
  onBarClick,
  emptyText = 'Sin datos para mostrar',
}: BarChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState<{ catIdx: number; x: number; y: number } | null>(null)

  const reducedMotion = useMemo(() => prefersReducedMotion(), [])

  // Layout constants
  const PAD_T = 12
  const PAD_B = 36
  const PAD_L = 44
  const PAD_R = 12

  // Tamaño "lógico" del SVG (viewBox)
  const VBW = 600
  const VBH = height
  const innerW = VBW - PAD_L - PAD_R
  const innerH = VBH - PAD_T - PAD_B

  // Asignar colores si no vinieron
  const seriesWithColors = useMemo(
    () => series.map((s, i) => ({ ...s, color: s.color ?? CHART_PALETTE[i % CHART_PALETTE.length] })),
    [series],
  )

  // Calcular max del eje Y
  const maxY = useMemo(() => {
    if (series.length === 0) return 0
    if (mode === 'stacked') {
      // Para stacked, el max es la suma máxima por categoría
      let m = 0
      for (let i = 0; i < labels.length; i++) {
        const s = series.reduce((acc, sr) => acc + (sr.data[i] ?? 0), 0)
        if (s > m) m = s
      }
      return m
    }
    // grouped: max sobre todas las series
    return Math.max(...series.flatMap(s => s.data), 0)
  }, [series, labels, mode])

  const ticks = useMemo(() => getTicks(maxY, 4), [maxY])
  const yScale = linearScale([0, maxY || 1], [innerH, 0])

  // Ancho de categoría
  const catCount = Math.max(labels.length, 1)
  const catWidth = innerW / catCount
  const barCount = mode === 'grouped' ? seriesWithColors.length : 1
  const barGap = 4
  const barWidth = Math.max(2, (catWidth - barGap * 2) / Math.max(barCount, 1) - 4)

  const fmt = formatValue ?? ((v: number) => v.toLocaleString('es-BO'))

  const empty = series.length === 0 || labels.length === 0 || maxY === 0

  // Para stacked: calcular acumulados por categoría
  const stackedAcc = useMemo(() => {
    if (mode !== 'stacked' || empty) return [] as number[][]
    return labels.map((_, i) => {
      const acc: number[] = []
      let prev = 0
      for (const s of seriesWithColors) {
        acc.push(prev)
        prev += s.data[i] ?? 0
      }
      return acc
    })
  }, [mode, empty, labels, seriesWithColors])

  const handleEnter = (catIdx: number, e: React.MouseEvent<SVGRectElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    // x,y del SVG event en píxeles de viewport
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top
    setHover({ catIdx, x: localX, y: localY })
  }

  const handleLeave = () => setHover(null)

  if (empty) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-steel-400" style={{ minHeight: height }}>
        {emptyText}
      </div>
    )
  }

  // Filas del tooltip
  const tooltipRows: TooltipRow[] = hover
    ? seriesWithColors.map((s) => {
        const v = s.data[hover.catIdx] ?? 0
        return { label: s.name, value: fmt(v), color: s.color }
      })
    : []

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
        role="img" aria-label="Bar chart"
        data-chart="true"
      >
        {/* Grid horizontal */}
        {showGrid && ticks.map((t, i) => {
          const y = PAD_T + yScale(t)
          return (
            <g key={`grid-${i}`} pointerEvents="none">
              <line x1={PAD_L} x2={PAD_L + innerW} y1={y} y2={y}
                stroke="#F0EFEC" strokeWidth={1} strokeDasharray="2 3" />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end"
                className="fill-steel-400"
                fontSize={9} fontWeight={500}
                style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmt(t)}
              </text>
            </g>
          )
        })}

        {/* Eje X — labels */}
        {labels.map((lab, i) => {
          const cx = PAD_L + catWidth * (i + 0.5)
          const y = PAD_T + innerH + 14
          const rotate = labels.some(l => l.length > 6) ? -22 : 0
          return (
            <text key={`x-${i}`} x={cx} y={y}
              textAnchor={rotate ? 'end' : 'middle'}
              transform={rotate ? `rotate(${rotate} ${cx} ${y})` : undefined}
              className="fill-steel-500"
              fontSize={10} fontWeight={500}>
              {lab}
            </text>
          )
        })}

        {/* Barras */}
        {labels.map((_, catIdx) => {
          const catX = PAD_L + catWidth * catIdx + barGap
          if (mode === 'grouped') {
            return (
              <g key={`cat-${catIdx}`}>
                {seriesWithColors.map((s, sIdx) => {
                  const v = s.data[catIdx] ?? 0
                  const bx = catX + sIdx * (barWidth + 2)
                  const h = innerH - yScale(v)
                  const y = PAD_T + yScale(v)
                  const animDelay = reducedMotion ? '0ms' : `${catIdx * 40 + sIdx * 20}ms`
                  return (
                    <rect key={`bar-${catIdx}-${sIdx}`}
                      x={bx} y={y}
                      width={barWidth} height={h}
                      fill={s.color}
                      rx={3}
                      className="motion-safe:animate-[chart-grow_600ms_ease-out_both]"
                      style={{
                        transformOrigin: `${bx + barWidth / 2}px ${PAD_T + innerH}px`,
                        animationDelay: animDelay,
                        cursor: onBarClick ? 'pointer' : 'default',
                        transition: 'opacity 150ms ease-out',
                        opacity: hover && hover.catIdx === catIdx ? 1 : hover ? 0.55 : 1,
                      }}
                      onMouseEnter={(e) => handleEnter(catIdx, e)}
                      onMouseLeave={handleLeave}
                      onClick={() => onBarClick?.(labels[catIdx], s.name, v)}
                    />
                  )
                })}
              </g>
            )
          } else {
            // stacked
            return (
              <g key={`cat-${catIdx}`}>
                {seriesWithColors.map((s, sIdx) => {
                  const v = s.data[catIdx] ?? 0
                  const prev = stackedAcc[catIdx]?.[sIdx] ?? 0
                  const top = PAD_T + yScale(prev + v)
                  const bottom = PAD_T + yScale(prev)
                  const h = bottom - top
                  const bx = catX
                  const animDelay = reducedMotion ? '0ms' : `${catIdx * 40 + sIdx * 30}ms`
                  return (
                    <rect key={`bar-${catIdx}-${sIdx}`}
                      x={bx} y={top}
                      width={catWidth - barGap * 2} height={Math.max(h, 0)}
                      fill={s.color}
                      className="motion-safe:animate-[chart-grow_600ms_ease-out_both]"
                      style={{
                        transformOrigin: `${bx + (catWidth - barGap * 2) / 2}px ${PAD_T + innerH}px`,
                        animationDelay: animDelay,
                        cursor: onBarClick ? 'pointer' : 'default',
                        transition: 'opacity 150ms ease-out',
                        opacity: hover && hover.catIdx === catIdx ? 1 : hover ? 0.55 : 1,
                      }}
                      onMouseEnter={(e) => handleEnter(catIdx, e)}
                      onMouseLeave={handleLeave}
                      onClick={() => onBarClick?.(labels[catIdx], s.name, v)}
                    />
                  )
                })}
              </g>
            )
          }
        })}

        {/* Línea base */}
        <line x1={PAD_L} x2={PAD_L + innerW} y1={PAD_T + innerH} y2={PAD_T + innerH}
          stroke="#D1D1D1" strokeWidth={1} />
      </svg>

      {/* Tooltip overlay */}
      {hover && tooltipRows.length > 0 && (
        <ChartTooltip
          x={hover.x}
          y={hover.y}
          title={labels[hover.catIdx]}
          rows={tooltipRows}
          visible
        />
      )}

      {/* Leyenda */}
      {showLegend && seriesWithColors.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 mt-2 px-2">
          {seriesWithColors.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-[11px] text-steel-600 font-semibold">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
