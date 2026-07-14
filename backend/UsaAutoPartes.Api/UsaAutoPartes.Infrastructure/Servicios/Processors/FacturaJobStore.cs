using System.Collections.Concurrent;
using UsaAutoPartes.Application.IServicios;

namespace UsaAutoPartes.Infrastructure.Servicios.Processors
{
    // Store en memoria del proceso. Railway corre una sola instancia de la API
    // para este servicio, así que no hace falta Redis/DB para esto — los jobs
    // son efímeros (se descargan y se olvidan). Si en el futuro se escala a
    // múltiples instancias, esto necesita moverse a un store compartido.
    public sealed class FacturaJobStore : IFacturaJobStore
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromHours(1);
        private readonly ConcurrentDictionary<Guid, FacturaJob> _jobs = new();

        public Guid Crear()
        {
            LimpiarViejos();
            var job = new FacturaJob { Id = Guid.NewGuid() };
            _jobs[job.Id] = job;
            return job.Id;
        }

        public void MarcarProcesando(Guid id)
        {
            if (_jobs.TryGetValue(id, out var job))
                job.Estado = FacturaJobEstado.Procesando;
        }

        public void MarcarCompletado(Guid id, byte[] resultado)
        {
            if (_jobs.TryGetValue(id, out var job))
            {
                job.Resultado = resultado;
                job.Estado = FacturaJobEstado.Completado;
            }
        }

        public void MarcarError(Guid id, string mensaje)
        {
            if (_jobs.TryGetValue(id, out var job))
            {
                job.Error = mensaje;
                job.Estado = FacturaJobEstado.Error;
            }
        }

        public FacturaJob? Obtener(Guid id) =>
            _jobs.TryGetValue(id, out var job) ? job : null;

        // Barrido perezoso al crear un job nuevo — evita que la memoria crezca
        // sin límite si nadie descarga el resultado.
        private void LimpiarViejos()
        {
            var limite = DateTime.UtcNow - Ttl;
            foreach (var (id, job) in _jobs)
            {
                if (job.CreadoUtc < limite)
                    _jobs.TryRemove(id, out _);
            }
        }
    }
}
