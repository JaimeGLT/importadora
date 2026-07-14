using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigOrdenVenta : IEntityTypeConfiguration<OrdenVenta>
    {
        public void Configure(EntityTypeBuilder<OrdenVenta> builder)
        {
            builder.ToTable("OrdenVenta");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Estado).IsRequired().HasMaxLength(20);

            builder.Property(x => x.Fecha).IsRequired();

            builder.Property(x => x.FechaEsperandoPago).IsRequired(false);

            builder.HasIndex(x => x.Estado).HasDatabaseName("IX_OrdenVenta_Estado");

            builder.HasIndex(x => x.Id_Cajero).HasDatabaseName("IX_OrdenVenta_Cajero");

            builder.Property(x => x.Modalidad).IsRequired().HasMaxLength(20);
            builder.HasIndex(x => x.Modalidad).HasDatabaseName("IX_OrdenVenta_Modalidad");

            builder.Property(x => x.MontoDescuento).HasPrecision(10, 2);

            builder.HasOne(x => x.Descuento)
                .WithMany()
                .HasForeignKey(x => x.Id_Descuento)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OrdenVenta_Descuento");

            builder.HasIndex(x => x.Id_Descuento).HasDatabaseName("IX_OrdenVenta_Id_Descuento");

            builder.HasOne(x => x.Cliente)
                .WithMany()
                .HasForeignKey(x => x.Id_Cliente)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OrdenVenta_Cliente");

            builder.HasOne(x => x.Caja)
                .WithMany()
                .HasForeignKey(x => x.Id_Caja)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OrdenVenta_Caja");

            builder.HasOne(x => x.Cajero)
                .WithMany()
                .HasForeignKey(x => x.Id_Cajero)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OrdenVenta_Cajero");

            builder.HasOne(x => x.Almacenero)
                .WithMany()
                .HasForeignKey(x => x.Id_Almacenero)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OrdenVenta_Almacenero");

            // Acompaña el soft-delete de Usuario: si el cajero (o el almacenero, si fue
            // asignado) fue eliminado lógicamente, la orden no se expone en queries por DbSet.
            // Para incluirlas, usar IgnoreQueryFilters(). El check explícito de null en
            // Almacenero es porque Id_Almacenero es Guid? (opcional).
            builder.HasQueryFilter(x =>
                x.Cajero.EliminadoEn == null &&
                (x.Almacenero == null || x.Almacenero.EliminadoEn == null));
        }
    }
}
