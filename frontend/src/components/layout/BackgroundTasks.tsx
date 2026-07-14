import { useStockPolling } from '@/hooks/useStockPolling'

/**
 * Componente sin UI que monta tareas en background que deben vivir durante
 * toda la sesión (polling, listeners, etc.) sin re-montarse con cada navegación.
 *
 * Se renderiza una sola vez en el shell de la app (`App.tsx`), hermano de
 * `<Routes>`. NO dentro de `<MainLayout>` — eso causaría que se ejecutara en
 * cada navegación porque cada página envuelve su contenido con su propio
 * `<MainLayout>` (no hay layout persistente en el router).
 */
export function BackgroundTasks(): null {
  useStockPolling()
  return null
}
