using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Api.Schema.Types
{
    public class Importacion_DetalleType : ObjectType<Importacion_Detalle>
    {
        protected override void Configure(IObjectTypeDescriptor<Importacion_Detalle> build)
        {
            base.Configure(build);
            build.Field(x => x.Importacion).Ignore();
            build.Field(x => x.MarcaNavigation).Ignore();
            build.Field(x => x.Procedencia).Type<StringType>();
        }
    }
}
