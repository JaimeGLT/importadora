/**
 * ImageUploader — galería de imágenes de un producto.
 *
 * Siempre en modo "diferido": el componente NO hace llamadas al backend.
 * Acumula tres piezas de estado local y las expone al padre vía `onChange`:
 *  - `pending: { file, localId }[]` → archivos a subir cuando el usuario
 *    guarde el producto (en orden de subida)
 *  - `deletedIds: number[]` → ids de imágenes existentes a eliminar al guardar
 *  - `finalOrder` → orden final de la galería visual (mezcla existentes y
 *    pendientes) para que el padre pueda armar el orden de ids final
 *    mapeando `localId` → id después del upload
 *
 * El padre (InventarioPage.handleSave) es quien decide qué hacer con esos
 * datos: subir los nuevos vía `subirLoteDiferido`, borrar los marcados vía
 * DELETE, y reordenar vía PUT /reordenar. De este modo, si el usuario
 * cierra el modal sin guardar, no queda nada en R2 ni en la DB.
 *
 * Dropzone HTML5 nativo (sin librerías), patrón copiado de
 * `pages/importaciones/FacturaExtractorPage.tsx`. Drag & drop de reorden
 * también HTML5 nativo.
 *
 * UI simplificada:
 *  - X de eliminar siempre visible en la esquina superior derecha
 *  - Badge "Pendiente" para archivos aún no subidos; cambia a "Subiendo"
 *    cuando el padre pasa `isSaving={true}`
 *  - Badge "Principal" read-only (lo pone el backend, no es un botón)
 *  - Sin botón de estrella ni de reemplazar
 */

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { ConfirmModal } from './Modal'
import type { ProductoImagen } from '@/types'

// ─── Constantes ──────────────────────────────────────────────────────────────

const MAX_MB = 10
const MAX_BYTES = MAX_MB * 1024 * 1024
const ACCEPT = 'image/*'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface PendingFile {
  /** Identificador local estable (no se persiste). */
  localId: string
  file: File
  /** URL local para preview (revocada al eliminar). */
  localUrl: string
}

export type OrderItem =
  | { type: 'existing'; id: number }
  | { type: 'pending'; localId: string }

type DisplayItem =
  | { type: 'existing'; img: ProductoImagen }
  | { type: 'pending'; pending: PendingFile }

export interface ImageUploaderState {
  /** Archivos a subir, en orden (el primero se sube primero). */
  pending: Array<{ file: File; localId: string }>
  /** Ids de imágenes existentes marcadas para eliminar al guardar. */
  deletedIds: number[]
  /**
   * Orden final de los items en la galería (mezcla existentes y pendientes).
   * El padre lo usa para construir la lista de ids final (mapeando
   * `localId` → id después del upload) y llamar a PUT /reordenar.
   */
  finalOrder: Array<OrderItem>
}

interface ImageUploaderProps {
  /** Si está definido, indica que el producto ya existe en DB. */
  productoId?: number
  /** Galería actual del producto (imágenes ya confirmadas en backend). */
  imagenes: ProductoImagen[]
  /** Llamado cuando cambia el estado local. */
  onChange?: (state: ImageUploaderState) => void
  /** `true` mientras el padre está guardando → cambia el badge a "Subiendo". */
  isSaving?: boolean
  /** Tope por producto (default 20, tomado del backend). */
  maxImagenes?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Componente principal ───────────────────────────────────────────────────

export function ImageUploader({
  productoId: _productoId,
  imagenes,
  onChange,
  isSaving = false,
  maxImagenes = 20,
}: ImageUploaderProps) {
  const [pending, setPending] = useState<PendingFile[]>([])
  const [deletedIds, setDeletedIds] = useState<number[]>([])
  const [order, setOrder] = useState<OrderItem[] | null>(null)
  const [dragging, setDragging] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; nombreArchivo: string; esPrincipal: boolean } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Cómputos derivados ────────────────────────────────────────────────

