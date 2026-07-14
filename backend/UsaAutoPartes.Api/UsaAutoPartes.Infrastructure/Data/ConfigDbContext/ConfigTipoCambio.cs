using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigTipoCambio : IEntityTypeConfiguration<TipoCambio>
    {
        public void Configure(EntityTypeBuilder<TipoCambio> builder)
        {
            builder.ToTable("TipoCambio");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.PrecioDolar).HasPrecision(10, 4).IsRequired();

            builder.Property(x => x.Fecha).IsRequired();
        }
    }
}
