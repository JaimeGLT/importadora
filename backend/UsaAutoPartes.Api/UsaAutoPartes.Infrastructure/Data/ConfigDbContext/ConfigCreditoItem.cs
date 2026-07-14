using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigCreditoItem : IEntityTypeConfiguration<CreditoItem>
    {
        public void Configure(EntityTypeBuilder<CreditoItem> builder)
        {
            builder.ToTable("CreditoItem");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Cantidad).IsRequired();
            builder.Property(x => x.PrecioUnitario).HasPrecision(18, 2);

            builder.HasOne(x => x.Credito)
                .WithMany(x => x.Items)
                .HasForeignKey(x => x.Id_Credito)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_CreditoItem_Credito");

            builder.HasOne(x => x.Producto)
                .WithMany()
                .HasForeignKey(x => x.Id_Producto)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_CreditoItem_Producto");

            builder.HasOne(x => x.Pieza)
                .WithMany()
                .HasForeignKey(x => x.Id_Pieza)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_CreditoItem_Pieza");

            builder.HasIndex(x => x.Id_Credito).HasDatabaseName("IX_CreditoItem_Credito");

            // Acompaña el filtro de Credito: si el crédito está oculto (cajero eliminado
            // lógicamente), sus items tampoco se exponen en queries por DbSet.
            // Para incluirlos, usar IgnoreQueryFilters().
            builder.HasQueryFilter(x => x.Credito.Cajero.EliminadoEn == null);
        }
    }
}
