using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface ICajaRepositorio : IGenericRepositorio<Caja>
    {
        Task<Caja?> GetCajaActivaByUsuario(Guid usuarioId);
        IQueryable<Caja> CajaQuery();
    }
}
