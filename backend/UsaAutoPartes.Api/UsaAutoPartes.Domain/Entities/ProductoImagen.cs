using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    /// <summary>
    /// Imagen de la galería de un producto. Un producto puede tener hasta N imágenes
    /// (configurable por <c>CloudflareR2.MaxImagenesPorProducto</c>). Una sola por
    /// producto puede estar marcada como principal.
    /// </summary>
    public class ProductoImagen : BaseEntity
    {
        /// <summary>Estados posibles del ciclo de vida de una imagen.</summary>
        public static class Estados
        {
            public const string Pendiente = "Pendiente";
            public const string Activa = "Activa";
            public const string Eliminada = "Eliminada";
        }

        public int Id_Producto { get; set; }

        public Producto? Producto { get; set; }

        /// <summary>
        /// Key única del objeto en R2. Formato: <c>productos/{productoId}/{guid}.{ext}</c>.
        /// Tiene UNIQUE index en BD para evitar colisiones accidentales.
        /// </summary>
        public string LlaveObjeto { get; set; } = string.Empty;

        /// <summary>URL pública completa (https://cdn.../productos/123/abc.jpg) lista para usar en &lt;img src&gt;.</summary>
        public string UrlPublica { get; set; } = string.Empty;

        public string NombreArchivo { get; set; } = string.Empty;

        /// <summary>MIME type real declarado en la presigned URL. Típicamente image/jpeg, image/png, image/webp.</summary>
        public string TipoContenido { get; set; } = string.Empty;

        public long TamanoBytes { get; set; }

        /// <summary>Ancho en píxeles (opcional, enviado por el cliente al confirmar la subida).</summary>
        public int? AnchoPx { get; set; }

        /// <summary>Alto en píxeles (opcional, enviado por el cliente al confirmar la subida).</summary>
        public int? AltoPx { get; set; }

        /// <summary>
        /// Posición secuencial en la galería (1, 2, 3...). Los huecos se preservan
        /// cuando se elimina una imagen intermedia. Se asigna al confirmar la subida
        /// como <c>max(Orden) + 1</c> de las imágenes activas del producto.
        /// </summary>
        public int Orden { get; set; }

        /// <summary>
        /// <c>true</c> si es la imagen destacada (portada) del producto.
        /// Garantizado único por producto mediante índice parcial
        /// (solo filas con <c>EsPrincipal = true AND Estado &lt;&gt; 'Eliminada'</c>).
        /// </summary>
        public bool EsPrincipal { get; set; }

        /// <summary>Una de <see cref="Estados"/>.</summary>
        public string Estado { get; set; } = Estados.Activa;

        public DateTime FechaSubida { get; set; }

        /// <summary>Timestamp de soft delete. <c>null</c> si nunca se eliminó.</summary>
        public DateTime? FechaEliminacion { get; set; }

        public ProductoImagen() { }
    }
}
