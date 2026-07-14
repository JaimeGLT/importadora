import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useVentasStore } from '@/stores/ventasStore'
import { useMarcasStore } from '@/stores/marcasStore'
import { MainLayout } from '@/components/layout/MainLayout'
import type { ItemOrden, PiezaOrden, Producto, AgregarItemOrdenResponse, PiezaKit, ProductoBusquedaEscaneo } from '@/types'
import { playConfirmBeep } from '@/lib/sounds'
import { notify } from '@/lib/notify'
import { api } from '@/lib/api'
import { gql } from '@/lib/graphql'
import { PRODUCTO_BY_ID_QUERY, PRODUCTOS_IMAGENES_BATCH_QUERY, backendToProductoSimple, backendToProducto, type ProductoAPI, type ProductoAPISimple } from '@/lib/queries/inventario.queries'
import { ORDENES_PARA_ESCANEO_QUERY, backendToOrdenVenta, type OrdenVentaAPI } from '@/lib/queries/ventas.queries'
import { useVentasHub } from '@/hooks/useVentasHub'
import { clsx } from 'clsx'
import { EtiquetaModal } from '@/pages/inventario/EtiquetaModal'
import { GalleryViewerModal } from '@/pages/inventario/GalleryViewerModal'
import { ProductThumb } from '@/components/ui/ProductThumb'
import type { LabelData } from '@/lib/printLabel'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBs = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ─── LineSelectionModal ───────────────────────────────────────────────────────

