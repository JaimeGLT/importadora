using System.Drawing;
using System.Text.Json;
using Anthropic;
using Anthropic.Models.Messages;
using ExcelDataReader;
using ImageMagick;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using UsaAutoPartes.Application.IServicios;

namespace UsaAutoPartes.Infrastructure.Servicios.Processors
{
    public class FacturaExtractorServicio : IFacturaExtractorServicio
    {
        private readonly AnthropicClient _claude;

        // Registrado una sola vez por proceso (constructor estático): RegisterProvider
        // tira InvalidOperationException si se llama más de una vez, y este servicio
        // se instancia por request/scope.
        static FacturaExtractorServicio()
        {
            System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
        }

        public FacturaExtractorServicio(IConfiguration config)
        {
            ExcelPackage.License.SetNonCommercialOrganization("UsaAutoPartes");
            var apiKey = config["IA:ClaudeApiKey"]
                ?? throw new InvalidOperationException("Falta IA:ClaudeApiKey en la configuración.");
            _claude = new AnthropicClient
            {
                ApiKey  = apiKey,
                Timeout = TimeSpan.FromMinutes(20)
            };
        }

        // ── ENTRY POINT ──────────────────────────────────────────────────────

        public async Task<byte[]> ExtraerProductosAsync(List<ArchivoFactura> archivos)
        {
            if (archivos == null || archivos.Count == 0)
                throw new InvalidOperationException("Debe enviar al menos un archivo.");

            // Una sola lista de content blocks para una sola llamada a Claude,
            // así arma una tabla coherente cuando los archivos son páginas/fotos
            // de la misma factura.
            var content = new List<ContentBlockParam>();

            foreach (var archivo in archivos)
            {
                var ext   = Path.GetExtension(archivo.FileName).ToLower();
                var bytes = LeerStreamComoBytes(archivo.Stream);

                switch (ext)
                {
                    case ".pdf":
                        content.AddRange(BuildPdfContent(bytes));
                        break;

                    case ".xlsx":
                    case ".xls":
                        // No confiar en la extensión del archivo: proveedores/ERPs
                        // a veces exportan .xls que en realidad son OOXML (zip), o
                        // .xlsx que en realidad son binarios legacy renombrados.
                        // Se detecta el formato real por los primeros bytes:
                        // ZIP (OOXML/.xlsx real) → EPPlus; OLE2 (BIFF8/.xls real) →
                        // ExcelDataReader. Si no matchea ninguno, error claro en vez
                        // de dejar que EPPlus tire "Invalid or unsupported encryption"
                        // (su mensaje genérico para cualquier stream no-ZIP).
                        content.AddRange(BuildExcelContent(
                            EsFormatoOoxml(bytes)
                                ? LeerExcel(new MemoryStream(bytes))
                                : EsFormatoOle2(bytes)
                                    ? LeerXls(new MemoryStream(bytes))
                                    : throw new InvalidOperationException(
                                        $"El archivo '{archivo.FileName}' no es un Excel válido (ni .xlsx ni .xls reconocible).")));
                        break;

                    case ".jpg":
                    case ".jpeg":
                    case ".png":
                    case ".gif":
                    case ".webp":
                    case ".heic":
                    case ".heif":
                        // HEIC/HEIF se convierten primero a JPEG con auto-orient
                        // aplicado a los píxeles. Después TODAS las imágenes pasan
                        // por EnsureImageUnderLimit, que reduce iterativamente la
                        // calidad JPEG si la imagen supera 5 MB (límite inline de
                        // Anthropic). AutoOrient va ANTES de cualquier compresión:
                        // redimensionar una imagen todavía rotada aplica la
                        // reducción sobre píxeles no orientados.
                        var rawImageBytes = (ext is ".heic" or ".heif")
                            ? ConvertirHeicAJpeg(bytes)
                            : bytes;
                        var safeImageBytes = EnsureImageUnderLimit(rawImageBytes);
                        content.AddRange(BuildImageContent(safeImageBytes, ".jpg"));
                        break;

                    default:
                        throw new InvalidOperationException(
                            $"Formato no soportado: '{ext}' en archivo '{archivo.FileName}'. " +
                            "Permitidos: .xlsx, .xls, .pdf, .jpg, .jpeg, .png, .gif, .webp, .heic, .heif");
                }
            }

            var jsonRespuesta    = await LlamarClaudeAsync(content);
            var (headers, rows) = ParsearRespuesta(jsonRespuesta);
            return GenerarExcel(headers, rows);
        }

