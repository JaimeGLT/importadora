// ─── Auth ────────────────────────────────────────────────────────────────────

export type RolUsuario = 'admin' | 'cajero' | 'almacenero' | 'operador'

export interface Usuario {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: RolUsuario
  activo: boolean
  bloqueadoHasta?: string | null
  horario?: { horaInicio: string; horaFin: string; activo: boolean } | null
  porcentajeComision?: number
  creado_en: string
  actualizado_en: string
}

export interface AuthState {
  user: Usuario | null
  isAuthenticated: boolean
}

// ─── Inventario ───────────────────────────────────────────────────────────────

export type UnidadProducto = 'pieza' | 'juego' | 'par' | 'kit' | 'litro' | 'metro' | 'otro'

export type EstadoProducto = 'activo' | 'descontinuado' | 'sin_stock'

export interface HistorialPrecio {
  fecha: string          // ISO
  precio_costo: number
  precio_venta: number
  tipo_cambio: number    // tasa Bs/USD al momento del cambio
  nota?: string
}

/**
 * Una imagen de la galería de un producto. Mapeo del DtoProductoImagenResponse
 * del backend. La galería completa viene en `Producto.imagenes` (modo edición).
 * Para la lista de inventario se usa `Producto.imagen` (URL de la principal).
 */
export interface ProductoImagen {
  id: number
  productoId: number
  url: string            // URL pública lista para <img src>
  key: string            // R2 key (interno)
  nombreArchivo: string
  contentType: string
  tamanoBytes: number
  anchoPx?: number | null
  altoPx?: number | null
  orden: number          // posición 1, 2, 3...
  esPrincipal: boolean
  estado: 'Pendiente' | 'Activa' | 'Eliminada'
  fechaSubida: string    // ISO
}

export interface Producto {
  id: string
  codigo_universal: string        // código principal — búsquedas y código de barras
  codigos_alternativos: string[]  // hasta 2 códigos adicionales (caja / proveedor)
  nombre?: string                 // opcional — puede ser string vacío o null
  descripcion: string
  procedencia?: string
  categoria?: string
  marcaId?: number | null
  marca?: string
  vehiculo: string                // compatibilidad libre: "Toyota Corolla 2018-2023"
  unidad: UnidadProducto
  stock: number
  stock_reservado?: number
  stock_minimo: number
  piezas: number                   // piezas por unidad (default 1)
  precio_costo: number
  precio_venta: number            // en bolivianos (Bs)
  conversionABs?: number
  historial_precios: HistorialPrecio[]
  almacen: string
  estante: string
  fila: string
  columna: string
  imagen?: string                 // URL de la imagen principal (thumb). Compatibilidad con call-sites existentes.
  imagenes?: ProductoImagen[]     // Galería completa (solo en modo edición / detalle).
  estado: EstadoProducto
  proveedor_id: string
  es_kit?: boolean
  kit_id?: string | null
  cantidad_por_kit?: number
  piezas_kit?: PiezaKit[]
  creado_en: string
  actualizado_en: string
}

export interface KitRelacion {
  kit_id: string
  producto_id: string
  cantidad: number
}

export interface PiezaKit {
  id: number
  id_producto: number
  nombre: string
  cantidad_por_kit: number
  stock_actual: number
  stock_reservado: number
  codigo_universal?: string
  /**
   * Código técnico autogenerado por el backend.
   * Formato: P{Orden}-{PrefijoMarcaKit o 'NO' si sin marca}-{CodigoKit}.
   * Se regenera automáticamente al cambiar la marca del kit padre.
   */
  codigo_pieza: string
  /** Posición secuencial de la pieza dentro del kit (1, 2, 3...). Autogenerado. */
  orden: number
}

export type MonedaProveedor = 'USD' | 'EUR' | 'CNY' | 'GBP' | 'JPY' | 'KRW' | 'BRL' | 'ARS' | 'CLP' | 'PEN'

export type TerminosPago =
  | 'T/T anticipado'
  | 'T/T 30 días'
  | 'T/T 60 días'
  | 'L/C a la vista'
  | 'L/C 30 días'
  | 'NET 30'
  | 'NET 60'
  | 'Contra entrega'

