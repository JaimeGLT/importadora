using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using UsaAutoPartes.Application.Dtos.CreditoDtos;
using UsaAutoPartes.Application.Exceptions.CreditoExceptions;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.CajaEnums;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;
using UsaAutoPartes.Domain.Enum.VentaEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = $"{UsuarioRoles.Cajero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
    public class CreditoController(
        IUnitWork _db,
        ICajaRepositorio _cajas,
        IMovimientoCajaRepositorio _movimientos) : ControllerBase
    {
        // POST /api/Credito
        // Crea un crédito con orden previa (Id_OrdenVenta) o venta rápida (Items[]).
        [HttpPost]
        public async Task<IActionResult> Crear(DtoCrearCredito datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var caja = await _cajas.GetCajaActivaByUsuario(userId);
            if (caja is null) return BadRequest(new { message = "No tienes una caja abierta." });

            // Validar cliente
            var cliente = await _db.Set<Cliente>().FirstOrDefaultAsync(c => c.Id == datos.Id_Cliente);
            if (cliente is null) return BadRequest(new { message = "El cliente indicado no existe." });

            decimal total;
            int? idOrden = null;

            if (datos.Id_OrdenVenta.HasValue)
            {
                // Crédito con orden: reutilizar el subtotal calculado por la orden
                var orden = await _db.ordenesVenta.GetConItems(datos.Id_OrdenVenta.Value);
                if (orden is null) return NotFound(new { message = "Orden no encontrada." });
                if (orden.Id_Cajero != userId) return Forbid();
                if (orden.Estado != EstadosOrden.Completada) return BadRequest(new { message = "La orden debe estar completada para generar un crédito." });
                if (!orden.Id_Cliente.HasValue || orden.Id_Cliente.Value != datos.Id_Cliente)
                    return BadRequest(new { message = "El cliente de la orden no coincide con el del crédito." });

                total = orden.CalcularSubtotalNeto();
                idOrden = orden.Id;
            }
            else
            {
                // Venta rápida: validar items y descontar stock
                if (datos.Items is null || datos.Items.Count == 0)
                    return BadRequest(new { message = "La venta rápida requiere al menos un item." });

                if (datos.Total <= 0)
                    return BadRequest(new { message = "El total del crédito debe ser mayor a 0." });

                total = datos.Total;

                // Validar stock ANTES de crear el crédito
                foreach (var itemDto in datos.Items)
                {
                    if (itemDto.Id_Pieza.HasValue)
                    {
                        // ── Pieza suelta de un kit ────────────────────────────
                        var pieza = await _db.piezasKit.Obtener(itemDto.Id_Pieza.Value);
                        if (pieza is null)
                            return NotFound(new { message = $"Pieza {itemDto.Id_Pieza} no encontrada." });

                        var productoKit = await _db.productos.ObtenerConPiezas(pieza.Id_Producto);
                        if (productoKit is null)
                            return NotFound(new { message = "Kit del producto no encontrado." });
                        if (!productoKit.EsKit)
                            return BadRequest(new { message = "La pieza no pertenece a un kit." });

                        if (itemDto.Id_Producto != 0 && itemDto.Id_Producto != productoKit.Id)
                            return BadRequest(new { message = "Id_Pieza no corresponde al Id_Producto indicado." });

                        var disponiblePieza = pieza.StockActual - pieza.StockReservado;
                        if (disponiblePieza < itemDto.Cantidad)
                            return BadRequest(new { message = $"Stock insuficiente de {pieza.Nombre}. Disponible: {disponiblePieza}." });
                    }
                    else
                    {
                        // ── Producto regular o kit completo ───────────────────
                        var producto = await _db.productos.ObtenerConPiezas(itemDto.Id_Producto);
                        if (producto is null) return NotFound(new { message = $"Producto {itemDto.Id_Producto} no encontrado." });

                        if (!producto.EsKit)
                        {
                            var disponible = producto.Stock_Actual - producto.StockReservado;
                            if (disponible < itemDto.Cantidad)
                                return BadRequest(new { message = $"Stock insuficiente para {producto.Nombre}. Disponible: {disponible}." });
                        }
                        else
                        {
                            foreach (var pieza in producto.PiezasKit)
                            {
                                var cantidadPieza = itemDto.Cantidad * pieza.CantidadPorKit;
                                var disponiblePieza = pieza.StockActual - pieza.StockReservado;
                                if (disponiblePieza < cantidadPieza)
                                    return BadRequest(new { message = $"Stock insuficiente de {pieza.Nombre} para el kit {producto.Nombre}. Disponible: {disponiblePieza}." });
                            }
                        }
                    }
                }
            }

            // Aplicar descuento global (si vino). Se descuenta del subtotal
            // calculado arriba (sea de la orden o de la venta rápida).
            int? idDescuento = null;
            decimal montoDescuento = 0;
            if (datos.Id_Descuento.HasValue)
            {
                if (datos.MontoDescuento < 0)
                    return BadRequest(new { message = "El monto del descuento no puede ser negativo." });

                idDescuento = datos.Id_Descuento;
                montoDescuento = datos.MontoDescuento;
                total = Math.Round(Math.Max(0, total - montoDescuento), 2);

                if (total <= 0)
                    return BadRequest(new { message = "El total del crédito no puede ser 0 o negativo después del descuento." });
            }

            // Crear el crédito
            var credito = new Credito(datos.Id_Cliente, userId, caja.Id, idOrden, total, idDescuento, montoDescuento, datos.Nota);
            await _db.creditos.Crear(credito);
            await _db.SaveUnitWork(); // Para obtener el Id autogenerado

            // Si es venta rápida: crear los CreditoItem y descontar stock
            if (datos.EsVentaRapida)
            {
                foreach (var itemDto in datos.Items!)
                {
                    var creditoItem = itemDto.Crear(credito.Id);
                    credito.Items.Add(creditoItem); // Cascade add via navigation property

                    if (itemDto.Id_Pieza.HasValue)
                    {
                        // ── Pieza suelta: descontar stock de la pieza ───────
                        var pieza = await _db.piezasKit.Obtener(itemDto.Id_Pieza.Value);
                        if (pieza is null) continue;

                        pieza.DescontarStock(itemDto.Cantidad);

                        // Recalcular stock del kit padre
                        var productoKit = await _db.productos.ObtenerConPiezas(pieza.Id_Producto);
                        if (productoKit is not null)
                            productoKit.Stock_Actual = productoKit.CalcularStockKit();
                    }
                    else
                    {
                        // ── Producto regular o kit completo ────────────────
                        var producto = await _db.productos.ObtenerConPiezas(itemDto.Id_Producto);
                        if (producto is null) continue;

                        if (!producto.EsKit)
                        {
                            producto.Descontar(itemDto.Cantidad);
                        }
                        else
                        {
                            foreach (var pieza in producto.PiezasKit)
                                pieza.DescontarStock(itemDto.Cantidad * pieza.CantidadPorKit);
                            producto.Stock_Actual = producto.CalcularStockKit();
                        }
                    }
                }

                await _db.SaveUnitWork();
            }

            // Recargar el crédito con sus items para devolver
            var response = await GetCreditoResponseAsync(credito.Id);
            return Created("", new { message = "Crédito creado.", creditoId = credito.Id, credito = response });
        }

        // GET /api/Credito?estado=&clienteId=&page=&pageSize=
        [HttpGet]
        public async Task<IActionResult> Listar(
            [FromQuery] string? estado,
            [FromQuery] int? clienteId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var query = _db.creditos.CreditoQuery()
                .Include(c => c.Cliente)
                .Include(c => c.Cajero)
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(estado))
                query = query.Where(c => c.Estado == estado);

            if (clienteId.HasValue)
                query = query.Where(c => c.Id_Cliente == clienteId.Value);

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(c => c.FechaCreacion)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var dtos = items.Select(MapToListDto).ToList();

            return Ok(new
            {
                totalCount,
                page,
                pageSize,
                items = dtos
            });
        }

        // GET /api/Credito/{id}
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Detalle(int id)
        {
            var credito = await _db.creditos.GetConItemsYPagosAsync(id);
            if (credito is null) return NotFound(new { message = "Crédito no encontrado." });

            return Ok(MapToDetailDto(credito));
        }

        // POST /api/Credito/{id}/Pago
        [HttpPost("{id:int}/Pago")]
        public async Task<IActionResult> RegistrarPago(int id, DtoRegistrarPago datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            // Tracking ON para que EF Core use RowVersion en el WHERE del UPDATE.
            var credito = await _db.creditos.GetParaActualizarAsync(id);
            if (credito is null) return NotFound(new { message = "Crédito no encontrado." });

            // Validar que la caja esté abierta
            var caja = await _cajas.GetCajaActivaByUsuario(userId);
            if (caja is null) return BadRequest(new { message = "No tienes una caja abierta." });

            // Validar tipo de pago
            var tiposValidos = new[] { TipoPago.Efectivo, TipoPago.QR, TipoPago.Tarjeta };
            if (!tiposValidos.Contains(datos.TipoPago))
                return BadRequest(new { message = "Tipo de pago inválido." });

            // Crear el MovimientoCaja (ingreso por cobranza de crédito)
            var movimiento = new MovimientoCaja(
                caja.Id,
                TipoMovimiento.Ingreso,
                CategoriaMovimiento.CobranzaCredito,
                datos.TipoPago,
                datos.Monto,
                $"Cobranza crédito #{credito.Id}");
            await _movimientos.Crear(movimiento);
            await _movimientos.GuardarAsync();

            // Crear el CreditoPago
            var pago = new CreditoPago(credito.Id, caja.Id, userId, datos.Monto, datos.TipoPago, datos.Nota);
            pago.VincularMovimientoCaja(movimiento.Id);
            credito.Pagos.Add(pago); // Cascade add via navigation property

            // Actualizar el crédito (esto lanza si el RowVersion no coincide)
            try
            {
                credito.RegistrarPago(datos.Monto);
                await _db.SaveUnitWork();
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new { message = "El crédito fue modificado por otro usuario. Recargue la pantalla e intente de nuevo." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }

            // Recargar y devolver
            var response = await _db.creditos.GetConItemsYPagosAsync(credito.Id);
            return Ok(new { message = "Pago registrado.", pagoId = pago.Id, credito = MapToDetailDto(response!) });
        }

        // POST /api/Credito/{id}/Cancelar
        [HttpPost("{id:int}/Cancelar")]
        public async Task<IActionResult> Cancelar(int id)
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            // Tracking ON para actualizar
            var credito = await _db.creditos.GetParaActualizarAsync(id);
            if (credito is null) return NotFound(new { message = "Crédito no encontrado." });

            // Devolver stock
            // Caso 1: con orden — items viven en OrdenVentaItem
            // Caso 2: venta rápida — items viven en CreditoItem
            if (credito.Id_OrdenVenta.HasValue)
            {
                var orden = await _db.ordenesVenta.GetConItems(credito.Id_OrdenVenta.Value);
                if (orden is not null)
                {
                    foreach (var item in orden.Items.Where(i => i.Estado == EstadosOrdenItem.Confirmado))
                    {
                        if (!item.Id_Producto.HasValue) continue;
                        var producto = await _db.productos.ObtenerConPiezas(item.Id_Producto.Value);
                        if (producto is null) continue;

                        if (!producto.EsKit)
                        {
                            producto.Devolver(item.Cantidad);
                        }
                        else
                        {
                            foreach (var pieza in producto.PiezasKit)
                                pieza.AgregarStock(item.Cantidad * pieza.CantidadPorKit);
                            producto.Stock_Actual = producto.CalcularStockKit();
                        }
                    }

                    orden.Cancelar($"Crédito #{credito.Id} cancelado.");
                }
            }
            else
            {
                var items = await _db.Set<CreditoItem>()
                    .Where(i => i.Id_Credito == credito.Id)
                    .ToListAsync();

                foreach (var item in items)
                {
                    if (item.Id_Pieza.HasValue)
                    {
                        // ── Devolver stock a la pieza ─────────────────────
                        var pieza = await _db.piezasKit.Obtener(item.Id_Pieza.Value);
                        if (pieza is null) continue;

                        pieza.AgregarStock(item.Cantidad);
                        var productoKit = await _db.productos.ObtenerConPiezas(pieza.Id_Producto);
                        if (productoKit is not null)
                            productoKit.Stock_Actual = productoKit.CalcularStockKit();
                    }
                    else if (item.Id_Producto.HasValue)
                    {
                        var producto = await _db.productos.ObtenerConPiezas(item.Id_Producto.Value);
                        if (producto is null) continue;

                        if (!producto.EsKit)
                        {
                            producto.Devolver(item.Cantidad);
                        }
                        else
                        {
                            foreach (var pieza in producto.PiezasKit)
                                pieza.AgregarStock(item.Cantidad * pieza.CantidadPorKit);
                            producto.Stock_Actual = producto.CalcularStockKit();
                        }
                    }
                }
            }

            try
            {
                credito.Cancelar();
                await _db.SaveUnitWork();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }

            var response = await _db.creditos.GetConItemsYPagosAsync(credito.Id);
            return Ok(new { message = "Crédito cancelado. Stock devuelto.", credito = MapToDetailDto(response!) });
        }

        // ---- Helpers de mapeo ----

        private static DtoCreditoResponse MapToListDto(Credito c) => new()
        {
            Id = c.Id,
            Id_Cliente = c.Id_Cliente,
            Cliente_Nombre = c.Cliente?.Nombre,
            Cliente_Apellido = c.Cliente?.Apellido,
            Cliente_Telefono = c.Cliente?.Telefono,
            Id_OrdenVenta = c.Id_OrdenVenta,
            Id_Cajero = c.Id_Cajero,
            Cajero_Nombre = c.Cajero is null ? null : $"{c.Cajero.Nombre} {c.Cajero.Apellido}".Trim(),
            Id_CajaOrigen = c.Id_CajaOrigen,
            Estado = c.Estado,
            Total = c.Total,
            SaldoPendiente = c.SaldoPendiente,
            FechaCreacion = c.FechaCreacion,
            FechaPagoCompleto = c.FechaPagoCompleto,
            FechaCancelacion = c.FechaCancelacion,
            Nota = c.Nota,
            RowVersion = c.RowVersion
        };

        private static DtoCreditoResponse MapToDetailDto(Credito c) => new()
        {
            Id = c.Id,
            Id_Cliente = c.Id_Cliente,
            Cliente_Nombre = c.Cliente?.Nombre,
            Cliente_Apellido = c.Cliente?.Apellido,
            Cliente_Telefono = c.Cliente?.Telefono,
            Id_OrdenVenta = c.Id_OrdenVenta,
            Id_Cajero = c.Id_Cajero,
            Cajero_Nombre = c.Cajero is null ? null : $"{c.Cajero.Nombre} {c.Cajero.Apellido}".Trim(),
            Id_CajaOrigen = c.Id_CajaOrigen,
            Estado = c.Estado,
            Total = c.Total,
            SaldoPendiente = c.SaldoPendiente,
            FechaCreacion = c.FechaCreacion,
            FechaPagoCompleto = c.FechaPagoCompleto,
            FechaCancelacion = c.FechaCancelacion,
            Nota = c.Nota,
            RowVersion = c.RowVersion,
            Items = c.Items.Select(i => new DtoCreditoItem
            {
                Id = i.Id,
                Id_Producto = i.Id_Producto,
                Producto_Codigo = i.Producto?.Codigo,
                Producto_Nombre = i.Producto?.Nombre,
                Producto_MarcaId = i.Producto?.MarcaId,
                Producto_MarcaNombre = i.Producto?.Marca?.Nombre,
                Id_Pieza = i.Id_Pieza,
                Cantidad = i.Cantidad,
                PrecioUnitario = i.PrecioUnitario,
                Subtotal = i.Subtotal
            }).ToList(),
            Pagos = c.Pagos.Select(p => new DtoCreditoPago
            {
                Id = p.Id,
                Id_Caja = p.Id_Caja,
                Id_Usuario = p.Id_Usuario,
                Usuario_Nombre = p.Usuario is null ? null : $"{p.Usuario.Nombre} {p.Usuario.Apellido}".Trim(),
                Fecha = p.Fecha,
                Monto = p.Monto,
                TipoPago = p.TipoPago,
                Nota = p.Nota
            }).ToList()
        };

        private async Task<DtoCreditoResponse?> GetCreditoResponseAsync(int id)
        {
            var c = await _db.creditos.GetConItemsYPagosAsync(id);
            return c is null ? null : MapToDetailDto(c);
        }
    }
}
