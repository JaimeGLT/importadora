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
        // ── MODO PORTAFOLIO ─────────────────────────────────────────────────
        // Gestión de usuarios (crear, bloquear, eliminar, horarios, comisiones)
        // deshabilitada: solo se dejan activos los endpoints de LECTURA para que
        // la pantalla pueda listar usuarios si se vuelve a exponer. Cada acción
        // de escritura fue comentada y reemplazada por una respuesta 423 fija.
        // Para restaurar, descomentar el cuerpo original de cada método.

        [HttpPost]
        public Task<IActionResult> Crear([FromBody] RequestRegister datos)
        {
            // if (!ModelState.IsValid) return BadRequest(ModelState);
            // await _auth.Register(datos);
            // return Ok(new { message = "Usuario creado." });
            return Task.FromResult<IActionResult>(Deshabilitado());
        }

        [HttpGet]
        public async Task<IActionResult> GetTodos()
        {
            var usuarios = await _repo.GetTodosAsync();
            return Ok(usuarios);
        }

        [HttpPatch("{id}/toggle")]
        public Task<IActionResult> Toggle(string id)
        {
            // await _repo.ToggleActivoAsync(id);
            // return Ok(new { message = "Estado actualizado." });
            return Task.FromResult<IActionResult>(Deshabilitado());
        }

        [HttpPost("{id}/bloquear-hasta")]
        public Task<IActionResult> BloquearHasta(string id, [FromBody] DtoBloquearHasta datos)
        {
            // if (!ModelState.IsValid) return BadRequest(ModelState);
            // await _repo.BloquearHastaAsync(id, datos.Hasta);
            // return Ok(new { message = "Usuario bloqueado.", hasta = datos.Hasta });
            return Task.FromResult<IActionResult>(Deshabilitado());
        }

        [HttpPost("desactivar-todos")]
        public Task<IActionResult> DesactivarTodos()
        {
            // var callerEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? string.Empty;
            // await _repo.DesactivarTodosAsync(callerEmail);
            // return Ok(new { message = "Usuarios desactivados." });
            return Task.FromResult<IActionResult>(Deshabilitado());
        }

        [HttpPost("programar-bloqueo")]
        public Task<IActionResult> ProgramarBloqueo([FromBody] DtoProgramarBloqueo datos)
        {
            // if (!ModelState.IsValid) return BadRequest(ModelState);
            // var callerEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? string.Empty;
            // await _repo.ProgramarBloqueoAsync(datos.Desde, datos.Hasta, callerEmail);
            // return Ok(new { message = "Bloqueo programado.", desde = datos.Desde, hasta = datos.Hasta });
            return Task.FromResult<IActionResult>(Deshabilitado());
        }

        [HttpGet("{id}/horario")]
        public async Task<IActionResult> GetHorario(string id)
        {
            var horario = await _repo.GetHorarioAsync(id);
            return Ok(horario);
        }

        [HttpPost("{id}/horario")]
        public Task<IActionResult> SetHorario(string id, [FromBody] DtoSetHorario datos)
        {
            // if (!ModelState.IsValid) return BadRequest(ModelState);
            // await _repo.SetHorarioAsync(id, datos);
            // return Ok(new { message = "Horario guardado." });
            return Task.FromResult<IActionResult>(Deshabilitado());
        }

        [HttpDelete("{id}/horario")]
        public Task<IActionResult> DeleteHorario(string id)
        {
            // await _repo.DeleteHorarioAsync(id);
            // return Ok(new { message = "Horario eliminado." });
            return Task.FromResult<IActionResult>(Deshabilitado());
        }

        [HttpGet("horario-global")]
        public async Task<IActionResult> GetHorarioGlobal()
        {
            var horario = await _repo.GetHorarioGlobalAsync();
            return Ok(horario);
        }

        [HttpPost("horario-global")]
        public Task<IActionResult> SetHorarioGlobal([FromBody] DtoSetHorario datos)
        {
            // if (!ModelState.IsValid) return BadRequest(ModelState);
            // await _repo.SetHorarioGlobalAsync(datos);
            // return Ok(new { message = "Horario global guardado." });
            return Task.FromResult<IActionResult>(Deshabilitado());
        }

        [HttpDelete("horario-global")]
        public Task<IActionResult> DeleteHorarioGlobal()
        {
            // await _repo.DeleteHorarioGlobalAsync();
            // return Ok(new { message = "Horario global eliminado." });
            return Task.FromResult<IActionResult>(Deshabilitado());
        }

        [HttpPatch("{id}/comision")]
        public Task<IActionResult> SetComision(string id, [FromBody] DtoSetComision datos)
        {
            // if (!ModelState.IsValid) return BadRequest(ModelState);
            // await _repo.SetComisionAsync(id, datos.Porcentaje);
            // return Ok(new { message = "Comisión actualizada.", porcentaje = datos.Porcentaje });
            return Task.FromResult<IActionResult>(Deshabilitado());
        }

        [HttpDelete("{id}")]
        public Task<IActionResult> Delete(string id)
        {
            // var callerId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            // if (string.IsNullOrEmpty(callerId)) return Unauthorized();
            // await _repo.DeleteUsuarioAsync(callerId, id);
            // return NoContent();
            return Task.FromResult<IActionResult>(Deshabilitado());
        }

        private IActionResult Deshabilitado() =>
            StatusCode(423, new { message = "Gestión de usuarios deshabilitada en este portafolio." });
    }
}
