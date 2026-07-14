using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UsaAutoPartes.Domain.Entities.IdentityDb;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigHorarioGlobal : IEntityTypeConfiguration<HorarioGlobal>
    {
        public void Configure(EntityTypeBuilder<HorarioGlobal> builder)
        {
            builder.ToTable("HorarioGlobal");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.HoraInicio).IsRequired();
            builder.Property(x => x.HoraFin).IsRequired();
            builder.Property(x => x.Activo).HasDefaultValue(true);
        }
    }
}
