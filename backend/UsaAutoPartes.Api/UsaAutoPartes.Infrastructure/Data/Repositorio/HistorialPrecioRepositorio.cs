using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class HistorialPrecioRepositorio : GenericRepositorio<HistorialPrecio>, IHistorialPrecioRepositorio
    {
        private readonly AppDbContext _context;

        public HistorialPrecioRepositorio(AppDbContext _db) : base(_db)
        {
            _context = _db;
        }

        public async Task<HistorialPrecio?> GetUltimoPrecio(int idProducto)
        {
            return await _context.Set<HistorialPrecio>()
                .Where(h => h.Id_producto == idProducto)
                .OrderByDescending(h => h.Fecha)
                .FirstOrDefaultAsync();
        }
    }
}
