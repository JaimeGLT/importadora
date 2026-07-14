// Mapeo entre el tipo interno `MetodoPago` (lowercase) y los strings
// exactos que valida el backend en `TipoPago` (capitalizado).
// El backend rechaza valores como "efectivo" con 400.
const PAGO_MAP: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  qr: 'QR',
}

/**
 * Normaliza un `tipoPago` del frontend al formato esperado por el backend.
 * Si el valor ya viene capitalizado (o es desconocido) lo devuelve tal cual.
 */
export const capitalizeTipoPago = (m: string): string => PAGO_MAP[m] ?? m
