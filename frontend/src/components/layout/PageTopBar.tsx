import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { NotificacionesBell } from './NotificacionesBell'
import { useAuth } from '@/contexts/AuthContext'

interface PageTopBarProps {
  title: string
  section?: string
  subsection?: string
}

export function PageTopBar({ title, section = 'Operaciones', subsection }: PageTopBarProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const dateStr = useMemo(() => {
    return new Date().toLocaleDateString('es-BO', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
  }, [])

  return (
    <header className="bg-[#F7F7F7]/85 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full h-[62px] px-7 border-b border-[#E8E5E2]">
      <div className="flex items-center gap-2 text-sm text-[#7A7571]">
        <span>{section}</span>
        {subsection && (
          <>
            <span className="text-[10px] opacity-40">/</span>
            <span>{subsection}</span>
          </>
        )}
        <span className="text-[10px] opacity-40">/</span>
        <strong className="text-[#2D2B2A] font-semibold">{title}</strong>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden sm:flex bg-white px-3.5 py-1.5 rounded-lg items-center gap-2 border border-[#D8D4D0]">
          <i className="ti ti-calendar text-[#7A7571] text-[15px]" />
          <span className="text-xs text-[#4A4744]">{dateStr}</span>
        </div>

        {user?.rol === 'admin' && (
          <div className="flex items-center gap-1.5">
            <NotificacionesBell />
            <button
              onClick={() => navigate('/configuracion')}
              className="w-[34px] h-[34px] flex items-center justify-center rounded-full bg-white border border-[#D8D4D0] text-[#4A4744] hover:bg-[#F7F7F7] transition-colors"
              title="Configuración"
            >
              <i className="ti ti-settings text-[15px]" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
