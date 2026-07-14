using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class ProductoType : ObjectType<Producto>
    {
        protected override void Configure(IObjectTypeDescriptor<Producto> producto)
        {
            base.Configure(producto);
            producto.Field(p => p.Id).Type<NonNullType<IdType>>();
            producto.Field(p => p.Codigo).Type<NonNullType<StringType>>();
            producto.Field(p => p.Nombre).Type<StringType>();
            producto.Field(p => p.MarcaId).Type<IntType>();
            // Nav-property de la marca. Resuelta por [UseProjection] en ProductoQuery
            // (ver ProductoQuery.cs). Null si el producto no tiene marca asignada.
            producto.Field(p => p.Marca)
                .Type<MarcaType>()
                .Description("Marca asociada al producto (FK MarcaId). Null si el producto no tiene marca asignada.");
            producto.Field(p => p.Procedencia).Type<StringType>();
            producto.Field(p => p.Descripcion).Type<StringType>();
            producto.Field(p => p.Categoria).Type<StringType>();
            producto.Field(P => P.HistorialPrecios).Type<ListType<HistorialPrecioType>>();
            producto.Field(P => P.PiezasKit).Type<ListType<PiezaKitType>>();

            // Galería de imágenes. Resolver basado en el repo (no en la nav property
            // `Imagenes`) para no depender de EF Include — la nav queda vacía cuando
            // HotChocolate proyecta Producto sin `[UseProjection]`, o aunque la proyecte
            // no se garantiza el filtro server-side `Estado == Activa` + el orden. Con
            // un resolver async que llama a `IProductoImagenRepositorio` siempre se hace
            // la query correcta. Trade-off: 1 query extra por producto (aceptable, las
            // páginas son chicas y el repo es AsNoTracking).
            producto.Field("imagenes")
                .Type<ListType<ProductoImagenType>>()
                .Description("Galería de imágenes activas del producto, ordenadas por Orden ASC.")
                .Resolve(async ctx =>
                {
                    var productoId = ctx.Parent<Producto>().Id;
                    var repo = ctx.Service<IProductoImagenRepositorio>();
                    return await repo.GetByProductoAsync(productoId);
                });

            // Computed: imagen portada del producto. Es la primera imagen de la
            // galería por Orden ASC (la que se ve primero en el visor), NO la
            // marcada con la estrella. La estrella (EsPrincipal) es un "favorito"
            // separado que no afecta la portada. Null si el producto no tiene
            // imágenes activas.
            producto.Field("imagenPrincipal")
                .Type<ProductoImagenType>()
                .Description("Imagen de portada del producto: la primera imagen de la galería por Orden ASC. Es la que se muestra en la lista de inventario y como miniatura inicial en la card móvil. Null si el producto no tiene imágenes.")
                .Resolve(async ctx =>
                {
                    var productoId = ctx.Parent<Producto>().Id;
                    var repo = ctx.Service<IProductoImagenRepositorio>();
                    var imagenes = await repo.GetByProductoAsync(productoId);
                    // GetByProductoAsync ya retorna ordenado por Orden ASC, así
                    // que la primera es la portada.
                    return imagenes.FirstOrDefault();
                });

            producto.Field("calcularStockKit")
                .Type<IntType>()
                .Description("Stock total (raw) del kit, sin descontar reservas de piezas. Útil para inventario físico.")
                .Resolve(ctx => ctx.Parent<Producto>().CalcularStockKit());

            producto.Field("calcularStockKitDisponible")
                .Type<IntType>()
                .Description("Stock disponible del kit, descontando las piezas reservadas por otras órdenes. Es el número que se muestra en la lista de búsqueda del cajero.")
                .Resolve(ctx => ctx.Parent<Producto>().CalcularStockKitDisponible());
        }
    }
}
