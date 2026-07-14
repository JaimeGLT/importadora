using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.ProductoImagenDtos
{
    /// <summary>El cliente notifica al backend que subió el archivo a R2 y que la fila puede persistirse.</summary>
    public class DtoConfirmarImagenRequest
    {
        [Required]
        public int ProductoId { get; set; }

        /// <summary>Key que devolvió el presign.</summary>
        [Required, MaxLength(500)]
        public string Key { get; set; } = string.Empty;

        [Required, MaxLength(255)]
        public string NombreArchivo { get; set; } = string.Empty;

        [Required, MaxLength(50)]
        public string ContentType { get; set; } = string.Empty;

        [Range(1, long.MaxValue)]
        public long TamanoBytes { get; set; }

        public int? AnchoPx { get; set; }
        public int? AltoPx { get; set; }
    }
}
