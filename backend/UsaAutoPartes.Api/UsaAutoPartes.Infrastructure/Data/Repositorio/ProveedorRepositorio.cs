using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class ProveedorRepositorio : GenericRepositorio<Proveedor>, IProveedorRepositorio
    {
        private readonly DbSet<Proveedor> _Proveedores;
        public ProveedorRepositorio(AppDbContext _db) : base(_db)
        {
            _Proveedores = _db.Set<Proveedor>(); 
        }

        public IQueryable<Proveedor> ProveedorQuery()
        {
            return _Proveedores.AsQueryable();
        }
    }
}
