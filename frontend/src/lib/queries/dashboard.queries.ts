import type { ProductoAPISimple } from './inventario.queries'
import type { DashboardOrdenAPI } from './ventas.queries'
import type { TipoCambioAPI } from './config.queries'

export const DASHBOARD_QUERY = `
  query Dashboard($first: Int, $after: String) {
    productos(first: $first, after: $after) {
      nodes {
        id
        codigo
        codigoAux
        codigoAux2
        nombre
        marcaId
        ubicacion
        stock_Actual
        stockReservado
        stock_Minimo
        calcularStockKit
        esKit
        costo
        precio
        conversionABs
        fechaCreacion
        fechaActualizacion
      }
    }
    todasOrdenes {
      nodes {
        id
        estado
        fecha
        fechaCompletada
        montoDescuento
        cajero { nombre apellido }
        items {
          id_Producto
          cantidad
          precioUnitario
          producto { id codigo nombre }
        }
      }
    }
    tipoCambio {
      id
      precioDolar
      fecha
    }
  }
`

export interface DashboardQueryResult {
  productos: { nodes: ProductoAPISimple[] }
  todasOrdenes: { nodes: DashboardOrdenAPI[] }
  tipoCambio: TipoCambioAPI
}
