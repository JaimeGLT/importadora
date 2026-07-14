import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { notify } from '@/lib/notify'
import { gql } from '@/lib/graphql'
import { PRODUCTO_IMAGENES_QUERY } from '@/lib/queries/inventario.queries'
import type { Producto, ProductoImagen } from '@/types'
import { clsx } from 'clsx'

interface ProductoImagenesAPI {
  id: number
  productoId: number
  url: string
  key: string
  nombreArchivo: string
  orden: number
  esPrincipal: boolean
}

interface ProductoImagenesResponse {
  productos: {
    nodes: Array<{
      id: string
      codigo: string
      nombre: string | null
      imagenPrincipal: { id: number; url: string } | null
      imagenes: ProductoImagenesAPI[]
    }>
  }
}

interface GalleryViewerModalProps {
  producto: Producto | null
  onClose: () => void
}

/**
 * Visor de galería de imágenes de un producto. Se abre al hacer click en el
 * thumbnail de la tabla de inventario o de la fila móvil. Trae las imágenes
 * con `PRODUCTO_IMAGENES_QUERY` (liviana) en lugar de usar las que ya están en
 * `producto.imagenes` porque la lista no las hidrata.
 *
 * Navegación: flechas ← / → del teclado, o los botones laterales. La
 * posición inicial es la de la imagen marcada como `esPrincipal` (o 0).
 */
