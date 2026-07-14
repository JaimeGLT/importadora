using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IProductoRepositorio : IGenericRepositorio<Producto>
    {
        Task<List<Producto>> GetProductosConHistorial();

        Task<Producto?> GetProductoforCodigo(string codigo, int? marcaId = null);

        Task<Producto?> BuscarPorCodigoEscaneo(string codigo);

        IQueryable<Producto> BuscarPorTermino(string termino);

        Task<Producto?> ObtenerConPiezas(int id);

        Task<Producto?> ObtenerConPiezasYMarca(int id);
    }
}
