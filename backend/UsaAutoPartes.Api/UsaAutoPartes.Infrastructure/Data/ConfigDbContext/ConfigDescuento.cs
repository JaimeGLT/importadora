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
    public class ConfigDescuento : IEntityTypeConfiguration<Descuento>
    {
        public void Configure(EntityTypeBuilder<Descuento> builder)
        {
            builder.ToTable("Descuento");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Nombre).IsRequired();

            builder.Property(x => x.CantDescuento).HasPrecision(4,2);

            builder.Property(x => x.Color).IsRequired();

            builder.Property(x => x.Activo).HasDefaultValue(true);

            builder.HasIndex(x => x.Nombre).IsUnique().HasDatabaseName("Id_nombre_descuento");
        }
    }
}
