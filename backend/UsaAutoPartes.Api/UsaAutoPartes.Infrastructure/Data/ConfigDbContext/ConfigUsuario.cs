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
    public class ConfigUsuario : IEntityTypeConfiguration<Usuario>
    {
        public void Configure(EntityTypeBuilder<Usuario> builder)
        {
            builder.ToTable("Usuario");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Nombre).IsRequired();

            builder.Property(x => x.PorcentajeComision)
                .HasColumnType("decimal(5,2)")
                .IsRequired()
                .HasDefaultValue(0m);

            builder.Property(x => x.EliminadoEn).IsRequired(false);

            // Soft delete: índice único compuesto (Email, EliminadoEn) en vez de Email solo.
            // PostgreSQL trata NULLs como distintos, así que se permiten múltiples filas con el
            // mismo email siempre que solo una tenga EliminadoEn = NULL (el usuario "vivo").
            // Los soft-deleted quedan con un timestamp y no chocan entre sí ni con el vivo.
            builder.HasIndex(x => new { x.Email, x.EliminadoEn })
                .IsUnique()
                .HasDatabaseName("IX_Usuario_Email_EliminadoEn");

            builder.HasIndex(x => new { x.UserName, x.EliminadoEn })
                .IsUnique()
                .HasDatabaseName("IX_Usuario_UserName_EliminadoEn");

            // Identity crea un UserNameIndex por defecto (UNIQUE sobre NormalizedUserName)
            // que no considera EliminadoEn. Eso bloquea la creación de un nuevo usuario
            // con el mismo email/username que uno soft-deleted. Lo redefinimos como
            // índice parcial: solo aplica unicidad a usuarios activos.
            builder.HasIndex(x => x.NormalizedUserName)
                .IsUnique()
                .HasFilter("\"EliminadoEn\" IS NULL")
                .HasDatabaseName("UserNameIndex");

            // Soft delete: las queries por DbSet<Usuario> excluyen automáticamente
            // los usuarios con EliminadoEn != null. UserManager.FindByXxx NO respeta
            // este filtro, por eso los chequeos de login/refresh deben ser explícitos.
            builder.HasQueryFilter(u => u.EliminadoEn == null);
        }
    }
}
