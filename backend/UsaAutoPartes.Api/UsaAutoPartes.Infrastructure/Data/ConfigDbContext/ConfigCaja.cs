using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigCaja : IEntityTypeConfiguration<Caja>
    {
        public void Configure(EntityTypeBuilder<Caja> builder)
        {
            builder.ToTable("Caja");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.UsuarioId).IsRequired();

            builder.Property(x => x.MontoInicial).HasPrecision(10, 2).IsRequired();

            builder.Property(x => x.FechaInicio).IsRequired();

            builder.Property(x => x.Estado).IsRequired();

            builder.Property(x => x.MontoContado).HasPrecision(10, 2);

            builder.Property(x => x.Justificacion).HasMaxLength(500);

            builder.HasOne(x => x.Usuario)
                .WithMany()
                .HasForeignKey(x => x.UsuarioId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Caja_Usuario");

            builder.HasIndex(x => x.UsuarioId);
            builder.HasIndex(x => x.Estado);

            // Acompaña el soft-delete de Usuario: si el cajero fue eliminado lógicamente,
            // sus cajas no se exponen en queries por DbSet. Para incluirlas, usar IgnoreQueryFilters().
            builder.HasQueryFilter(x => x.Usuario.EliminadoEn == null);
        }
    }
}
