import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { PageTopBar } from '@/components/layout/PageTopBar'
import { ServerPagination } from '@/components/ui'
import { ProductThumb } from '@/components/ui/ProductThumb'
import { GalleryViewerModal } from './GalleryViewerModal'
import { notify } from '@/lib/notify'
import { gql } from '@/lib/graphql'
import { api } from '@/lib/api'
import {
  PRODUCTOS_CON_MARCAS_QUERY,
  PRODUCTO_BY_ID_QUERY,
  backendToProductoSimple,
  backendToProducto,
  type ProductoAPI,
  type ProductoAPISimple,
} from '@/lib/queries/inventario.queries'
import {
  AJUSTES_HISTORIAL_QUERY,
  backendToAjusteRow,
  type AjusteStockAPI,
  type AjusteStockRow,
} from '@/lib/queries/ajustes.queries'
import type { Producto, PiezaKit } from '@/types'
import { clsx } from 'clsx'

// ─── Constants ────────────────────────────────────────────────────────────────

const MOTIVOS = [
  'Conteo físico',
  'Merma / daño',
  'Error de registro',
  'Devolución de cliente',
  'Ajuste por importación',
  'Otro',
]

// ─── Shared sub-components ────────────────────────────────────────────────────

function MotivoField({ motivo, setMotivo, motivoCustom, setMotivoCustom }: {
  motivo: string; setMotivo: (m: string) => void
  motivoCustom: string; setMotivoCustom: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">Motivo *</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {MOTIVOS.map(m => (
          <button key={m} type="button" onClick={() => setMotivo(m)}
            className={clsx('px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all',
              motivo === m
                ? 'bg-[#780e18] text-white border-[#780e18]'
                : 'bg-white text-[#4A4744] border-[#E8E5E2] hover:border-[#780e18] hover:text-[#780e18]')}>
            {m}
          </button>
        ))}
      </div>
      {motivo === 'Otro' && (
        <input type="text" value={motivoCustom} onChange={e => setMotivoCustom(e.target.value)}
          maxLength={200} placeholder="Describe el motivo…" required
          className="w-full h-10 px-3.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all" />
      )}
    </div>
  )
}

function NotaField({ nota, setNota }: { nota: string; setNota: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">
        Nota <span className="font-normal text-[#7A7571]">(opcional)</span>
      </label>
      <textarea value={nota} onChange={e => setNota(e.target.value)} maxLength={500} rows={2}
        placeholder="Detalles adicionales…"
        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm resize-none focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all" />
    </div>
  )
}

// ─── Table skeletons ──────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="divide-y divide-[#E8E5E2]">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-3.5 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-[#F0EFEC] shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 rounded bg-[#F0EFEC]" />
            <div className="h-2.5 w-40 rounded bg-[#E8E5E2]" />
          </div>
          <div className="h-2.5 w-16 rounded bg-[#F0EFEC]" />
          <div className="h-2.5 w-16 rounded bg-[#F0EFEC]" />
          <div className="h-6 w-14 rounded bg-[#F0EFEC]" />
          <div className="h-7 w-20 rounded-lg bg-[#F0EFEC]" />
        </div>
      ))}
    </div>
  )
}

function MobileSkeletonRows() {
  return (
    <div className="divide-y divide-[#E8E5E2]">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="w-9 h-9 rounded-lg bg-[#F0EFEC] shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 rounded bg-[#F0EFEC]" />
            <div className="h-2.5 w-36 rounded bg-[#E8E5E2]" />
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="h-5 w-10 rounded bg-[#F0EFEC]" />
            <div className="h-2.5 w-14 rounded bg-[#E8E5E2]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function HistorialSkeleton() {
  return (
    <div className="divide-y divide-[#E8E5E2]">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-3.5 animate-pulse">
          <div className="h-2.5 w-28 rounded bg-[#F0EFEC]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 rounded bg-[#F0EFEC]" />
            <div className="h-2.5 w-24 rounded bg-[#E8E5E2]" />
          </div>
          <div className="h-6 w-12 rounded-full bg-[#F0EFEC]" />
          <div className="h-2.5 w-24 rounded bg-[#F0EFEC]" />
          <div className="h-2.5 w-20 rounded bg-[#F0EFEC]" />
        </div>
      ))}
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[22px]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-[#D0CBC4] p-[18px] animate-pulse">
          <div className="flex items-start justify-between mb-[14px]">
            <div className="w-9 h-9 rounded-lg bg-[#F0EFEC]" />
            <div className="h-5 w-20 rounded-full bg-[#F0EFEC]" />
          </div>
          <div className="h-8 w-16 rounded bg-[#F0EFEC] mb-2" />
          <div className="h-2.5 w-28 rounded bg-[#E8E5E2]" />
        </div>
      ))}
    </div>
  )
}

// ─── AjusteModal ─────────────────────────────────────────────────────────────

type ModalTab = 'kit' | 'piezas'

interface PiezaAjuste {
  pieza: PiezaKit
  deltaStr: string
}

