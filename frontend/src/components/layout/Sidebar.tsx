import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'

interface NavItem {
  label: string
  to: string
  roles?: string[]
}

interface NavGroup {
  label: string
  icon: React.ReactNode
  items: NavItem[]
  roles?: string[]
}

const groups: NavGroup[] = [
  {
    label: 'Inventario',
    icon: <i className="ti ti-package text-[16px] shrink-0" />,
    items: [
      { label: 'Productos',  to: '/inventario',            roles: ['admin'] },
      { label: 'Ajustes',    to: '/inventario/ajustes',   roles: ['admin', 'almacenero', 'cajero'] },
      { label: 'Marcas',     to: '/inventario/marcas',    roles: ['admin'] },
    ],
  },
  {
    label: 'Importaciones',
    icon: <i className="ti ti-file-import text-[16px] shrink-0" />,
    items: [
      { label: 'Importaciones', to: '/importaciones',             roles: ['admin'] },
      { label: 'Proveedores',   to: '/importaciones/proveedores', roles: ['admin'] },
      { label: 'Extractor IA',  to: '/importaciones/extractor',   roles: ['admin'] },
    ],
  },
  {
    label: 'Caja',
    icon: <i className="ti ti-cash-register text-[16px] shrink-0" />,
    roles: ['admin', 'cajero'],
    items: [
      { label: 'Caja diaria', to: '/caja', roles: ['admin', 'cajero'] },
    ],
  },
  {
    label: 'Ventas',
    icon: <i className="ti ti-receipt text-[16px] shrink-0" />,
    items: [
      { label: 'Punto de Venta',     to: '/ventas/punto-de-venta',     roles: ['admin', 'cajero'] },
      { label: 'Almacén',  to: '/ventas/almacen',  roles: ['admin', 'almacenero'] },
      { label: 'Escaneo',  to: '/ventas/escaneo',  roles: ['admin', 'cajero', 'operador'] },
      { label: 'Clientes',  to: '/ventas/clientes',  roles: ['admin', 'cajero'] },
      { label: 'Créditos',  to: '/ventas/creditos',  roles: ['admin', 'cajero'] },
      { label: 'Historial', to: '/ventas/historial', roles: ['admin', 'cajero'] },
    ],
  },
  {
    label: 'Reportes',
    icon: <i className="ti ti-chart-bar text-[16px] shrink-0" />,
    roles: ['admin'],
    items: [
      { label: 'Ventas',      to: '/reportes/ventas',      roles: ['admin'] },
      { label: 'Inventario',  to: '/reportes/inventario',  roles: ['admin'] },
      { label: 'Órdenes',     to: '/reportes/ordenes',     roles: ['admin'] },
      { label: 'Comisiones',  to: '/reportes/comisiones',  roles: ['admin'] },
    ],
  },
  {
    label: 'Sistema',
    icon: <i className="ti ti-settings-2 text-[16px] shrink-0" />,
    roles: ['admin'],
    items: [
      { label: 'Configuración',    to: '/configuracion',    roles: ['admin'] },
      { label: 'Usuarios y roles', to: '/sistema/usuarios', roles: ['admin'] },
    ],
  },
]

