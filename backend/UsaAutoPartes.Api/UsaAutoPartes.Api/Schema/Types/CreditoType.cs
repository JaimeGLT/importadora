using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class CreditoType : ObjectType<Credito>
    {
        protected override void Configure(IObjectTypeDescriptor<Credito> descriptor)
        {
            base.Configure(descriptor);
            descriptor.Field(x => x.Cliente).Type<ClienteType>();
            descriptor.Field(x => x.Cajero).Type<UsuarioResumenType>();
            descriptor.Field(x => x.Items).Type<ListType<CreditoItemType>>();
            descriptor.Field(x => x.Pagos).Type<ListType<CreditoPagoType>>();

            // RowVersion es la columna xmin de PostgreSQL (concurrencia optimista).
            // No es un dato de negocio: no debe exponerse en GraphQL ni entrar
            // en el FilterInputType generado por [UseFiltering].
            descriptor.Ignore(x => x.RowVersion);
        }
    }
}
