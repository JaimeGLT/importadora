using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities.IdentityDb;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigHorarioBloqueo : IEntityTypeConfiguration<HorarioBloqueo>
    {
        public void Configure(EntityTypeBuilder<HorarioBloqueo> builder)
        {
            builder.ToTable("HorarioBloqueo");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.HoraInicio).IsRequired();
            builder.Property(x => x.HoraFin).IsRequired();
            builder.Property(x => x.Activo).HasDefaultValue(true);

            builder.HasOne(x => x.Usuario)
                   .WithMany()
                   .HasForeignKey(x => x.UsuarioId)
                   .OnDelete(DeleteBehavior.Cascade);

            // Acompaña el soft-delete de Usuario: los horarios de usuarios eliminados
            // lógicamente no se exponen en queries por DbSet.
            builder.HasQueryFilter(x => x.Usuario.EliminadoEn == null);
        }
    }
}
