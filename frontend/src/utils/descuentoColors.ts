// Mapa de colores para los descuentos. Cubre TODOS los colores de Tailwind
// que tienen 50/200/500/700/800 (los shades que usamos). El fallback es
// emerald para que cualquier color desconocido se vea decente.
//
// Las claves válidas para crear descuentos en la UI viven en
// `lib/queries/config.queries.ts → COLOR_OPTIONS`
// (emerald, blue, amber, purple, rose, cyan). Los demás colores se incluyen
// para tolerar datos antiguos o personalizados sin romper la UI.

export type DescuentoColorVariant = {
  /** Badge en vivo: bg-50, border-200, text-700 */
  badge: string
  /** Card seleccionada: border-500, bg-50, text-800 */
  selected: string
  /** Card NO seleccionada: solo border-200 (lo demás gris) */
  border: string
  /** Icono del descuento (cuando no está seleccionado): text-500 */
  icon: string
}

export const DESCUENTO_COLORS: Record<string, DescuentoColorVariant> = {
  // Los 6 colores canónicos (de COLOR_OPTIONS)
  emerald: {
    badge:    'bg-emerald-50 border-emerald-200 text-emerald-700',
    selected: 'border-emerald-500 bg-emerald-50 text-emerald-800',
    border:   'border-emerald-200',
    icon:     'text-emerald-500',
  },
  blue: {
    badge:    'bg-blue-50 border-blue-200 text-blue-700',
    selected: 'border-blue-500 bg-blue-50 text-blue-800',
    border:   'border-blue-200',
    icon:     'text-blue-500',
  },
  amber: {
    badge:    'bg-amber-50 border-amber-200 text-amber-700',
    selected: 'border-amber-500 bg-amber-50 text-amber-800',
    border:   'border-amber-200',
    icon:     'text-amber-500',
  },
  purple: {
    badge:    'bg-purple-50 border-purple-200 text-purple-700',
    selected: 'border-purple-500 bg-purple-50 text-purple-800',
    border:   'border-purple-200',
    icon:     'text-purple-500',
  },
  rose: {
    badge:    'bg-rose-50 border-rose-200 text-rose-700',
    selected: 'border-rose-500 bg-rose-50 text-rose-800',
    border:   'border-rose-200',
    icon:     'text-rose-500',
  },
  cyan: {
    badge:    'bg-cyan-50 border-cyan-200 text-cyan-700',
    selected: 'border-cyan-500 bg-cyan-50 text-cyan-800',
    border:   'border-cyan-200',
    icon:     'text-cyan-500',
  },

  // Extras (tolerancia a datos viejos o personalizados)
  violet: {
    badge:    'bg-violet-50 border-violet-200 text-violet-700',
    selected: 'border-violet-500 bg-violet-50 text-violet-800',
    border:   'border-violet-200',
    icon:     'text-violet-500',
  },
  green: {
    badge:    'bg-green-50 border-green-200 text-green-700',
    selected: 'border-green-500 bg-green-50 text-green-800',
    border:   'border-green-200',
    icon:     'text-green-500',
  },
  teal: {
    badge:    'bg-teal-50 border-teal-200 text-teal-700',
    selected: 'border-teal-500 bg-teal-50 text-teal-800',
    border:   'border-teal-200',
    icon:     'text-teal-500',
  },
  sky: {
    badge:    'bg-sky-50 border-sky-200 text-sky-700',
    selected: 'border-sky-500 bg-sky-50 text-sky-800',
    border:   'border-sky-200',
    icon:     'text-sky-500',
  },
  indigo: {
    badge:    'bg-indigo-50 border-indigo-200 text-indigo-700',
    selected: 'border-indigo-500 bg-indigo-50 text-indigo-800',
    border:   'border-indigo-200',
    icon:     'text-indigo-500',
  },
  fuchsia: {
    badge:    'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700',
    selected: 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-800',
    border:   'border-fuchsia-200',
    icon:     'text-fuchsia-500',
  },
  pink: {
    badge:    'bg-pink-50 border-pink-200 text-pink-700',
    selected: 'border-pink-500 bg-pink-50 text-pink-800',
    border:   'border-pink-200',
    icon:     'text-pink-500',
  },
  red: {
    badge:    'bg-red-50 border-red-200 text-red-700',
    selected: 'border-red-500 bg-red-50 text-red-800',
    border:   'border-red-200',
    icon:     'text-red-500',
  },
  orange: {
    badge:    'bg-orange-50 border-orange-200 text-orange-700',
    selected: 'border-orange-500 bg-orange-50 text-orange-800',
    border:   'border-orange-200',
    icon:     'text-orange-500',
  },
  yellow: {
    badge:    'bg-yellow-50 border-yellow-200 text-yellow-700',
    selected: 'border-yellow-500 bg-yellow-50 text-yellow-800',
    border:   'border-yellow-200',
    icon:     'text-yellow-500',
  },
  lime: {
    badge:    'bg-lime-50 border-lime-200 text-lime-700',
    selected: 'border-lime-500 bg-lime-50 text-lime-800',
    border:   'border-lime-200',
    icon:     'text-lime-500',
  },
}

/**
 * Devuelve las clases Tailwind para el shade pedido de un color de descuento.
 * Si el color no está en el mapa, cae a `emerald`.
 */
export const getDescuentoColor = (
  color: string,
  variant: keyof DescuentoColorVariant,
): string => DESCUENTO_COLORS[color]?.[variant] ?? DESCUENTO_COLORS.emerald[variant]
