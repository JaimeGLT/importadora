import { toast } from 'sonner'

type NotifyType = 'success' | 'error' | 'warning' | 'info'

interface NotifyOptions {
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

const icons: Record<NotifyType, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

const titleColors: Record<NotifyType, string> = {
  success: 'text-emerald-700',
  error: 'text-red-700',
  warning: 'text-amber-700',
  info: 'text-blue-700',
}

function showToast(type: NotifyType, message: string, options?: NotifyOptions) {
  const icon = icons[type]
  const titleColor = titleColors[type]

  return toast[type](message, {
    description: options?.description,
    duration: options?.duration ?? 4000,
    icon,
    classNames: {
      title: titleColor,
    },
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
  })
}

export const notify = {
  success: (message: string, options?: NotifyOptions) => showToast('success', message, options),
  error: (message: string, options?: NotifyOptions) => showToast('error', message, options),
  warning: (message: string, options?: NotifyOptions) => showToast('warning', message, options),
  info: (message: string, options?: NotifyOptions) => showToast('info', message, options),
  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ) => toast.promise(promise, messages),
}