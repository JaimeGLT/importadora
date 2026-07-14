import type { ReactNode } from 'react'
import { clsx } from 'clsx'

interface WarmMetricProps {
  label: string
  value: string | number
  unit?: string
  icon: ReactNode
  sublabel: string
  tone?: 'warn' | 'crit'
}

export function WarmMetric({ label, value, unit, icon, sublabel, tone }: WarmMetricProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-hair p-4 md:p-7 relative transition-all duration-160 hover:shadow-sm',
        'bg-white/82',
        tone === 'crit' && 'border-terra/20',
      )}
      style={
        tone === 'crit' ? { background: 'linear-gradient(180deg, #FCEEE8 0%, #FFFDF9 60%)' } :
        tone === 'warn' ? { background: 'linear-gradient(180deg, #FFF8EE 0%, #FFFDF9 60%)' } :
        undefined
      }
    >
      <div className="flex items-center justify-between mb-3 md:mb-[18px]">
        <div className="text-[12.5px] text-muted font-medium uppercase tracking-[0.04em]">{label}</div>
        <div className={clsx(
          'w-[34px] h-[34px] rounded-[10px] flex items-center justify-center',
          tone === 'crit' ? 'bg-terra text-white animate-pulse-crit' :
          tone === 'warn' ? 'bg-[#FEF3C7] text-[#B45309]' :
          'bg-cream-2 text-ink-2',
        )}>
          {icon}
        </div>
      </div>
      <div className="font-serif text-[36px] md:text-[52px] leading-[1] tracking-[-0.02em] mb-2 md:mb-2.5 flex items-baseline gap-1.5 text-ink">
        {unit === 'Bs.' && <span className="font-sans text-base font-medium text-muted mr-1.5">Bs.</span>}
        {value}
        {unit && unit !== 'Bs.' && <span className="font-sans text-base font-medium text-muted">{unit}</span>}
      </div>
      <div className="text-[12.5px] text-muted">{sublabel}</div>
    </div>
  )
}
