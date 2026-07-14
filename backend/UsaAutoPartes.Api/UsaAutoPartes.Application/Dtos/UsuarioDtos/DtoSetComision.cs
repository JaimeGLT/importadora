using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.UsuarioDtos
{
    public class DtoSetComision
    {
        [Required]
        [Range(0, 100)]
        public decimal Porcentaje { get; set; }
    }
}
