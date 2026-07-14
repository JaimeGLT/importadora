export const AJUSTES_HISTORIAL_QUERY = `
  query AjustesHistorial($first: Int, $after: String, $where: AjusteStockFilterInput, $order: [AjusteStockSortInput!]) {
    ajustesStock(first: $first, after: $after, where: $where, order: $order) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        cantidadAnterior
        cantidadNueva
        motivo
        nota
        fecha
        usuario { nombre }
        producto { nombre codigo codigoAux codigoAux2 marcaId marca { nombre } }
      }
    }
    marca(order: { nombre: ASC }, first: 5000) {
      nodes { id nombre }
    }
  }
`

export interface AjusteStockAPI {
  id: number
  cantidadAnterior: number
  cantidadNueva: number
  motivo: string
  nota: string
  fecha: string
  usuario?: { nombre: string }
  producto?: { nombre: string; codigo: string; codigoAux?: string; codigoAux2?: string; marcaId?: number; marca?: { nombre: string } | null }
}

export interface AjusteStockRow {
  id: number
  productoNombre: string
  productoCodigo: string
  productoCodigos: string[]
  marcaId: number | null
  marca: string
  delta: number
  cantidadAnterior: number
  cantidadNueva: number
  motivo: string
  nota: string
  fecha: Date
  usuarioNombre: string
}

export function backendToAjusteRow(a: AjusteStockAPI): AjusteStockRow {
  const codigos = [a.producto?.codigo, a.producto?.codigoAux, a.producto?.codigoAux2].filter(Boolean) as string[]
  return {
    id: a.id,
    productoNombre: a.producto?.nombre ?? '—',
    productoCodigo: a.producto?.codigo ?? '—',
    productoCodigos: codigos.length > 0 ? codigos : ['—'],
    marcaId: a.producto?.marcaId ?? null,
    marca: a.producto?.marca?.nombre ?? '',
    delta: a.cantidadNueva - a.cantidadAnterior,
    cantidadAnterior: a.cantidadAnterior,
    cantidadNueva: a.cantidadNueva,
    motivo: a.motivo,
    nota: a.nota ?? '',
    fecha: new Date(a.fecha),
    usuarioNombre: a.usuario?.nombre ?? '—',
  }
}
