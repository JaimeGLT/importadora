import type { Producto, PiezaKit } from '@/types'

function parseUbicacion(ubicacion: string): { almacen: string; estante: string; fila: string; columna: string } {
  if (!ubicacion) return { almacen: 'Almacén Central', estante: '', fila: '', columna: '' }
  if (ubicacion.includes('/')) {
    const parts = ubicacion.split('/').map((p) => p.trim())
    return {
      almacen: parts[0] || 'Almacén Central',
      estante: parts[1] || '',
      fila: parts[2] || '',
      columna: parts[3] || '',
    }
  }
  if (ubicacion.includes('-') && ubicacion.split('-').length >= 3) {
    const [e, f, c] = ubicacion.split('-')
    return { almacen: 'Almacén Central', estante: e || '', fila: f || '', columna: c || '' }
  }
  return { almacen: ubicacion, estante: '', fila: '', columna: '' }
}

export const PRODUCTOS_QUERY = `
  query Productos($first: Int, $after: String, $where: ProductoFilterInput, $order: [ProductoSortInput!]) {
    productos(first: $first, after: $after, where: $where, order: $order) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        codigo
        codigoAux
        codigoAux2
        nombre
        categoria
        marcaId
        ubicacion
        stock_Actual
        stockReservado
        stock_Minimo
        calcularStockKit
        esKit
        costo
        precio
        conversionABs
        fechaCreacion
        fechaActualizacion
        imagenPrincipal { id url }
      }
    }
  }
`

export const PRODUCTOS_CON_MARCAS_QUERY = `
  query ProductosConMarcas($first: Int, $after: String, $where: ProductoFilterInput, $order: [ProductoSortInput!]) {
    productos(first: $first, after: $after, where: $where, order: $order) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        codigo
        codigoAux
        codigoAux2
        nombre
        categoria
        marcaId
        marca { nombre }
        ubicacion
        stock_Actual
        stockReservado
        stock_Minimo
        calcularStockKit
        esKit
        costo
        precio
        conversionABs
        fechaCreacion
        fechaActualizacion
        imagenPrincipal { id url }
      }
    }
    marca(order: { nombre: ASC }, first: 5000) {
      nodes {
        id
        nombre
      }
    }
  }
`


export const PRODUCTOS_NOTIFICACIONES_QUERY = `
  query ProductosNotificaciones {
    productos {
      nodes {
        id
        codigo
        nombre
        categoria
        stock_Actual
        stock_Minimo
        esKit
        calcularStockKit
        marcaId
      }
    }
  }
`

export const PRODUCTOS_ALL_QUERY = `
  query ProductosTodos {
    productos {
      nodes {
        id
        codigo
        codigoAux
        codigoAux2
        nombre
        categoria
        marcaId
        stock_Actual
        stock_Minimo
        piezas
        calcularStockKit
        esKit
        costo
        precio
        conversionABs
      }
    }
  }
`

/**
 * Query liviana para el visor de galería: solo trae los datos necesarios
 * para mostrar las imágenes y la info mínima del producto (código + nombre
 * para el subtítulo del modal). Mucho más barata que `PRODUCTO_BY_ID_QUERY`
 * porque no hidrata historial de precios, piezas de kit, etc.
 */
export const PRODUCTO_IMAGENES_QUERY = `
  query ProductoImagenes($id: Int!) {
    productos(where: { id: { eq: $id } }) {
      nodes {
        id
        codigo
        nombre
        imagenPrincipal { id url }
        imagenes {
          id
          productoId
          url
          key
          nombreArchivo
          orden
          esPrincipal
        }
      }
    }
  }
`

/**
 * Batch lightweight: trae únicamente el `id` y la URL de la imagen
 * principal de varios productos en una sola query. Usado por las páginas
 * de ventas (Caja/Escaneo/Almacén) que listan `ItemOrden` con
 * `producto_id` y necesitan mostrar el thumb sin hidratar todo el
 * `Producto`. Más barato que N veces `PRODUCTO_IMAGENES_QUERY`.
 */
export const PRODUCTOS_IMAGENES_BATCH_QUERY = `
  query ProductosImagenesBatch($ids: [Int!]!) {
    productos(where: { id: { in: $ids } }) {
      nodes {
        id
        imagenPrincipal { id url }
      }
    }
  }
`

