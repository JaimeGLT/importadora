using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.ProductosDtos
{
    public class ProductoActualizar
    {
        [Required(ErrorMessage = "Codigo requerido")]
        public required string Codigo { get; set; }

        public string CodigoAux { get; set; } = string.Empty;

        public string CodigoAux2 { get; set; } = string.Empty;

        public string Nombre { get; set; } = string.Empty;

        public int? MarcaId { get; set; }

        public string Descripcion { get; set; } = string.Empty;

        public string? Procedencia { get; set; }

        public string? Categoria { get; set; }

        public string Unidad_Medida { get; set; } = string.Empty;

        public string Ubicacion { get; set; } = string.Empty;

        [Required]
        public required int Piezas { get; set; } = 1;

        [Required(ErrorMessage = "Stock Minimo requerido")]
        public required int Stock_Minimo { get; set; }
    }
}
