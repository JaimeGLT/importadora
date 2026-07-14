using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Entities.IdentityDb;
using UsaAutoPartes.Infrastructure.Data.ConfigDbContext;

namespace UsaAutoPartes.Infrastructure.Data
{
    public class AppDbContext : IdentityDbContext<Usuario, IdentityRole<Guid>, Guid>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Usuario> Usuarios { get; set; }

        public DbSet<RefreshToken> RefreshTokens { get; set; }

        public DbSet<Producto> Productos { get; set; }

        public DbSet<ProductoImagen> ProductosImagenes { get; set; }

        public DbSet<HistorialPrecio> HistorialPrecios { get; set; }

        public DbSet<Proveedor> Proveedores { get; set; }

        public DbSet<Importacion> Importaciones { get; set; }

        public DbSet<Importacion_Detalle> DetalleImportaciones { get; set; }

        public DbSet<Descuento> Descuentos { get; set; }

        public DbSet<PiezaKit> PiezasKit { get; set; }

        public DbSet<Caja> Cajas { get; set; }

        public DbSet<MovimientoCaja> MovimientosCaja { get; set; }

        public DbSet<TipoCambio> TipoCambios { get; set; }

        public DbSet<Cliente> Clientes { get; set; }

        public DbSet<MargenGanancia> MargenGanancias { get; set; }

        public DbSet<ConfigVenta> ConfigVentas { get; set; }

        public DbSet<OrdenVenta> OrdenesVenta { get; set; }

        public DbSet<OrdenVentaItem> OrdenesVentaItems { get; set; }

        public DbSet<OrdenVentaItemPieza> OrdenesVentaItemPiezas { get; set; }

        public DbSet<AjusteStock> AjustesStock { get; set; }

        public DbSet<HorarioBloqueo> HorariosBloqueo { get; set; }

        public DbSet<HorarioGlobal> HorariosGlobal { get; set; }

        public DbSet<BloqueoGlobalProgramado> BloqueosProgramados { get; set; }

        public DbSet<Marca> Marcas { get; set; }

        public DbSet<Credito> Creditos { get; set; }

        public DbSet<CreditoPago> CreditoPagos { get; set; }

        public DbSet<CreditoItem> CreditoItems { get; set; }

        protected override void OnModelCreating(ModelBuilder Builder)
        {
           base.OnModelCreating(Builder);

            // Register unaccent() PostgreSQL function for EF Core translation.
            // The extension must be enabled in the database:
            //   CREATE EXTENSION IF NOT EXISTS unaccent;
            Builder.HasDbFunction(
                typeof(PostgresFunctions).GetMethod(nameof(PostgresFunctions.Unaccent), [typeof(string)])!)
                .HasName("unaccent");

            Builder.ApplyConfigurationsFromAssembly(typeof(ConfigUsuario).Assembly);
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;
            foreach (var entry in ChangeTracker.Entries<Producto>())
            {
                if (entry.State == EntityState.Added)
                    entry.Entity.FechaCreacion = now;
                else if (entry.State == EntityState.Modified)
                    entry.Entity.FechaActualizacion = now;
            }
            return await base.SaveChangesAsync(cancellationToken);
        }
    }
}
