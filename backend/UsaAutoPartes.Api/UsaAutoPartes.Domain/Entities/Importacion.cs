using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public class Importacion : BaseEntity
    {
        public string Codigo { get; set; }
        
        public required int Id_Proveedor {  get; set; }

        public required DateTime Fecha { get; set; }

        public required int CantProductos { get; set; }

        public decimal Total { get; set; } = 0.00M;

        public string Estado { get; set; } = "Recibida";

        public string Tipo { get; set; } = "Internacional";

        public decimal F_Internacional { get; set; } = 0.00M;

        public decimal Aduana_Arancel { get; set; } = 0.00M;

        public decimal Trasporte_Interno { get; set; } = 0.00M;

        public Proveedor? Proveedor { get; set; } 

        public List<Importacion_Detalle> Detalles { get; set; } = new List<Importacion_Detalle>();
    }
}
