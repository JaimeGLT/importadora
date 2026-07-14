# Imágenes de Productos — Cloudflare R2

## Concepto

Cada producto puede tener una **galería de hasta 20 imágenes** con una marcada como **principal** (la que aparece como portada en la lista de inventario y en los recibos). Las imágenes se almacenan en **Cloudflare R2** (S3-compatible) y se sirven por URL pública.

**Flujo "presigned + confirmar + GC":**
1. El browser pide al backend una URL firmada (PUT, 15 min de TTL).
2. El browser sube el archivo directo a R2 con `XMLHttpRequest` (para tracking de progress).
3. El browser confirma al backend; éste hace `HEAD` en R2 para verificar y persiste la fila en DB.
4. Un `BackgroundService` corre cada 6h comparando objetos en R2 vs keys activas en DB; los huérfanos de más de 1h se borran automáticamente.

**Restricciones (configurables en `appsettings.json`):**
- Tamaño máximo por imagen: **10 MB**.
- Cantidad máxima por producto: **20 imágenes**.
- Content-Type: cualquier `image/*`.

---

## Estructura de Datos

### En DB (PostgreSQL)

Tabla `producto_imagen` (1-N con `Producto`):

| Campo | Tipo | Notas |
|---|---|---|
| `Id` | `int` | PK |
| `Id_Producto` | `int` | FK a `Producto.Id` (`OnDelete Cascade`) |
| `LlaveObjeto` | `string(500)` | Key en R2: `productos/{productoId}/{guid}.{ext}`. **UNIQUE global.** |
| `UrlPublica` | `string(500)` | URL pública completa (`{PublicBaseUrl}/{LlaveObjeto}`) |
| `NombreArchivo` | `string(255)` | Nombre original del cliente |
| `TipoContenido` | `string(50)` | MIME (`image/...`) |
| `TamanoBytes` | `long` | Tamaño del archivo |
| `AnchoPx` | `int?` | Dimensiones, enviadas por el front al confirmar |
| `AltoPx` | `int?` | Idem |
| `Orden` | `int` | Posición 1, 2, 3... |
| `EsPrincipal` | `bool` | **Garantizado único por producto** vía índice parcial |
| `Estado` | `string(20)` | `Pendiente` / `Activa` / `Eliminada` (soft delete) |
| `FechaSubida` | `timestamptz` | `default NOW()` |
| `FechaEliminacion` | `timestamptz?` | Soft delete timestamp |

**Índices únicos parciales** (PostgreSQL):
- `IX_ProductoImagen_LlaveObjeto` — UNIQUE global sobre `LlaveObjeto` (evita colisiones de key).
- `IX_ProductoImagen_Producto_Orden` — UNIQUE sobre `(Id_Producto, Orden)` filtrado `Estado <> 'Eliminada'`. Garantiza que no haya dos imágenes activas con el mismo orden.
- `IX_ProductoImagen_Producto_Principal` — UNIQUE sobre `Id_Producto` filtrado `EsPrincipal = true AND Estado <> 'Eliminada'`. **Garantiza exactamente 1 principal activa por producto.**

### En Frontend (`types/index.ts`)

```ts
interface ProductoImagen {
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

interface Producto {
  // ...campos existentes...
  imagen?: string             // URL de la principal (compatibilidad con <ProductThumb>)
  imagenes?: ProductoImagen[] // galería completa (solo en detalle / edición)
}
```

`Producto.imagen` se popula desde `imagenPrincipal.url` cuando el backend lo proyecta. Los call-sites existentes (`<ProductThumb src={p.imagen} />` en `InventarioPage`, `SelectPriceModal`, `CajaPage`) siguen funcionando sin cambios.

---

## API REST

`ProductoImagenController` con 7 endpoints, todos bajo `/api/ProductoImagen`:

| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| `POST` | `/presign` | Admin, Cajero | `DtoPresignRequest` | `DtoPresignResponse` (200) |
| `POST` | `/confirmar` | Admin, Cajero | `DtoConfirmarImagenRequest` | `DtoProductoImagenResponse` (201) |
| `GET` | `/producto/{productoId}` | Admin, Cajero, Operador | — | `DtoProductoImagenResponse[]` (orden ASC) |
| `PUT` | `/{id}/principal` | Admin, Cajero | `DtoSetPrincipalRequest` | `DtoProductoImagenResponse[]` (galería actualizada) |
| `PUT` | `/reordenar` | Admin, Cajero | `DtoReordenarRequest` | `DtoProductoImagenResponse[]` |
| `PUT` | `/{id}/reemplazar` | Admin, Cajero | `DtoConfirmarImagenRequest` | `DtoProductoImagenResponse` |
| `DELETE` | `/{id}` | Admin, Cajero | — | 204 (soft delete; promueve la siguiente si era principal) |

