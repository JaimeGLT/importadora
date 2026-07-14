import { type ReactNode } from 'react'
import { clsx } from 'clsx'

type Color = 'green' | 'red' | 'yellow' | 'blue' | 'gray'

interface BadgeProps {
  color?: Color
  children: ReactNode
  className?: string
}

const colorCls: Record<Color, string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  red:   'bg-red-50 text-red-700 border-red-200',
  yellow:'bg-yellow-50 text-yellow-700 border-yellow-200',
  blue:  'bg-brand-50 text-brand-700 border-brand-200',
  gray:  'bg-steel-100 text-steel-600 border-steel-200',
}

export function Badge({ color = 'gray', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        colorCls[color],
        className,
      )}
    >
      {children}
    </span>
  )
}
