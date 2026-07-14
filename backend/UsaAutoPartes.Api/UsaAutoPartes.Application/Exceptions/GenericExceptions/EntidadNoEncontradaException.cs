using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Exceptions.GenericExceptions
{
    public class EntidadNoEncontradaException(string nombre) : Exception($"{nombre} no existe."); 
}
