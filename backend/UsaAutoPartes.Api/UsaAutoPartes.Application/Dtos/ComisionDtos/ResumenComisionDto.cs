namespace UsaAutoPartes.Application.Dtos.ComisionDtos
{
    public class ResumenComisionDto
    {
        public string CajeroId { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string Apellido { get; set; } = string.Empty;
        public decimal TotalVentas { get; set; }
        public decimal PorcentajeComision { get; set; }
        public decimal MontoComision { get; set; }
    }
}
