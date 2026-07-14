import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from './Sidebar'
import { api } from '@/lib/api'
import { useConfigStore } from '@/stores/configStore'
import { TipoCambioModal } from '@/components/ui/TipoCambioModal'

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated, isTokenReady, user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showTipoCambioModal, setShowTipoCambioModal] = useState(false)
  const [tipoCambioApi, setTipoCambioApi] = useState(0)
  const {
    setTipoCambio, setTipoCambioHabilitado,
    tipoCambioFechaRecordatorio, setTipoCambioFechaRecordatorio,
  } = useConfigStore()

  useEffect(() => {
    if (!isTokenReady || !isAuthenticated) return
    if (user?.rol === 'admin') {
      const today = new Date().toISOString().split('T')[0]
      if (tipoCambioFechaRecordatorio !== today) {
        fetch('https://bo.dolarapi.com/v1/dolares/binance')
          .then(r => r.json())
          .then((d: { venta?: number }) => {
            setTipoCambioApi(d.venta ?? 0)
            setShowTipoCambioModal(true)
          })
          .catch(() => {})
      }
    }
  }, [isTokenReady, isAuthenticated, user, tipoCambioFechaRecordatorio])

  const handleTipoCambioAccept = async () => {
    setTipoCambio(tipoCambioApi)
    setTipoCambioHabilitado(true)
    setTipoCambioFechaRecordatorio(new Date().toISOString().split('T')[0])
    setShowTipoCambioModal(false)
    try {
      await api.post('/TipoCambio', { precioDolar: tipoCambioApi })
    } catch {
      // non-blocking — store already updated
    }
  }

  const handleTipoCambioReject = () => {
    setTipoCambioHabilitado(false)
    setTipoCambioFechaRecordatorio(new Date().toISOString().split('T')[0])
    setShowTipoCambioModal(false)
  }

  if (!isTokenReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9]">
        <div className="h-8 w-8 rounded-full border-2 border-[#e2e8f0] border-t-[#1d4ed8] animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
    <TipoCambioModal
      open={showTipoCambioModal}
      tipoCambio={tipoCambioApi}
      onAccept={handleTipoCambioAccept}
      onReject={handleTipoCambioReject}
    />
    <div className="flex min-h-screen bg-[#f1f5f9]">

      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-ink/35 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />

      {/* Sidebar collapse tab — desktop only, always visible, slides with sidebar */}
      <button
        onClick={() => setSidebarCollapsed(c => !c)}
        className="hidden md:flex fixed top-[22px] z-50 items-center justify-center w-5 h-10 bg-[#780e18] border border-[#D4A333] border-l-0 rounded-r-lg hover:bg-[#8a1019] transition-all duration-300 shadow-md"
        style={{ left: sidebarCollapsed ? 0 : 237 }}
        title={sidebarCollapsed ? 'Abrir menú' : 'Ocultar menú'}
      >
        <i
          className={`ti text-[14px] bg-gradient-to-r from-[#D4A333] via-[#F4ECDB] to-[#D4A333] bg-clip-text text-transparent animate-gradient-shift transition-transform duration-300 ${sidebarCollapsed ? 'ti-chevron-right' : 'ti-chevron-left'}`}
          style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        />
      </button>

      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar mobile */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-[#f1f5f9] border-b border-[#e2e8f0] shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-[#5a5670] hover:text-[#1e1b2e] hover:bg-white transition-colors"
            aria-label="Abrir menú"
          >
            <i className="ti ti-menu-2 text-[22px]" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#0284c7] to-[#1d4ed8] flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-black tracking-wider">USA</span>
            </div>
            <span className="text-sm font-bold text-[#1e1b2e]">USA Autopartes</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
    </>
  )
}

interface PageContainerProps {
  children: ReactNode
}

export function PageContainer({ children }: PageContainerProps) {
  return <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">{children}</div>
}

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 gap-3">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">{actions}</div>
      )}
    </div>
  )
}
