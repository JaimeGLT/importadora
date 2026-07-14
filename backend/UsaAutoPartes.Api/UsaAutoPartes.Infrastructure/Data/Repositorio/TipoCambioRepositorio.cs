using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class TipoCambioRepositorio(AppDbContext db) : GenericRepositorio<TipoCambio>(db), ITipoCambioRepositorio
    {
        private readonly DbSet<TipoCambio> _tipoCambio = db.Set<TipoCambio>();

        public async Task<TipoCambio?> GetUnico() => await _tipoCambio.FirstOrDefaultAsync();
    }
}