export function GalleryViewerModal({ producto, onClose }: GalleryViewerModalProps) {
  const [imagenes, setImagenes] = useState<ProductoImagen[]>([])
  const [loading, setLoading] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [erroredIds, setErroredIds] = useState<Set<number>>(new Set())

  // Reset state y fetch al abrir con un producto nuevo.
  useEffect(() => {
    if (!producto) return
    setImagenes([])
    setErroredIds(new Set())
    setLoading(true)
    gql<ProductoImagenesResponse>(PRODUCTO_IMAGENES_QUERY, { id: Number(producto.id) })
      .then((res) => {
        const node = res.productos.nodes[0]
        if (!node) {
          setImagenes([])
          setCurrentIdx(0)
          return
        }
        const ordenadas = [...node.imagenes].sort((a, b) => a.orden - b.orden)
        const mapped: ProductoImagen[] = ordenadas.map((i) => ({
          id: i.id,
          productoId: i.productoId,
          url: i.url,
          key: i.key,
          nombreArchivo: i.nombreArchivo,
          contentType: '',
          tamanoBytes: 0,
          anchoPx: null,
          altoPx: null,
          orden: i.orden,
          esPrincipal: i.esPrincipal,
          estado: 'Activa',
          fechaSubida: '',
        }))
        setImagenes(mapped)
        // Posición inicial: la principal, si existe; si no, la primera.
        const principalIdx = mapped.findIndex((m) => m.esPrincipal)
        setCurrentIdx(principalIdx >= 0 ? principalIdx : 0)
      })
      .catch(() => {
        notify.error('No se pudo cargar la galería')
        setImagenes([])
      })
      .finally(() => setLoading(false))
  }, [producto])

  // Atajos de teclado: ← / → / Esc. Esc lo cierra el Modal base, solo
  // agrego navegación.
  useEffect(() => {
    if (!producto) return
    const onKey = (e: KeyboardEvent) => {
      if (imagenes.length <= 1) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentIdx((i) => (i - 1 + imagenes.length) % imagenes.length)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setCurrentIdx((i) => (i + 1) % imagenes.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [producto, imagenes.length])

  const current = imagenes[currentIdx]
  const subtitulo = useMemo(() => {
    if (!producto) return ''
    const nombre = producto.nombre?.trim()
    return nombre ? `${producto.codigo_universal} · ${nombre}` : producto.codigo_universal
  }, [producto])

  if (!producto) return null

  return (
    <Modal
      open={!!producto}
      onClose={onClose}
      title="Galería de imágenes"
      size="2xl"
    >
      <div className="space-y-3">
        {/* Subtítulo: código + nombre */}
        <div className="text-xs text-[#7A7571] font-medium truncate">{subtitulo}</div>

        {/* Visor principal */}
        <div className="relative bg-[#1A1916] rounded-lg overflow-hidden flex items-center justify-center min-h-[320px] sm:min-h-[420px]">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-white/70 py-16">
              <i className="ti ti-loader-2 text-3xl animate-spin" />
              <span className="text-sm">Cargando galería…</span>
            </div>
          ) : !current ? (
            <div className="flex flex-col items-center gap-2 text-white/60 py-16">
              <i className="ti ti-photo-off text-4xl" />
              <span className="text-sm">Este producto no tiene imágenes</span>
            </div>
          ) : erroredIds.has(current.id) ? (
            <div className="flex flex-col items-center gap-2 text-white/60 py-16">
              <i className="ti ti-photo-off text-4xl" />
              <span className="text-sm">No se pudo cargar la imagen</span>
            </div>
          ) : (
            <img
              key={current.id}
              src={current.url}
              alt={current.nombreArchivo || 'Imagen del producto'}
              className="max-h-[60vh] sm:max-h-[520px] max-w-full object-contain"
              onError={() => setErroredIds((prev) => new Set(prev).add(current.id))}
            />
          )}

          {/* Flechas de navegación — solo si hay más de 1 imagen */}
          {imagenes.length > 1 && !loading && (
            <>
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => (i - 1 + imagenes.length) % imagenes.length)}
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-colors"
                aria-label="Anterior"
                title="Anterior (←)"
              >
                <i className="ti ti-chevron-left text-lg" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => (i + 1) % imagenes.length)}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/65 text-white flex items-center justify-center transition-colors"
                aria-label="Siguiente"
                title="Siguiente (→)"
              >
                <i className="ti ti-chevron-right text-lg" />
              </button>
            </>
          )}

          {/* Contador arriba a la derecha */}
          {!loading && imagenes.length > 0 && (
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-black/50 text-white text-xs font-mono font-semibold px-2.5 py-1 rounded-full">
              {currentIdx + 1} / {imagenes.length}
            </div>
          )}

          {/* Tag "Principal" cuando aplica */}
          {!loading && current?.esPrincipal && (
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-[#D4A333] text-[#2D2010] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full inline-flex items-center gap-1">
              <i className="ti ti-star-filled text-[11px]" />
              Principal
            </div>
          )}
        </div>

        {/* Thumbnails de la strip */}
        {!loading && imagenes.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {imagenes.map((img, idx) => {
              const isActive = idx === currentIdx
              const isErrored = erroredIds.has(img.id)
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  className={clsx(
                    'shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-all',
                    isActive ? 'border-[#D4A333] ring-2 ring-[#D4A333]/30' : 'border-[#E8E5E2] hover:border-[#7A7571]',
                  )}
                  title={img.nombreArchivo || `Imagen ${idx + 1}`}
                >
                  {isErrored ? (
                    <div className="w-full h-full bg-[#F0EFEC] flex items-center justify-center">
                      <i className="ti ti-photo-off text-[#7A7571] text-base" />
                    </div>
                  ) : (
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => setErroredIds((prev) => new Set(prev).add(img.id))}
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Hint de teclado */}
        {!loading && imagenes.length > 1 && (
          <div className="text-[11px] text-[#A09A95] text-center font-medium hidden sm:block">
            Usa <kbd className="font-mono bg-[#F0EFEC] border border-[#E8E5E2] rounded px-1.5 py-0.5 mx-0.5">←</kbd>
            <kbd className="font-mono bg-[#F0EFEC] border border-[#E8E5E2] rounded px-1.5 py-0.5 mx-0.5">→</kbd>
            para navegar · <kbd className="font-mono bg-[#F0EFEC] border border-[#E8E5E2] rounded px-1.5 py-0.5 mx-0.5">Esc</kbd> para cerrar
          </div>
        )}
      </div>
    </Modal>
  )
}
