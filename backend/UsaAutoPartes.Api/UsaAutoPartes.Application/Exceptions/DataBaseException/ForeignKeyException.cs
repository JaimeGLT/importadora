using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Exceptions.DataBaseException
{
    public class ForeignKeyException(string Message) : Exception(Message);
}
