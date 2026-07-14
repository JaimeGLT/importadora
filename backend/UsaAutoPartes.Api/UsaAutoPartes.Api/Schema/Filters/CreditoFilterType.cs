using HotChocolate.Data.Filters;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Filters
{
    /// <summary>
    /// Filtro custom para Credito. Necesario porque el auto-generador de
    /// FilterInputType no sabe mapear RowVersion (columna xmin/xid de
    /// PostgreSQL) a un escalar de GraphQL y revienta el startup del schema.
    /// </summary>
    public class CreditoFilterType : FilterInputType<Credito>
    {
        protected override void Configure(IFilterInputTypeDescriptor<Credito> descriptor)
        {
            descriptor.Ignore(x => x.RowVersion);
        }
    }
}
