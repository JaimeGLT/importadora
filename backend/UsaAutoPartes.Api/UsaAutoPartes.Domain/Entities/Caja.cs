using UsaAutoPartes.Domain.Entities.BasesEntidades;
using UsaAutoPartes.Domain.Entities.IdentityDb;
using UsaAutoPartes.Domain.Enum.CajaEnums;

namespace UsaAutoPartes.Domain.Entities
{
    public class Caja : BaseEntity
    {
        public Guid UsuarioId { get; private set; }

        public decimal MontoInicial { get; private set; }

        public DateTime FechaInicio { get; private set; }

        public DateTime? FechaCierre { get; private set; }

        public string Estado { get; private set; } = EstadosCaja.Abierta;

        public decimal? MontoContado { get; private set; }

        public string? Justificacion { get; private set; }

        public Usuario? Usuario { get; set; }

        public List<MovimientoCaja> Movimientos { get; set; } = new List<MovimientoCaja>();

        public Caja() { }

        public Caja(Guid usuarioId, decimal montoInicial, DateTime fechaInicio)
        {
            UsuarioId = usuarioId;
            MontoInicial = montoInicial;
            FechaInicio = fechaInicio;
        }

        public void Cerrar(decimal montoContado, string? justificacion)
        {
            Estado = EstadosCaja.Cerrada;
            FechaCierre = DateTime.UtcNow;
            MontoContado = montoContado;
            Justificacion = justificacion;
        }
    }
}
