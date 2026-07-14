using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class MargenGananciaRepositorio(AppDbContext db) : GenericRepositorio<MargenGanancia>(db), IMargenGananciaRepositorio
    {
        private readonly DbSet<MargenGanancia> _margen = db.Set<MargenGanancia>();

        public async Task<MargenGanancia?> GetUnico() => await _margen.FirstOrDefaultAsync();
    }
}
