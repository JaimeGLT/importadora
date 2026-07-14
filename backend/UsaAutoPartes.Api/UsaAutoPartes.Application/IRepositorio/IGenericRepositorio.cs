using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IGenericRepositorio<T> where T : BaseEntity 
    {
        Task<bool> Crear(T Modelo);
        Task GuardarAsync();
        Task<bool> Eliminar(int Id);

        IQueryable<T> Query();
        Task<T> Obtener(int Id);
    }
}
