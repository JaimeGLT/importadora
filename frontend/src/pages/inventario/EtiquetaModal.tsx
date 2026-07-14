import { useEffect, useRef, useState } from 'react'
import type JsBarcodeType from 'jsbarcode'
import { Modal, Button } from '@/components/ui'
import { imprimirLote, imprimirLoteZPL, connectQZTray, type LabelData } from '@/lib/printLabel'
import { getAvailablePrinters } from '@/lib/qzTray'

const EMPRESA_NOMBRE = 'Usa AutoPartes'
const PRINTER_NAME_PARTIAL = 'GS-2406'

function formatearFecha(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

interface EtiquetaModalProps {
  open: boolean
  onClose: () => void
  etiqueta: LabelData | null
  /** Título secundario (ej. nombre de la pieza) mostrado bajo el código en la cabecera. */
  subtitulo?: string
}

function EtiquetaSimulada({ codigo, fecha }: { codigo: string; fecha: string; }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!codigo || !svgRef.current) return
    import('jsbarcode').then((mod) => {
      const JsBarcode = mod.default as typeof JsBarcodeType
      try {
        JsBarcode(svgRef.current!, codigo, {
          format: 'CODE128',
          width: 2,
          height: 40,
          fontSize: 10,
          displayValue: true,
          margin: 3,
          background: '#ffffff',
          lineColor: '#000000',
          font: 'Arial, sans-serif',
          textMargin: 2,
        })
      } catch { /* código inválido */ }
    }).catch(() => null)
  }, [codigo])

  return (
    <div className="w-[113px] h-[75px] px-1.5 pt-1 pb-0.5 flex flex-col justify-between items-center border border-dashed border-steel-200 shrink-0">
      <p className="text-[5px] font-bold text-black text-center w-full tracking-widest uppercase leading-none">{EMPRESA_NOMBRE}</p>
      <div className="w-full flex justify-center">
        <svg ref={svgRef} className="w-full" />
      </div>
      <p className="text-[4px] text-gray-500 text-center w-full leading-none">{fecha}</p>
    </div>
  )
}

export function EtiquetaModal({ open, onClose, etiqueta, subtitulo }: EtiquetaModalProps) {
  const [copias, setCopias] = useState(1)
  const [printing, setPrinting] = useState(false)
  const [qzConnected, setQzConnected] = useState(false)
  const [qzError, setQzError] = useState<string | null>(null)
  const [selectedPrinter, setSelectedPrinter] = useState<string>('')
  const [printMode, setPrintMode] = useState<'pdf' | 'zpl'>('zpl')
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([])
  const [testingConnection, setTestingConnection] = useState(false)

  useEffect(() => {
    if (!open) return
    setQzError(null)
    setTestingConnection(true)
    connectQZTray().then(async (status) => {
      setTestingConnection(false)
      setQzConnected(status.connected)
      if (!status.connected && status.error) {
        setQzError(status.error)
        return
      }
      const printers = await getAvailablePrinters()
      setAvailablePrinters(printers)
      const autoSelect = printers.find((p: string) =>
        p.toLowerCase().includes(PRINTER_NAME_PARTIAL.toLowerCase())
      )
      if (autoSelect) setSelectedPrinter(autoSelect)
    })
  }, [open])

  const handlePrint = async () => {
    if (!etiqueta) return
    setPrinting(true)
    setQzError(null)

    if (printMode === 'zpl' && selectedPrinter) {
      const result = await imprimirLoteZPL([{ producto: etiqueta, copias }], selectedPrinter)
      if (!result.success && result.error) {
        setQzError(result.error)
      }
    } else {
      await imprimirLote([{ producto: etiqueta, copias }])
    }

    setPrinting(false)
  }

  if (!etiqueta) return null

  const fechaLabel = etiqueta.creado_en
    ? formatearFecha(etiqueta.creado_en)
    : etiqueta.fecha_importacion
      ? formatearFecha(etiqueta.fecha_importacion)
      : ''
  const codigoBarras = etiqueta.codigo_universal

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Etiqueta y código de barras"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button
            onClick={() => void handlePrint()}
            loading={printing}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            }
          >
            Imprimir {copias > 1 ? `${copias} copias` : 'etiqueta'}
          </Button>
        </>
      }
    >
      {qzError && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {qzError}
        </div>
      )}

      {testingConnection && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-600 flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Conectando con QZ Tray...
        </div>
      )}

      {qzConnected && !testingConnection && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            QZ Tray conectado
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPrintMode('pdf')}
              className={`flex-1 py-1.5 px-3 rounded text-xs font-medium border transition-colors ${printMode === 'pdf' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-steel-200 text-steel-500 hover:bg-steel-50'}`}
            >
              PDF
            </button>
            <button
              onClick={() => setPrintMode('zpl')}
              className={`flex-1 py-1.5 px-3 rounded text-xs font-medium border transition-colors ${printMode === 'zpl' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-steel-200 text-steel-500 hover:bg-steel-50'}`}
            >
              ZPL (térmica)
            </button>
          </div>

          {printMode === 'zpl' && (
            <div className="space-y-1">
              <input
                type="text"
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                placeholder="Nombre de impresora"
                list="printer-list"
                className="w-full px-2 py-1.5 text-xs border border-steel-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <datalist id="printer-list">
                {availablePrinters.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              {availablePrinters.length > 0 && (
                <p className="text-[10px] text-steel-400">
                  {availablePrinters.length} impresoras disponibles
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-steel-100 rounded-lg p-5 flex flex-col items-center gap-2 mb-4">
        <p className="text-xs text-steel-400 mb-1">Vista previa (30 × 20 mm)</p>

        <div className="scale-[2.5] origin-center my-16">
          <EtiquetaSimulada codigo={codigoBarras} fecha={fechaLabel} />
        </div>

        <p className="text-[10px] text-steel-400 text-center font-mono">{codigoBarras}</p>
        {subtitulo && (
          <p className="text-[10px] text-steel-500 text-center truncate max-w-[200px]">{subtitulo}</p>
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-steel-600 font-medium">Cantidad de etiquetas</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCopias((c) => Math.max(1, c - 1))}
            className="h-8 w-8 rounded-lg border border-steel-200 flex items-center justify-center text-steel-600 hover:bg-steel-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="w-8 text-center font-semibold text-steel-900 text-sm tabular-nums">{copias}</span>
          <button
            onClick={() => setCopias((c) => Math.min(100, c + 1))}
            className="h-8 w-8 rounded-lg border border-steel-200 flex items-center justify-center text-steel-600 hover:bg-steel-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-steel-400 text-center">
        Formato 30 × 20 mm · 203 DPI · Gainscha GS-2409T PLUS
      </p>
    </Modal>
  )
}