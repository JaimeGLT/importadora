import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useNotificacionesStore } from '@/stores/notificacionesStore'

export function NotificacionesBell() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { productosBajoStock, cargando } = useNotificacionesStore()

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    setOpen((o) => !o)
  }

  const count = productosBajoStock.length
  const preview = [...productosBajoStock]
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5)

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="w-[34px] h-[34px] flex items-center justify-center rounded-full bg-white border border-[#D8D4D0] text-[#4A4744] hover:bg-[#F7F7F7] transition-colors relative"
        title="Notificaciones"
      >
        <i className="ti ti-bell text-[15px]" />
        {count > 0 && (
          <span
            className={`absolute top-[7px] right-[7px] w-1.5 h-1.5 rounded-full bg-[#B23A2A] ${cargando ? 'animate-pulse' : ''}`}
          />
        )}
        {count === 0 && cargando && (
          <span className="absolute top-[7px] right-[7px] w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-72 rounded-xl shadow-xl border border-[#E8E5E2] bg-white overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E5E2]">
            <span className="text-sm font-semibold text-[#2D2B2A]">Stock bajo</span>
            {count > 0 && (
              <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {count} producto{count !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {count === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[#7A7571]">
              {cargando ? 'Verificando stock...' : 'Todo el inventario está OK'}
            </div>
          ) : (
            <ul className="divide-y divide-[#F2F0EE] max-h-64 overflow-y-auto">
              {preview.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-[#B23A2A]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#7A7571] truncate">
                      {p.codigo}
                    </p>
                    <p className="text-xs font-medium text-[#2D2B2A] truncate">{p.nombre}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-[#B23A2A]">{p.stock}</p>
                    <p className="text-[10px] text-[#7A7571]">mín {p.stockMinimo}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="px-4 py-2.5 border-t border-[#E8E5E2]">
            <Link
              to="/reportes/inventario"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-[#1d4ed8] hover:underline"
            >
              Ver todas en Alertas →
            </Link>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
