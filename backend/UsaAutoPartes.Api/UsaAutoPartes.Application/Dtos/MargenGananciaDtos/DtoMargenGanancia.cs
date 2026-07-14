using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.MargenGananciaDtos
{
    public class DtoMargenGanancia
    {
        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal Valor { get; set; }
    }
}
