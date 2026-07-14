using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.VentaDtos
{
    public class DtoAgregarItemOrden
    {
        /// <summary>Kit o producto regular. Si se envía Id_Pieza, puede omitirse y se infiere del kit.</summary>
        public int? Id_Producto { get; set; }

        /// <summary>Pieza individual de un kit (escaneo de código P-...).</summary>
        public int? Id_Pieza { get; set; }

        /// <summary>Código leído en escáneo; si es de una pieza del kit, agrega solo esa pieza.</summary>
        public string? CodigoEscaneado { get; set; }

        [Required, Range(1, int.MaxValue)]
        public int Cantidad { get; set; }

        /// <summary>Precio unitario a asignar. Si no se envía: 0 para piezas, precio catálogo para productos.</summary>
        public decimal? PrecioUnitario { get; set; }
    }
}
