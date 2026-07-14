using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigMargenGanancia : IEntityTypeConfiguration<MargenGanancia>
    {
        public void Configure(EntityTypeBuilder<MargenGanancia> builder)
        {
            builder.ToTable("MargenGanancia");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Valor).HasPrecision(10, 4).IsRequired();

            builder.Property(x => x.Fecha).IsRequired();
        }
    }
}
