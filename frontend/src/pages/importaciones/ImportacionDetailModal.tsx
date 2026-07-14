import { Fragment, useEffect, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import type { Importacion, ItemImportacion, Marca } from '@/types'
import { gql } from '@/lib/graphql'
import { IMPORTACION_DETAIL_QUERY, backendToImportacion } from '@/lib/queries/importaciones.queries'
import { notify } from '@/lib/notify'

interface Props {
  open: boolean
  onClose: () => void
  importacion: Importacion | null
  marcas: Marca[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtUSD(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtBs(n: number) {
  return `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function ImportacionDetailModal({ open, onClose, importacion, marcas }: Props) {
  const [items, setItems] = useState<ItemImportacion[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    if (!open || !importacion) return
    setItems([])
    setLoadingItems(true)
    gql<{ importacion: { nodes: Parameters<typeof backendToImportacion>[0][] } }>(
      IMPORTACION_DETAIL_QUERY,
      { id: Number(importacion.id) },
    )
      .then(res => {
        const node = res.importacion.nodes[0]
        if (node) setItems(backendToImportacion(node).items)
      })
      .catch(() => notify.error('Error cargando detalle'))
      .finally(() => setLoadingItems(false))
  }, [open, importacion?.id])

  if (!importacion) return null

  const getMarcaNombre = (marcaId?: number | null) =>
    marcaId ? (marcas.find(m => m.id === marcaId)?.nombre ?? '') : ''

  const costoTotal =
    importacion.fob_total_usd * importacion.tipo_cambio +
    importacion.flete_usd * importacion.tipo_cambio +
    importacion.aduana_bs +
    importacion.transporte_interno_bs

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-[#2D2B2A]/40 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-xl flex flex-col overflow-hidden border border-[#D0CBC4]">

              {/* Header */}
              <div className="px-6 py-5 border-b border-[#D0CBC4] bg-[#F5F0EB] flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#780e18] to-[#D4A333] flex items-center justify-center text-white shrink-0">
                      <i className="ti ti-package-import text-base" />
                    </div>
                    <DialogTitle
                      className="text-xl font-semibold text-[#2D2B2A] tracking-[-0.02em]"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {importacion.numero}
                    </DialogTitle>
                  </div>
                  <p className="text-sm text-[#7A7571] ml-11">{importacion.proveedor} · {importacion.origen}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#E8E5E2] transition-colors"
                >
                  <i className="ti ti-x text-xl" />
                </button>
              </div>

              {/* KPIs */}
              <div className="px-6 py-4 border-b border-[#D0CBC4] bg-white">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-semibold text-[#7A7571] tracking-[0.1em] mb-1">Productos</p>
                    <p
                      className="font-semibold text-[26px] text-[#2D2B2A] leading-none tracking-[-0.025em]"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {loadingItems ? <span className="text-[18px] text-[#7A7571]">…</span> : items.length}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-semibold text-[#7A7571] tracking-[0.1em] mb-1">FOB Total</p>
                    <p
                      className="font-semibold text-[22px] text-[#2D2B2A] leading-none tracking-[-0.025em]"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {fmtUSD(importacion.fob_total_usd)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-semibold text-[#7A7571] tracking-[0.1em] mb-1">Inversión</p>
                    <p
                      className="font-semibold text-[22px] text-[#780e18] leading-none tracking-[-0.025em]"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {fmtBs(costoTotal)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-semibold text-[#7A7571] tracking-[0.1em] mb-1">T.C.</p>
                    <p
                      className="font-semibold text-[22px] text-[#2D2B2A] leading-none tracking-[-0.025em]"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {importacion.tipo_cambio.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-semibold text-[#7A7571] tracking-[0.1em] mb-1">Llegada</p>
                    <p className="text-base font-semibold text-[#2D2B2A]">{fmtDate(importacion.fecha_estimada_llegada)}</p>
                  </div>
                </div>
              </div>

              {/* Tabla de productos */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: '220px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '60px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '80px' }} />
                  </colgroup>
                  <thead className="sticky top-0 bg-[#F5F0EB] z-10 border-b border-[#D0CBC4]">
                    <tr>
                      <th className="text-left px-4 py-[11px] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#5C5654]">Producto</th>
                      <th className="text-left px-2 py-[11px] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#5C5654]">Marca</th>
                      <th className="text-left px-2 py-[11px] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#5C5654]">Procedencia</th>
                      <th className="text-center px-2 py-[11px] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#5C5654]">Cant.</th>
                      <th className="text-right px-2 py-[11px] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#5C5654]">Costo Unit.</th>
                      <th className="text-right px-2 py-[11px] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#5C5654]">Precio Venta</th>
                      <th className="text-center px-3 py-[11px] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#5C5654]">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D0CBC4]">
                    {loadingItems
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-4 py-3"><div className="h-3 w-32 rounded bg-[#F0EFEC] mb-1.5" /><div className="h-2.5 w-24 rounded bg-[#E8E5E2]" /></td>
                            <td className="px-2 py-3"><div className="h-5 w-16 rounded-full bg-[#F0EFEC]" /></td>
                            <td className="px-2 py-3"><div className="h-2.5 w-14 rounded bg-[#F0EFEC]" /></td>
                            <td className="px-2 py-3 text-center"><div className="h-2.5 w-6 rounded bg-[#F0EFEC] mx-auto" /></td>
                            <td className="px-2 py-3 text-right"><div className="h-2.5 w-16 rounded bg-[#F0EFEC] ml-auto" /></td>
                            <td className="px-2 py-3 text-right"><div className="h-2.5 w-16 rounded bg-[#F0EFEC] ml-auto" /></td>
                            <td className="px-3 py-3 text-center"><div className="h-5 w-12 rounded-full bg-[#F0EFEC] mx-auto" /></td>
                          </tr>
                        ))
                      : items.map((item) => (
                          <tr key={item.id} className="hover:bg-[#FAF5EE] transition-colors">
                            <td className="px-4 py-3 overflow-hidden">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-mono font-bold bg-[#780e18] text-white shrink-0">
                                  {item.codigo_proveedor}
                                </span>
                                {item.codigos_adicionales?.[0] && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-medium bg-[#F5F0EB] text-[#5C5654] border border-[#D0CBC4] shrink-0">
                                    {item.codigos_adicionales[0]}
                                  </span>
                                )}
                                {item.codigos_adicionales?.[1] && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-medium bg-[#F5F0EB] text-[#5C5654] border border-[#D0CBC4] shrink-0">
                                    {item.codigos_adicionales[1]}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-[#2D2B2A] leading-tight truncate">{item.nombre}</p>
                            </td>
                            <td className="px-2 py-3">
                              {getMarcaNombre(item.marcaId) ? (
                                <div className="inline-flex items-center gap-1.5 bg-[#E8D4B8] text-[#780e18] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#780e18] shrink-0" />
                                  {getMarcaNombre(item.marcaId)}
                                </div>
                              ) : (
                                <span className="text-xs text-[#7A7571]">—</span>
                              )}
                            </td>
                            <td className="px-2 py-3">
                              <span className="text-[12px] text-[#5C5654]">{item.procedencia || '—'}</span>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <span className="font-mono font-semibold text-[13px] text-[#2D2B2A] tabular-nums">{item.cantidad}</span>
                            </td>
                            <td className="px-2 py-3 text-right">
                              <span className="text-[11px] font-medium text-[#7A7571]">Bs</span>
                              <span className="text-sm font-semibold text-[#5C5654] tabular-nums ml-1">{item.costo_unitario_total_bs.toFixed(2)}</span>
                            </td>
                            <td className="px-2 py-3 text-right">
                              <span className="text-[11px] font-medium text-[#7A7571]">Bs</span>
                              <span className="text-sm font-semibold text-[#3F7A52] tabular-nums ml-1">{item.precio_venta_final.toFixed(2)}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              {item.es_nuevo ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4ECDB] text-[#780e18]">
                                  Nuevo
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#B8DCCA] text-[#1E5C38]">
                                  Stock+
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-[#F5F0EB] border-t border-[#D0CBC4] flex items-center justify-between gap-4">
                <div className="flex items-center gap-5 flex-wrap">
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-[#7A7571] tracking-[0.1em]">Creada</p>
                    <p className="text-sm font-semibold text-[#2D2B2A] mt-0.5">{fmtDate(importacion.fecha_creacion)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-[#7A7571] tracking-[0.1em]">Flete</p>
                    <p className="text-sm font-semibold text-[#2D2B2A] mt-0.5">
                      {fmtUSD(importacion.flete_usd)}
                      <span className="text-[11px] text-[#7A7571] ml-1">({fmtBs(importacion.flete_usd * importacion.tipo_cambio)})</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-[#7A7571] tracking-[0.1em]">Aduana</p>
                    <p className="text-sm font-semibold text-[#2D2B2A] mt-0.5">{fmtBs(importacion.aduana_bs)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-[#7A7571] tracking-[0.1em]">Transporte</p>
                    <p className="text-sm font-semibold text-[#2D2B2A] mt-0.5">{fmtBs(importacion.transporte_interno_bs)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase font-semibold text-[#7A7571] tracking-[0.1em]">Inversión Total</p>
                  <p
                    className="font-semibold text-[22px] text-[#780e18] leading-none mt-1 tracking-[-0.025em]"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {fmtBs(costoTotal)}
                  </p>
                </div>
              </div>

            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
