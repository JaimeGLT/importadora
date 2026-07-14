namespace UsaAutoPartes.Application.Exceptions.ImagenExceptions
{
    /// <summary>
    /// Se lanza cuando el tamaño de la imagen supera el máximo configurado
    /// (por defecto 10MB, vía <c>CloudflareR2.MaxObjectBytes</c>).
    /// </summary>
    public class ImagenTamanoExcedidoException(long tamano, long maximo)
        : Exception($"La imagen pesa {tamano} bytes y supera el máximo permitido de {maximo} bytes.");
}
