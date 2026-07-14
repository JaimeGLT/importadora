import { useEffect } from 'react'
import { playAlertBeep } from '@/lib/sounds'
import { notify } from '@/lib/notify'

const broadcast = typeof window !== 'undefined'
  ? new BroadcastChannel('ventas-sync')
  : null

export function useVentasAlerts() {
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== 'alert') return
      const { alertType, ordenId } = e.data as {
        alertType: 'faltante' | 'expirado' | 'cancelado'
        ordenId: string
      }
      playAlertBeep()

      if (alertType === 'faltante') {
        notify.error(`Un producto fue marcado como faltante en la orden`)
      } else if (alertType === 'expirado') {
        notify.error(`La orden #${ordenId.slice(0, 8)} expiró`)
      } else if (alertType === 'cancelado') {
        notify.warning(`La orden #${ordenId.slice(0, 8)} fue cancelada`)
      }
    }

    broadcast?.addEventListener('message', handler)
    return () => broadcast?.removeEventListener('message', handler)
  }, [])
}
