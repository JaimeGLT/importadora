import { Modal, Button } from '@/components/ui'

interface TipoCambioModalProps {
  open: boolean
  tipoCambio: number
  onAccept: () => void
  onReject: () => void
}

export function TipoCambioModal({ open, tipoCambio, onAccept, onReject }: TipoCambioModalProps) {
  const fechaHoy = new Date().toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Modal open={open} onClose={() => {}} title="Tipo de Cambio del Día" size="sm" hideCloseButton>
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-steel-50 border border-steel-100">
          <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
            <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-steel-700">Precio del dólar</p>
            <p className="text-xs text-steel-500">{fechaHoy}</p>
          </div>
        </div>

        <div className="text-center py-3">
          <p className="text-[11px] font-bold text-steel-400 uppercase tracking-widest mb-2">
            El precio del dólar es
          </p>
          <p className="text-4xl font-black text-steel-900">
            Bs {tipoCambio.toFixed(2)}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onReject}
            className="flex-1 justify-center"
          >
            No utilizar el precio
          </Button>
          <Button onClick={onAccept} className="flex-1 justify-center">
            Utilizar el precio
          </Button>
        </div>
      </div>
    </Modal>
  )
}