using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IConfigVentaRepositorio : IGenericRepositorio<ConfigVenta>
    {
        Task<ConfigVenta?> GetUnico();
    }
}
