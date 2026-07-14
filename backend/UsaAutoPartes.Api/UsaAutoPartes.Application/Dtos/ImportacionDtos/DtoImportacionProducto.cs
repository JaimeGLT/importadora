using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Application.Dtos.ProductosDtos;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.Dtos.ImportacionDtos
{
    public class DtoImportacionProducto : DtoProductosLista
    {
        public override Producto Crear()
        {
            var producto = base.Crear();
            return producto;
        }

        public override HistorialPrecio Actualizar(Producto producto, string Nota)
        {
            return base.Actualizar(producto, Nota);
        }

        public Importacion_Detalle CrearImportacionDetalle()
        {
            var detalle = new Importacion_Detalle
            {
                Codigo = this.Codigo,
                CodigoAux = this.CodigoAux,
                CodigoAux2 = this.CodigoAux2,
                Nombre = this.Nombre,
                MarcaId = this.MarcaId,
                Descripcion = this.Descripcion,
                Procedencia = this.Procedencia,
                Unidad_Medida = this.Unidad_Medida,
                Ubicacion = this.Ubicacion,
                Stock_Actual = this.Cantidad * Piezas,
                Stock_Minimo = this.Stock_Minimo,
                Costo = this.Costo,
                Precio = this.Precio,
                ConversionABs = this.ConversionABs,
                Piezas = this.Piezas,

            };
            return detalle;
        }
    }
}
