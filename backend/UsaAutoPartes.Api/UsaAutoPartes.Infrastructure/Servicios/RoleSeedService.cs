using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using UsaAutoPartes.Domain.Entities.IdentityDb;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Infrastructure.Servicios;

/// <summary>
/// Asegura que los roles base del sistema existan en la base de datos.
/// Se ejecuta una sola vez al arrancar la app (idempotente: no duplica si ya existen).
/// Las migraciones EF deben correrse por separado en el deploy (`dotnet ef database update`).
/// </summary>
public class RoleSeedService : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RoleSeedService> _logger;

    public RoleSeedService(IServiceScopeFactory scopeFactory, ILogger<RoleSeedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

            var roles = new[]
            {
                UsuarioRoles.Admin.ToString(),
                UsuarioRoles.Cajero.ToString(),
                UsuarioRoles.Almacenero.ToString(),
                UsuarioRoles.Operador.ToString(),
            };

            foreach (var role in roles)
            {
                if (!await roleManager.RoleExistsAsync(role))
                {
                    await roleManager.CreateAsync(new IdentityRole<Guid>(role));
                    _logger.LogInformation("Rol '{Role}' creado.", role);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al sembrar roles. Verifique que las migraciones estén aplicadas.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
