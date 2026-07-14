// ─── Overlay ─────────────────────────────────────────────────────────────────
// Envoltorio histórico. La implementación visual vive en
// `frontend/src/pages/inventario/ImportProgressView.tsx` y se reutiliza con
// `variant="overlay"`. Este archivo se conserva porque ImportacionesPage lo
// importa por path estable. Si en el futuro se decide consolidar en
// `src/components/ui/`, se actualiza este import.

import { ImportProgressView } from '@/pages/inventario/ImportProgressView'

interface ImportProgressOverlayProps {
  /** Productos ya enviados al backend (post-POST del lote). 0 al arrancar. */
  current: number
  /** Total de productos a importar. */
  total: number
}

export function ImportProgressOverlay({ current, total }: ImportProgressOverlayProps) {
  return <ImportProgressView variant="overlay" current={current} total={total} />
}
