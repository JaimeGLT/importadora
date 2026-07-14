import type { RolUsuario } from '@/types'

export const ROLE_HOME: Record<RolUsuario, string> = {
  admin:      '/inventario',
  cajero:     '/ventas/punto-de-venta',
  almacenero: '/ventas/almacen',
  operador:   '/ventas/escaneo',
}
