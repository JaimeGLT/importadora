import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { clsx } from 'clsx'

type BaseProps = {
  label?: string
  error?: string
  hint?: string
  multiline?: boolean
  rows?: number
}

type WarmInputProps =
  | (BaseProps & { multiline?: false } & InputHTMLAttributes<HTMLInputElement>)
  | (BaseProps & { multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>)

const sharedClass = (error?: string, readOnly?: boolean, className?: string) =>
  clsx(
    'w-full px-3.5 rounded-xl border text-[13.5px] text-[#2D2B2A]',
    'focus:outline-none focus:border-[#780e18] transition-colors duration-150',
    'placeholder:text-[#7A7571]',
    error
      ? 'border-[#B23A2A]/40 bg-[#F5C9C0]/20'
      : 'border-[#E8E5E2] bg-white',
    readOnly && 'opacity-55 cursor-not-allowed bg-[#F0EFEC]',
    className,
  )

export function WarmInput({ label, error, hint, multiline, rows, className, ...props }: WarmInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[10.5px] uppercase tracking-[0.1em] font-bold text-[#7A7571] leading-none">
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          rows={rows ?? 3}
          className={clsx(sharedClass(error, (props as TextareaHTMLAttributes<HTMLTextAreaElement>).readOnly as boolean | undefined, className), 'py-2.5 resize-none')}
          {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          className={clsx(sharedClass(error, (props as InputHTMLAttributes<HTMLInputElement>).readOnly as boolean | undefined, className), 'h-[42px]')}
          {...(props as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {error && <p className="text-[11px] text-[#B23A2A] leading-tight">{error}</p>}
      {hint && !error && <p className="text-[11px] text-[#7A7571] leading-tight">{hint}</p>}
    </div>
  )
}
