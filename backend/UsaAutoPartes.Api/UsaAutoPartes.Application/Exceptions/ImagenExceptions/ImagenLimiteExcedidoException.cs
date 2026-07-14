namespace UsaAutoPartes.Application.Exceptions.ImagenExceptions
{
    /// <summary>
    /// Se lanza cuando un producto ya tiene la cantidad máxima de imágenes activas
    /// configurada (por defecto 20, vía <c>CloudflareR2.MaxImagenesPorProducto</c>).
    /// </summary>
    public class ImagenLimiteExcedidoException(int limite, int actuales)
        : Exception($"El producto ya tiene {actuales} imágenes activas. El límite es {limite}.");
}
