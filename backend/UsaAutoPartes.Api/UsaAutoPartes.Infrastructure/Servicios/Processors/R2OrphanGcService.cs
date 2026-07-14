using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Application.IServicios;

namespace UsaAutoPartes.Infrastructure.Servicios.Processors
{
    /// <summary>
    /// Hosted service que corre cada <c>CloudflareR2.GcIntervalHours</c> y limpia
    /// objetos huérfanos en R2 (subidos pero nunca confirmados en BD).
    /// <para>
    /// Solo limpia objetos con más de 1h de antigüedad (subido y olvidado antes
    /// de que el cliente llegara a confirmar) y que NO estén referenciados en
    /// <c>ProductoImagen.LlaveObjeto</c> activas.
    /// </para>
    /// </summary>
    public class R2OrphanGcService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly CloudflareR2Options _opts;
        private readonly ILogger<R2OrphanGcService> _logger;

        public R2OrphanGcService(
            IServiceProvider serviceProvider,
            IOptions<CloudflareR2Options> opts,
            ILogger<R2OrphanGcService> logger)
        {
            _serviceProvider = serviceProvider;
            _opts = opts.Value;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var interval = TimeSpan.FromHours(Math.Max(1, _opts.GcIntervalHours));
            _logger.LogInformation("R2OrphanGcService iniciado. Intervalo: {Interval}h", interval.TotalHours);

            // Espera inicial para no correr durante el arranque de la app.
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
            catch (TaskCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await EjecutarGcAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "R2OrphanGcService fallo en una iteración. Continúa corriendo.");
                }

                try
                {
                    await Task.Delay(interval, stoppingToken);
                }
                catch (TaskCanceledException) { return; }
            }
        }

        private async Task EjecutarGcAsync(CancellationToken ct)
        {
            using var scope = _serviceProvider.CreateScope();
            var r2 = scope.ServiceProvider.GetRequiredService<IR2StorageServicio>();
            var repoImagenes = scope.ServiceProvider.GetRequiredService<IProductoImagenRepositorio>();

            var prefijo = _opts.Prefijo;
            var keysEnR2 = await r2.ListarKeysAsync(prefijo);
            var keysEnBd = await repoImagenes.GetAllActiveKeysAsync();

            var huerfanos = keysEnR2
                .Where(k => !keysEnBd.Contains(k))
                .ToList();

            if (huerfanos.Count == 0)
            {
                _logger.LogDebug("R2OrphanGcService: 0 huérfanos. {Count} objetos escaneados.", keysEnR2.Count);
                return;
            }

            _logger.LogInformation("R2OrphanGcService: {Count} huérfanos encontrados de {Total} objetos en '{Prefijo}'",
                huerfanos.Count, keysEnR2.Count, prefijo);

            foreach (var key in huerfanos)
            {
                if (ct.IsCancellationRequested) break;
                await r2.EliminarAsync(key);
            }
        }
    }
}
