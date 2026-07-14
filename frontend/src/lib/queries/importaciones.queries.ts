export interface DtoProductoImportacion {
  codigo: string
  codigoAux: string
  codigoAux2: string
  nombre: string
  marcaId?: number | null
  descripcion: string
  procedencia?: string
  categoria?: string
  unidad_Medida: string
  ubicacion: string
  cantidad: number
  stock_Minimo: number
  piezas: number
  conversionABs: number
  costo: number
  precio: number
}

export interface DtoImportacion {
  /**
   * Si viene con un id, este payload es un LOTE de continuación: el backend
   * solo anexa productos y detalles a la Importacion existente. Si es null
   * (o no viene), es el PRIMER lote: el backend crea la Importacion y
   * devuelve su id en la respuesta para los siguientes lotes.
   */
  importacionId?: number | null
  tipo?: string
  id_Proveedor: number
  fecha: string
  conversionABs: number
  costoTotal: number
  f_Internacional: number
  aduana_Arancel: number
  trasporte_Interno: number
  productos: DtoProductoImportacion[]
}

/** Respuesta del backend tras cada lote (creación o continuación). */
export interface DtoImportacionRespuesta {
  actualizados: number
  creados: number
  importacionId?: number | null
}

interface BackendDetalle {
  id: number
  codigo: string
  codigoAux: string
  codigoAux2: string
  nombre: string
  descripcion: string
  procedencia?: string
  marcaId?: number | null
  unidad_Medida: string
  ubicacion: string
  stock_Actual: number
  stock_Minimo: number
  costo: number
  precio: number
  conversionABs: number
  tipo: string
  piezas?: number
}

interface BackendProveedor {
  id: number
  nombre: string
  pais: string
  moneda: string
}

export interface BackendDetalleFull extends BackendDetalle {}

interface BackendImportacion {
  id: number
  id_Proveedor: number
  codigo: string
  fecha: string
  cantProductos: number
  total: number
  estado: string
  tipo?: string
  proveedor: BackendProveedor
  trasporte_Interno: number
  f_Internacional: number
  aduana_Arancel: number
  detalles?: BackendDetalle[]
}

import type { Importacion, EstadoImportacion } from '@/types'

function normalizeEstadoImportacion(raw: string): EstadoImportacion {
  const s = raw.toLowerCase().replace(/[\s_]/g, '')
  if (s.includes('transito') || s.includes('tránsito')) return 'en_transito'
  if (s.includes('aduana'))                               return 'en_aduana'
  if (s.includes('recibida') || s.includes('completada')) return 'recibida'
  if (s.includes('cancelada'))                            return 'cancelada'
  return 'en_transito'
}

export function backendToImportacion(b: BackendImportacion): Importacion {
  const firstDetalle = b.detalles?.[0]
  return {
    id: String(b.id),
    numero: b.codigo,
    proveedor: b.proveedor.nombre,
    origen: b.proveedor.pais,
    fecha_creacion: b.fecha,
    fecha_estimada_llegada: b.fecha,
    estado: normalizeEstadoImportacion(b.estado),
    tipo: (b.tipo === 'Local' ? 'Local' : 'Internacional') as 'Local' | 'Internacional',
    fob_total_usd: b.total,
    flete_usd: b.f_Internacional,
    aduana_bs: b.aduana_Arancel,
    transporte_interno_bs: b.trasporte_Interno,
    tipo_cambio: firstDetalle?.conversionABs ?? 6.96,
    items: (b.detalles ?? []).map((d) => ({
      id: String(d.id),
      codigo_proveedor: d.codigo,
      codigos_adicionales: [d.codigoAux, d.codigoAux2].filter(Boolean),
      nombre: d.nombre,
      descripcion: d.descripcion ?? '',
      procedencia: d.procedencia ?? '',
      marcaId: d.marcaId ?? null,
      unidad: (d.unidad_Medida as Importacion['items'][0]['unidad']) ?? 'pieza',
      ubicacion: d.ubicacion ?? 'Almacén Central',
      precio_fob_usd: 0,
      cantidad: d.stock_Actual,
      piezas: d.piezas,
      stock_minimo: d.stock_Minimo,
      costo_unitario_fob_bs: d.costo,
      costo_unitario_adicional_bs: 0,
      costo_unitario_total_bs: d.costo,
      precio_venta_sugerido: d.precio,
      precio_venta_final: d.precio,
      producto_id: undefined,
      es_nuevo: d.tipo === 'Nuevo',
      usar_precio_nuevo: true,
    })),
    creado_en: b.fecha,
    actualizado_en: b.fecha,
  }
}

