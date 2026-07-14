import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { MainLayout } from '@/components/layout/MainLayout'
import { Button } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { notify } from '@/lib/notify'
import { useVentasStore } from '@/stores/ventasStore'
import { useSoundAlert } from '@/hooks/useSoundAlert'
import { useVentasAlerts } from '@/hooks/useVentasAlerts'
import type { OrdenVenta, EstadoOrden, ItemOrden, PiezaOrden, Producto } from '@/types'
import { gql } from '@/lib/graphql'
import { api } from '@/lib/api'
import { useVentasHub } from '@/hooks/useVentasHub'
import { ORDENES_PENDIENTES_QUERY, MIS_ORDENES_ALMACEN_QUERY, backendToOrdenVenta, type OrdenVentaAPI } from '@/lib/queries/ventas.queries'
import { PRODUCTOS_IMAGENES_BATCH_QUERY } from '@/lib/queries/inventario.queries'
import { GalleryViewerModal } from '@/pages/inventario/GalleryViewerModal'
import { ProductThumb } from '@/components/ui/ProductThumb'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBs = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtTimeSince = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'ahora'
  if (mins === 1) return '1 min'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const ALERT_MINS = 10

type TabFiltro = 'todos' | 'pendiente_almacenero' | 'en_preparacion' | 'listo_para_escaneo'

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EstadoOrden, { label: string; bg: string; text: string; dot: string }> = {
  pendiente_almacenero: { label: 'Pendiente',       bg: 'bg-[#F5E0A8]',   text: 'text-[#7A5200]',  dot: 'bg-[#B47A1F]' },
  en_preparacion:       { label: 'En preparación',  bg: 'bg-[#DBEAFE]',   text: 'text-[#1D4ED8]',  dot: 'bg-[#3B82F6]' },
  listo_para_escaneo:   { label: 'Para escanear',   bg: 'bg-[#EDE9FE]',   text: 'text-[#5B21B6]',  dot: 'bg-[#7C3AED]' },
  con_faltantes:        { label: 'Con faltantes',   bg: 'bg-[#F5E0A8]',   text: 'text-[#7A5200]',  dot: 'bg-[#B47A1F]' },
  esperando_pago:       { label: 'Esperando pago',  bg: 'bg-[#F3E8FF]',   text: 'text-[#7E22CE]',  dot: 'bg-[#A855F7]' },
  completada:           { label: 'Completada',      bg: 'bg-[#B8DCCA]',   text: 'text-[#1E5C38]',  dot: 'bg-[#3F7A52]' },
  cancelada:            { label: 'Cancelada',       bg: 'bg-[#F5C9C0]',   text: 'text-[#8A1E12]',  dot: 'bg-[#B23A2A]' },
}

// ─── OrderCard (lista) ───────────────────────────────────────────────────────