**Errores vía `GlobalHandler`:**
- `400` — `ImagenTamanoExcedidoException` (>10MB), `ImagenTipoInvalidoException` (no es `image/*`), `ImagenLimiteExcedidoException` (>20 activas).
- `404` — Producto o imagen no encontrada.
- `409` — Conflicto de principal (carrera entre dos requests; el índice único parcial protege la integridad).

---

## API GraphQL

`ProductoType` expone dos nuevos campos server-side:

```graphql
type Producto {
  id: Int!
  # ...campos existentes...
  imagenes: [ProductoImagen!]!       # galería completa, ordenada por Orden ASC
  imagenPrincipal: ProductoImagen     # null si no tiene principal activa
}

type ProductoImagen {
  id: Int!
  productoId: Int!
  url: String!
  key: String!
  nombreArchivo: String!
  contentType: String!
  tamanoBytes: Int!
  anchoPx: Int
  altoPx: Int
  orden: Int!
  esPrincipal: Boolean!
  estado: String!                    # 'Pendiente' | 'Activa' | 'Eliminada'
  fechaSubida: DateTime!
}
```

Queries del frontend que se modificaron:
- `PRODUCTOS_QUERY` y `PRODUCTOS_CON_MARCAS_QUERY` piden `imagenPrincipal { id url }` (para el thumb en la lista).
- `PRODUCTO_BY_ID_QUERY` pide también `imagenes { ... todos los campos ... }` (para la galería en detalle/edición).

---

## Storage Wrapper (`src/lib/storage.ts`)

Punto único de contacto frontend ↔ R2. Funciones exportadas:

```ts
// 1. Pedir URL presignada al backend
presignParaProducto(productoId, archivo): Promise<{ key, url, expiraEn }>

// 2. PUT directo a R2 con XHR (progress tracking)
subirArchivoAR2(url, archivo, contentType, onProgress?): Promise<void>

// 3. Confirmar al backend para que persista la fila
confirmarImagen(params: DtoConfirmarImagenRequest): Promise<ProductoImagenAPI>

// Helper: leer dimensiones width/height de un File
leerDimensiones(archivo): Promise<{ anchoPx, altoPx } | null>

// Orquesta 1+2+3 para un archivo
subirImagenAProducto({ productoId, archivo, onProgreso? }): Promise<{ imagen }>

// Lote diferido para CREACIÓN de producto (secuencial, reporta éxitos y fallas)
subirLoteDiferido(productoId, archivos, onProgresoArchivo?): Promise<{
  exitosas: ProductoImagenAPI[]
  fallidas: { archivo, error }[]
}>

// Acciones sobre galería existente
marcarImagenPrincipal(productoId, imagenId): Promise<ProductoImagenAPI[]>
reordenarImagenes(productoId, imagenesIds): Promise<ProductoImagenAPI[]>
eliminarImagen(imagenId): Promise<void>
reemplazarImagen({ imagenId, productoId, archivo, onProgreso? }): Promise<ProductoImagenAPI>
```

**Por qué XHR y no `fetch`:** `fetch` no expone progress de upload en el browser. `XMLHttpRequest.upload.onprogress` es la única API estándar que lo permite. El PUT a R2 no envía credenciales (`withCredentials = false`) porque R2 valida la firma de la URL.

**Por qué un wrapper aparte de `api.ts`:** `api.post()` fuerza `Content-Type: application/json` y agrega headers de auth, ambas incompatibles con la URL presignada de R2 (que requiere `Content-Type` exacto al firmado y no acepta credenciales). Patrón copiado de `FacturaExtractorPage.tsx` (upload binario a `/api/factura/extraer`).

---

## ImageUploader (`src/components/ui/ImageUploader.tsx`)

Componente reutilizable integrado en `ProductoModal`. Dos modos:

- **`productoId` definido** (modo edición): cada drop sube en tiempo real. Las acciones (eliminar, marcar principal, reordenar, reemplazar) pegan al backend optimistamente y rollbackean en error.
- **`productoId` undefined** (modo nuevo): las imágenes se acumulan en una cola de "pendientes" con preview local (`URL.createObjectURL`). El padre las sube con `subirLoteDiferido(id, pendientes)` después de crear el producto.

**Features:**
- Dropzone HTML5 nativo (sin `react-dropzone`) con preview y validación client-side (`image/*`, 10 MB).
- Grid responsive (3-5 columnas) con tiles que muestran la imagen, badge "Principal" en oro, y botones hover (estrella/editar/borrar).
- Drag & drop HTML5 nativo para reordenar (optimista + rollback).
- Reemplazar abre file picker dedicado (`replaceInputRef`).
- Eliminar usa `ConfirmModal` con mensaje contextual: *"Al ser la principal, se promoverá la siguiente automáticamente."*
- Tope de 20 imágenes enforced client-side (refleja `MaxImagenesPorProducto` del backend).
- Tiles "Pendiente" con borde dorado punteado y badge reloj en modo nuevo producto.

