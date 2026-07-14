using UsaAutoPartes.Domain.Entities.IdentityDb;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class UsuarioResumenType : ObjectType<Usuario>
    {
        protected override void Configure(IObjectTypeDescriptor<Usuario> descriptor)
        {
            descriptor.BindFieldsExplicitly();
            descriptor.Field(x => x.Id).Name("id");
            descriptor.Field(x => x.Nombre).Name("nombre");
            descriptor.Field(x => x.Apellido).Name("apellido");
        }
    }
}
