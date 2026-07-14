using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.ProductosDtos
{
    public class DtoListaProducto
    {

        public List<DtoProductosLista> Productos { get; set; } = new List<DtoProductosLista>();
    }
}