function AjusteModal({
  producto,
  onClose,
  onSuccess,
}: {
  producto: Producto
  onClose: () => void
  onSuccess: (id: string, nuevoStock: number) => void
}) {
  const [tab, setTab] = useState<ModalTab>('kit')
  const [deltaStr, setDeltaStr] = useState('')
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [motivoCustom, setMotivoCustom] = useState('')
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingPiezas, setLoadingPiezas] = useState(false)
  const [piezasAjuste, setPiezasAjuste] = useState<PiezaAjuste[]>([])
  const [motivoPiezas, setMotivoPiezas] = useState(MOTIVOS[0])
  const [motivoPiezasCustom, setMotivoPiezasCustom] = useState('')
  const [notaPiezas, setNotaPiezas] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (tab === 'piezas' && producto.es_kit && piezasAjuste.length === 0 && !loadingPiezas) {
      setLoadingPiezas(true)
      gql<{ productos: { nodes: ProductoAPI[] } }>(PRODUCTO_BY_ID_QUERY, { id: Number(producto.id) })
        .then(data => {
          const raw = data.productos?.nodes?.[0]
          if (raw) {
            const full = backendToProducto(raw)
            setPiezasAjuste((full.piezas_kit ?? []).map(p => ({ pieza: p, deltaStr: '' })))
          }
        })
        .catch(() => notify.error('Error cargando piezas'))
        .finally(() => setLoadingPiezas(false))
    }
  }, [tab, producto, piezasAjuste.length, loadingPiezas])

  const delta = deltaStr === '' ? NaN : parseInt(deltaStr, 10)
  const deltaValido = !isNaN(delta) && delta !== 0
  const nuevoStock = producto.stock + delta
  const nuevoStockValido = deltaValido && nuevoStock >= 0
  const motivoFinal = motivo === 'Otro' ? motivoCustom.trim() : motivo
  const motivoPiezasFinal = motivoPiezas === 'Otro' ? motivoPiezasCustom.trim() : motivoPiezas

  const piezasConCambio = piezasAjuste.filter(pa => {
    const d = parseInt(pa.deltaStr, 10)
    return pa.deltaStr !== '' && !isNaN(d) && d !== 0 && (pa.pieza.stock_actual + d) >= 0
  })

  const handleSubmitKit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoStockValido || !motivoFinal) return
    setSaving(true)
    try {
      const res = await api.post<{ cantidadNueva: number }>(`/AjusteStock/${producto.id}`, {
        delta,
        motivo: motivoFinal,
        nota: nota.trim(),
      })
      notify.success('Stock ajustado', {
        description: `${producto.nombre}: ${producto.stock} → ${res?.cantidadNueva ?? nuevoStock}`,
      })
      onSuccess(producto.id, res?.cantidadNueva ?? nuevoStock)
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al ajustar stock')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitPiezas = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!motivoPiezasFinal || piezasConCambio.length === 0) return
    setSaving(true)
    try {
      for (const pa of piezasConCambio) {
        const d = parseInt(pa.deltaStr, 10)
        await api.post(`/AjusteStock/${producto.id}/Piezas/${pa.pieza.id}`, {
          delta: d,
          motivo: motivoPiezasFinal,
          nota: notaPiezas.trim(),
        })
      }
      notify.success(`${piezasConCambio.length} pieza(s) ajustada(s)`)
      onSuccess(producto.id, -1)
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al ajustar piezas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(45,43,42,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden border border-[#E8E5E2]">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#E8E5E2]">
          <div className="flex items-start gap-3">
            <div className={clsx(
              'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white',
              producto.es_kit
                ? 'bg-gradient-to-br from-[#780e18] to-[#B4881C]'
                : 'bg-gradient-to-br from-[#4A4744] to-[#7A7571]'
            )}>
              <i className={clsx('text-[18px]', producto.es_kit ? 'ti ti-stack' : 'ti ti-package')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-bold text-[#2D2B2A] truncate tracking-[0.05em]">{producto.codigo_universal}</p>
              {(producto.codigos_alternativos?.filter(Boolean) ?? []).length > 0 && (
                <div className="flex flex-wrap gap-x-1.5 mt-0.5">
                  {producto.codigos_alternativos!.filter(Boolean).map((c, i) => (
                    <span key={i} className="text-[12px] font-mono text-[#7A7571]">{c}</span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-[#7A7571] truncate mt-0.5">{producto.nombre}</p>
              {producto.marca && <p className="text-[10px] text-[#7A7571]/70 mt-0.5">{producto.marca}</p>}
            </div>
            <button onClick={onClose} className="text-[#7A7571] hover:text-[#2D2B2A] transition-colors p-1 rounded-lg hover:bg-[#F0EFEC]">
              <i className="ti ti-x text-[18px]" />
            </button>
          </div>

          {producto.es_kit && (
            <div className="flex gap-1 mt-4 p-1 bg-[#F7F7F7] rounded-xl border border-[#E8E5E2]">
              <button
                onClick={() => setTab('kit')}
                className={clsx('flex-1 h-8 rounded-lg text-[12px] font-semibold transition-all',
                  tab === 'kit'
                    ? 'bg-white text-[#2D2B2A] shadow-sm border border-[#E8E5E2]'
                    : 'text-[#7A7571] hover:text-[#2D2B2A]')}
              >
                Kit completo
              </button>
              <button
                onClick={() => setTab('piezas')}
                className={clsx('flex-1 h-8 rounded-lg text-[12px] font-semibold transition-all',
                  tab === 'piezas'
                    ? 'bg-white text-[#2D2B2A] shadow-sm border border-[#E8E5E2]'
                    : 'text-[#7A7571] hover:text-[#2D2B2A]')}
              >
                Por pieza
              </button>
            </div>
          )}
        </div>

        {/* ── Tab: Kit completo ── */}
        {tab === 'kit' && (
          <form onSubmit={handleSubmitKit} className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#F7F7F7] rounded-xl px-4 py-3 text-center border border-[#E8E5E2]">
                <p className="text-[10px] text-[#7A7571] uppercase tracking-wider mb-1 font-bold">Actual</p>
                <p className="text-[28px] font-mono font-black text-[#2D2B2A] leading-none">{producto.stock}</p>
                {producto.es_kit && <p className="text-[10px] text-[#780e18] font-bold mt-1">kits</p>}
              </div>
              <div className="text-[#7A7571]">
                <i className="ti ti-arrow-right text-[20px]" />
              </div>
              <div className={clsx('flex-1 rounded-xl px-4 py-3 text-center border-2 transition-all',
                !deltaValido || !nuevoStockValido
                  ? 'bg-[#F7F7F7] border-[#E8E5E2]'
                  : delta > 0
                    ? 'bg-[#B8DCCA] border-[#3F7A52]/30'
                    : 'bg-[#F5C9C0] border-[#B23A2A]/30'
              )}>
                <p className="text-[10px] text-[#7A7571] uppercase tracking-wider mb-1 font-bold">Resultado</p>
                <p className={clsx('text-[28px] font-mono font-black leading-none',
                  !deltaValido || !nuevoStockValido ? 'text-[#7A7571]'
                  : delta > 0 ? 'text-[#3F7A52]' : 'text-[#B23A2A]'
                )}>
                  {deltaValido && nuevoStockValido ? nuevoStock : '—'}
                </p>
                {deltaValido && nuevoStockValido && (
                  <p className={clsx('text-[11px] font-bold mt-1', delta > 0 ? 'text-[#3F7A52]' : 'text-[#B23A2A]')}>
                    {delta > 0 ? `+${delta}` : delta}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2D2B2A] mb-1.5">
                Ajuste <span className="font-normal text-[#7A7571]">(usa − para restar, p.ej. −3 o +5)</span>
              </label>
              <input
                ref={inputRef}
                type="number"
                value={deltaStr}
                onChange={e => setDeltaStr(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E5E2] bg-white text-[#2D2B2A] text-lg text-center font-bold focus:outline-none focus:border-[#780e18] focus:ring-2 focus:ring-[#780e18]/10 transition-all"
                placeholder="0"
              />
              {deltaValido && !nuevoStockValido && (
                <p className="text-xs text-[#B23A2A] mt-1 font-medium">El resultado sería negativo — ajuste no permitido.</p>
              )}
            </div>

            <MotivoField motivo={motivo} setMotivo={setMotivo} motivoCustom={motivoCustom} setMotivoCustom={setMotivoCustom} />
            <NotaField nota={nota} setNota={setNota} />

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={saving}
                className="flex-1 h-10 rounded-xl border border-[#E8E5E2] text-sm font-semibold text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={saving || !nuevoStockValido || !motivoFinal}
                className="flex-1 h-10 rounded-xl bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                {saving ? 'Guardando…' : 'Confirmar ajuste'}
              </button>
            </div>
          </form>
        )}

        {/* ── Tab: Por pieza ── */}
        {tab === 'piezas' && (
          <form onSubmit={handleSubmitPiezas} className="px-6 py-5 space-y-4">
            {loadingPiezas ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-7 w-7 rounded-full border-2 border-[#E8E5E2] border-t-[#780e18] animate-spin" />
              </div>
            ) : piezasAjuste.length === 0 ? (
              <p className="text-sm text-[#7A7571] text-center py-8 font-semibold">Sin piezas registradas</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {piezasAjuste.map((pa, idx) => {
                  const d = parseInt(pa.deltaStr, 10)
                  const dValido = pa.deltaStr !== '' && !isNaN(d) && d !== 0
                  const resultado = pa.pieza.stock_actual + d
                  const resultadoValido = dValido && resultado >= 0
                  return (
                    <div key={pa.pieza.id}
                      className={clsx('flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors',
                        dValido && resultadoValido
                          ? 'border-[#780e18]/30 bg-[#F4ECDB]/40'
                          : dValido && !resultadoValido
                            ? 'border-[#B23A2A]/30 bg-[#F5C9C0]/50'
                            : 'border-[#E8E5E2] bg-[#F7F7F7]/50'
                      )}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#2D2B2A] truncate">{pa.pieza.nombre}</p>
                        <p className="text-[10px] text-[#7A7571] font-mono">{pa.pieza.codigo_universal}</p>
                      </div>
                      <div className="text-right shrink-0 w-12">
                        <p className="text-[10px] text-[#7A7571] font-semibold">actual</p>
                        <p className="text-sm font-mono font-bold text-[#2D2B2A]">{pa.pieza.stock_actual}</p>
                      </div>
                      <div className="shrink-0 w-20">
                        <input
                          type="number"
                          value={pa.deltaStr}
                          onChange={e => setPiezasAjuste(prev => prev.map((x, i) => i === idx ? { ...x, deltaStr: e.target.value } : x))}
                          className="w-full h-8 px-2 rounded-lg border border-[#E8E5E2] bg-white text-[#2D2B2A] text-sm text-center font-bold focus:outline-none focus:border-[#780e18] transition-all"
                          placeholder="±0"
                        />
                      </div>
                      <div className="shrink-0 w-10 text-right">
                        {dValido && resultadoValido && (
                          <span className={clsx('text-[12px] font-mono font-bold',
                            d > 0 ? 'text-[#3F7A52]' : 'text-[#B23A2A]')}>
                            {resultado}
                          </span>
                        )}
                        {dValido && !resultadoValido && (
                          <span className="text-[10px] text-[#B23A2A] font-bold">−</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!loadingPiezas && piezasAjuste.length > 0 && (
              <>
                <MotivoField motivo={motivoPiezas} setMotivo={setMotivoPiezas} motivoCustom={motivoPiezasCustom} setMotivoCustom={setMotivoPiezasCustom} />
                <NotaField nota={notaPiezas} setNota={setNotaPiezas} />
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={onClose} disabled={saving}
                    className="flex-1 h-10 rounded-xl border border-[#E8E5E2] text-sm font-semibold text-[#4A4744] hover:bg-[#F0EFEC] transition-colors disabled:opacity-50">
                    Cancelar
                  </button>
                  <button type="submit"
                    disabled={saving || piezasConCambio.length === 0 || !motivoPiezasFinal}
                    className="flex-1 h-10 rounded-xl bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                    {saving ? 'Guardando…' : `Ajustar${piezasConCambio.length > 0 ? ` (${piezasConCambio.length})` : ''}`}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Helpers de motivo ───────────────────────────────────────────────────────

const PIEZA_REGEX = /^\[Pieza:\s*(.+?)\]\s*/

function parseMotivoConPieza(motivo: string): { pieza: string | null; motivo: string } {
  const m = PIEZA_REGEX.exec(motivo)
  if (!m) return { pieza: null, motivo }
  return { pieza: m[1], motivo: motivo.slice(m[0].length) }
}

function MotivoCelda({ motivo }: { motivo: string }) {
  const { pieza, motivo: motivoBase } = parseMotivoConPieza(motivo)
  return (
    <div className="max-w-[160px]">
      {pieza && (
        <span className="inline-block text-[10px] font-mono bg-[#F4ECDB] text-[#780e18] px-1.5 py-0.5 rounded mb-1 truncate max-w-full">
          {pieza}
        </span>
      )}
      <p className="text-sm text-[#2D2B2A] truncate">{motivoBase}</p>
    </div>
  )
}

// ─── Modal detalle ────────────────────────────────────────────────────────────

function AjusteDetalleModal({ row, onClose }: { row: AjusteStockRow; onClose: () => void }) {
  const { pieza, motivo: motivoBase } = parseMotivoConPieza(row.motivo)
  const [codigo, ...alternos] = row.productoCodigos

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(45,43,42,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden border border-[#E8E5E2]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#E8E5E2]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono font-bold text-[15px] text-[#2D2B2A] tracking-[0.05em]">{codigo}</p>
              {alternos.map((c, i) => (
                <p key={i} className="font-mono text-[12px] text-[#7A7571]">{c}</p>
              ))}
              <p className="text-xs text-[#7A7571] mt-0.5 truncate">{row.productoNombre}</p>
            </div>
            <button onClick={onClose} className="text-[#7A7571] hover:text-[#2D2B2A] p-1 rounded-lg hover:bg-[#F0EFEC] shrink-0">
              <i className="ti ti-x text-[18px]" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Delta */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[#F7F7F7] rounded-xl px-4 py-3 text-center border border-[#E8E5E2]">
              <p className="text-[10px] text-[#7A7571] uppercase tracking-wider font-bold mb-1">Anterior</p>
              <p className="text-[26px] font-mono font-black text-[#2D2B2A] leading-none">{row.cantidadAnterior}</p>
            </div>
            <div className="text-[#7A7571]"><i className="ti ti-arrow-right text-[20px]" /></div>
            <div className={clsx('flex-1 rounded-xl px-4 py-3 text-center border-2',
              row.delta > 0 ? 'bg-[#B8DCCA] border-[#3F7A52]/30' : 'bg-[#F5C9C0] border-[#B23A2A]/30'
            )}>
              <p className="text-[10px] text-[#7A7571] uppercase tracking-wider font-bold mb-1">Nuevo</p>
              <p className={clsx('text-[26px] font-mono font-black leading-none', row.delta > 0 ? 'text-[#3F7A52]' : 'text-[#B23A2A]')}>
                {row.cantidadNueva}
              </p>
              <p className={clsx('text-[11px] font-bold mt-1', row.delta > 0 ? 'text-[#3F7A52]' : 'text-[#B23A2A]')}>
                {row.delta > 0 ? `+${row.delta}` : row.delta}
              </p>
            </div>
          </div>

          {/* Motivo */}
          <div>
            <p className="text-[10px] font-semibold text-[#7A7571] uppercase tracking-wider mb-1.5">Motivo</p>
            {pieza && (
              <span className="inline-block text-[11px] font-mono bg-[#F4ECDB] text-[#780e18] px-2 py-0.5 rounded mb-1.5">
                Pieza: {pieza}
              </span>
            )}
            <p className="text-sm text-[#2D2B2A]">{motivoBase}</p>
          </div>

          {/* Nota */}
          {row.nota && (
            <div>
              <p className="text-[10px] font-semibold text-[#7A7571] uppercase tracking-wider mb-1.5">Nota</p>
              <p className="text-sm text-[#2D2B2A] whitespace-pre-wrap">{row.nota}</p>
            </div>
          )}

          {/* Footer: fecha + usuario */}
          <div className="flex items-center justify-between pt-1 border-t border-[#E8E5E2]">
            <div className="flex items-center gap-1.5 text-xs text-[#7A7571]">
              <i className="ti ti-calendar text-[12px]" />
              <span className="font-mono">{row.fecha.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })} {row.fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#7A7571]">
              <i className="ti ti-user text-[12px]" />
              <span>{row.usuarioNombre}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── HistorialTab ─────────────────────────────────────────────────────────────

function fmtFecha(d: Date) {
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
}

function HistorialTab({ refreshKey }: { refreshKey: number }) {
  const [historial, setHistorial] = useState<AjusteStockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const cursors = useRef<(string | null)[]>([null])
  const [search, setSearch] = useState('')
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [detalleRow, setDetalleRow] = useState<AjusteStockRow | null>(null)

  const loadHistorial = useCallback((targetPage: number, size: number, q = '') => {
    setLoading(true)
    const where = q.trim() ? {
      or: [
        { producto: { nombre: { contains: q } } },
        { producto: { codigo: { contains: q } } },
        { motivo: { contains: q } },
      ],
    } : undefined
    gql<{
      ajustesStock: { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: AjusteStockAPI[] }
      marca: { nodes: { id: number; nombre: string }[] }
    }>(
      AJUSTES_HISTORIAL_QUERY,
      { first: size, after: cursors.current[targetPage] ?? null, where, order: [{ fecha: 'DESC' }] },
    )
      .then(res => {
        const { totalCount, pageInfo, nodes } = res.ajustesStock
        setHistorial(nodes.map(backendToAjusteRow))
        setTotal(totalCount)
        setHasNext(pageInfo.hasNextPage)
        cursors.current[targetPage + 1] = pageInfo.endCursor
        setPage(targetPage)
      })
      .catch(() => notify.error('Error cargando historial'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadHistorial(0, pageSize)
  }, [loadHistorial, pageSize])

  useEffect(() => {
    if (refreshKey === 0) return
    cursors.current = [null]
    setPage(0)
    loadHistorial(0, pageSize, search)
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (val: string) => {
    setSearch(val)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      cursors.current = [null]
      loadHistorial(0, pageSize, val)
    }, 350)
  }

  return (
    <div className="bg-white rounded-2xl border border-[#D0CBC4] overflow-hidden">
      <div className="px-5 py-[18px] border-b border-[#D0CBC4] flex flex-wrap justify-between items-center gap-4">
        <h3 className="text-[17px] font-semibold text-[#2D2B2A] tracking-[-0.01em] flex items-center gap-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Historial
          <span className="bg-[#F4ECDB] text-[#780e18] text-xs font-semibold px-2.5 py-0.5 rounded-full">{total}</span>
        </h3>
        <div className="flex items-center gap-2 bg-[#FBFBFA] border border-[#D8D4D0] rounded-lg px-3.5 w-full sm:w-auto sm:min-w-[250px] focus-within:border-[#780e18] transition-colors">
          <i className="ti ti-search text-[#7A7571] text-[13px] shrink-0" />
          <input
            className="flex-1 py-2 bg-transparent text-[13px] text-[#2D2B2A] font-normal placeholder:text-[#7A7571] outline-none border-none"
            placeholder="Buscar por producto, código o motivo…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <HistorialSkeleton />
      ) : historial.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-5">
          <div className="w-12 h-12 rounded-xl bg-white border border-[#E8E5E2] flex items-center justify-center mb-4">
            <i className="ti ti-history text-[#7A7571] text-xl" />
          </div>
          <p className="text-sm font-semibold text-[#2D2B2A] mb-1">Sin registros</p>
          <p className="text-xs text-[#7A7571] font-medium max-w-xs">No hay ajustes de stock registrados aún.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F5F0EB]">
              <tr>
                <th className="px-6 py-3 text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] whitespace-nowrap">Fecha / Por</th>
                <th className="px-4 py-3 text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em]">Producto</th>
                <th className="px-4 py-3 text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] text-center">Delta</th>
                <th className="px-4 py-3 text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] text-center">Ant. → Nuevo</th>
                <th className="px-4 py-3 text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em]">Motivo</th>
                <th className="px-4 py-3 text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] hidden lg:table-cell">Nota</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((r) => {
                const [codigoPrincipal, ...codAlt] = r.productoCodigos
                const codigoDisplay = codigoPrincipal
                return (
                  <tr
                    key={r.id}
                    onClick={() => setDetalleRow(r)}
                    className="border-t border-[#E8E5E2] hover:bg-[#FAF5EE] transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className="text-xs text-[#7A7571] font-mono block">{fmtFecha(r.fecha)}</span>
                      <span className="text-[11px] text-[#4A4744] font-medium mt-0.5 block">{r.usuarioNombre}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-mono font-bold text-[13px] text-[#2D2B2A] tracking-[0.05em] truncate max-w-[200px]">{codigoDisplay}</p>
                      {codAlt.map((c, i) => (
                        <p key={i} className="font-mono text-[11px] text-[#7A7571] truncate max-w-[200px]">{c}</p>
                      ))}
                      <p className="text-[11px] text-[#7A7571] truncate max-w-[200px] mt-0.5">{r.productoNombre}</p>
                      {r.marca && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#E8D4B8] text-[#780e18] mt-1">
                          <span className="w-1 h-1 rounded-full bg-[#780e18] shrink-0" />
                          {r.marca}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={clsx(
                        'font-mono font-bold text-sm px-2.5 py-0.5 rounded-full',
                        r.delta > 0 ? 'text-[#3F7A52] bg-[#B8DCCA]' : 'text-[#B23A2A] bg-[#F5C9C0]'
                      )}>
                        {r.delta > 0 ? `+${r.delta}` : r.delta}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-mono text-sm text-[#4A4744]">
                        {r.cantidadAnterior}
                        <span className="mx-1.5 text-[#7A7571]">→</span>
                        {r.cantidadNueva}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <MotivoCelda motivo={r.motivo} />
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-[#7A7571] truncate max-w-[120px] block">{r.nota || '—'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="px-5 py-3.5 bg-[#F5F0EB] border-t border-[#D0CBC4]">
          <ServerPagination
            totalCount={total}
            page={page}
            pageSize={pageSize}
            hasNextPage={hasNext}
            onPage={p => { cursors.current = cursors.current.slice(0, p + 1); loadHistorial(p, pageSize, search) }}
            onPageSize={size => { cursors.current = [null]; setPageSize(size); loadHistorial(0, size, search) }}
          />
        </div>
      )}

      {detalleRow && <AjusteDetalleModal row={detalleRow} onClose={() => setDetalleRow(null)} />}
    </div>
  )
}

// ─── AjustesPage ─────────────────────────────────────────────────────────────

export function AjustesPage() {
  const [activeTab, setActiveTab] = useState<'ajustes' | 'historial'>('ajustes')
  const [historialTouched, setHistorialTouched] = useState(false)
  const [historialRefreshKey, setHistorialRefreshKey] = useState(0)
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'bajo' | 'kits'>('todos')
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const cursors = useRef<(string | null)[]>([null])
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [galleryProducto, setGalleryProducto] = useState<Producto | null>(null)

  const loadProductos = useCallback((targetPage: number, size: number, q = '', currentFiltro: 'todos' | 'bajo' | 'kits' = 'todos') => {
    setLoading(true)

    if (q.trim()) {
      api.get<ProductoAPISimple[]>(`/Producto/buscar-lista?q=${encodeURIComponent(q.trim())}`)
        .then(res => {
          let resultados = (res ?? []).map(backendToProductoSimple)
          if (currentFiltro === 'kits') resultados = resultados.filter(p => p.es_kit)
          setProductos(resultados)
          setTotalCount(resultados.length)
          setHasNextPage(false)
        })
        .catch(() => notify.error('Error buscando productos'))
        .finally(() => setLoading(false))
      return
    }

    const conditions: object[] = [{ activo: { eq: true } }]
    if (currentFiltro === 'kits') conditions.push({ esKit: { eq: true } })
    const where = conditions.length === 1 ? conditions[0] : { and: conditions }
    gql<{
      productos: { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ProductoAPI[] }
      marca: { nodes: { id: number; nombre: string }[] }
    }>(
      PRODUCTOS_CON_MARCAS_QUERY,
      { first: size, after: cursors.current[targetPage] ?? null, where, order: { fechaActualizacion: 'DESC' } },
    )
      .then(res => {
        const { totalCount, pageInfo, nodes } = res.productos
        setProductos(nodes.map(backendToProductoSimple))
        setTotalCount(totalCount)
        setHasNextPage(pageInfo.hasNextPage)
        cursors.current[targetPage + 1] = pageInfo.endCursor
        setPage(targetPage)
      })
      .catch(() => notify.error('Error cargando productos'))
      .finally(() => setLoading(false))
  }, [])

  const handleSearch = (val: string) => {
    setSearch(val)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      cursors.current = [null]
      loadProductos(0, pageSize, val, filtro)
    }, 350)
  }

  const handleFiltro = (f: typeof filtro) => {
    setFiltro(f)
    cursors.current = [null]
    loadProductos(0, pageSize, search, f)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadProductos(0, pageSize)
  }, [loadProductos])

  const displayed = useMemo(
    () => filtro === 'bajo' ? productos.filter(p => p.stock <= p.stock_minimo) : productos,
    [productos, filtro],
  )

  const handleSuccess = (id: string, nuevoStock: number) => {
    if (nuevoStock >= 0) {
      setProductos(prev => prev.map(p => p.id === id ? { ...p, stock: nuevoStock } : p))
    } else {
      loadProductos(page, pageSize, search, filtro)
    }
    setHistorialRefreshKey(k => k + 1)
  }

  const kpi = useMemo(() => ({
    total: totalCount,
    stockBajo: productos.filter(p => p.stock <= p.stock_minimo).length,
    kits: productos.filter(p => p.es_kit).length,
  }), [productos, totalCount])

  return (
    <MainLayout>
      <div className="bg-[#F7F7F7] min-h-screen">

        <PageTopBar subsection="Inventario" title="Ajustes" />

        <div className="px-7 py-6 max-w-[1400px] mx-auto">

          {/* ── Page Header ── */}
          <div className="mb-6">
            <h2 className="font-semibold text-[30px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Ajustes
            </h2>
            <p className="text-[13.5px] text-[#7A7571] mt-1.5">
              Corrección manual de stock por conteo físico o mermas
            </p>
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 bg-white border border-[#E8E5E2] rounded-xl p-1 w-fit mb-6">
            {(['ajustes', 'historial'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setActiveTab(t); if (t === 'historial') setHistorialTouched(true) }}
                className={clsx(
                  'px-5 py-2 rounded-lg text-sm font-semibold transition-all',
                  activeTab === t
                    ? 'bg-[#780e18] text-white shadow-sm'
                    : 'text-[#7A7571] hover:text-[#2D2B2A] hover:bg-[#F0EFEC]'
                )}
              >
                {t === 'ajustes' ? 'Ajustes' : 'Historial'}
              </button>
            ))}
          </div>

          {historialTouched && (
            <div className={activeTab !== 'historial' ? 'hidden' : ''}>
              <HistorialTab refreshKey={historialRefreshKey} />
            </div>
          )}

          {activeTab === 'ajustes' && (
            <>
              {/* ── KPI Cards ── */}
              {loading ? <KpiSkeleton /> : <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[22px]">

                <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#780e18] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#780e18] opacity-[0.08]" />
                  <div className="flex items-start justify-between mb-[14px]">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#780e18] to-[#D4A333] flex items-center justify-center shrink-0">
                      <i className="ti ti-package text-white text-[16px]" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#B8DCCA] text-[#1E5C38]">
                      <i className="ti ti-circle-check text-[10px]" />
                      catálogo
                    </span>
                  </div>
                  <div className="font-semibold text-[32px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {kpi.total.toLocaleString('es-BO')}
                  </div>
                  <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Total productos</div>
                </div>

                <div className={clsx(
                  'rounded-xl border border-l-4 p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200',
                  kpi.stockBajo > 0 ? 'bg-[#FDF1EE] border-[#D0CBC4] border-l-[#B23A2A]' : 'bg-white border-[#D0CBC4] border-l-[#3F7A52]'
                )}>
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#B23A2A] opacity-[0.08]" />
                  <div className="flex items-start justify-between mb-[14px]">
                    <div className={clsx(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                      kpi.stockBajo > 0 ? 'bg-gradient-to-br from-[#B23A2A] to-[#E07060]' : 'bg-gradient-to-br from-[#3F7A52] to-[#6BAF80]'
                    )}>
                      <i className={clsx('text-white text-[16px]', kpi.stockBajo > 0 ? 'ti ti-alert-triangle' : 'ti ti-circle-check')} />
                    </div>
                    <span className={clsx(
                      'inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full',
                      kpi.stockBajo > 0 ? 'bg-[#F5C9C0] text-[#8A1E12]' : 'bg-[#B8DCCA] text-[#1E5C38]'
                    )}>
                      {kpi.stockBajo > 0 ? 'Requiere acción' : 'Todo bien'}
                    </span>
                  </div>
                  <div className={clsx('font-semibold text-[32px] leading-none tracking-[-0.025em]', kpi.stockBajo > 0 ? 'text-[#B23A2A]' : 'text-[#2D2B2A]')} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {kpi.stockBajo}
                  </div>
                  <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Stock crítico</div>
                </div>

                <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#3F7A52] p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#3F7A52] opacity-[0.08]" />
                  <div className="flex items-start justify-between mb-[14px]">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3F7A52] to-[#6BAF80] flex items-center justify-center shrink-0">
                      <i className="ti ti-stack text-white text-[16px]" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F5E0A8] text-[#7A5200]">
                      <i className="ti ti-layers-linked text-[10px]" />
                      kits
                    </span>
                  </div>
                  <div className="font-semibold text-[32px] text-[#2D2B2A] leading-none tracking-[-0.025em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {kpi.kits.toLocaleString('es-BO')}
                  </div>
                  <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">Kits en inventario</div>
                </div>

              </div>}

              {/* ── Table Container ── */}
              <div className="bg-white rounded-xl border border-[#D0CBC4] overflow-hidden">

                {/* Toolbar */}
                <div className="px-[22px] py-[18px] border-b border-[#D0CBC4] flex flex-wrap justify-between items-center gap-4">
                  <h3 className="text-[17px] font-semibold text-[#2D2B2A] tracking-[-0.01em] flex items-center gap-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Productos
                    <span className="bg-[#F4ECDB] text-[#780e18] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {totalCount}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    <div className="flex items-center gap-2 bg-[#FBFBFA] border border-[#D8D4D0] rounded-lg px-3.5 w-full sm:w-auto sm:min-w-[250px] focus-within:border-[#780e18] transition-colors">
                      <i className="ti ti-search text-[#7A7571] text-[13px] shrink-0" />
                      <input
                        className="flex-1 py-2 bg-transparent text-[13px] text-[#2D2B2A] font-normal placeholder:text-[#7A7571] outline-none border-none"
                        placeholder="Buscar por nombre, código, marca o código de pieza (P1-…)"
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-1">
                      {(['todos', 'bajo', 'kits'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => handleFiltro(f)}
                          className={clsx('px-3 h-9 rounded-lg text-xs font-semibold border transition-all',
                            filtro === f
                              ? 'bg-[#780e18] text-white border-[#780e18]'
                              : 'bg-white text-[#4A4744] border-[#E8E5E2] hover:bg-[#F0EFEC]'
                          )}
                        >
                          {f === 'todos' ? 'Todos' : f === 'bajo' ? `Bajo mínimo${kpi.stockBajo > 0 ? ` (${kpi.stockBajo})` : ''}` : 'Kits'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {loading ? (
                  <>
                    <div className="hidden md:block"><TableSkeleton /></div>
                    <div className="md:hidden"><MobileSkeletonRows /></div>
                  </>
                ) : displayed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
                    <div className="w-12 h-12 rounded-lg bg-white border border-[#E8E5E2] flex items-center justify-center mb-4">
                      <i className="ti ti-package text-[#7A7571] text-xl" />
                    </div>
                    <p className="text-sm font-semibold text-[#2D2B2A] mb-1">Sin productos</p>
                    <p className="text-xs text-[#7A7571] font-medium max-w-xs">
                      No hay productos que coincidan con la búsqueda o filtro.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* ── Desktop table ── */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#F5F0EB]">
                          <tr>
                            <th className="px-6 py-[11px] text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] border-b border-[#D0CBC4]">Producto</th>
                            <th className="px-4 py-[11px] text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] border-b border-[#D0CBC4]">Marca</th>
                            <th className="px-4 py-[11px] text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] border-b border-[#D0CBC4] hidden lg:table-cell">Ubicación</th>
                            <th className="px-4 py-[11px] text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] border-b border-[#D0CBC4] min-w-[200px]">Categoría</th>
                            <th className="px-4 py-[11px] text-[10.5px] font-semibold text-[#7A7571] uppercase tracking-[0.12em] border-b border-[#D0CBC4] text-right">Stock</th>
                            <th className="w-28 px-4 border-b border-[#D0CBC4]" />
                          </tr>
                        </thead>
                        <tbody>
                          {displayed.map((p) => {
                            const bajo = p.stock <= p.stock_minimo
                            const codigoDisplay = p.codigo_universal
                            return (
                              <tr
                                key={p.id}
                                className="border-t border-[#E8E5E2] even:bg-white odd:bg-[#FAF5EE] hover:bg-[#F5F0EB] transition-colors cursor-pointer"
                                onClick={() => setSeleccionado(p)}
                              >
                                <td className={clsx('px-6 py-3.5 border-r border-[#E8E5E2]', p.es_kit && 'border-l-[3px] border-l-[#D4A333]')}>
                                  <div className="flex items-center gap-3">
                                    <ProductThumb
                                      src={p.imagen}
                                      nombre={p.nombre}
                                      onClick={() => setGalleryProducto(p)}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-mono font-bold text-[#2D2B2A] truncate max-w-[220px] tracking-[0.05em]">{codigoDisplay}</p>
                                  {(p.codigos_alternativos?.filter(Boolean) ?? []).length > 0 && (
                                    <div className="flex flex-col mt-0.5">
                                      {p.codigos_alternativos!.filter(Boolean).map((c, i) => (
                                        <span key={i} className="text-[12px] font-mono text-[#7A7571]">{c}</span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5">
                                    <span className="text-[11px] text-[#7A7571] truncate max-w-[200px]">{p.nombre}</span>
                                    {p.es_kit && (
                                      <span className="text-[9px] bg-[#F4ECDB] text-[#780e18] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">Kit</span>
                                    )}
                                  </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 border-r border-[#E8E5E2]">
                                  {p.marca ? (
                                    <div className="inline-flex items-center gap-1.5 bg-[#E8D4B8] text-[#780e18] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#780e18] shrink-0" />
                                      {p.marca}
                                    </div>
                                  ) : (
                                    <span className="text-[12px] text-[#7A7571]">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 hidden lg:table-cell border-r border-[#E8E5E2]">
                                  <div className="text-[11px] text-[#7A7571] font-medium flex items-center gap-1">
                                    <i className="ti ti-map-pin text-[11px]" />
                                    <span>{[p.almacen, p.estante, p.fila, p.columna].filter(Boolean).join(' / ') || '—'}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 border-r border-[#E8E5E2] min-w-[200px] align-top">
                                  {(() => {
                                    const cat = p.categoria?.trim()
                                    if (!cat) return <span className="text-[12px] text-[#A09A95] font-normal italic">— sin categoría —</span>
                                    const truncated = cat.length > 100 ? cat.slice(0, 100) + '...' : cat
                                    return (
                                      <span
                                        className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F0EFEC] text-[#4A4744] max-w-full whitespace-normal break-words align-top"
                                        title={cat}
                                      >
                                        {truncated}
                                      </span>
                                    )
                                  })()}
                                </td>
                                <td className="px-4 py-3.5 text-right border-r border-[#E8E5E2]">
                                  <span className={clsx('font-mono font-black text-[22px] leading-none tabular-nums',
                                    p.stock === 0 ? 'text-[#B23A2A]' : bajo ? 'text-[#B47A1F]' : 'text-[#2D2B2A]')}>
                                    {p.stock}
                                  </span>
                                  {bajo && (
                                    <p className="text-[10px] text-[#B47A1F] font-bold mt-0.5">bajo mínimo</p>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <button
                                    onClick={e => { e.stopPropagation(); setSeleccionado(p) }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#E8E5E2] text-[#4A4744] hover:bg-[#F4ECDB] hover:text-[#780e18] hover:border-[#780e18] transition-all"
                                  >
                                    Ajustar
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* ── Mobile list ── */}
                    <div className="md:hidden">
                      {displayed.map(p => {
                        const bajo = p.stock <= p.stock_minimo
                        const codigoDisplay = p.codigo_universal
                        return (
                          <div
                            key={p.id}
                            onClick={() => setSeleccionado(p)}
                            className={clsx(
                              'flex items-center gap-3 px-4 py-3 border-b border-[#E8E5E2] last:border-0 active:bg-[#FBFAF7] transition-colors cursor-pointer',
                              p.es_kit && 'border-l-[3px] border-l-[#D4A333]',
                            )}
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          >
                            <ProductThumb
                              src={p.imagen}
                              nombre={p.nombre}
                              onClick={() => setGalleryProducto(p)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-mono font-bold text-[13px] text-[#2D2B2A] truncate tracking-[0.05em]">{codigoDisplay}</p>
                              {(p.codigos_alternativos?.filter(Boolean) ?? []).length > 0 && (
                                <div className="flex flex-col mt-0.5">
                                  {p.codigos_alternativos!.filter(Boolean).map((c, i) => (
                                    <span key={i} className="text-[11px] font-mono text-[#7A7571]">{c}</span>
                                  ))}
                                </div>
                              )}
                              <p className="text-[11px] text-[#7A7571] truncate mt-0.5">
                                {p.nombre}{p.marca ? ` · ${p.marca}` : ''}
                              </p>
                              {p.categoria && (
                                <span
                                  className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0EFEC] text-[#4A4744] mt-1 max-w-full truncate"
                                  title={p.categoria}
                                >
                                  {p.categoria}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={clsx('font-mono font-black text-[20px] leading-none tabular-nums',
                                p.stock === 0 ? 'text-[#B23A2A]' : bajo ? 'text-[#B47A1F]' : 'text-[#2D2B2A]')}>
                                {p.stock}
                              </span>
                              {bajo
                                ? <span className="text-[10px] text-[#B47A1F] font-bold">bajo mín.</span>
                                : <span className="text-[10px] text-[#7A7571] font-semibold">mín. {p.stock_minimo}</span>
                              }
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); setSeleccionado(p) }}
                              className="ml-1 shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[#E8E5E2] text-[#4A4744] hover:bg-[#F4ECDB] hover:text-[#780e18] hover:border-[#780e18] transition-all"
                            >
                              Ajustar
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {!loading && (
                  <div className="px-[22px] py-[14px] bg-[#F5F0EB] border-t border-[#D0CBC4]">
                    <ServerPagination
                      totalCount={filtro === 'bajo' ? displayed.length : totalCount}
                      page={page}
                      pageSize={pageSize}
                      hasNextPage={filtro === 'bajo' ? false : hasNextPage}
                      loading={loading}
                      onPage={p => { cursors.current = cursors.current.slice(0, p + 1); loadProductos(p, pageSize, search, filtro) }}
                      onPageSize={size => { cursors.current = [null]; setPageSize(size); loadProductos(0, size, search, filtro) }}
                    />
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {seleccionado && (
        <AjusteModal
          producto={seleccionado}
          onClose={() => setSeleccionado(null)}
          onSuccess={handleSuccess}
        />
      )}

      <GalleryViewerModal
        producto={galleryProducto}
        onClose={() => setGalleryProducto(null)}
      />
    </MainLayout>
  )
}
