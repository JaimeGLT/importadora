using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Exceptions.AuthenticationExceptions
{
    public class RegistroTransaccionFailException(IEnumerable<string> errors) : 
        Exception($"Fallo el reistro:  { string.Join(Environment.NewLine, errors)}");
}
