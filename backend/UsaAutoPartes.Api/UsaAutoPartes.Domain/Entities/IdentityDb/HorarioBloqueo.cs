namespace UsaAutoPartes.Domain.Entities.IdentityDb
{
    public class HorarioBloqueo
    {
        public int Id { get; set; }
        public Guid UsuarioId { get; set; }
        public TimeOnly HoraInicio { get; set; }
        public TimeOnly HoraFin { get; set; }
        public bool Activo { get; set; } = true;

        public Usuario Usuario { get; set; } = null!;
    }
}
