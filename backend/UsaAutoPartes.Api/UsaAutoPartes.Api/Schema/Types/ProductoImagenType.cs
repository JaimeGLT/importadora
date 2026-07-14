using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class ProductoImagenType : ObjectType<ProductoImagen>
    {
        protected override void Configure(IObjectTypeDescriptor<ProductoImagen> descriptor)
        {
            descriptor.Ignore(x => x.Producto);

            // Bindings explícitos: la entity usa nombres "español/legacy"
            // (UrlPublica, LlaveObjeto, Id_Producto, TipoContenido, TamanoBytes,
            // FechaSubida) y el contrato GraphQL usa los del DTO de Application
            // (url, key, productoId, contentType, tamanoBytes, fechaSubida).
            // La convención default solo convierte PascalCase→camelCase, no
            // renombra ni quita guiones bajos, así que hay que mapear uno por uno.
            descriptor.Field(f => f.Id).Type<NonNullType<IntType>>();
            descriptor.Field(f => f.Id_Producto).Name("productoId").Type<NonNullType<IntType>>();
            descriptor.Field(f => f.UrlPublica).Name("url").Type<NonNullType<StringType>>();
            descriptor.Field(f => f.LlaveObjeto).Name("key").Type<NonNullType<StringType>>();
            descriptor.Field(f => f.NombreArchivo).Type<NonNullType<StringType>>();
            descriptor.Field(f => f.TipoContenido).Name("contentType").Type<NonNullType<StringType>>();
            descriptor.Field(f => f.TamanoBytes).Name("tamanoBytes").Type<NonNullType<LongType>>();
            descriptor.Field(f => f.AnchoPx).Name("anchoPx").Type<IntType>();
            descriptor.Field(f => f.AltoPx).Name("altoPx").Type<IntType>();
            descriptor.Field(f => f.Orden).Type<NonNullType<IntType>>();
            descriptor.Field(f => f.EsPrincipal).Name("esPrincipal").Type<NonNullType<BooleanType>>();
            descriptor.Field(f => f.Estado).Type<NonNullType<StringType>>();
            descriptor.Field(f => f.FechaSubida).Name("fechaSubida").Type<NonNullType<DateTimeType>>();
            descriptor.Field(f => f.FechaEliminacion).Name("fechaEliminacion").Type<DateTimeType>();
        }
    }
}
