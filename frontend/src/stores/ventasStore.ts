import { create } from 'zustand'
import type { OrdenVenta, ItemOrden } from '@/types'
import { useConfigStore } from './configStore'

// Misma fórmula que backendToOrdenVenta (lib/queries/ventas.queries.ts):
// para items no parciales usa precio_unitario * cantidad_pedida (descuento prorrateado),
// para items parciales suma precio_unitario * cantidad de cada pieza.
function recalcularTotal(items: ItemOrden[]): number {
  return items.reduce((s, i) => {
    if (i.es_parcial && i.piezas_orden?.length) {
      return s + i.piezas_orden.reduce(
        (ps, p) => ps + (p.precio_unitario ?? i.precio_unitario) * p.cantidad,
        0,
      )
    }
    return s + i.precio_unitario * i.cantidad_pedida
  }, 0)
}

interface VentasState {
  ordenes: OrdenVenta[]
  setOrdenes: (ordenes: OrdenVenta[]) => void
  addOrden: (orden: OrdenVenta) => void
  updateOrden: (id: string, data: Partial<OrdenVenta>) => void
  addItemToOrden: (ordenId: string, item: ItemOrden) => void
  removeItemFromOrden: (ordenId: string, itemId: string) => void
  updateItemQtyInOrden: (ordenId: string, itemId: string, cantidad: number) => void
  markItemListoEnOrden: (ordenId: string, itemId: string) => void
  updateItemEstadoEnOrden: (ordenId: string, itemId: string, estado: ItemOrden['estado']) => void
  marcarItemFaltante: (ordenId: string, itemId: string, cantidad: number) => void
  cancelarOrdenYLiberarStock: (id: string) => void
  updatePiezaQtyInOrden: (ordenId: string, itemId: string, piezaId: number, cantidad: number) => void
  removePiezaFromOrden: (ordenId: string, itemId: string, piezaId: number) => void
}

const broadcast = typeof window !== 'undefined'
  ? new BroadcastChannel('ventas-sync')
  : null

