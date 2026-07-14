namespace UsaAutoPartes.Application.Dtos.ProductosDtos
{
    /// <summary>
    /// DTO de salida para PiezaKit. Incluye los campos autogenerados por el backend:
    /// Orden y CodigoPieza (formato "P{N}-{PrefijoMarcaKit}-{CodigoKit}").
    /// </summary>
    public class DtoPiezaKitResponse
    {
        public int Id { get; set; }
        public int Id_Producto { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public int CantidadPorKit { get; set; }
        public int StockActual { get; set; }
        public int StockReservado { get; set; }
        public int Orden { get; set; }
        public string CodigoPieza { get; set; } = string.Empty;
    }
}
