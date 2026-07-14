namespace UsaAutoPartes.Domain.Entities.IdentityDb
{
    public class HorarioGlobal
    {
        public int Id { get; set; }
        public TimeOnly HoraInicio { get; set; }
        public TimeOnly HoraFin { get; set; }
        public bool Activo { get; set; } = true;
    }
}
