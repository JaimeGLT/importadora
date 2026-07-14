import { useEffect, type ReactNode } from 'react'

interface DrawerWrapperProps {
  open: boolean
  onClose: () => void
  subtitle: string
  title: string
  sku?: string
  children: ReactNode
  footer: ReactNode
}

export function DrawerWrapper({ open, onClose, subtitle, title, sku, children, footer }: DrawerWrapperProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      <div
        className="fixed inset-0 z-50 transition-opacity duration-200"
        style={{
          background: 'rgba(45,43,42,0.45)',
          backdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[520px] border-l border-[#E8E5E2] z-[60] flex flex-col"
        style={{
          background: '#ffffff',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 280ms cubic-bezier(0.32, 0.72, 0.2, 1)',
          boxShadow: '-24px 0 40px -20px rgba(30,27,46,0.18)',
        }}
      >
        {/* Top accent stripe */}
        <div className="h-[3px] bg-gradient-to-r from-[#780e18] to-[#D4A333] shrink-0" />

        {/* Head */}
        <div className="px-5 sm:px-8 pt-6 pb-[22px] border-b border-[#E8E5E2] flex items-start justify-between gap-3 shrink-0 bg-[#FBFAF7]">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-[#7A7571] font-bold mb-1.5">{subtitle}</div>
            {sku && (
              <h2 className="font-mono text-[30px] sm:text-[36px] leading-[1.05] tracking-[-0.02em] m-0 mb-1 text-[#2D2B2A] font-black">{sku}</h2>
            )}
            <div className="text-[13px] font-bold text-[#4A4744]">{title}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#F0EFEC] transition-colors shrink-0 mt-1"
          >
            <i className="ti ti-x text-[20px]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 bg-[#F7F7F7]">
          {children}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-8 py-[18px] border-t border-[#E8E5E2] flex justify-end gap-2.5 shrink-0 bg-white">
          {footer}
        </div>
      </aside>
    </>
  )
}
