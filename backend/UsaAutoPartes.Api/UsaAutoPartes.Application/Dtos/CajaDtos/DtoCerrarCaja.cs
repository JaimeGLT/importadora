using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.CajaDtos
{
    public class DtoCerrarCaja
    {
        [Required]
        [Range(0, double.MaxValue)]
        public decimal MontoContado { get; set; }

        public string? Justificacion { get; set; }
    }
}
