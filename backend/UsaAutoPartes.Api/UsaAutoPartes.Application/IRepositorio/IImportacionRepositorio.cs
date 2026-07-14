using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IImportacionRepositorio : IGenericRepositorio<Importacion>
    {
        Task<int> Count(Expression<Func<Importacion, bool>> filtro);

        IQueryable<Importacion> ImportacionQuery();
    }
}
