using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using UsaAutoPartes.Application.Dtos.Autentication;
using UsaAutoPartes.Application.Dtos.Authentication;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Enum.CookieNames;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController(IAuthenticationRepositorio _Auth) : ControllerBase
    {
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Registro(RequestRegister Datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            await _Auth.Register(Datos);

            return Ok();
        }

        [HttpPost("login")]
        public async Task<ActionResult<DtoUsuarioDatos>> Login(RequestLogin datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var usuario = await _Auth.Login(datos);

            return Ok(usuario);
        }

        [HttpPost("refresh")]
        public async Task<ActionResult<DtoUsuarioDatos>> RefreshToken()
        {
            var token = Request.Cookies[CookiesNames.accessreload.ToString()];

            var usuario = await _Auth.RefreshTokenAsync(token);

            return Ok(usuario);
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            await _Auth.LogoutAsync(userId);

            Response.Cookies.Delete(CookiesNames.access.ToString(), new CookieOptions { Path = "/" });
            Response.Cookies.Delete(CookiesNames.accessreload.ToString(), new CookieOptions { Path = "/api/Auth/refresh" });

            return Ok(new { message = "Sesión cerrada." });
        }
    }
}
