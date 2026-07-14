using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigVentaConfig : IEntityTypeConfiguration<ConfigVenta>
    {
        public void Configure(EntityTypeBuilder<ConfigVenta> builder)
        {
            builder.ToTable("ConfigVenta");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.ModoVenta).IsRequired().HasMaxLength(30);
        }
    }
}
