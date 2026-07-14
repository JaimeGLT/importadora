import { useEffect, useMemo, useRef, useState } from 'react'
import { PageTopBar } from '@/components/layout/PageTopBar'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnMeta,
} from '@tanstack/react-table'
import { MainLayout } from '@/components/layout/MainLayout'
import { ConfirmModal, ServerPagination } from '@/components/ui'
import { ProductThumb } from '@/components/ui/ProductThumb'
import type { Producto } from '@/types'
import { notify } from '@/lib/notify'
import { ProductoModal, type PriceUpdate } from './ProductoModal'
import { ImportarExcelModal, type ImportResult } from './ImportarExcelModal'
import { EtiquetaModal } from './EtiquetaModal'
import { GalleryViewerModal } from './GalleryViewerModal'
import { useAuth } from '@/contexts/AuthContext'
import { gql } from '@/lib/graphql'
import {
  PRODUCTOS_QUERY,
  PRODUCTOS_ALL_QUERY,
  PRODUCTO_BY_ID_QUERY,
  backendToProducto,
  backendToProductoSimple,
  productoToBackend,
  productoToBackendUpdate,
  productoToBackendBulk,
  type ProductoAPI,
  type ProductoAPISimple,
  type KitOps,
} from '@/lib/queries/inventario.queries'
import { MARCAS_QUERY, backendToMarca } from '@/lib/queries/marcas.queries'
import type { Marca } from '@/types'
import { api } from '@/lib/api'
import { subirLoteDiferido, eliminarImagen, reordenarImagenes, marcarImagenPrincipal } from '@/lib/storage'
import type { ImageUploaderState } from '@/components/ui/ImageUploader'
import { clsx } from 'clsx'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'center' | 'right'
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StockBadgeMd3({ stock, stockMinimo }: { stock: number; stockMinimo: number }) {
  if (stock === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#F5C9C0] text-[#8A1E12]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B23A2A] shrink-0" />
        Sin stock
      </span>
    )
  }
  if (stock <= stockMinimo) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#F5C9C0] text-[#8A1E12]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B23A2A] shrink-0" />
        Stock bajo
      </span>
    )
  }
  if (stock <= stockMinimo * 2) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#F5E0A8] text-[#7A5200]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B47A1F] shrink-0" />
        Limitado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#B8DCCA] text-[#1E5C38]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#2A6040] shrink-0" />
      En stock
    </span>
  )
}

// ─── Product thumbnail ────────────────────────────────────────────────────────
// Reutiliza el componente compartido `@/components/ui/ProductThumb`.

// ─── Table skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="divide-y divide-[#D0CBC4]">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
          <div className="w-[42px] h-[42px] rounded-lg bg-[#F0EFEC] shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 rounded bg-[#F0EFEC]" />
            <div className="h-2.5 w-40 rounded bg-[#E8E5E2]" />
          </div>
          <div className="h-2.5 w-20 rounded bg-[#F0EFEC]" />
          <div className="h-5 w-20 rounded-full bg-[#F0EFEC]" />
          <div className="h-2.5 w-20 rounded bg-[#F0EFEC]" />
          <div className="h-2.5 w-16 rounded bg-[#E8E5E2]" />
          <div className="flex gap-1.5">
            {[0, 1, 2].map(j => <div key={j} className="h-8 w-8 rounded-[8px] bg-[#F0EFEC]" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew, searching }: { onNew: () => void; searching: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
      <div className="w-12 h-12 rounded-lg bg-white border border-[#E8E5E2] flex items-center justify-center mb-4">
        <i className="ti ti-package text-[#7A7571] text-xl" />
      </div>
      <p className="text-sm font-semibold text-[#2D2B2A] mb-1">
        {searching ? 'Sin resultados' : 'Sin productos'}
      </p>
      <p className="text-xs text-[#7A7571] font-medium max-w-xs mb-5">
        {searching
          ? 'No hay productos que coincidan con esta búsqueda.'
          : 'Agrega tu primer producto o importa desde Excel.'}
      </p>
      {!searching && (
        <button onClick={onNew}
          className="px-5 py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm">
          <i className="ti ti-plus text-base" />
          Nuevo producto
        </button>
      )}
    </div>
  )
}

// ─── Mobile product row ───────────────────────────────────────────────────────

