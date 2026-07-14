using HotChocolate.Authorization;
using UsaAutoPartes.Api.Schema.Filters;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class CreditoQuery
    {
        // Cajero/Admin/Operador: lista de créditos con paginación y filtros.
        [Authorize(Roles = new[] { UsuarioRoles.Cajero, UsuarioRoles.Admin, UsuarioRoles.Operador })]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        [UseSorting]
        [UseFiltering(typeof(CreditoFilterType))]
        public IQueryable<Credito> Creditos([Service] ICreditoRepositorio _db)
        {
            return _db.CreditoQuery();
        }

        // Detalle de un crédito (incluye cliente, items y pagos).
        [Authorize(Roles = new[] { UsuarioRoles.Cajero, UsuarioRoles.Admin, UsuarioRoles.Operador })]
        public Task<Credito?> CreditoDetalle([Service] ICreditoRepositorio _db, int id)
        {
            return _db.GetConItemsYPagosAsync(id);
        }
    }
}
