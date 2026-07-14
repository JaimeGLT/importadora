using UsaAutoPartes.Domain.Entities.BasesEntidades;
using UsaAutoPartes.Domain.Entities.IdentityDb;

namespace UsaAutoPartes.Domain.Entities
{
    /// <summary>
    /// Abono registrado contra un crédito. Genera un MovimientoCaja con
    /// Categoria=CobranzaCredito para que la caja diaria lo sume como ingreso.
    /// </summary>
    public class CreditoPago : BaseEntity
    {
        public int Id_Credito { get; private set; }
        public int Id_Caja { get; private set; }
        public Guid Id_Usuario { get; private set; }
        public int? Id_MovimientoCaja { get; private set; }

        public DateTime Fecha { get; private set; } = DateTime.UtcNow;
        public decimal Monto { get; private set; }
        public string TipoPago { get; private set; } = string.Empty;
        public string? Nota { get; private set; }

        public Credito? Credito { get; set; }
        public Caja? Caja { get; set; }
        public Usuario? Usuario { get; set; }
        public MovimientoCaja? MovimientoCaja { get; set; }

        public CreditoPago() { }

        public CreditoPago(int idCredito, int idCaja, Guid idUsuario, decimal monto, string tipoPago, string? nota = null)
        {
            if (monto <= 0) throw new ArgumentException("El monto del pago debe ser mayor a 0.", nameof(monto));
            if (string.IsNullOrWhiteSpace(tipoPago)) throw new ArgumentException("El tipo de pago es obligatorio.", nameof(tipoPago));

            Id_Credito = idCredito;
            Id_Caja = idCaja;
            Id_Usuario = idUsuario;
            Monto = monto;
            TipoPago = tipoPago;
            Nota = nota;
        }

        public void VincularMovimientoCaja(int idMovimiento)
        {
            Id_MovimientoCaja = idMovimiento;
        }
    }
}
