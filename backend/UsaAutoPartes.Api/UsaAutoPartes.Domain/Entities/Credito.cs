using UsaAutoPartes.Domain.Entities.BasesEntidades;
using UsaAutoPartes.Domain.Entities.IdentityDb;
using UsaAutoPartes.Domain.Enum.VentaEnums;

namespace UsaAutoPartes.Domain.Entities
{
    /// <summary>
    /// Representa una venta entregada cuya cobranza se difiere en el tiempo.
    /// El cliente retira el producto (stock descontado) pero el efectivo
    /// se registra recién cuando se acredita un pago (abono).
    /// </summary>
    public class Credito : BaseEntity
    {
        public int Id_Cliente { get; set; }
        public int? Id_OrdenVenta { get; set; }
        public Guid Id_Cajero { get; set; }
        public int Id_CajaOrigen { get; set; }

        public string Estado { get; set; } = EstadosCredito.Pendiente;
        public decimal Total { get; set; }
        public decimal SaldoPendiente { get; set; }

        public int? Id_Descuento { get; set; }
        public decimal MontoDescuento { get; set; } = 0;

        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaPagoCompleto { get; set; }
        public DateTime? FechaCancelacion { get; set; }

        public string? Nota { get; set; }

        /// <summary>
        /// Marca de concurrencia optimista. Permite que dos cajeros no cobren
        /// abonos sobre el mismo crédito en simultáneo.
        /// </summary>
        public uint RowVersion { get; set; }

        public Cliente? Cliente { get; set; }
        public OrdenVenta? OrdenVenta { get; set; }
        public Usuario? Cajero { get; set; }
        public Caja? CajaOrigen { get; set; }
        public Descuento? Descuento { get; set; }
        public List<CreditoPago> Pagos { get; set; } = new();
        public List<CreditoItem> Items { get; set; } = new();

        public Credito() { }

        /// <summary>
        /// Crea un crédito con un cliente obligatorio y el total calculado
        /// externamente. SaldoPendiente arranca igual a Total.
        /// </summary>
        public Credito(int idCliente, Guid idCajero, int idCajaOrigen, int? idOrdenVenta, decimal total, int? idDescuento = null, decimal montoDescuento = 0, string? nota = null)
        {
            if (idCliente <= 0) throw new ArgumentException("El cliente es obligatorio para un crédito.", nameof(idCliente));
            if (total <= 0) throw new ArgumentException("El total del crédito debe ser mayor a 0.", nameof(total));

            Id_Cliente = idCliente;
            Id_Cajero = idCajero;
            Id_CajaOrigen = idCajaOrigen;
            Id_OrdenVenta = idOrdenVenta;
            Total = total;
            SaldoPendiente = total;
            Id_Descuento = idDescuento;
            MontoDescuento = montoDescuento;
            Nota = nota;
            FechaCreacion = DateTime.UtcNow;
        }

        /// <summary>
        /// Acredita un pago al crédito. Reduce SaldoPendiente, recalcula Estado
        /// y deja FechaPagoCompleto seteada si quedó en 0. Lanza si el crédito
        /// no admite pagos (cancelado, ya pagado, o monto inválido).
        /// </summary>
        public void RegistrarPago(decimal monto)
        {
            if (Estado == EstadosCredito.Cancelado) throw new InvalidOperationException("El crédito está cancelado.");
            if (Estado == EstadosCredito.Pagado) throw new InvalidOperationException("El crédito ya fue pagado en su totalidad.");
            if (monto <= 0) throw new ArgumentException("El monto del pago debe ser mayor a 0.", nameof(monto));
            if (monto > SaldoPendiente) throw new ArgumentException("El monto del pago supera el saldo pendiente.", nameof(monto));

            SaldoPendiente = Math.Round(SaldoPendiente - monto, 2);

            if (SaldoPendiente <= 0)
            {
                SaldoPendiente = 0;
                Estado = EstadosCredito.Pagado;
                FechaPagoCompleto = DateTime.UtcNow;
            }
            else
            {
                Estado = EstadosCredito.Parcial;
            }
        }

        /// <summary>
        /// Marca el crédito como cancelado. NO devuelve stock — eso lo hace
        /// el controller iterando items.
        /// </summary>
        public void Cancelar()
        {
            if (Estado == EstadosCredito.Pagado) throw new InvalidOperationException("No se puede cancelar un crédito ya pagado.");
            if (Estado == EstadosCredito.Cancelado) throw new InvalidOperationException("El crédito ya está cancelado.");

            Estado = EstadosCredito.Cancelado;
            FechaCancelacion = DateTime.UtcNow;
        }
    }
}
