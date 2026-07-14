import { useEffect, useMemo, useRef, useState } from 'react'
import { MainLayout, PageContainer, PageHeader } from '@/components/layout/MainLayout'
import { PageTopBar } from '@/components/layout/PageTopBar'
import { useAuth } from '@/contexts/AuthContext'
import { gql } from '@/lib/graphql'
import { DASHBOARD_ORDENES_QUERY, backendOrdenToDashboard, type DashboardOrdenAPI, type DashboardOrden } from '@/lib/queries/ventas.queries'
import {
  ChartContainer,
  DonutChart,
  BarChart,
  useChartExport,
} from '@/components/charts'
import type { EstadoOrden } from '@/types'

const fmtBs = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

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

type BadgeVariant = 'red' | 'amber' | 'green' | 'blue' | 'gray' | 'yellow'
const BADGE_STYLES: Record<BadgeVariant, string> = {
  red:    'bg-brand-600 text-white',
  amber:  'bg-amber-500 text-white',
  green:  'bg-emerald-500 text-white',
  blue:   'bg-steel-700 text-white',
  gray:   'bg-steel-200 text-steel-600',
  yellow: 'bg-accent text-steel-900',
}

const ESTADO_META: Record<EstadoOrden, { label: string; variant: BadgeVariant }> = {
  pendiente_almacenero: { label: 'Pendiente',  variant: 'amber'  },
  en_preparacion:       { label: 'Preparando', variant: 'blue'   },
  listo_para_escaneo:   { label: 'Listo',      variant: 'green'  },
  con_faltantes:        { label: 'Faltantes',  variant: 'red'    },
  esperando_pago:       { label: 'Por cobrar', variant: 'yellow' },
  completada:           { label: 'Completada', variant: 'gray'   },
  cancelada:            { label: 'Cancelado',  variant: 'red'    },
}

const FILTROS: { label: string; value: EstadoOrden | 'todas' }[] = [
  { label: 'Todas',       value: 'todas'               },
  { label: 'Pendientes',  value: 'pendiente_almacenero' },
  { label: 'Preparando',  value: 'en_preparacion'       },
  { label: 'Listas',      value: 'listo_para_escaneo'   },
  { label: 'Faltantes',   value: 'con_faltantes'        },
  { label: 'Por cobrar',  value: 'esperando_pago'       },
  { label: 'Completadas', value: 'completada'           },
  { label: 'Canceladas',  value: 'cancelada'            },
]

