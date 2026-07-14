using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.ProductoImagenDtos
{
    public class DtoSetPrincipalRequest
    {
        [Required]
        public int ProductoId { get; set; }

        [Required]
        public int ImagenId { get; set; }
    }
}
