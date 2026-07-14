import type { Marca } from '@/types'

export interface DtoMarca {
  nombre: string
}

export const MARCAS_QUERY = `
  query Marcas($where: MarcaFilterInput) {
    marca(order: { nombre: ASC }, where: $where, first: 5000) {
      nodes {
        id
        nombre
      }
    }
  }
`

export function backendToMarca(b: { id: number; nombre: string; creado_en?: string }): Marca {
  return {
    // GraphQL devuelve `id` como string (convención Relay/Node), pero el tipo
    // `Marca.id` es `number`. Sin la coerción, `m.id === marcaId` con `===`
    // estricto siempre devuelve `false` y `getMarcaNombre` nunca encuentra la
    // marca — la columna muestra "—" aunque la marca SÍ esté en la lista.
    id: Number(b.id),
    nombre: b.nombre,
    creado_en: b.creado_en ?? '',
  }
}
