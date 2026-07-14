using Microsoft.AspNetCore.Mvc;
using UsaAutoPartes.Application.IServicios;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FacturaController(
        IFacturaJobStore _jobStore,
        IFacturaTrabajoQueue _queue
    ) : ControllerBase
    {
        private const int MaxArchivos         = 10;
        private const long MaxBytesPorArchivo = 20L * 1024 * 1024; // 20 MB

        private static readonly HashSet<string> ExtensionesPermitidas = new(StringComparer.OrdinalIgnoreCase)
        {
            ".xlsx", ".xls", ".pdf",
            ".jpg", ".jpeg", ".png", ".gif", ".webp",
            ".heic", ".heif"
        };

        // Encola el trabajo y responde de inmediato con el jobId. El procesamiento
        // real (llamada a Claude, que puede tardar minutos con PDFs largos) corre
        // en background — así el request HTTP no queda abierto esperando y el
        // proxy de Railway no lo corta con un 502 por timeout.
        [HttpPost("extraer")]
        public async Task<IActionResult> Extraer([FromForm] List<IFormFile> files)
        {
            if (files == null || files.Count == 0)
                return BadRequest(new { error = "No se recibieron archivos." });

            if (files.Count > MaxArchivos)
                return BadRequest(new
                {
                    error = $"Máximo {MaxArchivos} archivos por request (recibidos: {files.Count})."
                });

            foreach (var f in files)
            {
                if (f.Length == 0)
                    return BadRequest(new { error = $"El archivo '{f.FileName}' está vacío." });

                if (f.Length > MaxBytesPorArchivo)
                    return BadRequest(new
                    {
                        error = $"El archivo '{f.FileName}' excede el máximo de {MaxBytesPorArchivo / (1024 * 1024)} MB."
                    });

                var ext = System.IO.Path.GetExtension(f.FileName);
                if (!ExtensionesPermitidas.Contains(ext))
                    return BadRequest(new
                    {
                        error = $"Formato no soportado: '{ext}' en archivo '{f.FileName}'."
                    });
            }

            var archivos = new List<ArchivoFacturaBytes>();
            foreach (var f in files)
            {
                using var ms = new MemoryStream();
                await f.CopyToAsync(ms);
                archivos.Add(new ArchivoFacturaBytes(ms.ToArray(), f.FileName));
            }

            var jobId = _jobStore.Crear();
            _queue.Encolar(new FacturaTrabajo(jobId, archivos));

            return Accepted(new { jobId });
        }

        [HttpGet("extraer/{id:guid}/estado")]
        public IActionResult Estado(Guid id)
        {
            var job = _jobStore.Obtener(id);
            if (job == null)
                return NotFound(new { error = "Job no encontrado o expirado." });

            return Ok(new { estado = job.Estado.ToString(), error = job.Error });
        }

        [HttpGet("extraer/{id:guid}/resultado")]
        public IActionResult Resultado(Guid id)
        {
            var job = _jobStore.Obtener(id);
            if (job == null)
                return NotFound(new { error = "Job no encontrado o expirado." });

            if (job.Estado == FacturaJobEstado.Error)
                return UnprocessableEntity(new { error = job.Error });

            if (job.Estado != FacturaJobEstado.Completado || job.Resultado == null)
                return Conflict(new { error = "El job todavía no terminó de procesarse." });

            var nombreSalida = $"factura_procesada_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
            return File(
                job.Resultado,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                nombreSalida
            );
        }
    }
}
