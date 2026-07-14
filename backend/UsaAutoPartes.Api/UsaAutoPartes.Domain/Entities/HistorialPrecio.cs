using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public class HistorialPrecio : BaseEntity
    {
        public required int Id_producto { get; set; }

        public DateTime Fecha { get; set; }

        public required decimal Costo { get; set; } 

        public required decimal Precio { get; set; }

        public required decimal ConversionABs { get; set; }

        public string Nota { get; set; } = string.Empty;

        public Producto? Producto { get; set; }
    }
}
