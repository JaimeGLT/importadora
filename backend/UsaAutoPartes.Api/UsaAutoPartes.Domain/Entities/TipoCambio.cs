using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public class TipoCambio : BaseEntity
    {
        public decimal PrecioDolar { get; private set; }

        public DateTime Fecha { get; private set; }

        public TipoCambio() { }

        public TipoCambio(decimal precioDolar)
        {
            PrecioDolar = precioDolar;
            Fecha = DateTime.UtcNow;
        }

        public void Actualizar(decimal precioDolar)
        {
            PrecioDolar = precioDolar;
            Fecha = DateTime.UtcNow;
        }
    }
}
