using System.ComponentModel.DataAnnotations;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.Dtos.VentaDtos
{
    public class DtoPiezaItemOrden
    {
        [Required]
        public int Id_Pieza { get; set; }

        [Required]
        [Range(1, int.MaxValue)]
        public int Cantidad { get; set; }

        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal PrecioUnitario { get; set; }

        public OrdenVentaItemPieza Crear() => new OrdenVentaItemPieza(Id_Pieza, Cantidad, PrecioUnitario);
    }
}
