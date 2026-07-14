import { useRef } from 'react'
import { Modal, Button } from '@/components/ui'
import type { OrdenVenta } from '@/types'

interface TicketPreviewProps {
  orden: OrdenVenta
  open: boolean
  onClose: () => void
}

export function TicketPreview({ orden, open, onClose }: TicketPreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  const itemsDespachados = orden.items.filter(
    i => i.estado === 'completo' || i.estado === 'parcial'
  )

  const handlePrint = () => {
    const content = contentRef.current
    if (!content) return

    const printWindow = window.open('', '_blank', 'width=300,height=600')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orden ${orden.numero}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; font-size: 12px; padding: 8px; width: 280px; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
            .header h2 { font-size: 16px; margin-bottom: 2px; }
            .header p { font-size: 10px; }
            .item { margin-bottom: 8px; }
            .item-name { font-weight: bold; }
            .item-detail { padding-left: 8px; font-size: 11px; }
            .separator { border-top: 1px dashed #000; margin: 6px 0; }
            .footer { border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; font-size: 11px; }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
    printWindow.close()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Ticket — ${orden.numero}`} size="sm">
      <div className="space-y-4">
        <div
          ref={contentRef}
          className="bg-white border border-steel-200 rounded-lg p-4 font-mono text-xs text-steel-800"
        >
          <div className="text-center border-b border-dashed border-steel-300 pb-3 mb-3">
            <h2 className="text-base font-bold">ORDEN #{orden.numero.replace('ORD-', '')}</h2>
            <p className="text-steel-500 mt-0.5">Cajero: {orden.cajero_nombre}</p>
            <p className="text-steel-400 text-[10px] mt-0.5">
              {new Date().toLocaleString('es-BO')}
            </p>
          </div>

          <div className="space-y-3">
            {itemsDespachados.map((item, idx) => (
              <div key={item.id}>
                {idx > 0 && (
                  <div className="border-t border-dashed border-steel-200 my-2" />
                )}
                <p className="font-bold text-[11px]">
                  {idx + 1}. {item.producto_nombre}
                </p>
                <div className="pl-3 mt-1 space-y-0.5">
                  <p>Código:      <span className="font-mono">{item.producto_codigo}</span></p>
                  <p>Cantidad:   <span className="font-bold">{item.cantidad_recogida ?? item.cantidad_pedida} unidades</span></p>
                  {item.producto_almacen && (
                    <p>Ubicación:  <span>{item.producto_almacen}{item.producto_estante ? ` / ${item.producto_estante}` : ''}{item.producto_fila ? ` / ${item.producto_fila}` : ''}{item.producto_columna ? ` / ${item.producto_columna}` : ''}</span></p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-steel-300 mt-4 pt-3 text-center">
            <p className="text-[10px] text-steel-400">
              ⚠ Esto es un ticket de demostración
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir ticket
          </Button>
        </div>
      </div>
    </Modal>
  )
}