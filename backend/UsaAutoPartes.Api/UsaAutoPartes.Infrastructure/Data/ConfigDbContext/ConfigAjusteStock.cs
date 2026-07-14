using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigAjusteStock : IEntityTypeConfiguration<AjusteStock>
    {
        public void Configure(EntityTypeBuilder<AjusteStock> builder)
        {
            builder.ToTable("AjusteStock");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Motivo).IsRequired().HasMaxLength(200);

            builder.Property(x => x.Nota).HasMaxLength(500);

            builder.Property(x => x.Fecha).HasDefaultValueSql("CURRENT_TIMESTAMP");

            builder.HasOne(x => x.Producto)
                .WithMany(p => p.AjustesStock)
                .HasForeignKey(x => x.Id_Producto)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_AjusteStock_Producto");

            builder.HasOne(x => x.Usuario)
                .WithMany()
                .HasForeignKey(x => x.UsuarioId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_AjusteStock_Usuario");

            builder.HasIndex(x => x.Id_Producto).HasDatabaseName("IX_AjusteStock_IdProducto");

            builder.HasIndex(x => x.Fecha).HasDatabaseName("IX_AjusteStock_Fecha");
        }
    }
}
