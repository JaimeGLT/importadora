using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.AjusteStockDtos
{
    public class DtoAjusteStock
    {
        [Required(ErrorMessage = "Delta requerido")]
        public required int Delta { get; set; }

        [Required(ErrorMessage = "Motivo requerido")]
        [MaxLength(200)]
        public required string Motivo { get; set; }

        [MaxLength(500)]
        public string Nota { get; set; } = string.Empty;
    }
}
