import { clsx } from 'clsx'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (tipo: 'local' | 'internacional') => void
}

export function TipoImportacionModal({ open, onClose, onSelect }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-[#7A7571] hover:bg-[#F0EFEC] transition-colors"
        >
          <i className="ti ti-x text-[15px]" />
        </button>

        <div className="mb-5">
          <h2 className="text-[18px] font-semibold text-[#2D2B2A] tracking-tight">Nueva importación</h2>
          <p className="text-[13px] text-[#7A7571] mt-1">¿Qué tipo de compra vas a registrar?</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TipoCard
            icon="ti-world"
            titulo="Internacional"
            descripcion="Compra al exterior con flete, aduana y tipo de cambio"
            color="#780e18"
            bgColor="#FFF1F0"
            borderColor="#F8C5C0"
            onClick={() => { onSelect('internacional'); onClose() }}
          />
          <TipoCard
            icon="ti-map-pin"
            titulo="Local"
            descripcion="Compra nacional, precio en bolivianos"
            color="#3F7A52"
            bgColor="#F0FAF4"
            borderColor="#BBF7D0"
            onClick={() => { onSelect('local'); onClose() }}
          />
        </div>
      </div>
    </div>
  )
}

function TipoCard({
  icon, titulo, descripcion, color, bgColor, borderColor, onClick,
}: {
  icon: string
  titulo: string
  descripcion: string
  color: string
  bgColor: string
  borderColor: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150',
        'hover:scale-[1.02] hover:shadow-md active:scale-[0.98]',
      )}
      style={{ borderColor, background: bgColor }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: color + '18', border: `1px solid ${color}30` }}
      >
        <i className={clsx('ti text-xl', icon)} style={{ color }} />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-[#2D2B2A]">{titulo}</p>
        <p className="text-[11.5px] text-[#7A7571] mt-0.5 leading-snug">{descripcion}</p>
      </div>
    </button>
  )
}
