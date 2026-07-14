/**
 * Endpoints REST del módulo de Usuarios.
 * Las mutaciones en este proyecto se hacen por REST, no por GraphQL.
 * Mantener todas las rutas centralizadas aquí para no repetirlas inline.
 */

export const USUARIOS_ENDPOINTS = {
  // Listado y admin
  list: '/Usuario',
  toggle: (id: string) => `/Usuario/${id}/toggle`,
  bloquearHasta: (id: string) => `/Usuario/${id}/bloquear-hasta`,
  horario: (id: string) => `/Usuario/${id}/horario`,
  comision: (id: string) => `/Usuario/${id}/comision`,
  horarioGlobal: '/Usuario/horario-global',
  desactivarTodos: '/Usuario/desactivar-todos',
  programarBloqueo: '/Usuario/programar-bloqueo',
  delete: (id: string) => `/Usuario/${id}`,

  // Mi cuenta (cualquier usuario autenticado)
  me: '/MiCuenta/me',
  updateMiPerfil: '/MiCuenta/me',
  changeMyPassword: '/MiCuenta/me/change-password',
} as const
