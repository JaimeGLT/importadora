using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Application.Dtos.ImportacionDtos
{
    public class DtoImportacionLista
    {
        /// <summary>
        /// Si viene con un id, este request es un LOTE de continuación: solo crea
        /// los productos y sus <see cref="Importacion_Detalle"/> vinculados a la
        /// Importacion existente. NO crea una nueva Importacion ni toca el proveedor.
        /// Si es null, este es el PRIMER lote: crea la Importacion, actualiza el
        /// proveedor, y devuelve su id en la respuesta para que el frontend pueda
        /// mandar los siguientes lotes con ese mismo id.
        /// </summary>
        public int? ImportacionId { get; set; }

        [Required]
        public required int Id_Proveedor { get; set; }

        [Required]
        public required DateTime Fecha { get; set; }

        [Required]
        [Range(0, double.MaxValue, ErrorMessage = "Costo total debe ser mayor o igual a 0")]
        public required decimal CostoTotal {  get; set; }

        [Required]
        public decimal F_Internacional { get; set; } = 0.00M;

        [Required]
        public decimal Aduana_Arancel { get; set; } = 0.00M;

        [Required]
        public decimal Trasporte_Interno { get; set; } = 0.00M;

        public string Tipo { get; set; } = "Internacional";

        public List<DtoImportacionProducto> Productos { get; set; } = new List<DtoImportacionProducto>();
    }
}
