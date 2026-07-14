using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class MarcaType : ObjectType<Marca>
    {
        protected override void Configure(IObjectTypeDescriptor<Marca> marca)
        {
            base.Configure(marca);

            // Inverse nav: romper el ciclo Producto ↔ Marca en el schema. Si se
            // expone, cualquier query de marca terminaría trayendo todos los
            // productos y se vuelve recursivo.
            marca.Ignore(m => m.Productos);

            marca.Field(m => m.Id).Type<NonNullType<IdType>>();
            marca.Field(m => m.Nombre).Type<NonNullType<StringType>>();
        }
    }
}
