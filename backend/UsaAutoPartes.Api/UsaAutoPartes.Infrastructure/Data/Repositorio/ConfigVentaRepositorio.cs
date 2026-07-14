using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class ConfigVentaRepositorio(AppDbContext db) : GenericRepositorio<ConfigVenta>(db), IConfigVentaRepositorio
    {
        private readonly DbSet<ConfigVenta> _config = db.Set<ConfigVenta>();

        public async Task<ConfigVenta?> GetUnico() => await _config.FirstOrDefaultAsync();
    }
}