---

## Configuración de R2 (setup manual)

### 1. Crear bucket

Cloudflare → R2 → **Create bucket**:
- Nombre: `usaimportadora-productos` (o el que prefieras).
- Location: Automatic.
- **Settings → Public access** → **Allow Access**. Te da `pub-xxxx.r2.dev` (suficiente para dev) o **Connect domain** para custom domain (`cdn.usaimportadora.com` con CNAME pre-creado).

### 2. Crear API token

R2 → **Manage R2 API Tokens** → **Create API token**:
- Token name: `usaimportadora-backend`.
- Permissions: **Object Read & Write**.
- Bucket scope: el bucket del paso 1.

Guardá los 3 valores: `AccountId`, `AccessKeyId`, `SecretAccessKey`.

### 3. Configurar CORS en el bucket

R2 → bucket → **Settings → CORS Policy**:

```json
[{
  "AllowedOrigins": [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://dev.usaimportadora.snakil.com",
    "https://app.usaimportadora.com"
  ],
  "AllowedMethods": ["PUT", "GET", "HEAD", "DELETE"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```

Sin `ExposeHeaders: ["ETag"]` el browser no puede leer el ETag (innecesario para PUT simple, pero útil si en el futuro se quiere implementar uploads multipart).

### 4. Variables en `appsettings.json`

`backend/UsaAutoPartes.Api/UsaAutoPartes.Api/appsettings.json`:

```json
"CloudflareR2": {
  "AccountId": "<tu CF account id>",
  "AccessKeyId": "<R2 access key>",
  "SecretAccessKey": "<R2 secret key>",
  "Bucket": "usaimportadora-productos",
  "PublicBaseUrl": "https://pub-xxxx.r2.dev",
  "PresignTtlSeconds": 900,
  "MaxObjectBytes": 10485760,
  "MaxImagenesPorProducto": 20,
  "Prefijo": "productos/",
  "GcIntervalHours": 6
}
```

En `appsettings.Development.json` overridear `GcIntervalHours: 1` para que el GC corra cada hora en dev (útil para testear huérfanos).

### 5. Verificar

Reiniciar el backend y buscar en logs:
```
info: R2 configurado: bucket=usaimportadora-productos, baseUrl=https://pub-xxxx.r2.dev
```

---

## Migración DB

`20260616143105_AgregarProductoImagen` (aplicada). Crea tabla + 3 índices únicos. Si la tabla ya existe con datos, el `IF NOT EXISTS` evita duplicados.

```bash
cd backend/UsaAutoPartes.Api/UsaAutoPartes.Infrastructure
dotnet ef database update
```

Para verificar:
```bash
psql $CADENA_CONEXION -c "\d producto_imagen"
```

Debería listar las 3 columnas UNIQUE INDEX con sus filtros parciales.

---

## Garbage Collection de huérfanos

`R2OrphanGcService` (BackgroundService) corre cada `GcIntervalHours` (default 6h, 1h en dev):

1. Lista todos los objetos en R2 con prefijo `productos/`.
2. Trae todas las keys activas en DB (`SELECT LlaveObjeto FROM ProductoImagen WHERE Estado='Activa'`).
3. Calcula la diferencia: keys en R2 que NO están en DB.
4. Filtra por edad: solo borra objetos con más de 1 hora de antigüedad (para no borrar uploads en curso).
5. Borra los huérfanos con `DeleteObjectAsync`. Loguea cantidad borrada.

**Casos que cubre:**
- Usuario dropea archivos, cierra el modal sin guardar.
- Confirmar falla después del PUT (e.g. transient DB error).
- Producto eliminado pero R2 delete falló (best-effort en `ProductoController.Eliminar`).

---

## Compatibilidad con código existente

`Producto.imagen` se mantiene como campo opcional (URL string) y se popula desde `imagenPrincipal.url` en el mapper. Esto permite que call-sites legacy (`<ProductThumb src={p.imagen} />`) sigan funcionando sin cambios.

`Producto.imagenes` es opcional y solo viene en el detalle (`PRODUCTO_BY_ID_QUERY`). Las queries de lista (`PRODUCTOS_QUERY`, `PRODUCTOS_CON_MARCAS_QUERY`, `buscar-lista`) solo traen `imagenPrincipal` para no inflar el payload.

---

## Decisiones de diseño (rationale)

**¿Por qué R2 y no S3, GCS, etc.?** El plan original es R2 (storage barato, sin egress fees). El patrón presign funciona idéntico con cualquier S3-compatible.

