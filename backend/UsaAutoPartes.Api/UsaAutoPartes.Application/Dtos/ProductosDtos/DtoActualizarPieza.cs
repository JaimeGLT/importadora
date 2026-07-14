using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.ProductosDtos
{
    public class DtoActualizarPieza
    {
        public string? Nombre { get; set; }

        [Range(1, int.MaxValue)]
        public int? CantidadPorKit { get; set; }
    }
}
