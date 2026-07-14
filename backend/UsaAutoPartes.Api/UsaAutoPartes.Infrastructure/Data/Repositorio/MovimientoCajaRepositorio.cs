using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class MovimientoCajaRepositorio(AppDbContext db) : GenericRepositorio<MovimientoCaja>(db), IMovimientoCajaRepositorio
    {
        private readonly DbSet<MovimientoCaja> _movimientos = db.Set<MovimientoCaja>();

        public IQueryable<MovimientoCaja> MovimientoQuery()
        {
            return _movimientos.AsQueryable();
        }
    }
}