function OrderCard({
  orden,
  userId,
  onTomar,
  isNew,
}: {
  orden: OrdenVenta
  userId: string
  onTomar: (o: OrdenVenta) => void
  isNew?: boolean
}) {
  const mins = Math.floor((Date.now() - new Date(orden.creado_en).getTime()) / 60_000)
  const isLate = mins >= ALERT_MINS && orden.estado === 'pendiente_almacenero'
  const esMia = !!orden.almacenero_id && orden.almacenero_id.toLowerCase() === userId.toLowerCase()
  const tomadaPorOtro = !!orden.almacenero_id && !esMia
  const status = STATUS_CONFIG[orden.estado]
  const pendientesCount = orden.items.filter(i => i.estado === 'pendiente').length
  const hasPendientes = pendientesCount > 0 && orden.estado === 'con_faltantes'

  return (
    <div
      className={clsx(
        'bg-white rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
        isNew && 'ring-2 ring-[#D4A333] ring-offset-2',
        isLate && orden.estado === 'pendiente_almacenero' ? 'border-[#B23A2A]' : 'border-[#D0CBC4]',
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-black text-[#2D2B2A]">{orden.numero}</span>
          <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold', status.bg, status.text)}>
            <span className={clsx('h-1.5 w-1.5 rounded-full shrink-0', status.dot, orden.estado === 'pendiente_almacenero' && 'animate-pulse')} />
            {status.label}
          </span>
          {isLate && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F5C9C0] text-[#8A1E12] text-[10px] font-bold">
              <i className="ti ti-alert-triangle text-[11px]" />
              Urgente
            </span>
          )}
          {hasPendientes && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200] text-[10px] font-bold animate-pulse">
              <i className="ti ti-clock text-[11px]" />
              {pendientesCount} nuevo{pendientesCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className={clsx('text-xs font-medium tabular-nums shrink-0', isLate ? 'text-[#B23A2A]' : 'text-[#7A7571]')}>
          {fmtTimeSince(orden.creado_en)}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-[#7A7571] mb-1">
        <span className="font-medium text-[#4A4744]">{orden.cajero_nombre}</span>
        <span>·</span>
        <span>{orden.items.length} prod.</span>
        <span>·</span>
        <span className="font-semibold text-[#4A4744]">{fmtBs(orden.total)}</span>
      </div>

      {(() => {
        const kitsCount = orden.items.filter(i => i.es_kit && !i.es_parcial).length
        const piezasCount = orden.items.filter(i => i.es_parcial).length
        if (!kitsCount && !piezasCount) return null
        return (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {kitsCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F4ECDB] text-[#780e18] text-[10px] font-bold border border-[#E8D4B8]">
                <i className="ti ti-stack text-[11px]" />
                {kitsCount} kit{kitsCount > 1 ? 's' : ''}
              </span>
            )}
            {piezasCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[10px] font-bold border border-[#BFDBFE]">
                <i className="ti ti-tool text-[11px]" />
                {piezasCount} piezas sueltas
              </span>
            )}
          </div>
        )
      })()}

      {orden.nota && (
        <p className="mt-1.5 text-xs text-[#7A5200] italic bg-[#F5E0A8] px-2.5 py-1.5 rounded-lg border border-[#B47A1F]/30 flex items-start gap-1.5">
          <i className="ti ti-note text-[12px] shrink-0 mt-0.5" />
          {orden.nota}
        </p>
      )}

      {tomadaPorOtro && orden.estado === 'en_preparacion' && (
        <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-[#F0EFEC] border border-[#E8E5E2]">
          <div className="h-8 w-8 rounded-full bg-[#E8E5E2] flex items-center justify-center text-xs font-bold text-[#4A4744]">
            {(orden.almacenero_nombre ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#4A4744]">{orden.almacenero_nombre ?? 'Desconocido'}</p>
            <p className="text-[10px] text-[#7A7571]">está preparando esta orden</p>
          </div>
          <i className="ti ti-lock text-[#7A7571] text-[16px]" />
        </div>
      )}

      <div className="mt-3">
        {orden.estado === 'pendiente_almacenero' && (
          <button
            onClick={() => onTomar(orden)}
            className="w-full py-2.5 rounded-xl bg-[#2D2B2A] text-white text-xs font-bold hover:bg-[#4A4744] active:bg-[#1A1918] transition-all flex items-center justify-center gap-2"
          >
            <i className="ti ti-package text-[14px]" />
            Tomar orden
          </button>
        )}
        {orden.estado === 'en_preparacion' && esMia && (
          <button
            onClick={() => onTomar(orden)}
            className="w-full py-2.5 rounded-xl bg-[#1D4ED8] text-white text-xs font-bold hover:bg-[#1E40AF] active:bg-[#1E3A8A] transition-all flex items-center justify-center gap-2"
          >
            <i className="ti ti-edit text-[14px]" />
            Continuar preparación
          </button>
        )}
        {orden.estado === 'listo_para_escaneo' && (
          <button
            onClick={() => onTomar(orden)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#EDE9FE] rounded-xl border border-[#DDD6FE] hover:bg-[#DDD6FE] transition-colors"
          >
            <div className="h-2 w-2 rounded-full bg-[#7C3AED] animate-bounce" />
            <p className="text-xs text-[#5B21B6] font-bold">Lista — esperando escaneo · Ver detalle</p>
          </button>
        )}
        {(orden.estado === 'listo_para_escaneo' || orden.estado === 'con_faltantes') && hasPendientes && (
          <button
            onClick={() => onTomar(orden)}
            className="w-full py-2.5 rounded-xl bg-[#B47A1F] text-white text-xs font-bold hover:bg-[#7A5200] active:bg-[#5C3D00] transition-all flex items-center justify-center gap-2"
          >
            <i className="ti ti-package text-[14px]" />
            Ir a buscar {pendientesCount} producto{pendientesCount !== 1 ? 's' : ''} faltante{pendientesCount !== 1 ? 's' : ''}
          </button>
        )}
        {orden.estado === 'con_faltantes' && !hasPendientes && (
          <button
            onClick={() => onTomar(orden)}
            className="w-full py-2.5 rounded-xl bg-[#B23A2A] text-white text-xs font-bold hover:bg-[#8A1E12] active:bg-[#6B1410] transition-all flex items-center justify-center gap-2"
          >
            <i className="ti ti-clipboard-list text-[14px]" />
            Ver orden con faltantes
          </button>
        )}
      </div>
    </div>
  )
}

// ─── FaltantesModal ─────────────────────────────────────────────────────────

type PiezaFaltante = { itemId: string; piezaId: number }
type ItemFaltante = { id: string; cantidadEncontrada: number }

function FaltantesModal({
  orden,
  open,
  onClose,
  onConfirm,
  onRevertir,
}: {
  orden: OrdenVenta
  open: boolean
  onClose: () => void
  onConfirm: (items: ItemFaltante[], piezasFaltantes: PiezaFaltante[]) => void
  onRevertir: (itemId: string, piezaId?: number) => Promise<void>
}) {
  const [selItems, setSelItems] = useState<Set<string>>(new Set())
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [selPiezas, setSelPiezas] = useState<Set<string>>(new Set())
  const [confirmando, setConfirmando] = useState(false)
  const [revertiendoId, setRevertiendoId] = useState<string | null>(null)

  const totalSel = selItems.size + selPiezas.size

  const toggleItem = (id: string) =>
    setSelItems(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const setCantidad = (id: string, val: number) =>
    setCantidades(prev => ({ ...prev, [id]: val }))

  const togglePieza = (itemId: string, piezaId: number) => {
    const key = `${itemId}-${piezaId}`
    setSelPiezas(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  const handleConfirm = async () => {
    if (totalSel === 0) { notify.warning('Selecciona al menos un faltante'); return }
    setConfirmando(true)
    const items: ItemFaltante[] = [...selItems].map(id => ({ id, cantidadEncontrada: cantidades[id] ?? 0 }))
    const piezasFaltantes: PiezaFaltante[] = [...selPiezas].map(key => {
      const [itemId, piezaId] = key.split('-')
      return { itemId, piezaId: Number(piezaId) }
    })
    await onConfirm(items, piezasFaltantes)
    setConfirmando(false)
    setSelItems(new Set())
    setCantidades({})
    setSelPiezas(new Set())
  }

  const handleClose = () => {
    setSelItems(new Set())
    setCantidades({})
    setSelPiezas(new Set())
    onClose()
  }

  const itemsDisponibles = orden.items.filter(i => i.estado !== 'faltante')
  const itemsFaltantes   = orden.items.filter(i => i.estado === 'faltante')

  function CheckBox({ checked }: { checked: boolean }) {
    return (
      <div className={clsx('h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
        checked ? 'bg-[#B23A2A] border-[#B23A2A]' : 'border-[#E8E5E2]')}>
        {checked && <i className="ti ti-check text-white text-[12px]" />}
      </div>
    )
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Reportar faltantes — ${orden.numero}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={confirmando}>Cancelar</Button>
          <Button variant="danger" onClick={handleConfirm} loading={confirmando} disabled={totalSel === 0}>
            Reportar {totalSel > 0 ? `(${totalSel})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[#7A7571]">
          Marca los productos o piezas que no encontraste. El stock reservado será liberado.
        </p>

        {itemsDisponibles.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[#7A7571] uppercase tracking-wide mb-2">
              Disponibles ({itemsDisponibles.length})
            </p>
            <div className="space-y-1.5">
              {itemsDisponibles.map(item => {
                if (item.es_parcial && item.piezas_orden?.length) {
                  return (
                    <div key={item.id} className="rounded-xl border border-[#E8E5E2] bg-white overflow-hidden">
                      <div className="px-3 py-2 bg-[#F0F4FF] border-b border-[#DBEAFE]">
                        <p className="text-xs font-bold text-[#1D4ED8]">{item.producto_nombre}</p>
                        <p className="text-[10px] text-[#3B82F6]">Kit parcial — selecciona las piezas faltantes</p>
                      </div>
                      <div className="divide-y divide-[#E8E5E2]">
                        {item.piezas_orden.map(p => {
                          const key = `${item.id}-${p.id}`
                          const checked = selPiezas.has(key)
                          return (
                            <div
                              key={p.id}
                              onClick={() => togglePieza(item.id, p.id)}
                              className={clsx('flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                                checked ? 'bg-[#FDF1EE]' : 'hover:bg-[#F7F7F7]')}
                            >
                              <CheckBox checked={checked} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#2D2B2A] truncate">{p.nombre}</p>
                              </div>
                              <span className="text-sm font-bold text-[#4A4744] shrink-0">×{p.cantidad}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
                const checked = selItems.has(item.id)
                const cantEncontrada = cantidades[item.id] ?? 0
                return (
                  <div
                    key={item.id}
                    className={clsx('rounded-xl border transition-all',
                      checked ? 'bg-[#FDF1EE] border-[#F5C9C0]' : 'bg-white border-[#E8E5E2] hover:border-[#F5C9C0]')}
                  >
                    <div
                      onClick={() => toggleItem(item.id)}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    >
                      <CheckBox checked={checked} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#2D2B2A] truncate">{item.producto_nombre}</p>
                        {item.producto_descripcion && (
                          <p
                            className="text-[10px] text-[#7A7571] truncate leading-tight mt-0.5"
                            title={item.producto_descripcion}
                          >
                            <i className="ti ti-align-left text-[9px] mr-0.5" />
                            {item.producto_descripcion}
                          </p>
                        )}
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
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] font-mono text-[#7A7571] bg-[#F0EFEC] px-1.5 py-0.5 rounded">{item.producto_codigo}</span>
                          {(item.producto_almacen || item.producto_estante) && (
                            <span className="text-[11px] text-[#7A7571] flex items-center gap-0.5">
                              <i className="ti ti-map-pin text-[10px]" />
                              {item.producto_almacen}{item.producto_estante ? ` / ${item.producto_estante}` : ''}
                              {item.producto_fila ? ` / ${item.producto_fila}` : ''}{item.producto_columna ? ` / ${item.producto_columna}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[#4A4744] shrink-0">×{item.cantidad_pedida}</span>
                    </div>
                    {checked && (
                      <div className="px-3 pb-2.5 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <span className="text-xs text-[#B23A2A] font-medium shrink-0">Cantidad encontrada:</span>
                        <input
                          type="number"
                          min={0}
                          max={item.cantidad_pedida - 1}
                          value={cantEncontrada}
                          onChange={e => setCantidad(item.id, Math.min(item.cantidad_pedida - 1, Math.max(0, Number(e.target.value))))}
                          className="w-16 text-center text-sm font-bold border border-[#F5C9C0] rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#B23A2A]/30"
                        />
                        <span className="text-xs text-[#7A7571]">de {item.cantidad_pedida}</span>
                        {cantEncontrada === 0 && (
                          <span className="text-[10px] text-[#B23A2A] font-medium ml-1">ninguno</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {itemsFaltantes.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[#B23A2A] uppercase tracking-wide mb-2">
              Ya reportados ({itemsFaltantes.length})
            </p>
            <div className="space-y-1">
              {itemsFaltantes.map(item => {
                const isRev = revertiendoId === item.id
                return (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#FDF1EE] border border-[#F5C9C0]">
                    <i className="ti ti-x text-[#B23A2A] text-[16px] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#8A1E12] truncate">{item.producto_nombre}</p>
                      {(item.producto_categoria || item.producto_procedencia) && (
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#B23A2A]/70 leading-tight">
                          {item.producto_categoria && (
                            <span className="inline-flex items-center gap-0.5">
                              <i className="ti ti-tag text-[9px]" />
                              {item.producto_categoria}
                            </span>
                          )}
                          {item.producto_categoria && item.producto_procedencia && <span className="text-[#B23A2A]/30">·</span>}
                          {item.producto_procedencia && (
                            <span className="inline-flex items-center gap-0.5">
                              <i className="ti ti-flag text-[9px]" />
                              Origen: {item.producto_procedencia}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono text-[#B23A2A]">{item.producto_codigo}</span>
                        {item.nota && <span className="text-[10px] text-[#B23A2A] italic">— {item.nota}</span>}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        setRevertiendoId(item.id)
                        await onRevertir(item.id)
                        setRevertiendoId(null)
                      }}
                      disabled={isRev || confirmando}
                      className="p-1.5 rounded-lg text-[#B23A2A] hover:text-[#8A1E12] hover:bg-[#F5C9C0] transition-colors disabled:opacity-40"
                      title="Deshacer faltante"
                    >
                      {isRev
                        ? <i className="ti ti-loader-2 text-[16px] animate-spin" />
                        : <i className="ti ti-arrow-back-up text-[16px]" />
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {orden.items.length === 0 && (
          <p className="text-sm text-[#7A7571] text-center py-4">No hay productos en esta orden</p>
        )}
      </div>
    </Modal>
  )
}

// ─── PickingView (en preparación) ──────────────────────────────────────────

function ItemCard({
  item,
  showListoBtn,
  loading,
  onListo,
  onFaltante,
  onEditCantidad,
  imagen,
  onViewGallery,
}: {
  item: OrdenVenta['items'][number]
  showListoBtn: boolean
  loading: boolean
  onListo: () => void
  onFaltante?: () => void
  onEditCantidad?: () => void
  imagen?: string
  onViewGallery?: (producto_id: string, codigo: string, nombre: string | null | undefined) => void
}) {
  const isPendiente = item.estado === 'pendiente'
  const isListoAlmacenero = item.estado === 'listo_almacenero'
  const isFaltanteTotal = item.estado === 'faltante' && (!item.cantidad_recogida || item.cantidad_recogida === 0)
  const isParcial = item.estado === 'parcial' || (item.estado === 'faltante' && !!item.cantidad_recogida && item.cantidad_recogida > 0)

  const recogida = item.cantidad_recogida ?? 0
  const pedida = item.cantidad_pedida
  const pct = pedida > 0 ? Math.round((recogida / pedida) * 100) : 0

  return (
    <div className={clsx(
      'rounded-xl border overflow-hidden',
      isFaltanteTotal ? 'border-[#F5C9C0] bg-[#FDF1EE]' :
      isPendiente ? 'border-[#F5E0A8] bg-[#FFFBF0]' :
      isListoAlmacenero ? 'border-[#B8DCCA] bg-[#F0FAF5]' :
      isParcial ? 'border-[#F5E0A8] bg-white' :
      'border-[#E8E5E2] bg-white'
    )}>
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        {/* Thumb producto */}
        {onViewGallery && (
          <ProductThumb
            src={imagen}
            nombre={item.producto_nombre}
            size="sm"
            onClick={() => onViewGallery(item.producto_id, item.producto_codigo, item.producto_nombre)}
          />
        )}

        {/* Icono estado */}
        <div className={clsx(
          'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
          isFaltanteTotal ? 'bg-[#F5C9C0] border border-[#F5C9C0]' :
          isPendiente ? 'bg-[#F5E0A8] border border-[#F5E0A8]' :
          isListoAlmacenero ? 'bg-[#B8DCCA] border border-[#B8DCCA]' :
          isParcial ? 'bg-[#F5E0A8] border border-[#F5E0A8]' :
          'bg-[#F0EFEC] border border-[#E8E5E2]'
        )}>
          {isFaltanteTotal ? (
            <i className="ti ti-x text-[#B23A2A] text-[16px]" />
          ) : isListoAlmacenero ? (
            <i className="ti ti-check text-[#3F7A52] text-[16px]" />
          ) : isParcial ? (
            <i className="ti ti-clock text-[#B47A1F] text-[16px]" />
          ) : (
            <i className={clsx('text-[16px]', isPendiente ? 'ti ti-package text-[#B47A1F]' : 'ti ti-package text-[#7A7571]')} />
          )}
        </div>

        {/* Info producto */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-[#7A7571] leading-none mb-0.5">{item.producto_codigo}</p>
          <p className="text-sm font-bold text-[#2D2B2A] leading-snug">{item.producto_nombre}</p>
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
          <p className="text-[11px] text-[#7A7571] mt-0.5">Pedidas: {pedida} unidades</p>
          {item.nota && <p className="text-[11px] text-[#B23A2A] mt-0.5 italic">{item.nota}</p>}
          {(item.producto_almacen || item.producto_estante || item.producto_fila || item.producto_columna) && (
            <p className="text-[11px] text-[#7A7571] mt-0.5 flex items-center gap-0.5">
              <i className="ti ti-map-pin text-[10px]" />
              {item.producto_almacen}{item.producto_estante ? ` / ${item.producto_estante}` : ''}{item.producto_fila ? ` / ${item.producto_fila}` : ''}{item.producto_columna ? ` / ${item.producto_columna}` : ''}
            </p>
          )}
          {item.es_parcial && (
            <span className="inline-block mt-1 text-[10px] font-bold bg-[#DBEAFE] text-[#1D4ED8] px-1.5 py-0.5 rounded-full">Kit parcial</span>
          )}
        </div>

        {/* Derecha: estado/cantidad + botones */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {isPendiente && (
            <p className="text-xl font-black text-[#4A4744] tabular-nums">×{pedida}</p>
          )}
          {isListoAlmacenero && (
            <div className="text-right">
              <p className="text-base font-black text-[#3F7A52] tabular-nums leading-none">{pedida}/{pedida}</p>
              <p className="text-[10px] font-bold text-[#3F7A52]">Listo</p>
            </div>
          )}
          {isFaltanteTotal && (
            <div className="text-right">
              <p className="text-base font-black text-[#B23A2A] tabular-nums leading-none">0/{pedida}</p>
              <p className="text-[10px] font-bold text-[#B23A2A]">Faltante</p>
            </div>
          )}
          {showListoBtn && isPendiente && (
            <div className="flex flex-col gap-1.5 items-end mt-1">
              <button onClick={onListo} disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#3F7A52] text-white hover:bg-[#1E5C38] disabled:opacity-50 transition-colors">
                {loading ? '…' : 'Listo'}
              </button>
              <button onClick={onFaltante}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#B23A2A] text-white hover:bg-[#8A1E12] transition-colors">
                Faltante
              </button>
            </div>
          )}
          {(isParcial || isFaltanteTotal) && onEditCantidad && (
            <button onClick={onEditCantidad}
              className="text-[10px] font-bold text-[#B47A1F] hover:text-[#7A5200] underline underline-offset-2 transition-colors mt-1">
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Barra de progreso parcial / faltante */}
      {(isParcial || isFaltanteTotal) && (
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          <div className={clsx('flex-1 relative h-2 rounded-full overflow-hidden', isFaltanteTotal ? 'bg-[#F5C9C0]' : 'bg-[#F5E0A8]')}>
            <div
              className={clsx('absolute top-0 left-0 h-full transition-all rounded-full', isFaltanteTotal ? 'bg-[#B23A2A]' : 'bg-[#B47A1F]')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className={clsx('shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full', isFaltanteTotal ? 'bg-[#F5C9C0] text-[#8A1E12]' : 'bg-[#F5E0A8] text-[#7A5200]')}>
            <i className={clsx('text-[11px]', isFaltanteTotal ? 'ti ti-x' : 'ti ti-clock')} />
            <span className="text-[10px] font-bold tabular-nums">{recogida}/{pedida} {isFaltanteTotal ? 'Faltante' : 'Parcial'}</span>
          </div>
        </div>
      )}

      {item.es_parcial && item.piezas_orden && item.piezas_orden.length > 0 && (
        <div className="border-t border-[#E8E5E2] bg-[#F7F7F7] divide-y divide-[#E8E5E2]">
          {item.piezas_orden.map(p => (
            <div key={p.id_pieza} className="flex items-center gap-2 px-4 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {p.codigo_pieza && (
                    <span className="text-[10px] font-mono font-bold text-[#780e18] bg-white px-1.5 py-0.5 rounded border border-[#E8E5E2] shrink-0">
                      {p.codigo_pieza}
                    </span>
                  )}
                  <span className="text-xs text-[#4A4744] truncate">{p.nombre}</span>
                </div>
              </div>
              <span className="text-xs font-bold text-[#2D2B2A] shrink-0">×{p.cantidad}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── KitGroupCard ────────────────────────────────────────────────────────────

function parsePiezaRecogida(nota: string | null | undefined): number | undefined {
  if (!nota) return undefined
  const m = nota.match(/^Encontró (\d+) de \d+/)
  return m ? parseInt(m[1], 10) : undefined
}

function getPiezaEstado(p: PiezaOrden): 'listo' | 'parcial' | 'faltante' | 'pendiente' {
  if (p.confirmado || p.listo_almacenero) return 'listo'
  if (p.nota_incompleto) {
    const rec = parsePiezaRecogida(p.nota_incompleto)
    return rec != null && rec > 0 ? 'parcial' : 'faltante'
  }
  return 'pendiente'
}

interface KitGroupCardProps {
  kitCompleto?: ItemOrden
  piezasSueltas?: ItemOrden
  ordenId: string
  isReadOnly: boolean
  loadingPiezas: Record<string, boolean>
  onMarcarListoKit: (itemId: string) => void
  onFaltanteKit: (itemId: string, cantidadPedida: number) => void
  onConfirmarPieza: (itemId: string, pieza: PiezaOrden) => Promise<void>
  onFaltantePieza: (itemId: string, pieza: PiezaOrden) => void
  onListoPieza: (itemId: string, pieza: PiezaOrden) => void
  onEditKit?: (itemId: string, cantidadPedida: number, cantidadRecogida?: number) => void
  productoImagenes: Record<string, string>
  onViewGallery: (producto_id: string, codigo: string, nombre: string | null | undefined) => void
}

function KitGroupCard({
  kitCompleto,
  piezasSueltas,
  isReadOnly,
  loadingPiezas,
  onMarcarListoKit,
  onFaltanteKit,
  onConfirmarPieza: _onConfirmarPieza,
  onFaltantePieza,
  onListoPieza,
  onEditKit,
  productoImagenes,
  onViewGallery,
}: KitGroupCardProps) {
  const piezas = piezasSueltas?.piezas_orden ?? []
  const piezasListasCount = piezas.filter(p => getPiezaEstado(p) === 'listo').length
  const piezasParcialCount = piezas.filter(p => getPiezaEstado(p) === 'parcial').length
  const piezasPendienteCount = piezas.filter(p => getPiezaEstado(p) === 'pendiente').length
  const piezasParcialesNombre = piezas.filter(p => p.nota_incompleto)

  const kitCompletoListo = kitCompleto?.estado === 'listo_almacenero' || kitCompleto?.estado === 'completo'
  const kitCompletoPendiente = kitCompleto?.estado === 'pendiente'

  return (
    <div className="rounded-xl border border-[#D0CBC4] overflow-hidden bg-white">

      {/* Sección: Kit completo */}
      {kitCompleto && (
        <div className={clsx('border-b border-[#E8E5E2]',
          kitCompletoListo ? 'bg-[#F0FAF5]' :
          kitCompletoPendiente ? '' :
          'bg-[#FDF1EE]'
        )}>
          <div className={clsx('flex items-center justify-between px-4 py-2.5 border-b',
            kitCompletoListo ? 'border-[#B8DCCA]' :
            kitCompletoPendiente ? 'border-[#E8E5E2]' :
            'border-[#F5C9C0]'
          )}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
                kitCompletoListo ? 'bg-[#B8DCCA] text-[#1E5C38]' :
                kitCompletoPendiente ? 'bg-[#F0EFEC] text-[#4A4744]' :
                'bg-[#F5C9C0] text-[#8A1E12]')}>
                <i className="ti ti-stack text-[10px]" />
                Kit completo
              </span>
              <span className="text-xs text-[#7A7571] font-mono shrink-0">{kitCompleto.producto_codigo}</span>
              <span className="text-xs text-[#4A4744] font-medium truncate min-w-0">{kitCompleto.producto_nombre}</span>
              <span className="text-xs text-[#7A7571] shrink-0">×{kitCompleto.cantidad_pedida} pedidos</span>
            </div>
            <span className="text-[10px] text-[#7A7571] hidden sm:block">Busca el kit armado físicamente</span>
          </div>

          <div className="px-4 py-3 flex items-center gap-3">
            <ProductThumb
              src={productoImagenes[kitCompleto.producto_id]}
              nombre={kitCompleto.producto_nombre}
              size="sm"
              onClick={() => onViewGallery(kitCompleto.producto_id, kitCompleto.producto_codigo, kitCompleto.producto_nombre)}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#2D2B2A] truncate">{kitCompleto.producto_nombre}</p>
              {(kitCompleto.producto_categoria || kitCompleto.producto_procedencia) && (
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#7A7571] leading-tight">
                  {kitCompleto.producto_categoria && (
                    <span className="inline-flex items-center gap-0.5">
                      <i className="ti ti-tag text-[9px]" />
                      {kitCompleto.producto_categoria}
                    </span>
                  )}
                  {kitCompleto.producto_categoria && kitCompleto.producto_procedencia && <span className="text-[#D0CBC4]">·</span>}
                  {kitCompleto.producto_procedencia && (
                    <span className="inline-flex items-center gap-0.5">
                      <i className="ti ti-flag text-[9px]" />
                      Origen: {kitCompleto.producto_procedencia}
                    </span>
                  )}
                </div>
              )}
              <p className="text-[11px] text-[#7A7571] mt-0.5">
                {kitCompleto.cantidad_pedida} unidades pedidas · kit pre-armado
              </p>
              {(kitCompleto.producto_almacen || kitCompleto.producto_estante || kitCompleto.producto_fila || kitCompleto.producto_columna) && (
                <p className="text-[11px] text-[#7A7571] mt-0.5 flex items-center gap-0.5">
                  <i className="ti ti-map-pin text-[10px]" />
                  {kitCompleto.producto_almacen}{kitCompleto.producto_estante ? ` / ${kitCompleto.producto_estante}` : ''}{kitCompleto.producto_fila ? ` / ${kitCompleto.producto_fila}` : ''}{kitCompleto.producto_columna ? ` / ${kitCompleto.producto_columna}` : ''}
                </p>
              )}
            </div>
            <div className="shrink-0">
              {kitCompletoListo ? (
                <div className="flex items-center gap-1.5 bg-[#B8DCCA] text-[#1E5C38] px-2.5 py-1 rounded-full">
                  <i className="ti ti-check text-[13px]" />
                  <span className="text-xs font-bold tabular-nums">
                    {kitCompleto.cantidad_pedida}/{kitCompleto.cantidad_pedida} listo
                  </span>
                </div>
              ) : kitCompletoPendiente && !isReadOnly ? (
                <div className="flex flex-col gap-1.5 items-end">
                  <button
                    onClick={() => onMarcarListoKit(kitCompleto.id)}
                    disabled={!!loadingPiezas[kitCompleto.id]}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#3F7A52] text-white hover:bg-[#1E5C38] disabled:opacity-50 transition-colors"
                  >
                    {loadingPiezas[kitCompleto.id] ? '…' : 'Listo'}
                  </button>
                  <button
                    onClick={() => onFaltanteKit(kitCompleto.id, kitCompleto.cantidad_pedida)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#B23A2A] text-white hover:bg-[#8A1E12] transition-colors"
                  >
                    Faltante
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 items-end">
                  <span className="text-xs text-[#7A7571] bg-[#F0EFEC] px-2 py-1 rounded-full">
                    ×{kitCompleto.cantidad_pedida}
                  </span>
                  {!isReadOnly && onEditKit && (
                    <button
                      onClick={() => onEditKit(kitCompleto.id, kitCompleto.cantidad_pedida, kitCompleto.cantidad_recogida)}
                      className="text-[10px] font-bold text-[#B47A1F] hover:text-[#7A5200] underline underline-offset-2 transition-colors"
                    >
                      Editar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Barra de progreso kit faltante */}
          {!kitCompletoListo && !kitCompletoPendiente && kitCompleto.cantidad_recogida != null && (
            <div className="px-4 pb-3 flex items-center gap-2">
              <div className="flex-1 relative h-1.5 rounded-full overflow-hidden bg-[#F5C9C0]">
                <div
                  className="absolute top-0 left-0 h-full bg-[#B23A2A] rounded-full transition-all"
                  style={{ width: `${kitCompleto.cantidad_pedida > 0 ? Math.round((kitCompleto.cantidad_recogida / kitCompleto.cantidad_pedida) * 100) : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-[#7A7571] tabular-nums shrink-0">
                {kitCompleto.cantidad_recogida}/{kitCompleto.cantidad_pedida}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Divisor "y / o" si hay ambas secciones */}
      {kitCompleto && piezasSueltas && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#F0EFEC] border-y border-[#E8E5E2]">
          <div className="flex-1 h-px bg-[#D0CBC4]" />
          <span className="text-[10px] font-bold text-[#7A7571] uppercase tracking-wider">y / o</span>
          <div className="flex-1 h-px bg-[#D0CBC4]" />
        </div>
      )}

      {/* Sección: Piezas sueltas */}
      {piezasSueltas && (
        <div className="bg-[#F7F7F7]">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#E8E5E2]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F4ECDB] text-[#780e18] text-[10px] font-bold">
              <i className="ti ti-tool text-[10px]" />
              Piezas sueltas
            </span>
            <span className="text-[10px] text-[#7A7571]">Desarma kits para sacar piezas</span>
          </div>

          <div className="divide-y divide-[#E8E5E2]">
            {piezas.map(pieza => {
              const estado = getPiezaEstado(pieza)
              const recogida = parsePiezaRecogida(pieza.nota_incompleto)
              const pct = pieza.cantidad > 0 && recogida != null
                ? Math.round((recogida / pieza.cantidad) * 100)
                : 0
              const loadKey = `pieza-${pieza.id}`
              const isLoading = !!loadingPiezas[loadKey]

              return (
                <div key={pieza.id} className={clsx('px-4 py-3',
                  estado === 'listo' && 'bg-[#F0FAF5]',
                  estado === 'faltante' && 'bg-[#FDF1EE]'
                )}>
                  <div className="flex items-start gap-3">
                    <ProductThumb
                      src={productoImagenes[piezasSueltas.producto_id]}
                      nombre={piezasSueltas.producto_nombre}
                      size="sm"
                      onClick={() => onViewGallery(piezasSueltas.producto_id, piezasSueltas.producto_codigo, piezasSueltas.producto_nombre)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {pieza.codigo_pieza && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono font-bold text-[10px] bg-[#780e18] text-white shrink-0">
                            {pieza.codigo_pieza}
                          </span>
                        )}
                        <p className="text-sm font-bold text-[#2D2B2A] leading-snug">{pieza.nombre}</p>
                      </div>
                      <p className="text-[11px] text-[#7A7571] mt-0.5">
                        {pieza.cantidad} unidades pedidas · sale de kit{' '}
                        <span className="font-mono">{piezasSueltas.producto_codigo}</span>
                        <span className="text-[#4A4744] font-medium"> · {piezasSueltas.producto_nombre}</span>
                      </p>
                      {(piezasSueltas.producto_almacen || piezasSueltas.producto_estante || piezasSueltas.producto_fila || piezasSueltas.producto_columna) && (
                        <p className="text-[11px] text-[#7A7571] mt-0.5 flex items-center gap-0.5">
                          <i className="ti ti-map-pin text-[10px]" />
                          {piezasSueltas.producto_almacen}{piezasSueltas.producto_estante ? ` / ${piezasSueltas.producto_estante}` : ''}{piezasSueltas.producto_fila ? ` / ${piezasSueltas.producto_fila}` : ''}{piezasSueltas.producto_columna ? ` / ${piezasSueltas.producto_columna}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      {estado === 'listo' ? (
                        <div className="flex items-center gap-1 bg-[#B8DCCA] text-[#1E5C38] px-2 py-0.5 rounded-full">
                          <i className="ti ti-check text-[11px]" />
                          <span className="text-[10px] font-bold tabular-nums">{pieza.cantidad}/{pieza.cantidad}</span>
                        </div>
                      ) : estado === 'parcial' ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-1 bg-[#F5E0A8] text-[#7A5200] px-2 py-0.5 rounded-full">
                            <i className="ti ti-list text-[11px]" />
                            <span className="text-[10px] font-bold">Parcial</span>
                          </div>
                          {!isReadOnly && (
                            <button
                              onClick={() => onFaltantePieza(pieza.item_id ?? piezasSueltas.id, pieza)}
                              className="text-[10px] font-bold text-[#B47A1F] hover:text-[#7A5200] underline underline-offset-2 transition-colors"
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      ) : estado === 'faltante' ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-1 bg-[#F5C9C0] text-[#8A1E12] px-2 py-0.5 rounded-full">
                            <i className="ti ti-x text-[11px]" />
                            <span className="text-[10px] font-bold tabular-nums">0/{pieza.cantidad}</span>
                          </div>
                          {!isReadOnly && (
                            <button
                              onClick={() => onFaltantePieza(pieza.item_id ?? piezasSueltas.id, pieza)}
                              className="text-[10px] font-bold text-[#B47A1F] hover:text-[#7A5200] underline underline-offset-2 transition-colors"
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      ) : !isReadOnly ? (
                        <div className="flex flex-col gap-1.5 items-end">
                          <button
                            onClick={() => onListoPieza(pieza.item_id ?? piezasSueltas.id, pieza)}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#3F7A52] text-white hover:bg-[#1E5C38] disabled:opacity-50 transition-colors"
                          >
                            {isLoading ? '…' : 'Listo'}
                          </button>
                          <button
                            onClick={() => onFaltantePieza(pieza.item_id ?? piezasSueltas.id, pieza)}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#B23A2A] text-white hover:bg-[#8A1E12] disabled:opacity-50 transition-colors"
                          >
                            Faltante
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Barra de progreso parcial / faltante */}
                  {(estado === 'parcial' || estado === 'faltante') && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className={clsx('flex-1 relative h-1.5 rounded-full overflow-hidden', estado === 'faltante' ? 'bg-[#F5C9C0]' : 'bg-[#F5E0A8]')}>
                        <div
                          className={clsx('absolute top-0 left-0 h-full rounded-full transition-all', estado === 'faltante' ? 'bg-[#B23A2A]' : 'bg-[#B47A1F]')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#7A7571] tabular-nums shrink-0">
                        {estado === 'faltante' ? 0 : (recogida ?? 0)}/{pieza.cantidad}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Warning si hay piezas parciales */}
          {piezasParcialesNombre.length > 0 && (
            <div className="mx-3 mb-3 mt-1 rounded-xl bg-[#F5E0A8] border border-[#B47A1F]/30 px-3 py-2">
              <p className="text-[11px] text-[#7A5200] font-medium">
                {piezasParcialesNombre.length === 1
                  ? `Si es parcial, la pieza "${piezasParcialesNombre[0].nombre}" tiene cantidad limitada. El cajero deberá acordar el precio con el cliente.`
                  : `${piezasParcialesNombre.length} piezas parciales. El cajero deberá acordar los precios con el cliente.`
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Resumen piezas */}
      {piezasSueltas && piezas.length > 0 && (
        <div className="px-4 py-2.5 bg-[#F0EFEC] border-t border-[#E8E5E2] flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-[#3F7A52] font-bold">{piezasListasCount} listo</span>
            {piezasParcialCount > 0 && <span className="text-[#B47A1F] font-bold">{piezasParcialCount} parcial</span>}
            {piezasPendienteCount > 0 && <span className="text-[#4A4744]">{piezasPendienteCount} pendiente</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function PickingView({
  orden,
  onMarcarListo,
  onVolver,
  onMarcarListoIndividual,
  onMarcarFaltanteIndividual,
  onConfirmarPieza,
  onFaltantePiezaIndividual,
  onListoPiezaIndividual,
  productoImagenes,
  onViewGallery,
}: {
  orden: OrdenVenta
  onMarcarListo: () => void
  onVolver: () => void
  onMarcarListoIndividual: (itemId: string) => Promise<void>
  onMarcarFaltanteIndividual: (itemId: string, cantidadEncontrada: number) => Promise<void>
  onConfirmarPieza: (itemId: string, pieza: PiezaOrden) => Promise<void>
  onFaltantePiezaIndividual: (itemId: string, pieza: PiezaOrden, cantidadEncontrada: number) => Promise<void>
  onListoPiezaIndividual: (itemId: string, pieza: PiezaOrden) => Promise<void>
  productoImagenes: Record<string, string>
  onViewGallery: (producto_id: string, codigo: string, nombre: string | null | undefined) => void
}) {
  const [listoLoading, setListoLoading] = useState<Record<string, boolean>>({})
  const [faltanteModal, setFaltanteModal] = useState<{ itemId: string; cantidadPedida: number } | null>(null)
  const [cantidadEncontrada, setCantidadEncontrada] = useState(0)
  const [faltanteConfirmLoading, setFaltanteConfirmLoading] = useState(false)
  const [piezaFaltanteModal, setPiezaFaltanteModal] = useState<{ itemId: string; pieza: PiezaOrden } | null>(null)
  const [piezaCantidadEncontrada, setPiezaCantidadEncontrada] = useState(0)
  const [piezaFaltanteConfirmLoading, setPiezaFaltanteConfirmLoading] = useState(false)

  const handleListoIndividual = async (itemId: string) => {
    setListoLoading(p => ({ ...p, [itemId]: true }))
    await onMarcarListoIndividual(itemId)
    setListoLoading(p => ({ ...p, [itemId]: false }))
  }

  const abrirFaltanteModal = (itemId: string, cantidadPedida: number, cantidadPrevia?: number) => {
    setCantidadEncontrada(cantidadPrevia ?? 0)
    setFaltanteModal({ itemId, cantidadPedida })
  }

  const confirmarFaltante = async () => {
    if (!faltanteModal) return
    setFaltanteConfirmLoading(true)
    if (cantidadEncontrada >= faltanteModal.cantidadPedida) {
      await onMarcarListoIndividual(faltanteModal.itemId)
    } else {
      await onMarcarFaltanteIndividual(faltanteModal.itemId, cantidadEncontrada)
    }
    setFaltanteConfirmLoading(false)
    setFaltanteModal(null)
  }

  const confirmarPiezaFaltante = async () => {
    if (!piezaFaltanteModal) return
    setPiezaFaltanteConfirmLoading(true)
    await onFaltantePiezaIndividual(piezaFaltanteModal.itemId, piezaFaltanteModal.pieza, piezaCantidadEncontrada)
    setPiezaFaltanteConfirmLoading(false)
    setPiezaFaltanteModal(null)
  }

  const [loadingPiezas, setLoadingPiezas] = useState<Record<string, boolean>>({})

  const kitGroups = useMemo(() => {
    const groups = new Map<string, { kitCompleto?: ItemOrden; piezasSueltas?: ItemOrden }>()
    orden.items.forEach(item => {
      if (!item.es_kit && !item.es_parcial) return
      const key = item.producto_id
      if (!groups.has(key)) groups.set(key, {})
      const g = groups.get(key)!
      if (item.es_parcial) {
        if (!g.piezasSueltas) {
          g.piezasSueltas = {
            ...item,
            piezas_orden: item.piezas_orden?.map(p => ({ ...p, item_id: item.id })),
          }
        } else {
          g.piezasSueltas = {
            ...g.piezasSueltas,
            piezas_orden: [
              ...(g.piezasSueltas.piezas_orden ?? []),
              ...(item.piezas_orden ?? []).map(p => ({ ...p, item_id: item.id })),
            ],
          }
        }
      } else {
        g.kitCompleto = item
      }
    })
    return groups
  }, [orden.items])

  const itemsNormalesAll = orden.items.filter(i => !i.es_kit && !i.es_parcial)

  const isReadOnly = orden.estado === 'listo_para_escaneo'
  const isConFaltantes = orden.estado === 'con_faltantes'

  const todosConEstado = orden.items.every(i => i.estado !== 'pendiente')
  const pendienteCount = orden.items.filter(i => i.estado === 'pendiente').length

  const itemsNuevos = isConFaltantes ? itemsNormalesAll.filter(i => i.estado === 'pendiente') : []
  const itemsFaltantesReportados = isConFaltantes ? itemsNormalesAll.filter(i => i.estado === 'faltante') : []
  const itemsNormales = isConFaltantes ? [] : itemsNormalesAll

  return (
    <div className="flex flex-col h-full">
      {/* Modal: ¿Cuántas encontraste? */}
      {faltanteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(45,43,42,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4 border border-[#E8E5E2]">
            <p className="text-base font-bold text-[#2D2B2A] text-center">¿Cuántas encontraste?</p>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCantidadEncontrada(v => Math.max(0, v - 1))}
                  className="h-9 w-9 rounded-xl bg-[#F0EFEC] text-[#4A4744] text-lg font-bold hover:bg-[#E8E5E2] transition-colors flex items-center justify-center"
                >
                  <i className="ti ti-minus text-[14px]" />
                </button>
                <span className="text-4xl font-black text-[#2D2B2A] w-12 text-center tabular-nums">{cantidadEncontrada}</span>
                <button
                  onClick={() => setCantidadEncontrada(v => Math.min(faltanteModal.cantidadPedida, v + 1))}
                  className="h-9 w-9 rounded-xl bg-[#F0EFEC] text-[#4A4744] text-lg font-bold hover:bg-[#E8E5E2] transition-colors flex items-center justify-center"
                >
                  <i className="ti ti-plus text-[14px]" />
                </button>
              </div>
              <p className="text-xs text-[#7A7571]">de {faltanteModal.cantidadPedida} pedidas</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <i className="ti ti-arrow-right text-[#7A7571] text-[14px]" />
              {cantidadEncontrada >= faltanteModal.cantidadPedida
                ? <span className="font-bold text-[#3F7A52]">Todos encontrados — marcar como Listo</span>
                : <span className="font-bold text-[#B23A2A]">{faltanteModal.cantidadPedida - cantidadEncontrada} faltante{faltanteModal.cantidadPedida - cantidadEncontrada !== 1 ? 's' : ''}</span>
              }
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFaltanteModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#4A4744] hover:bg-[#F0EFEC] border border-[#E8E5E2] transition-colors"
              >Cancelar</button>
              <button
                onClick={confirmarFaltante}
                disabled={faltanteConfirmLoading}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors',
                  cantidadEncontrada >= faltanteModal.cantidadPedida
                    ? 'bg-[#3F7A52] hover:bg-[#1E5C38]'
                    : 'bg-[#B23A2A] hover:bg-[#8A1E12]'
                )}
              >{faltanteConfirmLoading ? '…' : cantidadEncontrada >= faltanteModal.cantidadPedida ? 'Listo' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal pieza: ¿Cuántas encontraste? */}
      {piezaFaltanteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(45,43,42,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4 border border-[#E8E5E2]">
            <div className="text-center">
              <p className="text-base font-bold text-[#2D2B2A]">¿Cuántas encontraste?</p>
              <p className="text-xs text-[#7A7571] mt-0.5 truncate">{piezaFaltanteModal.pieza.nombre}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPiezaCantidadEncontrada(v => Math.max(0, v - 1))}
                  className="h-9 w-9 rounded-xl bg-[#F0EFEC] text-[#4A4744] text-lg font-bold hover:bg-[#E8E5E2] transition-colors flex items-center justify-center"
                >
                  <i className="ti ti-minus text-[14px]" />
                </button>
                <span className="text-4xl font-black text-[#2D2B2A] w-12 text-center tabular-nums">{piezaCantidadEncontrada}</span>
                <button
                  onClick={() => setPiezaCantidadEncontrada(v => Math.min(piezaFaltanteModal.pieza.cantidad, v + 1))}
                  className="h-9 w-9 rounded-xl bg-[#F0EFEC] text-[#4A4744] text-lg font-bold hover:bg-[#E8E5E2] transition-colors flex items-center justify-center"
                >
                  <i className="ti ti-plus text-[14px]" />
                </button>
              </div>
              <p className="text-xs text-[#7A7571]">de {piezaFaltanteModal.pieza.cantidad} pedidas</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <i className="ti ti-arrow-right text-[#7A7571] text-[14px]" />
              {piezaCantidadEncontrada >= piezaFaltanteModal.pieza.cantidad
                ? <span className="font-bold text-[#3F7A52]">Todas encontradas — marcar como Listo</span>
                : <span className="font-bold text-[#B23A2A]">{piezaFaltanteModal.pieza.cantidad - piezaCantidadEncontrada} faltante{piezaFaltanteModal.pieza.cantidad - piezaCantidadEncontrada !== 1 ? 's' : ''}</span>
              }
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPiezaFaltanteModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#4A4744] hover:bg-[#F0EFEC] border border-[#E8E5E2] transition-colors"
              >Cancelar</button>
              <button
                onClick={confirmarPiezaFaltante}
                disabled={piezaFaltanteConfirmLoading}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors',
                  piezaCantidadEncontrada >= piezaFaltanteModal.pieza.cantidad
                    ? 'bg-[#3F7A52] hover:bg-[#1E5C38]'
                    : 'bg-[#B23A2A] hover:bg-[#8A1E12]'
                )}
              >{piezaFaltanteConfirmLoading ? '…' : piezaCantidadEncontrada >= piezaFaltanteModal.pieza.cantidad ? 'Listo' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-[#F7F7F7]/90 backdrop-blur-md border-b border-[#E8E5E2] px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onVolver}
            className="p-1.5 rounded-lg text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#E8E5E2] transition-colors shrink-0"
          >
            <i className="ti ti-chevron-left text-[18px]" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-black text-[#2D2B2A]">{orden.numero}</h2>
              <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold',
                STATUS_CONFIG[orden.estado].bg, STATUS_CONFIG[orden.estado].text)}>
                <span className={clsx('h-1.5 w-1.5 rounded-full shrink-0', STATUS_CONFIG[orden.estado].dot)} />
                {STATUS_CONFIG[orden.estado].label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] text-[#7A7571]">{fmtTimeSince(orden.creado_en)}</span>
              <span className="text-[10px] text-[#D0CBC4]">·</span>
              <span className="text-[10px] text-[#7A7571]">{orden.items.length} línea{orden.items.length !== 1 ? 's' : ''}</span>
              {kitGroups.size > 0 && (
                <>
                  <span className="text-[10px] text-[#D0CBC4]">·</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#F4ECDB] text-[#780e18] text-[10px] font-bold">
                    <i className="ti ti-stack text-[10px]" />
                    {[...kitGroups.values()].filter(g => g.kitCompleto).length} kit
                  </span>
                </>
              )}
              {[...kitGroups.values()].some(g => g.piezasSueltas) && (
                <>
                  <span className="text-[10px] text-[#D0CBC4]">·</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[10px] font-bold">
                    <i className="ti ti-tool text-[10px]" />
                    {[...kitGroups.values()].filter(g => g.piezasSueltas).map(g => g.piezasSueltas!.piezas_orden?.length ?? 0).reduce((a, b) => a + b, 0)} piezas sueltas
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {orden.nota && (
          <p className="mt-2 text-xs text-[#7A5200] italic bg-[#F5E0A8] px-2.5 py-1.5 rounded-lg border border-[#B47A1F]/30 flex items-start gap-1.5 mx-4 mb-1">
            <i className="ti ti-note text-[12px] shrink-0 mt-0.5" />
            {orden.nota}
          </p>
        )}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-3 pt-2 bg-[#F7F7F7]">
        <div className="space-y-3 pb-2">

          {/* Modo con_faltantes: dos secciones */}
          {isConFaltantes && (
            <>
              {itemsNuevos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[10px] font-black text-[#B47A1F] uppercase tracking-wide">
                      Productos nuevos a buscar ({itemsNuevos.length})
                    </span>
                    <div className="flex-1 h-px bg-[#F5E0A8]" />
                  </div>
                  <div className="space-y-2">
                    {itemsNuevos.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        showListoBtn
                        loading={!!listoLoading[item.id]}
                        onListo={() => handleListoIndividual(item.id)}
                        onFaltante={() => abrirFaltanteModal(item.id, item.cantidad_pedida)}
                        onEditCantidad={() => abrirFaltanteModal(item.id, item.cantidad_pedida, item.cantidad_recogida)}
                        imagen={productoImagenes[item.producto_id]}
                        onViewGallery={onViewGallery}
                      />
                    ))}
                  </div>
                </div>
              )}

              {itemsFaltantesReportados.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[10px] font-black text-[#B23A2A] uppercase tracking-wide">
                      Faltantes que ya reportaste ({itemsFaltantesReportados.length})
                    </span>
                    <div className="flex-1 h-px bg-[#F5C9C0]" />
                  </div>
                  <div className="space-y-2">
                    {itemsFaltantesReportados.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        showListoBtn={false}
                        loading={false}
                        onListo={() => {}}
                        onEditCantidad={() => abrirFaltanteModal(item.id, item.cantidad_pedida, item.cantidad_recogida)}
                        imagen={productoImagenes[item.producto_id]}
                        onViewGallery={onViewGallery}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Kits con piezas pendientes en con_faltantes */}
              {kitGroups.size > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[10px] font-black text-[#1D4ED8] uppercase tracking-wide">
                      Kits ({kitGroups.size})
                    </span>
                    <div className="flex-1 h-px bg-[#BFDBFE]" />
                  </div>
                  <div className="space-y-2">
                    {[...kitGroups.entries()].map(([kitProductoId, grupo]) => (
                      <KitGroupCard
                        key={kitProductoId}
                        kitCompleto={grupo.kitCompleto}
                        piezasSueltas={grupo.piezasSueltas}
                        ordenId={orden.id}
                        isReadOnly={false}
                        loadingPiezas={loadingPiezas}
                        onMarcarListoKit={(itemId) => handleListoIndividual(itemId)}
                        onFaltanteKit={(itemId, cantidadPedida) => abrirFaltanteModal(itemId, cantidadPedida)}
                        onConfirmarPieza={async (itemId, pieza) => {
                          const key = `pieza-${pieza.id}`
                          setLoadingPiezas(p => ({ ...p, [key]: true }))
                          await onConfirmarPieza(itemId, pieza)
                          setLoadingPiezas(p => ({ ...p, [key]: false }))
                        }}
                        onFaltantePieza={(itemId, pieza) => {
                          setPiezaCantidadEncontrada(parsePiezaRecogida(pieza.nota_incompleto) ?? 0)
                          setPiezaFaltanteModal({ itemId, pieza })
                        }}
                        onListoPieza={async (itemId, pieza) => {
                          const key = `pieza-${pieza.id}`
                          setLoadingPiezas(p => ({ ...p, [key]: true }))
                          await onListoPiezaIndividual(itemId, pieza)
                          setLoadingPiezas(p => ({ ...p, [key]: false }))
                        }}
                        onEditKit={(itemId, cantidadPedida, cantidadRecogida) =>
                          abrirFaltanteModal(itemId, cantidadPedida, cantidadRecogida)
                        }
                        productoImagenes={productoImagenes}
                        onViewGallery={onViewGallery}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Modo normal (en_preparacion) o read-only (listo_para_escaneo) */}
          {!isConFaltantes && (
            <>
              {itemsNormales.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  showListoBtn={!isReadOnly}
                  loading={!!listoLoading[item.id]}
                  onListo={() => handleListoIndividual(item.id)}
                  onFaltante={() => abrirFaltanteModal(item.id, item.cantidad_pedida)}
                  onEditCantidad={() => abrirFaltanteModal(item.id, item.cantidad_pedida, item.cantidad_recogida)}
                  imagen={productoImagenes[item.producto_id]}
                  onViewGallery={onViewGallery}
                />
              ))}

              {/* Grupos de kits */}
              {[...kitGroups.entries()].map(([kitProductoId, grupo]) => (
                <KitGroupCard
                  key={kitProductoId}
                  kitCompleto={grupo.kitCompleto}
                  piezasSueltas={grupo.piezasSueltas}
                  ordenId={orden.id}
                  isReadOnly={isReadOnly}
                  loadingPiezas={loadingPiezas}
                  onMarcarListoKit={(itemId) => handleListoIndividual(itemId)}
                  onFaltanteKit={(itemId, cantidadPedida) => abrirFaltanteModal(itemId, cantidadPedida)}
                  onConfirmarPieza={async (itemId, pieza) => {
                    const key = `pieza-${pieza.id}`
                    setLoadingPiezas(p => ({ ...p, [key]: true }))
                    await onConfirmarPieza(itemId, pieza)
                    setLoadingPiezas(p => ({ ...p, [key]: false }))
                  }}
                  onFaltantePieza={(itemId, pieza) => {
                    setPiezaCantidadEncontrada(parsePiezaRecogida(pieza.nota_incompleto) ?? 0)
                    setPiezaFaltanteModal({ itemId, pieza })
                  }}
                  onListoPieza={async (itemId, pieza) => {
                    const key = `pieza-${pieza.id}`
                    setLoadingPiezas(p => ({ ...p, [key]: true }))
                    await onListoPiezaIndividual(itemId, pieza)
                    setLoadingPiezas(p => ({ ...p, [key]: false }))
                  }}
                  onEditKit={(itemId, cantidadPedida, cantidadRecogida) =>
                    abrirFaltanteModal(itemId, cantidadPedida, cantidadRecogida)
                  }
                  productoImagenes={productoImagenes}
                  onViewGallery={onViewGallery}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#E8E5E2] bg-white px-4 py-3 shrink-0">
        {isReadOnly ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <div className="h-2 w-2 rounded-full bg-[#7C3AED] animate-bounce" />
            <span className="text-xs text-[#5B21B6] font-bold">Orden enviada a escaneo — solo lectura</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className={clsx('h-2 w-2 rounded-full', todosConEstado ? 'bg-[#3F7A52]' : 'bg-[#B47A1F] animate-pulse')} />
              <span className="text-xs text-[#4A4744] font-medium">
                {todosConEstado
                  ? 'Todos los productos marcados'
                  : `${pendienteCount} producto${pendienteCount !== 1 ? 's' : ''} por marcar`}
              </span>
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={onMarcarListo}
                disabled={!todosConEstado}
                className={clsx(
                  'px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
                  todosConEstado
                    ? 'bg-[#3F7A52] text-white hover:bg-[#1E5C38] active:bg-[#16472E]'
                    : 'bg-[#F0EFEC] text-[#7A7571] cursor-not-allowed'
                )}
              >
                Marcar como lista
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function AlmacenPage() {
  const { user, isTokenReady } = useAuth()
  const { ordenes, updateOrden, setOrdenes, removeItemFromOrden, updateItemQtyInOrden, markItemListoEnOrden } = useVentasStore()
  const { playBeep, playAlertSequence } = useSoundAlert()
  useVentasAlerts()

  const [tab, setTab] = useState<TabFiltro>('todos')
  const [pickingOrdenId, setPickingOrdenId] = useState<string | null>(null)
  const [faltantesOrden, setFaltantesOrden] = useState<OrdenVenta | null>(null)
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const [productoImagenes, setProductoImagenes] = useState<Record<string, string>>({})
  const [galleryProducto, setGalleryProducto] = useState<Producto | null>(null)
  const previousPendientesRef = useRef<Set<string>>(new Set())

  const loadOrdenes = useCallback(async () => {
    try {
      const [dataPendientes, dataMias] = await Promise.all([
        gql<{ ordenesPendientes: { nodes: OrdenVentaAPI[] } }>(ORDENES_PENDIENTES_QUERY),
        gql<{ misOrdenesAlmacen: { nodes: OrdenVentaAPI[] } }>(MIS_ORDENES_ALMACEN_QUERY),
      ])
      const pendientes = (dataPendientes.ordenesPendientes?.nodes ?? []).map(backendToOrdenVenta)
      const mias = (dataMias.misOrdenesAlmacen?.nodes ?? [])
        .map(backendToOrdenVenta)
        .filter(o => o.estado !== 'completada' && o.estado !== 'cancelada')
      const merged = [...mias]
      pendientes.forEach(p => {
        if (!merged.some(m => m.id === p.id)) merged.push(p)
      })
      setOrdenes(merged)
    } catch {
      notify.error('Error cargando órdenes')
    }
  }, [setOrdenes])

  useEffect(() => {
    if (!isTokenReady) return
    loadOrdenes()
    const poll = setInterval(loadOrdenes, 15_000)
    return () => clearInterval(poll)
  }, [isTokenReady, loadOrdenes])

  const { isConnected, joinGrupo } = useVentasHub({
    onNuevaOrden: () => loadOrdenes(),
    onOrdenAceptada: () => loadOrdenes(),
    onOrdenLista: () => loadOrdenes(),
    onOrdenCompletada: (p) => {
      updateOrden(String(p.id), { estado: 'completada' })
      if (pickingOrdenId === String(p.id)) setPickingOrdenId(null)
    },
    onOrdenCancelada: (p) => {
      const oid = String(p.id)
      updateOrden(oid, { estado: 'cancelada' })
      if (pickingOrdenId === oid) {
        setPickingOrdenId(null)
        notify.warning('La orden fue cancelada')
      }
    },
    onNuevoItemAgregado: (p) => {
      setTimeout(() => loadOrdenes(), 400)
      playAlertSequence()
      notify.warning(`Producto nuevo en orden #${p.ordenId}`, { description: `${p.productoNombre} ×${p.cantidad} — ve a buscarlo`, duration: 10000 })
    },
    onOrdenConFaltantes: () => {
      setTimeout(() => loadOrdenes(), 400)
    },
    onItemEliminado: (p) => removeItemFromOrden(String(p.ordenId), String(p.itemId)),
    onCantidadItemActualizada: (p) => {
      updateItemQtyInOrden(String(p.ordenId), String(p.itemId), p.nuevaCantidad)
      playAlertSequence()
      notify.warning(`Cantidad actualizada en orden #${p.ordenId}`, {
        description: `Nueva cantidad: ×${p.nuevaCantidad} — revisa el producto`,
        duration: 8000,
      })
    },
  }, isTokenReady, ['Almaceneros'])

  useEffect(() => {
    if (pickingOrdenId) {
      joinGrupo(`orden-${pickingOrdenId}`)
    }
  }, [pickingOrdenId, joinGrupo])

  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const pendientes = ordenes.filter(o => o.estado === 'pendiente_almacenero')
    const currentPendientes = new Set(pendientes.map(o => o.id))

    const newOnes = [...currentPendientes].filter(id => !previousPendientesRef.current.has(id))
    if (newOnes.length > 0) {
      playBeep({ frequency: 1200, duration: 100 })
      setTimeout(() => playBeep({ frequency: 1400, duration: 150 }), 120)
      setNewOrderIds(prev => new Set([...prev, ...newOnes]))
      setTimeout(() => {
        setNewOrderIds(prev => {
          const next = new Set(prev)
          newOnes.forEach(id => next.delete(id))
          return next
        })
      }, 3000)
    }

    previousPendientesRef.current = currentPendientes
  }, [ordenes, playBeep])

  // Cache de imágenes principales: cuando cambian las órdenes visibles
  // (en la lista o en el picking), batch-fetcheamos `imagenPrincipal.url`
  // para todos los productoIds únicos que aún no tengamos en cache. Esto
  // evita N+1 en la lista y mantiene la galería funcionando sin hidratar
  // todo el `Producto`.
  useEffect(() => {
    const ids = Array.from(new Set(ordenes.flatMap(o => o.items.map(i => i.producto_id))))
      .map(id => Number(id))
      .filter(id => Number.isFinite(id) && !productoImagenes[id])
    if (ids.length === 0) return
    let cancelled = false
    gql<{
      productos: { nodes: Array<{ id: number; imagenPrincipal: { id: number; url: string } | null }> }
    }>(PRODUCTOS_IMAGENES_BATCH_QUERY, { ids })
      .then(res => {
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const n of res.productos.nodes) {
          if (n.imagenPrincipal?.url) map[String(n.id)] = n.imagenPrincipal.url
        }
        if (Object.keys(map).length) {
          setProductoImagenes(prev => ({ ...prev, ...map }))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [ordenes, productoImagenes])

  const activeOrdenes = useMemo(
    () => ordenes.filter(o => o.estado !== 'completada' && o.estado !== 'cancelada'),
    [ordenes]
  )

  const filteredOrdenes = useMemo(() => {
    const base = tab === 'todos' ? activeOrdenes : activeOrdenes.filter(o => o.estado === tab)
    return [...base].sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())
  }, [activeOrdenes, tab])

  const counts = useMemo(() => ({
    todos:                 activeOrdenes.length,
    pendiente_almacenero:  activeOrdenes.filter(o => o.estado === 'pendiente_almacenero').length,
    en_preparacion:       activeOrdenes.filter(o => o.estado === 'en_preparacion').length,
    listo_para_escaneo:    activeOrdenes.filter(o => o.estado === 'listo_para_escaneo').length,
  }), [activeOrdenes])

  const handleTomar = async (orden: OrdenVenta) => {
    try {
      if (orden.estado === 'pendiente_almacenero') {
        await api.post(`/OrdenVenta/${orden.id}/Aceptar`, null)
        await loadOrdenes()
        playBeep({ frequency: 1000, duration: 80 })
        notify.success(`Orden ${orden.numero} tomada`)
      }
      setPickingOrdenId(orden.id)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al tomar orden')
    }
  }

  const handleMarcarListo = async () => {
    if (!pickingOrdenId) return
    try {
      await api.post(`/OrdenVenta/${pickingOrdenId}/Lista`, null)
      await loadOrdenes()
      playAlertSequence()
      setPickingOrdenId(null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al marcar como lista')
    }
  }

  const handleFaltantesConfirm = async (items: ItemFaltante[], piezasFaltantes: PiezaFaltante[]) => {
    if (!faltantesOrden) return
    try {
      for (const { id: itemId, cantidadEncontrada } of items) {
        await api.post(`/OrdenVenta/${faltantesOrden.id}/Items/${itemId}/Incompleto`, { CantidadEncontrada: cantidadEncontrada })
      }
      for (const { itemId, piezaId } of piezasFaltantes) {
        await api.post(`/OrdenVenta/${faltantesOrden.id}/Items/${itemId}/Piezas/${piezaId}/Incompleto`, {})
      }
      const totalReportado = items.length + piezasFaltantes.length
      const totalDisponible = faltantesOrden.items
        .filter(i => i.estado !== 'faltante')
        .reduce((sum, i) => sum + (i.es_parcial && i.piezas_orden?.length ? i.piezas_orden.length : 1), 0)
      const todosReportados = totalReportado >= totalDisponible
      if (todosReportados) {
        await api.post(`/OrdenVenta/${faltantesOrden.id}/Lista`, null)
        await loadOrdenes()
        setFaltantesOrden(null)
        setPickingOrdenId(null)
        notify.warning('Todos los productos son faltantes — orden enviada al cajero')
      } else {
        await loadOrdenes()
        setFaltantesOrden(null)
        notify.warning(`${totalReportado} faltante(s) reportado(s)`)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al reportar faltantes')
    }
  }

  const handleRevertirFaltante = async (itemId: string, piezaId?: number) => {
    if (!faltantesOrden) return
    const ordenId = faltantesOrden.id
    try {
      if (piezaId != null) {
        await api.delete(`/OrdenVenta/${ordenId}/Items/${itemId}/Piezas/${piezaId}/Incompleto`)
      } else {
        await api.delete(`/OrdenVenta/${ordenId}/Items/${itemId}/Incompleto`)
      }
      await loadOrdenes()
      const actualizada = useVentasStore.getState().ordenes.find(o => o.id === ordenId)
      if (actualizada) setFaltantesOrden(actualizada)
      notify.success('Faltante deshecho')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al deshacer faltante')
    }
  }

  const handleMarcarListoIndividual = async (itemId: string) => {
    if (!pickingOrdenId) return
    const currentOrden = useVentasStore.getState().ordenes.find(o => o.id === pickingOrdenId)
    try {
      const currentItem = currentOrden?.items.find(i => i.id === itemId)
      if (currentItem?.es_parcial && currentItem.piezas_orden?.length) {
        for (const pieza of currentItem.piezas_orden) {
          if (!pieza.listo_almacenero) {
            await api.post(`/OrdenVenta/${pickingOrdenId}/Items/${itemId}/Piezas/${pieza.id}/ListoAlmacenero`, null)
          }
        }
      }
      if (currentItem?.estado === 'faltante') {
        await api.delete(`/OrdenVenta/${pickingOrdenId}/Items/${itemId}/Incompleto`)
      }
      await api.post(`/OrdenVenta/${pickingOrdenId}/Items/${itemId}/MarcarListoIndividual`, null)
      markItemListoEnOrden(pickingOrdenId, itemId)
      notify.success('Producto marcado como listo — cajero notificado')

      // Refrescar la lista para obtener el estado REAL de la orden desde el backend.
      // El backend puede haber promovido automáticamente la orden a 'lista' cuando
      // todos los items quedaron resueltos; en ese caso NO debemos llamar a /Lista.
      await loadOrdenes()
      const updatedOrden = useVentasStore.getState().ordenes.find(o => o.id === pickingOrdenId)

      // Si la orden ya pasó a 'listo_para_escaneo' por promoción automática del backend, salir.
      if (updatedOrden?.estado === 'listo_para_escaneo') {
        setPickingOrdenId(null)
        notify.success('Todos los productos listos — orden de vuelta en escaneo')
        return
      }

      // Si la orden quedó en 'con_faltantes' (no promovida) y no quedan pendientes,
      // intentar promoverla manualmente. Si el backend ya la promovió entre el
      // loadOrdenes y este POST, ignorar el error (la orden ya está como debe estar).
      if (updatedOrden?.estado === 'con_faltantes') {
        const remainingPendientes = updatedOrden.items.filter(i => i.estado === 'pendiente').length
        if (remainingPendientes === 0) {
          try {
            await api.post(`/OrdenVenta/${pickingOrdenId}/Lista`, null)
          } catch {
            // Race condition: el backend pudo haber promovido la orden entre el
            // loadOrdenes y este POST. Ignorar el error.
          }
          updateOrden(pickingOrdenId, { estado: 'listo_para_escaneo' })
          setPickingOrdenId(null)
          notify.success('Todos los productos listos — orden de vuelta en escaneo')
        }
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al marcar como listo')
    }
  }

  const handleConfirmarPieza = async (itemId: string, pieza: PiezaOrden) => {
    if (!pickingOrdenId) return
    if (!pieza.precio_unitario || pieza.precio_unitario <= 0) {
      notify.error(`Pieza "${pieza.nombre}" sin precio. Solicite al operador que la confirme.`)
      return
    }
    try {
      await api.post(`/OrdenVenta/${pickingOrdenId}/Items/${itemId}/Piezas/${pieza.id}/Confirmar`, {
        PrecioUnitario: pieza.precio_unitario,
      })
      await loadOrdenes()
      notify.success('Pieza confirmada')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al confirmar pieza')
    }
  }

  const handleMarcarFaltanteIndividual = async (itemId: string, cantidadEncontrada: number) => {
    if (!pickingOrdenId) return
    try {
      await api.post(`/OrdenVenta/${pickingOrdenId}/Items/${itemId}/Incompleto`, { CantidadEncontrada: cantidadEncontrada })
      await loadOrdenes()
      notify.warning(cantidadEncontrada === 0 ? 'Producto marcado como faltante' : `Parcial: ${cantidadEncontrada} encontrado(s)`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al marcar faltante')
    }
  }

  const handleListoPiezaIndividual = async (itemId: string, pieza: PiezaOrden) => {
    if (!pickingOrdenId) return
    try {
      await api.post(`/OrdenVenta/${pickingOrdenId}/Items/${itemId}/Piezas/${pieza.id}/ListoAlmacenero`, null)
      await loadOrdenes()
      notify.success(`Pieza "${pieza.nombre}" marcada como lista`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al marcar pieza como lista')
    }
  }

  const handleFaltantePiezaIndividual = async (itemId: string, pieza: PiezaOrden, cantidadEncontrada: number) => {
    if (!pickingOrdenId) return
    try {
      if (cantidadEncontrada >= pieza.cantidad) {
        if (pieza.nota_incompleto) {
          await api.delete(`/OrdenVenta/${pickingOrdenId}/Items/${itemId}/Piezas/${pieza.id}/Incompleto`)
        }
        if (!pieza.listo_almacenero) {
          await api.post(`/OrdenVenta/${pickingOrdenId}/Items/${itemId}/Piezas/${pieza.id}/ListoAlmacenero`, null)
        }
        await loadOrdenes()
        const updatedOrden = useVentasStore.getState().ordenes.find(o => o.id === pickingOrdenId)
        const updatedItem = updatedOrden?.items.find(i => i.id === itemId)
        const todasListas = updatedItem?.piezas_orden?.every(p => p.listo_almacenero || p.confirmado) ?? false
        if (todasListas) {
          await api.post(`/OrdenVenta/${pickingOrdenId}/Items/${itemId}/MarcarListoIndividual`, null)
          markItemListoEnOrden(pickingOrdenId, itemId)
          await loadOrdenes()
          notify.success('Todas las piezas encontradas — ítem marcado como listo')
        } else {
          notify.success(`Pieza "${pieza.nombre}" encontrada`)
        }
      } else {
        const nota = cantidadEncontrada > 0
          ? `Encontró ${cantidadEncontrada} de ${pieza.cantidad}`
          : 'Faltante'
        await api.post(`/OrdenVenta/${pickingOrdenId}/Items/${itemId}/Piezas/${pieza.id}/Incompleto`, { Nota: nota })
        await loadOrdenes()
        notify.warning(cantidadEncontrada === 0
          ? `Pieza "${pieza.nombre}" marcada como faltante`
          : `Pieza "${pieza.nombre}" parcial: ${cantidadEncontrada} encontrada(s)`)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al marcar pieza')
    }
  }

  const pickingOrden = pickingOrdenId ? ordenes.find(o => o.id === pickingOrdenId) : null

  const TABS: { key: TabFiltro; label: string }[] = [
    { key: 'todos',                label: 'Todos' },
    { key: 'pendiente_almacenero', label: 'Pendiente' },
    { key: 'en_preparacion',       label: 'En preparación' },
    { key: 'listo_para_escaneo',   label: 'Para escanear' },
  ]

  return (
    <MainLayout>
      <div className="flex flex-col h-screen overflow-hidden bg-[#F7F7F7]">
        {pickingOrden ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <PickingView
              orden={pickingOrden}
              onMarcarListo={handleMarcarListo}
              onVolver={() => setPickingOrdenId(null)}
              onMarcarListoIndividual={handleMarcarListoIndividual}
              onMarcarFaltanteIndividual={handleMarcarFaltanteIndividual}
              onConfirmarPieza={handleConfirmarPieza}
              onFaltantePiezaIndividual={handleFaltantePiezaIndividual}
              onListoPiezaIndividual={handleListoPiezaIndividual}
              productoImagenes={productoImagenes}
              onViewGallery={(producto_id, codigo, nombre) => setGalleryProducto({
                id: producto_id,
                codigo_universal: codigo,
                nombre: nombre ?? '',
              } as Producto)}
            />
          </div>
        ) : (
          <>
            {/* TopBar */}
            <header className="bg-[#F7F7F7]/85 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full h-[62px] px-5 border-b border-[#E8E5E2] shrink-0">
              <div className="flex items-center gap-2 text-sm text-[#7A7571]">
                <span>Ventas</span>
                <span className="text-[10px] opacity-40">/</span>
                <strong className="text-[#2D2B2A] font-semibold">Almacén</strong>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-[#D8D4D0]">
                  <div className={clsx('h-1.5 w-1.5 rounded-full', isConnected ? 'bg-[#3F7A52] animate-pulse' : 'bg-[#B47A1F]')} />
                  <span className="text-xs text-[#4A4744] font-medium">{user?.nombre}</span>
                </div>
              </div>
            </header>

            {/* Page content */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {/* Page Header */}
              <div className="mb-5">
                <h2 className="font-semibold text-[28px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Almacén
                </h2>
                <p className="text-[13px] text-[#7A7571] mt-1">Órdenes de picking</p>
              </div>

              {/* Tab bar */}
              <div className="flex gap-1 bg-white border border-[#E8E5E2] rounded-xl p-1 w-fit mb-5 overflow-x-auto">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                      tab === t.key
                        ? 'bg-[#780e18] text-white shadow-sm'
                        : 'text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#F0EFEC]',
                    )}
                  >
                    {t.label}
                    {counts[t.key] > 0 && (
                      <span className={clsx(
                        'ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-black',
                        tab === t.key ? 'bg-white/20 text-white' : 'bg-[#F0EFEC] text-[#4A4744]',
                      )}>
                        {counts[t.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Orders list */}
              {filteredOrdenes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="w-12 h-12 rounded-xl bg-white border border-[#E8E5E2] flex items-center justify-center mb-4">
                    <i className="ti ti-package text-[#7A7571] text-xl" />
                  </div>
                  <p className="text-sm font-semibold text-[#2D2B2A] mb-1">Sin órdenes</p>
                  <p className="text-xs text-[#7A7571] font-medium max-w-xs">
                    {tab === 'todos' ? 'No hay órdenes activas' : `No hay órdenes en este estado`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-w-[680px] mx-auto">
                  {filteredOrdenes.map(o => (
                    <OrderCard
                      key={o.id}
                      orden={o}
                      userId={user?.id ?? 'demo-almacenero'}
                      onTomar={handleTomar}
                      isNew={newOrderIds.has(o.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {faltantesOrden && (
        <FaltantesModal
          orden={faltantesOrden}
          open={!!faltantesOrden}
          onClose={() => setFaltantesOrden(null)}
          onConfirm={handleFaltantesConfirm}
          onRevertir={handleRevertirFaltante}
        />
      )}

      <GalleryViewerModal
        producto={galleryProducto}
        onClose={() => setGalleryProducto(null)}
      />
    </MainLayout>
  )
}
