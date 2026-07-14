import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { MainLayout } from '@/components/layout/MainLayout'
import { notify } from '@/lib/notify'
import { gql } from '@/lib/graphql'
import { api } from '@/lib/api'
import { CREDITOS_QUERY, backendToCredito } from '@/lib/queries/creditos.queries'
import type { Credito, EstadoCredito } from '@/types'
import { CreditoDetailModal } from '@/components/modals/CreditoDetailModal'
import { RegistrarAbonoModal, type MetodoPagoCaja } from '@/components/modals/RegistrarAbonoModal'
import { useCreditosStore } from '@/stores/creditosStore'

const fmtBs = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (iso?: string) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: '2-digit' })
}

const ESTADO_CFG: Record<EstadoCredito, { label: string; cls: string; dot: string }> = {
  Pendiente: { label: 'Pendiente', cls: 'bg-[#F5E0A8] text-[#7A5200]',     dot: 'bg-[#B47A1F]' },
  Parcial:   { label: 'Parcial',   cls: 'bg-[#F4ECDB] text-[#780e18]',     dot: 'bg-[#780e18]' },
  Pagado:    { label: 'Pagado',    cls: 'bg-[#B8DCCA] text-[#1E5C38]',     dot: 'bg-[#3F7A52]' },
  Cancelado: { label: 'Cancelado', cls: 'bg-[#F5C9C0] text-[#8A1E12]',     dot: 'bg-[#B23A2A]' },
}

const ESTADO_FALLBACK = { label: '—', cls: 'bg-[#E8E5E2] text-[#4A4744]', dot: 'bg-[#7A7571]' }

/** Lookup defensivo: case-insensitive + fallback si el estado es null/unknown. */
function getEstadoCfg(estado: string | null | undefined) {
  if (!estado) return ESTADO_FALLBACK
  const key = (estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase()) as EstadoCredito
  return ESTADO_CFG[key] ?? ESTADO_FALLBACK
}

const TABS: { value: 'Todos' | EstadoCredito; label: string }[] = [
  { value: 'Todos',     label: 'Todos' },
  { value: 'Pendiente', label: 'Pendientes' },
  { value: 'Parcial',   label: 'Parciales' },
  { value: 'Pagado',    label: 'Pagados' },
  { value: 'Cancelado', label: 'Cancelados' },
]

