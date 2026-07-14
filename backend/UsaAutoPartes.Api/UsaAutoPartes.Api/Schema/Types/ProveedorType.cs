using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class ProveedorType : ObjectType<Proveedor>
    {
        protected override void Configure(IObjectTypeDescriptor<Proveedor> proveedor)
        {
            base.Configure(proveedor);

            proveedor.Field(x => x.Importaciones).Ignore();
            
        }
    }
}
