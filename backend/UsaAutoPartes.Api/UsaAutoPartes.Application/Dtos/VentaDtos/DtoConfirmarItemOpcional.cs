using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.VentaDtos
{
    public class DtoConfirmarItemOpcional
    {
        [Range(0.01, double.MaxValue)]
        public decimal? PrecioUnitario { get; set; }
    }
}
