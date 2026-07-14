using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.UsuarioDtos
{
    public class DtoBloquearHasta
    {
        [Required]
        public DateTime Hasta { get; set; }
    }
}
