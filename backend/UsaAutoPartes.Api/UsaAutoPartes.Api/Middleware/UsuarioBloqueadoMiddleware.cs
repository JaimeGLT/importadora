using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using UsaAutoPartes.Application.Exceptions.AuthenticationExceptions;
using UsaAutoPartes.Domain.Entities.IdentityDb;
using UsaAutoPartes.Domain.Enum.CookieNames;
using UsaAutoPartes.Infrastructure.Data;

namespace UsaAutoPartes.Api.Middleware
{
    public class UsuarioBloqueadoMiddleware(RequestDelegate next)
    {
        public async Task InvokeAsync(
            HttpContext context,
            UserManager<Usuario> userManager,
            AppDbContext db)
        {
            if (EsRutaExcluida(context))
            {
                await next(context);
                return;
            }

            if (EsRefresh(context))
            {
                var refreshToken = context.Request.Cookies[CookiesNames.accessreload.ToString()];
                if (!string.IsNullOrEmpty(refreshToken))
                {
                    var userId = await db.RefreshTokens
                        .AsNoTracking()
                        .Where(x => x.Token == refreshToken)
                        .Select(x => (Guid?)x.UserId)
                        .FirstOrDefaultAsync(context.RequestAborted);

                    if (userId.HasValue && await UsuarioEstaBloqueadoAsync(userManager, userId.Value))
                    {
                        await RechazarAsync(context);
                        return;
                    }
                }
            }

            if (context.User.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (Guid.TryParse(userIdClaim, out var userId)
                    && await UsuarioEstaBloqueadoAsync(userManager, userId))
                {
                    await RechazarAsync(context);
                    return;
                }
            }

            await next(context);
        }

        private static bool EsRutaExcluida(HttpContext context)
        {
            var path = context.Request.Path;

            if (path.StartsWithSegments("/openapi") || path.StartsWithSegments("/scalar"))
                return true;

            if (path.StartsWithSegments("/api/Auth/login"))
                return true;

            if (path.Equals("/api/Auth", StringComparison.OrdinalIgnoreCase)
                && HttpMethods.IsPost(context.Request.Method))
                return true;

            return false;
        }

        private static bool EsRefresh(HttpContext context) =>
            context.Request.Path.StartsWithSegments("/api/Auth/refresh")
            && HttpMethods.IsPost(context.Request.Method);

        private static async Task<bool> UsuarioEstaBloqueadoAsync(UserManager<Usuario> userManager, Guid userId)
        {
            var user = await userManager.FindByIdAsync(userId.ToString());
            if (user is null) return true; // no existe o fue soft-deleted
            return user.EstaBloqueado() || user.EstaEliminado();
        }

        private static async Task RechazarAsync(HttpContext context)
        {
            context.Response.Cookies.Delete(CookiesNames.access.ToString(), new CookieOptions { Path = "/" });
            context.Response.Cookies.Delete(CookiesNames.accessreload.ToString(), new CookieOptions { Path = "/api/Auth/refresh" });

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                message = new UsuarioDesactivadoException().Message
            });
        }
    }
}
