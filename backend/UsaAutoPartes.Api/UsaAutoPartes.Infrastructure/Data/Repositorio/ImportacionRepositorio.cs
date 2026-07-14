using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class ImportacionRepositorio : GenericRepositorio<Importacion>, IImportacionRepositorio
    {
        private readonly DbSet<Importacion> _importacion;
        public ImportacionRepositorio(AppDbContext _db) : base(_db)
        {
            _importacion = _db.Set<Importacion>();
        }

        public async Task<int> Count(Expression<Func<Importacion, bool>> filtro)
        {
            return await _importacion.CountAsync(filtro);
        }

        public IQueryable<Importacion> ImportacionQuery()
        {
            return _importacion.AsQueryable();
        }
    }
}
