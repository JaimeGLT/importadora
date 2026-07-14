using System.ComponentModel.DataAnnotations;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.VentaEnums;

namespace UsaAutoPartes.Application.Dtos.VentaDtos
{
    public class DtoCrearOrden
    {
        public int? Id_Cliente { get; set; }
        public string? Nota { get; set; }

        /// <summary>Descuento global aplicado a la orden completa. Se setea al cobrar.</summary>
        public int? Id_Descuento { get; set; }

        /// <summary>Monto (en Bs) del descuento global. 0 si no hay descuento.</summary>
        [Range(0, double.MaxValue)]
        public decimal MontoDescuento { get; set; } = 0;

        [Required]
        [MinLength(1)]
        public List<DtoItemOrden> Items { get; set; } = new();

        public OrdenVenta Crear(Guid idCajero, int idCaja)
        {
            var orden = new OrdenVenta(idCajero, idCaja, Id_Cliente);
            orden.Nota = Nota;
            orden.Id_Descuento = Id_Descuento;
            orden.MontoDescuento = MontoDescuento;
            orden.Modalidad = ModalidadVenta.Normal;
            orden.Items = Items.Select(i => i.Crear()).ToList();
            return orden;
        }
    }
}
