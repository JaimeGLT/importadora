import type { Credito } from '@/types'

/**
 * Forma de la respuesta del backend vía GraphQL. HotChocolate conserva el
 * snake_case de los nombres C# (Id_Cliente, Cajero_Nombre, etc.) y baja
 * la primera letra del nombre del campo: `Id` -> `id`, `Estado` -> `estado`.
 *
 * El campo `estado` viene con la capitalización que la DB guarda
 * ("Pendiente" / "Parcial" / "Pagado" / "Cancelado"), igual que
 * `EstadosCredito` en el backend.
 */
export interface CreditoAPI {
  id: number
  id_Cliente: number
  id_OrdenVenta: number | null
  id_Cajero: string
  id_CajaOrigen: number
  estado: string
  total: number
  saldoPendiente: number
  fechaCreacion: string
  fechaPagoCompleto: string | null
  fechaCancelacion: string | null
  nota: string | null
  // nested (GraphQL)
  cliente?: {
    id: number
    nombre?: string | null
    apellido?: string | null
    telefono?: string | null
    correoElectronico?: string | null
    direccion?: string | null
  } | null
  cajero?: {
    id: string
    nombre?: string | null
    apellido?: string | null
  } | null
  items?: Array<{
    id: number
    id_Producto: number | null
    id_Pieza?: number | null
    cantidad: number
    precioUnitario: number
    subtotal: number
    producto?: { id: number; codigo?: string | null; nombre?: string | null; marca?: { id: number; nombre?: string | null } | null } | null
    pieza?: { id: number; nombre?: string | null; codigoPieza?: string | null } | null
  }> | null
  pagos?: Array<{
    id: number
    id_Caja: number
    id_Usuario: string
    fecha: string
    monto: number
    tipoPago: string
    nota: string | null
    usuario?: { id: string; nombre?: string | null; apellido?: string | null } | null
  }> | null
}

/**
 * Lista paginada de créditos. Usa Relay-style (first/after) y permite
 * filtrar por estado y clienteId con un input `where`.
 */
export const CREDITOS_QUERY = `
  query Creditos($first: Int, $after: String, $where: CreditoFilterInput, $order: [CreditoSortInput!]) {
    creditos(first: $first, after: $after, where: $where, order: $order) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        id_Cliente
        id_OrdenVenta
        id_Cajero
        id_CajaOrigen
        estado
        total
        saldoPendiente
        fechaCreacion
        fechaPagoCompleto
        fechaCancelacion
        nota
        cliente {
          id
          nombre
          apellido
          telefono
        }
        cajero {
          id
          nombre
          apellido
        }
      }
    }
  }
`

/**
 * Detalle de un crédito: cliente, cajero, items y pagos.
 */
export const CREDITO_DETALLE_QUERY = `
  query CreditoDetalle($id: Int!) {
    creditoDetalle(id: $id) {
      id
      id_Cliente
      id_OrdenVenta
      id_Cajero
      id_CajaOrigen
      estado
      total
      saldoPendiente
      fechaCreacion
      fechaPagoCompleto
      fechaCancelacion
      nota
      cliente {
        id
        nombre
        apellido
        telefono
        correoElectronico
        direccion
      }
      cajero {
        id
        nombre
        apellido
      }
      items {
        id
        id_Producto
        id_Pieza
        cantidad
        precioUnitario
        subtotal
        producto {
          id
          codigo
          nombre
          marca {
            id
            nombre
          }
        }
        pieza {
          id
          nombre
          codigoPieza
        }
      }
      pagos {
        id
        id_Caja
        id_Usuario
        fecha
        monto
        tipoPago
        nota
        usuario {
          id
          nombre
          apellido
        }
      }
    }
  }
`

/** Convierte la respuesta del backend (GraphQL) al modelo Credito del frontend. */
export function backendToCredito(c: CreditoAPI): Credito {
  const clienteNombre = c.cliente?.nombre ?? null
  const clienteApellido = c.cliente?.apellido ?? null
  const clienteTelefono = c.cliente?.telefono ?? null
  const cajeroNombre = c.cajero
    ? `${c.cajero.nombre ?? ''} ${c.cajero.apellido ?? ''}`.trim() || null
    : null

  return {
    id: c.id,
    id_cliente: c.id_Cliente,
    cliente_nombre: clienteNombre,
    cliente_apellido: clienteApellido,
    cliente_telefono: clienteTelefono,
    id_ordenVenta: c.id_OrdenVenta,
    id_cajero: c.id_Cajero,
    cajero_nombre: cajeroNombre,
    id_cajaOrigen: c.id_CajaOrigen,
    estado: c.estado as Credito['estado'],
    total: c.total,
    saldoPendiente: c.saldoPendiente,
    fechaCreacion: c.fechaCreacion,
    fechaPagoCompleto: c.fechaPagoCompleto,
    fechaCancelacion: c.fechaCancelacion,
    nota: c.nota,
    items: (c.items ?? []).map((i) => ({
      id: i.id,
      id_producto: i.id_Producto,
      producto_codigo: i.producto?.codigo ?? null,
      producto_nombre: i.producto?.nombre ?? null,
      producto_marcaId: i.producto?.marca?.id ?? null,
      producto_marcaNombre: i.producto?.marca?.nombre ?? null,
      id_pieza: i.id_Pieza ?? null,
      pieza_nombre: i.pieza?.nombre ?? null,
      pieza_codigo: i.pieza?.codigoPieza ?? null,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      subtotal: i.subtotal,
    })),
    pagos: (c.pagos ?? []).map((p) => ({
      id: p.id,
      id_caja: p.id_Caja,
      id_usuario: p.id_Usuario,
      usuario_nombre: p.usuario
        ? `${p.usuario.nombre ?? ''} ${p.usuario.apellido ?? ''}`.trim() || null
        : null,
      fecha: p.fecha,
      monto: p.monto,
      tipoPago: p.tipoPago as 'Efectivo' | 'QR' | 'Tarjeta',
      nota: p.nota,
    })),
  }
}
