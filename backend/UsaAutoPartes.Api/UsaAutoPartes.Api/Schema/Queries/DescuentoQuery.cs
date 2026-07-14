using HotChocolate.Authorization;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class DescuentoQuery
    {
        [Authorize]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        [UseSorting]
        [UseFiltering]
        //[Authorize(Roles = new[] { UsuarioRoles.Admin })]
        public IQueryable<Descuento> Descuento([Service] IDescuentoRepositorio _db)
        {
            return _db.Query();
        }
    }
}
