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
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class MiCuentaController(IUsuarioRepositorio _repo) : ControllerBase
    {
        [HttpPut("me")]
        public async Task<ActionResult<DtoMiPerfilResponse>> UpdateMiPerfil([FromBody] RequestUpdateMiPerfil datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var result = await _repo.UpdateMiPerfilAsync(userId, datos);
            return Ok(result);
        }

        [HttpPost("me/change-password")]
        public async Task<IActionResult> ChangeMyPassword([FromBody] RequestChangeMyPassword datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            await _repo.ChangeMyPasswordAsync(userId, datos);
            return NoContent();
        }
    }
}