  /** Lista combinada para renderizar, respetando `order` o el default. */
  const displayList: DisplayItem[] = (() => {
    if (order === null) {
      const visibles = imagenes
        .filter((i) => !deletedIds.includes(i.id))
        .sort((a, b) => a.orden - b.orden)
      return [
        ...visibles.map<DisplayItem>((img) => ({ type: 'existing', img })),
        ...pending.map<DisplayItem>((p) => ({ type: 'pending', pending: p })),
      ]
    }
    const existingById = new Map(
      imagenes
        .filter((i) => !deletedIds.includes(i.id))
        .map((i) => [i.id, i] as const),
    )
    const pendingByLocalId = new Map(pending.map((p) => [p.localId, p] as const))
    return order
      .map<DisplayItem | null>((item) => {
        if (item.type === 'existing') {
          const img = existingById.get(item.id)
          return img ? { type: 'existing', img } : null
        }
        const p = pendingByLocalId.get(item.localId)
        return p ? { type: 'pending', pending: p } : null
      })
      .filter((x): x is DisplayItem => x !== null)
  })()

  /** `totalCount` ignorando los marcados para borrar. */
  const totalCount = displayList.length
  const canAddMore = totalCount < maxImagenes

  // ── Notificar al padre cuando cambia el estado ────────────────────────

  // Construimos el `finalOrder` (mezcla de existentes y pendientes en el
  // orden visual) y separamos `pending` (en orden de subida) y
  // `deletedIds`. El padre usa `finalOrder` para mapear localId → id
  // después de subir y armar el orden final de ids para PUT /reordenar.
  const reportedState: ImageUploaderState = (() => {
    const finalOrder: OrderItem[] = displayList.map((item) =>
      item.type === 'existing'
        ? { type: 'existing', id: item.img.id }
        : { type: 'pending', localId: item.pending.localId },
    )
    return {
      pending: pending.map((p) => ({ file: p.file, localId: p.localId })),
      deletedIds: [...deletedIds],
      finalOrder,
    }
  })()

