using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.ProductosDtos
{
    public class DtoConvertirAKit
    {
        [Required]
        [MinLength(1, ErrorMessage = "El kit debe tener al menos una pieza.")]
        public List<DtoPiezaKit> Piezas { get; set; } = new List<DtoPiezaKit>();
    }
}