export const PRODUCTO_BY_ID_QUERY = `
  query ProductoById($id: Int!) {
    productos(where: { id: { eq: $id } }) {
      nodes {
        id
        unidad_Medida
        ubicacion
        stock_Actual
        calcularStockKit
        calcularStockKitDisponible
        stockReservado
        stock_Minimo
        piezas
        costo
        conversionABs
        codigo
        nombre
        categoria
        precio
        esKit
        historialPrecios {
          id
          id_producto
          fecha
          costo
          precio
          conversionABs
          nota
        }
        piezasKit {
          id
          id_Producto
          nombre
          cantidadPorKit
          stockActual
          stockReservado
          orden
          codigoPieza
        }
        codigoAux
        codigoAux2
        marcaId
        descripcion
        procedencia
        fechaCreacion
        fechaActualizacion
        imagenPrincipal { id url }
        imagenes {
          id
          productoId
          url
          key
          nombreArchivo
          contentType
          tamanoBytes
          anchoPx
          altoPx
          orden
          esPrincipal
          estado
          fechaSubida
        }
      }
    }
  }
`

interface PiezaKitAPI {
  id: number
  id_Producto: number
  nombre: string
  cantidadPorKit: number
  stockActual: number
  stockReservado: number
  codigo?: string
  /** Autogenerado por el backend. Formato: P{Orden}-{PrefijoMarcaKit}-{CodigoKit}. */
  codigoPieza: string
  /** Posición secuencial (1, 2, 3...) dentro del kit. Autogenerado. */
  orden: number
}

interface HistorialPrecioAPI {
  id: number
  id_producto: number
  fecha: string
  costo: number
  precio: number
  conversionABs: number
  nota: string | null
}

/** Imagen expuesta por el backend (DtoProductoImagenResponse). */
export interface ProductoImagenAPI {
  id: number
  productoId: number
  url: string
  key: string
  nombreArchivo: string
  contentType: string
  tamanoBytes: number
  anchoPx?: number | null
  altoPx?: number | null
  orden: number
  esPrincipal: boolean
  estado: 'Pendiente' | 'Activa' | 'Eliminada'
  fechaSubida: string
}

export interface ProductoAPISimple {
  id: string | number
  codigo: string
  codigoAux: string
  codigoAux2: string
  nombre?: string | null
  marcaId?: number | null
  /**
   * Shape divergente entre canales:
   * - GraphQL (`PRODUCTOS_CON_MARCAS_QUERY`) → `{ nombre: string }` (objeto, resuelto
   *   por el field `Marca` del schema `ProductoType`).
   * - REST (`GET /Producto/buscar-lista`) → string plano (`p.Marca?.Nombre`).
   * El mapper `mapProductoBase` abajo tolera ambos con `typeof p.marca === 'string'`.
   */
  marca?: { nombre: string } | string | null
  descripcion: string
  procedencia?: string | null
  categoria?: string | null
  unidad_Medida: string
  ubicacion: string
  stock_Actual: number
  stockReservado?: number
  stock_Minimo: number
  calcularStockKit?: number | null
  /**
   * Stock del kit descontando piezas reservadas por otras órdenes.
   * Solo presente en respuestas que lo incluyan explícitamente
   * (REST `buscar-lista`, `PRODUCTO_BY_ID_QUERY`). Cuando es null/undefined,
   * el mapping cae al `calcularStockKit` raw.
   */
  calcularStockKitDisponible?: number | null
  piezas: number
  costo: number
  precio: number
  conversionABs: number
  esKit?: boolean
  imagen?: string | null
  /**
   * Solo presente en queries que lo pidan explícitamente (lista con thumb).
   * Lo proyectamos desde `imagenPrincipal.url` para mantener compatibilidad
   * con el call-site `<ProductThumb src={p.imagen} />` que ya existía.
   */
  imagenPrincipal?: { id: number; url: string } | null
  historialPrecios?: HistorialPrecioAPI[]
  fechaCreacion?: string | null
  fechaActualizacion?: string | null
}

