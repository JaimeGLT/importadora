using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.Dtos.Authentication;
using UsaAutoPartes.Application.Dtos.UsuarioDtos;
using UsaAutoPartes.Application.Exceptions.AuthenticationExceptions;
using UsaAutoPartes.Application.Exceptions.GenericExceptions;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities.IdentityDb;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Infrastructure.Data.Repositorio
{
    public class UsuarioRepositorio : IUsuarioRepositorio
    {
        private readonly UserManager<Usuario> _usuarios;
        private readonly AppDbContext _db;

        public UsuarioRepositorio(UserManager<Usuario> usuarios, AppDbContext db)
        {
            _usuarios = usuarios;
            _db = db;
        }

        public async Task<(Usuario? usuario, string? rol)> Me(string id)
        {
            var usuario = await _usuarios.FindByIdAsync(id);
            if (usuario is null) return (null, "");
            var rol = await _usuarios.GetRolesAsync(usuario);
            return (usuario, rol.FirstOrDefault());
        }

        public async Task<List<DtoUsuarioResponse>> GetTodosAsync()
        {
            var usuarios = await _usuarios.Users.ToListAsync();
            var horarios = await _db.HorariosBloqueo
                .Where(h => h.Activo)
                .ToDictionaryAsync(h => h.UsuarioId);

            var result = new List<DtoUsuarioResponse>();

            foreach (var u in usuarios)
            {
                var roles = await _usuarios.GetRolesAsync(u);
                var activo = !u.LockoutEnabled || !u.LockoutEnd.HasValue || u.LockoutEnd.Value <= DateTimeOffset.UtcNow;
                var bloqueadoHasta = (!activo && u.LockoutEnd.HasValue && u.LockoutEnd.Value < DateTimeOffset.MaxValue)
                    ? u.LockoutEnd.Value.UtcDateTime
                    : (DateTime?)null;

                horarios.TryGetValue(u.Id, out var horario);

                result.Add(new DtoUsuarioResponse
                {
                    Id = u.Id.ToString(),
                    Nombre = u.Nombre,
                    Apellido = u.Apellido,
                    Email = u.Email ?? string.Empty,
                    Rol = roles.FirstOrDefault() ?? string.Empty,
                    Activo = activo,
                    BloqueadoHasta = bloqueadoHasta,
                    PorcentajeComision = u.PorcentajeComision,
                    Horario = horario is null ? null : new DtoHorarioResponse
                    {
                        HoraInicio = horario.HoraInicio.ToString("HH:mm"),
                        HoraFin = horario.HoraFin.ToString("HH:mm"),
                        Activo = horario.Activo,
                    }
                });
            }

            return result;
        }

        public async Task ToggleActivoAsync(string id)
        {
            var usuario = await _usuarios.FindByIdAsync(id)
                ?? throw new KeyNotFoundException("Usuario no encontrado.");

            var activo = !usuario.LockoutEnabled || !usuario.LockoutEnd.HasValue || usuario.LockoutEnd.Value <= DateTimeOffset.UtcNow;

            if (activo)
            {
                await _usuarios.SetLockoutEnabledAsync(usuario, true);
                await _usuarios.SetLockoutEndDateAsync(usuario, DateTimeOffset.MaxValue);
            }
            else
            {
                await _usuarios.SetLockoutEndDateAsync(usuario, null);
            }
        }

        public async Task BloquearHastaAsync(string id, DateTime hasta)
        {
            var usuario = await _usuarios.FindByIdAsync(id)
                ?? throw new EntidadNoEncontradaException("Usuario");
            var hastaUtc = new DateTimeOffset(hasta.ToUniversalTime(), TimeSpan.Zero);
            await _usuarios.SetLockoutEnabledAsync(usuario, true);
            await _usuarios.SetLockoutEndDateAsync(usuario, hastaUtc);
        }

        public async Task DesactivarTodosAsync(string callerEmail)
        {
            var admins = await _usuarios.GetUsersInRoleAsync(UsuarioRoles.Admin);
            var adminIds = admins.Select(a => a.Id).ToHashSet();

            var usuarios = await _usuarios.Users
                .Where(u => !adminIds.Contains(u.Id))
                .ToListAsync();

            foreach (var u in usuarios)
            {
                await _usuarios.SetLockoutEnabledAsync(u, true);
                await _usuarios.SetLockoutEndDateAsync(u, DateTimeOffset.MaxValue);
            }
        }

        public async Task ProgramarBloqueoAsync(DateTime? desde, DateTime hasta, string callerEmail)
        {
            var hastaUtc = new DateTimeOffset(hasta.ToUniversalTime(), TimeSpan.Zero);

            if (desde.HasValue && desde.Value.ToUniversalTime() > DateTime.UtcNow)
            {
                _db.BloqueosProgramados.Add(new BloqueoGlobalProgramado
                {
                    Desde = desde.Value.ToUniversalTime(),
                    Hasta = hasta.ToUniversalTime(),
                    Aplicado = false,
                });
                await _db.SaveChangesAsync();
                return;
            }

            var admins = await _usuarios.GetUsersInRoleAsync(UsuarioRoles.Admin);
            var adminIds = admins.Select(a => a.Id).ToHashSet();

            var usuarios = await _usuarios.Users
                .Where(u => !adminIds.Contains(u.Id))
                .ToListAsync();

            foreach (var u in usuarios)
            {
                await _usuarios.SetLockoutEnabledAsync(u, true);
                await _usuarios.SetLockoutEndDateAsync(u, hastaUtc);
            }
        }

        public async Task<DtoHorarioResponse?> GetHorarioAsync(string id)
        {
            if (!Guid.TryParse(id, out var guid)) throw new EntidadNoEncontradaException("Usuario");
            var h = await _db.HorariosBloqueo.FirstOrDefaultAsync(x => x.UsuarioId == guid);
            if (h is null) return null;
            return new DtoHorarioResponse
            {
                HoraInicio = h.HoraInicio.ToString("HH:mm"),
                HoraFin = h.HoraFin.ToString("HH:mm"),
                Activo = h.Activo,
            };
        }

        public async Task SetHorarioAsync(string id, DtoSetHorario datos)
        {
            if (!Guid.TryParse(id, out var guid)) throw new EntidadNoEncontradaException("Usuario");
            _ = await _usuarios.FindByIdAsync(id) ?? throw new EntidadNoEncontradaException("Usuario");

            if (!TimeOnly.TryParseExact(datos.HoraInicio, "HH:mm", out var inicio))
                throw new ArgumentException("HoraInicio inválida. Formato: HH:mm");
            if (!TimeOnly.TryParseExact(datos.HoraFin, "HH:mm", out var fin))
                throw new ArgumentException("HoraFin inválida. Formato: HH:mm");

            var existing = await _db.HorariosBloqueo.FirstOrDefaultAsync(x => x.UsuarioId == guid);

            if (existing is null)
            {
                _db.HorariosBloqueo.Add(new HorarioBloqueo
                {
                    UsuarioId = guid,
                    HoraInicio = inicio,
                    HoraFin = fin,
                    Activo = true,
                });
            }
            else
            {
                existing.HoraInicio = inicio;
                existing.HoraFin = fin;
                existing.Activo = true;
            }

            await _db.SaveChangesAsync();
        }

        public async Task DeleteHorarioAsync(string id)
        {
            if (!Guid.TryParse(id, out var guid)) throw new EntidadNoEncontradaException("Usuario");

            var h = await _db.HorariosBloqueo.FirstOrDefaultAsync(x => x.UsuarioId == guid);
            if (h is null) return;

            _db.HorariosBloqueo.Remove(h);

            var usuario = await _usuarios.FindByIdAsync(id);
            if (usuario is not null && usuario.BloqueoHorarioActivo)
            {
                await _usuarios.SetLockoutEndDateAsync(usuario, null);
                usuario.BloqueoHorarioActivo = false;
                await _usuarios.UpdateAsync(usuario);
            }

            await _db.SaveChangesAsync();
        }

        public async Task<DtoHorarioResponse?> GetHorarioGlobalAsync()
        {
            var h = await _db.HorariosGlobal.FirstOrDefaultAsync(x => x.Activo);
            if (h is null) return null;
            return new DtoHorarioResponse
            {
                HoraInicio = h.HoraInicio.ToString("HH:mm"),
                HoraFin = h.HoraFin.ToString("HH:mm"),
                Activo = h.Activo,
            };
        }

        public async Task SetHorarioGlobalAsync(DtoSetHorario datos)
        {
            if (!TimeOnly.TryParseExact(datos.HoraInicio, "HH:mm", out var inicio))
                throw new ArgumentException("HoraInicio inválida. Formato: HH:mm");
            if (!TimeOnly.TryParseExact(datos.HoraFin, "HH:mm", out var fin))
                throw new ArgumentException("HoraFin inválida. Formato: HH:mm");

            var existing = await _db.HorariosGlobal.FirstOrDefaultAsync();
            if (existing is null)
            {
                _db.HorariosGlobal.Add(new HorarioGlobal
                {
                    HoraInicio = inicio,
                    HoraFin = fin,
                    Activo = true,
                });
            }
            else
            {
                existing.HoraInicio = inicio;
                existing.HoraFin = fin;
                existing.Activo = true;
            }

            await _db.SaveChangesAsync();
        }

        public async Task SetComisionAsync(string id, decimal porcentaje)
        {
            var usuario = await _usuarios.FindByIdAsync(id)
                ?? throw new KeyNotFoundException("Usuario no encontrado.");
            usuario.PorcentajeComision = porcentaje;
            await _usuarios.UpdateAsync(usuario);
        }

        public async Task DeleteHorarioGlobalAsync()
        {
            var h = await _db.HorariosGlobal.FirstOrDefaultAsync();
            if (h is null) return;

            _db.HorariosGlobal.Remove(h);

            var bloqueadosPorGlobal = await _usuarios.Users
                .Where(u => u.BloqueoHorarioGlobalActivo)
                .ToListAsync();

            foreach (var u in bloqueadosPorGlobal)
            {
                await _usuarios.SetLockoutEndDateAsync(u, null);
                u.BloqueoHorarioGlobalActivo = false;
                await _usuarios.UpdateAsync(u);
            }

            await _db.SaveChangesAsync();
        }

        // ─── Mi perfil (cualquier usuario autenticado) ──────────────────────

        public async Task<DtoMiPerfilResponse> UpdateMiPerfilAsync(string userId, RequestUpdateMiPerfil datos)
        {
            var usuario = await _usuarios.FindByIdAsync(userId)
                ?? throw new EntidadNoEncontradaException("Usuario");

            // Validar correo duplicado si cambió
            var correoActual = usuario.Email ?? string.Empty;
            if (!string.Equals(correoActual, datos.Correo, StringComparison.OrdinalIgnoreCase))
            {
                var existente = await _usuarios.FindByEmailAsync(datos.Correo);
                if (existente is not null && existente.Id != usuario.Id)
                {
                    throw new CorreoDuplicadoException(datos.Correo);
                }
                var setEmail = await _usuarios.SetEmailAsync(usuario, datos.Correo);
                if (!setEmail.Succeeded)
                {
                    throw new RegistroTransaccionFailException(setEmail.Errors.Select(x => x.Description));
                }
                await _usuarios.SetUserNameAsync(usuario, datos.Correo);
            }

            usuario.Nombre = datos.Nombre.Trim();
            usuario.Apellido = datos.Apellido.Trim();

            var update = await _usuarios.UpdateAsync(usuario);
            if (!update.Succeeded)
            {
                throw new RegistroTransaccionFailException(update.Errors.Select(x => x.Description));
            }

            var rol = (await _usuarios.GetRolesAsync(usuario)).FirstOrDefault() ?? string.Empty;

            return new DtoMiPerfilResponse
            {
                Id = usuario.Id,
                Nombre = usuario.Nombre,
                Apellido = usuario.Apellido,
                Correo = usuario.Email ?? string.Empty,
                Rol = rol,
            };
        }

        public async Task ChangeMyPasswordAsync(string userId, RequestChangeMyPassword datos)
        {
            var usuario = await _usuarios.FindByIdAsync(userId)
                ?? throw new EntidadNoEncontradaException("Usuario");

            if (datos.PasswordNueva != datos.PasswordNuevaConfirm)
            {
                throw new PasswordIncorrectaException(); // mensaje genérico para no leak
            }

            var result = await _usuarios.ChangePasswordAsync(usuario, datos.PasswordActual, datos.PasswordNueva);
            if (!result.Succeeded)
            {
                throw new PasswordIncorrectaException();
            }
        }

        // ─── Solo Admin ─────────────────────────────────────────────────────

        public async Task DeleteUsuarioAsync(string callerId, string targetUserId)
        {
            if (!Guid.TryParse(targetUserId, out _))
                throw new EntidadNoEncontradaException("Usuario");

            // 1) No puede eliminarse a sí mismo
            if (string.Equals(callerId, targetUserId, StringComparison.OrdinalIgnoreCase))
            {
                throw new EliminarUsuarioInvalidoException("No puedes eliminarte a ti mismo.");
            }

            // 2) No se puede eliminar a otro admin
            var target = await _usuarios.FindByIdAsync(targetUserId)
                ?? throw new EntidadNoEncontradaException("Usuario");

            var rolesTarget = await _usuarios.GetRolesAsync(target);
            if (rolesTarget.Contains(UsuarioRoles.Admin))
            {
                throw new EliminarUsuarioInvalidoException("No se puede eliminar a otro administrador.");
            }

            // 3) Limpiar refresh tokens del usuario para que no pueda seguir
            //    manteniendo sesiones activas (los EliminadoEn no invalidan tokens
            //    existentes por sí solos hasta que el middleware los corte).
            await _db.RefreshTokens
                .Where(rt => rt.UserId == target.Id)
                .ExecuteDeleteAsync();

            // 4) Soft delete: marcar EliminadoEn en vez de borrar físicamente.
            //    Las cajas, créditos, órdenes y demás datos transaccionales del
            //    usuario se preservan para auditoría y reportes históricos. El
            //    usuario no podrá loguearse ni aparecerá en la lista.
            target.EliminadoEn = DateTime.UtcNow;
            var update = await _usuarios.UpdateAsync(target);
            if (!update.Succeeded)
            {
                throw new RegistroTransaccionFailException(update.Errors.Select(x => x.Description));
            }
        }
    }
}
