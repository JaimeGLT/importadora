import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { MainLayout } from '@/components/layout/MainLayout'
import { PageTopBar } from '@/components/layout/PageTopBar'
import { Button, Input, Select, Modal } from '@/components/ui'
import { notify } from '@/lib/notify'
import { gql } from '@/lib/graphql'
import { api } from '@/lib/api'
import { MI_CAJA_QUERY, backendToCaja, type CajaAPI } from '@/lib/queries/caja.queries'
import type { Caja, MovimientoCaja, CierreCajaResponse } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })

const CATEGORIA_LABELS: Record<MovimientoCaja['categoria'], string> = {
  Ventas: 'Ventas',
  OtroIngreso: 'Otro ingreso',
  Compra: 'Compra',
  GastoOperativo: 'Gasto operativo',
  OtroEgreso: 'Otro egreso',
  Transferencia: 'Transferencia',
  CobranzaCredito: 'Cobranza de crédito',
}

const TIPO_PAGO_CONFIG: Record<MovimientoCaja['tipoPago'], { label: string; style: string }> = {
  Efectivo: { label: 'Efectivo', style: 'bg-[#F0EFEC] text-[#4A4744]' },
  QR:       { label: 'QR',       style: 'bg-[#F4ECDB] text-[#780e18]' },
  Tarjeta:  { label: 'Tarjeta',  style: 'bg-[#E8D4B8] text-[#780e18]' },
}

type TipoBackend = 'ingreso' | 'egreso'

// ─── Metric card ──────────────────────────────────────────────────────────────

interface CajaMetricCardProps {
  label: string
  value: string
  accentColor: string
  badgeText: string
  badgeBg: string
  badgeColor: string
  highlightColor?: string
}

