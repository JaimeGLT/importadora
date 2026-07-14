using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class CreditoPagoType : ObjectType<CreditoPago>
    {
        protected override void Configure(IObjectTypeDescriptor<CreditoPago> descriptor)
        {
            base.Configure(descriptor);
            descriptor.Field(x => x.Usuario).Type<UsuarioResumenType>();
            descriptor.Field(x => x.MovimientoCaja).Type<MovimientoCajaType>();
        }
    }
}
