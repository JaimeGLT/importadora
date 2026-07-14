import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui'
import type { Importacion, ImportacionSummary, ItemImportacion, Proveedor } from '@/types'
import { gql } from '@/lib/graphql'
import { IMPORTACION_DETAIL_QUERY, backendToImportacion } from '@/lib/queries/importaciones.queries'
import { notify } from '@/lib/notify'

interface Props {
  open: boolean
  onClose: () => void
  proveedor: Proveedor
  importaciones: ImportacionSummary[]
  loading: boolean
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtUSD(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtBs(n: number) {
  return `${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Tabla de productos de una importación ────────────────────────────────────

const COLS = [
  { key: 'codigo_proveedor',        label: 'Cód.',           w: 130 },
  { key: 'nombre',                  label: 'Producto',       w: 180 },
  { key: 'cod_alt_1',               label: 'Cód. Alt. 1',    w: 110 },
  { key: 'cod_alt_2',               label: 'Cód. Alt. 2',    w: 110 },
  { key: 'marca',                   label: 'Marca',           w: 100 },
  { key: 'procedencia',             label: 'Procedencia',     w: 110 },
  { key: 'descripcion',             label: 'Descripción',     w: 160 },
  { key: 'cantidad',                label: 'Cant.',           w: 70  },
  { key: 'costo_unitario_total_bs', label: 'Costo Bs',        w: 100 },
  { key: 'precio_venta_final',      label: 'Venta Bs',        w: 100 },
  { key: 'tipo_cambio',             label: 'TC',              w: 60  },
]

function ProductosTable({ items, tipoCambio }: { items: ItemImportacion[]; tipoCambio: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E8E5E2]">
      <table className="w-full text-[12px]">
        <thead>
          <tr style={{ background: '#F5F0EB' }}>
            {COLS.map((col, i) => (
              <th
                key={col.key}
                style={{
                  width: col.w,
                  padding: '10px 12px',
                  textAlign: 'left',
                  borderBottom: '1px solid #D0CBC4',
                  borderRight: i < COLS.length - 1 ? '1px solid #E8E5E2' : undefined,
                }}
                className="text-[10px] font-semibold uppercase tracking-wider text-[#5C5654]"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, rowIdx) => (
            <tr
              key={item.id}
              style={{ background: rowIdx % 2 === 0 ? '#FFFFFF' : '#FAF5EE' }}
              className="hover:bg-[#F5F0EB] transition-colors"
            >
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #E8E5E2', borderRight: '1px solid #E8E5E2' }}>
                <span className="font-mono text-[11px] text-[#2D2B2A] whitespace-nowrap">{item.codigo_proveedor}</span>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #E8E5E2', borderRight: '1px solid #E8E5E2' }}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-[#2D2B2A]">{item.nombre}</span>
                  {item.ubicacion && (
                    <span className="text-[10px] text-[#7A7571]">{item.ubicacion}</span>
                  )}
                </div>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #E8E5E2', borderRight: '1px solid #E8E5E2' }}>
                <span className="font-mono text-[11px] text-[#4A4744]">{item.codigos_adicionales[0] ?? '—'}</span>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #E8E5E2', borderRight: '1px solid #E8E5E2' }}>
                <span className="font-mono text-[11px] text-[#4A4744]">{item.codigos_adicionales[1] ?? '—'}</span>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #E8E5E2', borderRight: '1px solid #E8E5E2' }}>
                <span className="text-[#4A4744]">{item.marca ?? '—'}</span>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #E8E5E2', borderRight: '1px solid #E8E5E2' }}>
                <span className="text-[12px] text-[#4A4744]">{item.procedencia || '—'}</span>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #E8E5E2', borderRight: '1px solid #E8E5E2', maxWidth: 160 }}>
                <span className="text-[#7A7571] truncate block">{item.descripcion ?? '—'}</span>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #E8E5E2', borderRight: '1px solid #E8E5E2', textAlign: 'center' }}>
                <span className="font-semibold tabular-nums text-[#2D2B2A]">{item.cantidad}</span>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #E8E5E2', borderRight: '1px solid #E8E5E2', textAlign: 'right' }}>
                <span className="tabular-nums text-[#4A4744]">Bs {fmtBs(item.costo_unitario_total_bs)}</span>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #E8E5E2', borderRight: '1px solid #E8E5E2', textAlign: 'right' }}>
                <span className="tabular-nums font-semibold text-[#2D2B2A]">Bs {fmtBs(item.precio_venta_final)}</span>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #E8E5E2', textAlign: 'right' }}>
                <span className="tabular-nums text-[#7A7571]">{tipoCambio.toFixed(2)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Vista detalle de una importación ────────────────────────────────────────

function DetalleImportacion({
  importacionId,
  summary,
  onBack,
}: {
  importacionId: string
  summary: ImportacionSummary
  onBack: () => void
}) {
  const [importacion, setImportacion] = useState<Importacion | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  // Fetch lazy: trae el detalle (con todos los productos) solo cuando el
  // usuario hace click en una importación específica. Equivalente al patrón
  // ya usado en `ImportacionDetailModal` global.
  useEffect(() => {
    let cancelled = false
    setImportacion(null)
    setLoadingDetalle(true)
    gql<{ importacion: { nodes: Parameters<typeof backendToImportacion>[0][] } }>(
      IMPORTACION_DETAIL_QUERY,
      { id: Number(importacionId) },
    )
      .then((res) => {
        if (cancelled) return
        const node = res.importacion.nodes[0]
        if (node) setImportacion(backendToImportacion(node))
      })
      .catch(() => {
        if (!cancelled) notify.error('Error cargando detalle de la importación')
      })
      .finally(() => {
        if (!cancelled) setLoadingDetalle(false)
      })
    return () => { cancelled = true }
  }, [importacionId])

  // Mientras carga el detalle, mostramos el header con el `summary` (que ya
  // tenemos en memoria) y un skeleton en la tabla.
  const cantProductos = importacion?.items.length ?? summary.cantProductos
  const tipoCambio = importacion?.tipo_cambio ?? summary.tipo_cambio

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#F5F0EB] transition-colors"
          title="Volver al historial"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-semibold text-[#2D2B2A]">{summary.numero}</p>
          </div>
          <p className="text-[11px] text-[#7A7571] mt-0.5">
            {fmtDate(summary.fecha_creacion)} ·{' '}
            {loadingDetalle ? '…' : `${cantProductos} producto${cantProductos !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Resumen costos — siempre se puede mostrar desde el `summary` */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
        {[
          { label: 'FOB total',   value: fmtUSD(summary.fob_total_usd) },
          { label: 'Flete',       value: fmtUSD(summary.flete_usd) },
          { label: 'Aduana',      value: `Bs ${fmtBs(summary.aduana_bs)}` },
          { label: 'Transporte',  value: `Bs ${fmtBs(summary.transporte_interno_bs)}` },
          { label: 'Tipo cambio', value: `Bs ${tipoCambio.toFixed(2)}` },
        ].map((m) => (
          <div key={m.label} className="rounded-lg px-3 py-2.5 bg-[#FAF5EE] border border-[#E8E5E2]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A7571] mb-0.5">{m.label}</p>
            <p className="text-[13px] font-semibold text-[#2D2B2A]">{m.value}</p>
          </div>
        ))}
      </div>

      {loadingDetalle ? (
        <div className="overflow-x-auto rounded-xl border border-[#E8E5E2] p-3">
          <div className="animate-pulse space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-[#F0EFEC]" style={{ width: `${85 - i * 5}%` }} />
            ))}
          </div>
        </div>
      ) : !importacion || importacion.items.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[13px] text-[#7A7571]">Sin productos registrados en esta importación</p>
        </div>
      ) : (
        <ProductosTable items={importacion.items} tipoCambio={importacion.tipo_cambio} />
      )}
    </div>
  )
}

