# Importadora — ERP Autopartes

ERP para importadora de autopartes. Maneja inventario (productos normales y kits), importaciones masivas por Excel, flujo de ventas con roles (cajero/almacenero/operador), caja diaria, créditos, reportes y facturación.

## Stack

**Backend** — `.NET 9`, Clean Architecture (Api / Application / Domain / Infrastructure), EF Core + PostgreSQL (Npgsql), JWT auth, GraphQL (HotChocolate), SignalR (`/hubs/ventas`), almacenamiento de imágenes en Cloudflare R2.

**Frontend** — React 18 + TypeScript + Vite, Tailwind, Zustand (stores), React Router, `@microsoft/signalr`, react-select, react-table, xlsx (importación Excel), jsPDF/html2canvas (reportes/etiquetas), qz-tray (impresión de etiquetas de código de barras).

## Estructura del repo

```
.
├── backend/    # UsaAutoPartes.Api (.sln con 4 proyectos), Dockerfile
└── frontend/   # SPA Vite/React
```

Ver `backend/arquitectura.md` para el detalle de capas del backend y `backend/contexto.md` para las reglas de negocio de stock de kits (fuente de verdad, cálculo de ensamblable vs físico, etc.) — **léelo antes de tocar lógica de stock**.

## Qué hace el sistema

- **Inventario**: productos normales y productos "kit" (compuestos por piezas con cantidad requerida). Las piezas se pueden vender sueltas. Stock ensamblable se calcula como `min(PiezaKit.StockActual / CantidadPorKit)`; stock físico es la suma de piezas en bodega.
- **Importaciones**: carga masiva de productos vía Excel (suma stock a existentes, crea los nuevos), extracción de datos desde factura, gestión de proveedores.
- **Ventas** (flujo con 3 roles):
  1. **Cajero** arma la orden de venta (puede ser parcial en un kit) y la envía al almacenero.
  2. **Almacenero** acepta la orden, prepara los productos/piezas pedidos, puede marcar como incompleto con nota, y marca la orden como lista.
  3. **Cajero** recibe los productos, corrobora con el cliente y concreta la venta (rol **operador** para el punto de escaneo/entrega).
- **Caja diaria**: apertura/cierre de caja, registro de movimientos.
- **Créditos**: gestión de ventas a crédito y clientes.
- **Reportes**: ventas, comisiones, órdenes, inventario.
- **Configuración**: usuarios, roles, marcas, descuentos, tipo de cambio, márgenes de ganancia, config de venta.

## Roles y home por rol

| Rol | Ruta inicial |
|---|---|
| admin | `/inventario` |
| cajero | `/ventas/punto-de-venta` |
| almacenero | `/ventas/almacen` |
| operador | `/ventas/escaneo` |

## Cómo levantar el proyecto

### Requisitos
- .NET 9 SDK
- PostgreSQL
- Node 18+ y `pnpm`

### Backend

```bash
cd backend/UsaAutoPartes.Api
dotnet restore
```

Configurar `UsaAutoPartes.Api/appsettings.Development.json` (o variables de entorno) con:
- `ConexionDataBase:CadenaConexion` — cadena de conexión a PostgreSQL
- `JwtOptions:SecretKey` — secreto JWT
- `IA:ClaudeApiKey` — si se usa extracción de factura con IA
- `CloudflareR2:*` — credenciales de R2 para imágenes de productos
- `Cors:Origins` — orígenes permitidos (ya trae los de dev/local)

Aplicar migraciones y correr:

```bash
dotnet ef database update --project UsaAutoPartes.Infrastructure --startup-project UsaAutoPartes.Api
dotnet run --project UsaAutoPartes.Api
```

La API expone: REST controllers, GraphQL en `/graphql`, SignalR hub en `/hubs/ventas`.

**Con Docker:**

```bash
cd backend
docker build -t importadora-api .
docker run -p 8080:8080 -e PORT=8080 importadora-api
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Variables de entorno ya definidas en `.env.development` (apunta a backend local en `http://localhost:5120`) y `.env.production` (apunta al backend en Render). Ajustar `VITE_BACKEND_PROXY` si el backend corre en otro puerto.

Build de producción:

```bash
pnpm build
pnpm preview
```

Deploy configurado para Vercel (`vercel.json`) con rewrites de `/api`, `/graphql` y `/hubs` hacia el backend.

## Notas importantes

- **Regla de stock de kits**: nunca escribir `Producto.Stock_Actual` directo para kits — siempre se deriva de `PiezaKit.StockActual`. Ver `backend/contexto.md`.
- No usar deserialización insegura (indicado explícitamente en la documentación de arquitectura del backend).
