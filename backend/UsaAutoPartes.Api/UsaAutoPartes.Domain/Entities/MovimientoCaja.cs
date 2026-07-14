using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public class MovimientoCaja : BaseEntity
    {
        public int Id_Caja { get; private set; }

        public string Tipo { get; private set; } = string.Empty;

        public string Categoria { get; private set; } = string.Empty;

        public string TipoPago { get; private set; } = string.Empty;

        public decimal Monto { get; private set; }

        public string Motivo { get; private set; } = string.Empty;

        public DateTime Fecha { get; private set; } = DateTime.UtcNow;

        public Caja? Caja { get; set; }

        public MovimientoCaja() { }

        public MovimientoCaja(int idCaja, string tipo, string categoria, string tipoPago, decimal monto, string motivo)
        {
            Id_Caja = idCaja;
            Tipo = tipo;
            Categoria = categoria;
            TipoPago = tipoPago;
            Monto = monto;
            Motivo = motivo;
        }
    }
}
