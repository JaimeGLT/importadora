using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Application.Exceptions.GenericExceptions;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class GenericRepositorio<T>(AppDbContext _db) : IGenericRepositorio<T> where T : BaseEntity
    { 
        private readonly DbSet<T> _Set = _db.Set<T>();

        public async Task<bool> Crear(T Modelo)
        {
            await _Set.AddAsync(Modelo);

            return true;
        }

        public async Task<T> Obtener(int Id)
        {
            var entidad = await _Set.FindAsync(Id);

            if (entidad == null) throw new EntidadNoEncontradaException(typeof(T).Name);

            return entidad;
        }

        public async Task GuardarAsync()
        {
            await _db.SaveChangesAsync();
        } 

        public virtual async Task<bool> Eliminar(int Id)
        {
            var entidad = await _Set.FindAsync(Id);

            if (entidad == null) throw new EntidadNoEncontradaException(typeof(T).Name);
            
            _Set.Remove(entidad);

            return true;
        } 

        public virtual IQueryable<T> Query()
        {
            return _Set.AsNoTracking().AsQueryable();
        }
    }
}
