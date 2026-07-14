import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, className, id, ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-400 z-10">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          placeholder={label ? ' ' : props.placeholder}
          className={clsx(
            'peer w-full rounded-lg border bg-white px-3 text-sm text-steel-900',
            'focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent',
            'disabled:bg-steel-50 disabled:cursor-not-allowed',
            'transition-colors duration-150',
            error ? 'border-red-400' : 'border-steel-200',
            label  ? 'h-12 pt-3 placeholder-transparent' : 'h-9 placeholder:text-steel-400',
            leftIcon && 'pl-9',
            className,
          )}
          {...props}
        />
        {label && (
          <label
            htmlFor={inputId}
            className={clsx(
              'pointer-events-none absolute transition-all duration-150 select-none',
              leftIcon ? 'left-9' : 'left-3',
              // Floated — default when there is a value
              'top-1.5 text-xs',
              // Resting — when empty (placeholder is "shown")
              'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2',
              'peer-placeholder-shown:text-sm',
              // Focused — float back up, override resting
              'peer-focus:top-1.5 peer-focus:translate-y-0',
              'peer-focus:text-xs',
              error
                ? 'text-red-400 peer-focus:text-red-500'
                : 'text-steel-400 peer-focus:text-brand-600',
            )}
          >
            {label}
          </label>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-steel-400">{hint}</p>}
    </div>
  )
})
