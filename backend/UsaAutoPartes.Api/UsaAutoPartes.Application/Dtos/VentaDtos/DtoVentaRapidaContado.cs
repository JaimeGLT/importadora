using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.VentaDtos
{
    /// <summary>
    /// DTO de entrada para el endpoint <c>POST /api/OrdenVenta/Rapida</c>.
    /// Crea una orden, descuenta stock y registra los pagos en una sola
    /// transacción atómica, sin pasar por el almacenero.
    /// </summary>
    public class DtoVentaRapidaContado
    {
        /// <summary>Cliente opcional. Si se envía, debe existir en la BD.</summary>
        public int? Id_Cliente { get; set; }

        /// <summary>Nota opcional (motivo, referencia, etc.). Máx 200 chars.</summary>
        [MaxLength(200)]
        public string? Nota { get; set; }

        /// <summary>Descuento global aplicado a la orden completa.</summary>
        public int? Id_Descuento { get; set; }

        /// <summary>Monto (en Bs) del descuento global. 0 si no hay descuento.</summary>
        [Range(0, double.MaxValue)]
        public decimal MontoDescuento { get; set; } = 0;

        /// <summary>Ítems del carrito. Mínimo 1.</summary>
        [Required]
        [MinLength(1)]
        public List<DtoVentaRapidaContadoItem> Items { get; set; } = new();

        /// <summary>Pagos al contado (uno o varios en caso de pago mixto). Mínimo 1.</summary>
        [Required]
        [MinLength(1)]
        public List<DtoPago> Pagos { get; set; } = new();
    }

    /// <summary>
    /// Ítem de la venta rápida al contado. Puede representar un producto
    /// regular, un kit completo o una pieza suelta de un kit (venta parcial).
    /// Para piezas sueltas, enviar <c>Id_Pieza</c>; <c>Id_Producto</c> debe
    /// apuntar al kit padre (o a 0 si se omite).
    /// </summary>
    public class DtoVentaRapidaContadoItem
    {
        [Required]
        public int Id_Producto { get; set; }

        /// <summary>
        /// Pieza individual del kit. Si está presente, el ítem se marca como
        /// parcial y se descuenta stock de la pieza (no del kit).
        /// </summary>
        public int? Id_Pieza { get; set; }

        [Required]
        [Range(1, int.MaxValue)]
        public int Cantidad { get; set; }

        [Range(0, double.MaxValue)]
        public decimal PrecioUnitario { get; set; }
    }
}
