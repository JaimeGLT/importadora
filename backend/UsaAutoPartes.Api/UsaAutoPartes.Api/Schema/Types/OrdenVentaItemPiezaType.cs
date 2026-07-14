using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class OrdenVentaItemPiezaType : ObjectType<OrdenVentaItemPieza>
    {
        protected override void Configure(IObjectTypeDescriptor<OrdenVentaItemPieza> descriptor)
        {
            base.Configure(descriptor);
            descriptor.Ignore(x => x.Item);
            descriptor.Field(x => x.Pieza).Type<PiezaKitType>();
        }
    }
}
