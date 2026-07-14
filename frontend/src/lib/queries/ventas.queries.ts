import type { OrdenVenta, ItemOrden, EstadoOrden, EstadoItemOrden } from '@/types'

// ─── Backend API types ────────────────────────────────────────────────────────

export interface OrdenItemProductoAPI {
  id: number
  codigo: string
  nombre: string
  marca: { id: number; nombre: string } | null
  categoria: string | null
  procedencia: string | null
  descripcion: string | null
  ubicacion: string
  stock_Actual: number
  stock_Minimo: number
  costo: number
  precio: number
  esKit: boolean
  stockReservado: number
}

export interface OrdenItemPiezaAPI {
  id: number
  id_Item: number
  id_Pieza: number
  cantidad: number
  precioUnitario: number
  confirmado: boolean
  listoAlmacenero: boolean
  notaIncompleto: string | null
  pieza?: { nombre: string; codigoPieza: string } | null
}

export interface OrdenItemAPI {
  id: number
  id_Orden: number
  id_Producto: number
  cantidad: number
  esParcial: boolean
  estado: string
  notaIncompleto: string | null
  precioUnitario: number
  producto: OrdenItemProductoAPI
  piezas: OrdenItemPiezaAPI[]
}

export interface OrdenVentaAPI {
  id: number
  id_Cajero: string
  id_Almacenero: string | null
  id_Cliente: number | null
  id_Caja: number
  estado: string
  fecha: string
  fechaCompletada: string | null
  nota: string | null
  notaCancelacion: string | null
  id_Descuento: number | null
  montoDescuento: number
  descuento: { id: number; nombre: string; cantDescuento: number; color: string; activo: boolean } | null
  modalidad?: string
  numero?: string
  cajero: { id: string; nombre: string; apellido: string } | null
  almacenero: { id: string; nombre: string; apellido: string } | null
  cliente: { id: number; nombre: string; apellido: string; telefono: string } | null
  items: OrdenItemAPI[]
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const MIS_ORDENES_QUERY = `
  query MisOrdenes($desde: DateTime, $hasta: DateTime) {
    misOrdenes(desde: $desde, hasta: $hasta) {
      nodes {
        id
        id_Cajero
        id_Almacenero
        id_Cliente
        id_Caja
        estado
        fecha
        fechaCompletada
        nota
        notaCancelacion
        id_Descuento
        montoDescuento
        descuento {
          id
          nombre
          cantDescuento
          color
          activo
        }
        cajero {
          id
          nombre
          apellido
        }
        almacenero {
          id
          nombre
          apellido
        }
        cliente {
          id
          nombre
          apellido
          telefono
        }
        items {
          id
          id_Orden
          id_Producto
          cantidad
          esParcial
          estado
          notaIncompleto
          precioUnitario
          producto {
            id
            codigo
            nombre
            marca {
              id
              nombre
            }
            categoria
            procedencia
            descripcion
            ubicacion
            stock_Actual
            stock_Minimo
            costo
            precio
            esKit
            stockReservado
          }
          esParcial
          piezas {
            id
            id_Item
            id_Pieza
            cantidad
            precioUnitario
            confirmado
            listoAlmacenero
            notaIncompleto
            pieza {
              nombre
              codigoPieza
            }
          }
        }
      }
    }
  }
`

export const ORDENES_PARA_ESCANEO_QUERY = `
  query OrdenesParaEscaneo {
    ordenesParaEscaneo {
      nodes {
        id
        id_Cajero
        id_Almacenero
        id_Cliente
        id_Caja
        estado
        fecha
        fechaCompletada
        notaCancelacion
        id_Descuento
        montoDescuento
        descuento {
          id
          nombre
          cantDescuento
          color
          activo
        }
        cajero {
          id
          nombre
          apellido
        }
        almacenero {
          id
          nombre
          apellido
        }
        cliente {
          id
          nombre
          apellido
          telefono
        }
        items {
          id
          id_Orden
          id_Producto
          cantidad
          esParcial
          estado
          notaIncompleto
          precioUnitario
          producto {
            id
            codigo
            nombre
            marca {
              id
              nombre
            }
            categoria
            procedencia
            descripcion
            ubicacion
            stock_Actual
            stock_Minimo
            costo
            precio
            esKit
            stockReservado
          }
          esParcial
          piezas {
            id
            id_Item
            id_Pieza
            cantidad
            precioUnitario
            confirmado
            listoAlmacenero
            notaIncompleto
            pieza {
              nombre
              codigoPieza
            }
          }
        }
      }
    }
  }
`

export const ORDENES_PENDIENTES_QUERY = `
  query OrdenesPendientes {
    ordenesPendientes {
      nodes {
        id
        id_Cajero
        id_Almacenero
        id_Cliente
        id_Caja
        estado
        fecha
        fechaCompletada
        nota
        notaCancelacion
        id_Descuento
        montoDescuento
        descuento {
          id
          nombre
          cantDescuento
          color
          activo
        }
        cajero {
          id
          nombre
          apellido
        }
        almacenero {
          id
          nombre
          apellido
        }
        cliente {
          id
          nombre
          apellido
          telefono
        }
        items {
          id
          id_Orden
          id_Producto
          cantidad
          esParcial
          estado
          notaIncompleto
          precioUnitario
          producto {
            id
            codigo
            nombre
            marca {
              id
              nombre
            }
            categoria
            procedencia
            descripcion
            ubicacion
            stock_Actual
            stock_Minimo
            precio
            esKit
            stockReservado
          }
          esParcial
          piezas {
            id
            id_Item
            id_Pieza
            cantidad
            precioUnitario
            confirmado
            listoAlmacenero
            notaIncompleto
            pieza {
              nombre
              codigoPieza
            }
          }
        }
      }
    }
  }
`

export const MIS_ORDENES_ALMACEN_QUERY = `
  query MisOrdenesAlmacen {
    misOrdenesAlmacen {
      nodes {
        id
        id_Cajero
        id_Almacenero
        id_Cliente
        id_Caja
        estado
        fecha
        fechaCompletada
        nota
        notaCancelacion
        id_Descuento
        montoDescuento
        descuento {
          id
          nombre
          cantDescuento
          color
          activo
        }
        cajero {
          id
          nombre
          apellido
        }
        almacenero {
          id
          nombre
          apellido
        }
        cliente {
          id
          nombre
          apellido
          telefono
        }
        items {
          id
          id_Orden
          id_Producto
          cantidad
          esParcial
          estado
          notaIncompleto
          precioUnitario
          producto {
            id
            codigo
            nombre
            marca {
              id
              nombre
            }
            categoria
            procedencia
            descripcion
            ubicacion
            stock_Actual
            stock_Minimo
            precio
            esKit
            stockReservado
          }
          esParcial
          piezas {
            id
            id_Item
            id_Pieza
            cantidad
            precioUnitario
            confirmado
            listoAlmacenero
            notaIncompleto
            pieza {
              nombre
              codigoPieza
            }
          }
        }
      }
    }
  }
`

export const TODAS_ORDENES_QUERY = `
  query TodasOrdenes($desde: DateTime, $hasta: DateTime) {
    todasOrdenes(desde: $desde, hasta: $hasta) {
      nodes {
        id
        id_Cajero
        id_Almacenero
        id_Cliente
        id_Caja
        estado
        fecha
        fechaCompletada
        notaCancelacion
        id_Descuento
        montoDescuento
        descuento {
          id
          nombre
          cantDescuento
          color
          activo
        }
        cajero {
          id
          nombre
          apellido
        }
        almacenero {
          id
          nombre
          apellido
        }
        cliente {
          id
          nombre
          apellido
          telefono
        }
        items {
          id
          id_Orden
          id_Producto
          cantidad
          esParcial
          estado
          notaIncompleto
          precioUnitario
          producto {
            id
            codigo
            nombre
            marca {
              id
              nombre
            }
            categoria
            procedencia
            descripcion
            ubicacion
            stock_Actual
            precio
            esKit
            stockReservado
          }
          esParcial
          piezas {
            id
            id_Item
            id_Pieza
            cantidad
            precioUnitario
            confirmado
            listoAlmacenero
            notaIncompleto
            pieza {
              nombre
              codigoPieza
            }
          }
        }
      }
    }
  }
`

// ─── Converters ───────────────────────────────────────────────────────────────

const ESTADO_ORDEN_MAP: Record<string, EstadoOrden> = {
  pendiente:       'pendiente_almacenero',
  aceptada:        'en_preparacion',
  lista:           'listo_para_escaneo',
  confaltantes:    'con_faltantes',
  esperandopago:   'esperando_pago',
  completada:      'completada',
  cancelada:       'cancelada',
}

const ESTADO_ITEM_MAP: Record<string, EstadoItemOrden> = {
  pendiente:         'pendiente',
  confirmado:        'completo',
  completo:          'completo',
  parcial:           'parcial',
  faltante:          'faltante',
  incompleto:        'faltante',
  listoindividual:   'listo_almacenero',
}

function parseUbicacion(ubicacion?: string | null) {
  if (!ubicacion) return { almacen: '', estante: '', fila: '', columna: '' }
  const parts = ubicacion.includes('/') ? ubicacion.split('/') : ubicacion.split('-')
  if (parts.length === 4) return { almacen: parts[0], estante: parts[1], fila: parts[2], columna: parts[3] }
  if (parts.length === 3) return { almacen: '', estante: parts[0], fila: parts[1], columna: parts[2] }
  return { almacen: ubicacion, estante: '', fila: '', columna: '' }
}

function parseCantidadRecogida(nota: string | null | undefined): number | undefined {
  if (!nota) return undefined
  const m = nota.match(/^Encontró (\d+) de \d+/)
  return m ? parseInt(m[1], 10) : undefined
}

function parseNotaUsuario(nota: string | null | undefined): string | undefined {
  if (!nota) return undefined
  if (/^Encontró \d+ de \d+/.test(nota)) {
    const idx = nota.indexOf(' — ')
    return idx !== -1 ? nota.slice(idx + 3) : undefined
  }
  return nota
}

function backendToItemOrden(api: OrdenItemAPI): ItemOrden {
  const loc = parseUbicacion(api.producto?.ubicacion)
  const estado = ESTADO_ITEM_MAP[api.estado?.toLowerCase()] ?? 'pendiente'
  return {
    id: String(api.id),
    producto_id: String(api.id_Producto),
    producto_codigo: api.producto?.codigo ?? '',
    producto_nombre: api.producto?.nombre ?? '',
    producto_categoria: api.producto?.categoria ?? '',
    producto_procedencia: api.producto?.procedencia ?? '',
    producto_descripcion: api.producto?.descripcion ?? '',
    marcaId: api.producto?.marca?.id ?? null,
    marca_nombre: api.producto?.marca?.nombre ?? '',
    producto_almacen: loc.almacen,
    producto_estante: loc.estante,
    producto_fila: loc.fila,
    producto_columna: loc.columna,
    cantidad_pedida: api.cantidad,
    precio_unitario: api.precioUnitario,
    subtotal: api.precioUnitario * api.cantidad,
    estado,
    nota: parseNotaUsuario(api.notaIncompleto),
    cantidad_recogida: parseCantidadRecogida(api.notaIncompleto),
    es_kit: api.producto?.esKit ?? false,
    es_parcial: api.esParcial,
    precio_base: api.precioUnitario,
    piezas_orden: api.esParcial && api.piezas?.length
      ? api.piezas.map(p => ({
          id: p.id,
          id_pieza: p.id_Pieza,
          nombre: p.pieza?.nombre ?? `Pieza #${p.id_Pieza}`,
          codigo_pieza: p.pieza?.codigoPieza,
          marcaId: api.producto?.marca?.id ?? null,
          cantidad: p.cantidad,
          precio_unitario: p.precioUnitario,
          confirmado: p.confirmado,
          listo_almacenero: p.listoAlmacenero,
          nota_incompleto: p.notaIncompleto,
          cantidad_recogida: parseCantidadRecogida(p.notaIncompleto),
        }))
      : undefined,
  }
}

// ─── Dashboard types & query ──────────────────────────────────────────────────

export interface DashboardOrdenItemAPI {
  id_Producto: number
  cantidad: number
  precioUnitario: number
  producto: { id: number; codigo: string; nombre: string; marca: { id: number } | null } | null
}

export interface DashboardOrdenAPI {
  id: number
  estado: string
  fecha: string
  fechaCompletada: string | null
  montoDescuento: number
  cajero: { nombre: string; apellido: string } | null
  items: DashboardOrdenItemAPI[]
}

export interface DashboardOrden {
  id: string
  numero: string
  estado: EstadoOrden
  fecha: string
  fechaCompletada: string | null
  cajeroNombre: string
  total: number
  montoDescuento: number
  items: { productoId: string; productoNombre: string; productoCodigo: string; productoMarcaId?: number | null; cantidad: number; precioUnitario: number }[]
}

export const DASHBOARD_ORDENES_QUERY = `
  query TodasOrdenes {
    todasOrdenes {
      nodes {
        id
        estado
        fecha
        fechaCompletada
        montoDescuento
        cajero { nombre apellido }
        items {
          id_Producto
          cantidad
          precioUnitario
          producto { id codigo nombre marca { id } }
        }
      }
    }
  }
`

export function backendOrdenToDashboard(api: DashboardOrdenAPI): DashboardOrden {
  const estado = ESTADO_ORDEN_MAP[api.estado?.toLowerCase()] ?? 'pendiente_almacenero'
  const items = (api.items ?? []).map(i => ({
    productoId:       String(i.id_Producto),
    productoNombre:   i.producto?.nombre  ?? '',
    productoCodigo:   i.producto?.codigo  ?? '',
    productoMarcaId:  i.producto?.marca?.id ?? null,
    cantidad:         i.cantidad,
    precioUnitario:   i.precioUnitario,
  }))
  const total = items.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0) - (api.montoDescuento ?? 0)
  return {
    id:              String(api.id),
    numero:          `#${api.id}`,
    estado,
    fecha:           api.fecha,
    fechaCompletada: api.fechaCompletada ?? null,
    cajeroNombre:    api.cajero ? `${api.cajero.nombre} ${api.cajero.apellido}`.trim() : '',
    total,
    montoDescuento:  api.montoDescuento ?? 0,
    items,
  }
}

