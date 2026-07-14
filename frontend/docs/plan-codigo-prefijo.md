# Plan: Mostrar código de producto como `PREFIJO-CODIGO` en Historial de Ventas y Reporte Top 10

## Contexto

En el frontend, los listados de productos vendidos deben mostrar el código en la notación **`PREFIJO-CODIGO`** (por ejemplo `TOY-12345`) y no solo el código universal. Esto ya es la convención del proyecto, materializada en:

- `src/lib/formatCodigo.ts` — helper `fmtCodigo(codigo, marcaId, marcas)`.
- `src/stores/marcasStore.ts` — store Zustand con `marcas: Marca[]` (cada `Marca` tiene `prefijo`).
- Consumidores existentes: `CheckoutModal`, `CajaPage`, `AlmacenPage`, `EscaneoPage`, `VentaRapidaContadoModal`, `VentaRapidaCreditoModal`, `CreditoDetailModal`, `SelectPriceModal`, `KitVentaParcialModal` — todos usan `fmtCodigo(item.producto_codigo, item.marcaId, marcas)`.

Sin embargo, dos lugares del flujo de **ventas completadas** todavía muestran el código plano:

1. **`src/pages/ventas/VentasHistorialPage.tsx`** — sub-tabla "Productos" dentro del `OrdenDrawer` (línea 130: `{item.producto_codigo}`).
2. **`src/pages/reportes/VentasReportePage.tsx`** — Top 10 productos últimos 7 días (línea 165: `<p>{p.codigo}</p>`).

El usuario confirmó que se arreglen **ambos** para mantener consistencia visual.

## Resultado esperado

- `Historial de Ventas > Detalle` → columna "Código" muestra `PREFIJO-CODIGO`.
- `Reportes > Ventas > Top 10 productos (7d)` → debajo del nombre del producto aparece `PREFIJO-CODIGO`.
- Si el producto no tiene `marcaId` o la marca no tiene `prefijo` cargado → cae al fallback `codigo` (comportamiento actual del helper, sin cambios).

## Archivos a modificar

| Archivo | Razón |
|---|---|
| `src/pages/ventas/VentasHistorialPage.tsx` | Render del código en `OrdenDrawer` (línea 130) + carga de marcas |
| `src/pages/reportes/VentasReportePage.tsx` | Render del código en Top 10 (línea 165) + carga de marcas + integración de `marcaId` en el Map |
| `src/lib/queries/ventas.queries.ts` | Agregar `marca: { id }` a la selección de `producto` en `DASHBOARD_ORDENES_QUERY`; extender `DashboardOrdenItemAPI` y `backendOrdenToDashboard` para exponer `productoMarcaId` en cada item |

## Archivos a reutilizar (NO modificar)

- `src/lib/formatCodigo.ts` → `fmtCodigo(codigo, marcaId, marcas)` (ya hace todo el trabajo).
- `src/stores/marcasStore.ts` → `useMarcasStore` (selector de `marcas` y `setMarcas`).
- `src/lib/queries/marcas.queries.ts` → `MARCAS_QUERY` y `backendToMarca` (el patrón de carga ya está).

## Patrón de carga de marcas (copiado de `AlmacenPage.tsx:1354-1359` y `CajaPage.tsx:1002-1007`)

Ambas páginas deben incluir un `useEffect` que cargue marcas solo si el store está vacío:

```ts
useEffect(() => {
  if (!isTokenReady || marcas.length > 0) return
  gql<{ marca: { nodes: Array<{ id: number; nombre: string; prefijo: string }> } }>(MARCAS_QUERY)
    .then(res => setMarcas((res.marca?.nodes ?? []).map(backendToMarca)))
    .catch(() => {})
}, [isTokenReady, marcas.length, setMarcas])
```

## Detalle de los cambios

### 1. `VentasHistorialPage.tsx`

**Imports nuevos** (después de los imports existentes de `@/lib/queries/ventas.queries`):

```ts
import { useMarcasStore } from '@/stores/marcasStore'
import { MARCAS_QUERY, backendToMarca } from '@/lib/queries/marcas.queries'
import { fmtCodigo } from '@/lib/formatCodigo'
```

**En `VentasHistorialPage` (componente principal):**

- Después de `useAuth` y antes del `useState`, agregar:
  ```ts
  const marcas    = useMarcasStore(s => s.marcas)
  const setMarcas = useMarcasStore(s => s.setMarcas)
  ```
- Insertar el `useEffect` de carga de marcas **antes** del `useEffect` existente que carga órdenes (orden 3 de la arquitectura: fetch tras `isTokenReady`).

**En `OrdenDrawer` (sub-componente, líneas 61-165):**

- Después de las props `{ orden, onClose }`, agregar:
  ```ts
  const marcas = useMarcasStore(s => s.marcas)
  ```
- Cambiar la línea 130:
  ```tsx
  // antes
  {item.producto_codigo}
  // después
  {fmtCodigo(item.producto_codigo, item.marcaId, marcas)}
  ```

