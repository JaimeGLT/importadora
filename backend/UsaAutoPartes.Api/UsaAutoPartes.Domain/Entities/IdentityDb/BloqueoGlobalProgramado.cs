namespace UsaAutoPartes.Domain.Entities.IdentityDb
{
    public class BloqueoGlobalProgramado
    {
        public int Id { get; set; }
        public DateTime Desde { get; set; }  // UTC
        public DateTime Hasta { get; set; }  // UTC
        public bool Aplicado { get; set; } = false;
    }
}
