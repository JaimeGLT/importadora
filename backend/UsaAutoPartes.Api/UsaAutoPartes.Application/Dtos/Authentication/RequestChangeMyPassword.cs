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
    /// Datos para que un usuario cambie SU PROPIA contraseña.
    /// Requiere la contraseña actual por seguridad. El userId se deriva del JWT.
    /// </summary>
    public record RequestChangeMyPassword
    {
        [Required]
        public required string PasswordActual { get; init; }

        [Required]
        [MinLength(6, ErrorMessage = "La nueva contraseña debe tener al menos 6 caracteres.")]
        public required string PasswordNueva { get; init; }

        [Required]
        public required string PasswordNuevaConfirm { get; init; }
    }
}
