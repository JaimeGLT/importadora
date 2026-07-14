import { clsx } from 'clsx'

interface ImportProgressViewProps {
  /** Productos ya enviados al backend (no se muestra al usuario; reservado
   *  para uso futuro si se requiere mostrar progreso numérico). */
  current: number
  /** Total de productos a importar. */
  total: number
  /**
   * `inline` (default): se renderiza como bloque dentro de un modal.
   * `overlay`: se renderiza como overlay fullscreen con backdrop y card blanco
   * centrado, para flujos donde el modal del formulario ya se cerró
   * (e.g., importaciones que se procesan en background).
   */
  variant?: 'inline' | 'overlay'
}

/**
 * Vista de carga mientras se importan productos.
 *
 * Diseño minimalista: ícono con pulso, mensaje claro, spinner circular
 * indeterminado y barra con shimmer continuo. NO muestra el conteo "X / Y"
 * ni el porcentaje — la experiencia es limpia y solo comunica
 * "se está procesando".
 *
 * El mismo componente sirve tanto para la vista inline (dentro del modal del
 * wizard de Inventario) como para el overlay fullscreen (Importaciones).
 */
export function ImportProgressView({
  current,
  total,
  variant = 'inline',
}: ImportProgressViewProps) {
  void current
  void total

  const content = (
    <div className="flex flex-col items-center justify-center py-10 px-4 sm:py-14">
      {/* Shimmer keyframe — la "ola" clara viaja de izquierda a derecha sobre
          el fill de la barra y da sensación de actividad continua. */}
      <style>{`
        @keyframes shimmer-slide {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
      `}</style>

      {/* Pulse icon with glow */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-2xl bg-brand-500 opacity-25 blur-xl animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center shadow-lg">
          <svg
            className="h-8 w-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h3
        className="text-xl font-semibold text-steel-900 mb-1"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        Importando productos…
      </h3>
      <p className="text-sm text-steel-500 mb-8 text-center max-w-sm">
        Por favor no cierres esta ventana. Esto puede tardar unos minutos.
      </p>

      {/* Spinner circular indeterminado */}
      <div className="relative w-10 h-10 mb-6" role="status" aria-label="Cargando">
        <div className="absolute inset-0 rounded-full border-[3px] border-steel-100" />
        <div
          className={clsx(
            'absolute inset-0 rounded-full border-[3px] border-transparent',
            'border-t-brand-600 border-r-brand-400',
          )}
          style={{ animation: 'spin 0.9s linear infinite' }}
        />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* Progress bar indeterminada con shimmer — sin porcentaje ni contador */}
      <div className="w-full max-w-md">
        <div className="w-full h-2.5 bg-steel-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full relative overflow-hidden"
            style={{ width: '100%' }}
          >
            <div
              className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-white/45 to-transparent pointer-events-none"
              style={{ animation: 'shimmer-slide 1.4s linear infinite' }}
            />
          </div>
        </div>
      </div>
    </div>
  )

  if (variant === 'inline') return content

  // Overlay: backdrop fullscreen + card blanco centrado. Usado en flujos donde
  // el modal del formulario ya se cerró (e.g., Importaciones que se procesan
  // en background en lotes de 100).
  return (
    <div
      className="fixed inset-0 z-50 bg-[#2D2B2A]/40 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {content}
      </div>
    </div>
  )
}
