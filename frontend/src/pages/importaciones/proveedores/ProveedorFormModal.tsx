import React, { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import type { Proveedor, MonedaProveedor, TerminosPago } from '@/types'

const MONEDAS: MonedaProveedor[] = ['USD', 'EUR', 'CNY', 'GBP', 'JPY', 'KRW', 'BRL', 'ARS', 'CLP', 'PEN']

const TERMINOS: TerminosPago[] = [
  'T/T anticipado',
  'T/T 30 días',
  'T/T 60 días',
  'L/C a la vista',
  'L/C 30 días',
  'NET 30',
  'NET 60',
  'Contra entrega',
]

const INPUT = 'w-full bg-white border border-[#D0CBC4] rounded-lg px-3 py-2 text-[13px] text-[#2D2B2A] placeholder:text-[#7A7571] focus:outline-none focus:ring-2 focus:ring-[#780e18]/20 focus:border-[#780e18] transition-colors'
const LABEL = 'text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.1em] block mb-1.5'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<Proveedor, 'id' | 'creado_en' | 'actualizado_en'>) => void
  initial?: Proveedor | null
  saving?: boolean
}

type Form = {
  nombre: string
  pais: string
  moneda: MonedaProveedor
  terminos_pago: TerminosPago
  contacto: string
  email: string
  telefono: string
  sitio_web: string
  notas: string
  tiempo_reposicion_dias: string
  estado: 'activo' | 'inactivo'
}

const EMPTY: Form = {
  nombre: '',
  pais: '',
  moneda: 'USD',
  terminos_pago: 'T/T 30 días',
  contacto: '',
  email: '',
  telefono: '',
  sitio_web: '',
  notas: '',
  tiempo_reposicion_dias: '',
  estado: 'activo',
}

