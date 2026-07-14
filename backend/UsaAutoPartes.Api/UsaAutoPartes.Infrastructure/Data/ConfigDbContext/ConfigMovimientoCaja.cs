using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigMovimientoCaja : IEntityTypeConfiguration<MovimientoCaja>
    {
        public void Configure(EntityTypeBuilder<MovimientoCaja> builder)
        {
            builder.ToTable("MovimientoCaja");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id_Caja).IsRequired();

            builder.Property(x => x.Tipo).IsRequired();

            builder.Property(x => x.Categoria).IsRequired();

            builder.Property(x => x.TipoPago).IsRequired();

            builder.Property(x => x.Monto).HasPrecision(10, 2).IsRequired();

            builder.Property(x => x.Motivo).IsRequired();

            builder.Property(x => x.Fecha).HasDefaultValueSql("CURRENT_TIMESTAMP");

            builder.HasOne(x => x.Caja)
                .WithMany(x => x.Movimientos)
                .HasForeignKey(x => x.Id_Caja)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_MovimientoCaja_Caja");

            builder.HasIndex(x => x.Id_Caja);
            builder.HasIndex(x => x.Tipo);
            builder.HasIndex(x => x.TipoPago);

            // Acompaña el filtro de Caja: si la caja está oculta (cajero eliminado
            // lógicamente), sus movimientos tampoco se exponen en queries por DbSet.
            // Para incluirlos, usar IgnoreQueryFilters().
            builder.HasQueryFilter(x => x.Caja.Usuario.EliminadoEn == null);
        }
    }
}
