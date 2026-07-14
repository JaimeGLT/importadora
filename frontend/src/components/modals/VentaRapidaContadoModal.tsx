import { useState, useMemo, useEffect } from 'react'
import { clsx } from 'clsx'
import { Button, Input, Modal } from '@/components/ui'
import { notify } from '@/lib/notify'
import { getDescuentoColor } from '@/utils/descuentoColors'
import type { DescuentoConfig } from '@/stores/configStore'
import type { Cliente, MetodoPago } from '@/types'
import type { Cart } from '@/stores/cajaStore'

const fmtBs = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const METODOS: { value: MetodoPago; label: string; icon: React.ReactNode }[] = [
  { value: 'efectivo', label: 'Efectivo', icon: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.657 0-3-.895-3-2s1.343-2 3-2 3 .895 3 2-1.343 2-3 2m0-1v-1m0 1v1m0 1v1M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  )},
  { value: 'tarjeta', label: 'Tarjeta', icon: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )},
  { value: 'qr', label: 'QR', icon: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
    </svg>
  )},
]

export interface VentaRapidaContadoItem {
  id_Producto: number       // kit padre (si es pieza) o producto regular
  id_Pieza?: number         // presente si el item es una pieza suelta del kit
  cantidad: number
  precioUnitario: number
}

export interface VentaRapidaContadoConfirm {
  id_Cliente?: number
  items: VentaRapidaContadoItem[]
  pagos: { tipoPago: MetodoPago; monto: number }[]
  descuento: { id?: string; monto: number } | null
  nota: string | null
}

export interface VentaRapidaContadoModalProps {
  open: boolean
  cart: Cart
  clientes: Cliente[]
  descuentos: DescuentoConfig[]
  onConfirm: (data: VentaRapidaContadoConfirm) => Promise<void> | void
  onClose: () => void
}

/**
 * Venta rápida al contado: el cajero arma un carrito, esta modal le
 * permite elegir descuento, cliente (opcional) y método de pago (efectivo,
 * tarjeta, QR o mixto). Al confirmar genera una OrdenVenta en estado
 * Completada y un MovimientoCaja por cada pago, sin pasar por almacén.
 * Stock se descuenta de inmediato.
 */
