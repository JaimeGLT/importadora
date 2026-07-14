/**
 * Wrapper de uploads a Cloudflare R2 vía presigned URLs.
 *
 * Flujo "presign + confirmar":
 *  1. `presignParaProducto` → backend devuelve URL firmada (PUT) y key.
 *  2. `subirArchivoAR2` → XHR directo a R2 con tracking de progress.
 *  3. `confirmarImagen` → backend hace HEAD en R2, inserta fila en DB.
 *
 * `api.post()` fuerza `Content-Type: application/json` (incompatible con
 * R2 que requiere el mismo `Content-Type` que se firmó). Por eso el PUT
 * a R2 va con `fetch`/`XMLHttpRequest` directo. El patrón está copiado
 * de `pages/importaciones/FacturaExtractorPage.tsx`.
 */

import { api } from './api'
import type { ProductoImagenAPI } from './queries/inventario.queries'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PresignResponse {
  key: string
  url: string
  expiraEn: string
}

interface ConfirmarRequest {
  productoId: number
  key: string
  nombreArchivo: string
  contentType: string
  tamanoBytes: number
  anchoPx?: number | null
  altoPx?: number | null
}

export interface ProgresoSubida {
  /** 0..1 */
  cargando: number
  /** Fase actual del upload (presign / upload / confirmar). */
  fase: 'presign' | 'upload' | 'confirmar'
}

// ─── 1. Presign ───────────────────────────────────────────────────────────────

/**
 * Pide al backend una URL presignada para subir un archivo a R2.
 * Valida tamaño/tipo/límite server-side antes de generar la URL.
 */
export async function presignParaProducto(
  productoId: number,
  archivo: File,
): Promise<PresignResponse> {
  return api.post<PresignResponse>('/ProductoImagen/presign', {
    productoId,
    nombreArchivo: archivo.name,
    contentType: archivo.type || 'application/octet-stream',
    tamanoBytes: archivo.size,
  })
}

// ─── 2. Upload directo a R2 (XHR con progress) ───────────────────────────────

/**
 * Sube el archivo a R2 usando la URL presignada. Devuelve una Promise con
 * `onProgress` opcional que recibe el porcentaje (0..1).
 *
 * Usamos XHR (no fetch) porque fetch no expone progress de upload en browser.
 */
export function subirArchivoAR2(
  url: string,
  archivo: File,
  contentType: string,
  onProgress?: (fraccion: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    xhr.setRequestHeader('Content-Type', contentType)
    // R2 valida la firma — NO enviar credenciales ni headers extra.
    xhr.withCredentials = false

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1)
        resolve()
      } else {
        // R2 responde con texto plano en errores; intentamos parsear.
        let msg = `Error ${xhr.status} subiendo a R2`
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string }
          if (body.message) msg = body.message
        } catch { /* mantener msg por defecto */ }
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('Error de red subiendo a R2'))
    xhr.onabort = () => reject(new Error('Subida cancelada'))

    xhr.send(archivo)
  })
}

// ─── 3. Confirmar ────────────────────────────────────────────────────────────

/**
 * Le dice al backend "ya subí el archivo, persistilo". El backend hace HEAD
 * en R2 para verificar que el objeto existe, e inserta la fila con
 * `Estado='Activa'`, `Orden=max+1`, `EsPrincipal=(si es la primera)`.
 */
export async function confirmarImagen(params: ConfirmarRequest): Promise<ProductoImagenAPI> {
  return api.post<ProductoImagenAPI>('/ProductoImagen/confirmar', params)
}

// ─── Helpers: dimensiones de imagen ─────────────────────────────────────────

