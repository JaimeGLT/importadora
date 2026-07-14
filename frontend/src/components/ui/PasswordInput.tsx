import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Input } from './Input'

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const [show, setShow] = useState(false)

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={show ? 'text' : 'password'}
          className={clsx('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-steel-400 hover:text-steel-600 transition-colors"
        >
          <i className={clsx('text-base', show ? 'ti ti-eye-off' : 'ti ti-eye')} />
        </button>
      </div>
    )
  },
)
