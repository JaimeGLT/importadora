using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    /// <summary>
    /// Snapshot de los productos vendidos a crédito. Solo se usa en
    /// "venta rápida a crédito" (sin orden previa). Cuando el crédito
    /// nace desde una orden, los items viven en OrdenVentaItem.
    /// </summary>
    public class CreditoItem : BaseEntity
    {
        public int Id_Credito { get; set; }
        public int? Id_Producto { get; set; }

        /// <summary>
        /// Si está presente, el item representa una pieza suelta de un kit
        /// (venta parcial). El stock se descuenta de la pieza (no del kit)
        /// y <see cref="Id_Producto"/> apunta al kit padre. Si es null,
        /// el item es un producto regular o un kit completo.
        /// </summary>
        public int? Id_Pieza { get; set; }

        public int Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }

        public Credito? Credito { get; set; }
        public Producto? Producto { get; set; }
        public PiezaKit? Pieza { get; set; }

        public CreditoItem() { }

        public CreditoItem(int idCredito, int? idProducto, int? idPieza, int cantidad, decimal precioUnitario)
        {
            Id_Credito = idCredito;
            Id_Producto = idProducto;
            Id_Pieza = idPieza;
            Cantidad = cantidad;
            PrecioUnitario = precioUnitario;
        }

        public decimal Subtotal => Math.Round(Cantidad * PrecioUnitario, 2);
    }
}
