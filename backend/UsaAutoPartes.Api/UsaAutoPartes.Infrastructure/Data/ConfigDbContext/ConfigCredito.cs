using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigCredito : IEntityTypeConfiguration<Credito>
    {
        public void Configure(EntityTypeBuilder<Credito> builder)
        {
            builder.ToTable("Credito");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Estado).IsRequired().HasMaxLength(20);
            builder.Property(x => x.Total).HasPrecision(18, 2);
            builder.Property(x => x.SaldoPendiente).HasPrecision(18, 2);
            builder.Property(x => x.MontoDescuento).HasPrecision(18, 2);
            builder.Property(x => x.Nota).HasMaxLength(500);
            builder.Property(x => x.FechaCreacion).IsRequired();

            // Concurrencia optimista: xmin de PostgreSQL.
            // EF Core lo usa para detectar updates perdidos entre dos transacciones.
            builder.Property(x => x.RowVersion)
                .HasColumnName("xmin")
                .HasColumnType("xid")
                .ValueGeneratedOnAddOrUpdate()
                .IsConcurrencyToken();

            // Check constraint: el saldo no puede ser negativo (defensa en profundidad).
            builder.ToTable(t =>
            {
                t.HasCheckConstraint("CK_Credito_SaldoPendiente_NoNegativo", "\"SaldoPendiente\" >= 0");
            });

            builder.HasOne(x => x.Cliente)
                .WithMany()
                .HasForeignKey(x => x.Id_Cliente)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Credito_Cliente");

            builder.HasOne(x => x.OrdenVenta)
                .WithMany()
                .HasForeignKey(x => x.Id_OrdenVenta)
                .OnDelete(DeleteBehavior.SetNull)
                .IsRequired(false)
                .HasConstraintName("FK_Credito_OrdenVenta");

            builder.HasOne(x => x.Cajero)
                .WithMany()
                .HasForeignKey(x => x.Id_Cajero)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Credito_Cajero");

            builder.HasOne(x => x.CajaOrigen)
                .WithMany()
                .HasForeignKey(x => x.Id_CajaOrigen)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Credito_CajaOrigen");

            builder.HasOne(x => x.Descuento)
                .WithMany()
                .HasForeignKey(x => x.Id_Descuento)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Credito_Descuento");

            builder.HasIndex(x => x.Id_Cliente).HasDatabaseName("IX_Credito_Cliente");
            builder.HasIndex(x => x.Estado).HasDatabaseName("IX_Credito_Estado");
            builder.HasIndex(x => new { x.Id_Cliente, x.Estado }).HasDatabaseName("IX_Credito_Cliente_Estado");
            builder.HasIndex(x => x.FechaCreacion).HasDatabaseName("IX_Credito_FechaCreacion");
            builder.HasIndex(x => x.Id_Descuento).HasDatabaseName("IX_Credito_Id_Descuento");

            // Acompaña el soft-delete de Usuario: si el cajero fue eliminado lógicamente,
            // sus créditos no se exponen en queries por DbSet. Para incluirlos, usar IgnoreQueryFilters().
            builder.HasQueryFilter(x => x.Cajero.EliminadoEn == null);
        }
    }
}
