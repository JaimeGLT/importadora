using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UsaAutoPartes.Application.Dtos.ConfigVentaDtos;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;
using UsaAutoPartes.Domain.Enum.VentaEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = UsuarioRoles.Admin)]
    public class ConfigVentaController(IConfigVentaRepositorio _config) : ControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> Actualizar(DtoConfigVenta datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var modosValidos = new[] { ModoVenta.PrecioImportacion, ModoVenta.PrecioDolarDia, ModoVenta.Ambos };
            if (!modosValidos.Contains(datos.ModoVenta))
                return BadRequest(new { message = "Modo inválido. Use: PrecioImportacion, PrecioDolarDia o Ambos." });

            var config = await _config.GetUnico();

            if (config is null)
            {
                var nueva = new ConfigVenta(datos.ModoVenta);
                await _config.Crear(nueva);
            }
            else
            {
                config.Actualizar(datos.ModoVenta);
            }

            await _config.GuardarAsync();

            return Ok(new { message = "Configuración de venta actualizada.", modoVenta = datos.ModoVenta });
        }
    }
}
