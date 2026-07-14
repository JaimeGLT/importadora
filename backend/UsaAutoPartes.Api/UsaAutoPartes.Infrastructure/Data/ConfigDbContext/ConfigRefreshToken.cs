using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities.IdentityDb;

namespace UsaAutoPartes.Infrastructure.Data.ConfigDbContext
{
    public class ConfigRefreshToken : IEntityTypeConfiguration<RefreshToken>
    {
        public void Configure(EntityTypeBuilder<RefreshToken> builder)
        {
            builder.ToTable("refreshtoken");

            builder.HasKey(x => x.Id);

            builder.HasIndex(x => x.Token).IsUnique();

            builder.Property(x => x.Token).IsRequired();

            builder.Property(x => x.ExpiraEn).IsRequired();

            builder.Property(x => x.CreadoEn).IsRequired();

            builder.Property(x => x.IsRevoked).IsRequired();

            builder.HasOne(x => x.Usuario)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Acompaña el soft-delete de Usuario: los refresh tokens de usuarios
            // eliminados lógicamente no se exponen en queries por DbSet.
            builder.HasQueryFilter(x => x.Usuario.EliminadoEn == null);
        }
    }
}
