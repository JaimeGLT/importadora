using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.CreditoDtos
{
    /// <summary>
    /// Registra un abono (parcial o total) contra un crédito. El backend
    /// crea el MovimientoCaja y actualiza el estado del crédito.
    /// </summary>
    public class DtoRegistrarPago
    {
        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal Monto { get; set; }

        [Required]
        public string TipoPago { get; set; } = string.Empty;

        public string? Nota { get; set; }

        /// <summary>Valor de RowVersion del crédito al momento de leerlo. Para chequeo de concurrencia optimista.</summary>
        public uint RowVersion { get; set; }
    }
}
