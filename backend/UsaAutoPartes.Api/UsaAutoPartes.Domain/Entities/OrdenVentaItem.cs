using UsaAutoPartes.Domain.Entities.BasesEntidades;
using UsaAutoPartes.Domain.Enum.VentaEnums;

namespace UsaAutoPartes.Domain.Entities
{
    public class OrdenVentaItem : BaseEntity
    {
        public int Id_Orden { get; set; }
        public int? Id_Producto { get; set; }
        public int Cantidad { get; set; }
        public bool EsParcial { get; set; } = false;
        public string Estado { get; set; } = EstadosOrdenItem.Pendiente;
        public string? NotaIncompleto { get; set; }
        public decimal PrecioUnitario { get; set; }

        public OrdenVenta? Orden { get; set; }
        public Producto? Producto { get; set; }
        public List<OrdenVentaItemPieza> Piezas { get; set; } = new();

        public OrdenVentaItem() { }

        public OrdenVentaItem(int idProducto, int cantidad, bool esParcial, decimal precioUnitario)
        {
            Id_Producto = idProducto;
            Cantidad = cantidad;
            EsParcial = esParcial;
            PrecioUnitario = precioUnitario;
        }

        public void MarcarIncompleto(string? nota)
        {
            Estado = EstadosOrdenItem.Incompleto;
            NotaIncompleto = nota;
        }

        public void Confirmar(decimal precioUnitario)
        {
            Estado = EstadosOrdenItem.Confirmado;
            PrecioUnitario = precioUnitario;
        }

        public void MarcarListoIndividual()
        {
            Estado = EstadosOrdenItem.ListoIndividual;
        }

        public void RevertirIncompleto()
        {
            Estado = EstadosOrdenItem.Pendiente;
            NotaIncompleto = null;
        }

        public decimal CalcularSubtotalConfirmado()
        {
            if (Estado == EstadosOrdenItem.Incompleto)
                return 0;

            decimal subtotal;
            if (!EsParcial)
            {
                if (Estado != EstadosOrdenItem.Confirmado)
                    return 0;
                subtotal = PrecioUnitario * Cantidad;
            }
            else
            {
                subtotal = Piezas
                    .Where(p => p.Confirmado)
                    .Sum(p => p.PrecioUnitario * p.Cantidad);
                if (subtotal == 0)
                    return 0;
            }

            return subtotal;
        }
    }
}