        // ── EXCEL ─────────────────────────────────────────────────────────────

        private static readonly byte[] FirmaZip  = [0x50, 0x4B, 0x03, 0x04];
        private static readonly byte[] FirmaOle2 = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

        private static bool TieneFirma(byte[] bytes, byte[] firma) =>
            bytes.Length >= firma.Length && bytes.AsSpan(0, firma.Length).SequenceEqual(firma);

        private static bool EsFormatoOoxml(byte[] bytes) => TieneFirma(bytes, FirmaZip);
        private static bool EsFormatoOle2(byte[] bytes)  => TieneFirma(bytes, FirmaOle2);

        // Lee TODAS las hojas visibles del workbook, no solo la primera. Facturas
        // reales suelen traer varias pestañas (ej: "COVER" con datos de la
        // empresa, "Packing Slip", "INVOICE" con la tabla de productos real) y
        // la pestaña con la tabla no siempre es la primera en el índice de
        // EPPlus. Antes se leía solo Worksheets[0], que en esos casos agarraba
        // la portada (casi sin datos tabulares) y Claude recibía un payload
        // vacío/basura, devolviendo una respuesta degenerada. Ahora se manda
        // todo y el prompt (reglas 1-4) ya sabe encontrar la fila de headers
        // real e ignorar filas que no son de producto.
        private static List<(string Hoja, List<List<string?>> Filas)> LeerExcel(Stream stream)
        {
            var hojas = new List<(string, List<List<string?>>)>();
            using var package = new ExcelPackage(stream);

            foreach (var ws in package.Workbook.Worksheets)
            {
                if (ws.Hidden != eWorkSheetHidden.Visible) continue;
                if (ws.Dimension == null) continue;

                var filas = new List<List<string?>>();
                for (int row = 1; row <= ws.Dimension.End.Row; row++)
                {
                    var fila = new List<string?>();
                    for (int col = 1; col <= ws.Dimension.End.Column; col++)
                    {
                        var val = ws.Cells[row, col].Value;
                        fila.Add(val?.ToString()?.Replace("\n", " ").Replace("\r", " "));
                    }
                    filas.Add(fila);
                }

                if (filas.Any(f => f.Any(c => !string.IsNullOrWhiteSpace(c))))
                    hojas.Add((ws.Name, filas));
            }
            return hojas;
        }

        // Lector para .xls legacy (Excel 97-2003, formato binario BIFF8 sobre
        // OLE Compound File). EPPlus no soporta este formato — solo OOXML (.xlsx).
        private static List<(string Hoja, List<List<string?>> Filas)> LeerXls(Stream stream)
        {
            var hojas = new List<(string, List<List<string?>>)>();
            using var reader = ExcelReaderFactory.CreateReader(stream);

            do
            {
                var filas = new List<List<string?>>();
                while (reader.Read())
                {
                    var fila = new List<string?>();
                    for (int col = 0; col < reader.FieldCount; col++)
                    {
                        var val = reader.IsDBNull(col) ? null : reader.GetValue(col);
                        fila.Add(val?.ToString()?.Replace("\n", " ").Replace("\r", " "));
                    }
                    filas.Add(fila);
                }

                if (filas.Any(f => f.Any(c => !string.IsNullOrWhiteSpace(c))))
                    hojas.Add((reader.Name, filas));
            }
            while (reader.NextResult());

            return hojas;
        }

