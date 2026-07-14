import { useState } from 'react'
import { clsx } from 'clsx'

interface ProductThumbProps {
  src?: string | null
  nombre?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
}

/**
 * Miniatura cuadrada del producto. Si la URL falla o no hay, muestra un
 * placeholder con icono. Por defecto es clickable (botón) para abrir el
 * `GalleryViewerModal` desde listas.
 *
 * Variantes de tamaño:
 *  - sm: 28×28 (compacto, para piezas en picker / items densos)
 *  - md: 42×42 (default — mismo tamaño que InventarioPage)
 *  - lg: 56×56 (para mobile cards)
 */
export function ProductThumb({ src, nombre, size = 'md', className, onClick }: ProductThumbProps) {
  const [err, setErr] = useState(false)
  const dim = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-14 h-14' : 'w-[42px] h-[42px]'
  const iconSize = size === 'sm' ? 'text-[14px]' : size === 'lg' ? 'text-[24px]' : 'text-[18px]'

  const inner = src && !err ? (
    <img
      src={src}
      alt={nombre || 'Imagen del producto'}
      onError={() => setErr(true)}
      className={clsx(
        dim,
        'rounded-lg border border-[#E8E5E2] object-cover bg-white',
        className,
      )}
    />
  ) : (
    <div className={clsx(
      dim,
      'bg-[#F0EFEC] rounded-lg border border-[#E8E5E2] flex items-center justify-center shrink-0',
      className,
    )}>
      <i className={clsx('ti ti-photo text-[#7A7571]', iconSize)} />
    </div>
  )

  if (!onClick) return inner

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title="Ver galería"
      className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A333]/40 hover:opacity-80 transition-opacity"
    >
      {inner}
    </button>
  )
}
