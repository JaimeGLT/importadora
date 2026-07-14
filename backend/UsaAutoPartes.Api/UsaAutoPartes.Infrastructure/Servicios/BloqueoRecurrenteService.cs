using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using UsaAutoPartes.Domain.Entities.IdentityDb;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;
using UsaAutoPartes.Infrastructure.Data;

namespace UsaAutoPartes.Infrastructure.Servicios
{
    public class BloqueoRecurrenteService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<BloqueoRecurrenteService> _logger;
        private readonly TimeZoneInfo _zona;

        public BloqueoRecurrenteService(IServiceScopeFactory scopeFactory, ILogger<BloqueoRecurrenteService> logger, TimeZoneInfo zona)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _zona = zona;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try { await AplicarBloqueos(stoppingToken); }
                catch (Exception ex) { _logger.LogError(ex, "Error en BloqueoRecurrenteService"); }
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        private async Task AplicarBloqueos(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<Usuario>>();

            var ahoraUtc = DateTime.UtcNow;
            var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(ahoraUtc, _zona);
            var ahora = TimeOnly.FromDateTime(ahoraLocal);

            // 1. Horarios recurrentes individuales
            var horarios = await db.HorariosBloqueo
                .Include(h => h.Usuario)
                .Where(h => h.Activo)
                .ToListAsync(ct);

            foreach (var h in horarios)
            {
                var enVentana = EstaEnVentana(ahora, h.HoraInicio, h.HoraFin);
                var usuario = h.Usuario;

                if (enVentana && !usuario.BloqueoHorarioActivo)
                {
                    var finBloqueo = CalcularFinBloqueo(h.HoraFin);
                    await userManager.SetLockoutEnabledAsync(usuario, true);
                    await userManager.SetLockoutEndDateAsync(usuario, finBloqueo);
                    usuario.BloqueoHorarioActivo = true;
                    await userManager.UpdateAsync(usuario);
                    _logger.LogInformation("Bloqueado por horario: {email}", usuario.Email);
                }
                else if (!enVentana && usuario.BloqueoHorarioActivo)
                {
                    await userManager.SetLockoutEndDateAsync(usuario, null);
                    usuario.BloqueoHorarioActivo = false;
                    await userManager.UpdateAsync(usuario);
                    _logger.LogInformation("Desbloqueado por horario: {email}", usuario.Email);
                }
            }

            // 2. Horario recurrente global (todos los no-admins)
            var horarioGlobal = await db.HorariosGlobal.FirstOrDefaultAsync(h => h.Activo, ct);
            if (horarioGlobal is not null)
            {
                var admins = await userManager.GetUsersInRoleAsync(UsuarioRoles.Admin);
                var adminIds = admins.Select(a => a.Id).ToHashSet();
                var noAdmins = await userManager.Users
                    .Where(u => !adminIds.Contains(u.Id))
                    .ToListAsync(ct);

                var enVentana = EstaEnVentana(ahora, horarioGlobal.HoraInicio, horarioGlobal.HoraFin);

                foreach (var usuario in noAdmins)
                {
                    if (enVentana && !usuario.BloqueoHorarioGlobalActivo && !usuario.BloqueoHorarioActivo)
                    {
                        // Solo bloquear si actualmente está activo (no tiene bloqueo manual)
                        var activo = !usuario.LockoutEnabled || !usuario.LockoutEnd.HasValue || usuario.LockoutEnd.Value <= DateTimeOffset.UtcNow;
                        if (activo)
                        {
                            var finBloqueo = CalcularFinBloqueo(horarioGlobal.HoraFin);
                            await userManager.SetLockoutEnabledAsync(usuario, true);
                            await userManager.SetLockoutEndDateAsync(usuario, finBloqueo);
                            usuario.BloqueoHorarioGlobalActivo = true;
                            await userManager.UpdateAsync(usuario);
                            _logger.LogInformation("Bloqueado por horario global: {email}", usuario.Email);
                        }
                    }
                    else if (!enVentana && usuario.BloqueoHorarioGlobalActivo)
                    {
                        await userManager.SetLockoutEndDateAsync(usuario, null);
                        usuario.BloqueoHorarioGlobalActivo = false;
                        await userManager.UpdateAsync(usuario);
                        _logger.LogInformation("Desbloqueado por horario global: {email}", usuario.Email);
                    }
                }
            }

            // 3. Bloqueos globales programados (con "desde" futuro)
            var programados = await db.BloqueosProgramados
                .Where(b => !b.Aplicado && b.Desde <= ahoraUtc)
                .ToListAsync(ct);

            if (programados.Count > 0)
            {
                var admins = await userManager.GetUsersInRoleAsync(UsuarioRoles.Admin);
                var adminIds = admins.Select(a => a.Id).ToHashSet();
                var noAdmins = await userManager.Users
                    .Where(u => !adminIds.Contains(u.Id))
                    .ToListAsync(ct);

                foreach (var programado in programados)
                {
                    var hastaUtc = new DateTimeOffset(programado.Hasta, TimeSpan.Zero);
                    foreach (var usuario in noAdmins)
                    {
                        await userManager.SetLockoutEnabledAsync(usuario, true);
                        await userManager.SetLockoutEndDateAsync(usuario, hastaUtc);
                    }
                    programado.Aplicado = true;
                    _logger.LogInformation("Bloqueo programado aplicado: {desde} → {hasta}", programado.Desde, programado.Hasta);
                }
                await db.SaveChangesAsync(ct);
            }
        }

        private static bool EstaEnVentana(TimeOnly ahora, TimeOnly inicio, TimeOnly fin)
        {
            if (inicio <= fin)
                return ahora >= inicio && ahora < fin;
            else // cruza medianoche (ej: 20:00 → 03:00)
                return ahora >= inicio || ahora < fin;
        }

        private DateTimeOffset CalcularFinBloqueo(TimeOnly horaFin)
        {
            var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _zona);
            var fin = ahoraLocal.Date.Add(horaFin.ToTimeSpan());
            if (fin <= ahoraLocal) fin = fin.AddDays(1);

            var finUtc = TimeZoneInfo.ConvertTimeToUtc(fin, _zona);
            return new DateTimeOffset(finUtc, TimeSpan.Zero);
        }
    }
}
