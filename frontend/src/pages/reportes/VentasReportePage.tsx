import { useEffect, useMemo, useRef, useState } from 'react'
import { MainLayout, PageContainer, PageHeader } from '@/components/layout/MainLayout'
import { PageTopBar } from '@/components/layout/PageTopBar'
import { useAuth } from '@/contexts/AuthContext'
import { gql } from '@/lib/graphql'
import { DASHBOARD_ORDENES_QUERY, backendOrdenToDashboard, type DashboardOrdenAPI, type DashboardOrden } from '@/lib/queries/ventas.queries'
import { SalesChart } from '@/components/ui/SalesChart'
import {
  ChartContainer,
  BarChart,
  HorizontalBarChart,
  AreaChart,
  useChartExport,
} from '@/components/charts'

const fmtBs = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-steel-100 ${className}`}>
      {children}
    </div>
  )
}

function KpiCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-[11px] font-bold text-steel-400 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-black tabular-nums leading-tight ${accent ? 'text-brand-600' : 'text-steel-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-steel-400 mt-1.5">{sub}</p>}
    </Card>
  )
}

export function VentasReportePage() {
  const { isTokenReady } = useAuth()
  const [ordenes, setOrdenes] = useState<DashboardOrden[]>([])
  const [, setChartHover] = useState<number | null>(null)

  const reportRef = useRef<HTMLDivElement | null>(null)
  const { exportPDF } = useChartExport()

  useEffect(() => {
    if (!isTokenReady) return
    gql<{ todasOrdenes: { nodes: DashboardOrdenAPI[] } }>(DASHBOARD_ORDENES_QUERY)
      .then(res => setOrdenes(res.todasOrdenes.nodes.map(backendOrdenToDashboard)))
      .catch(() => {})
  }, [isTokenReady])

  const {
    ventasHoy, ventasMes, ventasMesPrev, ordenesCompletadasMes, ticketPromedio,
    sparkline30d, chartDates30, top10,
    ventasPorDiaSemana,
    acumuladoActual, acumuladoAnterior, labelsAcumulado,
  } = useMemo(() => {
    const today      = new Date()
    const toDateStr  = (d: Date) => d.toISOString().slice(0, 10)
    const hoy        = toDateStr(today)
    const mesActual  = hoy.slice(0, 7)
    const mesAnterior = toDateStr(new Date(today.getFullYear(), today.getMonth() - 1, 1)).slice(0, 7)

    const completadas = ordenes.filter(o => o.estado === 'completada' && o.fechaCompletada)

    const ventasHoy = completadas
      .filter(o => o.fechaCompletada!.slice(0, 10) === hoy)
      .reduce((s, o) => s + o.total, 0)

    const completadasMes = completadas.filter(o => o.fechaCompletada!.slice(0, 7) === mesActual)
    const ventasMes      = completadasMes.reduce((s, o) => s + o.total, 0)
    const ventasMesPrev  = completadas
      .filter(o => o.fechaCompletada!.slice(0, 7) === mesAnterior)
      .reduce((s, o) => s + o.total, 0)
    const ordenesCompletadasMes = completadasMes.length
    const ticketPromedio = ordenesCompletadasMes > 0 ? ventasMes / ordenesCompletadasMes : 0

    const sparkline30d: number[] = []
    const chartDates30: string[] = []
    for (let i = 29; i >= 0; i--) {
      const d   = new Date(today.getTime() - i * 86400000)
      const str = toDateStr(d)
      sparkline30d.push(
        completadas.filter(o => o.fechaCompletada!.slice(0, 10) === str).reduce((s, o) => s + o.total, 0)
      )
      chartDates30.push(d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }))
    }

    const hace7  = new Date(today.getTime() - 7 * 86400000)
    const ordenes7d = completadas.filter(o => new Date(o.fechaCompletada!) >= hace7)

    // El descuento es a nivel orden; se distribuye proporcionalmente al subtotal de cada item
    // para que el ingreso por producto refleje el neto que aportó.
    const porProducto = new Map<string, { nombre: string; codigo: string; marcaId: number | null; unidades: number; ingreso: number }>()
    for (const orden of ordenes7d) {
      const subtotalOrden = orden.items.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0)
      const factor = subtotalOrden > 0 ? 1 - (orden.montoDescuento ?? 0) / subtotalOrden : 1
      for (const item of orden.items) {
        const prev = porProducto.get(item.productoId)
        const ingresoItem = item.precioUnitario * item.cantidad * factor
        if (prev) {
          prev.unidades += item.cantidad
          prev.ingreso  += ingresoItem
        } else {
          porProducto.set(item.productoId, {
            nombre:   item.productoNombre,
            codigo:   item.productoCodigo,
            marcaId:  item.productoMarcaId ?? null,
            unidades: item.cantidad,
            ingreso:  ingresoItem,
          })
        }
      }
    }
    const top10 = [...porProducto.values()]
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 10)

    // ─── Ventas por día de la semana (últimos 30 días) — grouped por estado ───
    const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const hace30 = new Date(today.getTime() - 30 * 86400000)
    const ordenes30d = ordenes.filter(o => new Date(o.fecha) >= hace30)
    const completada30d = new Array(7).fill(0)
    const cancelada30d  = new Array(7).fill(0)
    for (const o of ordenes30d) {
      const d = new Date(o.fecha).getDay()
      if (o.estado === 'completada') completada30d[d] = (completada30d[d] ?? 0) + o.total
      else if (o.estado === 'cancelada') cancelada30d[d] = (cancelada30d[d] ?? 0) + o.total
    }
    const ventasPorDiaSemana = {
      labels: DIAS,
      completada: completada30d,
      cancelada: cancelada30d,
    }

    // ─── Acumulado: día a día del mes actual vs mes anterior ───
    const dayOfMonth = today.getDate()
    const labelsAcumulado: string[] = []
    const acumActual: number[] = []
    const acumAnterior: number[] = []
    let sActual = 0, sAnterior = 0
    for (let i = 1; i <= dayOfMonth; i++) {
      const dActual = new Date(today.getFullYear(), today.getMonth(), i)
      const dAnterior = new Date(today.getFullYear(), today.getMonth() - 1, i)
      const strActual = toDateStr(dActual)
      const strAnterior = toDateStr(dAnterior)
      sActual  += completadas.filter(o => o.fechaCompletada?.slice(0, 10) === strActual).reduce((s, o) => s + o.total, 0)
      sAnterior += completadas.filter(o => o.fechaCompletada?.slice(0, 10) === strAnterior).reduce((s, o) => s + o.total, 0)
      labelsAcumulado.push(String(i))
      acumActual.push(sActual)
      acumAnterior.push(sAnterior)
    }

    return {
      ventasHoy, ventasMes, ventasMesPrev, ordenesCompletadasMes, ticketPromedio,
      sparkline30d, chartDates30, top10,
      ventasPorDiaSemana,
      acumuladoActual: acumActual, acumuladoAnterior: acumAnterior, labelsAcumulado,
    }
  }, [ordenes])

  const deltaPct = ventasMesPrev > 0
    ? `${ventasMes >= ventasMesPrev ? '+' : ''}${(((ventasMes - ventasMesPrev) / ventasMesPrev) * 100).toFixed(0)}% vs mes ant.`
    : undefined

  return (
    <MainLayout>
      <PageTopBar section="Reportes" title="Ventas" />
      <PageContainer>
        <div ref={reportRef}>
        <PageHeader
          title="Ventas"
          description="Análisis de ventas del período actual"
          actions={
            <button
              onClick={() => exportPDF(reportRef, 'reporte-ventas', `Reporte de Ventas — ${new Date().toLocaleDateString('es-BO')}`)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-steel-200 hover:border-brand-600 hover:text-brand-600 text-steel-600 text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              Exportar PDF
            </button>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Ventas hoy"            value={fmtBs(ventasHoy)} accent />
          <KpiCard label="Ventas del mes"         value={fmtBs(ventasMes)}           sub={deltaPct} />
          <KpiCard label="Órdenes completadas"    value={String(ordenesCompletadasMes)} sub="Este mes" />
          <KpiCard label="Ticket promedio"        value={fmtBs(ticketPromedio)}       sub="Este mes" />
        </div>

        <ChartContainer
          title="Ventas — últimos 30 días"
          subtitle="Tendencia diaria de ventas completadas"
          minHeight={220}
          enableExport
          exportFilename="ventas-30d"
        >
          <div style={{ height: 200 }}>
            <SalesChart data={sparkline30d} dates={chartDates30} onHover={setChartHover} />
          </div>
        </ChartContainer>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 my-5">
          <ChartContainer
            title="Ventas por día de semana"
            subtitle="Últimos 30 días — separadas por estado"
            minHeight={260}
            enableExport
            exportFilename="ventas-dia-semana"
          >
            <div style={{ height: 240 }}>
              <BarChart
                labels={ventasPorDiaSemana.labels}
                series={[
                  { name: 'Completada', color: '#3F7A52', data: ventasPorDiaSemana.completada },
                  { name: 'Cancelada',  color: '#C8102E', data: ventasPorDiaSemana.cancelada  },
                ]}
                mode="grouped"
                formatValue={fmtBs}
                showLegend
              />
            </div>
          </ChartContainer>

          <ChartContainer
            title="Acumulado del mes"
            subtitle="Este mes vs. mes anterior, día a día"
            minHeight={260}
            enableExport
            exportFilename="ventas-acumulado"
          >
            <div style={{ height: 240 }}>
              <AreaChart
                labels={labelsAcumulado}
                series={[
                  { name: 'Mes actual',    color: '#C8102E', data: acumuladoActual    },
                  { name: 'Mes anterior',  color: '#3B82F6', data: acumuladoAnterior  },
                ]}
                height={240}
                formatValue={fmtBs}
              />
            </div>
          </ChartContainer>
        </div>

        <ChartContainer
          title="Top 10 productos"
          subtitle="Últimos 7 días — ordenados por unidades"
          minHeight={380}
          enableExport
          exportFilename="top-10-productos"
        >
          {top10.length === 0 ? (
            <p className="text-sm text-steel-400 text-center py-10">Sin ventas en los últimos 7 días</p>
          ) : (
            <HorizontalBarChart
              items={top10.map((p, i) => ({
                id: p.codigo || `top-${i}`,
                label: p.nombre || '—',
                sublabel: `${p.codigo} · ${fmtBs(p.ingreso)}`,
                value: p.unidades,
                displayValue: `${p.unidades} uds`,
              }))}
            />
          )}
        </ChartContainer>
        </div>
      </PageContainer>
    </MainLayout>
  )
}
