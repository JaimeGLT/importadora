using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.ProductosDtos
{
    public class DtoProductoUPrecio
    {
        public decimal? Costo { get; set; }
        public decimal? Precio { get; set; }
        public decimal? ConversionABs { get; set; }
        public string Nota { get; set; } = string.Empty;
    }
}
