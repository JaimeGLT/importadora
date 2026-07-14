using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigProducto : IEntityTypeConfiguration<Producto>
    {
        public void Configure(EntityTypeBuilder<Producto> builder)
        {
            builder.ToTable("Producto");

            builder.HasKey(x => x.Id);

            builder.HasIndex(x => x.Codigo)
                .IsUnique()
                .HasFilter("\"MarcaId\" IS NULL")
                .HasDatabaseName("IX_Producto_Codigo_SinMarca");

            builder.HasIndex(x => new { x.Codigo, x.MarcaId })
                .IsUnique()
                .HasFilter("\"MarcaId\" IS NOT NULL")
                .HasDatabaseName("IX_Producto_Codigo_Marca");

            builder.HasOne(x => x.Marca)
                .WithMany(m => m.Productos)
                .HasForeignKey(x => x.MarcaId)
                .OnDelete(DeleteBehavior.SetNull)
                .IsRequired(false);


            builder.Property(x => x.Codigo).IsRequired();

            builder.HasIndex(x => x.Nombre);

            builder.Property(x => x.Costo).HasPrecision(10, 2);

            builder.Property(x => x.Precio).HasPrecision(10, 2);

            builder.Property(x => x.ConversionABs).HasPrecision(10, 2);

            builder.Property(x => x.Activo).HasDefaultValue(true);

            builder.Property(x => x.FechaEliminacion).IsRequired(false);

            builder.Property(x => x.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .HasDefaultValueSql("NOW()");

            builder.Property(x => x.FechaActualizacion)
                .HasColumnName("fecha_actualizacion")
                .IsRequired(false);
        }
    }
}
