using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities.IdentityDb;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigBloqueoGlobalProgramado : IEntityTypeConfiguration<BloqueoGlobalProgramado>
    {
        public void Configure(EntityTypeBuilder<BloqueoGlobalProgramado> builder)
        {
            builder.ToTable("BloqueoGlobalProgramado");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Desde).IsRequired();
            builder.Property(x => x.Hasta).IsRequired();
            builder.Property(x => x.Aplicado).HasDefaultValue(false);
        }
    }
}
