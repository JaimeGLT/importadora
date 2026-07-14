using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IUnitWork : IDisposable
    {
        /// <summary>Acceso genérico a una tabla de cualquier entidad (para queries ad-hoc).</summary>
        IQueryable<T> Set<T>() where T : BaseEntity;

        IProductoRepositorio productos {get; }

        IProductoImagenRepositorio productosImagenes { get; }

        IProveedorRepositorio proveedores {get; }

        IImportacionRepositorio importaciones { get; }

        IHistorialPrecioRepositorio historialPrecios { get; }

        IPiezaKitRepositorio piezasKit { get; }

        IOrdenVentaRepositorio ordenesVenta { get; }

        IAjusteStockRepositorio ajustesStock { get; }

        IMarcaRepositorio marcas { get; }

        ICreditoRepositorio creditos { get; }

        Task<int> SaveUnitWork();
    }
}
