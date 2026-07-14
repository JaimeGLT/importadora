using UsaAutoPartes.Domain.Entities.BasesEntidades;
using UsaAutoPartes.Domain.Entities.IdentityDb;
using UsaAutoPartes.Domain.Enum.VentaEnums;

namespace UsaAutoPartes.Domain.Entities
{
    public class OrdenVenta : BaseEntity
    {
        public Guid Id_Cajero { get; set; }
        public Guid? Id_Almacenero { get; set; }
        public int? Id_Cliente { get; set; }
        public int Id_Caja { get; set; }
        public string Estado { get; set; } = EstadosOrden.Pendiente;
        public DateTime Fecha { get; set; }
        public DateTime? FechaCompletada { get; set; }
        public DateTime? FechaEsperandoPago { get; set; }
        public string? Nota { get; set; }
        public string? NotaCancelacion { get; set; }

        /// <summary>Descuento global aplicado a toda la orden (elegido al cobrar).</summary>
        public int? Id_Descuento { get; set; }

        /// <summary>Monto (en Bs) del descuento global. 0 si no hay descuento.</summary>
        public decimal MontoDescuento { get; set; } = 0;

        /// <summary>
        /// Modalidad de la venta: <see cref="ModalidadVenta.Normal"/> (flujo completo
        /// con almacenero y escaneo) o las variantes rápidas (sin pasar por almacén).
        /// Default: <see cref="ModalidadVenta.Normal"/>.
        /// </summary>
        public string Modalidad { get; set; } = ModalidadVenta.Normal;

        public Usuario? Cajero { get; set; }
        public Usuario? Almacenero { get; set; }
        public Cliente? Cliente { get; set; }
        public Caja? Caja { get; set; }
        public Descuento? Descuento { get; set; }
        public List<OrdenVentaItem> Items { get; set; } = new();

        public OrdenVenta() { }

        public OrdenVenta(Guid idCajero, int idCaja, int? idCliente)
        {
            Id_Cajero = idCajero;
            Id_Caja = idCaja;
            Id_Cliente = idCliente;
            Fecha = DateTime.UtcNow;
        }

        public void Aceptar(Guid idAlmacenero)
        {
            Id_Almacenero = idAlmacenero;
            Estado = EstadosOrden.Aceptada;
        }

        public void MarcarLista()
        {
            Estado = EstadosOrden.Lista;
        }

        public void MarcarConFaltantes()
        {
            Estado = EstadosOrden.ConFaltantes;
        }

        public void MarcarEsperandoPago()
        {
            Estado = EstadosOrden.EsperandoPago;
            FechaEsperandoPago = DateTime.UtcNow;
        }

        public void Completar()
        {
            Estado = EstadosOrden.Completada;
            FechaCompletada = DateTime.UtcNow;
        }

        public void Cancelar(string? nota)
        {
            Estado = EstadosOrden.Cancelada;
            NotaCancelacion = nota;
        }

        /// <summary>
        /// Suma los subtotales brutos de los items que se cobran
        /// (confirmados o parciales con piezas confirmadas; los
        /// "incompletos" no entran al cobro).
        /// </summary>
        public decimal CalcularSubtotalBruto()
        {
            decimal total = 0;
            foreach (var item in Items)
            {
                if (item.Estado == EstadosOrdenItem.Incompleto)
                    continue;

                if (item.EsParcial)
                {
                    total += item.Piezas
                        .Where(p => p.Confirmado)
                        .Sum(p => p.PrecioUnitario * p.Cantidad);
                }
                else
                {
                    if (item.Estado != EstadosOrdenItem.Confirmado)
                        continue;
                    total += item.PrecioUnitario * item.Cantidad;
                }
            }
            return total;
        }

        /// <summary>Subtotal bruto menos el descuento global de la orden.</summary>
        public decimal CalcularSubtotalNeto() =>
            Math.Round(CalcularSubtotalBruto() - MontoDescuento, 2);
    }
}
