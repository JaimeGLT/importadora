using HotChocolate.Authorization;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class MarcaQuery
    {
        [Authorize]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 100)]
        [UseProjection]
        [UseSorting]
        [UseFiltering]
        public IQueryable<Marca> marca([Service] IMarcaRepositorio _db)
        {
            return _db.MarcaQuery();
        }
    }
}
