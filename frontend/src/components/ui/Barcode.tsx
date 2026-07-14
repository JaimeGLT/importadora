import { useEffect, useRef } from 'react'
import type JsBarcodeType from 'jsbarcode'

interface BarcodeProps {
  value: string
  width?: number
  height?: number
  fontSize?: number
  displayValue?: boolean
}

export function Barcode({ value, width = 2, height = 60, fontSize = 12, displayValue = true }: BarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !value) return

    import('jsbarcode').then((mod) => {
      const JsBarcode = mod.default as typeof JsBarcodeType
      try {
        JsBarcode(svgRef.current!, value, {
          format: 'CODE128',
          width,
          height,
          fontSize,
          displayValue,
          margin: 6,
          background: '#ffffff',
          lineColor: '#000000',
          fontOptions: 'normal',
          font: 'Inter, system-ui, sans-serif',
          textMargin: 4,
        })
      } catch {
        // código inválido para CODE128 — muestra fallback
        if (svgRef.current) {
          svgRef.current.innerHTML = `<text x="50%" y="50%" text-anchor="middle" font-size="10" fill="#ef4444">Código inválido</text>`
        }
      }
    }).catch(() => null)
  }, [value, width, height, fontSize, displayValue])

  return <svg ref={svgRef} className="w-full" />
}
