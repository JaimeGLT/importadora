using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigOrdenVentaItemPieza : IEntityTypeConfiguration<OrdenVentaItemPieza>
    {
        public void Configure(EntityTypeBuilder<OrdenVentaItemPieza> builder)
        {
            builder.ToTable("OrdenVentaItemPieza");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.PrecioUnitario).HasPrecision(10, 2);

            builder.HasOne(x => x.Item)
                .WithMany(x => x.Piezas)
                .HasForeignKey(x => x.Id_Item)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_OrdenVentaItemPieza_Item");

            builder.HasOne(x => x.Pieza)
                .WithMany()
                .HasForeignKey(x => x.Id_Pieza)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_OrdenVentaItemPieza_Pieza");

            // Acompaña el filtro de OrdenVentaItem: si el item está oculto (la orden
            // está oculta porque su cajero/almacenero fue eliminado lógicamente), sus
            // piezas tampoco se exponen en queries por DbSet. Para incluirlas, usar IgnoreQueryFilters().
            builder.HasQueryFilter(x =>
                x.Item.Orden.Cajero.EliminadoEn == null &&
                (x.Item.Orden.Almacenero == null || x.Item.Orden.Almacenero.EliminadoEn == null));
        }
    }
}
