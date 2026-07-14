import type { Proveedor, ImportacionSummary } from '@/types'

export function backendToProveedor(b: {
  id: number
  nombre: string
  nota: string
  canImportaciones: number
  total: number
  pais: string | null
  moneda: string | null
  terminos: string | null
  nombre_Contacto: string | null
  email: string | null
  telefono: string
  tiempoReposicion: number
  sitioWeb: string
  estado: boolean
}): Proveedor {
  return {
    id: String(b.id),
    nombre: b.nombre,
    pais: b.pais ?? undefined,
    moneda: (b.moneda ?? undefined) as Proveedor['moneda'],
    terminos_pago: (b.terminos ?? undefined) as Proveedor['terminos_pago'],
    contacto: b.nombre_Contacto ?? undefined,
    email: b.email ?? undefined,
    telefono: b.telefono,
    sitio_web: b.sitioWeb,
    notas: b.nota,
    tiempo_reposicion_dias: b.tiempoReposicion,
    estado: b.estado ? 'activo' : 'inactivo',
    creado_en: '',
    actualizado_en: '',
  }
}

export function backendToImportacionSimple(b: {
  id: number
  codigo: string
  fecha: string
  cantProductos: number
  total: number
  estado: string
  id_Proveedor: number
  f_Internacional: number
  aduana_Arancel: number
  trasporte_Interno: number
  proveedor: { id: number; nombre: string; pais: string }
}): ImportacionSummary {
  return {
    id: String(b.id),
    numero: b.codigo,
    proveedor: b.proveedor.nombre,
    origen: b.proveedor.pais,
    fecha_creacion: b.fecha,
    fecha_estimada_llegada: b.fecha,
    estado: 'en_transito' as ImportacionSummary['estado'],
    fob_total_usd: b.total,
    flete_usd: b.f_Internacional,
    aduana_bs: b.aduana_Arancel,
    transporte_interno_bs: b.trasporte_Interno,
    tipo_cambio: 6.96,
    cantProductos: b.cantProductos ?? 0,
    creado_en: b.fecha,
    actualizado_en: b.fecha,
  }
}

export const PROVEEDORES_LIST_QUERY = `
  query ProveedoresList {
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
  }
`

export const PROVEEDOR_IMPORTACIONES_QUERY = `
  query ProveedorImportaciones($id: Int!) {
    importacion(where: { id_Proveedor: { eq: $id } }) {
      nodes {
        id
        codigo
        fecha
        cantProductos
        total
        estado
        id_Proveedor
        f_Internacional
        aduana_Arancel
        trasporte_Interno
        proveedor {
          id
          nombre
          pais
        }
      }
    }
  }
`

export interface DtoProveedor {
  nombre: string
  pais?: string
  moneda?: string
  terminos?: string
  nombre_Contacto?: string
  email?: string
  telefono: string
  tiempoReposicion: number
  sitioWeb: string
  estado: boolean
  nota: string
}