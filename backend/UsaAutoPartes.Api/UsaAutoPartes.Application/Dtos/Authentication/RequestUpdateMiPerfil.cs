using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.Authentication
{
    /// <summary>
    /// Datos para que un usuario actualice SU PROPIA información personal.
    /// El userId se deriva del JWT en el controller, nunca de la URL ni del body.
    /// </summary>
    public record RequestUpdateMiPerfil
    {
        [Required]
        public required string Nombre { get; init; }

        [Required]
        public required string Apellido { get; init; }

        [Required]
        [EmailAddress]
        public required string Correo { get; init; }
    }
}
