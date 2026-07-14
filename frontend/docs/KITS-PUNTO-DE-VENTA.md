# Kits de Venta — Punto de Venta

## Concepto

Un **Kit** es un producto compuesto que agrupa varias piezas individuales. Se vende como unidad única pero puede-descontarse pieza por pieza del inventario.

Ejemplo: Kit Embrague = Placa + Disco + Collar + Rulemán (4 piezas)

## Estructura de Datos

### En Producto
```ts
{
  id: 'kit-1',
  nombre: 'Kit Embrague Completo',
  es_kit: true,           // <-- marca que es un kit
  kit_id: null,            // null porque es el kit padre
  cantidad_por_kit: null,  // null porque es el kit padre
  stock: 5,                // se calcula como min(stock_pieza[i] / cantidad_necesaria[i])
  precio_venta: 4200,
  ...
}
```

### Piezas del Kit
```ts
{
  id: 'kit-1-placa',
  nombre: 'Placa de Embrague',
  es_kit: false,
  kit_id: 'kit-1',         // <-- apunta al kit padre
  cantidad_por_kit: 1,     // <-- cuántas se necesitan por cada kit
  stock: 12,
  ...
}
```

### En Store (inventarioStore)
```ts
kitRelaciones: [
  { kit_id: 'kit-1', producto_id: 'kit-1-placa', cantidad: 1 },
  { kit_id: 'kit-1', producto_id: 'kit-1-disco', cantidad: 1 },
  { kit_id: 'kit-1', producto_id: 'kit-1-collar', cantidad: 1 },
  { kit_id: 'kit-1', producto_id: 'kit-1-ruleman', cantidad: 1 },
]
```

## Flujo en Caja

### 1. Agregar kit al carrito
```
CajaPage → addToCart(producto)
  └─ producto.es_kit === true
       └─ abre KitVentaParcialModal con el kit seleccionado
```

### 2. Modal de Venta Parcial (KitVentaParcialModal)
Muestra las piezas del kit con:
- Nombre y código de cada pieza
- Stock disponible
- Cantidad por kit (default 1)
- Input para cambiar cantidad
- Precio total del kit ( Bs)
- Campo para ingresar precio de venta real
- Diferencia en tiempo real (precio_kit - precio_ingresado)

### 3. Confirmar venta parcial
```
onConfirm(piezas_seleccionadas, precioTotal, diferencia)
  └─ Crea ItemOrden por cada pieza
  └─ diferencia_kit → guardada en ItemOrden para reportes
  └─ kit_id → guardada en ItemOrden para trazabilidad
```

## Tipos Involved

```ts
// types/index.ts
interface Producto {
  es_kit?: boolean
  kit_id?: string | null   // null para kit padre, id del kit para piezas
  cantidad_por_kit?: number // null para kit padre
}

interface ItemOrden {
  diferencia_kit?: number  // Bs de diferencia (positiva = cliente pagó menos)
  kit_id?: string         // para identificar qué kit pertenece
}

// stores/inventarioStore.ts
interface KitRelacion {
  kit_id: string
  producto_id: string
  cantidad: number
}
```

## Stock de Kit

El stock de un kit se calcula automáticamente como:

```
stock_kit = min( stock_pieza[i] / cantidad_por_kit[i] ) para toda i
```

Ejemplo:
- Placa: stock 12 / 1 = 12
- Disco: stock 10 / 1 = 10
- Collar: stock 8 / 1 = 8
- Rulemán: stock 15 / 1 = 15
- **Stock kit = 5** (mínimo de todos)

> **Nota:** `getKitStock()` en inventarioStore hace este cálculo en tiempo real.

## Venta Completa vs Parcial

### Venta completa (kit entero)
Se descuenta 1 de cada pieza × cantidad:
```
por cada pieza del kit:
  stock -= cantidad_kit × cantidad_por_kit
```

### Venta parcial
El cajero ingresa el **precio total** que pagó el cliente (que puede ser menor al precio del kit). La diferencia se registra para control financiero.

```
diferencia = precio_kit_oficial - precio_total_ingresado
```

## Datos de Prueba (Mock)

En `src/mock/inventario.ts`:
- **Kit:** `KIT-EMBRAGUE-01` — "Kit Embrague Completo"
- **Piezas:** `EMB-PLACA-001`, `EMB-DISCO-001`, `EMB-COLLAR-001`, `EMB-RULEMAN-001`

## Backend (pendiente)

El modelo de datos está documentado en `KIT_MODEL.md`. Cuando el backend implemente:
1. CRUD de kits y piezas
2. Relación kit_id en Producto
3. Campo `es_kit` en Producto
4. Tabla `kit_relaciones`
5. Endpoint `kitRelaciones`
6. Venta con diferenciación kit completo vs parcial
7. Reportes de diferencia_kit por producto/vendedor/fecha

## Flags de Desarrollo

Para probar sin backend:
- `setProductos` en inventarioStore inyecta mockKits automáticamente
- Las piezas del kit usan `kit_id` para identificar pertenencia
- `kitRelaciones` se alimenta de mock data cuando no hay backend
