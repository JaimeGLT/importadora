using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.UsuarioDtos
{
    public class DtoProgramarBloqueo
    {
        [Required]
        public DateTime Hasta { get; set; }
        public DateTime? Desde { get; set; }  // null = aplicar inmediatamente
    }
}
