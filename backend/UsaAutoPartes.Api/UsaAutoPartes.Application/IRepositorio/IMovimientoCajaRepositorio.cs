using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IMovimientoCajaRepositorio : IGenericRepositorio<MovimientoCaja>
    {
        IQueryable<MovimientoCaja> MovimientoQuery();
    }
}
