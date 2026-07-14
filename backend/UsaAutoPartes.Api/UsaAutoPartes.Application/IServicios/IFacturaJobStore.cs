namespace UsaAutoPartes.Application.IServicios
{
    public enum FacturaJobEstado { Pendiente, Procesando, Completado, Error }

    public sealed class FacturaJob
    {
        public required Guid Id { get; init; }
        public FacturaJobEstado Estado { get; set; } = FacturaJobEstado.Pendiente;
        public byte[]? Resultado { get; set; }
        public string? Error { get; set; }
        public DateTime CreadoUtc { get; init; } = DateTime.UtcNow;
    }

    public interface IFacturaJobStore
    {
        Guid Crear();
        void MarcarProcesando(Guid id);
        void MarcarCompletado(Guid id, byte[] resultado);
        void MarcarError(Guid id, string mensaje);
        FacturaJob? Obtener(Guid id);
    }
}
