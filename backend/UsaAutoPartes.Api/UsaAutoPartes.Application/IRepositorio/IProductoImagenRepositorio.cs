using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IProductoImagenRepositorio : IGenericRepositorio<ProductoImagen>
    {
        /// <summary>Lista las imágenes activas de un producto, ordenadas por Orden ASC.</summary>
        Task<List<ProductoImagen>> GetByProductoAsync(int productoId);

        /// <summary>
        /// Batch: trae las imágenes activas de varios productos en una sola query,
        /// agrupadas por producto y ordenadas por Orden ASC. Usado por endpoints
        /// que devuelven listas (ej. `buscar-lista`) para no caer en N+1.
        /// </summary>
        Task<Dictionary<int, List<ProductoImagen>>> GetByProductosAsync(IEnumerable<int> productosIds);

        /// <summary>Cantidad de imágenes activas (Estado = 'Activa') de un producto.</summary>
        Task<int> CountActivasAsync(int productoId);

        /// <summary>¿Existe ya una fila con esta key de R2? Útil para detectar keys duplicadas.</summary>
        Task<bool> ExistsByKeyAsync(string llaveObjeto);

        /// <summary>Devuelve el máximo Orden actual entre las imágenes activas de un producto. 0 si no hay ninguna.</summary>
        Task<int> GetMaxOrdenAsync(int productoId);

        /// <summary>¿Tiene el producto alguna imagen marcada como principal activa?</summary>
        Task<bool> TienePrincipalAsync(int productoId);

        /// <summary>Obtiene una imagen por Id sin tracking. Devuelve null si no existe o está eliminada.</summary>
        Task<ProductoImagen?> GetByIdAsync(int id);

        /// <summary>Devuelve todas las keys activas (Estado = 'Activa') de todos los productos. Usado por el GC.</summary>
        Task<HashSet<string>> GetAllActiveKeysAsync();

        /// <summary>Bulk: marca EsPrincipal = false en todas las imágenes activas del producto. Devuelve filas afectadas.</summary>
        Task<int> ClearPrincipalAsync(int productoId);

        /// <summary>Soft delete en bulk de todas las imágenes activas de un producto. Usado al soft-delete del Producto.</summary>
        Task<int> SoftDeleteByProductoAsync(int productoId);
    }
}