**No tocar** la query ni el mapeador: `ItemOrden` ya expone `marcaId: number | null` y `producto_codigo: string` (líneas 398 y 392 de `src/types/index.ts`).

### 2. `ventas.queries.ts`

**Cambio en `DASHBOARD_ORDENES_QUERY` (línea 604-623):**

```graphql
# antes
producto { id codigo nombre }
# después
producto { id codigo nombre marca { id } }
```

**Cambio en `DashboardOrdenItemAPI` (línea 575-580):**

```ts
// antes
producto: { id: number; codigo: string; nombre: string } | null
// después
producto: { id: number; codigo: string; nombre: string; marca: { id: number } | null } | null
```

**Cambio en `DashboardOrden` (línea 592-602):** agregar campo al item:

```ts
items: {
  productoId: string
  productoNombre: string
  productoCodigo: string
  productoMarcaId?: number | null
  cantidad: number
  precioUnitario: number
}[]
```

**Cambio en `backendOrdenToDashboard` (líneas 625-646):** agregar al mapeo de items:

```ts
items: (api.items ?? []).map(i => ({
  productoId:       String(i.id_Producto),
  productoNombre:   i.producto?.nombre  ?? '',
  productoCodigo:   i.producto?.codigo  ?? '',
  productoMarcaId:  i.producto?.marca?.id ?? null,
  cantidad:         i.cantidad,
  precioUnitario:   i.precioUnitario,
}))
```

### 3. `VentasReportePage.tsx`

**Imports nuevos:**

```ts
import { useMarcasStore } from '@/stores/marcasStore'
import { MARCAS_QUERY, backendToMarca } from '@/lib/queries/marcas.queries'
import { fmtCodigo } from '@/lib/formatCodigo'
```

**En el componente `VentasReportePage` (línea 30):**

- Agregar stores (después de `useAuth`, en orden 1-2):
  ```ts
  const marcas    = useMarcasStore(s => s.marcas)
  const setMarcas = useMarcasStore(s => s.setMarcas)
  ```
- Agregar `useEffect` de carga de marcas (orden 3, antes del `useEffect` de órdenes).

**En el `useMemo` (línea 42-104):** extender el Map con `marcaId`:

```ts
const porProducto = new Map<string, {
  nombre: string
  codigo: string
  marcaId: number | null
  unidades: number
  ingreso: number
}>()
```

Y al poblarlo (línea 90-96):

```ts
porProducto.set(item.productoId, {
  nombre:   item.productoNombre,
  codigo:   item.productoCodigo,
  marcaId:  item.productoMarcaId ?? null,
  unidades: item.cantidad,
  ingreso:  ingresoItem,
})
```

**En el render (línea 165):** cambiar

```tsx
<p className="text-[10px] text-steel-400 mt-0.5 tabular-nums">{p.codigo}</p>
```

por

```tsx
<p className="text-[10px] text-steel-400 mt-0.5 tabular-nums">{fmtCodigo(p.codigo, p.marcaId, marcas)}</p>
```

## Verificación end-to-end

1. **Compilación / tipos:**
   - Levantar el frontend con `npm run dev` (Vite).
   - Confirmar que TypeScript no reporta errores en los 3 archivos modificados.

2. **Historial de Ventas (rol admin y cajero):**
   - Ir a `Ventas > Historial de Ventas`.
   - Abrir el detalle (icono de ojo) de cualquier venta completada.
   - Verificar que la columna "Código" muestra `PREFIJO-CODIGO` (ej. `TOY-12345`).
   - Verificar que sigue apareciendo la marca como pill (esa lógica no cambia).
   - Si hay un producto sin marca → debe seguir mostrando solo el código (fallback).

3. **Reporte Top 10 (rol admin):**
   - Ir a `Reportes > Ventas`.
   - Verificar que la tarjeta "Top 10 productos — últimos 7 días" muestra `PREFIJO-CODIGO` debajo de cada nombre.
   - Si no hay ventas en los últimos 7 días → la sección muestra el empty state y no rompe.

4. **Caso borde (store de marcas vacío):**
   - Hacer `localStorage.clear()` (o logout + login) y navegar directo a `Reportes > Ventas` sin pasar por caja/almacén/inventario.
   - El `useEffect` debe poblar el store; el render debe mostrar `PREFIJO-CODIGO` (no solo código).

5. **Regresión:** verificar que el resto de la página (KPI cards, sparkline, tabla principal) sigue funcionando igual.

## Notas

- No se toca el backend.
- El helper `fmtCodigo` ya tiene todos los fallbacks necesarios; no requiere cambios.
- El tipo `ItemOrden` y `Producto` no se modifican; toda la información necesaria ya está disponible en las queries y los mapeadores.
- Patrón replicado de `AlmacenPage.tsx` y `CajaPage.tsx` para mantener consistencia con el resto del proyecto.
