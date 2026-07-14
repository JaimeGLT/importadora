import { create } from 'zustand'
import type { Importacion, OrigenConfig } from '@/types'

interface ImportacionesState {
  importaciones: Importacion[]
  origenes: OrigenConfig[]
  setImportaciones: (items: Importacion[]) => void
  addImportacion: (item: Importacion) => void
  updateImportacion: (id: string, data: Partial<Importacion>) => void
  setOrigenes: (origenes: OrigenConfig[]) => void
  addOrigen: (origen: OrigenConfig) => void
  updateOrigen: (id: string, data: Partial<OrigenConfig>) => void
  deleteOrigen: (id: string) => void
}

export const useImportacionesStore = create<ImportacionesState>((set) => ({
  importaciones: [],
  origenes: [],

  setImportaciones: (importaciones) => set({ importaciones }),
  addImportacion: (item) =>
    set((s) => ({ importaciones: [item, ...s.importaciones] })),
  updateImportacion: (id, data) =>
    set((s) => ({
      importaciones: s.importaciones.map((i) =>
        i.id === id ? { ...i, ...data, actualizado_en: new Date().toISOString() } : i,
      ),
    })),

  setOrigenes: (origenes) => set({ origenes }),
  addOrigen: (origen) => set((s) => ({ origenes: [...s.origenes, origen] })),
  updateOrigen: (id, data) =>
    set((s) => ({
      origenes: s.origenes.map((o) => (o.id === id ? { ...o, ...data } : o)),
    })),
  deleteOrigen: (id) =>
    set((s) => ({ origenes: s.origenes.filter((o) => o.id !== id) })),
}))
