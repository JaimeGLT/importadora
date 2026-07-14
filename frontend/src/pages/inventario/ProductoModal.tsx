import { useEffect, useState } from 'react'
import { Button, WarmInput, DrawerWrapper, FormSection, ImageUploader } from '@/components/ui'
import type { ImageUploaderState } from '@/components/ui/ImageUploader'
import { BrandSelect } from '@/components/ui/BrandSelect'
import type { Producto, ProductoImagen, HistorialPrecio } from '@/types'
import type { DtoPiezaKit, KitOps, PieceOp } from '@/lib/queries/inventario.queries'
import { KitPartsSection } from './KitPartsSection'
import type { DisplayPart } from './KitPartsSection'
import { EtiquetaModal } from './EtiquetaModal'
import type { LabelData } from '@/lib/printLabel'
import { notify } from '@/lib/notify'

export interface PriceUpdate {
  costo: number | null
  precio: number | null
  conversionABs: number | null
  nota: string
}

interface ProductoModalProps {
  open: boolean
  onClose: () => void
  /**
   * Al guardar, se llama con los datos del form + operaciones de imagen
   * diferidas (archivos nuevos a subir, ids existentes a eliminar, orden
   * final de la galería). El padre (InventarioPage) orquesta: subir vía
   * `subirLoteDiferido`, borrar vía DELETE, reordenar vía PUT /reordenar.
   * De este modo, si el usuario cierra el modal sin guardar, no queda
   * nada en R2 ni en la DB.
   */
  onSave: (
    data: Omit<Producto, 'id' | 'creado_en' | 'actualizado_en'>,
    kitOps: KitOps,
    priceUpdate: PriceUpdate | undefined,
    imageOps: ImageUploaderState,
  ) => Promise<void>
  onDelete?: () => void
  producto: Producto | null
  loading?: boolean
  productosExistentes?: Producto[]
  marcas?: import('@/types').Marca[]
}

type FormData = Omit<Producto, 'id' | 'creado_en' | 'actualizado_en'>