  useEffect(() => {
    onChange?.(reportedState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportedState])

  // ── Cleanup: revocar object URLs al desmontar ─────────────────────────

  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.localUrl))
    }
    // Solo al desmontar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers: agregar archivos (dropzone + click) ────────────────────

  function validateFile(file: File): string | null {
    if (!file.type.startsWith('image/')) {
      return `"${file.name}" no es una imagen válida.`
    }
    if (file.size > MAX_BYTES) {
      return `"${file.name}" supera el límite de ${MAX_MB} MB.`
    }
    return null
  }

  function handleAdd(files: FileList | File[]) {
    const arr = Array.from(files)
    const aceptados: PendingFile[] = []
    for (const f of arr) {
      if (totalCount + aceptados.length >= maxImagenes) {
        toast.error(`Máximo ${maxImagenes} imágenes por producto.`)
        break
      }
      const err = validateFile(f)
      if (err) { toast.error(err); continue }
      aceptados.push({
        localId: makeLocalId(),
        file: f,
        localUrl: URL.createObjectURL(f),
      })
    }
    if (aceptados.length > 0) {
      setPending((p) => [...p, ...aceptados])
      // Si teníamos un `order` previo, hay que insertar los nuevos al final
      // para mantener consistencia.
      setOrder((prev) => {
        if (prev === null) return null
        const next = [...prev]
        for (const a of aceptados) {
          next.push({ type: 'pending', localId: a.localId })
        }
        return next
      })
      toast.success(
        `${aceptados.length} imagen${aceptados.length === 1 ? '' : 'es'} lista${aceptados.length === 1 ? '' : 's'} para subir`,
      )
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) handleAdd(files)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) handleAdd(files)
  }

  // ── Handlers: eliminar (marcar para borrar al guardar) ───────────────

  function requestDeleteExisting(img: ProductoImagen) {
    setConfirmDelete({
      id: img.id,
      nombreArchivo: img.nombreArchivo,
      esPrincipal: img.esPrincipal,
    })
  }

  function doDelete() {
    if (!confirmDelete) return
    const id = confirmDelete.id
    setDeletedIds((d) => (d.includes(id) ? d : [...d, id]))
    setConfirmDelete(null)
    toast.success('Imagen marcada para eliminar (se borrará al guardar)')
  }

  function removePending(localId: string) {
    const target = pending.find((p) => p.localId === localId)
    if (target) URL.revokeObjectURL(target.localUrl)
    setPending((p) => p.filter((x) => x.localId !== localId))
    setOrder((prev) => {
      if (prev === null) return null
      return prev.filter((it) => !(it.type === 'pending' && it.localId === localId))
    })
  }

  // ── Handlers: reordenar (drag & drop) ────────────────────────────────

  function handleReorderByIndex(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    // Construir `order` si todavía es null.
    const currentOrder: OrderItem[] = (() => {
      if (order !== null) return [...order]
      return [
        ...displayList
          .filter((d): d is { type: 'existing'; img: ProductoImagen } => d.type === 'existing')
          .map((d) => ({ type: 'existing' as const, id: d.img.id })),
        ...displayList
          .filter((d): d is { type: 'pending'; pending: PendingFile } => d.type === 'pending')
          .map((d) => ({ type: 'pending' as const, localId: d.pending.localId })),
      ]
    })()
    if (fromIdx < 0 || fromIdx >= currentOrder.length) return
    if (toIdx < 0 || toIdx > currentOrder.length) return
    const [moved] = currentOrder.splice(fromIdx, 1)
    currentOrder.splice(toIdx, 0, moved)
    setOrder(currentOrder)
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Galería */}
      {displayList.length > 0 && (
        <GalleryGrid
          items={displayList}
          onDeleteExisting={requestDeleteExisting}
          onRemovePending={removePending}
          onReorderByIndex={handleReorderByIndex}
          isSaving={isSaving}
        />
      )}

      {/* Dropzone */}
      <div
        onClick={() => canAddMore && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (canAddMore) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={clsx(
          'relative flex flex-col items-center justify-center gap-2',
          'border-2 border-dashed rounded-xl transition-all duration-150 min-h-[110px] py-4 px-4',
          !canAddMore
            ? 'border-[#D0CBC4] bg-[#F0EFEC] cursor-not-allowed opacity-60'
            : dragging
              ? 'border-[#780e18] bg-[#FAF5EE] cursor-copy scale-[1.005]'
              : 'border-[#D0CBC4] bg-white cursor-pointer hover:border-[#780e18]/50 hover:bg-[#FAF5EE]/40',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={onInputChange}
          disabled={!canAddMore}
        />
        <div className={clsx(
          'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
          dragging
            ? 'bg-gradient-to-br from-[#780e18] to-[#D4A333]'
            : 'bg-[#F5F0EB] border border-[#D0CBC4]',
        )}>
          <i className={clsx('ti ti-cloud-upload text-xl', dragging ? 'text-white' : 'text-[#7A7571]')} />
        </div>
        <div className="text-center">
          <p className="text-[13px] font-semibold text-[#2D2B2A]">
            {!canAddMore
              ? `Límite alcanzado (${maxImagenes} imágenes)`
              : dragging
                ? 'Suelta las imágenes aquí'
                : 'Arrastra imágenes o haz clic'}
          </p>
          <p className="text-[11px] text-[#7A7571] mt-0.5">
            Se subirán al guardar el producto · máx {MAX_MB} MB cada una
          </p>
        </div>
      </div>

      {/* Contador */}
      <div className="flex items-center justify-between text-[11px] text-[#7A7571]">
        <span>
          {totalCount} de {maxImagenes} imágenes
        </span>
        {pending.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F4ECDB] text-[#780e18] font-semibold">
            <i className="ti ti-clock text-[10px]" />
            {pending.length} pendiente{pending.length === 1 ? '' : 's'} de subir
          </span>
        )}
      </div>

      {/* Confirm de eliminación */}
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => doDelete()}
        title="Eliminar imagen"
        message={
          confirmDelete
            ? `¿Eliminar "${confirmDelete.nombreArchivo}"?${
                confirmDelete.esPrincipal
                  ? ' Al ser la principal, se promoverá la siguiente automáticamente.'
                  : ''
              } Los cambios se aplican al guardar el producto.`
            : ''
        }
      />
    </div>
  )
}

// ─── Galería (grid + drag & drop) ───────────────────────────────────────────

interface GalleryGridProps {
  items: DisplayItem[]
  onDeleteExisting: (img: ProductoImagen) => void
  onRemovePending: (localId: string) => void
  onReorderByIndex: (fromIdx: number, toIdx: number) => void
  isSaving: boolean
}

