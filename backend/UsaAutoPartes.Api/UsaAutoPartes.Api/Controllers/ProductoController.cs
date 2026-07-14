using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Api.Helpers;
using UsaAutoPartes.Application.Dtos.ImportacionDtos;
using UsaAutoPartes.Application.Dtos.ProductosDtos;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Application.IServicios;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = $"{UsuarioRoles.Admin},{UsuarioRoles.Cajero},{UsuarioRoles.Operador}")]
    public class ProductoController(
        IProductoRepositorio _producto,
        IUnitWork _db,
        IMargenGananciaRepositorio _margen,
        IExportProductoServicio _exportServicio,
        IR2StorageServicio _r2,
        IProductoImagenRepositorio _productoImagenes,
        ILogger<ProductoController> _logger) : ControllerBase
    {
        [HttpPost]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> Crear(ProductoCrear datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (datos.Precio == 0)
            {
                var margen = await _margen.GetUnico();
                if (margen is not null)
                    datos.Precio = PrecioHelper.CalcularPrecioConMargen(datos.Costo * datos.ConversionABs, margen.Valor);
            }

            var producto = datos.AdaptarProducto();

            await _producto.Crear(producto);

            await _producto.GuardarAsync();

            return Created("", new { message = "Producto creado", id = producto.Id });
        }

        [HttpPut("{Id:int}")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> Editar(int Id, ProductoActualizar datos)
        {
            if(!ModelState.IsValid) return BadRequest(ModelState);

            // Importante: usar ObtenerConPiezas (no el genérico _producto.Obtener) para que
            // productoBd.PiezasKit venga cargado. Si el código del kit cambió, hay que
            // recomputar los CodigoPieza de cada pieza.
            var productoBd = await _db.productos.ObtenerConPiezas(Id);
            if (productoBd is null) return NotFound(new { message = "Producto no encontrado." });

            var codigoCambio = productoBd.Codigo != datos.Codigo;
            var esKitConPiezas = productoBd.EsKit && productoBd.PiezasKit?.Count > 0;

            productoBd.Codigo        = datos.Codigo;
            productoBd.CodigoAux     = datos.CodigoAux;
            productoBd.CodigoAux2    = datos.CodigoAux2;
            productoBd.Nombre        = datos.Nombre;
            productoBd.MarcaId       = datos.MarcaId;
            productoBd.Descripcion   = datos.Descripcion;
            productoBd.Procedencia   = datos.Procedencia;
            productoBd.Categoria     = datos.Categoria;
            productoBd.Unidad_Medida = datos.Unidad_Medida;
            productoBd.Ubicacion     = datos.Ubicacion;
            productoBd.Piezas        = datos.Piezas;
            productoBd.Stock_Minimo  = datos.Stock_Minimo;

            if (codigoCambio && esKitConPiezas)
            {
                productoBd.RecomputarCodigosPiezas();
            }

            await _db.SaveUnitWork();

            return Ok(new {message = "Producto editado"});
        }

        [HttpPost("CambiarPrecio/{Id:int}")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> Cambiarprecio(int Id, DtoProductoUPrecio datos)
        {
            var productoBd = await _db.productos.Obtener(Id);
            if (productoBd is null) return NotFound();

            var ultimoHistorial = await _db.historialPrecios.GetUltimoPrecio(Id);

            var costo      = datos.Costo          ?? ultimoHistorial?.Costo          ?? productoBd.Costo;
            var precio     = datos.Precio          ?? ultimoHistorial?.Precio         ?? productoBd.Precio;
            var conversion = datos.ConversionABs   ?? ultimoHistorial?.ConversionABs  ?? productoBd.ConversionABs;

            var historial = productoBd.CambiarPrecio(costo, precio, conversion, datos.Nota);

            await _db.historialPrecios.Crear(historial);

            await _db.SaveUnitWork();

            return Ok(new { message = "Precio cambiado" });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> Eliminar(int id)
        {
            // Capturar las keys de las imágenes activas ANTES del soft delete,
            // porque después las filas se marcan como Eliminadas y la query
            // CountActivas/GetByProducto ya no las devolvería.
            var imagenes = await _db.productosImagenes.GetByProductoAsync(id);
            var keysR2 = imagenes.Select(i => i.LlaveObjeto).ToList();

            await _producto.Eliminar(id);
            await _producto.GuardarAsync();

            // Soft delete en cascada de la galería (marca Estado='Eliminada', EsPrincipal=false).
            // NO toca R2 — el GC recoge los objetos viejos eventualmente. Conservamos
            // los objetos por si el producto se restaura (Activo=true vía bulk import).
            await _db.productosImagenes.SoftDeleteByProductoAsync(id);
            await _db.SaveUnitWork();

            // Best-effort: borrar de R2 en background. No bloqueamos la respuesta.
            // Si R2 está caído, los objetos se quedan — no es crítico para el soft delete.
            _ = Task.Run(async () =>
            {
                foreach (var key in keysR2)
                {
                    try { await _r2.EliminarAsync(key); }
                    catch (Exception ex) { _logger.LogWarning(ex, "Fallo borrando {Key} de R2 al eliminar producto {Id}", key, id); }
                }
            });

            return NoContent();
        }

        [HttpPost("lista")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> CrearLista(DtoListaProducto Lista)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (Lista.Productos == null || !Lista.Productos.Any())
                return BadRequest(new { mensaje = "La lista está vacía." });

            int CreadoCant = 0;
            int ActualizadoCant = 0;

            var margenLista = await _margen.GetUnico();
            var nuevosEnSesion = new Dictionary<(string, int?), Producto>();

            foreach (var item in Lista.Productos)
            {
                if (item.Precio == 0 && margenLista is not null)
                    item.Precio = PrecioHelper.CalcularPrecioConMargen(item.Costo * item.ConversionABs, margenLista.Valor);

                var key = (item.Codigo, item.MarcaId);
                bool esNuevoEnSesion = nuevosEnSesion.TryGetValue(key, out var tracked);
                var producto = esNuevoEnSesion
                    ? tracked
                    : await _db.productos.GetProductoforCodigo(item.Codigo, item.MarcaId);

                if (producto != null)
                {
                    if (!producto.Activo)
                    {
                        producto.Activo = true;
                        producto.FechaEliminacion = null;
                    }

                    if (producto.EsKit)
                    {
                        var cantidadNueva = item.Cantidad;
                        var preciocambio = item.Precio > 0 ? item.Precio : producto.Precio;
                        var costocambio = item.Costo > 0 ? item.Costo : producto.Costo;
                        var precio = producto.CambiarPrecio(costocambio, preciocambio, item.ConversionABs, "Actualizacion de la lista");
                        if (!esNuevoEnSesion) await _db.historialPrecios.Crear(precio);
                        if (cantidadNueva > 0)
                            producto.AgregarStockKit(cantidadNueva);
                    }
                    else
                    {
                        var historial = item.Actualizar(producto, "Actualizacion de la lista");
                        if (!esNuevoEnSesion) await _db.historialPrecios.Crear(historial);
                    }
                    ActualizadoCant++;
                }
                else
                {
                    var newproducto = item.Crear();
                    await _db.productos.Crear(newproducto);
                    nuevosEnSesion[key] = newproducto;
                    CreadoCant++;
                }
            }

            await _db.SaveUnitWork();

            var res = new DtoRespuestaLista(ActualizadoCant, CreadoCant);

            return Ok(res);
        }

        [HttpPost("importacion")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> Importar(DtoImportacionLista datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (datos.Productos == null || !datos.Productos.Any())
                return BadRequest(new { mensaje = "La lista está vacía." });

            // Lotes por batches (frontend manda de 100 en 100). El primer lote
            // llega sin ImportacionId: crea la Importacion, asigna correlativo,
            // y suma al proveedor. Los lotes siguientes llegan con ImportacionId:
            // solo anexan productos y sus detalles a la Importacion existente,
            // sin tocar el proveedor ni asignar otro correlativo. Esto permite
            // que la UI muestre progreso real (current / total) por cada lote
            // completado, y que un fallo a mitad del camino NO haga rollback
            // de los lotes ya commiteados.
            var esPrimerLote = datos.ImportacionId == null;

            int CreadoCant = 0;
            int ActualizadoCant = 0;

            var detallesImportacion = new List<Importacion_Detalle>();

            // Tracking en memoria de productos recién creados DENTRO de este mismo
            // POST. Sin esto, si el Excel tiene 2 filas con el mismo (Codigo, MarcaId),
            // la primera crea el producto (en el contexto, sin commit), la segunda
            // lo busca (no lo encuentra porque no hay commit aún) e intenta crear
            // otro con la misma key → IX_Producto_Codigo_Marca explota.
            // Mismo patrón que usa CrearLista (línea ~139). La clave compuesta
            // (Codigo, MarcaId) deja pasar (ABC, M1) + (ABC, M2) como productos
            // distintos, pero une (ABC, M1) + (ABC, M1) en el segundo update.
            //
            // CAVEAT: este Dict vive solo en el proceso del backend. Si hay varios
            // workers, el state NO se comparte entre procesos. Aceptable porque
            // ya es así en Inventario (/Producto/lista) y la sesión lo confirmó.
            var nuevosEnSesion = new Dictionary<(string, int?), Producto>();

            foreach (var item in datos.Productos)
            {
                var key = (item.Codigo, item.MarcaId);
                bool esNuevoEnSesion = nuevosEnSesion.TryGetValue(key, out var tracked);
                var producto = esNuevoEnSesion
                    ? tracked
                    : await _db.productos.GetProductoforCodigo(item.Codigo, item.MarcaId);

                if (producto != null)
                {
                    if (!producto.Activo)
                    {
                        producto.Activo = true;
                        producto.FechaEliminacion = null;
                    }

                    if (producto.EsKit)
                    {
                        var cantidadNueva = item.Cantidad;
                        var preciocambio = item.Precio > 0 ? item.Precio : producto.Precio;
                        var costocambio = item.Costo > 0 ? item.Costo : producto.Costo;
                        var precio = producto.CambiarPrecio(costocambio, preciocambio, item.ConversionABs, "Actualizado por importacion");
                        // Skip HistorialPrecio si el producto es nuevo en esta misma sesión:
                        // su Id todavía es 0/temporal, y el INSERT del historial violaría
                        // el FK FK_HistorialPrecio_Producto. Mismo patrón que CrearLista.
                        if (!esNuevoEnSesion) await _db.historialPrecios.Crear(precio);
                        if (cantidadNueva > 0)
                            producto.AgregarStockKit(cantidadNueva);
                    }
                    else
                    {
                        var precio = item.Actualizar(producto, "Actualizado por importacion");
                        if (!esNuevoEnSesion) await _db.historialPrecios.Crear(precio);
                    }

                    var detalle = item.CrearImportacionDetalle();
                    detalle.Tipo = "Stock+";
                    detallesImportacion.Add(detalle);
                    ActualizadoCant++;
                }
                else
                {
                    var newproducto = item.Crear();
                    await _db.productos.Crear(newproducto);
                    nuevosEnSesion[key] = newproducto; // ← clave: registrar para la próxima iteración
                    var detalle = item.CrearImportacionDetalle();
                    detalle.Tipo = "Nuevo";
                    detallesImportacion.Add(detalle);
                    CreadoCant++;
                }
            }

            Importacion importacion;

            if (esPrimerLote)
            {
                var proveedor = await _db.proveedores.Obtener(datos.Id_Proveedor);
                if (proveedor is null)
                    return BadRequest(new { mensaje = "Proveedor no encontrado." });

                // El CostoTotal del request corresponde al TOTAL de la importacion
                // completa (no solo al primer lote), porque el frontend lo calcula
                // sobre todos los items. Por eso solo se suma al proveedor UNA vez,
                // aquí en el primer lote.
                proveedor.CanImportaciones++;
                proveedor.Total += datos.CostoTotal;

                var correlativo = await _db.importaciones.Count(x => x.Fecha.Year == datos.Fecha.Year) + 1;

                importacion = new Importacion
                {
                    Codigo = $"IMP-{datos.Fecha.Year}-{correlativo.ToString()}",
                    Id_Proveedor = datos.Id_Proveedor,
                    Fecha = datos.Fecha,
                    Total = datos.CostoTotal,
                    CantProductos = datos.Productos.Count(),
                    F_Internacional = datos.F_Internacional,
                    Aduana_Arancel = datos.Aduana_Arancel,
                    Trasporte_Interno = datos.Trasporte_Interno,
                    Tipo = datos.Tipo ?? "Internacional",
                    Detalles = detallesImportacion
                };

                await _db.importaciones.Crear(importacion);
            }
            else
            {
                importacion = await _db.importaciones.Obtener(datos.ImportacionId!.Value);
                if (importacion is null)
                    return BadRequest(new { mensaje = "Importacion no encontrada para continuar el lote." });

                // Anexar los detalles a la coleccion existente. EF los persistira
                // con el Id_Importacion correcto al hacer SaveChanges.
                importacion.Detalles.AddRange(detallesImportacion);
                importacion.CantProductos += datos.Productos.Count;
            }

            await _db.SaveUnitWork();

            // Devolvemos el ImportacionId en TODOS los lotes para que el frontend
            // pueda confirmar/referenciar la importacion al final.
            var res = new DtoRespuestaLista(ActualizadoCant, CreadoCant, importacion.Id);

            return Ok(res);
        }

        [HttpPut("ConvertirKit/{id:int}")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> ConvertirAKit(int id, DtoConvertirAKit datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var producto = await _db.productos.ObtenerConPiezasYMarca(id);
            if (producto is null) return NotFound(new { message = "Producto no encontrado." });
            if (producto.EsKit) return BadRequest(new { message = "El producto ya es un kit." });

            var orden = 0;
            var piezas = new List<PiezaKit>(datos.Piezas.Count);
            foreach (var dto in datos.Piezas)
            {
                orden += 1;
                piezas.Add(new PiezaKit(producto, dto.Nombre, dto.CantidadPorKit, orden));
            }

            producto.ConvertirAKit(piezas);
            await _db.SaveUnitWork();

            return Ok(new { message = "Producto convertido a kit." });
        }

        [HttpPut("ConvertirRegular/{id:int}")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> ConvertirARegular(int id, DtoConvertirARegular datos)
        {
            var producto = await _db.productos.ObtenerConPiezas(id);
            if (producto is null) return NotFound(new { message = "Producto no encontrado." });
            if (!producto.EsKit) return BadRequest(new { message = "El producto ya es regular." });

            var stockFinal = datos.StockManual ?? producto.CalcularStockKit();
            producto.ConvertirARegular(stockFinal);

            await _db.SaveUnitWork();

            return Ok(new { message = "Producto convertido a regular.", stockFinal });
        }

        [HttpPost("{id:int}/Piezas")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> AgregarPiezas(int id, DtoConvertirAKit datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var producto = await _db.productos.ObtenerConPiezasYMarca(id);
            if (producto is null) return NotFound(new { message = "Producto no encontrado." });
            if (!producto.EsKit) return BadRequest(new { message = "El producto no es un kit." });

            // El cálculo de Orden usa el máximo existente + 1. Los huecos se preservan
            // (si se eliminó P2, las piezas nuevas siguen a partir del último máximo + 1).
            // El índice único (Id_Producto, Orden) protege contra carreras: dos POST
            // simultáneos que intenten usar el mismo Orden rebotarán con 23505.
            var maxOrden = producto.PiezasKit.Count == 0
                ? 0
                : producto.PiezasKit.Max(p => p.Orden);

            var stockActual = producto.CalcularStockKit();
            var nuevasPiezas = new List<PiezaKit>(datos.Piezas.Count);
            foreach (var dto in datos.Piezas)
            {
                maxOrden += 1;
                var pieza = new PiezaKit(producto, dto.Nombre, dto.CantidadPorKit, maxOrden);
                pieza.EstablecerStockInicial(stockActual);
                nuevasPiezas.Add(pieza);
            }

            producto.PiezasKit.AddRange(nuevasPiezas);
            producto.Stock_Actual = producto.CalcularStockKit();
            await _db.SaveUnitWork();

            var response = nuevasPiezas.Select(p => new DtoPiezaKitResponse
            {
                Id = p.Id,
                Id_Producto = p.Id_Producto,
                Nombre = p.Nombre,
                CantidadPorKit = p.CantidadPorKit,
                StockActual = p.StockActual,
                StockReservado = p.StockReservado,
                Orden = p.Orden,
                CodigoPieza = p.CodigoPieza,
            });

            return Created("", new { message = "Piezas agregadas.", piezas = response });
        }

        [HttpPut("{id:int}/Piezas/{piezaId:int}")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> ActualizarPieza(int id, int piezaId, DtoActualizarPieza datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var pieza = await _db.piezasKit.Obtener(piezaId);
            if (pieza.Id_Producto != id) return BadRequest(new { message = "La pieza no pertenece a este producto." });

            pieza.ActualizarDatos(datos.Nombre, datos.CantidadPorKit);

            if (datos.CantidadPorKit.HasValue)
            {
                var producto = await _db.productos.ObtenerConPiezas(id);
                if (producto is not null)
                {
                    var nuevoStock = producto.CalcularStockKit();
                    if (nuevoStock < producto.StockReservado)
                        return Conflict(new { message = $"No se puede cambiar la cantidad. El nuevo stock ({nuevoStock}) sería menor al stock reservado ({producto.StockReservado})." });
                    producto.Stock_Actual = nuevoStock;
                }
            }

            await _db.SaveUnitWork();

            return Ok(new { message = "Pieza actualizada." });
        }

        [HttpDelete("{id:int}/Piezas/{piezaId:int}")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> EliminarPieza(int id, int piezaId)
        {
            var pieza = await _db.piezasKit.Obtener(piezaId);
            if (pieza.Id_Producto != id) return BadRequest(new { message = "La pieza no pertenece a este producto." });

            await _db.piezasKit.Eliminar(piezaId);
            await _db.SaveUnitWork();

            return NoContent();
        }

        [HttpGet("buscar")]
        [Authorize(Roles = $"{UsuarioRoles.Admin},{UsuarioRoles.Cajero},{UsuarioRoles.Operador}")]
        public async Task<IActionResult> BuscarPorCodigo([FromQuery] string codigo)
        {
            if (string.IsNullOrWhiteSpace(codigo))
                return BadRequest(new { message = "Indique un código." });

            var producto = await _producto.BuscarPorCodigoEscaneo(codigo);
            if (producto is null)
                return NotFound(new { message = "Producto no encontrado." });

            return Ok(new
            {
                id = producto.Id,
                codigo = producto.Codigo,
                nombre = producto.Nombre,
                precio = producto.Precio,
                stock_Actual = producto.Stock_Actual,
                stockReservado = producto.StockReservado,
                esKit = producto.EsKit,
                ubicacion = producto.Ubicacion,
                marcaId = producto.MarcaId,
                marca = producto.Marca?.Nombre,
                piezas = producto.EsKit
                    ? producto.PiezasKit.Select(p => new
                    {
                        id = p.Id,
                        nombre = p.Nombre,
                        stockActual = p.StockActual,
                        stockReservado = p.StockReservado,
                        cantidadPorKit = p.CantidadPorKit,
                        orden = p.Orden,
                        codigoPieza = p.CodigoPieza
                    })
                    : null
            });
        }

        [HttpGet("buscar-lista")]
        [Authorize(Roles = $"{UsuarioRoles.Admin},{UsuarioRoles.Cajero},{UsuarioRoles.Operador}")]
        public async Task<IActionResult> BuscarLista([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return BadRequest(new { message = "Indique un término." });

            var lista = await _producto.BuscarPorTermino(q).ToListAsync();

            if (q.Contains('-'))
            {
                var exacto = await _producto.BuscarPorCodigoEscaneo(q);
                if (exacto != null && !lista.Any(p => p.Id == exacto.Id))
                    lista.Insert(0, exacto);
            }

            // Batch: traer todas las imágenes activas de los productos de la lista
            // en una sola query para evitar N+1. La portada es la primera por
            // Orden ASC (mismo criterio que `imagenPrincipal` en el schema
            // GraphQL de `ProductoType`).
            var imagenesPorProducto = await _productoImagenes.GetByProductosAsync(lista.Select(p => p.Id));

            return Ok(lista.Select(p =>
            {
                var primera = imagenesPorProducto.TryGetValue(p.Id, out var imgs) && imgs.Count > 0
                    ? imgs[0]
                    : null;
                return new
                {
                    id               = p.Id,
                    codigo           = p.Codigo,
                    codigoAux        = p.CodigoAux,
                    codigoAux2       = p.CodigoAux2,
                    nombre           = p.Nombre,
                    marcaId          = p.MarcaId,
                    marca            = p.Marca?.Nombre,
                    ubicacion        = p.Ubicacion,
                    stock_Actual     = p.Stock_Actual,
                    stockReservado   = p.StockReservado,
                    stock_Minimo     = p.Stock_Minimo,
                    calcularStockKit = p.EsKit ? (int?)p.CalcularStockKit() : null,
                    calcularStockKitDisponible = p.EsKit ? (int?)p.CalcularStockKitDisponible() : null,
                    piezas           = p.Piezas,
                    costo            = p.Costo,
                    precio           = p.Precio,
                    conversionABs    = p.ConversionABs,
                    esKit            = p.EsKit,
                    descripcion      = p.Descripcion,
                    procedencia      = p.Procedencia,
                    unidad_Medida    = p.Unidad_Medida,
                    categoria        = p.Categoria,
                    fechaCreacion    = p.FechaCreacion,
                    fechaActualizacion = p.FechaActualizacion,
                    // Portada: la primera imagen activa por Orden ASC. Mismo
                    // criterio que el resolver `imagenPrincipal` del schema
                    // GraphQL para que la card y la tabla sean consistentes.
                    imagenPrincipal  = primera == null
                        ? null
                        : new
                        {
                            id    = primera.Id,
                            url   = primera.UrlPublica,
                            orden = primera.Orden,
                        },
                };
            }));
        }

        [HttpGet("exportar")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> ExportarExcel()
        {
            var bytes = await _exportServicio.GenerarExcelInventario();
            var filename = $"inventario_{DateTime.Now:yyyy-MM-dd}.xlsx";
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
        }
    }
}
