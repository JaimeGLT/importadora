using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IMarcaRepositorio : IGenericRepositorio<Marca>
    {
        Task<Marca?> ObtenerPorNombre(string nombre);
        IQueryable<Marca> MarcaQuery();
    }
}