/* Tiny SVG watermark — purely decorative */
function SidebarWatermark() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden"
         style={{ opacity: 0.03, mixBlendMode: 'screen' }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 248 900" preserveAspectRatio="xMidYMax meet"
           style={{ width: '100%', height: '100%', display: 'block' }}>
        <g fill="#FFFFFF">
          <g transform="translate(148,80) rotate(15)">
            <circle cx="50" cy="50" r="38"/>
            <rect x="47" y="0" width="6" height="14"/>
            <rect x="47" y="86" width="6" height="14"/>
            <rect x="0" y="47" width="14" height="6"/>
            <rect x="86" y="47" width="14" height="6"/>
            <rect x="20" y="9" width="6" height="14" transform="rotate(-45 23 16)"/>
            <rect x="74" y="9" width="6" height="14" transform="rotate(45 77 16)"/>
            <rect x="20" y="77" width="6" height="14" transform="rotate(45 23 84)"/>
            <rect x="74" y="77" width="6" height="14" transform="rotate(-45 77 84)"/>
            <circle cx="50" cy="50" r="20" fill="#780e18"/>
            <circle cx="50" cy="50" r="6"/>
          </g>
          <g transform="translate(14,320)">
            <circle cx="52" cy="52" r="50"/>
            <circle cx="52" cy="52" r="32" fill="#780e18"/>
            <circle cx="52" cy="52" r="9"/>
            <circle cx="52" cy="10" r="4" fill="#780e18"/>
            <circle cx="52" cy="94" r="4" fill="#780e18"/>
            <circle cx="10" cy="52" r="4" fill="#780e18"/>
            <circle cx="94" cy="52" r="4" fill="#780e18"/>
            <circle cx="80" cy="24" r="4" fill="#780e18"/>
            <circle cx="24" cy="80" r="4" fill="#780e18"/>
            <circle cx="24" cy="24" r="4" fill="#780e18"/>
            <circle cx="80" cy="80" r="4" fill="#780e18"/>
          </g>
          <g transform="translate(172,490) rotate(-20)">
            <path d="M30 2 L56 16 L56 44 L30 58 L4 44 L4 16 Z"/>
            <circle cx="30" cy="30" r="9" fill="#780e18"/>
          </g>
          <g transform="translate(28,620) rotate(10)">
            <rect x="0" y="0" width="12" height="8"/>
            <path d="M2 8 L10 8 L6 60 Z"/>
          </g>
          <g transform="translate(168,710) rotate(40)">
            <rect x="6" y="0" width="9" height="8"/>
            <rect x="1" y="8" width="18" height="6"/>
            <rect x="3" y="14" width="15" height="24"/>
            <path d="M3 38 L18 38 L16 66 L5 66 Z"/>
            <rect x="7" y="66" width="7" height="16"/>
          </g>
        </g>
      </svg>
    </div>
  )
}

/* Reusable nav label */
function NavLabel({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div
      className="text-[10px] font-medium text-[#CFA9A6] uppercase tracking-[0.14em] px-[10px]"
      style={{ paddingTop: first ? 0 : 14, paddingBottom: 8 }}
    >
      {children}
    </div>
  )
}

/* Base classes for a nav row */
const navItemBase =
  'flex items-center gap-[11px] py-[9px] px-3 rounded-lg text-[13.5px] transition-colors duration-100 cursor-pointer relative select-none'

const navItemInactive = 'text-[#CFA9A6] hover:bg-[#F4ECDB]/[0.06] hover:text-[#F4ECDB]'
const navItemActive   = 'bg-[#F4ECDB]/10 text-[#F4ECDB] font-medium'

/* Gold bar — mimics the ::before left:-14px in the HTML (nav has px-[14px]) */
function ActiveBar() {
  return (
    <span
      className="absolute top-1/2 -translate-y-1/2 bg-[#D4A333]"
      style={{ left: -14, width: 3, height: 20, borderRadius: '0 3px 3px 0' }}
    />
  )
}

