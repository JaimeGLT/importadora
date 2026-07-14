using HotChocolate.Authorization;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class ImportacionQuery
    {
        [Authorize]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        [UseSorting]
        [UseFiltering]
        //[Authorize(Roles = new[] { UsuarioRoles.Admin })]
        public IQueryable<Importacion> importacion([Service] IImportacionRepositorio _db)
        {
            return _db.ImportacionQuery();
        }
    }
}
