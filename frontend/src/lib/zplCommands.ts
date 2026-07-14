export interface ZPLLabelData {
  codigo_universal: string
  nombre: string
  marca: string
  vehiculo: string
  precio_venta: number
  unidad: string
  creado_en?: string
  fecha_importacion?: string
}

const DPM = 8

const LABEL_W_DOTS = 30 * DPM   // 240
const LABEL_H_DOTS = 20 * DPM   // 160

function formatearFecha(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function buildLabel(data: ZPLLabelData): string {
  const codigo = data.codigo_universal

  const fecha = data.fecha_importacion
    ? formatearFecha(data.fecha_importacion)
    : data.creado_en
    ? formatearFecha(data.creado_en)
    : ''

  const parts = [
    `^XA`,
    `^PW${LABEL_W_DOTS}`,
    `^LL${LABEL_H_DOTS}`,
    `^CI28`,
    `^LH0,0`,
    `^MTT`,
    `^PR1`,
    `^MD12`,

    // Empresa — más grande (alto 20, ancho 16)
    `^FO0,4^FB${LABEL_W_DOTS},1,,C,0^A0N,20,16^FDUsa AutoPartes\&^FS`,

    // Barcode
    `^FO12,28^BY1,2,46^BCN,,N,N,N^FD${codigo}^FS`,

    // Código texto — más grande (alto 20, ancho 16)
    `^FO0,80^FB${LABEL_W_DOTS},1,,C,0^A0N,20,16^FD${codigo}\&^FS`,

    // Fecha — más grande (alto 20, ancho 18)
    ...(fecha
      ? [`^FO0,112^FB${LABEL_W_DOTS},1,,C,0^A0N,20,18^FD${fecha}\&^FS`]
      : []),

    `^XZ`,
  ]

  return parts.join('')
}

export function generarZPLMultiple(
  labels: ZPLLabelData[],
  copiasPorLabel: number,
): string[] {
  const commands: string[] = []
  for (const label of labels) {
    const zpl = buildLabel(label)
    for (let i = 0; i < copiasPorLabel; i++) {
      commands.push(zpl)
    }
  }
  return commands
}

export { buildLabel as generarZPLRow }