function LineSelectionModal({
  matches,
  onSelect,
  onClose,
}: {
  matches: ItemOrden[]
  onSelect: (item: ItemOrden) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(45,43,42,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden border border-[#E8E5E2]">
        <div className="px-6 pt-5 pb-4 border-b border-[#E8E5E2] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#2D2B2A]">Selecciona la línea</h3>
            <p className="text-xs text-[#7A7571] mt-0.5">{matches.length} líneas con el mismo código</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#F0EFEC] transition-colors"
          >
            <i className="ti ti-x text-[18px]" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {matches.map((item, idx) => {
            const isKit = !!item.kit_id
            const isParcial = item.diferencia_kit !== undefined

            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="w-full text-left p-3 rounded-xl border border-[#E8E5E2] hover:border-[#780e18]/30 hover:bg-[#FAF5EE] transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#F0EFEC] border border-[#E8E5E2] flex items-center justify-center text-xs font-bold text-[#7A7571] shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#2D2B2A] truncate">{item.producto_nombre}</p>
                      {item.marca_nombre && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] shrink-0">
                          {item.marca_nombre}
                        </span>
                      )}
                      {isKit && (
                        <span className={clsx(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                          isParcial ? 'bg-[#F5E0A8] text-[#7A5200]' : 'bg-[#E8D4B8] text-[#780e18]'
                        )}>
                          {isParcial ? 'Parcial' : 'Completo'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-[#7A7571] mt-0.5">{item.producto_codigo}</p>
                    {isKit && (
                      <div className="mt-1.5 px-2 py-1.5 rounded-lg bg-[#F5F0EB] border border-[#E8E5E2]">
                        <p className="text-[10px] text-[#7A7571]">
                          {isParcial
                            ? `Diferencia kit: Bs ${item.diferencia_kit?.toFixed(2)}`
                            : 'Kit completo'}
                        </p>
                      </div>
                    )}
                    {!isKit && (
                      <p className="text-xs text-[#4A4744] mt-1">
                        Precio: Bs {item.precio_unitario.toFixed(2)} c/u
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-[#2D2B2A]">×{item.cantidad_pedida}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="px-4 py-3 border-t border-[#E8E5E2] bg-[#F5F0EB]">
          <p className="text-[11px] text-[#7A7571] text-center">Toca una línea para seleccionarla y continuar</p>
        </div>
      </div>
    </div>
  )
}

// ─── ScanConfirmModal ─────────────────────────────────────────────────────────

function ScanConfirmModal({
  item,
  onConfirm,
  onCancel,
  loading,
}: {
  item: ItemOrden
  onConfirm: (precio?: number) => void
  onCancel: () => void
  loading: boolean
}) {
  const [precio, setPrecio] = useState(
    item.precio_unitario > 0 ? item.precio_unitario.toFixed(2) : ''
  )
  const isKit = !!item.kit_id
  const isParcial = !!item.es_parcial
  const precioValido = isParcial || !isKit || (parseFloat(precio) > 0)
  const esFaltanteParcial = item.estado === 'faltante' && (item.cantidad_recogida ?? 0) > 0
  const cantidadMostrar = esFaltanteParcial ? item.cantidad_recogida! : item.cantidad_pedida
  const labelCantidad = esFaltanteParcial ? 'Cantidad encontrada' : 'Cantidad pedida'
  const ubicacion = [item.producto_almacen, item.producto_estante, item.producto_fila, item.producto_columna]
    .filter(Boolean).join(' › ')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && !loading && precioValido) {
        onConfirm(isKit ? parseFloat(precio) : undefined)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [loading, precioValido, isParcial, precio, isKit, onConfirm, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(45,43,42,0.45)' }}
      onClick={() => !loading && onCancel()}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border border-[#E8E5E2]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-[#E8E5E2]">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-bold text-[#2D2B2A]">Confirmar despacho</h3>
            {isKit && (
              <span className={clsx(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                isParcial ? 'bg-[#F5E0A8] text-[#7A5200]' : 'bg-[#E8D4B8] text-[#780e18]'
              )}>
                {isParcial ? 'Kit Parcial' : 'Kit'}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-[#7A7571]">{item.producto_codigo}</p>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div>
            <p className="text-base font-bold text-[#2D2B2A]">{item.producto_nombre}</p>
            {ubicacion && (
              <p className="text-xs text-[#7A7571] mt-0.5 flex items-center gap-1">
                <i className="ti ti-map-pin text-[11px]" />
                {ubicacion}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[#F5F0EB] border border-[#E8E5E2]">
            <span className="text-xs text-[#7A7571]">{labelCantidad}</span>
            <span className="text-sm font-black text-[#2D2B2A]">× {cantidadMostrar}</span>
          </div>

          {isKit && !isParcial && (
            <div>
              <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Precio total del kit (Bs)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={precio}
                onChange={e => setPrecio(e.target.value)}
                autoFocus
                className="w-full h-10 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
              />
            </div>
          )}

          {(!isKit || isParcial) && (
            <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[#F5F0EB] border border-[#E8E5E2]">
              <span className="text-xs text-[#7A7571]">Precio unitario</span>
              <span className="text-sm font-bold text-[#2D2B2A]">Bs {item.precio_unitario.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <button
            className="flex-1 h-10 rounded-xl border border-[#E8E5E2] text-sm font-semibold text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className="flex-1 h-10 rounded-xl bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            onClick={() => onConfirm(isKit ? parseFloat(precio) : undefined)}
            disabled={loading || !precioValido}
          >
            {loading ? 'Confirmando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ScanNotInOrderModal ──────────────────────────────────────────────────────

function ScanNotInOrderModal({
  code,
  producto,
  fetchLoading,
  onAgregar,
  onDescartar,
  loading,
  existingPrice,
}: {
  code: string
  producto: ProductoBusquedaEscaneo | null
  fetchLoading: boolean
  onAgregar: (cantidad: number, precio?: number, piezas?: { piezaId: number; cantidad: number; precio: number }[]) => void
  onDescartar: () => void
  loading: boolean
  existingPrice?: number
}) {
  const [cantidad, setCantidad] = useState('1')
  const [precio, setPrecio] = useState(
    existingPrice != null
      ? String(existingPrice)
      : producto?.precio != null
        ? producto.precio.toFixed(2)
        : ''
  )
  const [vistaKit, setVistaKit] = useState<'completo' | 'piezas'>('completo')
  const [piezasQty, setPiezasQty] = useState<Record<number, number>>({})
  const [piezasPrecios, setPiezasPrecios] = useState<Record<number, string>>({})
  const cantidadNum = parseInt(cantidad) || 0

  useEffect(() => {
    if (!producto) return
    // Sincronizar precio base del producto cada vez que cambia el producto cargado
    setPrecio(prev => {
      if (existingPrice != null) return String(existingPrice)
      if (prev && parseFloat(prev) > 0) return prev
      return producto.precio != null ? producto.precio.toFixed(2) : ''
    })
    if (producto.esKit && producto.piezas) {
      const piezas = producto.piezas
      // Precio sugerido: precio del kit dividido equitativamente entre las piezas
      const sugeridoUnit = producto.precio && piezas.length > 0
        ? (producto.precio / piezas.length).toFixed(2)
        : ''
      setPiezasQty(Object.fromEntries(piezas.map(p => [p.id, p.cantidadPorKit])))
      setPiezasPrecios(Object.fromEntries(piezas.map(p => [p.id, sugeridoUnit])))
      setVistaKit('completo')
    }
  }, [producto, existingPrice])

  const pieza = producto?.piezaEscaneadaId != null
    ? producto.piezas?.find(p => p.id === producto.piezaEscaneadaId) ?? null
    : null
  const stockDisponible = pieza
    ? pieza.stockActual - pieza.stockReservado
    : producto
      ? producto.stock_Actual - producto.stockReservado
      : 0
  const precioNum = parseFloat(precio) || 0

  const isKitPiezasMode = !!producto?.esKit && !pieza && vistaKit === 'piezas'
  const piezasActivasValidas = isKitPiezasMode
    ? Object.entries(piezasQty).filter(([, q]) => q > 0).every(([id]) => parseFloat(piezasPrecios[Number(id)] ?? '') > 0)
    : true
  const puedeAgregar = isKitPiezasMode
    ? Object.values(piezasQty).some(q => q > 0) && piezasActivasValidas
    : !!producto && cantidadNum >= 1 && cantidadNum <= stockDisponible && (!pieza || precioNum > 0)

  const handleConfirmar = () => {
    if (isKitPiezasMode) {
      const piezasSeleccionadas = Object.entries(piezasQty)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ piezaId: Number(id), cantidad: qty, precio: parseFloat(piezasPrecios[Number(id)] ?? '') }))
      onAgregar(0, undefined, piezasSeleccionadas)
    } else {
      onAgregar(cantidadNum, pieza ? precioNum : undefined)
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDescartar()
      if (e.key === 'Enter' && puedeAgregar && !loading) handleConfirmar()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [puedeAgregar, loading, cantidadNum, precioNum, pieza, piezasQty, vistaKit, onAgregar, onDescartar])

  const tipoLabel = pieza
    ? 'Pieza'
    : producto?.esKit
      ? 'Kit'
      : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(45,43,42,0.45)' }}
      onClick={() => !loading && onDescartar()}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border border-[#E8E5E2]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-[#E8E5E2]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#F5E0A8] flex items-center justify-center shrink-0">
              <i className="ti ti-alert-triangle text-[#B47A1F] text-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-[#2D2B2A]">Código no está en esta orden</h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className="text-[11px] font-mono text-[#7A7571]">{code}</p>
                {producto?.esKit && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] tracking-wider">
                    KIT
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-3">
          {fetchLoading ? (
            <div className="flex items-center justify-center h-12 gap-2 text-sm text-[#7A7571]">
              <i className="ti ti-loader-2 animate-spin text-[16px]" />
              Buscando…
            </div>
          ) : !producto ? (
            <div className="px-3 py-2.5 rounded-lg bg-[#F5F0EB] border border-[#E8E5E2]">
              <p className="text-sm text-[#7A7571]">Código no reconocido en el inventario.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-[#2D2B2A]">
                      {pieza ? pieza.nombre : producto.nombre}
                    </p>
                    {tipoLabel && (
                      <span className={clsx(
                        'text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 tracking-wider',
                        pieza ? 'bg-[#F5E0A8] text-[#7A5200]' : 'bg-[#E8D4B8] text-[#780e18]'
                      )}>
                        {pieza ? 'PIEZA' : 'KIT'}
                      </span>
                    )}
                  </div>
                  {pieza && (
                    <p className="text-[11px] text-[#7A7571] mt-1 flex items-center gap-1">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] tracking-wider">
                        KIT
                      </span>
                      <span>{producto.nombre}</span>
                    </p>
                  )}
                </div>
              </div>

              {!isKitPiezasMode && (
                <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[#F5F0EB] border border-[#E8E5E2]">
                  <span className="text-xs text-[#7A7571]">Stock disponible</span>
                  <span className={clsx('text-sm font-bold', stockDisponible > 0 ? 'text-[#2D2B2A]' : 'text-[#B23A2A]')}>
                    {stockDisponible} uds.
                  </span>
                </div>
              )}

              {producto.esKit && !pieza ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVistaKit('completo')}
                      className={clsx(
                        'flex-1 py-2 rounded-xl text-sm font-semibold border transition-all',
                        vistaKit === 'completo'
                          ? 'bg-[#780e18] text-white border-[#780e18]'
                          : 'bg-white text-[#4A4744] border-[#E8E5E2] hover:border-[#780e18]/30'
                      )}
                    >
                      Kit completo
                    </button>
                    <button
                      onClick={() => setVistaKit('piezas')}
                      className={clsx(
                        'flex-1 py-2 rounded-xl text-sm font-semibold border transition-all',
                        vistaKit === 'piezas'
                          ? 'bg-[#780e18] text-white border-[#780e18]'
                          : 'bg-white text-[#4A4744] border-[#E8E5E2] hover:border-[#780e18]/30'
                      )}
                    >
                      Piezas sueltas
                    </button>
                  </div>

                  {vistaKit === 'completo' ? (
                    stockDisponible > 0 ? (
                      <div>
                        <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Cantidad de kits (máx. {stockDisponible})</label>
                        <input
                          type="number"
                          min="1"
                          max={stockDisponible}
                          value={cantidad}
                          onChange={e => setCantidad(e.target.value)}
                          autoFocus
                          className="w-full h-10 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
                        />
                      </div>
                    ) : (
                      <div className="px-3 py-2.5 rounded-lg bg-[#F5E0A8] border border-[#B47A1F]/30">
                        <p className="text-xs font-semibold text-[#7A5200]">Sin stock disponible.</p>
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em]">Piezas del kit</p>
                      {!producto.piezas?.length ? (
                        <p className="text-sm text-[#7A7571] text-center py-4">Este kit no tiene piezas registradas</p>
                      ) : (
                        producto.piezas.map(pz => {
                          const dispPieza = Math.max(0, pz.stockActual - pz.stockReservado)
                          const qty = piezasQty[pz.id] ?? 0
                          return (
                            <div key={pz.id} className="p-3 rounded-xl bg-[#F5F0EB] border border-[#E8E5E2] space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[#2D2B2A] truncate">{pz.nombre}</p>
                                  {pz.codigoPieza && (
                                    <p className="font-mono text-[10.5px] text-[#7A7571] tracking-[0.04em] mt-0.5">
                                      {pz.codigoPieza}
                                    </p>
                                  )}
                                  <p className={clsx('text-[11px] font-semibold mt-0.5', dispPieza === 0 ? 'text-[#B23A2A]' : 'text-[#3F7A52]')}>
                                    {dispPieza} disp.
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-[10px] text-[#7A7571]">Cant.</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={dispPieza}
                                    value={qty}
                                    onChange={e => {
                                      const val = Math.max(0, Math.min(dispPieza, parseInt(e.target.value) || 0))
                                      setPiezasQty(prev => ({ ...prev, [pz.id]: val }))
                                    }}
                                    className="w-16 h-8 text-center text-sm font-bold border border-[#E8E5E2] rounded-lg bg-white focus:outline-none focus:border-[#780e18] transition-all"
                                  />
                                </div>
                              </div>
                              {qty > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[#7A7571] shrink-0">Precio (Bs)</span>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={piezasPrecios[pz.id] ?? ''}
                                    onChange={e => setPiezasPrecios(prev => ({ ...prev, [pz.id]: e.target.value }))}
                                    className="flex-1 h-8 px-2.5 text-sm border border-[#E8E5E2] rounded-lg bg-white focus:outline-none focus:border-[#780e18] transition-all"
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              ) : stockDisponible > 0 ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Cantidad a agregar</label>
                    <input
                      type="number"
                      min="1"
                      max={stockDisponible}
                      value={cantidad}
                      onChange={e => setCantidad(e.target.value)}
                      autoFocus={!pieza}
                      className="w-full h-10 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
                    />
                  </div>
                  {pieza && (
                    <div>
                      <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">
                        Precio unitario (Bs)
                        {existingPrice != null && (
                          <span className="ml-1.5 text-[10px] font-normal text-[#7A7571]">precio anterior</span>
                        )}
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={precio}
                        onChange={e => setPrecio(e.target.value)}
                        autoFocus
                        placeholder="0.00"
                        className="w-full h-10 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-3 py-2.5 rounded-lg bg-[#F5E0A8] border border-[#B47A1F]/30">
                  <p className="text-xs font-semibold text-[#7A5200]">Sin stock disponible.</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <button
            className="flex-1 h-10 rounded-xl border border-[#E8E5E2] text-sm font-semibold text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50"
            onClick={onDescartar}
            disabled={loading}
          >
            Descartar
          </button>
          {puedeAgregar && (
            <button
              className="flex-1 h-10 rounded-xl bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              onClick={handleConfirmar}
              disabled={loading || !puedeAgregar}
            >
              {loading ? 'Agregando…' : 'Agregar al pedido'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── PiezaScanPriceModal ──────────────────────────────────────────────────────

function PiezaScanPriceModal({
  pieza,
  item,
  onConfirm,
  onCancel,
  loading,
}: {
  pieza: PiezaOrden
  item: ItemOrden
  onConfirm: (precio: number) => void
  onCancel: () => void
  loading: boolean
}) {
  const [precio, setPrecio] = useState(pieza.precio_unitario ? pieza.precio_unitario.toFixed(2) : '')
  const precioNum = parseFloat(precio)
  const valido = !isNaN(precioNum) && precioNum > 0

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && !loading && valido) onConfirm(precioNum)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [loading, valido, precioNum, onConfirm, onCancel])

  const esFaltanteParcial = pieza.nota_incompleto != null && (pieza.cantidad_recogida ?? 0) > 0
  const cantidadMostrar = esFaltanteParcial ? pieza.cantidad_recogida! : pieza.cantidad
  const labelCantidad = esFaltanteParcial ? 'Cantidad encontrada' : 'Cantidad pedida'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(45,43,42,0.45)' }}
      onClick={() => !loading && onCancel()}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border border-[#E8E5E2]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-[#E8E5E2]">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-[#2D2B2A]">Confirmar despacho</h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200]">
              PIEZA
            </span>
          </div>
          {pieza.codigo_pieza && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono font-bold text-[10px] bg-[#780e18] text-white">
              {pieza.codigo_pieza}
            </span>
          )}
        </div>

        <div className="px-6 py-5 space-y-3">
          <div>
            <p className="text-base font-bold text-[#2D2B2A] leading-snug">{pieza.nombre}</p>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#7A7571]">
              <span className="font-mono">{item.producto_codigo}</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] tracking-wider shrink-0">
                KIT
              </span>
              <span className="font-medium text-[#4A4744] truncate">{item.producto_nombre}</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[#F5F0EB] border border-[#E8E5E2]">
            <span className="text-xs text-[#7A7571]">{labelCantidad}</span>
            <span className="text-sm font-black text-[#2D2B2A]">× {cantidadMostrar}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Precio unitario (Bs)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={precio}
              onChange={e => setPrecio(e.target.value)}
              autoFocus
              className="w-full h-10 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <button
            className="flex-1 h-10 rounded-xl border border-[#E8E5E2] text-sm font-semibold text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className="flex-1 h-10 rounded-xl bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            onClick={() => onConfirm(precioNum)}
            disabled={loading || !valido}
          >
            {loading ? 'Confirmando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AgregarProductoModal ─────────────────────────────────────────────────────

type AgregarRequest =
  | { tipo: 'producto'; producto: Producto; cantidad: number; precioUnitario: number }
  | { tipo: 'kit_completo'; producto: Producto; cantidad: number; precioUnitario: number }
  | { tipo: 'piezas_sueltas'; kitProducto: Producto; piezas: { pieza: PiezaKit; cantidad: number; precio: number }[] }

function AgregarProductoModal({
  onAgregar,
  onClose,
  loading,
  existingItems,
}: {
  onAgregar: (req: AgregarRequest) => void
  onClose: () => void
  loading: boolean
  existingItems: ItemOrden[]
}) {
  const { isTokenReady } = useAuth()
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [kitDetalle, setKitDetalle] = useState<Producto | null>(null)
  const [fetchingKit, setFetchingKit] = useState(false)
  const [vistaKit, setVistaKit] = useState<'opciones' | 'piezas'>('opciones')
  const [piezasConfig, setPiezasConfig] = useState<{ pieza: PiezaKit; cantidad: number; precio: string }[]>([])

  useEffect(() => {
    if (!query.trim() || !isTokenReady) { setResultados([]); return }
    const q = query.trim()
    const timer = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await api.get<ProductoAPISimple[]>(`/Producto/buscar-lista?q=${encodeURIComponent(q)}`)
        setResultados((res ?? []).map(backendToProductoSimple))
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, isTokenReady])

  const handleSelectProducto = async (p: Producto) => {
    setSeleccionado(p)
    setCantidad('1')
    setKitDetalle(null)
    setVistaKit('opciones')
    if (p.es_kit) {
      setFetchingKit(true)
      try {
        const res = await gql<{ productos: { nodes: ProductoAPI[] } }>(
          PRODUCTO_BY_ID_QUERY, { id: parseInt(p.id) }
        )
        const full = backendToProducto(res.productos?.nodes?.[0])
        setKitDetalle(full)
        // Prellenar precio de piezas: primero las que ya existen en la orden; si no, división equitativa del precio del kit
        const piezasEnOrden = new Map<number, number>()
        for (const it of existingItems) {
          for (const pz of it.piezas_orden ?? []) {
            if (pz.precio_unitario != null) piezasEnOrden.set(pz.id_pieza, pz.precio_unitario)
          }
        }
        const piezasKit = full.piezas_kit ?? []
        const sugeridoUnit = piezasKit.length > 0 && full.precio_venta > 0
          ? (full.precio_venta / piezasKit.length).toFixed(2)
          : ''
        setPiezasConfig(piezasKit.map(pz => ({
          pieza: pz,
          cantidad: pz.cantidad_por_kit,
          precio: piezasEnOrden.has(pz.id)
            ? String(piezasEnOrden.get(pz.id))
            : sugeridoUnit,
        })))
      } catch {
        notify.error('Error al cargar piezas del kit')
        setSeleccionado(null)
      } finally {
        setFetchingKit(false)
      }
    }
  }

  // Detectar si el producto/kit seleccionado ya existe en la orden (para heredar precio/descuento)
  const existingItemMatch = seleccionado
    ? existingItems.find(i => i.producto_id === seleccionado.id && !i.es_parcial)
    : null
  const existingPartialItemMatch = seleccionado
    ? existingItems.find(i => i.producto_id === seleccionado.id && i.es_parcial)
    : null

  const cantidadNum = parseInt(cantidad) || 0
  const disp = seleccionado ? Math.max(0, seleccionado.stock - (seleccionado.stock_reservado ?? 0)) : 0

  const puedeAgregar = (() => {
    if (!seleccionado) return false
    if (seleccionado.es_kit) {
      if (fetchingKit || !kitDetalle) return false
      if (vistaKit === 'opciones') return cantidadNum >= 1 && cantidadNum <= disp
      const activas = piezasConfig.filter(p => p.cantidad > 0)
      return activas.length > 0 && activas.every(p => parseFloat(p.precio) > 0)
    }
    return cantidadNum >= 1 && cantidadNum <= disp
  })()

  const handleConfirmar = () => {
    if (!seleccionado) return
    if (seleccionado.es_kit && kitDetalle) {
      if (vistaKit === 'opciones') {
        // Kit completo: heredar precio si ya existe; si no, precio base
        const inherited = existingItemMatch
        onAgregar({
          tipo: 'kit_completo',
          producto: seleccionado,
          cantidad: cantidadNum,
          precioUnitario: inherited ? inherited.precio_unitario : seleccionado.precio_venta,
        })
      } else {
        onAgregar({
          tipo: 'piezas_sueltas',
          kitProducto: seleccionado,
          piezas: piezasConfig
            .filter(p => p.cantidad > 0)
            .map(p => ({ pieza: p.pieza, cantidad: p.cantidad, precio: parseFloat(p.precio) })),
        })
      }
    } else {
      // Producto regular: heredar precio si ya existe; si no, precio base
      const inherited = existingItemMatch
      onAgregar({
        tipo: 'producto',
        producto: seleccionado,
        cantidad: cantidadNum,
        precioUnitario: inherited ? inherited.precio_unitario : seleccionado.precio_venta,
      })
    }
  }

  const resetSeleccion = () => {
    setSeleccionado(null)
    setKitDetalle(null)
    setVistaKit('opciones')
    setPiezasConfig([])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(45,43,42,0.45)' }}
      onClick={() => !loading && onClose()}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden border border-[#E8E5E2] flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-[#E8E5E2] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold text-[#2D2B2A]">Agregar producto</h3>
            <p className="text-xs text-[#7A7571] mt-0.5">Busca y selecciona el producto a agregar</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#F0EFEC] transition-colors"
          >
            <i className="ti ti-x text-[18px]" />
          </button>
        </div>

        {!seleccionado ? (
          <>
            <div className="px-4 pt-3 pb-2 border-b border-[#E8E5E2] shrink-0">
              <div className="flex items-center gap-2 bg-[#F7F7F7] border border-[#D8D4D0] rounded-lg px-3.5 focus-within:border-[#780e18] transition-colors">
                <i className="ti ti-search text-[#7A7571] text-[13px] shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value.replace(/'/g, '-'))}
                  placeholder="Buscar por código, nombre, marca o código de pieza (P1-…)"
                  className="flex-1 py-2.5 bg-transparent text-[13px] text-[#2D2B2A] placeholder:text-[#7A7571] outline-none border-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {buscando ? (
                <div className="divide-y divide-[#E8E5E2] px-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-24 rounded bg-[#F0EFEC]" />
                        <div className="h-2.5 w-40 rounded bg-[#F0EFEC]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : query.trim() === '' ? (
                <div className="flex items-center justify-center h-32 text-sm text-[#7A7571]">Escribe para buscar</div>
              ) : resultados.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-[#7A7571]">Sin resultados</div>
              ) : (
                <div className="divide-y divide-[#E8E5E2]">
                  {resultados.map(p => {
                    const dispP = Math.max(0, p.stock - (p.stock_reservado ?? 0))
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProducto(p)}
                        disabled={!p.es_kit && dispP === 0}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAF5EE] transition-colors text-left disabled:opacity-40"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-black text-[#780e18] bg-[#F4ECDB] px-1.5 py-0.5 rounded">
                              {p.codigo_universal}
                            </span>
                            {p.es_kit && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18]">KIT</span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-[#4A4744] truncate mt-0.5">{p.nombre}</p>
                          {p.es_kit ? (
                            <p className="text-[11px] font-semibold mt-0.5 text-[#780e18] flex items-center gap-1.5">
                              <span>Kit de productos</span>
                              <span className="text-[#D0CBC4]">·</span>
                              <span className="font-mono font-bold text-[#2D2B2A]">{fmtBs(p.precio_venta)}</span>
                            </p>
                          ) : (
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className={clsx('text-[11px] font-semibold', dispP === 0 ? 'text-[#B23A2A]' : 'text-[#3F7A52]')}>{dispP} disponibles</p>
                              <span className="text-[#D0CBC4]">·</span>
                              <p className="text-[11px] font-mono font-bold text-[#2D2B2A]">{fmtBs(p.precio_venta)}</p>
                            </div>
                          )}
                        </div>
                        <i className="ti ti-chevron-right text-[#D0CBC4] text-[16px] shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : seleccionado.es_kit ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F4ECDB]/50 border border-[#E8D4B8]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-[#780e18] bg-[#F4ECDB] px-1.5 py-0.5 rounded">
                    {seleccionado.codigo_universal}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18]">KIT</span>
                </div>
                <p className="text-sm font-semibold text-[#2D2B2A] mt-1">{seleccionado.nombre}</p>
              </div>
              <button
                onClick={resetSeleccion}
                className="p-1 rounded-lg text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#F0EFEC] transition-colors shrink-0"
              >
                <i className="ti ti-x text-[16px]" />
              </button>
            </div>

            {fetchingKit ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-[#F0EFEC]" />)}
              </div>
            ) : kitDetalle ? (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVistaKit('opciones')}
                    className={clsx(
                      'flex-1 py-2 rounded-xl text-sm font-semibold border transition-all',
                      vistaKit === 'opciones'
                        ? 'bg-[#780e18] text-white border-[#780e18]'
                        : 'bg-white text-[#4A4744] border-[#E8E5E2] hover:border-[#780e18]/30'
                    )}
                  >
                    Kit completo
                  </button>
                  <button
                    onClick={() => setVistaKit('piezas')}
                    className={clsx(
                      'flex-1 py-2 rounded-xl text-sm font-semibold border transition-all',
                      vistaKit === 'piezas'
                        ? 'bg-[#780e18] text-white border-[#780e18]'
                        : 'bg-white text-[#4A4744] border-[#E8E5E2] hover:border-[#780e18]/30'
                    )}
                  >
                    Piezas sueltas
                  </button>
                </div>

                {vistaKit === 'opciones' ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Cantidad de kits (máx. {disp})</label>
                    <input
                      type="number"
                      min="1"
                      max={disp}
                      value={cantidad}
                      onChange={e => setCantidad(e.target.value)}
                      autoFocus
                      className="w-full h-10 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em]">Piezas del kit</p>
                    {piezasConfig.length === 0 ? (
                      <p className="text-sm text-[#7A7571] text-center py-4">Este kit no tiene piezas registradas</p>
                    ) : (
                      piezasConfig.map((pc, idx) => {
                        const dispPieza = Math.max(0, pc.pieza.stock_actual - pc.pieza.stock_reservado)
                        return (
                          <div key={pc.pieza.id} className="p-3 rounded-xl bg-[#F5F0EB] border border-[#E8E5E2] space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#2D2B2A] truncate">{pc.pieza.nombre}</p>
                                {pc.pieza.codigo_pieza && (
                                  <p className="font-mono text-[10.5px] text-[#7A7571] tracking-[0.04em] mt-0.5">
                                    {pc.pieza.codigo_pieza}
                                  </p>
                                )}
                                <p className={clsx('text-[11px] font-semibold mt-0.5', dispPieza === 0 ? 'text-[#B23A2A]' : 'text-[#3F7A52]')}>
                                  {dispPieza} disp.
                                </p>
                              </div>
                              <input
                                type="number"
                                min="0"
                                max={dispPieza}
                                value={pc.cantidad}
                                onChange={e => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0)
                                  setPiezasConfig(prev => prev.map((x, i) => i === idx ? { ...x, cantidad: val, precio: val === 0 ? '' : x.precio } : x))
                                }}
                                className="w-16 h-8 text-center text-sm font-bold border border-[#E8E5E2] rounded-lg focus:outline-none focus:border-[#780e18] transition-all"
                              />
                            </div>
                            {pc.cantidad > 0 && (
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] font-semibold text-[#7A7571] shrink-0">Precio (Bs)</label>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={pc.precio}
                                  onChange={e => setPiezasConfig(prev => prev.map((x, i) => i === idx ? { ...x, precio: e.target.value } : x))}
                                  className="flex-1 h-8 px-2.5 text-sm font-bold border border-[#E8E5E2] rounded-lg focus:outline-none focus:border-[#780e18] transition-all"
                                />
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F0EB] border border-[#E8E5E2]">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs font-black text-[#780e18] bg-[#F4ECDB] px-1.5 py-0.5 rounded">
                  {seleccionado.codigo_universal}
                </span>
                <p className="text-sm font-semibold text-[#2D2B2A] mt-1">{seleccionado.nombre}</p>
                <p className="text-xs text-[#3F7A52] font-semibold mt-0.5">{disp} disponibles</p>
              </div>
              <button
                onClick={resetSeleccion}
                className="p-1 rounded-lg text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#EDE8E3] transition-colors shrink-0"
              >
                <i className="ti ti-x text-[16px]" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Cantidad (máx. {disp})</label>
              <input
                type="number"
                min="1"
                max={disp}
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                autoFocus
                className="w-full h-10 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
              />
            </div>
            {existingItemMatch && (
              <div className="p-2.5 rounded-lg bg-[#F5E0A8]/40 border border-[#F5E0A8] text-[12px] text-[#7A5200]">
                <i className="ti ti-info-circle mr-1" />
                Ya en la orden con precio <strong>Bs {existingItemMatch.precio_unitario.toFixed(2)}</strong>.
                Se agregará con el mismo precio.
              </div>
            )}
            {existingPartialItemMatch && (
              <div className="p-2.5 rounded-lg bg-[#EAF4EE] border border-[#B8DCCA] text-[12px] text-[#1E5C38]">
                <i className="ti ti-info-circle mr-1" />
                Este producto ya tiene <strong>{existingPartialItemMatch.piezas_orden?.length ?? 0}</strong> pieza(s) suelta(s) en la orden.
              </div>
            )}
          </div>
        )}

        <div className="px-6 pb-6 pt-3 flex gap-2 border-t border-[#E8E5E2] shrink-0">
          <button
            className="flex-1 h-10 rounded-xl border border-[#E8E5E2] text-sm font-semibold text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          {seleccionado && (
            <button
              className="flex-1 h-10 rounded-xl bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              onClick={handleConfirmar}
              disabled={loading || !puedeAgregar}
            >
              {loading ? 'Agregando…' : 'Agregar al pedido'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MarcarListoPromptModal ───────────────────────────────────────────────────

function MarcarListoPromptModal({
  item,
  onConfirmar,
  onRechazar,
}: {
  item: ItemOrden
  onConfirmar: () => void
  onRechazar: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRechazar()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onRechazar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(45,43,42,0.45)' }}
      onClick={onRechazar}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border border-[#E8E5E2]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-[#E8E5E2]">
          <h3 className="text-sm font-bold text-[#2D2B2A]">¿Marcar como listo ahora?</h3>
          <p className="text-xs text-[#7A7571] mt-1">Item recién agregado a la orden</p>
        </div>

        <div className="px-6 py-5 space-y-2">
          <p className="text-base font-bold text-[#2D2B2A]">{item.producto_nombre}</p>
          <p className="text-sm text-[#4A4744] leading-relaxed">
            ¿Querés marcarlo como listo para que el cajero lo escanee directamente, o lo dejas para
            que el almacenero lo busque?
          </p>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            type="button"
            className="w-full h-10 rounded-xl bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-sm font-bold active:scale-[0.98] transition-all shadow-sm"
            onClick={onConfirmar}
          >
            Sí, marcar como listo
          </button>
          <button
            type="button"
            className="w-full h-10 rounded-xl border border-[#E8E5E2] text-sm font-semibold text-[#4A4744] hover:bg-[#F0EFEC] transition-colors"
            onClick={onRechazar}
          >
            No, enviar al almacenero
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── EscaneoPage ──────────────────────────────────────────────────────────────

export function EscaneoPage() {
  const { isTokenReady } = useAuth()
  const { ordenes, setOrdenes, updateOrden, addItemToOrden, removeItemFromOrden, updateItemQtyInOrden, markItemListoEnOrden, updateItemEstadoEnOrden, updatePiezaQtyInOrden, removePiezaFromOrden } = useVentasStore()
  const { marcas } = useMarcasStore()
  const [selectedOrdenId, setSelectedOrdenId] = useState<string | null>(null)
  const [loadingOrdenes, setLoadingOrdenes] = useState(false)
  const [confirmedItemIds, setConfirmedItemIds] = useState<Set<string>>(new Set())
  const [pendingConfirmItem, setPendingConfirmItem] = useState<ItemOrden | null>(null)
  const [pendingNotInOrderCode, setPendingNotInOrderCode] = useState<string | null>(null)
  const [selectMultipleMatches, setSelectMultipleMatches] = useState<ItemOrden[]>([])
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [agregarLoading, setAgregarLoading] = useState(false)
  const [completarLoading, setCompletarLoading] = useState(false)
  const [showAgregarModal, setShowAgregarModal] = useState(false)
  const [itemLoading, setItemLoading] = useState<Record<string, boolean>>({})
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null)
  const [flashItemId, setFlashItemId] = useState<string | null>(null)
  const [flashPiezaId, setFlashPiezaId] = useState<string | null>(null)
  const [piezaPrecios, setPiezaPrecios] = useState<Record<number, string>>({})
  const [piezaLoading, setPiezaLoading] = useState<Record<string, boolean>>({})
  const [confirmedPiezaPrices, setConfirmedPiezaPrices] = useState<Record<number, number>>({})
  const [confirmedPiezaIds, setConfirmedPiezaIds] = useState<Set<number>>(new Set())
  const [notInOrderProducto, setNotInOrderProducto] = useState<ProductoBusquedaEscaneo | null>(null)
  const [notInOrderLoading, setNotInOrderLoading] = useState(false)
  const [_pendingNotInOrderMarcaId, setPendingNotInOrderMarcaId] = useState<number | null>(null)
  const [pendingPiezaScan, setPendingPiezaScan] = useState<{ item: ItemOrden; pieza: PiezaOrden } | null>(null)
  const [pendingMarcarListoItem, setPendingMarcarListoItem] = useState<ItemOrden | null>(null)
  const [scanCounts, setScanCounts] = useState<Record<string, number>>({})
  // Contador de escaneos por pieza (similar a scanCounts de productos).
  // Cuando el contador llega a pieza.cantidad, se abre el PiezaScanPriceModal.
  const [piezaScanCounts, setPiezaScanCounts] = useState<Record<string, number>>({})
  const [etiquetaPieza, setEtiquetaPieza] = useState<{ etiqueta: LabelData; subtitulo: string } | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const [productoImagenes, setProductoImagenes] = useState<Record<string, string>>({})
  const [galleryProducto, setGalleryProducto] = useState<Producto | null>(null)

  const dateStr = useMemo(() => {
    return new Date().toLocaleDateString('es-BO', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
  }, [])

  // El modal de precios ya no muestra descuentos (se eligen al cobrar).
  // El estado `descuentos` se mantiene en CajaPage para alimentar el CheckoutModal.

  // Buscar producto por código cuando se escanea algo fuera de la orden
  useEffect(() => {
    if (!pendingNotInOrderCode || !isTokenReady) { setNotInOrderProducto(null); return }
    const code = pendingNotInOrderCode
    setNotInOrderLoading(true)
    api.get<ProductoBusquedaEscaneo>(`/Producto/buscar?codigo=${encodeURIComponent(code)}`)
      .then(res => { setNotInOrderProducto(res); setNotInOrderLoading(false) })
      .catch(() => { setNotInOrderProducto(null); setNotInOrderLoading(false) })
  }, [pendingNotInOrderCode, isTokenReady])

  const handleRecargarRef = useRef<() => void>(() => {})

  const { joinGrupo } = useVentasHub({
    onItemListoParaScaneo: useCallback((p: { ordenId: number; itemId: number }) => {
      if (selectedOrdenId === String(p.ordenId)) {
        markItemListoEnOrden(String(p.ordenId), String(p.itemId))
        notify.success('Producto listo para escanear', { description: 'El almacenero ya trajo el producto' })
      }
    }, [selectedOrdenId, markItemListoEnOrden]),
    onOrdenConFaltantes: useCallback((p: { ordenId: number }) => {
      const existe = useVentasStore.getState().ordenes.find(o => o.id === String(p.ordenId))
      if (existe) {
        updateOrden(String(p.ordenId), { estado: 'con_faltantes' })
      } else {
        handleRecargarRef.current()
      }
    }, [updateOrden]),
    onOrdenLista: useCallback((p: { id: number }) => {
      const existe = useVentasStore.getState().ordenes.find(o => o.id === String(p.id))
      if (existe) {
        updateOrden(String(p.id), { estado: 'listo_para_escaneo' })
      } else {
        handleRecargarRef.current()
      }
      if (selectedOrdenId === String(p.id)) {
        notify.success('Almacenero listo', { description: 'Ya puedes continuar escaneando' })
        scanInputRef.current?.focus()
      }
    }, [selectedOrdenId, updateOrden]),
    onItemFaltanteReportado: useCallback((_p: { ordenId: number; itemId: number }) => {
      // El item/pieza cambió de estado en el almacén; refrescar la orden
      handleRecargarRef.current()
    }, []),
    onPiezaFaltanteReportado: useCallback((_p: { ordenId: number; itemId: number; piezaItemId: number }) => {
      // La pieza cambió de estado en el almacén; refrescar la orden
      handleRecargarRef.current()
    }, []),
    onFaltanteRevertido: useCallback((_p: { ordenId: number; itemId: number; piezaItemId?: number }) => {
      // Se revirtió un faltante en el almacén; refrescar la orden
      handleRecargarRef.current()
    }, []),
  }, isTokenReady, ['Escaneo'])

  const joinGrupoRef = useRef<(g: string) => Promise<void>>(() => Promise.resolve())
  joinGrupoRef.current = joinGrupo

  const handleRecargar = useCallback(() => {
    if (!isTokenReady) return
    setLoadingOrdenes(true)
    gql<{ ordenesParaEscaneo: { nodes: OrdenVentaAPI[] } }>(ORDENES_PARA_ESCANEO_QUERY)
      .then(data => {
        const fetched = (data.ordenesParaEscaneo?.nodes ?? [])
          .map(backendToOrdenVenta)
          .filter(o => o.estado !== 'completada' && o.estado !== 'cancelada')
        const { ordenes: current } = useVentasStore.getState()
        const fetchedMap = new Map(fetched.map(o => [o.id, o]))
        const merged = current.map(o => fetchedMap.get(o.id) ?? o)
        const newOnes = fetched.filter(o => !current.some(c => c.id === o.id))
        const all = [...merged, ...newOnes]
        setOrdenes(all)
        all.forEach(o => joinGrupoRef.current(`orden-${o.id}`))
      })
      .catch(() => notify.error('Error al cargar órdenes'))
      .finally(() => setLoadingOrdenes(false))
  }, [isTokenReady, setOrdenes])
  handleRecargarRef.current = handleRecargar

  useEffect(() => {
    handleRecargar()
  }, [handleRecargar])

  useEffect(() => {
    scanInputRef.current?.focus()
  }, [selectedOrdenId])

  useEffect(() => {
    if (selectedOrdenId) {
      joinGrupo(`orden-${selectedOrdenId}`)
    }
  }, [selectedOrdenId, joinGrupo])

  // Ref + listener global de teclado: agregados más abajo (después de
  // declarar `handleScan` para evitar TDZ). Se busca "Listener global".

  const selectedOrden = useMemo(
    () => ordenes.find((o) => o.id === selectedOrdenId) ?? null,
    [ordenes, selectedOrdenId],
  )

  // Pre-marcar ítems que ya vienen confirmados del backend (recarga de página)
  useEffect(() => {
    if (!selectedOrden) return
    const yaConfirmados = selectedOrden.items
      .filter(i => i.estado === 'completo')
      .map(i => i.id)
    if (yaConfirmados.length > 0) {
      setConfirmedItemIds(prev => new Set([...prev, ...yaConfirmados]))
    }
  }, [selectedOrden?.id])

  // Ítems que el almacenero encontró (total o parcialmente) — van a la sección de escaneo
  const itemsParaEscanear = useMemo(
    () => selectedOrden?.items.filter(i => {
      if (i.estado !== 'faltante') return true
      if (i.es_parcial && i.piezas_orden?.length)
        return i.piezas_orden.some(p =>
          (p.listo_almacenero && !p.nota_incompleto) ||
          (!!p.nota_incompleto && (p.cantidad_recogida ?? 0) > 0)
        )
      return (i.cantidad_recogida ?? 0) > 0
    }) ?? [],
    [selectedOrden],
  )

  const itemsEscaneables = useMemo(
    () => itemsParaEscanear.filter(i => i.estado !== 'pendiente'),
    [itemsParaEscanear],
  )

  // Cache de imágenes principales: cuando cambia la orden visible,
  // batch-fetcheamos `imagenPrincipal.url` para todos los productoIds
  // únicos que aún no tengamos en el cache. Mantiene la galería
  // funcionando en las páginas de ventas sin hidratar todo el `Producto`.
  useEffect(() => {
    const ids = Array.from(new Set(itemsParaEscanear.map(i => i.producto_id)))
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
  }, [itemsParaEscanear, productoImagenes])

  const isItemConfirmed = (item: ItemOrden) => {
    if (item.es_parcial && item.piezas_orden?.length) {
      return item.piezas_orden.every(p =>
        confirmedPiezaIds.has(p.id) || !!p.confirmado || !!p.nota_incompleto
      )
    }
    return confirmedItemIds.has(item.id)
  }

  const allConfirmed = itemsParaEscanear.length > 0 &&
    itemsParaEscanear.every(i => isItemConfirmed(i))

  // Solo los faltantes totales (0 encontrados) van tachados abajo
  // Los parciales también aparecen tachados pero solo por la cantidad faltante
  const faltanteItems = useMemo(
    () => selectedOrden?.items.filter(i => i.estado === 'faltante' && !i.es_parcial) ?? [],
    [selectedOrden]
  )

  const faltantePiezas = useMemo(() => {
    const result: Array<{ itemNombre: string; pieza: PiezaOrden }> = []
    for (const item of selectedOrden?.items ?? []) {
      if (!item.es_parcial || !item.piezas_orden?.length) continue
      for (const pieza of item.piezas_orden) {
        if (pieza.nota_incompleto && !(pieza.cantidad_recogida ?? 0)) {
          result.push({ itemNombre: item.producto_nombre ?? '', pieza })
        }
      }
    }
    return result
  }, [selectedOrden])

  const faltantesCount = faltanteItems.length + faltantePiezas.length

  const totalSinFaltantes = useMemo(
    () => itemsParaEscanear.reduce((s, i) => {
      if (i.es_parcial && i.piezas_orden?.length) {
        return s + i.piezas_orden.reduce((ps, p) => {
          const precio = confirmedPiezaPrices[p.id] ?? p.precio_unitario ?? 0
          const qty = p.nota_incompleto ? (p.cantidad_recogida ?? 0) : p.cantidad
          return ps + precio * qty
        }, 0)
      }
      const qty = i.estado === 'faltante' ? (i.cantidad_recogida ?? 0) : i.cantidad_pedida
      return s + i.precio_unitario * qty
    }, 0),
    [itemsParaEscanear, confirmedPiezaPrices]
  )

  const setItemLoadingState = (itemId: string, val: boolean) =>
    setItemLoading(prev => ({ ...prev, [itemId]: val }))

  const handleEliminarItem = async (item: ItemOrden) => {
    if (!selectedOrden) return
    setItemLoadingState(item.id, true)
    try {
      await api.delete(`/OrdenVenta/${selectedOrden.id}/Items/${item.id}`)
      removeItemFromOrden(selectedOrden.id, item.id)
      setConfirmedItemIds(prev => { const n = new Set(prev); n.delete(item.id); return n })
      setConfirmEliminar(null)
      notify.success(`${item.producto_nombre} eliminado del pedido`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setItemLoadingState(item.id, false)
    }
  }

  const handleAjustarCantidad = async (item: ItemOrden, delta: number) => {
    if (!selectedOrden) return
    const nuevaCantidad = item.cantidad_pedida + delta
    if (nuevaCantidad < 1) return
    setItemLoadingState(item.id, true)
    try {
      await api.put(`/OrdenVenta/${selectedOrden.id}/Items/${item.id}/Cantidad`, { cantidad: nuevaCantidad })
      updateItemQtyInOrden(selectedOrden.id, item.id, nuevaCantidad)
      if (delta > 0 && item.estado === 'listo_almacenero') {
        updateItemEstadoEnOrden(selectedOrden.id, item.id, 'pendiente')
        updateOrden(selectedOrden.id, { estado: 'con_faltantes' })
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al actualizar cantidad')
    } finally {
      setItemLoadingState(item.id, false)
    }
  }

  const handleConfirmarPieza = async (item: ItemOrden, pieza: PiezaOrden) => {
    if (!selectedOrden) return
    const precio = parseFloat(piezaPrecios[pieza.id] ?? String(pieza.precio_unitario ?? ''))
    if (isNaN(precio) || precio <= 0) { notify.warning('Ingresa un precio válido'); return }
    setPiezaLoading(prev => ({ ...prev, [pieza.id]: true }))
    try {
      await api.post(
        `/OrdenVenta/${selectedOrden.id}/Items/${item.id}/Piezas/${pieza.id}/Confirmar`,
        { PrecioUnitario: precio }
      )
      setConfirmedPiezaIds(prev => new Set([...prev, pieza.id]))
      setConfirmedPiezaPrices(prev => ({ ...prev, [pieza.id]: precio }))
      playConfirmBeep()
      notify.success(`${pieza.nombre} confirmada`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al confirmar pieza')
    } finally {
      setPiezaLoading(prev => ({ ...prev, [pieza.id]: false }))
    }
  }

  const handleAjustarCantidadPieza = async (item: ItemOrden, pieza: PiezaOrden) => {
    if (!selectedOrden) return
    if (pieza.cantidad <= 1) {
      // Si la pieza tiene cantidad 1, -1 = eliminar
      return handleEliminarPieza(item, pieza)
    }
    const nuevaCantidad = pieza.cantidad - 1
    const cantidadAnterior = pieza.cantidad
    setPiezaLoading(prev => ({ ...prev, [pieza.id]: true }))
    try {
      await api.put(
        `/OrdenVenta/${selectedOrden.id}/Items/${item.id}/Piezas/${pieza.id}/Cantidad`,
        { cantidad: nuevaCantidad },
      )
      updatePiezaQtyInOrden(selectedOrden.id, item.id, pieza.id, nuevaCantidad)
      notify.info(`${pieza.nombre}: stock reducido a ${nuevaCantidad}`, {
        duration: 5000,
        action: {
          label: 'Deshacer',
          onClick: async () => {
            try {
              await api.put(
                `/OrdenVenta/${selectedOrden.id}/Items/${item.id}/Piezas/${pieza.id}/Cantidad`,
                { cantidad: cantidadAnterior },
              )
              updatePiezaQtyInOrden(selectedOrden.id, item.id, pieza.id, cantidadAnterior)
            } catch (err) {
              notify.error(err instanceof Error ? err.message : 'Error al deshacer')
            }
          },
        },
      })
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al ajustar stock')
    } finally {
      setPiezaLoading(prev => ({ ...prev, [pieza.id]: false }))
    }
  }

  const handleEliminarPieza = async (item: ItemOrden, pieza: PiezaOrden) => {
    if (!selectedOrden) return
    setPiezaLoading(prev => ({ ...prev, [pieza.id]: true }))
    // Snapshot para undo
    const snapshot = {
      idProducto: Number(item.producto_id),
      idPieza: pieza.id_pieza,
      cantidad: pieza.cantidad,
      precioUnitario: pieza.precio_unitario ?? item.precio_unitario,
    }
    try {
      await api.delete(
        `/OrdenVenta/${selectedOrden.id}/Items/${item.id}/Piezas/${pieza.id}`,
      )
      removePiezaFromOrden(selectedOrden.id, item.id, pieza.id)
      notify.info(`${pieza.nombre} eliminado de la orden`, {
        duration: 5000,
        action: {
          label: 'Deshacer',
          onClick: async () => {
            try {
              await api.post(`/OrdenVenta/${selectedOrden.id}/AgregarItem`, {
                Id_Producto: snapshot.idProducto,
                Id_Pieza: snapshot.idPieza,
                Cantidad: snapshot.cantidad,
                PrecioUnitario: snapshot.precioUnitario,
              })
              // Refrescar para que el frontend refleje la pieza restaurada en su item original
              await handleRecargar()
            } catch (err) {
              notify.error(err instanceof Error ? err.message : 'Error al deshacer')
            }
          },
        },
      })
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al eliminar pieza')
    } finally {
      setPiezaLoading(prev => ({ ...prev, [pieza.id]: false }))
    }
  }

  const handleImprimirPieza = (item: ItemOrden, pieza: PiezaOrden) => {
    if (!pieza.codigo_pieza) {
      notify.error('La pieza no tiene código para imprimir')
      return
    }
    const marca = item.marcaId != null ? marcas.find(m => m.id === item.marcaId) : null
    const etiqueta: LabelData = {
      // Imprimimos el codigo_pieza tal cual viene del backend (ej. "P1-ABC123").
      codigo_universal: pieza.codigo_pieza,
      nombre: pieza.nombre,
      marca: marca?.nombre ?? item.marca_nombre ?? '',
      vehiculo: '',
      precio_venta: pieza.precio_unitario ?? item.precio_unitario,
      unidad: 'pieza',
      creado_en: new Date().toISOString(),
    }
    setEtiquetaPieza({
      etiqueta,
      subtitulo: `${pieza.nombre} · de ${item.producto_nombre}`,
    })
  }

  const handleConfirmarMarcarListo = async (item: ItemOrden) => {
    if (!selectedOrden) return
    const ordenId = selectedOrden.id
    const itemId = item.id
    setPendingMarcarListoItem(null)
    try {
      if (item.es_parcial && item.piezas_orden?.[0]) {
        const pieza = item.piezas_orden[0]
        await api.post(
          `/OrdenVenta/${ordenId}/Items/${itemId}/Piezas/${pieza.id}/ListoAlmacenero`,
          null
        )
      } else {
        await api.post(
          `/OrdenVenta/${ordenId}/Items/${itemId}/MarcarListoIndividual`,
          null
        )
      }
      markItemListoEnOrden(ordenId, itemId)
      playConfirmBeep()
      notify.success(`${item.producto_nombre} marcado como listo`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al marcar como listo')
    } finally {
      scanInputRef.current?.focus()
    }
  }

  const handleAgregarProducto = async (req: AgregarRequest) => {
    if (!selectedOrden) return
    return ejecutarAgregarProducto(req)
  }

  const ejecutarAgregarProducto = async (req: AgregarRequest) => {
    if (!selectedOrden) return
    setAgregarLoading(true)
    try {
      if (req.tipo === 'piezas_sueltas') {
        let lastItem: ItemOrden | null = null
        for (const { pieza, cantidad, precio } of req.piezas) {
          const res = await api.post<AgregarItemOrdenResponse>(
            `/OrdenVenta/${selectedOrden.id}/AgregarItem`,
            { Id_Producto: parseInt(req.kitProducto.id), Id_Pieza: pieza.id, Cantidad: cantidad, PrecioUnitario: precio }
          )
          const newItem: ItemOrden = {
            id: String(res.id),
            producto_id: String(res.idProducto ?? parseInt(req.kitProducto.id)),
            producto_codigo: res.producto.codigo,
            producto_nombre: res.producto.nombre,
            marcaId: req.kitProducto.marcaId ?? null,
            marca_nombre: req.kitProducto.marca ?? undefined,
            producto_almacen: '',
            producto_estante: '',
            producto_fila: '',
            producto_columna: '',
            cantidad_pedida: res.cantidad,
            precio_unitario: precio,
            subtotal: precio * res.cantidad,
            estado: 'pendiente',
            kit_id: req.kitProducto.id,
            es_parcial: true,
            piezas_orden: res.piezas?.[0] ? [{
              id: res.piezas[0].id,
              id_pieza: res.piezas[0].idPieza,
              nombre: pieza.nombre,
              cantidad: res.cantidad,
              precio_unitario: precio,
            }] : undefined,
          }
          addItemToOrden(selectedOrden.id, newItem)
          lastItem = newItem
        }
        notify.success(`Piezas de ${req.kitProducto.nombre} agregadas — almacén notificado`)
        if (lastItem) setPendingMarcarListoItem(lastItem)
      } else {
        const { producto, cantidad, precioUnitario } = req
        const res = await api.post<AgregarItemOrdenResponse>(
          `/OrdenVenta/${selectedOrden.id}/AgregarItem`,
          {
            Id_Producto: parseInt(producto.id),
            Cantidad: cantidad,
            PrecioUnitario: precioUnitario,
          }
        )
        const subtotalCalculado = precioUnitario * res.cantidad
        const newItem: ItemOrden = {
          id: String(res.id),
          producto_id: String(res.idProducto ?? parseInt(producto.id)),
          producto_codigo: res.producto.codigo,
          producto_nombre: res.producto.nombre,
          marcaId: producto.marcaId ?? null,
          marca_nombre: producto.marca ?? undefined,
          producto_almacen: producto.almacen,
          producto_estante: producto.estante,
          producto_fila: producto.fila,
          producto_columna: producto.columna,
          cantidad_pedida: res.cantidad,
          precio_unitario: precioUnitario,
          subtotal: subtotalCalculado,
          estado: 'pendiente',
          es_kit: res.producto.esKit,
          precio_base: precioUnitario,
        }
        addItemToOrden(selectedOrden.id, newItem)
        notify.success(`${newItem.producto_nombre} agregado — almacén notificado`)
        setPendingMarcarListoItem(newItem)
      }
      setShowAgregarModal(false)
      scanInputRef.current?.focus()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al agregar')
    } finally {
      setAgregarLoading(false)
    }
  }

  const autoConfirmarItem = useCallback(async (item: ItemOrden) => {
    if (!selectedOrden) return
    setConfirmLoading(true)
    try {
      await api.post(`/OrdenVenta/${selectedOrden.id}/Items/${item.id}/Confirmar`, undefined)
      setConfirmedItemIds(prev => new Set([...prev, item.id]))
      setFlashItemId(item.id)
      setTimeout(() => setFlashItemId(null), 1200)
      playConfirmBeep()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al confirmar')
    } finally {
      setConfirmLoading(false)
      scanInputRef.current?.focus()
    }
  }, [selectedOrden, playConfirmBeep])

  const handleScan = (code: string) => {
    if (!selectedOrden) return
    // Guard: ignore scan if any modal is open
    if (pendingConfirmItem || pendingNotInOrderCode !== null || selectMultipleMatches.length > 0 || pendingPiezaScan) return

    // 1) Match contra codigo_pieza de cualquier pieza de la orden
    // (se hace antes del parseo por guion porque el codigo_pieza incluye la marca
    // del kit padre y ya tiene guiones: ej. "P1-TY-ABC123")
    const codeTrimmed = code.trim()
    const codeLower = codeTrimmed.toLowerCase()
    for (const item of selectedOrden.items) {
      if (!item.es_parcial || !item.piezas_orden) continue
      const pieza = item.piezas_orden.find(
        (p) => p.codigo_pieza && p.codigo_pieza.toLowerCase() === codeLower,
      )
      if (pieza) {
        if (pieza.confirmado) {
          notify.warning('Esta pieza ya fue confirmada')
          return
        }

        // Flujo "producto normal": N escaneos = N unidades. El modal de precio
        // aparece solo en el último escaneo (cuando se completa la cantidad).
        // Si la pieza es parcial con faltante, se confirma la cantidad recogida.
        const esPiezaParcial = !!pieza.nota_incompleto && (pieza.cantidad_recogida ?? 0) > 0
        const targetQty = esPiezaParcial ? pieza.cantidad_recogida! : pieza.cantidad
        const current = piezaScanCounts[pieza.id] ?? 0
        const next = current + 1

        playConfirmBeep()
        setFlashPiezaId(String(pieza.id))
        setTimeout(() => setFlashPiezaId(null), 600)

        if (next >= targetQty) {
          // Última unidad → limpiar counter y abrir modal de precio
          setPiezaScanCounts(prev => { const n = { ...prev }; delete n[pieza.id]; return n })
          setPendingPiezaScan({ item, pieza })
        } else {
          setPiezaScanCounts(prev => ({ ...prev, [pieza.id]: next }))
        }
        return
      }
    }

    // El código se usa tal cual llega. Compatibilidad con etiquetas viejas
    // (formato PREFIJO-CODIGO con un guion) se resuelve en el backend
    // mediante fallback por último segmento después del guion.
    const resolvedCode = code

    const resolvedCodeLower = resolvedCode.toLowerCase().trim()
    const matched = itemsEscaneables.filter((i) => {
      const codeMatch = i.producto_codigo.toLowerCase() === resolvedCodeLower || i.producto_id.toLowerCase() === resolvedCodeLower
      return codeMatch
    })

    if (matched.length > 1) {
      setSelectMultipleMatches(matched)
      return
    }

    if (matched.length === 1) {
      const item = matched[0]
      // Ítems parciales: el código del kit padre no es escaneable directamente
      if (item.es_parcial) {
        notify.warning('Escanea el código de cada pieza individualmente')
        return
      }
      if (confirmedItemIds.has(item.id)) {
        notify.warning('Este ítem ya fue confirmado')
        return
      }
      // Kit no-parcial: una pasada confirma todo
      if (item.kit_id && !item.es_parcial) {
        autoConfirmarItem(item)
        return
      }
      // Kit parcial: abrir modal
      if (item.kit_id && item.es_parcial) {
        setPendingConfirmItem(item)
        return
      }
      // Producto regular: contar de a 1
      const targetQty = item.estado === 'faltante'
        ? (item.cantidad_recogida ?? 0)
        : item.cantidad_pedida
      const current = scanCounts[item.id] ?? 0
      const next = current + 1

      playConfirmBeep()
      setFlashItemId(item.id)
      setTimeout(() => setFlashItemId(null), 600)

      if (next >= targetQty) {
        // Última unidad → confirmar en backend y limpiar contador
        setScanCounts(prev => { const n = { ...prev }; delete n[item.id]; return n })
        autoConfirmarItem(item)
      } else {
        setScanCounts(prev => ({ ...prev, [item.id]: next }))
      }
      return
    }

    // Not found in order — el backend lo resuelve con fallback por último segmento
    setPendingNotInOrderMarcaId(null)
    setPendingNotInOrderCode(code)
  }

  // Listener global: si el operador escanea con la pistola desde cualquier parte
  // de la página (no necesita hacer click en el input de escaneo), enfocamos
  // el input y le inyectamos los caracteres que ya se tipearon. A partir de ahí
  // el onKeyDown existente del input se encarga del Enter → handleScan.
  //
  // Heurística: las pistolas tipean a < 50ms entre caracteres. Un humano no.
  useEffect(() => {
    if (!selectedOrden) return

    let buffer = ''
    let lastKeyTime = 0
    const SCAN_CHAR_INTERVAL_MS = 50

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTextInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        !!target?.isContentEditable

      // El usuario está escribiendo en un input (puede ser el de escaneo u otro).
      // Dejamos pasar la tecla al input y reseteamos nuestro buffer.
      if (isTextInput) {
        buffer = ''
        lastKeyTime = 0
        return
      }

      // Solo nos importan los caracteres imprimibles
      if (e.key.length !== 1) {
        buffer = ''
        lastKeyTime = 0
        return
      }

      const now = performance.now()
      const dt = lastKeyTime === 0 ? Infinity : now - lastKeyTime
      lastKeyTime = now

      if (buffer.length === 0) {
        // Primer char: bufferear silenciosamente (no es suficiente para saber
        // si es un scan; esperamos al segundo)
        buffer = e.key
        return
      }

      if (dt < SCAN_CHAR_INTERVAL_MS) {
        // Segundo char llegó rápido: es un scan. Enfocamos el input de escaneo
        // y le inyectamos el buffer + el char actual. A partir de acá el input
        // recibe los chars restantes y el Enter por su cuenta.
        //
        // ⚠ preventDefault es crítico: sin él, el navegador hace su acción
        // por defecto del keydown (insertar el char en el input enfocado),
        // lo que duplica el último char. Ej: buffer="P" + e.key="1" → seteamos
        // input.value="P1" y enfocamos, pero el default mete "1" otra vez → "P11".
        const input = scanInputRef.current
        if (input && !input.disabled) {
          input.value = buffer + e.key
          input.focus()
          e.preventDefault()
        }
        buffer = ''
      } else {
        // Tipeo humano lento, reseteamos y empezamos de nuevo
        buffer = e.key
      }
    }

    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [selectedOrden])

  const handleSelectMatch = (item: ItemOrden) => {
    setSelectMultipleMatches([])
    if (confirmedItemIds.has(item.id)) {
      notify.warning('Este ítem ya fue confirmado')
      return
    }
    if (item.kit_id && !item.es_parcial) {
      autoConfirmarItem(item)
      return
    }
    setPendingConfirmItem(item)
  }

  const handleConfirmScan = async (precio?: number) => {
    if (!pendingConfirmItem || !selectedOrden) return
    const item = pendingConfirmItem
    setConfirmLoading(true)
    try {
      if (item.es_parcial && item.piezas_orden?.[0]) {
        const pieza = item.piezas_orden[0]
        await api.post(
          `/OrdenVenta/${selectedOrden.id}/Items/${item.id}/Piezas/${pieza.id}/Confirmar`,
          { precioUnitario: precio ?? item.precio_unitario }
        )
      } else {
        const body = item.kit_id && precio !== undefined ? { precioUnitario: precio } : undefined
        await api.post(`/OrdenVenta/${selectedOrden.id}/Items/${item.id}/Confirmar`, body)
      }
      setConfirmedItemIds(prev => new Set([...prev, item.id]))
      if (item.estado === 'pendiente') {
        updateItemEstadoEnOrden(selectedOrden.id, item.id, 'listo_almacenero')
      }
      playConfirmBeep()
      notify.success(`${item.producto_nombre} confirmado`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al confirmar')
    } finally {
      setConfirmLoading(false)
      setPendingConfirmItem(null)
      scanInputRef.current?.focus()
    }
  }

  const handleAgregarItem = async (cantidad: number, precio?: number, piezas?: { piezaId: number; cantidad: number; precio: number }[]) => {
    if (!pendingNotInOrderCode || !selectedOrden || !notInOrderProducto) return
    const p = notInOrderProducto
    // Camino A: producto/kit (no pieza). Si ya existe en la orden, heredar su precio; si no, usar el precio base.
    if (piezas == null && p.piezaEscaneadaId == null) {
      const existingItem = itemsParaEscanear.find(
        i => i.producto_id === String(p.id) && !i.es_parcial
      )
      return ejecutarAgregarItemA(
        cantidad,
        existingItem ? existingItem.precio_unitario : p.precio,
        piezas
      )
    }
    return ejecutarAgregarItemA(cantidad, precio, piezas)
  }

  const ejecutarAgregarItemA = async (cantidad: number, precio?: number, piezas?: { piezaId: number; cantidad: number; precio: number }[]) => {
    if (!selectedOrden || !notInOrderProducto) return
    const p = notInOrderProducto
    setAgregarLoading(true)
    try {
      if (piezas && piezas.length > 0) {
        let lastItem: ItemOrden | null = null
        for (const { piezaId, cantidad: cantPieza, precio: precioPieza } of piezas) {
          if (cantPieza <= 0) continue
          const res = await api.post<AgregarItemOrdenResponse>(
            `/OrdenVenta/${selectedOrden.id}/AgregarItem`,
            { Id_Producto: p.id, Id_Pieza: piezaId, Cantidad: cantPieza, PrecioUnitario: precioPieza }
          )
          const piezaItemId = res.piezas![0].id
          const parts = (res.producto.ubicacion ?? '').split('/')
          const [almacen = '', estante = '', fila = '', columna = ''] =
            parts.length >= 4 ? parts : ['', ...parts]
          const piezaCatalogo = p.piezas?.find(pz => pz.id === piezaId)
          const newItem: ItemOrden = {
            id: String(res.id),
            producto_id: String(res.idProducto ?? p.id),
            producto_codigo: res.producto.codigo,
            producto_nombre: res.producto.nombre,
            marcaId: p.marcaId,
            marca_nombre: marcas.find(m => m.id === p.marcaId)?.nombre,
            producto_almacen: almacen,
            producto_estante: estante,
            producto_fila: fila,
            producto_columna: columna,
            cantidad_pedida: res.cantidad,
            precio_unitario: precioPieza,
            subtotal: precioPieza * res.cantidad,
            estado: 'pendiente',
            es_parcial: true,
            piezas_orden: [{
              id: piezaItemId,
              id_pieza: res.piezas![0].idPieza,
              nombre: piezaCatalogo?.nombre ?? '',
              cantidad: res.cantidad,
              precio_unitario: precioPieza,
            }],
          }
          addItemToOrden(selectedOrden.id, newItem)
          lastItem = newItem
        }
        notify.info(`Piezas de ${p.nombre} agregadas a la orden`)
        setPendingNotInOrderCode(null)
        setPendingNotInOrderMarcaId(null)
        setNotInOrderProducto(null)
        if (lastItem) setPendingMarcarListoItem(lastItem)
        return
      }

      const body: { Id_Producto?: number; Id_Pieza?: number; Cantidad: number; PrecioUnitario?: number } = { Cantidad: cantidad }
      if (p.piezaEscaneadaId != null) {
        body.Id_Producto = p.id
        body.Id_Pieza = p.piezaEscaneadaId
        body.PrecioUnitario = precio
      } else {
        body.Id_Producto = p.id
        body.PrecioUnitario = precio
      }
      const res = await api.post<AgregarItemOrdenResponse>(
        `/OrdenVenta/${selectedOrden.id}/AgregarItem`,
        body
      )
      const parts = (res.producto.ubicacion ?? '').split('/')
      const [almacen = '', estante = '', fila = '', columna = ''] =
        parts.length >= 4 ? parts : ['', ...parts]
      let newItem: ItemOrden
      if (res.esParcial && res.piezas?.[0]) {
        const piezaItemId = res.piezas[0].id
        const piezaCatalogo = p.piezas?.find(pz => pz.id === res.piezas![0].idPieza)
        newItem = {
          id: String(res.id),
          producto_id: String(res.idProducto ?? p.id),
          producto_codigo: res.producto.codigo,
          producto_nombre: res.producto.nombre,
          producto_almacen: almacen,
          producto_estante: estante,
          producto_fila: fila,
          producto_columna: columna,
          cantidad_pedida: res.cantidad,
          precio_unitario: res.precioUnitario,
          subtotal: res.precioUnitario * res.cantidad,
          estado: 'pendiente',
          es_parcial: true,
          piezas_orden: [{
            id: piezaItemId,
            id_pieza: res.piezas[0].idPieza,
            nombre: piezaCatalogo?.nombre ?? '',
            cantidad: res.cantidad,
            precio_unitario: res.precioUnitario,
          }],
        }
      } else {
        newItem = {
          id: String(res.id),
          producto_id: String(res.idProducto ?? p.id),
          producto_codigo: res.producto.codigo,
          producto_nombre: res.producto.nombre,
          marcaId: p.marcaId,
          marca_nombre: marcas.find(m => m.id === p.marcaId)?.nombre,
          producto_almacen: almacen,
          producto_estante: estante,
          producto_fila: fila,
          producto_columna: columna,
          cantidad_pedida: res.cantidad,
          precio_unitario: res.precioUnitario,
          subtotal: res.precioUnitario * res.cantidad,
          estado: 'pendiente',
          es_kit: res.producto.esKit,
          precio_base: precio,
        }
      }
      addItemToOrden(selectedOrden.id, newItem)
      notify.info(`${newItem.producto_nombre} agregado a la orden`)
      setPendingNotInOrderCode(null)
      setPendingNotInOrderMarcaId(null)
      setNotInOrderProducto(null)
      setPendingMarcarListoItem(newItem)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al agregar')
    } finally {
      setAgregarLoading(false)
    }
  }

  const handleMarcarEsperandoPago = async () => {
    if (!selectedOrden) return
    try {
      await api.post(`/OrdenVenta/${selectedOrden.id}/MarcarEsperandoPago`, undefined)
      updateOrden(selectedOrden.id, { estado: 'esperando_pago' })
      notify.success('Orden enviada a caja para cobro')
      setSelectedOrdenId(null)
      setConfirmedItemIds(new Set())
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al enviar a caja')
    } finally {
      setCompletarLoading(false)
    }
  }

  const ordenesDisponibles = ordenes.filter((o) => o.estado === 'listo_para_escaneo' || o.estado === 'con_faltantes')

  return (
    <MainLayout>
      <div className="bg-[#F7F7F7] min-h-screen">

        {/* ── TopBar ── */}
        <header className="bg-[#F7F7F7]/85 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full h-[62px] px-7 border-b border-[#E8E5E2]">
          <div className="flex items-center gap-2 text-sm text-[#7A7571]">
            <span>Ventas</span>
            <span className="text-[10px] opacity-40">/</span>
            <strong className="text-[#2D2B2A] font-semibold">Punto de escaneo</strong>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex bg-white px-3.5 py-1.5 rounded-lg items-center gap-2 border border-[#D8D4D0]">
              <i className="ti ti-calendar text-[#7A7571] text-[15px]" />
              <span className="text-xs text-[#4A4744]">{dateStr}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className="w-[34px] h-[34px] flex items-center justify-center rounded-full bg-white border border-[#D8D4D0] text-[#4A4744] hover:bg-[#F7F7F7] transition-colors relative"
                title="Notificaciones"
              >
                <i className="ti ti-bell text-[15px]" />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#B23A2A]" />
              </button>
              <button
                className="w-[34px] h-[34px] flex items-center justify-center rounded-full bg-white border border-[#D8D4D0] text-[#4A4744] hover:bg-[#F7F7F7] transition-colors"
                title="Configuración"
              >
                <i className="ti ti-settings text-[15px]" />
              </button>
            </div>
          </div>
        </header>

        <div className="px-7 pt-4 pb-0 max-w-[1400px] mx-auto">

          {/* ── Page Header ── */}
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-semibold text-[22px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Punto de escaneo
            </h2>
            <span className="text-[12px] text-[#7A7571]">Confirma productos y envía órdenes a caja</span>
          </div>

          <div className="flex gap-5" style={{ height: 'calc(100vh - 148px)' }}>

            {/* ── Lista de órdenes ── */}
            <div className="w-72 shrink-0 flex flex-col gap-2.5 overflow-y-auto">
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em]">Órdenes</p>
                <button
                  onClick={handleRecargar}
                  disabled={loadingOrdenes}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#D8D4D0] text-[#4A4744] text-[11px] font-semibold hover:border-[#780e18] hover:text-[#780e18] hover:bg-[#FAF5EE] disabled:opacity-40 transition-all shadow-sm"
                  title="Recargar órdenes"
                >
                  <i className={clsx('ti ti-refresh text-[13px]', loadingOrdenes && 'animate-spin')} />
                  Recargar
                </button>
              </div>
              {loadingOrdenes ? (
                <div className="flex flex-col gap-2.5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="p-4 rounded-xl border border-[#E8E5E2] bg-white animate-pulse">
                      <div className="h-2.5 w-16 bg-[#F0EFEC] rounded mb-2" />
                      <div className="h-3.5 w-32 bg-[#F0EFEC] rounded mb-2" />
                      <div className="h-2.5 w-24 bg-[#F0EFEC] rounded" />
                    </div>
                  ))}
                </div>
              ) : ordenesDisponibles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white border border-[#E8E5E2] flex items-center justify-center mb-4">
                    <i className="ti ti-clipboard-list text-[#D0CBC4] text-xl" />
                  </div>
                  <p className="text-sm font-semibold text-[#2D2B2A] mb-1">Sin órdenes</p>
                  <p className="text-xs text-[#7A7571] font-medium max-w-xs">No hay órdenes listas para escanear.</p>
                </div>
              ) : (
                ordenesDisponibles.map((orden) => (
                  <button
                    key={orden.id}
                    onClick={() => {
                      setSelectedOrdenId(orden.id)
                      setConfirmedItemIds(new Set())
                      setPendingConfirmItem(null)
                      setPendingNotInOrderCode(null)
                      setPendingNotInOrderMarcaId(null)
                      setScanCounts({})
                      setPiezaScanCounts({})
                    }}
                    className={clsx(
                      'w-full text-left p-4 rounded-xl border transition-all',
                      selectedOrdenId === orden.id
                        ? 'border-[#780e18] bg-[#F4ECDB]/40 shadow-sm'
                        : 'border-[#D0CBC4] bg-white hover:border-[#780e18]/30 hover:bg-[#FAF5EE]',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-[10px] font-bold text-[#7A7571] uppercase tracking-wider">{orden.numero}</p>
                      {orden.estado === 'con_faltantes' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200] shrink-0">
                          <i className="ti ti-clock text-[9px]" />
                          Almacén
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#2D2B2A]">{orden.cliente_nombre ?? 'Sin cliente'}</p>
                    <p className="text-xs text-[#7A7571] mt-1">
                      {orden.items.filter((i) => i.estado !== 'faltante').length} ítems · Bs {orden.total.toFixed(2)}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* ── Panel de escaneo ── */}
            <div className="flex-1 flex flex-col bg-white rounded-2xl border border-[#D0CBC4] overflow-hidden">
              {!selectedOrden ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <i className="ti ti-scan text-[60px] text-[#D0CBC4]" />
                  <p className="text-sm text-[#7A7571] font-medium">Selecciona una orden para comenzar a escanear</p>
                </div>
              ) : (
                <>
                  {/* Header del panel */}
                  <div className="px-6 py-4 border-b border-[#E8E5E2]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] mb-0.5">Escaneo</p>
                        <h2 className="text-base font-bold text-[#2D2B2A]">{selectedOrden.numero}</h2>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4ECDB] text-[#780e18] text-xs font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#780e18]" />
                        Pendiente escaneo
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F5F0EB] text-[#4A4744]">
                        {itemsEscaneables.length} para escanear
                      </span>
                      {faltantesCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F5C9C0] text-[#8A1E12]">
                          <i className="ti ti-alert-triangle text-[10px]" />
                          {faltantesCount} faltante{faltantesCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Banner con_faltantes */}
                  {selectedOrden.estado === 'con_faltantes' && (
                    <div className="mx-6 mt-3 px-4 py-3 rounded-xl bg-[#F5E0A8] border border-[#B47A1F]/30 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[#F5E0A8] border border-[#B47A1F]/30 flex items-center justify-center shrink-0">
                        <i className="ti ti-clock text-[#B47A1F] text-[16px]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#7A5200]">Almacenero buscando producto nuevo</p>
                        <p className="text-xs text-[#7A5200]/80">El escaneo está pausado — espera a que el almacenero lo traiga</p>
                      </div>
                    </div>
                  )}

                  {/* Input escaneo */}
                  <div className="px-6 py-3 border-b border-[#E8E5E2]">
                    <div className="flex items-center gap-2 bg-[#F7F7F7] border border-[#D8D4D0] rounded-lg px-3.5 focus-within:border-[#780e18] transition-colors">
                      <i className="ti ti-barcode text-[#7A7571] text-[16px] shrink-0" />
                      <input
                        ref={scanInputRef}
                        autoFocus
                        type="text"
                        disabled={selectedOrden.estado === 'con_faltantes'}
                        placeholder={selectedOrden.estado === 'con_faltantes' ? 'Esperando almacenero…' : 'Escanea o escribe un código y presiona Enter…'}
                        className="flex-1 py-2.5 bg-transparent text-[13px] text-[#2D2B2A] placeholder:text-[#7A7571] outline-none border-none disabled:opacity-50 disabled:cursor-not-allowed"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.currentTarget as HTMLInputElement).value.trim().replace(/'/g, '-')
                            if (val) handleScan(val)
                            ;(e.currentTarget as HTMLInputElement).value = ''
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Lista de ítems */}
                  <div className="flex-1 overflow-y-auto">

                    {/* ── ÍTEMS ENCONTRADOS ── */}
                    <div className="px-6 pt-4 pb-2">
                      <p className="text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] mb-3">Ítems encontrados</p>
                      <div className="space-y-2">
                        {itemsParaEscanear.map((item) => {
                          const isKit = !!item.kit_id
                          const isParcialKit = isKit && item.diferencia_kit !== undefined
                          const confirmed = isItemConfirmed(item)
                          const isPendiente = item.estado === 'pendiente'
                          const isLoadingItem = !!itemLoading[item.id]
                          const isConfirmandoEliminar = confirmEliminar === item.id
                          const isFlashing = flashItemId === item.id

                          // Piezas sueltas — cada pieza como fila independiente, sin header del kit padre
                          if (item.es_parcial && item.piezas_orden?.length) {
                            return (
                              <Fragment key={item.id}>
                                {item.piezas_orden.map((pieza) => {
                                  const piezaConfirmada = confirmedPiezaIds.has(pieza.id) || !!pieza.confirmado
                                  const esPiezaFaltante = !!pieza.nota_incompleto && !(pieza.cantidad_recogida ?? 0)
                                  const esPiezaParcial = !!pieza.nota_incompleto && (pieza.cantidad_recogida ?? 0) > 0
                                  const esPiezaLista = !!pieza.listo_almacenero
                                  const cantidadConfirmar = esPiezaParcial ? pieza.cantidad_recogida! : pieza.cantidad
                                  const cantidadFaltante = esPiezaParcial ? pieza.cantidad - pieza.cantidad_recogida! : 0
                                  const loadingPieza = !!piezaLoading[pieza.id]
                                  const piezaScanCount = piezaScanCounts[pieza.id] ?? 0
                                  const isPiezaFlashing = flashPiezaId === String(pieza.id)
                                  if (esPiezaFaltante) return null
                                  return (
                                    <div
                                      key={pieza.id}
                                      className={clsx(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300',
                                        esPiezaFaltante ? 'border-[#F5C9C0] bg-[#F5C9C0]/20' :
                                        esPiezaParcial ? 'border-[#B47A1F]/30 bg-[#F5E0A8]/20' :
                                        piezaConfirmada ? 'border-[#3F7A52]/30 bg-[#B8DCCA]/20' :
                                        esPiezaLista ? 'border-[#B47A1F]/30 bg-[#F5E0A8]/20' :
                                        isPiezaFlashing ? 'border-[#780e18] bg-[#F4ECDB]/40' :
                                        'border-[#D0CBC4] bg-white'
                                      )}
                                    >
                                      <ProductThumb
                                        src={productoImagenes[item.producto_id]}
                                        nombre={item.producto_nombre ?? undefined}
                                        size="sm"
                                        onClick={() => setGalleryProducto({
                                          id: item.producto_id,
                                          codigo_universal: item.producto_codigo,
                                          nombre: item.producto_nombre ?? '',
                                        } as Producto)}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <p className="text-[10px] font-mono font-semibold text-[#7A7571] truncate leading-none">
                                            {item.producto_codigo}
                                          </p>
                                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] tracking-wider shrink-0">
                                            KIT
                                          </span>
                                          <p className="text-[10px] font-semibold text-[#4A4744] truncate leading-none">
                                            {item.producto_nombre}
                                          </p>
                                        </div>
                                        <p className="text-sm font-semibold text-[#2D2B2A] leading-snug truncate flex items-center gap-1.5">
                                          {pieza.codigo_pieza && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono font-bold text-[10px] bg-[#780e18] text-white shrink-0">
                                              {pieza.codigo_pieza}
                                            </span>
                                          )}
                                          <span className="truncate">{pieza.nombre} · ×{cantidadConfirmar}</span>
                                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200] tracking-wider shrink-0">
                                            PIEZA
                                          </span>
                                          <button
                                            onClick={() => handleImprimirPieza(item, pieza)}
                                            disabled={!pieza.codigo_pieza}
                                            title={pieza.codigo_pieza ? `Imprimir etiqueta de la pieza (${pieza.codigo_pieza})` : 'La pieza no tiene código'}
                                            className="w-6 h-6 flex items-center justify-center rounded-md border border-[#E8E5E2] text-[#4A4744] hover:bg-[#F0EFEC] hover:text-[#2D2B2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                                          >
                                            <i className="ti ti-printer text-[10px]" />
                                          </button>
                                        </p>
                                        {esPiezaParcial && (
                                          <p className="text-xs text-[#B47A1F] leading-none mt-0.5">×{cantidadFaltante} faltantes</p>
                                        )}
                                      </div>
                                      {esPiezaFaltante ? (
                                        <span className="px-2.5 py-1 rounded-lg bg-[#F5C9C0] text-[#8A1E12] text-xs font-bold shrink-0">No disponible</span>
                                      ) : piezaConfirmada ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#B8DCCA] text-[#1E5C38] text-xs font-bold shrink-0">
                                          <i className="ti ti-check text-[10px]" />
                                          Bs {((confirmedPiezaPrices[pieza.id] ?? pieza.precio_unitario ?? 0) * cantidadConfirmar).toFixed(2)}
                                        </span>
                                      ) : (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {esPiezaLista && !piezaScanCount && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F5E0A8] text-[#7A5200] text-[10px] font-bold shrink-0">
                                              <i className="ti ti-package-import text-[9px]" />
                                              Lista
                                            </span>
                                          )}
                                          {piezaScanCount > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F4ECDB] text-[#780e18] text-[10px] font-bold shrink-0">
                                              <i className="ti ti-barcode text-[9px]" />
                                              {piezaScanCount}/{cantidadConfirmar}
                                            </span>
                                          )}
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="Bs"
                                            value={piezaPrecios[pieza.id] ?? (pieza.precio_unitario ? pieza.precio_unitario.toFixed(2) : '')}
                                            onChange={(e) => setPiezaPrecios(prev => ({ ...prev, [pieza.id]: e.target.value }))}
                                            className="w-20 h-8 px-2 rounded-lg border border-[#E8E5E2] bg-white text-[#2D2B2A] text-xs text-center font-bold focus:outline-none focus:border-[#780e18] transition-all"
                                          />
                                          <button
                                            onClick={() => handleConfirmarPieza(item, pieza)}
                                            disabled={loadingPieza}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] font-bold text-sm disabled:opacity-50 transition-colors"
                                          >
                                            {loadingPieza ? <i className="ti ti-loader-2 animate-spin text-[12px]" /> : <i className="ti ti-check text-[12px]" />}
                                          </button>
                                          {!esPiezaLista && (
                                            <>
                                              <button
                                                onClick={() => handleAjustarCantidadPieza(item, pieza)}
                                                disabled={loadingPieza}
                                                title={pieza.cantidad > 1 ? 'Reducir stock en 1' : 'Eliminar pieza'}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E8E5E2] text-[#7A7571] hover:bg-[#F0EFEC] hover:text-[#2D2B2A] transition-colors disabled:opacity-50"
                                              >
                                                <i className="ti ti-minus text-[11px]" />
                                              </button>
                                              <button
                                                onClick={() => handleEliminarPieza(item, pieza)}
                                                disabled={loadingPieza}
                                                title="Eliminar pieza"
                                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#F5C9C0]/40 text-[#B23A2A] hover:bg-[#F5C9C0]/30 transition-colors disabled:opacity-50"
                                              >
                                                <i className="ti ti-trash text-[11px]" />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </Fragment>
                            )
                          }

                          // Fallback: es_parcial sin piezas cargadas — no mostrar botón confirmar
                          if (item.es_parcial) return null

                          // Ítem normal
                          const isParcialFaltante = item.estado === 'faltante' && (item.cantidad_recogida ?? 0) > 0
                          const cantidadEscanear = isParcialFaltante ? (item.cantidad_recogida ?? 0) : item.cantidad_pedida

                          return (
                            <div
                              key={item.id}
                              className={clsx(
                                'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300',
                                isFlashing ? 'border-[#3F7A52]/40 bg-[#B8DCCA]/30 scale-[1.01]' :
                                confirmed ? 'border-[#3F7A52]/30 bg-[#B8DCCA]/20' :
                                isPendiente ? 'border-[#B47A1F]/30 bg-[#F5E0A8]/20' :
                                isParcialFaltante ? 'border-[#B47A1F]/30 bg-[#F5E0A8]/20' :
                                'border-[#D0CBC4] bg-white'
                              )}
                            >
                              {/* Thumb */}
                              <ProductThumb
                                src={productoImagenes[item.producto_id]}
                                nombre={item.producto_nombre ?? undefined}
                                size="sm"
                                onClick={() => setGalleryProducto({
                                  id: item.producto_id,
                                  codigo_universal: item.producto_codigo,
                                  nombre: item.producto_nombre ?? '',
                                } as Producto)}
                              />

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 leading-none">
                                  <p className="text-xs font-mono text-[#7A7571] truncate">{item.producto_codigo}</p>
                                  {isKit && !isPendiente && (
                                    <span className={clsx('text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wider shrink-0', isParcialKit ? 'bg-[#F5E0A8] text-[#7A5200]' : 'bg-[#E8D4B8] text-[#780e18]')}>
                                      {isParcialKit ? 'PARCIAL' : 'KIT'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-[#2D2B2A] leading-snug truncate">
                                  {item.producto_nombre} · ×{cantidadEscanear}
                                </p>
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
                                {!confirmed && !isKit && (scanCounts[item.id] ?? 0) > 0 && (
                                  <p className="text-[11px] font-bold text-[#780e18] mt-0.5">
                                    {scanCounts[item.id]}/{cantidadEscanear} escaneados
                                  </p>
                                )}
                              </div>

                              {/* Acciones */}
                              {confirmed ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#B8DCCA] text-[#1E5C38] text-xs font-bold shrink-0">
                                  <i className="ti ti-check text-[10px]" />
                                  Confirmado
                                </span>
                              ) : isPendiente ? (
                                isConfirmandoEliminar ? (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs text-[#B23A2A] font-semibold">¿Eliminar?</span>
                                    <button
                                      onClick={() => handleEliminarItem(item)}
                                      disabled={isLoadingItem}
                                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-[#B23A2A] text-white hover:bg-[#8A1E12] disabled:opacity-50 transition-colors"
                                    >
                                      {isLoadingItem ? <i className="ti ti-loader-2 animate-spin text-[11px]" /> : 'Sí'}
                                    </button>
                                    <button
                                      onClick={() => setConfirmEliminar(null)}
                                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-[#F0EFEC] text-[#4A4744] hover:bg-[#E8E5E2] transition-colors"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => handleAjustarCantidad(item, -1)}
                                      disabled={isLoadingItem || item.cantidad_pedida <= 1}
                                      className="w-6 h-6 rounded border border-[#E8E5E2] bg-white flex items-center justify-center text-[#4A4744] hover:bg-[#F0EFEC] disabled:opacity-40 transition-colors"
                                    >
                                      <i className="ti ti-minus text-[10px]" />
                                    </button>
                                    <span className="w-5 text-center text-xs font-bold text-[#2D2B2A]">{isLoadingItem ? '…' : item.cantidad_pedida}</span>
                                    <button
                                      onClick={() => handleAjustarCantidad(item, +1)}
                                      disabled={isLoadingItem}
                                      className="w-6 h-6 rounded border border-[#E8E5E2] bg-white flex items-center justify-center text-[#4A4744] hover:bg-[#F0EFEC] disabled:opacity-40 transition-colors"
                                    >
                                      <i className="ti ti-plus text-[10px]" />
                                    </button>
                                    <button
                                      onClick={() => setConfirmEliminar(item.id)}
                                      disabled={isLoadingItem}
                                      className="w-6 h-6 rounded border border-[#F5C9C0] bg-white flex items-center justify-center text-[#B23A2A] hover:bg-[#F5C9C0] disabled:opacity-40 transition-colors ml-0.5"
                                    >
                                      <i className="ti ti-trash text-[11px]" />
                                    </button>
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F5E0A8] text-[#7A5200] text-[10px] font-bold ml-1">
                                      <i className="ti ti-clock text-[9px]" />
                                      Almacén
                                    </span>
                                  </div>
                                )
                              ) : (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => setConfirmEliminar(item.id)}
                                    disabled={isLoadingItem}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#7A7571] hover:text-[#B23A2A] hover:bg-[#F5C9C0]/40 transition-colors disabled:opacity-40"
                                  >
                                    <i className="ti ti-trash text-[14px]" />
                                  </button>
                                  {isConfirmandoEliminar ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleEliminarItem(item)}
                                        disabled={isLoadingItem}
                                        className="px-2 py-1 text-[11px] font-bold rounded-lg bg-[#B23A2A] text-white hover:bg-[#8A1E12] disabled:opacity-50 transition-colors"
                                      >
                                        {isLoadingItem ? <i className="ti ti-loader-2 animate-spin text-[11px]" /> : 'Sí'}
                                      </button>
                                      <button
                                        onClick={() => setConfirmEliminar(null)}
                                        className="px-2 py-1 text-[11px] font-bold rounded-lg bg-[#F0EFEC] text-[#4A4744] hover:bg-[#E8E5E2] transition-colors"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setPendingConfirmItem(item)}
                                      className="px-3 py-1.5 rounded-lg bg-[#780e18] text-white text-xs font-bold hover:bg-[#B23A2A] transition-colors"
                                    >
                                      Confirmar
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* ── FALTANTES ── */}
                    {(faltanteItems.length > 0 || faltantePiezas.length > 0) && (
                      <div className="px-6 pt-3 pb-4">
                        <p className="text-[10.5px] font-semibold text-[#8A1E12] uppercase tracking-[0.12em] mb-3">Faltantes (no se cobran)</p>
                        <div className="space-y-2">
                          {faltanteItems.map(item => {
                            const recogida = item.cantidad_recogida ?? 0
                            const cantidadFaltante = item.cantidad_pedida - recogida
                            return (
                              <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#F5C9C0] bg-[#F5C9C0]/20">
                                <div className="h-8 w-8 rounded-full bg-[#F5C9C0] flex items-center justify-center shrink-0">
                                  <i className="ti ti-x text-[#B23A2A] text-[14px]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-mono text-[#D0CBC4] line-through leading-none">{item.producto_codigo}</p>
                                  <p className="text-sm text-[#7A7571] line-through leading-snug truncate">{item.producto_nombre} · ×{cantidadFaltante}</p>
                                  {(item.producto_categoria || item.producto_procedencia) && (
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#B23A2A]/70 line-through leading-tight">
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
                                </div>
                                <span className="px-2.5 py-1 rounded-lg bg-[#F5C9C0] text-[#8A1E12] text-xs font-bold shrink-0">No disponible</span>
                              </div>
                            )
                          })}
                          {faltantePiezas.map(({ itemNombre, pieza }) => (
                            <div key={`pieza-faltante-${pieza.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#F5C9C0] bg-[#F5C9C0]/20">
                              <div className="h-8 w-8 rounded-full bg-[#F5C9C0] flex items-center justify-center shrink-0">
                                <i className="ti ti-x text-[#B23A2A] text-[14px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-[#7A7571] line-through leading-snug truncate">{itemNombre} — {pieza.nombre} · ×{pieza.cantidad}</p>
                              </div>
                              <span className="px-2.5 py-1 rounded-lg bg-[#F5C9C0] text-[#8A1E12] text-xs font-bold shrink-0">No disponible</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 border-t border-[#E8E5E2] bg-[#F5F0EB] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] text-[#7A7571] font-medium">Total a cobrar (sin faltantes)</p>
                        <p className="text-[22px] font-semibold text-[#2D2B2A] leading-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                          Bs {totalSinFaltantes.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAgregarModal(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#D0CBC4] bg-white text-[#4A4744] hover:bg-[#F4ECDB] hover:text-[#780e18] hover:border-[#780e18] transition-all"
                      >
                        <i className="ti ti-plus text-[11px] mr-1" />
                        Agregar producto
                      </button>
                    </div>
                    <button
                      className="w-full py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-xl text-sm font-bold active:scale-[0.99] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={handleMarcarEsperandoPago}
                      disabled={!allConfirmed || completarLoading}
                    >
                      {completarLoading
                        ? <><i className="ti ti-loader-2 animate-spin text-base mr-1.5" />Enviando…</>
                        : selectedOrden.estado === 'con_faltantes'
                          ? <><i className="ti ti-clock text-base mr-1.5" />Esperando almacenero…</>
                          : <><i className="ti ti-cash-register text-base mr-1.5" />Enviar a caja</>
                      }
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      {selectMultipleMatches.length > 0 && (
        <LineSelectionModal
          matches={selectMultipleMatches}
          onSelect={handleSelectMatch}
          onClose={() => {
            setSelectMultipleMatches([])
            scanInputRef.current?.focus()
          }}
        />
      )}

      {pendingConfirmItem && (
        <ScanConfirmModal
          item={pendingConfirmItem}
          onConfirm={handleConfirmScan}
          onCancel={() => {
            setPendingConfirmItem(null)
            scanInputRef.current?.focus()
          }}
          loading={confirmLoading}
        />
      )}

      {pendingNotInOrderCode !== null && (
        <ScanNotInOrderModal
          code={pendingNotInOrderCode}
          producto={notInOrderProducto}
          fetchLoading={notInOrderLoading}
          onAgregar={handleAgregarItem}
          onDescartar={() => {
            setPendingNotInOrderCode(null)
            setPendingNotInOrderMarcaId(null)
            setNotInOrderProducto(null)
            scanInputRef.current?.focus()
          }}
          loading={agregarLoading}
          existingPrice={
            notInOrderProducto?.piezaEscaneadaId != null
              ? itemsParaEscanear
                  .flatMap(i => i.piezas_orden ?? [])
                  .find(p => p.id_pieza === notInOrderProducto.piezaEscaneadaId)
                  ?.precio_unitario
              : undefined
          }
        />
      )}

      {showAgregarModal && (
        <AgregarProductoModal
          onAgregar={handleAgregarProducto}
          onClose={() => setShowAgregarModal(false)}
          loading={agregarLoading}
          existingItems={itemsParaEscanear}
        />
      )}

      {pendingMarcarListoItem && selectedOrden && (
        <MarcarListoPromptModal
          item={pendingMarcarListoItem}
          onConfirmar={() => handleConfirmarMarcarListo(pendingMarcarListoItem)}
          onRechazar={() => {
            setPendingMarcarListoItem(null)
            scanInputRef.current?.focus()
          }}
        />
      )}

      {pendingPiezaScan && (
        <PiezaScanPriceModal
          pieza={pendingPiezaScan.pieza}
          item={pendingPiezaScan.item}
          onConfirm={(precio) => {
            setPiezaPrecios(prev => ({ ...prev, [pendingPiezaScan.pieza.id]: String(precio) }))
            handleConfirmarPieza(pendingPiezaScan.item, pendingPiezaScan.pieza)
            setPendingPiezaScan(null)
            scanInputRef.current?.focus()
          }}
          onCancel={() => {
            setPendingPiezaScan(null)
            scanInputRef.current?.focus()
          }}
          loading={!!piezaLoading[pendingPiezaScan.pieza.id]}
        />
      )}
      <EtiquetaModal
        open={!!etiquetaPieza}
        onClose={() => setEtiquetaPieza(null)}
        etiqueta={etiquetaPieza?.etiqueta ?? null}
        subtitulo={etiquetaPieza?.subtitulo}
      />
      <GalleryViewerModal
        producto={galleryProducto}
        onClose={() => setGalleryProducto(null)}
      />
    </MainLayout>
  )
}
