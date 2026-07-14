namespace UsaAutoPartes.Application.Dtos.UsuarioDtos
{
    public class DtoUsuarioResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string Apellido { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Rol { get; set; } = string.Empty;
        public bool Activo { get; set; }
        public DateTime? BloqueadoHasta { get; set; }
        public DtoHorarioResponse? Horario { get; set; }
        public decimal PorcentajeComision { get; set; }
    }
}
