using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class HistorialPrecioType : ObjectType<HistorialPrecio>
    {
        protected override void Configure(IObjectTypeDescriptor<HistorialPrecio> builder)
        {
            builder.Field(x => x.Producto).Ignore();
        }
    }
}
