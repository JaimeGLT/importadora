using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public class PiezaKit : BaseEntity
    {
        public int Id_Producto { get; set; }

        public string Nombre { get; set; } = string.Empty;

        public int CantidadPorKit { get; set; } = 1;

        public int StockActual { get; set; }

        public int StockReservado { get; set; } = 0;

        /// <summary>
        /// Posición secuencial de la pieza dentro del kit padre (1, 2, 3...).
        /// Autogenerado al crear. Los huecos se preservan cuando se elimina una pieza intermedia.
        /// </summary>
        public int Orden { get; set; }

        /// <summary>
        /// Código técnico autogenerado con formato "P{Orden}-{CodigoKit}".
        /// Ejemplo: "P1-ABC123". No depende de la marca del kit padre.
        /// </summary>
        public string CodigoPieza { get; set; } = string.Empty;

        public Producto? Producto { get; set; }

        public PiezaKit() { }

        /// <summary>
        /// Constructor de aplicación. Calcula Orden y CodigoPieza a partir del kit padre.
        /// </summary>
        /// <param name="padre">Producto kit padre (debe tener Codigo asignado).</param>
        /// <param name="nombre">Nombre descriptivo de la pieza (editable).</param>
        /// <param name="cantidadPorKit">Cantidad de esta pieza que compone un kit.</param>
        /// <param name="orden">Posición secuencial (1, 2, 3...).</param>
        public PiezaKit(Producto padre, string nombre, int cantidadPorKit, int orden)
        {
            if (padre is null) throw new ArgumentNullException(nameof(padre), "El producto padre es obligatorio.");
            if (string.IsNullOrWhiteSpace(padre.Codigo))
                throw new InvalidOperationException("El producto kit padre debe tener un Código asignado.");
            if (orden <= 0)
                throw new ArgumentOutOfRangeException(nameof(orden), "El orden debe ser mayor a 0.");

            Id_Producto = padre.Id;
            Nombre = nombre;
            CantidadPorKit = cantidadPorKit;
            Orden = orden;
            CodigoPieza = BuildCodigoPieza(orden, padre.Codigo);
        }

        /// <summary>
        /// Recomputa el CodigoPieza con un nuevo código de kit
        /// (típicamente al editar el código del kit padre).
        /// </summary>
        public void ActualizarCodigoPieza(string codigoKit)
        {
            if (string.IsNullOrWhiteSpace(codigoKit))
                throw new ArgumentException("El código del kit es obligatorio.", nameof(codigoKit));
            CodigoPieza = BuildCodigoPieza(Orden, codigoKit);
        }

        private static string BuildCodigoPieza(int orden, string codigoKit)
        {
            return $"P{orden}-{codigoKit}";
        }

        public void ActualizarDatos(string? nombre, int? cantidadPorKit)
        {
            if (!string.IsNullOrWhiteSpace(nombre))
                Nombre = nombre;
            if (cantidadPorKit.HasValue)
                CantidadPorKit = cantidadPorKit.Value;
        }

        public void EstablecerStockInicial(int stockKit)
        {
            StockActual = stockKit * CantidadPorKit;
        }

        public void Reservar(int cantidad) => StockReservado += cantidad;

        public void LiberarReserva(int cantidad) => StockReservado = Math.Max(0, StockReservado - cantidad);

        public void AgregarStock(int cantidad)
        {
            StockActual += cantidad;
        }

        public void DescontarStock(int cantidad)
        {
            StockActual -= cantidad;
        }
    }
}
