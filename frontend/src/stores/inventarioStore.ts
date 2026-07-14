import { create } from 'zustand'
import type { Producto, Proveedor, Filters, KitRelacion } from '@/types'

interface InventarioState {
  productos: Producto[]
  total: number
  proveedores: Proveedor[]
  filters: Filters
  sorting: import('@tanstack/react-table').SortingState
  selectedRows: Set<string>
  modalOpen: boolean
  importOpen: boolean
  kitRelaciones: KitRelacion[]
  setProductos: (productos: Producto[], total: number) => void
  setProveedores: (proveedores: Proveedor[]) => void
  setFilters: (filters: Partial<Filters>) => void
  resetFilters: () => void
  addProducto: (producto: Producto) => void
  updateProducto: (producto: Producto) => void
  removeProducto: (id: string) => void
  reservarStock: (id: string, qty: number) => void
  liberarReserva: (id: string, qty: number) => void
  confirmarSalida: (id: string, qty: number) => void
  setSorting: (sorting: import('@tanstack/react-table').SortingState) => void
  toggleRowSelection: (id: string) => void
  clearSelection: () => void
  setModalOpen: (open: boolean) => void
  setImportOpen: (open: boolean) => void
  addKitRelacion: (relacion: KitRelacion) => void
  removeKitRelacion: (kitId: string, productoId: string) => void
  getKitRelaciones: (kitId: string) => KitRelacion[]
  getKitStock: (kitId: string) => number
  venderKit: (kitId: string) => boolean
  setKitRelaciones: (relaciones: KitRelacion[]) => void
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  categoria: '',
  estado: '',
  page: 1,
  pageSize: 20,
}

export const useInventarioStore = create<InventarioState>()((set, get) => ({
  productos: [],
  total: 0,
  proveedores: [],
  filters: DEFAULT_FILTERS,
  sorting: [],
  selectedRows: new Set(),
  modalOpen: false,
  importOpen: false,
  kitRelaciones: [],

  setProductos: (productos, total) => set({ productos, total }),
  setProveedores: (proveedores) => set({ proveedores }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters, page: 1 } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  addProducto: (producto) =>
    set((state) => ({
      productos: [producto, ...state.productos],
      total: state.total + 1,
    })),
  updateProducto: (producto) =>
    set((state) => ({
      productos: state.productos.map(p =>
        p.id === producto.id ? producto : p,
      ),
    })),
  removeProducto: (id) =>
    set((state) => ({
      productos: state.productos.filter(p => p.id !== id),
      total: Math.max(0, state.total - 1),
    })),
  reservarStock: (id, qty) =>
    set((state) => ({
      productos: state.productos.map(p =>
        p.id === id
          ? { ...p, stock: Math.max(0, p.stock - qty), stock_reservado: (p.stock_reservado ?? 0) + qty }
          : p,
      ),
    })),
  liberarReserva: (id, qty) =>
    set((state) => ({
      productos: state.productos.map(p =>
        p.id === id
          ? { ...p, stock: p.stock + qty, stock_reservado: Math.max(0, (p.stock_reservado ?? 0) - qty) }
          : p,
      ),
    })),
  confirmarSalida: (id, qty) =>
    set((state) => ({
      productos: state.productos.map(p =>
        p.id === id
          ? {
              ...p,
              stock: Math.max(0, p.stock - qty),
              stock_reservado: Math.max(0, (p.stock_reservado ?? 0) - qty),
            }
          : p,
      ),
    })),

  setSorting: (sorting) => set({ sorting }),

  toggleRowSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedRows)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedRows: next }
    }),

  clearSelection: () => set({ selectedRows: new Set() }),

  setModalOpen: (open) => set({ modalOpen: open }),
  setImportOpen: (open) => set({ importOpen: open }),

  addKitRelacion: (relacion) =>
    set((state) => ({
      kitRelaciones: [...state.kitRelaciones, relacion],
    })),
  removeKitRelacion: (kitId, productoId) =>
    set((state) => ({
      kitRelaciones: state.kitRelaciones.filter(
        r => !(r.kit_id === kitId && r.producto_id === productoId)
      ),
    })),
  getKitRelaciones: (kitId) =>
    get().kitRelaciones.filter(r => r.kit_id === kitId),
  getKitStock: (kitId) => {
    const state = get()
    const relaciones = state.kitRelaciones.filter(r => r.kit_id === kitId)
    if (relaciones.length === 0) {
      const kit = state.productos.find(p => p.id === kitId)
      return kit?.stock ?? 0
    }
    let minKits = Infinity
    for (const rel of relaciones) {
      const parte = state.productos.find(p => p.id === rel.producto_id)
      if (!parte) return 0
      const cantidad = Math.floor(parte.stock / rel.cantidad)
      if (cantidad < minKits) minKits = cantidad
    }
    return minKits === Infinity ? 0 : minKits
  },
  venderKit: (kitId) => {
    const state = get()
    const relaciones = state.kitRelaciones.filter(r => r.kit_id === kitId)
    if (relaciones.length === 0) return false
    const newProductos = state.productos.map(p => {
      if (p.id === kitId) {
        return { ...p, stock: Math.max(0, p.stock - 1) }
      }
      const rel = relaciones.find(r => r.producto_id === p.id)
      if (rel) {
        return { ...p, stock: Math.max(0, p.stock - rel.cantidad) }
      }
      return p
    })
    set({ productos: newProductos })
    return true
  },
  setKitRelaciones: (relaciones) => set({ kitRelaciones: relaciones }),
}))