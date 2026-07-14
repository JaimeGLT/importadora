import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Modal, Button, Input, Select } from '@/components/ui'
import { useProveedoresStore } from '@/stores/proveedoresStore'
import { notify } from '@/lib/notify'
import { api } from '@/lib/api'
import type { Proveedor, MonedaProveedor, TerminosPago } from '@/types'
import { clsx } from 'clsx'

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

type Form = {
  nombre: string
  pais: string
  moneda: MonedaProveedor
  terminos_pago: TerminosPago
  contacto: string
  email: string
}

const EMPTY: Form = {
  nombre: '',
  pais: '',
  moneda: 'USD',
  terminos_pago: 'T/T 30 días',
  contacto: '',
  email: '',
}

interface ProveedorSelectProps {
  value: string | null
  onChange: (id: string) => void
  onCreated?: (p: Proveedor) => void
  proveedores: Proveedor[]
  label?: string
  placeholder?: string
}

export function ProveedorSelect({
  value,
  onChange,
  onCreated,
  proveedores,
  label,
  placeholder = 'Seleccionar proveedor…',
}: ProveedorSelectProps) {
  const { addProveedor } = useProveedoresStore()
  const [search, setSearch]           = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [createOpen, setCreateOpen]   = useState(false)
  const [form, setForm]               = useState<Form>(EMPTY)
  const [errors, setErrors]           = useState<Partial<Record<keyof Form, string>>>({})
  const [saving, setSaving]           = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })

  const selected = proveedores.find((p) => p.id === value)

  const filtered = search.trim()
    ? proveedores.filter((p) =>
        `${p.nombre} ${p.pais}`.toLowerCase().includes(search.toLowerCase()),
      )
    : proveedores

  const updatePos = () => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  const handleFocus = () => {
    updatePos()
    setShowDropdown(true)
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    onChange('')
    setShowDropdown(true)
    updatePos()
  }

  const handleSelect = (p: Proveedor) => {
    onChange(p.id)
    setSearch('')
    setShowDropdown(false)
  }

  const setField = (key: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const validate = (): boolean => {
    const e: Partial<Record<keyof Form, string>> = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleCreate = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const body = {
        nombre: form.nombre.trim(),
        pais: form.pais.trim(),
        moneda: form.moneda,
        terminos: form.terminos_pago,
        nombre_Contacto: form.contacto.trim() || null,
        email: form.email.trim() || null,
        telefono: '',
        tiempoReposicion: 0,
        sitioWeb: '',
        estado: true,
        nota: '',
      }
      const res = await api.post<{ id: number }>('/Proveedor', body)
      const ahora = new Date().toISOString()
      const nuevo: Proveedor = {
        id: String(res?.id ?? Date.now()),
        nombre: form.nombre.trim(),
        pais: form.pais.trim(),
        moneda: form.moneda,
        terminos_pago: form.terminos_pago,
        contacto: form.contacto.trim(),
        email: form.email.trim(),
        estado: 'activo',
        creado_en: ahora,
        actualizado_en: ahora,
      }
      addProveedor(nuevo)
      onCreated?.(nuevo)
      onChange(nuevo.id)
      setForm(EMPTY)
      setErrors({})
      setCreateOpen(false)
      notify.success('Proveedor creado')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al crear el proveedor')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setCreateOpen(false)
    setForm(EMPTY)
    setErrors({})
  }

  const dropdown = showDropdown && (
    <div
      style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
      className="bg-white rounded-lg border border-steel-200 shadow-xl max-h-52 overflow-y-auto"
    >
      {filtered.length === 0 ? (
        <p className="px-3 py-2.5 text-xs text-steel-400">
          {search.trim() ? 'Sin resultados' : 'Sin proveedores — crea uno nuevo'}
        </p>
      ) : (
        filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onMouseDown={() => handleSelect(p)}
            className={clsx(
              'w-full text-left px-3 py-2 text-sm transition-colors',
              p.id === value
                ? 'bg-brand-50 text-brand-700 font-medium'
                : 'text-steel-700 hover:bg-brand-50',
            )}
          >
            <span className="font-medium">{p.nombre}</span>
            <span className="text-steel-400 text-xs ml-2">— {p.pais}</span>
          </button>
        ))
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-steel-700">{label}</label>
      )}
      <div className="relative flex gap-1">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={selected ? `${selected.nombre} — ${selected.pais}` : search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder={placeholder}
            className={clsx(
              'h-9 w-full rounded-lg border border-steel-200 bg-white px-3 text-sm text-steel-900',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            )}
          />
          {createPortal(dropdown, document.body)}
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="h-9 px-3 rounded-lg border border-steel-200 bg-white text-steel-500 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-300 transition-colors shrink-0"
          title="Crear nuevo proveedor"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <Modal
        open={createOpen}
        onClose={handleClose}
        title="Nuevo proveedor"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Crear proveedor</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-steel-500 uppercase tracking-wide mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <Input value={form.nombre} onChange={setField('nombre')} placeholder="Ej. Auto Parts Global Co." autoFocus />
              {errors.nombre && <p className="text-[11px] text-red-500 mt-1">{errors.nombre}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-steel-500 uppercase tracking-wide mb-1">
                País
              </label>
              <Input value={form.pais} onChange={setField('pais')} placeholder="Ej. China" />
              {errors.pais && <p className="text-[11px] text-red-500 mt-1">{errors.pais}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-steel-500 uppercase tracking-wide mb-1">
                Moneda
              </label>
              <Select
                value={form.moneda}
                onChange={setField('moneda')}
                options={MONEDAS.map((m) => ({ value: m, label: m }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-steel-500 uppercase tracking-wide mb-1">
                Términos de pago
              </label>
              <Select
                value={form.terminos_pago}
                onChange={setField('terminos_pago')}
                options={TERMINOS.map((t) => ({ value: t, label: t }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-steel-500 uppercase tracking-wide mb-1">
                Contacto
              </label>
              <Input value={form.contacto} onChange={setField('contacto')} placeholder="Nombre del contacto" />
              {errors.contacto && <p className="text-[11px] text-red-500 mt-1">{errors.contacto}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-steel-500 uppercase tracking-wide mb-1">
                Email
              </label>
              <Input value={form.email} onChange={setField('email')} placeholder="correo@proveedor.com" type="email" />
              {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
