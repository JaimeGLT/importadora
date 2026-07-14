import { useMemo, useRef, useState } from 'react'
import { linearScale, formatBsShort, prefersReducedMotion } from './chartUtils'
import { ChartTooltip, type TooltipRow } from './ChartTooltip'

export interface AreaSeries {
  name: string
  color?: string
  data: number[]
}

interface AreaChartProps {
  /** Etiquetas del eje X (fechas o categorías) */
  labels: string[]
  /** Una o más series. Una sola = line+area, varias = overlay translúcido */
  series: AreaSeries[]
  height?: number
  formatValue?: (v: number) => string
  showGrid?: boolean
  /** Callback cuando el cursor entra/sale de un índice (consistente con SalesChart) */
  onHover?: (idx: number | null) => void
  /** Color por defecto (cuando hay una sola serie) */
  defaultColor?: string
  /** Empty state */
  emptyText?: string
}

const BRAND = '#C8102E'

/**
 * Area chart SVG puro — versión evolucionada del SalesChart original.
 *
 * Soporta múltiples series superpuestas con áreas translúcidas.
 * La línea se anima con `chart-draw` (stroke-dashoffset) y el fill con `chart-fade-in`.
 *
 * Mantiene la misma API que `SalesChart` (labels + onHover) para que sea un drop-in
 * replacement cuando se quiera área filled en lugar de línea simple.
 */
