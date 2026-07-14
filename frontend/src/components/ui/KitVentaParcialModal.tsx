import { useState, useMemo } from 'react'
import { clsx } from 'clsx'
import type { Producto } from '@/types'
import { useCajaStore } from '@/stores/cajaStore'
import { getStockEfectivo, getStockEfectivoPieza } from '@/utils/stockValidator'

interface PiezaSeleccionada {
  producto_id: string
  nombre: string
  /** Código técnico de la pieza (formato P{N}-{Prefijo}-{CodigoKit}). */
  codigo: string
  stock: number
  cantidad: number
  cantidad_por_kit: number
  precio: number
}

export type KitSeleccionResult =
  | { tipo: 'kit_completo'; cantidad: number }
  | { tipo: 'piezas_sueltas'; piezas: PiezaSeleccionada[] }
  | { tipo: 'ambos'; cantidad_kit: number; piezas: PiezaSeleccionada[] }

interface KitSeleccionModalProps {
  open: boolean
  onClose: () => void
  kit: Producto
  onConfirm: (result: KitSeleccionResult) => void
  preciosIniciales?: Record<string, number>
}

export function KitSeleccionModal({ open, onClose, kit, onConfirm, preciosIniciales }: KitSeleccionModalProps) {
  const cart = useCajaStore(s => s.cart)
  const [cantidadKit, setCantidadKit] = useState(0)
  const [seleccionadas, setSeleccionadas] = useState<PiezaSeleccionada[]>(() => {
    if (!preciosIniciales) return []
    return (kit.piezas_kit ?? [])
      .filter(p => (preciosIniciales[String(p.id)] ?? 0) > 0)
      .map(p => {
        // Si la pieza ya está en el carrito, pre-cargamos la cantidad real
        // del carrito (no el default por kit) para que el cajero vea cuánto
        // tiene actualmente. Si confirma sin tocar nada, se le suma esa misma
        // cantidad al carrito (semántica "agregar más"), comportamiento que
        // ya existía — el bug anterior era que mostraba `cantidad_por_kit`
        // (típicamente 2) en vez de la cantidad real (ej. 5), causando
        // confusión entre lo que el modal mostraba y lo que estaba en el carrito.
        const cartItem = cart.items.find(
          i => i.kit_id === kit.id && i.producto_id === String(p.id),
        )
        return {
          producto_id: String(p.id),
          nombre: p.nombre,
          codigo: p.codigo_pieza,
          stock: Math.max(0, p.stock_actual - p.stock_reservado),
          cantidad: cartItem?.cantidad ?? p.cantidad_por_kit,
          cantidad_por_kit: p.cantidad_por_kit,
          precio: preciosIniciales[String(p.id)],
        }
      })
  })
  const [precios, setPrecios] = useState<Record<string, string>>(
    () => Object.fromEntries(Object.entries(preciosIniciales ?? {}).map(([k, v]) => [k, String(v)]))
  )
  const [errorPrecios, setErrorPrecios] = useState(false)

  const stockDisponible = getStockEfectivo(kit, cart).stockEfectivo
  const stockCls = stockDisponible === 0
    ? 'bg-[#F5C9C0] text-[#8A1E12]'
    : stockDisponible <= kit.stock_minimo
      ? 'bg-[#F5E0A8] text-[#7A5200]'
      : 'bg-[#B8DCCA] text-[#1E5C38]'

  const piezasKit = useMemo(() =>
    (kit.piezas_kit ?? []).map(p => {
      const info = getStockEfectivoPieza(p, cart, kit.id)
      return {
        producto_id: String(p.id),
        nombre: p.nombre,
        codigo: p.codigo_pieza,
        stock: info.stockEfectivo,
        cantidad_por_kit: p.cantidad_por_kit,
        precio: 0,
      }
    }),
    [kit.piezas_kit, kit.id, cart],
  )

  const togglePieza = (productoId: string) => {
    const existe = seleccionadas.find(s => s.producto_id === productoId)
    if (existe) {
      setSeleccionadas(prev => prev.filter(s => s.producto_id !== productoId))
    } else {
      const info = piezasKit.find(p => p.producto_id === productoId)
      if (!info) return
      setSeleccionadas(prev => [...prev, { ...info, cantidad: info.cantidad_por_kit }])
    }
  }

  const updateCantidadPieza = (productoId: string, cantidad: number) => {
    setSeleccionadas(prev =>
      prev.map(s =>
        s.producto_id === productoId
          ? { ...s, cantidad: Math.max(1, Math.min(cantidad, s.stock)) }
          : s,
      ),
    )
  }

  const tieneKit = cantidadKit > 0 && stockDisponible > 0
  const tienePiezas = seleccionadas.length > 0
  const confirmDisabled = !tieneKit && !tienePiezas

  const piezasConPrecio = (): PiezaSeleccionada[] =>
    seleccionadas.map(s => ({ ...s, precio: parseFloat(precios[s.producto_id] ?? '0') || 0 }))

  const handleConfirm = () => {
    if (tienePiezas) {
      const sinPrecio = seleccionadas.some(s => !(parseFloat(precios[s.producto_id] ?? '0') > 0))
      if (sinPrecio) {
        setErrorPrecios(true)
        return
      }
    }
    setErrorPrecios(false)
    const piezas = piezasConPrecio()
    if (tieneKit && tienePiezas) {
      onConfirm({ tipo: 'ambos', cantidad_kit: cantidadKit, piezas })
    } else if (tieneKit) {
      onConfirm({ tipo: 'kit_completo', cantidad: cantidadKit })
    } else {
      onConfirm({ tipo: 'piezas_sueltas', piezas })
    }
    handleClose()
  }

  const handleClose = () => {
    setCantidadKit(0)
    setSeleccionadas([])
    setPrecios({})
    setErrorPrecios(false)
    onClose()
  }

  if (!open) return null

  const allCodes = [kit.codigo_universal, ...kit.codigos_alternativos.filter(Boolean)]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(45,43,42,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden border border-[#E8E5E2]">

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 border-b border-[#E8E5E2] bg-[#F5F0EB]">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#780e18] to-[#B4881C] flex items-center justify-center shrink-0">
              <i className="ti ti-stack text-white text-[20px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1 mb-1">
                {allCodes.slice(0, 3).map((code, i) => (
                  <span key={i} className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-[11px]',
                    i === 0 ? 'bg-[#780e18] text-white' : 'bg-[#2D2B2A] text-[#F7F7F7]'
                  )}>
                    {i === 0 ? kit.codigo_universal : code}
                  </span>
                ))}
              </div>
              <p className="text-[13px] font-medium text-[#4A4744] truncate leading-tight">{kit.nombre}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', stockCls)}>
                  <span className="w-1 h-1 rounded-full bg-current" />
                  {stockDisponible} kits disponibles
                </span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-[#7A7571] hover:text-[#2D2B2A] transition-colors p-1.5 rounded-lg hover:bg-[#E8E5E2] shrink-0"
            >
              <i className="ti ti-x text-[18px]" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">

          {/* Kit completo */}
          <div
            className={clsx(
              'rounded-xl border border-l-4 p-4 transition-all duration-200',
              stockDisponible > 0 && 'cursor-pointer',
              tieneKit
                ? 'bg-[#F4ECDB]/50 border-[#D0CBC4]'
                : 'bg-white border-[#D0CBC4]',
            )}
            style={{ borderLeftColor: tieneKit ? '#780e18' : '#D0CBC4' }}
            onClick={() => { if (stockDisponible > 0) setCantidadKit(q => Math.min(stockDisponible, q + 1)) }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  tieneKit
                    ? 'bg-gradient-to-br from-[#780e18] to-[#D4A333]'
                    : 'bg-[#F0EFEC]'
                )}>
                  <i className={clsx('ti ti-stack text-[15px]', tieneKit ? 'text-white' : 'text-[#7A7571]')} />
                </div>
                <div>
                  <p className={clsx('text-sm font-bold leading-tight', tieneKit ? 'text-[#780e18]' : 'text-[#2D2B2A]')}>
                    Kit completo
                  </p>
                  <p className="text-[10px] text-[#7A7571] font-medium mt-0.5">
                    {stockDisponible} en stock
                  </p>
                </div>
              </div>
              {stockDisponible === 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5C9C0] text-[#8A1E12]">
                  Sin stock
                </span>
              )}
            </div>

            {stockDisponible > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#7A7571] uppercase tracking-[0.1em]">Cantidad</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={e => { e.stopPropagation(); setCantidadKit(q => Math.max(0, q - 1)) }}
                    className="h-8 w-8 rounded-lg border border-[#E8E5E2] flex items-center justify-center text-[#4A4744] hover:bg-[#F0EFEC] font-bold transition-colors"
                  >
                    <i className="ti ti-minus text-[13px]" />
                  </button>
                  <span className={clsx(
                    'w-10 text-center font-mono font-black text-[22px] leading-none tabular-nums',
                    tieneKit ? 'text-[#780e18]' : 'text-[#7A7571]'
                  )}>
                    {cantidadKit}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setCantidadKit(q => Math.min(stockDisponible, q + 1)) }}
                    disabled={cantidadKit >= stockDisponible}
                    className="h-8 w-8 rounded-lg border border-[#E8E5E2] flex items-center justify-center text-[#4A4744] hover:bg-[#F0EFEC] font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="ti ti-plus text-[13px]" />
                  </button>
                </div>
              </div>
            )}
            {!tieneKit && stockDisponible > 0 && (
              <p className="text-[10px] text-[#7A7571] font-medium text-center mt-2">
                Cantidad en 0 — no se agregará kit
              </p>
            )}
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E8E5E2]" />
            <span className="text-[10px] font-bold text-[#7A7571] uppercase tracking-[0.12em]">y / o</span>
            <div className="flex-1 h-px bg-[#E8E5E2]" />
          </div>

          {/* Piezas sueltas */}
          <div className={clsx(
            'rounded-xl border border-l-4 overflow-hidden transition-all duration-200',
            tienePiezas ? 'border-[#D0CBC4]' : 'border-[#D0CBC4]',
          )}
            style={{ borderLeftColor: tienePiezas ? '#3055A4' : '#D0CBC4' }}
          >
            {/* Piezas header */}
            <div className={clsx('px-4 pt-4 pb-2', tienePiezas && 'bg-[#E8EEF8]/30')}>
              <div className="flex items-center gap-2.5">
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  tienePiezas ? 'bg-[#3055A4]' : 'bg-[#F0EFEC]'
                )}>
                  <i className={clsx('ti ti-puzzle text-[15px]', tienePiezas ? 'text-white' : 'text-[#7A7571]')} />
                </div>
                <div className="flex-1">
                  <p className={clsx('text-sm font-bold leading-tight', tienePiezas ? 'text-[#1A3875]' : 'text-[#2D2B2A]')}>
                    Piezas sueltas
                  </p>
                  {tienePiezas && (
                    <p className="text-[10px] text-[#3055A4] font-medium mt-0.5">
                      {seleccionadas.reduce((s, p) => s + p.cantidad, 0)} piezas · {seleccionadas.length} productos
                    </p>
                  )}
                </div>
              </div>
              {errorPrecios && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#8A1E12] bg-[#F5C9C0]/60 px-2.5 py-1 rounded-lg">
                  <i className="ti ti-alert-circle text-[12px]" />
                  Ingresa precio para todas las piezas seleccionadas
                </div>
              )}
            </div>

            {piezasKit.length === 0 ? (
              <p className="text-sm text-[#7A7571] text-center py-8 px-4 font-medium">
                Este kit no tiene piezas registradas
              </p>
            ) : (
              <div className="divide-y divide-[#E8E5E2] max-h-64 overflow-y-auto">
                {piezasKit.map(pieza => {
                  const sel = seleccionadas.find(s => s.producto_id === pieza.producto_id)
                  const checked = !!sel
                  const sinStock = pieza.stock === 0
                  const precioVal = precios[pieza.producto_id] ?? ''
                  const precioInvalido = errorPrecios && checked && !(parseFloat(precioVal) > 0)

                  return (
                    <div
                      key={pieza.producto_id}
                      onClick={() => { if (!checked && !sinStock) { togglePieza(pieza.producto_id); setErrorPrecios(false) } }}
                      className={clsx(
                        'px-4 py-3 transition-colors',
                        !sinStock || checked ? 'cursor-pointer' : 'cursor-not-allowed',
                        checked ? 'bg-[#E8EEF8]/40' : sinStock ? 'opacity-40' : 'hover:bg-[#FAF5EE]',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Toggle custom */}
                        <div
                          onClick={e => { e.stopPropagation(); if (!sinStock || checked) { togglePieza(pieza.producto_id); setErrorPrecios(false) } }}
                          className={clsx(
                            'h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer',
                            checked
                              ? 'bg-[#3055A4] border-[#3055A4]'
                              : 'bg-white border-[#D0CBC4] hover:border-[#3055A4]',
                          )}
                        >
                          {checked && <i className="ti ti-check text-white text-[11px]" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[#2D2B2A] truncate">{pieza.nombre}</p>
                          {pieza.codigo && (
                            <p className="font-mono text-[10px] text-[#7A7571] tracking-[0.04em] mt-0.5">
                              {pieza.codigo}
                            </p>
                          )}
                          <p className="text-[10px] font-mono text-[#7A7571] mt-0.5">
                            Stock: {pieza.stock}
                            <span className="mx-1 opacity-40">·</span>
                            {pieza.cantidad_por_kit}× por kit
                          </p>
                        </div>

                        {checked && (
                          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => updateCantidadPieza(pieza.producto_id, (sel?.cantidad ?? 1) - 1)}
                              className="h-7 w-7 rounded-lg border border-[#E8E5E2] flex items-center justify-center text-[#4A4744] hover:bg-[#F0EFEC] transition-colors"
                            >
                              <i className="ti ti-minus text-[12px]" />
                            </button>
                            <span className="w-7 text-center text-sm font-mono font-bold text-[#2D2B2A]">
                              {sel?.cantidad ?? 1}
                            </span>
                            <button
                              onClick={() => updateCantidadPieza(pieza.producto_id, (sel?.cantidad ?? 1) + 1)}
                              disabled={(sel?.cantidad ?? 1) >= pieza.stock}
                              className="h-7 w-7 rounded-lg border border-[#E8E5E2] flex items-center justify-center text-[#4A4744] hover:bg-[#F0EFEC] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <i className="ti ti-plus text-[12px]" />
                            </button>
                          </div>
                        )}
                      </div>

                      {checked && (
                        <div className="mt-2.5 flex items-center gap-2 pl-8" onClick={e => e.stopPropagation()}>
                          <label className="text-[11px] font-semibold text-[#7A7571] shrink-0">Precio (Bs)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            value={precioVal}
                            onChange={e => {
                              setPrecios(prev => ({ ...prev, [pieza.producto_id]: e.target.value }))
                              setErrorPrecios(false)
                            }}
                            className={clsx(
                              'w-28 h-8 rounded-xl border px-3 text-sm text-right font-mono focus:outline-none focus:ring-2 transition-all',
                              precioInvalido
                                ? 'border-[#B23A2A] focus:ring-[#B23A2A]/20 bg-[#F5C9C0]/20'
                                : 'border-[#E8E5E2] focus:border-[#780e18] focus:ring-[#780e18]/10 bg-white'
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="px-5 pb-5 pt-3 border-t border-[#E8E5E2] flex gap-2">
          <button
            onClick={handleClose}
            className="flex-1 h-10 rounded-xl border border-[#E8E5E2] text-sm font-semibold text-[#4A4744] hover:bg-[#F0EFEC] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="flex-1 h-10 rounded-xl bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-sm font-bold active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Agregar al carrito
          </button>
        </div>

      </div>
    </div>
  )
}
