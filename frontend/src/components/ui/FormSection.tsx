import type { ReactNode } from 'react'
import { clsx } from 'clsx'

interface FormSectionProps {
  icon: ReactNode
  title: string
  description?: string
  extra?: ReactNode
  children: ReactNode
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
  iconClass?: string
}

export function FormSection({ icon, title, description, extra, children, collapsible, open, onToggle, iconClass }: FormSectionProps) {
  const isOpen = !collapsible || open
  return (
    <section className="rounded-2xl border border-[#E8E5E2] overflow-hidden">
      <div
        className={clsx(
          'flex items-center gap-3 px-5 py-3.5 border-b border-[#E8E5E2] bg-white',
          collapsible && 'cursor-pointer select-none hover:bg-[#FBFAF7] transition-colors',
          collapsible && !isOpen && 'border-b-0',
        )}
        onClick={collapsible ? onToggle : undefined}
      >
        <div className={clsx(
          'flex items-center justify-center w-[30px] h-[30px] rounded-[8px] flex-shrink-0',
          iconClass ?? 'bg-white border border-[#E8E5E2] text-[#4A4744]',
        )}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-[#2D2B2A]">{title}</p>
              {description && <p className="text-[11px] text-[#7A7571] leading-tight">{description}</p>}
            </div>
            {extra && <div className="flex-shrink-0">{extra}</div>}
          </div>
        </div>
        {collapsible && (
          <i className={clsx('ti ti-chevron-right text-[16px] text-[#7A7571] transition-transform flex-shrink-0', isOpen && 'rotate-90')} />
        )}
      </div>
      {isOpen && <div className="p-5 bg-white">{children}</div>}
    </section>
  )
}
