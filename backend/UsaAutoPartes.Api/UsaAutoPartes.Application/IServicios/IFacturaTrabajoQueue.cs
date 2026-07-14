namespace UsaAutoPartes.Application.IServicios
{
    public sealed record ArchivoFacturaBytes(byte[] Bytes, string FileName);
    public sealed record FacturaTrabajo(Guid JobId, List<ArchivoFacturaBytes> Archivos);

    public interface IFacturaTrabajoQueue
    {
        void Encolar(FacturaTrabajo trabajo);
        IAsyncEnumerable<FacturaTrabajo> DequeueAllAsync(CancellationToken ct);
    }
}