export function OrdenesReportePage() {
  const { isTokenReady } = useAuth()
  const [ordenes, setOrdenes] = useState<DashboardOrden[]>([])
  const [filtro,  setFiltro]  = useState<EstadoOrden | 'todas'>('todas')

  const reportRef = useRef<HTMLDivElement | null>(null)
  const { exportPDF } = useChartExport()

  useEffect(() => {
    if (!isTokenReady) return
    gql<{ todasOrdenes: { nodes: DashboardOrdenAPI[] } }>(DASHBOARD_ORDENES_QUERY)
      .then(res => setOrdenes(res.todasOrdenes.nodes.map(backendOrdenToDashboard)))
      .catch(() => {})
  }, [isTokenReady])

  const { total, activas, completadasHoy, canceladas, ordenesVis, donutEstados, barPorDia } = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10)
    const total          = ordenes.length
    const activas        = ordenes.filter(o => o.estado !== 'completada' && o.estado !== 'cancelada').length
    const completadasHoy = ordenes.filter(o => o.estado === 'completada' && o.fechaCompletada?.slice(0, 10) === hoy).length
    const canceladas     = ordenes.filter(o => o.estado === 'cancelada').length

    const ordenesVis = [...ordenes]
      .reverse()
      .filter(o => filtro === 'todas' || o.estado === filtro)

    // Donut: distribución de órdenes por estado
    const porEstado = new Map<string, number>()
    for (const o of ordenes) {
      porEstado.set(o.estado, (porEstado.get(o.estado) ?? 0) + 1)
    }
    const ESTADO_COLOR: Record<string, string> = {
      completada:           '#3F7A52',
      cancelada:            '#C8102E',
      pendiente_almacenero: '#D4A333',
      en_preparacion:       '#7A7571',
      listo_para_escaneo:   '#3B82F6',
      con_faltantes:        '#F97316',
      esperando_pago:       '#8B5CF6',
    }
    const donutEstados = [...porEstado.entries()]
      .map(([estado, value]) => ({
        label: (ESTADO_META[estado as EstadoOrden]?.label) ?? estado,
        value,
        color: ESTADO_COLOR[estado],
      }))
      .sort((a, b) => b.value - a.value)

    // Bar chart: órdenes por día de la semana, agrupadas por estado
    const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const hace30 = new Date(Date.now() - 30 * 86400000)
    const completada = new Array(7).fill(0)
    const cancelada  = new Array(7).fill(0)
    const activa     = new Array(7).fill(0)
    for (const o of ordenes) {
      if (new Date(o.fecha) < hace30) continue
      const d = new Date(o.fecha).getDay()
      if (o.estado === 'completada') completada[d] = (completada[d] ?? 0) + 1
      else if (o.estado === 'cancelada') cancelada[d] = (cancelada[d] ?? 0) + 1
      else activa[d] = (activa[d] ?? 0) + 1
    }
    const barPorDia = { labels: DIAS, completada, cancelada, activa }

    return { total, activas, completadasHoy, canceladas, ordenesVis, donutEstados, barPorDia }
  }, [ordenes, filtro])

  return (
    <MainLayout>
      <PageTopBar section="Reportes" title="Órdenes" />
      <PageContainer>
        <div ref={reportRef}>
        <PageHeader
          title="Órdenes"
          description="Historial y estado de todas las órdenes de venta"
          actions={
            <button
              onClick={() => exportPDF(reportRef, 'reporte-ordenes', `Reporte de Órdenes — ${new Date().toLocaleDateString('es-BO')}`)}
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
          <KpiCard label="Total órdenes"      value={String(total)} />
          <KpiCard label="Activas"            value={String(activas)}        sub="En proceso" accent={activas > 0} />
          <KpiCard label="Completadas hoy"    value={String(completadasHoy)} sub="Hoy" />
          <KpiCard label="Canceladas"         value={String(canceladas)} />
        </div>

        {/* ─── Charts: Donut + Bar ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <div className="lg:col-span-1">
            <ChartContainer
              title="Órdenes por estado"
              subtitle="Click para filtrar la tabla"
              minHeight={260}
              enableExport
              exportFilename="ordenes-estado"
            >
              <div className="flex flex-col items-center">
                <DonutChart
                  segments={donutEstados}
                  size={170}
                  thickness={26}
                  formatValue={(v) => `${v} ${v === 1 ? 'orden' : 'órdenes'}`}
                  centerLabel="Total"
                  centerValue={String(total)}
                  centerSub={filtro !== 'todas'
                    ? `Filtrado: ${ESTADO_META[filtro as EstadoOrden]?.label ?? filtro}`
                    : 'órdenes'}
                  selectedLabel={
                    filtro !== 'todas'
                      ? ESTADO_META[filtro as EstadoOrden]?.label
                      : undefined
                  }
                  onSegmentClick={(seg) => {
                    // buscar el estado original a partir del label del segmento
                    const estadoEntry = Object.entries(ESTADO_META).find(([, m]) => m.label === seg.label)
                    if (!estadoEntry) return
                    const [estado] = estadoEntry
                    setFiltro(prev => prev === estado ? 'todas' : (estado as EstadoOrden))
                  }}
                />
              </div>
            </ChartContainer>
          </div>

          <div className="lg:col-span-2">
            <ChartContainer
              title="Órdenes por día de semana"
              subtitle="Últimos 30 días — agrupadas por estado"
              minHeight={260}
              enableExport
              exportFilename="ordenes-dia-semana"
            >
              <div style={{ height: 240 }}>
                <BarChart
                  labels={barPorDia.labels}
                  series={[
                    { name: 'Completada', color: '#3F7A52', data: barPorDia.completada },
                    { name: 'Activa',     color: '#D4A333', data: barPorDia.activa     },
                    { name: 'Cancelada',  color: '#C8102E', data: barPorDia.cancelada  },
                  ]}
                  mode="stacked"
                  showLegend
                />
              </div>
            </ChartContainer>
          </div>
        </div>

        <Card className="p-5">
          {/* Filtros */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {FILTROS.map(f => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtro === f.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-steel-100 text-steel-500 hover:bg-steel-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {ordenesVis.length === 0 ? (
            <p className="text-sm text-steel-400 text-center py-10">Sin órdenes para este filtro</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-steel-100">
                  <th className="text-left pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Orden</th>
                  <th className="text-left pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Cajero</th>
                  <th className="text-center pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Ítems</th>
                  <th className="text-left pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Estado</th>
                  <th className="text-right pb-3 font-bold text-steel-400 uppercase tracking-widest text-[10px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {ordenesVis.map(o => {
                  const meta = ESTADO_META[o.estado] ?? { label: o.estado, variant: 'gray' as BadgeVariant }
                  return (
                    <tr key={o.id} className="border-b border-steel-50 hover:bg-[#FAFAF9] transition-colors">
                      <td className="py-3 pr-4">
                        <p className="font-bold text-steel-800">{o.numero}</p>
                        <p className="text-[10px] text-steel-400 mt-0.5">{relativeTime(o.fecha)}</p>
                      </td>
                      <td className="py-3 pr-4 text-steel-600">{o.cajeroNombre || '—'}</td>
                      <td className="py-3 text-center text-steel-500 tabular-nums">{o.items.length}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${BADGE_STYLES[meta.variant]}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-3 text-right font-black text-steel-800 tabular-nums">{fmtBs(o.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
        </div>
      </PageContainer>
    </MainLayout>
  )
}
