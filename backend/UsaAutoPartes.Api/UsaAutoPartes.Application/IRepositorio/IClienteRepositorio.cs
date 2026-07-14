using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IClienteRepositorio : IGenericRepositorio<Cliente>
    {
        IQueryable<Cliente> ClienteQuery();
    }
}