// ─── Vista lista de importaciones del proveedor ───────────────────────────────

export function CatalogoProveedorModal({ open, onClose, proveedor, importaciones, loading }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const imps = importaciones
    .slice()
    .sort((a, b) => b.fecha_creacion.localeCompare(a.fecha_creacion))

  const selectedSummary = selectedId
    ? imps.find((i) => i.id === selectedId) ?? null
    : null

  const handleClose = () => { setSelectedId(null); onClose() }

  const title = selectedSummary
    ? `${selectedSummary.numero} — ${proveedor.nombre}`
    : `Historial — ${proveedor.nombre}`

  return (
    <Modal open={open} onClose={handleClose} title={title} size="2xl">
      {loading ? (
        <div className="py-16 text-center">
          <div className="animate-pulse flex flex-col gap-3 items-center">
            <div className="h-8 w-48 rounded bg-[#F5F0EB]" />
            <div className="h-4 w-32 rounded bg-[#EDE8E3]" />
          </div>
          <p className="text-[12px] text-[#7A7571] mt-3">Cargando importaciones...</p>
        </div>
      ) : selectedSummary ? (
        <DetalleImportacion
          importacionId={selectedSummary.id}
          summary={selectedSummary}
          onBack={() => setSelectedId(null)}
        />
      ) : imps.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-white border border-[#D0CBC4] flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-package text-[#7A7571] text-xl" />
          </div>
          <p className="text-[13px] font-semibold text-[#2D2B2A] mb-1">Sin importaciones registradas</p>
          <p className="text-[12px] text-[#7A7571]">Las importaciones de este proveedor aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-2">
          {imps.map((imp) => (
            <button key={imp.id} onClick={() => setSelectedId(imp.id)} className="w-full text-left group">
              <div
                className="flex items-center gap-4 px-5 py-4 rounded-xl bg-white border border-[#D0CBC4] transition-all group-hover:border-[#780e18] group-hover:bg-[#FAF5EE]"
                style={{ boxShadow: '0 1px 3px rgba(45,43,42,0.04)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#2D2B2A] group-hover:text-[#780e18] transition-colors">
                    {imp.numero}
                  </p>
                  <p className="text-[11px] text-[#7A7571] mt-0.5">
                    {fmtDate(imp.fecha_creacion)} · {imp.cantProductos} producto{imp.cantProductos !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="hidden sm:block text-right shrink-0">
                  <p className="text-[13px] font-semibold tabular-nums text-[#2D2B2A]">{fmtUSD(imp.fob_total_usd)}</p>
                  <p className="text-[10px] text-[#7A7571]">FOB</p>
                </div>
                <svg
                  className="h-4 w-4 text-[#D0CBC4] group-hover:text-[#780e18] transition-colors shrink-0"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
