import { useMemo } from 'react'
import { prefersReducedMotion } from './chartUtils'

interface GaugeChartProps {
  /** Valor 0-100 (porcentaje). Si >100 se clipea; si <0 se trata como 0. */
  value: number
  /** Label arriba del número (ej: "Stock crítico") */
  label: string
  /** Sub-texto debajo del número (ej: "8 de 120 productos") */
  sublabel?: string
  /** Valor numérico formateado para el centro (default: `${value}%`) */
  displayValue?: string
  size?: number
  /** Umbrales para colorear el valor (0-100). Default: ok<15, warn<30, crit>=30 */
  thresholds?: { ok: number; warn: number }
  /** Empty state si value es null o no hay datos */
  emptyText?: string
}

const COLOR_OK    = '#3F7A52' // esmeralda
const COLOR_WARN  = '#D4A333' // oro
const COLOR_CRIT  = '#C8102E' // brand
const COLOR_TRACK = '#F0EFEC'

/**
 * Gauge semicircular SVG.
 *
 * El arco va de -90° (izquierda) a +90° (derecha) pasando por arriba (0°).
 * Se divide visualmente en 3 zonas (ok/warn/crit) según `thresholds`.
 * El valor actual se pinta como un arco filled con animación `chart-gauge-fill`.
 *
 * Layout del viewBox:
 *  ┌────────────────────────┐  y = 0
 *  │        ╱─────╲         │  ← arco (semicírculo)
 *  │      ╱         ╲       │
 *  │                       │
 *  │     LABEL               │  ← label
 *  │     8.5%                │  ← value (grande)
 *  │     sublabel            │  ← sublabel
 *  └────────────────────────┘  y = VBH
 *
 * Útil para: % stock crítico, % utilización de inventario, tasa de completitud.
 */
export function GaugeChart({
  value,
  label,
  sublabel,
  displayValue,
  size = 200,
  thresholds = { ok: 15, warn: 30 },
  emptyText = 'Sin datos',
}: GaugeChartProps) {
  const reducedMotion = useMemo(() => prefersReducedMotion(), [])

  // Layout: viewBox casi cuadrado (un poco más alto que ancho) para que el
  // semicírculo arriba y el bloque label/value/sublabel abajo quepan sin
  // quedar clippeados ni solaparse con el arco.
  const VBW = size
  const VBH = Math.round(size * 0.95)
  const cx = VBW / 2

  // cy = fondo del semicírculo. Lo colocamos en la mitad del viewBox para
  // que el arco ocupe la mitad superior y debajo quede el bloque de texto.
  const cy = Math.round(VBH * 0.5)

  // Radio: limitado por el ancho (mitad) y por la altura disponible arriba.
  const arcTopMargin = 6
  const maxRByWidth  = VBW / 2 - 18
  const maxRByHeight = cy - arcTopMargin
  const r = Math.min(maxRByWidth, maxRByHeight)

  const thickness = 16

  const v = Math.max(0, Math.min(100, value))
  const empty = !Number.isFinite(v) || value === null

  // Función para describir un arco como path SVG (sólo stroke)
  const arcStroke = (startDeg: number, endDeg: number, radius: number): string => {
    const toRad = (d: number) => ((d - 180) * Math.PI) / 180 // -180 para que 0° esté a la izquierda
    const sx = cx + radius * Math.cos(toRad(startDeg))
    const sy = cy + radius * Math.sin(toRad(startDeg))
    const ex = cx + radius * Math.cos(toRad(endDeg))
    const ey = cy + radius * Math.sin(toRad(endDeg))
    const largeArc = endDeg - startDeg > 180 ? 1 : 0
    return `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`
  }

  // Valor → color
  let valueColor: string
  if (v <= thresholds.ok) valueColor = COLOR_OK
  else if (v <= thresholds.warn) valueColor = COLOR_WARN
  else valueColor = COLOR_CRIT

  // Valor actual: arco de -90° a (-90 + v%) * 180/100
  const totalDeg = 180
  const valueDeg = (v / 100) * totalDeg
  const startValueDeg = -90
  const endValueDeg = startValueDeg + valueDeg
  const valuePath = v > 0 ? arcStroke(startValueDeg, endValueDeg, r) : ''

  // Zones (de fondo, pintadas según thresholds)
  const okEnd   = startValueDeg + (thresholds.ok  / 100) * totalDeg
  const warnEnd = startValueDeg + (thresholds.warn / 100) * totalDeg
  const trackPath = arcStroke(-90, 90, r)

  // arc-length para animar stroke-dashoffset
  const arcLength = Math.PI * r
  const dashOffset = arcLength * (1 - v / 100)

  // Posición vertical de los textos (todos DEBAJO del arco, en bloque centrado).
  //   label     → ~18px debajo del fondo del arco
  //   value     → grande, debajo del label
  //   sublabel  → pequeño, debajo del value
  const labelY    = cy + 18
  const valueY    = cy + 48
  const sublabelY = cy + 68

  return (
    <div className="relative flex flex-col items-center justify-center h-full">
      {empty ? (
        <div className="flex items-center justify-center text-xs text-steel-400" style={{ minHeight: size * 0.5 }}>
          {emptyText}
        </div>
      ) : (
        <svg width={VBW} height={VBH} viewBox={`0 0 ${VBW} ${VBH}`}
          role="img" aria-label={`Gauge: ${label}`}
          data-chart="true"
          className="motion-safe:animate-[chart-fade-in_600ms_ease-out]">
          {/* Track base gris */}
          <path d={trackPath} fill="none" stroke={COLOR_TRACK}
            strokeWidth={thickness} strokeLinecap="round" />

          {/* Zones (segmentos de color de fondo, baja opacidad) */}
          <path d={arcStroke(-90, okEnd, r)} fill="none" stroke={COLOR_OK}
            strokeWidth={thickness - 6} strokeLinecap="butt" opacity={0.18} />
          <path d={arcStroke(okEnd, warnEnd, r)} fill="none" stroke={COLOR_WARN}
            strokeWidth={thickness - 6} strokeLinecap="butt" opacity={0.18} />
          <path d={arcStroke(warnEnd, 90, r)} fill="none" stroke={COLOR_CRIT}
            strokeWidth={thickness - 6} strokeLinecap="butt" opacity={0.18} />

          {/* Valor arc (filled con animación) */}
          {v > 0 && (
            <path d={valuePath} fill="none" stroke={valueColor}
              strokeWidth={thickness} strokeLinecap="round"
              strokeDasharray={arcLength}
              strokeDashoffset={reducedMotion ? dashOffset : arcLength}
              className="motion-safe:animate-[chart-gauge-fill_1100ms_ease-out_both]"
              style={{ animationFillMode: 'forwards' }} />
          )}

          {/* Centro: label / value / sublabel */}
          <text x={cx} y={labelY} textAnchor="middle"
            className="fill-steel-400"
            fontSize={9} fontWeight={700}
            style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {label}
          </text>
          <text x={cx} y={valueY} textAnchor="middle"
            fontSize={28} fontWeight={800}
            style={{ fill: valueColor, fontVariantNumeric: 'tabular-nums' }}>
            {displayValue ?? `${v.toFixed(v < 10 ? 1 : 0)}%`}
          </text>
          {sublabel && (
            <text x={cx} y={sublabelY} textAnchor="middle"
              className="fill-steel-500"
              fontSize={9} fontWeight={500}>
              {sublabel}
            </text>
          )}
        </svg>
      )}
    </div>
  )
}
