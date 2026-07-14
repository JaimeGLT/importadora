import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DescuentoConfig {
  id: string
  nombre: string       // "Familia", "Mecánico", etc.
  porcentaje: number   // 10 = 10% de descuento
  color: string        // para UI: "emerald", "amber", "blue", etc.
  activo: boolean
}

interface ConfigState {
  // Tipo de cambio
  tipoCambioHoy: number
  tipoCambioFecha: string
  tipoCambioHabilitado: boolean
  tipoCambioFechaRecordatorio: string
  setTipoCambio: (tipoCambio: number) => void
  setTipoCambioHabilitado: (habilitado: boolean) => void
  setTipoCambioFechaRecordatorio: (fecha: string) => void

  // Tiempos del almacenero (en minutos)
  tiempoCompletarAlmacenero: number
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      tipoCambioHoy: 0,
      tipoCambioFecha: '',
      tipoCambioHabilitado: false,
      tipoCambioFechaRecordatorio: '',

      setTipoCambio: (tipoCambio) =>
        set({
          tipoCambioHoy: tipoCambio,
          tipoCambioFecha: new Date().toISOString().split('T')[0],
        }),

      setTipoCambioHabilitado: (habilitado) => set({ tipoCambioHabilitado: habilitado }),

      setTipoCambioFechaRecordatorio: (fecha) => set({ tipoCambioFechaRecordatorio: fecha }),

      tiempoCompletarAlmacenero: 10,
    }),
    {
      name: 'config-store',
      // Solo persistir lo que debe sobrevivir al reload.
      // tipoCambioHoy y tipoCambioFecha se reescriben cada vez que el admin
      // acepta el modal, así que no hace falta guardarlos: la próxima vez que
      // se muestre el modal se actualizarán.
      partialize: (state) => ({
        tipoCambioHabilitado: state.tipoCambioHabilitado,
        tipoCambioFechaRecordatorio: state.tipoCambioFechaRecordatorio,
        tiempoCompletarAlmacenero: state.tiempoCompletarAlmacenero,
      }),
    }
  )
)
