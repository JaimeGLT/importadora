using HotChocolate.Authorization;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class MargenGananciaQuery
    {
        [Authorize]
        public async Task<MargenGanancia?> MargenGanancia([Service] IMargenGananciaRepositorio _db)
        {
            return await _db.GetUnico();
        }
    }
}
