using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class MovimientoCajaType : ObjectType<MovimientoCaja>
    {
        protected override void Configure(IObjectTypeDescriptor<MovimientoCaja> descriptor)
        {
            descriptor.Ignore(x => x.Caja);
        }
    }
}
