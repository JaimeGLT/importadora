import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type * as XLSXType from 'xlsx'
import { Modal, Button, Input, ExcelColumnMapper, BrandSelect, ProveedorSelect } from '@/components/ui'
import type { Importacion, ItemImportacion, Producto, Proveedor, Marca } from '@/types'
import { imprimirLote } from '@/lib/printLabel'
import { clsx } from 'clsx'
import { notify } from '@/lib/notify'
import { api } from '@/lib/api'
import { backendToMarca } from '@/lib/queries/marcas.queries'
import { buildProductoIndex, buildProductoIdIndex, buildMarcaIndex, productoKey } from '@/lib/importIndex'

// ─── Tipos internos ───────────────────────────────────────────────────────────

type ImportStep = 'upload' | 'mapear' | 'datos' | 'preview' | 'confirmar'

type ImportField =
  | 'codigo_universal' | 'codigo_alt1' | 'codigo_alt2'
  | 'nombre' | 'descripcion' | 'categoria' | 'procedencia' | 'marca'
  | 'stock' | 'stock_minimo' | 'piezas' | 'precio_costo' | 'precio_venta' | 'ubicacion'

interface SystemField {
  key: ImportField
  label: string
  required: boolean
  hint?: string
  maxColumns?: number
}

type FieldMappings = Partial<Record<ImportField, { columns: string[]; separator: string }>>

interface DraftItem extends Omit<ItemImportacion, 'id'> {
  _index: number
  stock_minimo: number
  piezas?: number
  piezas_sugerido: number
  procedencia: string
  usar_precio_nuevo: boolean
  usar_piezas_nuevo: boolean
}

interface RawItem {
  codigo_universal: string
  codigos_adicionales: string[]
  nombre: string
  descripcion: string
  procedencia: string
  categoria: string
  marca: string
  precio_fob_usd: number   // = precio_costo del Excel (en USD)
  cantidad: number          // = stock del Excel
  piezas?: number           // piezas por unidad (undefined = no enviar al backend)
  stock_minimo: number
  precio_venta_manual: number  // 0 = no especificado
  ubicacion: string
}

