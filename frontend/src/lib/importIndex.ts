import type { Marca, Producto } from '@/types'

/**
 * Helpers de indexación para el flujo de importación.
 *
 * El catálogo de productos y de marcas puede tener miles de filas. El
 * `calcItems` y los handlers de update hacían `Array.find(...)` dentro de un
 * loop de 1500+ items, lo que producía O(n×m) comparaciones de strings y
 * congelaba la UI. Estos helpers construyen `Map` una sola vez para que cada
 * lookup sea O(1).
 *
 * Semántica: en caso de duplicados en el catálogo, gana el PRIMER match
 * (mismo comportamiento que `Array.find`).
 */

export function productoKey(codigo: string, marcaId: number | null | undefined): string {
  return `${codigo.trim().toLowerCase()}|${marcaId ?? 'null'}`
}

/**
 * Indexa productos por (codigo_universal, marcaId). Sirve para resolver
 * el match de un row del Excel contra el inventario en O(1).
 */
export function buildProductoIndex(productos: Producto[]): Map<string, Producto> {
  const idx = new Map<string, Producto>()
  for (const p of productos) {
    const key = productoKey(p.codigo_universal, p.marcaId)
    if (!idx.has(key)) idx.set(key, p)
  }
  return idx
}

/**
 * Indexa productos por id. Sirve para lookups por id de producto
 * (ej. el handler de "usar precio del producto existente").
 */
export function buildProductoIdIndex(productos: Producto[]): Map<string, Producto> {
  const idx = new Map<string, Producto>()
  for (const p of productos) {
    if (!idx.has(p.id)) idx.set(p.id, p)
  }
  return idx
}

/**
 * Indexa marcas por nombre normalizado (lowercase + trim). Devuelve el id
 * de la marca, no la entidad completa, porque es lo único que necesita
 * el import.
 */
export function buildMarcaIndex(marcas: Marca[]): Map<string, number> {
  const idx = new Map<string, number>()
  for (const m of marcas) {
    const key = m.nombre.trim().toLowerCase()
    if (!idx.has(key)) idx.set(key, m.id)
  }
  return idx
}