**¿Por qué una tabla separada y no un `JSONB` en `Producto`?** Reordenar en JSONB requiere reescribir el array completo. Con tabla, solo `UPDATE ... SET Orden = ?` y el índice parcial garantiza 1 principal. Además, permite soft delete, GC, y queries SQL directas sin parsear JSON.

**¿Por qué soft delete y no hard delete?** Permite auditoría y restauración. Los huérfanos de R2 los recoge el GC; el espacio en DB es despreciable.

**¿Por qué presign y no backend proxy?** El backend no procesa los bytes: ahorra CPU, RAM y bandwidth. El browser sube directo a R2, que es 10x más rápido que pasar por el backend. La firma caduca a los 15min, suficiente para que el usuario confirme.

**¿Por qué confirmar en backend en vez de insertar directo desde el frontend?** Necesitamos que el backend haga `HEAD` en R2 para verificar que el PUT realmente sucedió (no fue spoofed). Y queremos IDs server-side (autoincrementales) y validación de límite server-side.

**¿Por qué `XMLHttpRequest` y no `fetch`?** `fetch` no expone progress de upload en el browser. XHR es la única API estándar que permite mostrar progress por archivo.

**¿Por qué no `react-dropzone` u otra lib?** El codebase ya tiene un patrón HTML5 nativo funcionando en `FacturaExtractorPage.tsx` y `NuevaImportacionModal.tsx`. Agregar una dependencia para usar 1% de su API es sobre-ingeniería.

---

## Testing manual (checklist)

### Setup con R2 de prueba

1. Crear bucket `usaimportadora-productos-test`, API token, CORS con `localhost:5173`.
2. Credenciales en `appsettings.Development.json` con `PublicBaseUrl: "https://pub-xxxx.r2.dev"`.
3. `dotnet run` del backend. Verificar log: `R2 configurado: bucket=usaimportadora-productos-test`.

### Casos

- [ ] **Crear producto con 1 imagen:** arrastrar al `ImageUploader` → progress 0→100% → imagen aparece como "Principal" → DB: 1 fila `EsPrincipal=true, Orden=1, Estado='Activa'`. Crear producto. Verificar thumb en la lista.
- [ ] **Editar producto, agregar 4 imgs más:** 5 imgs en galería, la primera sigue siendo principal. DB: 5 filas.
- [ ] **Reordenar (drag & drop):** mover img #5 a posición #1. UI optimistic + `PUT /reordenar` → orden persistido.
- [ ] **Marcar principal:** click estrella img #2. DB: img #2 `EsPrincipal=true`, img #1 `false`. Thumb de la lista cambia.
- [ ] **Eliminar imagen (no principal):** `ConfirmModal` → img desaparece. DB: `Estado='Eliminada', FechaEliminacion=UtcNow`. R2: objeto SIGUE (soft).
- [ ] **Eliminar imagen principal:** se promueve automáticamente la de menor `Orden`.
- [ ] **Soft delete de producto:** todas las `ProductoImagen` del producto quedan `Estado='Eliminada'`. R2: objetos siguen.
- [ ] **GC de huérfanos:** crear producto, subir 1 img, **cancelar** el modal → objeto en R2, no en DB. Cambiar `GcIntervalHours` a 1min en dev, esperar, verificar log `ObjectsOrphansFound=1` y objeto borrado.
- [ ] **CORS:** DevTools → Network → PUT a `pub-xxxx.r2.dev`. Response con `Access-Control-Allow-Origin: http://localhost:5173`. Si falla: verificar CORS en R2 dashboard.
- [ ] **Race condition de principal:** 2 tabs, marcar #2 y #3 principal rápido. Una gana 200, la otra 409. Ambas refrescadas: misma principal.
- [ ] **Validación de límites:** subir imagen de 11MB → `notify.error` "Imagen demasiado grande". Subir 21ª imagen → `notify.error` "Límite de 20 imágenes alcanzado".

### Comandos útiles

```bash
# Verificar migración
psql $CADENA_CONEXION -c "\d producto_imagen"

# Probar presign con curl
curl -X POST http://localhost:5000/api/ProductoImagen/presign \
  -H "Content-Type: application/json" \
  -b "access=..." \
  -d '{"productoId":1,"nombreArchivo":"test.jpg","contentType":"image/jpeg","tamanoBytes":1024000}'

# Probar PUT a R2 con la URL firmada
curl -X PUT "<url>" --data-binary @imagen.jpg -H "Content-Type: image/jpeg"

# Listar objetos en R2 desde la consola web
# Cloudflare → R2 → bucket → Objects

# Verificar GC en logs del backend
grep "R2 GC" logs/app.log
```