export function ProveedorFormModal({ open, onClose, onSave, initial, saving = false }: Props) {
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        nombre: initial.nombre,
        pais: initial.pais ?? '',
        moneda: initial.moneda ?? 'USD',
        terminos_pago: initial.terminos_pago ?? 'T/T 30 días',
        contacto: initial.contacto ?? '',
        email: initial.email ?? '',
        telefono: initial.telefono ?? '',
        sitio_web: initial.sitio_web ?? '',
        notas: initial.notas ?? '',
        tiempo_reposicion_dias: initial.tiempo_reposicion_dias?.toString() ?? '',
        estado: initial.estado,
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const validate = (): boolean => {
    const e: Partial<Record<keyof Form, string>> = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido'
    if (form.tiempo_reposicion_dias && isNaN(Number(form.tiempo_reposicion_dias))) {
      e.tiempo_reposicion_dias = 'Debe ser número'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    onSave({
      nombre: form.nombre.trim(),
      pais: form.pais.trim() || undefined,
      moneda: form.moneda || undefined,
      terminos_pago: form.terminos_pago || undefined,
      contacto: form.contacto.trim() || undefined,
      email: form.email.trim() || undefined,
      telefono: form.telefono.trim() || undefined,
      sitio_web: form.sitio_web.trim() || undefined,
      notas: form.notas.trim() || undefined,
      tiempo_reposicion_dias: form.tiempo_reposicion_dias ? Number(form.tiempo_reposicion_dias) : undefined,
      estado: form.estado,
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 transition-opacity duration-200"
        style={{
          background: 'rgba(45,43,42,0.45)',
          backdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={clsx(
          'fixed z-[60] bg-white flex flex-col',
          // Posición mobile: bottom sheet
          'bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl',
          // Posición desktop: panel derecho
          'sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto sm:max-h-none sm:w-[520px] sm:rounded-none',
          // Bordes
          'border-t border-[#E8E5E2] sm:border-t-0 sm:border-l',
          // Animación: mobile = translateY, desktop = translateX
          open
            ? 'translate-y-0 sm:translate-x-0'
            : 'translate-y-full sm:translate-y-0 sm:translate-x-full',
          'transition-transform duration-[280ms]',
        )}
        style={{ boxShadow: '-24px 0 40px -20px rgba(30,27,46,0.18)' }}
      >
        {/* Accent stripe */}
        <div className="h-[3px] bg-gradient-to-r from-[#780e18] to-[#D4A333] shrink-0" />

        {/* Header */}
        <div className="px-6 pt-5 pb-[18px] border-b border-[#E8E5E2] flex items-center justify-between gap-3 shrink-0 bg-[#FBFAF7]">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-[#7A7571] font-semibold mb-1">
              {initial ? 'Editar proveedor' : 'Nuevo proveedor'}
            </div>
            <h2
              className="text-[20px] font-semibold text-[#2D2B2A] leading-tight"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {initial ? initial.nombre : 'Registrar proveedor'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#F0EFEC] transition-colors shrink-0"
          >
            <i className="ti ti-x text-[20px]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#F7F7F7]">
          <div className="space-y-4">

            {/* Nombre + País */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Nombre <span className="text-[#B23A2A]">*</span></label>
                <input className={clsx(INPUT, errors.nombre && 'border-[#D45040]')} value={form.nombre} onChange={set('nombre')} placeholder="Ej. Auto Parts Global Co." />
                {errors.nombre && <p className="text-[11px] text-[#B23A2A] mt-1">{errors.nombre}</p>}
              </div>
              <div>
                <label className={LABEL}>País</label>
                <input className={clsx(INPUT, errors.pais && 'border-[#D45040]')} value={form.pais} onChange={set('pais')} placeholder="Ej. China" />
                {errors.pais && <p className="text-[11px] text-[#B23A2A] mt-1">{errors.pais}</p>}
              </div>
            </div>

            {/* Moneda + Términos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Moneda</label>
                <select className={INPUT} value={form.moneda} onChange={set('moneda')}>
                  {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Términos de pago</label>
                <select className={INPUT} value={form.terminos_pago} onChange={set('terminos_pago')}>
                  {TERMINOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Contacto + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Contacto</label>
                <input className={INPUT} value={form.contacto} onChange={set('contacto')} placeholder="Nombre del contacto" />
              </div>
              <div>
                <label className={LABEL}>Email</label>
                <input className={clsx(INPUT, errors.email && 'border-[#D45040]')} value={form.email} onChange={set('email')} placeholder="correo@proveedor.com" type="email" />
                {errors.email && <p className="text-[11px] text-[#B23A2A] mt-1">{errors.email}</p>}
              </div>
            </div>

            {/* Teléfono + Tiempo reposición */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Teléfono</label>
                <input className={INPUT} value={form.telefono} onChange={set('telefono')} placeholder="+86 21 5555 0101" />
              </div>
              <div>
                <label className={LABEL}>Tiempo reposición (días)</label>
                <input
                  className={clsx(INPUT, errors.tiempo_reposicion_dias && 'border-[#D45040]')}
                  value={form.tiempo_reposicion_dias}
                  onChange={set('tiempo_reposicion_dias')}
                  placeholder="45"
                  type="number"
                />
                {errors.tiempo_reposicion_dias && <p className="text-[11px] text-[#B23A2A] mt-1">{errors.tiempo_reposicion_dias}</p>}
              </div>
            </div>

            {/* Sitio web + Estado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Sitio web</label>
                <input className={INPUT} value={form.sitio_web} onChange={set('sitio_web')} placeholder="www.proveedor.com" />
              </div>
              <div>
                <label className={LABEL}>Estado</label>
                <select className={INPUT} value={form.estado} onChange={set('estado')}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className={LABEL}>Notas</label>
              <textarea
                className={clsx(INPUT, 'resize-none')}
                rows={3}
                placeholder="Condiciones especiales, mínimos de compra, observaciones…"
                value={form.notas}
                onChange={set('notas')}
              />
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E8E5E2] flex justify-end gap-2.5 shrink-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#D0CBC4] text-[13px] text-[#4A4744] font-semibold hover:bg-[#F5F0EB] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-[13px] font-semibold transition-colors disabled:opacity-50 active:scale-95"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </>
  )
}
