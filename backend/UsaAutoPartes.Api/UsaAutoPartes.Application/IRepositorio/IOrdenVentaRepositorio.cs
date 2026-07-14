using UsaAutoPartes.Application.Dtos.ComisionDtos;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IOrdenVentaRepositorio : IGenericRepositorio<OrdenVenta>
    {
        Task<OrdenVenta?> GetConItems(int id);
        IQueryable<OrdenVenta> OrdenQuery();
        Task<List<ResumenComisionDto>> GetResumenComisionesAsync(DateTime desde, DateTime hasta);
    }
}
