using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class OrdenVentaType : ObjectType<OrdenVenta>
    {
        protected override void Configure(IObjectTypeDescriptor<OrdenVenta> descriptor)
        {
            base.Configure(descriptor);
            descriptor.Ignore(x => x.Caja);
            descriptor.Field(x => x.Cajero).Type<UsuarioResumenType>();
            descriptor.Field(x => x.Almacenero).Type<UsuarioResumenType>();
            descriptor.Field(x => x.Id_Descuento).Type<IntType>();
            descriptor.Field(x => x.MontoDescuento).Type<DecimalType>();
            descriptor.Field(x => x.Descuento).Type<DescuentoType>();
            descriptor.Field(x => x.Items).Type<ListType<OrdenVentaItemType>>();
        }
    }
}
