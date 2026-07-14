using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.ProductoImagenDtos
{
    /// <summary>Cliente envía el orden final deseado de las imágenes (índice 0 = primera).</summary>
    public class DtoReordenarRequest
    {
        [Required]
        public int ProductoId { get; set; }

        [Required, MinLength(1)]
        public List<int> ImagenesIds { get; set; } = new();
    }
}
