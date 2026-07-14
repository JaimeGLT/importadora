import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { MainLayout } from '@/components/layout/MainLayout'
import { Button, Modal, ConfirmModal, SelectPriceModal } from '@/components/ui'
import { ProductThumb } from '@/components/ui/ProductThumb'
import { GalleryViewerModal } from '../inventario/GalleryViewerModal'
import { KitSeleccionModal, type KitSeleccionResult } from '@/components/ui/KitVentaParcialModal'
import { notify } from '@/lib/notify'
import { useVentasStore } from '@/stores/ventasStore'
import { useCajaStore, type Cart, type CartItem } from '@/stores/cajaStore'
import { useSoundAlert } from '@/hooks/useSoundAlert'
import { type DescuentoConfig } from '@/stores/configStore'
import { gql } from '@/lib/graphql'
import { api } from '@/lib/api'
import { PRODUCTO_BY_ID_QUERY, backendToProductoSimple, backendToProducto, type ProductoAPI, type ProductoAPISimple } from '@/lib/queries/inventario.queries'
import { MIS_ORDENES_QUERY, backendToOrdenVenta, type OrdenVentaAPI } from '@/lib/queries/ventas.queries'
import { CLIENTES_QUERY, backendToCliente, type ClienteAPI } from '@/lib/queries/clientes.queries'
import {
  DESCUENTOS_QUERY,
  backendToDescuento,
  type DescuentoAPI,
} from '@/lib/queries/config.queries'
import { useVentasHub } from '@/hooks/useVentasHub'
import { getStockEfectivo, getStockEfectivoPieza } from '@/utils/stockValidator'
import { capitalizeTipoPago } from '@/utils/tipoPago'
import { CheckoutModal, type CheckoutConfirm } from '@/components/modals/CheckoutModal'
import { VentaRapidaCreditoModal, type VentaRapidaCreditoItem } from '@/components/modals/VentaRapidaCreditoModal'
import { VentaRapidaContadoModal, type VentaRapidaContadoConfirm } from '@/components/modals/VentaRapidaContadoModal'
import type { Producto, OrdenVenta, Cliente } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBs = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtTimeSince = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'ahora'
  if (mins === 1) return '1 min'
  return `${mins} min`
}

const ESTADO_ORDEN_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  pendiente_almacenero: { label: 'Pendiente',         cls: 'bg-[#F5E0A8] text-[#7A5200]',     dot: 'bg-[#B47A1F]' },
  en_preparacion:       { label: 'Preparando',        cls: 'bg-[#F4ECDB] text-[#780e18]',     dot: 'bg-[#780e18]' },
  listo_para_escaneo:   { label: 'Escaneando',        cls: 'bg-[#F4ECDB] text-[#780e18]',     dot: 'bg-[#780e18]' },
  con_faltantes:        { label: 'Con faltantes',     cls: 'bg-[#F5E0A8] text-[#7A5200]',     dot: 'bg-[#B47A1F]' },
  esperando_pago:       { label: 'Listo para cobrar', cls: 'bg-[#B8DCCA] text-[#1E5C38]',     dot: 'bg-[#3F7A52]' },
  cancelada:            { label: 'Cancelada',         cls: 'bg-[#F5C9C0] text-[#8A1E12]',     dot: 'bg-[#B23A2A]' },
}

// ─── FlyingBall ────────────────────────────────────────────────────────────────

interface FlyingBallProps {
  fromRect: DOMRect | null
  toRect: DOMRect | null
  itemCount: number
  onComplete: () => void
}

