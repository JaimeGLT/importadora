using Anthropic.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using UsaAutoPartes.Application.IServicios;

namespace UsaAutoPartes.Infrastructure.Servicios.Processors
{
    // Procesa facturas en background para que el request HTTP original
    // (POST /api/factura/extraer) responda 202 casi al instante, sin importar
    // cuánto tarde Claude. Esto evita los 502 de Railway: su proxy corta
    // conexiones HTTP que quedan abiertas esperando respuesta más de cierto
    // tiempo, y un PDF de varias páginas puede tardar minutos.
    public sealed class FacturaProcesadorService(
        IFacturaTrabajoQueue queue,
        IFacturaJobStore jobStore,
        IServiceScopeFactory scopeFactory,
        ILogger<FacturaProcesadorService> logger
    ) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await foreach (var trabajo in queue.DequeueAllAsync(stoppingToken))
            {
                jobStore.MarcarProcesando(trabajo.JobId);

                try
                {
                    // Scope nuevo por trabajo: IFacturaExtractorServicio es Scoped
                    // y el scope del request original ya se cerró para cuando esto corre.
                    using var scope = scopeFactory.CreateScope();
                    var extractor = scope.ServiceProvider.GetRequiredService<IFacturaExtractorServicio>();

                    var archivos = trabajo.Archivos
                        .Select(a => new ArchivoFactura(new MemoryStream(a.Bytes), a.FileName))
                        .ToList();

                    var resultado = await extractor.ExtraerProductosAsync(archivos);
                    jobStore.MarcarCompletado(trabajo.JobId, resultado);
                }
                catch (Exception ex)
                {
                    // ex.Message en las excepciones del SDK de Anthropic (AnthropicApiException
                    // y derivadas, ej. AnthropicBadRequestException) es genérico ("Status Code:
                    // BadRequest") — el detalle real que manda la API (tipo de error, motivo
                    // específico) viene en ResponseBody. Sin esto, un 400 por payload demasiado
                    // grande y un 400 por cualquier otra causa son indistinguibles en los logs.
                    var mensaje = ex is AnthropicApiException apiEx && !string.IsNullOrWhiteSpace(apiEx.ResponseBody)
                        ? $"{ex.Message} — {apiEx.ResponseBody}"
                        : ex.Message;

                    logger.LogError(ex, "Error procesando factura job {JobId}: {Mensaje}", trabajo.JobId, mensaje);
                    jobStore.MarcarError(trabajo.JobId, mensaje);
                }
            }
        }
    }
}
