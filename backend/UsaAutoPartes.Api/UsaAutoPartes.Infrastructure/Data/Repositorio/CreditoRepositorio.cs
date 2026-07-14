using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class CreditoRepositorio(AppDbContext db) : GenericRepositorio<Credito>(db), ICreditoRepositorio
    {
        private readonly DbSet<Credito> _creditos = db.Set<Credito>();

        public IQueryable<Credito> CreditoQuery()
        {
            return _creditos.AsQueryable();
        }

        public async Task<Credito?> GetConItemsYPagosAsync(int id)
        {
            return await _creditos
                .Include(x => x.Cliente)
                .Include(x => x.Cajero)
                .Include(x => x.Items)
                    .ThenInclude(i => i.Producto)
                        .ThenInclude(p => p.Marca)
                .Include(x => x.Items)
                    .ThenInclude(i => i.Pieza)
                .Include(x => x.Pagos)
                    .ThenInclude(p => p.Usuario)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<Credito?> GetParaActualizarAsync(int id)
        {
            // Tracking ON para que EF Core capture el RowVersion original y lo use
            // en la cláusula WHERE del UPDATE. Si la fila cambió, el SaveChanges
            // lanza DbUpdateConcurrencyException.
            return await _creditos
                .FirstOrDefaultAsync(x => x.Id == id);
        }
    }
}