export function AreaChart({
  labels,
  series,
  height = 220,
  formatValue,
  showGrid = true,
  onHover,
  defaultColor = BRAND,
  emptyText = 'Sin datos para mostrar',
}: AreaChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const reducedMotion = useMemo(() => prefersReducedMotion(), [])

  const PAD = 6
  const VBW = 600
  const VBH = height

  // Normalizar series con color
  const seriesC = useMemo(() => series.map((s, i) => ({
    ...s,
    color: s.color ?? (series.length === 1 ? defaultColor : ['#C8102E', '#3B82F6', '#3F7A52'][i] ?? '#C8102E'),
  })), [series, defaultColor])

  const allData = seriesC.flatMap(s => s.data)
  const max = Math.max(...allData, 0)
  const min = Math.min(...allData, 0)
  const mid = (max + min) / 2

  const innerW = VBW - PAD * 2
  const innerH = VBH - PAD * 2
  const xStep = innerW / Math.max(labels.length - 1, 1)
  const yScale = linearScale([min, max], [innerH, 0])

  const fmt = formatValue ?? ((v: number) => formatBsShort(v))

  const empty = labels.length === 0 || series.length === 0 || allData.every(v => v === 0)

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || labels.length === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, localX / rect.width))
    const idx = Math.round(ratio * (labels.length - 1))
    setHoverIdx(idx)
    setTooltipPos({ x: localX, y: rect.height / 2 })
    onHover?.(idx)
  }

  const handleLeave = () => {
    setHoverIdx(null)
    setTooltipPos(null)
    onHover?.(null)
  }

  if (empty) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-steel-400" style={{ minHeight: height }}>
        {emptyText}
      </div>
    )
  }

  // Construir path de área + línea para cada serie
  const seriesPaths = seriesC.map((s) => {
    const pts = s.data.map((v, i) => ({
      x: PAD + i * xStep,
      y: PAD + yScale(v),
    }))
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    // Cerrar el área agregando línea a baseline
    const areaPath = pts.length > 0
      ? `${linePath} L ${pts[pts.length - 1]!.x} ${PAD + innerH} L ${pts[0]!.x} ${PAD + innerH} Z`
      : ''
    return { linePath, areaPath, pts }
  })

  // Path length para animar (aprox = innerW + innerH)
  const pathLength = innerW + innerH

  // Tooltip rows: una por serie en el idx hovereado
  const tooltipRows: TooltipRow[] = hoverIdx !== null
    ? seriesC.map((s) => {
        const v = s.data[hoverIdx] ?? 0
        return { label: s.name, value: fmt(v), color: s.color }
      })
    : []

  // X labels (mostrar subset para no saturar)
  const xLabels = labels.filter((_, i) => i % Math.ceil(labels.length / 7) === 0)

  return (
    <div ref={containerRef} className="relative w-full h-full"
      onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <div className="flex gap-2 h-full">
        {/* Eje Y labels */}
        <div className="flex flex-col justify-between text-right shrink-0 pb-5" style={{ width: 44 }}>
          <span className="text-[10px] font-semibold tabular-nums text-steel-400">{fmt(max)}</span>
          <span className="text-[10px] font-semibold tabular-nums text-steel-400">{fmt(mid)}</span>
          <span className="text-[10px] font-semibold tabular-nums text-steel-400">{fmt(min)}</span>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="relative flex-1 min-h-0">
            {/* Grid */}
            {showGrid && (
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[0, 1, 2].map(i => (
                  <div key={i} className="border-t border-dashed border-steel-100" />
                ))}
              </div>
            )}

            <svg viewBox={`0 0 ${VBW} ${VBH}`} preserveAspectRatio="none"
              className="w-full h-full overflow-visible"
              role="img" aria-label="Area chart"
              data-chart="true">
              <defs>
                {seriesC.map((s, i) => (
                  <linearGradient key={`grad-${i}`} id={`area-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                ))}
              </defs>

              {seriesPaths.map((p, i) => {
                const color = seriesC[i]!.color
                const animDelay = reducedMotion ? '0ms' : `${i * 120}ms`
                return (
                  <g key={`s-${i}`}>
                    <path d={p.areaPath} fill={`url(#area-grad-${i})`}
                      className="motion-safe:animate-[chart-fade-in_700ms_ease-out_both]"
                      style={{ animationDelay: animDelay }} />
                    <path d={p.linePath} fill="none" stroke={color}
                      strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
                      strokeDasharray={pathLength}
                      className="motion-safe:animate-[chart-draw_900ms_ease-out_both]"
                      style={{ animationDelay: animDelay }} />
                  </g>
                )
              })}

              {/* Hover marker */}
              {hoverIdx !== null && seriesPaths[0] && (
                <g pointerEvents="none">
                  <line
                    x1={PAD + hoverIdx * xStep} x2={PAD + hoverIdx * xStep}
                    y1={PAD} y2={PAD + innerH}
                    stroke="#C8102E" strokeWidth={1} opacity={0.2}
                  />
                  {seriesPaths.map((p, i) => {
                    const pt = p.pts[hoverIdx]
                    if (!pt) return null
                    return (
                      <circle key={`dot-${i}`} cx={pt.x} cy={pt.y}
                        r={3.5} fill="white" stroke={seriesC[i]!.color} strokeWidth={2} />
                    )
                  })}
                </g>
              )}
              {!hoverIdx && seriesPaths[0]?.pts && (
                <g pointerEvents="none">
                  {seriesPaths.map((p, i) => {
                    const pt = p.pts[p.pts.length - 1]
                    if (!pt) return null
                    return (
                      <circle key={`last-${i}`} cx={pt.x} cy={pt.y}
                        r={3} fill="white" stroke={seriesC[i]!.color} strokeWidth={2} />
                    )
                  })}
                </g>
              )}
            </svg>
          </div>

          {/* X axis labels */}
          <div className="flex justify-between mt-2 shrink-0">
            {xLabels.map((d, i) => (
              <span key={i} className="text-[10px] text-steel-400">{d}</span>
            ))}
          </div>
        </div>
      </div>

      {hoverIdx !== null && tooltipPos && tooltipRows.length > 0 && (
        <ChartTooltip
          x={tooltipPos.x}
          y={tooltipPos.y}
          title={labels[hoverIdx]}
          rows={tooltipRows}
          visible
        />
      )}
    </div>
  )
}
