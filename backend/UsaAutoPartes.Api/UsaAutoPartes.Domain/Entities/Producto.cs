using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public  class Producto : BaseEntity 
    {
        public required string Codigo { get; set; }

        public string CodigoAux { get; set; } = string.Empty;

        public string CodigoAux2 { get; set; } = string.Empty;

        public string Nombre { get; set; } = string.Empty;

        public int? MarcaId { get; set; }

        public Marca? Marca { get; set; }

        public string Descripcion { get; set; } = string.Empty;

        public string? Procedencia { get; set; }

        public string? Categoria { get; set; }

        public string Unidad_Medida { get; set; } = string.Empty;

        public string Ubicacion { get; set; } = string.Empty;

        public required int Piezas { get; set; } = 1;

        public required int Stock_Actual { get; set; }

        public required int Stock_Minimo { get; set; }

        public decimal Costo { get; private set; }

        public decimal Precio { get; private set; }

        public decimal ConversionABs { get; private set; }

        public bool EsKit { get; set; } = false;

        public int StockReservado { get; set; } = 0;

        public bool Activo { get; set; } = true;

        public DateTime? FechaEliminacion { get; set; }

        public DateTime FechaCreacion { get; set; }

        public DateTime? FechaActualizacion { get; set; }

        public List<HistorialPrecio> HistorialPrecios { get; set; } = new List<HistorialPrecio>();

        public List<PiezaKit> PiezasKit { get; set; } = new List<PiezaKit>();

        public List<AjusteStock> AjustesStock { get; set; } = new List<AjusteStock>();

        public List<ProductoImagen> Imagenes { get; set; } = new List<ProductoImagen>();

        public Producto() { }
        public Producto(decimal costo, decimal precio, decimal conversionABs)
        {
            Costo = costo;
            Precio = precio;
            ConversionABs = conversionABs;
            HistorialPrecios.Add(new HistorialPrecio
            {
                Id_producto = this.Id,
                Costo = costo,
                Precio = precio,
                ConversionABs = conversionABs,
                Nota = "Creación del producto"
            });
        }

        public HistorialPrecio CambiarPrecio(decimal Costo, decimal venta, decimal ConversionABs, string Nota)
        {
            this.Costo = Costo;
            this.Precio = venta;
            this.ConversionABs = ConversionABs;

            return new HistorialPrecio
            {
                Id_producto = this.Id,
                Costo = Costo,
                Precio = venta,
                ConversionABs = ConversionABs,
                Nota = Nota
            };
        }

        public void Reservar(int cantidad) => StockReservado += cantidad;

        public void LiberarReserva(int cantidad) => StockReservado = Math.Max(0, StockReservado - cantidad);

        public void Descontar(int cantidad)
        {
            Stock_Actual -= cantidad;
        }

        public void Devolver(int cantidad)
        {
            Stock_Actual += cantidad;
        }

        public int CalcularStockKit()
        {
            if (!PiezasKit.Any()) return 0;
            return PiezasKit.Min(p => p.StockActual / p.CantidadPorKit);
        }

        /// <summary>
        /// Stock disponible del kit descontando las piezas ya reservadas por
        /// otras órdenes (pendientes o en preparación). Distinto de
        /// <see cref="CalcularStockKit"/>, que devuelve el stock crudo y se usa
        /// internamente para mantener <see cref="Stock_Actual"/> al agregar /
        /// descontar stock — ahí NO se quieren restar reservas, porque
        /// <see cref="Stock_Actual"/> refleja el inventario físico.
        /// </summary>
        public int CalcularStockKitDisponible()
        {
            if (!PiezasKit.Any()) return 0;
            return PiezasKit.Min(p => Math.Max(0, p.StockActual - p.StockReservado) / p.CantidadPorKit);
        }

        public void ConvertirAKit(List<PiezaKit> piezas)
        {
            EsKit = true;
            foreach (var pieza in piezas)
                pieza.EstablecerStockInicial(Stock_Actual);
            PiezasKit.AddRange(piezas);
            Stock_Actual = CalcularStockKit();
        }

        public void ConvertirARegular(int stockManual)
        {
            EsKit = false;
            Stock_Actual = stockManual;
            PiezasKit.Clear();
        }

        public void AgregarStockKit(int cantidad)
        {
            foreach (var pieza in PiezasKit)
                pieza.AgregarStock(cantidad * pieza.CantidadPorKit);
            Stock_Actual = CalcularStockKit();
        }

        public void DescontarKit(int cantidad)
        {
            foreach (var pieza in PiezasKit)
                pieza.DescontarStock(cantidad * pieza.CantidadPorKit);
            Stock_Actual = CalcularStockKit();
        }

        // Returns null if valid, or error message describing which piece has insufficient free stock
        public string? ValidarPiezasSuficientes(int cantidadKits)
        {
            var cantidadActual = CalcularStockKit();
            var deltaKits = cantidadActual - cantidadKits;

            foreach (var p in PiezasKit)
            {
                var disponible = p.StockActual - p.StockReservado;
                var necesario = p.CantidadPorKit * deltaKits;
                if (disponible < necesario)
                    return $"Pieza '{p.Nombre}' tiene {disponible} disponibles (descontando {p.StockReservado} reservadas). Se necesitan {necesario} para el ajuste.";
            }
            return null;
        }

        public void ActualizarPiezas(List<PiezaKit> nuevasPiezas)
        {
            PiezasKit.Clear();
            PiezasKit.AddRange(nuevasPiezas);
            Stock_Actual = CalcularStockKit();
        }

        /// <summary>
        /// Recomputa el CodigoPieza de cada pieza del kit usando el código actual del kit padre.
        /// Ya no depende de la marca: el formato es simplemente "P{N}-{CodigoKit}".
        /// Llamar después de cambiar el código de un kit ya existente.
        /// </summary>
        public void RecomputarCodigosPiezas()
        {
            var codigoKit = Codigo;
            foreach (var pieza in PiezasKit)
                pieza.ActualizarCodigoPieza(codigoKit);
        }
    }
}
