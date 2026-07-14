// ─────────────────────────────────────────────────────────────────────────────
// Utilidades compartidas para todos los charts SVG custom.
// Mantener este archivo sin dependencias externas — sólo funciones puras.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paleta de 8 colores armoniosa con el sistema de diseño del proyecto.
 * brand (rojo) → accent (oro) → verde esmeralda → azul → púrpura → naranja → rosa → teal.
 * Los dos primeros coinciden con el tema principal; el resto se reserva para series múltiples.
 */
export const CHART_PALETTE = [
  '#C8102E', // brand (rojo principal)
  '#D4A333', // accent (oro)
  '#3F7A52', // esmeralda
  '#3B82F6', // azul
  '#8B5CF6', // púrpura
  '#F97316', // naranja
  '#EC4899', // rosa
  '#14B8A6', // teal
] as const

export type ChartColor = (typeof CHART_PALETTE)[number]

/** Devuelve el color i-ésimo de la paleta (con wrap-around). */
export function paletteAt(i: number): string {
  return CHART_PALETTE[((i % CHART_PALETTE.length) + CHART_PALETTE.length) % CHART_PALETTE.length]
}

// ─── Formatters ─────────────────────────────────────────────────────────────

/** Formatea un número como moneda en Bolivianos. Ej: 12500 → "Bs 12.500" */
export function formatBs(n: number): string {
  return `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/** Formato corto: 1250 → "1k", 1500000 → "1.5M" */
export function formatBsShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`
  return String(Math.round(n))
}

/** Formatea un número como porcentaje entero. Ej: 0.245 → "25%" */
export function formatPct(n: number, decimals = 0): string {
  return `${(n * 100).toFixed(decimals)}%`
}

/** Formatea un número con separador de miles sin sufijo. */
export function formatInt(n: number): string {
  return n.toLocaleString('es-BO')
}

// ─── Escalas ────────────────────────────────────────────────────────────────

/** Escala lineal: mapea un valor del dominio al rango. */
export function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain
  const [r0, r1] = range
  const dspan = d1 - d0 || 1
  return (v: number) => r0 + ((v - d0) / dspan) * (r1 - r0)
}

/** Devuelve `count` ticks "lindos" entre 0 y max (1, 2, 5, 10 × 10^n). */
export function getTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0]
  const step = niceStep(max / count)
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.0001; v += step) {
    ticks.push(Number(v.toFixed(6)))
  }
  return ticks
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1
  const exp = Math.floor(Math.log10(raw))
  const base = raw / Math.pow(10, exp)
  let nice: number
  if (base < 1.5) nice = 1
  else if (base < 3) nice = 2
  else if (base < 7) nice = 5
  else nice = 10
  return nice * Math.pow(10, exp)
}

// ─── Geometría polar (para donut) ───────────────────────────────────────────

/** Convierte coordenadas polares (r, ángulo en grados) a cartesianas. */
export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180 // -90 para empezar arriba
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/**
 * Genera el `d` de un path SVG para un arco anular (donut).
 * Si endAngle - startAngle ≥ 360°, devuelve un círculo completo (con un mini corte
 * para evitar que el navegador no pinte nada).
 */
export function arcPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const span = endAngle - startAngle
  if (span >= 359.999) {
    // full circle — necesita dos semicírculos
    const o1 = polarToCartesian(cx, cy, outerR, startAngle)
    const o2 = polarToCartesian(cx, cy, outerR, startAngle + 180)
    const o3 = polarToCartesian(cx, cy, outerR, endAngle - 0.01)
    const i1 = polarToCartesian(cx, cy, innerR, endAngle - 0.01)
    const i2 = polarToCartesian(cx, cy, innerR, startAngle + 180)
    const i3 = polarToCartesian(cx, cy, innerR, startAngle)
    return [
      `M ${o1.x} ${o1.y}`,
      `A ${outerR} ${outerR} 0 0 1 ${o2.x} ${o2.y}`,
      `A ${outerR} ${outerR} 0 0 1 ${o3.x} ${o3.y}`,
      `L ${i1.x} ${i1.y}`,
      `A ${innerR} ${innerR} 0 0 0 ${i2.x} ${i2.y}`,
      `A ${innerR} ${innerR} 0 0 0 ${i3.x} ${i3.y}`,
      'Z',
    ].join(' ')
  }
  const largeArc = span > 180 ? 1 : 0
  const oStart = polarToCartesian(cx, cy, outerR, startAngle)
  const oEnd   = polarToCartesian(cx, cy, outerR, endAngle)
  const iEnd   = polarToCartesian(cx, cy, innerR, endAngle)
  const iStart = polarToCartesian(cx, cy, innerR, startAngle)
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
    'Z',
  ].join(' ')
}

// ─── Helpers varios ─────────────────────────────────────────────────────────

/** Suma los valores numéricos de un array. */
export function sum(arr: number[]): number {
  return arr.reduce((s, n) => s + n, 0)
}

/** Trunca un texto largo añadiendo "…" si pasa de maxLen. */
export function truncate(s: string, maxLen = 30): string {
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s
}

/** Versión CSS de prefers-reduced-motion — para saltear animaciones. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