interface SidebarProps {
  open: boolean
  onClose: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ open, onClose, collapsed = false }: SidebarProps) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    groups.forEach((g) => {
      if (g.items.some((i) => pathname.startsWith(i.to === '/inventario' ? '/inventario' : i.to))) {
        initial.add(g.label)
      }
    })
    return initial
  })

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  const initials = user?.nombre
    ? user.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <aside className={clsx(
      'flex flex-col w-[240px] shrink-0',
      'bg-[#780e18] text-[#F4ECDB]',
      'border-r-[3px] border-r-[#D4A333]',
      'fixed inset-y-0 left-0 z-50 h-full transition-transform duration-300 ease-in-out',
      'md:sticky md:top-0 md:translate-x-0 md:h-screen',
      open ? 'translate-x-0' : '-translate-x-full',
      collapsed && 'md:hidden',
    )}>
      <SidebarWatermark />

      <div className="flex flex-col flex-1 min-h-0 relative z-[1]">

        {/* Brand */}
        <div className="relative flex flex-col items-center px-[22px] pt-[10px] pb-[10px]">
          <button
            onClick={onClose}
            className="md:hidden absolute top-3 right-3 p-1.5 rounded-lg text-[#CFA9A6] hover:text-[#F4ECDB] hover:bg-[#F4ECDB]/10 transition-colors"
            aria-label="Cerrar menú"
          >
            <i className="ti ti-x text-[18px]" />
          </button>
          <img
            src="/logo-usa.png"
            alt="USA Autopartes"
            className="w-[140px] object-contain"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}
          />
        </div>

        {/* Gold divider */}
        <div
          className="mx-[22px]"
          style={{ height: '0.5px', background: '#D4A333', opacity: 0.55, marginBottom: 16, marginTop: 4 }}
        />

        {/* Nav — padding matches HTML: 0 14px */}
        <nav className="flex-1 flex flex-col gap-0.5 px-[14px] pb-4 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[#F4ECDB]/[0.08]">

          {user?.rol === 'admin' && <NavLabel first>Principal</NavLabel>}

          {user?.rol === 'admin' && (
            <NavLink
              to="/dashboard"
              onClick={onClose}
              className={({ isActive }) => clsx(navItemBase, isActive ? navItemActive : navItemInactive)}
            >
              {({ isActive }) => (
                <>
                  {isActive && <ActiveBar />}
                  <i className={clsx('ti ti-layout-dashboard text-[16px] shrink-0', isActive ? 'text-[#D4A333]' : 'text-[#CFA9A6]')} />
                  <span>Dashboard</span>
                </>
              )}
            </NavLink>
          )}

          <NavLabel>Operaciones</NavLabel>

          {groups.slice(0, 4).map((group) => {
            const visibleItems = group.items.filter(i => !i.roles || !user || i.roles.includes(user.rol))
            if (visibleItems.length === 0) return null
            const groupActive = visibleItems.some((i) => pathname === i.to || pathname.startsWith(i.to + '/'))
            const isExpanded = expandedGroups.has(group.label)

            if (visibleItems.length === 1) {
              const item = visibleItems[0]
              return (
                <NavLink
                  key={group.label}
                  to={item.to}
                  end={item.to === '/inventario' || item.to === '/caja'}
                  onClick={onClose}
                  className={({ isActive }) => clsx(navItemBase, isActive ? navItemActive : navItemInactive)}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <ActiveBar />}
                      <span className={clsx('shrink-0', isActive ? 'text-[#D4A333]' : 'text-[#CFA9A6]')}>
                        {group.icon}
                      </span>
                      <span>{group.label}</span>
                    </>
                  )}
                </NavLink>
              )
            }

            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={clsx(
                    navItemBase, 'w-full text-left',
                    groupActive && !isExpanded ? navItemActive : navItemInactive,
                  )}
                >
                  {groupActive && !isExpanded && <ActiveBar />}
                  <span className={clsx('shrink-0', groupActive && !isExpanded ? 'text-[#D4A333]' : 'text-[#CFA9A6]')}>
                    {group.icon}
                  </span>
                  <span className="flex-1">{group.label}</span>
                  <i className={clsx(
                    'ti ti-chevron-down text-[15px] shrink-0 opacity-50 transition-transform duration-200',
                    isExpanded && 'rotate-180',
                  )} />
                </button>

                <div className={clsx(
                  'overflow-hidden transition-all duration-200 ease-in-out',
                  isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
                )}>
                  <div className="ml-[27px] flex flex-col mt-0.5">
                    {visibleItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end
                        onClick={onClose}
                        className={({ isActive }) =>
                          clsx(
                            'py-[7px] text-[13px] transition-colors',
                            isActive ? 'text-[#D4A333] font-medium' : 'text-[#CFA9A6] hover:text-[#F4ECDB]',
                          )
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          {groups.slice(4).some(g => g.items.some(i => !i.roles || !user || i.roles.includes(user.rol))) && <NavLabel>General</NavLabel>}

          {groups.slice(4).map((group) => {
            const visibleItems = group.items.filter(i => !i.roles || !user || i.roles.includes(user.rol))
            if (visibleItems.length === 0) return null
            const groupActive = visibleItems.some((i) => pathname === i.to || pathname.startsWith(i.to + '/'))
            const isExpanded = expandedGroups.has(group.label)

            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={clsx(
                    navItemBase, 'w-full text-left',
                    groupActive && !isExpanded ? navItemActive : navItemInactive,
                  )}
                >
                  {groupActive && !isExpanded && <ActiveBar />}
                  <span className={clsx('shrink-0', groupActive && !isExpanded ? 'text-[#D4A333]' : 'text-[#CFA9A6]')}>
                    {group.icon}
                  </span>
                  <span className="flex-1">{group.label}</span>
                  <i className={clsx(
                    'ti ti-chevron-down text-[15px] shrink-0 opacity-50 transition-transform duration-200',
                    isExpanded && 'rotate-180',
                  )} />
                </button>

                <div className={clsx(
                  'overflow-hidden transition-all duration-200 ease-in-out',
                  isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
                )}>
                  <div className="ml-[27px] flex flex-col mt-0.5">
                    {visibleItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end
                        onClick={onClose}
                        className={({ isActive }) =>
                          clsx(
                            'py-[7px] text-[13px] transition-colors',
                            isActive ? 'text-[#D4A333] font-medium' : 'text-[#CFA9A6] hover:text-[#F4ECDB]',
                          )
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Mi cuenta — visible para todos los roles autenticados */}
          <NavLabel>Cuenta</NavLabel>
          <NavLink
            to="/mi-cuenta"
            onClick={onClose}
            className={({ isActive }) => clsx(navItemBase, isActive ? navItemActive : navItemInactive)}
          >
            {({ isActive }) => (
              <>
                {isActive && <ActiveBar />}
                <i className={clsx('ti ti-user-circle text-[16px] shrink-0', isActive ? 'text-[#D4A333]' : 'text-[#CFA9A6]')} />
                <span>Mi cuenta</span>
              </>
            )}
          </NavLink>


        </nav>

        {/* User footer — .me from HTML: margin auto 14px 18px */}
        <div
          className="flex items-center gap-[10px] rounded-[10px] p-3 mx-[14px] mb-[18px]"
          style={{
            background: 'rgba(244,236,219,0.05)',
            border: '0.5px solid rgba(244,236,219,0.10)',
          }}
        >
          <div
            onClick={() => { onClose(); navigate('/mi-cuenta') }}
            className="flex items-center gap-[10px] flex-1 min-w-0 cursor-pointer rounded-md -m-1 p-1 hover:bg-[#F4ECDB]/[0.08] transition-colors"
            title="Mi cuenta"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#F4ECDB] font-semibold text-[12px] shrink-0"
              style={{ background: 'linear-gradient(135deg, #D4A333 0%, #8C5A12 100%)' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-[#F4ECDB] truncate leading-tight">
                {user?.nombre ?? '—'}
              </div>
              <div className="text-[11px] text-[#CFA9A6] capitalize truncate mt-px">
                {user?.rol ?? ''}
              </div>
            </div>
          </div>
          <div
            onClick={() => { void logout().then(() => navigate('/login')) }}
            className="p-[5px] rounded-md text-[#CFA9A6] hover:bg-[#F4ECDB]/[0.08] hover:text-[#F4ECDB] cursor-pointer transition-colors"
            title="Cerrar sesión"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
        </div>

      </div>
    </aside>
  )
}
