using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class CajaType : ObjectType<Caja>
    {
        protected override void Configure(IObjectTypeDescriptor<Caja> descriptor)
        {
            descriptor.Ignore(x => x.Usuario);
        }
    }
}
