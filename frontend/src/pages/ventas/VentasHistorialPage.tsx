import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { MainLayout } from '@/components/layout/MainLayout'
import { DrawerWrapper } from '@/components/ui/DrawerWrapper'
import { gql } from '@/lib/graphql'
import {
  MIS_ORDENES_QUERY,
  TODAS_ORDENES_QUERY,
  backendToOrdenVenta,
  type OrdenVentaAPI,
} from '@/lib/queries/ventas.queries'
import type { OrdenVenta } from '@/types'
import { clsx } from 'clsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const fmtBs = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtBsShort = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const ESTADO_LABEL: Record<string, { label: string; cls: string }> = {
  completada:            { label: 'Completada',       cls: 'bg-[#B8DCCA] text-[#1E5C38]' },
  cancelada:             { label: 'Cancelada',         cls: 'bg-[#F5C9C0] text-[#8A1E12]' },
  pendiente_almacenero:  { label: 'Pendiente',         cls: 'bg-[#F5E0A8] text-[#7A5200]' },
  en_preparacion:        { label: 'Preparando',        cls: 'bg-[#F4ECDB] text-[#780e18]' },
  listo_para_escaneo:    { label: 'Escaneando',        cls: 'bg-[#F4ECDB] text-[#780e18]' },
  esperando_pago:        { label: 'Esperando pago',    cls: 'bg-[#B8DCCA] text-[#1E5C38]' },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <tr key={i} className="border-t border-[#E8E5E2]">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-[14px]">
              <div
                className="h-3.5 rounded-md bg-[#F0EFEC] animate-pulse"
                style={{ width: j === 0 ? '3.5rem' : j === cols - 1 ? '2rem' : '65%' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function OrdenDrawer({ orden, onClose }: { orden: OrdenVenta; onClose: () => void }) {
  const estado = ESTADO_LABEL[orden.estado] ?? { label: orden.estado, cls: 'bg-[#F0EFEC] text-[#4A4644]' }
  const total = orden.total

  return (
    <DrawerWrapper
      open
      onClose={onClose}
      subtitle="Detalle de venta"
      sku={orden.numero}
      title={orden.cajero_nombre}
      footer={
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-lg bg-[#EDE8E3] border border-[#D0CBC4] text-[#4A4744] text-sm font-medium hover:bg-[#E0DAD4] transition-colors"
        >
          Cerrar
        </button>
      }
    >
      <div className="space-y-4">

        {/* Info grid */}
        <div className="bg-white rounded-xl border border-[#E8E5E2] p-4 grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <p className="text-[10px] font-bold text-[#7A7571] uppercase tracking-[0.1em] mb-0.5">Fecha</p>
            <p className="text-[13px] text-[#2D2B2A]">{fmtFecha(orden.creado_en)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#7A7571] uppercase tracking-[0.1em] mb-0.5">Estado</p>
            <span className={clsx('inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full', estado.cls)}>
              {estado.label}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#7A7571] uppercase tracking-[0.1em] mb-0.5">Cliente</p>
            <p className="text-[13px] text-[#2D2B2A]">{orden.cliente_nombre ?? <span className="text-[#B0ABA7]">Sin cliente</span>}</p>
          </div>
          {orden.almacenero_nombre && (
            <div>
              <p className="text-[10px] font-bold text-[#7A7571] uppercase tracking-[0.1em] mb-0.5">Almacenero</p>
              <p className="text-[13px] text-[#2D2B2A]">{orden.almacenero_nombre}</p>
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="bg-white rounded-xl border border-[#E8E5E2] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E5E2] flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[#2D2B2A]">Productos</p>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F4ECDB] text-[#780e18]">
              {orden.items.length} ítem{orden.items.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F0EB]">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-[#5C5654] uppercase tracking-[0.1em]">Código</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-[#5C5654] uppercase tracking-[0.1em]">Producto</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-[#5C5654] uppercase tracking-[0.1em]">Cant.</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-[#5C5654] uppercase tracking-[0.1em]">P. Unit.</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-[#5C5654] uppercase tracking-[0.1em]">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFEC]">
              {orden.items.flatMap(item => {
                // Caso A: item parcial con piezas → header del kit + sub-filas por pieza
                if (item.es_parcial && item.piezas_orden && item.piezas_orden.length > 0) {
                  return [
                    <tr key={`${item.id}-header`} className="bg-[#F4ECDB]/40">
                      <td colSpan={5} className="px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold text-[#780e18]">
                            {item.producto_codigo}
                          </span>
                          <span className="text-[12px] font-semibold text-[#2D2B2A]">
                            {item.producto_nombre}
                          </span>
                          <span className="inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] tracking-wider">
                            KIT
                          </span>
                          <span className="inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] tracking-wider">
                            Venta parcial · {item.piezas_orden.length} {item.piezas_orden.length === 1 ? 'pieza' : 'piezas'}
                          </span>
                          {(item.producto_categoria || item.producto_procedencia) && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-[#7A7571]">
                              {item.producto_categoria && (
                                <span className="inline-flex items-center gap-0.5">
                                  <i className="ti ti-tag text-[9px]" />
                                  {item.producto_categoria}
                                </span>
                              )}
                              {item.producto_categoria && item.producto_procedencia && <span className="text-[#D0CBC4]">·</span>}
                              {item.producto_procedencia && (
                                <span className="inline-flex items-center gap-0.5">
                                  <i className="ti ti-flag text-[9px]" />
                                  Origen: {item.producto_procedencia}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>,
                    ...item.piezas_orden.map(p => (
                      <tr key={`${item.id}-${p.id}`} className="hover:bg-[#FAF9F7]">
                        <td className="pl-7 pr-3 py-2 font-mono text-[11px] text-[#780e18] font-semibold whitespace-nowrap">
                          {p.codigo_pieza}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-[#2D2B2A]">
                          <span>{p.nombre}</span>
                          <span className="ml-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200] tracking-wider">
                            PIEZA
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-[12px] text-[#4A4644]">×{p.cantidad}</td>
                        <td className="px-3 py-2 text-right text-[12px] text-[#4A4644] whitespace-nowrap">
                          {fmtBs(p.precio_unitario ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-[12px] font-semibold text-[#2D2B2A] whitespace-nowrap">
                          {fmtBs((p.precio_unitario ?? 0) * p.cantidad)}
                        </td>
                      </tr>
                    )),
                  ]
                }

                // Caso B: item normal (producto simple o kit completo) → fila simple
                return [
                  <tr key={item.id} className="hover:bg-[#FAF9F7]">
                    <td className="px-3 py-2.5 font-mono text-xs text-[#780e18] font-semibold whitespace-nowrap">
                      {item.producto_codigo}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[#2D2B2A]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{item.producto_nombre}</span>
                        {item.marca_nombre && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F4ECDB] text-[#780e18]">
                            {item.marca_nombre}
                          </span>
                        )}
                        {item.es_kit && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] tracking-wider">
                            KIT
                          </span>
                        )}
                      </div>
                      {(item.producto_categoria || item.producto_procedencia) && (
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#7A7571] leading-tight">
                          {item.producto_categoria && (
                            <span className="inline-flex items-center gap-0.5">
                              <i className="ti ti-tag text-[9px]" />
                              {item.producto_categoria}
                            </span>
                          )}
                          {item.producto_categoria && item.producto_procedencia && <span className="text-[#D0CBC4]">·</span>}
                          {item.producto_procedencia && (
                            <span className="inline-flex items-center gap-0.5">
                              <i className="ti ti-flag text-[9px]" />
                              Origen: {item.producto_procedencia}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[12px] text-[#4A4644]">{item.cantidad_pedida}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] text-[#4A4644] whitespace-nowrap">{fmtBs(item.precio_unitario)}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#2D2B2A] whitespace-nowrap">
                      {fmtBs(item.precio_unitario * item.cantidad_pedida)}
                    </td>
                  </tr>,
                ]
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#E8E5E2] bg-[#FBFAF7]">
                <td colSpan={4} className="px-3 py-3 text-right text-[11px] font-bold text-[#5C5654] uppercase tracking-[0.1em]">
                  Total
                </td>
                <td className="px-3 py-3 text-right text-[14px] font-black text-[#2D2B2A] whitespace-nowrap">
                  {fmtBs(total)}
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>

      </div>
    </DrawerWrapper>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function VentasHistorialPage() {
  const { user, isTokenReady } = useAuth()
  const [ordenes, setOrdenes]       = useState<OrdenVenta[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<OrdenVenta | null>(null)

  const isAdmin = user?.rol === 'admin'
  const cols    = isAdmin ? 7 : 6

  const today      = new Date().toISOString().slice(0, 10)
  const mesActual  = new Date().toISOString().slice(0, 7)

  const [searchParams, setSearchParams] = useSearchParams()
  const validDate = (v: string | null) =>
    !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime()) ? v : ''
  const [desde, setDesde] = useState(() => validDate(searchParams.get('desde')))
  const [hasta, setHasta] = useState(() => validDate(searchParams.get('hasta')))
  const filterActive = !!desde || !!hasta

  const updateUrl = (d: string, h: string) => {
    setSearchParams(prev => {
      if (d) prev.set('desde', d); else prev.delete('desde')
      if (h) prev.set('hasta', h); else prev.delete('hasta')
      return prev
    }, { replace: true })
  }
  const onDesde = (v: string) => { setDesde(v); updateUrl(v, hasta) }
  const onHasta = (v: string) => { setHasta(v); updateUrl(desde, v) }
  const clear   = () => { setDesde(''); setHasta(''); updateUrl('', '') }

  useEffect(() => {
    if (!isTokenReady) return
    setLoading(true)
    const query = isAdmin ? TODAS_ORDENES_QUERY : MIS_ORDENES_QUERY
    const key   = isAdmin ? 'todasOrdenes'      : 'misOrdenes'
    gql<{ [k: string]: { nodes: OrdenVentaAPI[] } }>(query, {
      desde: desde ? `${desde}T00:00:00-04:00` : null,
      hasta: hasta ? `${hasta}T23:59:59-04:00` : null,
    })
      .then(res => {
        const completadas = res[key].nodes
          .map(backendToOrdenVenta)
          .filter(o => o.estado === 'completada')
          .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())
        setOrdenes(completadas)
      })
      .catch(() => setOrdenes([]))
      .finally(() => setLoading(false))
  }, [isTokenReady, isAdmin, desde, hasta])

  const kpi = useMemo(() => {
    const hoy = ordenes.filter(o => o.creado_en.slice(0, 10) === today)
    const mes  = ordenes.filter(o => o.creado_en.slice(0, 7) === mesActual)
    const totalFacturado = ordenes.reduce((s, o) => s + o.total, 0)
    const totalMes       = mes.reduce((s, o) => s + o.total, 0)
    const ticket         = ordenes.length > 0 ? totalFacturado / ordenes.length : 0
    return { total: ordenes.length, hoy: hoy.length, totalFacturado, totalMes, ticket }
  }, [ordenes, today, mesActual])

  const filtered = useMemo(() => {
    if (!search.trim()) return ordenes
    const q = search.toLowerCase()
    return ordenes.filter(o =>
      o.numero.toLowerCase().includes(q) ||
      o.cajero_nombre.toLowerCase().includes(q) ||
      (o.cliente_nombre ?? '').toLowerCase().includes(q),
    )
  }, [ordenes, search])

  const dateStr = new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <MainLayout>
      <div className="bg-[#F7F7F7] min-h-screen">

        {/* ── TopBar ──────────────────────────────────────────────────────── */}
        <header className="bg-[#F7F7F7]/85 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full h-[62px] px-7 border-b border-[#E8E5E2]">
          <div className="flex items-center gap-2 text-sm text-[#7A7571]">
            <span>Ventas</span>
            <span className="text-[10px] opacity-40">/</span>
            <strong className="text-[#2D2B2A] font-semibold">Historial de Ventas</strong>
          </div>
          <div className="hidden sm:flex bg-white px-3.5 py-1.5 rounded-lg items-center gap-2 border border-[#D8D4D0]">
            <i className="ti ti-calendar text-[#7A7571] text-[15px]" />
            <span className="text-xs text-[#4A4644]">{dateStr}</span>
          </div>
        </header>

        <div className="px-7 py-[26px] max-w-[1320px] mx-auto w-full">

          {/* ── Page Header ─────────────────────────────────────────────── */}
          <div className="mb-6">
            <h2 className="font-semibold text-[30px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Historial de Ventas
            </h2>
            <p className="text-[13.5px] text-[#7A7571] mt-1.5">
              {isAdmin ? 'Registro de todas las ventas completadas' : 'Mis ventas completadas'}
            </p>
          </div>

          {/* ── KPI Cards ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[22px]">

            {/* Total ventas */}
            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#780e18] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#780e18] opacity-[0.08]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#780e18] to-[#D4A333] flex items-center justify-center shrink-0">
                  <i className="ti ti-receipt text-white text-[16px]" />
                </div>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F4ECDB] text-[#780e18]">
                  {filterActive ? `${kpi.hoy} filtradas` : `${kpi.hoy} hoy`}
                </span>
              </div>
              {loading
                ? <div className="h-8 w-16 rounded-md bg-[#F0EFEC] animate-pulse mb-2" />
                : <div className="font-semibold text-[32px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {kpi.total.toLocaleString('es-BO')}
                  </div>
              }
              <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Total ventas</div>
            </div>

            {/* Total facturado */}
            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#3F7A52] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#3F7A52] opacity-[0.08]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3F7A52] to-[#6BAF80] flex items-center justify-center shrink-0">
                  <i className="ti ti-cash text-white text-[16px]" />
                </div>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#B8DCCA] text-[#1E5C38]">
                  {filterActive ? 'filtrado' : 'mes actual'}
                </span>
              </div>
              {loading
                ? <div className="h-8 w-28 rounded-md bg-[#F0EFEC] animate-pulse mb-2" />
                : <div className="font-semibold text-[28px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {fmtBsShort(kpi.totalFacturado)}
                  </div>
              }
              <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Total facturado</div>
            </div>

            {/* Ticket promedio */}
            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#D4A333] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#D4A333] opacity-[0.08]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D4A333] to-[#F0C060] flex items-center justify-center shrink-0">
                  <i className="ti ti-chart-bar text-white text-[16px]" />
                </div>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200]">
                  promedio
                </span>
              </div>
              {loading
                ? <div className="h-8 w-24 rounded-md bg-[#F0EFEC] animate-pulse mb-2" />
                : <div className="font-semibold text-[28px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {fmtBsShort(kpi.ticket)}
                  </div>
              }
              <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Ticket promedio</div>
            </div>

          </div>

          {/* ── Date Filter ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-[#D0CBC4] p-4 mb-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#4A4744] mb-1.5 uppercase tracking-wide">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={e => onDesde(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#4A4744] mb-1.5 uppercase tracking-wide">Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={e => onHasta(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
              />
            </div>
            {filterActive && (
              <button
                onClick={clear}
                className="h-9 px-3 rounded-lg border border-[#E8E5E2] bg-white text-[#4A4744] text-xs font-semibold hover:bg-[#F0EFEC] transition-colors"
              >
                Limpiar
              </button>
            )}
            {filterActive && (
              <span className="text-[11px] text-[#7A7571] font-medium ml-auto">
                Filtrando por rango — {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── Table Container ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-[#D0CBC4] overflow-hidden">

            {/* Toolbar */}
            <div className="px-[22px] py-[18px] border-b border-[#D0CBC4] flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-[17px] font-semibold text-[#2D2B2A] tracking-[-0.01em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Registro de ventas
                </h3>
                {!loading && (
                  <span className="bg-[#F4ECDB] text-[#780e18] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {filtered.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 bg-[#FBFBFA] border border-[#D8D4D0] rounded-lg px-3.5 w-full sm:w-auto sm:min-w-[260px] focus-within:border-[#780e18] transition-colors">
                <i className="ti ti-search text-[#7A7571] text-[13px] shrink-0" />
                <input
                  className="flex-1 py-2 bg-transparent text-[13px] text-[#2D2B2A] placeholder:text-[#7A7571] outline-none border-none"
                  placeholder={isAdmin ? 'Buscar por N°, cajero, cliente…' : 'Buscar por N° o cliente…'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-[#7A7571] hover:text-[#2D2B2A] transition-colors">
                    <i className="ti ti-x text-[12px]" />
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F5F0EB]">
                  <tr>
                    <th className="px-4 py-[11px] text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.12em] border-b border-[#D0CBC4] whitespace-nowrap">N°</th>
                    <th className="px-4 py-[11px] text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.12em] border-b border-[#D0CBC4] whitespace-nowrap">Fecha</th>
                    {isAdmin && (
                      <th className="px-4 py-[11px] text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.12em] border-b border-[#D0CBC4] whitespace-nowrap">Cajero</th>
                    )}
                    <th className="px-4 py-[11px] text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.12em] border-b border-[#D0CBC4] whitespace-nowrap">Cliente</th>
                    <th className="px-4 py-[11px] text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.12em] border-b border-[#D0CBC4] text-center whitespace-nowrap">Items</th>
                    <th className="px-4 py-[11px] text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.12em] border-b border-[#D0CBC4] text-right whitespace-nowrap">Total</th>
                    <th className="px-4 py-[11px] text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.12em] border-b border-[#D0CBC4] text-center whitespace-nowrap">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeleton cols={cols} />
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={cols} className="px-4 py-14 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <i className="ti ti-receipt-off text-[32px] text-[#C5C0BB]" />
                          <p className="text-sm text-[#7A7571]">
                            {search ? 'Sin resultados para la búsqueda' : 'No hay ventas completadas'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map(o => (
                    <tr key={o.id} className="border-t border-[#E8E5E2] hover:bg-[#FAF5EE] transition-colors">
                      <td className="px-4 py-[14px] font-mono font-semibold text-[#2D2B2A] text-[13px]">{o.numero}</td>
                      <td className="px-4 py-[14px] text-[13px] text-[#4A4644] whitespace-nowrap">{fmtFecha(o.creado_en)}</td>
                      {isAdmin && (
                        <td className="px-4 py-[14px] text-[13px] text-[#2D2B2A]">{o.cajero_nombre}</td>
                      )}
                      <td className="px-4 py-[14px] text-[13px] text-[#4A4644]">
                        {o.cliente_nombre ?? <span className="text-[#B0ABA7]">—</span>}
                      </td>
                      <td className="px-4 py-[14px] text-center">
                        <span className="inline-flex items-center justify-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F4ECDB] text-[#780e18]">
                          {o.items.length}
                        </span>
                      </td>
                      <td className="px-4 py-[14px] text-right font-semibold text-[13px] text-[#2D2B2A] whitespace-nowrap">
                        {fmtBs(o.total)}
                      </td>
                      <td className="px-4 py-[14px] text-center">
                        <button
                          onClick={() => setSelected(o)}
                          title="Ver detalle"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#E8D4B8] hover:text-[#780e18] hover:border-[#780e18] transition-all"
                        >
                          <i className="ti ti-eye text-[14px]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>

      {selected && <OrdenDrawer orden={selected} onClose={() => setSelected(null)} />}
    </MainLayout>
  )
}
