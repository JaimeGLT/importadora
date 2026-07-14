import { type RefObject, useCallback } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { notify } from '@/lib/notify'

/**
 * Captura un elemento HTML completo como PNG de alta resolución.
 *
 * Usa html2canvas para rasterizar TODO el contenido del contenedor:
 * - Header (título, descripción)
 * - KPIs (tarjetas con números)
 * - Charts SVG (donut, bar, area, gauge, line)
 * - Tablas con datos
 *
 * Devuelve un data URL PNG listo para incrustar en un PDF o descargar.
 */
async function captureElementAsPng(
  element: HTMLElement,
  scale = 2,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: '#FFFFFF',
    useCORS: true,
    logging: false,
    // Evita que html2canvas corte los elementos con overflow:hidden
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function safeFilename(name: string, ext: string): string {
  const base = name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'reporte'
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${base}_${ts}.${ext}`
}

export interface ChartExportApi {
  /**
   * Descarga TODO el contenido del contenedor como una imagen PNG.
   *
   * Útil para: chart individual (vía ref del ChartContainer) o reporte
   * completo (vía ref del page container). Captura header + KPIs + charts
   * + tablas tal como se ven en pantalla.
   */
  exportPNG: (ref: RefObject<HTMLElement | null>, filename?: string) => Promise<void>
  /**
   * Genera un PDF con TODO el contenido del contenedor.
   *
   * - Si el contenido entra en una página A4: 1 sola página.
   * - Si es muy largo: lo divide en múltiples páginas A4 (corte horizontal
   *   limpio entre páginas para que la información quede legible).
   * - El `title` se imprime como encabezado sólo en la primera página.
   */
  exportPDF: (ref: RefObject<HTMLElement | null>, filename?: string, title?: string) => Promise<void>
}

export function useChartExport(): ChartExportApi {
  const exportPNG = useCallback(async (ref: RefObject<HTMLElement | null>, filename = 'reporte') => {
    if (!ref.current) { notify.error('No se pudo exportar el reporte.'); return }
    try {
      const { dataUrl } = await captureElementAsPng(ref.current, 2)
      downloadDataUrl(dataUrl, safeFilename(filename, 'png'))
      notify.success('Imagen descargada.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      notify.error(`No se pudo exportar: ${msg}`)
    }
  }, [])

  const exportPDF = useCallback(async (
    ref: RefObject<HTMLElement | null>,
    filename = 'reporte',
    title?: string,
  ) => {
    if (!ref.current) { notify.error('No se pudo exportar el reporte.'); return }
    try {
      // Capturar el contenedor completo como PNG a alta resolución
      const { dataUrl, width, height } = await captureElementAsPng(ref.current, 2)

      // Tamaño de la imagen en mm (asumiendo 96 DPI base → 1px ≈ 0.2646mm)
      // Como capturamos con scale=2, dividimos por 2 para obtener tamaño "lógico"
      const imgWmm = (width  / 2) * 0.2645833
      const imgHmm = (height / 2) * 0.2645833

      // A4 en mm
      const A4_PORTRAIT_W = 210
      const A4_PORTRAIT_H = 297
      const A4_LANDSCAPE_W = 297
      const A4_LANDSCAPE_H = 210

      // Decidir orientación: landscape si la imagen es significativamente más
      // ancha que alta (ratio > 1.3), portrait en caso contrario.
      const useLandscape = imgWmm / imgHmm > 1.3
      const pageW = useLandscape ? A4_LANDSCAPE_W : A4_PORTRAIT_W
      const pageH = useLandscape ? A4_LANDSCAPE_H : A4_PORTRAIT_H

      const margin = 10
      const titleH = title ? 8 : 0

      // El área imprimible (descontando márgenes y título de página 1)
      const printableH = pageH - margin * 2 - titleH

      // Si la imagen entera entra en una sola página: ponerla como una sola
      // página escalada para que ocupe el área imprimible.
      if (imgHmm <= printableH) {
        const pdf = new jsPDF({
          orientation: useLandscape ? 'landscape' : 'portrait',
          unit: 'mm',
          format: 'a4',
        })

        if (title) {
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'bold')
          pdf.text(title, margin, margin + 4)
        }

        // Escalar la imagen para que entre en el área imprimible
        let drawW = pageW - margin * 2
        let drawH = imgHmm * (drawW / imgWmm)
        if (drawH > printableH) {
          drawH = printableH
          drawW = drawH * (imgWmm / imgHmm)
        }
        const x = (pageW - drawW) / 2
        const y = margin + titleH + (printableH - drawH) / 2
        pdf.addImage(dataUrl, 'PNG', x, y, drawW, drawH)
        pdf.save(safeFilename(filename, 'pdf'))
        notify.success('PDF descargado.')
        return
      }

      // Imagen más alta que una página: dividir en N páginas.
      // Estrategia: cada página contiene una "tira" de la imagen original.
      // pxPorMm: cuántos píxeles de la imagen original caben en printableH mm.
      // (Recordemos que imgHmm está en mm "lógicos" — multiplicamos por 2 para
      // obtener píxeles de la imagen capturada a scale=2.)
      const pxPerMm = (height / imgHmm)
      const slicePxH = Math.floor(printableH * pxPerMm) // alto de cada slice en píxeles
      const totalSlices = Math.ceil(height / slicePxH)

      const pdf = new jsPDF({
        orientation: useLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      for (let i = 0; i < totalSlices; i++) {
        if (i > 0) pdf.addPage()

        // Crear un canvas temporal con la slice
        const sliceTop    = i * slicePxH
        const sliceHeight = Math.min(slicePxH, height - sliceTop)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width  = width
        sliceCanvas.height = sliceHeight
        const sctx = sliceCanvas.getContext('2d')
        if (!sctx) throw new Error('No se pudo crear el contexto del canvas para el slice.')
        sctx.fillStyle = '#FFFFFF'
        sctx.fillRect(0, 0, width, sliceHeight)
        // Dibujar la slice de la imagen completa sobre el canvas temporal
        const fullImg = new Image()
        await new Promise<void>((resolve, reject) => {
          fullImg.onload = () => resolve()
          fullImg.onerror = () => reject(new Error('No se pudo recargar la imagen para slicing.'))
          fullImg.src = dataUrl
        })
        sctx.drawImage(fullImg, 0, sliceTop, width, sliceHeight, 0, 0, width, sliceHeight)
        const sliceDataUrl = sliceCanvas.toDataURL('image/png')

        // Título sólo en la primera página
        if (i === 0 && title) {
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'bold')
          pdf.text(title, margin, margin + 4)
        }

        // Tamaño de la slice en mm
        const sliceHmm = sliceHeight / pxPerMm
        // Escalar para que entre en el ancho disponible
        let drawW = pageW - margin * 2
        let drawH = sliceHmm * (drawW / imgWmm)
        if (drawH > printableH) {
          drawH = printableH
          drawW = drawH * (imgWmm / sliceHmm)
        }
        const x = (pageW - drawW) / 2
        const y = margin + (i === 0 ? titleH : 0) + (printableH - drawH) / 2
        pdf.addImage(sliceDataUrl, 'PNG', x, y, drawW, drawH)
      }

      pdf.save(safeFilename(filename, 'pdf'))
      notify.success(totalSlices === 1 ? 'PDF descargado.' : `PDF descargado (${totalSlices} páginas).`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      notify.error(`No se pudo exportar: ${msg}`)
    }
  }, [])

  return { exportPNG, exportPDF }
}