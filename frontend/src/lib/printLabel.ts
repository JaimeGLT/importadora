import type JsBarcodeType from 'jsbarcode'
import { jsPDF } from 'jspdf'
import { generarZPLMultiple, type ZPLLabelData } from './zplCommands'
import { printZPL } from './qzTray'

export interface LabelData {
  codigo_universal: string
  nombre: string
  marca: string
  vehiculo: string
  precio_venta: number
  unidad: string
  creado_en?: string
  fecha_importacion?: string
}

const EMPRESA_NOMBRE = 'Usa AutoPartes'



function formatearFecha(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

async function generarBarcodePNG(value: string): Promise<string> {
  const mod = await import('jsbarcode')
  const JsBarcode = mod.default as typeof JsBarcodeType

  // Canvas proporcional a 28mm × 9mm (área útil del barcode en la etiqueta)
  // Ratio 28:9 ≈ 3.1:1 — antes era 300:72 = 4.17:1 (aplastaba las barras)
  const CANVAS_W = 280
  const CANVAS_H = 90

  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

  try {
    JsBarcode(svgEl, value, {
      format:       'CODE128',
      width:        1.5,   // barras más delgadas para códigos largos
      height:       55,    // altura barras en px dentro del SVG
      fontSize:     0,     // sin texto — lo ponemos nosotros en el PDF
      displayValue: false,
      margin:       3,
      background:   '#ffffff',
      lineColor:    '#000000',
    })

    // Leer el tamaño real que generó jsbarcode
    const svgW = parseFloat(svgEl.getAttribute('width') || String(CANVAS_W))
    const svgH = parseFloat(svgEl.getAttribute('height') || String(CANVAS_H))
    svgEl.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`)
    svgEl.setAttribute('width', String(CANVAS_W))
    svgEl.setAttribute('height', String(CANVAS_H))
  } catch {
    return ''
  }

  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgEl)
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const svgUrl = URL.createObjectURL(blob)

  return new Promise<string>((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = CANVAS_W
      canvas.height = CANVAS_H
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(svgUrl); resolve(''); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)
      URL.revokeObjectURL(svgUrl)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve('') }
    img.src = svgUrl
  })
}

async function generarPDF(
  items: { producto: LabelData; copias: number }[],
): Promise<Blob> {
  const LABEL_W_MM = 30
  const LABEL_H_MM = 20

  const pdf = new jsPDF({
    orientation: 'portrait',  // ← corregido: era 'landscape'
    unit: 'mm',               // ← corregido: usa mm directamente
    format: [LABEL_W_MM, LABEL_H_MM],
  })

  let firstPage = true

  for (const item of items) {
    const codigoBarras = item.producto.codigo_universal
    const pngBase64 = await generarBarcodePNG(codigoBarras)

    const fechaFormateada = item.producto.fecha_importacion
      ? formatearFecha(item.producto.fecha_importacion)
      : item.producto.creado_en
      ? formatearFecha(item.producto.creado_en)
      : ''

    for (let c = 0; c < item.copias; c++) {
      if (firstPage) {
        firstPage = false
      } else {
        pdf.addPage([LABEL_W_MM, LABEL_H_MM])
      }

      // Empresa — Y=1.8mm
      pdf.setFontSize(5)
      pdf.setFont('helvetica', 'bold')
      pdf.text(EMPRESA_NOMBRE, 15, 1.8, { align: 'center' })

      // Barcode — X=1mm, Y=3mm, W=28mm, H=9mm
      // Sin texto en la imagen (displayValue: false arriba)
      if (pngBase64) {
        try {
          pdf.addImage(pngBase64, 'PNG', 1, 3, 28, 9)
        } catch { /* skip */ }
      }

      // Texto código — Y=13.5mm (justo debajo del barcode)
      pdf.setFontSize(4)
      pdf.setFont('courier', 'normal')
      pdf.text(codigoBarras, 15, 13.5, { align: 'center' })

      // Fecha — Y=17.5mm
      if (fechaFormateada) {
        pdf.setFontSize(3.5)
        pdf.setFont('helvetica', 'normal')
        pdf.text(fechaFormateada, 15, 17.5, { align: 'center' })
      }
    }
  }

  return pdf.output('blob')
}

export interface PrintResult {
  success: boolean
  method: 'zpl' | 'pdf'
  error?: string
}

export async function imprimirLoteZPL(
  items: { producto: LabelData; copias: number }[],
  printerName: string,
): Promise<PrintResult> {
  if (items.length === 0) return { success: false, method: 'zpl', error: 'No items to print' }

  const zplCommands: string[] = []

  for (const item of items) {
    const zplData: ZPLLabelData = { ...item.producto }
    const labelCommands = generarZPLMultiple([zplData], item.copias)
    zplCommands.push(...labelCommands)
  }

  const result = await printZPL(printerName, zplCommands)
  return {
    success: result.success,
    method: 'zpl',
    error: result.error,
  }
}

export async function imprimirLote(
  items: { producto: LabelData; copias: number }[],
): Promise<void> {
  if (items.length === 0) return

  const blob = await generarPDF(items)
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) {
    const a = document.createElement('a')
    a.href = url
    a.download = 'etiquetas.pdf'
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export { connectQZTray } from './qzTray'