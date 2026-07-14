using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.ProductosDtos
{
    public class DtoPiezaKit
    {
        [Required]
        public string Nombre { get; set; } = string.Empty;

        [Required]
        [Range(1, int.MaxValue)]
        public int CantidadPorKit { get; set; } = 1;
    }
}
