using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class CreditoItemType : ObjectType<CreditoItem>
    {
        protected override void Configure(IObjectTypeDescriptor<CreditoItem> descriptor)
        {
            base.Configure(descriptor);
            descriptor.Field(x => x.Producto).Type<ProductoType>();
            descriptor.Field(x => x.Pieza).Type<PiezaKitType>();
        }
    }
}
