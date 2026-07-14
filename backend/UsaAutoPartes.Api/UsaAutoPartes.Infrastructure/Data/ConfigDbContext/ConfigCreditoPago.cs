using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigCreditoPago : IEntityTypeConfiguration<CreditoPago>
    {
        public void Configure(EntityTypeBuilder<CreditoPago> builder)
        {
            builder.ToTable("CreditoPago");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Monto).HasPrecision(18, 2);
            builder.Property(x => x.TipoPago).IsRequired().HasMaxLength(20);
            builder.Property(x => x.Nota).HasMaxLength(500);
            builder.Property(x => x.Fecha).HasDefaultValueSql("CURRENT_TIMESTAMP");

            builder.HasOne(x => x.Credito)
                .WithMany(x => x.Pagos)
                .HasForeignKey(x => x.Id_Credito)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_CreditoPago_Credito");

            builder.HasOne(x => x.Caja)
                .WithMany()
                .HasForeignKey(x => x.Id_Caja)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_CreditoPago_Caja");

            builder.HasOne(x => x.Usuario)
                .WithMany()
                .HasForeignKey(x => x.Id_Usuario)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_CreditoPago_Usuario");

            builder.HasOne(x => x.MovimientoCaja)
                .WithMany()
                .HasForeignKey(x => x.Id_MovimientoCaja)
                .OnDelete(DeleteBehavior.SetNull)
                .IsRequired(false)
                .HasConstraintName("FK_CreditoPago_MovimientoCaja");

            builder.HasIndex(x => x.Id_Credito).HasDatabaseName("IX_CreditoPago_Credito");
            builder.HasIndex(x => x.Fecha).HasDatabaseName("IX_CreditoPago_Fecha");

            // Acompaña el soft-delete de Usuario: si el usuario que registró el pago fue
            // eliminado lógicamente, sus pagos no se exponen en queries por DbSet.
            // Para incluirlos, usar IgnoreQueryFilters().
            builder.HasQueryFilter(x => x.Usuario.EliminadoEn == null);
        }
    }
}
