using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigPiezaKit : IEntityTypeConfiguration<PiezaKit>
    {
        public void Configure(EntityTypeBuilder<PiezaKit> builder)
        {
            builder.ToTable("PiezaKit");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id_Producto).IsRequired();

            builder.Property(x => x.Nombre).IsRequired();

            builder.Property(x => x.CantidadPorKit).IsRequired();

            builder.Property(x => x.StockActual).IsRequired();

            builder.Property(x => x.Orden).IsRequired();

            builder.Property(x => x.CodigoPieza)
                .IsRequired()
                .HasMaxLength(120);

            builder.HasOne(x => x.Producto)
                .WithMany(x => x.PiezasKit)
                .HasForeignKey(x => x.Id_Producto)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired()
                .HasConstraintName("FK_PiezaKit_Producto");

            builder.HasIndex(x => x.Id_Producto);

            // Evita que dos piezas del mismo kit compartan Orden.
            builder.HasIndex(x => new { x.Id_Producto, x.Orden })
                .IsUnique()
                .HasDatabaseName("IX_PiezaKit_Producto_Orden");

            // Evita que dos piezas del mismo kit compartan CodigoPieza.
            builder.HasIndex(x => new { x.Id_Producto, x.CodigoPieza })
                .IsUnique()
                .HasDatabaseName("IX_PiezaKit_Producto_CodigoPieza");
        }
    }
}
