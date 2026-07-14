using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.ProductosDtos
{
    public record DtoRespuestaLista
    {
        public int Actualizados { get; set; }

        public int Creados { get; set; }

        /// <summary>
        /// Id de la Importacion afectada por este lote. En el PRIMER lote es el id
        /// recién creado (para que el frontend pueda seguir mandando lotes con él);
        /// en lotes de continuación es el mismo id que el frontend ya tenía.
        /// </summary>
        public int? ImportacionId { get; set; }

        public DtoRespuestaLista(int actualizados, int creados, int? importacionId = null)
        {
            Actualizados = actualizados;
            Creados = creados;
            ImportacionId = importacionId;
        }
    }
}