function MobileProductRow({ p, marcaNombre, onTap, onViewGallery }: { p: Producto; marcaNombre: string; onTap: () => void; onViewGallery: () => void }) {
  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 border-b border-[#E8E5E2] last:border-0 active:bg-[#FBFAF7] transition-colors cursor-pointer',
        p.es_kit && 'border-l-[3px] border-l-[#D4A333]',
      )}
      onClick={onTap}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onViewGallery() }}
        className="shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A333]/40"
        title="Ver galería"
      >
        <ProductThumb src={p.imagen} nombre={p.nombre ?? ''} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-mono font-semibold text-[13px] text-[#2D2B2A] tracking-[0.05em] leading-tight underline decoration-[#D4A333] decoration-2 underline-offset-2">
          {p.codigo_universal}
        </div>
        {p.codigos_alternativos.filter(Boolean).map((cod, i) => (
          <div key={i} className="font-mono text-[12px] text-[#7A7571] tracking-[0.04em] leading-tight mt-0.5">
            {cod}
          </div>
        ))}
        {p.nombre?.trim() && (
          <div className="text-[11.5px] text-[#7A7571] font-medium truncate leading-tight mt-0.5">{p.nombre}</div>
        )}
        {marcaNombre && (
          <div className="text-[10.5px] text-[#7A7571] mt-0.5">{marcaNombre}</div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <StockBadgeMd3 stock={p.stock} stockMinimo={p.stock_minimo} />
        <span className="font-mono text-[12px] font-medium text-[#2D2B2A]">
          Bs. {p.precio_venta.toFixed(2)}
        </span>
      </div>
      <i className="ti ti-chevron-right text-[#7A7571] text-lg ml-1" />
    </div>
  )
}

function MobileSkeletonRows() {
  return (
    <div className="divide-y divide-[#D0CBC4]">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="w-[42px] h-[42px] rounded-lg bg-[#F0EFEC] shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 rounded bg-[#F0EFEC]" />
            <div className="h-2.5 w-36 rounded bg-[#E8E5E2]" />
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="h-5 w-16 rounded-full bg-[#F0EFEC]" />
            <div className="h-2.5 w-14 rounded bg-[#E8E5E2]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── KPI skeleton ─────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[14px] mb-[22px]">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#D0CBC4] p-[18px] animate-pulse">
          <div className="flex items-start justify-between mb-[14px]">
            <div className="w-9 h-9 rounded-lg bg-[#F0EFEC]" />
            <div className="h-5 w-20 rounded-full bg-[#E8E5E2]" />
          </div>
          <div className="h-8 w-24 rounded bg-[#F0EFEC] mb-2" />
          <div className="h-2.5 w-28 rounded bg-[#E8E5E2]" />
        </div>
      ))}
    </div>
  )
}

// ─── Column helper ────────────────────────────────────────────────────────────

