using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigMarca : IEntityTypeConfiguration<Marca>
    {
        public void Configure(EntityTypeBuilder<Marca> builder)
        {
            builder.ToTable("Marca");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Nombre).IsRequired();

            builder.HasIndex(x => x.Nombre).IsUnique().HasDatabaseName("IX_Marca_Nombre");
        }
    }
}