        private static List<ContentBlockParam> BuildExcelContent(List<(string Hoja, List<List<string?>> Filas)> hojas)
        {
            var bloques = new List<ContentBlockParam>();

            foreach (var (nombreHoja, filas) in hojas)
            {
                // Descarta filas completamente vacías (separadores/spacers del Excel)
                // ANTES de serializar. Una fila es "vacía" si TODAS sus celdas son
                // null/empty/whitespace. No es lo mismo que "alguna celda vacía" —
                // las filas de productos reales tienen código y precio, las separadoras
                // no tienen contenido en ninguna celda. Esto evita inflar el payload
                // a Claude con filas basura que no aportan señal.
                //
                // No se aplica Take(N): una factura real puede tener 100-500 líneas
                // y truncar el input causaba pérdida silenciosa de productos. Ahora
                // se envía todo; si la salida resultante supera MaxTokens, el check
                // de stop_reason en LlamarClaudeAsync lo detecta y falla limpio.
                var filasReales = filas
                    .Where(f => f.Any(c => !string.IsNullOrWhiteSpace(c)))
                    .ToList();

                var muestra = filasReales
                    .Select((fila, i) => new {
                        fila   = i + 1,
                        celdas = fila.Select(c => c?.Length > 120 ? c[..120] : (c ?? "")).ToList()
                    })
                    .ToList();

                int nColumnas = muestra.Count > 0 ? muestra.Max(m => m.celdas.Count) : 0;

                var texto = $"""
                    Hoja "{nombreHoja}" del Excel de factura de proveedor. Tiene {nColumnas} columnas y {muestra.Count} filas con contenido.
                    Puede ser portada, packing list, o la tabla de productos real — evaluá el contenido para decidir cuál usar.

                    Filas de esta hoja (número de fila + array de celdas):
                    {JsonConvert.SerializeObject(muestra)}
                    """;

                bloques.Add(new ContentBlockParam(new TextBlockParam(texto)));
            }

            bloques.Add(new ContentBlockParam(new TextBlockParam(
                "Este Excel tiene varias hojas mostradas arriba. Encontrá la que contiene la tabla real de productos " +
                "(código/parte + cantidad/precio) y extraé de ahí. Ignorá hojas de portada o packing list sin precios, " +
                "salvo que sean la única fuente de algún dato complementario (ej: proveedor, procedencia)."
            )));

            return bloques;
        }

        // ── PDF ────────────────────────────────────────────────────────────────

        private static byte[] LeerStreamComoBytes(Stream stream)
        {
            using var ms = new MemoryStream();
            stream.CopyTo(ms);
            return ms.ToArray();
        }

        private static List<ContentBlockParam> BuildPdfContent(byte[] pdfBytes)
        {
            var b64 = Convert.ToBase64String(pdfBytes);
            return
            [
                new ContentBlockParam(new DocumentBlockParam(new Base64PdfSource { Data = b64 })),
                new ContentBlockParam(new TextBlockParam("Analizá este PDF de factura de proveedor y extraé la tabla de productos."))
            ];
        }

        // ── IMAGEN ────────────────────────────────────────────────────────────

        private static List<ContentBlockParam> BuildImageContent(byte[] imageBytes, string ext)
        {
            var b64   = Convert.ToBase64String(imageBytes);
            var media = ext switch
            {
                ".jpg" or ".jpeg" => MediaType.ImageJpeg,
                ".png"            => MediaType.ImagePng,
                ".gif"            => MediaType.ImageGif,
                ".webp"           => MediaType.ImageWebP,
                _                 => throw new InvalidOperationException($"Extensión de imagen no soportada: {ext}")
            };

            return
            [
                new ContentBlockParam(new ImageBlockParam(new Base64ImageSource
                {
                    Data      = b64,
                    MediaType = media
                })),
                new ContentBlockParam(new TextBlockParam("Analizá esta imagen de factura de proveedor y extraé la tabla de productos."))
            ];
        }

        // ── HEIC → JPEG ───────────────────────────────────────────────────────

        private static byte[] ConvertirHeicAJpeg(byte[] heicBytes)
        {
            try
            {
                using var image = new MagickImage(heicBytes);
                // AutoOrient ANTES de re-encodear: aplica la rotación EXIF a los
                // píxeles. Sin esto, las fotos de iPhone en vertical salen rotadas
                // en el output de Claude. Strip() elimina metadata (incluida la
                // orientación ya aplicada) para no repetir bytes innecesarios.
                image.AutoOrient();
                image.Format = MagickFormat.Jpeg;
                image.Quality = 90;
                image.Strip();

                using var output = new MemoryStream();
                image.Write(output);
                return output.ToArray();
            }
            catch (MagickException ex)
            {
                throw new InvalidOperationException(
                    $"No se pudo convertir el archivo HEIC a JPEG. ¿Está corrupto? Detalle: {ex.Message}", ex);
            }
        }

