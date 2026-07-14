using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.Dtos.CreditoDtos
{
    public class DtoCreditoResponse
    {
        public int Id { get; set; }
        public int Id_Cliente { get; set; }
        public string? Cliente_Nombre { get; set; }
        public string? Cliente_Apellido { get; set; }
        public string? Cliente_Telefono { get; set; }
        public int? Id_OrdenVenta { get; set; }
        public Guid Id_Cajero { get; set; }
        public string? Cajero_Nombre { get; set; }
        public int Id_CajaOrigen { get; set; }
        public string Estado { get; set; } = string.Empty;
        public decimal Total { get; set; }
        public decimal SaldoPendiente { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaPagoCompleto { get; set; }
        public DateTime? FechaCancelacion { get; set; }
        public string? Nota { get; set; }
        public uint RowVersion { get; set; }
        public List<DtoCreditoItem> Items { get; set; } = new();
        public List<DtoCreditoPago> Pagos { get; set; } = new();
    }

    public class DtoCreditoItem
    {
        public int Id { get; set; }
        public int? Id_Producto { get; set; }
        public string? Producto_Codigo { get; set; }
        public string? Producto_Nombre { get; set; }
        public int? Producto_MarcaId { get; set; }
        public string? Producto_MarcaNombre { get; set; }
        public int? Id_Pieza { get; set; }
        public int Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
        public decimal Subtotal { get; set; }
    }

    public class DtoCreditoPago
    {
        public int Id { get; set; }
        public int Id_Caja { get; set; }
        public Guid Id_Usuario { get; set; }
        public string? Usuario_Nombre { get; set; }
        public DateTime Fecha { get; set; }
        public decimal Monto { get; set; }
        public string TipoPago { get; set; } = string.Empty;
        public string? Nota { get; set; }
    }
}