const EMPTY: FormData = {
  codigo_universal: '',
  codigos_alternativos: ['', ''],
  nombre: '',
  descripcion: '',
  procedencia: '',
  categoria: '',
  marcaId: null,
  vehiculo: '',
  unidad: 'pieza',
  stock: 0,
  stock_minimo: 5,
  piezas: 1,
  precio_costo: 0,
  precio_venta: 0,
  conversionABs: 6.96,
  historial_precios: [],
  almacen: 'Almacén Central',
  estante: '',
  fila: '',
  columna: '',
  estado: 'activo',
  proveedor_id: '',
  es_kit: false,
  kit_id: null,
  cantidad_por_kit: 1,
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonField({ labelWidth = 24 }: { labelWidth?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-2.5 rounded bg-[#F0EFEC] animate-pulse" style={{ width: `${labelWidth}%` }} />
      <div className="h-[42px] w-full rounded-xl bg-[#F0EFEC] animate-pulse" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProductoModal({
  open, onClose, onSave, onDelete, producto, loading, productosExistentes = [], marcas,
}: ProductoModalProps) {
  const [form, setForm]       = useState<FormData>(EMPTY)
  const [tipoCambio, setTipoCambio] = useState('6.96')
  const [errors, setErrors]   = useState<Partial<Record<keyof FormData | 'tipo_cambio' | 'kit_piezas', string>>>({})
  const [saving, setSaving]   = useState(false)
  const [historialOpen, setHistorialOpen] = useState(false)
  const [actualizarPrecio, setActualizarPrecio] = useState(false)
  const [nuevoCosto, setNuevoCosto] = useState('')
  const [nuevoVenta, setNuevoVenta] = useState('')
  const [nuevoTipoCambio, setNuevoTipoCambio] = useState('')
  const [nuevoNota, setNuevoNota] = useState('')
  // Kit state
  const [kitPieces, setKitPieces] = useState<DtoPiezaKit[]>([])
  const [pieceOps, setPieceOps]   = useState<PieceOp[]>([])
  const [stockManual, setStockManual] = useState('')
  const [etiquetaPieza, setEtiquetaPieza] = useState<{ etiqueta: LabelData; subtitulo?: string } | null>(null)
  // Galería de imágenes (sincronizada desde producto al abrir).
  // NOTA: el ImageUploader ya NO muta esta lista — gestiona su propio
  // estado interno (pendientes, borrados, orden) y lo reporta vía
  // `onChange`. La usamos solo para inicializar la galería visual al abrir.
  const [imagenes, setImagenes] = useState<ProductoImagen[]>([])
  // Estado reportado por ImageUploader (pending + deletedIds + finalOrder).
  const [imageOps, setImageOps] = useState<ImageUploaderState>({
    pending: [],
    deletedIds: [],
    finalOrder: [],
  })

  const isLoading = loading && producto !== null

  useEffect(() => {
    if (!open) return
    const tc = producto?.conversionABs ?? 6.96
    if (producto) {
      setForm({
        codigo_universal:     producto.codigo_universal,
        codigos_alternativos: [...producto.codigos_alternativos, '', ''].slice(0, 2),
        nombre:               producto.nombre,
        descripcion:          producto.descripcion,
        procedencia:          producto.procedencia ?? '',
        categoria:            producto.categoria ?? '',
        marcaId:              producto.marcaId ?? null,
        vehiculo:             producto.vehiculo,
        unidad:               producto.unidad,
        stock:                producto.stock,
        stock_minimo:         producto.stock_minimo,
        piezas:               producto.piezas ?? 1,
        precio_costo:         producto.precio_costo,
        precio_venta:         producto.precio_venta,
        conversionABs:        tc,
        historial_precios:    producto.historial_precios,
        almacen: [producto.almacen, producto.estante, producto.fila, producto.columna].filter(Boolean).join(' / '),
        estante: '',
        fila: '',
        columna: '',
        estado:               producto.estado,
        proveedor_id:         producto.proveedor_id,
        es_kit:               producto.es_kit ?? false,
        kit_id:               producto.kit_id ?? null,
        cantidad_por_kit:     producto.cantidad_por_kit ?? 1,
      })
      setTipoCambio(String(tc))
    } else {
      setForm(EMPTY)
      setTipoCambio('6.96')
    }
    setErrors({})
    setHistorialOpen(false)
    setActualizarPrecio(false)
    setNuevoCosto('')
    setNuevoVenta('')
    setNuevoTipoCambio('')
    setNuevoNota('')
    setKitPieces([])
    setPieceOps([])
    setStockManual('')
    setImagenes(producto?.imagenes ?? [])
    setImageOps({ pending: [], deletedIds: [], finalOrder: [] })
  }, [open, producto])

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const setAltCode = (idx: 0 | 1, value: string) => {
    const next = [...form.codigos_alternativos] as [string, string]
    next[idx] = value
    set('codigos_alternativos', next)
  }

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.codigo_universal.trim()) {
      e.codigo_universal = 'El código universal es obligatorio'
    } else if (form.codigo_universal.trim().length < 3) {
      e.codigo_universal = 'El código debe tener al menos 3 caracteres'
    }
    if (!producto && form.precio_costo <= 0) {
      e.precio_costo = 'El precio costo debe ser mayor a 0'
    }
    const isConvertingToKit = form.es_kit && !(producto?.es_kit ?? false)
    if (isConvertingToKit && kitPieces.length === 0) {
      e.kit_piezas = 'Debes agregar al menos una pieza al kit'
      notify.error('Debes agregar al menos una pieza al kit')
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const buildHistorial = (): HistorialPrecio[] => {
    const tc = parseFloat(tipoCambio) || 6.96
    if (actualizarPrecio && (nuevoCosto || nuevoVenta || nuevoTipoCambio)) {
      const nuevoTc = parseFloat(nuevoTipoCambio) || form.conversionABs || tc
      return [
        ...form.historial_precios,
        {
          fecha: new Date().toISOString(),
          precio_costo: parseFloat(nuevoCosto) || form.precio_costo,
          precio_venta: parseFloat(nuevoVenta) || form.precio_venta,
          tipo_cambio: nuevoTc,
          nota: nuevoNota || undefined,
        },
      ]
    }
    return form.historial_precios
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const wasKit = producto?.es_kit ?? false
      const isKit  = form.es_kit

      let kitOps: KitOps = { mode: 'none' }
      if (!producto && isKit) {
        kitOps = { mode: 'convertirKit', piezas: kitPieces }
      } else if (producto && !wasKit && isKit) {
        kitOps = { mode: 'convertirKit', piezas: kitPieces }
      } else if (producto && wasKit && !isKit) {
        kitOps = { mode: 'convertirRegular', stockManual: stockManual ? parseInt(stockManual) : null }
      } else if (producto && wasKit && isKit && pieceOps.length > 0) {
        kitOps = { mode: 'managePieces', pieceOps }
      }

      console.log('[Modal.handleSave] producto_id=%s wasKit=%s isKit=%s pieceOps=%d kitOps_mode=%s',
        producto?.id, wasKit, isKit, pieceOps.length, kitOps.mode)
      if (kitOps.mode === 'convertirKit')
        console.log('[Modal.handleSave] convertirKit piezas:', kitPieces)
      if (kitOps.mode === 'managePieces')
        console.log('[Modal.handleSave] managePieces ops:', JSON.stringify(pieceOps))

      const dataToSave = { ...form, historial_precios: buildHistorial() }

      const hasAnyPrice = nuevoCosto || nuevoVenta || nuevoTipoCambio
      const priceUpdate: PriceUpdate | undefined = actualizarPrecio && hasAnyPrice
        ? {
            costo:         parseFloat(nuevoCosto)     || null,
            precio:        parseFloat(nuevoVenta)      || null,
            conversionABs: parseFloat(nuevoTipoCambio) || null,
            nota:          nuevoNota,
          }
        : undefined

      await onSave(dataToSave, kitOps, priceUpdate, imageOps)
    } finally {
      setSaving(false)
    }
  }

  const margen =
    form.precio_costo > 0 && form.precio_venta > 0
      ? (((form.precio_venta - form.precio_costo) / form.precio_costo) * 100).toFixed(1)
      : null

  const ganancia =
    form.precio_venta > 0 && form.precio_costo > 0
      ? (form.precio_venta - form.precio_costo).toFixed(2)
      : null

  // Código del kit (en edición viene del producto cargado; al crear un kit
  // nuevo se toma del form). Se pasa a KitPartsSection para previsualizar el
  // código autogenerado de la próxima pieza. Ya no incluye el prefijo de marca.
  const kitCodigoActual = producto?.codigo_universal ?? form.codigo_universal

  const handleImprimirPieza = (part: DisplayPart) => {
    if (!part.codigoPieza) return
    const marcaId = producto?.marcaId ?? form.marcaId
    const marca = marcaId != null ? marcas?.find((m) => m.id === marcaId) : null
    setEtiquetaPieza({
      etiqueta: {
        codigo_universal: part.codigoPieza,
        nombre: part.nombre,
        marca: marca?.nombre ?? '',
        vehiculo: '',
        precio_venta: form.precio_venta,
        unidad: 'pieza',
        creado_en: new Date().toISOString(),
      },
      subtitulo: `${part.nombre} · de ${form.nombre?.trim() || producto?.nombre?.trim() || '(sin nombre)'}`,
    })
  }

  return (
    <>
    <DrawerWrapper
      open={open}
      onClose={onClose}
      subtitle={producto ? 'Detalle del producto' : 'Nuevo producto'}
      title={producto ? (producto.nombre?.trim() || '(sin nombre)') : 'Registrar autoparte'}
      sku={producto?.codigo_universal}
      footer={
        <>
          {producto && onDelete && (
            <button
              onClick={onDelete} disabled={saving}
              className="h-[42px] w-[42px] flex items-center justify-center rounded-xl border border-[#E8E5E2] text-[#7A7571] bg-white hover:bg-[#F5C9C0] hover:text-[#B23A2A] hover:border-[#B23A2A] transition-all mr-auto disabled:opacity-40"
              title="Eliminar producto"
            >
              <i className="ti ti-trash text-[20px]" />
            </button>
          )}
          <Button variant="secondary"
            className="h-[42px] px-5 rounded-xl !border-[#E8E5E2] !text-[#4A4744] !bg-white hover:!bg-[#F0EFEC] !text-[13.5px] !font-semibold"
            onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            className="h-[42px] px-5 rounded-xl !bg-[#D4A333] hover:!bg-[#B4881C] !text-[#2D2010] !text-[13.5px] !font-bold shadow-sm"
            onClick={() => void handleSave()} loading={saving}>
            {producto ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SkeletonField labelWidth={30} />
            <SkeletonField labelWidth={50} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SkeletonField labelWidth={45} />
            <SkeletonField labelWidth={60} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SkeletonField labelWidth={20} />
            <SkeletonField labelWidth={35} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SkeletonField labelWidth={50} />
            <SkeletonField labelWidth={70} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SkeletonField labelWidth={40} />
            <SkeletonField labelWidth={35} />
            <SkeletonField labelWidth={50} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Identificación */}
          <FormSection icon={<IconBarcode />} title="Identificación" description="Códigos únicos que identifican el producto" iconClass="bg-[#780e18] text-white shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <WarmInput
                label="Código universal *"
                value={form.codigo_universal}
                onChange={(e) => set('codigo_universal', e.target.value)}
                error={errors.codigo_universal}
                placeholder="MOT-0011"
                hint="Código principal — usado en búsquedas y etiquetas"
              />
              <WarmInput
                label="Nombre del producto (opcional)"
                value={form.nombre ?? ''}
                onChange={(e) => set('nombre', e.target.value)}
                error={errors.nombre}
                placeholder="Filtro de aceite Toyota"
                hint="Opcional — el código universal es el identificador principal"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <WarmInput
                label="Código alternativo 1"
                value={form.codigos_alternativos[0] ?? ''}
                onChange={(e) => setAltCode(0, e.target.value)}
                placeholder="Ej. código del proveedor"
                hint="Opcional — también busca por este código"
              />
              <WarmInput
                label="Código alternativo 2"
                value={form.codigos_alternativos[1] ?? ''}
                onChange={(e) => setAltCode(1, e.target.value)}
                placeholder="Ej. código en caja"
                hint="Opcional"
              />
            </div>
          </FormSection>

          {/* Imágenes */}
          <FormSection
            icon={<IconPhoto />}
            title="Imágenes"
            description="Galería de hasta 20 imágenes."
            iconClass="bg-[#780e18] text-white shadow-sm"
            extra={
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F4ECDB] px-2.5 py-1 text-[11px] font-bold text-[#780e18] tabular-nums">
                <i className="ti ti-photo text-[11px]" />
                {imagenes.filter((i) => !imageOps.deletedIds.includes(i.id)).length + imageOps.pending.length}/20
              </span>
            }
          >
            <ImageUploader
              key={producto?.id ?? 'new'}
              productoId={producto ? Number(producto.id) : undefined}
              imagenes={imagenes}
              onChange={setImageOps}
              isSaving={saving}
            />
          </FormSection>

          {/* Descripción */}
          <FormSection icon={<IconClipboard />} title="Descripción" description="Marca y detalle del producto" iconClass="bg-[#780e18] text-white shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <BrandSelect
                label="Marca"
                value={form.marcaId ?? null}
                onChange={(id) => set('marcaId', id)}
                marcas={marcas}
                placeholder="Seleccionar marca…"
              />
              <WarmInput
                multiline
                rows={3}
                label="Descripción adicional"
                value={form.descripcion}
                onChange={(e) => set('descripcion', e.target.value)}
                placeholder="Detalle o nota adicional del producto"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <WarmInput
                label="Procedencia"
                value={form.procedencia ?? ''}
                onChange={(e) => set('procedencia', e.target.value)}
                placeholder="Ej: China, USA, Japón..."
                hint="Opcional — país o región de origen del producto"
              />
              <WarmInput
                label="Categoría"
                value={form.categoria ?? ''}
                onChange={(e) => set('categoria', e.target.value)}
                placeholder="Ej: Ford, Toyota..."
                hint="Opcional — texto libre, buscable desde la barra superior"
              />
            </div>
          </FormSection>

          {/* Stock y almacén */}
          <FormSection icon={<IconBox />} title="Stock y almacén" description="Cantidades, unidad de medida y ubicación física" iconClass="bg-[#4A4744] text-white shadow-sm">
            <WarmInput
              label="Ubicación"
              value={form.almacen}
              onChange={(e) => set('almacen', e.target.value)}
              placeholder="Almacén Central"
              hint="Nombre del almacén o ubicación física del producto"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <WarmInput
                label="Stock actual *"
                type="number"
                value={form.stock}
                onChange={(e) => set('stock', Number(e.target.value))}
                readOnly={!!producto}
                hint="Stock editable solo desde el módulo de Ajustes"
              />
              <WarmInput
                label="Stock mínimo"
                type="number"
                value={form.stock_minimo}
                onChange={(e) => set('stock_minimo', Number(e.target.value))}
                hint="Se activa alerta de reposición al llegar a este nivel"
              />
              <WarmInput
                label="Piezas"
                type="number"
                value={form.piezas}
                onChange={(e) => set('piezas', Number(e.target.value))}
                hint="Piezas por unidad (default 1)"
              />
            </div>
          </FormSection>

          {/* Kit */}
          <FormSection
            icon={<IconKit />}
            title="Kit / Conjunto"
            description="Relacionar producto como kit o como parte de un kit"
            iconClass="bg-[#D4A333] text-[#2D2010] shadow-sm"
            extra={producto?.es_kit ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 rounded-full bg-[#780e18] px-2.5 py-1">
                  <i className="ti ti-package text-white text-[11px]" />
                  <span className="text-[11px] font-bold text-white tabular-nums">{producto.stock}</span>
                  <span className="text-[10px] text-white/70">kits</span>
                </div>
                {(producto.piezas_kit?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1 rounded-full bg-[#F4ECDB] border border-[#780e18]/30 px-2.5 py-1">
                    <span className="text-[11px] font-semibold text-[#780e18] tabular-nums">
                      {producto.piezas_kit!.reduce((s, p) => s + p.stock_actual, 0)}
                    </span>
                    <span className="text-[10px] text-[#780e18]/70">piezas en bodega</span>
                  </div>
                )}
              </div>
            ) : undefined}
          >
            <div className="space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.es_kit}
                  onChange={(e) => set('es_kit', e.target.checked)}
                  className="h-4 w-4 rounded-[4px] border-[#E8E5E2]"
                  style={{ accentColor: '#780e18' }}
                />
                <span className="text-[13px] font-semibold text-[#4A4744]">Este producto es un kit</span>
              </label>

              {/* Warning eliminado: el código de pieza ya no incluye el prefijo
                  de marca, por lo que cambiar la marca de un kit no regenera
                  los CodigoPieza de sus piezas. */}

              {/* Kit → Regular: warning + stock manual input */}
              {!form.es_kit && producto?.es_kit && (
                <div className="rounded-[12px] border-2 border-dashed border-amber-300 bg-amber-50/60 overflow-hidden">
                  <div className="px-4 py-3 flex items-start gap-2.5">
                    <svg className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-[12.5px] font-bold text-amber-800">Convertir a producto regular</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">Las piezas del kit y el stock calculado se eliminarán al guardar.</p>
                    </div>
                  </div>
                  <div className="px-4 pb-4 bg-white/60 border-t border-amber-200">
                    <div className="pt-3">
                      <WarmInput
                        label="Stock manual (opcional)"
                        type="number"
                        value={stockManual}
                        onChange={(e) => setStockManual(e.target.value)}
                        placeholder="0"
                        hint="Si no se especifica, el stock queda en 0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Kit parts management */}
              {form.es_kit && (
                <>
                  <KitPartsSection
                    productoId={producto?.id}
                    wasKit={producto?.es_kit ?? false}
                    piezasFromBackend={producto?.piezas_kit}

                    localPieces={kitPieces}
                    onLocalPiecesChange={setKitPieces}
                    pieceOps={pieceOps}
                    onPieceOpsChange={setPieceOps}
                    kitCodigo={kitCodigoActual}
                    onImprimirPieza={handleImprimirPieza}
                  />
                </>
              )}

              {!form.es_kit && !producto?.es_kit && producto?.kit_id && (
                <div className="p-3.5 rounded-xl bg-[#FBFAF7] border border-[#E8E5E2]">
                  <p className="text-[12px] text-[#7A7571]">
                    Parte del kit:{' '}
                    <span className="font-bold text-[#2D2B2A]">{getKitNombre(producto.kit_id, productosExistentes)}</span>
                  </p>
                </div>
              )}
            </div>
          </FormSection>

          {/* Precios */}
          <FormSection icon={<IconCurrency />} title="Precios" description="Costos, precio de venta y tipo de cambio" iconClass="bg-[#D4A333] text-[#2D2010] shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <WarmInput
                label="Precio costo (Bs) *"
                type="number"
                step="0.01"
                value={form.precio_costo}
                onChange={(e) => set('precio_costo', Number(e.target.value))}
                error={errors.precio_costo}
                readOnly={!!producto}
              />
              <div>
                <WarmInput
                  label="Precio venta (Bs)"
                  type="number"
                  step="0.01"
                  value={form.precio_venta}
                  onChange={(e) => set('precio_venta', Number(e.target.value))}
                  error={errors.precio_venta}
                  readOnly={!!producto}
                />
                {!producto && form.precio_venta <= 0 && (
                  <p className="text-xs text-steel-400 mt-1">
                    Se calculará automáticamente con el margen de ganancia
                  </p>
                )}
              </div>
              <WarmInput
                label="Tipo de cambio (Bs/$)"
                type="number"
                step="0.01"
                value={tipoCambio}
                onChange={(e) => {
                  setTipoCambio(e.target.value)
                  set('conversionABs', parseFloat(e.target.value) || 6.96)
                  setErrors((er) => ({ ...er, tipo_cambio: undefined }))
                }}
                error={errors.tipo_cambio}
                hint="Se guarda en el historial de precios"
                readOnly={!!producto}
              />
            </div>
            {margen !== null && (
              <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#3F7A52] px-3 py-1">
                  <i className="ti ti-trending-up text-white text-xs" />
                  <span className="text-xs font-bold text-white">Margen {margen}%</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#B8DCCA] border border-[#3F7A52]/25 px-3 py-1">
                  <span className="text-xs text-[#3F7A52]/80">Ganancia</span>
                  <span className="text-xs font-bold text-[#3F7A52]">Bs {ganancia}</span>
                </div>
              </div>
            )}
          </FormSection>

          {/* Actualizar precios (solo edición) */}
          {producto && (
            <div className="rounded-[14px] border-2 border-dashed border-amber-300 bg-amber-50/50 overflow-hidden">
              <div className="px-5 py-3.5 flex items-center gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={actualizarPrecio}
                    onChange={(e) => setActualizarPrecio(e.target.checked)}
                    className="h-4 w-4 rounded-[4px] border-amber-400"
                    style={{ accentColor: '#d97706' }}
                  />
                  <span className="text-[12.5px] font-bold text-amber-800">Actualizar precios</span>
                </label>
                <span className="text-[11px] text-amber-600">Los precios actuales pasarán al historial</span>
              </div>
              {actualizarPrecio && (
                <div className="px-5 pb-5 bg-white border-t border-amber-200">
                  <div className="pt-3.5 text-[11px] text-amber-700 bg-amber-100/50 rounded-[10px] px-3.5 py-2.5 mb-3.5">
                    <strong>Precio actual:</strong> Costo Bs {form.precio_costo.toFixed(2)} · Venta Bs {form.precio_venta.toFixed(2)} · T.C. {(parseFloat(tipoCambio) || 6.96).toFixed(2)}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <WarmInput
                      label="Nuevo costo (Bs)"
                      type="number"
                      step="0.01"
                      value={nuevoCosto}
                      onChange={(e) => setNuevoCosto(e.target.value)}
                      placeholder={form.precio_costo.toFixed(2)}
                    />
                    <WarmInput
                      label="Nueva venta (Bs)"
                      type="number"
                      step="0.01"
                      value={nuevoVenta}
                      onChange={(e) => setNuevoVenta(e.target.value)}
                      placeholder={form.precio_venta.toFixed(2)}
                    />
                    <WarmInput
                      label="Nuevo T.C. (Bs/$)"
                      type="number"
                      step="0.01"
                      value={nuevoTipoCambio}
                      onChange={(e) => setNuevoTipoCambio(e.target.value)}
                      placeholder={tipoCambio}
                    />
                  </div>
                  <div className="mt-3">
                    <WarmInput
                      label="Nota (opcional)"
                      value={nuevoNota}
                      onChange={(e) => setNuevoNota(e.target.value)}
                      placeholder="Ej. ajuste por inflación, cambio de proveedor..."
                      hint="Descripción del cambio de precio"
                    />
                  </div>
                  {nuevoCosto && nuevoVenta && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-200 px-3 py-1">
                        <svg className="h-3.5 w-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-xs font-semibold text-amber-700">
                          Se guardará: Costo {nuevoCosto} · Venta {nuevoVenta}{nuevoNota ? ` · Nota: ${nuevoNota}` : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Historial de precios */}
          {form.historial_precios.length > 0 && (
            <FormSection
              icon={<IconHistory />}
              title="Historial de precios"
              description={`${form.historial_precios.length} registro${form.historial_precios.length !== 1 ? 's' : ''} de cambios`}
              iconClass="bg-[#3F7A52] text-white shadow-sm"
              collapsible
              open={historialOpen}
              onToggle={() => setHistorialOpen((v) => !v)}
            >
              <div className="overflow-x-auto -mx-5 -mb-5">
                <table className="w-full text-xs min-w-[400px]">
                  <thead className="border-b border-[#E8E5E2]">
                    <tr className="bg-[#F0EFEC]">
                      <th className="px-4 py-2.5 text-left text-[10.5px] font-bold text-[#7A7571] uppercase tracking-[0.06em]">Fecha</th>
                      <th className="px-4 py-2.5 text-right text-[10.5px] font-bold text-[#7A7571] uppercase tracking-[0.06em]">Costo (Bs)</th>
                      <th className="px-4 py-2.5 text-right text-[10.5px] font-bold text-[#7A7571] uppercase tracking-[0.06em]">Venta (Bs)</th>
                      <th className="px-4 py-2.5 text-right text-[10.5px] font-bold text-[#7A7571] uppercase tracking-[0.06em]">T.C.</th>
                      <th className="px-4 py-2.5 text-left text-[10.5px] font-bold text-[#7A7571] uppercase tracking-[0.06em]">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E5E2]">
                    {[...form.historial_precios].reverse().map((h, i) => (
                      <tr key={i} className={i === 0 ? 'bg-[#F4ECDB]/30' : 'bg-white'}>
                        <td className="px-4 py-2.5 text-[#4A4744] whitespace-nowrap">
                          {new Date(h.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#7A7571] tabular-nums">{h.precio_costo.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-[#2D2B2A] tabular-nums">{h.precio_venta.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-[#7A7571] tabular-nums">{h.tipo_cambio.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-[#7A7571]">{h.nota ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FormSection>
          )}
        </div>
      )}
    </DrawerWrapper>

    <EtiquetaModal
      open={!!etiquetaPieza}
      onClose={() => setEtiquetaPieza(null)}
      etiqueta={etiquetaPieza?.etiqueta ?? null}
      subtitulo={etiquetaPieza?.subtitulo}
    />
    </>
  )
}

function getKitNombre(kitId: string | null | undefined, productos: Producto[]): string {
  if (!kitId) return '—'
  return productos.find((p) => p.id === kitId)?.nombre ?? '—'
}

/* ── Icons ── */
function IconBarcode() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9V5a2 2 0 012-2h2M3 15v4a2 2 0 002 2h2m10-16h2a2 2 0 012 2v4m0 6v4a2 2 0 01-2 2h-2M9 5v14M12 5v14M15 5v14" />
    </svg>
  )
}
function IconClipboard() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}
function IconBox() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}
function IconCurrency() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconHistory() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconKit() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )
}
function IconPhoto() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
