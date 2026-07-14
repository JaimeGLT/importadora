using HotChocolate.Data;
using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Infrastructure.Data;

namespace UsaAutoPartes.Api.Schema.Types
{
    [ExtendObjectType(typeof(Importacion_Detalle))]
    public class ImportacionDetalleExtensions
    {
        [GraphQLName("marca")]
        [IsProjected(false)]
        public async Task<string> GetMarcaNombre(
            [Parent] Importacion_Detalle detalle,
            [Service] AppDbContext db,
            CancellationToken cancellationToken)
        {
            if (!detalle.MarcaId.HasValue)
                return string.Empty;

            if (detalle.MarcaNavigation is not null)
                return detalle.MarcaNavigation.Nombre;

            return await db.Marcas
                .AsNoTracking()
                .Where(m => m.Id == detalle.MarcaId.Value)
                .Select(m => m.Nombre)
                .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
        }
    }
}
