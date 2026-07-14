using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.Autentication
{
    public record RequestRegister
{
    [Required]
    public required string Nombre { get; init; }
    [Required]
    public required string Apellido { get; init; }
    [Required]
    [EmailAddress]
    public required string Email { get; init; }
    [Required]
    [PasswordPropertyText]
    public required string Password { get; init; }
    [Required]
    public required string Rol { get; init; }
}
}
