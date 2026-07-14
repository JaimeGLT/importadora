using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public class MargenGanancia : BaseEntity
    {
        public decimal Valor { get; private set; }
        public DateTime Fecha { get; private set; }

        public MargenGanancia() { }

        public MargenGanancia(decimal valor)
        {
            Valor = valor;
            Fecha = DateTime.UtcNow;
        }

        public void Actualizar(decimal valor)
        {
            Valor = valor;
            Fecha = DateTime.UtcNow;
        }
    }
}
