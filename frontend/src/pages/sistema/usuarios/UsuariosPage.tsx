import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { MainLayout } from '@/components/layout/MainLayout'
import { PageTopBar } from '@/components/layout/PageTopBar'
import { ConfirmModal } from '@/components/ui'
import { notify } from '@/lib/notify'
import { api } from '@/lib/api'
import { USUARIOS_ENDPOINTS } from '@/lib/queries/usuarios.queries'
import { clsx } from 'clsx'
import { UsuarioDetalleDrawer } from './UsuarioDetalleDrawer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HorarioAPI {
  horaInicio: string
  horaFin: string
  activo: boolean
}

interface UsuarioAPI {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: string
  activo: boolean
  bloqueadoHasta: string | null
  horario: HorarioAPI | null
  porcentajeComision: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROL_LABELS: Record<string, string> = {
  Admin: 'Administrador',
  Cajero: 'Cajero',
  Almacenero: 'Almacenero',
  Operador: 'Operador',
}

function fmtBloqueo(bloqueadoHasta: string | null): string | null {
  if (!bloqueadoHasta) return null
  const d = new Date(bloqueadoHasta)
  if (d.getFullYear() > 9000) return null
  return d.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
}

function localISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── Drawer wrapper ───────────────────────────────────────────────────────────
// Mobile: bottom sheet. Desktop: right panel full height.

function Drawer({
  onClose,
  children,
  width = 'sm:w-[420px]',
}: {
  onClose: () => void
  children: React.ReactNode
  width?: string
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end"
      style={{ background: 'rgba(45,43,42,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={clsx(
          'bg-white flex flex-col w-full rounded-t-2xl sm:rounded-none sm:rounded-l-2xl overflow-hidden shadow-2xl',
          'border-t border-[#E8E5E2] sm:border-t-0 sm:border-l sm:border-[#D0CBC4]',
          'sm:h-full',
          width,
        )}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#D0CBC4]" />
        </div>
        {children}
      </div>
    </div>
  )
}

function DrawerHeader({ icon, title, subtitle, onClose, iconBg = '#F4ECDB', iconColor = '#780e18' }: {
  icon: string; title: string; subtitle?: string
  onClose: () => void; iconBg?: string; iconColor?: string
}) {
  return (
    <div className="px-6 pt-4 pb-4 border-b border-[#E8E5E2] shrink-0">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg, color: iconColor }}>
          <i className={clsx(icon, 'text-[18px]')} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#2D2B2A] text-sm">{title}</p>
          {subtitle && <p className="text-[11px] text-[#7A7571] truncate">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="text-[#7A7571] hover:text-[#2D2B2A] p-1.5 rounded-lg hover:bg-[#F0EFEC] transition-colors shrink-0">
          <i className="ti ti-x text-[16px]" />
        </button>
      </div>
    </div>
  )
}

// ─── HorarioModal ─────────────────────────────────────────────────────────────

