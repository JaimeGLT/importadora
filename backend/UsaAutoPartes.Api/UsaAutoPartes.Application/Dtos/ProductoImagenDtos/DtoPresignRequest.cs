using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.ProductoImagenDtos
{
    /// <summary>Solicita al backend una URL presignada para subir un archivo directo a R2.</summary>
    public class DtoPresignRequest
    {
        [Required]
        public int ProductoId { get; set; }

        [Required, MaxLength(255)]
        public string NombreArchivo { get; set; } = string.Empty;

        /// <summary>MIME type del archivo (image/jpeg, image/png, image/webp, image/gif, etc.).</summary>
        [Required, MaxLength(50)]
        public string ContentType { get; set; } = string.Empty;

        [Range(1, long.MaxValue)]
        public long TamanoBytes { get; set; }

        public int? AnchoPx { get; set; }
        public int? AltoPx { get; set; }
    }
}
