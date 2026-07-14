using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UsaAutoPartes.Application.Dtos.ClienteDtos;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ClienteController(IClienteRepositorio _cliente) : ControllerBase
    {
        [HttpPost]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> Crear(DtoCrearCliente datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var cliente = datos.Crear();
            await _cliente.Crear(cliente);
            await _cliente.GuardarAsync();

            return Created("", new { message = "Cliente creado." });
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = $"{UsuarioRoles.Admin}, {UsuarioRoles.Cajero}, {UsuarioRoles.Operador}")]
        public async Task<IActionResult> Actualizar(int id, DtoActualizarCliente datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var clienteBd = await _cliente.Obtener(id);
            clienteBd.Actualizar(datos.Nombre, datos.Apellido, datos.Telefono, datos.Direccion, datos.CorreoElectronico);

            await _cliente.GuardarAsync();

            return Ok(new { message = "Cliente actualizado." });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = UsuarioRoles.Admin)]
        public async Task<IActionResult> Eliminar(int id)
        {
            await _cliente.Eliminar(id);
            await _cliente.GuardarAsync();

            return NoContent();
        }
    }
}