export interface ProductoAPI extends ProductoAPISimple {
  historialPrecios: HistorialPrecioAPI[]
  piezasKit?: PiezaKitAPI[]
  /** Galería completa del producto (solo en detalle). */
  imagenes?: ProductoImagenAPI[]
}

function mapPiezasKit(raw: PiezaKitAPI[] | undefined): PiezaKit[] {
  if (!raw) return []
  return raw.map((p) => ({
    id: p.id,
    id_producto: p.id_Producto,
    nombre: p.nombre ?? '',
    cantidad_por_kit: p.cantidadPorKit ?? 1,
    stock_actual: p.stockActual ?? 0,
    stock_reservado: p.stockReservado ?? 0,
    codigo_universal: p.codigo,
    codigo_pieza: p.codigoPieza ?? '',
    orden: p.orden ?? 0,
  }))
}

function mapImagenes(raw: ProductoImagenAPI[] | undefined): Producto['imagenes'] {
  if (!raw) return []
  return raw.map((i) => ({
    id: i.id,
    productoId: i.productoId,
    url: i.url,
    key: i.key,
    nombreArchivo: i.nombreArchivo,
    contentType: i.contentType,
    tamanoBytes: i.tamanoBytes,
    anchoPx: i.anchoPx ?? null,
    altoPx: i.altoPx ?? null,
    orden: i.orden,
    esPrincipal: i.esPrincipal,
    estado: i.estado,
    fechaSubida: i.fechaSubida,
  }))
}

export interface ProductoAPIInput {
  codigo: string
  codigoAux: string
  codigoAux2: string
  nombre?: string
  marcaId?: number | null
  descripcion: string
  procedencia?: string
  categoria?: string
  unidad_Medida: string
  ubicacion: string
  cantidad: number
  stock_Minimo: number
  piezas: number
  costo: number
  precio: number
  conversionABs: number
}

function mapProductoBase(p: ProductoAPISimple): Producto {
  return {
    id: String(p.id),
    codigo_universal: p.codigo ?? '',
    codigos_alternativos: [p.codigoAux ?? '', p.codigoAux2 ?? ''],
    nombre: p.nombre ?? '',
    descripcion: p.descripcion ?? '',
    procedencia: p.procedencia ?? '',
    categoria: p.categoria ?? '',
    marcaId: p.marcaId ?? null,
    marca: typeof p.marca === 'string' ? p.marca : (p.marca?.nombre ?? ''),
    vehiculo: '',
    unidad: (p.unidad_Medida?.toLowerCase() as Producto['unidad']) ?? 'pieza',
    // Para kits, preferimos `calcularStockKitDisponible` (descuenta reservas
    // de piezas). Si la respuesta no lo incluye (queries viejas), caemos al
    // `calcularStockKit` raw para no romper nada.
    stock: p.esKit
      ? (p.calcularStockKitDisponible ?? p.calcularStockKit ?? 0)
      : (p.stock_Actual ?? 0),
    stock_reservado: p.stockReservado ?? 0,
    stock_minimo: p.stock_Minimo ?? 0,
    piezas: p.piezas ?? 1,
    precio_costo: p.costo ?? 0,
    precio_venta: p.precio ?? 0,
    conversionABs: p.conversionABs ?? 6.96,
    es_kit: p.esKit ?? false,
    // Imagen: prioriza la principal computada, fallback al campo legacy `imagen`.
    imagen: p.imagenPrincipal?.url ?? p.imagen ?? undefined,
    historial_precios: (p.historialPrecios ?? []).map((h) => ({
      fecha: h.fecha,
      precio_costo: h.costo,
      precio_venta: h.precio,
      tipo_cambio: h.conversionABs,
      nota: h.nota ?? undefined,
    })),
    ...parseUbicacion(p.ubicacion ?? ''),
    estado: 'activo',
    proveedor_id: '',
    creado_en: p.fechaCreacion ?? '',
    actualizado_en: p.fechaActualizacion ?? '',
  }
}

export function backendToProductoSimple(p: ProductoAPISimple): Producto {
  return mapProductoBase(p)
}

export function backendToProducto(p: ProductoAPI): Producto {
  return { ...mapProductoBase(p), piezas_kit: mapPiezasKit(p.piezasKit), imagenes: mapImagenes(p.imagenes) }
}

