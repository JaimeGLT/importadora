import { useState, useRef, useEffect, useMemo } from 'react'
import type { Producto, PiezaKit } from '@/types'
import type { DtoPiezaKit, PieceOp } from '@/lib/queries/inventario.queries'
import { PRODUCTOS_QUERY, backendToProductoSimple } from '@/lib/queries/inventario.queries'
import { gql } from '@/lib/graphql'
import { clsx } from 'clsx'

interface KitPartsSectionProps {
  productoId?: string
  wasKit: boolean
  piezasFromBackend?: PiezaKit[]
  localPieces: DtoPiezaKit[]
  onLocalPiecesChange: (p: DtoPiezaKit[]) => void
  pieceOps: PieceOp[]
  onPieceOpsChange: (ops: PieceOp[]) => void
  /** Código del producto kit padre (ej. "ABC123"). Se usa para previsualizar el código autogenerado de la próxima pieza con formato "P{N}-{codigo}". */
  kitCodigo?: string
  /** Callback al pulsar el botón imprimir de una pieza. Si no se provee, no se muestra el botón. */
  onImprimirPieza?: (part: DisplayPart) => void
}

type DisplayPart = {
  key: string
  nombre: string
  cantidad: number
  stock?: number
  piezaId?: number
  addOpIdx?: number
  localIdx?: number
  codigoPieza?: string
}

export type { DisplayPart }

