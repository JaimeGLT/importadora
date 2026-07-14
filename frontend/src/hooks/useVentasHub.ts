import { useCallback, useEffect, useRef, useState } from 'react'
import { HttpTransportType, HubConnectionBuilder, HubConnectionState, type HubConnection } from '@microsoft/signalr'

interface HubHandlers {
  onNuevaOrden?: (p: { id: number; fecha: string; cantItems: number; id_cliente: number | null }) => void
  onOrdenAceptada?: (p: { id: number; almaceneroId: number }) => void
  onOrdenLista?: (p: { id: number }) => void
  onOrdenCompletada?: (p: { id: number; total: number }) => void
  onOrdenCancelada?: (p: { id: number; nota: string | null }) => void
  onNuevoItemAgregado?: (p: { ordenId: number; itemId: number; productoNombre: string; codigo: string; cantidad: number }) => void
  onItemEliminado?: (p: { ordenId: number; itemId: number }) => void
  onCantidadItemActualizada?: (p: { ordenId: number; itemId: number; nuevaCantidad: number }) => void
  onItemListoParaScaneo?: (p: { ordenId: number; itemId: number }) => void
  onOrdenConFaltantes?: (p: { ordenId: number }) => void
  onOrdenEsperandoPago?: (p: { id: number }) => void
  onItemFaltanteReportado?: (p: { ordenId: number; itemId: number }) => void
  onPiezaFaltanteReportado?: (p: { ordenId: number; itemId: number; piezaItemId: number }) => void
  onFaltanteRevertido?: (p: { ordenId: number; itemId: number; piezaItemId?: number }) => void
}

export function useVentasHub(
  handlers: HubHandlers,
  isReady: boolean,
  initialGrupos?: string[],
): { isConnected: boolean; joinGrupo: (g: string) => Promise<void> } {
  const [isConnected, setIsConnected] = useState(false)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const connRef = useRef<HubConnection | null>(null)
  const initialGruposRef = useRef(initialGrupos)
  initialGruposRef.current = initialGrupos
  const joinedGruposRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isReady) return

    const conn = new HubConnectionBuilder()
      .withUrl('/hubs/ventas', { withCredentials: true, transport: HttpTransportType.ServerSentEvents })
      .withAutomaticReconnect()
      
      .build()

    connRef.current = conn

    conn.on('NuevaOrden', (p) => handlersRef.current.onNuevaOrden?.(p))
    conn.on('OrdenAceptada', (p) => handlersRef.current.onOrdenAceptada?.(p))
    conn.on('OrdenLista', (p) => handlersRef.current.onOrdenLista?.(p))
    conn.on('OrdenCompletada', (p) => handlersRef.current.onOrdenCompletada?.(p))
    conn.on('OrdenCancelada', (p) => handlersRef.current.onOrdenCancelada?.(p))
    conn.on('NuevoItemAgregado', (p) => handlersRef.current.onNuevoItemAgregado?.(p))
    conn.on('ItemEliminado', (p) => handlersRef.current.onItemEliminado?.(p))
    conn.on('CantidadItemActualizada', (p) => handlersRef.current.onCantidadItemActualizada?.(p))
    conn.on('ItemListoParaScaneo', (p) => handlersRef.current.onItemListoParaScaneo?.(p))
    conn.on('OrdenConFaltantes', (p) => handlersRef.current.onOrdenConFaltantes?.(p))
    conn.on('OrdenEsperandoPago', (p) => handlersRef.current.onOrdenEsperandoPago?.(p))
    conn.on('ItemFaltanteReportado', (p) => handlersRef.current.onItemFaltanteReportado?.(p))
    conn.on('PiezaFaltanteReportado', (p) => handlersRef.current.onPiezaFaltanteReportado?.(p))
    conn.on('FaltanteRevertido', (p) => handlersRef.current.onFaltanteRevertido?.(p))

    conn.onreconnecting(() => setIsConnected(false))
    conn.onreconnected(async () => {
      setIsConnected(true)
      for (const g of initialGruposRef.current ?? []) {
        await conn.invoke('UnirseAGrupo', g).catch(() => {})
      }
      for (const g of joinedGruposRef.current) {
        await conn.invoke('UnirseAGrupo', g).catch(() => {})
      }
    })
    conn.onclose(() => setIsConnected(false))

    conn.start()
      .then(async () => {
        setIsConnected(true)
        for (const g of initialGruposRef.current ?? []) {
          await conn.invoke('UnirseAGrupo', g).catch(() => {})
        }
        for (const g of joinedGruposRef.current) {
          await conn.invoke('UnirseAGrupo', g).catch(() => {})
        }
      })
      .catch(() => setIsConnected(false))

    return () => {
      connRef.current = null
      conn.stop()
    }
  }, [isReady])

  const joinGrupo = useCallback(async (grupo: string) => {
    joinedGruposRef.current.add(grupo)
    if (connRef.current?.state === HubConnectionState.Connected) {
      await connRef.current.invoke('UnirseAGrupo', grupo).catch(() => {})
    }
  }, [])

  return { isConnected, joinGrupo }
}
