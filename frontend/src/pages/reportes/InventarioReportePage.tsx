import { useEffect, useMemo, useRef, useState } from 'react'
import { MainLayout, PageContainer, PageHeader } from '@/components/layout/MainLayout'
import { PageTopBar } from '@/components/layout/PageTopBar'
import { useAuth } from '@/contexts/AuthContext'
import { gql } from '@/lib/graphql'
import {
  PRODUCTOS_CON_MARCAS_QUERY,
  backendToProductoSimple,
  type ProductoAPI,
} from '@/lib/queries/inventario.queries'
import { DASHBOARD_ORDENES_QUERY, backendOrdenToDashboard, type DashboardOrdenAPI, type DashboardOrden } from '@/lib/queries/ventas.queries'
import { TIPO_CAMBIO_QUERY, type TipoCambioAPI } from '@/lib/queries/config.queries'
import {
  ChartContainer,
  DonutChart,
  GaugeChart,
  formatBsShort,
  useChartExport,
} from '@/components/charts'
import type { Producto } from '@/types'

const fmtBs  = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtUSD = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-4 rounded-full bg-brand-600" />
      <h2 className="text-[11px] font-bold text-steel-500 uppercase tracking-widest">{children}</h2>
    </div>
  )
}

export function InventarioReportePage() {
  const { isTokenReady } = useAuth()
  const [productos,  setProductos]  = useState<Producto[]>([])
  const [ordenes,    setOrdenes]    = useState<DashboardOrden[]>([])
  const [tipoCambio, setTipoCambio] = useState<number>(6.96)

  const reportRef = useRef<HTMLDivElement | null>(null)
  const { exportPDF } = useChartExport()

  useEffect(() => {
    if (!isTokenReady) return
    gql<{ productos: { nodes: ProductoAPI[] } }>(PRODUCTOS_CON_MARCAS_QUERY, { first: 9999, after: null, order: { fechaActualizacion: 'DESC' } })
      .then(res => setProductos(res.productos.nodes.map(backendToProductoSimple)))
      .catch(() => {})
    gql<{ todasOrdenes: { nodes: DashboardOrdenAPI[] } }>(DASHBOARD_ORDENES_QUERY)
      .then(res => setOrdenes(res.todasOrdenes.nodes.map(backendOrdenToDashboard)))
      .catch(() => {})
    gql<{ tipoCambio: TipoCambioAPI }>(TIPO_CAMBIO_QUERY)
      .then(res => setTipoCambio(res.tipoCambio.precioDolar))
      .catch(() => {})
  }, [isTokenReady])

  const {
    productosActivos, totalUnidades, valorUSD, valorBs, stockCritico, sinMovimiento,
    donutMarcas, pctStockCritico, pctSinMovimiento,
  } = useMemo(() => {
    const productosActivos = productos.filter(p => p.estado === 'activo')
    const totalUnidades    = productosActivos.reduce((s, p) => s + p.stock, 0)
    const valorBs          = productosActivos.reduce((s, p) => s + p.stock * p.precio_costo, 0)
    const valorUSD         = valorBs / tipoCambio

    const stockCritico = productosActivos
      .filter(p => p.stock <= p.stock_minimo)
      .sort((a, b) => (a.stock - a.stock_minimo) - (b.stock - b.stock_minimo))

    const hace30 = new Date(Date.now() - 30 * 86400000)
    const vendidos30d = new Set(
      ordenes
        .filter(o => o.estado === 'completada' && o.fechaCompletada && new Date(o.fechaCompletada) >= hace30)
        .flatMap(o => o.items.map(i => i.productoId))
    )
    const sinMovimiento = productosActivos.filter(p => !vendidos30d.has(p.id))

    // Donut: valor del inventario agrupado por marca (Top 6 + "Otras")
    const porMarca = new Map<string, number>()
    for (const p of productosActivos) {
      const key = p.marca || 'Sin marca'
      porMarca.set(key, (porMarca.get(key) ?? 0) + p.stock * p.precio_costo)
    }
    const sortedMarcas = [...porMarca.entries()].sort((a, b) => b[1] - a[1])
    const TOP = 6
    const topMarcas = sortedMarcas.slice(0, TOP)
    const otrasMarcas = sortedMarcas.slice(TOP)
    const sumaOtras = otrasMarcas.reduce((s, [, v]) => s + v, 0)
    const donutMarcas = [
      ...topMarcas.map(([label, value]) => ({ label, value })),
      ...(sumaOtras > 0 ? [{ label: `Otras (${otrasMarcas.length})`, value: sumaOtras }] : []),
    ]

    // Gauges
    const pctStockCritico  = productosActivos.length > 0
      ? (stockCritico.length / productosActivos.length) * 100 : 0
    const pctSinMovimiento = productosActivos.length > 0
      ? (sinMovimiento.length / productosActivos.length) * 100 : 0

    return {
      productosActivos, totalUnidades, valorUSD, valorBs, stockCritico, sinMovimiento,
      donutMarcas, pctStockCritico, pctSinMovimiento,
    }
  }, [productos, ordenes, tipoCambio])

  return (
    <MainLayout>
      <PageTopBar section="Reportes" title="Inventario" />
      <PageContainer>
        <div ref={reportRef}>
        <PageHeader
          title="Inventario"
          description="Estado actual del stock y valor del inventario"
          actions={
            <button
              onClick={() => exportPDF(reportRef, 'reporte-inventario', `Reporte de Inventario — ${new Date().toLocaleDateString('es-BO')}`)}
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
          <KpiCard label="Productos activos" value={String(productosActivos.length)} />
          <KpiCard label="Total unidades"    value={totalUnidades.toLocaleString()} />
          <KpiCard label="Valor inventario"  value={fmtUSD(valorUSD)} sub={fmtBs(valorBs)} />
          <KpiCard label="Stock crítico"     value={String(stockCritico.length)} sub="Bajo el mínimo" accent={stockCritico.length > 0} />
        </div>

        {/* ─── Charts ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <div className="lg:col-span-1">
            <ChartContainer
              title="Valor por marca"
              subtitle="Top 6 marcas + agrupadas"
              minHeight={240}
              enableExport
              exportFilename="inventario-valor-marca"
            >
              <div className="flex flex-col items-center">
                <DonutChart
                  segments={donutMarcas}
                  size={170}
                  thickness={26}
                  formatValue={(v) => `Bs ${formatBsShort(v)}`}
                  centerLabel="Total"
                  centerValue={`Bs ${formatBsShort(valorBs)}`}
                  centerSub={`${productosActivos.length} productos`}
                />
              </div>
            </ChartContainer>
          </div>

          <div className="lg:col-span-1">
            <ChartContainer
              title="Stock crítico"
              subtitle="Productos bajo el mínimo"
              minHeight={240}
            >
              <GaugeChart
                value={pctStockCritico}
                label="Stock crítico"
                sublabel={`${stockCritico.length} de ${productosActivos.length}`}
              />
            </ChartContainer>
          </div>

          <div className="lg:col-span-1">
            <ChartContainer
              title="Sin movimiento"
              subtitle="Sin ventas en 30 días"
              minHeight={240}
            >
              <GaugeChart
                value={pctSinMovimiento}
                label="Sin movimiento"
                sublabel={`${sinMovimiento.length} de ${productosActivos.length}`}
                thresholds={{ ok: 25, warn: 50 }}
              />
            </ChartContainer>
          </div>
        </div>

        {/* Stock crítico */}
        <Card className="p-5 mb-5">
          <SectionTitle>Stock crítico — productos bajo mínimo</SectionTitle>
          {stockCritico.length === 0 ? (
            <div className="flex items-center gap-3 py-10 justify-center">
              <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-steel-400">Todos los productos sobre el mínimo</span>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-steel-100">
                  <th className="text-left pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Producto</th>
                  <th className="text-center pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Stock</th>
                  <th className="text-center pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Mínimo</th>
                  <th className="text-center pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Diferencia</th>
                  <th className="text-left pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stockCritico.map(p => (
                  <tr key={p.id} className="border-b border-steel-50 hover:bg-[#FAFAF9] transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-steel-800 truncate max-w-[220px]">{p.nombre}</p>
                      <p className="text-[10px] text-steel-400 mt-0.5 tabular-nums">{p.codigo_universal}</p>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`text-base font-black tabular-nums ${p.stock === 0 ? 'text-brand-600' : 'text-amber-600'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="py-3 text-center text-steel-400 font-semibold tabular-nums">{p.stock_minimo}</td>
                    <td className="py-3 text-center">
                      <span className="text-xs font-bold text-brand-600 tabular-nums">{p.stock - p.stock_minimo}</span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.stock === 0 ? 'bg-brand-600 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {p.stock === 0 ? 'Sin stock' : 'Bajo mínimo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Sin movimiento */}
        <Card className="p-5">
          <SectionTitle>Sin movimiento — últimos 30 días ({sinMovimiento.length})</SectionTitle>
          {sinMovimiento.length === 0 ? (
            <p className="text-sm text-steel-400 text-center py-10">Todos los productos tuvieron ventas en los últimos 30 días</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-steel-100">
                  <th className="text-left pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Producto</th>
                  <th className="text-center pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Stock</th>
                  <th className="text-right pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Valor parado</th>
                </tr>
              </thead>
              <tbody>
                {sinMovimiento.map(p => (
                  <tr key={p.id} className="border-b border-steel-50 hover:bg-[#FAFAF9] transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-steel-800 truncate max-w-[300px]">{p.nombre}</p>
                      <p className="text-[10px] text-steel-400 mt-0.5 tabular-nums">{p.codigo_universal}</p>
                    </td>
                    <td className="py-3 text-center font-bold text-steel-700 tabular-nums">{p.stock}</td>
                    <td className="py-3 text-right text-steel-500 tabular-nums">{fmtBs(p.stock * p.precio_costo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        </div>
      </PageContainer>
    </MainLayout>
  )
}
