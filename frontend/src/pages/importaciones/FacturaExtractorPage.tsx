import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { MainLayout } from '@/components/layout/MainLayout'
import { PageTopBar } from '@/components/layout/PageTopBar'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

type Estado = 'idle' | 'procesando' | 'listo'

const MAX_ARCHIVOS = 10
const MAX_BYTES_POR_ARCHIVO = 20 * 1024 * 1024 // 20 MB

const EXTENSIONES_VALIDAS = [
  'xlsx', 'xls', 'pdf',
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'heic', 'heif',
] as const

function esExtensionValida(nombre: string): boolean {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
  return (EXTENSIONES_VALIDAS as readonly string[]).includes(ext)
}

function iconoPara(nombre: string): string {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'ti-file-type-pdf'
  if (['xlsx', 'xls'].includes(ext)) return 'ti-file-spreadsheet'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return 'ti-photo'
  return 'ti-file'
}

export function FacturaExtractorPage() {
  const [archivos, setArchivos] = useState<File[]>([])
  const [estado, setEstado] = useState<Estado>('idle')
  const [dragging, setDragging] = useState(false)
  const [nombreDescargado, setNombreDescargado] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function agregarArchivos(files: FileList | File[]) {
    const nuevos = Array.from(files)
    const rechazados: string[] = []
    const validos: File[] = []

    for (const f of nuevos) {
      if (!esExtensionValida(f.name)) {
        rechazados.push(f.name)
        continue
      }
      if (f.size > MAX_BYTES_POR_ARCHIVO) {
        rechazados.push(`${f.name} (supera 20 MB)`)
        continue
      }
      validos.push(f)
    }

    if (rechazados.length > 0) {
      toast.error(`Archivos rechazados: ${rechazados.join(', ')}`)
    }

    if (validos.length === 0) return

    setArchivos((prev) => {
      const total = prev.length + validos.length
      if (total > MAX_ARCHIVOS) {
        toast.error(`Máximo ${MAX_ARCHIVOS} archivos (ya tenés ${prev.length}).`)
        return prev
      }
      return [...prev, ...validos]
    })
    setEstado('idle')
    setNombreDescargado('')
  }

  function quitarArchivo(index: number) {
    setArchivos((prev) => prev.filter((_, i) => i !== index))
    setEstado('idle')
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      agregarArchivos(e.target.files)
    }
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      agregarArchivos(e.dataTransfer.files)
    }
  }

  async function leerError(res: Response): Promise<string> {
    const text = await res.text().catch(() => '')
    try {
      const json = JSON.parse(text) as { error?: string }
      if (json.error) return json.error
    } catch { /* usar msg por defecto */ }
    return `Error ${res.status}`
  }

  function esperar(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // El backend procesa la factura en background (puede tardar minutos con PDFs
  // largos) y devuelve un jobId al toque. Acá se hace polling del estado en vez
  // de esperar una sola respuesta larga — así el proxy de Railway nunca corta
  // la conexión por timeout (eso generaba 502 antes).
  const MAX_ESPERA_MS = 10 * 60 * 1000 // 10 minutos
  const INTERVALO_POLL_MS = 3000

  async function procesar() {
    if (archivos.length === 0 || estado === 'procesando') return
    setEstado('procesando')

    try {
      const formData = new FormData()
      archivos.forEach((f) => formData.append('files', f))

      const res = await fetch(`${BASE_URL}/factura/extraer`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) throw new Error(await leerError(res))

      const { jobId } = await res.json() as { jobId: string }

      const desde = Date.now()
      let terminado = false

      while (!terminado) {
        if (Date.now() - desde > MAX_ESPERA_MS) {
          throw new Error('El procesamiento está tardando demasiado. Intentá de nuevo.')
        }

        await esperar(INTERVALO_POLL_MS)

        const estadoRes = await fetch(`${BASE_URL}/factura/extraer/${jobId}/estado`, {
          credentials: 'include',
        })
        if (!estadoRes.ok) throw new Error(await leerError(estadoRes))

        const { estado: estadoJob, error } = await estadoRes.json() as {
          estado: 'Pendiente' | 'Procesando' | 'Completado' | 'Error'
          error?: string
        }

        if (estadoJob === 'Error') throw new Error(error ?? 'Error al procesar los archivos')
        if (estadoJob === 'Completado') terminado = true
      }

      const resultadoRes = await fetch(`${BASE_URL}/factura/extraer/${jobId}/resultado`, {
        credentials: 'include',
      })
      if (!resultadoRes.ok) throw new Error(await leerError(resultadoRes))

      const blob = await resultadoRes.blob()
      const nombre = archivos.length === 1
        ? archivos[0].name.replace(/\.[^.]+$/, '') + '_limpio.xlsx'
        : `factura_procesada_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.xlsx`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nombre
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setNombreDescargado(nombre)
      setEstado('listo')
      toast.success(`Descargando ${nombre}`)
    } catch (err) {
      setEstado('idle')
      toast.error(err instanceof Error ? err.message : 'Error al procesar los archivos')
    }
  }

  function limpiar() {
    setArchivos([])
    setEstado('idle')
    setNombreDescargado('')
  }

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const tieneArchivos = archivos.length > 0

  return (
    <MainLayout>
      <div className="bg-[#F7F7F7] min-h-screen">

        <PageTopBar section="Importaciones" title="Extractor IA" />

        <div className="px-7 py-6 max-w-[1400px] mx-auto">

          {/* Page Header */}
          <div className="flex items-center gap-3.5 mb-8">
            <div
              className="w-12 h-12 bg-gradient-to-br from-[#780e18] to-[#D4A333] rounded-2xl flex items-center justify-center text-white shrink-0"
              style={{ boxShadow: '0 6px 18px rgba(120,14,24,0.28)' }}
            >
              <i className="ti ti-sparkles text-2xl" />
            </div>
            <div>
              <h2
                className="font-semibold text-[30px] text-[#2D2B2A] leading-none"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Extractor IA de facturas
              </h2>
              <p className="text-[13.5px] text-[#7A7571] mt-1.5">
                Subí una o varias fotos/archivos de la misma factura y la IA arma una sola tabla
              </p>
            </div>
          </div>

          {/* Contenido — 2 columnas en desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start max-w-5xl">

            {/* Columna izquierda: zona de trabajo */}
            <div className="space-y-4">

              {/* Drop zone */}
              <div
                onClick={() => estado !== 'procesando' && !tieneArchivos && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); if (!tieneArchivos) setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={[
                  'relative flex flex-col items-center justify-center gap-4',
                  'border-2 border-dashed rounded-xl transition-all duration-150',
                  tieneArchivos
                    ? 'border-[#B8DCCA] bg-[#FAF5EE] cursor-default py-6 px-4'
                    : dragging
                      ? 'border-[#780e18] bg-[#FAF5EE] cursor-copy scale-[1.01] min-h-[260px]'
                      : 'border-[#D0CBC4] bg-white cursor-pointer hover:border-[#780e18]/50 hover:bg-[#FAF5EE]/60 min-h-[260px]',
                ].join(' ')}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                  className="hidden"
                  onChange={onInputChange}
                />

                {estado === 'procesando' ? (
                  <ProcessingState />
                ) : estado === 'listo' ? (
                  <SuccessState nombre={nombreDescargado} onNew={limpiar} />
                ) : tieneArchivos ? (
                  <FilesReadyState
                    archivos={archivos}
                    fmtSize={fmtSize}
                    onQuitar={quitarArchivo}
                    onAgregar={() => inputRef.current?.click()}
                    puedeAgregar={archivos.length < MAX_ARCHIVOS}
                  />
                ) : (
                  <EmptyDropState dragging={dragging} />
                )}
              </div>

              {/* Botón procesar */}
              {estado !== 'listo' && (
                <button
                  onClick={() => void procesar()}
                  disabled={!tieneArchivos || estado === 'procesando'}
                  className={[
                    'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold transition-all duration-150',
                    !tieneArchivos || estado === 'procesando'
                      ? 'bg-[#EDE8E3] text-[#7A7571] cursor-not-allowed'
                      : 'bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] shadow-sm active:scale-[0.99]',
                  ].join(' ')}
                >
                  {estado === 'procesando' ? (
                    <>
                      <i className="ti ti-loader-2 animate-spin text-[17px]" />
                      Procesando con IA…
                    </>
                  ) : (
                    <>
                      <i className="ti ti-sparkles text-[17px]" />
                      {tieneArchivos
                        ? `Procesar ${archivos.length} archivo${archivos.length > 1 ? 's' : ''} con IA`
                        : 'Selecciona uno o más archivos para continuar'}
                    </>
                  )}
                </button>
              )}

              {/* Formatos soportados */}
              <div className="flex items-center gap-2 flex-wrap px-1">
                <span className="text-[11px] text-[#7A7571] font-medium">Formatos:</span>
                {EXTENSIONES_VALIDAS.map((f) => (
                  <span key={f} className="text-[11px] font-semibold text-[#4A4744] bg-[#F5F0EB] border border-[#D0CBC4] px-2 py-0.5 rounded font-mono">
                    .{f}
                  </span>
                ))}
                <span className="text-[11px] text-[#7A7571] font-medium ml-2">
                  · Máx {MAX_ARCHIVOS} archivos · 20 MB c/u
                </span>
              </div>
            </div>

            {/* Columna derecha: info */}
            <div className="space-y-4">

              {/* Cómo funciona */}
              <div className="bg-white rounded-xl border border-[#D0CBC4] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-[#F5E8D4] flex items-center justify-center shrink-0">
                    <i className="ti ti-info-circle text-[#780e18] text-[14px]" />
                  </div>
                  <p className="text-[12px] font-semibold text-[#2D2B2A] uppercase tracking-[0.1em]">
                    ¿Cómo funciona?
                  </p>
                </div>
                <ol className="space-y-3">
                  {[
                    'Subí los archivos de UNA sola factura (mezclá Excel, PDF y fotos si querés)',
                    'Si son varias fotos, son páginas de la misma factura — la IA las une en una sola tabla',
                    'La IA detecta encabezados y filas de productos en cualquier idioma',
                    'Se genera un Excel limpio con columnas uniformes y precios normalizados',
                    'El archivo se descarga automáticamente a tu equipo',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#780e18] to-[#D4A333] text-white text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-[12.5px] text-[#4A4744] leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

// ─── Estados del drop zone ────────────────────────────────────────────────────

function EmptyDropState({ dragging }: { dragging: boolean }) {
  return (
    <>
      <div className={[
        'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-150',
        dragging
          ? 'bg-gradient-to-br from-[#780e18] to-[#D4A333] scale-110'
          : 'bg-[#F5F0EB] border border-[#D0CBC4]',
      ].join(' ')}>
        <i className={`ti ti-cloud-upload text-[32px] ${dragging ? 'text-white' : 'text-[#7A7571]'}`} />
      </div>
      <div className="text-center">
        <p className="text-[14px] font-semibold text-[#2D2B2A]">
          {dragging ? 'Soltá los archivos aquí' : 'Arrastrá o hacé clic para subir'}
        </p>
        <p className="text-[12px] text-[#7A7571] mt-1">
          Excel, PDF, imágenes (.jpg, .png, .heic…) — uno o varios archivos
        </p>
      </div>
    </>
  )
}

function FilesReadyState({
  archivos,
  fmtSize,
  onQuitar,
  onAgregar,
  puedeAgregar,
}: {
  archivos: File[]
  fmtSize: (b: number) => string
  onQuitar: (index: number) => void
  onAgregar: () => void
  puedeAgregar: boolean
}) {
  return (
    <div className="w-full max-w-[640px] space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-[#2D2B2A]">
          {archivos.length} archivo{archivos.length > 1 ? 's' : ''} listo{archivos.length > 1 ? 's' : ''} para procesar
        </p>
        <div className="flex items-center gap-1.5 text-[11.5px] text-[#3F7A52] font-semibold bg-[#B8DCCA] px-2.5 py-1 rounded-full">
          <i className="ti ti-circle-check text-[13px]" />
          Listos
        </div>
      </div>

      <ul className="w-full space-y-1.5 max-h-[280px] overflow-y-auto">
        {archivos.map((f, i) => (
          <li
            key={`${f.name}-${i}`}
            className="flex items-center gap-3 bg-white border border-[#D0CBC4] rounded-lg px-3 py-2"
          >
            <div className="w-9 h-9 rounded-lg bg-[#F5F0EB] flex items-center justify-center shrink-0">
              <i className={`ti ${iconoPara(f.name)} text-[#7A7571] text-[18px]`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-[#2D2B2A] truncate">{f.name}</p>
              <p className="text-[11px] text-[#7A7571]">{fmtSize(f.size)}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onQuitar(i) }}
              className="w-7 h-7 rounded-md hover:bg-[#FAF5EE] text-[#7A7571] hover:text-[#8A1E12] transition-colors flex items-center justify-center shrink-0"
              title="Quitar archivo"
            >
              <i className="ti ti-x text-[16px]" />
            </button>
          </li>
        ))}
      </ul>

      {puedeAgregar && (
        <button
          onClick={(e) => { e.stopPropagation(); onAgregar() }}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-[#D0CBC4] text-[12px] text-[#7A7571] hover:text-[#780e18] hover:border-[#780e18]/40 transition-colors"
        >
          <i className="ti ti-plus text-[14px]" />
          Agregar más archivos
        </button>
      )}
    </div>
  )
}

function ProcessingState() {
  return (
    <>
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#780e18] to-[#D4A333] flex items-center justify-center shrink-0">
        <i className="ti ti-loader-2 text-white text-[32px] animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-[14px] font-semibold text-[#2D2B2A]">Procesando con IA…</p>
        <p className="text-[12px] text-[#7A7571] mt-1">Extrayendo productos de los archivos</p>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#D4A333] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </>
  )
}

function SuccessState({ nombre, onNew }: { nombre: string; onNew: () => void }) {
  return (
    <>
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3F7A52] to-[#6BAF80] flex items-center justify-center shrink-0">
        <i className="ti ti-circle-check text-white text-[32px]" />
      </div>
      <div className="text-center">
        <p className="text-[14px] font-semibold text-[#2D2B2A]">¡Archivo generado!</p>
        <p className="text-[12px] text-[#7A7571] mt-0.5 max-w-[260px] truncate">{nombre}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onNew() }}
        className="px-4 py-2 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-[12px] font-semibold rounded-lg transition-colors"
      >
        Procesar otra factura
      </button>
    </>
  )
}