function dec(n: number): number {
  return parseFloat(n.toFixed(2))
}

export function productoToBackend(
  p: Omit<Producto, 'id' | 'creado_en' | 'actualizado_en'>,
): ProductoAPIInput {
  const costo = dec(p.precio_costo > 0 ? p.precio_costo : 0.01)
  const precio = dec(p.precio_venta > 0 ? p.precio_venta : 0)
  return {
    codigo: p.codigo_universal,
    codigoAux: p.codigos_alternativos[0] ?? '',
    codigoAux2: p.codigos_alternativos[1] ?? '',
    nombre: p.nombre,
    marcaId: p.marcaId ?? null,
    descripcion: p.descripcion,
    procedencia: p.procedencia ?? '',
    categoria: p.categoria ?? '',
    unidad_Medida: p.unidad,
    ubicacion: [p.almacen, p.estante, p.fila, p.columna].filter(Boolean).join(' / '),
    cantidad: p.stock,
    stock_Minimo: p.stock_minimo,
    piezas: p.piezas ?? 1,
    costo,
    precio,
    conversionABs: dec(p.conversionABs ?? 6.96),
  }
}

export interface ProductoAPIUpdate {
  codigo: string
  nombre?: string
  piezas: number
  stock_Actual: number
  stock_Minimo: number
  codigoAux?: string
  codigoAux2?: string
  descripcion?: string
  procedencia?: string
  categoria?: string
  marcaId?: number | null
  ubicacion?: string
  unidad_Medida?: string
}

export function productoToBackendUpdate(
  p: Omit<Producto, 'id' | 'creado_en' | 'actualizado_en'>,
): ProductoAPIUpdate {
  return {
    codigo: p.codigo_universal,
    nombre: p.nombre,
    piezas: p.piezas ?? 1,
    stock_Actual: p.stock,
    stock_Minimo: p.stock_minimo,
    codigoAux: p.codigos_alternativos[0] ?? '',
    codigoAux2: p.codigos_alternativos[1] ?? '',
    descripcion: p.descripcion,
    procedencia: p.procedencia ?? '',
    categoria: p.categoria ?? '',
    marcaId: p.marcaId ?? null,
    ubicacion: [p.almacen, p.estante, p.fila, p.columna].filter(Boolean).join(' / '),
    unidad_Medida: p.unidad,
  }
}

export type ProductoAPIBulkInput = Omit<ProductoAPIInput, 'conversionABs' | 'stock_Actual'> & { cantidad: number; conversionABs: number }

// ─── Kit operation types ───────────────────────────────────────────────────────

export type DtoPiezaKit = {
  nombre: string
  cantidadPorKit: number
}

export type PieceOp =
  | { type: 'add'; data: DtoPiezaKit }
  | { type: 'update'; piezaId: number; data: { nombre?: string | null; cantidadPorKit: number } }
  | { type: 'delete'; piezaId: number }

export type KitOpsMode = 'none' | 'convertirKit' | 'convertirRegular' | 'managePieces'

export interface KitOps {
  mode: KitOpsMode
  piezas?: DtoPiezaKit[]
  stockManual?: number | null
  pieceOps?: PieceOp[]
}

export function productoToBackendBulk(
  p: Omit<Producto, 'id' | 'creado_en' | 'actualizado_en'>,
): ProductoAPIBulkInput {
  const costo = dec(p.precio_costo > 0 ? p.precio_costo : 0.01)
  const precio = dec(p.precio_venta > 0 ? p.precio_venta : 0)
  return {
    codigo: p.codigo_universal,
    codigoAux: p.codigos_alternativos[0] ?? '',
    codigoAux2: p.codigos_alternativos[1] ?? '',
    nombre: p.nombre,
    marcaId: p.marcaId ?? null,
    descripcion: p.descripcion,
    procedencia: p.procedencia ?? '',
    categoria: p.categoria ?? '',
    unidad_Medida: p.unidad,
    ubicacion: [p.almacen, p.estante, p.fila, p.columna].filter(Boolean).join(' / '),
    cantidad: p.stock,
    stock_Minimo: p.stock_minimo,
    piezas: p.piezas ?? 1,
    costo,
    precio,
    conversionABs: dec(p.conversionABs ?? 6.96),
  }
}