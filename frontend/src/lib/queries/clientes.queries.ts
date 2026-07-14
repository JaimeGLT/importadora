import type { Cliente, ClienteAPI } from '@/types'

export type { ClienteAPI }

export const CLIENTES_QUERY = `
  query Clientes($first: Int, $after: String) {
    clientes(first: $first, after: $after) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        nombre
        apellido
        telefono
        direccion
        correoElectronico
      }
    }
  }
`

export function backendToCliente(n: ClienteAPI): Cliente {
  return {
    id: n.id,
    nombre: n.nombre,
    apellido: n.apellido,
    telefono: n.telefono,
    direccion: n.direccion,
    correoElectronico: n.correoElectronico,
  }
}