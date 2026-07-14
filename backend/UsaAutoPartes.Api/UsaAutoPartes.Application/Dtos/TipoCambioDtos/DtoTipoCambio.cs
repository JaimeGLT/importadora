using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.TipoCambioDtos
{
    public class DtoTipoCambio
    {
        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal PrecioDolar { get; set; }
    }
}
