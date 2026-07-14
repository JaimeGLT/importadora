using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class PiezaKitRepositorio(AppDbContext db) : GenericRepositorio<PiezaKit>(db), IPiezaKitRepositorio
    {
    }
}
