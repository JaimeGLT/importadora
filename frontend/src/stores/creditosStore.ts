import { create } from 'zustand'
import type { Credito, EstadoCredito } from '@/types'

/**
 * Store de créditos. Por convención del repo NO hace fetch: el page
 * o modal llama a la API y usa `setCreditos` o `addCredito` para
 * mantener el store sincronizado. Los componentes leen de acá.
 */
interface CreditosState {
  creditos: Credito[]
  creditoSeleccionado: Credito | null
  setCreditos: (creditos: Credito[]) => void
  addCredito: (credito: Credito) => void
  updateCredito: (id: number, updates: Partial<Omit<Credito, 'id' | 'fechaCreacion'>>) => void
  cancelarCredito: (id: number) => void
  setCreditoSeleccionado: (credito: Credito | null) => void
}

export const useCreditosStore = create<CreditosState>((set) => ({
  creditos: [],
  creditoSeleccionado: null,

  setCreditos: (creditos) => set({ creditos }),

  addCredito: (credito) =>
    set((state) => ({ creditos: [credito, ...state.creditos] })),

  updateCredito: (id, updates) =>
    set((state) => ({
      creditos: state.creditos.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      creditoSeleccionado:
        state.creditoSeleccionado?.id === id
          ? { ...state.creditoSeleccionado, ...updates }
          : state.creditoSeleccionado,
    })),

  cancelarCredito: (id) =>
    set((state) => ({
      creditos: state.creditos.map((c) =>
        c.id === id
          ? {
              ...c,
              estado: 'Cancelado' as EstadoCredito,
              fechaCancelacion: new Date().toISOString(),
            }
          : c,
      ),
      creditoSeleccionado:
        state.creditoSeleccionado?.id === id
          ? {
              ...state.creditoSeleccionado,
              estado: 'Cancelado' as EstadoCredito,
              fechaCancelacion: new Date().toISOString(),
            }
          : state.creditoSeleccionado,
    })),

  setCreditoSeleccionado: (credito) => set({ creditoSeleccionado: credito }),
}))