export function VentaRapidaContadoModal({
  open,
  cart,
  clientes,
  descuentos,
  onConfirm,
  onClose,
}: VentaRapidaContadoModalProps) {

  // ─── Estado del formulario ─────────────────────────────────────────────────
  const [descuentoId, setDescuentoId] = useState<string>('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteSelected, setClienteSelected] = useState<Cliente | null>(null)
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const [nota, setNota] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ─── Pago ──────────────────────────────────────────────────────────────────
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [pagoMixto, setPagoMixto] = useState(false)
  const [metodo2, setMetodo2] = useState<MetodoPago>('tarjeta')
  const [monto2Str, setMonto2Str] = useState('')
  const [montoStr, setMontoStr] = useState('')

  // ─── Cálculos ──────────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => cart.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0),
    [cart.items],
  )

  const descuentosActivos = useMemo(
    () => descuentos.filter((d) => d.activo),
    [descuentos],
  )
  const descuentoSel = descuentosActivos.find((d) => d.id === descuentoId) ?? null
  const montoDescuento = descuentoSel
    ? Math.round(subtotal * descuentoSel.porcentaje) / 100
    : 0
  const total = Math.max(0, subtotal - montoDescuento)

  const monto2 = parseFloat(monto2Str.replace(',', '.')) || 0
  const monto1Mixto = Math.max(0, total - monto2)
  const monto = parseFloat(montoStr.replace(',', '.'))
  const cambio = metodo === 'efectivo' && !isNaN(monto) ? monto - total : null

  // Sincroniza el montoStr con el total cuando cambia (para el campo "Monto recibido")
  useEffect(() => {
    setMontoStr(total.toFixed(2))
  }, [total])

  // ─── Cliente (opcional) ───────────────────────────────────────────────────
  const filteredClientes = useMemo(() => {
    if (!clienteSearch.trim()) return []
    const q = clienteSearch.toLowerCase()
    return clientes
      .filter(
        (c) =>
          c.apellido.toLowerCase().includes(q) ||
          (c.nombre?.toLowerCase().includes(q) ?? false) ||
          (c.telefono?.includes(clienteSearch) ?? false),
      )
      .slice(0, 5)
  }, [clientes, clienteSearch])

  const handleSelectCliente = (c: Cliente) => {
    setClienteSelected(c)
    setClienteSearch('')
    setShowClienteDropdown(false)
  }

  // ─── Confirm ──────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (cart.items.length === 0) {
      notify.error('El carrito está vacío.')
      return
    }

    if (pagoMixto) {
      if (monto2 <= 0 || monto2 >= total) {
        notify.error('En pago mixto, el segundo monto debe ser mayor a 0 y menor al total.')
        return
      }
      if (metodo === metodo2) {
        notify.error('En pago mixto los dos métodos deben ser distintos.')
        return
      }
    }

    // Cada pieza del carrito se envía como item separado con id_Pieza poblado;
    // cada producto regular (no pieza) se envía tal cual. El backend crea un
    // OrdenVentaItem parcial por cada pieza para preservar la info de qué
    // piezas se vendieron (no se agrupan bajo el kit padre).
    const items: VentaRapidaContadoItem[] = cart.items.map((i) => ({
      id_Producto: Number(i.kit_id ?? i.producto_id),
      id_Pieza: i.kit_id ? Number(i.producto_id) : undefined,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
    }))

    const pagos: VentaRapidaContadoConfirm['pagos'] = pagoMixto
      ? [
          { tipoPago: metodo, monto: monto1Mixto },
          { tipoPago: metodo2, monto: monto2 },
        ]
      : [{ tipoPago: metodo, monto: total }]

    setSubmitting(true)
    try {
      await onConfirm({
        id_Cliente: clienteSelected?.id,
        items,
        pagos,
        descuento: descuentoSel
          ? { id: descuentoSel.id, monto: montoDescuento }
          : null,
        nota: nota.trim() || null,
      })
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al registrar la venta rápida')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Venta rápida al contado" size="lg">
      <div className="space-y-4 pt-1">

        {/* Items del carrito */}
        <div>
          <p className="text-xs font-bold text-[#7A7571] uppercase tracking-widest mb-2">
            Productos ({cart.items.length})
          </p>
          <div className="rounded-xl border border-[#E8E5E2] overflow-hidden divide-y divide-[#E8E5E2] max-h-48 overflow-y-auto">
            {cart.items.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-[#7A7571]">
                El carrito está vacío.
              </div>
            ) : (
              cart.items.map((item, idx) => (
                <div
                  key={`${item.producto_id}-${item.kit_id ?? 'root'}-${idx}`}
                  className="px-3 py-2.5"
                >
                  {item.kit_id && (item.kit_nombre || item.kit_codigo) && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <i className="ti ti-stack text-[10px] text-[#D4A333]" />
                      {item.kit_codigo && (
                        <span className="font-mono text-[10px] font-bold text-[#7A5200] bg-[#F5E0A8] px-1.5 py-0.5 rounded">
                          {item.kit_codigo}
                        </span>
                      )}
                      {item.kit_nombre && (
                        <span className="text-[10px] text-[#7A5200] truncate">{item.kit_nombre}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] font-bold text-[#780e18] bg-[#F4ECDB] px-1.5 py-0.5 rounded shrink-0">
                        {item.producto_codigo}
                      </span>
                      <span className="text-xs text-[#4A4744] truncate">{item.producto_nombre}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-[11px] text-[#7A7571]">×{item.cantidad}</span>
                      <span className="ml-2 text-xs font-semibold text-[#2D2B2A]">
                        {fmtBs(item.precio_unitario * item.cantidad)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center justify-between pt-2 px-1">
            <span className="text-xs font-bold text-[#7A7571]">Subtotal</span>
            <span className="text-xs font-semibold text-[#4A4744]">{fmtBs(subtotal)}</span>
          </div>
          {descuentoSel && (
            <div className="flex items-center justify-between pt-1 px-1">
              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border',
                  getDescuentoColor(descuentoSel.color, 'badge'),
                )}
              >
                <i className="ti ti-discount-2 text-[12px]" />
                {descuentoSel.nombre} · {descuentoSel.porcentaje}%
              </span>
              <span className="text-xs font-semibold text-[#1E5C38]">−{fmtBs(montoDescuento)}</span>
            </div>
          )}
          <div className="flex items-center justify-between mt-2 pt-3 border-t-2 border-[#780e18]/15">
            <span className="text-xs font-black text-[#780e18] uppercase tracking-widest">Total a cobrar</span>
            <span className="text-2xl font-black text-[#780e18] tabular-nums">{fmtBs(total)}</span>
          </div>
        </div>

        {/* Descuento (cards grid) */}
        <div>
          <p className="text-xs font-bold text-[#7A7571] uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <i className="ti ti-discount-2 text-[13px]" />
            Descuento
          </p>
          <div className="grid grid-cols-3 gap-2">
            {/* Sin descuento (primera opción) */}
            <button
              type="button"
              onClick={() => setDescuentoId('')}
              className={clsx(
                'py-2.5 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-0.5',
                !descuentoSel
                  ? 'border-[#780e18] bg-[#F4ECDB] text-[#780e18]'
                  : 'border-[#E8E5E2] text-[#7A7571] hover:border-[#D0CBC4] hover:bg-[#FAF5EE]'
              )}
            >
              <i className="ti ti-x text-[18px]" />
              <span>Sin descuento</span>
            </button>
            {descuentosActivos.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDescuentoId(d.id)}
                className={clsx(
                  'py-2.5 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-0.5 min-w-0',
                  descuentoId === d.id
                    ? getDescuentoColor(d.color, 'selected')
                    : clsx(
                        getDescuentoColor(d.color, 'border'),
                        'text-[#7A7571] hover:bg-[#FAF5EE]'
                      )
                )}
                title={`${d.nombre} · ${d.porcentaje}%`}
              >
                <i className={clsx('ti ti-discount-2 text-[18px]', getDescuentoColor(d.color, 'icon'))} />
                <span className="truncate max-w-full">{d.nombre}</span>
                <span className="text-[10px] font-black opacity-80">−{d.porcentaje}%</span>
              </button>
            ))}
          </div>
          {descuentosActivos.length === 0 && (
            <p className="text-[10px] text-[#7A7571] mt-1 italic">No hay descuentos activos configurados.</p>
          )}
        </div>

        {/* Cliente (opcional) */}
        <div>
          <p className="text-xs font-bold text-[#7A7571] uppercase tracking-widest mb-2 flex items-center gap-1">
            Cliente
            <span className="text-[10px] font-normal text-[#7A7571] normal-case tracking-normal">
              (opcional)
            </span>
          </p>
          {clienteSelected ? (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#B8DCCA]/30 border border-[#B8DCCA]">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1E5C38] truncate">
                  {clienteSelected.nombre
                    ? `${clienteSelected.nombre} ${clienteSelected.apellido}`
                    : clienteSelected.apellido}
                </p>
                {clienteSelected.telefono && (
                  <p className="text-xs text-[#3F7A52]">{clienteSelected.telefono}</p>
                )}
              </div>
              <button
                onClick={() => setClienteSelected(null)}
                className="p-1.5 text-[#3F7A52] hover:text-[#1E5C38] hover:bg-[#B8DCCA]/50 rounded-lg transition-colors shrink-0"
              >
                <i className="ti ti-x text-[14px]" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={clienteSearch}
                onChange={(e) => {
                  setClienteSearch(e.target.value)
                  setShowClienteDropdown(true)
                }}
                onFocus={() => setShowClienteDropdown(true)}
                onBlur={() => setTimeout(() => setShowClienteDropdown(false), 150)}
                placeholder="Buscar cliente por nombre o teléfono…"
                className="w-full text-xs px-3 py-2.5 bg-white border border-[#E8E5E2] rounded-xl focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 placeholder:text-[#7A7571]"
              />
              {showClienteDropdown && clienteSearch.trim() && (
                <div className="absolute z-20 w-full mt-1 bg-white rounded-xl border border-[#E8E5E2] shadow-lg max-h-40 overflow-y-auto">
                  {filteredClientes.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-[#7A7571] text-center">
                      Sin resultados
                    </div>
                  ) : (
                    filteredClientes.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCliente(c)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#FAF5EE] transition-colors text-left"
                      >
                        <div className="h-7 w-7 rounded-full bg-[#F4ECDB] flex items-center justify-center text-[10px] font-bold text-[#780e18] shrink-0">
                          {c.nombre ? c.nombre.charAt(0) : c.apellido.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#2D2B2A] truncate">
                            {c.nombre ? `${c.nombre} ${c.apellido}` : c.apellido}
                          </p>
                          {c.telefono && (
                            <p className="text-[10px] text-[#7A7571]">{c.telefono}</p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Método de pago */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#7A7571] uppercase tracking-widest">
              Método de pago
            </p>
            <button
              onClick={() => setPagoMixto((v) => !v)}
              className={clsx(
                'text-[11px] font-bold px-2 py-1 rounded-lg border transition-all',
                pagoMixto
                  ? 'bg-[#F4ECDB] border-[#D4A333]/50 text-[#780e18]'
                  : 'bg-[#F7F7F7] border-[#E8E5E2] text-[#7A7571] hover:border-[#D0CBC4]',
              )}
            >
              {pagoMixto ? 'Pago mixto ✓' : 'Pago mixto'}
            </button>
          </div>
          {!pagoMixto ? (
            <div className="grid grid-cols-3 gap-2">
              {METODOS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMetodo(m.value)}
                  className={clsx(
                    'py-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-1',
                    metodo === m.value
                      ? 'border-[#780e18] bg-[#F4ECDB] text-[#780e18]'
                      : 'border-[#E8E5E2] text-[#7A7571] hover:border-[#D0CBC4]',
                  )}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {METODOS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMetodo(m.value)}
                      className={clsx(
                        'py-2 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-0.5',
                        metodo === m.value
                          ? 'border-[#780e18] bg-[#F4ECDB] text-[#780e18]'
                          : 'border-[#E8E5E2] text-[#7A7571] hover:border-[#D0CBC4]',
                      )}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="w-28 shrink-0">
                  <p className="text-xs text-[#7A7571] mb-1">
                    Bs {monto1Mixto > 0 ? monto1Mixto.toFixed(2) : '—'}
                  </p>
                  <p className="text-[10px] text-[#7A7571]">Resto automático</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {METODOS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMetodo2(m.value)}
                      className={clsx(
                        'py-2 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-0.5',
                        metodo2 === m.value
                          ? 'border-[#780e18] bg-[#F4ECDB] text-[#780e18]'
                          : 'border-[#E8E5E2] text-[#7A7571] hover:border-[#D0CBC4]',
                      )}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="w-28 shrink-0">
                  <Input
                    type="number"
                    step="0.50"
                    min="0.01"
                    max={total - 0.01}
                    value={monto2Str}
                    onChange={(e) => setMonto2Str(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Monto recibido / Cambio (solo efectivo, pago simple) */}
        {!pagoMixto && metodo === 'efectivo' && (
          <div>
            <label className="block text-xs font-bold text-[#7A7571] uppercase tracking-widest mb-1.5">
              Monto recibido (Bs)
            </label>
            <Input
              type="number"
              min={total}
              step="0.50"
              value={montoStr}
              onChange={(e) => setMontoStr(e.target.value)}
            />
            {cambio !== null && cambio >= 0 && (
              <p className="text-sm font-bold text-[#3F7A52] mt-2">Cambio: {fmtBs(cambio)}</p>
            )}
          </div>
        )}

        {/* Nota opcional */}
        <div>
          <p className="text-xs font-bold text-[#7A7571] uppercase tracking-widest mb-2">
            Nota (opcional)
          </p>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Motivo, referencia, condiciones…"
            className="w-full text-xs px-3 py-2 bg-white border border-[#E8E5E2] rounded-xl focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 placeholder:text-[#7A7571] resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={submitting || cart.items.length === 0}
            loading={submitting}
          >
            <i className="ti ti-cash text-[14px] mr-1" />
            Confirmar venta
          </Button>
        </div>
      </div>
    </Modal>
  )
}
