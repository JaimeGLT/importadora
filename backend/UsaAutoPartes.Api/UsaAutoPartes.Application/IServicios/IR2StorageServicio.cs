namespace UsaAutoPartes.Application.IServicios
{
    /// <summary>
    /// Contrato para interactuar con Cloudflare R2 (S3-compatible).
    /// El backend NO almacena archivos: solo genera URLs presignadas y orquesta
    /// la confirmación de que el cliente subió el archivo.
    /// </summary>
    public interface IR2StorageServicio
    {
        /// <summary>
        /// Genera una URL presignada con método PUT. El cliente sube el archivo directo a R2
        /// usando esa URL (sin pasar por el backend). TTL controlado por config.
        /// </summary>
        /// <param name="llaveObjeto">Key en R2 (ej: <c>productos/123/abc.jpg</c>).</param>
        /// <param name="contentType">MIME type que el cliente va a usar (debe coincidir en el PUT).</param>
        /// <param name="tamanoBytes">Tamaño esperado del archivo (usado para logging/validación).</param>
        /// <returns>URL firmada lista para usar en PUT.</returns>
        Task<string> GenerarUrlPresignadaAsync(string llaveObjeto, string contentType, long tamanoBytes);

        /// <summary>
        /// Verifica que el objeto existe en R2 (HEAD). Usado por el endpoint
        /// de confirmar para validar que el cliente realmente subió el archivo
        /// antes de insertar la fila en BD.
        /// </summary>
        Task<bool> ExisteAsync(string llaveObjeto);

        /// <summary>Elimina un objeto de R2. Best-effort: loguea y sigue si falla.</summary>
        Task EliminarAsync(string llaveObjeto);

        /// <summary>Lista todos los objetos bajo un prefijo. Usado por el GC de huérfanos.</summary>
        Task<List<string>> ListarKeysAsync(string prefijo);

        /// <summary>Construye la URL pública de un objeto (sin firmar, asume bucket con acceso público).</summary>
        string ConstruirUrlPublica(string llaveObjeto);
    }
}
