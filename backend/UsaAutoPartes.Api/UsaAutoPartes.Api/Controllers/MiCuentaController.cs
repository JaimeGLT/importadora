using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using UsaAutoPartes.Application.Dtos.Authentication;
using UsaAutoPartes.Application.IRepositorio;

namespace UsaAutoPartes.Api.Controllers
{
    /// <summary>
    /// Endpoints para que un usuario edite SU PROPIA información.
    /// El userId se deriva SIEMPRE del JWT, nunca de la URL ni del body.
    /// Accesible a cualquier usuario autenticado (sin restricción de rol).
    /// </summary>
    // ── MODO PORTAFOLIO ─────────────────────────────────────────────────────
    // Edición de perfil y cambio de contraseña deshabilitados (no hay login,
    // no hay JWT del cual derivar el userId). Cuerpos originales comentados
    // abajo para restaurar junto con el login.
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class MiCuentaController(IUsuarioRepositorio _repo) : ControllerBase
    {
        [HttpPut("me")]
        public Task<ActionResult<DtoMiPerfilResponse>> UpdateMiPerfil([FromBody] RequestUpdateMiPerfil datos)
        {
            // if (!ModelState.IsValid) return BadRequest(ModelState);
            //
            // var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            // if (string.IsNullOrEmpty(userId)) return Unauthorized();
            //
            // var result = await _repo.UpdateMiPerfilAsync(userId, datos);
            // return Ok(result);
            return Task.FromResult<ActionResult<DtoMiPerfilResponse>>(Deshabilitado<DtoMiPerfilResponse>());
        }

        [HttpPost("me/change-password")]
        public Task<IActionResult> ChangeMyPassword([FromBody] RequestChangeMyPassword datos)
        {
            // if (!ModelState.IsValid) return BadRequest(ModelState);
            //
            // var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            // if (string.IsNullOrEmpty(userId)) return Unauthorized();
            //
            // await _repo.ChangeMyPasswordAsync(userId, datos);
            // return NoContent();
            return Task.FromResult<IActionResult>(StatusCode(423, new { message = "Cambio de contraseña deshabilitado en este portafolio." }));
        }

        private ActionResult<T> Deshabilitado<T>() =>
            StatusCode(423, new { message = "Edición de perfil deshabilitada en este portafolio." });
    }
}
