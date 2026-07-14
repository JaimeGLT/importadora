import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { RolUsuario } from '@/types'
import { ROLE_HOME } from '@/lib/roles'

interface Props { allowedRoles: RolUsuario[] }

export function RoleGuard({ allowedRoles }: Props) {
  const { user, isTokenReady } = useAuth()
  if (!isTokenReady) return null
  if (!user || !allowedRoles.includes(user.rol)) {
    return <Navigate to={ROLE_HOME[user?.rol as RolUsuario] ?? '/dashboard'} replace />
  }
  return <Outlet />
}
