using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface ITipoCambioRepositorio : IGenericRepositorio<TipoCambio>
    {
        Task<TipoCambio?> GetUnico();
    }
}
