using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.Exceptions.GenericExceptions;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class ProductoImagenRepositorio(AppDbContext _db)
        : GenericRepositorio<ProductoImagen>(_db), IProductoImagenRepositorio
    {
        private readonly DbSet<ProductoImagen> datos = _db.Set<ProductoImagen>();

        public override IQueryable<ProductoImagen> Query()
        {
            return datos.AsNoTracking();
        }

        public async Task<List<ProductoImagen>> GetByProductoAsync(int productoId)
        {
            return await datos
                .AsNoTracking()
                .Where(x => x.Id_Producto == productoId && x.Estado == ProductoImagen.Estados.Activa)
                .OrderBy(x => x.Orden)
                .ToListAsync();
        }

        public async Task<Dictionary<int, List<ProductoImagen>>> GetByProductosAsync(IEnumerable<int> productosIds)
        {
            var ids = productosIds.Distinct().ToList()
            ;
            if (ids.Count == 0)
                return new Dictionary<int, List<ProductoImagen>>();

            var todas = await datos
                .AsNoTracking()
                .Where(x => ids.Contains(x.Id_Producto) && x.Estado == ProductoImagen.Estados.Activa)
                .OrderBy(x => x.Orden)
                .ToListAsync();

            // Diccionario productoId -> imágenes ordenadas por Orden ASC.
            return todas
                .GroupBy(x => x.Id_Producto)
                .ToDictionary(g => g.Key, g => g.ToList());
        }

        public async Task<int> CountActivasAsync(int productoId)
        {
            return await datos
                .AsNoTracking()
                .CountAsync(x => x.Id_Producto == productoId && x.Estado == ProductoImagen.Estados.Activa);
        }

        public async Task<bool> ExistsByKeyAsync(string llaveObjeto)
        {
            return await datos.AsNoTracking().AnyAsync(x => x.LlaveObjeto == llaveObjeto);
        }

        public async Task<int> GetMaxOrdenAsync(int productoId)
        {
            return await datos
                .AsNoTracking()
                .Where(x => x.Id_Producto == productoId && x.Estado == ProductoImagen.Estados.Activa)
                .Select(x => (int?)x.Orden)
                .MaxAsync() ?? 0;
        }

        public async Task<bool> TienePrincipalAsync(int productoId)
        {
            return await datos.AsNoTracking().AnyAsync(x =>
                x.Id_Producto == productoId
                && x.EsPrincipal
                && x.Estado == ProductoImagen.Estados.Activa);
        }

        public async Task<ProductoImagen?> GetByIdAsync(int id)
        {
            return await datos.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<HashSet<string>> GetAllActiveKeysAsync()
        {
            var keys = await datos
                .AsNoTracking()
                .Where(x => x.Estado == ProductoImagen.Estados.Activa)
                .Select(x => x.LlaveObjeto)
                .ToListAsync();
            return new HashSet<string>(keys, StringComparer.Ordinal);
        }

        public async Task<int> ClearPrincipalAsync(int productoId)
        {
            return await datos
                .Where(x => x.Id_Producto == productoId
                    && x.EsPrincipal
                    && x.Estado == ProductoImagen.Estados.Activa)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.EsPrincipal, false));
        }

        public async Task<int> SoftDeleteByProductoAsync(int productoId)
        {
            return await datos
                .Where(x => x.Id_Producto == productoId
                    && x.Estado != ProductoImagen.Estados.Eliminada)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.Estado, ProductoImagen.Estados.Eliminada)
                    .SetProperty(x => x.EsPrincipal, false)
                    .SetProperty(x => x.FechaEliminacion, DateTime.UtcNow));
        }

        /// <summary>
        /// Override de Eliminar del genérico: hace soft delete (NO hard delete),
        /// preservando la fila para auditoría. Si la imagen era la principal,
        /// NO promueve otra automáticamente — eso lo hace el Controller.
        /// </summary>
        public override async Task<bool> Eliminar(int Id)
        {
            var rows = await datos
                .Where(x => x.Id == Id && x.Estado != ProductoImagen.Estados.Eliminada)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.Estado, ProductoImagen.Estados.Eliminada)
                    .SetProperty(x => x.EsPrincipal, false)
                    .SetProperty(x => x.FechaEliminacion, DateTime.UtcNow));

            if (rows == 0) throw new EntidadNoEncontradaException(nameof(ProductoImagen));
            return true;
        }
    }
}
