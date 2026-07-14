using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigProductoImagen : IEntityTypeConfiguration<ProductoImagen>
    {
        public void Configure(EntityTypeBuilder<ProductoImagen> builder)
        {
            builder.ToTable("ProductoImagen");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id_Producto).IsRequired();

            builder.Property(x => x.LlaveObjeto)
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(x => x.UrlPublica)
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(x => x.NombreArchivo)
                .IsRequired()
                .HasMaxLength(255);

            builder.Property(x => x.TipoContenido)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(x => x.TamanoBytes).IsRequired();

            builder.Property(x => x.AnchoPx).IsRequired(false);

            builder.Property(x => x.AltoPx).IsRequired(false);

            builder.Property(x => x.Orden).IsRequired();

            builder.Property(x => x.EsPrincipal).IsRequired();

            builder.Property(x => x.Estado)
                .IsRequired()
                .HasMaxLength(20)
                .HasDefaultValue(ProductoImagen.Estados.Activa);

            builder.Property(x => x.FechaEliminacion).IsRequired(false);

            builder.Property(x => x.FechaSubida)
                .HasColumnName("fecha_subida")
                .HasDefaultValueSql("NOW()");

            // FK con cascade: al hard-delete del Producto se eliminan las imágenes.
            // En la práctica el ProductoController hace soft delete, así que esta
            // cascade aplica sólo si alguien hace DELETE físico directo a la tabla.
            builder.HasOne(x => x.Producto)
                .WithMany(x => x.Imagenes)
                .HasForeignKey(x => x.Id_Producto)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired()
                .HasConstraintName("FK_ProductoImagen_Producto");

            // Llave de R2 única globalmente (Guid + extensión, colisión negligible
            // pero el índice protege contra bugs de generación).
            builder.HasIndex(x => x.LlaveObjeto)
                .IsUnique()
                .HasDatabaseName("IX_ProductoImagen_LlaveObjeto");

            // Orden único por producto entre imágenes activas. Permite huecos en el
            // rango (si se eliminó la #2, las nuevas arrancan en max+1).
            builder.HasIndex(x => new { x.Id_Producto, x.Orden })
                .IsUnique()
                .HasFilter("\"Estado\" <> 'Eliminada'")
                .HasDatabaseName("IX_ProductoImagen_Producto_Orden");

            // Garantiza UNA sola imagen principal activa por producto. El backend
            // flipea con ClearPrincipalAsync + set en una sola transacción; el
            // índice protege contra carreras (dos PUTs simultáneos: 23505 → 409).
            builder.HasIndex(x => x.Id_Producto)
                .IsUnique()
                .HasFilter("\"EsPrincipal\" = true AND \"Estado\" <> 'Eliminada'")
                .HasDatabaseName("IX_ProductoImagen_Producto_Principal");
        }
    }
}
