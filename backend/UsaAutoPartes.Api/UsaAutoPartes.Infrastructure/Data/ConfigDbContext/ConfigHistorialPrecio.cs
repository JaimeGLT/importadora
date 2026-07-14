using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigHistorialPrecio : IEntityTypeConfiguration<HistorialPrecio>
    {
        public void Configure(EntityTypeBuilder<HistorialPrecio> builder)
        {
            builder.ToTable("HistorialPrecio");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Costo).HasPrecision(10, 2).IsRequired();

            builder.Property(x => x.Precio).HasPrecision(10, 2).IsRequired();

            builder.Property(x => x.ConversionABs).HasPrecision(10, 2).IsRequired();

            builder.Property(x => x.Nota).HasMaxLength(500);

            builder.Property(x => x.Fecha).HasDefaultValueSql("CURRENT_TIMESTAMP");

            // Relaci�n con Producto
            builder.HasOne(x => x.Producto)
                .WithMany(p => p.HistorialPrecios)
                .HasForeignKey(x => x.Id_producto)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_HistorialPrecio_Producto");

            builder.HasIndex(x => x.Id_producto).HasDatabaseName("IX_HistorialPrecio_IdProducto");

            builder.HasIndex(x => x.Fecha).HasDatabaseName("IX_HistorialPrecio_Fecha");
        }
    }
}