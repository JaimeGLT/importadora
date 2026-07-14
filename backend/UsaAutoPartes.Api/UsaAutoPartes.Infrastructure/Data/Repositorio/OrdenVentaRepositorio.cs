using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.Dtos.ComisionDtos;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.VentaEnums;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class OrdenVentaRepositorio(AppDbContext db) : GenericRepositorio<OrdenVenta>(db), IOrdenVentaRepositorio
    {
        private readonly DbSet<OrdenVenta> _ordenes = db.Set<OrdenVenta>();

        public async Task<OrdenVenta?> GetConItems(int id)
        {
            return await _ordenes
                .Include(x => x.Items)
                    .ThenInclude(i => i.Piezas)
                .Include(x => x.Descuento)
                .Include(x => x.Cliente)
                .FirstOrDefaultAsync(x => x.Id == id);
        }

        public IQueryable<OrdenVenta> OrdenQuery()
        {
            return _ordenes.AsQueryable();
        }

        public async Task<List<ResumenComisionDto>> GetResumenComisionesAsync(DateTime desde, DateTime hasta)
        {
            var hastaFin = hasta.Date.AddDays(1).AddTicks(-1);

            var ordenes = await _ordenes
                .Where(o => o.Estado == EstadosOrden.Completada
                         && o.FechaCompletada >= desde
                         && o.FechaCompletada <= hastaFin)
                .Include(o => o.Cajero)
                .Include(o => o.Items)
                .ToListAsync();

            return ordenes
                .GroupBy(o => o.Id_Cajero)
                .Select(g =>
                {
                    var cajero = g.First().Cajero;
                    var totalVentas = g.Sum(o =>
                        o.Items.Sum(i => i.PrecioUnitario * i.Cantidad) - o.MontoDescuento);
                    var pct = cajero?.PorcentajeComision ?? 0;
                    return new ResumenComisionDto
                    {
                        CajeroId = g.Key.ToString(),
                        Nombre = cajero?.Nombre ?? string.Empty,
                        Apellido = cajero?.Apellido ?? string.Empty,
                        TotalVentas = totalVentas,
                        PorcentajeComision = pct,
                        MontoComision = Math.Round(totalVentas * pct / 100m, 2),
                    };
                })
                .OrderByDescending(r => r.TotalVentas)
                .ToList();
        }
    }
}
