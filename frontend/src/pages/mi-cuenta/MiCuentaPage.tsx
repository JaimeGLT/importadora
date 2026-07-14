import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { MainLayout } from '@/components/layout/MainLayout'
import { PageTopBar } from '@/components/layout/PageTopBar'
import { Input, PasswordInput, Button, ConfirmModal, FormSection } from '@/components/ui'
import { api } from '@/lib/api'
import { USUARIOS_ENDPOINTS } from '@/lib/queries/usuarios.queries'
import { notify } from '@/lib/notify'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PasswordForm {
  passwordActual: string
  passwordNueva: string
  passwordNuevaConfirm: string
}

type PasswordErrors = Partial<Record<keyof PasswordForm, string>>

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MiCuentaPage() {
  const { user, isTokenReady, updateMiPerfil } = useAuth()

  // ── Estado local (form de perfil) ─────────────────────────────────────────
  const [perfil, setPerfil] = useState({ nombre: '', apellido: '', correo: '' })
  const [perfilOriginal, setPerfilOriginal] = useState({ nombre: '', apellido: '', correo: '' })
  const [perfilErrors, setPerfilErrors] = useState<Partial<Record<keyof typeof perfil, string>>>({})
  const [savingPerfil, setSavingPerfil] = useState(false)

  // ── Estado local (form de contraseña) ────────────────────────────────────
  const [pwd, setPwd] = useState<PasswordForm>({
    passwordActual: '',
    passwordNueva: '',
    passwordNuevaConfirm: '',
  })
  const [pwdErrors, setPwdErrors] = useState<PasswordErrors>({})
  const [savingPwd, setSavingPwd] = useState(false)
  const [showPwdConfirm, setShowPwdConfirm] = useState(false)

  // ── 3) useEffect con isTokenReady: inicializar forms con el user actual ─
  useEffect(() => {
    if (!isTokenReady || !user) return
    const inicial = {
      nombre: user.nombre ?? '',
      apellido: user.apellido ?? '',
      correo: user.email ?? '',
    }
    setPerfil(inicial)
    setPerfilOriginal(inicial)
  }, [isTokenReady, user])

  // ── 4) useMemo: detectar cambios y limpiar errores ──────────────────────
  const perfilDirty = useMemo(
    () =>
      perfil.nombre !== perfilOriginal.nombre ||
      perfil.apellido !== perfilOriginal.apellido ||
      perfil.correo !== perfilOriginal.correo,
    [perfil, perfilOriginal],
  )

  const pwdDirty =
    pwd.passwordActual.length > 0 ||
    pwd.passwordNueva.length > 0 ||
    pwd.passwordNuevaConfirm.length > 0

  // ── 5) Handlers ──────────────────────────────────────────────────────────
  const validarPerfil = (): boolean => {
    const e: Partial<Record<keyof typeof perfil, string>> = {}
    if (!perfil.nombre.trim()) e.nombre = 'Requerido'
    if (!perfil.apellido.trim()) e.apellido = 'Requerido'
    if (!perfil.correo.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(perfil.correo)) {
      e.correo = 'Correo inválido'
    }
    setPerfilErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmitPerfil = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validarPerfil()) return
    setSavingPerfil(true)
    try {
      await updateMiPerfil({
        nombre: perfil.nombre.trim(),
        apellido: perfil.apellido.trim(),
        correo: perfil.correo.trim(),
      })
      setPerfilOriginal({ ...perfil })
      notify.success('Información actualizada', {
        description: 'Tus datos personales se guardaron correctamente.',
      })
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al actualizar perfil')
    } finally {
      setSavingPerfil(false)
    }
  }

  const validarPwd = (): boolean => {
    const e: PasswordErrors = {}
    if (!pwd.passwordActual) e.passwordActual = 'Ingresa tu contraseña actual'
    if (pwd.passwordNueva.length < 6) e.passwordNueva = 'Mínimo 6 caracteres'
    if (pwd.passwordNueva !== pwd.passwordNuevaConfirm) {
      e.passwordNuevaConfirm = 'Las contraseñas no coinciden'
    }
    setPwdErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmitPwd = async () => {
    if (!validarPwd()) {
      setShowPwdConfirm(false)
      return
    }
    setSavingPwd(true)
    try {
      await api.post(USUARIOS_ENDPOINTS.changeMyPassword, {
        PasswordActual: pwd.passwordActual,
        PasswordNueva: pwd.passwordNueva,
        PasswordNuevaConfirm: pwd.passwordNuevaConfirm,
      })
      notify.success('Contraseña cambiada', {
        description: 'Tu nueva contraseña ya está activa. Vuelve a iniciar sesión si lo necesitas.',
      })
      setPwd({ passwordActual: '', passwordNueva: '', passwordNuevaConfirm: '' })
      setPwdErrors({})
      setShowPwdConfirm(false)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al cambiar la contraseña')
    } finally {
      setSavingPwd(false)
    }
  }

  const handleCancelPwd = () => {
    setPwd({ passwordActual: '', passwordNueva: '', passwordNuevaConfirm: '' })
    setPwdErrors({})
  }

  // ── 6) Render ────────────────────────────────────────────────────────────
  if (!isTokenReady) {
    return (
      <MainLayout>
        <PageTopBar section="Mi cuenta" title="Mi cuenta" />
        <PageSkeleton />
      </MainLayout>
    )
  }

  if (!user) return null

  const iniciales = (user.nombre?.[0] ?? '?').toUpperCase()
  const rolLabel = user.rol ? user.rol[0].toUpperCase() + user.rol.slice(1) : ''

  return (
    <MainLayout>
      <PageTopBar section="Mi cuenta" title="Mi cuenta" />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#2D2B2A] tracking-[-0.022em]">
            Mi cuenta
          </h1>
          <p className="text-sm text-[#7A7571] mt-1">
            Edita tu información personal y tu contraseña.
          </p>
        </div>

        {/* Card de identidad */}
        <div className="flex items-center gap-4 mb-6 px-5 py-4 rounded-2xl border border-[#E8E5E2] bg-white">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-[#F4ECDB] shrink-0"
            style={{ background: 'linear-gradient(135deg, #D4A333 0%, #8C5A12 100%)' }}
          >
            {iniciales}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#2D2B2A] truncate">
              {user.nombre} {user.apellido}
            </p>
            <p className="text-sm text-[#7A7571] truncate">{user.email}</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F4ECDB] text-[#780e18] border border-[#E8D4B8]">
            {rolLabel}
          </span>
        </div>

        {/* Form: Información personal */}
        <form onSubmit={handleSubmitPerfil} className="mb-5">
          <FormSection
            icon={<i className="ti ti-user text-[16px] text-[#780e18]" />}
            title="Información personal"
            description="Tu nombre, apellido y correo de inicio de sesión."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                value={perfil.nombre}
                onChange={(e) => setPerfil((p) => ({ ...p, nombre: e.target.value }))}
                error={perfilErrors.nombre}
                autoComplete="given-name"
              />
              <Input
                label="Apellido"
                value={perfil.apellido}
                onChange={(e) => setPerfil((p) => ({ ...p, apellido: e.target.value }))}
                error={perfilErrors.apellido}
                autoComplete="family-name"
              />
            </div>
            <div className="mt-4">
              <Input
                label="Correo electrónico"
                type="email"
                value={perfil.correo}
                onChange={(e) => setPerfil((p) => ({ ...p, correo: e.target.value }))}
                error={perfilErrors.correo}
                hint="Es el correo que usas para iniciar sesión."
                autoComplete="email"
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-[#E8E5E2]">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPerfil(perfilOriginal)}
                disabled={!perfilDirty || savingPerfil}
              >
                Descartar cambios
              </Button>
              <Button type="submit" variant="primary" loading={savingPerfil} disabled={!perfilDirty}>
                Guardar cambios
              </Button>
            </div>
          </FormSection>
        </form>

        {/* Form: Cambiar contraseña */}
        <FormSection
          icon={<i className="ti ti-lock text-[16px] text-[#780e18]" />}
          title="Cambiar contraseña"
          description="Por seguridad, ingresa tu contraseña actual para confirmar el cambio."
        >
          <div className="space-y-4">
            <PasswordInput
              label="Contraseña actual"
              value={pwd.passwordActual}
              onChange={(e) => setPwd((p) => ({ ...p, passwordActual: e.target.value }))}
              error={pwdErrors.passwordActual}
              autoComplete="current-password"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PasswordInput
                label="Nueva contraseña"
                value={pwd.passwordNueva}
                onChange={(e) => setPwd((p) => ({ ...p, passwordNueva: e.target.value }))}
                error={pwdErrors.passwordNueva}
                hint="Mínimo 6 caracteres."
                autoComplete="new-password"
              />
              <PasswordInput
                label="Confirmar nueva contraseña"
                value={pwd.passwordNuevaConfirm}
                onChange={(e) => setPwd((p) => ({ ...p, passwordNuevaConfirm: e.target.value }))}
                error={pwdErrors.passwordNuevaConfirm}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-[#E8E5E2]">
            <Button type="button" variant="secondary" onClick={handleCancelPwd} disabled={!pwdDirty || savingPwd}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                if (validarPwd()) setShowPwdConfirm(true)
              }}
              disabled={!pwdDirty}
            >
              Cambiar contraseña
            </Button>
          </div>
        </FormSection>
      </div>

      <ConfirmModal
        open={showPwdConfirm}
        onClose={() => setShowPwdConfirm(false)}
        onConfirm={handleSubmitPwd}
        title="¿Cambiar tu contraseña?"
        message="Una vez confirmada, tu nueva contraseña estará activa de inmediato. Asegúrate de recordarla."
        loading={savingPwd}
      />
    </MainLayout>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="h-7 w-40 rounded bg-[#F0EFEC] animate-pulse mb-2" />
      <div className="h-4 w-72 rounded bg-[#E8E5E2] animate-pulse mb-6" />
      <div className="h-16 w-full rounded-2xl bg-[#F0EFEC] animate-pulse mb-5" />
      <div className="h-64 w-full rounded-2xl bg-[#F0EFEC] animate-pulse mb-5" />
      <div className="h-48 w-full rounded-2xl bg-[#F0EFEC] animate-pulse" />
    </div>
  )
}