        // ── IMAGE SIZE CAP (5 MB inline de Anthropic) ─────────────────────────

        private const long MaxInlineImageBytes = 5L * 1024 * 1024; // 5 MB

        // Una foto de iPhone Pro sale de 8-12 MB; la API de Anthropic rechaza
        // imágenes inline > 5 MB. Reducir a 5 MB con un resize lineal de
        // dimensiones degrada la lectura de texto chico (códigos de parte,
        // precios), que es justo lo que necesitamos que Claude lea. Por eso el
        // algoritmo es:
        //   1) AutoOrient (si la imagen trae EXIF rotado)
        //   2) Iterar Quality = 90 → 80 → 70 → 60 → 50 (JPEG)
        //   3) Recién si con Quality=50 sigue arriba de 5 MB, bajar dimensiones
        //      a max 2048 px preservando aspect ratio
        //   4) Si ni así entra, error claro (no explosión silenciosa)
        private static byte[] EnsureImageUnderLimit(byte[] imageBytes)
        {
            if (imageBytes.Length <= MaxInlineImageBytes)
                return imageBytes;

            using var image = new MagickImage(imageBytes);
            image.AutoOrient();
            image.Strip();

            int[] qualitySteps = { 90, 80, 70, 60, 50 };
            foreach (int q in qualitySteps)
            {
                image.Format = MagickFormat.Jpeg;
                image.Quality = (uint)q;

                using var ms = new MemoryStream();
                image.Write(ms);
                var compressed = ms.ToArray();

                if (compressed.Length <= MaxInlineImageBytes)
                    return compressed;
            }

            // Último recurso: reducir dimensiones. 2048 px cubre el ancho
            // suficiente para que Claude lea texto chico en facturas A4.
            image.Resize(new MagickGeometry(2048, 2048) { IgnoreAspectRatio = false });
            image.Quality = 50;
            image.Strip();
            using var finalMs = new MemoryStream();
            image.Write(finalMs);
            var finalBytes = finalMs.ToArray();

            if (finalBytes.Length > MaxInlineImageBytes)
            {
                throw new InvalidOperationException(
                    $"La imagen es demasiado grande incluso después de comprimirla. " +
                    $"Tamaño original: {imageBytes.Length / 1024.0 / 1024.0:F2} MB, " +
                    $"comprimido: {finalBytes.Length / 1024.0 / 1024.0:F2} MB. " +
                    $"Capturá la foto con menor resolución o en formato JPEG estándar."
                );
            }

            return finalBytes;
        }

        // ── CLAUDE API ────────────────────────────────────────────────────────

