using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.ClienteDtos
{
    public class DtoActualizarCliente
    {
        [Required]
        [MaxLength(100)]
        public string Nombre { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Apellido { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Telefono { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? Direccion { get; set; }

        [MaxLength(150)]
        public string? CorreoElectronico { get; set; }
    }
}