/** Lee width/height de un archivo de imagen. Devuelve null si no se puede. */
export function leerDimensiones(archivo: File): Promise<{ anchoPx: number; altoPx: number } | null> {
  return new Promise((resolve) => {
    // No todos los navegadores soportan createImageBitmap; fallback a Image.
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      const dims = { anchoPx: img.naturalWidth, altoPx: img.naturalHeight }
      URL.revokeObjectURL(url)
      resolve(dims)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

// ─── 4. Orquesta los 3 pasos para UN archivo ────────────────────────────────

export interface SubirImagenParams {
  productoId: number
  archivo: File
  /** Callback opcional para reportar progreso al componente. */
  onProgreso?: (p: ProgresoSubida) => void
}

export interface SubirImagenResultado {
  imagen: ProductoImagenAPI
}

/**
 * Sube UNA imagen a R2 (presign + PUT + confirmar) y devuelve la fila creada.
 * Si algo falla, el archivo puede quedar huérfano en R2 — el GC lo limpia.
 */
export async function subirImagenAProducto({
  productoId,
  archivo,
  onProgreso,
}: SubirImagenParams): Promise<SubirImagenResultado> {
  onProgreso?.({ cargando: 0.05, fase: 'presign' })

  const { url, key } = await presignParaProducto(productoId, archivo)

  onProgreso?.({ cargando: 0.15, fase: 'upload' })
  const contentType = archivo.type || 'application/octet-stream'
  await subirArchivoAR2(url, archivo, contentType, (fraccion) => {
    // Mapear 0..1 del upload a 0.15..0.85 del total.
    onProgreso?.({ cargando: 0.15 + fraccion * 0.7, fase: 'upload' })
  })

  onProgreso?.({ cargando: 0.9, fase: 'confirmar' })
  const dims = await leerDimensiones(archivo)

  const imagen = await confirmarImagen({
    productoId,
    key,
    nombreArchivo: archivo.name,
    contentType,
    tamanoBytes: archivo.size,
    anchoPx: dims?.anchoPx ?? null,
    altoPx: dims?.altoPx ?? null,
  })

  onProgreso?.({ cargando: 1, fase: 'confirmar' })
  return { imagen }
}

// ─── 5. Lote diferido (usado en CREACIÓN de producto, sin id aún) ───────────

/**
 * Sube varias imágenes secuencialmente, reportando progreso global.
 * Usado cuando el producto se acaba de crear (todavía no tiene id al
 * momento de soltar los archivos).
 *
 * Si una imagen falla, se continúa con las siguientes; los errores se
 * devuelven en el array de `fallidas` para que el caller los muestre.
 */
export async function subirLoteDiferido(
  productoId: number,
  archivos: File[],
  onProgresoArchivo?: (index: number, fraccion: number) => void,
): Promise<{
  exitosas: ProductoImagenAPI[]
  fallidas: { archivo: File; error: string }[]
}> {
  const exitosas: ProductoImagenAPI[] = []
  const fallidas: { archivo: File; error: string }[] = []

  for (let i = 0; i < archivos.length; i++) {
    const archivo = archivos[i]
    try {
      onProgresoArchivo?.(i, 0)
      const { imagen } = await subirImagenAProducto({
        productoId,
        archivo,
        onProgreso: ({ cargando }) => onProgresoArchivo?.(i, cargando),
      })
      exitosas.push(imagen)
    } catch (err) {
      fallidas.push({ archivo, error: err instanceof Error ? err.message : 'Error desconocido' })
    }
  }
  return { exitosas, fallidas }
}

// ─── 6. Acciones sobre la galería (PUT/DELETE) ───────────────────────────────

export async function marcarImagenPrincipal(productoId: number, imagenId: number): Promise<ProductoImagenAPI[]> {
  return api.put<ProductoImagenAPI[]>(`/ProductoImagen/${imagenId}/principal`, { productoId, imagenId })
}

export async function reordenarImagenes(productoId: number, imagenesIds: number[]): Promise<ProductoImagenAPI[]> {
  return api.put<ProductoImagenAPI[]>('/ProductoImagen/reordenar', { productoId, imagenesIds })
}

export async function eliminarImagen(imagenId: number): Promise<void> {
  await api.delete<void>(`/ProductoImagen/${imagenId}`)
}

/**
 * Reemplaza el archivo de una imagen existente. Mismo flujo que subir pero
 * apunta al endpoint `/{id}/reemplazar` que mantiene la misma key de orden
 * y elimina la versión vieja de R2 (best-effort).
 */
export async function reemplazarImagen(params: {
  imagenId: number
  productoId: number
  archivo: File
  onProgreso?: (p: ProgresoSubida) => void
}): Promise<ProductoImagenAPI> {
  const { imagenId, productoId, archivo, onProgreso } = params

  onProgreso?.({ cargando: 0.05, fase: 'presign' })
  const { url, key } = await presignParaProducto(productoId, archivo)

  onProgreso?.({ cargando: 0.15, fase: 'upload' })
  const contentType = archivo.type || 'application/octet-stream'
  await subirArchivoAR2(url, archivo, contentType, (fraccion) => {
    onProgreso?.({ cargando: 0.15 + fraccion * 0.7, fase: 'upload' })
  })

  onProgreso?.({ cargando: 0.9, fase: 'confirmar' })
  const dims = await leerDimensiones(archivo)

  return api.put<ProductoImagenAPI>(`/ProductoImagen/${imagenId}/reemplazar`, {
    productoId,
    key,
    nombreArchivo: archivo.name,
    contentType,
    tamanoBytes: archivo.size,
    anchoPx: dims?.anchoPx ?? null,
    altoPx: dims?.altoPx ?? null,
  })
}
