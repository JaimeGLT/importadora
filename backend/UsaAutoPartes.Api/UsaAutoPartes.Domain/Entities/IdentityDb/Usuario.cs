using Microsoft.AspNetCore.Identity;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Domain.Entities.IdentityDb
{
    public class Usuario : IdentityUser<Guid>
    {
        public required string Nombre { get; set; }

        public required string Apellido { get; set; }

        public bool BloqueoHorarioActivo { get; set; }

        public bool BloqueoHorarioGlobalActivo { get; set; }

        public decimal PorcentajeComision { get; set; } = 0;

        /// <summary>
        /// Soft delete. Si tiene valor, el usuario fue "eliminado" por un admin y
        /// no puede iniciar sesión, pero sus datos transaccionales (ventas, créditos,
        /// cajas) se preservan para auditoría y reportes.
        /// </summary>
        public DateTime? EliminadoEn { get; set; }


        public bool EstaBloqueado() =>
            LockoutEnabled && LockoutEnd.HasValue && LockoutEnd.Value > DateTimeOffset.UtcNow;

        public bool EstaEliminado() => EliminadoEn.HasValue;

        public static Usuario Created(string Email, string Nombre, string Apellido)
        {
            return new Usuario
            {
                Id = Guid.NewGuid(),
                UserName = Email,
                Email = Email,
                Nombre = Nombre,
                Apellido = Apellido
            };
        }

        public override string ToString()
        {
            return $"{Nombre}  {Apellido}";
        }
    }
}
