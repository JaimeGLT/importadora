using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public class Importacion_Detalle : BaseEntity
    {
        public int Id_Importacion { get; set; }

        public required string Codigo { get; set; }

        public string CodigoAux { get; set; } = string.Empty;

        public string CodigoAux2 { get; set; } = string.Empty;

        public required string Nombre { get; set; }

        public int? MarcaId { get; set; }

        public Marca? MarcaNavigation { get; set; }

        public string Descripcion { get; set; } = string.Empty;

        public string? Procedencia { get; set; }

        public string Unidad_Medida { get; set; } = string.Empty;

        public string Ubicacion { get; set; } = string.Empty;

        public required int Piezas { get; set; } = 1;

        public required int Stock_Actual { get; set; }

        public required int Stock_Minimo { get; set; }

        public decimal Costo { get; set; }

        public decimal Precio { get;  set; }

        public decimal ConversionABs { get; set; }

        public string Tipo { get; set; } = string.Empty;

        public Importacion? Importacion { get; set; }
    }
}
