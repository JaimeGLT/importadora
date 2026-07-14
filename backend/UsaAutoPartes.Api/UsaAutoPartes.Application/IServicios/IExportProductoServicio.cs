namespace UsaAutoPartes.Application.IServicios
{
    public interface IExportProductoServicio
    {
        Task<byte[]> GenerarExcelInventario();
    }
}
