using System.ComponentModel.DataAnnotations;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.Dtos.CreditoDtos
{
    /// <summary>
    /// Crea un crédito. Si <see cref="Id_OrdenVenta"/> está presente, el
    /// crédito se ata a esa orden (los items viven en OrdenVentaItem).
    /// Si es null, es "venta rápida" y se requiere <see cref="Items"/>.
    /// </summary>
    public class DtoCrearCredito
    {
        [Required]
        public int Id_Cliente { get; set; }

        /// <summary>ID de la orden original. Null = venta rápida a crédito.</summary>
        public int? Id_OrdenVenta { get; set; }

        /// <summary>Total del crédito en Bs. Para crédito con orden se recalcula del subtotal; para venta rápida debe venir aquí.</summary>
        [Range(0.01, double.MaxValue)]
        public decimal Total { get; set; }

        /// <summary>ID del descuento global aplicado al crédito. Null = sin descuento.</summary>
        public int? Id_Descuento { get; set; }

        /// <summary>Monto (en Bs) del descuento global. Debe ser ≥ 0 y coincidir con Id_Descuento si está presente.</summary>
        [Range(0, double.MaxValue)]
        public decimal MontoDescuento { get; set; } = 0;

        public string? Nota { get; set; }

        /// <summary>Snapshot de productos (solo venta rápida).</summary>
        public List<DtoCreditoItemInput>? Items { get; set; }

        public bool EsVentaRapida => !Id_OrdenVenta.HasValue;
    }

    public class DtoCreditoItemInput
    {
        [Required]
        public int Id_Producto { get; set; }

        /// <summary>
        /// Pieza individual del kit. Si está presente, el ítem se marca como
        /// parcial y se descuenta stock de la pieza (no del kit). El
        /// <see cref="Id_Producto"/> debe apuntar al kit padre (o ser 0 si
        /// se omite).
        /// </summary>
        public int? Id_Pieza { get; set; }

        [Range(1, int.MaxValue)]
        public int Cantidad { get; set; }

        [Range(0, double.MaxValue)]
        public decimal PrecioUnitario { get; set; }

        public CreditoItem Crear(int idCredito) => new(idCredito, Id_Producto, Id_Pieza, Cantidad, PrecioUnitario);
    }
}