// ─── Skeletons ───────────────────────────────────────────────────────────────

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[22px]">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl border border-[#D0CBC4] p-[18px] animate-pulse">
          <div className="flex items-start justify-between mb-[14px]">
            <div className="w-9 h-9 rounded-lg bg-[#F0EFEC]" />
            <div className="h-5 w-16 rounded-full bg-[#F0EFEC]" />
          </div>
          <div className="h-9 w-24 rounded bg-[#F0EFEC]" />
          <div className="h-3 w-20 rounded bg-[#E8E5E2] mt-2" />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-[#E8E5E2]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-3.5 animate-pulse">
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 rounded bg-[#F0EFEC]" />
            <div className="h-2.5 w-44 rounded bg-[#E8E5E2]" />
          </div>
          <div className="h-3 w-20 rounded bg-[#F0EFEC]" />
          <div className="h-6 w-16 rounded-full bg-[#F0EFEC]" />
          <div className="h-3 w-16 rounded bg-[#E8E5E2]" />
        </div>
      ))}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function CreditosPage() {
  const { isTokenReady } = useAuth()
  const { creditos, setCreditos } = useCreditosStore()

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'Todos' | EstadoCredito>('Todos')
  const [search, setSearch] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [creditoDetalleId, setCreditoDetalleId] = useState<number | null>(null)
  const [creditoParaAbono, setCreditoParaAbono] = useState<Credito | null>(null)

  const dateStr = useMemo(() => {
    return new Date().toLocaleDateString('es-BO', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
  }, [])

  const loadCreditos = () => {
    setLoading(true)
    gql<{
      creditos: {
        totalCount: number
        pageInfo: { hasNextPage: boolean; endCursor: string }
        nodes: Parameters<typeof backendToCredito>[0][]
      }
    }>(CREDITOS_QUERY, { first: 50 })
      .then((res) => {
        const { nodes } = res.creditos
        setCreditos(nodes.map(backendToCredito))
        setTotalCount(res.creditos.totalCount)
      })
      .catch(() => notify.error('Error cargando créditos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!isTokenReady) return
    loadCreditos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTokenReady])

  // Refetch silencioso cada 30s para que la página muestre saldos al día.
  useEffect(() => {
    if (!isTokenReady) return
    const interval = setInterval(loadCreditos, 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTokenReady])

  const filtrados = useMemo(() => {
    return creditos.filter((c) => {
      if (tab !== 'Todos' && c.estado !== tab) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const nombre = `${c.cliente_nombre ?? ''} ${c.cliente_apellido ?? ''}`.toLowerCase().trim()
      return (
        nombre.includes(q) ||
        (c.cliente_telefono?.includes(search) ?? false) ||
        String(c.id).includes(search)
      )
    })
  }, [creditos, tab, search])

  const kpi = useMemo(() => {
    const pendientes = creditos.filter((c) => c.estado === 'Pendiente' || c.estado === 'Parcial')
    const totalPendiente = pendientes.reduce((s, c) => s + c.saldoPendiente, 0)
    const totalCobrado = creditos
      .filter((c) => c.estado === 'Pagado' || c.estado === 'Parcial')
      .reduce((s, c) => s + (c.total - c.saldoPendiente), 0)
    return { activos: pendientes.length, totalPendiente, totalCobrado, total: totalCount }
  }, [creditos, totalCount])

  const handleRegistrarAbono = async (data: { monto: number; tipoPago: MetodoPagoCaja; nota: string | null }) => {
    if (!creditoParaAbono) return
    try {
      await api.post(`/Credito/${creditoParaAbono.id}/Pago`, {
        Monto: data.monto,
        TipoPago: data.tipoPago,
        Nota: data.nota,
      })
      notify.success('Pago registrado', { description: `${fmtBs(data.monto)} · Crédito #${creditoParaAbono.id}` })
      setCreditoParaAbono(null)
      loadCreditos()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al registrar el pago')
      throw err
    }
  }

  return (
    <MainLayout>
      <div className="bg-[#F7F7F7] min-h-screen">

        {/* ── TopBar ──────────────────────────────────────────────────── */}
        <header className="bg-[#F7F7F7]/85 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full h-[62px] px-7 border-b border-[#E8E5E2]">
          <div className="flex items-center gap-2 text-sm text-[#7A7571]">
            <span>Operaciones</span>
            <span className="text-[10px] opacity-40">/</span>
            <span>Ventas</span>
            <span className="text-[10px] opacity-40">/</span>
            <strong className="text-[#2D2B2A] font-semibold">Créditos</strong>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex bg-white px-3.5 py-1.5 rounded-lg items-center gap-2 border border-[#D8D4D0]">
              <i className="ti ti-calendar text-[#7A7571] text-[15px]" />
              <span className="text-xs text-[#4A4744]">{dateStr}</span>
            </div>
            <button
              onClick={loadCreditos}
              className="w-[34px] h-[34px] flex items-center justify-center rounded-full bg-white border border-[#D8D4D0] text-[#4A4744] hover:bg-[#F7F7F7] transition-colors"
              title="Recargar"
            >
              <i className="ti ti-refresh text-[15px]" />
            </button>
          </div>
        </header>

        <div className="px-7 py-[26px] max-w-[1320px] mx-auto w-full">

          {/* ── Page header ──────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="font-semibold text-[30px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Créditos
              </h2>
              <p className="text-[13.5px] text-[#7A7571] mt-1.5">
                Ventas a crédito y registro de abonos
              </p>
            </div>
          </div>

          {/* ── Metrics ──────────────────────────────────────────────── */}
          {loading && creditos.length === 0 ? <MetricsSkeleton /> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[22px]">

              <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#780e18] p-[18px] relative overflow-hidden">
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#780e18] opacity-[0.08]" />
                <div className="flex items-start justify-between mb-[14px]">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#780e18] to-[#D4A333] flex items-center justify-center shrink-0">
                    <i className="ti ti-hand-coins text-white text-[16px]" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F4ECDB] text-[#780e18]">
                    activos
                  </span>
                </div>
                <div className="font-semibold text-[32px] text-[#2D2B2A] leading-none" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {kpi.activos.toLocaleString('es-BO')}
                </div>
                <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Créditos activos</div>
              </div>

              <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#B47A1F] p-[18px] relative overflow-hidden">
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#B47A1F] opacity-[0.08]" />
                <div className="flex items-start justify-between mb-[14px]">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#B47A1F] to-[#F5E0A8] flex items-center justify-center shrink-0">
                    <i className="ti ti-clock-hour-4 text-white text-[16px]" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200]">
                    por cobrar
                  </span>
                </div>
                <div className="font-semibold text-[28px] text-[#2D2B2A] leading-none tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {fmtBs(kpi.totalPendiente)}
                </div>
                <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Saldo pendiente</div>
              </div>

              <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#3F7A52] p-[18px] relative overflow-hidden">
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#3F7A52] opacity-[0.08]" />
                <div className="flex items-start justify-between mb-[14px]">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3F7A52] to-[#6BAF80] flex items-center justify-center shrink-0">
                    <i className="ti ti-cash text-white text-[16px]" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#B8DCCA] text-[#1E5C38]">
                    acumulado
                  </span>
                </div>
                <div className="font-semibold text-[28px] text-[#2D2B2A] leading-none tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {fmtBs(kpi.totalCobrado)}
                </div>
                <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Total cobrado</div>
              </div>

            </div>
          )}

          {/* ── Tabs + Search ─────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex items-center gap-1 bg-white border border-[#D0CBC4] rounded-lg p-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-bold rounded-md transition-colors shrink-0',
                    tab === t.value
                      ? 'bg-[#780e18] text-white'
                      : 'text-[#4A4744] hover:bg-[#F5F0EB]',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7571] text-[14px] pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente, teléfono o #"
                className="pl-9 pr-3 py-2 text-sm bg-white border border-[#D0CBC4] rounded-lg focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 w-full md:w-72 placeholder:text-[#7A7571]"
              />
            </div>
          </div>

          {/* ── Tabla ────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-[#D0CBC4] overflow-hidden">
            {loading ? (
              <TableSkeleton />
            ) : filtrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
                <div className="w-12 h-12 rounded-lg bg-white border border-[#E8E5E2] flex items-center justify-center mb-4">
                  <i className="ti ti-hand-coins text-[#7A7571] text-xl" />
                </div>
                <p className="text-sm font-semibold text-[#2D2B2A] mb-1">
                  {search || tab !== 'Todos' ? 'Sin resultados' : 'Sin créditos'}
                </p>
                <p className="text-xs text-[#7A7571] font-medium max-w-xs">
                  {search || tab !== 'Todos'
                    ? 'No hay créditos con este filtro.'
                    : 'Aún no se generaron créditos. Usa la opción "Crédito" en el Punto de Venta o la venta rápida a crédito.'}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#FAF5EE] text-[#7A7571] text-[10.5px] uppercase tracking-[0.08em]">
                      <tr>
                        <th className="text-left font-semibold px-5 py-3">Cliente</th>
                        <th className="text-left font-semibold px-5 py-3">Origen</th>
                        <th className="text-left font-semibold px-5 py-3">Estado</th>
                        <th className="text-right font-semibold px-5 py-3">Total</th>
                        <th className="text-right font-semibold px-5 py-3">Saldo</th>
                        <th className="text-left font-semibold px-5 py-3">Creado</th>
                        <th className="text-right font-semibold px-5 py-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E5E2]">
                      {filtrados.map((c) => {
                        const cfg = getEstadoCfg(c.estado)
                        const cliente = `${c.cliente_nombre ?? ''} ${c.cliente_apellido ?? ''}`.trim() || `#${c.id_cliente}`
                        return (
                          <tr key={c.id} className="hover:bg-[#FAF5EE] transition-colors cursor-pointer" onClick={() => setCreditoDetalleId(c.id)}>
                            <td className="px-5 py-3">
                              <div className="font-semibold text-[13px] text-[#2D2B2A] truncate max-w-[260px]">{cliente}</div>
                              {c.cliente_telefono && (
                                <div className="text-[10.5px] text-[#7A7571] mt-0.5">{c.cliente_telefono}</div>
                              )}
                            </td>
                            <td className="px-5 py-3 text-[11.5px] text-[#7A7571]">
                              {c.id_ordenVenta ? `Orden #${c.id_ordenVenta}` : 'Venta rápida'}
                            </td>
                            <td className="px-5 py-3">
                              <span className={clsx('inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full', cfg.cls)}>
                                <span className={clsx('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right tabular-nums font-semibold text-[#2D2B2A]">{fmtBs(c.total)}</td>
                            <td className="px-5 py-3 text-right tabular-nums font-bold text-[#7A5200]">{fmtBs(c.saldoPendiente)}</td>
                            <td className="px-5 py-3 text-[11.5px] text-[#7A7571]">{fmtDate(c.fechaCreacion)}</td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {(c.estado === 'Pendiente' || c.estado === 'Parcial') && (
                                  <button
                                    onClick={() => setCreditoParaAbono(c)}
                                    className="h-8 px-3 text-[11px] font-bold bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-md transition-colors flex items-center gap-1"
                                    title="Registrar abono"
                                  >
                                    <i className="ti ti-cash text-[13px]" />
                                    Abonar
                                  </button>
                                )}
                                <button
                                  onClick={() => setCreditoDetalleId(c.id)}
                                  className="h-8 w-8 text-[#7A7571] hover:text-[#780e18] hover:bg-[#F4ECDB] rounded-md transition-colors flex items-center justify-center"
                                  title="Ver detalle"
                                >
                                  <i className="ti ti-eye text-[15px]" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile list */}
                <div className="md:hidden divide-y divide-[#E8E5E2]">
                  {filtrados.map((c) => {
                    const cfg = getEstadoCfg(c.estado)
                    const cliente = `${c.cliente_nombre ?? ''} ${c.cliente_apellido ?? ''}`.trim() || `#${c.id_cliente}`
                    return (
                      <div key={c.id} className="px-4 py-3" onClick={() => setCreditoDetalleId(c.id)}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-[13px] text-[#2D2B2A] truncate">{cliente}</span>
                          <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', cfg.cls)}>
                            <span className={clsx('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#7A7571]">
                          <span>{c.id_ordenVenta ? `Orden #${c.id_ordenVenta}` : 'Venta rápida'} · {fmtDate(c.fechaCreacion)}</span>
                          <span className="font-mono font-bold text-[#7A5200]">{fmtBs(c.saldoPendiente)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      <CreditoDetailModal
        open={creditoDetalleId !== null}
        creditoId={creditoDetalleId}
        onClose={() => setCreditoDetalleId(null)}
        onRegistrarAbono={(c) => {
          setCreditoDetalleId(null)
          setCreditoParaAbono(c)
        }}
      />

      <RegistrarAbonoModal
        open={creditoParaAbono !== null}
        credito={creditoParaAbono}
        onClose={() => setCreditoParaAbono(null)}
        onConfirm={handleRegistrarAbono}
      />
    </MainLayout>
  )
}
