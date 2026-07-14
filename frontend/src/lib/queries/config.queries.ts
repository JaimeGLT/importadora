import type { DescuentoConfig } from '@/types'

export const DESCUENTOS_QUERY = `
  query Descuentos {
    descuento {
      nodes {
        id
        nombre
        cantDescuento
        color
        activo
      }
    }
  }
`

export const MARGEN_GANANCIA_QUERY = `
  query MargenGanancia {
    margenGanancia {
      id
      valor
      fecha
    }
  }
`

export const CONFIG_VENTA_QUERY = `
  query ConfigVenta {
    configVenta {
      id
      modoVenta
    }
  }
`

export const TIPO_CAMBIO_QUERY = `
  query TipoCambio {
    tipoCambio {
      id
      precioDolar
      fecha
    }
  }
`

export interface DescuentoAPI {
  id: number
  nombre: string
  cantDescuento: number
  color: string
  activo: boolean
}

export interface MargenGananciaAPI {
  id: number
  valor: number
  fecha: string
}

export interface ConfigVentaAPI {
  id: number
  modoVenta: string
}

export interface TipoCambioAPI {
  id: number
  precioDolar: number
  fecha: string
}

export function backendToDescuento(n: DescuentoAPI): DescuentoConfig {
  return {
    id: String(n.id),
    nombre: n.nombre,
    porcentaje: n.cantDescuento,
    color: n.color,
    activo: n.activo,
  }
}

export type ModoPrecioCajero = 'PrecioImportacion' | 'PrecioDolarDia'

export const MODO_PRECIO_LABELS: Record<ModoPrecioCajero, string> = {
  PrecioImportacion: 'Importación',
  PrecioDolarDia: 'Dólar hoy',
}

export const COLOR_OPTIONS = ['emerald', 'blue', 'amber', 'purple', 'rose', 'cyan'] as const
export type ColorOption = typeof COLOR_OPTIONS[number]

export const COLOR_STYLES: Record<ColorOption, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
}