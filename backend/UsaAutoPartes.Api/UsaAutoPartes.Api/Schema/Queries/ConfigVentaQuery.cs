using HotChocolate.Authorization;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class ConfigVentaQuery
    {
        [Authorize]
        public async Task<ConfigVenta?> ConfigVenta([Service] IConfigVentaRepositorio _db)
        {
            return await _db.GetUnico();
        }
    }
}
