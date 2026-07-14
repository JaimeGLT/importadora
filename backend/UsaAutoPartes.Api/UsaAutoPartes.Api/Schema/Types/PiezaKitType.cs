using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class PiezaKitType : ObjectType<PiezaKit>
    {
        protected override void Configure(IObjectTypeDescriptor<PiezaKit> descriptor)
        {
            descriptor.Ignore(x => x.Producto);

            // Campos autogenerados por el backend.
            // El resto de las propiedades (id, id_Producto, nombre, cantidadPorKit,
            // stockActual, stockReservado) se autodescubren por convención de nombre.
            descriptor.Field(x => x.Orden).Type<IntType>();
            descriptor.Field(x => x.CodigoPieza).Type<StringType>();
        }
    }
}
