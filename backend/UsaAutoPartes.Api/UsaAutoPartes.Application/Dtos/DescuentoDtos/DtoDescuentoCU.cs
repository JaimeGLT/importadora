using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.DescuentoDtos
{
    public class DtoDescuentoCU
    {
        [Required]
        public required string Nombre { get; set; }

        [Required]
        [Range(0.01, 100.00, ErrorMessage = "Rango no valido")]
        public required decimal CantDescuento { get; set; }

        [Required]
        public required string Color { get; set; }
    }
}
