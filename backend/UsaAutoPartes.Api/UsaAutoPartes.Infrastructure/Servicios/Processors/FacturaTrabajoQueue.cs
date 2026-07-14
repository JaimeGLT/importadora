using System.Threading.Channels;
using UsaAutoPartes.Application.IServicios;

namespace UsaAutoPartes.Infrastructure.Servicios.Processors
{
    public sealed class FacturaTrabajoQueue : IFacturaTrabajoQueue
    {
        private readonly Channel<FacturaTrabajo> _channel =
            Channel.CreateUnbounded<FacturaTrabajo>();

        public void Encolar(FacturaTrabajo trabajo) =>
            _channel.Writer.TryWrite(trabajo);

        public IAsyncEnumerable<FacturaTrabajo> DequeueAllAsync(CancellationToken ct) =>
            _channel.Reader.ReadAllAsync(ct);
    }
}
