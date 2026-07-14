using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using UsaAutoPartes.Domain.Entities.IdentityDb;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Middleware
{
    /// <summary>
    /// MODO PORTAFOLIO: no hay login real, así que las requests llegan sin JWT y
    /// sin claims. Muchos controllers/queries GraphQL asumen que SIEMPRE hay un
    /// usuario autenticado (leen ClaimTypes.NameIdentifier con "!.Value" para
    /// filtrar "mis órdenes", "mi caja", etc.) y explotan con
    /// NullReferenceException si no hay claims.
    ///
    /// Este middleware busca un usuario Admin real en la base de datos (el
    /// primero no eliminado) y arma un ClaimsPrincipal idéntico al que generaría
    /// un login real con ese usuario, para que esos controllers sigan
    /// funcionando sin cambiar cada uno. Se cachea en memoria del proceso.
    ///
    /// Para restaurar el login real: quitar el registro de este middleware en
    /// Program.cs (no toca AuthController ni el JWT).
    /// </summary>
    public class PortfolioIdentityMiddleware(RequestDelegate next)
    {
        private static ClaimsPrincipal? _cachedPrincipal;
        private static readonly SemaphoreSlim _lock = new(1, 1);

        public async Task InvokeAsync(HttpContext context, UserManager<Usuario> userManager)
        {
            if (context.User.Identity?.IsAuthenticated != true)
            {
                var principal = await GetOrBuildPrincipalAsync(userManager);
                if (principal is not null)
                {
                    context.User = principal;
                }
            }

            await next(context);
        }

        private static async Task<ClaimsPrincipal?> GetOrBuildPrincipalAsync(UserManager<Usuario> userManager)
        {
            if (_cachedPrincipal is not null) return _cachedPrincipal;

            await _lock.WaitAsync();
            try
            {
                if (_cachedPrincipal is not null) return _cachedPrincipal;

                var admins = await userManager.GetUsersInRoleAsync(UsuarioRoles.Admin);
                var usuario = admins.FirstOrDefault(u => !u.EstaEliminado());
                if (usuario is null) return null;

                var claims = new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
                    new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                    new Claim(JwtRegisteredClaimNames.Email, usuario.Email ?? string.Empty),
                    new Claim(ClaimTypes.Name, usuario.Nombre),
                    new Claim(ClaimTypes.Role, UsuarioRoles.Admin),
                };
                var identity = new ClaimsIdentity(claims, "PortfolioDemo");
                _cachedPrincipal = new ClaimsPrincipal(identity);
                return _cachedPrincipal;
            }
            finally
            {
                _lock.Release();
            }
        }
    }
}