function FlyingBall({ fromRect, toRect, itemCount, onComplete }: FlyingBallProps) {
  useEffect(() => {
    if (!fromRect || !toRect) return
    const t = setTimeout(onComplete, 800)
    return () => clearTimeout(t)
  }, [fromRect, toRect, onComplete])

  if (!fromRect || !toRect) return null

  const startX = fromRect.left + fromRect.width / 2
  const startY = fromRect.top + fromRect.height / 2
  const deltaX = toRect.left + toRect.width / 2 - startX
  const deltaY = toRect.top + toRect.height / 2 - startY

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{ left: startX, top: startY }}
    >
      <div
        className="relative"
        style={{
          animation: `flyToOrder 0.8s cubic-bezier(0.2, 0, 0.8, 1) forwards`,
        }}
      >
        <div
          className="h-12 w-12 rounded-full bg-gradient-to-br from-[#780e18] to-[#D4A333] shadow-xl flex items-center justify-center text-white font-black text-lg relative"
          style={{
            boxShadow: '0 0 0 4px rgba(120, 14, 24, 0.3), 0 0 20px rgba(120, 14, 24, 0.5)',
          }}
        >
          <span className="relative z-10">{itemCount}</span>
          <div className="absolute inset-0 rounded-full bg-[#D4A333] animate-ping opacity-30" />
        </div>
        <svg
          className="absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D4A333]"
          style={{ animation: 'dash 0.2s ease-in-out infinite' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
      <div
        className="absolute w-3 h-3 rounded-full bg-[#D4A333] opacity-40"
        style={{ animation: 'trail 0.3s ease-out infinite alternate' }}
      />
      <style>{`
        @keyframes flyToOrder {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          15% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
          50% { transform: translate(calc(-50% + ${deltaX * 0.5}px), calc(-50% + ${deltaY * 0.5}px)) scale(1.1); }
          80% { transform: translate(calc(-50% + ${deltaX * 0.9}px), calc(-50% + ${deltaY * 0.9}px)) scale(1.05); }
          100% { transform: translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(0); opacity: 0; }
        }
        @keyframes trail {
          0% { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ─── ProductSearch ─────────────────────────────────────────────────────────────

function ProductSearch({ onSelectProducto, cart, onDecrementProducto, onViewGallery }: {
  onSelectProducto: (producto: Producto) => void
  cart: Cart
  onDecrementProducto: (productoId: string) => void
  onViewGallery: (producto: Producto) => void
}) {
  const { isTokenReady } = useAuth()
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Búsqueda con debounce. showLoading=true sólo en el search inicial del usuario;
  // los refetch en background (periódico / al volver a la pestaña) pasan false
  // para no flashear el skeleton ni perder foco del input.
  const searchProductos = useCallback(async (q: string, showLoading: boolean) => {
    if (!q.trim() || !isTokenReady) { setResultados([]); return }
    if (showLoading) setLoading(true)
    try {
      const res = await api.get<ProductoAPISimple[]>(`/Producto/buscar-lista?q=${encodeURIComponent(q)}`)
      setResultados((res ?? []).map(backendToProductoSimple))
    } catch {
      // En error, conservar los últimos resultados buenos. Sólo el search
      // inicial limpia la lista (manejado arriba con `setResultados([])`).
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [isTokenReady])

  // Búsqueda inicial al tipear (debounced 300ms, con skeleton).
  useEffect(() => {
    if (!query.trim() || !isTokenReady) { setResultados([]); return }
    const q = query.trim()
    const timer = setTimeout(() => searchProductos(q, true), 300)
    return () => clearTimeout(timer)
  }, [query, isTokenReady, searchProductos])

  // Refetch silencioso cada 20s mientras hay query activa: cubre la actividad
  // de otros cajeros en segundo plano sin agregar lag perceptible.
  useEffect(() => {
    if (!query.trim() || !isTokenReady) return
    const q = query.trim()
    const interval = setInterval(() => searchProductos(q, false), 20_000)
    return () => clearInterval(interval)
  }, [query, isTokenReady, searchProductos])

  // Refetch silencioso al volver a la pestaña: cubre "me fui a otra ventana
  // y volví, mientras tanto hubo cambios".
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && query.trim() && isTokenReady) {
        searchProductos(query.trim(), false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [query, isTokenReady, searchProductos])

  const stockDisponible = (p: Producto) => getStockEfectivo(p, cart).stockEfectivo

  const getCartQty = (productoId: string) =>
    cart.items.filter(i => i.producto_id === productoId).reduce((acc, i) => acc + i.cantidad, 0)

  const isKitInCart = (kitId: string) =>
    cart.items.some(i => i.kit_id === kitId)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2 border-b border-[#D0CBC4]">
        <div className="relative">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7571] text-[14px] pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value.replace(/'/g, '-'))}
            placeholder="Buscar por código, nombre, marca o código de pieza (P1-...)..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-[#FBFBFA] border border-[#D8D4D0] rounded-xl focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 placeholder:text-[#7A7571]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7571] hover:text-[#2D2B2A]">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="divide-y divide-[#E8E5E2] px-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
                <div className="h-10 w-10 rounded-lg bg-[#F0EFEC]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 rounded bg-[#F0EFEC]" />
                  <div className="h-2 w-40 rounded bg-[#E8E5E2]" />
                </div>
                <div className="h-4 w-20 rounded bg-[#F0EFEC]" />
              </div>
            ))}
          </div>
        ) : query.trim() === '' ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <i className="ti ti-search text-[#E8E5E2] text-[40px] mb-3" />
            <p className="text-sm text-[#7A7571]">Escribe para buscar productos</p>
          </div>
        ) : resultados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-sm text-[#7A7571] font-medium">Sin resultados</p>
            <p className="text-xs text-[#7A7571] mt-1">"{query}"</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E8E5E2]">
            {resultados.map(p => {
              const disp = stockDisponible(p)
              const stockCls = disp === 0 ? 'text-[#B23A2A]' : disp <= p.stock_minimo ? 'text-[#B47A1F]' : 'text-[#3F7A52]'
              const inCart = p.es_kit ? isKitInCart(p.id) : getCartQty(p.id) > 0
              return (
                <div
                  key={p.id}
                  onClick={() => { if (disp > 0 || p.es_kit) onSelectProducto(p) }}
                  className={clsx(
                    'flex items-start gap-3 px-4 py-3 transition-colors',
                    p.es_kit && 'border-l-[4px] !border-l-[#B47A1F]',
                    disp === 0 && !p.es_kit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                    inCart
                      ? 'bg-[#F4ECDB]'
                      : 'hover:bg-[#FAF5EE]'
                  )}
                >
                  <ProductThumb
                    src={p.imagen}
                    nombre={p.nombre}
                    size="sm"
                    onClick={() => onViewGallery(p)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-sm font-bold text-[#780e18] bg-[#F4ECDB] px-2 py-0.5 rounded">{p.codigo_universal}</span>
                      {p.es_kit && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F4ECDB] text-[#780e18] border border-[#D4A333]/30">
                          <i className="ti ti-stack text-[10px]" />
                          KIT
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[#4A4744] whitespace-normal break-words">{p.nombre}</p>
                    {p.descripcion && (
                      <p
                        className="text-[10px] text-[#7A7571] whitespace-normal break-words leading-tight mt-0.5"
                        title={p.descripcion}
                      >
                        <i className="ti ti-align-left text-[9px] mr-0.5" />
                        {p.descripcion}
                      </p>
                    )}
                    {(p.categoria || p.procedencia) && (
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[10px] text-[#7A7571] leading-tight">
                        {p.categoria && (
                          <span className="inline-flex items-center gap-0.5 whitespace-normal break-words">
                            <i className="ti ti-tag text-[9px]" />
                            {p.categoria}
                          </span>
                        )}
                        {p.categoria && p.procedencia && <span className="text-[#D0CBC4]">·</span>}
                        {p.procedencia && (
                          <span className="inline-flex items-center gap-0.5 whitespace-normal break-words">
                            <i className="ti ti-flag text-[9px]" />
                            Origen: {p.procedencia}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className={`text-[11px] font-semibold ${stockCls}`}>{disp} disponibles</span>
                      <span className="text-[11px] font-mono font-bold text-[#2D2B2A]">Bs {p.precio_venta.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      {p.almacen && (
                        <span className="text-[11px] text-[#7A7571] flex items-center gap-0.5">
                          <i className="ti ti-map-pin text-[10px]" />
                          {p.almacen} {p.estante} {p.fila} {p.columna}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    {p.es_kit ? (
                      <button
                        onClick={e => { e.stopPropagation(); onSelectProducto(p) }}
                        className="h-7 w-7 rounded-lg flex items-center justify-center bg-[#D4A333] text-[#2D2010] hover:bg-[#B4881C] transition-colors"
                      >
                        <i className="ti ti-plus text-[13px]" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); onDecrementProducto(p.id) }}
                          disabled={getCartQty(p.id) === 0}
                          className="h-7 w-7 rounded-lg flex items-center justify-center bg-[#F0EFEC] text-[#4A4744] hover:bg-[#E8E5E2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <i className="ti ti-minus text-[13px]" />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold text-[#2D2B2A]">{getCartQty(p.id)}</span>
                        <button
                          onClick={e => { e.stopPropagation(); onSelectProducto(p) }}
                          disabled={disp === 0}
                          className={clsx(
                            'h-7 w-7 rounded-lg flex items-center justify-center transition-colors',
                            disp === 0 ? 'bg-[#F0EFEC] text-[#7A7571] cursor-not-allowed' : 'bg-[#D4A333] text-[#2D2010] hover:bg-[#B4881C]'
                          )}
                        >
                          <i className="ti ti-plus text-[13px]" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Cart Item ────────────────────────────────────────────────────────────────

function CartItem({
  item,
  idx,
  disp,
  imagen,
  onQtyChange,
  onRemoveItem,
  onEditPrice,
  onViewGallery,
}: {
  item: CartItem
  idx: number
  disp: number
  imagen?: string
  onQtyChange: (itemIdx: number, delta: number) => void
  onRemoveItem: (itemIdx: number) => void
  onEditPrice: (producto_id: string) => void
  onViewGallery: (producto_id: string) => void
}) {
  const [editingQty, setEditingQty] = useState(false)
  const [qtyValue, setQtyValue] = useState(String(item.cantidad))

  return (
    <div className={clsx('px-4 py-3', item.kit_id && 'border-l-[4px] !border-l-[#B47A1F]')}>
      {item.kit_id && (item.kit_nombre || item.kit_codigo) && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <i className="ti ti-stack text-[10px] text-[#D4A333]" />
          {item.kit_codigo && (
            <span className="font-mono text-[10px] font-bold text-[#7A5200] bg-[#F5E0A8] px-1.5 py-0.5 rounded">
              {item.kit_codigo}
            </span>
          )}
          {item.kit_nombre && (
            <span className="text-[10px] font-semibold text-[#7A5200] truncate">{item.kit_nombre}</span>
          )}
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] tracking-wider shrink-0">
            KIT
          </span>
        </div>
      )}
      <div className={clsx('flex gap-3', item.kit_id ? 'items-center' : 'items-start')}>
        <ProductThumb
          src={imagen}
          nombre={item.producto_nombre}
          size="sm"
          onClick={() => onViewGallery(item.producto_id)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-[11px] font-bold text-[#780e18] bg-[#F4ECDB] px-1.5 py-0.5 rounded">{item.producto_codigo}</span>
              {item.es_kit && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] tracking-wider shrink-0">
                  KIT
                </span>
              )}
            </div>
            {!item.kit_id && (
              <button
                onClick={() => onEditPrice(item.producto_id)}
                className="p-1.5 text-[#7A7571] hover:text-[#780e18] hover:bg-[#F4ECDB] rounded-lg transition-colors"
                title="Cambiar precio"
              >
                <i className="ti ti-edit text-[14px]" />
              </button>
            )}
          </div>
          <p className={clsx('mt-0.5 truncate flex items-center gap-1.5', item.kit_id ? 'text-sm font-medium text-[#4A4744]' : 'text-xs text-[#7A7571]')}>
            <span className="truncate">{item.producto_nombre}</span>
            {item.kit_id && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200] tracking-wider shrink-0">
                PIEZA
              </span>
            )}
          </p>
          {(item.producto_categoria || item.producto_procedencia) && (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[10px] text-[#7A7571] leading-tight">
              {item.producto_categoria && (
                <span className="inline-flex items-center gap-0.5 whitespace-normal break-words">
                  <i className="ti ti-tag text-[9px]" />
                  {item.producto_categoria}
                </span>
              )}
              {item.producto_categoria && item.producto_procedencia && <span className="text-[#D0CBC4]">·</span>}
              {item.producto_procedencia && (
                <span className="inline-flex items-center gap-0.5 whitespace-normal break-words">
                  <i className="ti ti-flag text-[9px]" />
                  Origen: {item.producto_procedencia}
                </span>
              )}
            </div>
          )}
          {item.producto_descripcion && (
            <p
              className="text-[10px] text-[#7A7571] whitespace-normal break-words mt-0.5"
              title={item.producto_descripcion}
            >
              {item.producto_descripcion}
            </p>
          )}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <button onClick={() => onQtyChange(idx, -1)} className="h-7 w-7 rounded-lg border border-[#E8E5E2] text-[#4A4744] hover:bg-[#F0EFEC] flex items-center justify-center text-base font-bold transition-colors">−</button>
              {editingQty ? (
                <input
                  type="number"
                  min={1}
                  max={disp}
                  value={qtyValue}
                  autoFocus
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '')
                    if (raw) {
                      const num = parseInt(raw, 10)
                      const clamped = Math.max(1, Math.min(disp, num))
                      setQtyValue(String(clamped))
                    } else {
                      setQtyValue('')
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseInt(qtyValue, 10)
                    const newQty = isNaN(parsed) ? item.cantidad : Math.max(1, Math.min(disp, parsed))
                    setQtyValue(String(newQty))
                    if (newQty !== item.cantidad) {
                      const delta = newQty - item.cantidad
                      onQtyChange(idx, delta)
                    }
                    setEditingQty(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                    } else if (e.key === 'Escape') {
                      setQtyValue(String(item.cantidad))
                      setEditingQty(false)
                    }
                  }}
                  className="w-14 h-7 px-2 text-center text-sm font-bold border border-[#780e18] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#780e18]/20"
                />
              ) : (
                <button
                  onClick={() => {
                    setQtyValue(String(item.cantidad))
                    setEditingQty(true)
                  }}
                  className="h-7 w-10 text-center text-sm font-bold text-[#2D2B2A] hover:bg-[#F0EFEC] rounded-lg transition-colors"
                >
                  {item.cantidad}
                </button>
              )}
              <button onClick={() => onQtyChange(idx, +1)} disabled={item.cantidad >= disp} className={clsx('h-7 w-7 rounded-lg border flex items-center justify-center text-base font-bold transition-colors', item.cantidad >= disp ? 'border-[#E8E5E2] text-[#7A7571] cursor-not-allowed' : 'border-[#E8E5E2] text-[#4A4744] hover:bg-[#F0EFEC]')}>+</button>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-[#2D2B2A]">{fmtBs(item.precio_unitario * item.cantidad)}</span>
              {item.cantidad > 1 && (
                <p className="text-[10px] text-[#7A7571] font-mono mt-0.5">{fmtBs(item.precio_unitario)} / u</p>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => onRemoveItem(idx)} className="text-[#7A7571] hover:text-[#B23A2A] transition-colors shrink-0">
          <i className="ti ti-x text-[16px]" />
        </button>
      </div>
    </div>
  )
}

// ─── CartPanel ────────────────────────────────────────────────────────────────

function CartPanel({ cart, productosCache, onQtyChange, onRemoveItem, onNotaChange, onEmitir, onEditPrice, onCancelarOrden, onVentaRapidaCredito, onVentaRapidaContado, onViewGallery, emitButtonRef }: { cart: Cart; productosCache: Record<string, Producto>; onQtyChange: (itemIdx: number, delta: number) => void; onRemoveItem: (itemIdx: number) => void; onNotaChange: (nota: string) => void; onEmitir: () => void; onEditPrice: (producto_id: string) => void; onCancelarOrden: () => void; onVentaRapidaCredito: () => void; onVentaRapidaContado: () => void; onViewGallery: (producto_id: string) => void; emitButtonRef?: (el: HTMLButtonElement | null) => void }) {
  const [confirmCancelar, setConfirmCancelar] = useState(false)
  const stockDisponible = (id: string) => {
    const p = productosCache[id]
    return p ? getStockEfectivo(p, cart).stockEfectivo : Infinity
  }
  const total = cart.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#D0CBC4] shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <p className="text-[10px] font-bold text-[#7A7571] uppercase tracking-widest shrink-0">Carrito de venta</p>
        </div>
        {cart.items.length > 0 && (
          <button
            onClick={() => setConfirmCancelar(true)}
            className="shrink-0 text-[11px] font-semibold text-[#B23A2A] hover:text-[#8A1E12] hover:bg-[#F5C9C0]/40 px-2 py-1 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
      <ConfirmModal
        open={confirmCancelar}
        title="Cancelar orden"
        message="Se eliminarán todos los productos del carrito. ¿Continuar?"
        onConfirm={() => { setConfirmCancelar(false); onCancelarOrden() }}
        onClose={() => setConfirmCancelar(false)}
      />
      <div className="flex-1 overflow-y-auto">
        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <i className="ti ti-shopping-cart text-[#E8E5E2] text-[48px] mb-3" />
            <p className="text-sm text-[#7A7571]">Carrito vacío</p>
            <p className="text-xs text-[#7A7571] mt-1">Agrega productos desde la búsqueda</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E8E5E2]">
            {cart.items.map((item, idx) => {
              const disp = stockDisponible(item.producto_id)
              return (
                <CartItem
                  key={`${item.producto_id}-${item.kit_id ?? 'root'}-${idx}`}
                  item={item}
                  idx={idx}
                  disp={disp}
                  imagen={productosCache[item.producto_id]?.imagen}
                  onQtyChange={onQtyChange}
                  onRemoveItem={onRemoveItem}
                  onEditPrice={onEditPrice}
                  onViewGallery={onViewGallery}
                />
              )
            })}
          </div>
        )}
      </div>
      {cart.items.length > 0 && (
        <div className="border-t border-[#D0CBC4] px-4 py-3 space-y-3 shrink-0">
          <input type="text" value={cart.nota} onChange={e => onNotaChange(e.target.value)} placeholder="Nota para almacén (opcional)" className="w-full text-xs px-3 py-2.5 bg-[#FBFBFA] border border-[#D8D4D0] rounded-xl focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 placeholder:text-[#7A7571]" maxLength={100} />
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-[#7A7571] uppercase tracking-widest">Total</p>
              <p className="text-xl font-black text-[#2D2B2A] tabular-nums">{fmtBs(total)}</p>
            </div>
            <button
              ref={emitButtonRef}
              onClick={onEmitir}
              className="px-4 h-10 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-sm font-bold rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-sm"
            >
              <i className="ti ti-arrow-right text-[16px]" />
              Emitir orden
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onVentaRapidaContado}
              className="flex-1 h-10 bg-white border border-[#1E5C38] text-[#1E5C38] hover:bg-[#E8F3ED] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95"
              title="Venta rápida al contado (sin pasar por almacén)"
            >
              <i className="ti ti-cash text-[14px]" />
              Venta rápida
            </button>
            <button
              type="button"
              onClick={onVentaRapidaCredito}
              className="flex-1 h-10 bg-white border border-[#780e18] text-[#780e18] hover:bg-[#F4ECDB] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95"
              title="Venta rápida a crédito (sin pasar por almacén)"
            >
              <i className="ti ti-hand-coins text-[14px]" />
              Crédito rápido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── OrdersModal ───────────────────────────────────────────────────────────────

function OrdersModal({
  ordenes,
  canceladas,
  onCobrar,
  onCancelar,
  open,
  onClose,
}: {
  ordenes: OrdenVenta[]
  canceladas?: OrdenVenta[]
  onCobrar: (o: OrdenVenta) => void
  onCancelar: (o: OrdenVenta) => void
  open: boolean
  onClose: () => void
}) {
  const [showCanceladas, setShowCanceladas] = useState(false)
  const listos = ordenes.filter(o => o.estado === 'esperando_pago')
  const otras = ordenes.filter(o => o.estado !== 'completada' && o.estado !== 'cancelada' && o.estado !== 'esperando_pago')

  return (
    <Modal open={open} onClose={onClose} title="Órdenes activas" size="lg">
      <div className="space-y-4 pt-1">
        <div className="max-h-[60vh] overflow-y-auto space-y-4">
          <>
              {listos.length > 0 ? (
                <div className="space-y-2">
                  {listos.map(o => (
                    <div key={o.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#B8DCCA]/30 border-2 border-[#B8DCCA]">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-[#3F7A52] flex items-center justify-center text-white font-bold text-sm">{o.numero.replace('ORD-', '')}</div>
                        <div>
                          <p className="text-sm font-bold text-[#1E5C38]">{o.numero}</p>
                          <p className="text-xs text-[#3F7A52]">{o.items.length} prod. · {fmtBs(o.total)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { onCobrar(o); onClose() }} className="px-4 py-1.5 rounded-lg bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-xs font-bold transition-colors">Cobrar</button>
                        <button onClick={() => { onCancelar(o); onClose() }} className="p-1.5 text-[#7A7571] hover:text-[#B23A2A]">
                          <i className="ti ti-x text-[15px]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="ti ti-clipboard-list text-[#E8E5E2] text-[48px] mx-auto mb-3 block" />
                  <p className="text-sm text-[#7A7571]">No hay órdenes listas</p>
                </div>
              )}
              {otras.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[#7A7571] uppercase tracking-wide mb-2">En proceso</p>
                  <div className="space-y-2">
                    {otras.map(o => {
                      const cfg = ESTADO_ORDEN_CONFIG[o.estado] ?? { label: o.estado, cls: 'bg-[#F0EFEC] text-[#7A7571]', dot: 'bg-[#7A7571]' }
                      const tieneFaltantes = o.items.some(i => i.estado === 'faltante')
                      return (
                        <div key={o.id} className={clsx('flex items-center justify-between px-4 py-3 rounded-xl border', tieneFaltantes ? 'bg-[#F5E0A8]/40 border-[#F5E0A8]' : 'bg-white border-[#E8E5E2]')}>
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.cls}`}>{cfg.label}</span>
                            <div>
                              <p className="text-sm font-semibold text-[#4A4744]">{o.numero}</p>
                              <p className="text-xs text-[#7A7571]">{o.items.length} prod. · {fmtBs(o.total)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {tieneFaltantes && <span className="text-[10px] font-bold text-[#B47A1F]">⚠ faltantes</span>}
                            <span className="text-[10px] text-[#7A7571]">{fmtTimeSince(o.creado_en)}</span>
                            <button onClick={() => { onCancelar(o); onClose() }} className="p-1.5 text-[#7A7571] hover:text-[#B23A2A]">
                              <i className="ti ti-x text-[15px]" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {canceladas && canceladas.length > 0 && (
                <div className="border-t border-[#E8E5E2] pt-3">
                  <button
                    onClick={() => setShowCanceladas(!showCanceladas)}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-[#F0EFEC] transition-colors"
                  >
                    <span className="text-xs font-bold text-[#7A7571] uppercase tracking-wide flex items-center gap-2">
                      <i className={clsx('ti ti-chevron-right text-[14px] transition-transform', showCanceladas && 'rotate-90')} />
                      Canceladas ({canceladas.length})
                    </span>
                  </button>
                  {showCanceladas && (
                    <div className="space-y-2 mt-2">
                      {canceladas.map(o => (
                        <div key={o.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#F5C9C0]/40 border border-[#F5C9C0] opacity-70">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-[#F5C9C0] flex items-center justify-center">
                              <i className="ti ti-x text-[#B23A2A] text-[14px]" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#8A1E12]">{o.numero}</p>
                              <p className="text-xs text-[#B23A2A]">{o.items.length} prod. · {fmtBs(o.total)}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-[#B23A2A]">{fmtTimeSince(o.creado_en)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function PickingParcialModal({ orden, onPartial, onCancelar, onClose }: { orden: OrdenVenta; onPartial: () => void; onCancelar: () => void; onClose: () => void }) {
  const completos = orden.items.filter(i =>
    i.estado === 'completo' || i.estado === 'parcial' ||
    (i.estado === 'faltante' && (i.cantidad_recogida ?? 0) > 0)
  )
  const faltantes = orden.items.filter(i =>
    i.estado === 'faltante' && ((i.cantidad_recogida ?? 0) === 0)
  )
  return (
    <Modal open onClose={onClose} title="Orden con faltantes">
      <div className="space-y-4 pt-1">
        <p className="text-sm text-[#7A7571]">Esta orden tiene productos no encontrados. ¿Cómo procedes?</p>
        {completos.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[#3F7A52] uppercase tracking-wide mb-2">✓ Encontrados ({completos.length})</p>
            <div className="space-y-1">{completos.map(i => (
              <div key={i.id} className="flex justify-between text-sm px-3 py-1.5 bg-[#B8DCCA]/30 rounded-lg">
                <span className="text-[#4A4744] truncate mr-2">{i.producto_nombre}</span>
                <span className="text-[#1E5C38] font-semibold">×{i.cantidad_recogida ?? i.cantidad_pedida}</span>
              </div>
            ))}</div>
          </div>
        )}
        {faltantes.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[#B23A2A] uppercase tracking-wide mb-2">✕ Faltantes ({faltantes.length})</p>
            <div className="space-y-1">{faltantes.map(i => (
              <div key={i.id} className="flex justify-between text-sm px-3 py-1.5 bg-[#F5C9C0]/40 rounded-lg">
                <span className="text-[#4A4744] truncate mr-2">{i.producto_nombre}</span>
                <span className="text-[#B23A2A] font-semibold">×{i.cantidad_pedida}</span>
              </div>
            ))}</div>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onCancelar}>Cancelar orden</Button>
          <Button className="flex-1" onClick={onPartial}>Entregar parcial</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Cancelar Orden Modal ───────────────────────────────────────────────────────

function CancelarOrdenModal({
  orden,
  onConfirm,
  onClose,
}: {
  orden: OrdenVenta
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open onClose={onClose} title={`Cancelar ${orden.numero}`} size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F5C9C0]/40 border border-[#F5C9C0]">
          <div className="h-10 w-10 rounded-full bg-[#F5C9C0] flex items-center justify-center shrink-0">
            <i className="ti ti-alert-triangle text-[#B23A2A] text-[18px]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#8A1E12]">¿Cancelar esta orden?</p>
            <p className="text-xs text-[#B23A2A] mt-0.5">El stock reservado será liberado. Esta acción no se puede deshacer.</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#E8E5E2] overflow-hidden">
          <div className="px-4 py-2 bg-[#F5F0EB] border-b border-[#E8E5E2] flex items-center justify-between">
            <span className="text-xs font-bold text-[#7A7571]">PRODUCTOS</span>
            <span className="text-xs text-[#7A7571]">{orden.items.length} items · {fmtBs(orden.total)}</span>
          </div>
          <div className="divide-y divide-[#E8E5E2] max-h-48 overflow-y-auto">
            {orden.items.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-[#780e18] bg-[#F4ECDB] px-1.5 py-0.5 rounded shrink-0">{item.producto_codigo}</span>
                  {item.es_kit && !item.es_parcial && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] tracking-wider shrink-0">
                      KIT
                    </span>
                  )}
                  <span className="text-xs text-[#4A4744] truncate">{item.producto_nombre}</span>
                </div>
                <span className="text-xs font-semibold text-[#4A4744] ml-2 shrink-0">×{item.cantidad_pedida}</span>
              </div>
            ))}
          </div>
        </div>

        {orden.nota && (
          <div className="px-3 py-2 rounded-lg bg-[#F5E0A8]/40 border border-[#F5E0A8]">
            <p className="text-xs text-[#7A5200]"><span className="font-semibold">Nota:</span> {orden.nota}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Mantener orden</Button>
        <Button variant="danger" className="flex-1" onClick={onConfirm}>Sí, cancelar</Button>
      </div>
    </Modal>
  )
}

// ─── Cobro Modal ───────────────────────────────────────────────────────────────

function FacturaModal({ orden, onClose }: { orden: OrdenVenta; onClose: () => void }) {
  const isFactura = orden.tipoDocumento === 'factura'
  const itemsDespachados = orden.items.filter(i =>
    i.estado === 'completo' || i.estado === 'parcial' ||
    (i.estado === 'faltante' && (i.cantidad_recogida ?? 0) > 0)
  )
  const subtotal = itemsDespachados.reduce((s, i) => {
    if (i.es_parcial && i.piezas_orden?.length)
      return s + i.piezas_orden.filter(p => p.confirmado).reduce((ps, p) => ps + (p.precio_unitario ?? 0) * p.cantidad, 0)
    return s + i.precio_unitario * (i.cantidad_recogida ?? i.cantidad_pedida)
  }, 0)
  const montoDesc = orden.monto_descuento ?? 0
  const totalReal = Math.max(0, subtotal - montoDesc)
  const cambio = orden.monto_recibido != null ? orden.monto_recibido - totalReal : null

  const docLabel = isFactura ? 'FACTURA' : 'NOTA DE VENTA'

  return (
    <Modal open onClose={onClose} title="Comprobante de venta" size="sm">
      <div className="flex justify-center bg-[#F0EFEC] -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 py-4 print:py-0 print:bg-transparent">
        <div
          id="comprobante-print"
          className="w-[80mm] bg-white text-black font-mono text-[11px] leading-tight p-4 shadow-md print:shadow-none print:p-0"
        >
          {/* Header */}
          <div className="text-center">
            <p className="font-black text-[13px] uppercase tracking-wide">{docLabel}</p>
            {isFactura && orden.facturaNro && (
              <p className="font-bold">N° {orden.facturaNro}</p>
            )}
            <p>Orden {orden.numero}</p>
            <p>{new Date(orden.pagado_en ?? orden.actualizado_en).toLocaleString('es-BO')}</p>
            <p>Cajero: {orden.cajero_nombre}</p>
          </div>

          <div className="border-t border-dashed border-black/40 my-1.5" />

          {/* Cliente */}
          {orden.cliente_nombre && (
            <>
              <p>Cliente: {orden.cliente_nombre}</p>
              {orden.cliente_tipo_id && orden.cliente_numero_id && (
                <p>
                  {orden.cliente_tipo_id === 'nit' ? 'NIT' :
                   orden.cliente_tipo_id === 'ci' ? 'CI' :
                   'Doc'}: {orden.cliente_numero_id}
                </p>
              )}
              {orden.cliente_nit && orden.cliente_tipo_id !== 'nit' && (
                <p>NIT: {orden.cliente_nit}</p>
              )}
              <div className="border-t border-dashed border-black/40 my-1.5" />
            </>
          )}

          {/* Items */}
          {itemsDespachados.map(i => {
            if (i.es_parcial && i.piezas_orden?.length) {
              return i.piezas_orden.filter(p => p.confirmado).map(p => (
                <div key={`${i.id}-${p.id}`} className="mb-1.5">
                  <p className="font-bold">{i.producto_codigo}</p>
                  <p className="truncate">{p.nombre}</p>
                  <div className="flex justify-between pl-1">
                    <span>{p.cantidad} x {fmtBs(p.precio_unitario ?? 0)}</span>
                    <span className="font-bold">{fmtBs((p.precio_unitario ?? 0) * p.cantidad)}</span>
                  </div>
                </div>
              ))
            }
            const qty = i.cantidad_recogida ?? i.cantidad_pedida
            return (
              <div key={i.id} className="mb-1.5">
                <p className="font-bold">{i.producto_codigo}</p>
                <p className="truncate">{i.producto_nombre}</p>
                <div className="flex justify-between pl-1">
                  <span>{qty} x {fmtBs(i.precio_unitario)}</span>
                  <span className="font-bold">{fmtBs(i.precio_unitario * qty)}</span>
                </div>
              </div>
            )
          })}

          <div className="border-t border-dashed border-black/40 my-1.5" />

          {/* Totales */}
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{fmtBs(subtotal)}</span>
          </div>
          {montoDesc > 0 && orden.descuento && (
            <div className="flex justify-between">
              <span>Descuento {orden.descuento.nombre} ({orden.descuento.porcentaje}%)</span>
              <span>−{fmtBs(montoDesc)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-[12px] pt-0.5">
            <span>TOTAL</span>
            <span>{fmtBs(totalReal)}</span>
          </div>
          {orden.metodo_pago && (
            <div className="flex justify-between">
              <span>Método:</span>
              <span className="capitalize">{orden.metodo_pago}</span>
            </div>
          )}
          {orden.monto_recibido != null && (
            <div className="flex justify-between">
              <span>Recibido:</span>
              <span>{fmtBs(orden.monto_recibido)}</span>
            </div>
          )}
          {cambio != null && cambio > 0 && (
            <div className="flex justify-between">
              <span>Cambio:</span>
              <span>{fmtBs(cambio)}</span>
            </div>
          )}

          {isFactura && (
            <>
              <div className="border-t border-dashed border-black/40 my-1.5" />
              <div className="flex items-center gap-2">
                <div className="h-16 w-16 border border-dashed border-black/40 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-center leading-tight">QR{'\n'}SIAT</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[10px]">Verifique su factura</p>
                  <p className="text-[9px]">en el portal del SIN</p>
                  {orden.facturaNro && <p className="text-[9px]">{orden.facturaNro}</p>}
                </div>
              </div>
            </>
          )}

          <div className="border-t border-dashed border-black/40 my-1.5" />

          {/* Footer */}
          <div className="text-center space-y-0.5">
            <p className="font-bold">¡Gracias por su compra!</p>
            {!isFactura && (
              <p className="text-[9px]">Esta nota no es válida como factura</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-4 print:hidden">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cerrar</Button>
        <Button className="flex-1" onClick={() => window.print()}>
          <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </Button>
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CajaPage() {
  const { user, isTokenReady } = useAuth()
  const { ordenes, setOrdenes, updateOrden } = useVentasStore()
  const { playAlertSequence, playBeep } = useSoundAlert()

  const { cart, setCart, clearCart } = useCajaStore()
  const [ordersModalOpen, setOrdersModalOpen] = useState(false)
  const [flyingBall, setFlyingBall] = useState<{ from: DOMRect | null; items: number } | null>(null)
  const emitButtonRef = useRef<HTMLButtonElement>(null)
  const headerBadgeRef = useRef<HTMLButtonElement | null>(null)
  const [productosCache, setProductosCache] = useState<Record<string, Producto>>({})
  const [clientes, setClientes] = useState<Cliente[]>([])

  const [cobroOrden, setCobroOrden] = useState<OrdenVenta | null>(null)
  const [parcialOrden, setParcialOrden] = useState<OrdenVenta | null>(null)
  const [facturaOrden, setFacturaOrden] = useState<OrdenVenta | null>(null)
  const [cancelarOrden, setCancelarOrden] = useState<OrdenVenta | null>(null)
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [kitSeleccionado, setKitSeleccionado] = useState<Producto | null>(null)
  const [ventaRapidaOpen, setVentaRapidaOpen] = useState(false)
  const [ventaRapidaContadoOpen, setVentaRapidaContadoOpen] = useState(false)
  const [galleryProducto, setGalleryProducto] = useState<Producto | null>(null)

  const [descuentos, setDescuentos] = useState<DescuentoConfig[]>([])

  const misOrdenes = useMemo(() => ordenes.filter(o => o.estado !== 'completada' && o.estado !== 'cancelada'), [ordenes])
  const canceladas = useMemo(() => ordenes.filter(o => o.estado === 'cancelada'), [ordenes])
  const listosCount = misOrdenes.filter(o => o.estado === 'esperando_pago').length
  const alertedFaltantes = useRef<Set<string>>(new Set())
  const alertedListo = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isTokenReady) return
    Promise.all([
      gql<{ descuento: { nodes: DescuentoAPI[] } }>(DESCUENTOS_QUERY).then(r => r.descuento.nodes),
      gql<{ clientes: { nodes: ClienteAPI[] } }>(CLIENTES_QUERY, { first: 200 }).then(r => r.clientes?.nodes ?? []),
    ]).then(([desc, clientesNodes]) => {
      setDescuentos(desc.map(backendToDescuento))
      setClientes(clientesNodes.map(backendToCliente))
    }).catch(() => {})
  }, [isTokenReady])

  const joinGrupoRef = useRef<(g: string) => Promise<void>>(() => Promise.resolve())

  const loadOrdenes = useCallback(async () => {
    if (!isTokenReady) return
    try {
      const data = await gql<{ misOrdenes: { nodes: OrdenVentaAPI[] } }>(MIS_ORDENES_QUERY)
      const converted = data.misOrdenes.nodes.map(backendToOrdenVenta)
      setOrdenes(converted)
      converted
        .filter(o => o.estado !== 'completada' && o.estado !== 'cancelada')
        .forEach(o => joinGrupoRef.current(`orden-${o.id}`))
    } catch {
      notify.error('Error cargando órdenes')
    }
  }, [isTokenReady, setOrdenes])

  useEffect(() => { loadOrdenes() }, [loadOrdenes])

  const { isConnected, joinGrupo } = useVentasHub({
    onOrdenAceptada: ({ id }) => {
      updateOrden(String(id), { estado: 'en_preparacion' })
      playAlertSequence()
      notify.info('Almacenero tomó la orden')
    },
    onOrdenLista: () => {
      loadOrdenes()
      playAlertSequence()
      notify.success('¡Orden lista!', { description: 'Mercadería preparada', duration: 8000 })
    },
    onOrdenCompletada: ({ id }) => {
      updateOrden(String(id), { estado: 'completada' })
    },
    onOrdenCancelada: ({ id }) => {
      updateOrden(String(id), { estado: 'cancelada' })
    },
    onOrdenConFaltantes: () => {
      loadOrdenes()
    },
    onOrdenEsperandoPago: ({ id }) => {
      loadOrdenes()
      playAlertSequence()
      notify.success('Orden lista para cobrar', { description: `Orden #${id} — escaneo completado`, duration: 8000 })
    },
    onNuevoItemAgregado: () => loadOrdenes(),
    onItemEliminado: () => loadOrdenes(),
    onCantidadItemActualizada: () => loadOrdenes(),
    onItemListoParaScaneo: () => loadOrdenes(),
  }, isTokenReady)
  joinGrupoRef.current = joinGrupo

  useEffect(() => {
    const ordenConFaltantes = misOrdenes.find(o => o.items.some(i => i.estado === 'faltante') && !alertedFaltantes.current.has(o.id))
    if (ordenConFaltantes) {
      alertedFaltantes.current.add(ordenConFaltantes.id)
      playAlertSequence()
      notify.warning(`${ordenConFaltantes.numero} — productos faltantes`, { description: 'Habla con almacén para resolver', duration: 8000 })
    }
  }, [misOrdenes, playAlertSequence])

  useEffect(() => {
    const ordenLista = misOrdenes.find(o => o.estado === 'esperando_pago' && !alertedListo.current.has(o.id))
    if (ordenLista) {
      alertedListo.current.add(ordenLista.id)
      playAlertSequence()
      notify.success(`${ordenLista.numero} lista para cobrar`, { description: 'Escaneo completado', duration: 6000 })
    }
  }, [misOrdenes, playAlertSequence])

  const addKitSeleccion = useCallback(async (producto: Producto) => {
    try {
      const data = await gql<{ productos: { nodes: ProductoAPI[] } }>(
        PRODUCTO_BY_ID_QUERY,
        { id: Number(producto.id) },
      )
      const node = data.productos?.nodes?.[0]
      setKitSeleccionado(node ? backendToProducto(node) : producto)
    } catch {
      setKitSeleccionado(producto)
    }
  }, [])

  const addToCart = useCallback((producto: Producto) => {
    setProductosCache(prev => ({ ...prev, [producto.id]: producto }))
    if (producto.es_kit) {
      addKitSeleccion(producto)
      return
    }
    setCart(prev => {
      const existingIdx = prev.items.findIndex(i => i.producto_id === producto.id)
      if (existingIdx >= 0) {
        const disp = getStockEfectivo(producto, prev).stockEfectivo
        if (prev.items[existingIdx].cantidad >= disp) {
          notify.error('Stock máximo alcanzado')
          return prev
        }
        notify.success('+1 al carrito')
        return { ...prev, items: prev.items.map((item, idx) => idx === existingIdx ? { ...item, cantidad: item.cantidad + 1 } : item) }
      }
      // Producto nuevo: agregar directamente con precio base (sin modal)
      return { ...prev, items: [...prev.items, {
        producto_id: producto.id,
        producto_codigo: producto.codigo_universal,
        marcaId: producto.marcaId ?? null,
        producto_nombre: producto.nombre,
        producto_descripcion: producto.descripcion || undefined,
        producto_categoria: producto.categoria,
        producto_procedencia: producto.procedencia,
        producto_almacen: producto.almacen,
        producto_estante: producto.estante,
        producto_fila: producto.fila,
        producto_columna: producto.columna,
        producto_imagen: producto.imagen,
        cantidad: 1,
        precio_unitario: producto.precio_venta,
        precio_base: producto.precio_venta,
        es_kit: producto.es_kit,
      }] }
    })
    playBeep({ frequency: 600, duration: 60 })
    notify.success('Producto agregado')
  }, [addKitSeleccion, playBeep])

  const handleDecrementProducto = useCallback((productoId: string) => {
    setCart(prev => {
      const items = [...prev.items]
      const lastIdx = items.map(i => i.producto_id).lastIndexOf(productoId)
      if (lastIdx === -1) return prev
      if (items[lastIdx].cantidad > 1) {
        items[lastIdx] = { ...items[lastIdx], cantidad: items[lastIdx].cantidad - 1 }
      } else {
        items.splice(lastIdx, 1)
      }
      return { ...prev, items }
    })
  }, [])

  const handleUpdatePrice = useCallback((precio: number) => {
    if (!productoSeleccionado) return
    setCart(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.producto_id === productoSeleccionado.id
          ? { ...item, precio_unitario: precio, precio_base: productoSeleccionado.precio_venta }
          : item
      ),
    }))
    setProductoSeleccionado(null)
    notify.success('Precio actualizado')
  }, [productoSeleccionado])

  const agregarPiezasAlCarrito = useCallback((
    piezas: { producto_id: string; nombre: string; codigo?: string; cantidad: number; precio: number }[],
    kitId: string,
    kitNombre?: string,
    kitCodigo?: string,
    kitMarcaId?: number | null,
  ) => {
    setCart(prev => {
      const items = [...prev.items]
      for (const p of piezas) {
        const existingIdx = items.findIndex(i => i.producto_id === p.producto_id && i.kit_id === kitId)
        if (existingIdx >= 0) {
          items[existingIdx] = { ...items[existingIdx], cantidad: items[existingIdx].cantidad + p.cantidad, precio_unitario: p.precio, precio_base: p.precio }
        } else {
          items.push({
            producto_id: p.producto_id,
            producto_codigo: p.codigo ?? '',
            producto_nombre: p.nombre,
            producto_almacen: '',
            producto_estante: '',
            producto_fila: '',
            producto_columna: '',
            cantidad: p.cantidad,
            precio_unitario: p.precio,
            precio_base: p.precio,
            kit_id: kitId,
            kit_nombre: kitNombre,
            kit_codigo: kitCodigo,
            kit_marcaId: kitMarcaId,
          })
        }
      }
      return { ...prev, items }
    })
  }, [])

  const handleKitSeleccion = useCallback((result: KitSeleccionResult) => {
    if (!kitSeleccionado) return

    if (result.tipo === 'kit_completo') {
      // Agregar el kit completo al carrito directamente con el precio base
      setCart(prev => {
        const existingIdx = prev.items.findIndex(i => i.producto_id === kitSeleccionado.id && !i.kit_id)
        if (existingIdx >= 0) {
          const disp = getStockEfectivo(kitSeleccionado, prev).stockEfectivo
          if (prev.items[existingIdx].cantidad >= disp) { notify.error('Stock máximo alcanzado'); return prev }
          return { ...prev, items: prev.items.map((item, idx) => idx === existingIdx ? { ...item, cantidad: item.cantidad + result.cantidad } : item) }
        }
        return { ...prev, items: [...prev.items, {
          producto_id: kitSeleccionado.id,
          producto_codigo: kitSeleccionado.codigo_universal,
          marcaId: kitSeleccionado.marcaId ?? null,
          producto_nombre: kitSeleccionado.nombre,
          producto_categoria: kitSeleccionado.categoria,
          producto_procedencia: kitSeleccionado.procedencia,
          producto_almacen: kitSeleccionado.almacen,
          producto_estante: kitSeleccionado.estante,
          producto_fila: kitSeleccionado.fila,
          producto_columna: kitSeleccionado.columna,
          producto_imagen: kitSeleccionado.imagen,
          cantidad: result.cantidad,
          precio_unitario: kitSeleccionado.precio_venta,
          precio_base: kitSeleccionado.precio_venta,
          es_kit: true,
        }] }
      })
      setKitSeleccionado(null)
      playBeep({ frequency: 600, duration: 60 })
      notify.success('Kit agregado')
      return
    }

    if (result.tipo === 'piezas_sueltas') {
      agregarPiezasAlCarrito(result.piezas, kitSeleccionado.id, kitSeleccionado.nombre, kitSeleccionado.codigo_universal, kitSeleccionado.marcaId)
      setKitSeleccionado(null)
      playBeep({ frequency: 600, duration: 60 })
      notify.success(`${result.piezas.length} pieza(s) agregada(s)`)
      return
    }

    // tipo === 'ambos': agregar piezas al carrito Y el kit con precio base (sin modal)
    agregarPiezasAlCarrito(result.piezas, kitSeleccionado.id, kitSeleccionado.nombre, kitSeleccionado.codigo_universal, kitSeleccionado.marcaId)
    setCart(prev => {
      const existingIdx = prev.items.findIndex(i => i.producto_id === kitSeleccionado.id && !i.kit_id)
      if (existingIdx >= 0) {
        return { ...prev, items: prev.items.map((item, idx) => idx === existingIdx ? { ...item, cantidad: item.cantidad + result.cantidad_kit } : item) }
      }
      return { ...prev, items: [...prev.items, {
        producto_id: kitSeleccionado.id,
        producto_codigo: kitSeleccionado.codigo_universal,
        marcaId: kitSeleccionado.marcaId ?? null,
        producto_nombre: kitSeleccionado.nombre,
        producto_categoria: kitSeleccionado.categoria,
        producto_procedencia: kitSeleccionado.procedencia,
        producto_almacen: kitSeleccionado.almacen,
        producto_estante: kitSeleccionado.estante,
        producto_fila: kitSeleccionado.fila,
        producto_columna: kitSeleccionado.columna,
        producto_imagen: kitSeleccionado.imagen,
        cantidad: result.cantidad_kit,
        precio_unitario: kitSeleccionado.precio_venta,
        precio_base: kitSeleccionado.precio_venta,
        es_kit: true,
      }] }
    })
    setKitSeleccionado(null)
    notify.success(`${result.piezas.length} pieza(s) y kit agregados`)
  }, [kitSeleccionado, playBeep, agregarPiezasAlCarrito])

  const handleEditPrice = useCallback((producto_id: string) => {
    const producto = productosCache[producto_id]
    if (producto) setProductoSeleccionado(producto)
  }, [productosCache])

  const handleQtyChange = (itemIdx: number, delta: number) => {
    setCart(prev => {
      const newQty = prev.items[itemIdx].cantidad + delta
      if (newQty < 1) return prev
      return { ...prev, items: prev.items.map((item, idx) => idx === itemIdx ? { ...item, cantidad: newQty } : item) }
    })
  }

  const handleRemoveItem = (itemIdx: number) => {
    setCart(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== itemIdx) }))
  }

  const handleNotaChange = (nota: string) => {
    setCart(prev => ({ ...prev, nota }))
  }

  const handleEmitir = () => {
    if (cart.items.length === 0) return
    const fromRect = emitButtonRef.current?.getBoundingClientRect() ?? null
    setFlyingBall({ from: fromRect, items: cart.items.length })
  }

  const handleFlyingComplete = async () => {
    if (!flyingBall) return
    setFlyingBall(null)

    // Refetch fresh stock para todos los productos del carrito.
    // Cubre el caso "otro cajero emitió entremedio y el cache quedó stale".
    const productIds = new Set<string>()
    for (const item of cart.items) {
      if (item.kit_id) productIds.add(item.kit_id)        // kit padre (incluye piezas_kit)
      else productIds.add(item.producto_id)
    }

    const freshCache: Record<string, Producto> = {}
    try {
      await Promise.all(
        Array.from(productIds).map(async (id) => {
          const data = await gql<{ productos: { nodes: ProductoAPI[] } }>(
            PRODUCTO_BY_ID_QUERY,
            { id: Number(id) },
          )
          const node = data.productos?.nodes?.[0]
          if (node) freshCache[id] = backendToProducto(node)
        }),
      )
      if (Object.keys(freshCache).length > 0) {
        setProductosCache(prev => ({ ...prev, ...freshCache }))
      }
    } catch {
      // Si falla el refetch, seguimos con el cache; el backend será la red de seguridad.
    }

    // Validación final pre-emitir con stock fresco.
    // Comparamos `item.cantidad` contra `stockTotal` (no `stockEfectivo`):
    // `stockEfectivo = stockTotal − enCarrito`, así que comparar contra él
    // siempre falla cuando el carrito ya tiene todo el stock cargado,
    // y el frontend termina rechazando su propia orden.
    const errores: string[] = []
    for (const item of cart.items) {
      if (item.kit_id) {
        const parentKit = freshCache[item.kit_id] ?? productosCache[item.kit_id]
        if (!parentKit) continue
        const pieza = parentKit.piezas_kit?.find(pk => String(pk.id) === item.producto_id)
        if (!pieza) continue
        const info = getStockEfectivoPieza(pieza, cart, item.kit_id)
        if (item.cantidad > info.stockTotal) {
          errores.push(`${item.producto_nombre}: tenés ${item.cantidad} · hay ${info.stockTotal} en stock`)
        }
      } else {
        const p = freshCache[item.producto_id] ?? productosCache[item.producto_id]
        if (!p) continue
        const info = getStockEfectivo(p, cart)
        if (item.cantidad > info.stockTotal) {
          errores.push(`${item.producto_nombre}: tenés ${item.cantidad} · hay ${info.stockTotal} en stock`)
        }
      }
    }
    if (errores.length > 0) {
      notify.error('Stock insuficiente', { description: errores.join(' · '), duration: 8000 })
      return
    }

    // Agrupar piezas de kit por kit_id
    const regularItems = cart.items.filter(i => !i.kit_id)
    const kitGroups = cart.items
      .filter(i => !!i.kit_id)
      .reduce<Record<string, CartItem[]>>((acc, i) => {
        if (!acc[i.kit_id!]) acc[i.kit_id!] = []
        acc[i.kit_id!].push(i)
        return acc
      }, {})

    const apiItems = [
      ...regularItems.map(i => ({
        id_Producto: Number(i.producto_id),
        cantidad: i.cantidad,
        esParcial: false,
        precioUnitario: i.precio_unitario,
        piezas: [],
      })),
      ...Object.entries(kitGroups).map(([kitId, pieces]) => ({
        id_Producto: Number(kitId),
        cantidad: 1,
        esParcial: true,
        precioUnitario: pieces.reduce((s, p) => s + p.precio_unitario * p.cantidad, 0),
        piezas: pieces.map(p => ({ id_Pieza: Number(p.producto_id), cantidad: p.cantidad, PrecioUnitario: p.precio_unitario })),
      })),
    ]

    try {
      const result = await api.post<{ ordenId: number; message: string }>('/OrdenVenta', {
        id_Cliente: null,
        nota: cart.nota || null,
        items: apiItems,
      })
      await joinGrupo(`orden-${result.ordenId}`)
      clearCart()
      playBeep({ frequency: 800, duration: 80 })
      notify.success(`#${result.ordenId} enviada a almacén`)
      await loadOrdenes()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al crear la orden')
    }
  }

  const handleOpenCobro = (orden: OrdenVenta) => {
    orden.items.some(i => i.estado === 'faltante') ? setParcialOrden(orden) : setCobroOrden(orden)
  }

  const handleCancelarOrden = (orden: OrdenVenta) => {
    setCancelarOrden(orden)
  }

  const handleConfirmarCancelar = async () => {
    if (!cancelarOrden) return
    try {
      await api.post(`/OrdenVenta/${cancelarOrden.id}/Cancelar`, null)
      updateOrden(cancelarOrden.id, { estado: 'cancelada' })
      notify.success(`${cancelarOrden.numero} cancelada`)
      setCancelarOrden(null)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al cancelar')
    }
  }

  const handleEntregarParcial = () => {
    if (!parcialOrden) return
    setCobroOrden(parcialOrden)
    setParcialOrden(null)
  }

  const handleVentaRapidaCredito = async (data: { id_Cliente: number; items: VentaRapidaCreditoItem[]; descuento: { id?: string; monto: number } | null; nota: string | null }) => {
    // El subtotal sin descuento (el backend descuenta el monto que mandemos)
    const subtotal = data.items.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0)
    const montoDescuento = data.descuento?.monto ?? 0
    const total = Math.max(0, subtotal - montoDescuento)
    try {
      await api.post('/Credito', {
        Id_Cliente: data.id_Cliente,
        Id_OrdenVenta: null,
        EsVentaRapida: true,
        Total: subtotal,
        Id_Descuento: data.descuento?.id ? Number(data.descuento.id) : null,
        MontoDescuento: montoDescuento,
        Nota: data.nota,
        Items: data.items,
      })
      clearCart()
      setVentaRapidaOpen(false)
      playBeep({ frequency: 800, duration: 80 })
      notify.success('Crédito creado', { description: `Venta rápida registrada por ${fmtBs(total)}` })
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al crear el crédito')
      throw err
    }
  }

  const handleVentaRapidaContado = async (data: VentaRapidaContadoConfirm) => {
    setVentaRapidaContadoOpen(false)
    try {
      const res = await api.post<{ message: string; ordenId: number; total: number }>(
        '/OrdenVenta/Rapida',
        {
          id_Cliente: data.id_Cliente,
          nota: data.nota,
          id_Descuento: data.descuento?.id,
          montoDescuento: data.descuento?.monto ?? 0,
          items: data.items,
          pagos: data.pagos.map(p => ({ TipoPago: capitalizeTipoPago(p.tipoPago), Monto: p.monto })),
        },
      )
      clearCart()
      playBeep({ frequency: 800, duration: 80 })
      notify.success('Venta rápida al contado registrada', {
        description: `Cobrado: ${fmtBs(res.total)}`,
      })
      // Refresca la lista de órdenes del cajero para que el historial la vea
      await loadOrdenes()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al registrar la venta rápida')
      throw err
    }
  }

  const handleConfirmarPago = async (data: CheckoutConfirm) => {
    if (!cobroOrden) return
    const { pagos, monto_recibido, billing, descuento, esCredito } = data

    if (esCredito && !billing.cliente_id) {
      notify.error('Para venta a crédito es obligatorio seleccionar un cliente.')
      return
    }

    try {
      await api.post(`/OrdenVenta/${cobroOrden.id}/Completar`, {
        Pagos: pagos.map(p => ({ TipoPago: capitalizeTipoPago(p.tipoPago), Monto: p.monto })),
        Id_Descuento: descuento.id ?? null,
        MontoDescuento: descuento.monto,
        EsCredito: esCredito,
        Id_Cliente: billing.cliente_id ?? null,
        Nota: null,
      })
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al registrar el pago')
      return
    }
    const now = new Date().toISOString()
    const metodoPrimario = pagos[0]?.tipoPago ?? (esCredito ? 'credito' : 'efectivo')
    const ordenCompletada = {
      ...cobroOrden,
      estado: 'completada' as const,
      metodo_pago: metodoPrimario,
      monto_recibido,
      pagado_en: now,
      monto_descuento: descuento.monto,
      descuento: descuento.id
        ? {
            id: String(descuento.id),
            nombre: descuento.nombre ?? '',
            porcentaje: descuento.porcentaje ?? 0,
            color: 'emerald',
            activo: true,
          }
        : undefined,
    }
    updateOrden(cobroOrden.id, {
      estado: 'completada',
      metodo_pago: metodoPrimario,
      monto_recibido,
      pagado_en: now,
      cliente_id: billing.cliente_id != null ? String(billing.cliente_id) : undefined,
      monto_descuento: descuento.monto,
      descuento: ordenCompletada.descuento,
    })
    setCobroOrden(null)
    setFacturaOrden(ordenCompletada)
    if (esCredito) {
      notify.success('Crédito registrado', { description: `${cobroOrden.numero} — pendiente de pago` })
    } else {
      notify.success('Venta cobrada', { description: `${cobroOrden.numero} — ${pagos.length > 1 ? 'pago mixto' : metodoPrimario}` })
    }
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-screen overflow-hidden bg-[#F7F7F7]">
        <header className="bg-[#F7F7F7]/85 backdrop-blur-md sticky top-0 z-40 border-b border-[#E8E5E2] px-7 py-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-semibold text-[24px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Caja</h1>
              <p className="text-xs text-[#7A7571] font-medium mt-0.5">{new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={clsx('h-2 w-2 rounded-full', isConnected ? 'bg-[#3F7A52] animate-pulse' : 'bg-[#B47A1F]')} title={isConnected ? 'Conectado' : 'Reconectando...'} />
              <span className="text-xs text-[#7A7571]">{user?.nombre}</span>
            </div>
          </div>
          <button
            ref={headerBadgeRef}
            onClick={() => setOrdersModalOpen(true)}
            className={clsx(
              'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border transition-all text-xs font-bold',
              listosCount > 0
                ? 'bg-[#B8DCCA] border-[#3F7A52]/30 text-[#1E5C38]'
                : 'bg-white border-[#D8D4D0] text-[#4A4744] hover:bg-[#F7F7F7]'
            )}
          >
            <i className="ti ti-clipboard-list text-[15px]" />
            Órdenes
            {misOrdenes.length > 0 && (
              <span className={clsx(
                'inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-black',
                listosCount > 0 ? 'bg-[#3F7A52] text-white' : 'bg-[#7A7571] text-white'
              )}>
                {misOrdenes.length}
              </span>
            )}
            {listosCount > 0 && <span className="text-[10px] font-normal text-[#3F7A52]">({listosCount} listas)</span>}
          </button>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
          <div className="flex-1 grid grid-cols-[1fr_380px] gap-4 overflow-hidden min-h-0">
            <div className="bg-white rounded-2xl border border-[#D0CBC4] overflow-hidden flex flex-col">
              <ProductSearch onSelectProducto={addToCart} cart={cart} onDecrementProducto={handleDecrementProducto} onViewGallery={setGalleryProducto} />
            </div>
            <div className="bg-white rounded-2xl border border-[#D0CBC4] overflow-hidden flex flex-col">
              <CartPanel
                cart={cart}
                productosCache={productosCache}
                onQtyChange={handleQtyChange}
                onRemoveItem={handleRemoveItem}
                onNotaChange={handleNotaChange}
                onEmitir={handleEmitir}
                onEditPrice={handleEditPrice}
                onCancelarOrden={clearCart}
                onVentaRapidaCredito={() => setVentaRapidaOpen(true)}
                onVentaRapidaContado={() => setVentaRapidaContadoOpen(true)}
                onViewGallery={(producto_id) => {
                  const p = productosCache[producto_id]
                  if (p) setGalleryProducto(p)
                }}
                emitButtonRef={(el) => { (emitButtonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el }}
              />
            </div>
          </div>
        </div>
      </div>

      {flyingBall && (
        <FlyingBall
          fromRect={flyingBall.from}
          toRect={headerBadgeRef.current?.getBoundingClientRect() ?? null}
          itemCount={flyingBall.items}
          onComplete={handleFlyingComplete}
        />
      )}

      <OrdersModal
        ordenes={misOrdenes}
        canceladas={canceladas}
        onCobrar={handleOpenCobro}
        onCancelar={handleCancelarOrden}
        open={ordersModalOpen}
        onClose={() => setOrdersModalOpen(false)}
      />

      {parcialOrden && (
        <PickingParcialModal orden={parcialOrden} onPartial={handleEntregarParcial} onCancelar={() => { setCancelarOrden(parcialOrden); setParcialOrden(null) }} onClose={() => setParcialOrden(null)} />
      )}
      {cobroOrden && (
        <CheckoutModal
          open
          orden={cobroOrden}
          clientes={clientes}
          descuentos={descuentos}
          onConfirm={handleConfirmarPago}
          onClose={() => setCobroOrden(null)}
        />
      )}
      {facturaOrden && <FacturaModal orden={facturaOrden} onClose={() => setFacturaOrden(null)} />}
      {cancelarOrden && <CancelarOrdenModal orden={cancelarOrden} onConfirm={handleConfirmarCancelar} onClose={() => setCancelarOrden(null)} />}
      {productoSeleccionado && (
        <SelectPriceModal
          producto={productoSeleccionado}
          precioBase={productoSeleccionado.precio_venta}
          onSelect={handleUpdatePrice}
          isEdit
          onClose={() => setProductoSeleccionado(null)}
        />
      )}
      {kitSeleccionado && (() => {
        const preciosIniciales = Object.fromEntries(
          cart.items
            .filter(i => i.kit_id === kitSeleccionado.id && i.precio_unitario > 0)
            .map(i => [i.producto_id, i.precio_unitario])
        )
        return (
          <KitSeleccionModal
            open
            onClose={() => setKitSeleccionado(null)}
            kit={kitSeleccionado}
            onConfirm={handleKitSeleccion}
            preciosIniciales={preciosIniciales}
          />
        )
      })()}
      {ventaRapidaOpen && (
        <VentaRapidaCreditoModal
          open={ventaRapidaOpen}
          cart={cart}
          clientes={clientes}
          descuentos={descuentos}
          onConfirm={handleVentaRapidaCredito}
          onClose={() => setVentaRapidaOpen(false)}
        />
      )}
      {ventaRapidaContadoOpen && (
        <VentaRapidaContadoModal
          open={ventaRapidaContadoOpen}
          cart={cart}
          clientes={clientes}
          descuentos={descuentos}
          onConfirm={handleVentaRapidaContado}
          onClose={() => setVentaRapidaContadoOpen(false)}
        />
      )}
      <GalleryViewerModal
        producto={galleryProducto}
        onClose={() => setGalleryProducto(null)}
      />
    </MainLayout>
  )
}