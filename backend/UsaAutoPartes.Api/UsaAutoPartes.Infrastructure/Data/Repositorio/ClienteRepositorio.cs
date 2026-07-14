using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class ClienteRepositorio(AppDbContext db) : GenericRepositorio<Cliente>(db), IClienteRepositorio
    {
        private readonly DbSet<Cliente> _clientes = db.Set<Cliente>();

        public IQueryable<Cliente> ClienteQuery()
        {
            return _clientes.AsQueryable();
        }
    }
}
