using Mapster;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using UsaAutoPartes.Application.Dtos.DescuentoDtos;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = UsuarioRoles.Admin)]
    public class DescuentoController(IDescuentoRepositorio _descuento) : ControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> Crear(DtoDescuentoCU datos)
        {
            if(!ModelState.IsValid) return BadRequest(ModelState);

            var descuento = datos.Adapt<Descuento>();

            await _descuento.Crear(descuento);

            await _descuento.GuardarAsync();

            return Ok(new { message = "Descuento creado" });
        }

        [HttpPut("{Id:int}")]
        public async Task<IActionResult> Actualizar(int Id,DtoDescuentoCU datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var descuento = await _descuento.Obtener(Id);

            descuento = datos.Adapt(descuento);

            await _descuento.GuardarAsync();

            return Ok(new { message = "Actualizado" });
        }

        [HttpDelete("{Id:int}")]
        public async Task<IActionResult> Eliminar(int Id)
        {
            await _descuento.Eliminar(Id);

            await _descuento.GuardarAsync();

            return NoContent();
        }

        [HttpPut("Estado/{Id:int}")]
        public async Task<IActionResult> CambiarEstado(int Id)
        {
            var descuento = await _descuento.Obtener(Id);

            descuento.Activo = descuento.Activo ? false : true;

            await _descuento.GuardarAsync();

            return NoContent();
        }
    } 
}
