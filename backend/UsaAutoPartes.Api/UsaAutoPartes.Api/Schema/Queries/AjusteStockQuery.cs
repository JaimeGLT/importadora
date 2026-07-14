using HotChocolate.Authorization;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class AjusteStockQuery
    {
        [Authorize]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 25)]
        [UseProjection]
        [UseSorting]
        [UseFiltering]
        public IQueryable<AjusteStock> AjustesStock([Service] IAjusteStockRepositorio _db)
        {
            return _db.AjustesQuery();
        }
    }
}
