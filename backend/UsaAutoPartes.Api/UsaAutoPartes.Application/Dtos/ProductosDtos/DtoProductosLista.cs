using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.Dtos.ProductosDtos
{
    public class DtoProductosLista
    {
        [Required]
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

        [Required]
        public required int Cantidad { get; set; }

        public int Stock_Minimo { get; set; } = 0;

        [Required(ErrorMessage = "El las pieza son obligatorias")]
        [Range(0, int.MaxValue, ErrorMessage = "Piezas fuera de rango")]
        public int Piezas { get; set; } = 1;

        [Required(ErrorMessage = "El campo ConversionABs es obligatorio.")]
        public decimal ConversionABs { get; set; }

        [Required]
        [Range(0, double.MaxValue, ErrorMessage = "El costo no puede ser negativo")]
        public required decimal Costo { get; set; } = 0;

        public decimal Precio { get; set; } = 0;


        public virtual Producto Crear()
        {
            var precio = this.Precio > 0 ? this.Precio : 0;
            var costo = this.Costo;
            var producto = new Producto(costo, precio, this.ConversionABs)
            {
                Codigo = Codigo,
                CodigoAux = this.CodigoAux != string.Empty ? this.CodigoAux : string.Empty,
                CodigoAux2 = this.CodigoAux2 != string.Empty ? this.CodigoAux2 : string.Empty,
                Nombre = this.Nombre,
                MarcaId = this.MarcaId,
                Ubicacion = this.Ubicacion != string.Empty ? this.Ubicacion : string.Empty,
                Descripcion = this.Descripcion != string.Empty ? this.Descripcion : string.Empty,
                Procedencia = this.Procedencia,
                Categoria = this.Categoria,
                Unidad_Medida = this.Unidad_Medida != string.Empty ? this.Unidad_Medida : string.Empty,
                Stock_Actual = this.Cantidad * this.Piezas,
                Stock_Minimo = this.Stock_Minimo <= 0 ? 5 : this.Stock_Minimo,
                Piezas = this.Piezas
            }; 

            return producto;
        }   


        public virtual HistorialPrecio Actualizar(Producto producto, string Nota)
        {
            producto.CodigoAux = this.CodigoAux != string.Empty? CodigoAux : producto.CodigoAux;
            producto.CodigoAux2 = this.CodigoAux2 != string.Empty ? this.CodigoAux2 : producto.CodigoAux2;
            producto.Nombre = this.Nombre != string.Empty ? this.Nombre : producto.Nombre;
            if (this.MarcaId.HasValue) producto.MarcaId = this.MarcaId;
            producto.Descripcion = this.Descripcion != string.Empty ? this.Descripcion : producto.Descripcion;
            if (this.Procedencia != null) producto.Procedencia = this.Procedencia;
            if (this.Categoria != null) producto.Categoria = this.Categoria;
            producto.Unidad_Medida = this.Unidad_Medida != string.Empty ? this.Unidad_Medida : producto.Unidad_Medida;
            producto.Stock_Actual += this.Cantidad * this.Piezas;
            producto.Stock_Minimo = this.Stock_Minimo <= 0 ? producto.Stock_Minimo : this.Stock_Minimo;
            producto.Ubicacion = this.Ubicacion != string.Empty ? this.Ubicacion: producto.Ubicacion;
            producto.Piezas = this.Piezas;
            var preciocambio = this.Precio > 0 ? this.Precio : producto.Precio;
            var costocambio = this.Costo > 0 ? this.Costo : producto.Costo;

            return producto.CambiarPrecio(costocambio, preciocambio, this.ConversionABs, Nota);
        }
    }
}
