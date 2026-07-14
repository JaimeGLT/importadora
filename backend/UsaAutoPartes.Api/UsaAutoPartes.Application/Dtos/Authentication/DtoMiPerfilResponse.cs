using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.Authentication
{
    /// <summary>
    /// Respuesta devuelta por PUT /me. Reutiliza DtoUsuarioDatos pero asegura
    /// que el id también viaje (MeQuery actual no lo setea).
    /// </summary>
    public class DtoMiPerfilResponse
    {
        public Guid Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Apellido { get; set; } = string.Empty;
        public string Correo { get; set; } = string.Empty;
        public string Rol { get; set; } = string.Empty;
    }
}
