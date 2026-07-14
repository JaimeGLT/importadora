import { create } from 'zustand'
import type { Proveedor } from '@/types'

interface ProveedoresState {
  proveedores: Proveedor[]
  setProveedores: (proveedores: Proveedor[]) => void
  addProveedor: (proveedor: Proveedor) => void
  updateProveedor: (id: string, partial: Partial<Proveedor>) => void
  removeProveedor: (id: string) => void
}

export const useProveedoresStore = create<ProveedoresState>()((set) => ({
  proveedores: [],

  setProveedores: (proveedores) => set({ proveedores }),

  addProveedor: (proveedor) =>
    set((state) => ({ proveedores: [...state.proveedores, proveedor] })),

  updateProveedor: (id, partial) =>
    set((state) => ({
      proveedores: state.proveedores.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    })),

  removeProveedor: (id) =>
    set((state) => ({ proveedores: state.proveedores.filter((p) => p.id !== id) })),
}))
