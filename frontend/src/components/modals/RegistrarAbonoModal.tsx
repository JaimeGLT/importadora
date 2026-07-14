import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { Button, Modal } from '@/components/ui'
import { notify } from '@/lib/notify'
import type { Credito } from '@/types'

const fmtBs = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type MetodoPagoCaja = 'Efectivo' | 'QR' | 'Tarjeta'

export interface RegistrarAbonoModalProps {
  open: boolean
  credito: Credito | null
  onConfirm: (data: { monto: number; tipoPago: MetodoPagoCaja; nota: string | null }) => Promise<void> | void
  onClose: () => void
}

/**
 * Modal para registrar un abono (pago parcial o total) sobre un crédito.
 * El monto viene prellenado con el saldo pendiente. El usuario puede
 * reducirlo para pagos parciales, pero no puede superar el saldo.
 */
export function RegistrarAbonoModal({ open, credito, onConfirm, onClose }: RegistrarAbonoModalProps) {
  const [tipoPago, setTipoPago] = useState<MetodoPagoCaja>('Efectivo')
  const [montoStr, setMontoStr] = useState('0.00')
  const [nota, setNota] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && credito) {
      setTipoPago('Efectivo')
      setMontoStr(credito.saldoPendiente.toFixed(2))
      setNota('')
      setSubmitting(false)
    }
  }, [open, credito])

  if (!credito) return null

  const saldo = credito.saldoPendiente
  const monto = parseFloat(montoStr.replace(',', '.')) || 0
  const esPagoTotal = monto >= saldo - 0.001
  const esValido = monto > 0 && monto <= saldo + 0.001

  const handleConfirm = async () => {
    if (!esValido) {
      notify.error('El monto debe ser mayor a 0 y no superar el saldo pendiente.')
      return
    }
    setSubmitting(true)
    try {
      await onConfirm({
        monto: Math.round(monto * 100) / 100,
        tipoPago,
        nota: nota.trim() || null,
      })
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al registrar el pago')
    } finally {
      setSubmitting(false)
    }
  }

  const tipoOpciones: { value: MetodoPagoCaja; label: string; icon: React.ReactNode }[] = [
    {
      value: 'Efectivo',
      label: 'Efectivo',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.657 0-3-.895-3-2s1.343-2 3-2 3 .895 3 2-1.343 2-3 2m0-1v-1m0 1v1m0 1v1M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
        </svg>
      ),
    },
    {
      value: 'QR',
      label: 'QR',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h3v3h-3v-3zm4 0h3v7h-3v-7z" />
        </svg>
      ),
    },
    {
      value: 'Tarjeta',
      label: 'Tarjeta',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
  ]

  return (
    <Modal open={open} onClose={onClose} title={`Registrar abono — Crédito #${credito.id}`} size="md">
      <div className="space-y-4 pt-1">
        {/* Resumen del crédito */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#F5F0EB] border border-[#E8E5E2] p-3 text-center">
            <p className="text-[10px] font-bold text-[#7A7571] uppercase tracking-widest">Total</p>
            <p className="text-sm font-black text-[#2D2B2A] mt-1">{fmtBs(credito.total)}</p>
          </div>
          <div className="rounded-xl bg-[#F5E0A8]/40 border border-[#F5E0A8] p-3 text-center">
            <p className="text-[10px] font-bold text-[#7A5200] uppercase tracking-widest">Saldo</p>
            <p className="text-sm font-black text-[#7A5200] mt-1">{fmtBs(saldo)}</p>
          </div>
          <div className="rounded-xl bg-[#B8DCCA]/40 border border-[#B8DCCA] p-3 text-center">
            <p className="text-[10px] font-bold text-[#1E5C38] uppercase tracking-widest">Pagado</p>
            <p className="text-sm font-black text-[#1E5C38] mt-1">{fmtBs(credito.total - saldo)}</p>
          </div>
        </div>

        {/* Tipo de pago */}
        <div>
          <p className="text-xs font-bold text-[#7A7571] uppercase tracking-widest mb-2">Tipo de pago</p>
          <div className="grid grid-cols-3 gap-2">
            {tipoOpciones.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setTipoPago(m.value)}
                className={clsx(
                  'py-2.5 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                  tipoPago === m.value
                    ? 'border-[#780e18] bg-[#F4ECDB] text-[#780e18]'
                    : 'border-[#E8E5E2] text-[#7A7571] hover:border-[#D0CBC4]',
                )}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Monto */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-[#7A7571] uppercase tracking-widest">Monto del abono (Bs)</label>
            <button
              type="button"
              onClick={() => setMontoStr(saldo.toFixed(2))}
              className="text-[10px] font-bold text-[#780e18] hover:underline"
            >
              Pagar todo
            </button>
          </div>
          <input
            type="number"
            min={0.01}
            max={saldo}
            step="0.50"
            value={montoStr}
            onChange={(e) => setMontoStr(e.target.value)}
            autoFocus
            className="w-full text-base font-bold px-3 py-2.5 bg-white border border-[#E8E5E2] rounded-xl focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10"
          />
          {monto > 0 && !esValido && (
            <p className="text-[11px] text-[#B23A2A] mt-1">El monto no puede superar el saldo pendiente.</p>
          )}
          {esPagoTotal && monto > 0 && (
            <p className="text-[11px] text-[#1E5C38] mt-1 font-semibold">✓ Pago total — el crédito quedará marcado como pagado.</p>
          )}
        </div>

        {/* Nota opcional */}
        <div>
          <label className="text-xs font-bold text-[#7A7571] uppercase tracking-widest mb-1.5 block">Nota (opcional)</label>
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={120}
            placeholder="Recibo, referencia, etc."
            className="w-full text-xs px-3 py-2 bg-white border border-[#E8E5E2] rounded-xl focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 placeholder:text-[#7A7571]"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={!esValido} loading={submitting}>
            <i className="ti ti-cash text-[14px] mr-1" />
            Registrar pago
          </Button>
        </div>
      </div>
    </Modal>
  )
}