        private const string SystemPrompt = """
            Sos un experto en extraer datos de facturas de importación de proveedores extranjeros.

            TAREA: Extraé SOLO la tabla de productos/items del documento.

            REGLAS CRÍTICAS:
            1. Encontrá la fila que contiene los nombres de columna reales. Puede estar en cualquier idioma (inglés, español, chino, portugués).
            2. IGNORÁ columnas completamente vacías (spacers). Incluí en headers SOLO las columnas que tienen al menos un valor en las filas de producto.
            3. Si el documento tiene múltiples páginas, los headers pueden repetirse. Usá SOLO el primer set de headers.
            4. Extraé ÚNICAMENTE filas de productos reales. Una fila es producto si tiene: código/referencia + al menos un número (cantidad o precio). Descripción es opcional — algunos proveedores solo ponen código y precio.
            5. IGNORÁ completamente: nombre de empresa, dirección, datos de envío, teléfonos, totales, subtotales, notas de pago, datos bancarios, filas vacías, footers, balance due, términos de pago, filas de pallets/embalaje.
            6. Limpiá valores numéricos:
            - Precios: "$ 18.47" → "18.47", "18,47 USD" → "18.47", "$ 1,490.00" → "1490.00"
            - Eliminá separadores de miles: "1,490.00" → "1490.00"
            - Eliminá saltos de línea dentro de celdas
            - NO recalculés ni redondeés — transcribí el valor tal cual, limpio de símbolos.
            7. Si hay filas duplicadas (por saltos de página), deduplicá.
            8. Cada fila debe tener EXACTAMENTE la misma cantidad de valores que columnas en headers. Celda vacía → "".

            9. PROVEEDOR: Buscá el nombre del proveedor/empresa emisora en el encabezado ("Vendor:", "Supplier:", "From:", nombre de empresa, etc.).
            - Si lo encontrás con certeza, agregá columna "Proveedor" con ese valor repetido en cada fila.
            - Si no estás seguro, no agregues la columna.

            10. NOMBRE Y DESCRIPCIÓN:
                - Si el documento ya tiene columnas SEPARADAS para nombre corto (ej: "Line", "Type", "Tipo") y descripción larga: respetá ambas columnas tal cual, sin modificar ni fusionar.
                - Si hay UNA SOLA columna que mezcla nombre corto + descripción técnica larga (vehículos, motores, años, medidas): separala en dos columnas: "Nombre" con las primeras 2-4 palabras que identifican el tipo de parte (ej: "METAL DE BIELA", "METALES DE CENTRO", "TIMING CHAIN KIT") y "Descripción" con el resto. El corte va antes del primer vehículo compatible, marca de vehículo, medida de motor o especificación técnica.
                - Si no hay descripción de texto (solo código y precio): no crees columna Nombre ni Descripción vacías.

            11. MARCA: Agregá columna "Marca" SOLO si la marca del fabricante de la PARTE viene explícita:
                - En el encabezado del documento con etiqueta clara (ej: "Brand: CIC", "Marca: BOSCH").
                - O en una columna propia de la tabla.
                - NUNCA extraigas marca de nombres de vehículos compatibles (Ford, Chrysler, Nissan, Jeep, etc.) — esos son vehículos, no marcas de la parte.
                - Si la marca está en el encabezado, repetila en cada fila de producto.

            12. PROCEDENCIA: Agregá columna "Procedencia" en estos casos:
                - Si hay una columna por producto con país de origen (ej: "Origen", "COO", "Country of Origin"): incluila tal cual, expandiendo códigos ISO de 2 letras a nombre completo del país (CN→China, MX→Mexico, IN→India, US→USA, TR→Turquía, BR→Brasil, AR→Argentina, TW→Taiwán, IT→Italia, DE→Alemania, JP→Japón, KR→Corea del Sur).
                - Si hay un dato de procedencia único para todo el documento (ej: "FROM: NINGBO, CHINA", "Made in China", "Origin: USA"): extraé el país y repetilo en cada fila.
                - La dirección o ciudad del EMISOR/VENDEDOR NO es procedencia de la mercancía.
                - Si no hay procedencia explícita de la mercancía, no crees la columna.

            13. MÚLTIPLES ARCHIVOS: Vas a recibir varios archivos en un mismo mensaje
                (mezcla de PDF, Excel, e imágenes). Todos corresponden a UNA SOLA factura
                del mismo proveedor. Tratá el conjunto como un solo documento continuo
                y producía una sola tabla unificada.

            14. IMÁGENES MÚLTIPLES: Si recibís varias imágenes, son PÁGINAS O FOTOS de
                la misma factura (NO facturas distintas). El orden de envío puede NO
                ser el orden de las páginas. Tu trabajo es reconstruir la tabla
                completa uniendo la información de todas las imágenes, deduplicando
                encabezados repetidos y concatenando las filas de productos de cada
                página en orden lógico.

            15. DEDUPLICACIÓN AGRESIVA: Con fotos de celular hay más repetición de
                encabezados entre páginas, sombras, dedos en la esquina, y filas
                cortadas. Aplicá la regla 7 con más agresividad: si dos filas tienen
                los mismos valores en columnas clave (código + descripción + cantidad),
                son la misma fila, descartá la duplicada.
            """;

