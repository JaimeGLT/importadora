import type { Cart, CartItem } from '@/stores/cajaStore'
import type { Producto, PiezaKit } from '@/types'

/**
 * Resultado de un cálculo de stock efectivo.
 *
 * - `stockTotal`     → lo que el backend reporta como disponible (stock - stock_reservado).
 * - `enCarrito`      → lo que ya hay en el carrito local (descuenta del total).
 * - `stockEfectivo`  → lo que el usuario realmente puede agregar/seleccionar ahora.
 */
export interface StockInfo {
  stockTotal: number
  enCarrito: number
  stockEfectivo: number
}

/**
 * Calcula el stock efectivo de un producto (normal o kit) considerando lo que
 * el propio cajero ya tiene en su carrito local.
 *
 * Reglas:
 * - Producto normal → descuenta solo items con mismo `producto_id` y sin `kit_id`.
 * - Kit con `piezas_kit` poblado → recalcula el stock del kit como
 *   `min(floor(pieza.stock_efectivo / pieza.cantidad_por_kit))` sobre todas las
 *   piezas, donde `pieza.stock_efectivo` descuenta lo reservado por el carrito.
 * - Kit sin `piezas_kit` (caso típico de la lista de búsqueda) → usa el campo
 *   `stock` del backend y descuenta kits completos con mismo `producto_id`.
 */
export function getStockEfectivo(producto: Producto, cart: Cart): StockInfo {
  if (!producto.es_kit) {
    return calcularStockProductoNormal(producto, cart)
  }
  if (producto.piezas_kit && producto.piezas_kit.length > 0) {
    return calcularStockKitConPiezas(producto, cart)
  }
  return calcularStockKitSinPiezas(producto, cart)
}

/**
 * Calcula el stock efectivo de una pieza suelta, considerando tanto piezas
 * sueltas en el carrito como kits completos del padre que también consumen esta pieza.
 */
export function getStockEfectivoPieza(
  pieza: PiezaKit,
  cart: Cart,
  parentKitId: string,
): StockInfo {
  const stockTotal = Math.max(0, pieza.stock_actual - pieza.stock_reservado)
  const impacto = impactoPiezaEnCarrito(pieza, cart, parentKitId)
  const enCarrito = impacto.total
  const stockEfectivo = Math.max(0, stockTotal - enCarrito)
  return { stockTotal, enCarrito, stockEfectivo }
}

/**
 * Desglose del impacto del carrito sobre una pieza específica.
 * Exportado para tests, tooltips de debug, o futuras UI informativas.
 */
export function impactoPiezaEnCarrito(
  pieza: PiezaKit,
  cart: Cart,
  parentKitId: string,
): { piezasSueltas: number; kitsCompletos: number; total: number } {
  const piezasSueltas = piezasSueltasEnCarrito(cart, String(pieza.id), parentKitId)
  const kitsCompletos = kitsCompletosEnCarrito(cart, parentKitId)
  const total = piezasSueltas + kitsCompletos * pieza.cantidad_por_kit
  return { piezasSueltas, kitsCompletos, total }
}

// ─── Internals ────────────────────────────────────────────────────────────────

function calcularStockProductoNormal(producto: Producto, cart: Cart): StockInfo {
  const stockTotal = Math.max(0, producto.stock - (producto.stock_reservado ?? 0))
  const enCarrito = sumQty(cart.items, (i) => i.producto_id === producto.id && !i.kit_id)
  return {
    stockTotal,
    enCarrito,
    stockEfectivo: Math.max(0, stockTotal - enCarrito),
  }
}

function calcularStockKitConPiezas(kit: Producto, cart: Cart): StockInfo {
  // stockTotal = cuántos kits se pueden armar en el mundo con las piezas que NO
  // están reservadas por otras órdenes (reservas de OTROS cajeros, reflejadas
  // en pieza.stock_reservado). No restamos el impacto del carrito local acá:
  // ese descuento se hace al final con `enCarrito` para derivar `stockEfectivo`.
  let minKits = Infinity
  for (const pieza of kit.piezas_kit!) {
    const piezaStockDisponible = Math.max(0, pieza.stock_actual - pieza.stock_reservado)
    const kitsPosibles = Math.floor(piezaStockDisponible / pieza.cantidad_por_kit)
    if (kitsPosibles < minKits) minKits = kitsPosibles
  }
  const stockTotal = minKits === Infinity ? 0 : minKits
  const enCarrito = kitsCompletosEnCarrito(cart, kit.id)
  return {
    stockTotal,
    enCarrito,
    stockEfectivo: Math.max(0, stockTotal - enCarrito),
  }
}

function calcularStockKitSinPiezas(kit: Producto, cart: Cart): StockInfo {
  const stockTotal = Math.max(0, kit.stock - (kit.stock_reservado ?? 0))
  const enCarrito = kitsCompletosEnCarrito(cart, kit.id)
  return {
    stockTotal,
    enCarrito,
    stockEfectivo: Math.max(0, stockTotal - enCarrito),
  }
}

function sumQty(items: CartItem[], match: (i: CartItem) => boolean): number {
  let s = 0
  for (const i of items) if (match(i)) s += i.cantidad
  return s
}

function kitsCompletosEnCarrito(cart: Cart, kitId: string): number {
  return sumQty(
    cart.items,
    (i) => !i.kit_id && i.es_kit === true && i.producto_id === kitId,
  )
}

function piezasSueltasEnCarrito(cart: Cart, piezaId: string, parentKitId: string): number {
  return sumQty(
    cart.items,
    (i) => i.producto_id === piezaId && i.kit_id === parentKitId,
  )
}
