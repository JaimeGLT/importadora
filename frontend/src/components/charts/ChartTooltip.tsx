import { type ReactNode } from 'react'

export interface TooltipRow {
  label: string
  value: string
  /** Dot de color a la izquierda del label */
  color?: string
}

export interface ChartTooltipProps {
  /** Coordenadas en píxeles relativas al contenedor padre (que debe ser `relative`) */
  x: number
  y: number
  title?: string
  rows: TooltipRow[]
  visible: boolean
  /** Alineación: 'top'|'bottom' relativo al punto — útil cuando el cursor está en el borde */
  align?: 'center' | 'left' | 'right'
}

/**
 * Tooltip HTML overlay compartido por todos los charts.
 * No intercepta eventos del mouse (`pointer-events-none`) — sólo se renderiza.
 * El padre controla cuándo aparece pasando `visible`.
 */
export function ChartTooltip({ x, y, title, rows, visible, align = 'center' }: ChartTooltipProps): ReactNode {
  if (!visible || rows.length === 0) return null
  const offset = 12
  const style: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y - offset,
    transform:
      align === 'left' ? 'translate(-100%, -100%)' :
      align === 'right' ? 'translate(0, -100%)' :
      'translate(-50%, -100%)',
    pointerEvents: 'none',
    zIndex: 10,
    transition: 'opacity 120ms ease-out',
    opacity: visible ? 1 : 0,
    whiteSpace: 'nowrap',
  }
  return (
    <div style={style}
      className="bg-[#241E18]/95 text-white text-[11px] rounded-lg shadow-xl px-2.5 py-1.5 backdrop-blur-sm">
      {title && <div className="font-bold mb-1 pb-1 border-b border-white/10 text-white/90">{title}</div>}
      <div className="space-y-0.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            {r.color && <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} />}
            <span className="text-white/80">{r.label}</span>
            <span className="ml-auto font-bold tabular-nums text-white">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
