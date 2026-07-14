import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Button, Modal, ConfirmModal } from '@/components/ui'
import { notify } from '@/lib/notify'
import { gql } from '@/lib/graphql'
import { CREDITO_DETALLE_QUERY, backendToCredito } from '@/lib/queries/creditos.queries'
import type { Credito } from '@/types'

const fmtBs = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
}

const ESTADO_CREDITO_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  Pendiente:  { label: 'Pendiente',  cls: 'bg-[#F5E0A8] text-[#7A5200]',     dot: 'bg-[#B47A1F]' },
  Parcial:    { label: 'Parcial',    cls: 'bg-[#F4ECDB] text-[#780e18]',     dot: 'bg-[#780e18]' },
  Pagado:     { label: 'Pagado',     cls: 'bg-[#B8DCCA] text-[#1E5C38]',     dot: 'bg-[#3F7A52]' },
  Cancelado:  { label: 'Cancelado',  cls: 'bg-[#F5C9C0] text-[#8A1E12]',     dot: 'bg-[#B23A2A]' },
}

const ESTADO_CREDITO_FALLBACK = { label: '—', cls: 'bg-[#E8E5E2] text-[#4A4744]', dot: 'bg-[#7A7571]' }

/** Lookup defensivo: case-insensitive + fallback si el estado es null/unknown. */
function getEstadoCreditoCfg(estado: string | null | undefined) {
  if (!estado) return ESTADO_CREDITO_FALLBACK
  const key = estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase()
  return ESTADO_CREDITO_CFG[key] ?? ESTADO_CREDITO_FALLBACK
}

export interface CreditoDetailModalProps {
  open: boolean
  creditoId: number | null
  onRegistrarAbono: (credito: Credito) => void
  onClose: () => void
}

/**
 * Detalle de un crédito: cabecera (cliente, estado, totales), lista de
 * items, historial de abonos, y acciones (registrar nuevo abono o
 * cancelar crédito). Carga su propio detalle vía GraphQL al abrir.
 */
