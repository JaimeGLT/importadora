using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigImportacion_Detalle : IEntityTypeConfiguration<Importacion_Detalle>
    {
        public void Configure(EntityTypeBuilder<Importacion_Detalle> builder)
        {
            builder.ToTable("Importacion_Detalle");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Codigo).IsRequired();

            builder.Property(x => x.Nombre).IsRequired();

            builder.Property(x => x.Costo).HasPrecision(10, 2);

            builder.Property(x => x.Precio).HasPrecision(10, 2);

            builder.Property(x => x.ConversionABs).HasPrecision(10, 2);

            builder.Property(x => x.Tipo).HasMaxLength(50);

            builder.HasOne(x => x.MarcaNavigation)
                .WithMany()
                .HasForeignKey(x => x.MarcaId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(x => x.Id_Importacion).HasDatabaseName("IX_ImportacionDetalle_IdImportacion");

            builder.HasIndex(x => x.Codigo).HasDatabaseName("IX_ImportacionDetalle_Codigo");

            // Relación con Importacion
            builder.HasOne(x => x.Importacion)
                .WithMany(i => i.Detalles)
                .HasForeignKey(x => x.Id_Importacion)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_Importacion_Detalle_Importacion");
        }
    }
}
