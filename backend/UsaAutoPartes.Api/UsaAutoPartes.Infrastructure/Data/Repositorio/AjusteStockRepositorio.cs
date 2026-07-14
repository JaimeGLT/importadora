using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class AjusteStockRepositorio : GenericRepositorio<AjusteStock>, IAjusteStockRepositorio
    {
        private readonly AppDbContext _ctx;

        public AjusteStockRepositorio(AppDbContext context) : base(context)
        {
            _ctx = context;
        }

        /// <summary>
        /// Variante sin AsNoTracking para que [UseProjection] en GraphQL pueda
        /// proyectar navegaciones anidadas como `producto.marca.nombre`.
        /// </summary>
        public IQueryable<AjusteStock> AjustesQuery() => _ctx.Set<AjusteStock>().AsQueryable();
    }
}