        private static readonly Dictionary<string, JsonElement> _outputSchema =
            System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, JsonElement>>("""
                {
                    "type": "object",
                    "properties": {
                        "headers": { "type": "array", "items": { "type": "string" } },
                        "rows": {
                            "type": "array",
                            "items": { "type": "array", "items": { "type": "string" } }
                        }
                    },
                    "required": ["headers", "rows"],
                    "additionalProperties": false
                }
                """)!;

        private async Task<string> LlamarClaudeAsync(List<ContentBlockParam> content)
        {
            var response = await _claude.Messages.Create(new MessageCreateParams
            {
                Model     = "claude-sonnet-4-6",
                MaxTokens = 32_768,
                System    = new MessageCreateParamsSystem(new List<TextBlockParam>
                {
                    new TextBlockParam
                    {
                        Text         = SystemPrompt,
                        CacheControl = new CacheControlEphemeral()
                    }
                }),
                OutputConfig = new OutputConfig
                {
                    Format = new JsonOutputFormat { Schema = _outputSchema }
                },
                Messages =
                [
                    new()
                    {
                        Role    = Role.User,
                        Content = new MessageParamContent(content)
                    }
                ]
            });

            // Detección de truncamiento: stop_reason="max_tokens" indica que la
            // respuesta fue cortada por el techo de tokens. Sin este check,
            // ParsearRespuesta o explota con JSON parse error o, peor, parsea
            // un JSON parcial sin error y devuelve Excel con datos incompletos.
            if (response.StopReason?.Raw() == "max_tokens")
            {
                throw new InvalidOperationException(
                    "La factura es demasiado grande para procesarse en una sola pasada. " +
                    "Si subiste varios archivos juntos, intentá procesarlos en dos tandas separadas y combinar los resultados manualmente. " +
                    "Si el problema persiste, contactá a soporte."
                );
            }

            foreach (var block in response.Content)
            {
                if (block.TryPickText(out var textBlock))
                    return textBlock.Text;
            }

            throw new Exception("Claude no devolvió contenido de texto.");
        }

        // ── PARSEAR RESPUESTA ────────────────────────────────────────────────

        private static (List<string> Headers, List<List<string>> Rows) ParsearRespuesta(string json)
        {
            var jObj = JObject.Parse(json);

            if (jObj["headers"] == null || jObj["rows"] == null)
                throw new Exception($"JSON sin 'headers' o 'rows'. Claves: {string.Join(", ", jObj.Properties().Select(p => p.Name))}");

            var headers = jObj["headers"]!.Values<string>().Select(h => h ?? "").ToList();
            var rows    = jObj["rows"]!
                .Select(r => r.Values<string>().Select(v => v ?? "").ToList())
                .ToList();

            int n = headers.Count;
            var rowsNorm = rows.Select(fila =>
            {
                if (fila.Count < n) fila.AddRange(Enumerable.Repeat("", n - fila.Count));
                if (fila.Count > n) fila = fila.Take(n).ToList();
                return fila;
            }).ToList();

            return (headers, rowsNorm);
        }

        // ── GENERAR EXCEL LIMPIO ─────────────────────────────────────────────

        private static byte[] GenerarExcel(List<string> headers, List<List<string>> rows)
        {
            if (headers.Count == 0)
                throw new InvalidOperationException(
                    "Claude no pudo identificar una tabla de productos en los archivos enviados.");

            using var package = new ExcelPackage();
            var ws = package.Workbook.Worksheets.Add("Productos");

            for (int i = 0; i < headers.Count; i++)
            {
                var cell = ws.Cells[1, i + 1];
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Font.Name = "Arial";
                cell.Style.Font.Size = 10;
                cell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                cell.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(217, 217, 217));
                cell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
            }

            for (int r = 0; r < rows.Count; r++)
            {
                for (int c = 0; c < rows[r].Count; c++)
                {
                    var cell = ws.Cells[r + 2, c + 1];
                    cell.Value = rows[r][c];
                    cell.Style.Font.Name = "Arial";
                    cell.Style.Font.Size = 10;
                }
            }

            ws.Cells[ws.Dimension.Address].AutoFitColumns(8, 60);
            return package.GetAsByteArray();
        }
    }
}
