using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.VentaDtos
{
    public class DtoCompletarOrden : IValidatableObject
    {
        /// <summary>Descuento global elegido al cobrar. Null/0 = sin descuento.</summary>
        public int? Id_Descuento { get; set; }

        /// <summary>Monto (en Bs) del descuento global. Debe coincidir con Id_Descuento si está presente.</summary>
        [Range(0, double.MaxValue)]
        public decimal MontoDescuento { get; set; } = 0;

        /// <summary>
        /// Pagos aplicados al cobrar. Vacío si EsCredito=true (el efectivo entra a caja
        /// recién cuando el cliente abone, no ahora).
        /// </summary>
        public List<DtoPago> Pagos { get; set; } = new();

        /// <summary>Si es true, NO se crean MovimientoCaja: la venta se registra como crédito y el cobro se difiere.</summary>
        public bool EsCredito { get; set; } = false;

        /// <summary>Obligatorio cuando EsCredito = true. El cliente a quien se le fia.</summary>
        public int? Id_Cliente { get; set; }

        /// <summary>Nota opcional sobre el crédito.</summary>
        public string? Nota { get; set; }

        /// <summary>
        /// Validación cross-field. A crédito el array Pagos viene vacío porque todavía
        /// no hay cobro; el controller ya salta la creación de MovimientoCaja en ese caso.
        /// </summary>
        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (!EsCredito && (Pagos is null || Pagos.Count == 0))
            {
                yield return new ValidationResult(
                    "Debe registrar al menos un pago al cobrar al contado.",
                    new[] { nameof(Pagos) });
            }

            if (EsCredito && !Id_Cliente.HasValue)
            {
                yield return new ValidationResult(
                    "Para cobrar a crédito se requiere un cliente.",
                    new[] { nameof(Id_Cliente) });
            }
        }
    }
}
