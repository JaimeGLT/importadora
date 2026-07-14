namespace UsaAutoPartes.Infrastructure.Servicios.Processors
{
    /// <summary>
    /// Opciones de configuración de Cloudflare R2. Se bindea desde la sección
    /// <c>CloudflareR2</c> de <c>appsettings.json</c>.
    /// </summary>
    public class CloudflareR2Options
    {
        public const string SectionName = "CloudflareR2";

        /// <summary>Cloudflare Account ID (visible en el dashboard de R2).</summary>
        public string AccountId { get; set; } = string.Empty;

        /// <summary>R2 Access Key ID (token de API con permisos Object Read &amp; Write).</summary>
        public string AccessKeyId { get; set; } = string.Empty;

        /// <summary>R2 Secret Access Key.</summary>
        public string SecretAccessKey { get; set; } = string.Empty;

        /// <summary>Nombre del bucket donde se suben las imágenes de productos.</summary>
        public string Bucket { get; set; } = string.Empty;

        /// <summary>
        /// URL base pública para servir los objetos. Típicamente:
        /// <list type="bullet">
        ///   <item><c>https://pub-xxxx.r2.dev</c> (R2.dev subdomain)</item>
        ///   <item><c>https://cdn.usaimportadora.com</c> (custom domain via CNAME)</item>
        /// </list>
        /// </summary>
        public string PublicBaseUrl { get; set; } = string.Empty;

        /// <summary>Tiempo de vida en segundos de las URLs presignadas (default 900 = 15 min).</summary>
        public int PresignTtlSeconds { get; set; } = 900;

        /// <summary>Tamaño máximo permitido por archivo en bytes (default 10MB).</summary>
        public long MaxObjectBytes { get; set; } = 10L * 1024 * 1024;

        /// <summary>Cantidad máxima de imágenes activas por producto (default 20).</summary>
        public int MaxImagenesPorProducto { get; set; } = 20;

        /// <summary>Prefijo donde se guardan las imágenes en R2 (default <c>productos/</c>).</summary>
        public string Prefijo { get; set; } = "productos/";

        /// <summary>Cada cuánto corre el GC de huérfanos (en horas). Default 6.</summary>
        public int GcIntervalHours { get; set; } = 6;
    }
}
