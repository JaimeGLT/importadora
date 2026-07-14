using HotChocolate.Authorization;
using System.Security.Claims;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class CajaQuery
    {
        [Authorize]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        [UseSorting]
        [UseFiltering]
        public IQueryable<Caja> MisCajas([Service] ICajaRepositorio _db, ClaimsPrincipal claims)
        {
            var userId = Guid.Parse(claims.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            return _db.CajaQuery().Where(x => x.UsuarioId == userId);
        }
    }
}
