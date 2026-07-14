using Mapster;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using UsaAutoPartes.Application.Dtos.ProveedorDto;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = UsuarioRoles.Admin)]
    public class ProveedorController(IProveedorRepositorio _db) : ControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> Crear(ProveedorCU datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            datos.Email = datos.Email?.ToLower();

            var proveedor = datos.Adapt<Proveedor>();

            await _db.Crear(proveedor);

            await _db.GuardarAsync();

            return Created("", new { id = proveedor.Id, nombre = proveedor.Nombre });
        }

        [HttpPut("{Id:int}")]
        public async Task<IActionResult> Update(int Id, ProveedorCU datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            datos.Email = datos.Email?.ToLower();

            var proveedor = await _db.Obtener(Id);

            proveedor = datos.Adapt(proveedor);

            await _db.GuardarAsync();

            return NoContent();
        }

        [HttpDelete("{Id:int}")]
        public async Task<IActionResult> Delete(int Id)
        {
            await _db.Eliminar(Id);

            await _db.GuardarAsync();

            return NoContent();
        }
    }
}
