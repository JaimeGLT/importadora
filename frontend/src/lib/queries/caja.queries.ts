import type { Caja, CategoriaMovimientoCaja } from '@/types'

export const MI_CAJA_QUERY = `
  query MiCaja {
    misCajas(where: {
      estado: {
        eq: "Abierta"
      }
    }) {
      nodes {
        id
        usuarioId
        montoInicial
        fechaInicio
        fechaCierre
        estado
        montoContado
        justificacion
        movimientos {
          id_Caja
          tipo
          tipoPago
          categoria
          monto
          motivo
          fecha
          id
        }
      }
    }
  }
`

export const MIS_CAJAS_QUERY = `
  query MisCajas {
    misCajas {
      nodes {
        id
        usuarioId
        montoInicial
        fechaInicio
        fechaCierre
        estado
        montoContado
        justificacion
        movimientos {
          id_Caja
          tipo
          tipoPago
          categoria
          monto
          motivo
          fecha
          id
        }
      }
    }
  }
`

export interface CajaAPI {
  id: string
  usuarioId: string
  montoInicial: number
  fechaInicio: string
  fechaCierre: string | null
  estado: string
  montoContado: number | null
  justificacion: string | null
  movimientos: Array<{
    id_Caja: number
    tipo: string
    tipoPago: string
    categoria: string
    monto: number
    motivo: string
    fecha: string
    id: number
  }>
}

export function backendToCaja(n: CajaAPI): Caja {
  return {
    id: Number(n.id),
    usuarioId: n.usuarioId,
    montoInicial: n.montoInicial,
    fechaInicio: n.fechaInicio,
    fechaCierre: n.fechaCierre,
    estado: n.estado as 'Abierta' | 'Cerrada',
    montoContado: n.montoContado,
    justificacion: n.justificacion,
    movimientos: (n.movimientos ?? []).map(m => ({
      id: m.id,
      id_Caja: m.id_Caja,
      tipo: m.tipo as 'Ingreso' | 'Egreso',
      tipoPago: m.tipoPago as 'Efectivo' | 'QR' | 'Tarjeta',
      categoria: m.categoria as CategoriaMovimientoCaja,
      monto: m.monto,
      motivo: m.motivo,
      fecha: m.fecha,
    })),
  }
}