import React, { useState, useEffect } from 'react'
import { Modal, Button, Input, PasswordInput, Select } from '@/components/ui'
import type { Usuario, RolUsuario } from '@/types'

const ROLES: { value: RolUsuario; label: string }[] = [
  { value: 'admin',       label: 'Administrador' },
  { value: 'cajero',     label: 'Cajero' },
  { value: 'almacenero', label: 'Almacenero' },
  { value: 'operador',   label: 'Operador' },
]

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<Usuario, 'id' | 'creado_en' | 'actualizado_en'>) => void
  initial?: Usuario | null
}

type Form = {
  nombre: string
  apellido: string
  email: string
  password: string
  rol: RolUsuario
  activo: boolean
}

const EMPTY: Form = {
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  rol: 'cajero',
  activo: true,
}

export function UsuarioFormModal({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        nombre: initial.nombre,
        apellido: initial.apellido,
        email: initial.email,
        password: '',
        rol: initial.rol,
        activo: initial.activo,
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [open, initial])

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const setActivo = (value: boolean) => setForm((f) => ({ ...f, activo: value }))

  const validate = (): boolean => {
    const e: Partial<Record<keyof Form, string>> = {}
    if (!form.nombre.trim())   e.nombre   = 'Requerido'
    if (!form.apellido.trim()) e.apellido = 'Requerido'
    if (!form.email.trim())    e.email    = 'Requerido'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido'
    if (!initial && !form.password.trim()) e.password = 'Requerido'
    else if (!initial && form.password.length < 6) e.password = 'Mínimo 6 caracteres'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    onSave({
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      email: form.email.trim(),
      rol: form.rol,
      activo: form.activo,
    })
  }

  const title = initial ? 'Editar usuario' : 'Nuevo usuario'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-steel-500 uppercase tracking-wide mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <Input value={form.nombre} onChange={set('nombre')} placeholder="Ej. Jaime" />
            {errors.nombre && <p className="text-[11px] text-red-500 mt-1">{errors.nombre}</p>}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-steel-500 uppercase tracking-wide mb-1">
              Apellido <span className="text-red-500">*</span>
            </label>
            <Input value={form.apellido} onChange={set('apellido')} placeholder="Ej. Pérez" />
            {errors.apellido && <p className="text-[11px] text-red-500 mt-1">{errors.apellido}</p>}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-steel-500 uppercase tracking-wide mb-1">
            Correo electrónico <span className="text-red-500">*</span>
          </label>
          <Input value={form.email} onChange={set('email')} placeholder="correo@importadora.com" type="email" />
          {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-steel-500 uppercase tracking-wide mb-1">
            Contraseña <span className="text-red-500">*</span>
          </label>
          <PasswordInput
            value={form.password}
            onChange={set('password')}
            placeholder={initial ? 'Dejar en blanco para no cambiar' : 'Mínimo 6 caracteres'}
          />
          {errors.password && <p className="text-[11px] text-red-500 mt-1">{errors.password}</p>}
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-steel-500 uppercase tracking-wide mb-1">
            Rol <span className="text-red-500">*</span>
          </label>
          <Select
            value={form.rol}
            onChange={set('rol')}
            options={ROLES}
          />
        </div>

        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-steel-50 border border-steel-200">
          <div>
            <p className="text-sm font-medium text-steel-800">Activo</p>
            <p className="text-xs text-steel-400 mt-0.5">Si está desactivado, el usuario no podrá iniciar sesión</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.activo}
            onClick={() => setActivo(!form.activo)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
              form.activo ? 'bg-brand-600' : 'bg-steel-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                form.activo ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </Modal>
  )
}