export interface Proveedor {
  id: string
  nombre: string
  pais?: string
  moneda?: MonedaProveedor
  terminos_pago?: TerminosPago
  contacto?: string
  email?: string
  telefono?: string
  sitio_web?: string
  notas?: string
  tiempo_reposicion_dias?: number
  estado: 'activo' | 'inactivo'
  creado_en: string
  actualizado_en: string
}

export interface ProductoProveedor {
  id: string
  proveedor_id: string
  codigo_oem: string
  codigo_aftermarket?: string
  nombre: string
  descripcion?: string
  precio_usd: number
  minimo_pedido: number
  producto_id?: string   // vínculo con inventario
  activo: boolean
}

export interface EvaluacionProveedor {
  id: string
  proveedor_id: string
  importacion_id?: string
  importacion_numero?: string
  fecha: string
  calidad: number        // 1–5
  precio: number         // 1–5
  entrega: number        // 1–5
  comunicacion: number   // 1–5
  notas?: string
}

// ─── Importaciones ────────────────────────────────────────────────────────────

export interface OrigenConfig {
  id: string
  nombre: string
  tiempo_estimado_dias: number
}

export type EstadoImportacion = 'en_transito' | 'en_aduana' | 'recibida' | 'cancelada'

export interface ItemImportacion {
  id: string
  codigo_proveedor: string          // Código Universal
  codigos_adicionales: string[]     // [0] = Alt 1, [1] = Alt 2
  nombre: string
  marcaId?: number | null
  marca?: string
  descripcion?: string
  procedencia?: string
  categoria?: string                // texto libre; viene del Excel o se edita en el preview
  unidad?: UnidadProducto           // pieza, juego, par…
  ubicacion?: string                // Almacén Central
  precio_fob_usd: number
  cantidad: number                  // stock entrada
  piezas?: number                  // piezas por unidad (opcional, undefined = no enviar al backend)
  // costo por unidad
  costo_unitario_fob_bs: number
  costo_unitario_adicional_bs: number
  costo_unitario_total_bs: number   // precio costo
  precio_venta_sugerido: number
  precio_venta_final: number        // precio venta
  // vínculo inventario
  producto_id?: string
  es_nuevo: boolean
  usar_precio_nuevo?: boolean
}

export interface ImportacionSummary {
  id: string
  numero: string
  origen: string
  proveedor: string
  fecha_creacion: string
  fecha_estimada_llegada: string
  estado: EstadoImportacion
  fob_total_usd: number
  flete_usd: number
  aduana_bs: number
  transporte_interno_bs: number
  tipo_cambio: number
  tipo?: 'Local' | 'Internacional'
  /**
   * Cantidad de productos/detalles registrados en la importación.
   * Viene del backend en queries que la incluyen (ej. `cantProductos`).
   * Opcional: las queries que solo traen `items` pueden omitirla.
   */
  cantProductos?: number
  creado_en: string
  actualizado_en: string
}

export interface Importacion extends ImportacionSummary {
  items: ItemImportacion[]
}

// ─── API helpers ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface Filters {
  search?: string
  categoria?: string
  estado?: EstadoProducto | ''
  page?: number
  pageSize?: number
}

// ─── Caja ──────────────────────────────────────────────────────────────────────

export type CategoriaMovimientoCaja =
  | 'Ventas'
  | 'CobranzaCredito'
  | 'OtroIngreso'
  | 'Compra'
  | 'GastoOperativo'
  | 'OtroEgreso'
  | 'Transferencia'

export interface MovimientoCaja {
  id: number
  id_Caja: number
  tipo: 'Ingreso' | 'Egreso'
  tipoPago: 'Efectivo' | 'QR' | 'Tarjeta'
  categoria: CategoriaMovimientoCaja
  monto: number
  motivo: string
  fecha: string
}

export interface Caja {
  id: number
  usuarioId: string
  montoInicial: number
  fechaInicio: string
  fechaCierre: string | null
  estado: 'Abierta' | 'Cerrada'
  montoContado: number | null
  justificacion: string | null
  movimientos: MovimientoCaja[]
}