export function CreditoDetailModal({ open, creditoId, onRegistrarAbono, onClose }: CreditoDetailModalProps) {
  const [credito, setCredito] = useState<Credito | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmCancelar, setConfirmCancelar] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!open || !creditoId) {
      setCredito(null)
      return
    }
    setLoading(true)
    gql<{ creditoDetalle: unknown }>(CREDITO_DETALLE_QUERY, { id: creditoId })
      .then((res) => {
        if (res.creditoDetalle) setCredito(backendToCredito(res.creditoDetalle as never))
      })
      .catch(() => notify.error('No se pudo cargar el crédito'))
      .finally(() => setLoading(false))
  }, [open, creditoId])

  if (!open) return null

  const cfg = credito ? getEstadoCreditoCfg(credito.estado) : null
  const puedeAbonar = credito?.estado === 'Pendiente' || credito?.estado === 'Parcial'
  const puedeCancelar = credito?.estado === 'Pendiente' || credito?.estado === 'Parcial'

  const handleCancelar = async () => {
    if (!credito) return
    setCancelling(true)
    try {
      const { api } = await import('@/lib/api')
      await api.post(`/Credito/${credito.id}/Cancelar`, null)
      notify.success('Crédito cancelado', { description: 'El stock fue devuelto al inventario.' })
      setConfirmCancelar(false)
      onClose()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al cancelar el crédito')
    } finally {
      setCancelling(false)
    }
  }

  const totalPagado = credito ? credito.total - credito.saldoPendiente : 0
  const porcentajePagado = credito && credito.total > 0 ? Math.min(100, (totalPagado / credito.total) * 100) : 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={credito ? `Crédito #${credito.id}` : 'Crédito'}
      size="xl"
    >
      {loading || !credito ? (
        <div className="py-12 text-center">
          <i className="ti ti-loader text-[#7A7571] text-[28px] animate-spin" />
          <p className="text-sm text-[#7A7571] mt-2">Cargando…</p>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Cabecera: estado + totales + cliente */}
          <div className="rounded-xl border border-[#E8E5E2] overflow-hidden">
            <div className="px-4 py-3 flex items-start justify-between gap-3 bg-[#FAF5EE]">
              <div className="min-w-0">
                <p className="text-xs text-[#7A7571]">Cliente</p>
                <p className="text-base font-bold text-[#2D2B2A] truncate">
                  {credito.cliente_nombre
                    ? `${credito.cliente_nombre} ${credito.cliente_apellido ?? ''}`.trim()
                    : `#${credito.id_cliente}`}
                </p>
                {credito.cliente_telefono && (
                  <p className="text-xs text-[#7A7571]">{credito.cliente_telefono}</p>
                )}
              </div>
              <span className={clsx('inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full', cfg?.cls)}>
                <span className={clsx('h-1.5 w-1.5 rounded-full', cfg?.dot)} />
                {cfg?.label}
              </span>
            </div>

            {/* Barra de progreso */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center justify-between text-[11px] text-[#7A7571] mb-1.5">
                <span>Pagado: <strong className="text-[#1E5C38]">{fmtBs(totalPagado)}</strong></span>
                <span>Saldo: <strong className="text-[#7A5200]">{fmtBs(credito.saldoPendiente)}</strong></span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#F0EFEC] overflow-hidden">
                <div
                  className="h-full bg-[#3F7A52] transition-all"
                  style={{ width: `${porcentajePagado}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-[#E8E5E2] border-t border-[#E8E5E2]">
              <div className="px-4 py-2.5 text-center">
                <p className="text-[10px] font-bold text-[#7A7571] uppercase tracking-widest">Total</p>
                <p className="text-sm font-black text-[#2D2B2A] mt-0.5">{fmtBs(credito.total)}</p>
              </div>
              <div className="px-4 py-2.5 text-center">
                <p className="text-[10px] font-bold text-[#1E5C38] uppercase tracking-widest">Pagado</p>
                <p className="text-sm font-black text-[#1E5C38] mt-0.5">{fmtBs(totalPagado)}</p>
              </div>
              <div className="px-4 py-2.5 text-center">
                <p className="text-[10px] font-bold text-[#7A5200] uppercase tracking-widest">Saldo</p>
                <p className="text-sm font-black text-[#7A5200] mt-0.5">{fmtBs(credito.saldoPendiente)}</p>
              </div>
            </div>

            <div className="px-4 py-2 border-t border-[#E8E5E2] flex items-center justify-between text-[10px] text-[#7A7571]">
              <span>Origen: {credito.id_ordenVenta ? `Orden #${credito.id_ordenVenta}` : 'Venta rápida'}</span>
              <span>Creado: {fmtDate(credito.fechaCreacion)}</span>
            </div>
            {credito.fechaPagoCompleto && (
              <div className="px-4 py-2 border-t border-[#E8E5E2] text-[10px] text-[#1E5C38] flex items-center gap-1">
                <i className="ti ti-check text-[12px]" />
                Pagado por completo: {fmtDate(credito.fechaPagoCompleto)}
              </div>
            )}
            {credito.fechaCancelacion && (
              <div className="px-4 py-2 border-t border-[#E8E5E2] text-[10px] text-[#8A1E12] flex items-center gap-1">
                <i className="ti ti-x text-[12px]" />
                Cancelado: {fmtDate(credito.fechaCancelacion)}
              </div>
            )}
            {credito.nota && (
              <div className="px-4 py-2 border-t border-[#E8E5E2] text-[11px] text-[#4A4744]">
                <span className="font-semibold text-[#7A7571]">Nota: </span>
                {credito.nota}
              </div>
            )}
          </div>

          {/* Items del crédito */}
          {credito.items.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#7A7571] uppercase tracking-widest mb-2">
                Productos ({credito.items.length})
              </p>
              <div className="rounded-xl border border-[#E8E5E2] overflow-hidden divide-y divide-[#E8E5E2] max-h-44 overflow-y-auto">
                {credito.items.map((it) => (
                  <div key={it.id} className="px-3 py-2.5">
                    {it.id_pieza && it.producto_codigo && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <i className="ti ti-stack text-[10px] text-[#D4A333]" />
                        <span className="font-mono text-[10px] font-bold text-[#7A5200] bg-[#F5E0A8] px-1.5 py-0.5 rounded">
                          {it.producto_codigo}
                        </span>
                        {it.producto_nombre && (
                          <span className="text-[10px] text-[#7A5200] truncate">{it.producto_nombre}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] font-bold text-[#780e18] bg-[#F4ECDB] px-1.5 py-0.5 rounded">
                          {it.id_pieza && it.pieza_codigo
                            ? it.pieza_codigo
                            : (it.producto_codigo ?? '')}
                        </span>
                        <p className="text-xs text-[#4A4744] truncate mt-0.5">
                          {it.id_pieza ? (it.pieza_nombre ?? '—') : (it.producto_nombre ?? '—')}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-[11px] text-[#7A7571]">×{it.cantidad} · {fmtBs(it.precioUnitario)}</p>
                        <p className="text-xs font-semibold text-[#2D2B2A]">{fmtBs(it.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Abonos / pagos */}
          <div>
            <p className="text-xs font-bold text-[#7A7571] uppercase tracking-widest mb-2">
              Abonos ({credito.pagos.length})
            </p>
            {credito.pagos.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[#7A7571] bg-[#F5F0EB] rounded-xl border border-dashed border-[#E8E5E2]">
                Aún no se registraron abonos.
              </div>
            ) : (
              <div className="rounded-xl border border-[#E8E5E2] overflow-hidden divide-y divide-[#E8E5E2] max-h-44 overflow-y-auto">
                {credito.pagos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-[#1E5C38]">{fmtBs(p.monto)}</p>
                      <p className="text-[10px] text-[#7A7571]">
                        {p.tipoPago} · {fmtDate(p.fecha)}
                        {p.usuario_nombre ? ` · ${p.usuario_nombre}` : ''}
                      </p>
                      {p.nota && <p className="text-[10px] text-[#7A7571] italic mt-0.5">{p.nota}</p>}
                    </div>
                    <i className="ti ti-cash text-[#3F7A52] text-[16px]" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-2 pt-2">
            {puedeCancelar && (
              <Button variant="secondary" onClick={() => setConfirmCancelar(true)} disabled={cancelling}>
                <i className="ti ti-x text-[14px] mr-1" />
                Cancelar crédito
              </Button>
            )}
            <div className="flex-1" />
            {puedeAbonar && (
              <Button onClick={() => onRegistrarAbono(credito)}>
                <i className="ti ti-cash text-[14px] mr-1" />
                Registrar abono
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmCancelar}
        title="Cancelar crédito"
        message="Se cancelará el crédito y se devolverá el stock al inventario. ¿Continuar?"
        onConfirm={handleCancelar}
        onClose={() => setConfirmCancelar(false)}
        loading={cancelling}
      />
    </Modal>
  )
}