function HorarioModal({ usuario, onClose, onSuccess }: {
  usuario: UsuarioAPI; onClose: () => void; onSuccess: (u: UsuarioAPI) => void
}) {
  const [horaInicio, setHoraInicio] = useState(usuario.horario?.horaInicio ?? '20:00')
  const [horaFin,    setHoraFin]    = useState(usuario.horario?.horaFin    ?? '08:00')
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  const cruzaMedianoche = horaInicio > horaFin

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/Usuario/${usuario.id}/horario`, { horaInicio, horaFin })
      notify.success('Horario guardado', {
        description: `${usuario.nombre} bloqueado de ${horaInicio} a ${horaFin}${cruzaMedianoche ? ' (cruza medianoche)' : ''}`,
      })
      onSuccess({ ...usuario, horario: { horaInicio, horaFin, activo: true } })
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al guardar horario')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar el horario recurrente de este usuario?')) return
    setDeleting(true)
    try {
      await api.delete(`/Usuario/${usuario.id}/horario`)
      notify.success('Horario eliminado')
      onSuccess({ ...usuario, horario: null })
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al eliminar horario')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Drawer onClose={onClose}>
      <DrawerHeader icon="ti ti-clock" title="Horario de bloqueo recurrente" subtitle={`${usuario.nombre} ${usuario.apellido}`} onClose={onClose} />
      <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <p className="text-[12px] text-[#7A7571]">
            El usuario quedará bloqueado automáticamente cada día en este rango.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">Desde</label>
              <input
                type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} required
                className="w-full h-11 px-3 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">Hasta</label>
              <input
                type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} required
                className="w-full h-11 px-3 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
              />
            </div>
          </div>

          {cruzaMedianoche && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F5E0A8]/50 border border-[#D4A333]/30">
              <i className="ti ti-alert-triangle text-[#B4881C] text-[14px] shrink-0" />
              <p className="text-[11px] text-[#7A5200]">Cruza medianoche: de {horaInicio} a las {horaFin} del día siguiente.</p>
            </div>
          )}

          {usuario.horario && (
            <div className="pt-2 border-t border-[#E8E5E2]">
              <p className="text-[11px] text-[#7A7571] mb-2">Horario actual configurado</p>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F4ECDB]/60 border border-[#E8D4B8]">
                <i className="ti ti-clock text-[#780e18] text-[14px]" />
                <span className="text-sm font-semibold text-[#2D2B2A]">{usuario.horario.horaInicio} — {usuario.horario.horaFin}</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-[#E8E5E2] shrink-0 space-y-2">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving || deleting}
              className="flex-1 h-11 rounded-xl border border-[#E8E5E2] text-sm font-medium text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || deleting}
              className="flex-1 h-11 rounded-xl bg-[#780e18] hover:bg-[#5a0b12] text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
          {usuario.horario && (
            <button type="button" onClick={handleDelete} disabled={deleting || saving}
              className="w-full h-10 rounded-xl border border-[#F5C9C0] text-sm font-medium text-[#B23A2A] hover:bg-[#F5C9C0]/30 transition-colors disabled:opacity-50">
              {deleting ? 'Eliminando…' : 'Eliminar horario recurrente'}
            </button>
          )}
        </div>
      </form>
    </Drawer>
  )
}

// ─── ComisionModal ────────────────────────────────────────────────────────────

function ComisionModal({ usuario, onClose, onSuccess }: {
  usuario: UsuarioAPI; onClose: () => void; onSuccess: (u: UsuarioAPI) => void
}) {
  const [porcentaje, setPorcentaje] = useState(String(usuario.porcentajeComision))
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const pct = parseFloat(porcentaje)
    if (isNaN(pct) || pct < 0 || pct > 100) return
    setSaving(true)
    try {
      await api.patch(`/Usuario/${usuario.id}/comision`, { porcentaje: pct })
      notify.success('Comisión actualizada', {
        description: `${usuario.nombre} ${usuario.apellido}: ${pct}% de comisión`,
      })
      onSuccess({ ...usuario, porcentajeComision: pct })
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al guardar comisión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer onClose={onClose} width="sm:w-[380px]">
      <DrawerHeader icon="ti ti-percentage" title="Comisión por ventas" subtitle={`${usuario.nombre} ${usuario.apellido}`} onClose={onClose} iconBg="#F0F9F4" iconColor="#3F7A52" />
      <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <p className="text-[12px] text-[#7A7571]">
            Porcentaje del total de ventas que corresponde a este cajero como comisión.
          </p>
          <div>
            <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">Porcentaje de comisión</label>
            <div className="relative">
              <input
                type="number" min="0" max="100" step="0.01"
                value={porcentaje}
                onChange={e => setPorcentaje(e.target.value)}
                required
                className="w-full h-11 pl-3 pr-10 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#3F7A52] focus:ring-2 focus:ring-[#3F7A52]/10 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7571] text-sm font-semibold">%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F0F9F4]/60 border border-[#C8E6D4]">
            <i className="ti ti-info-circle text-[#3F7A52] text-[14px] shrink-0" />
            <p className="text-[11px] text-[#2D5A3D]">El monto a pagar se calcula en el módulo Reportes → Comisiones.</p>
          </div>
        </div>
        <div className="px-6 pb-6 pt-4 border-t border-[#E8E5E2] shrink-0">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 h-11 rounded-xl border border-[#E8E5E2] text-sm font-medium text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 h-11 rounded-xl bg-[#3F7A52] hover:bg-[#2D5A3D] text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </Drawer>
  )
}

// ─── HorarioGlobalModal ───────────────────────────────────────────────────────

function HorarioGlobalModal({ horarioActual, onClose, onSuccess }: {
  horarioActual: HorarioAPI | null; onClose: () => void; onSuccess: (h: HorarioAPI | null) => void
}) {
  const [horaInicio, setHoraInicio] = useState(horarioActual?.horaInicio ?? '20:00')
  const [horaFin,    setHoraFin]    = useState(horarioActual?.horaFin    ?? '08:00')
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  const cruzaMedianoche = horaInicio > horaFin

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/Usuario/horario-global', { horaInicio, horaFin })
      notify.success('Horario global guardado', {
        description: `Todos los no-admins bloqueados de ${horaInicio} a ${horaFin} cada día`,
      })
      onSuccess({ horaInicio, horaFin, activo: true })
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar el horario de cierre global? Los usuarios bloqueados por este horario serán desbloqueados.')) return
    setDeleting(true)
    try {
      await api.delete('/Usuario/horario-global')
      notify.success('Horario global eliminado')
      onSuccess(null)
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Drawer onClose={onClose}>
      <DrawerHeader icon="ti ti-world" title="Horario de cierre global" subtitle="Se aplica a todos los usuarios excepto admins" onClose={onClose} iconBg="#F4ECDB" iconColor="#D4A333" />
      <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <p className="text-[12px] text-[#7A7571]">
            Todos los días, los no-admins quedarán bloqueados automáticamente en este rango horario.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">Desde</label>
              <input
                type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} required
                className="w-full h-11 px-3 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#D4A333] focus:ring-2 focus:ring-[#D4A333]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">Hasta</label>
              <input
                type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} required
                className="w-full h-11 px-3 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#D4A333] focus:ring-2 focus:ring-[#D4A333]/20 transition-all"
              />
            </div>
          </div>

          {cruzaMedianoche && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F5E0A8]/50 border border-[#D4A333]/30">
              <i className="ti ti-alert-triangle text-[#B4881C] text-[14px] shrink-0" />
              <p className="text-[11px] text-[#7A5200]">Cruza medianoche: de {horaInicio} a las {horaFin} del día siguiente.</p>
            </div>
          )}

          {horarioActual && (
            <div className="pt-2 border-t border-[#E8E5E2]">
              <p className="text-[11px] text-[#7A7571] mb-2">Horario global activo</p>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F4ECDB]/60 border border-[#E8D4B8]">
                <i className="ti ti-world text-[#D4A333] text-[14px]" />
                <span className="text-sm font-semibold text-[#2D2B2A]">{horarioActual.horaInicio} — {horarioActual.horaFin}</span>
                <span className="text-[11px] text-[#B4881C] ml-auto">todos los días</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-[#E8E5E2] shrink-0 space-y-2">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving || deleting}
              className="flex-1 h-11 rounded-xl border border-[#E8E5E2] text-sm font-medium text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || deleting}
              className="flex-1 h-11 rounded-xl bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
          {horarioActual && (
            <button type="button" onClick={handleDelete} disabled={deleting || saving}
              className="w-full h-10 rounded-xl border border-[#F5C9C0] text-sm font-medium text-[#B23A2A] hover:bg-[#F5C9C0]/30 transition-colors disabled:opacity-50">
              {deleting ? 'Eliminando…' : 'Eliminar horario global'}
            </button>
          )}
        </div>
      </form>
    </Drawer>
  )
}

// ─── BloquearHastaModal ───────────────────────────────────────────────────────

function BloquearHastaModal({ usuario, onClose, onSuccess }: {
  usuario: UsuarioAPI; onClose: () => void; onSuccess: (u: UsuarioAPI) => void
}) {
  const [hasta, setHasta] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() + 2, 0, 0, 0)
    return localISOString(d)
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const hastaDate = new Date(hasta)
    if (hastaDate <= new Date()) {
      notify.error('La fecha debe ser en el futuro')
      return
    }
    setSaving(true)
    try {
      await api.post(`/Usuario/${usuario.id}/bloquear-hasta`, { hasta: hastaDate.toISOString() })
      notify.success(`${usuario.nombre} bloqueado`, {
        description: `Hasta ${hastaDate.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}`,
      })
      onSuccess({ ...usuario, activo: false, bloqueadoHasta: hastaDate.toISOString() })
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al bloquear usuario')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer onClose={onClose}>
      <DrawerHeader icon="ti ti-calendar" title="Bloquear hasta fecha" subtitle={`${usuario.nombre} ${usuario.apellido}`} onClose={onClose} iconBg="#F5C9C0" iconColor="#B23A2A" />
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <p className="text-[12px] text-[#7A7571]">
            El usuario no podrá ingresar al sistema hasta la fecha y hora indicada.
          </p>
          <div>
            <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">Bloqueado hasta</label>
            <input
              type="datetime-local" value={hasta} onChange={e => setHasta(e.target.value)}
              min={localISOString(new Date())} required
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#B23A2A] focus:ring-2 focus:ring-[#B23A2A]/10 transition-all"
            />
          </div>

          {hasta && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F5C9C0]/30 border border-[#F5C9C0]">
              <i className="ti ti-lock text-[#B23A2A] text-[14px] shrink-0" />
              <p className="text-[11px] text-[#8A1E12]">
                Bloqueado hasta: <strong>{new Date(hasta).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}</strong>
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-[#E8E5E2] shrink-0">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 h-11 rounded-xl border border-[#E8E5E2] text-sm font-medium text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 h-11 rounded-xl bg-[#B23A2A] hover:bg-[#8A1E12] text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50">
              {saving ? 'Bloqueando…' : 'Bloquear'}
            </button>
          </div>
        </div>
      </form>
    </Drawer>
  )
}

// ─── CrearUsuarioModal ────────────────────────────────────────────────────────

const ROLES_DISPONIBLES: { value: string; label: string }[] = [
  { value: 'Admin',       label: 'Administrador' },
  { value: 'Cajero',      label: 'Cajero' },
  { value: 'Almacenero',  label: 'Almacenero' },
  { value: 'Operador',    label: 'Operador' },
]

function CrearUsuarioModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: '', rol: 'Cajero' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<typeof form>>({})
  const [showPwd, setShowPwd] = useState(false)

  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const validate = () => {
    const e: Partial<typeof form> = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    if (!form.apellido.trim()) e.apellido = 'Requerido'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Correo inválido'
    if (form.password.length < 6) e.password = 'Mínimo 6 caracteres'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/Usuario', form)
      notify.success('Usuario creado', { description: `${form.nombre} ${form.apellido} — ${ROL_LABELS[form.rol] ?? form.rol}` })
      onSuccess()
      onClose()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al crear usuario')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer onClose={onClose} width="sm:w-[460px]">
      <DrawerHeader icon="ti ti-user-plus" title="Nuevo usuario" subtitle="El usuario podrá iniciar sesión de inmediato" onClose={onClose} />
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">Nombre *</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                placeholder="Juan" autoFocus
                className="w-full h-10 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all" />
              {errors.nombre && <p className="text-[11px] text-[#B23A2A] mt-1">{errors.nombre}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">Apellido *</label>
              <input value={form.apellido} onChange={e => set('apellido', e.target.value)}
                placeholder="Pérez"
                className="w-full h-10 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all" />
              {errors.apellido && <p className="text-[11px] text-[#B23A2A] mt-1">{errors.apellido}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">Correo electrónico *</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="juan@empresa.com"
              className="w-full h-10 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all" />
            {errors.email && <p className="text-[11px] text-[#B23A2A] mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">Contraseña *</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full h-10 pl-3.5 pr-10 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                tabIndex={-1}
                aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A4744] hover:text-[#780e18] transition-colors"
              >
                <i className={showPwd ? 'ti ti-eye-off' : 'ti ti-eye'} />
              </button>
            </div>
            {errors.password && <p className="text-[11px] text-[#B23A2A] mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A4744] mb-2">Rol *</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES_DISPONIBLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set('rol', r.value)}
                  className={clsx(
                    'px-3.5 py-3 rounded-xl text-[12px] font-semibold border transition-all text-left',
                    form.rol === r.value
                      ? 'bg-[#780e18] text-white border-[#780e18]'
                      : 'bg-white text-[#4A4744] border-[#E8E5E2] hover:border-[#780e18] hover:text-[#780e18]'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="px-6 pb-6 pt-4 border-t border-[#E8E5E2] shrink-0">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 h-11 rounded-xl border border-[#E8E5E2] text-sm font-medium text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 h-11 rounded-xl bg-[#780e18] hover:bg-[#5a0b12] text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50">
              {saving ? 'Creando…' : 'Crear usuario'}
            </button>
          </div>
        </div>
      </form>
    </Drawer>
  )
}

// ─── ProgramarBloqueoModal ────────────────────────────────────────────────────

function ProgramarBloqueoModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() + 2, 0, 0, 0)
    return localISOString(d)
  })
  const [saving, setSaving] = useState(false)

  const desdeDate = desde ? new Date(desde) : null
  const esProgamado = desdeDate !== null && desdeDate > new Date()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const hastaDate = new Date(hasta)
    if (hastaDate <= new Date()) {
      notify.error('La hora de fin debe ser en el futuro')
      return
    }
    if (desdeDate && desdeDate >= hastaDate) {
      notify.error('"Desde" debe ser anterior a "Hasta"')
      return
    }
    setSaving(true)
    try {
      await api.post('/Usuario/programar-bloqueo', {
        desde: desdeDate ? desdeDate.toISOString() : undefined,
        hasta: hastaDate.toISOString(),
      })
      if (esProgamado) {
        notify.success('Bloqueo programado', {
          description: `Comenzará ${desdeDate!.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })} hasta ${hastaDate.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}`,
        })
      } else {
        notify.success('Bloqueo aplicado', {
          description: `Usuarios bloqueados hasta ${hastaDate.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}`,
        })
      }
      onSuccess()
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al programar bloqueo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer onClose={onClose}>
      <DrawerHeader icon="ti ti-clock" title="Programar bloqueo global" subtitle="Afecta a todos los no-admins" onClose={onClose} iconBg="#F4ECDB" iconColor="#D4A333" />
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <p className="text-[12px] text-[#7A7571]">
            Los administradores no serán afectados.
          </p>

          <div>
            <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">
              Desde <span className="font-normal text-[#7A7571]">(opcional — vacío = ahora mismo)</span>
            </label>
            <input
              type="datetime-local" value={desde} onChange={e => setDesde(e.target.value)}
              min={localISOString(new Date())}
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#D4A333] focus:ring-2 focus:ring-[#D4A333]/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A4744] mb-1.5">Hasta *</label>
            <input
              type="datetime-local" value={hasta} onChange={e => setHasta(e.target.value)}
              min={localISOString(new Date())} required
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#D4A333] focus:ring-2 focus:ring-[#D4A333]/20 transition-all"
            />
          </div>

          {esProgamado && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F4ECDB]/50 border border-[#D4A333]/30">
              <i className="ti ti-info-circle text-[#B4881C] text-[14px] shrink-0" />
              <p className="text-[11px] text-[#7A5200]">
                El bloqueo comenzará automáticamente a las {desdeDate!.toLocaleString('es-BO', { timeStyle: 'short' })}.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-[#E8E5E2] shrink-0">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 h-11 rounded-xl border border-[#E8E5E2] text-sm font-medium text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 h-11 rounded-xl bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50">
              {saving ? 'Guardando…' : esProgamado ? 'Programar' : 'Aplicar ahora'}
            </button>
          </div>
        </div>
      </form>
    </Drawer>
  )
}

// ─── UsuariosPage ─────────────────────────────────────────────────────────────

export function UsuariosPage() {
  const { user: me } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioAPI[]>([])
  const [horarioGlobal, setHorarioGlobal] = useState<HorarioAPI | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'activo' | 'inactivo'>('todos')
  const [showProgramar, setShowProgramar] = useState(false)
  const [showCrear, setShowCrear] = useState(false)
  const [showHorarioGlobal, setShowHorarioGlobal] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [desactivandoTodos, setDesactivandoTodos] = useState(false)
  const [horarioUsuario, setHorarioUsuario] = useState<UsuarioAPI | null>(null)
  const [bloquearHastaUsuario, setBloquearHastaUsuario] = useState<UsuarioAPI | null>(null)
  const [comisionUsuario, setComisionUsuario] = useState<UsuarioAPI | null>(null)
  const [detalleUsuario, setDetalleUsuario] = useState<UsuarioAPI | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<UsuarioAPI | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const [data, global] = await Promise.all([
        api.get<UsuarioAPI[]>('/Usuario'),
        api.get<HorarioAPI | null>('/Usuario/horario-global'),
      ])
      setUsuarios(data ?? [])
      setHorarioGlobal(global ?? null)
    } catch {
      notify.error('Error cargando usuarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return usuarios.filter(u => {
      if (filtro === 'activo' && !u.activo) return false
      if (filtro === 'inactivo' && u.activo) return false
      if (!q) return true
      return (
        u.nombre.toLowerCase().includes(q) ||
        u.apellido.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    })
  }, [usuarios, search, filtro])

  const stats = useMemo(() => ({
    total: usuarios.length,
    activos: usuarios.filter(u => u.activo).length,
    inactivos: usuarios.filter(u => !u.activo).length,
  }), [usuarios])

  const handleToggle = async (u: UsuarioAPI) => {
    if (toggling) return
    setToggling(u.id)
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, activo: !x.activo, bloqueadoHasta: null } : x))
    try {
      await api.patch(`/Usuario/${u.id}/toggle`)
      notify.success(u.activo ? `${u.nombre} desactivado` : `${u.nombre} activado`)
    } catch (e) {
      setUsuarios(prev => prev.map(x => x.id === u.id ? u : x))
      notify.error(e instanceof Error ? e.message : 'Error al cambiar estado')
    } finally {
      setToggling(null)
    }
  }

  const handleHorarioSuccess = (updated: UsuarioAPI) => {
    setUsuarios(prev => prev.map(u => u.id === updated.id ? updated : u))
  }

  const handleBloquearHastaSuccess = (updated: UsuarioAPI) => {
    setUsuarios(prev => prev.map(u => u.id === updated.id ? updated : u))
  }

  const handleComisionSuccess = (updated: UsuarioAPI) => {
    setUsuarios(prev => prev.map(u => u.id === updated.id ? updated : u))
  }

  const canDelete = (u: UsuarioAPI) => {
    if (me?.rol !== 'admin') return false
    if (u.email === me?.email) return false
    if (u.rol === 'Admin') return false
    return true
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await api.delete(USUARIOS_ENDPOINTS.delete(confirmDelete.id))
      notify.success('Usuario eliminado', {
        description: `${confirmDelete.nombre} ${confirmDelete.apellido} fue eliminado del sistema.`,
      })
      setConfirmDelete(null)
      setDetalleUsuario(null)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al eliminar el usuario')
    } finally {
      setDeleting(false)
    }
  }

  const handleDesactivarTodos = async () => {
    if (!confirm('¿Desactivar a todos los usuarios (excepto administradores)? Podrás reactivarlos individualmente.')) return
    setDesactivandoTodos(true)
    try {
      await api.post('/Usuario/desactivar-todos')
      notify.success('Todos los no-admins desactivados')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setDesactivandoTodos(false)
    }
  }

  return (
    <MainLayout>
      <PageTopBar section="Sistema" title="Usuarios y roles" />
      <div className="bg-[#F7F7F7] min-h-screen">

        <div className="px-7 py-[26px] max-w-[1320px] mx-auto w-full">

          {/* ── Page Header ── */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="font-semibold text-[30px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Usuarios y roles
              </h2>
              <p className="text-[13.5px] text-[#7A7571] mt-1.5">
                Gestión de acceso al sistema
              </p>
            </div>
            <button
              onClick={() => setShowCrear(true)}
              className="px-[18px] py-2.5 bg-[#780e18] hover:bg-[#5a0b12] text-white rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold active:scale-95 transition-all shadow-sm w-full md:w-auto"
            >
              <i className="ti ti-user-plus text-base" />
              Nuevo usuario
            </button>
          </div>

          {/* ── KPI Cards ── */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[22px]">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#D0CBC4] p-[18px] animate-pulse">
                  <div className="flex items-start justify-between mb-[14px]">
                    <div className="w-9 h-9 rounded-lg bg-[#F0EFEC]" />
                    <div className="h-5 w-16 rounded-full bg-[#F0EFEC]" />
                  </div>
                  <div className="h-7 w-20 rounded bg-[#F0EFEC] mb-2" />
                  <div className="h-3 w-28 rounded bg-[#E8E5E2]" />
                </div>
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[22px]">

            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#780e18] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#780e18] opacity-[0.08]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#780e18] to-[#D4A333] flex items-center justify-center shrink-0">
                  <i className="ti ti-users text-white text-[16px]" />
                </div>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F4ECDB] text-[#780e18]">
                  <i className="ti ti-circle-check text-[10px]" />
                  registrados
                </span>
              </div>
              <div className="font-semibold text-[32px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {stats.total}
              </div>
              <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Total usuarios</div>
            </div>

            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#3F7A52] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#3F7A52] opacity-[0.08]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3F7A52] to-[#6BAF80] flex items-center justify-center shrink-0">
                  <i className="ti ti-circle-check text-white text-[16px]" />
                </div>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#B8DCCA] text-[#1E5C38]">
                  con acceso
                </span>
              </div>
              <div className="font-semibold text-[32px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {stats.activos}
              </div>
              <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Activos</div>
            </div>

            <div className={clsx(
              'rounded-xl border border-l-4 p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200',
              stats.inactivos > 0 ? 'bg-[#FDF1EE] border-[#D0CBC4] border-l-[#B23A2A]' : 'bg-white border-[#D0CBC4] border-l-[#B23A2A]'
            )}>
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#B23A2A] opacity-[0.08]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#B23A2A] to-[#E07060] flex items-center justify-center shrink-0">
                  <i className="ti ti-lock text-white text-[16px]" />
                </div>
                <span className={clsx(
                  'inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full',
                  stats.inactivos > 0 ? 'bg-[#F5C9C0] text-[#8A1E12]' : 'bg-[#F0EFEC] text-[#7A7571]'
                )}>
                  {stats.inactivos > 0 ? 'sin acceso' : 'ninguno'}
                </span>
              </div>
              <div className={clsx('font-semibold text-[32px] leading-none tracking-[-0.025em]', stats.inactivos > 0 ? 'text-[#B23A2A]' : 'text-[#2D2B2A]')} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {stats.inactivos}
              </div>
              <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Inactivos</div>
            </div>

          </div>
          )}

          {/* ── Horario Global + Programar bloqueo ── */}
          {loading ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
              <div className="flex-1 h-[58px] rounded-xl bg-[#F0EFEC] animate-pulse" />
              <div className="h-[58px] sm:w-[200px] rounded-xl bg-[#F0EFEC] animate-pulse" />
            </div>
          ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
            <div
              className="flex-1 flex items-center justify-between px-5 py-4 rounded-xl border"
              style={{
                background: horarioGlobal ? '#FEF9EE' : '#FAFAFA',
                borderColor: horarioGlobal ? '#E8D4B8' : '#E8E5E2',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: horarioGlobal ? '#F4ECDB' : '#F0EFEC',
                    color: horarioGlobal ? '#D4A333' : '#7A7571',
                  }}
                >
                  <i className="ti ti-world text-[18px]" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#2D2B2A]">Horario de cierre global</p>
                  {horarioGlobal ? (
                    <p className="text-[11px] text-[#B4881C]">
                      Activo · Todos los días de {horarioGlobal.horaInicio} a {horarioGlobal.horaFin}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#7A7571]">Sin horario configurado</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowHorarioGlobal(true)}
                className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors"
                style={{
                  background: horarioGlobal ? '#F4ECDB' : '#F0EFEC',
                  color: horarioGlobal ? '#780e18' : '#4A4744',
                  borderColor: horarioGlobal ? '#E8D4B8' : '#E8E5E2',
                }}
              >
                {horarioGlobal ? 'Editar' : 'Configurar'}
              </button>
            </div>

            <button
              onClick={() => setShowProgramar(true)}
              className="h-[58px] sm:h-auto px-5 rounded-xl border border-[#E8D4B8] bg-[#FEF9EE] text-[#B4881C] hover:bg-[#F4ECDB] transition-colors flex items-center justify-center gap-2 text-[13px] font-semibold whitespace-nowrap"
            >
              <i className="ti ti-clock text-[16px]" />
              Programar bloqueo
            </button>
          </div>
          )}

          {/* ── Tabla de usuarios ── */}
          <div className="bg-white rounded-xl border border-[#D0CBC4] overflow-hidden">

            {/* Toolbar */}
            <div className="px-[22px] py-[18px] border-b border-[#D0CBC4] flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-[17px] font-semibold text-[#2D2B2A] tracking-[-0.01em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Usuarios
                </h3>
                <span className="bg-[#F4ECDB] text-[#780e18] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {filtered.length}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-[#FBFBFA] border border-[#D8D4D0] rounded-lg px-3.5 w-full sm:w-auto sm:min-w-[240px] focus-within:border-[#780e18] transition-colors">
                  <i className="ti ti-search text-[#7A7571] text-[13px] shrink-0" />
                  <input
                    className="flex-1 py-2 bg-transparent text-[13px] text-[#2D2B2A] font-normal placeholder:text-[#7A7571] outline-none border-none"
                    placeholder="Buscar por nombre, apellido o correo…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                <div className="flex gap-1">
                  {(['todos', 'activo', 'inactivo'] as const).map(f => (
                    <button key={f} onClick={() => setFiltro(f)}
                      className={clsx(
                        'px-3 h-9 rounded-lg text-xs font-semibold border transition-all',
                        filtro === f
                          ? 'bg-[#780e18] text-white border-[#780e18]'
                          : 'bg-white text-[#4A4744] border-[#E8E5E2] hover:bg-[#F0EFEC]'
                      )}>
                      {f === 'todos' ? 'Todos' : f === 'activo' ? 'Activos' : 'Inactivos'}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleDesactivarTodos}
                  disabled={desactivandoTodos}
                  className="h-9 px-3.5 rounded-lg text-xs font-semibold border border-[#F5C9C0] bg-[#FDF1EE] text-[#B23A2A] hover:bg-[#F5C9C0]/50 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <i className="ti ti-lock text-[13px]" />
                  {desactivandoTodos ? 'Desactivando…' : 'Desactivar todos'}
                </button>
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <ListSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#F5F0EB]">
                      <tr>
                        {['Usuario', 'Correo', 'Rol', 'Estado', ''].map((h, i) => (
                          <th key={i} className="px-5 py-[11px] text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] border-b border-[#D0CBC4] whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(u => (
                        <UsuarioRow
                          key={u.id}
                          usuario={u}
                          isSelf={u.email === me?.email}
                          toggling={toggling === u.id}
                          canDelete={canDelete(u)}
                          onToggle={() => handleToggle(u)}
                          onHorario={() => setHorarioUsuario(u)}
                          onBloquearHasta={() => setBloquearHastaUsuario(u)}
                          onComision={() => setComisionUsuario(u)}
                          onOpenDetalle={() => setDetalleUsuario(u)}
                          onDelete={() => setConfirmDelete(u)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="lg:hidden flex flex-col divide-y divide-[#E8E5E2]">
                  {filtered.map(u => (
                    <UsuarioCard
                      key={u.id}
                      usuario={u}
                      isSelf={u.email === me?.email}
                      toggling={toggling === u.id}
                      canDelete={canDelete(u)}
                      onToggle={() => handleToggle(u)}
                      onHorario={() => setHorarioUsuario(u)}
                      onBloquearHasta={() => setBloquearHastaUsuario(u)}
                      onComision={() => setComisionUsuario(u)}
                      onOpenDetalle={() => setDetalleUsuario(u)}
                      onDelete={() => setConfirmDelete(u)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {showCrear && (
        <CrearUsuarioModal
          onClose={() => setShowCrear(false)}
          onSuccess={load}
        />
      )}

      {showProgramar && (
        <ProgramarBloqueoModal
          onClose={() => setShowProgramar(false)}
          onSuccess={load}
        />
      )}

      {showHorarioGlobal && (
        <HorarioGlobalModal
          horarioActual={horarioGlobal}
          onClose={() => setShowHorarioGlobal(false)}
          onSuccess={setHorarioGlobal}
        />
      )}

      {comisionUsuario && (
        <ComisionModal
          usuario={comisionUsuario}
          onClose={() => setComisionUsuario(null)}
          onSuccess={handleComisionSuccess}
        />
      )}

      {horarioUsuario && (
        <HorarioModal
          usuario={horarioUsuario}
          onClose={() => setHorarioUsuario(null)}
          onSuccess={handleHorarioSuccess}
        />
      )}

      {bloquearHastaUsuario && (
        <BloquearHastaModal
          usuario={bloquearHastaUsuario}
          onClose={() => setBloquearHastaUsuario(null)}
          onSuccess={handleBloquearHastaSuccess}
        />
      )}

      <UsuarioDetalleDrawer
        usuario={detalleUsuario}
        onClose={() => setDetalleUsuario(null)}
      />

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => !deleting && setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar usuario"
        message={
          confirmDelete
            ? `¿Estás seguro de que querés eliminar a ${confirmDelete.nombre} ${confirmDelete.apellido}? Esta acción no se puede deshacer.`
            : ''
        }
        loading={deleting}
      />
    </MainLayout>
  )
}

// ─── Row / Card ───────────────────────────────────────────────────────────────

interface RowProps {
  usuario: UsuarioAPI
  isSelf: boolean
  toggling: boolean
  canDelete: boolean
  onToggle: () => void
  onHorario: () => void
  onBloquearHasta: () => void
  onComision: () => void
  onOpenDetalle: () => void
  onDelete: () => void
}

function Toggle({ activo, toggling, onToggle, disabled }: { activo: boolean; toggling: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled || toggling}
      title={disabled ? 'No puedes desactivarte a ti mismo' : undefined}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none',
        activo ? 'bg-[#780e18]' : 'bg-[#D0CBC4]',
        (disabled || toggling) && 'opacity-50 cursor-not-allowed',
        !disabled && !toggling && 'cursor-pointer',
      )}
    >
      <span className={clsx(
        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200',
        activo ? 'translate-x-4' : 'translate-x-0',
        toggling && 'animate-pulse',
      )} />
    </button>
  )
}

function UsuarioRow({ usuario: u, isSelf, toggling, canDelete, onToggle, onHorario, onBloquearHasta, onComision, onOpenDetalle, onDelete }: RowProps) {
  const hasta = fmtBloqueo(u.bloqueadoHasta)
  const esCajero = u.rol === 'Cajero'
  return (
    <tr
      onClick={onOpenDetalle}
      className="border-t border-[#E8E5E2] hover:bg-[#FAF5EE] transition-colors cursor-pointer"
      style={{ opacity: u.activo ? 1 : 0.65 }}
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[#F4ECDB] text-[#780e18]">
            {u.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[13px] text-[#2D2B2A] truncate">{u.nombre} {u.apellido}</p>
            {isSelf && <span className="text-[10px] text-[#780e18] font-semibold">Tú</span>}
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <p className="text-[12px] text-[#7A7571] truncate max-w-[200px]">{u.email}</p>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <RolBadge rol={u.rol} />
          {esCajero && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F0F9F4] text-[#3F7A52] border border-[#C8E6D4]">
              <i className="ti ti-percentage text-[9px]" />
              {u.porcentajeComision}%
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Toggle activo={u.activo} toggling={toggling} onToggle={onToggle} disabled={isSelf} />
          <div>
            <span className="text-[11px] font-semibold" style={{ color: u.activo ? '#3F7A52' : '#B23A2A' }}>
              {u.activo ? 'Activo' : 'Inactivo'}
            </span>
            {!u.activo && hasta && (
              <p className="text-[10px] text-[#B4881C]">hasta {hasta}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 justify-end">
          {esCajero && (
            <button
              onClick={onComision}
              disabled={isSelf}
              title={isSelf ? 'No puedes editar tu propia comisión' : 'Editar comisión'}
              className={clsx(
                'w-8 h-8 flex items-center justify-center rounded-[6px] transition-all border',
                isSelf
                  ? 'opacity-30 cursor-not-allowed bg-[#F0EFEC] text-[#7A7571] border-[#E8E5E2]'
                  : 'bg-[#F0F9F4] text-[#3F7A52] border-[#C8E6D4] hover:bg-[#C8E6D4]'
              )}
            >
              <i className="ti ti-percentage text-[14px]" />
            </button>
          )}
          <button
            onClick={onBloquearHasta}
            disabled={isSelf}
            title={isSelf ? 'No puedes bloquearte a ti mismo' : u.activo ? 'Bloquear hasta fecha' : 'Cambiar fecha de bloqueo'}
            className={clsx(
              'w-8 h-8 flex items-center justify-center rounded-[6px] transition-all border',
              isSelf
                ? 'opacity-30 cursor-not-allowed bg-[#F0EFEC] text-[#7A7571] border-[#E8E5E2]'
                : 'bg-[#F5C9C0]/50 text-[#B23A2A] border-[#F5C9C0] hover:bg-[#F5C9C0]'
            )}
          >
            <i className="ti ti-calendar text-[14px]" />
          </button>
          <button
            onClick={onHorario}
            disabled={isSelf}
            title={isSelf ? 'No puedes asignarte un horario a ti mismo' : u.horario ? `Horario recurrente: ${u.horario.horaInicio}–${u.horario.horaFin}` : 'Sin horario recurrente'}
            className={clsx(
              'w-8 h-8 flex items-center justify-center rounded-[6px] transition-all border',
              isSelf
                ? 'opacity-30 cursor-not-allowed bg-[#F0EFEC] text-[#7A7571] border-[#E8E5E2]'
                : u.horario
                  ? 'bg-[#F4ECDB] text-[#780e18] border-[#E8D4B8] hover:bg-[#E8D4B8]'
                  : 'bg-[#F0EFEC] text-[#7A7571] border-[#E8E5E2] hover:bg-[#E8E5E2]'
            )}
          >
            <i className="ti ti-clock text-[14px]" />
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
              title="Eliminar usuario"
              className="w-8 h-8 flex items-center justify-center rounded-[6px] transition-all border bg-[#FDF1EE] text-[#B23A2A] border-[#F5C9C0] hover:bg-[#F5C9C0]"
            >
              <i className="ti ti-trash text-[14px]" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function UsuarioCard({ usuario: u, isSelf, toggling, canDelete, onToggle, onHorario, onBloquearHasta, onComision, onOpenDetalle, onDelete }: RowProps) {
  const hasta = fmtBloqueo(u.bloqueadoHasta)
  const esCajero = u.rol === 'Cajero'
  return (
    <div
      onClick={onOpenDetalle}
      className="px-4 py-4 cursor-pointer hover:bg-[#FAF5EE] transition-colors"
      style={{ opacity: u.activo ? 1 : 0.65 }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[#F4ECDB] text-[#780e18]">
            {u.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[13px] text-[#2D2B2A] truncate">{u.nombre} {u.apellido}</p>
            <p className="text-[11px] text-[#7A7571] truncate">{u.email}</p>
            {isSelf && <span className="text-[10px] text-[#780e18] font-semibold">Tú</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
          <RolBadge rol={u.rol} />
          {esCajero && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F0F9F4] text-[#3F7A52] border border-[#C8E6D4]">
              <i className="ti ti-percentage text-[9px]" />
              {u.porcentajeComision}%
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-[#E8E5E2]">
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Toggle activo={u.activo} toggling={toggling} onToggle={onToggle} disabled={isSelf} />
          <div>
            <span className="text-[11px] font-semibold" style={{ color: u.activo ? '#3F7A52' : '#B23A2A' }}>
              {u.activo ? 'Activo' : 'Inactivo'}
            </span>
            {!u.activo && hasta && (
              <p className="text-[10px] text-[#B4881C]">hasta {hasta}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {esCajero && (
            <button
              onClick={onComision}
              disabled={isSelf}
              title={isSelf ? 'No puedes editar tu propia comisión' : 'Editar comisión'}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border',
                isSelf
                  ? 'opacity-30 cursor-not-allowed bg-[#F0EFEC] text-[#7A7571] border-[#E8E5E2]'
                  : 'bg-[#F0F9F4] text-[#3F7A52] border-[#C8E6D4] hover:bg-[#C8E6D4]'
              )}
            >
              <i className="ti ti-percentage text-[12px]" />
              Comisión
            </button>
          )}
          <button
            onClick={onBloquearHasta}
            disabled={isSelf}
            title={isSelf ? 'No puedes bloquearte a ti mismo' : undefined}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border',
              isSelf
                ? 'opacity-30 cursor-not-allowed bg-[#F0EFEC] text-[#7A7571] border-[#E8E5E2]'
                : 'bg-[#F5C9C0]/40 text-[#B23A2A] border-[#F5C9C0] hover:bg-[#F5C9C0]/70'
            )}
          >
            <i className="ti ti-calendar text-[12px]" />
            Bloquear
          </button>
          <button
            onClick={onHorario}
            disabled={isSelf}
            title={isSelf ? 'No puedes asignarte un horario a ti mismo' : undefined}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border',
              isSelf
                ? 'opacity-30 cursor-not-allowed bg-[#F0EFEC] text-[#7A7571] border-[#E8E5E2]'
                : u.horario
                  ? 'bg-[#F4ECDB] text-[#780e18] border-[#E8D4B8] hover:bg-[#E8D4B8]'
                  : 'bg-[#F0EFEC] text-[#7A7571] border-[#E8E5E2] hover:bg-[#E8E5E2]'
            )}
          >
            <i className="ti ti-clock text-[12px]" />
            {u.horario ? `${u.horario.horaInicio}–${u.horario.horaFin}` : 'Horario'}
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
              title="Eliminar usuario"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border bg-[#FDF1EE] text-[#B23A2A] border-[#F5C9C0] hover:bg-[#F5C9C0]"
            >
              <i className="ti ti-trash text-[12px]" />
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function RolBadge({ rol }: { rol: string }) {
  const isAdmin = rol.toLowerCase() === 'admin'
  return (
    <span
      className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold w-fit"
      style={{
        background: isAdmin ? '#F4ECDB' : '#F0EFEC',
        color: isAdmin ? '#780e18' : '#4A4744',
        border: '1px solid',
        borderColor: isAdmin ? '#E8D4B8' : '#E8E5E2',
      }}
    >
      {ROL_LABELS[rol] ?? rol}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
      <div className="w-12 h-12 rounded-lg bg-white border border-[#E8E5E2] flex items-center justify-center mb-4">
        <i className="ti ti-users text-[#7A7571] text-xl" />
      </div>
      <p className="text-sm font-semibold text-[#2D2B2A] mb-1">Sin usuarios registrados</p>
      <p className="text-xs text-[#7A7571] font-medium max-w-xs">
        No hay usuarios que coincidan con la búsqueda o filtro.
      </p>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-[#E8E5E2]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
          <div className="w-9 h-9 rounded-full bg-[#F0EFEC] shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-36 rounded bg-[#F0EFEC]" />
            <div className="h-2.5 w-48 rounded bg-[#E8E5E2]" />
          </div>
          <div className="h-5 w-20 rounded-full bg-[#F0EFEC]" />
          <div className="h-5 w-16 rounded-full bg-[#F0EFEC]" />
          <div className="flex gap-1">
            <div className="h-8 w-8 rounded-[6px] bg-[#F0EFEC]" />
            <div className="h-8 w-8 rounded-[6px] bg-[#F0EFEC]" />
          </div>
        </div>
      ))}
    </div>
  )
}
