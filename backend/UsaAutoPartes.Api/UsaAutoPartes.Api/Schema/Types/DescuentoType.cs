using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class DescuentoType : ObjectType<Descuento>
    {
        protected override void Configure(IObjectTypeDescriptor<Descuento> descriptor)
        {
            base.Configure(descriptor);
            descriptor.Field(x => x.Id).Type<IntType>();
            descriptor.Field(x => x.Nombre).Type<StringType>();
            descriptor.Field(x => x.CantDescuento).Type<DecimalType>();
            descriptor.Field(x => x.Color).Type<StringType>();
            descriptor.Field(x => x.Activo).Type<BooleanType>();
        }
    }
}
