using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using UsaAutoPartes.Api.Hubs;
using UsaAutoPartes.Application.Dtos.VentaDtos;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.CajaEnums;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;
using UsaAutoPartes.Domain.Enum.VentaEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class OrdenVentaController(
        IUnitWork _db,
        ICajaRepositorio _cajas,
        IMovimientoCajaRepositorio _movimientos,
        IHubContext<VentasHub> _hub) : ControllerBase
    {
        [HttpPost]
        [Authorize(Roles = $"{UsuarioRoles.Cajero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> Crear(DtoCrearOrden datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var caja = await _cajas.GetCajaActivaByUsuario(userId);
            if (caja is null) return BadRequest(new { message = "No tienes una caja abierta." });

            foreach (var itemDto in datos.Items)
            {
                if (!itemDto.EsParcial)
                {
                    var producto = await _db.productos.ObtenerConPiezas(itemDto.Id_Producto);
                    if (producto is null) return NotFound(new { message = $"Producto {itemDto.Id_Producto} no encontrado." });

                    if (!producto.EsKit)
                    {
                        var disponible = producto.Stock_Actual - producto.StockReservado;
                        if (disponible < itemDto.Cantidad)
                            return BadRequest(new { message = $"Stock insuficiente para {producto.Nombre}. Disponible: {disponible}." });
                        producto.Reservar(itemDto.Cantidad);
                    }
                    else
                    {
                        foreach (var pieza in producto.PiezasKit)
                        {
                            var cantidadPieza = itemDto.Cantidad * pieza.CantidadPorKit;
                            var disponiblePieza = pieza.StockActual - pieza.StockReservado;
                            if (disponiblePieza < cantidadPieza)
                                return BadRequest(new { message = $"Stock insuficiente de {pieza.Nombre} para el kit {producto.Nombre}. Disponible: {disponiblePieza}." });
                            pieza.Reservar(cantidadPieza);
                        }
                    }
                }
                else
                {
                    if (itemDto.Piezas is null || !itemDto.Piezas.Any())
                        return BadRequest(new { message = "Orden parcial requiere especificar piezas." });

                    foreach (var piezaDto in itemDto.Piezas)
                    {
                        var pieza = await _db.piezasKit.Obtener(piezaDto.Id_Pieza);
                        var disponible = pieza.StockActual - pieza.StockReservado;
                        if (disponible < piezaDto.Cantidad)
                            return BadRequest(new { message = $"Stock insuficiente de pieza {pieza.Nombre}. Disponible: {disponible}." });
                        pieza.Reservar(piezaDto.Cantidad);
                    }
                }
            }

            var orden = datos.Crear(userId, caja.Id);
            await _db.ordenesVenta.Crear(orden);
            await _db.SaveUnitWork();

            await _hub.Clients.Group("Almaceneros").SendAsync("NuevaOrden", new
            {
                orden.Id,
                orden.Fecha,
                CantItems = orden.Items.Count,
                orden.Id_Cliente
            });

            return Created("", new { message = "Orden creada.", ordenId = orden.Id });
        }

        [HttpPost("{id:int}/Cancelar")]
        [Authorize(Roles = $"{UsuarioRoles.Cajero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> Cancelar(int id, [FromBody] string? nota)
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (orden.Id_Cajero != userId) return Forbid();
            if (orden.Estado == EstadosOrden.Completada) return BadRequest(new { message = "No se puede cancelar una orden completada." });
            if (orden.Estado == EstadosOrden.Cancelada) return BadRequest(new { message = "La orden ya está cancelada." });

            foreach (var item in orden.Items)
            {
                if (!item.EsParcial)
                {
                    if (!item.Id_Producto.HasValue) continue;
                    var producto = await _db.productos.ObtenerConPiezas(item.Id_Producto.Value);
                    if (producto is null) continue;

                    if (!producto.EsKit)
                    {
                        producto.LiberarReserva(item.Cantidad);
                    }
                    else
                    {
                        foreach (var pieza in producto.PiezasKit)
                            pieza.LiberarReserva(item.Cantidad * pieza.CantidadPorKit);
                    }
                }
                else
                {
                    foreach (var piezaItem in item.Piezas.Where(p => !p.Confirmado))
                    {
                        var pieza = await _db.piezasKit.Obtener(piezaItem.Id_Pieza);
                        var cantidadALiberar = piezaItem.NotaIncompleto != null
                            ? (ParseCantidadEncontrada(piezaItem.NotaIncompleto) ?? 0)
                            : piezaItem.Cantidad;
                        pieza.LiberarReserva(cantidadALiberar);
                    }
                }
            }

            orden.Cancelar(nota);
            await _db.SaveUnitWork();

            if (orden.Id_Almacenero.HasValue)
            {
                await _hub.Clients.Group($"orden-{id}").SendAsync("OrdenCancelada", new
                {
                    orden.Id,
                    nota
                });
            }

            return Ok(new { message = "Orden cancelada." });
        }

        [HttpPost("{id:int}/Aceptar")]
        [Authorize(Roles = $"{UsuarioRoles.Almacenero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> Aceptar(int id)
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (orden.Estado != EstadosOrden.Pendiente) return BadRequest(new { message = "La orden ya fue aceptada o no está disponible." });

            orden.Aceptar(userId);
            await _db.SaveUnitWork();

            await _hub.Clients.Group($"orden-{id}").SendAsync("OrdenAceptada", new
            {
                orden.Id,
                AlmaceneroId = userId
            });

            return Ok(new { message = "Orden aceptada." });
        }

        [HttpPost("{id:int}/Items/{itemId:int}/Incompleto")]
        [Authorize(Roles = $"{UsuarioRoles.Almacenero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> MarcarItemIncompleto(int id, int itemId, DtoMarcarIncompleto datos)
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (userRole != UsuarioRoles.Admin && userRole != UsuarioRoles.Operador && orden.Id_Almacenero != userId) return Forbid();
            if (orden.Estado != EstadosOrden.Aceptada && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está en un estado válido para reportar faltantes." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });

            var nota = datos.CantidadEncontrada.HasValue && datos.CantidadEncontrada.Value > 0
                ? $"Encontró {datos.CantidadEncontrada.Value} de {item.Cantidad}" + (string.IsNullOrWhiteSpace(datos.Nota) ? "" : $" — {datos.Nota}")
                : datos.Nota;
            item.MarcarIncompleto(nota);
            await _db.SaveUnitWork();

            await _hub.Clients.Group($"orden-{id}").SendAsync("ItemFaltanteReportado", new
            {
                ordenId = id,
                itemId
            });
            await _hub.Clients.Group("Escaneo").SendAsync("ItemFaltanteReportado", new { ordenId = id, itemId });

            return Ok(new { message = "Ítem marcado como incompleto." });
        }

        [HttpDelete("{id:int}/Items/{itemId:int}/Incompleto")]
        [Authorize(Roles = $"{UsuarioRoles.Almacenero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> RevertirItemIncompleto(int id, int itemId)
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (userRole != UsuarioRoles.Admin && userRole != UsuarioRoles.Operador && orden.Id_Almacenero != userId) return Forbid();
            if (orden.Estado != EstadosOrden.Aceptada && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está en un estado válido para reportar faltantes." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });
            if (item.Estado != EstadosOrdenItem.Incompleto) return BadRequest(new { message = "El ítem no está marcado como incompleto." });

            item.RevertirIncompleto();
            await _db.SaveUnitWork();

            await _hub.Clients.Group($"orden-{id}").SendAsync("FaltanteRevertido", new
            {
                ordenId = id,
                itemId
            });
            await _hub.Clients.Group("Escaneo").SendAsync("FaltanteRevertido", new { ordenId = id, itemId });

            return Ok(new { message = "Faltante revertido." });
        }

        [HttpPost("{id:int}/Items/{itemId:int}/Piezas/{piezaItemId:int}/Incompleto")]
        [Authorize(Roles = $"{UsuarioRoles.Almacenero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> MarcarPiezaIncompleta(int id, int itemId, int piezaItemId, DtoMarcarIncompleto datos)
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (userRole != UsuarioRoles.Admin && userRole != UsuarioRoles.Operador && orden.Id_Almacenero != userId) return Forbid();
            if (orden.Estado != EstadosOrden.Aceptada && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está en un estado válido para reportar faltantes." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });
            if (!item.EsParcial) return BadRequest(new { message = "Solo ítems parciales tienen piezas." });

            var piezaItem = item.Piezas.FirstOrDefault(x => x.Id == piezaItemId);
            if (piezaItem is null) return NotFound(new { message = "Pieza no encontrada." });

            var pieza = await _db.piezasKit.Obtener(piezaItem.Id_Pieza);
            var cantidadEncontrada = ParseCantidadEncontrada(datos.Nota) ?? 0;
            var cantidadALiberar = cantidadEncontrada > 0
                ? piezaItem.Cantidad - cantidadEncontrada
                : piezaItem.Cantidad;
            if (pieza is not null) pieza.LiberarReserva(cantidadALiberar);

            piezaItem.MarcarIncompleto(datos.Nota);

            if (item.Piezas.All(p => p.NotaIncompleto != null || p.ListoAlmacenero))
                item.MarcarIncompleto(datos.Nota);

            await _db.SaveUnitWork();

            await _hub.Clients.Group($"orden-{id}").SendAsync("PiezaFaltanteReportado", new
            {
                ordenId = id,
                itemId,
                piezaItemId
            });
            await _hub.Clients.Group("Escaneo").SendAsync("PiezaFaltanteReportado", new
            {
                ordenId = id,
                itemId,
                piezaItemId
            });

            return Ok(new { message = "Pieza marcada como incompleta." });
        }

        [HttpDelete("{id:int}/Items/{itemId:int}/Piezas/{piezaItemId:int}/Incompleto")]
        [Authorize(Roles = $"{UsuarioRoles.Almacenero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> RevertirPiezaIncompleta(int id, int itemId, int piezaItemId)
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (userRole != UsuarioRoles.Admin && userRole != UsuarioRoles.Operador && orden.Id_Almacenero != userId) return Forbid();
            if (orden.Estado != EstadosOrden.Aceptada && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está en un estado válido para reportar faltantes." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });

            var piezaItem = item.Piezas.FirstOrDefault(x => x.Id == piezaItemId);
            if (piezaItem is null) return NotFound(new { message = "Pieza no encontrada." });
            if (piezaItem.NotaIncompleto is null) return BadRequest(new { message = "La pieza no está marcada como incompleta." });

            var cantidadEncontradaRevertir = ParseCantidadEncontrada(piezaItem.NotaIncompleto) ?? 0;
            var cantidadARereservar = cantidadEncontradaRevertir > 0
                ? piezaItem.Cantidad - cantidadEncontradaRevertir
                : piezaItem.Cantidad;

            var pieza = await _db.piezasKit.Obtener(piezaItem.Id_Pieza);
            if (pieza is not null) pieza.Reservar(cantidadARereservar);

            piezaItem.RevertirIncompleto();

            if (item.Estado == EstadosOrdenItem.Incompleto)
                item.RevertirIncompleto();

            await _db.SaveUnitWork();

            await _hub.Clients.Group($"orden-{id}").SendAsync("FaltanteRevertido", new
            {
                ordenId = id,
                itemId,
                piezaItemId
            });
            await _hub.Clients.Group("Escaneo").SendAsync("FaltanteRevertido", new
            {
                ordenId = id,
                itemId,
                piezaItemId
            });

            return Ok(new { message = "Faltante de pieza revertido." });
        }

        [HttpPost("{id:int}/Items/{itemId:int}/Piezas/{piezaItemId:int}/ListoAlmacenero")]
        [Authorize(Roles = $"{UsuarioRoles.Almacenero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> MarcarPiezaListoAlmacenero(int id, int itemId, int piezaItemId)
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (userRole != UsuarioRoles.Admin && userRole != UsuarioRoles.Operador && orden.Id_Almacenero != userId) return Forbid();
            if (orden.Estado != EstadosOrden.Aceptada && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está en un estado válido para reportar faltantes." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });
            if (!item.EsParcial) return BadRequest(new { message = "Solo ítems parciales tienen piezas." });

            var piezaItem = item.Piezas.FirstOrDefault(x => x.Id == piezaItemId);
            if (piezaItem is null) return NotFound(new { message = "Pieza no encontrada." });

            piezaItem.MarcarListoAlmacenero();

            var todasResueltas = item.Piezas.All(p => p.ListoAlmacenero || p.NotaIncompleto != null);
            if (todasResueltas)
            {
                if (item.Estado == EstadosOrdenItem.Incompleto)
                    item.RevertirIncompleto();

                item.MarcarListoIndividual();

                if (orden.Estado == EstadosOrden.ConFaltantes)
                {
                    var todosItemsResueltos = orden.Items.All(i =>
                        i.Estado == EstadosOrdenItem.Confirmado ||
                        i.Estado == EstadosOrdenItem.Incompleto ||
                        i.Estado == EstadosOrdenItem.ListoIndividual);

                    if (todosItemsResueltos)
                    {
                        orden.MarcarLista();
                        await _db.SaveUnitWork();
                        await _hub.Clients.Group($"orden-{id}").SendAsync("ItemListoParaScaneo", new { ordenId = id, itemId });
                        await _hub.Clients.Group($"orden-{id}").SendAsync("OrdenLista", new { orden.Id });
                        await _hub.Clients.Group("Escaneo").SendAsync("OrdenLista", new { orden.Id });
                        return Ok(new { message = "Pieza marcada como lista. Orden vuelve a Lista." });
                    }
                }
            }

            await _db.SaveUnitWork();
            await _hub.Clients.Group($"orden-{id}").SendAsync("ItemListoParaScaneo", new { ordenId = id, itemId });

            return Ok(new { message = "Pieza marcada como lista por almacenero." });
        }

        [HttpDelete("{id:int}/Items/{itemId:int}/Piezas/{piezaItemId:int}/ListoAlmacenero")]
        [Authorize(Roles = $"{UsuarioRoles.Almacenero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> RevertirPiezaListoAlmacenero(int id, int itemId, int piezaItemId)
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (userRole != UsuarioRoles.Admin && userRole != UsuarioRoles.Operador && orden.Id_Almacenero != userId) return Forbid();
            if (orden.Estado != EstadosOrden.Aceptada && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está en un estado válido para reportar faltantes." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });

            var piezaItem = item.Piezas.FirstOrDefault(x => x.Id == piezaItemId);
            if (piezaItem is null) return NotFound(new { message = "Pieza no encontrada." });
            if (!piezaItem.ListoAlmacenero) return BadRequest(new { message = "La pieza no está marcada como lista." });

            piezaItem.RevertirListoAlmacenero();

            if (item.Estado == EstadosOrdenItem.ListoIndividual)
                item.Estado = EstadosOrdenItem.Pendiente;

            await _db.SaveUnitWork();

            return Ok(new { message = "Listo de pieza revertido." });
        }

        [HttpPost("{id:int}/Lista")]
        [Authorize(Roles = $"{UsuarioRoles.Almacenero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> MarcarLista(int id)
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (userRole != UsuarioRoles.Admin && userRole != UsuarioRoles.Operador && orden.Id_Almacenero != userId) return Forbid();
            if (orden.Estado != EstadosOrden.Aceptada && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está en un estado válido para marcar como lista." });

            orden.MarcarLista();
            await _db.SaveUnitWork();

            await _hub.Clients.Group($"orden-{id}").SendAsync("OrdenLista", new
            {
                orden.Id
            });
            await _hub.Clients.Group("Escaneo").SendAsync("OrdenLista", new { orden.Id });

            return Ok(new { message = "Orden marcada como lista." });
        }

        [HttpPost("{id:int}/Items/{itemId:int}/Confirmar")]
        [Authorize(Roles = $"{UsuarioRoles.Operador},{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> ConfirmarItem(int id, int itemId)
        {
            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (orden.Estado != EstadosOrden.Lista && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está lista para escaneo." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });
            if (item.EsParcial) return BadRequest(new { message = "Use el endpoint de piezas para ítems parciales." });
            if (item.Estado == EstadosOrdenItem.Confirmado) return BadRequest(new { message = "El ítem ya fue confirmado." });

            var cantidadAConfirmar = item.Cantidad;
            var cantidadALiberar = item.Cantidad;

            if (item.Estado == EstadosOrdenItem.Incompleto)
            {
                var encontrada = ParseCantidadEncontrada(item.NotaIncompleto);
                if (!encontrada.HasValue || encontrada.Value <= 0)
                    return BadRequest(new { message = "El ítem está marcado como incompleto." });
                cantidadAConfirmar = encontrada.Value;
            }

            if (!item.Id_Producto.HasValue)
                return BadRequest(new { message = "El producto de este ítem ya no existe en el catálogo." });

            var producto = await _db.productos.ObtenerConPiezas(item.Id_Producto.Value);
            if (producto is null) return NotFound(new { message = "Producto no encontrado." });

            if (!producto.EsKit)
            {
                producto.LiberarReserva(cantidadALiberar);
                producto.Descontar(cantidadAConfirmar);
            }
            else
            {
                foreach (var pieza in producto.PiezasKit)
                {
                    pieza.LiberarReserva(cantidadALiberar * pieza.CantidadPorKit);
                    pieza.DescontarStock(cantidadAConfirmar * pieza.CantidadPorKit);
                }
                producto.Stock_Actual = producto.CalcularStockKit();
            }

            if (item.Cantidad != cantidadAConfirmar)
                item.Cantidad = cantidadAConfirmar;

            item.Confirmar(item.PrecioUnitario);
            await _db.SaveUnitWork();

            return Ok(new { message = "Ítem confirmado." });
        }

        private async Task LiberarReservaItem(OrdenVentaItem item)
        {
            if (item.EsParcial)
            {
                foreach (var piezaItem in item.Piezas)
                {
                    var pieza = await _db.piezasKit.Obtener(piezaItem.Id_Pieza);
                    pieza.LiberarReserva(piezaItem.Cantidad);
                }
                return;
            }

            if (!item.Id_Producto.HasValue) return;

            var producto = await _db.productos.ObtenerConPiezas(item.Id_Producto.Value);
            if (producto is null) return;

            if (!producto.EsKit)
                producto.LiberarReserva(item.Cantidad);
            else
            {
                foreach (var pieza in producto.PiezasKit)
                    pieza.LiberarReserva(item.Cantidad * pieza.CantidadPorKit);
            }
        }

        private static int? ParseCantidadEncontrada(string? nota)
        {
            if (string.IsNullOrWhiteSpace(nota)) return null;
            var match = System.Text.RegularExpressions.Regex.Match(nota, @"^Encontró (\d+) de \d+");
            if (match.Success && int.TryParse(match.Groups[1].Value, out var qty))
                return qty;
            return null;
        }

        [HttpPost("{id:int}/Items/{itemId:int}/Piezas/{piezaItemId:int}/Confirmar")]
        [Authorize(Roles = $"{UsuarioRoles.Operador},{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> ConfirmarPieza(int id, int itemId, int piezaItemId, DtoConfirmarPieza datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (orden.Estado != EstadosOrden.Lista && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está lista para escaneo." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });
            if (!item.EsParcial) return BadRequest(new { message = "Este ítem no es parcial." });

            var piezaItem = item.Piezas.FirstOrDefault(x => x.Id == piezaItemId);
            if (piezaItem is null) return NotFound(new { message = "Pieza no encontrada." });
            if (piezaItem.Confirmado) return BadRequest(new { message = "La pieza ya fue confirmada." });

            var cantidadAConfirmar = piezaItem.Cantidad;
            if (piezaItem.NotaIncompleto != null)
            {
                var encontrada = ParseCantidadEncontrada(piezaItem.NotaIncompleto);
                if (!encontrada.HasValue || encontrada.Value <= 0)
                    return BadRequest(new { message = "Esta pieza está marcada como faltante." });
                cantidadAConfirmar = encontrada.Value;
            }

            var pieza = await _db.piezasKit.Obtener(piezaItem.Id_Pieza);
            pieza.LiberarReserva(cantidadAConfirmar);
            pieza.DescontarStock(cantidadAConfirmar);

            if (piezaItem.Cantidad != cantidadAConfirmar)
                piezaItem.Cantidad = cantidadAConfirmar;

            if (item.Id_Producto.HasValue)
            {
                var producto = await _db.productos.ObtenerConPiezas(item.Id_Producto.Value);
                if (producto is not null)
                    producto.Stock_Actual = producto.CalcularStockKit();
            }

            piezaItem.Confirmar(datos.PrecioUnitario);

            if (item.Piezas.All(p => p.Confirmado || p.NotaIncompleto != null))
                item.Estado = EstadosOrdenItem.Confirmado;

            await _db.SaveUnitWork();

            return Ok(new { message = "Pieza confirmada." });
        }

        [HttpPost("{id:int}/AgregarItem")]
        [Authorize(Roles = $"{UsuarioRoles.Operador},{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> AgregarItem(int id, DtoAgregarItemOrden datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (!datos.Id_Producto.HasValue && !datos.Id_Pieza.HasValue)
                return BadRequest(new { message = "Indique Id_Producto o Id_Pieza." });

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (orden.Estado != EstadosOrden.Lista && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está lista para escaneo." });

            OrdenVentaItem item;
            Producto producto;

            if (datos.Id_Pieza.HasValue)
            {
                var pieza = await _db.piezasKit.Obtener(datos.Id_Pieza.Value);
                var productoKit = await _db.productos.ObtenerConPiezas(pieza.Id_Producto);
                if (productoKit is null) return NotFound(new { message = "Kit del producto no encontrado." });
                producto = productoKit;

                if (!producto.EsKit)
                    return BadRequest(new { message = "La pieza no pertenece a un kit." });

                if (datos.Id_Producto.HasValue && datos.Id_Producto.Value != producto.Id)
                    return BadRequest(new { message = "Id_Pieza no corresponde al Id_Producto indicado." });

                var disponiblePieza = pieza.StockActual - pieza.StockReservado;
                if (disponiblePieza < datos.Cantidad)
                    return BadRequest(new { message = $"Stock insuficiente de {pieza.Nombre}. Disponible: {disponiblePieza}." });

                pieza.Reservar(datos.Cantidad);

                item = new OrdenVentaItem(producto.Id, datos.Cantidad, esParcial: true, datos.PrecioUnitario ?? 0)
                {
                    Id_Orden = id,
                    Piezas = [new OrdenVentaItemPieza(pieza.Id, datos.Cantidad, datos.PrecioUnitario ?? 0)]
                };
            }
            else
            {
                var productoBd = await _db.productos.ObtenerConPiezas(datos.Id_Producto!.Value);
                if (productoBd is null) return NotFound(new { message = "Producto no encontrado." });
                producto = productoBd;

                if (producto.EsKit)
                {
                    foreach (var pieza in producto.PiezasKit)
                    {
                        var cantidadPieza = datos.Cantidad * pieza.CantidadPorKit;
                        var disponiblePieza = pieza.StockActual - pieza.StockReservado;
                        if (disponiblePieza < cantidadPieza)
                            return BadRequest(new { message = $"Stock insuficiente de {pieza.Nombre} para el kit {producto.Nombre}. Disponible: {disponiblePieza}." });
                        pieza.Reservar(cantidadPieza);
                    }
                }
                else
                {
                    var disponible = producto.Stock_Actual - producto.StockReservado;
                    if (disponible < datos.Cantidad)
                        return BadRequest(new { message = $"Stock insuficiente. Disponible: {disponible}." });
                    producto.Reservar(datos.Cantidad);
                }

                item = new OrdenVentaItem(producto.Id, datos.Cantidad, false, datos.PrecioUnitario ?? producto.Precio)
                {
                    Id_Orden = id
                };
            }

            orden.Items.Add(item);
            orden.MarcarConFaltantes();
            await _db.SaveUnitWork();

            await _hub.Clients.Group("Almaceneros").SendAsync("NuevoItemAgregado", new
            {
                ordenId = id,
                itemId = item.Id,
                productoNombre = producto.Nombre,
                codigo = producto.Codigo,
                cantidad = item.Cantidad,
                esParcial = item.EsParcial
            });

            await _hub.Clients.Group($"orden-{id}").SendAsync("OrdenConFaltantes", new
            {
                ordenId = id
            });
            await _hub.Clients.Group("Escaneo").SendAsync("OrdenConFaltantes", new { ordenId = id });

            return Ok(new
            {
                id = item.Id,
                id_Producto = item.Id_Producto,
                cantidad = item.Cantidad,
                esParcial = item.EsParcial,
                precioUnitario = (double)item.PrecioUnitario,
                estado = item.Estado,
                piezas = item.EsParcial
                    ? item.Piezas.Select(p => new { id = p.Id, id_Pieza = p.Id_Pieza, cantidad = p.Cantidad })
                    : null,
                producto = new { id = producto.Id, codigo = producto.Codigo, nombre = producto.Nombre, ubicacion = producto.Ubicacion, esKit = producto.EsKit }
            });
        }

        [HttpDelete("{id:int}/Items/{itemId:int}")]
        [Authorize(Roles = $"{UsuarioRoles.Operador},{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> EliminarItem(int id, int itemId)
        {
            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (orden.Estado != EstadosOrden.Lista && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está lista para escaneo." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });
            if (item.Estado == EstadosOrdenItem.Confirmado) return BadRequest(new { message = "No se puede eliminar un ítem ya confirmado." });

            await LiberarReservaItem(item);

            orden.Items.Remove(item);
            await _db.SaveUnitWork();

            await _hub.Clients.Group("Almaceneros").SendAsync("ItemEliminado", new
            {
                ordenId = id,
                itemId
            });

            return Ok(new { message = "Ítem eliminado." });
        }

        [HttpPut("{id:int}/Items/{itemId:int}/Cantidad")]
        [Authorize(Roles = $"{UsuarioRoles.Operador},{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> ActualizarCantidadItem(int id, int itemId, DtoActualizarCantidadItem datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (orden.Estado != EstadosOrden.Lista && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está lista para escaneo." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });
            if (item.Estado == EstadosOrdenItem.Confirmado) return BadRequest(new { message = "No se puede modificar un ítem ya confirmado." });

            if (!item.Id_Producto.HasValue)
                return BadRequest(new { message = "El producto de este ítem ya no existe en el catálogo." });

            if (item.EsParcial)
                return BadRequest(new { message = "No se puede cambiar la cantidad de un ítem parcial (pieza suelta). Elimínelo y vuelva a agregarlo." });

            var producto = await _db.productos.ObtenerConPiezas(item.Id_Producto.Value);
            if (producto is null) return NotFound(new { message = "Producto no encontrado." });

            var diferencia = datos.Cantidad - item.Cantidad;
            if (diferencia != 0)
            {
                if (producto.EsKit)
                {
                    foreach (var pieza in producto.PiezasKit)
                    {
                        var deltaPieza = diferencia * pieza.CantidadPorKit;
                        if (deltaPieza > 0)
                        {
                            var disponible = pieza.StockActual - pieza.StockReservado;
                            if (disponible < deltaPieza)
                                return BadRequest(new { message = $"Stock insuficiente de {pieza.Nombre}. Disponible adicional: {disponible}." });
                            pieza.Reservar(deltaPieza);
                        }
                        else
                            pieza.LiberarReserva(-deltaPieza);
                    }
                }
                else if (diferencia > 0)
                {
                    var disponible = producto.Stock_Actual - producto.StockReservado;
                    if (disponible < diferencia)
                        return BadRequest(new { message = $"Stock insuficiente. Disponible adicional: {disponible}." });
                    producto.Reservar(diferencia);
                }
                else
                    producto.LiberarReserva(-diferencia);
            }

            item.Cantidad = datos.Cantidad;
            await _db.SaveUnitWork();

            await _hub.Clients.Group("Almaceneros").SendAsync("CantidadItemActualizada", new
            {
                ordenId = id,
                itemId,
                nuevaCantidad = datos.Cantidad
            });

            return Ok(new { message = "Cantidad actualizada.", nuevaCantidad = datos.Cantidad });
        }

        [HttpPut("{id:int}/Items/{itemId:int}/Piezas/{piezaId:int}/Cantidad")]
        [Authorize(Roles = $"{UsuarioRoles.Operador},{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> ActualizarCantidadPieza(int id, int itemId, int piezaId, [FromBody] DtoActualizarCantidadPieza datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (orden.Estado != EstadosOrden.Lista && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está lista para escaneo." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });
            if (!item.EsParcial) return BadRequest(new { message = "Este ítem no es parcial." });

            var piezaItem = item.Piezas.FirstOrDefault(x => x.Id == piezaId);
            if (piezaItem is null) return NotFound(new { message = "Pieza no encontrada." });
            if (piezaItem.Confirmado) return BadRequest(new { message = "No se puede modificar una pieza ya confirmada." });
            if (piezaItem.NotaIncompleto != null) return BadRequest(new { message = "La pieza está marcada como faltante; reviértala primero." });

            var diferencia = datos.Cantidad - piezaItem.Cantidad;
            if (diferencia == 0)
                return Ok(new { message = "Cantidad sin cambios.", nuevaCantidad = piezaItem.Cantidad });

            var pieza = await _db.piezasKit.Obtener(piezaItem.Id_Pieza);
            if (diferencia > 0)
            {
                var disponible = pieza.StockActual - pieza.StockReservado;
                if (disponible < diferencia)
                    return BadRequest(new { message = $"Stock insuficiente de {pieza.Nombre}. Disponible adicional: {disponible}." });
                pieza.Reservar(diferencia);
            }
            else
            {
                pieza.LiberarReserva(-diferencia);
            }

            piezaItem.Cantidad = datos.Cantidad;
            item.Cantidad = item.Piezas.Sum(p => p.Cantidad);

            // Si la cantidad del item llega a 0 o no quedan piezas, eliminar el item completo
            if (item.Cantidad <= 0 || item.Piezas.Count == 0)
            {
                await LiberarReservaItem(item);
                orden.Items.Remove(item);
                await _db.SaveUnitWork();

                await _hub.Clients.Group("Almaceneros").SendAsync("ItemEliminado", new { ordenId = id, itemId });
                return Ok(new { message = "Pieza ajustada a 0: ítem eliminado." });
            }

            await _db.SaveUnitWork();

            await _hub.Clients.Group("Almaceneros").SendAsync("CantidadItemActualizada", new
            {
                ordenId = id,
                itemId,
                nuevaCantidad = item.Cantidad,
                piezaId = piezaItem.Id,
                nuevaCantidadPieza = piezaItem.Cantidad
            });

            return Ok(new { message = "Cantidad de pieza actualizada.", nuevaCantidad = piezaItem.Cantidad });
        }

        [HttpDelete("{id:int}/Items/{itemId:int}/Piezas/{piezaId:int}")]
        [Authorize(Roles = $"{UsuarioRoles.Operador},{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> EliminarPieza(int id, int itemId, int piezaId)
        {
            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (orden.Estado != EstadosOrden.Lista && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está lista para escaneo." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });
            if (!item.EsParcial) return BadRequest(new { message = "Este ítem no es parcial." });

            var piezaItem = item.Piezas.FirstOrDefault(x => x.Id == piezaId);
            if (piezaItem is null) return NotFound(new { message = "Pieza no encontrada." });
            if (piezaItem.Confirmado) return BadRequest(new { message = "No se puede eliminar una pieza ya confirmada." });
            if (piezaItem.NotaIncompleto != null) return BadRequest(new { message = "La pieza está marcada como faltante; reviértala primero." });

            // Liberar reserva de esta pieza específica
            var piezaCatalogo = await _db.piezasKit.Obtener(piezaItem.Id_Pieza);
            piezaCatalogo.LiberarReserva(piezaItem.Cantidad);

            item.Piezas.Remove(piezaItem);
            item.Cantidad = item.Piezas.Sum(p => p.Cantidad);

            // Si no quedan piezas, eliminar el item completo
            if (item.Piezas.Count == 0)
            {
                orden.Items.Remove(item);
                await _db.SaveUnitWork();

                await _hub.Clients.Group("Almaceneros").SendAsync("ItemEliminado", new { ordenId = id, itemId });
                return Ok(new { message = "Pieza eliminada (ítem sin piezas eliminado)." });
            }

            await _db.SaveUnitWork();

            await _hub.Clients.Group("Almaceneros").SendAsync("CantidadItemActualizada", new
            {
                ordenId = id,
                itemId,
                nuevaCantidad = item.Cantidad,
                piezaId,
                piezaEliminada = true
            });

            return Ok(new { message = "Pieza eliminada." });
        }

        [HttpPost("{id:int}/Items/{itemId:int}/MarcarListoIndividual")]
        [Authorize(Roles = $"{UsuarioRoles.Almacenero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> MarcarItemListoIndividual(int id, int itemId)
        {
            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (orden.Estado != EstadosOrden.Aceptada && orden.Estado != EstadosOrden.ConFaltantes)
                return BadRequest(new { message = "La orden no está en preparación." });

            var item = orden.Items.FirstOrDefault(x => x.Id == itemId);
            if (item is null) return NotFound(new { message = "Ítem no encontrado." });
            if (item.Estado != EstadosOrdenItem.Pendiente) return BadRequest(new { message = "El ítem no está en estado pendiente." });

            item.MarcarListoIndividual();

            // Si estaba en ConFaltantes y todos los items ya están resueltos, volver a Lista
            if (orden.Estado == EstadosOrden.ConFaltantes)
            {
                var todosResueltos = orden.Items.All(i =>
                    i.Estado == EstadosOrdenItem.Confirmado ||
                    i.Estado == EstadosOrdenItem.Incompleto ||
                    i.Estado == EstadosOrdenItem.ListoIndividual);

                if (todosResueltos)
                {
                    orden.MarcarLista();
                    await _db.SaveUnitWork();

                    await _hub.Clients.Group($"orden-{id}").SendAsync("ItemListoParaScaneo", new { ordenId = id, itemId });
                    await _hub.Clients.Group($"orden-{id}").SendAsync("OrdenLista", new { orden.Id });
                    await _hub.Clients.Group("Escaneo").SendAsync("OrdenLista", new { orden.Id });

                    return Ok(new { message = "Ítem marcado como listo. Orden vuelve a Lista." });
                }
            }

            await _db.SaveUnitWork();

            await _hub.Clients.Group($"orden-{id}").SendAsync("ItemListoParaScaneo", new
            {
                ordenId = id,
                itemId
            });

            return Ok(new { message = "Ítem marcado como listo." });
        }

        [HttpPost("{id:int}/MarcarEsperandoPago")]
        [Authorize(Roles = $"{UsuarioRoles.Operador},{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}")]
        public async Task<IActionResult> MarcarEsperandoPago(int id)
        {
            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (orden.Estado != EstadosOrden.Lista) return BadRequest(new { message = "La orden no está lista para escaneo." });

            var itemsPendientes = orden.Items.Where(i =>
                i.Estado == EstadosOrdenItem.Pendiente ||
                i.Estado == EstadosOrdenItem.ListoIndividual).ToList();

            if (itemsPendientes.Count > 0)
                return BadRequest(new { message = "Hay ítems pendientes de escanear." });

            orden.MarcarEsperandoPago();
            await _db.SaveUnitWork();

            await _hub.Clients.Group($"orden-{id}").SendAsync("OrdenEsperandoPago", new
            {
                orden.Id
            });

            await _hub.Clients.Group("Cajeros").SendAsync("OrdenEsperandoPago", new
            {
                orden.Id
            });

            return Ok(new { message = "Orden marcada como esperando pago." });
        }

        [HttpPost("{id:int}/Completar")]
        [Authorize(Roles = $"{UsuarioRoles.Cajero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> Completar(int id, DtoCompletarOrden datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

            var orden = await _db.ordenesVenta.GetConItems(id);
            if (orden is null) return NotFound(new { message = "Orden no encontrada." });
            if (userRole != UsuarioRoles.Admin && orden.Id_Cajero != userId)
                return Forbid();
            if (orden.Estado != EstadosOrden.EsperandoPago) return BadRequest(new { message = "La orden no está esperando pago." });

            // Validaciones específicas para crédito
            if (datos.EsCredito)
            {
                if (!datos.Id_Cliente.HasValue)
                    return BadRequest(new { message = "Para cobrar a crédito se requiere un cliente." });

                var clienteExiste = await _db.Set<Cliente>().AnyAsync(c => c.Id == datos.Id_Cliente.Value);
                if (!clienteExiste)
                    return BadRequest(new { message = "El cliente indicado no existe." });

                // Si es crédito, la orden debe tener ese cliente (o se le asigna)
                orden.Id_Cliente = datos.Id_Cliente.Value;
            }

            // Liberar reservas de ítems no confirmados
            foreach (var item in orden.Items.Where(i => i.Estado != EstadosOrdenItem.Confirmado))
            {
                if (!item.EsParcial)
                {
                    if (!item.Id_Producto.HasValue) continue;
                    var producto = await _db.productos.ObtenerConPiezas(item.Id_Producto.Value);
                    if (producto is null) continue;

                    if (!producto.EsKit)
                        producto.LiberarReserva(item.Cantidad);
                    else
                        foreach (var pieza in producto.PiezasKit)
                            pieza.LiberarReserva(item.Cantidad * pieza.CantidadPorKit);
                }
                else
                {
                    foreach (var piezaItem in item.Piezas.Where(p => !p.Confirmado))
                    {
                        var pieza = await _db.piezasKit.Obtener(piezaItem.Id_Pieza);
                        var cantidadALiberar = piezaItem.NotaIncompleto != null
                            ? (ParseCantidadEncontrada(piezaItem.NotaIncompleto) ?? 0)
                            : piezaItem.Cantidad;
                        pieza.LiberarReserva(cantidadALiberar);
                    }
                }
            }

            // Aplicar el descuento global elegido al cobrar.
            if (datos.Id_Descuento.HasValue)
            {
                if (datos.MontoDescuento < 0)
                    return BadRequest(new { message = "El monto del descuento no puede ser negativo." });
                orden.Id_Descuento = datos.Id_Descuento;
                orden.MontoDescuento = datos.MontoDescuento;
            }
            else
            {
                orden.Id_Descuento = null;
                orden.MontoDescuento = 0;
            }

            var total = orden.CalcularSubtotalNeto();

            if (datos.EsCredito)
            {
                // Crédito: crear Credito, NO crear MovimientoCaja.
                var credito = new Credito(
                    orden.Id_Cliente!.Value,
                    orden.Id_Cajero,
                    orden.Id_Caja,
                    orden.Id,
                    total,
                    idDescuento: orden.Id_Descuento,
                    montoDescuento: orden.MontoDescuento,
                    nota: datos.Nota);
                await _db.creditos.Crear(credito);
            }
            else
            {
                // Contado: crear MovimientoCaja por cada pago.
                foreach (var pago in datos.Pagos)
                {
                    var movimiento = new MovimientoCaja(
                        orden.Id_Caja,
                        TipoMovimiento.Ingreso,
                        CategoriaMovimiento.Ventas,
                        pago.TipoPago,
                        pago.Monto,
                        $"Venta #{orden.Id}"
                    );
                    await _movimientos.Crear(movimiento);
                }
            }

            orden.Completar();
            await _db.SaveUnitWork();

            await _hub.Clients.Group($"orden-{id}").SendAsync("OrdenCompletada", new
            {
                orden.Id,
                total,
                esCredito = datos.EsCredito
            });

            return Ok(new { message = datos.EsCredito ? "Orden completada como crédito." : "Orden completada.", total, esCredito = datos.EsCredito });
        }

        /// <summary>
        /// Venta rápida al contado: crea la orden en estado <c>Completada</c>,
        /// descuenta el stock de inmediato y registra los pagos en una sola
        /// transacción. NO emite SignalR al grupo <c>Almaceneros</c> — es un
        /// atajo que salta el flujo de almacén y escaneo.
        /// </summary>
        [HttpPost("Rapida")]
        [Authorize(Roles = $"{UsuarioRoles.Cajero},{UsuarioRoles.Admin}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> Rapida([FromBody] DtoVentaRapidaContado datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var caja = await _cajas.GetCajaActivaByUsuario(userId);
            if (caja is null) return BadRequest(new { message = "No tienes una caja abierta." });

            if (datos.Id_Cliente.HasValue)
            {
                var clienteExiste = await _db.Set<Cliente>().AnyAsync(c => c.Id == datos.Id_Cliente.Value);
                if (!clienteExiste)
                    return BadRequest(new { message = "El cliente indicado no existe." });
            }

            // ── Validar TipoPago contra las constantes permitidas ───────────
            var tiposPagoValidos = new[] { TipoPago.Efectivo, TipoPago.QR, TipoPago.Tarjeta };
            foreach (var pago in datos.Pagos)
            {
                if (!tiposPagoValidos.Contains(pago.TipoPago))
                    return BadRequest(new { message = $"TipoPago '{pago.TipoPago}' no es válido. Use: {string.Join(", ", tiposPagoValidos)}." });
            }

            // ── Construir la orden en estado Completada (atómico) ───────────
            var orden = new OrdenVenta
            {
                Id_Cajero = userId,
                Id_Caja = caja.Id,
                Id_Cliente = datos.Id_Cliente,
                Nota = datos.Nota,
                Id_Descuento = datos.Id_Descuento,
                MontoDescuento = datos.MontoDescuento,
                Modalidad = ModalidadVenta.RapidaContado,
                Estado = EstadosOrden.Completada,
                Fecha = DateTime.UtcNow,
                FechaCompletada = DateTime.UtcNow,
                Items = new List<OrdenVentaItem>()
            };

            // ── Validar stock y descontar directo (NO reservar) ─────────────
            foreach (var itemDto in datos.Items)
            {
                if (itemDto.Id_Pieza.HasValue)
                {
                    // ── Pieza suelta de un kit (venta parcial) ─────────────
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

                    pieza.DescontarStock(itemDto.Cantidad);
                    productoKit.Stock_Actual = productoKit.CalcularStockKit();

                    var itemPieza = new OrdenVentaItem(
                        productoKit.Id,
                        itemDto.Cantidad,
                        esParcial: true,
                        itemDto.PrecioUnitario)
                    {
                        Estado = EstadosOrdenItem.Confirmado,
                        Piezas = [new OrdenVentaItemPieza(pieza.Id, itemDto.Cantidad, itemDto.PrecioUnitario)]
                    };
                    orden.Items.Add(itemPieza);
                }
                else
                {
                    // ── Producto regular o kit completo ─────────────────────
                    var producto = await _db.productos.ObtenerConPiezas(itemDto.Id_Producto);
                    if (producto is null)
                        return NotFound(new { message = $"Producto {itemDto.Id_Producto} no encontrado." });

                    if (!producto.EsKit)
                    {
                        var disponible = producto.Stock_Actual - producto.StockReservado;
                        if (disponible < itemDto.Cantidad)
                            return BadRequest(new { message = $"Stock insuficiente para {producto.Nombre}. Disponible: {disponible}." });

                        producto.Descontar(itemDto.Cantidad);
                    }
                    else
                    {
                        foreach (var pieza in producto.PiezasKit)
                        {
                            var cantidadPieza = itemDto.Cantidad * pieza.CantidadPorKit;
                            var disponiblePieza = pieza.StockActual - pieza.StockReservado;
                            if (disponiblePieza < cantidadPieza)
                                return BadRequest(new { message = $"Stock insuficiente de {pieza.Nombre} para el kit {producto.Nombre}. Disponible: {disponiblePieza}." });

                            pieza.DescontarStock(cantidadPieza);
                        }
                        producto.Stock_Actual = producto.CalcularStockKit();
                    }

                    orden.Items.Add(new OrdenVentaItem(
                        itemDto.Id_Producto,
                        itemDto.Cantidad,
                        false,
                        itemDto.PrecioUnitario)
                    {
                        Estado = EstadosOrdenItem.Confirmado  // ya está vendido
                    });
                }
            }

            // ── Registrar movimientos de caja (uno por pago) ────────────────
            foreach (var pago in datos.Pagos)
            {
                var movimiento = new MovimientoCaja(
                    orden.Id_Caja,
                    TipoMovimiento.Ingreso,
                    CategoriaMovimiento.Ventas,
                    pago.TipoPago,
                    pago.Monto,
                    "Venta rápida contado"
                );
                await _movimientos.Crear(movimiento);
            }

            // ── Persistir todo en una sola transacción ──────────────────────
            await _db.ordenesVenta.Crear(orden);
            await _db.SaveUnitWork();

            // NOTA: NO se emite SignalR al grupo "Almaceneros" — la orden
            // nunca pasa por almacén. Tampoco a "Cajeros" — la venta ya
            // está cobrada y completa, no hay estado "esperando pago" que
            // notificar.

            var total = orden.CalcularSubtotalNeto();
            return Created($"/api/OrdenVenta/{orden.Id}", new
            {
                message = "Venta rápida al contado registrada.",
                ordenId = orden.Id,
                total
            });
        }
    }
}
