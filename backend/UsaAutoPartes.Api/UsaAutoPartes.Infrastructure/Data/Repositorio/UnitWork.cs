using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class UnitWork : IUnitWork
    {
        public AppDbContext db;
        public IProductoRepositorio productos { get; private set;  }

        public IProductoImagenRepositorio productosImagenes { get; private set; }

        public IQueryable<T> Set<T>() where T : BaseEntity
        {
            return db.Set<T>().AsNoTracking().AsQueryable();
        }
        public IProveedorRepositorio proveedores { get; private set; }
        public IImportacionRepositorio importaciones { get; private set; }

        public IHistorialPrecioRepositorio historialPrecios { get; private set; }

        public IPiezaKitRepositorio piezasKit { get; private set; }

        public IOrdenVentaRepositorio ordenesVenta { get; private set; }

        public IAjusteStockRepositorio ajustesStock { get; private set; }

        public IMarcaRepositorio marcas { get; private set; }

        public ICreditoRepositorio creditos { get; private set; }

        public UnitWork(IProductoRepositorio _productos,
            IProductoImagenRepositorio _productosImagenes,
            AppDbContext _db, IProveedorRepositorio proveedor,
            IImportacionRepositorio _impoop,
            IHistorialPrecioRepositorio _historialPrecios,
            IPiezaKitRepositorio _piezasKit,
            IOrdenVentaRepositorio _ordenesVenta,
            IAjusteStockRepositorio _ajustesStock,
            IMarcaRepositorio _marcas,
            ICreditoRepositorio _creditos
            )
        {
            productos = _productos;
            productosImagenes = _productosImagenes;
            db = _db;
            this.proveedores = proveedor;
            importaciones = _impoop;
            historialPrecios = _historialPrecios;
            piezasKit = _piezasKit;
            ordenesVenta = _ordenesVenta;
            ajustesStock = _ajustesStock;
            marcas = _marcas;
            creditos = _creditos;
        }
        public void Dispose()
        {
            db.Dispose();
        }

        public async Task<int> SaveUnitWork()
        {
            return await db.SaveChangesAsync();
        }
    }
}
