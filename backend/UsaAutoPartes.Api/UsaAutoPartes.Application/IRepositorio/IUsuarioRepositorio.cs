using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Application.Dtos.Authentication;
using UsaAutoPartes.Application.Dtos.UsuarioDtos;
using UsaAutoPartes.Domain.Entities.IdentityDb;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IUsuarioRepositorio
    {
        Task<(Usuario? usuario, string? rol)> Me(string id);
        Task<List<DtoUsuarioResponse>> GetTodosAsync();
        Task ToggleActivoAsync(string id);
        Task BloquearHastaAsync(string id, DateTime hasta);
        Task DesactivarTodosAsync(string callerEmail);
        Task ProgramarBloqueoAsync(DateTime? desde, DateTime hasta, string callerEmail);
        Task<DtoHorarioResponse?> GetHorarioAsync(string id);
        Task SetHorarioAsync(string id, DtoSetHorario datos);
        Task DeleteHorarioAsync(string id);
        Task<DtoHorarioResponse?> GetHorarioGlobalAsync();
        Task SetHorarioGlobalAsync(DtoSetHorario datos);
        Task DeleteHorarioGlobalAsync();
        Task SetComisionAsync(string id, decimal porcentaje);

        // ─── Mi perfil (cualquier usuario autenticado) ──────────────────────
        Task<DtoMiPerfilResponse> UpdateMiPerfilAsync(string userId, RequestUpdateMiPerfil datos);
        Task ChangeMyPasswordAsync(string userId, RequestChangeMyPassword datos);

        // ─── Solo Admin ─────────────────────────────────────────────────────
        Task DeleteUsuarioAsync(string callerId, string targetUserId);
    }
}
