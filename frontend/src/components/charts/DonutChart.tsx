import { useMemo, useRef, useState } from 'react'
import { arcPath, polarToCartesian, paletteAt, sum, prefersReducedMotion } from './chartUtils'
import { ChartTooltip, type TooltipRow } from './ChartTooltip'

export interface DonutSegment {
  label: string
  value: number
  color?: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  /** Texto pequeño arriba del valor central (ej: "Total ventas") */
  centerLabel?: string
  /** Valor grande del centro (ej: "Bs 12.500") */
  centerValue?: string
  /** Sub-texto debajo del valor central (ej: "32 órdenes") */
  centerSub?: string
  /** Callback al hacer click en un segmento (filtro cruzado) */
  onSegmentClick?: (segment: DonutSegment) => void
  /** Si se provee, los demás segmentos bajan opacidad (modo "filtro aplicado") */
  selectedLabel?: string
  /** Formatea el valor en el tooltip */
  formatValue?: (v: number) => string
  /** Separación en grados entre segmentos (gap visual) */
  gap?: number
  /** Empty state copy si segments.length === 0 */
  emptyText?: string
}

/**
 * Donut chart SVG puro.
 *
 * Cada segmento es un `<path>` independiente para que reciba hover/click propios.
 * El círculo central está libre para poner label + valor.
 *
 * Soporta:
 *  - Hover → tooltip flotante
 *  - Click → onSegmentClick (filtro cruzado)
 *  - Animación de entrada con `chart-fade-in` y delay escalonado por segmento
 *  - Modo "selección activa" bajando opacidad de los segmentos no seleccionados
 *  - prefers-reduced-motion (salta animaciones)
 */
export function DonutChart({
  segments,
  size = 180,
  thickness = 32,
  centerLabel,
  centerValue,
  centerSub,
  onSegmentClick,
  selectedLabel,
  formatValue,
  gap = 1.2,
  emptyText = 'Sin datos para mostrar',
}: DonutChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; rows: TooltipRow[]; title: string } | null>(null)

  const reducedMotion = useMemo(() => prefersReducedMotion(), [])

  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 4
  const innerR = outerR - thickness

  const total = useMemo(() => sum(segments.map(s => s.value)), [segments])
  const empty = segments.length === 0 || total === 0

  // Calcular arcos
  const arcs = useMemo(() => {
    if (empty) return []
    let acc = 0
    return segments.map((s, i) => {
      const startAngle = (acc / total) * 360 + gap / 2
      acc += s.value
      const endAngle = (acc / total) * 360 - gap / 2
      const color = s.color ?? paletteAt(i)
      const midAngle = (startAngle + endAngle) / 2
      const labelPos = polarToCartesian(cx, cy, (outerR + innerR) / 2, midAngle)
      const isSelected = !selectedLabel || selectedLabel === s.label
      const isHovered = hoverIdx === i
      return {
        segment: s,
        color,
        path: arcPath(cx, cy, innerR, outerR, startAngle, endAngle),
        midAngle,
        labelPos,
        isSelected,
        isHovered,
        // Animación: pop-out 3px del centro cuando hovereado
        offset: isHovered ? 4 : 0,
      }
    })
  }, [segments, total, empty, hoverIdx, selectedLabel, cx, cy, outerR, innerR, gap])

  const fmt = formatValue ?? ((v: number) => v.toLocaleString('es-BO'))

  const handleEnter = (i: number) => {
    setHoverIdx(i)
    const a = arcs[i]
    if (!a || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (a.labelPos.x / size) * rect.width
    const y = (a.labelPos.y / size) * rect.height
    const pct = (a.segment.value / total) * 100
    setTooltip({
      x, y,
      title: a.segment.label,
      rows: [
        { label: 'Valor', value: fmt(a.segment.value), color: a.color },
        { label: 'Participación', value: `${pct.toFixed(pct < 10 ? 1 : 0)}%` },
      ],
    })
  }

  const handleLeave = () => {
    setHoverIdx(null)
    setTooltip(null)
  }

  const handleClick = (segment: DonutSegment) => {
    onSegmentClick?.(segment)
  }

  if (empty) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-steel-400" style={{ minHeight: size }}>
        {emptyText}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        role="img" aria-label="Donut chart"
        data-chart="true"
        className="motion-safe:animate-[chart-fade-in_500ms_ease-out]">
        {/* Track gris de fondo */}
        <circle cx={cx} cy={cy} r={(outerR + innerR) / 2}
          fill="none" stroke="#F0EFEC" strokeWidth={thickness} />

        {/* Cada segmento es un path independiente */}
        {arcs.map((a, i) => {
          const opacity = selectedLabel && !a.isSelected ? 0.22 : 1
          const cursor = onSegmentClick ? 'pointer' : 'default'
          const animDelay = reducedMotion ? '0ms' : `${i * 60}ms`
          return (
            <g key={i}
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: a.offset ? `translate(${Math.cos(((a.midAngle - 90) * Math.PI) / 180) * a.offset}px, ${Math.sin(((a.midAngle - 90) * Math.PI) / 180) * a.offset}px)` : 'none',
                transition: 'transform 180ms ease-out, opacity 200ms ease-out',
                opacity,
                animation: reducedMotion ? undefined : `chart-fade-in 500ms ease-out ${animDelay} both`,
                cursor,
              }}
              onMouseEnter={() => handleEnter(i)}
              onMouseLeave={handleLeave}
              onClick={() => handleClick(a.segment)}>
              <path d={a.path} fill={a.color}
                stroke="#FFFFFF" strokeWidth={hoverIdx === i ? 2 : 1}
                style={{ transition: 'stroke-width 120ms ease-out' }} />
            </g>
          )
        })}

        {/* Centro: label + valor */}
        {(centerLabel || centerValue || centerSub) && (
          <g pointerEvents="none">
            <text x={cx} y={cy - 12} textAnchor="middle"
              className="fill-steel-400"
              fontSize={10} fontWeight={700}
              style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {centerLabel ?? ''}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle"
              className="fill-steel-900"
              fontSize={20} fontWeight={800}
              style={{ fontVariantNumeric: 'tabular-nums' }}>
              {centerValue ?? ''}
            </text>
            {centerSub && (
              <text x={cx} y={cy + 24} textAnchor="middle"
                className="fill-steel-400"
                fontSize={10} fontWeight={500}>
                {centerSub}
              </text>
            )}
          </g>
        )}
      </svg>

      {/* Tooltip overlay (mismo tamaño que el SVG, así x/y coinciden) */}
      {tooltip && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <ChartTooltip
            x={tooltip.x}
            y={tooltip.y}
            title={tooltip.title}
            rows={tooltip.rows}
            visible
          />
        </div>
      )}
    </div>
  )
}
