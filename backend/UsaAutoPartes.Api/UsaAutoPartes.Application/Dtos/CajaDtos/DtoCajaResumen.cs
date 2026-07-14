namespace UsaAutoPartes.Application.Dtos.CajaDtos
{
    public class DtoCajaResumen
    {
        public string Estado { get; set; } = string.Empty;
        public DateTime FechaInicio { get; set; }
        public DateTime? FechaCierre { get; set; }
        public decimal MontoInicial { get; set; }
        public decimal TotalIngresos { get; set; }
        public decimal IngresoEfectivo { get; set; }
        public decimal IngresoQR { get; set; }
        public decimal IngresoTarjeta { get; set; }
        public decimal TotalEgresos { get; set; }
        public decimal EfectivoEsperado { get; set; }
        public decimal MontoContado { get; set; }
        public string? Justificacion { get; set; }

        // ─── Desglose de ingresos por categoría (caja diaria) ─────────────
        /// <summary>Total de ingresos por ventas al contado (excluye cobros de crédito).</summary>
        public decimal IngresoVentasTotal { get; set; }
        /// <summary>Total de cobros de créditos (CobranzaCredito) — no se cuentan como "ventas del día".</summary>
        public decimal IngresoCobranzasTotal { get; set; }
        public decimal IngresoCobranzaEfectivo { get; set; }
        public decimal IngresoCobranzaQR { get; set; }
        public decimal IngresoCobranzaTarjeta { get; set; }
    }
}
