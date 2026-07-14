import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import type * as XLSXType from 'xlsx'
import { Modal, Button, ExcelColumnMapper } from '@/components/ui'
import { imprimirLote } from '@/lib/printLabel'
import type { Producto, Marca } from '@/types'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { ImportProgressView } from './ImportProgressView'

// ─── Tipos internos ───────────────────────────────────────────────────────────

type ImportableKey =
  | 'codigo_universal' | 'codigo_alt1' | 'codigo_alt2'
  | 'nombre' | 'descripcion' | 'procedencia' | 'categoria' | 'marca'
  | 'stock' | 'stock_minimo' | 'piezas' | 'precio_costo' | 'precio_venta'
  | 'almacen' | 'estante' | 'fila' | 'columna'
  | 'tipo_cambio'

interface SystemField {
  key: ImportableKey
  label: string
  required: boolean
  hint?: string
}

interface ColumnMapping {
  columns: string[]
  separator: string
}

type FieldMappings = Partial<Record<ImportableKey, ColumnMapping>>

type Step = 'upload' | 'mapear' | 'preview' | 'importing' | 'etiquetas'

type ProductoImportado = Omit<Producto, 'id' | 'creado_en' | 'actualizado_en'>

export type ImportAction = 'create' | 'update'

export interface ImportResult {
  data: ProductoImportado
  action: ImportAction
  existingId?: string
}