export interface CierreCajaResponse {
  estado: string
  fechaInicio: string
  fechaCierre: string
  montoInicial: number
  totalIngresos: number
  ingresoEfectivo: number
  ingresoQR: number
  ingresoTarjeta: number
  totalEgresos: number
  efectivoEsperado: number
  montoContado: number
  justificacion: string | null
  // Desglose ventas contado vs cobros de crédito (Devuelto por DtoCajaResumen)
  ingresoVentasTotal?: number
  ingresoCobranzasTotal?: number
  ingresoCobranzaEfectivo?: number
  ingresoCobranzaQR?: number
  ingresoCobranzaTarjeta?: number
}

export interface Caja {
  id: number
  usuarioId: string
  montoInicial: number
  fechaInicio: string
  fechaCierre: string | null
  estado: 'Abierta' | 'Cerrada'
  montoContado: number | null
  justificacion: string | null
  movimientos: MovimientoCaja[]
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export interface Cliente {
  id: number
  nombre?: string
  apellido: string
  telefono?: string
  ci?: string
  ciComplemento?: string
  nit?: string
  correoElectronico?: string
  direccion?: string
  activo?: boolean
  compras?: unknown[]
  creado_en?: string
  actualizado_en?: string
}

export interface ClienteAPI {
  id: number
  nombre?: string
  apellido: string
  telefono?: string
  nit?: string
  correoElectronico?: string
  direccion?: string
}

// ─── Ventas ───────────────────────────────────────────────────────────────────

export type EstadoOrden =
  | 'pendiente_almacenero'
  | 'en_preparacion'
  | 'listo_para_escaneo'
  | 'con_faltantes'
  | 'esperando_pago'
  | 'completada'
  | 'cancelada'
export type TipoOrden = 'venta' | 'reserva'
export type EstadoItemOrden = 'pendiente' | 'completo' | 'parcial' | 'faltante' | 'listo_almacenero'
export type MetodoPago = 'efectivo' | 'tarjeta' | 'qr'

export interface PagoOrden {
  tipoPago: MetodoPago
  monto: number
}

export interface PiezaOrden {
  id: number
  id_pieza: number
  item_id?: string
  nombre: string
  /** Código técnico de la pieza (formato "P{N}-{Prefijo}-{CodigoKit}"). */
  codigo_pieza?: string
  marcaId?: number | null
  cantidad: number
  precio_unitario?: number
  confirmado?: boolean
  listo_almacenero?: boolean
  nota_incompleto?: string | null
  cantidad_recogida?: number
}

export interface ItemOrden {
  id: string
  producto_id: string
  producto_codigo: string
  producto_nombre?: string | null
  producto_categoria?: string
  producto_procedencia?: string
  producto_descripcion?: string
  producto_almacen: string
  producto_estante: string
  producto_fila: string
  producto_columna: string
  marcaId?: number | null
  marca_nombre?: string
  cantidad_pedida: number
  cantidad_recogida?: number
  precio_unitario: number
  precio_escaneo?: number
  subtotal: number
  estado: EstadoItemOrden
  nota?: string
  diferencia_kit?: number
  kit_id?: string
  es_kit?: boolean
  es_parcial?: boolean
  piezas_orden?: PiezaOrden[]
  /** Precio base sin descuento. Por ahora siempre igual a `precio_unitario` (no hay descuento por línea). */
  precio_base?: number
}

export interface AgregarItemOrdenResponse {
  id: number
  idProducto?: number | null
  id_Produto?: number | null
  cantidad: number
  esParcial?: boolean
  precioUnitario: number
  estado: string
  piezas?: { id: number; idPieza: number; cantidad: number }[] | null
  producto: { id: number; codigo: string; nombre: string; ubicacion: string; esKit?: boolean }
}

export interface ProductoBusquedaEscaneo {
  id: number
  codigo: string
  nombre: string
  precio: number
  stock_Actual: number
  stockReservado: number
  esKit: boolean
  ubicacion: string
  marcaId: number | null
  piezaEscaneadaId: number | null
  piezas: PiezaBusquedaEscaneo[] | null
}

export interface PiezaBusquedaEscaneo {
  id: number
  codigoUniversal: string
  codigoPieza: string
  nombre: string
  stockActual: number
  stockReservado: number
  cantidadPorKit: number
  orden: number
}

export type TipoDocumento = 'nota_venta' | 'factura'

export interface OrdenVenta {
  id: string
  numero: string
  tipo: TipoOrden
  tipoDocumento?: TipoDocumento   // nota_venta o factura
  facturaNro?: string            // número de factura simulada (ej: 001-001-0001234)
  cliente_id?: string
  cliente_nombre?: string
  cliente_tipo_id?: 'ci' | 'nit' | 'sin_nit'  // tipo de identificación para facturación
  cliente_numero_id?: string      // CI con/sin complemento, o NIT, o 99001
  cliente_nit?: string           // NIT específico para la factura (puede diferir del cliente guardado)
  cajero_id: string
  cajero_nombre: string
  almacenero_id?: string
  almacenero_nombre?: string
  items: ItemOrden[]
  total: number
  estado: EstadoOrden
  metodo_pago?: MetodoPago
  monto_recibido?: number
  nota?: string
  /** Descuento global aplicado a toda la orden (elegido al cobrar). */
  descuento?: DescuentoConfig
  /** Monto en Bs del descuento global. 0 si no hay descuento. */
  monto_descuento?: number
  creado_en: string
  actualizado_en: string
  aceptado_en?: string
  listo_en?: string
  pagado_en?: string
  caduca_en?: string
  /** Modalidad de la venta: flujo normal o atajo rápido (contado/crédito). */
  modalidad?: 'normal' | 'rapida_contado' | 'rapida_credito'
}

// ─── Marcas ───────────────────────────────────────────────────────────────────

export interface Marca {
  id: number
  nombre: string
  creado_en: string
}

// ─── Config ────────────────────────────────────────────────────────────────────

export interface DescuentoConfig {
  id: string
  nombre: string
  porcentaje: number
  color: string
  activo: boolean
}

export interface MargenGanancia {
  id: number
  valor: number
  fecha: string
}

export interface ConfigVenta {
  id: number
  modoVenta: 'PrecioImportacion' | 'PrecioDolarDia' | 'Ambos'
}

export interface TipoCambio {
  id: number
  precioDolar: number
  fecha: string
}

// ─── Créditos ─────────────────────────────────────────────────────────────────

export type EstadoCredito = 'Pendiente' | 'Parcial' | 'Pagado' | 'Cancelado'

export interface CreditoItem {
  id: number
  id_producto: number | null
  producto_codigo?: string | null
  producto_nombre?: string | null
  producto_marcaId?: number | null
  producto_marcaNombre?: string | null
  /** Presente si el item es una pieza suelta de un kit. */
  id_pieza?: number | null
  pieza_nombre?: string | null
  pieza_codigo?: string | null
  cantidad: number
  precioUnitario: number
  subtotal: number
}

export interface CreditoPago {
  id: number
  id_caja: number
  id_usuario: string
  usuario_nombre?: string | null
  fecha: string
  monto: number
  tipoPago: 'Efectivo' | 'QR' | 'Tarjeta'
  nota?: string | null
}

export interface Credito {
  id: number
  id_cliente: number
  cliente_nombre?: string | null
  cliente_apellido?: string | null
  cliente_telefono?: string | null
  id_ordenVenta: number | null
  id_cajero: string
  cajero_nombre?: string | null
  id_cajaOrigen: number
  estado: EstadoCredito
  total: number
  saldoPendiente: number
  fechaCreacion: string
  fechaPagoCompleto: string | null
  fechaCancelacion: string | null
  nota: string | null
  items: CreditoItem[]
  pagos: CreditoPago[]
}

// Forma que devuelve el backend REST (en snake_case según DtoCreditoResponse)
// Definida en src/lib/queries/creditos.queries.ts (patrón del proyecto).
