import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Input, PasswordInput } from '@/components/ui'
import { notify } from '@/lib/notify'
import type { Usuario } from '@/types'
import { ROLE_HOME } from '@/lib/roles'


export function LoginPage() {
  const { login, user, isTokenReady } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? null
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  if (isTokenReady && user) {
    return <Navigate to={ROLE_HOME[user.rol] ?? '/inventario'} replace />
  }

  const doLogin = async (e: string, p: string) => {
    setLoading(true)
    try {
      const loggedUser: Usuario = await login(e, p)
      void navigate(from ?? ROLE_HOME[loggedUser.rol] ?? '/inventario', { replace: true })
    } catch {
      notify.error('Credenciales incorrectas', { description: 'Verifica tu email y contraseña' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await doLogin(email, password)
  }

  return (
    <>
    <div className="min-h-screen flex">

      {/* ── Panel izquierdo — siempre visible, ocupa todo en mobile ── */}
      <div className="flex flex-col justify-between w-full lg:w-[55%] bg-steel-900 relative overflow-hidden">

        {/* Rin SVG */}
        <div className="absolute inset-0 flex items-center justify-center">
          <WheelIllustration />
        </div>

        {/* Degradado inferior */}
        <div className="absolute bottom-0 left-0 right-0 h-56
          bg-gradient-to-t from-steel-900 via-steel-900/80 to-transparent" />

        {/* Línea roja derecha (solo desktop) */}
        <div className="hidden lg:block absolute top-0 right-0 w-1 h-full bg-brand-600" />

        {/* Logo arriba */}
        <div className="relative z-10 px-8 lg:px-12 pt-10 flex items-center gap-3">
          <div className="h-8 w-8 bg-brand-600 flex items-center justify-center rounded shrink-0">
            <GearIconSm />
          </div>
          <span className="text-white font-bold text-xs tracking-widest uppercase opacity-70">
            Sistema de gestión
          </span>
        </div>

        {/* Nombre empresa — desktop: abajo izquierda / mobile: centrado sobre el formulario */}
        <div className="relative z-10 px-8 lg:px-12 pb-8 lg:pb-12 lg:block hidden">
          <p className="text-white text-5xl font-black tracking-tight leading-none">
            USA<br />
            <span className="text-brand-500">AUTO</span>PARTES
          </p>
        </div>

        {/* Mobile: formulario superpuesto en la parte inferior */}
        <div className="lg:hidden relative z-10 px-6 pb-10 pt-4 flex flex-col items-center">
          <p className="w-full max-w-sm text-white text-4xl font-black tracking-tight leading-none mb-8">
            USA<br />
            <span className="text-brand-500">AUTO</span>PARTES
          </p>

          <div className="w-full max-w-sm bg-steel-900/60 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-white/10">
            <h2 className="text-xl font-bold text-white mb-1">Iniciar sesión</h2>
            <p className="text-steel-300 text-sm mb-6">Ingresa tus credenciales para continuar.</p>
            <LoginForm
              email={email} password={password} loading={loading}
              onEmail={setEmail} onPassword={setPassword}
              onSubmit={handleSubmit}
            />
          </div>

          <p className="w-full max-w-sm mt-6 text-xs text-steel-400 text-center">
            © {new Date().getFullYear()} USA Autopartes
          </p>
        </div>

      </div>

      {/* ── Panel derecho — solo desktop ── */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-white px-6">
        <div className="w-full max-w-xs">
          <h2 className="text-2xl font-bold text-steel-900 mb-1">Iniciar sesión</h2>
          <p className="text-steel-400 text-sm mb-8">Ingresa tus credenciales para continuar.</p>
          <LoginForm
            email={email} password={password} loading={loading}
            onEmail={setEmail} onPassword={setPassword}
            onSubmit={handleSubmit}
          />
        </div>
        <p className="mt-16 text-xs text-steel-300">© {new Date().getFullYear()} USA Autopartes</p>
      </div>

    </div>

</>
  )
}

// ── Ilustración de rin / rueda ────────────────────────────────────────────────

function WheelIllustration() {
  const cx = 300
  const cy = 300
  const R  = 260   // neumático exterior
  const r1 = 220   // interior neumático
  const r2 = 180   // borde del rin
  const r3 = 60    // buje central
  const spokes = 5

  // Genera los rayos (spokes) del rin
  const spokeElements = Array.from({ length: spokes }, (_, i) => {
    const angle = (i * 360) / spokes
    const rad   = (angle * Math.PI) / 180
    const spread = 0.18 // medio-ancho angular del rayo en radianes

    // Cuatro puntos del rayo trapezoidal
    const outerLeft  = polarToXY(cx, cy, r2,      rad - spread)
    const outerRight = polarToXY(cx, cy, r2,      rad + spread)
    const innerLeft  = polarToXY(cx, cy, r3 + 10, rad - spread * 1.6)
    const innerRight = polarToXY(cx, cy, r3 + 10, rad + spread * 1.6)

    return (
      <polygon
        key={i}
        points={`${outerLeft} ${outerRight} ${innerRight} ${innerLeft}`}
        fill="#C8102E"
        opacity="0.9"
      />
    )
  })

  return (
    <svg
      viewBox="0 0 600 600"
      className="w-[680px] h-[680px] opacity-20"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Neumático */}
      <circle cx={cx} cy={cy} r={R}  fill="#3a3a3a" />
      <circle cx={cx} cy={cy} r={r1} fill="#1A1A1A" />

      {/* Detalle interior neumático */}
      <circle cx={cx} cy={cy} r={R - 8}  fill="none" stroke="#555" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={r1 + 8} fill="none" stroke="#444" strokeWidth="2" />

      {/* Disco del rin */}
      <circle cx={cx} cy={cy} r={r2} fill="#2a2a2a" />

      {/* Rayos */}
      {spokeElements}

      {/* Ventanas entre rayos (cut-outs) */}
      {Array.from({ length: spokes }, (_, i) => {
        const angle  = ((i + 0.5) * 360) / spokes
        const rad    = (angle * Math.PI) / 180
        const midR   = (r3 + r2) / 2
        const spread = 0.22
        const outerL = polarToXY(cx, cy, r2 - 18,  rad - spread)
        const outerR = polarToXY(cx, cy, r2 - 18,  rad + spread)
        const innerL = polarToXY(cx, cy, r3 + 22,  rad - spread * 0.7)
        const innerR = polarToXY(cx, cy, r3 + 22,  rad + spread * 0.7)
        void midR
        return (
          <polygon
            key={i}
            points={`${outerL} ${outerR} ${innerR} ${innerL}`}
            fill="#1A1A1A"
            opacity="0.9"
          />
        )
      })}

      {/* Buje */}
      <circle cx={cx} cy={cy} r={r3}      fill="#222" />
      <circle cx={cx} cy={cy} r={r3 - 6}  fill="#C8102E" opacity="0.7" />
      <circle cx={cx} cy={cy} r={r3 - 18} fill="#1a1a1a" />

      {/* Tornillos del buje */}
      {Array.from({ length: 5 }, (_, i) => {
        const angle = (i * 72 * Math.PI) / 180
        const bx    = cx + (r3 - 28) * Math.cos(angle)
        const by    = cy + (r3 - 28) * Math.sin(angle)
        return <circle key={i} cx={bx} cy={by} r={5} fill="#555" />
      })}

      {/* Aro exterior del rin */}
      <circle cx={cx} cy={cy} r={r2}      fill="none" stroke="#C8102E" strokeWidth="3" opacity="0.6" />
      <circle cx={cx} cy={cy} r={r2 - 6}  fill="none" stroke="#888"    strokeWidth="1" opacity="0.3" />
    </svg>
  )
}

function polarToXY(cx: number, cy: number, r: number, rad: number): string {
  return `${(cx + r * Math.cos(rad)).toFixed(2)},${(cy + r * Math.sin(rad)).toFixed(2)}`
}

// ── Icono engranaje pequeño ───────────────────────────────────────────────────

function GearIconSm() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="currentColor">
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.69.07-1.08s-.03-.73-.07-1.08l2.3-1.8c.21-.16.27-.46.13-.7l-2.18-3.78a.502.502 0 0 0-.61-.22l-2.71 1.09c-.57-.44-1.17-.81-1.84-1.08l-.41-2.88C14.29 2.14 14.04 2 13.76 2h-3.52c-.28 0-.53.14-.57.38l-.41 2.88C8.59 5.58 7.99 5.95 7.42 6.39L4.71 5.3a.488.488 0 0 0-.61.22L1.92 9.3c-.14.24-.08.54.13.7l2.3 1.8C4.31 12.14 4.28 12.5 4.28 12.84s.03.69.07 1.08l-2.3 1.8c-.21.16-.27.46-.13.7l2.18 3.78c.12.22.41.3.61.22l2.71-1.09c.57.44 1.17.81 1.84 1.08l.41 2.88c.04.24.29.38.57.38h3.52c.28 0 .53-.14.57-.38l.41-2.88c.67-.27 1.27-.64 1.84-1.08l2.71 1.09c.2.08.49 0 .61-.22l2.18-3.78c.14-.24.08-.54-.13-.7l-2.3-1.8z" />
    </svg>
  )
}

// ── Formulario de login reutilizable ─────────────────────────────────────────

interface LoginFormProps {
  email: string
  password: string
  loading: boolean
  onEmail: (v: string) => void
  onPassword: (v: string) => void
  onSubmit: (e: FormEvent) => void
}

function LoginForm({ email, password, loading, onEmail, onPassword, onSubmit }: LoginFormProps) {
  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <PasswordInput
          label="Contraseña"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <Button type="submit" loading={loading} className="w-full justify-center">
          Ingresar
        </Button>
      </form>
    </div>
  )
}
