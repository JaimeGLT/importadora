using Microsoft.AspNetCore.Authorization;

namespace UsaAutoPartes.Api.Middleware
{
    /// <summary>
    /// MODO PORTAFOLIO: aprueba cualquier requerimiento de autorización pendiente
    /// (rol, política, autenticación, etc.), efectivamente desactivando login y
    /// permisos para toda la API sin remover los atributos [Authorize] existentes.
    /// Ver registro en Program.cs. Eliminar este archivo y su registro para
    /// restaurar el comportamiento original de autenticación/roles.
    /// </summary>
    public class AllowAllAuthorizationHandler : IAuthorizationHandler
    {
        public Task HandleAsync(AuthorizationHandlerContext context)
        {
            foreach (var requirement in context.PendingRequirements.ToList())
            {
                context.Succeed(requirement);
            }
            return Task.CompletedTask;
        }
    }
}
