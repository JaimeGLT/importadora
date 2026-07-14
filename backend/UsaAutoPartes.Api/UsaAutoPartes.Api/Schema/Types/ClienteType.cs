using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class ClienteType : ObjectType<Cliente>
    {
        protected override void Configure(IObjectTypeDescriptor<Cliente> descriptor)
        {
            base.Configure(descriptor);
        }
    }
}
