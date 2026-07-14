import { createContext, useContext, type ReactNode } from 'react'
import type { Usuario } from '@/types'

interface AuthContextValue {
  user: Usuario | null
  isAuthenticated: boolean
  isTokenReady: boolean
  refreshSession: () => Promise<boolean>
  login: (email: string, password: string) => Promise<Usuario>
  logout: () => Promise<void>
  updateMiPerfil: (datos: { nombre: string; apellido: string; correo: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── MODO PORTAFOLIO ─────────────────────────────────────────────────────────
// Login, refresh de sesión y roles deshabilitados: se usa un usuario "admin"
// fijo, sin llamadas al backend, para que cualquier visitante pueda entrar
// directo y ver/usar todas las secciones del sistema sin autenticarse.
// La implementación original (login/refresh/logout reales contra
// /Auth/login, /Auth/refresh, /Auth/logout) queda comentada más abajo para
// poder restaurarla completa el día que se quiera volver a exigir login.
const PORTFOLIO_USER: Usuario = {
  id: 'portfolio-guest',
  nombre: 'Visitante',
  apellido: 'Portafolio',
  email: 'demo@portafolio.local',
  rol: 'admin',
  activo: true,
  creado_en: '',
  actualizado_en: '',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const login = async (): Promise<Usuario> => PORTFOLIO_USER
  const refreshSession = async (): Promise<boolean> => true
  const logout = async (): Promise<void> => {}
  const updateMiPerfil = async (): Promise<void> => {}

  return (
    <AuthContext.Provider
      value={{
        user: PORTFOLIO_USER,
        isAuthenticated: true,
        isTokenReady: true,
        refreshSession,
        login,
        logout,
        updateMiPerfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// ─── Implementación original (con login/roles reales) ──────────────────────
// Descomentar este bloque y borrar el AuthProvider de arriba para restaurar
// la autenticación real contra el backend.
//
// import { useState, useEffect } from 'react'
// import { api, apiInternal, setAuthCallbacks, clearAuthCallbacks } from '@/lib/api'
// import { initGqlCallbacks, clearGqlCallbacks } from '@/lib/graphql'
// import { USUARIOS_ENDPOINTS } from '@/lib/queries/usuarios.queries'
//
// interface ApiUserResponse {
//   id?: string | number
//   nombre?: string
//   name?: string
//   email?: string
//   correo?: string
//   rol?: string
//   role?: string
// }
//
// interface MiPerfilResponse {
//   id: string
//   nombre: string
//   apellido: string
//   correo: string
//   rol: string
// }
//
// function mapToUser(data: ApiUserResponse): Usuario | null {
//   const email = data.correo ?? data.email ?? ''
//   const id = data.id ? String(data.id) : (email.split('@')[0] || null)
//   const nombre = data.nombre ?? data.name ?? email.split('@')[0] ?? ''
//   const rawRol = (data.rol ?? data.role ?? '').toLowerCase()
//   const ROL_MAP: Record<string, Usuario['rol']> = {
//     admin: 'admin',
//     administrador: 'admin',
//     vendedor: 'cajero',
//     sales: 'cajero',
//     cajero: 'cajero',
//     almacenero: 'almacenero',
//     almacen: 'almacenero',
//     warehouse: 'almacenero',
//     operador: 'operador',
//   }
//   const rol: Usuario['rol'] = ROL_MAP[rawRol] ?? 'cajero'
//   if (!id || !email) return null
//   return { id, nombre, email, rol, apellido: '', activo: true, creado_en: '', actualizado_en: '' }
// }
//
// // Dedup the initial refresh so StrictMode's double-mount doesn't fire two requests
// // with the same token (backend revokes on first call, second would fail)
// let initialRefreshPromise: Promise<ApiUserResponse | null> | null = null
//
// export function AuthProvider({ children }: { children: ReactNode }) {
//   const [user, setUser] = useState<Usuario | null>(null)
//   const [isTokenReady, setIsTokenReady] = useState(false)
//
//   useEffect(() => {
//     setAuthCallbacks(refreshSession, logout)
//     initGqlCallbacks(refreshSession, logout)
//
//     if (!initialRefreshPromise) {
//       initialRefreshPromise = apiInternal.post<ApiUserResponse>('/Auth/refresh')
//         .catch(() => null)
//         .finally(() => { initialRefreshPromise = null })
//     }
//
//     initialRefreshPromise.then((data) => {
//       if (data) {
//         const u = mapToUser(data)
//         if (u) setUser(u)
//       }
//     }).finally(() => setIsTokenReady(true))
//
//     return () => { clearAuthCallbacks(); clearGqlCallbacks() }
//   }, [])
//
//   const login = async (email: string, password: string): Promise<Usuario> => {
//     const data = await apiInternal.post<ApiUserResponse>('/Auth/login', { email, password })
//     const u = mapToUser(data ?? {})
//     if (!u) throw new Error('No se pudo obtener datos del usuario')
//     setUser(u)
//     return u
//   }
//
//   const refreshSession = async (): Promise<boolean> => {
//     try {
//       const data = await apiInternal.post<ApiUserResponse>('/Auth/refresh')
//       const u = mapToUser(data)
//       if (u) {
//         setUser(u)
//         return true
//       }
//       return false
//     } catch {
//       setUser(null)
//       return false
//     }
//   }
//
//   const logout = async () => {
//     clearAuthCallbacks()
//     try { await apiInternal.post('/Auth/logout') } catch { /* ignore */ }
//     setUser(null)
//   }
//
//   const updateMiPerfil = async (datos: { nombre: string; apellido: string; correo: string }): Promise<void> => {
//     await api.put<MiPerfilResponse>(USUARIOS_ENDPOINTS.updateMiPerfil, {
//       Nombre: datos.nombre,
//       Apellido: datos.apellido,
//       Correo: datos.correo,
//     })
//     // Refrescar sesión para que el user global refleje los cambios
//     await refreshSession()
//   }
//
//   return (
//     <AuthContext.Provider value={{ user, isAuthenticated: !!user, isTokenReady, refreshSession, login, logout, updateMiPerfil }}>
//       {children}
//     </AuthContext.Provider>
//   )
// }
