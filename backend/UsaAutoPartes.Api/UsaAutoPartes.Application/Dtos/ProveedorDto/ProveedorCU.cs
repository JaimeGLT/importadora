using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.ProveedorDto
{
    public class ProveedorCU
    {
        [Required(ErrorMessage = "Nombre obligatorio")]
        public required string Nombre { get; set; }

        public string? Pais { get; set; } = null;

        public string? Moneda { get; set; } = null;

        public string? Terminos { get; set; } = null;

        public string? Nombre_Contacto { get; set; } = null;

        [EmailAddress]
        public string? Email { get; set; } = null;

        public string Telefono { get; set; } = string.Empty;

        public int TiempoReposicion { get; set; } = 0;

        public string SitioWeb { get; set; } = string.Empty;

        public bool Estado { get; set; } = true;

        public string Nota { get; set; } = string.Empty;
    }
}
