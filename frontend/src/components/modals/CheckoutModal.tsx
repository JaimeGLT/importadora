import { useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { Button, Input, Modal } from '@/components/ui'
import type { DescuentoConfig } from '@/stores/configStore'
import { notify } from '@/lib/notify'
import { getDescuentoColor } from '@/utils/descuentoColors'
import type { OrdenVenta, MetodoPago, Cliente, PagoOrden } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── CheckoutModal ────────────────────────────────────────────────────────────

export interface CheckoutConfirm {
  pagos: PagoOrden[]
  monto_recibido: number
  billing: { cliente_id?: number }
  descuento: { id?: number | string; monto: number; porcentaje?: number; nombre?: string }
  /** true si el cajero eligió "Crédito" — el cliente es obligatorio. */
  esCredito: boolean
}

export interface CheckoutModalProps {
  open: boolean
  orden: OrdenVenta
  clientes: Cliente[]
  descuentos: DescuentoConfig[]
  onConfirm: (data: CheckoutConfirm) => void
  onClose: () => void
}

export function CheckoutModal({
  open,
  orden,
  clientes,
  descuentos,
  onConfirm,
  onClose,
}: CheckoutModalProps) {

  // ─── Totales (sobre los items despachados) ─────────────────────────────────
  const itemsDespachados = orden.items.filter(i =>
    i.estado === 'completo' || i.estado === 'parcial' ||
    (i.estado === 'faltante' && (i.cantidad_recogida ?? 0) > 0)
  )
  const itemsFaltantes = orden.items.filter(i =>
    i.estado === 'faltante' && ((i.cantidad_recogida ?? 0) === 0)
  )
  const subtotal = itemsDespachados.reduce((s, i) => {
    if (i.es_parcial && i.piezas_orden?.length)
      return s + i.piezas_orden.filter(p => p.confirmado).reduce((ps, p) => ps + (p.precio_unitario ?? 0) * p.cantidad, 0)
    return s + i.precio_unitario * (i.cantidad_recogida ?? i.cantidad_pedida)
  }, 0)

  // ─── Descuento ─────────────────────────────────────────────────────────────
  const descuentosActivos = useMemo(
    () => descuentos.filter(d => d.activo),
    [descuentos],
  )
  const [descuentoId, setDescuentoId] = useState<string>('')
  const descuentoSel = descuentosActivos.find(d => d.id === descuentoId) ?? null
  const montoDescuento = descuentoSel
    ? Math.round(subtotal * descuentoSel.porcentaje) / 100
    : 0
  const total = Math.max(0, subtotal - montoDescuento)

  // ─── Modo de pago (Contado / Crédito) ──────────────────────────────────────
  const [modoPago, setModoPago] = useState<'contado' | 'credito'>('contado')
  const esCredito = modoPago === 'credito'

  // ─── Pago ──────────────────────────────────────────────────────────────────
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [montoStr, setMontoStr] = useState(total.toFixed(2))
  const [pagoMixto, setPagoMixto] = useState(false)
  const [metodo2, setMetodo2] = useState<MetodoPago>('tarjeta')
  const [monto2Str, setMonto2Str] = useState('')
  const monto2 = parseFloat(monto2Str.replace(',', '.')) || 0
  const monto1Mixto = total - monto2

  // ─── Cliente ──────────────────────────────────────────────────────────────
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteSelected, setClienteSelected] = useState<Cliente | null>(
    orden.cliente_id ? clientes.find(c => c.id === Number(orden.cliente_id)) ?? null : null
  )
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)

  const monto = parseFloat(montoStr.replace(',', '.'))
  const cambio = metodo === 'efectivo' && !isNaN(monto) ? monto - total : null

  const filteredClientes = useMemo(() => {
    if (!clienteSearch.trim()) return []
    const q = clienteSearch.toLowerCase()
    return clientes.filter(c =>
      c.apellido.toLowerCase().includes(q) ||
      (c.nombre?.toLowerCase().includes(q) ?? false) ||
      (c.telefono?.includes(clienteSearch) ?? false)
    ).slice(0, 5)
  }, [clientes, clienteSearch])

  const handleSelectCliente = (c: Cliente) => {
    setClienteSelected(c)
    setClienteSearch('')
    setShowClienteDropdown(false)
  }

  const handleConfirm = () => {
    if (esCredito && !clienteSelected) {
      notify.error('Para venta a crédito es obligatorio seleccionar un cliente.')
      return
    }
    const m = parseFloat(montoStr.replace(',', '.'))
    if (!esCredito && pagoMixto) {
      if (monto2 <= 0 || monto2 >= total) { return }
      if (metodo === metodo2) { return }
    }
    const pagos: PagoOrden[] = esCredito
      ? []
      : pagoMixto
        ? [{ tipoPago: metodo, monto: monto1Mixto }, { tipoPago: metodo2, monto: monto2 }]
        : [{ tipoPago: metodo, monto: total }]
    onConfirm({
      pagos,
      monto_recibido: isNaN(m) ? total : m,
      billing: { cliente_id: clienteSelected?.id },
      descuento: descuentoSel
        ? {
            id: descuentoSel.id,
            monto: montoDescuento,
            porcentaje: descuentoSel.porcentaje,
            nombre: descuentoSel.nombre,
          }
        : { id: undefined, monto: 0 },
      esCredito,
    })
  }

  const totalFaltantes = itemsFaltantes.length

  return (
    <Modal open={open} onClose={onClose} title={`Cobrar ${orden.numero}`} size="lg">
      <div className="space-y-4 pt-1">
        {/* ── Modo de pago: Contado / Crédito ─────────────────────────── */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F5F0EB] p-1">
          <button
            type="button"
            onClick={() => setModoPago('contado')}
            className={clsx(
              'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all',
              !esCredito
                ? 'bg-white text-[#1E5C38] shadow-sm'
                : 'text-[#7A7571] hover:text-[#4A4744]',
            )}
          >
            <i className="ti ti-cash text-[15px]" />
            Contado
          </button>
          <button
            type="button"
            onClick={() => setModoPago('credito')}
            className={clsx(
              'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all',
              esCredito
                ? 'bg-white text-[#780e18] shadow-sm'
                : 'text-[#7A7571] hover:text-[#4A4744]',
            )}
          >
            <i className="ti ti-hand-coins text-[15px]" />
            Crédito
          </button>
        </div>
        {/* ── Resumen de la orden ───────────────────────────────────────── */}
        <div className="rounded-xl bg-[#FBFBFA] border border-[#E8E5E2] px-3 py-2.5 space-y-1.5">
          <p className="text-[10px] font-black text-[#7A7571] uppercase tracking-widest flex items-center gap-1.5">
            <i className="ti ti-receipt text-[12px]" />
            Resumen de la orden
          </p>
          {itemsDespachados.map(i => {
            if (i.es_parcial && i.piezas_orden?.length) {
              return i.piezas_orden.filter(p => p.confirmado).map(p => (
                <div key={`${i.id}-${p.id}`} className="flex justify-between text-sm gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-mono font-bold text-[#780e18]">{i.producto_codigo}</p>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] tracking-wider shrink-0">KIT</span>
                    </div>
                    <p className="text-[11px] font-semibold text-[#2D2B2A] flex items-center gap-1.5">
                      <span className="truncate">{p.nombre} · ×{p.cantidad}</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200] tracking-wider shrink-0">PIEZA</span>
                    </p>
                  </div>
                  <span className="font-semibold text-[#2D2B2A] shrink-0">{fmtBs((p.precio_unitario ?? 0) * p.cantidad)}</span>
                </div>
              ))
            }
            return (
              <div key={i.id} className="flex justify-between text-sm gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-mono font-bold text-[#780e18]">{i.producto_codigo} · ×{i.cantidad_recogida ?? i.cantidad_pedida}</p>
                    {i.es_kit && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] tracking-wider shrink-0">KIT</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#7A7571] truncate">{i.producto_nombre}</p>
                </div>
                <span className="font-semibold text-[#2D2B2A] shrink-0">{fmtBs(i.precio_unitario * (i.cantidad_recogida ?? i.cantidad_pedida))}</span>
              </div>
            )
          })}
          {totalFaltantes > 0 && itemsFaltantes.map(i => (
            <div key={i.id} className="flex justify-between text-sm gap-2 opacity-50">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono font-bold text-[#7A7571] line-through">{i.producto_codigo} · ×{i.cantidad_pedida - (i.cantidad_recogida ?? 0)}</p>
                <p className="text-[11px] text-[#7A7571] truncate">{i.producto_nombre}</p>
              </div>
              <span className="text-[#7A7571] shrink-0">N/A</span>
            </div>
          ))}

          {/* Subtotal */}
          <div className="flex justify-between pt-2 border-t border-[#E8E5E2] mt-2">
            <span className="text-sm font-bold text-[#4A4744]">Subtotal</span>
            <span className="text-sm font-bold text-[#2D2B2A]">{fmtBs(subtotal)}</span>
          </div>

          {/* Descuento aplicado en vivo */}
          {descuentoSel && (
            <div className="flex justify-between items-center text-sm">
              <span className={clsx('inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border', getDescuentoColor(descuentoSel.color, 'badge'))}>
                <i className="ti ti-discount-2 text-[12px]" />
                {descuentoSel.nombre} · {descuentoSel.porcentaje}%
              </span>
              <span className="font-semibold text-[#1E5C38]">−{fmtBs(montoDescuento)}</span>
            </div>
          )}

          <div className="flex items-center justify-between mt-2 pt-3 border-t-2 border-[#780e18]/15">
            <span className="text-xs font-black text-[#780e18] uppercase tracking-widest">Total a cobrar</span>
            <span className="text-2xl font-black text-[#780e18] tabular-nums">{fmtBs(total)}</span>
          </div>
        </div>

        {/* ── Descuento (cards grid) ──────────────────────────────────────── */}
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
            {descuentosActivos.map(d => (
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

        {/* ── Cliente (opcional / obligatorio en crédito) ───────────── */}
        <div>
          <p className="text-xs font-bold text-[#7A7571] uppercase tracking-widest mb-2 flex items-center gap-1">
            Cliente
            {esCredito ? (
              <span className="text-[#B23A2A]">*</span>
            ) : (
              <span className="text-[10px] font-normal text-[#7A7571] normal-case tracking-normal">(opcional)</span>
            )}
          </p>
          {clienteSelected ? (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#B8DCCA]/30 border border-[#B8DCCA]">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1E5C38] truncate">
                  {clienteSelected.nombre ? `${clienteSelected.nombre} ${clienteSelected.apellido}` : clienteSelected.apellido}
                </p>
                {clienteSelected.telefono && (
                  <p className="text-xs text-[#3F7A52]">{clienteSelected.telefono}</p>
                )}
              </div>
              <button onClick={() => setClienteSelected(null)} className="p-1.5 text-[#3F7A52] hover:text-[#1E5C38] hover:bg-[#B8DCCA]/50 rounded-lg transition-colors shrink-0">
                <i className="ti ti-x text-[14px]" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={clienteSearch}
                onChange={e => { setClienteSearch(e.target.value); setShowClienteDropdown(true) }}
                onFocus={() => setShowClienteDropdown(true)}
                onBlur={() => setTimeout(() => setShowClienteDropdown(false), 150)}
                placeholder="Buscar cliente por nombre o teléfono…"
                className="w-full text-xs px-3 py-2.5 bg-white border border-[#E8E5E2] rounded-xl focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 placeholder:text-[#7A7571]"
              />
              {showClienteDropdown && clienteSearch.trim() && (
                <div className="absolute z-20 w-full mt-1 bg-white rounded-xl border border-[#E8E5E2] shadow-lg max-h-40 overflow-y-auto">
                  {filteredClientes.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-[#7A7571] text-center">Sin resultados</div>
                  ) : filteredClientes.map(c => (
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
                        {c.telefono && <p className="text-[10px] text-[#7A7571]">{c.telefono}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Método de pago (oculto en crédito) ──────────────────────── */}
        {!esCredito && (
        <>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#7A7571] uppercase tracking-widest">Método de pago</p>
            <button
              onClick={() => setPagoMixto(v => !v)}
              className={clsx('text-[11px] font-bold px-2 py-1 rounded-lg border transition-all', pagoMixto ? 'bg-[#F4ECDB] border-[#D4A333]/50 text-[#780e18]' : 'bg-[#F7F7F7] border-[#E8E5E2] text-[#7A7571] hover:border-[#D0CBC4]')}
            >
              {pagoMixto ? 'Pago mixto ✓' : 'Pago mixto'}
            </button>
          </div>
          {!pagoMixto ? (
            <div className="grid grid-cols-3 gap-2">
              {METODOS.map(m => (
                <button key={m.value} onClick={() => setMetodo(m.value)} className={clsx('py-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-1', metodo === m.value ? 'border-[#780e18] bg-[#F4ECDB] text-[#780e18]' : 'border-[#E8E5E2] text-[#7A7571] hover:border-[#D0CBC4]')}>
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {METODOS.map(m => (
                    <button key={m.value} onClick={() => setMetodo(m.value)} className={clsx('py-2 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-0.5', metodo === m.value ? 'border-[#780e18] bg-[#F4ECDB] text-[#780e18]' : 'border-[#E8E5E2] text-[#7A7571] hover:border-[#D0CBC4]')}>
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="w-28 shrink-0">
                  <p className="text-xs text-[#7A7571] mb-1">Bs {monto1Mixto > 0 ? monto1Mixto.toFixed(2) : '—'}</p>
                  <p className="text-[10px] text-[#7A7571]">Resto automático</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {METODOS.map(m => (
                    <button key={m.value} onClick={() => setMetodo2(m.value)} className={clsx('py-2 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-0.5', metodo2 === m.value ? 'border-[#780e18] bg-[#F4ECDB] text-[#780e18]' : 'border-[#E8E5E2] text-[#7A7571] hover:border-[#D0CBC4]')}>
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="w-28 shrink-0">
                  <Input type="number" step="0.50" min="0.01" max={total - 0.01} value={monto2Str} onChange={e => setMonto2Str(e.target.value)} placeholder="0.00" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Monto recibido / Cambio (solo efectivo, pago simple) ─────── */}
        {!pagoMixto && metodo === 'efectivo' && (
          <div>
            <label className="block text-xs font-bold text-[#7A7571] uppercase tracking-widest mb-1.5">Monto recibido (Bs)</label>
            <Input type="number" min={total} step="0.50" value={montoStr} onChange={e => setMontoStr(e.target.value)} />
            {cambio !== null && cambio >= 0 && <p className="text-sm font-bold text-[#3F7A52] mt-2">Cambio: {fmtBs(cambio)}</p>}
          </div>
        )}
        </>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={handleConfirm}>
            {esCredito ? 'Confirmar crédito' : 'Confirmar pago'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
