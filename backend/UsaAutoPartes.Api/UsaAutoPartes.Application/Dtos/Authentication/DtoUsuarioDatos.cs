using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.Authentication
{
    public class DtoUsuarioDatos
    {
        public Guid Id { get; set; }

        public string Nombre { get; set; }

        public string Correo { get; set; }

        public string Rol { get; set; }
    }
}
