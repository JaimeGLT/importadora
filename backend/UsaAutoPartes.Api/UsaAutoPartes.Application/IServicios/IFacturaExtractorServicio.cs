namespace UsaAutoPartes.Application.IServicios
{
    public interface IFacturaExtractorServicio
    {
        Task<byte[]> ExtraerProductosAsync(List<ArchivoFactura> archivos);
    }

    public sealed record ArchivoFactura(Stream Stream, string FileName);
}
