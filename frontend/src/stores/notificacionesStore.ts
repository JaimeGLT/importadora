import { create } from 'zustand'

export interface ProductoBajoStock {
  id: string
  nombre: string
  codigo: string
  stock: number
  stockMinimo: number
}

interface NotificacionesState {
  productosBajoStock: ProductoBajoStock[]
  cargando: boolean
  ultimaActualizacion: Date | null
  setProductosBajoStock: (p: ProductoBajoStock[]) => void
  setCargando: (b: boolean) => void
  setUltimaActualizacion: (d: Date) => void
}

export const useNotificacionesStore = create<NotificacionesState>()((set) => ({
  productosBajoStock: [],
  cargando: false,
  ultimaActualizacion: null,
  setProductosBajoStock: (productosBajoStock) => set({ productosBajoStock }),
  setCargando: (cargando) => set({ cargando }),
  setUltimaActualizacion: (ultimaActualizacion) => set({ ultimaActualizacion }),
}))
