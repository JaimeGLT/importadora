using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.Autentication
{
    public record RequestLogin
    {
        [Required(ErrorMessage = "Email de usuario necesario")]
        [EmailAddress(ErrorMessage = "Email no valido")]
        public required string Email { get; init; }
        [Required(ErrorMessage = "Password requerido")]
        [PasswordPropertyText]
        public required string Password { get; init; }
    }
}
