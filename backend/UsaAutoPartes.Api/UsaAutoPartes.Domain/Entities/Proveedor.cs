using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public class Proveedor : BaseEntity
    {
        public required string Nombre { get; set;  }

        public string? Pais { get; set; }

        public string? Moneda { get; set; }

        public string? Terminos { get; set; }

        public string? Nombre_Contacto { get; set; }

        public string? Email { get; set; }

        public string Telefono { get; set; } = string.Empty;

        public int TiempoReposicion { get; set; } = 0;

        public string SitioWeb { get; set; } = string.Empty;

        public bool Estado { get; set; } = true;

        public string Nota {  get; set; } = string.Empty;

        public int CanImportaciones { get; set; } = 0;

        public decimal Total {  get; set; } = 0.00M;

        public List<Importacion> Importaciones { get; set; } = new List<Importacion>();
    } 
}
