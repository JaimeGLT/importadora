import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HorarioAPI {
  horaInicio: string
  horaFin: string
  activo: boolean
}

export interface UsuarioDetalle {
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

type TabKey = 'info' | 'actividad'

interface UsuarioDetalleDrawerProps {
  usuario: UsuarioDetalle | null
  onClose: () => void
}

// ─── Drawer container ────────────────────────────────────────────────────────

function Drawer({
  onClose,
  children,
  width = 'sm:w-[480px]',
}: {
  onClose: () => void
  children: React.ReactNode
  width?: string
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end"
      style={{ background: 'rgba(45,43,42,0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
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

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function Tabs({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'info', label: 'Información', icon: 'ti ti-user' },
    { key: 'actividad', label: 'Actividad', icon: 'ti ti-activity' },
  ]
  return (
    <div className="px-6 pt-2 flex items-center gap-1 border-b border-[#E8E5E2] shrink-0 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-semibold border-b-2 transition-colors whitespace-nowrap -mb-px',
            active === t.key
              ? 'border-[#780e18] text-[#780e18]'
              : 'border-transparent text-[#7A7571] hover:text-[#2D2B2A]',
          )}
        >
          <i className={clsx(t.icon, 'text-[14px]')} />
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Field row (read-only) ───────────────────────────────────────────────────

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="py-2.5 border-b border-[#F0EFEC] last:border-b-0">
      <p className="text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.1em] mb-1">
        {label}
      </p>
      <div className={clsx('text-[13.5px] text-[#2D2B2A] break-words', mono && 'font-mono text-[12px]')}>
        {value}
      </div>
    </div>
  )
}

// ─── Tab: Información ────────────────────────────────────────────────────────

function InfoTab({ usuario }: { usuario: UsuarioDetalle }) {
  const hasta = fmtBloqueo(usuario.bloqueadoHasta)
  return (
    <div className="space-y-1">
      <Field
        label="ID"
        value={<span className="text-[#7A7571]">{usuario.id}</span>}
        mono
      />
      <Field
        label="Nombre completo"
        value={
          <span className="flex items-center gap-2">
            {usuario.nombre} {usuario.apellido}
          </span>
        }
      />
      <Field label="Correo electrónico" value={usuario.email} />
      <Field
        label="Rol"
        value={
          <span
            className={clsx(
              'inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold w-fit',
              usuario.rol.toLowerCase() === 'admin'
                ? 'bg-[#F4ECDB] text-[#780e18] border border-[#E8D4B8]'
                : 'bg-[#F0EFEC] text-[#4A4744] border border-[#E8E5E2]',
            )}
          >
            {ROL_LABELS[usuario.rol] ?? usuario.rol}
          </span>
        }
      />
      <Field
        label="Estado"
        value={
          <span className="flex items-center gap-2">
            <span
              className={clsx(
                'inline-block w-2 h-2 rounded-full',
                usuario.activo ? 'bg-emerald-500' : 'bg-red-500',
              )}
            />
            <span className={clsx('font-semibold', usuario.activo ? 'text-emerald-700' : 'text-red-700')}>
              {usuario.activo ? 'Activo' : 'Inactivo'}
            </span>
            {!usuario.activo && hasta && (
              <span className="text-[11px] text-[#B4881C]">· hasta {hasta}</span>
            )}
          </span>
        }
      />

      {usuario.rol === 'Cajero' && (
        <Field
          label="Comisión por ventas"
          value={
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F0F9F4] text-[#3F7A52] border border-[#C8E6D4]">
              <i className="ti ti-percentage text-[10px]" />
              {usuario.porcentajeComision}%
            </span>
          }
        />
      )}

      {usuario.horario && (
        <Field
          label="Horario recurrente"
          value={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F4ECDB] text-[#780e18] border border-[#E8D4B8]">
              <i className="ti ti-clock text-[12px]" />
              {usuario.horario.horaInicio} — {usuario.horario.horaFin}
            </span>
          }
        />
      )}

      <Field label="Creado en" value={fmtFecha((usuario as unknown as { creado_en?: string }).creado_en)} />
      <Field
        label="Actualizado en"
        value={fmtFecha((usuario as unknown as { actualizado_en?: string }).actualizado_en)}
      />
    </div>
  )
}

// ─── Tab: Actividad ──────────────────────────────────────────────────────────

function ActividadTab({ usuario }: { usuario: UsuarioDetalle }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[#F4ECDB]/40 border border-[#E8D4B8]">
        <i className="ti ti-info-circle text-[#B4881C] text-[15px] shrink-0 mt-px" />
        <p className="text-[12px] text-[#7A5200]">
          Los datos de actividad (comisión, horario, bloqueo) se gestionan desde la
          lista principal con los botones de cada fila. Esta pestaña es solo
          informativa.
        </p>
      </div>
      <Field
        label="Bloqueado hasta"
        value={fmtBloqueo(usuario.bloqueadoHasta) ?? 'Sin bloqueo activo'}
      />
      <Field
        label="Horario recurrente"
        value={
          usuario.horario
            ? `${usuario.horario.horaInicio} — ${usuario.horario.horaFin}`
            : 'Sin horario configurado'
        }
      />
      {usuario.rol === 'Cajero' && (
        <Field label="Comisión" value={`${usuario.porcentajeComision}%`} />
      )}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export function UsuarioDetalleDrawer({ usuario, onClose }: UsuarioDetalleDrawerProps) {
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('info')

  if (!usuario) return null

  const isSelf = me?.id === usuario.id

  return (
    <>
      <Drawer onClose={onClose}>
        {/* Header */}
        <div className="px-6 pt-4 pb-3 border-b border-[#E8E5E2] shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-[#F4ECDB] text-[#780e18]">
              <i className="ti ti-user text-[18px]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#2D2B2A] text-sm truncate">
                {usuario.nombre} {usuario.apellido}
                {isSelf && (
                  <span className="ml-2 text-[10px] text-[#780e18] font-semibold">(Tú)</span>
                )}
              </p>
              <p className="text-[11px] text-[#7A7571] truncate">{usuario.email}</p>
            </div>
            <button
              onClick={onClose}
              className="text-[#7A7571] hover:text-[#2D2B2A] p-1.5 rounded-lg hover:bg-[#F0EFEC] transition-colors shrink-0"
            >
              <i className="ti ti-x text-[16px]" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs active={tab} onChange={setTab} />

        {/* Banner: si es la cuenta del admin, redirigirlo a /mi-cuenta */}
        {isSelf && (
          <button
            type="button"
            onClick={() => { onClose(); navigate('/mi-cuenta') }}
            className="mx-6 mt-4 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[#F4ECDB]/60 border border-[#E8D4B8] text-left hover:bg-[#F4ECDB] transition-colors"
          >
            <i className="ti ti-info-circle text-[#B4881C] text-[15px] shrink-0 mt-px" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#7A5200]">Esta es tu cuenta</p>
              <p className="text-[11px] text-[#7A5200]/80 mt-0.5">
                Para editar tu información personal, hacé click acá o usá el menú lateral → Mi cuenta.
              </p>
            </div>
            <i className="ti ti-arrow-right text-[#B4881C] text-[14px] shrink-0 mt-1" />
          </button>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'info' && <InfoTab usuario={usuario} />}
          {tab === 'actividad' && <ActividadTab usuario={usuario} />}
        </div>
      </Drawer>
    </>
  )
}
