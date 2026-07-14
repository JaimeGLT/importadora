namespace UsaAutoPartes.Application.Exceptions.ImagenExceptions
{
    /// <summary>
    /// Se lanza cuando el Content-Type de la imagen no es válido. Reservado para
    /// validación futura (v1 acepta cualquier <c>image/*</c>). Definida de antemano
    /// para que el GlobalHandler la mapee a 400 desde el primer día.
    /// </summary>
    public class ImagenTipoInvalidoException(string contentType)
        : Exception($"El tipo de contenido '{contentType}' no es una imagen válida.");
}
