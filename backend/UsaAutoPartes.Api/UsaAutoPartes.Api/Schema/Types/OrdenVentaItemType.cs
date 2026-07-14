using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class OrdenVentaItemType : ObjectType<OrdenVentaItem>
    {
        protected override void Configure(IObjectTypeDescriptor<OrdenVentaItem> descriptor)
        {
            base.Configure(descriptor);
            descriptor.Ignore(x => x.Orden);
            descriptor.Field(x => x.Piezas).Type<ListType<OrdenVentaItemPiezaType>>();
        }
    }
}