export function backendToOrdenVenta(api: OrdenVentaAPI): OrdenVenta {
  const estado = ESTADO_ORDEN_MAP[api.estado?.toLowerCase()] ?? 'pendiente_almacenero'
  const items = (api.items ?? []).map(backendToItemOrden)
  const subtotal = items.reduce((s, i) => {
    if (i.es_parcial && i.piezas_orden?.length)
      return s + i.piezas_orden.reduce((ps, p) => ps + (p.precio_unitario ?? 0) * p.cantidad, 0)
    return s + i.precio_unitario * i.cantidad_pedida
  }, 0)
  const descuentoMonto = api.montoDescuento ?? 0
  const total = Math.max(0, subtotal - descuentoMonto)
  const clienteNombre = api.cliente
    ? `${api.cliente.nombre} ${api.cliente.apellido}`.trim()
    : undefined

  const cajeroNombre = api.cajero
    ? `${api.cajero.nombre} ${api.cajero.apellido}`.trim()
    : ''
  const almaceneroNombre = api.almacenero
    ? `${api.almacenero.nombre} ${api.almacenero.apellido}`.trim()
    : undefined

  return {
    id: String(api.id),
    numero: api.numero ?? `#${api.id}`,
    tipo: 'venta',
    cajero_id: String(api.id_Cajero),
    cajero_nombre: cajeroNombre,
    almacenero_id: api.id_Almacenero != null ? String(api.id_Almacenero) : undefined,
    almacenero_nombre: almaceneroNombre,
    cliente_id: api.id_Cliente != null ? String(api.id_Cliente) : undefined,
    cliente_nombre: clienteNombre,
    items,
    total,
    estado,
    nota: api.nota ?? undefined,
    descuento: api.descuento
      ? {
          id: String(api.descuento.id),
          nombre: api.descuento.nombre,
          porcentaje: api.descuento.cantDescuento,
          color: api.descuento.color,
          activo: api.descuento.activo,
        }
      : undefined,
    monto_descuento: descuentoMonto,
    creado_en: api.fecha,
    actualizado_en: api.fecha,
    modalidad:
      api.modalidad === 'RapidaContado' ? 'rapida_contado'
      : api.modalidad === 'RapidaCredito' ? 'rapida_credito'
      : 'normal',
  }
}
