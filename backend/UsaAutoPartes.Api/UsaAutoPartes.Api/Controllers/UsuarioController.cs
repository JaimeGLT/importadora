using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UsaAutoPartes.Application.Dtos.Autentication;
using UsaAutoPartes.Application.Dtos.UsuarioDtos;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = UsuarioRoles.Admin)]
    public class UsuarioController(IUsuarioRepositorio _repo, IAuthenticationRepositorio _auth) : ControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] RequestRegister datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            await _auth.Register(datos);
            return Ok(new { message = "Usuario creado." });
        }

        [HttpGet]
        public async Task<IActionResult> GetTodos()
        {
            var usuarios = await _repo.GetTodosAsync();
            return Ok(usuarios);
        }

        [HttpPatch("{id}/toggle")]
        public async Task<IActionResult> Toggle(string id)
        {
            await _repo.ToggleActivoAsync(id);
            return Ok(new { message = "Estado actualizado." });
        }

        [HttpPost("{id}/bloquear-hasta")]
        public async Task<IActionResult> BloquearHasta(string id, [FromBody] DtoBloquearHasta datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            await _repo.BloquearHastaAsync(id, datos.Hasta);
            return Ok(new { message = "Usuario bloqueado.", hasta = datos.Hasta });
        }

        [HttpPost("desactivar-todos")]
        public async Task<IActionResult> DesactivarTodos()
        {
            var callerEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? string.Empty;
            await _repo.DesactivarTodosAsync(callerEmail);
            return Ok(new { message = "Usuarios desactivados." });
        }

        [HttpPost("programar-bloqueo")]
        public async Task<IActionResult> ProgramarBloqueo([FromBody] DtoProgramarBloqueo datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var callerEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? string.Empty;
            await _repo.ProgramarBloqueoAsync(datos.Desde, datos.Hasta, callerEmail);
            return Ok(new { message = "Bloqueo programado.", desde = datos.Desde, hasta = datos.Hasta });
        }

        [HttpGet("{id}/horario")]
        public async Task<IActionResult> GetHorario(string id)
        {
            var horario = await _repo.GetHorarioAsync(id);
            return Ok(horario);
        }

        [HttpPost("{id}/horario")]
        public async Task<IActionResult> SetHorario(string id, [FromBody] DtoSetHorario datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            await _repo.SetHorarioAsync(id, datos);
            return Ok(new { message = "Horario guardado." });
        }

        [HttpDelete("{id}/horario")]
        public async Task<IActionResult> DeleteHorario(string id)
        {
            await _repo.DeleteHorarioAsync(id);
            return Ok(new { message = "Horario eliminado." });
        }

        [HttpGet("horario-global")]
        public async Task<IActionResult> GetHorarioGlobal()
        {
            var horario = await _repo.GetHorarioGlobalAsync();
            return Ok(horario);
        }

        [HttpPost("horario-global")]
        public async Task<IActionResult> SetHorarioGlobal([FromBody] DtoSetHorario datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            await _repo.SetHorarioGlobalAsync(datos);
            return Ok(new { message = "Horario global guardado." });
        }

        [HttpDelete("horario-global")]
        public async Task<IActionResult> DeleteHorarioGlobal()
        {
            await _repo.DeleteHorarioGlobalAsync();
            return Ok(new { message = "Horario global eliminado." });
        }

        [HttpPatch("{id}/comision")]
        public async Task<IActionResult> SetComision(string id, [FromBody] DtoSetComision datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            await _repo.SetComisionAsync(id, datos.Porcentaje);
            return Ok(new { message = "Comisión actualizada.", porcentaje = datos.Porcentaje });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var callerId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(callerId)) return Unauthorized();
            await _repo.DeleteUsuarioAsync(callerId, id);
            return NoContent();
        }
    }
}