interface LabelConfig {
  selected: boolean
  copias: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SYSTEM_FIELDS: SystemField[] = [
  { key: 'codigo_universal', label: 'Código universal',     required: true,  hint: 'Código principal del producto' },
  { key: 'codigo_alt1',      label: 'Código alternativo 1', required: false, hint: 'Código secundario (caja / proveedor)' },
  { key: 'codigo_alt2',      label: 'Código alternativo 2', required: false },
  { key: 'nombre',           label: 'Nombre',               required: false },
  { key: 'descripcion',      label: 'Descripción',          required: false },
  { key: 'procedencia',      label: 'Procedencia',          required: false, hint: 'País o región de origen' },
  { key: 'categoria',        label: 'Categoría',            required: false },
  { key: 'marca',            label: 'Marca',                required: false },
  { key: 'stock',            label: 'Stock actual',         required: true  },
  { key: 'stock_minimo',     label: 'Stock mínimo',         required: false },
  { key: 'piezas',           label: 'Piezas por unidad',     required: false },
  { key: 'precio_costo',     label: 'Precio costo (Bs)',    required: true  },
  { key: 'precio_venta',     label: 'Precio venta (Bs)',    required: false },
  { key: 'almacen',         label: 'Almacén',              required: false },
  { key: 'estante',         label: 'Estante',              required: false },
  { key: 'fila',            label: 'Fila',                 required: false },
  { key: 'columna',         label: 'Columna',              required: false },
  { key: 'tipo_cambio',     label: 'Tipo de cambio (Bs/$)', required: false },
]


// ─── Helpers ─────────────────────────────────────────────────────────────────

// Acepta números JS directos (de XLSX) o strings con cualquier formato de moneda
function parseNumeric(raw: unknown): number {
  if (typeof raw === 'number') return isFinite(raw) ? raw : 0
  if (typeof raw !== 'string' || !raw.trim()) return 0
  // Elimina símbolos de moneda y espacios, manteniendo dígitos, coma y punto
  const cleaned = raw.trim().replace(/[^0-9.,-]/g, '')
  // Si hay coma como separador decimal (ej. "3,74") la convertimos a punto
  const normalized = cleaned.includes(',') && !cleaned.includes('.')
    ? cleaned.replace(',', '.')
    : cleaned.replace(/,/g, '') // coma como separador de miles
  const n = parseFloat(normalized)
  return isFinite(n) ? n : 0
}

function resolveValue(row: Record<string, unknown>, mapping: ColumnMapping): string {
  return mapping.columns
    .map((col) => String(row[col] ?? '').trim())
    .filter(Boolean)
    .join(mapping.separator || ' ')
}

function parseRow(
  row: Record<string, unknown>,
  mappings: FieldMappings,
  tcManual: number,
): Omit<Producto, 'id' | 'creado_en' | 'actualizado_en'> | null {
  const get = (key: ImportableKey) => {
    const m = mappings[key]
    return m ? resolveValue(row, m) : ''
  }

  // Para campos numéricos, leer el valor raw de la primera columna mapeada
  // para preservar el tipo number que entrega XLSX (evita pérdida de precisión)
  const getRaw = (key: ImportableKey): unknown => {
    const m = mappings[key]
    if (!m || m.columns.length === 0) return ''
    return row[m.columns[0]] ?? ''
  }

  const codigo_universal = get('codigo_universal')
  const nombre = get('nombre')
  if (!codigo_universal) return null

  const precio_costo = parseNumeric(getRaw('precio_costo'))
  const precio_venta = parseNumeric(getRaw('precio_venta'))
  const tipo_cambio_excel = parseNumeric(getRaw('tipo_cambio'))
  const tc = tipo_cambio_excel > 0 ? tipo_cambio_excel : tcManual

  return {
    codigo_universal,
    codigos_alternativos: [get('codigo_alt1'), get('codigo_alt2')],
    nombre,
    descripcion:  get('descripcion'),
    procedencia:  get('procedencia'),
    categoria:    get('categoria') || 'Otro',
    marca:        get('marca') || '',
    vehiculo:     '',
    unidad:       'pieza',
    stock:        Math.round(parseNumeric(getRaw('stock'))),
    stock_minimo: Math.round(parseNumeric(getRaw('stock_minimo'))) || 5,
    piezas:       Math.round(parseNumeric(getRaw('piezas'))) || 1,
    precio_costo,
    precio_venta,
    conversionABs: tc,
    historial_precios: precio_costo > 0 || precio_venta > 0
      ? [{ fecha: new Date().toISOString(), precio_costo, precio_venta, tipo_cambio: tc, nota: 'Importado desde Excel' }]
      : [],
    almacen:       get('almacen') || 'Almacén Central',
    estante:       get('estante') || '',
    fila:          get('fila') || '',
    columna:       get('columna') || '',
    estado:       'activo',
    proveedor_id: '',
  }
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'upload',    label: 'Subir archivo' },
    { id: 'mapear',    label: 'Mapear columnas' },
    { id: 'preview',   label: 'Vista previa' },
    { id: 'etiquetas', label: 'Etiquetas' },
  ]
  // 'importing' es una fase transitoria entre preview y etiquetas:
  // visualmente se muestra como si el usuario siguiera en "Vista previa".
  const displayStep = step === 'importing' ? 'preview' : step
  const idx = steps.findIndex((s) => s.id === displayStep)

  return (
    <div className="flex items-center gap-0 mb-5">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center">
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
            )}>{s.label}</span>
            {/* Mobile: show label only for active step */}
            {i === idx && (
              <span className="sm:hidden text-sm font-medium text-steel-900">{s.label}</span>
            )}
          </div>
          {i < steps.length - 1 && (
            <div className={clsx('h-px w-4 sm:w-8 mx-1.5 sm:mx-2', i < idx ? 'bg-brand-400' : 'bg-steel-200')} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface ImportarExcelModalProps {
  open: boolean
  onClose: () => void
  onImport: (
    results: ImportResult[],
    onProgress?: (current: number, total: number) => void,
  ) => Promise<void>
  productosExistentes: Producto[]
  marcas: Marca[]
}

async function resolveMarcaId(
  nombre: string,
  marcas: Marca[],
): Promise<number | null> {
  if (!nombre.trim()) return null
  const norm = nombre.trim().toLowerCase()
  const existing = marcas.find((m) => m.nombre.toLowerCase() === norm)
  if (existing) return existing.id
  const res = await api.post<{ id: number; nombre: string }>('/marca', { nombre: nombre.trim() })
  return res.id
}

export function ImportarExcelModal({ open, onClose, onImport, productosExistentes, marcas }: ImportarExcelModalProps) {
  const [step, setStep]               = useState<Step>('upload')
  const [excelCols, setExcelCols]     = useState<string[]>([])
  const [rawRows, setRawRows]         = useState<Record<string, unknown>[]>([])
  const [fileName, setFileName]       = useState('')
  const [mappings, setMappings]       = useState<FieldMappings>({})
  const [, setPreviewActions] = useState<Record<string, ImportAction>>({})
  const [procedenciaOverrides, setProcedenciaOverrides] = useState<Record<number, string>>({})
  const [categoriaOverrides, setCategoriaOverrides] = useState<Record<number, string>>({})
  const [tipoCambio, setTipoCambio]   = useState('6.96')
  const [usarTipoCambioGlobal, setUsarTipoCambioGlobal] = useState(true)
const [dragOver, setDragOver]       = useState(false)
  const [importing, setImporting]     = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [importados, setImportados]   = useState<ProductoImportado[]>([])
  const [labelConfig, setLabelConfig] = useState<Record<string, LabelConfig>>({})
  const [printing, setPrinting]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo<(ProductoImportado | null)[]>(() => {
    if (rawRows.length === 0) return []
    const tc = usarTipoCambioGlobal ? (parseFloat(tipoCambio) || 6.96) : 0
    return rawRows.map((row) => parseRow(row, mappings, tc))
  }, [rawRows, mappings, tipoCambio, usarTipoCambioGlobal])

  const tieneTipoCambioEnExcel = useMemo(() => {
    return (mappings['tipo_cambio']?.columns.length ?? 0) > 0
  }, [mappings])

  useEffect(() => {
    setUsarTipoCambioGlobal(!tieneTipoCambioEnExcel)
  }, [tieneTipoCambioEnExcel])

  const excelKey = (codigo: string, marca: string) => `${codigo}|${marca.toLowerCase().trim()}`

  // Mapa de códigos existentes para búsqueda rápida — clave compuesta codigo|marca
  const codigosMap = useMemo(() => {
    const map = new Map<string, Producto>()
    productosExistentes.forEach((p) => {
      const marcaNombre = (marcas.find((m) => m.id === p.marcaId)?.nombre ?? '').toLowerCase().trim()
      const makeKey = (code: string) => excelKey(code, marcaNombre)
      map.set(makeKey(p.codigo_universal), p)
      p.codigos_alternativos.forEach((code) => {
        if (code) map.set(makeKey(code), p)
      })
    })
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productosExistentes, marcas])

  // Detectar duplicados cuando se parsean los productos
  const duplicates = useMemo(() => {
    const dupMap = new Map<string, { existing: Producto; parsed: ProductoImportado }>()
    parsed.forEach((p) => {
      if (!p) return
      const existing = codigosMap.get(excelKey(p.codigo_universal, p.marca ?? ''))
      if (existing) {
        dupMap.set(p.codigo_universal, { existing, parsed: p })
      }
    })
    return dupMap
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, codigosMap])

  const reset = () => {
    setStep('upload'); setExcelCols([]); setRawRows([])
    setFileName(''); setMappings({})
    setPreviewActions({}); setImportados([]); setLabelConfig({})
    setImportProgress({ current: 0, total: 0 })
    setTipoCambio('6.96')
    setUsarTipoCambioGlobal(true)
    setProcedenciaOverrides({})
    setCategoriaOverrides({})
  }

  const handleClose = () => { reset(); onClose() }

  // ── Step 1: leer archivo ────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const XLSX: typeof XLSXType = await import('xlsx')
      const data = e.target?.result
      const wb = XLSX.read(data, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      if (rows.length === 0) return
      setRawRows(rows)
      setExcelCols(Object.keys(rows[0]))
      setStep('mapear')
    }
    reader.readAsBinaryString(file)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  // ── Step 2: mapeos ──────────────────────────────────────────────────────────
  const addColumn = (fieldKey: string, col: string) => {
    setMappings((prev) => {
      const existing = prev[fieldKey as ImportableKey] ?? { columns: [], separator: '-' }
      if (existing.columns.includes(col)) return prev
      return { ...prev, [fieldKey]: { ...existing, columns: [...existing.columns, col] } }
    })
  }

  const removeColumn = (fieldKey: string, col: string) => {
    setMappings((prev) => {
      const existing = prev[fieldKey as ImportableKey]
      if (!existing) return prev
      const columns = existing.columns.filter((c) => c !== col)
      if (columns.length === 0) { const next = { ...prev }; delete next[fieldKey as ImportableKey]; return next }
      return { ...prev, [fieldKey]: { ...existing, columns } }
    })
  }

  const setSeparator = (fieldKey: string, sep: string) => {
    setMappings((prev) => {
      const existing = prev[fieldKey as ImportableKey]
      if (!existing) return prev
      return { ...prev, [fieldKey]: { ...existing, separator: sep } }
    })
  }

  const handleGoToPreview = () => {
    const actions: Record<string, ImportAction> = {}
    parsed.forEach((p) => {
      if (p) {
        const exists = codigosMap.has(excelKey(p.codigo_universal, p.marca ?? ''))
        actions[p.codigo_universal] = exists ? 'update' : 'create'
      }
    })
    setPreviewActions(actions)
    setStep('preview')
  }

  const requiredMapped = SYSTEM_FIELDS
    .filter((f) => f.required)
    .every((f) => (mappings[f.key]?.columns.length ?? 0) > 0)

  // ── Step 3: importar ────────────────────────────────────────────────────────
  const handleImport = async () => {
    setImporting(true)

    const columnaPiezasMapeada = (mappings['piezas']?.columns.length ?? 0) > 0

    const results: ImportResult[] = parsed
      .map((p, i) => [p, i] as [ProductoImportado | null, number])
      .filter((x): x is [ProductoImportado, number] => x[0] !== null)
      .map(([p, i]) => {
        const procedencia = procedenciaOverrides[i] !== undefined
          ? procedenciaOverrides[i]
          : (p.procedencia ?? '')
        const categoria = categoriaOverrides[i] !== undefined
          ? categoriaOverrides[i]
          : (p.categoria ?? 'Otro')
        const existing = codigosMap.get(excelKey(p.codigo_universal, p.marca ?? ''))
        const action: ImportAction = existing ? 'update' : 'create'
        const tcFromExcel = p.conversionABs ?? 0
        const tc = usarTipoCambioGlobal
          ? (parseFloat(tipoCambio) || 6.96)
          : tcFromExcel > 0 ? tcFromExcel : 6.96

        if (action === 'update' && existing) {
          // Acumular al stock existente en vez de sobrescribirlo: el Excel
          // representa un nuevo ingreso, no un reemplazo del inventario.
          const stockParaEnviar = (existing.stock ?? 0) + p.stock
          return {
            data: {
              ...p,
              procedencia,
              categoria,
              marcaId: p.marcaId ?? existing.marcaId ?? null,
              stock: stockParaEnviar,
              conversionABs: usarTipoCambioGlobal ? tc : (tcFromExcel > 0 ? tcFromExcel : 6.96),
              piezas: columnaPiezasMapeada ? p.piezas : existing.piezas ?? 1,
              historial_precios: [
                ...existing.historial_precios,
                {
                  fecha: new Date().toISOString(),
                  precio_costo: p.precio_costo,
                  precio_venta: p.precio_venta,
                  tipo_cambio: tc,
                  nota: 'Actualizado desde Excel',
                },
              ],
            },
            action: 'update' as ImportAction,
            existingId: existing.id,
          }
        }

        return {
          data: {
            ...p,
            procedencia,
            categoria,
            conversionABs: tc,
            historial_precios: p.precio_costo > 0 || p.precio_venta > 0
              ? [{ fecha: new Date().toISOString(), precio_costo: p.precio_costo, precio_venta: p.precio_venta, tipo_cambio: tc, nota: 'Importado desde Excel' }]
              : [],
          },
          action: 'create' as ImportAction,
        }
      })

    // Activar vista de progreso antes de la resolución de marcas: así el
    // usuario ve la UI de carga de inmediato y la resolución de marcaId
    // (que puede ser lenta si hay marcas nuevas) ocurre "en background".
    setImportProgress({ current: 0, total: results.length })
    setStep('importing')

    const marcaCache = new Map<string, number | null>()
    for (const result of results) {
      const nombreMarca = ((result.data as unknown as { marca?: string }).marca ?? '').trim()
      if (!nombreMarca) continue
      const norm = nombreMarca.toLowerCase()
      if (!marcaCache.has(norm)) {
        marcaCache.set(norm, await resolveMarcaId(nombreMarca, marcas))
      }
      result.data.marcaId = marcaCache.get(norm) ?? null
    }

    await onImport(
      results,
      (current, total) => setImportProgress({ current, total }),
    )

    // Preparar config de etiquetas
    const config: Record<string, LabelConfig> = {}
    results.forEach((r) => {
      config[r.data.codigo_universal] = { selected: true, copias: Math.max(1, r.data.stock) }
    })
    setImportados(results.map((r) => r.data))
    setLabelConfig(config)
    setImporting(false)
    setStep('etiquetas')
  }

  // ── Step 4: imprimir etiquetas ───────────────────────────────────────────────
  const todosSeleccionados = importados.every((p) => labelConfig[p.codigo_universal]?.selected)
  const algunoSeleccionado = importados.some((p) => labelConfig[p.codigo_universal]?.selected)

  const toggleTodos = () => {
    const nuevoEstado = !todosSeleccionados
    setLabelConfig((prev) => {
      const next = { ...prev }
      importados.forEach((p) => { next[p.codigo_universal] = { ...next[p.codigo_universal], selected: nuevoEstado } })
      return next
    })
  }

  const toggleProducto = (codigo: string) => {
    setLabelConfig((prev) => ({
      ...prev,
      [codigo]: { ...prev[codigo], selected: !prev[codigo].selected },
    }))
  }

  const setCopias = (codigo: string, copias: number) => {
    setLabelConfig((prev) => ({
      ...prev,
      [codigo]: { ...prev[codigo], copias: Math.max(1, Math.min(999, copias)) },
    }))
  }

  const handlePrintEtiquetas = async () => {
    setPrinting(true)
    const items = importados
      .filter((p) => labelConfig[p.codigo_universal]?.selected)
      .map((p) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        producto: p as any,
        copias: labelConfig[p.codigo_universal]?.copias ?? 1,
      }))
    await imprimirLote(items)
    setPrinting(false)
  }

  const totalEtiquetas = importados
    .filter((p) => labelConfig[p.codigo_universal]?.selected)
    .reduce((sum, p) => sum + (labelConfig[p.codigo_universal]?.copias ?? 1), 0)

  const validCount   = parsed.filter(Boolean).length
  const invalidCount = parsed.length - validCount

  // ─── Render ────────────────────────────────────────────────────────────────
  const footer = (
    <>
      {step !== 'upload' && step !== 'etiquetas' && step !== 'importing' && (
        <Button variant="ghost" onClick={() => setStep(step === 'preview' ? 'mapear' : 'upload')} disabled={importing}>
          Atrás
        </Button>
      )}
      {step !== 'etiquetas' && step !== 'importing' && (
        <Button variant="secondary" onClick={handleClose} disabled={importing}>Cancelar</Button>
      )}
      {step === 'mapear' && (
        <Button onClick={handleGoToPreview} disabled={!requiredMapped}>Ver vista previa</Button>
      )}
      {step === 'preview' && (
        <Button onClick={() => void handleImport()} loading={importing} disabled={validCount === 0}>
          Importar {validCount} producto{validCount !== 1 ? 's' : ''}
        </Button>
      )}
      {step === 'importing' && (
        <Button loading disabled>
          Importando…
        </Button>
      )}
      {step === 'etiquetas' && (
        <>
          <Button variant="secondary" onClick={handleClose} className="text-xs sm:text-sm">
            <span className="hidden xs:inline">Omitir e ir al </span>inventario
          </Button>
          <Button
            onClick={() => void handlePrintEtiquetas()}
            loading={printing}
            disabled={!algunoSeleccionado}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            }
          >
            Imprimir {totalEtiquetas} etiqueta{totalEtiquetas !== 1 ? 's' : ''}
          </Button>
        </>
      )}
    </>
  )

  return (
    <Modal open={open} onClose={handleClose} title="Importar productos desde Excel" size="xl" footer={footer}>
      <Stepper step={step} />

      {/* ── STEP 1: UPLOAD ── */}
      {step === 'upload' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={clsx(
            'flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl p-6 sm:p-12 cursor-pointer transition-colors',
            dragOver ? 'border-brand-400 bg-brand-50' : 'border-steel-200 bg-steel-50 hover:border-brand-300 hover:bg-brand-50/50',
          )}
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
          <input
            ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]) }}
          />
        </div>
      )}

      {/* ── STEP 2: MAPEAR ── */}
      {step === 'mapear' && (
        <ExcelColumnMapper
          fields={SYSTEM_FIELDS}
          excelCols={excelCols}
          mappings={mappings}
          fileName={fileName}
          rowCount={rawRows.length}
          onAddColumn={addColumn}
          onRemoveColumn={removeColumn}
          onSetSeparator={setSeparator}
        />
      )}

      {/* ── STEP 4: ETIQUETAS ── */}
      {step === 'etiquetas' && (
        <div>
          <div className="mb-3">
            <p className="text-sm text-steel-600">Selecciona los productos y ajusta la cantidad de etiquetas.</p>
            <p className="text-xs text-steel-400 mt-0.5">Las cantidades se pre-llenaron con el stock importado.</p>
          </div>

          {/* Cabecera con "seleccionar todo" */}
          <div className="flex items-center gap-3 px-3 py-2 bg-steel-50 rounded-t-lg border border-b-0 border-steel-200">
            <input
              type="checkbox"
              checked={todosSeleccionados}
              onChange={toggleTodos}
              className="h-4 w-4 rounded border-steel-300 text-brand-600 cursor-pointer shrink-0"
            />
            <span className="text-xs font-medium text-steel-500 flex-1 min-w-0 truncate">
              {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </span>
            <span className="text-xs text-steel-400 shrink-0">Cant.</span>
          </div>

          {/* Lista de productos */}
          <div className="border border-steel-200 rounded-b-lg divide-y divide-steel-100 max-h-72 overflow-y-auto">
            {importados.map((p) => {
              const cfg = labelConfig[p.codigo_universal] ?? { selected: false, copias: 1 }
              return (
                <div
                  key={p.codigo_universal}
                  className={clsx(
                    'flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 transition-colors',
                    cfg.selected ? 'bg-brand-50/30' : 'bg-white',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={cfg.selected}
                    onChange={() => toggleProducto(p.codigo_universal)}
                    className="h-4 w-4 rounded border-steel-300 text-brand-600 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-steel-900 truncate">{p.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                        {p.codigo_universal}
                      </span>
                      <span className="text-xs text-steel-400">{p.marca}</span>
                      <span className="text-xs text-steel-400">· Stock: {p.stock}</span>
                    </div>
                  </div>

                  {/* Selector de copias — fila propia en móvil */}
                  <div className="flex items-center gap-1 w-full sm:w-auto pl-7 sm:pl-0">
                    <button
                      onClick={() => setCopias(p.codigo_universal, cfg.copias - 1)}
                      disabled={!cfg.selected}
                      className="h-7 w-7 rounded border border-steel-200 flex items-center justify-center text-steel-500 hover:bg-steel-50 disabled:opacity-30 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={cfg.copias}
                      onChange={(e) => setCopias(p.codigo_universal, Number(e.target.value))}
                      disabled={!cfg.selected}
                      className="w-14 h-7 text-center text-sm font-medium border border-steel-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-30 disabled:bg-steel-50"
                    />
                    <button
                      onClick={() => setCopias(p.codigo_universal, cfg.copias + 1)}
                      disabled={!cfg.selected}
                      className="h-7 w-7 rounded border border-steel-200 flex items-center justify-center text-steel-500 hover:bg-steel-50 disabled:opacity-30 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {algunoSeleccionado && (
            <p className="mt-3 text-xs text-steel-400 text-center">
              {importados.filter((p) => labelConfig[p.codigo_universal]?.selected).length} producto{importados.filter((p) => labelConfig[p.codigo_universal]?.selected).length !== 1 ? 's' : ''} seleccionado{importados.filter((p) => labelConfig[p.codigo_universal]?.selected).length !== 1 ? 's' : ''} · {totalEtiquetas} etiqueta{totalEtiquetas !== 1 ? 's' : ''} en total
            </p>
          )}
        </div>
      )}

      {/* ── STEP 3: PREVIEW ── */}
      {step === 'preview' && (
        <div>
          {/* Tipo de cambio input */}
          {!tieneTipoCambioEnExcel ? (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={usarTipoCambioGlobal}
                    onChange={(e) => setUsarTipoCambioGlobal(e.target.checked)}
                    className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-semibold text-amber-800">Aplicar tipo de cambio global</span>
                </label>
              </div>
              {usarTipoCambioGlobal && (
                <div className="flex items-center gap-3 ml-7">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tipoCambio}
                    onChange={(e) => setTipoCambio(e.target.value)}
                    className="w-24 px-2 py-1.5 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <span className="text-xs text-amber-600">Bs/USD · Se aplicará a todos los productos importados</span>
                </div>
              )}
              {!usarTipoCambioGlobal && (
                <p className="ml-7 text-xs text-amber-600">No se guardará tipo de cambio para los productos importados</p>
              )}
            </div>
          ) : (
            <div className="mb-4 px-3 py-2 bg-steel-50 border border-steel-200 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-semibold text-steel-700">Tipo de cambio por producto</span>
              </div>
              <p className="text-[11px] text-steel-500 mb-2 ml-6">
                Se usará el valor de la columna "Tipo de cambio" mapeada en el Excel para cada producto.
              </p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={usarTipoCambioGlobal}
                    onChange={(e) => setUsarTipoCambioGlobal(e.target.checked)}
                    className="h-4 w-4 rounded border-steel-400 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-xs font-semibold text-steel-700">Sobrescribir con tipo de cambio global</span>
                </label>
              </div>
              {usarTipoCambioGlobal && (
                <div className="flex items-center gap-3 mt-2 ml-7">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tipoCambio}
                    onChange={(e) => setTipoCambio(e.target.value)}
                    className="w-24 px-2 py-1.5 text-sm border border-steel-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                  <span className="text-xs text-steel-500">Bs/USD · Reemplazará el tipo de cambio de todos los productos</span>
                </div>
              )}
            </div>
          )}

<div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-green-800"><strong>{validCount}</strong> válidos</span>
            </div>
            {duplicates.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm text-amber-800"><strong>{duplicates.size}</strong> duplicados</span>
              </div>
            )}
            {invalidCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-sm text-red-700"><strong>{invalidCount}</strong> omitidos</span>
              </div>
            )}
          </div>

          

          <div className="overflow-x-auto rounded-xl border border-steel-200 max-h-80 overflow-y-auto">
            <table className="text-xs" style={{ minWidth: 1180 }}>
              <thead className="sticky top-0 bg-steel-50 border-b border-steel-200 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-steel-500 w-6">#</th>
                  <th className="px-3 py-2 text-left font-medium text-steel-500 whitespace-nowrap">Código *</th>
                  <th className="px-3 py-2 text-left font-medium text-steel-500">Nombre</th>
                  <th className="px-3 py-2 text-left font-medium text-steel-500">Categoría</th>
                  <th className="px-3 py-2 text-left font-medium text-steel-500">Marca</th>
                  <th className="px-3 py-2 text-right font-medium text-steel-500 whitespace-nowrap">Stock *</th>
                  <th className="px-3 py-2 text-right font-medium text-steel-500 whitespace-nowrap">Pzas</th>
                  <th className="px-3 py-2 text-right font-medium text-steel-500 whitespace-nowrap">P. Costo *</th>
                  <th className="px-3 py-2 text-right font-medium text-steel-500 whitespace-nowrap">P. Venta</th>
                  <th className="px-3 py-2 text-right font-medium text-steel-500 whitespace-nowrap">T.C.</th>
                  <th className="px-3 py-2 text-left font-medium text-steel-500 whitespace-nowrap">Procedencia</th>
                  <th className="px-3 py-2 text-center font-medium text-steel-500 whitespace-nowrap">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-100">
                {parsed.map((row, i) => {
                  if (row === null) {
                    return (
                      <tr key={i} className="bg-red-50/50">
                        <td className="px-3 py-2 text-steel-400">{i + 1}</td>
                        <td colSpan={11} className="px-3 py-2 text-red-400 italic">
                          Fila omitida — sin código universal
                        </td>
                      </tr>
                    )
                  }

                  const existing = codigosMap.get(excelKey(row.codigo_universal, row.marca ?? ''))
                  const isDuplicate = !!existing

                  return (
                    <tr key={i} className={clsx('hover:bg-steel-50', isDuplicate && 'bg-amber-50/30')}>
                      <td className="px-3 py-2 text-steel-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-brand-600 whitespace-nowrap">{row.codigo_universal}</span>
                          {isDuplicate && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                              DUPLICADO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-steel-900 max-w-[140px] truncate">{row.nombre || '—'}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={categoriaOverrides[i] !== undefined ? categoriaOverrides[i] : (row.categoria ?? '')}
                          onChange={(e) => setCategoriaOverrides((prev) => ({ ...prev, [i]: e.target.value }))}
                          placeholder="Otro"
                          className="w-28 px-1.5 py-0.5 text-xs border border-steel-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
                        />
                      </td>
                      <td className="px-3 py-2 text-steel-600 whitespace-nowrap">{row.marca || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-steel-900">{row.stock}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {isDuplicate && existing ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[11px] font-bold text-brand-600">{row.piezas ?? 1}</span>
                            <span className="text-[9px] text-steel-400">actual: {existing.piezas ?? 1}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-steel-700">{row.piezas ?? 1}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-steel-900">
                        {row.precio_costo > 0 ? row.precio_costo.toFixed(2) : <span className="text-red-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-steel-600">
                        {row.precio_venta > 0 ? row.precio_venta.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-steel-500">
                        {(row.conversionABs ?? 0) > 0 ? row.conversionABs!.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={procedenciaOverrides[i] !== undefined ? procedenciaOverrides[i] : (row.procedencia ?? '')}
                          onChange={(e) => setProcedenciaOverrides((prev) => ({ ...prev, [i]: e.target.value }))}
                          placeholder="—"
                          className="w-24 px-1.5 py-0.5 text-xs border border-steel-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isDuplicate ? (
                          <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded">
                            Actualizar
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                            Nuevo
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>


        </div>
      )}

      {/* ── STEP 3.5: IMPORTING (progress overlay) ── */}
      {step === 'importing' && (
        <ImportProgressView
          current={importProgress.current}
          total={importProgress.total}
        />
      )}
    </Modal>
  )
}
