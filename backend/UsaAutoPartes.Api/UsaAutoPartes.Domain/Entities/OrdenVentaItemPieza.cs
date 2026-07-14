using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public class OrdenVentaItemPieza : BaseEntity
    {
        public int Id_Item { get; set; }
        public int Id_Pieza { get; set; }
        public int Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
        public bool Confirmado { get; set; } = false;
        public bool ListoAlmacenero { get; set; } = false;
        public string? NotaIncompleto { get; set; }

        public OrdenVentaItem? Item { get; set; }
        public PiezaKit? Pieza { get; set; }

        public OrdenVentaItemPieza() { }

        public OrdenVentaItemPieza(int idPieza, int cantidad, decimal precioUnitario = 0)
        {
            Id_Pieza = idPieza;
            Cantidad = cantidad;
            PrecioUnitario = precioUnitario;
        }

        public void Confirmar(decimal precioUnitario)
        {
            Confirmado = true;
            PrecioUnitario = precioUnitario;
        }

        public void MarcarListoAlmacenero() => ListoAlmacenero = true;
        public void RevertirListoAlmacenero() => ListoAlmacenero = false;

        public void MarcarIncompleto(string? nota)
        {
            NotaIncompleto = nota;
        }

        public void RevertirIncompleto()
        {
            NotaIncompleto = null;
        }
    }
}
