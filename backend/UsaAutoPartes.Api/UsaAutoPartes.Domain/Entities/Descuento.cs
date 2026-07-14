using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public class Descuento : BaseEntity
    {
        public required string Nombre  { get; set; }

        public required decimal CantDescuento { get; set; }

        public required string Color { get; set; }

        public bool Activo { get; set; } = true;
    }
}
