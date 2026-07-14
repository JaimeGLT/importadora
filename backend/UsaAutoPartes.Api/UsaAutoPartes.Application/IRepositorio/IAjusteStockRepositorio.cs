using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IAjusteStockRepositorio : IGenericRepositorio<AjusteStock>
    {
        /// <summary>
        /// Variante sin AsNoTracking para que [UseProjection] en GraphQL pueda
        /// proyectar navegaciones anidadas como `producto.marca.nombre`.
        /// </summary>
        IQueryable<AjusteStock> AjustesQuery();
    }
}
