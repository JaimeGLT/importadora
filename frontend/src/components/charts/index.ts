// ─── Componentes principales ────────────────────────────────────────────────
export { ChartContainer } from './ChartContainer'
export { ChartTooltip, type TooltipRow, type ChartTooltipProps } from './ChartTooltip'
export { ChartLegend, type LegendItem } from './ChartLegend'

export { DonutChart, type DonutSegment } from './DonutChart'
export { BarChart, type BarSeries, type BarMode } from './BarChart'
export { HorizontalBarChart, type HorizontalBarItem } from './HorizontalBarChart'
export { AreaChart, type AreaSeries } from './AreaChart'
export { GaugeChart } from './GaugeChart'

// ─── Hooks ──────────────────────────────────────────────────────────────────
export { useChartExport, type ChartExportApi } from './useChartExport'

// ─── Utilidades (re-export para conveniencia) ───────────────────────────────
export {
  CHART_PALETTE,
  paletteAt,
  formatBs,
  formatBsShort,
  formatPct,
  formatInt,
  linearScale,
  getTicks,
  polarToCartesian,
  arcPath,
  sum,
  truncate,
  prefersReducedMotion,
} from './chartUtils'
