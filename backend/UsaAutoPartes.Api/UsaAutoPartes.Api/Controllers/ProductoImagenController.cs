using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using UsaAutoPartes.Application.Dtos.ProductoImagenDtos;
using UsaAutoPartes.Application.Exceptions.GenericExceptions;
using UsaAutoPartes.Application.Exceptions.ImagenExceptions;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Application.IServicios;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;
using UsaAutoPartes.Infrastructure.Servicios.Processors;
using Path = System.IO.Path;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = $"{UsuarioRoles.Admin},{UsuarioRoles.Cajero},{UsuarioRoles.Operador}")]
    public class ProductoImagenController(
        IProductoImagenRepositorio _imagenes,
        IProductoRepositorio _productos,
        IUnitWork _db,
        IR2StorageServicio _r2,
        IOptions<CloudflareR2Options> _r2Opts,
        ILogger<ProductoImagenController> _logger) : ControllerBase
    {
        private readonly CloudflareR2Options _opts = _r2Opts.Value;

        /// <summary>Genera una URL presignada para que el cliente suba directo a R2.</summary>
        [HttpPost("presign")]
        [Authorize(Roles = $"{UsuarioRoles.Admin},{UsuarioRoles.Cajero}")]
        public async Task<IActionResult> Presign([FromBody] DtoPresignRequest datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (datos.TamanoBytes <= 0)
                return BadRequest(new { message = "TamanoBytes debe ser mayor a 0." });
            if (datos.TamanoBytes > _opts.MaxObjectBytes)
                throw new ImagenTamanoExcedidoException(datos.TamanoBytes, _opts.MaxObjectBytes);
            if (!datos.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                throw new ImagenTipoInvalidoException(datos.ContentType);

            var producto = await _productos.Obtener(datos.ProductoId);
            // Verificar límite antes de generar la URL: así evitamos firmarle una
            // imagen al cliente que después no va a poder confirmar.
            var activas = await _imagenes.CountActivasAsync(datos.ProductoId);
            if (activas >= _opts.MaxImagenesPorProducto)
                throw new ImagenLimiteExcedidoException(_opts.MaxImagenesPorProducto, activas);

            var ext = Path.GetExtension(datos.NombreArchivo);
            if (string.IsNullOrWhiteSpace(ext)) ext = ".bin";
            var guid = Guid.NewGuid().ToString("N");
            var key = $"{_opts.Prefijo.TrimEnd('/')}/{datos.ProductoId}/{guid}{ext}";

            var url = await _r2.GenerarUrlPresignadaAsync(key, datos.ContentType, datos.TamanoBytes);

            return Ok(new DtoPresignResponse
            {
                Key = key,
                Url = url,
                ExpiraEn = DateTime.UtcNow.AddSeconds(_opts.PresignTtlSeconds),
            });
        }

        /// <summary>El cliente confirma que subió el archivo; backend valida HEAD en R2 y persiste la fila.</summary>
        [HttpPost("confirmar")]
        [Authorize(Roles = $"{UsuarioRoles.Admin},{UsuarioRoles.Cajero}")]
        public async Task<IActionResult> Confirmar([FromBody] DtoConfirmarImagenRequest datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (datos.TamanoBytes > _opts.MaxObjectBytes)
                throw new ImagenTamanoExcedidoException(datos.TamanoBytes, _opts.MaxObjectBytes);
            if (!datos.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                throw new ImagenTipoInvalidoException(datos.ContentType);

            // Validar que el producto existe y está activo. No permitir subir a
            // un producto soft-deleted (la galería también se soft-deletea).
            var producto = await _productos.Obtener(datos.ProductoId);
            if (!producto.Activo) return NotFound(new { message = "Producto no encontrado." });

            // HEAD en R2 para confirmar que el objeto realmente existe.
            var existe = await _r2.ExisteAsync(datos.Key);
            if (!existe) return BadRequest(new { message = "El archivo no se encontró en el storage. Subilo de nuevo." });

            // Re-chequeo de límite (pudo haber carrera entre presign y confirmar).
            var activas = await _imagenes.CountActivasAsync(datos.ProductoId);
            if (activas >= _opts.MaxImagenesPorProducto)
                throw new ImagenLimiteExcedidoException(_opts.MaxImagenesPorProducto, activas);

            var maxOrden = await _imagenes.GetMaxOrdenAsync(datos.ProductoId);
            // Si es la primera imagen activa, se marca como principal automáticamente.
            var esPrincipal = activas == 0;

            var imagen = new ProductoImagen
            {
                Id_Producto = datos.ProductoId,
                LlaveObjeto = datos.Key,
                UrlPublica = _r2.ConstruirUrlPublica(datos.Key),
                NombreArchivo = datos.NombreArchivo,
                TipoContenido = datos.ContentType,
                TamanoBytes = datos.TamanoBytes,
                AnchoPx = datos.AnchoPx,
                AltoPx = datos.AltoPx,
                Orden = maxOrden + 1,
                EsPrincipal = esPrincipal,
                Estado = ProductoImagen.Estados.Activa,
            };

            await _imagenes.Crear(imagen);
            await _db.SaveUnitWork();

            return Created("", DtoProductoImagenResponse.FromEntity(imagen));
        }

        /// <summary>Lista la galería activa de un producto, ordenada por Orden ASC.</summary>
        [HttpGet("producto/{productoId:int}")]
        public async Task<IActionResult> ListarPorProducto(int productoId)
        {
            var lista = await _imagenes.GetByProductoAsync(productoId);
            return Ok(lista.Select(DtoProductoImagenResponse.FromEntity));
        }

        /// <summary>Marca la imagen como principal. Backend flipea en una sola transacción.</summary>
        [HttpPut("{id:int}/principal")]
        [Authorize(Roles = $"{UsuarioRoles.Admin},{UsuarioRoles.Cajero}")]
        public async Task<IActionResult> MarcarPrincipal(int id, [FromBody] DtoSetPrincipalRequest datos)
        {
            if (id != datos.ImagenId) return BadRequest(new { message = "El id de la URL no coincide con el del body." });
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var imagen = await _imagenes.GetByIdAsync(id);
            if (imagen is null || imagen.Id_Producto != datos.ProductoId)
                return NotFound(new { message = "Imagen no encontrada para este producto." });
            if (imagen.Estado != ProductoImagen.Estados.Activa)
                return BadRequest(new { message = "La imagen está eliminada." });

            // Limpiar principal actual + set nueva. El índice UNIQUE parcial
            // (IX_ProductoImagen_Producto_Principal) protege contra carrera.
            await _imagenes.ClearPrincipalAsync(datos.ProductoId);
            imagen.EsPrincipal = true;
            await _db.SaveUnitWork();

            // Devolver la lista actualizada.
            var lista = await _imagenes.GetByProductoAsync(datos.ProductoId);
            return Ok(lista.Select(DtoProductoImagenResponse.FromEntity));
        }

        /// <summary>Reordena la galería según el orden del array recibido.</summary>
        [HttpPut("reordenar")]
        [Authorize(Roles = $"{UsuarioRoles.Admin},{UsuarioRoles.Cajero}")]
        public async Task<IActionResult> Reordenar([FromBody] DtoReordenarRequest datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var actuales = await _imagenes.GetByProductoAsync(datos.ProductoId);
            var actualesIds = actuales.Select(a => a.Id).ToHashSet();
            var enviadosIds = datos.ImagenesIds.ToHashSet();

            if (enviadosIds.Count != datos.ImagenesIds.Count)
                return BadRequest(new { message = "Hay ids duplicados en la lista." });
            if (!enviadosIds.SetEquals(actualesIds))
                return BadRequest(new { message = "Los ids no coinciden con las imágenes activas del producto." });

            // Asignar Orden = index + 1. Los huecos previos (imágenes eliminadas)
            // se preservan en el orden lógico, pero re-numeramos para que el
            // cliente siempre vea 1, 2, 3 sin gaps.
            for (int i = 0; i < actuales.Count; i++)
            {
                var id = datos.ImagenesIds[i];
                var img = actuales.First(x => x.Id == id);
                img.Orden = i + 1;
            }
            await _db.SaveUnitWork();

            var lista = await _imagenes.GetByProductoAsync(datos.ProductoId);
            return Ok(lista.Select(DtoProductoImagenResponse.FromEntity));
        }

        /// <summary>Reemplaza el archivo de una imagen existente: borra el anterior en R2 y guarda la nueva key.</summary>
        [HttpPut("{id:int}/reemplazar")]
        [Authorize(Roles = $"{UsuarioRoles.Admin},{UsuarioRoles.Cajero}")]
        public async Task<IActionResult> Reemplazar(int id, [FromBody] DtoConfirmarImagenRequest datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (datos.TamanoBytes > _opts.MaxObjectBytes)
                throw new ImagenTamanoExcedidoException(datos.TamanoBytes, _opts.MaxObjectBytes);

            var imagen = await _imagenes.GetByIdAsync(id);
            if (imagen is null || imagen.Id_Producto != datos.ProductoId)
                return NotFound(new { message = "Imagen no encontrada para este producto." });
            if (imagen.Estado != ProductoImagen.Estados.Activa)
                return BadRequest(new { message = "La imagen está eliminada." });

            // Verificar que la nueva key existe en R2.
            var existe = await _r2.ExisteAsync(datos.Key);
            if (!existe) return BadRequest(new { message = "El nuevo archivo no se encontró en el storage. Subilo de nuevo." });

            var keyAnterior = imagen.LlaveObjeto;

            imagen.LlaveObjeto = datos.Key;
            imagen.UrlPublica = _r2.ConstruirUrlPublica(datos.Key);
            imagen.NombreArchivo = datos.NombreArchivo;
            imagen.TipoContenido = datos.ContentType;
            imagen.TamanoBytes = datos.TamanoBytes;
            imagen.AnchoPx = datos.AnchoPx;
            imagen.AltoPx = datos.AltoPx;

            await _db.SaveUnitWork();

            // Best-effort: borrar la versión vieja en R2 después de commitear la nueva.
            if (!string.Equals(keyAnterior, datos.Key, StringComparison.Ordinal))
                await _r2.EliminarAsync(keyAnterior);

            return Ok(DtoProductoImagenResponse.FromEntity(imagen));
        }

        /// <summary>Soft delete. Si era la principal, promueve automáticamente la siguiente por Orden.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = $"{UsuarioRoles.Admin},{UsuarioRoles.Cajero}")]
        public async Task<IActionResult> Eliminar(int id)
        {
            var imagen = await _imagenes.GetByIdAsync(id);
            if (imagen is null || imagen.Estado == ProductoImagen.Estados.Eliminada)
                return NotFound(new { message = "Imagen no encontrada." });

            var eraPrincipal = imagen.EsPrincipal;
            var productoId = imagen.Id_Producto;

            await _imagenes.Eliminar(id);

            // Si era la principal, promover la siguiente activa (menor Orden).
            if (eraPrincipal)
            {
                var restantes = await _imagenes.GetByProductoAsync(productoId);
                var nueva = restantes.OrderBy(i => i.Orden).FirstOrDefault();
                if (nueva is not null)
                {
                    nueva.EsPrincipal = true;
                    await _db.SaveUnitWork();
                }
            }
            else
            {
                await _db.SaveUnitWork();
            }

            return NoContent();
        }
    }
}
