namespace UsaAutoPartes.Application.Dtos.ProductoImagenDtos
{
    /// <summary>Imagen persistida, expuesta al cliente.</summary>
    public class DtoProductoImagenResponse
    {
        public int Id { get; set; }
        public int ProductoId { get; set; }
        public string Url { get; set; } = string.Empty;
        public string Key { get; set; } = string.Empty;
        public string NombreArchivo { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public long TamanoBytes { get; set; }
        public int? AnchoPx { get; set; }
        public int? AltoPx { get; set; }
        public int Orden { get; set; }
        public bool EsPrincipal { get; set; }
        public string Estado { get; set; } = string.Empty;
        public DateTime FechaSubida { get; set; }

        public static DtoProductoImagenResponse FromEntity(UsaAutoPartes.Domain.Entities.ProductoImagen img) => new()
        {
            Id = img.Id,
            ProductoId = img.Id_Producto,
            Url = img.UrlPublica,
            Key = img.LlaveObjeto,
            NombreArchivo = img.NombreArchivo,
            ContentType = img.TipoContenido,
            TamanoBytes = img.TamanoBytes,
            AnchoPx = img.AnchoPx,
            AltoPx = img.AltoPx,
            Orden = img.Orden,
            EsPrincipal = img.EsPrincipal,
            Estado = img.Estado,
            FechaSubida = img.FechaSubida,
        };
    }
}
