import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { gql } from '@/lib/graphql'
import { useNotificacionesStore } from '@/stores/notificacionesStore'
import { PRODUCTOS_NOTIFICACIONES_QUERY } from '@/lib/queries/inventario.queries'

const POLL_INTERVAL = 15 * 60 * 1000

interface GqlProductoNode {
  id: string
  nombre: string
  codigo: string
  marcaId: number | null
  stock_Actual: number
  stock_Minimo: number
  esKit: boolean
  calcularStockKit: number | null
}

interface GqlProductosResponse {
  productos: { nodes: GqlProductoNode[] }
}

export function useStockPolling() {
  const { isTokenReady, user } = useAuth()
  const { setProductosBajoStock, setCargando, setUltimaActualizacion } = useNotificacionesStore()

  useEffect(() => {
    if (!isTokenReady || user?.rol !== 'admin') return

    async function fetchStock() {
      setCargando(true)
      try {
        const [dataProductos] = await Promise.all([
          gql<GqlProductosResponse>(PRODUCTOS_NOTIFICACIONES_QUERY),
        ])

        const bajoStock = dataProductos.productos.nodes
          .filter((p) => {
            const stockReal = p.esKit ? (p.calcularStockKit ?? 0) : p.stock_Actual
            return stockReal <= p.stock_Minimo
          })
          .map((p) => ({
            id: p.id,
            nombre: p.nombre,
            codigo: p.codigo,
            stock: p.esKit ? (p.calcularStockKit ?? 0) : p.stock_Actual,
            stockMinimo: p.stock_Minimo,
          }))

        setProductosBajoStock(bajoStock)
        setUltimaActualizacion(new Date())
      } catch {
        // Silent — background poll no crítico
      } finally {
        setCargando(false)
      }
    }

    void fetchStock()
    const interval = setInterval(() => { void fetchStock() }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [isTokenReady, user?.rol])
}
