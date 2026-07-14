import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  producto_id: string
  producto_codigo: string
  producto_nombre?: string | null
  producto_descripcion?: string
  producto_categoria?: string
  producto_procedencia?: string
  producto_almacen: string
  producto_estante: string
  producto_fila: string
  producto_columna: string
  cantidad: number
  precio_unitario: number
  precio_base: number
  marcaId?: number | null
  producto_imagen?: string
  diferencia_kit?: number
  kit_id?: string
  kit_nombre?: string
  kit_codigo?: string
  kit_marcaId?: number | null
  es_kit?: boolean
}

export interface Cart {
  items: CartItem[]
  nota: string
}

interface CajaState {
  cart: Cart
  setCart: (cartOrUpdater: Cart | ((prev: Cart) => Cart)) => void
  clearCart: () => void
}

const emptyCart = (): Cart => ({ items: [], nota: '' })

export const useCajaStore = create<CajaState>()(
  persist(
    (set) => ({
      cart: emptyCart(),
      setCart: (cartOrUpdater) =>
        set((state) => ({
          cart:
            typeof cartOrUpdater === 'function'
              ? cartOrUpdater(state.cart)
              : cartOrUpdater,
        })),
      clearCart: () => set({ cart: emptyCart() }),
    }),
    {
      name: 'caja-cart',
      version: 2,
      // Migración: descarta carritos con la shape v1 (tenían descuento por item)
      migrate: (persisted, fromVersion) => {
        if (fromVersion < 2) return { cart: { items: [], nota: '' } }
        return persisted as CajaState
      },
    }
  )
)
