using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class TipoCambioType : ObjectType<TipoCambio>
    {
        protected override void Configure(IObjectTypeDescriptor<TipoCambio> descriptor)
        {
            base.Configure(descriptor);
        }
    }
}
