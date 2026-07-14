namespace UsaAutoPartes.Application.Dtos.ProductoImagenDtos
{
    /// <summary>URL presignada que el cliente usa para hacer PUT directo a R2.</summary>
    public class DtoPresignResponse
    {
        /// <summary>Key única del objeto en R2 (productos/{productoId}/{guid}.{ext}).</summary>
        public string Key { get; set; } = string.Empty;

        /// <summary>URL completa lista para hacer PUT con el body del archivo.</summary>
        public string Url { get; set; } = string.Empty;

        /// <summary>Timestamp de expiración de la URL (UTC). Después de esto, la URL devuelve 403.</summary>
        public DateTime ExpiraEn { get; set; }
    }
}