const colHelper = createColumnHelper<Producto>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBs = (n: number) =>
  n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function getMarcaNombre(marcaId: number | null | undefined, marcas: Marca[]): string {
  if (!marcaId) return ''
  // Coerción defensiva: GraphQL puede traer `m.id` como string o number según
  // el canal. `Number(m.id) === marcaId` tolera ambos sin importar quién carga
  // la lista de marcas (MARCAS_QUERY, REST, etc.).
  return marcas.find((m) => Number(m.id) === marcaId)?.nombre ?? ''
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function InventarioPage() {
  const { isTokenReady } = useAuth()
  const [modalOpen, setModalOpen]               = useState(false)
  const [importOpen, setImportOpen]             = useState(false)
  const [allProductos, setAllProductos]         = useState<Producto[]>([])
  const [loadingAllProductos, setLoadingAllProductos] = useState(false)
  const [etiquetaProducto, setEtiquetaProducto] = useState<Producto | null>(null)
  const [editingProducto, setEditingProducto]   = useState<Producto | null>(null)
  const [confirmDelete, setConfirmDelete]       = useState<Producto | null>(null)
  const [deleting, setDeleting]                 = useState(false)
  const [loading, setLoading]                   = useState(true)
  const [loadingModal, setLoadingModal]         = useState(false)
  const [products, setProducts]                 = useState<Producto[]>([])
  const [marcas, setMarcas]                     = useState<Marca[]>([])
  const [totalCount, setTotalCount]             = useState(0)
  const [hasNextPage, setHasNextPage]           = useState(false)
  const [page, setPage]                         = useState(0)
  const [pageSize, setPageSize]                 = useState(25)
  const [searchTerm, setSearchTerm]             = useState('')
  const [searching, setSearching]               = useState(false)
  const cursors                                 = useRef<(string | null)[]>([null])
  const searchDebounce                          = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedMarcaId, setSelectedMarcaId] = useState<number | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [exportando, setExportando] = useState(false)
  const [galleryProducto, setGalleryProducto] = useState<Producto | null>(null)


  // ── Load products ──────────────────────────────────────────────────────────
  const loadProducts = (targetPage: number, size: number, q: string = '', marcaId: number | null = null) => {
    setLoading(true)

    if (q.trim()) {
      api.get<ProductoAPISimple[]>(`/Producto/buscar-lista?q=${encodeURIComponent(q.trim())}`)
        .then(res => {
          let resultados = (res ?? []).map(backendToProductoSimple)
          if (marcaId) resultados = resultados.filter(p => p.marcaId === marcaId)
          setProducts(resultados)
          setTotalCount(resultados.length)
          setHasNextPage(false)
        })
        .catch(() => notify.error('Error buscando productos'))
        .finally(() => { setLoading(false); setSearching(false) })
      return
    }

    const marcaWhere = marcaId ? { marcaId: { eq: marcaId } } : undefined
    gql<{
      productos: { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ProductoAPI[] }
    }>(
      PRODUCTOS_QUERY,
      { first: size, after: cursors.current[targetPage] ?? null, where: marcaWhere, order: { fechaActualizacion: 'DESC' } }
    )
      .then(res => {
        const { totalCount, pageInfo, nodes } = res.productos
        setProducts(nodes.map(backendToProductoSimple))
        setTotalCount(totalCount)
        setHasNextPage(pageInfo.hasNextPage)
        cursors.current[targetPage + 1] = pageInfo.endCursor
        setPage(targetPage)
      })
      .catch(() => notify.error('Error cargando productos'))
      .finally(() => { setLoading(false); setSearching(false) })
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setSearching(true)
      setProducts([])
      cursors.current = [null]
      loadProducts(0, pageSize, value, selectedMarcaId)
    }, 350)
  }

  const handleMarcaFilter = (marcaId: number | null) => {
    setSelectedMarcaId(marcaId)
    cursors.current = [null]
    loadProducts(0, pageSize, searchTerm, marcaId)
  }

  const handlePage = (p: number) => loadProducts(p, pageSize, searchTerm, selectedMarcaId)
  const handlePageSize = (size: number) => {
    cursors.current = [null]
    setPageSize(size)
    loadProducts(0, size, searchTerm, selectedMarcaId)
  }

  useEffect(() => {
    if (!isTokenReady) return
    gql<{ marca: { nodes: { id: number; nombre: string }[] } }>(MARCAS_QUERY)
      .then(r => setMarcas(r.marca.nodes.map(backendToMarca)))
      .catch(() => {})
  }, [isTokenReady])

  useEffect(() => {
    if (!isTokenReady) return
    loadProducts(0, pageSize, '', null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTokenReady])

  const displayProducts = products

  // ── Mutations ──────────────────────────────────────────────────────────────
  const handleEdit = (p: Producto) => {
    setEditingProducto(p)
    setLoadingModal(true)
    setModalOpen(true)
    gql<{ productos: { nodes: ProductoAPI[] } }>(PRODUCTO_BY_ID_QUERY, { id: Number(p.id) })
      .then(res => { if (res.productos?.nodes?.[0]) setEditingProducto(backendToProducto(res.productos.nodes[0])) })
      .catch(() => notify.error('Error cargando producto'))
      .finally(() => setLoadingModal(false))
  }
  const handleNew  = () => { setEditingProducto(null); setModalOpen(true) }

  const handleSave = async (
    data: Omit<Producto, 'id' | 'creado_en' | 'actualizado_en'>,
    kitOps: KitOps,
    priceUpdate: PriceUpdate | undefined,
    imageOps: ImageUploaderState,
  ) => {
    try {
      if (editingProducto) {
        const updatePayload = productoToBackendUpdate(data)
        await api.put(`/Producto/${editingProducto.id}`, updatePayload)
        if (priceUpdate) {
          await api.post(`/Producto/CambiarPrecio/${editingProducto.id}`, priceUpdate)
        }
        if (kitOps.mode === 'convertirKit') {
          await api.put(`/Producto/ConvertirKit/${editingProducto.id}`, { piezas: kitOps.piezas ?? [] })
        } else if (kitOps.mode === 'convertirRegular') {
          await api.put(`/Producto/ConvertirRegular/${editingProducto.id}`, { stockManual: kitOps.stockManual ?? null })
        } else if (kitOps.mode === 'managePieces' && kitOps.pieceOps?.length) {
          for (const op of kitOps.pieceOps) {
            if (op.type === 'add') {
              await api.post(`/Producto/${editingProducto.id}/Piezas`, { piezas: [op.data] })
            } else if (op.type === 'update') {
              await api.put(`/Producto/${editingProducto.id}/Piezas/${op.piezaId}`, op.data)
            } else if (op.type === 'delete') {
              await api.delete(`/Producto/${editingProducto.id}/Piezas/${op.piezaId}`)
            }
          }
        }

        // ── Sincronizar galería de imágenes ─────────────────────────────
        // Flujo:
        //   1) Subir las imágenes nuevas (subirLoteDiferido las crea en R2 + DB
        //      con orden = max+1, max+2, ... y devuelve los ids en el mismo
        //      orden en que estaban en `imageOps.pending`).
        //   2) Construir el mapa localId → id para poder armar el orden final.
        //   3) Borrar las imágenes existentes marcadas para eliminar.
        //   4) Reordenar con PUT /reordenar para que la galería visual (mezcla
        //      de existentes y nuevas) coincida con el `finalOrder` del uploader.
        //   5) Ajustar la "Principal" para que sea la primera del `finalOrder`
        //      (con esto cubrimos el caso de reordenar y de subir nuevos).
        const productoId = Number(editingProducto.id)
        const localIdToId: Record<string, number> = {}
        if (imageOps.pending.length > 0) {
          const { exitosas, fallidas } = await subirLoteDiferido(
            productoId,
            imageOps.pending.map((p) => p.file),
          )
          if (fallidas.length > 0) {
            notify.warning(
              `Producto actualizado, pero ${fallidas.length} de ${imageOps.pending.length} imágenes no se pudieron subir`,
              { description: fallidas.map((f) => f.archivo.name).join(', ') },
            )
          }
          exitosas.forEach((img, i) => {
            const op = imageOps.pending[i]
            if (op) localIdToId[op.localId] = img.id
          })
        }

        if (imageOps.deletedIds.length > 0) {
          // Best-effort paralelo: si una falla, las otras siguen.
          await Promise.allSettled(
            imageOps.deletedIds.map((id) => eliminarImagen(id)),
          )
        }

        // Armar el orden final mapeando localId → id. Los ids que no se
        // encuentren (p.ej. porque un pendiente falló al subir) se omiten.
        const finalIds = imageOps.finalOrder
          .map((it) => (it.type === 'existing' ? it.id : localIdToId[it.localId]))
          .filter((id): id is number => typeof id === 'number')

        const restantesActuales = (editingProducto.imagenes ?? [])
          .filter((i) => !imageOps.deletedIds.includes(i.id))
          .map((i) => i.id)
          .concat(Object.values(localIdToId))

        const ordenCambio =
          finalIds.length > 0 &&
          (finalIds.length !== restantesActuales.length ||
            finalIds.some((id, idx) => restantesActuales[idx] !== id))

        if (ordenCambio) {
          await reordenarImagenes(productoId, finalIds)
        }

        // Sincronizar "Principal" con la primera imagen del orden final.
        // El backend ya promueve automáticamente al borrar la principal, pero
        // al reordenar/subir no cambia — esto asegura que la principal visual
        // (primera del `finalOrder`) coincida con la del backend.
        if (finalIds.length > 0) {
          await marcarImagenPrincipal(productoId, finalIds[0])
        }

        loadProducts(page, pageSize, searchTerm, selectedMarcaId)
        notify.success('Producto actualizado', { description: `${data.codigo_universal || '(sin código)'} - ${data.nombre?.trim() || '(sin nombre)'}` })
      } else {
        const createPayload = productoToBackend(data)
        const res = await api.post<{ id: number }>('/Producto', createPayload)
        if (kitOps.mode === 'convertirKit' && kitOps.piezas?.length) {
          await api.put(`/Producto/ConvertirKit/${res.id}`, { piezas: kitOps.piezas })
        }
        // Si el usuario dejó imágenes pendientes en el ImageUploader, las subimos
        // ahora que ya tenemos id. Cada archivo pasa por presign + PUT a R2 +
        // confirmar; los huérfanos de R2 los limpia el R2OrphanGcService del backend.
        if (imageOps.pending.length > 0) {
          const { exitosas, fallidas } = await subirLoteDiferido(
            res.id,
            imageOps.pending.map((p) => p.file),
          )
          if (fallidas.length > 0) {
            notify.warning(
              `Producto creado, pero ${fallidas.length} de ${imageOps.pending.length} imágenes no se pudieron subir`,
              { description: fallidas.map((f) => f.archivo.name).join(', ') },
            )
          } else if (exitosas.length > 0) {
            notify.success(`${exitosas.length} imagen${exitosas.length === 1 ? '' : 'es'} subida${exitosas.length === 1 ? '' : 's'}`)
          }
        }
        cursors.current = [null]
        loadProducts(0, pageSize, searchTerm, selectedMarcaId)
        notify.success('Producto creado', { description: `${data.codigo_universal || '(sin código)'} - ${data.nombre?.trim() || '(sin nombre)'}` })
      }
      setModalOpen(false)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al guardar producto')
    }
  }

  const handleOpenImport = async () => {
    setImportOpen(true)
    setLoadingAllProductos(true)
    try {
      const data = await gql<{ productos: { nodes: Parameters<typeof backendToProductoSimple>[0][] } }>(PRODUCTOS_ALL_QUERY)
      setAllProductos(data.productos.nodes.map(backendToProductoSimple))
    } catch {
      notify.error('Error al cargar productos para importación')
    } finally {
      setLoadingAllProductos(false)
    }
  }

  const handleExportar = async () => {
    setExportando(true)
    try {
      const blob = await api.download('/Producto/exportar')
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `inventario_${new Date().toISOString().slice(0, 10)}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      notify.success('Excel exportado')
    } catch {
      notify.error('Error al exportar inventario')
    } finally {
      setExportando(false)
    }
  }

  const handleImport = async (
    results: ImportResult[],
    onProgress?: (current: number, total: number) => void,
  ) => {
    const BATCH = 100
    const productosParaEnviar = results.map((r) => productoToBackendBulk(r.data))
    const total = productosParaEnviar.length
    for (let i = 0; i < total; i += BATCH) {
      await api.post('/Producto/lista', { productos: productosParaEnviar.slice(i, i + BATCH) })
      onProgress?.(Math.min(i + BATCH, total), total)
    }
    cursors.current = [null]
    loadProducts(0, pageSize, searchTerm, selectedMarcaId)
    const creados      = results.filter((r) => r.action === 'create').length
    const actualizados = results.filter((r) => r.action === 'update').length
    const msg = creados > 0 && actualizados > 0
      ? `${creados} creados, ${actualizados} actualizados`
      : creados > 0 ? `${creados} productos creados` : `${actualizados} productos actualizados`
    notify.success(msg)
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await api.delete(`/Producto/${confirmDelete.id}`)
      setProducts((prev) => prev.filter((p) => p.id !== confirmDelete.id))
      notify.success('Producto eliminado', { description: confirmDelete.nombre })
    } catch {
      notify.error('Error al eliminar producto')
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => ({
    total:         totalCount || products.length,
    totalUnidades: products.reduce((s, p) => s + p.stock, 0),
    totalValor:    products.reduce((s, p) => s + p.precio_costo * p.stock, 0),
    stockBajo:     products.filter((p) => p.stock <= p.stock_minimo).length,
  }), [products, totalCount])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    colHelper.display({
      id: 'imagen',
      header: '',
      size: 60,
      meta: { align: 'center' },
      enableSorting: false,
      cell: (info) => {
        const p = info.row.original
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setGalleryProducto(p) }}
            className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A333]/40 hover:opacity-80 transition-opacity"
            title="Ver galería"
          >
            <ProductThumb src={p.imagen} nombre={p.nombre ?? ''} />
          </button>
        )
      },
    }),
    colHelper.accessor('nombre', {
      header: 'Código / Producto',
      size: 220,
      meta: { align: 'left' },
      cell: (info) => {
        const p = info.row.original
        const nombreDisplay = p.nombre?.trim()
        return (
          <div>
            <div className="font-mono font-semibold text-[14px] text-[#2D2B2A] tracking-[0.04em] leading-tight underline decoration-[#D4A333] decoration-2 underline-offset-2">
              {p.codigo_universal || '—'}
            </div>
            {p.codigos_alternativos.filter(Boolean).map((cod, i) => (
              <div key={i} className="font-mono text-[13px] text-[#7A7571] tracking-[0.04em] leading-tight mt-0.5">
                {cod}
              </div>
            ))}
            {nombreDisplay && (
              <div className="text-xs text-[#7A7571] font-normal truncate max-w-[180px] mt-0.5">{nombreDisplay}</div>
            )}
            {p.es_kit && (
              <span className="text-[9px] font-semibold text-[#D4A333] uppercase tracking-wider">Kit</span>
            )}
          </div>
        )
      },
    }),
    colHelper.display({
      id: 'marca',
      header: 'Marca / Ubic.',
      size: 160,
      meta: { align: 'left' },
      cell: (info) => {
        const p = info.row.original
        const nombre = getMarcaNombre(p.marcaId, marcas)
        return (
          <div>
            <div className="inline-flex items-center gap-1.5 bg-[#E8D4B8] text-[#780e18] text-xs font-semibold px-2.5 py-0.5 rounded-full mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#780e18] shrink-0" />
              {nombre || '—'}
            </div>
            <div className="text-[10px] text-[#7A7571] font-normal flex items-center gap-1">
              <i className="ti ti-map-pin text-[10px]" />
              <span>{p.almacen} {p.estante} {p.fila} {p.columna}</span>
            </div>
          </div>
        )
      },
    }),
    colHelper.accessor('stock', {
      header: 'Stock',
      size: 90,
      meta: { align: 'left' },
      cell: (info) => {
        const p = info.row.original
        const pct = Math.min(100, p.stock_minimo > 0
          ? (p.stock / (p.stock_minimo * 4)) * 100
          : p.stock > 0 ? 50 : 0)
        const isOk   = p.stock > p.stock_minimo * 2
        const isWarn = p.stock > p.stock_minimo && p.stock <= p.stock_minimo * 2
        return (
          <div>
            <div className="font-mono font-semibold text-[14px] text-[#2D2B2A] leading-none">{p.stock.toLocaleString('es-BO')}</div>
            <div className="w-[60px] h-[5px] bg-[#DDD8D3] rounded-full overflow-hidden mt-1.5">
              <div
                className={clsx(
                  'h-full rounded-full',
                  isOk ? 'bg-gradient-to-r from-[#3F7A52] to-[#6BAF80]'
                  : isWarn ? 'bg-gradient-to-r from-[#B47A1F] to-[#D4A333]'
                  : 'bg-gradient-to-r from-[#B23A2A] to-[#D45040]'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      },
    }),
    colHelper.display({
      id: 'categoria',
      header: 'Categoría',
      size: 220,
      meta: { align: 'left' },
      cell: (info) => {
        const cat = info.row.original.categoria?.trim()
        if (!cat) {
          return <span className="text-[12px] text-[#A09A95] font-normal italic">— sin categoría —</span>
        }
        const truncated = cat.length > 100 ? cat.slice(0, 100) + '...' : cat
        return (
          <span
            className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full text-[#4A4744] max-w-full whitespace-normal break-words align-top"
            title={cat}
          >
            {truncated}
          </span>
        )
      },
    }),
    
    colHelper.accessor('precio_venta', {
      header: () => (
        <span className="inline-flex items-baseline gap-1">
          <span className="text-[9px] font-normal opacity-60 normal-case">Bs.</span>
          P. Venta
        </span>
      ),
      size: 110,
      meta: { align: 'left' },
      cell: (info) => (
        <div>
          <div className="font-mono font-medium text-[13px] text-[#2D2B2A]">Bs. {info.getValue().toFixed(2)}</div>
         
        </div>
      ),
    }),
    colHelper.accessor('precio_costo', {
      header: () => (
        <span className="inline-flex items-baseline gap-1">
          <span className="text-[9px] font-normal opacity-60 normal-case">Bs.</span>
          P. Costo
        </span>
      ),
      size: 120,
      meta: { align: 'left' }
    }),
    colHelper.display({
      id: 'acciones',
      header: '',
      size: 120,
      meta: { align: 'right' },
      enableSorting: false,
      cell: (info) => {
        const p = info.row.original
        return (
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => handleEdit(p)}
              title="Editar"
              className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#E8D4B8] hover:text-[#780e18] hover:border-[#780e18] transition-all"
            >
              <i className="ti ti-edit text-[14px]" />
            </button>
            <button
              onClick={() => setEtiquetaProducto(p)}
              title="Etiqueta"
              className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#E8D4B8] hover:text-[#780e18] hover:border-[#780e18] transition-all"
            >
              <i className="ti ti-printer text-[14px]" />
            </button>
            <button
              onClick={() => setConfirmDelete(p)}
              title="Eliminar"
              className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#F5C9C0] hover:text-[#8A1E12] hover:border-[#B23A2A] transition-all"
            >
              <i className="ti ti-trash text-[14px]" />
            </button>
          </div>
        )
      },
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [marcas])

  // ── TanStack Table ─────────────────────────────────────────────────────────
  const table = useReactTable({
    data: displayProducts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="bg-[#F7F7F7] min-h-screen">

        <PageTopBar title="Inventario" />

        <div className="px-7 py-[26px] max-w-[1320px] mx-auto w-full">

          {/* ── Page Header ─────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="font-semibold text-[30px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Inventario
              </h2>
              <p className="text-[13.5px] text-[#7A7571] mt-1.5">
                Gestión de repuestos y autopartes
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
              <button
                onClick={() => void handleExportar()}
                disabled={exportando}
                className="px-[18px] py-2.5 bg-white border border-[#D8D4D0] rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium text-[#4A4744] hover:bg-[#F7F7F7] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportando
                  ? <i className="ti ti-loader-2 text-base animate-spin" />
                  : <i className="ti ti-table-export text-base" />
                }
                {exportando ? 'Exportando...' : 'Exportar'}
              </button>
              <button
                onClick={() => void handleOpenImport()}
                className="px-[18px] py-2.5 bg-white border border-[#D8D4D0] rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium text-[#4A4744] hover:bg-[#F7F7F7] transition-all"
              >
                <i className="ti ti-upload text-base" />
                Importar
              </button>
              <button
                onClick={handleNew}
                className="px-[18px] py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold active:scale-95 transition-all shadow-sm"
              >
                <i className="ti ti-plus text-base" />
                Nuevo producto
              </button>
            </div>
          </div>

          {/* ── Metrics Grid ─────────────────────────────────────────────── */}
          {loading ? <KpiSkeleton /> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[14px] mb-[22px]">

            {/* Total Productos */}
            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#780e18] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#780e18] opacity-[0.08]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#780e18] to-[#D4A333] flex items-center justify-center shrink-0">
                  <i className="ti ti-box text-white text-[16px]" />
                </div>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#B8DCCA] text-[#1E5C38]">
                  <i className="ti ti-circle-check text-[10px]" />
                  catálogo
                </span>
              </div>
              <div className="font-semibold text-[32px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {kpi.total.toLocaleString('es-BO')}
              </div>
              <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Total productos</div>
            </div>

            {/* Stock Crítico */}
            <div className={clsx(
              'rounded-xl border border-l-4 p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200',
              kpi.stockBajo > 0
                ? 'bg-[#FDF1EE] border-[#D0CBC4] border-l-[#B23A2A]'
                : 'bg-white border-[#D0CBC4] border-l-[#3F7A52]'
            )}>
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#B23A2A] opacity-[0.08]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className={clsx(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                  kpi.stockBajo > 0
                    ? 'bg-gradient-to-br from-[#B23A2A] to-[#E07060]'
                    : 'bg-gradient-to-br from-[#3F7A52] to-[#6BAF80]'
                )}>
                  <i className={clsx('text-white text-[16px]', kpi.stockBajo > 0 ? 'ti ti-alert-triangle' : 'ti ti-circle-check')} />
                </div>
                <span className={clsx(
                  'inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full',
                  kpi.stockBajo > 0 ? 'bg-[#F5C9C0] text-[#8A1E12]' : 'bg-[#B8DCCA] text-[#1E5C38]'
                )}>
                  {kpi.stockBajo > 0 ? 'Requiere acción' : 'Todo bien'}
                </span>
              </div>
              <div
                className={clsx('font-semibold text-[32px] leading-none tracking-[-0.025em]', kpi.stockBajo > 0 ? 'text-[#B23A2A]' : 'text-[#2D2B2A]')}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {kpi.stockBajo}
              </div>
              <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Stock crítico</div>
            </div>

            {/* Valor Almacén */}
            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#3F7A52] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#3F7A52] opacity-[0.08]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3F7A52] to-[#6BAF80] flex items-center justify-center shrink-0">
                  <i className="ti ti-currency-dollar text-white text-[16px]" />
                </div>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#B8DCCA] text-[#1E5C38]">
                  al costo
                </span>
              </div>
              <div
                className="font-semibold text-[26px] text-[#2D2B2A] leading-none tracking-[-0.025em] flex items-baseline gap-1"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <span className="text-[13px] font-semibold text-[#3F7A52]">Bs.</span>
                {fmtBs(kpi.totalValor)}
              </div>
              <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Valor almacén</div>
            </div>

            {/* Unidades Totales */}
            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#D4A333] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#D4A333] opacity-[0.12]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D4A333] to-[#B4881C] flex items-center justify-center shrink-0">
                  <i className="ti ti-stack text-[#2D2010] text-[16px]" />
                </div>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200]">
                  <i className="ti ti-building-warehouse text-[10px]" />
                  físico
                </span>
              </div>
              <div className="font-semibold text-[32px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {kpi.totalUnidades.toLocaleString('es-BO')}
              </div>
              <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Unidades en stock</div>
            </div>

          </div>}

          {/* ── Table Container ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-[#D0CBC4] overflow-hidden">

            {/* Toolbar */}
            <div className="px-[22px] py-[18px] border-b border-[#D0CBC4] flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-[17px] font-semibold text-[#2D2B2A] tracking-[-0.01em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Matriz de productos
                </h3>
                <span className="bg-[#F4ECDB] text-[#780e18] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {totalCount > 0 ? totalCount : displayProducts.length}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <select
                    value={selectedMarcaId ?? ''}
                    onChange={e => handleMarcaFilter(e.target.value ? Number(e.target.value) : null)}
                    className="h-[37px] appearance-none bg-[#FBFBFA] border border-[#D8D4D0] rounded-lg pl-3 pr-8 text-[13px] text-[#2D2B2A] focus:outline-none focus:border-[#780e18] transition-colors cursor-pointer"
                  >
                    <option value="">Todas las marcas</option>
                    {marcas.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                  <i className="ti ti-chevron-down text-[#7A7571] text-[12px] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {selectedMarcaId && (
                  <button
                    onClick={() => handleMarcaFilter(null)}
                    className="flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#F4ECDB] text-[#780e18] hover:bg-[#E8D4B8] transition-colors"
                  >
                    {marcas.find(m => m.id === selectedMarcaId)?.nombre}
                    <i className="ti ti-x text-[11px]" />
                  </button>
                )}
                <div className="flex items-center gap-2 bg-[#FBFBFA] border border-[#D8D4D0] rounded-lg px-3.5 w-full sm:w-auto sm:min-w-[260px] focus-within:border-[#780e18] transition-colors">
                  <i className="ti ti-search text-[#7A7571] text-[13px] shrink-0" />
                  <input
                    className="flex-1 py-2 bg-transparent text-[13px] text-[#2D2B2A] font-normal placeholder:text-[#7A7571] outline-none border-none"
                    placeholder="Buscar SKU, repuesto, marca o código de pieza (P1-…)"
                    value={searchTerm}
                    onChange={e => handleSearch(e.target.value.replace(/'/g, '-'))}
                  />
                </div>
              </div>
            </div>

            {/* Table / skeleton / empty */}
            {(loading || searching) ? (
              <>
                <div className="hidden md:block"><TableSkeleton /></div>
                <div className="md:hidden"><MobileSkeletonRows /></div>
              </>
            ) : displayProducts.length === 0 ? (
              <EmptyState onNew={handleNew} searching={!!searchTerm} />
            ) : (
              <>
                {/* ── Desktop table ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <colgroup>
                      {table.getFlatHeaders().map((h) => (
                        <col key={h.id} style={{ width: h.column.getSize() }} />
                      ))}
                    </colgroup>
                    <thead className="bg-[#F5F0EB]">
                      {table.getHeaderGroups().map((hg) => (
                        <tr key={hg.id}>
                          {hg.headers.map((header) => {
                            const canSort = header.column.getCanSort()
                            const sorted  = header.column.getIsSorted()
                            const align   = (header.column.columnDef.meta as ColumnMeta<Producto, unknown> | undefined)?.align ?? 'left'
                            return (
                              <th
                                key={header.id}
                                className={clsx(
                                  'px-4 py-[11px] text-[10.5px] font-semibold text-[#5C5654] uppercase tracking-[0.12em] select-none whitespace-nowrap border-b border-[#D0CBC4]',
                                  align === 'center' && 'text-center',
                                  align === 'right'  && 'text-right',
                                  canSort && 'cursor-pointer hover:text-[#4A4744] transition-colors',
                                )}
                                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                              >
                                <span className={clsx(
                                  'inline-flex items-center gap-1',
                                  align === 'center' && 'justify-center w-full',
                                  align === 'right'  && 'justify-end w-full',
                                )}>
                                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                  {canSort && (
                                    <i className={clsx(
                                      'text-[12px]',
                                      sorted === 'asc' ? 'ti ti-arrow-up'
                                      : sorted === 'desc' ? 'ti ti-arrow-down'
                                      : 'ti ti-selector'
                                    )} />
                                  )}
                                </span>
                              </th>
                            )
                          })}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-t border-[#E8E5E2] even:bg-white odd:bg-[#FAF5EE] hover:bg-[#F5F0EB] transition-colors"
                        >
                          {row.getVisibleCells().map((cell, cellIdx) => {
                            const align = (cell.column.columnDef.meta as ColumnMeta<Producto, unknown> | undefined)?.align ?? 'left'
                            const isKit = row.original.es_kit
                            const isLast = cellIdx === row.getVisibleCells().length - 1
                            return (
                              <td
                                key={cell.id}
                                className={clsx(
                                  'px-4 py-[14px] align-middle text-sm',
                                  cellIdx === 0 ? 'flex items-center justify-center'
                                    : (
                                      clsx(
                                        align === 'center' && 'text-center',
                                        align === 'right'  && 'text-right',
                                      )
                                    ),
                                  cellIdx === 0 && isKit && 'border-l-[3px] border-l-[#D4A333]',
                                  !isLast && 'border-r border-[#E8E5E2]',
                                )}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Mobile list ── */}
                <div className="md:hidden">
                  {table.getRowModel().rows.map(row => (
                    <MobileProductRow
                      key={row.id}
                      p={row.original}
                      marcaNombre={getMarcaNombre(row.original.marcaId, marcas)}
                      onTap={() => handleEdit(row.original)}
                      onViewGallery={() => setGalleryProducto(row.original)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Footer */}
            {!loading && (
              <div className="px-[22px] py-[14px] bg-[#F5F0EB] border-t border-[#D0CBC4]">
                <ServerPagination
                  totalCount={totalCount}
                  page={page}
                  pageSize={pageSize}
                  hasNextPage={hasNextPage}
                  loading={loading}
                  onPage={handlePage}
                  onPageSize={handlePageSize}
                />
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <EtiquetaModal
        open={!!etiquetaProducto}
        onClose={() => setEtiquetaProducto(null)}
        etiqueta={etiquetaProducto ? {
          codigo_universal: etiquetaProducto.codigo_universal,
          nombre: etiquetaProducto.nombre ?? '',
          marca: getMarcaNombre(etiquetaProducto.marcaId, marcas),
          vehiculo: etiquetaProducto.vehiculo,
          precio_venta: etiquetaProducto.precio_venta,
          unidad: etiquetaProducto.unidad,
          creado_en: etiquetaProducto.creado_en,
        } : null}
        subtitulo={etiquetaProducto?.nombre}
      />
      <ImportarExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        productosExistentes={loadingAllProductos ? products : (allProductos.length > 0 ? allProductos : products)}
        marcas={marcas}
      />
      <ProductoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProducto(null) }}
        onSave={handleSave}
        onDelete={editingProducto ? () => { setModalOpen(false); setConfirmDelete(editingProducto) } : undefined}
        producto={editingProducto}
        loading={loadingModal}
        productosExistentes={products}
        marcas={marcas}
      />
      <GalleryViewerModal
        producto={galleryProducto}
        onClose={() => setGalleryProducto(null)}
      />
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => void handleDelete()}
        title="Eliminar producto"
        message={`¿Eliminar "${confirmDelete?.nombre}"? Esta acción no se puede deshacer.`}
        loading={deleting}
      />
    </MainLayout>
  )
}
