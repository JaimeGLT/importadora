export interface ResumenVentas {
  producto_id: string
  unidades_7d: number
  unidades_prev7d: number
  unidades_30d: number
}

// ─── Comisiones types ────────────────────────────────────────────────────────

export interface ResumenComisionAPI {
  cajeroId: string
  nombre: string
  apellido: string
  totalVentas: number
  porcentajeComision: number
  montoComision: number
}

export const COMISIONES_QUERY = `
  query ResumenComisionesCajeros($desde: DateTime!, $hasta: DateTime!) {
    resumenComisionesCajeros(desde: $desde, hasta: $hasta) {
      cajeroId
      nombre
      apellido
      totalVentas
      porcentajeComision
      montoComision
    }
  }
`

// ─── API types ───────────────────────────────────────────────────────────────

export interface OrdenReporteItemAPI {
  id_Producto: number
  cantidad: number
  precioUnitario: number
  producto: { id: number; nombre: string }
}

export interface OrdenReporteAPI {
  id: number
  fecha: string
  fechaCompletada: string | null
  id_Cliente: number | null
  cliente: { id: number; nombre: string; apellido: string } | null
  estado: string
  montoDescuento: number
  items: OrdenReporteItemAPI[]
}

export interface ProveedorReporteData {
  id: string
  nombre: string
  pais: string
  canImportaciones: number
  total: number
  tiempoReposicion: number
  activo: boolean
}

export interface ClienteCaidaData {
  id: string
  nombre: string
  tipo: string
  compras_30d_anterior_bs: number
  compras_30d_actual_bs: number
  pct_caida: number
  ultima_compra: string
}

export interface EstacionalidadRefData {
  codigo: string
  nombre: string
  ventas: { mes: string; unidades: number }[]
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const ORDENES_REPORTE_QUERY = `
  query OrdenesReporte {
    todasOrdenes(first: 10000) {
      nodes {
        id
        fecha
        fechaCompletada
        id_Cliente
        cliente { id nombre apellido }
        estado
        montoDescuento
        items {
          id_Producto
          cantidad
          precioUnitario
          producto { id nombre }
        }
      }
    }
  }
`

export const PROVEEDORES_REPORTE_QUERY = `
  query ProveedoresReporte {
    proveedor {
      nodes {
        id
        nombre
        pais
        canImportaciones
        total
        tiempoReposicion
        estado
      }
    }
  }
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function backendToProveedorReporte(b: {
  id: number
  nombre: string
  pais: string
  canImportaciones: number
  total: number
  tiempoReposicion: number
  estado: boolean
}): ProveedorReporteData {
  return {
    id: String(b.id),
    nombre: b.nombre,
    pais: b.pais,
    canImportaciones: b.canImportaciones,
    total: b.total,
    tiempoReposicion: b.tiempoReposicion,
    activo: b.estado,
  }
}

export function buildResumenMap(ordenes: OrdenReporteAPI[]): Record<string, ResumenVentas> {
  const now   = Date.now()
  const MS_7  = 7  * 86400000
  const MS_14 = 14 * 86400000
  const MS_30 = 30 * 86400000

  const map: Record<string, { unidades_7d: number; unidades_prev7d: number; unidades_30d: number }> = {}

  ordenes
    .filter(o => o.estado.toLowerCase() === 'completada')
    .forEach(o => {
      const t   = new Date(o.fechaCompletada ?? o.fecha).getTime()
      const age = now - t
      if (age > MS_30) return

      o.items.forEach(item => {
        const id = String(item.id_Producto)
        if (!map[id]) map[id] = { unidades_7d: 0, unidades_prev7d: 0, unidades_30d: 0 }
        map[id].unidades_30d += item.cantidad
        if (age <= MS_7)       map[id].unidades_7d     += item.cantidad
        else if (age <= MS_14) map[id].unidades_prev7d += item.cantidad
      })
    })

  return Object.fromEntries(
    Object.entries(map).map(([id, v]) => [id, { producto_id: id, ...v }])
  ) as Record<string, ResumenVentas>
}

export function buildClientesFugaData(ordenes: OrdenReporteAPI[]): ClienteCaidaData[] {
  const now   = Date.now()
  const MS_30 = 30 * 86400000
  const MS_60 = 60 * 86400000

  const byClient: Record<number, { nombre: string; actual: number; anterior: number; ultima: string }> = {}

  ordenes
    .filter(o => o.estado.toLowerCase() === 'completada' && o.id_Cliente)
    .forEach(o => {
      const cid  = o.id_Cliente!
      const t    = new Date(o.fechaCompletada ?? o.fecha).getTime()
      const age  = now - t
      if (age > MS_60) return

      const total = o.items.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0) - (o.montoDescuento ?? 0)

      if (!byClient[cid]) {
        byClient[cid] = {
          nombre: o.cliente ? `${o.cliente.nombre} ${o.cliente.apellido}` : `Cliente #${cid}`,
          actual: 0, anterior: 0,
          ultima: o.fechaCompletada ?? o.fecha,
        }
      }

      if (age <= MS_30) {
        byClient[cid].actual += total
        if (t > new Date(byClient[cid].ultima).getTime())
          byClient[cid].ultima = o.fechaCompletada ?? o.fecha
      } else {
        byClient[cid].anterior += total
      }
    })

  return Object.entries(byClient)
    .filter(([, c]) => c.anterior > 0 && c.actual < c.anterior)
    .map(([id, c]) => ({
      id,
      nombre: c.nombre,
      tipo: 'cliente',
      compras_30d_anterior_bs: c.anterior,
      compras_30d_actual_bs: c.actual,
      pct_caida: ((c.anterior - c.actual) / c.anterior) * 100,
      ultima_compra: c.ultima,
    }))
    .filter(c => c.pct_caida >= 20)
    .sort((a, b) => b.pct_caida - a.pct_caida)
    .slice(0, 10)
}

export function buildEstacionalidadData(ordenes: OrdenReporteAPI[]): EstacionalidadRefData[] {
  const MESES  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const now    = new Date()
  const MS_365 = 365 * 86400000

  const byProduct: Record<number, { nombre: string; meses: number[] }> = {}

  ordenes
    .filter(o => o.estado.toLowerCase() === 'completada')
    .forEach(o => {
      const fecha = new Date(o.fechaCompletada ?? o.fecha)
      if (now.getTime() - fecha.getTime() > MS_365) return
      const mes = fecha.getMonth()
      o.items.forEach(item => {
        if (!byProduct[item.id_Producto])
          byProduct[item.id_Producto] = { nombre: item.producto.nombre, meses: new Array(12).fill(0) }
        byProduct[item.id_Producto].meses[mes] += item.cantidad
      })
    })

  return Object.entries(byProduct)
    .map(([id, v]) => ({
      codigo: id,
      nombre: v.nombre,
      ventas: MESES.map((mes, i) => ({ mes, unidades: v.meses[i] })),
    }))
    .filter(p => p.ventas.reduce((s, v) => s + v.unidades, 0) > 0)
    .sort((a, b) =>
      b.ventas.reduce((s, v) => s + v.unidades, 0) -
      a.ventas.reduce((s, v) => s + v.unidades, 0)
    )
    .slice(0, 10)
}
