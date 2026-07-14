import { create } from 'zustand'
import type { Marca } from '@/types'

interface MarcasState {
  marcas: Marca[]
  setMarcas: (marcas: Marca[]) => void
  addMarca: (marca: Marca) => void
  updateMarca: (id: number, nombre: string) => void
  removeMarca: (id: number) => void
}

export const useMarcasStore = create<MarcasState>()((set) => ({
  marcas: [],

  setMarcas: (marcas) => set({ marcas }),

  addMarca: (marca) =>
    set((state) => ({ marcas: [...state.marcas, marca] })),

  updateMarca: (id, nombre) =>
    set((state) => ({
      marcas: state.marcas.map((m) => (m.id === id ? { ...m, nombre } : m)),
    })),

  removeMarca: (id) =>
    set((state) => ({ marcas: state.marcas.filter((m) => m.id !== id) })),
}))