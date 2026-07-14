using System.ComponentModel.DataAnnotations;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.Dtos.VentaDtos
{
    public class DtoItemOrden
    {
        [Required]
        public int Id_Producto { get; set; }

        [Required]
        [Range(1, int.MaxValue)]
        public int Cantidad { get; set; }

        public bool EsParcial { get; set; } = false;

        [Range(0, double.MaxValue)]
        public decimal PrecioUnitario { get; set; }

        public List<DtoPiezaItemOrden>? Piezas { get; set; }

        public OrdenVentaItem Crear()
        {
            var item = new OrdenVentaItem(Id_Producto, Cantidad, EsParcial, PrecioUnitario);

            if (EsParcial && Piezas != null)
                item.Piezas = Piezas.Select(p => p.Crear()).ToList();

            return item;
        }
    }
}
