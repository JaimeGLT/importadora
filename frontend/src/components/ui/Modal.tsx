import { type ReactNode, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  footer?: ReactNode
  hideCloseButton?: boolean
  disableBackdropClose?: boolean
}

const sizeCls = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, size = 'md', footer, hideCloseButton, disableBackdropClose }: ModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Garantiza que el modal abra con scroll al tope. Sin esto, el browser puede
  // preservar el scrollTop del contenedor entre mount/unmount y el usuario
  // ve el contenido a mitad de scroll en vez del primer hijo (ej. el toggle
  // Contado/Crédito en el CheckoutModal).
  useEffect(() => {
    if (!open) return
    // Doble rAF: esperar a que el browser termine de aplicar autoFocus/scroll
    // restoration, y solo después forzar scrollTop=0.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = 0
      })
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={disableBackdropClose ? undefined : onClose}
      />
      <div
        className={clsx(
          'relative z-10 w-full mx-0 sm:mx-4 bg-white rounded-t-xl sm:rounded-xl shadow-xl flex flex-col max-h-[92vh] sm:max-h-[90vh]',
          sizeCls[size],
        )}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-steel-100">
          <h2 className="text-sm sm:text-base font-semibold text-steel-900 truncate pr-2">{title}</h2>
          {!hideCloseButton && (
            <button
              onClick={onClose}
              className="text-steel-400 hover:text-steel-600 transition-colors p-1 rounded"
              aria-label="Cerrar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div ref={bodyRef} className="overflow-y-auto p-4 sm:p-6 flex-1">{children}</div>
        {footer && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-steel-100 flex flex-wrap justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  loading?: boolean
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, loading }: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Confirmar
          </Button>
        </>
      }
    >
      <p className="text-sm text-steel-600">{message}</p>
    </Modal>
  )
}
