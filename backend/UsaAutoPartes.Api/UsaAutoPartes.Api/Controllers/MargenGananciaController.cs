using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UsaAutoPartes.Api.Helpers;
using UsaAutoPartes.Application.Dtos.MargenGananciaDtos;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = UsuarioRoles.Admin)]
    public class MargenGananciaController(
        IMargenGananciaRepositorio _margen,
        IUnitWork _db) : ControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> Actualizar(DtoMargenGanancia datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var margen = await _margen.GetUnico();

            if (margen is null)
            {
                margen = new MargenGanancia(datos.Valor);
                await _margen.Crear(margen);
                await _margen.GuardarAsync();
            }
            else
            {
                margen.Actualizar(datos.Valor);
            }

            var productos = await _db.productos.GetProductosConHistorial();

            foreach (var producto in productos)
            {
                var ultimoHistorial = producto.HistorialPrecios.OrderByDescending(h => h.Fecha).FirstOrDefault();
                if (ultimoHistorial is null) continue;

                var nuevoPrecio = PrecioHelper.CalcularPrecioConMargen(ultimoHistorial.Costo, datos.Valor);
                var historial = producto.CambiarPrecio(ultimoHistorial.Costo, nuevoPrecio, ultimoHistorial.ConversionABs, "Actualización por margen de ganancia");
                await _db.historialPrecios.Crear(historial);
            }

            await _db.SaveUnitWork();

            return Ok(new { message = "Margen actualizado y precios recalculados.", productosActualizados = productos.Count });
        }
    }
}
