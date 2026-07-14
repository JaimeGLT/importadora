using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using UsaAutoPartes.Application.Dtos.AjusteStockDtos;
using UsaAutoPartes.Application.Exceptions.GenericExceptions;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = $"{UsuarioRoles.Admin}")]
    public class AjusteStockController(IUnitWork _db) : ControllerBase
    {
        private Guid? GetUsuarioId() =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        [HttpPost("{productoId:int}")]
        public async Task<IActionResult> AjustarStock(int productoId, DtoAjusteStock datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var producto = await _db.productos.ObtenerConPiezas(productoId);
            if (producto is null) return NotFound(new { message = "Producto no encontrado." });

            if (producto.EsKit && !producto.PiezasKit.Any())
                return BadRequest(new { message = "Este kit no tiene piezas configuradas. Agrega piezas antes de ajustar el stock." });

            int cantidadAnterior = producto.EsKit
                ? producto.CalcularStockKit()
                : producto.Stock_Actual;

            if (datos.Delta == 0)
                return BadRequest(new { message = "El delta no puede ser 0." });

            int cantidadNueva = cantidadAnterior + datos.Delta;

            if (cantidadNueva < 0)
                return BadRequest(new { message = "El resultado del ajuste no puede ser negativo." });

            if (producto.EsKit)
            {
                if (datos.Delta < 0)
                {
                    var error = producto.ValidarPiezasSuficientes(cantidadNueva);
                    if (error != null) throw new StockInsuficienteException(error);

                    producto.DescontarKit(Math.Abs(datos.Delta));
                }
                else
                {
                    producto.AgregarStockKit(datos.Delta);
                }
            }
            else
            {
                if (cantidadNueva < producto.StockReservado)
                    return Conflict(new { message = $"No se puede reducir a {cantidadNueva}. Hay {producto.StockReservado} unidades reservadas en órdenes pendientes." });
                producto.Stock_Actual = cantidadNueva;
            }

            var ajuste = new AjusteStock
            {
                Id_Producto = productoId,
                CantidadAnterior = cantidadAnterior,
                CantidadNueva = producto.Stock_Actual,
                Motivo = datos.Motivo,
                Nota = datos.Nota,
                UsuarioId = GetUsuarioId()
            };

            await _db.ajustesStock.Crear(ajuste);
            await _db.SaveUnitWork();

            return Ok(new
            {
                message = "Stock ajustado.",
                cantidadAnterior,
                cantidadNueva = producto.Stock_Actual,
                delta = datos.Delta
            });
        }

        [HttpPost("{productoId:int}/Piezas/{piezaId:int}")]
        public async Task<IActionResult> AjustarStockPieza(int productoId, int piezaId, DtoAjusteStock datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var producto = await _db.productos.ObtenerConPiezas(productoId);
            if (producto is null) return NotFound(new { message = "Producto no encontrado." });
            if (!producto.EsKit) return BadRequest(new { message = "El producto no es un kit." });

            var pieza = producto.PiezasKit.FirstOrDefault(p => p.Id == piezaId);
            if (pieza is null) return NotFound(new { message = "Pieza no encontrada en este kit." });

            int cantidadAnterior = pieza.StockActual;

            if (datos.Delta == 0)
                return BadRequest(new { message = "El delta no puede ser 0." });

            int cantidadNueva = cantidadAnterior + datos.Delta;

            if (cantidadNueva < 0)
                return BadRequest(new { message = "El resultado del ajuste no puede ser negativo." });

            if (cantidadNueva < pieza.StockReservado)
                return Conflict(new { message = $"No se puede reducir a {cantidadNueva}. La pieza '{pieza.Nombre}' tiene {pieza.StockReservado} unidades reservadas." });

            pieza.StockActual = cantidadNueva;
            producto.Stock_Actual = producto.CalcularStockKit();

            var motivo = $"[Pieza: {pieza.Nombre}] {datos.Motivo}";
            if (motivo.Length > 200)
                return BadRequest(new { message = "El motivo es demasiado largo (máx. 200 caracteres incluyendo el nombre de la pieza)." });

            var ajuste = new AjusteStock
            {
                Id_Producto = productoId,
                CantidadAnterior = cantidadAnterior,
                CantidadNueva = cantidadNueva,
                Motivo = motivo,
                Nota = datos.Nota,
                UsuarioId = GetUsuarioId()
            };

            await _db.ajustesStock.Crear(ajuste);
            await _db.SaveUnitWork();

            return Ok(new
            {
                message = "Stock de pieza ajustado.",
                cantidadAnterior,
                cantidadNueva,
                stockKitRecalculado = producto.Stock_Actual,
                delta = datos.Delta
            });
        }
    }
}
