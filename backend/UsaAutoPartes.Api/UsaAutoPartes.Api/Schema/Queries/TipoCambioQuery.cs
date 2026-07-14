using HotChocolate.Authorization;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class TipoCambioQuery
    {
        [Authorize]
        public async Task<TipoCambio?> TipoCambio([Service] ITipoCambioRepositorio _db)
        {
            return await _db.GetUnico();
        }
    }
}
