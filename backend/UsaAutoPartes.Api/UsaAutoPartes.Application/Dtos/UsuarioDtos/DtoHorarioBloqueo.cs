using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.UsuarioDtos
{
    public class DtoSetHorario
    {
        [Required]
        public string HoraInicio { get; set; } = ""; // "HH:mm"
        [Required]
        public string HoraFin { get; set; } = "";    // "HH:mm"
    }

    public class DtoHorarioResponse
    {
        public string HoraInicio { get; set; } = "";
        public string HoraFin { get; set; } = "";
        public bool Activo { get; set; }
    }
}