function CajaMetricCard({
  label, value, accentColor, badgeText, badgeBg, badgeColor, highlightColor,
}: CajaMetricCardProps) {
  return (
    <div
      className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 p-[18px] relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
      style={{ borderLeftColor: accentColor }}
    >
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-[0.06]" style={{ background: accentColor }} />
      <div className="flex items-start justify-between mb-[14px]">
        <div />
        <span
          className="inline-flex items-center text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {badgeText}
        </span>
      </div>
      <div
        className="font-semibold text-[32px] leading-none tracking-[-0.025em]"
        style={{ fontFamily: "'DM Sans', sans-serif", color: highlightColor ?? '#2D2B2A' }}
      >
        {value} <span className="text-sm font-semibold text-[#7A7571]">Bs.</span>
      </div>
      <div className="text-[10.5px] font-medium text-[#7A7571] uppercase tracking-[0.1em] mt-2">{label}</div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-[14px] mb-[22px]">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-xl border border-[#D0CBC4] p-[18px] animate-pulse">
          <div className="flex justify-end mb-[14px]">
            <div className="h-5 w-16 rounded-full bg-[#F0EFEC]" />
          </div>
          <div className="h-8 w-28 rounded bg-[#F0EFEC] mb-2" />
          <div className="h-3 w-20 rounded bg-[#E8E5E2]" />
        </div>
      ))}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PagoBadge({ tipo_pago }: { tipo_pago: MovimientoCaja['tipoPago'] }) {
  const cfg = TIPO_PAGO_CONFIG[tipo_pago]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${cfg.style}`}>
      {cfg.label}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: MovimientoCaja['tipo'] }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide',
      tipo === 'Ingreso' ? 'bg-[#B8DCCA] text-[#1E5C38]' : 'bg-[#F5C9C0] text-[#8A1E12]',
    )}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', tipo === 'Ingreso' ? 'bg-[#3F7A52]' : 'bg-[#B23A2A]')} />
      {tipo === 'Ingreso' ? 'Ingreso' : 'Egreso'}
    </span>
  )
}

// ─── Movimiento modal ─────────────────────────────────────────────────────────

interface MovimientoModalProps {
  tipo: TipoBackend
  onClose: () => void
  onSave: (mov: Omit<MovimientoCaja, 'id' | 'id_Caja' | 'fecha'>) => void
}

function MovimientoModal({ tipo, onClose, onSave }: MovimientoModalProps) {
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [categoria, setCategoria] = useState<MovimientoCaja['categoria']>(
    tipo === 'ingreso' ? 'Ventas' : 'GastoOperativo'
  )
  const [tipoPago, setTipoPago] = useState<MovimientoCaja['tipoPago']>('Efectivo')

  const categorias =
    tipo === 'ingreso'
      ? [
          { value: 'Ventas',        label: 'Ventas' },
          { value: 'Transferencia', label: 'Transferencia' },
          { value: 'OtroIngreso',   label: 'Otro ingreso' },
        ]
      : [
          { value: 'Compra',         label: 'Compra' },
          { value: 'GastoOperativo', label: 'Gasto operativo' },
          { value: 'Transferencia',  label: 'Transferencia' },
          { value: 'OtroEgreso',     label: 'Otro egreso' },
        ]

  const tiposPago = [
    { value: 'Efectivo', label: 'Efectivo' },
    { value: 'QR',       label: 'QR' },
    { value: 'Tarjeta',  label: 'Tarjeta' },
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseFloat(monto.replace(',', '.'))
    if (isNaN(n) || n <= 0) { notify.error('Monto inválido'); return }
    if (!motivo.trim()) { notify.error('Ingresa un motivo'); return }
    onSave({ tipo: tipo === 'ingreso' ? 'Ingreso' : 'Egreso', categoria, tipoPago, monto: n, motivo: motivo.trim() })
  }

  const isIngreso = tipo === 'ingreso'

  return (
    <Modal open onClose={onClose} title={isIngreso ? 'Registrar ingreso' : 'Registrar egreso'}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div className={clsx(
          'flex items-center gap-3 p-3 rounded-xl border',
          isIngreso ? 'bg-[#B8DCCA]/20 border-[#6BAF80]/50' : 'bg-[#F5C9C0]/20 border-[#D45040]/50',
        )}>
          <div className={clsx(
            'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
            isIngreso ? 'bg-[#3F7A52]' : 'bg-[#B23A2A]',
          )}>
            <i className={clsx('text-white text-[17px]', isIngreso ? 'ti ti-plus' : 'ti ti-minus')} />
          </div>
          <div>
            <p className={clsx(
              'text-xs font-bold uppercase tracking-wide',
              isIngreso ? 'text-[#1E5C38]' : 'text-[#8A1E12]',
            )}>
              {isIngreso ? 'Entrada de dinero' : 'Salida de dinero'}
            </p>
            <p className="text-[11px] text-[#7A7571] font-medium">
              {tipoPago !== 'Efectivo' ? 'No afecta el efectivo físico en caja' : 'Afecta el efectivo físico en caja'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#2D2B2A] uppercase tracking-wide mb-1.5">Categoría</label>
            <Select value={categoria} options={categorias}
              onChange={e => setCategoria(e.target.value as MovimientoCaja['categoria'])} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#2D2B2A] uppercase tracking-wide mb-1.5">Tipo de pago</label>
            <Select value={tipoPago} options={tiposPago}
              onChange={e => setTipoPago(e.target.value as MovimientoCaja['tipoPago'])} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#2D2B2A] uppercase tracking-wide mb-1.5">Monto (Bs)</label>
          <Input type="number" min="0.01" step="0.01" placeholder="0.00"
            value={monto} onChange={e => setMonto(e.target.value)} autoFocus />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#2D2B2A] uppercase tracking-wide mb-1.5">Motivo</label>
          <Input type="text"
            placeholder={isIngreso ? 'Ej: Venta contado cliente Pérez' : 'Ej: Pago proveedor materiales'}
            value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={120} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1">Registrar</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Cierre de caja modal ─────────────────────────────────────────────────────

interface CierreCajaModalProps {
  efectivoEsperado: number
  onClose: () => void
  onConfirm: (montoContado: number, justificacion: string | null) => void
}

function CierreCajaModal({ efectivoEsperado, onClose, onConfirm }: CierreCajaModalProps) {
  const [montoContado, setMontoContado] = useState('')
  const [justificacion, setJustificacion] = useState('')

  const contado = parseFloat(montoContado.replace(',', '.'))
  const contadoValido = !isNaN(contado) && montoContado.trim() !== ''
  const diferencia: number | null = contadoValido ? contado - efectivoEsperado : null
  const esFaltante = diferencia !== null && diferencia < 0
  const esSobrante = diferencia !== null && diferencia > 0

  const puedeCerrar = () => {
    if (!contadoValido) return false
    if (esFaltante && !justificacion.trim()) return false
    return true
  }

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!contadoValido) { notify.error('Ingresa el monto contado'); return }
    if (esFaltante && !justificacion.trim()) { notify.error('El faltante requiere una justificación'); return }
    onConfirm(contado, justificacion.trim() || null)
  }

  return (
    <Modal open onClose={onClose} title="Cierre de caja">
      <form onSubmit={handleConfirm} className="space-y-5 pt-1">
        <div className="p-4 rounded-xl bg-[#F7F7F7] border border-[#D0CBC4]">
          <p className="text-[11px] font-semibold text-[#7A7571] uppercase tracking-wide mb-1">Efectivo esperado en caja</p>
          <p className="text-2xl font-semibold tabular-nums text-[#2D2B2A]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {efectivoEsperado.toFixed(2)} Bs.
          </p>
          <p className="text-[11px] text-[#7A7571] font-medium mt-1">Calculado solo con movimientos en efectivo</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#2D2B2A] uppercase tracking-wide mb-1.5">
            Monto que contaste físicamente (Bs)
          </label>
          <Input type="number" min="0" step="0.01" placeholder="0.00"
            value={montoContado} onChange={e => setMontoContado(e.target.value)} autoFocus />
        </div>

        {contadoValido && diferencia !== null && (
          <div className={clsx(
            'flex items-center justify-between p-4 rounded-xl border',
            diferencia === 0
              ? 'bg-[#B8DCCA]/20 border-[#3F7A52]/30'
              : esSobrante
                ? 'bg-[#F4ECDB]/20 border-[#D4A333]/50'
                : 'bg-[#F5C9C0]/20 border-[#B23A2A]/30',
          )}>
            <div>
              <p className={clsx(
                'text-[11px] font-bold uppercase tracking-wide',
                diferencia === 0 ? 'text-[#1E5C38]' : esSobrante ? 'text-[#7A5200]' : 'text-[#8A1E12]',
              )}>
                {diferencia === 0 ? 'Cuadrado' : esSobrante ? 'Sobrante' : 'Faltante'}
              </p>
              <p className="text-xs text-[#7A7571] font-medium mt-0.5">
                {diferencia === 0
                  ? 'El monto coincide con el sistema'
                  : esSobrante
                    ? 'Hay más efectivo del esperado en sistema'
                    : 'Falta efectivo según registros del sistema'}
              </p>
            </div>
            <p className={clsx(
              'text-xl font-semibold tabular-nums',
              diferencia === 0 ? 'text-[#1E5C38]' : esSobrante ? 'text-[#7A5200]' : 'text-[#8A1E12]',
            )} style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)} Bs.
            </p>
          </div>
        )}

        {esFaltante && (
          <div>
            <label className="block text-xs font-bold text-[#8A1E12] uppercase tracking-wide mb-1.5">
              Justificación del faltante *
            </label>
            <Input type="text" placeholder="Ej: Billete falso, error de vuelto, robo..."
              value={justificacion} onChange={e => setJustificacion(e.target.value)} maxLength={200} />
            <p className="text-[10px] text-[#7A7571] font-medium mt-1">Campo obligatorio cuando hay faltante.</p>
          </div>
        )}

        {contadoValido && !esFaltante && (
          <div>
            <label className="block text-xs font-semibold text-[#2D2B2A] uppercase tracking-wide mb-1.5">
              Motivo (opcional)
            </label>
            <Input type="text" placeholder="Ej: Ajuste por tolerancia, ingreso extra..."
              value={justificacion} onChange={e => setJustificacion(e.target.value)} maxLength={200} />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={!puedeCerrar()}>Cerrar caja</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Apertura screen ──────────────────────────────────────────────────────────

function AperturaScreen({ onAbrir }: { onAbrir: (monto: number) => void }) {
  const [monto, setMonto] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseFloat(monto.replace(',', '.'))
    if (isNaN(n) || n < 0) { notify.error('Ingresa un monto válido'); return }
    setLoading(true)
    await onAbrir(n)
    setLoading(false)
  }

  const dateStr = new Date().toLocaleDateString('es-BO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h2 className="font-semibold text-[28px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Abrir caja
          </h2>
          <p className="text-sm text-[#7A7571] font-medium mt-2">{dateStr}</p>
          <p className="text-xs text-[#7A7571] mt-1">Registra el efectivo con el que inicias el día</p>
        </div>
        <div className="bg-white rounded-xl border border-[#D0CBC4] p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#2D2B2A] uppercase tracking-wide mb-1.5">
                Monto inicial en efectivo (Bs)
              </label>
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                value={monto} onChange={e => setMonto(e.target.value)} autoFocus disabled={loading} />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-[18px] py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center justify-center gap-2 text-sm font-semibold active:scale-95 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <i className="ti ti-loader-2 animate-spin text-[17px]" />
                  Abriendo…
                </>
              ) : (
                <>
                  <i className="ti ti-lock-open text-base" />
                  Abrir caja
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CajaDiariaPage() {
  const { isTokenReady, refreshSession } = useAuth()

  const [loading, setLoading] = useState(true)
  const [caja, setCaja] = useState<Caja | null>(null)
  const [resumenCierre, setResumenCierre] = useState<CierreCajaResponse | null>(null)
  const [modalTipo, setModalTipo] = useState<TipoBackend | null>(null)
  const [showCierre, setShowCierre] = useState(false)


  const movimientos = caja?.movimientos ?? []

  const totalIngresos = useMemo(
    () => movimientos.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + m.monto, 0),
    [movimientos],
  )
  const totalEgresos = useMemo(
    () => movimientos.filter(m => m.tipo === 'Egreso').reduce((s, m) => s + m.monto, 0),
    [movimientos],
  )

  const ingresosEfectivo = useMemo(
    () => movimientos.filter(m => m.tipo === 'Ingreso' && m.tipoPago === 'Efectivo').reduce((s, m) => s + m.monto, 0),
    [movimientos],
  )
  const egresosEfectivo = useMemo(
    () => movimientos.filter(m => m.tipo === 'Egreso' && m.tipoPago === 'Efectivo').reduce((s, m) => s + m.monto, 0),
    [movimientos],
  )
  const efectivoEsperado = (caja?.montoInicial ?? 0) + ingresosEfectivo - egresosEfectivo

  // Desglose de ingresos: ventas al contado vs cobros de crédito.
  const ventasHoy = useMemo(
    () => movimientos.filter(m => m.tipo === 'Ingreso' && m.categoria === 'Ventas').reduce((s, m) => s + m.monto, 0),
    [movimientos],
  )
  const cobranzasHoy = useMemo(
    () => movimientos.filter(m => m.tipo === 'Ingreso' && m.categoria === 'CobranzaCredito').reduce((s, m) => s + m.monto, 0),
    [movimientos],
  )
  const cobranzasEfectivo = useMemo(
    () => movimientos.filter(m => m.tipo === 'Ingreso' && m.categoria === 'CobranzaCredito' && m.tipoPago === 'Efectivo').reduce((s, m) => s + m.monto, 0),
    [movimientos],
  )

  useEffect(() => {
    if (!isTokenReady) return
    cargarCaja()
  }, [isTokenReady])

  const cargarCaja = async (isRetry = false) => {
    setLoading(true)
    try {
      const res = await gql<{ misCajas: { nodes: CajaAPI[] } }>(MI_CAJA_QUERY)
      const abierta = res.misCajas.nodes[0]
      setCaja(abierta ? backendToCaja(abierta) : null)
    } catch {
      if (!isRetry) {
        const refreshed = await refreshSession()
        if (refreshed) {
          await cargarCaja(true)
          return
        }
      }
      notify.error('Error cargando estado de caja')
    } finally {
      setLoading(false)
    }
  }

  const handleAbrir = async (montoInicial: number) => {
    try {
      await api.post('/Caja', {
        montoInicial,
        fechaInicio: new Date().toISOString(),
      })
      notify.success('Caja abierta correctamente')
      cargarCaja()
    } catch (err) {
      notify.error((err as Error).message || 'Error al abrir caja')
    }
  }

  const handleGuardarMovimiento = async (data: Omit<MovimientoCaja, 'id' | 'id_Caja' | 'fecha'>) => {
    if (!caja) return
    try {
      await api.post(`/Caja/${caja.id}/Movimiento`, {
        tipo: data.tipo,
        categoria: data.categoria,
        tipoPago: data.tipoPago,
        monto: data.monto,
        motivo: data.motivo,
      })
      notify.success(data.tipo === 'Ingreso' ? 'Ingreso registrado' : 'Egreso registrado')
      setModalTipo(null)
      cargarCaja()
    } catch (err) {
      notify.error((err as Error).message || 'Error al registrar movimiento')
    }
  }

  const handleConfirmarCierre = async (montoContado: number, justificacion: string | null) => {
    if (!caja) return
    try {
      const res = await api.post<CierreCajaResponse>(`/Caja/Cerrar/${caja.id}`, {
        montoContado,
        justificacion: justificacion ?? null,
      })
      notify.success('Caja cerrada. Resumen guardado.')
      setShowCierre(false)
      setCaja(null)
      setResumenCierre(res)
    } catch (err) {
      notify.error((err as Error).message || 'Error al cerrar caja')
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <MainLayout>
        <div className="bg-[#F7F7F7] min-h-screen">
          <PageTopBar title="Caja" />
          <div className="px-7 py-[26px] max-w-[1400px] mx-auto">
            <div className="mb-6">
              <div className="h-8 w-36 rounded-xl bg-[#E8E5E2] animate-pulse mb-2" />
              <div className="h-3 w-56 rounded bg-[#F0EFEC] animate-pulse" />
            </div>
            <MetricsSkeleton />
            <div className="bg-white rounded-xl border border-[#D0CBC4] h-64 animate-pulse" />
          </div>
        </div>
      </MainLayout>
    )
  }

  // ── Resumen de cierre ──────────────────────────────────────────────────────
  if (resumenCierre) {
    return (
      <MainLayout>
        <div className="bg-[#F7F7F7] min-h-screen">
          <PageTopBar title="Caja" />
          <div className="px-7 py-[26px] max-w-[1400px] mx-auto">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="font-semibold text-[30px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Resumen de cierre
                </h2>
                <p className="text-[13.5px] text-[#7A7571] mt-1.5">Reporte completo de la jornada</p>
              </div>
              <button
                onClick={() => setResumenCierre(null)}
                className="px-[18px] py-2.5 bg-[#D4A333] hover:bg-[#B4881C] text-[#2D2010] rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold active:scale-95 transition-all shadow-sm w-full md:w-auto"
              >
                <i className="ti ti-plus text-base" />
                Nueva caja
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[#D0CBC4] overflow-hidden">

              <div className="px-6 py-5 border-b border-[#D0CBC4] flex items-center gap-3 bg-[#B8DCCA]/20">
                <div className="w-10 h-10 rounded-xl bg-[#B8DCCA] border border-[#6BAF80]/50 flex items-center justify-center shrink-0">
                  <i className="ti ti-circle-check text-[#1E5C38] text-xl" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2D2B2A]">Caja cerrada exitosamente</p>
                  <p className="text-xs text-[#7A7571] font-medium">
                    {new Date(resumenCierre.fechaCierre).toLocaleDateString('es-BO', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })} — {new Date(resumenCierre.fechaCierre).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-[14px]">
                  {[
                    { label: 'Monto inicial',     value: resumenCierre.montoInicial,    accentColor: '#4A4744', color: '#2D2B2A' },
                    { label: 'Total ingresos',    value: resumenCierre.totalIngresos,   accentColor: '#3F7A52', color: '#1E5C38' },
                    { label: 'Total egresos',     value: resumenCierre.totalEgresos,    accentColor: '#B23A2A', color: '#8A1E12' },
                    { label: 'Efectivo esperado', value: resumenCierre.efectivoEsperado, accentColor: '#780e18', color: '#2D2B2A' },
                  ].map(({ label, value, accentColor, color }) => (
                    <div key={label} className="bg-[#F7F7F7] rounded-xl p-4 border border-[#D0CBC4] border-l-4" style={{ borderLeftColor: accentColor }}>
                      <p className="text-[11px] font-semibold text-[#7A7571] uppercase tracking-wide mb-2">{label}</p>
                      <p className="font-semibold text-xl leading-none" style={{ color, fontFamily: "'DM Sans', sans-serif" }}>
                        {value.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                        <span className="text-sm font-semibold text-[#7A7571] ml-1">Bs.</span>
                      </p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-[#7A7571] uppercase tracking-wide mb-3">Ingresos por tipo de pago</p>
                  <div className="grid grid-cols-3 gap-[14px]">
                    <div className="bg-[#F7F7F7] rounded-xl p-4 border border-[#D0CBC4]">
                      <p className="text-xs font-semibold text-[#4A4744] mb-1">Efectivo</p>
                      <p className="text-lg font-semibold text-[#2D2B2A]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {resumenCierre.ingresoEfectivo.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.
                      </p>
                    </div>
                    <div className="bg-[#F4ECDB]/40 rounded-xl p-4 border border-[#D4A333]/30">
                      <p className="text-xs font-semibold text-[#780e18] mb-1">QR</p>
                      <p className="text-lg font-semibold text-[#780e18]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {resumenCierre.ingresoQR.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.
                      </p>
                    </div>
                    <div className="bg-[#E8D4B8]/40 rounded-xl p-4 border border-[#D4A333]/40">
                      <p className="text-xs font-semibold text-[#780e18] mb-1">Tarjeta</p>
                      <p className="text-lg font-semibold text-[#780e18]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {resumenCierre.ingresoTarjeta.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Desglose Ventas contado vs Cobranzas de crédito */}
                <div>
                  <p className="text-[11px] font-semibold text-[#7A7571] uppercase tracking-wide mb-3">
                    Desglose de ingresos: Ventas contado vs Cobranzas
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
                    <div className="bg-[#B8DCCA]/20 rounded-xl p-4 border border-[#3F7A52]/30">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-[#1E5C38] uppercase tracking-wide">Ventas contado</p>
                        <span className="text-[10px] font-semibold text-[#1E5C38] bg-[#3F7A52] text-white px-1.5 py-0.5 rounded">
                          Categoría "Ventas"
                        </span>
                      </div>
                      <p className="text-2xl font-semibold text-[#1E5C38] tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {(resumenCierre.ingresoVentasTotal ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })} <span className="text-sm">Bs.</span>
                      </p>
                    </div>
                    <div className="bg-[#F5E0A8]/20 rounded-xl p-4 border border-[#B47A1F]/30">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-[#7A5200] uppercase tracking-wide">Cobranzas de crédito</p>
                        <span className="text-[10px] font-semibold text-[#7A5200] bg-[#B47A1F] text-white px-1.5 py-0.5 rounded">
                          Categoría "CobranzaCredito"
                        </span>
                      </div>
                      <p className="text-2xl font-semibold text-[#7A5200] tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {(resumenCierre.ingresoCobranzasTotal ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })} <span className="text-sm">Bs.</span>
                      </p>
                      {(resumenCierre.ingresoCobranzaEfectivo ?? 0) > 0 && (
                        <p className="text-[10.5px] text-[#7A5200] mt-1.5">
                          Efectivo: {(resumenCierre.ingresoCobranzaEfectivo ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })} · QR: {(resumenCierre.ingresoCobranzaQR ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })} · Tarjeta: {(resumenCierre.ingresoCobranzaTarjeta ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {(() => {
                  const diferencia = resumenCierre.montoContado - resumenCierre.efectivoEsperado
                  const esFaltante = diferencia < 0
                  const esCuadrado = diferencia === 0
                  return (
                    <div className={clsx(
                      'flex items-center justify-between p-5 rounded-xl border',
                      esCuadrado
                        ? 'bg-[#B8DCCA]/20 border-[#3F7A52]/30'
                        : esFaltante
                          ? 'bg-[#F5C9C0]/20 border-[#B23A2A]/30'
                          : 'bg-[#F4ECDB]/20 border-[#D4A333]/50',
                    )}>
                      <div>
                        <p className={clsx(
                          'text-xs font-bold uppercase tracking-wide',
                          esCuadrado ? 'text-[#1E5C38]' : esFaltante ? 'text-[#8A1E12]' : 'text-[#7A5200]',
                        )}>
                          {esCuadrado ? 'Caja cuadrada' : esFaltante ? 'Faltante' : 'Sobrante'}
                        </p>
                        <p className="text-xs text-[#7A7571] font-medium mt-0.5">
                          {esCuadrado
                            ? 'El monto contado coincide con el sistema'
                            : esFaltante
                              ? 'Falta efectivo según registros del sistema'
                              : 'Excedente de efectivo según registros'}
                        </p>
                        {resumenCierre.justificacion && (
                          <p className="text-[11px] text-[#7A7571] mt-1 italic">"{resumenCierre.justificacion}"</p>
                        )}
                      </div>
                      <p className={clsx(
                        'text-2xl font-semibold tabular-nums',
                        esCuadrado ? 'text-[#1E5C38]' : esFaltante ? 'text-[#8A1E12]' : 'text-[#7A5200]',
                      )} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {diferencia >= 0 ? '+' : ''}{diferencia.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.
                      </p>
                    </div>
                  )
                })()}

                <div className="flex items-center justify-between p-5 rounded-xl bg-[#F7F7F7] border border-[#D0CBC4]">
                  <div>
                    <p className="text-[11px] font-semibold text-[#7A7571] uppercase tracking-wide">Efectivo contado</p>
                    <p className="text-xs text-[#7A7571] font-medium mt-0.5">Lo que contaste físicamente en caja</p>
                  </div>
                  <p className="text-2xl font-semibold text-[#2D2B2A]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {resumenCierre.montoContado.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </MainLayout>
    )
  }

  // ── Caja cerrada — pantalla apertura ───────────────────────────────────────
  if (!caja) {
    return (
      <MainLayout>
        <div className="bg-[#F7F7F7] min-h-screen">
          <PageTopBar title="Caja" />
          <div className="px-7 py-[26px] max-w-[1400px] mx-auto">
            <AperturaScreen onAbrir={handleAbrir} />
          </div>
        </div>
      </MainLayout>
    )
  }

  // ── Caja abierta ───────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="bg-[#F7F7F7] min-h-screen">
        <PageTopBar title="Caja" />

        <div className="px-7 py-[26px] max-w-[1400px] mx-auto">

          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="font-semibold text-[30px] text-[#2D2B2A] leading-none tracking-[-0.022em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Caja diaria
              </h2>
              <p className="text-[13.5px] text-[#7A7571] mt-1.5">
                Gestión de efectivo y movimientos — registra ingresos, egresos y cierra tu jornada
              </p>
            </div>
            <button
              onClick={() => setShowCierre(true)}
              className="px-[18px] py-2.5 bg-white border border-[#D8D4D0] rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium text-[#4A4744] hover:bg-[#F0EFEC] transition-all w-full md:w-auto"
            >
              <i className="ti ti-lock text-base" />
              Cerrar caja
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[14px] mb-[22px]">
            <CajaMetricCard
              label="Monto inicial"
              value={caja.montoInicial.toLocaleString('es-BO')}
              accentColor="#4A4744"
              badgeBg="#F0EFEC"
              badgeColor="#4A4744"
              badgeText={`apertura ${fmtTime(caja.fechaInicio)}`}
            />
            <CajaMetricCard
              label="Total ingresos"
              value={totalIngresos.toLocaleString('es-BO')}
              accentColor="#3F7A52"
              badgeBg="#B8DCCA"
              badgeColor="#1E5C38"
              badgeText={`${movimientos.filter(m => m.tipo === 'Ingreso').length} movimientos`}
              highlightColor="#1E5C38"
            />
            <CajaMetricCard
              label="Total egresos"
              value={totalEgresos.toLocaleString('es-BO')}
              accentColor="#B23A2A"
              badgeBg="#F5C9C0"
              badgeColor="#8A1E12"
              badgeText={`${movimientos.filter(m => m.tipo === 'Egreso').length} movimientos`}
              highlightColor="#8A1E12"
            />
            <CajaMetricCard
              label="Efectivo en caja"
              value={efectivoEsperado.toLocaleString('es-BO')}
              accentColor="#780e18"
              badgeBg="#F4ECDB"
              badgeColor="#780e18"
              badgeText="solo efectivo"
            />
          </div>

          {/* Desglose de ingresos: Ventas contado vs Cobranzas del día */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px] mb-[22px]">
            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#3F7A52] p-[18px] relative overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <i className="ti ti-receipt text-[#3F7A52] text-[16px]" />
                <p className="text-[10.5px] font-semibold text-[#1E5C38] uppercase tracking-[0.1em]">Ventas al contado</p>
              </div>
              <p className="font-semibold text-[26px] text-[#1E5C38] leading-none tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {ventasHoy.toLocaleString('es-BO', { minimumFractionDigits: 2 })} <span className="text-sm font-semibold text-[#7A7571]">Bs.</span>
              </p>
              <p className="text-[10.5px] text-[#7A7571] mt-1.5">Ingresos del día por categoría "Ventas".</p>
            </div>
            <div className="bg-white rounded-xl border border-[#D0CBC4] border-l-4 border-l-[#B47A1F] p-[18px] relative overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <i className="ti ti-hand-coins text-[#B47A1F] text-[16px]" />
                <p className="text-[10.5px] font-semibold text-[#7A5200] uppercase tracking-[0.1em]">Cobranzas de crédito del día</p>
              </div>
              <p className="font-semibold text-[26px] text-[#7A5200] leading-none tabular-nums" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {cobranzasHoy.toLocaleString('es-BO', { minimumFractionDigits: 2 })} <span className="text-sm font-semibold text-[#7A7571]">Bs.</span>
              </p>
              <p className="text-[10.5px] text-[#7A7571] mt-1.5">
                {cobranzasEfectivo > 0
                  ? `${cobranzasEfectivo.toLocaleString('es-BO', { minimumFractionDigits: 2 })} en efectivo · `
                  : ''}
                Abonos a créditos de días anteriores
              </p>
            </div>
          </div>

          {/* Movements container */}
          <div className="bg-white rounded-xl border border-[#D0CBC4] overflow-hidden">

            {/* Toolbar */}
            <div className="px-[22px] py-[18px] border-b border-[#D0CBC4] flex flex-wrap justify-between items-center gap-3">
              <h3 className="text-[17px] font-semibold text-[#2D2B2A] tracking-[-0.01em] flex items-center gap-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Movimientos
                <span className="bg-[#F4ECDB] text-[#780e18] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {movimientos.length}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalTipo('egreso')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#F5C9C0] text-[#8A1E12] hover:bg-[#D45040]/20 border border-[#D45040]/50 transition-colors"
                >
                  <i className="ti ti-minus text-[13px]" />
                  Egreso
                </button>
                <button
                  onClick={() => setModalTipo('ingreso')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#B8DCCA] text-[#1E5C38] hover:bg-[#6BAF80]/30 border border-[#6BAF80]/50 transition-colors"
                >
                  <i className="ti ti-plus text-[13px]" />
                  Ingreso
                </button>
              </div>
            </div>

            {/* Movements list */}
            {movimientos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
                <div className="w-12 h-12 rounded-lg bg-white border border-[#E8E5E2] flex items-center justify-center mb-4">
                  <i className="ti ti-receipt text-[#7A7571] text-xl" />
                </div>
                <p className="text-sm font-semibold text-[#2D2B2A] mb-1">Sin movimientos aún</p>
                <p className="text-xs text-[#7A7571] font-medium max-w-xs">
                  Registra el primer ingreso o egreso del día
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E8E5E2]">
                {movimientos.map((mov) => (
                  <div key={mov.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAF5EE] transition-colors">
                    <div className={clsx(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                      mov.tipo === 'Ingreso' ? 'bg-[#B8DCCA]' : 'bg-[#F5C9C0]',
                    )}>
                      <i className={clsx(
                        'text-[17px]',
                        mov.tipo === 'Ingreso' ? 'ti ti-arrow-up text-[#3F7A52]' : 'ti ti-arrow-down text-[#B23A2A]',
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#2D2B2A] truncate">{mov.motivo}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <TipoBadge tipo={mov.tipo} />
                        <PagoBadge tipo_pago={mov.tipoPago} />
                        <span className="text-[11px] text-[#7A7571] font-medium">{CATEGORIA_LABELS[mov.categoria]}</span>
                        <span className="text-[11px] text-[#D0CBC4]">·</span>
                        <span className="text-[11px] text-[#7A7571] font-medium">{fmtTime(mov.fecha)}</span>
                      </div>
                    </div>

                    <p className={clsx(
                      'text-sm font-semibold tabular-nums shrink-0',
                      mov.tipo === 'Ingreso' ? 'text-[#1E5C38]' : 'text-[#8A1E12]',
                    )}>
                      {mov.tipo === 'Ingreso' ? '+' : '−'}{mov.monto.toFixed(2)} Bs.
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            {movimientos.length > 0 && (
              <div className="px-[22px] py-[14px] bg-[#F5F0EB] border-t border-[#D0CBC4] flex items-center justify-between">
                <p className="text-xs font-medium text-[#7A7571]">
                  {movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs font-semibold text-[#4A4744]">
                  Efectivo: <span className="text-[#2D2B2A] font-semibold">{efectivoEsperado.toFixed(2)} Bs.</span>
                </p>
              </div>
            )}
          </div>

        </div>

        {modalTipo && (
          <MovimientoModal
            tipo={modalTipo}
            onClose={() => setModalTipo(null)}
            onSave={handleGuardarMovimiento}
          />
        )}

        {showCierre && (
          <CierreCajaModal
            efectivoEsperado={efectivoEsperado}
            onClose={() => setShowCierre(false)}
            onConfirm={handleConfirmarCierre}
          />
        )}
      </div>
    </MainLayout>
  )
}
