using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IMargenGananciaRepositorio : IGenericRepositorio<MargenGanancia>
    {
        Task<MargenGanancia?> GetUnico();
    }
}
