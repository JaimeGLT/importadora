using HotChocolate.Authorization;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class ProductoQuery
    {
        [Authorize]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        [UseFiltering]
        [UseSorting]
        //[Authorize(Roles = new[] { UsuarioRoles.Admin })]
        public IQueryable<Producto> Productos([Service] IProductoRepositorio _db)
        {
            return _db.Query();
        }

        /// <summary>Resuelve un código escaneado: match exacto contra Codigo/CodigoAux/CodigoAux2, con fallback al último segmento si el string contiene guiones (compatibilidad con etiquetas antiguas).</summary>
        [Authorize]
        public Task<Producto?> ProductoPorCodigo(
            string codigo,
            [Service] IProductoRepositorio db)
        {
            return db.BuscarPorCodigoEscaneo(codigo);
        }

        /// <summary>Búsqueda por texto/código con letras (codigo, nombre, aux, codigo universal de piezas).</summary>
        [Authorize]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        public IQueryable<Producto> BuscarProductos(
            string termino,
            [Service] IProductoRepositorio db)
        {
            return db.BuscarPorTermino(termino);
        }
    }
}
