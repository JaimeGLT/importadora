using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UsaAutoPartes.Application.Dtos.TipoCambioDtos;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TipoCambioController(ITipoCambioRepositorio _tipoCambio) : ControllerBase
    {
        [HttpPost]
        [Authorize(Roles = UsuarioRoles.Admin)]
        public async Task<IActionResult> Actualizar(DtoTipoCambio datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var tipoCambio = await _tipoCambio.GetUnico();

            if (tipoCambio is null)
            {
                var nuevo = new TipoCambio(datos.PrecioDolar);
                await _tipoCambio.Crear(nuevo);
            }
            else
            {
                tipoCambio.Actualizar(datos.PrecioDolar);
            }

            await _tipoCambio.GuardarAsync();

            return Ok(new { message = "Tipo de cambio actualizado." });
        }
    }
}
