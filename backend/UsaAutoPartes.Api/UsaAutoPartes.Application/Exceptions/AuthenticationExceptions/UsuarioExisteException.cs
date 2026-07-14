using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Exceptions.Autentication
{
    public class UsuarioExisteException (string Email) : Exception ($"El email {Email} ya esta registrado");

}
