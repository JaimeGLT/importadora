using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.Dtos.ProductosDtos
{
    public class ProductoCrear
    {
        [Required(ErrorMessage = "Codigo requerido")]
        public required string Codigo { get; set; }

        public string CodigoAux { get; set; } = string.Empty;

        public string CodigoAux2 { get; set; } = string.Empty;

        public string Nombre { get; set; } = string.Empty;

        public int? MarcaId { get; set; }

        public string Descripcion { get; set; } = string.Empty;

        public string? Procedencia { get; set; }

        public string? Categoria { get; set; }

        public string Unidad_Medida { get; set; } = string.Empty;

        public string Ubicacion { get; set; } = string.Empty;

        [Required(ErrorMessage = "Stock Actual requerido")]
        public required int Cantidad { get; set; }
        [Required(ErrorMessage = "Stock Minimo requerido")]
        public required int Stock_Minimo { get; set; }

        [Required(ErrorMessage = "El las pieza son obligatorias")]
        [Range(0, int.MaxValue, ErrorMessage = "Piezas fuera de rango")]
        public int Piezas { get; set; } = 1;

        [Required(ErrorMessage = "Costo requerido")]
        [Range(0.01, double.MaxValue, ErrorMessage = "Costo debe ser mayor a 0")]
        public required decimal Costo { get; set; }

        public decimal Precio { get; set; } = 0;

        [Required(ErrorMessage = "ConversionABs requerido")]
        [Range(0.01, double.MaxValue, ErrorMessage = "ConversionABs debe ser mayor a 0")]
        public required decimal ConversionABs { get; set; }



        public Producto AdaptarProducto()
        {
            var producto = new Producto(Costo, Precio, ConversionABs)
            {
                Codigo = this.Codigo,
                CodigoAux = this.CodigoAux,
                CodigoAux2 = this.CodigoAux2,
                Nombre = this.Nombre,
                MarcaId = this.MarcaId,
                Descripcion = this.Descripcion,
                Procedencia = this.Procedencia,
                Categoria = this.Categoria,
                Unidad_Medida = this.Unidad_Medida,
                Ubicacion = this.Ubicacion,
                Stock_Actual = this.Cantidad * Piezas,
                Stock_Minimo = this.Stock_Minimo,
                Piezas = this.Piezas
            };

            return producto;
        }
    }
}
