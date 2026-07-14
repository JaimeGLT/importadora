using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.CajaEnums;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class CajaRepositorio(AppDbContext db) : GenericRepositorio<Caja>(db), ICajaRepositorio
    {
        private readonly DbSet<Caja> _cajas = db.Set<Caja>();

        public async Task<Caja?> GetCajaActivaByUsuario(Guid usuarioId)
        {
            return await _cajas.FirstOrDefaultAsync(x => x.UsuarioId == usuarioId && x.Estado == EstadosCaja.Abierta);
        }

        public IQueryable<Caja> CajaQuery()
        {
            return _cajas.AsQueryable();
        }
    }
}