export function KitPartsSection({
  productoId,
  wasKit,
  piezasFromBackend,
  localPieces,
  onLocalPiecesChange,
  pieceOps,
  onPieceOpsChange,
  kitCodigo,
  onImprimirPieza,
}: KitPartsSectionProps) {
  const [mode, setMode] = useState<'idle' | 'search' | 'create'>('idle')
  const [q, setQ] = useState('')
  const [newNombre, setNewNombre] = useState('')
  const [newCantidad, setNewCantidad] = useState(1)
  const [pending, setPending] = useState<{ nombre: string } | null>(null)
  const [pendingQty, setPendingQty] = useState(1)
  const [searchResults, setSearchResults] = useState<Producto[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!q.trim()) { setSearchResults([]); setSearchError(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearching(true)
      setSearchError(null)
      gql<{ productos: { nodes: Parameters<typeof backendToProductoSimple>[0][] } }>(
        PRODUCTOS_QUERY,
        { first: 10, where: { or: [{ codigo: { contains: q } }, { codigoAux: { contains: q } }, { codigoAux2: { contains: q } }, { nombre: { contains: q } }, { marca: { nombre: { contains: q } } }, { descripcion: { contains: q } }] } },
      )
        .then(res => setSearchResults(res.productos.nodes.map(backendToProductoSimple)))
        .catch((err: unknown) => {
          console.error('[KitSearch]', err)
          setSearchError(err instanceof Error ? err.message : 'Error al buscar')
        })
        .finally(() => setSearching(false))
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q])

  // ── Compute display list ─────────────────────────────────────────────────────

  const displayParts: DisplayPart[] = (() => {
    if (wasKit) {
      const deletedIds = new Set(
        pieceOps.filter((op): op is Extract<PieceOp, { type: 'delete' }> => op.type === 'delete').map((op) => op.piezaId)
      )
      const updatedMap = new Map(
        pieceOps.filter((op): op is Extract<PieceOp, { type: 'update' }> => op.type === 'update').map((op) => [op.piezaId, op.data])
      )
      const addOps = pieceOps.filter((op): op is Extract<PieceOp, { type: 'add' }> => op.type === 'add')

      const backendRows: DisplayPart[] = (piezasFromBackend ?? [])
        .filter((p) => !deletedIds.has(p.id))
        .map((p) => ({
          key: `b-${p.id}`,
          nombre: p.nombre,
          cantidad: updatedMap.get(p.id)?.cantidadPorKit ?? p.cantidad_por_kit,
          stock: p.stock_actual,
          piezaId: p.id,
          codigoPieza: p.codigo_pieza,
        }))

      const addRows: DisplayPart[] = addOps.map((op, i) => ({
        key: `add-${i}`,
        nombre: op.data.nombre,
        cantidad: op.data.cantidadPorKit,
        addOpIdx: i,
      }))

      return [...backendRows, ...addRows]
    } else {
      return localPieces.map((p, i) => ({
        key: `local-${i}`,
        nombre: p.nombre,
        cantidad: p.cantidadPorKit,
        localIdx: i,
      }))
    }
  })()

  // ── Próximo número de orden + preview del código autogenerado ────────────────
  // El backend asigna el orden = max(Orden) + 1 (preserva huecos al eliminar).
  // Acá calculamos el equivalente en cliente para mostrarle al usuario
  // qué código se generará antes de confirmar.
  const nextOrden = useMemo(() => {
    const ordenesBackend = (piezasFromBackend ?? []).map((p) => p.orden ?? 0)
    const max = ordenesBackend.length ? Math.max(...ordenesBackend) : 0
    return max + 1
  }, [piezasFromBackend])

  const previewCodigoPieza = (orden: number): string => {
    const codigo = kitCodigo || '???'
    return `P${orden}-${codigo}`
  }

  // ── Quantity stepper ─────────────────────────────────────────────────────────

  const handleQty = (part: DisplayPart, qty: number) => {
    const safe = Math.max(1, qty)
    if (part.piezaId !== undefined) {
      const filtered = pieceOps.filter((op) => !(op.type === 'update' && op.piezaId === part.piezaId))
      onPieceOpsChange([...filtered, { type: 'update', piezaId: part.piezaId, data: { cantidadPorKit: safe } }])
    } else if (part.addOpIdx !== undefined) {
      let addCount = 0
      onPieceOpsChange(pieceOps.map((op) => {
        if (op.type !== 'add') return op
        const i = addCount++
        return i === part.addOpIdx ? { ...op, data: { ...op.data, cantidadPorKit: safe } } : op
      }))
    } else if (part.localIdx !== undefined) {
      onLocalPiecesChange(localPieces.map((p, i) => i === part.localIdx ? { ...p, cantidadPorKit: safe } : p))
    }
  }

  // ── Remove ───────────────────────────────────────────────────────────────────

  const handleRemove = (part: DisplayPart) => {
    if (part.piezaId !== undefined) {
      const filtered = pieceOps.filter((op) => !(op.type === 'update' && op.piezaId === part.piezaId))
      onPieceOpsChange([...filtered, { type: 'delete', piezaId: part.piezaId }])
    } else if (part.addOpIdx !== undefined) {
      let addCount = 0
      onPieceOpsChange(pieceOps.filter((op) => {
        if (op.type !== 'add') return true
        return addCount++ !== part.addOpIdx
      }))
    } else if (part.localIdx !== undefined) {
      onLocalPiecesChange(localPieces.filter((_, i) => i !== part.localIdx))
    }
  }

  // ── Add piece ────────────────────────────────────────────────────────────────

  const addPiece = (nombre: string, cantidad = 1) => {
    const dto: DtoPiezaKit = { nombre, cantidadPorKit: Math.max(1, cantidad) }
    if (wasKit) {
      onPieceOpsChange([...pieceOps, { type: 'add', data: dto }])
    } else {
      onLocalPiecesChange([...localPieces, dto])
    }
    setQ('')
    setPending(null)
    setPendingQty(1)
    setMode('idle')
  }

  // ── Search results ───────────────────────────────────────────────────────────

  const filteredResults = searchResults.filter(
    (p) => !p.es_kit && p.id !== productoId
  )

  const resetCreate = () => { setMode('idle'); setNewNombre(''); setNewCantidad(1) }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Parts list */}
      {displayParts.length > 0 ? (
        <div className="rounded-[12px] border border-hair overflow-hidden divide-y divide-hair">
          {displayParts.map((part) => (
            <div key={part.key} className={clsx(
              'flex flex-wrap gap-2 px-3 sm:px-4 py-3 bg-white hover:bg-cream/40 transition-colors',
              part.addOpIdx !== undefined && 'bg-navy/[0.02]',
            )}>
              <div className={clsx('w-[3px] h-auto min-h-[60px] rounded-full shrink-0 self-stretch', part.addOpIdx !== undefined ? 'bg-navy/50' : 'bg-navy/25')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink leading-tight flex items-center gap-1.5 flex-wrap">
                      {part.nombre}
                      {part.addOpIdx !== undefined && (
                        <span className="text-[9px] font-semibold px-1 py-px rounded bg-navy/10 text-navy uppercase tracking-wider">nuevo</span>
                      )}
                    </div>
                    {part.codigoPieza && (
                      <div className="font-mono text-[10.5px] text-muted-2 mt-0.5 tracking-[0.04em]">
                        {part.codigoPieza}
                      </div>
                    )}
                    {part.addOpIdx !== undefined && (
                      <div className="font-mono text-[10.5px] text-muted-2 mt-0.5 tracking-[0.04em]">
                        Código a generar: <span className="font-semibold text-ink-2">{previewCodigoPieza(nextOrden + part.addOpIdx)}</span>
                      </div>
                    )}
                  </div>
                  {part.stock !== undefined && (
                    <div className={clsx(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 hidden sm:block',
                      part.stock > 0 ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#FEE2E2] text-terra',
                    )}>
                      {part.stock}u
                    </div>
                  )}
                  <button type="button" onClick={() => handleRemove(part)}
                    className="p-1.5 rounded-[6px] text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  {onImprimirPieza && (
                    <button
                      type="button"
                      onClick={() => onImprimirPieza(part)}
                      disabled={!part.codigoPieza}
                      title={part.codigoPieza ? 'Imprimir etiqueta de la pieza' : 'Guarda el kit para generar el código de la pieza'}
                      className="p-1.5 rounded-[6px] text-muted-2 hover:text-navy hover:bg-navy/5 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-2"
                    >
                      <i className="ti ti-printer text-[15px]" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-2 pl-2">
                  <button type="button" onClick={() => handleQty(part, part.cantidad - 1)}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-l-[6px] border border-hair bg-cream hover:bg-cream-2 text-ink-2 text-[15px] flex items-center justify-center transition-colors border-r-0">
                    −
                  </button>
                  <input
                    type="number" min={1} value={part.cantidad}
                    onChange={(e) => handleQty(part, Number(e.target.value))}
                    className="w-8 sm:w-10 h-6 sm:h-7 text-center text-[12px] font-semibold border-y border-hair bg-cream text-ink focus:outline-none focus:border-terra"
                  />
                  <button type="button" onClick={() => handleQty(part, part.cantidad + 1)}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-r-[6px] border border-hair bg-cream hover:bg-cream-2 text-ink-2 text-[15px] flex items-center justify-center transition-colors border-l-0">
                    +
                  </button>
                  <span className="text-[10px] text-muted-2 ml-1">/ kit</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center rounded-[12px] border border-dashed border-hair bg-cream/50">
          <div className="text-[12px] font-medium text-muted-2">Sin partes definidas</div>
          <div className="text-[11px] text-muted-2 mt-1">Agrega las piezas que componen este kit</div>
        </div>
      )}

      {/* Add controls */}
      {mode === 'idle' && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setMode('search')}
            className="h-8 px-3 rounded-[8px] border border-hair bg-white text-[12px] font-medium text-ink-2 hover:bg-cream-2 hover:border-hair-2 transition-colors flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            Buscar producto
          </button>
          <button type="button" onClick={() => setMode('create')}
            className="h-8 px-3 rounded-[8px] border border-hair bg-white text-[12px] font-medium text-ink-2 hover:bg-cream-2 hover:border-hair-2 transition-colors flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/></svg>
            Nueva pieza
          </button>
        </div>
      )}

      {mode === 'search' && (
        <div className="rounded-[12px] border border-hair bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-hair bg-cream/50">
            <svg className="h-3.5 w-3.5 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setPending(null) }}
              placeholder="Código o nombre del producto…"
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-ink placeholder:text-muted-2" />
            <button type="button" onClick={() => { setMode('idle'); setQ(''); setPending(null) }}
              className="p-1 rounded-[6px] text-muted hover:text-ink transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="max-h-[180px] overflow-y-auto">
            {!q.trim() ? (
              <div className="px-4 py-3 text-[12px] text-muted-2">Escribe para buscar…</div>
            ) : searching ? (
              <div className="px-4 py-3 text-[12px] text-muted-2">Buscando…</div>
            ) : searchError ? (
              <div className="px-4 py-3 text-[12px] text-red-500">Error: {searchError}</div>
            ) : filteredResults.length === 0 ? (
              <div className="px-4 py-3 text-[12px] text-muted-2">Sin resultados — usa "Nueva pieza".</div>
            ) : (
              filteredResults.map((p) => (
                <button key={p.id} type="button"
                  onClick={() => { setPending({ nombre: p.nombre ?? p.codigo_universal }); setPendingQty(1) }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-hair/50 last:border-0 transition-colors',
                    pending?.nombre === p.nombre ? 'bg-navy/[0.06]' : 'hover:bg-cream-2',
                  )}>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-[12px] text-ink tracking-[0.05em]">{p.codigo_universal}</div>
                    <div className="text-[11px] text-muted-2 truncate">{p.nombre}</div>
                  </div>
                  <div className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                    p.stock > 0 ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#FEE2E2] text-terra')}>
                    {p.stock}u
                  </div>
                </button>
              ))
            )}
          </div>
          {/* Confirm with qty when a product is selected */}
          {pending && (
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-t border-hair bg-cream/40 flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-ink-2 truncate block">{pending.nombre}</span>
                <span className="text-[10px] text-muted-2">Cantidad por kit</span>
                <div className="font-mono text-[10.5px] text-muted-2 mt-1 tracking-[0.04em]">
                  Código a generar: <span className="font-semibold text-ink-2">{previewCodigoPieza(nextOrden)}</span>
                </div>
              </div>
              <div className="flex items-center shrink-0">
                <button type="button" onClick={() => setPendingQty((v) => Math.max(1, v - 1))}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-l-[6px] border border-hair bg-white hover:bg-cream-2 text-ink-2 text-[15px] flex items-center justify-center border-r-0">−</button>
                <input type="number" min={1} value={pendingQty}
                  onChange={(e) => setPendingQty(Math.max(1, Number(e.target.value)))}
                  className="w-8 sm:w-10 h-6 sm:h-7 text-center text-[12px] font-semibold border-y border-hair bg-white text-ink focus:outline-none focus:border-terra" />
                <button type="button" onClick={() => setPendingQty((v) => v + 1)}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-r-[6px] border border-hair bg-white hover:bg-cream-2 text-ink-2 text-[15px] flex items-center justify-center border-l-0">+</button>
              </div>
              <button type="button"
                onClick={() => addPiece(pending.nombre, pendingQty)}
                className="h-7 px-3 rounded-[7px] bg-terra text-white text-[12px] font-semibold hover:bg-terra-deep transition-colors shrink-0">
                Agregar
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'create' && (
        <div className="rounded-[12px] border border-hair bg-cream/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-ink-2">Nueva pieza</p>
            <button type="button" onClick={resetCreate}
              className="p-1 rounded-[6px] text-muted hover:text-ink transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <input value={newNombre} onChange={(e) => setNewNombre(e.target.value)}
              placeholder="Nombre *" autoFocus
              onKeyDown={(e) => e.key === 'Enter' && newNombre.trim() && (addPiece(newNombre, newCantidad), setNewNombre(''), setNewCantidad(1))}
              className="h-[38px] px-3 text-[13px] border border-hair rounded-[8px] bg-white text-ink focus:outline-none focus:border-terra placeholder:text-muted-2" />
            <div className="flex items-center gap-1.5">
              <input type="number" min={1} value={newCantidad}
                onChange={(e) => setNewCantidad(Math.max(1, Number(e.target.value)))}
                className="h-[38px] w-full px-3 text-[13px] text-center border border-hair rounded-[8px] bg-white text-ink focus:outline-none focus:border-terra" />
              <span className="text-[10px] text-muted-2 whitespace-nowrap">/ kit</span>
            </div>
          </div>
          <div className="font-mono text-[10.5px] text-muted-2 tracking-[0.04em]">
            Código a generar: <span className="font-semibold text-ink-2">{previewCodigoPieza(nextOrden)}</span>
          </div>
          <div className="flex justify-end">
            <button type="button"
              onClick={() => { if (newNombre.trim()) { addPiece(newNombre, newCantidad); setNewNombre(''); setNewCantidad(1) } }}
              disabled={!newNombre.trim()}
              className="w-full sm:w-auto h-[34px] px-4 rounded-[8px] bg-terra text-white text-[12.5px] font-semibold hover:bg-terra-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Agregar pieza
            </button>
          </div>
        </div>
      )}

      {wasKit && pieceOps.length > 0 && (
        <p className="text-[10.5px] text-muted-2">
          {pieceOps.filter(op => op.type === 'add').length > 0 && `${pieceOps.filter(op => op.type === 'add').length} pieza(s) nueva(s) · `}
          {pieceOps.filter(op => op.type === 'delete').length > 0 && `${pieceOps.filter(op => op.type === 'delete').length} a eliminar · `}
          {pieceOps.filter(op => op.type === 'update').length > 0 && `${pieceOps.filter(op => op.type === 'update').length} cantidad(es) modificada(s) · `}
          Se aplicarán al guardar · códigos autogenerados por el servidor.
        </p>
      )}
    </div>
  )
}
