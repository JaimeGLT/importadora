using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.VentaDtos
{
    public class DtoActualizarCantidadItem
    {
        [Required, Range(1, int.MaxValue)]
        public int Cantidad { get; set; }
    }
}