// ─── Dashboard types & query ──────────────────────────────────────────────────

export interface DashboardImportacionAPI {
  id: number
  codigo: string
  fecha: string
  total: number
  estado: string
  proveedor: { nombre: string; pais: string }
  trasporte_Interno: number
  f_Internacional: number
  aduana_Arancel: number
}

export interface DashboardImportacion {
  id: string
  numero: string
  proveedor: string
  origen: string
  fecha_estimada_llegada: string
  estado: string
  fob_total_usd: number
  flete_usd: number
  aduana_bs: number
  transporte_interno_bs: number
  tipo_cambio: number
}

export const IMPORTACIONES_DASHBOARD_QUERY = `
  query ImportacionesDashboard {
    importacion {
      nodes {
        id
        codigo
        fecha
        total
        estado
        proveedor { nombre pais }
        trasporte_Interno
        f_Internacional
        aduana_Arancel
      }
    }
  }
`

export function backendToImportacionDashboard(b: DashboardImportacionAPI, tipoCambio: number): DashboardImportacion {
  return {
    id:                    String(b.id),
    numero:                b.codigo,
    proveedor:             b.proveedor.nombre,
    origen:                b.proveedor.pais,
    fecha_estimada_llegada: b.fecha,
    estado:                normalizeEstadoImportacion(b.estado),
    fob_total_usd:         b.total,
    flete_usd:             b.f_Internacional,
    aduana_bs:             b.aduana_Arancel,
    transporte_interno_bs: b.trasporte_Interno,
    tipo_cambio:           tipoCambio,
  }
}

const IMP_SUMMARY_NODES = `
  id
  id_Proveedor
  codigo
  fecha
  cantProductos
  total
  estado
  proveedor {
    id
    nombre
    pais
    moneda
  }
  trasporte_Interno
  f_Internacional
  aduana_Arancel
  tipo
  detalles {
    conversionABs
  }
`

const DETALLE_NODES = `
  id
  codigo
  codigoAux
  codigoAux2
  nombre
  descripcion
  procedencia
  marcaId
  unidad_Medida
  ubicacion
  stock_Actual
  stock_Minimo
  costo
  precio
  conversionABs
  tipo
  piezas
`

export const IMPORTACIONES_QUERY = `
  query Importaciones {
    importacion {
      nodes {
        ${IMP_SUMMARY_NODES}
      }
    }
  }
`

export const IMPORTACION_DETAIL_QUERY = `
  query ImportacionDetail($id: Int!) {
    importacion(where: { id: { eq: $id } }) {
      nodes {
        ${IMP_SUMMARY_NODES}
        detalles {
          ${DETALLE_NODES}
        }
      }
    }
  }
`

export const IMPORTACIONES_INIT_QUERY = `
  query ImportacionesInit {
    importacion {
      nodes {
        ${IMP_SUMMARY_NODES}
      }
    }
    proveedor {
      nodes {
        id
        nombre
        nota
        canImportaciones
        total
        pais
        moneda
        terminos
        nombre_Contacto
        email
        telefono
        tiempoReposicion
        sitioWeb
        estado
      }
    }
    marca(order: { nombre: ASC }, first: 5000) {
      nodes {
        id
        nombre
      }
    }
    margenGanancia {
      id
      valor
    }
  }
`