export const useVentasStore = create<VentasState>()((set, get) => ({
  ordenes: [],

  setOrdenes: (ordenes) => set({ ordenes }),

  addOrden: (orden) => {
    set((s) => ({ ordenes: [orden, ...s.ordenes] }))
    broadcast?.postMessage({ type: 'sync', ordenes: get().ordenes })
  },

  updateOrden: (id, data) => {
    set((s) => ({
      ordenes: s.ordenes.map((o) =>
        o.id === id ? { ...o, ...data, actualizado_en: new Date().toISOString() } : o,
      ),
    }))
    broadcast?.postMessage({ type: 'sync', ordenes: get().ordenes })
  },

  addItemToOrden: (ordenId, item) => {
    set((s) => ({
      ordenes: s.ordenes.map((o) =>
        o.id === ordenId
          ? { ...o, items: [...o.items, item], total: recalcularTotal([...o.items, item]) }
          : o,
      ),
    }))
    broadcast?.postMessage({ type: 'sync', ordenes: get().ordenes })
  },

  removeItemFromOrden: (ordenId, itemId) => {
    set((s) => ({
      ordenes: s.ordenes.map((o) => {
        if (o.id !== ordenId) return o
        const items = o.items.filter((i) => i.id !== itemId)
        return { ...o, items, total: recalcularTotal(items) }
      }),
    }))
    broadcast?.postMessage({ type: 'sync', ordenes: get().ordenes })
  },

  updateItemQtyInOrden: (ordenId, itemId, cantidad) => {
    set((s) => ({
      ordenes: s.ordenes.map((o) => {
        if (o.id !== ordenId) return o
        const items = o.items.map((i) =>
          i.id === itemId
            ? { ...i, cantidad_pedida: cantidad, subtotal: i.precio_unitario * cantidad }
            : i,
        )
        return { ...o, items, total: recalcularTotal(items) }
      }),
    }))
    broadcast?.postMessage({ type: 'sync', ordenes: get().ordenes })
  },

  markItemListoEnOrden: (ordenId, itemId) => {
    set((s) => ({
      ordenes: s.ordenes.map((o) =>
        o.id === ordenId
          ? {
              ...o,
              items: o.items.map((i) =>
                i.id === itemId ? { ...i, estado: 'listo_almacenero' as const } : i,
              ),
            }
          : o,
      ),
    }))
    broadcast?.postMessage({ type: 'sync', ordenes: get().ordenes })
  },

  updateItemEstadoEnOrden: (ordenId, itemId, estado) => {
    set((s) => ({
      ordenes: s.ordenes.map((o) =>
        o.id === ordenId
          ? { ...o, items: o.items.map((i) => i.id === itemId ? { ...i, estado } : i) }
          : o,
      ),
    }))
    broadcast?.postMessage({ type: 'sync', ordenes: get().ordenes })
  },

  marcarItemFaltante: (ordenId, itemId, _cantidad) => {
    set((s) => ({
      ordenes: s.ordenes.map((o) => {
        if (o.id !== ordenId) return o
        return {
          ...o,
          items: o.items.map((i) =>
            i.id === itemId ? { ...i, estado: 'faltante' as const } : i,
          ),
        }
      }),
    }))
    broadcast?.postMessage({ type: 'sync', ordenes: get().ordenes })
    broadcast?.postMessage({ type: 'alert', alertType: 'faltante', ordenId, itemId })
  },

  cancelarOrdenYLiberarStock: (id) => {
    set((s) => ({
      ordenes: s.ordenes.map((o) =>
        o.id === id
          ? { ...o, estado: 'cancelada' as const, actualizado_en: new Date().toISOString() }
          : o,
      ),
    }))
    broadcast?.postMessage({ type: 'sync', ordenes: get().ordenes })
    broadcast?.postMessage({ type: 'alert', alertType: 'cancelado', ordenId: id })
  },

  updatePiezaQtyInOrden: (ordenId, itemId, piezaId, cantidad) => {
    if (cantidad <= 0) {
      // Si la cantidad llega a 0, eliminar la pieza (que también puede eliminar el item padre)
      get().removePiezaFromOrden(ordenId, itemId, piezaId)
      return
    }
    set((s) => ({
      ordenes: s.ordenes.map((o) => {
        if (o.id !== ordenId) return o
        const items = o.items.map((i) => {
          if (i.id !== itemId) return i
          const piezasActualizadas = (i.piezas_orden ?? []).map((p) =>
            p.id === piezaId ? { ...p, cantidad } : p,
          )
          const cantidadTotal = piezasActualizadas.reduce((acc, p) => acc + p.cantidad, 0)
          const subtotalTotal = piezasActualizadas.reduce(
            (acc, p) => acc + p.cantidad * (p.precio_unitario ?? i.precio_unitario),
            0,
          )
          return {
            ...i,
            piezas_orden: piezasActualizadas,
            cantidad_pedida: cantidadTotal,
            subtotal: subtotalTotal,
          }
        })
        return { ...o, items, total: recalcularTotal(items) }
      }),
    }))
    broadcast?.postMessage({ type: 'sync', ordenes: get().ordenes })
  },

  removePiezaFromOrden: (ordenId, itemId, piezaId) => {
    // Detectar si el item padre quedará sin piezas antes de aplicar el cambio
    const ordenActual = get().ordenes.find((o) => o.id === ordenId)
    const itemActual = ordenActual?.items.find((i) => i.id === itemId)
    const piezasRestantes = (itemActual?.piezas_orden ?? []).filter((p) => p.id !== piezaId)
    const itemQuedoVacio = piezasRestantes.length === 0

    if (itemQuedoVacio) {
      get().removeItemFromOrden(ordenId, itemId)
      return
    }

    set((s) => ({
      ordenes: s.ordenes.map((o) => {
        if (o.id !== ordenId) return o
        const items = o.items.map((i) => {
          if (i.id !== itemId) return i
          const cantidadTotal = piezasRestantes.reduce((acc, p) => acc + p.cantidad, 0)
          const subtotalTotal = piezasRestantes.reduce(
            (acc, p) => acc + p.cantidad * (p.precio_unitario ?? i.precio_unitario),
            0,
          )
          return {
            ...i,
            piezas_orden: piezasRestantes,
            cantidad_pedida: cantidadTotal,
            subtotal: subtotalTotal,
          }
        })
        return { ...o, items, total: recalcularTotal(items) }
      }),
    }))
    broadcast?.postMessage({ type: 'sync', ordenes: get().ordenes })
  },
}))

// Recibir sync de otras pestañas
broadcast?.addEventListener('message', (e: MessageEvent) => {
  if (e.data?.type === 'sync') {
    useVentasStore.getState().setOrdenes(e.data.ordenes as OrdenVenta[])
  }
})

// ─── Expiración automática ──────────────────────────────────────────────────

let expiracionInterval: ReturnType<typeof setInterval> | null = null

export function iniciarTimersExpiracion() {
  if (expiracionInterval) return
  expiracionInterval = setInterval(() => {
    const { ordenes, cancelarOrdenYLiberarStock } = useVentasStore.getState()
    const config = useConfigStore.getState()
    const ahora = Date.now()

    ordenes.forEach((orden) => {
      if (orden.estado === 'pendiente_almacenero' && orden.caduca_en) {
        if (ahora > new Date(orden.caduca_en).getTime()) {
          cancelarOrdenYLiberarStock(orden.id)
          broadcast?.postMessage({ type: 'alert', alertType: 'expirado', ordenId: orden.id })
        }
      }
      if (orden.estado === 'en_preparacion' && orden.aceptado_en) {
        const limite = new Date(orden.aceptado_en).getTime() + config.tiempoCompletarAlmacenero * 60 * 1000
        if (ahora > limite) {
          cancelarOrdenYLiberarStock(orden.id)
          broadcast?.postMessage({ type: 'alert', alertType: 'expirado', ordenId: orden.id })
        }
      }
    })
  }, 5000)
}

export function detenerTimersExpiracion() {
  if (expiracionInterval) {
    clearInterval(expiracionInterval)
    expiracionInterval = null
  }
}