function GalleryGrid({
  items,
  onDeleteExisting,
  onRemovePending,
  onReorderByIndex,
  isSaving,
}: GalleryGridProps) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null)

  function onDragStart(e: React.DragEvent, idx: number) {
    setDraggingIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (draggingIdx === null || draggingIdx === idx) return
    setDropTargetIdx(idx)
  }

  function onDragLeave() {
    setDropTargetIdx(null)
  }

  function onDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault()
    if (draggingIdx === null || draggingIdx === dropIdx) {
      setDraggingIdx(null)
      setDropTargetIdx(null)
      return
    }
    onReorderByIndex(draggingIdx, dropIdx)
    setDraggingIdx(null)
    setDropTargetIdx(null)
  }

  function onDragEnd() {
    setDraggingIdx(null)
    setDropTargetIdx(null)
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
      {items.map((item, idx) => (
        <div
          key={
            item.type === 'existing' ? `e-${item.img.id}` : `p-${item.pending.localId}`
          }
          draggable
          onDragStart={(e) => onDragStart(e, idx)}
          onDragOver={(e) => onDragOver(e, idx)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, idx)}
          onDragEnd={onDragEnd}
          className={clsx(
            'group relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing',
            draggingIdx === idx && 'opacity-40 scale-95',
            dropTargetIdx === idx && draggingIdx !== null && draggingIdx !== idx
              ? 'border-[#780e18] ring-2 ring-[#780e18]/30 ring-offset-1'
              : item.type === 'existing' && item.img.esPrincipal
                ? 'border-[#D4A333]'
                : item.type === 'pending'
                  ? 'border-dashed border-[#D4A333]'
                  : 'border-[#E8E5E2]',
          )}
        >
          {item.type === 'existing' ? (
            <ExistingTileContent
              img={item.img}
              onDelete={() => onDeleteExisting(item.img)}
            />
          ) : (
            <PendingTileContent
              pending={item.pending}
              isSaving={isSaving}
              onRemove={() => onRemovePending(item.pending.localId)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Contenido de tile existente ─────────────────────────────────────────────

interface ExistingTileContentProps {
  img: ProductoImagen
  onDelete: () => void
}

function ExistingTileContent({ img, onDelete }: ExistingTileContentProps) {
  return (
    <>
      <img
        src={img.url}
        alt={img.nombreArchivo}
        className="w-full h-full object-cover select-none pointer-events-none"
        draggable={false}
      />
      {/* Badge "Principal" (read-only) */}
      {img.esPrincipal && (
        <div className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#D4A333] shadow-sm">
          <i className="ti ti-star-filled text-white text-[9px]" />
          <span className="text-[9px] font-bold text-white uppercase tracking-wide">Principal</span>
        </div>
      )}
      {/* X de eliminar, siempre visible */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/95 hover:bg-[#B23A2A] hover:text-white text-[#B23A2A] shadow-sm flex items-center justify-center transition-colors"
        title="Eliminar"
      >
        <i className="ti ti-x text-[14px] font-bold" />
      </button>
      <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent text-[9.5px] text-white truncate">
        {img.nombreArchivo}
      </div>
    </>
  )
}

// ─── Contenido de tile pendiente ─────────────────────────────────────────────

interface PendingTileContentProps {
  pending: PendingFile
  isSaving: boolean
  onRemove: () => void
}

function PendingTileContent({ pending, isSaving, onRemove }: PendingTileContentProps) {
  return (
    <>
      <img
        src={pending.localUrl}
        alt={pending.file.name}
        className={clsx(
          'w-full h-full object-cover select-none pointer-events-none',
          isSaving ? 'opacity-50' : 'opacity-80',
        )}
        draggable={false}
      />
      <div
        className={clsx(
          'absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full shadow-sm',
          isSaving ? 'bg-[#3F7A52]' : 'bg-[#780e18]',
        )}
      >
        {isSaving ? (
          <i className="ti ti-loader text-white text-[9px] animate-spin" />
        ) : (
          <i className="ti ti-clock text-white text-[9px]" />
        )}
        <span className="text-[9px] font-bold text-white uppercase tracking-wide">
          {isSaving ? 'Subiendo' : 'Pendiente'}
        </span>
      </div>
      <button
        onClick={onRemove}
        disabled={isSaving}
        className={clsx(
          'absolute top-1 right-1 w-7 h-7 rounded-full shadow-sm flex items-center justify-center transition-colors',
          'bg-white/95 hover:bg-[#B23A2A] hover:text-white text-[#B23A2A]',
          isSaving && 'opacity-40 cursor-not-allowed hover:bg-white/95 hover:text-[#B23A2A]',
        )}
        title={isSaving ? 'Espera a que termine de subirse' : 'Quitar'}
      >
        <i className="ti ti-x text-[14px] font-bold" />
      </button>
      <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-black/60 text-[9px] text-white truncate">
        {pending.file.name}
      </div>
    </>
  )
}
