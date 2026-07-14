using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Exceptions.AuthenticationExceptions
{
    public class LoginFailException(string email) : Exception($"Credenciales incorrecta para {email}");
}