interface DatosForm {
  proveedor_id: string
  fecha_estimada_llegada: string
  tipo_cambio: string
  flete_usd: string
  flete_modo: 'monto' | 'porcentaje'
  aduana_bs: string
  aduana_modo: 'monto' | 'porcentaje'
  transporte_interno_bs: string
  transporte_modo: 'monto' | 'porcentaje'
  marca_id: number | null
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SYSTEM_FIELDS: SystemField[] = [
  { key: 'codigo_universal', label: 'Código universal',     required: true,  hint: 'Código principal del producto', maxColumns: 1 },
  { key: 'codigo_alt1',      label: 'Código alternativo 1', required: false, hint: 'Código secundario (caja / proveedor)' },
  { key: 'codigo_alt2',      label: 'Código alternativo 2', required: false },
  { key: 'nombre',           label: 'Nombre',               required: false },
  { key: 'descripcion',      label: 'Descripción',          required: false },
  { key: 'categoria',        label: 'Categoría',            required: false, hint: 'Categoría del producto (texto libre)' },
  { key: 'procedencia',      label: 'Procedencia',          required: false, hint: 'País o región de origen' },
  { key: 'marca',            label: 'Marca',                required: false, hint: 'Marca por producto (sobreescribe la marca global)' },
  { key: 'stock',            label: 'Cantidad',              required: true,  hint: 'Unidades que ingresan al lote' },
  { key: 'precio_costo',     label: 'Precio FOB (USD)',      required: true,  hint: 'Precio unitario al proveedor en dólares' },
  { key: 'precio_venta',     label: 'Precio de venta (opcional)', required: false, hint: 'Si se mapea, se usa tal cual; si no, se calcula con el margen' },
]

const STEP_LABELS: Record<ImportStep, string> = {
  upload:    'Subir archivo',
  mapear:    'Mapear columnas',
  datos:     'Datos generales',
  preview:   'Revisar precios',
  confirmar: 'Confirmar',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNumeric(raw: unknown): number {
  if (typeof raw === 'number') return isFinite(raw) ? raw : 0
  if (typeof raw !== 'string' || !raw.trim()) return 0
  const trimmed = raw.trim()

  // Detectar signo antes de limpiar (los paréntesis contables se pierden al
  // aplicar el filtro `[^0-9.,-]`).
  const isNegative = trimmed.startsWith('-') || /^\(.*\)$/.test(trimmed)

  // Quitar todo menos dígitos y separadores.
  const cleaned = trimmed.replace(/[^0-9.,]/g, '')
  if (!cleaned) return 0

  const hasDot = cleaned.includes('.')
  const hasComma = cleaned.includes(',')

  let normalized: string
  if (hasDot && hasComma) {
    // El ÚLTIMO de los dos es el decimal. El otro es separador de miles.
    const lastDot = cleaned.lastIndexOf('.')
    const lastComma = cleaned.lastIndexOf(',')
    if (lastDot > lastComma) {
      // Formato inglés: "1,200.50" → "1200.50"
      normalized = cleaned.replace(/,/g, '')
    } else {
      // Formato europeo/latino: "1.200,50" → "1200.50"
      normalized = cleaned.replace(/\./g, '').replace(',', '.')
    }
  } else if (hasComma) {
    // Solo comas: asumir decimal latino (común en Excels exportados desde
    // sistemas bolivianos). "10,50" → "10.50"
    normalized = cleaned.replace(',', '.')
  } else if (hasDot) {
    // Solo puntos: heurística. Si tiene exactamente 3 dígitos después del
    // último punto, asumir separador de miles latino ("1.500" → 1500).
    // Caso contrario, decimal inglés ("10.50", "10.5" → 10.5).
    const lastDot = cleaned.lastIndexOf('.')
    const afterDot = cleaned.slice(lastDot + 1)
    if (afterDot.length === 3 && /^\d{3}$/.test(afterDot) && cleaned.split('.').length === 2) {
      normalized = cleaned.replace('.', '')
    } else {
      normalized = cleaned
    }
  } else {
    normalized = cleaned
  }

  const n = parseFloat(normalized)
  if (!isFinite(n)) return 0
  return isNegative ? -n : n
}

function resolveValue(row: Record<string, unknown>, mapping: { columns: string[]; separator: string }): string {
  return mapping.columns
    .map((col) => String(row[col] ?? '').trim())
    .filter(Boolean)
    .join(mapping.separator || ' ')
}

function buildRawItem(row: Record<string, unknown>, mappings: FieldMappings): RawItem {
  const get = (key: ImportField) => {
    const m = mappings[key]
    return m ? resolveValue(row, m) : ''
  }
  const getRaw = (key: ImportField): unknown => {
    const m = mappings[key]
    return m?.columns.length ? row[m.columns[0]] ?? '' : ''
  }
  return {
    codigo_universal: get('codigo_universal'),
    codigos_adicionales: [get('codigo_alt1'), get('codigo_alt2')].filter(Boolean),
    nombre:        get('nombre'),
    descripcion:   get('descripcion'),
    procedencia:   get('procedencia'),
    categoria:     get('categoria'),
    marca:         get('marca'),
    precio_fob_usd: parseNumeric(getRaw('precio_costo')),   // precio_costo del Excel = FOB en USD
    cantidad:       Math.round(parseNumeric(getRaw('stock'))),  // stock del Excel = cantidad del lote
    piezas:         parseNumeric(getRaw('piezas')) || undefined,
    stock_minimo:   Math.round(parseNumeric(getRaw('stock_minimo'))) || 15,
    precio_venta_manual: parseNumeric(getRaw('precio_venta')),
    ubicacion:     get('ubicacion') || 'Almacén Central',
  }
}

interface ImportStats {
  valid: RawItem[]
  total: number
  descartadas: number
  sinCodigo: number
}

/**
 * Construye los RawItems y, en el mismo recorrido, cuenta las razones de descarte.
 *
 * Reglas de validación:
 * - `codigo_universal` es el único campo obligatorio. Si está vacío, la fila se descarta.
 * - `precio_fob_usd` y `cantidad` se aceptan vacíos como 0 (no se descartan).
 *   Si el usuario deja la celda vacía en el Excel, el producto se importa con
 *   precio/stock 0 y se puede editar después.
 *
 * Una sola pasada sobre las filas: evita duplicar la lógica de parseo y
 * mantiene sincronizado el filtro con el diagnóstico.
 */
function computeImportStats(rows: Record<string, unknown>[], mappings: FieldMappings): ImportStats {
  let sinCodigo = 0
  const valid: RawItem[] = []

  for (const row of rows) {
    const item = buildRawItem(row, mappings)
    if (!item.codigo_universal) {
      sinCodigo++
    } else {
      valid.push(item)
    }
  }

  return { valid, total: rows.length, descartadas: sinCodigo, sinCodigo }
}

function calcItems(
  rawItems: RawItem[],
  datos: { tipo_cambio: number; flete_usd: number; aduana_bs: number; transporte_interno_bs: number },
  productoIndex: Map<string, Producto>,
  marcaIndex: Map<string, number>,
  piezasMapeado: boolean,
  marcaDefault: number | null,
  margenBd: number,
): DraftItem[] {
  const total_fob_bs = rawItems.reduce(
    (s, i) => s + i.precio_fob_usd * datos.tipo_cambio * i.cantidad, 0,
  )

  const costos_lote_bs =
    datos.flete_usd * datos.tipo_cambio + datos.aduana_bs + datos.transporte_interno_bs

  return rawItems.map((raw, idx) => {
    const costo_unitario_fob_bs = raw.precio_fob_usd * datos.tipo_cambio

    const fob_item_bs  = costo_unitario_fob_bs * raw.cantidad
    const proporcion   = total_fob_bs > 0 ? fob_item_bs / total_fob_bs : 0

    const costo_unitario_adicional_bs =
      raw.cantidad > 0 ? (proporcion * costos_lote_bs) / raw.cantidad : 0

    const costo_unitario_total_bs = costo_unitario_fob_bs + costo_unitario_adicional_bs

    const precio_venta_sugerido = Math.ceil(costo_unitario_total_bs * margenBd * 100) / 100

    const precio_venta_final =
      raw.precio_venta_manual > 0 ? raw.precio_venta_manual : precio_venta_sugerido

    const marcaExcel = raw.marca ? marcaIndex.get(raw.marca.trim().toLowerCase()) ?? null : null
    const resolvedMarcaId = marcaExcel ?? marcaDefault ?? null

    // Lookup O(1) en el index de productos (era Array.find O(n) por cada row).
    const match = productoIndex.get(productoKey(raw.codigo_universal, resolvedMarcaId)) ?? null

    return {
      _index:               idx,
      codigo_proveedor:     raw.codigo_universal,
      codigos_adicionales:  raw.codigos_adicionales,
      nombre:               raw.nombre,
      marcaId:              resolvedMarcaId,
      descripcion:          raw.descripcion,
      procedencia:          raw.procedencia,
      categoria:            raw.categoria,
      ubicacion:            raw.ubicacion,
      precio_fob_usd:       raw.precio_fob_usd,
      cantidad:             raw.cantidad,
      piezas:               piezasMapeado ? (raw.piezas ?? 1) : (match?.piezas ?? 1),
      piezas_sugerido:      piezasMapeado ? (raw.piezas ?? 1) : (match?.piezas ?? 1),
      stock_minimo:         raw.stock_minimo,
      costo_unitario_fob_bs,
      costo_unitario_adicional_bs,
      costo_unitario_total_bs,
      precio_venta_sugerido,
      precio_venta_final,
      producto_id:          match?.id,
      es_nuevo:             !match,
      usar_precio_nuevo:    true,
      usar_piezas_nuevo:    true,
    }
  })
}

function getResolvedAmounts(datos: DatosForm, rawItems: RawItem[]) {
  const tc = parseNumeric(datos.tipo_cambio)
  const totalFobUsd = rawItems.reduce((s, i) => s + i.precio_fob_usd * i.cantidad, 0)
  const totalFobBs = totalFobUsd * tc
  const fleteVal = parseNumeric(datos.flete_usd)
  const aduanaVal = parseNumeric(datos.aduana_bs)
  const transporteVal = parseNumeric(datos.transporte_interno_bs)
  return {
    tipo_cambio: tc,
    flete_usd: datos.flete_modo === 'porcentaje' ? (fleteVal / 100) * totalFobUsd : fleteVal,
    aduana_bs: datos.aduana_modo === 'porcentaje' ? (aduanaVal / 100) * totalFobBs : aduanaVal,
    transporte_interno_bs: datos.transporte_modo === 'porcentaje' ? (transporteVal / 100) * totalFobBs : transporteVal,
  }
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function nextNumero(existingCount: number): string {
  const year = new Date().getFullYear()
  const n = String(existingCount + 1).padStart(3, '0')
  return `IMP-${year}-${n}`
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

const STEPS: ImportStep[] = ['upload', 'mapear', 'datos', 'preview', 'confirmar']

function Stepper({ step }: { step: ImportStep }) {
  const idx = STEPS.indexOf(step)

  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex items-center gap-1.5">
            <div className={clsx(
              'h-6 w-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0',
              i < idx   ? 'bg-brand-600 text-white' :
              i === idx ? 'bg-brand-600 text-white ring-4 ring-brand-100' :
                          'bg-steel-200 text-steel-500',
            )}>
              {i < idx ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={clsx(
              'hidden sm:inline text-sm',
              i === idx ? 'font-medium text-steel-900' : 'text-steel-400',
            )}>{STEP_LABELS[s]}</span>
            {i === idx && (
              <span className="sm:hidden text-sm font-medium text-steel-900">{STEP_LABELS[s]}</span>
            )}
          </div>
          {i < STEPS.length - 1 && (
            <div className={clsx('h-px w-3 sm:w-6 mx-1.5 sm:mx-2', i < idx ? 'bg-brand-400' : 'bg-steel-200')} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onSave: (
    importacion: Omit<Importacion, 'id' | 'creado_en' | 'actualizado_en'>,
    proveedorId: number,
    options: { categoriaMapeada: boolean },
  ) => void
  proveedores: Proveedor[]
  productos: Producto[]
  marcas: Marca[]
  totalImportaciones: number
  margenGanancia: number
}

export function NuevaImportacionModal({
  open, onClose, onSave, proveedores, productos, marcas, totalImportaciones, margenGanancia,
}: Props) {
  // ── Estado ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<ImportStep>('upload')
  const [margenBd, setMargenBd] = useState<number>(margenGanancia)
  const [margenGlobal] = useState<number>(margenGanancia)

  // Sincronizar con el margen configurado en cuanto llegue del backend
  useEffect(() => {
    setMargenBd(margenGanancia)
  }, [margenGanancia])

  // Excel
  const [columns, setColumns]   = useState<string[]>([])
  const [rows, setRows]         = useState<Record<string, unknown>[]>([])
  const [mappings, setMappings] = useState<FieldMappings>({})
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>

  // Raw items (calculados tras mapear, antes de datos)
  const [rawItems, setRawItems] = useState<RawItem[]>([])

  // Datos generales
  const [datos, setDatos] = useState<DatosForm>({
    proveedor_id: '',
    fecha_estimada_llegada: '',
    tipo_cambio: '6.96',
    flete_usd: '',
    flete_modo: 'monto',
    aduana_bs: '',
    aduana_modo: 'monto',
    transporte_interno_bs: '',
    transporte_modo: 'monto',
    marca_id: null,
  })

  // Items calculados
  const [items, setItems] = useState<DraftItem[]>([])

  // Proveedores creados inline durante este flujo
  const [extraProveedores, setExtraProveedores] = useState<Proveedor[]>([])

  // Marcas creadas inline durante este flujo
  const [extraMarcas, setExtraMarcas] = useState<Marca[]>([])
  const allMarcas = useMemo(() => [...marcas, ...extraMarcas], [marcas, extraMarcas])

  // Indexes pre-calculados. Sin esto, con 1500 rows × N productos en el
  // catálogo, `Array.find` dentro del loop hacía O(1500×N) comparaciones de
  // strings y congelaba la página. Con Map.get, cada lookup es O(1).
  const productoIndex = useMemo(() => buildProductoIndex(productos), [productos])
  const productoById  = useMemo(() => buildProductoIdIndex(productos), [productos])
  const marcaIndex    = useMemo(() => buildMarcaIndex(allMarcas), [allMarcas])
  const marcaById     = useMemo(
    // `Marca.id` está tipeado como string pero `backendToMarca` lo coerce a
    // number con `Number(b.id)`; respetamos la realidad del runtime.
    () => new Map<number, Marca>(allMarcas.map(m => [m.id as number, m])),
    [allMarcas],
  )

  // Guardando
  const [saving, setSaving] = useState(false)
  const [creatingMarcas, setCreatingMarcas] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [successData, setSuccessData] = useState<{ numero: string; totalProductos: number; fobTotal: number; items: DraftItem[] } | null>(null)

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStep('upload')
    setColumns([]); setRows([]); setMappings({}); setFileName('')
    setRawItems([])
    setDatos({ proveedor_id: '', fecha_estimada_llegada: '', tipo_cambio: '6.96', flete_usd: '', flete_modo: 'monto', aduana_bs: '', aduana_modo: 'monto', transporte_interno_bs: '', transporte_modo: 'monto', marca_id: null })
    setMargenBd(margenGlobal)
    setItems([])
    setExtraProveedores([])
    setExtraMarcas([])
    setSaving(false)
    setCreatingMarcas(false)
  }, [margenGlobal])

  const handleClose = () => { reset(); onClose() }

  // ── Step 1: upload ────────────────────────────────────────────────────────
  // Estrategia: FileReader.readAsArrayBuffer + Uint8Array + XLSX.read type:'array'.
  // Itera TODAS las hojas y usa la que tenga más filas (algunos Excels ponen
  // los datos en la hoja 2, no en la hoja 1). `blankrows: true` evita que se
  // salten filas vacías intermedias que delimitan tablas.
  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      notify.error('Formato no soportado. Usa .xlsx, .xls o .csv')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const XLSX: typeof XLSXType = await import('xlsx')
        const buffer = e.target?.result as ArrayBuffer
        const data = new Uint8Array(buffer)
        const wb = XLSX.read(data, { type: 'array' })

        // Buscar la hoja con más filas (algunos Excels tienen varias hojas y
        // los datos están en la 2da o 3era, no en la primera)
        let bestSheetName = wb.SheetNames[0]
        let bestCount = 0
        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name]
          const tmp = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', blankrows: true })
          if (tmp.length > bestCount) {
            bestCount = tmp.length
            bestSheetName = name
          }
        }

        const ws = wb.Sheets[bestSheetName]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', blankrows: true })

        // eslint-disable-next-line no-console
        console.log('[ImportExcel] hojas:', wb.SheetNames, '→ usando:', bestSheetName, '| filas:', rows.length, '| columnas:', Object.keys(rows[0] ?? {}))

        if (!rows.length) { notify.error('El archivo está vacío'); return }
        setColumns(Object.keys(rows[0]))
        setRows(rows)
        setMappings({})
        setStep('mapear')
      } catch {
        notify.error('Error al leer el archivo')
      }
    }
    reader.onerror = () => notify.error('Error al leer el archivo')
    reader.readAsArrayBuffer(file)
  }, [])

  // ── Step 2: mapear ────────────────────────────────────────────────────────
  const addColumn = (field: string, col: string) => {
    setMappings((prev) => {
      const existing = prev[field as ImportField] ?? { columns: [], separator: '-' }
      if (existing.columns.includes(col)) return prev
      return { ...prev, [field as ImportField]: { ...existing, columns: [...existing.columns, col] } }
    })
  }

  const removeColumn = (field: string, col: string) => {
    setMappings((prev) => {
      const existing = prev[field as ImportField]
      if (!existing) return prev
      const columns = existing.columns.filter((c) => c !== col)
      if (columns.length === 0) {
        const next = { ...prev }
        delete next[field as ImportField]
        return next
      }
      return { ...prev, [field as ImportField]: { ...existing, columns } }
    })
  }

  const setSeparator = (field: string, sep: string) => {
    setMappings((prev) => {
      const existing = prev[field as ImportField]
      if (!existing) return prev
      return { ...prev, [field as ImportField]: { ...existing, separator: sep } }
    })
  }

  const requiredMapped = SYSTEM_FIELDS
    .filter((f) => f.required)
    .every((f) => (mappings[f.key]?.columns.length ?? 0) > 0)

  const handleGoToDatos = async () => {
    const stats = computeImportStats(rows, mappings)
    if (!stats.valid.length) {
      notify.error(
        `0 de ${stats.total} filas válidas — todas sin código universal. Revisá el mapeo de esa columna.`,
      )
      return
    }
    const raw = stats.valid
    setRawItems(raw)

    if (mappings['marca']) {
      setCreatingMarcas(true)
      try {
        // 1) Refrescar la lista de marcas desde la BD. Sin esto, si la marca
        //    ya existía (sesión anterior, otro usuario, etc.) el check local
        //    da false y mandamos un POST inútil que vuelve 409.
        let latestMarcas: Marca[] = []
        try {
          const res = await api.get<{ id: number; nombre: string }[]>('/marca')
          latestMarcas = res.map(backendToMarca)
        } catch {
          // Si falla el refresh, seguimos con la lista local — no es bloqueante.
        }

        // 2) Construir la lista efectiva: prop del padre + extras locales + las
        //    recién refrescadas. La usamos para detectar "ya existe" sin chocar
        //    con el índice único IX_Marca_Nombre.
        const byName = new Map<string, Marca>()
        for (const m of [...marcas, ...extraMarcas, ...latestMarcas]) {
          byName.set(m.nombre.trim().toLowerCase(), m)
        }
        const findByName = (name: string) =>
          byName.get(name.trim().toLowerCase()) ?? null

        // 3) Dedup case-insensitive + trim + colapso de whitespace. Usamos la
        //    key lowercase para que "AXP", "axp" y "AXP " colapsen en uno.
        //    Conservamos el casing original del primer row visto para mandar
        //    al backend el nombre "bonito".
        const seen = new Set<string>()
        const uniqueNames: string[] = []
        for (const r of raw) {
          const trimmed = (r.marca ?? '').trim().replace(/\s+/g, ' ')
          const key = trimmed.toLowerCase()
          if (key && !seen.has(key)) {
            seen.add(key)
            uniqueNames.push(trimmed)
          }
        }

        // 4) Para cada nombre único: si no existe, crear. Si el POST devuelve
        //    409 (race con otro usuario / caché desactualizado), refrescar y
        //    recuperar la marca existente del servidor.
        const newMarcas: Marca[] = []
        for (const nombre of uniqueNames) {
          const existing = findByName(nombre)
          if (existing) continue

          try {
            const res = await api.post<{ id: number; nombre: string }>('/marca', { nombre })
            const marca = backendToMarca({ id: res.id, nombre: res.nombre })
            newMarcas.push(marca)
            byName.set(marca.nombre.trim().toLowerCase(), marca)
          } catch {
            // 409 (o cualquier fallo): re-fetch de la lista y buscar la marca
            // que el backend rechazó — ya está creada, solo necesitamos su id.
            try {
              const res = await api.get<{ id: number; nombre: string }[]>('/marca')
              const found = res.find(
                m => m.nombre.trim().toLowerCase() === nombre.trim().toLowerCase(),
              )
              if (found) {
                const marca = backendToMarca({ id: found.id, nombre: found.nombre })
                newMarcas.push(marca)
                byName.set(marca.nombre.trim().toLowerCase(), marca)
              }
            } catch {
              // Si el re-fetch también falla, seguimos sin esa marca — el
              // producto la creará sin marcaId y se puede asignar después.
            }
          }
        }

        // 5) Mergear todo al state local para que calcItems encuentre las
        //    marcas por id al renderizar el preview.
        if (latestMarcas.length || newMarcas.length) {
          setExtraMarcas(prev => {
            const ids = new Set(prev.map(m => m.id))
            const merged = [...prev]
            for (const m of [...latestMarcas, ...newMarcas]) {
              if (!ids.has(m.id)) {
                merged.push(m)
                ids.add(m.id)
              }
            }
            return merged
          })
        }
      } finally {
        setCreatingMarcas(false)
      }
    }

    setStep('datos')
  }

  // ── Step 3: datos ─────────────────────────────────────────────────────────
  const handleProveedorChange = (id: string) => {
    const prov = proveedores.find((p) => p.id === id)
    setDatos((d) => ({
      ...d,
      proveedor_id: id,
      fecha_estimada_llegada: prov?.tiempo_reposicion_dias
        ? addDays(prov.tiempo_reposicion_dias)
        : d.fecha_estimada_llegada,
    }))
  }

  const validarDatos = (): boolean => {
    if (!datos.proveedor_id)              { notify.error('Selecciona un proveedor'); return false }
    if (!datos.fecha_estimada_llegada)    { notify.error('Ingresa la fecha estimada'); return false }
    if (!parseNumeric(datos.tipo_cambio)) { notify.error('Ingresa el tipo de cambio'); return false }
    return true
  }

  const handleGoToPreview = () => {
    if (!validarDatos()) return
    const resolved = getResolvedAmounts(datos, rawItems)
    const piezasMapeado = (mappings['piezas']?.columns.length ?? 0) > 0
    setItems(calcItems(rawItems, resolved, productoIndex, marcaIndex, piezasMapeado, datos.marca_id, margenBd))
    setStep('preview')
  }

  // ── Step 4: preview ───────────────────────────────────────────────────────
  // Al cambiar la marca, recalculamos el match (producto_id + es_nuevo) en el
  // mismo recorrido. El match depende de código universal + marca, así que al
  // editar la marca el estado "Nuevo/Existente" se actualiza en vivo.
  const updateMarcaItem = (index: number, marcaId: number | null) => {
    setItems((prev) => prev.map((it) => {
      if (it._index !== index) return it
      const match = productoIndex.get(productoKey(it.codigo_proveedor, marcaId)) ?? null
      return {
        ...it,
        marcaId: marcaId ?? null,
        producto_id: match?.id,
        es_nuevo: !match,
      }
    }))
  }

  const updateProcedencia = (index: number, val: string) => {
    setItems((prev) => prev.map((it) => it._index === index ? { ...it, procedencia: val } : it))
  }

  const updateCategoria = (index: number, val: string) => {
    setItems((prev) => prev.map((it) => it._index === index ? { ...it, categoria: val } : it))
  }

  const updatePrecioFinal = (index: number, val: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it._index === index ? { ...it, precio_venta_final: parseNumeric(val) || it.precio_venta_final } : it,
      ),
    )
  }

  const updatePrecioEleccion = (index: number, usarNuevo: boolean) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it._index !== index) return it
        if (usarNuevo) {
          return { ...it, usar_precio_nuevo: true, precio_venta_final: it.precio_venta_sugerido }
        }
        const prod = it.producto_id ? productoById.get(it.producto_id) : undefined
        return {
          ...it,
          usar_precio_nuevo: false,
          precio_venta_final: prod?.precio_venta ?? it.precio_venta_final,
        }
      }),
    )
  }

  // ── Step 5: confirmar ─────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    setSaving(true)

    const d = getResolvedAmounts(datos, rawItems)
    const fob_total_usd = items.reduce((s, i) => s + i.precio_fob_usd * i.cantidad, 0)

    const provSeleccionado = proveedores.find((p) => p.id === datos.proveedor_id)

    const importacion: Omit<Importacion, 'id' | 'creado_en' | 'actualizado_en'> = {
      numero: nextNumero(totalImportaciones),
      origen: provSeleccionado?.pais ?? '',
      proveedor: provSeleccionado?.nombre ?? '',
      fecha_creacion: new Date().toISOString(),
      fecha_estimada_llegada: new Date(datos.fecha_estimada_llegada).toISOString(),
      estado: 'en_transito',
      fob_total_usd,
      ...d,
      items: items.map((it, i) => ({ ...it, id: `item-${crypto.randomUUID()}-${i}` })),
    }

    try {
      const categoriaMapeada = (mappings['categoria']?.columns.length ?? 0) > 0
      await onSave(importacion, Number(datos.proveedor_id), { categoriaMapeada })
      setSuccessData({
        numero: nextNumero(totalImportaciones),
        totalProductos: items.length,
        fobTotal: fob_total_usd,
        items: [...items],
      })
      reset()
      setSuccessOpen(true)
    } catch {
      notify.error('Error al registrar la importación')
    } finally {
      setSaving(false)
    }
  }

  // ── Navegación atrás ──────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 'mapear')    setStep('upload')
    if (step === 'datos')     setStep('mapear')
    if (step === 'preview')   setStep('datos')
    if (step === 'confirmar') setStep('preview')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const fobPreliminar = rawItems.reduce((s, i) => s + i.precio_fob_usd * i.cantidad, 0)
  const nuevos     = items.filter((i) => i.es_nuevo).length
  const existentes = items.filter((i) => !i.es_nuevo).length
  const fobTotal   = items.reduce((s, i) => s + i.precio_fob_usd * i.cantidad, 0)
  const tc         = parseNumeric(datos.tipo_cambio)

  const modalSize = step === 'preview' ? '2xl' : 'xl'

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Nueva importación"
        size={modalSize}
        disableBackdropClose
        footer={
          <ModalFooter
            step={step}
            saving={saving}
            creatingMarcas={creatingMarcas}
            hasFile={columns.length > 0}
            requiredMapped={requiredMapped}
            hasItems={items.length > 0}
            onBack={handleBack}
            onNext={() => {
              if (step === 'mapear')    void handleGoToDatos()
              if (step === 'datos')     handleGoToPreview()
              if (step === 'preview')   setStep('confirmar')
              if (step === 'confirmar') void handleConfirmar()
            }}
            onClose={handleClose}
          />
        }
      >
        <Stepper step={step} />

      {/* ── STEP 1: UPLOAD ── */}
      {step === 'upload' && (
        <StepUpload
          dragging={dragging}
          fileInputRef={fileInputRef}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f) }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onFileChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
        />
      )}

      {/* ── STEP 2: MAPEAR ── */}
      {step === 'mapear' && (
        <ExcelColumnMapper
          fields={SYSTEM_FIELDS}
          excelCols={columns}
          mappings={mappings as Record<string, { columns: string[]; separator: string }>}
          fileName={fileName}
          rowCount={rows.length}
          onAddColumn={addColumn}
          onRemoveColumn={removeColumn}
          onSetSeparator={setSeparator}
        />
      )}

      {/* ── STEP 3: DATOS ── */}
      {step === 'datos' && (
        <StepDatos
          datos={datos}
          setDatos={setDatos}
          proveedores={[...proveedores, ...extraProveedores].filter((p) => p.estado === 'activo')}
          fobPreliminar={fobPreliminar}
          totalProductos={rawItems.length}
          onProveedorChange={handleProveedorChange}
          onProveedorCreado={(p) => setExtraProveedores((prev) => [...prev, p])}
          margen={margenBd}
          margenGlobal={margenGlobal}
          onMargenChange={setMargenBd}
        />
      )}

      {/* ── STEP 4: PREVIEW ── */}
      {step === 'preview' && (
        <StepPreview
          items={items}
          tc={tc}
          onPrecioChange={updatePrecioFinal}
          onPrecioEleccion={updatePrecioEleccion}
          onProcedenciaChange={updateProcedencia}
          onCategoriaChange={updateCategoria}
          onMarcaChange={updateMarcaItem}
          marcas={allMarcas}
          productoById={productoById}
          marcaById={marcaById}
        />
      )}

      {/* ── STEP 5: CONFIRMAR ── */}
      {step === 'confirmar' && (() => {
        const prov = proveedores.find((p) => p.id === datos.proveedor_id)
        const resolved = getResolvedAmounts(datos, rawItems)
        return (
          <StepConfirmar
            nuevos={nuevos}
            existentes={existentes}
            fobTotal={fobTotal}
            tc={tc}
            flete={resolved.flete_usd}
            aduana={resolved.aduana_bs}
            transporte={resolved.transporte_interno_bs}
            proveedor={prov?.nombre ?? ''}
            pais={prov?.pais ?? ''}
            fechaLlegada={datos.fecha_estimada_llegada}
          />
        )
      })()}
    </Modal>

      {/* ── MODAL DE ÉXITO ── */}
      {successData && (
        <SuccessModal
          open={successOpen}
          onClose={() => { setSuccessOpen(false); setSuccessData(null); onClose() }}
          numero={successData.numero}
          totalProductos={successData.totalProductos}
          fobTotal={successData.fobTotal}
          items={successData.items}
          marcas={allMarcas}
        />
      )}
    </>
  )
}

