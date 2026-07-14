import { useState, useRef } from 'react'

const fmtBsShort = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return String(Math.round(n))
}

interface SalesChartProps {
  data: number[]
  dates: string[]
  onHover?: (idx: number | null) => void
}

export function SalesChart({ data, dates, onHover }: SalesChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const max   = Math.max(...data, 1)
  const min   = Math.min(...data)
  const range = max - min || 1
  const mid   = (max + min) / 2

  const W = 300; const H = 100; const pad = 6

  const pts = data.map((v, i) => ({
    x: pad + (i / Math.max(data.length - 1, 1)) * (W - pad * 2),
    y: pad + (1 - (v - min) / range) * (H - pad * 2),
  }))
  const ptsStr  = pts.map(p => `${p.x},${p.y}`).join(' ')
  const fillPts = `${pad},${H} ${ptsStr} ${W - pad},${H}`

  const handle = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartRef.current) return
    const rect = chartRef.current.getBoundingClientRect()
    const idx  = Math.max(0, Math.min(data.length - 1, Math.round(((e.clientX - rect.left) / rect.width) * (data.length - 1))))
    setHoverIdx(idx)
    onHover?.(idx)
  }
  const leave = () => { setHoverIdx(null); onHover?.(null) }

  const xLabels = dates.filter((_, i) => i % Math.ceil(dates.length / 7) === 0)
  const hp = hoverIdx !== null ? pts[hoverIdx] : null

  return (
    <div className="flex gap-3 mt-2 flex-1 min-h-0 h-full">
      <div className="flex flex-col justify-between text-right shrink-0 pb-6" style={{ width: 44 }}>
        <span className="text-[10px] font-semibold tabular-nums text-steel-400">Bs {fmtBsShort(max)}</span>
        <span className="text-[10px] font-semibold tabular-nums text-steel-400">Bs {fmtBsShort(mid)}</span>
        <span className="text-[10px] font-semibold tabular-nums text-steel-400">Bs {fmtBsShort(min)}</span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div
          ref={chartRef}
          className="relative flex-1 min-h-0 cursor-default"
          onMouseMove={handle}
          onMouseLeave={leave}
        >
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="border-t border-dashed" style={{ borderColor: '#E2E2E2' }} />
            <div className="border-t border-dashed" style={{ borderColor: '#E2E2E2' }} />
            <div className="border-t border-dashed" style={{ borderColor: '#E2E2E2' }} />
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" data-chart="true" className="w-full h-full">
            <defs>
              <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#C8102E" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#C8102E" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={fillPts} fill="url(#brandGrad)" />
            <polyline points={ptsStr} fill="none" stroke="#C8102E" strokeWidth="2.5"
              strokeLinejoin="round" strokeLinecap="round" />

            {hp && (
              <>
                <line x1={hp.x} y1={0} x2={hp.x} y2={H} stroke="#C8102E" strokeWidth="1" opacity="0.2" />
                <circle cx={hp.x} cy={hp.y} r="4" fill="white" stroke="#C8102E" strokeWidth="2" />
              </>
            )}

            {!hp && pts.length > 0 && (() => {
              const last = pts[pts.length - 1]!
              return <circle cx={last.x} cy={last.y} r="3.5" fill="white" stroke="#C8102E" strokeWidth="2" />
            })()}
          </svg>
        </div>

        <div className="flex justify-between mt-2 shrink-0">
          {xLabels.map((d, i) => (
            <span key={i} className="text-[10px] text-steel-400">{d}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
