using HotChocolate.Authorization;
using System.Security.Claims;
using UsaAutoPartes.Application.Dtos.Authentication;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities.IdentityDb;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class MeQuery
    {
        [Authorize]
        public async Task<DtoUsuarioDatos> Me([Service] IUsuarioRepositorio user, ClaimsPrincipal info)
        {
            var userId = info.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (userId == null) throw new Exception("info no encontrado");

            var (usuarioDb , roal) = await user.Me(userId);

            if (usuarioDb == null) throw new Exception("Usario no encontrado");

            return new DtoUsuarioDatos
            {
                Nombre = usuarioDb.Nombre,
                Correo = usuarioDb.Email!,
                Rol = roal!
            };

        }
    }
}
