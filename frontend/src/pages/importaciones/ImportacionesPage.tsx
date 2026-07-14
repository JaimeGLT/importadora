import { useEffect, useMemo, useState } from 'react'
import { PageTopBar } from '@/components/layout/PageTopBar'
import { useImportacionesStore } from '@/stores/importacionesStore'
import { MainLayout } from '@/components/layout/MainLayout'
import { TablePagination } from '@/components/ui'
import type { Importacion, Producto, Proveedor, ItemImportacion, Marca } from '@/types'
import { NuevaImportacionModal } from './NuevaImportacionModal'
import { NuevaImportacionLocalModal } from './NuevaImportacionLocalModal'
import { TipoImportacionModal } from './TipoImportacionModal'
import { ImportacionDetailModal } from './ImportacionDetailModal'
import { ImportProgressOverlay } from './ImportProgressOverlay'
import { notify } from '@/lib/notify'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { gql } from '@/lib/graphql'
import { IMPORTACIONES_QUERY, IMPORTACIONES_INIT_QUERY, backendToImportacion } from '@/lib/queries/importaciones.queries'
import { PRODUCTOS_QUERY, backendToProductoSimple } from '@/lib/queries/inventario.queries'
import type { ProductoAPISimple } from '@/lib/queries/inventario.queries'
import { backendToMarca } from '@/lib/queries/marcas.queries'
import { backendToProveedor } from '@/lib/queries/proveedores.queries'
import { api } from '@/lib/api'
import type { DtoImportacion, DtoImportacionRespuesta } from '@/lib/queries/importaciones.queries'
import type { MargenGananciaAPI } from '@/lib/queries/config.queries'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnMeta,
} from '@tanstack/react-table'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtUSD(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="divide-y divide-[#D0CBC4]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-32 rounded bg-[#F0EFEC]" />
            <div className="h-3 w-48 rounded bg-[#E8E5E2]" />
          </div>
          <div className="h-4 w-20 rounded bg-[#F0EFEC]" />
          <div className="h-4 w-24 rounded bg-[#F0EFEC]" />
          <div className="flex gap-1.5">
            {[0].map(j => <div key={j} className="h-8 w-8 rounded-[6px] bg-[#F0EFEC]" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-12 h-12 rounded-lg bg-white border border-[#E8E5E2] flex items-center justify-center mb-4">
        <i className="ti ti-package-import text-[#7A7571] text-xl" />
      </div>
      <p className="text-sm font-semibold text-[#2D2B2A] mb-1">Sin importaciones</p>
      <p className="text-xs text-[#7A7571] font-medium max-w-xs text-center mb-5">
        Registra tu primera importación para empezar
      </p>
      <button
        onClick={onNew}
        className="px-5 py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm"
      >
        <i className="ti ti-plus text-base" />
        Nueva importación
      </button>
    </div>
  )
}

// ─── Column helper ────────────────────────────────────────────────────────────

const colHelper = createColumnHelper<Importacion>()

// ─── Main page ────────────────────────────────────────────────────────────────

export function ImportacionesPage() {
  const { isTokenReady } = useAuth()
  const [tipoOpen, setTipoOpen] = useState(false)
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [localOpen, setLocalOpen] = useState(false)
  const [detailImport, setDetailImport] = useState<Importacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [margenGanancia, setMargenGanancia] = useState<number>(1)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)

  const { importaciones, setImportaciones } = useImportacionesStore()

  // ── Progress driver ──────────────────────────────────────────────────────
  // El POST de importación AHORA es en lotes de 100 con progreso real: cada
  // vez que un lote termina, avanzamos el contador y la UI lo refleja. No
  // necesitamos curvas asintóticas fake: el progreso sube de 100 en 100
  // (o del último múltiplo) hasta llegar a `total`. El `finishProgress`
  // simplemente pinta 100% un instante y cierra.
  const finishProgress = async (total: number, holdMs = 450) => {
    setImportProgress({ current: total, total })
    await new Promise((r) => setTimeout(r, holdMs))
    setImportProgress(null)
  }


  const loadImportaciones = () => {
    gql<{ importacion: { nodes: Parameters<typeof backendToImportacion>[0][] } }>(IMPORTACIONES_QUERY)
      .then(res => {
        const mapped = res.importacion.nodes.map(backendToImportacion)
        mapped.sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime())
        setImportaciones(mapped)
      })
      .catch(() => notify.error('Error cargando importaciones'))
  }

  const loadProductos = () => {
    gql<{ productos: { nodes: ProductoAPISimple[] } }>(PRODUCTOS_QUERY, { first: 5000, order: { fechaActualizacion: 'DESC' } })
      .then(res => setProductos(res.productos.nodes.map(backendToProductoSimple)))
      .catch(() => notify.error('Error cargando productos'))
  }

  useEffect(() => {
    if (!isTokenReady) return
    setLoading(true)
    gql<{
      importacion: { nodes: Parameters<typeof backendToImportacion>[0][] }
      proveedor: { nodes: Parameters<typeof backendToProveedor>[0][] }
      marca: { nodes: { id: number; nombre: string }[] }
      margenGanancia: MargenGananciaAPI | null
    }>(IMPORTACIONES_INIT_QUERY)
      .then(res => {
        const mapped = res.importacion.nodes.map(backendToImportacion)
        mapped.sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime())
        setImportaciones(mapped)
        setProveedores(res.proveedor.nodes.map(backendToProveedor))
        setMarcas(res.marca.nodes.map(backendToMarca))
        if (res.margenGanancia?.valor != null) setMargenGanancia(res.margenGanancia.valor)
      })
      .catch(() => notify.error('Error cargando datos'))
      .finally(() => setLoading(false))
  }, [isTokenReady])

  // Carga lazy del catálogo de productos: solo cuando se abre un modal de
  // creación por primera vez. Aperturas subsiguientes usan el cache.
  useEffect(() => {
    if (!isTokenReady) return
    if ((nuevaOpen || localOpen) && productos.length === 0) {
      loadProductos()
    }
  }, [isTokenReady, nuevaOpen, localOpen])

  const handleSaveLocal = async (
    importacion: Omit<Importacion, 'id' | 'creado_en' | 'actualizado_en'>,
    proveedorId: number,
    { categoriaMapeada }: { categoriaMapeada: boolean },
  ) => {
    const total = importacion.items.length
    setLocalOpen(false)
    setImportProgress({ current: 0, total })
    try {
      // Se envía TODO tal cual: si el usuario dejó precio o cantidad en 0,
      // el backend ahora acepta esos valores (Range(0, ...)) y se importan
      // con costo/cantidad 0. El usuario puede editarlos después.
      const costoTotal = importacion.items.reduce(
        (s: number, i: ItemImportacion) => s + i.costo_unitario_total_bs * i.cantidad, 0,
      )
      const productos = importacion.items.map(it => ({
        codigo: it.codigo_proveedor,
        codigoAux: it.codigos_adicionales[0] ?? '',
        codigoAux2: it.codigos_adicionales[1] ?? '',
        nombre: it.nombre,
        marcaId: it.marcaId ?? null,
        descripcion: it.descripcion ?? '',
        procedencia: it.procedencia ?? '',
        // categoria: se incluye solo si el usuario mapeó la columna en el Excel.
        // Si no la mapeó, omitimos la key (undefined) para no pisar la categoría
        // existente en productos que ya estaban en el inventario.
        categoria: categoriaMapeada ? (it.categoria ?? '') : undefined,
        unidad_Medida: it.unidad ?? 'unidad',
        ubicacion: it.ubicacion ?? 'Almacén Central',
        cantidad: it.cantidad,
        stock_Minimo: (it as unknown as { stock_minimo: number }).stock_minimo,
        piezas: it.piezas ?? 1,
        conversionABs: 1,
        costo: it.costo_unitario_total_bs,
        precio: it.precio_venta_final,
      }))

      // Batching 100x100: el PRIMER POST crea la Importacion (sin importacionId),
      // los siguientes mandan el importacionId que devolvió el backend y solo
      // anexan productos/detalles. Esto da progreso real (current / total) y
      // evita un solo POST gigante con 1500 productos.
      const BATCH = 100
      let importacionId: number | null = null
      let enviados = 0
      for (let i = 0; i < productos.length; i += BATCH) {
        const lote = productos.slice(i, i + BATCH)
        const payload: DtoImportacion = {
          importacionId,
          tipo: 'Local',
          id_Proveedor: proveedorId,
          fecha: new Date().toISOString(),
          conversionABs: 1,
          costoTotal,
          f_Internacional: 0,
          aduana_Arancel: 0,
          trasporte_Interno: 0,
          productos: lote,
        }
        const res = await api.post<DtoImportacionRespuesta>('/Producto/importacion', payload)
        // El primer lote devuelve el id recién creado; los siguientes lo repiten.
        if (res.importacionId != null) importacionId = res.importacionId
        enviados = Math.min(i + BATCH, productos.length)
        setImportProgress({ current: enviados, total })
      }
      await finishProgress(total)
      loadImportaciones()
      if (productos.length > 0) loadProductos()
      notify.success('Importación local registrada')
    } catch (e) {
      setImportProgress(null)
      notify.error('Error al registrar importación local')
      throw e // re-lanzar para que el modal NO muestre el éxito
    }
  }

  const handleSave = async (
    importacion: Omit<Importacion, 'id' | 'creado_en' | 'actualizado_en'>,
    proveedorId: number,
    { categoriaMapeada }: { categoriaMapeada: boolean },
  ) => {
    const total = importacion.items.length
    setNuevaOpen(false)
    setImportProgress({ current: 0, total })
    try {
      const tc = importacion.tipo_cambio
      // Se envía TODO tal cual: si el usuario dejó precio o cantidad en 0,
      // el backend ahora acepta esos valores (Range(0, ...)) y se importan
      // con costo/cantidad 0. El usuario puede editarlos después.
      const fobTotal = importacion.items.reduce(
        (s: number, i: ItemImportacion) => s + i.precio_fob_usd * i.cantidad, 0,
      )
      const productos = importacion.items.map(it => ({
        codigo: it.codigo_proveedor,
        codigoAux: it.codigos_adicionales[0] ?? '',
        codigoAux2: it.codigos_adicionales[1] ?? '',
        nombre: it.nombre,
        marcaId: it.marcaId ?? null,
        descripcion: it.descripcion ?? '',
        procedencia: it.procedencia ?? '',
        // categoria: se incluye solo si el usuario mapeó la columna en el Excel.
        // Si no la mapeó, omitimos la key (undefined) para no pisar la categoría
        // existente en productos que ya estaban en el inventario.
        categoria: categoriaMapeada ? (it.categoria ?? '') : undefined,
        unidad_Medida: it.unidad ?? 'unidad',
        ubicacion: it.ubicacion ?? 'Almacén Central',
        cantidad: it.cantidad,
        stock_Minimo: (it as unknown as { stock_minimo: number }).stock_minimo,
        piezas: it.piezas ?? 1,
        conversionABs: tc,
        costo: it.costo_unitario_total_bs,
        precio: it.precio_venta_final,
      }))

      // Batching 100x100: el PRIMER POST crea la Importacion (sin importacionId),
      // los siguientes mandan el importacionId que devolvió el backend y solo
      // anexan productos/detalles. Esto da progreso real (current / total) y
      // evita un solo POST gigante con 1500 productos.
      const BATCH = 100
      let importacionId: number | null = null
      let enviados = 0
      for (let i = 0; i < productos.length; i += BATCH) {
        const lote = productos.slice(i, i + BATCH)
        const payload: DtoImportacion = {
          importacionId,
          id_Proveedor: proveedorId,
          fecha: new Date(importacion.fecha_estimada_llegada).toISOString(),
          conversionABs: tc,
          costoTotal: fobTotal,
          f_Internacional: importacion.flete_usd,
          aduana_Arancel: importacion.aduana_bs,
          trasporte_Interno: importacion.transporte_interno_bs,
          productos: lote,
        }
        const res = await api.post<DtoImportacionRespuesta>('/Producto/importacion', payload)
        // El primer lote devuelve el id recién creado; los siguientes lo repiten.
        if (res.importacionId != null) importacionId = res.importacionId
        enviados = Math.min(i + BATCH, productos.length)
        setImportProgress({ current: enviados, total })
      }
      await finishProgress(total)
      loadImportaciones()
      if (productos.length > 0) loadProductos()
      notify.success('Importación registrada')
    } catch (e) {
      setImportProgress(null)
      notify.error('Error al registrar importación')
      throw e // re-lanzar para que el modal NO muestre el éxito
    }
  }

  const kpi = useMemo(() => ({
    total: importaciones.length,
    valorTotal: importaciones.reduce((s, i) => s + i.fob_total_usd, 0),
  }), [importaciones])

  const globalFilterFn = (row: { original: Importacion }, _columnId: string, filterValue: string): boolean => {
    const imp = row.original
    const search = filterValue.toLowerCase().trim()
    if (!search) return true
    return (
      imp.numero.toLowerCase().includes(search) ||
      imp.proveedor.toLowerCase().includes(search) ||
      imp.origen.toLowerCase().includes(search)
    )
  }

  const columns = useMemo(() => [
    colHelper.accessor('numero', {
      header: 'Importación',
      size: 220,
      meta: { align: 'left' },
      cell: (info) => {
        const imp = info.row.original
        return (
          <div>
            <div className="text-[13.5px] font-semibold text-[#2D2B2A]">{imp.numero}</div>
            <div className="text-[11px] text-[#7A7571] mt-0.5">{imp.proveedor} · {imp.origen}</div>
          </div>
        )
      },
    }),
    colHelper.accessor('fecha_creacion', {
      header: 'Fecha',
      size: 120,
      meta: { align: 'left' },
      cell: (info) => (
        <span className="text-[12.5px] text-[#5C5654] font-medium">{fmtDate(info.getValue())}</span>
      ),
    }),
    colHelper.accessor('fob_total_usd', {
      header: 'FOB Total',
      size: 110,
      meta: { align: 'left' },
      cell: (info) => (
        <div>
          <div className="font-mono font-semibold text-[13px] text-[#2D2B2A]">{fmtUSD(info.getValue())}</div>
          <div className="text-[11px] text-[#7A7571] font-medium mt-0.5">USD</div>
        </div>
      ),
    }),
    colHelper.display({
      id: 'costos',
      header: 'Costos adicionales',
      size: 180,
      meta: { align: 'left' },
      cell: (info) => {
        const imp = info.row.original
        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-[#7A7571]">Flete:</span>
              <span className="font-semibold text-[#5C5654] tabular-nums">${imp.flete_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-[#7A7571]">Aduana:</span>
              <span className="font-semibold text-[#5C5654] tabular-nums">Bs {imp.aduana_bs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-[#7A7571]">Transp.:</span>
              <span className="font-semibold text-[#5C5654] tabular-nums">Bs {imp.transporte_interno_bs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )
      },
    }),
    colHelper.accessor('tipo_cambio', {
      header: 'Tipo Cambio',
      size: 110,
      meta: { align: 'left' },
      cell: (info) => (
        <div>
          <div className="font-mono font-semibold text-[13px] text-[#2D2B2A]">Bs {info.getValue().toFixed(2)}</div>
          <div className="text-[11px] text-[#7A7571] font-medium mt-0.5">por USD</div>
        </div>
      ),
    }),
    colHelper.display({
      id: 'acciones',
      header: '',
      size: 60,
      meta: { align: 'right' },
      cell: (info) => (
        <div className="flex justify-end">
          <button
            onClick={() => setDetailImport(info.row.original)}
            title="Ver detalle"
            className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#EDE8E3] border border-[#D0CBC4] text-[#5C5654] hover:bg-[#E8D4B8] hover:text-[#780e18] hover:border-[#780e18] transition-all"
          >
            <i className="ti ti-eye text-[14px]" />
          </button>
        </div>
      ),
    }),
  ], [])

  const table = useReactTable({
    data: importaciones,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn,
    initialState: { pagination: { pageSize: 25, pageIndex: 0 } },
  })

  useEffect(() => {
    table.setPageIndex(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalFilter])

  const filteredCount = table.getFilteredRowModel().rows.length

  return (
    <MainLayout>
      <div className="bg-[#F7F7F7] min-h-screen">

        <PageTopBar title="Importaciones" />

        <div className="px-7 py-[26px] max-w-[1400px] mx-auto">

          {/* ── Page Header ─────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 bg-gradient-to-br from-[#780e18] to-[#D4A333] rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ boxShadow: '0 6px 18px rgba(120,14,24,0.22)' }}
              >
                <i className="ti ti-package-import text-2xl" />
              </div>
              <div>
                <h2
                  className="font-semibold text-[30px] text-[#2D2B2A] leading-none tracking-[-0.022em]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Importaciones
                </h2>
                <p className="text-[13.5px] text-[#7A7571] mt-1.5">
                  Control de compras y entrada de mercadería
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <button
                onClick={() => setTipoOpen(true)}
                className="px-[18px] py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold active:scale-95 transition-all shadow-sm"
              >
                <i className="ti ti-plus text-base" />
                Nueva importación
              </button>
            </div>
          </div>

          {/* ── KPI Cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px] mb-[22px]">

            {/* Total importaciones */}
            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#780e18] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#780e18] opacity-[0.08]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#780e18] to-[#D4A333] flex items-center justify-center shrink-0">
                  <i className="ti ti-package-import text-white text-[16px]" />
                </div>
                {loading
                  ? <div className="h-5 w-20 rounded-full bg-[#F0EFEC] animate-pulse" />
                  : <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F4ECDB] text-[#780e18]">
                      <i className="ti ti-circle-check text-[10px]" />
                      registradas
                    </span>
                }
              </div>
              {loading ? (
                <>
                  <div className="h-8 w-24 rounded bg-[#F0EFEC] animate-pulse" />
                  <div className="h-2.5 w-20 rounded bg-[#E8E5E2] animate-pulse mt-2" />
                </>
              ) : (
                <>
                  <div
                    className="font-semibold text-[32px] text-[#2D2B2A] leading-none tracking-[-0.025em]"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {kpi.total.toLocaleString('es-BO')}
                  </div>
                  <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Total importaciones</div>
                </>
              )}
            </div>

            {/* Valor FOB total */}
            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#3F7A52] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#3F7A52] opacity-[0.08]" />
              <div className="flex items-start justify-between mb-[14px]">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3F7A52] to-[#6BAF80] flex items-center justify-center shrink-0">
                  <i className="ti ti-currency-dollar text-white text-[16px]" />
                </div>
                {loading
                  ? <div className="h-5 w-20 rounded-full bg-[#F0EFEC] animate-pulse" />
                  : <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#B8DCCA] text-[#1E5C38]">
                      <i className="ti ti-trending-up text-[10px]" />
                      acumulado
                    </span>
                }
              </div>
              {loading ? (
                <>
                  <div className="h-8 w-24 rounded bg-[#F0EFEC] animate-pulse" />
                  <div className="h-2.5 w-20 rounded bg-[#E8E5E2] animate-pulse mt-2" />
                </>
              ) : (
                <>
                  <div
                    className="font-semibold text-[26px] text-[#2D2B2A] leading-none tracking-[-0.025em] flex items-baseline gap-1"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <span className="text-[13px] font-semibold text-[#3F7A52]">USD</span>
                    {kpi.valorTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Valor FOB total</div>
                </>
              )}
            </div>

          </div>

          {/* ── Table Container ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-[#D0CBC4] overflow-hidden">

            {/* Toolbar */}
            <div className="px-[22px] py-[18px] border-b border-[#D0CBC4] flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <h3
                  className="text-[17px] font-semibold text-[#2D2B2A] tracking-[-0.01em]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Importaciones
                </h3>
                <span className="bg-[#F4ECDB] text-[#780e18] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {globalFilter ? filteredCount : importaciones.length}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-[#FBFBFA] border border-[#D8D4D0] rounded-lg px-3.5 w-full sm:w-auto sm:min-w-[260px] focus-within:border-[#780e18] transition-colors">
                <i className="ti ti-search text-[#7A7571] text-[13px] shrink-0" />
                <input
                  className="flex-1 py-2 bg-transparent text-[13px] text-[#2D2B2A] font-normal placeholder:text-[#7A7571] outline-none border-none"
                  placeholder="Buscar número, proveedor..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Table / skeleton / empty */}
            {loading ? (
              <TableSkeleton />
            ) : importaciones.length === 0 || filteredCount === 0 ? (
              <EmptyState onNew={() => setTipoOpen(true)} />
            ) : (
              <div className="overflow-x-auto">
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
                          const align   = (header.column.columnDef.meta as ColumnMeta<Importacion, unknown> | undefined)?.align ?? 'left'
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
                                    sorted === 'asc'  ? 'ti ti-arrow-up'
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
                        className="border-t border-[#E8E5E2] hover:bg-[#FAF5EE] transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => {
                          const align = (cell.column.columnDef.meta as ColumnMeta<Importacion, unknown> | undefined)?.align ?? 'left'
                          return (
                            <td
                              key={cell.id}
                              className={clsx(
                                'px-4 py-[14px] align-middle text-sm',
                                align === 'center' && 'text-center',
                                align === 'right'  && 'text-right',
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
            )}

            {/* Footer */}
            {!loading && importaciones.length > 0 && (
              <div className="px-[22px] py-[14px] bg-[#F5F0EB] border-t border-[#D0CBC4]">
                <TablePagination table={table} totalRows={filteredCount} />
              </div>
            )}

          </div>
        </div>
      </div>

      <TipoImportacionModal
        open={tipoOpen}
        onClose={() => setTipoOpen(false)}
        onSelect={(tipo) => {
          if (tipo === 'local') setLocalOpen(true)
          else setNuevaOpen(true)
        }}
      />
      <NuevaImportacionModal
        open={nuevaOpen}
        onClose={() => setNuevaOpen(false)}
        onSave={handleSave}
        proveedores={proveedores}
        productos={productos}
        marcas={marcas}
        totalImportaciones={importaciones.length}
        margenGanancia={margenGanancia}
      />
      <NuevaImportacionLocalModal
        open={localOpen}
        onClose={() => setLocalOpen(false)}
        onSave={handleSaveLocal}
        proveedores={proveedores}
        productos={productos}
        marcas={marcas}
        totalImportaciones={importaciones.length}
        margenGanancia={margenGanancia}
      />
      <ImportacionDetailModal
        open={!!detailImport}
        onClose={() => setDetailImport(null)}
        importacion={detailImport}
        marcas={marcas}
      />
      {importProgress && (
        <ImportProgressOverlay
          current={importProgress.current}
          total={importProgress.total}
        />
      )}
    </MainLayout>
  )
}