// ─── Modal de éxito ────────────────────────────────────────────────────────────

function SuccessModal({
  open, onClose, numero, totalProductos, fobTotal, items, marcas,
}: {
  open: boolean
  onClose: () => void
  numero: string
  totalProductos: number
  fobTotal: number
  items: DraftItem[]
  marcas: Marca[]
}) {
  const [printing, setPrinting] = useState(false)

  if (!open) return null

  const handlePrint = async () => {
    setPrinting(true)
    const today = new Date().toISOString()
    const labelItems = items.map(it => {
      const marca = marcas.find(m => m.id === it.marcaId)
      return {
        producto: {
          codigo_universal: it.codigo_proveedor,
          nombre: it.nombre,
          marca: marca?.nombre ?? '',
          vehiculo: '',
          precio_venta: it.precio_venta_final,
          unidad: it.unidad ?? 'unidad',
          creado_en: today,
        },
        copias: 1,
      }
    })
    await imprimirLote(labelItems)
    setPrinting(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-in fade-in zoom-in duration-300">
        {/* Icono circular verde */}
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)' }}>
          <svg className="w-10 h-10" style={{ color: '#059669' }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Título */}
        <h2 className="text-xl font-bold text-steel-900 mb-2">¡Importación creada!</h2>

        {/* Número de importación */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5"
          style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
          <svg className="w-4 h-4" style={{ color: '#6366F1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: '#4338CA' }}>{numero}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #E8EDF3' }}>
            <p className="text-2xl font-black text-steel-900">{totalProductos}</p>
            <p className="text-[11px] text-steel-400 mt-0.5">productos</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #E8EDF3' }}>
            <p className="text-2xl font-black text-steel-900">${fobTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            <p className="text-[11px] text-steel-400 mt-0.5">FOB total</p>
          </div>
        </div>

        <p className="text-sm text-steel-500 mb-4">
          Los productos han sido registrados correctamente y el inventario se ha actualizado.
        </p>

        <button
          onClick={() => void handlePrint()}
          disabled={printing}
          className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#D0CBC4] bg-white text-sm font-medium text-[#4A4744] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {printing
            ? <i className="ti ti-loader-2 animate-spin text-base" />
            : <i className="ti ti-printer text-base" />
          }
          {printing ? 'Generando etiquetas...' : `Imprimir etiquetas del lote (${totalProductos})`}
        </button>

        <Button onClick={onClose} className="w-full">
          Aceptar
        </Button>
      </div>
    </div>
  )
}

// ─── Sub-componentes de pasos ────────────────────────────────────────────────

function StepUpload({
  dragging, fileInputRef, onDrop, onDragOver, onDragLeave, onFileChange,
}: {
  dragging: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl p-6 sm:p-12 cursor-pointer transition-colors',
        dragging ? 'border-brand-400 bg-brand-50' : 'border-steel-200 bg-steel-50 hover:border-brand-300 hover:bg-brand-50/50',
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => fileInputRef.current?.click()}
    >
      <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center">
        <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-steel-800">Arrastra tu archivo aquí o haz clic para seleccionar</p>
        <p className="text-xs text-steel-400 mt-1">Formatos soportados: .xlsx, .xls, .csv</p>
      </div>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
    </div>
  )
}

function CostoField({
  label, modo, value, unidadMonto, fobRef, tc, esFob, onModoChange, onChange,
}: {
  label: string
  modo: 'monto' | 'porcentaje'
  value: string
  unidadMonto: string
  fobRef: number
  tc: number
  esFob?: boolean
  onModoChange: (m: 'monto' | 'porcentaje') => void
  onChange: (v: string) => void
}) {
  const pct = parseFloat(value)
  const fobBs = fobRef * tc
  const montoResuelto = modo === 'porcentaje' && isFinite(pct) && pct > 0
    ? esFob
      ? (pct / 100) * fobRef
      : (pct / 100) * fobBs
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-steel-700">{label}</span>
        <div className="flex items-center rounded-md overflow-hidden border border-steel-200 text-[10px] font-semibold">
          <button
            type="button"
            onClick={() => onModoChange('monto')}
            className={clsx(
              'px-2 py-0.5 transition-colors',
              modo === 'monto' ? 'bg-brand-600 text-white' : 'bg-white text-steel-500 hover:bg-steel-50',
            )}
          >
            Monto
          </button>
          <button
            type="button"
            onClick={() => onModoChange('porcentaje')}
            className={clsx(
              'px-2 py-0.5 transition-colors',
              modo === 'porcentaje' ? 'bg-brand-600 text-white' : 'bg-white text-steel-500 hover:bg-steel-50',
            )}
          >
            %
          </button>
        </div>
      </div>
      <div className="relative">
        <input
          type="number"
          step="0.01"
          min="0"
          max={modo === 'porcentaje' ? '100' : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={modo === 'porcentaje' ? 'ej: 5' : '0.00'}
          className="w-full px-3 py-2 pr-12 rounded-lg border border-steel-200 bg-white text-[13px] text-steel-900 placeholder:text-steel-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-shadow"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-steel-400 pointer-events-none select-none">
          {modo === 'porcentaje' ? '%' : unidadMonto}
        </span>
      </div>
      {montoResuelto !== null && (
        <p className="text-[10.5px] text-brand-600 font-medium mt-1 tabular-nums">
          ≈ {esFob ? `$${montoResuelto.toFixed(2)} USD` : `Bs ${montoResuelto.toFixed(2)}`}
        </p>
      )}
    </div>
  )
}

function StepDatos({
  datos, setDatos, proveedores, fobPreliminar, totalProductos, onProveedorChange, onProveedorCreado,
  margen, margenGlobal, onMargenChange,
}: {
  datos: DatosForm
  setDatos: React.Dispatch<React.SetStateAction<DatosForm>>
  proveedores: import('@/types').Proveedor[]
  fobPreliminar: number
  totalProductos: number
  onProveedorChange: (id: string) => void
  onProveedorCreado: (p: import('@/types').Proveedor) => void
  margen: number
  margenGlobal: number
  onMargenChange: (v: number) => void
}) {
  const set = (k: keyof DatosForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDatos((d) => ({ ...d, [k]: e.target.value }))

  const provSeleccionado = proveedores.find((p) => p.id === datos.proveedor_id)

  return (
    <div className="space-y-5">
      {/* Proveedor */}
      <ProveedorSelect
        label="Proveedor"
        value={datos.proveedor_id || null}
        onChange={onProveedorChange}
        onCreated={onProveedorCreado}
        proveedores={proveedores}
      />

      {/* Info del proveedor seleccionado */}
      {provSeleccionado && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-steel-50 border border-steel-200">
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-steel-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[12px] text-steel-600 font-medium">{provSeleccionado.pais}</span>
          </div>
          <span className="text-steel-200">·</span>
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-steel-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[12px] text-steel-600">
              {provSeleccionado.tiempo_reposicion_dias
                ? `~${provSeleccionado.tiempo_reposicion_dias} días de tránsito`
                : 'Tiempo no definido'}
            </span>
          </div>
          <span className="text-steel-200">·</span>
          <span className="text-[12px] text-steel-500">{provSeleccionado.moneda} · {provSeleccionado.terminos_pago}</span>
        </div>
      )}

      {/* Fecha y tipo de cambio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Fecha estimada de llegada"
          type="date"
          value={datos.fecha_estimada_llegada}
          onChange={set('fecha_estimada_llegada')}
          hint={provSeleccionado?.tiempo_reposicion_dias ? 'Auto-calculada según tiempo del proveedor' : undefined}
        />
        <Input
          label="Tipo de cambio (Bs/USD)"
          type="number"
          step="0.01"
          min="0"
          value={datos.tipo_cambio}
          onChange={set('tipo_cambio')}
          hint="Fijo para toda esta importación"
        />
      </div>


      {/* Marca global */}
      <BrandSelect
        value={datos.marca_id}
        onChange={(id) => setDatos((d) => ({ ...d, marca_id: id }))}
        label="Marca (aplica a todos los productos)"
        placeholder="Selecciona o crea una marca…"
      />

      {/* Costos adicionales */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-steel-400 mb-3">
          Costos adicionales del lote
        </p>

        {/* FOB del lote (calculado del Excel) */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-3 bg-steel-50 border border-steel-200">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
              <svg className="h-3.5 w-3.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-steel-700">FOB del lote (USD)</p>
              <p className="text-[11px] text-steel-400">{totalProductos} producto{totalProductos !== 1 ? 's' : ''} · calculado del Excel</p>
            </div>
          </div>
          <span className="text-sm font-bold tabular-nums text-steel-800">
            ${fobPreliminar.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CostoField
            label="Flete internacional"
            modo={datos.flete_modo}
            value={datos.flete_usd}
            unidadMonto="USD"
            fobRef={fobPreliminar}
            tc={parseNumeric(datos.tipo_cambio)}
            esFob
            onModoChange={(m) => setDatos((d) => ({ ...d, flete_modo: m, flete_usd: '' }))}
            onChange={(v) => setDatos((d) => ({ ...d, flete_usd: v }))}
          />
          <CostoField
            label="Aduana / aranceles"
            modo={datos.aduana_modo}
            value={datos.aduana_bs}
            unidadMonto="Bs"
            fobRef={fobPreliminar}
            tc={parseNumeric(datos.tipo_cambio)}
            onModoChange={(m) => setDatos((d) => ({ ...d, aduana_modo: m, aduana_bs: '' }))}
            onChange={(v) => setDatos((d) => ({ ...d, aduana_bs: v }))}
          />
          <CostoField
            label="Transporte interno"
            modo={datos.transporte_modo}
            value={datos.transporte_interno_bs}
            unidadMonto="Bs"
            fobRef={fobPreliminar}
            tc={parseNumeric(datos.tipo_cambio)}
            onModoChange={(m) => setDatos((d) => ({ ...d, transporte_modo: m, transporte_interno_bs: '' }))}
            onChange={(v) => setDatos((d) => ({ ...d, transporte_interno_bs: v }))}
          />
        </div>
        <p className="text-[11px] text-steel-400 mt-2">
          Estos costos se distribuirán proporcionalmente entre todos los productos según su valor FOB.
        </p>
      </div>

      {/* Margen de ganancia */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[13px] font-medium text-steel-700">Margen de ganancia</label>
          {margen !== margenGlobal && (
            <button
              type="button"
              onClick={() => onMargenChange(margenGlobal)}
              className="text-[11px] font-medium text-brand-600 hover:underline"
            >
              Restablecer global ({((margenGlobal - 1) * 100).toFixed(0)}%)
            </button>
          )}
        </div>
        <div className="relative">
          <Input
            type="number"
            step="1"
            min="1"
            max="500"
            value={((margen - 1) * 100).toFixed(0)}
            onChange={(e) => {
              const pct = parseFloat(e.target.value)
              if (!isNaN(pct) && pct >= 0) onMargenChange(1 + pct / 100)
            }}
          />
          <span className="absolute right-3 top-[9px] text-[12px] font-semibold text-steel-400 pointer-events-none select-none">%</span>
        </div>
      </div>
    </div>
  )
}

function StepPreview({
  items, tc, onPrecioChange, onPrecioEleccion, onProcedenciaChange, onCategoriaChange, onMarcaChange, marcas, productoById, marcaById,
}: {
  items: DraftItem[]
  tc: number
  onPrecioChange: (index: number, val: string) => void
  onPrecioEleccion: (index: number, usarNuevo: boolean) => void
  onProcedenciaChange: (index: number, val: string) => void
  onCategoriaChange: (index: number, val: string) => void
  onMarcaChange: (index: number, marcaId: number | null) => void
  marcas: Marca[]
  // Indexes pre-calculados para que el render no haga Array.find por row.
  productoById: Map<string, Producto>
  marcaById: Map<number, Marca>
}) {
  const fobTotal   = items.reduce((s, i) => s + i.precio_fob_usd * i.cantidad, 0)
  const nuevos     = items.filter((i) => i.es_nuevo).length
  const existentes = items.filter((i) => !i.es_nuevo).length
  const [openHistorial, setOpenHistorial] = useState<number | null>(null)

  const toggleHistorial = (index: number) =>
    setOpenHistorial((prev) => (prev === index ? null : index))

  const handleMarcaChange = (index: number, marcaId: number | null) => {
    onMarcaChange(index, marcaId)
  }

  return (
    <div className="space-y-3">

      {/* ── Aviso tipo de cambio — solo si hay existentes ── */}
      {existentes > 0 && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-[12px]"
          style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}>
          <svg className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#D97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold" style={{ color: '#92400E' }}>Productos existentes — elige qué precio aplicar</p>
            <p className="mt-0.5" style={{ color: '#B45309' }}>
              Para cada producto existente puedes elegir <strong>Nuevo</strong> (precio calculado con costos de esta importación)
              o <strong>Mantener</strong> (conserva el precio de venta actual sin cambios).
              Si no cambias nada, se aplicará el precio nuevo automáticamente.
            </p>
          </div>
        </div>
      )}

      {/* ── Resumen rápido ── */}
      <div className="flex items-center gap-4 flex-wrap text-[12px] text-steel-500">
        <span><strong className="text-steel-700">{items.length}</strong> productos</span>
        <span>·</span>
        <span>FOB total: <strong className="text-steel-700">${fobTotal.toFixed(2)}</strong></span>
        <span>·</span>
        <span>TC: <strong className="text-steel-700">Bs {tc}</strong></span>
        <div className="ml-auto flex gap-1.5">
          {nuevos > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: '#EEF2FF', color: '#4338CA' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 inline-block" />
              {nuevos} nuevo{nuevos !== 1 ? 's' : ''}
            </span>
          )}
          {existentes > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: '#F0FDF4', color: '#15803D' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
              {existentes} existente{existentes !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E8EDF3' }}>
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E8EDF3' }}>
              <th className="px-3 py-2.5 text-left font-semibold text-steel-400 uppercase tracking-wider text-[10px]">Producto</th>
              <th className="px-3 py-2.5 text-left font-semibold text-steel-400 uppercase tracking-wider text-[10px]">Categoría</th>
              <th className="px-3 py-2.5 text-left font-semibold text-steel-400 uppercase tracking-wider text-[10px]">Marca</th>
              <th className="px-3 py-2.5 text-right font-semibold text-steel-400 uppercase tracking-wider text-[10px]">Unidades</th>
              <th className="px-3 py-2.5 text-right font-semibold text-steel-400 uppercase tracking-wider text-[10px]">Stock mín.</th>
              <th className="px-3 py-2.5 text-left font-semibold text-steel-400 uppercase tracking-wider text-[10px]">Ubicación</th>
              <th className="px-3 py-2.5 text-right font-semibold text-steel-400 uppercase tracking-wider text-[10px]">Costo unit. Bs</th>
              {existentes > 0 && (
                <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wider text-[10px]"
                  style={{ background: '#F0F4FF', color: '#818CF8', borderLeft: '1px solid #E0E7FF', borderRight: '1px solid #E0E7FF' }}>
                  Precio anterior
                </th>
              )}
              <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wider text-[10px]"
                style={{ background: '#F0FDF9', color: '#059669', borderRight: '1px solid #D1FAE5' }}>
                Precio de venta
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-steel-400 uppercase tracking-wider text-[10px]">Procedencia</th>
              <th className="px-3 py-2.5 text-center font-semibold text-steel-400 uppercase tracking-wider text-[10px]">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, rowIdx) => {
              const producto = !item.es_nuevo && item.producto_id
                ? productoById.get(item.producto_id)
                : undefined
              const historialAbierto = openHistorial === item._index
              const variacionPct = producto && producto.precio_venta > 0
                ? ((item.precio_venta_final / producto.precio_venta) - 1) * 100
                : null
              // Sub-label: marca del producto existente matcheado (para que el
              // usuario entienda por qué este código se considera existente).
              const marcaMatch = producto?.marcaId != null
                ? marcaById.get(producto.marcaId)
                : undefined

              return (
                <React.Fragment key={item._index}>
                  <tr className="group transition-colors hover:bg-steel-50/60"
                    style={{ borderBottom: (!historialAbierto && rowIdx < items.length - 1) ? '1px solid #F0F0F5' : undefined }}>

                    <td className="px-3 py-2.5">
                      <p className="font-mono text-[11px] font-bold" style={{ color: '#3730A3' }}>
                        {item.codigo_proveedor}
                      </p>
                      <p className="text-[12px] text-steel-700 mt-0.5 leading-tight">{item.nombre}</p>
                    </td>

                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        defaultValue={item.categoria ?? ''}
                        onBlur={(e) => onCategoriaChange(item._index, e.target.value)}
                        placeholder="—"
                        className="w-24 px-1.5 py-0.5 text-xs border border-steel-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
                      />
                    </td>

                    <td className="px-3 py-2.5">
                      <select
                        value={String(item.marcaId ?? '')}
                        onChange={(e) => handleMarcaChange(item._index, e.target.value ? Number(e.target.value) : null)}
                        className="text-[11px] border border-steel-200 rounded px-1.5 py-0.5 bg-white text-steel-700 focus:outline-none focus:ring-1 focus:ring-brand-400 max-w-[130px] w-full"
                      >
                        <option value="">— sin marca —</option>
                        {marcas.map((m) => (
                          <option key={m.id} value={String(m.id)}>{m.nombre}</option>
                        ))}
                      </select>
                      {producto && marcaMatch ? (
                        <p className="text-[10px] mt-0.5 leading-tight" style={{ color: '#15803D' }}>
                          ↻ existente en: <span className="font-semibold">{marcaMatch.nombre}</span>
                        </p>
                      ) : (
                        <p className="text-[10px] mt-0.5 leading-tight text-steel-400">
                          sin coincidencias
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="text-[13px] font-semibold text-steel-700">{item.cantidad}</span>
                      <p className="text-[10px] text-steel-400">uds.</p>
                    </td>

                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="text-[12px] font-medium text-steel-500">{item.stock_minimo}</span>
                    </td>

                    <td className="px-3 py-2.5">
                      <span className="text-[11px] text-steel-500">{item.ubicacion}</span>
                    </td>

                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="text-[12px] font-medium text-steel-700">Bs {item.costo_unitario_total_bs.toFixed(2)}</span>
                      <p className="text-[10px] text-steel-400">${item.precio_fob_usd.toFixed(2)} FOB</p>
                    </td>

                    {existentes > 0 && (
                      <td className="px-3 py-2.5 text-right"
                        style={{ background: '#F8F9FF', borderLeft: '1px solid #E0E7FF', borderRight: '1px solid #E0E7FF' }}>
                        {producto && variacionPct !== null ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[13px] font-semibold tabular-nums text-steel-700">
                              Bs {producto.precio_venta.toFixed(2)}
                            </span>
                            <span className={clsx(
                              'inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md',
                              variacionPct > 0  ? 'bg-amber-50 text-amber-700'
                              : variacionPct < 0 ? 'bg-emerald-50 text-emerald-700'
                              :                   'bg-steel-100 text-steel-500',
                            )}>
                              {variacionPct > 0 ? '↑' : variacionPct < 0 ? '↓' : '='}{' '}
                              {variacionPct > 0 ? '+' : ''}{variacionPct.toFixed(1)}%
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleHistorial(item._index)}
                              className={clsx(
                                'flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors',
                                historialAbierto
                                  ? 'text-indigo-600 bg-indigo-50'
                                  : 'text-steel-400 hover:text-indigo-500 hover:bg-indigo-50',
                              )}
                            >
                              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {historialAbierto ? 'cerrar' : 'historial'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-steel-300">—</span>
                        )}
                      </td>
                    )}

                    <td className="px-4 py-2.5 text-right"
                      style={{ background: item.usar_precio_nuevo ? '#F0FDF9' : '#F9FAFB', borderRight: '1px solid #D1FAE5' }}>
                      <div className="flex flex-col items-end gap-1">
                        {!item.es_nuevo && (
                          <div className="flex items-center rounded-lg overflow-hidden text-[10px] font-semibold"
                            style={{ border: '1px solid #E2E8F0' }}>
                            <button
                              type="button"
                              onClick={() => onPrecioEleccion(item._index, true)}
                              className="px-2 py-1 transition-colors"
                              style={item.usar_precio_nuevo
                                ? { background: '#059669', color: '#fff' }
                                : { background: '#fff', color: '#6B7280' }}
                            >
                              Nuevo
                            </button>
                            <button
                              type="button"
                              onClick={() => onPrecioEleccion(item._index, false)}
                              className="px-2 py-1 transition-colors"
                              style={!item.usar_precio_nuevo
                                ? { background: '#6366F1', color: '#fff' }
                                : { background: '#fff', color: '#6B7280' }}
                            >
                              Mantener
                            </button>
                          </div>
                        )}
                        {item.usar_precio_nuevo ? (
                          <>
                            <input
                              key={`price-${item._index}-nuevo`}
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={item.precio_venta_final.toFixed(2)}
                              onBlur={(e) => onPrecioChange(item._index, e.target.value)}
                              className="w-28 text-right px-2.5 py-1.5 rounded-lg border text-[13px] font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow"
                              style={{ borderColor: '#6EE7B7', color: '#065F46', background: '#fff' }}
                            />
                            {item.precio_venta_final !== item.precio_venta_sugerido && (
                              <p className="text-[10px] tabular-nums" style={{ color: '#6EE7B7' }}>
                                Sug. Bs {item.precio_venta_sugerido.toFixed(2)}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[13px] font-bold tabular-nums px-2.5 py-1.5 rounded-lg"
                              style={{ color: '#4338CA', background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                              Bs {item.precio_venta_final.toFixed(2)}
                            </span>
                            <p className="text-[10px]" style={{ color: '#818CF8' }}>sin cambios</p>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        defaultValue={item.procedencia ?? ''}
                        onBlur={(e) => onProcedenciaChange(item._index, e.target.value)}
                        placeholder="—"
                        className="w-24 px-1.5 py-0.5 text-xs border border-steel-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
                      />
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={item.es_nuevo
                          ? { background: '#EEF2FF', color: '#4F46E5' }
                          : { background: '#F0FDF4', color: '#16A34A' }}>
                        {item.es_nuevo ? 'Nuevo' : 'Existente'}
                      </span>
                    </td>
                  </tr>

                  {historialAbierto && producto && (
                    <tr>
                      <td colSpan={existentes > 0 ? 11 : 10} className="px-3 pb-3 pt-0">
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E0E7FF', background: '#F8F9FF' }}>
                          <div className="flex items-stretch">
                            <div className="flex-1 px-5 py-4" style={{ background: '#EEF2FF', borderRight: '1px solid #C7D2FE' }}>
                              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#6366F1' }}>
                                Precio actual en inventario
                              </p>
                              <p className="text-[22px] font-extrabold tabular-nums leading-none" style={{ color: '#3730A3' }}>
                                Bs {producto.precio_venta.toFixed(2)}
                              </p>
                              <p className="text-[11px] mt-1.5" style={{ color: '#818CF8' }}>
                                Costo: <span className="font-semibold">Bs {producto.precio_costo.toFixed(2)}</span>
                              </p>
                              <p className="text-[10px] mt-1" style={{ color: '#A5B4FC' }}>
                                Desde {new Date(producto.actualizado_en).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <div className="flex flex-col items-center justify-center px-5 gap-1.5" style={{ background: '#F8F9FF' }}>
                              {variacionPct !== null && variacionPct !== 0 ? (
                                <span className={clsx(
                                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold',
                                  variacionPct > 0 ? 'text-amber-700' : 'text-emerald-700',
                                )}
                                  style={{ background: variacionPct > 0 ? '#FEF3C7' : '#D1FAE5', border: `1px solid ${variacionPct > 0 ? '#FCD34D' : '#6EE7B7'}` }}>
                                  {variacionPct > 0 ? '▲' : '▼'} {Math.abs(variacionPct).toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-[10px] text-steel-400 font-medium">sin cambio</span>
                              )}
                              <svg className="h-4 w-4 text-steel-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                              </svg>
                            </div>
                            <div className="flex-1 px-5 py-4" style={{ background: '#ECFDF5', borderLeft: '1px solid #A7F3D0' }}>
                              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#059669' }}>
                                Nuevo precio propuesto
                              </p>
                              <p className="text-[22px] font-extrabold tabular-nums leading-none" style={{ color: '#065F46' }}>
                                Bs {item.precio_venta_final.toFixed(2)}
                              </p>
                              <p className="text-[11px] mt-1.5" style={{ color: '#047857' }}>
                                Costo: <span className="font-semibold">Bs {item.costo_unitario_total_bs.toFixed(2)}</span>
                              </p>
                            </div>
                          </div>
                          {producto.historial_precios.length > 0 && (
                            <div className="px-5 py-3" style={{ borderTop: '1px solid #E0E7FF' }}>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-steel-400 mb-2.5">
                                Historial de precios anteriores
                              </p>
                              <div className="flex items-center flex-wrap gap-2">
                                {[...producto.historial_precios].reverse().slice(0, 5).map((h, i, arr) => {
                                  const opacity = 1 - (i / arr.length) * 0.55
                                  return (
                                    <React.Fragment key={i}>
                                      <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg"
                                        style={{
                                          background: `rgba(238,242,255,${opacity})`,
                                          border: `1px solid rgba(199,210,254,${opacity})`,
                                        }}>
                                        <span className="text-[10px] font-medium" style={{ color: '#818CF8' }}>
                                          {new Date(h.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: '2-digit' })}
                                        </span>
                                        <span className="text-[13px] font-bold tabular-nums leading-tight" style={{ color: '#3730A3', opacity }}>
                                          Bs {h.precio_venta.toFixed(2)}
                                        </span>
                                        <span className="text-[10px]" style={{ color: '#A5B4FC' }}>
                                          TC {h.tipo_cambio.toFixed(2)}
                                        </span>
                                      </div>
                                      {i < arr.length - 1 && (
                                        <svg className="h-3 w-3 shrink-0 text-steel-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      )}
                                    </React.Fragment>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          {producto.historial_precios.length === 0 && (
                            <div className="px-5 py-2.5" style={{ borderTop: '1px solid #E0E7FF' }}>
                              <p className="text-[11px] text-steel-400">Sin historial previo de precios registrado.</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StepConfirmar({
  nuevos, existentes, fobTotal, tc, flete, aduana, transporte, proveedor, pais, fechaLlegada,
}: {
  nuevos: number
  existentes: number
  fobTotal: number
  tc: number
  flete: number
  aduana: number
  transporte: number
  proveedor: string
  pais: string
  fechaLlegada: string
}) {
  const fleteBs = flete * tc
  const costoTotalBs = fobTotal * tc + fleteBs + aduana + transporte

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-4 space-y-2" style={{ background: '#F9FAFB', border: '1px solid #E8EDF3' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-steel-400 mb-3">Resumen</p>
        <Row label="Proveedor" value={proveedor} />
        <Row label="País de origen" value={pais} />
        <Row label="Llegada estimada" value={fechaLlegada ? new Date(fechaLlegada).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
        <Row label="Tipo de cambio" value={`Bs ${tc}`} />
      </div>

      <div className="rounded-xl p-4 space-y-2" style={{ background: '#F9FAFB', border: '1px solid #E8EDF3' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-steel-400 mb-3">Costos del lote</p>
        <Row label="FOB del lote" value={`$${fobTotal.toFixed(2)}  (Bs ${(fobTotal * tc).toFixed(2)})`} />
        <Row label="Flete internacional" value={`$${flete.toFixed(2)}  (Bs ${fleteBs.toFixed(2)})`} />
        <Row label="Aduana / aranceles" value={`Bs ${aduana.toFixed(2)}`} />
        <Row label="Transporte interno" value={`Bs ${transporte.toFixed(2)}`} />
        <div className="pt-2 mt-2" style={{ borderTop: '1px solid #E8EDF3' }}>
          <Row label="Costo total importación" value={`Bs ${costoTotalBs.toFixed(2)}`} bold />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4 text-center" style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
          <p className="text-3xl font-bold" style={{ color: '#4F46E5' }}>{nuevos}</p>
          <p className="text-[12px] font-medium mt-1" style={{ color: '#6366F1' }}>Productos nuevos</p>
          <p className="text-[11px] mt-0.5" style={{ color: '#818CF8' }}>Se crearán en el inventario</p>
        </div>
        <div className="rounded-xl p-4 text-center" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <p className="text-3xl font-bold" style={{ color: '#16A34A' }}>{existentes}</p>
          <p className="text-[12px] font-medium mt-1" style={{ color: '#15803D' }}>Productos existentes</p>
          <p className="text-[11px] mt-0.5" style={{ color: '#22C55E' }}>Stock y precio se actualizarán</p>
        </div>
      </div>

      <p className="text-[12px] text-steel-400 text-center">
        Al confirmar, el inventario se actualizará y podrás imprimir etiquetas del lote.
      </p>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[12px] text-steel-500">{label}</span>
      <span className={clsx('text-[12px] tabular-nums', bold ? 'font-bold text-steel-800' : 'text-steel-700')}>
        {value}
      </span>
    </div>
  )
}

function ModalFooter({
  step, saving, creatingMarcas, hasFile, requiredMapped, hasItems, onBack, onNext, onClose,
}: {
  step: ImportStep
  saving: boolean
  creatingMarcas: boolean
  hasFile: boolean
  requiredMapped: boolean
  hasItems: boolean
  onBack: () => void
  onNext: () => void
  onClose: () => void
}) {
  const isFirst = step === 'upload'
  const isLast  = step === 'confirmar'

  const nextLabel: Record<ImportStep, string> = {
    upload:    'Continuar',
    mapear:    'Continuar',
    datos:     'Calcular costos',
    preview:   'Revisar resumen',
    confirmar: 'Confirmar importación',
  }

  const nextDisabled =
    (step === 'upload'  && !hasFile) ||
    (step === 'mapear'  && !requiredMapped) ||
    (step === 'preview' && !hasItems)

  return (
    <>
      {!isFirst && (
        <Button variant="ghost" onClick={onBack} disabled={saving || creatingMarcas}>
          Atrás
        </Button>
      )}
      <Button variant="secondary" onClick={onClose} disabled={saving || creatingMarcas}>
        Cancelar
      </Button>
      {step !== 'upload' && (
        <Button
          onClick={onNext}
          loading={(saving && isLast) || creatingMarcas}
          disabled={nextDisabled || creatingMarcas}
        >
          {nextLabel[step]}
        </Button>
      )}
    </>
  )
}
