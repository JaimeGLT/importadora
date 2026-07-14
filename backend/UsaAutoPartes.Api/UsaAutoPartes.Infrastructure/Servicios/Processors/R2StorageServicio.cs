using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using UsaAutoPartes.Application.IServicios;

namespace UsaAutoPartes.Infrastructure.Servicios.Processors
{
    /// <summary>
    /// Implementación de <see cref="IR2StorageServicio"/> usando AWSSDK.S3 apuntando a
    /// Cloudflare R2. R2 es S3-compatible pero con algunas particularidades:
    /// <list type="bullet">
    ///   <item><c>ServiceURL</c> fijo a <c>https://{accountId}.r2.cloudflarestorage.com</c></item>
    ///   <item><c>ForcePathStyle = true</c> (R2 no soporta virtual-hosted style)</item>
    ///   <item><c>AuthenticationRegion = "auto"</c> (R2 ignora la región)</item>
    /// </list>
    /// </summary>
    public class R2StorageServicio : IR2StorageServicio
    {
        private readonly IAmazonS3 _s3;
        private readonly CloudflareR2Options _opts;
        private readonly ILogger<R2StorageServicio> _logger;

        public R2StorageServicio(IOptions<CloudflareR2Options> opts, ILogger<R2StorageServicio> logger)
        {
            _opts = opts.Value;
            _logger = logger;

            if (string.IsNullOrWhiteSpace(_opts.AccountId)
                || string.IsNullOrWhiteSpace(_opts.AccessKeyId)
                || string.IsNullOrWhiteSpace(_opts.SecretAccessKey)
                || string.IsNullOrWhiteSpace(_opts.Bucket))
            {
                _logger.LogWarning("R2 no configurado completamente. Las operaciones van a fallar hasta que appsettings.json tenga la sección CloudflareR2 completa.");
            }

            var config = new AmazonS3Config
            {
                ServiceURL = $"https://{_opts.AccountId}.r2.cloudflarestorage.com",
                AuthenticationRegion = "auto",
                ForcePathStyle = true,
                UseHttp = false,
            };

            var credentials = new BasicAWSCredentials(_opts.AccessKeyId, _opts.SecretAccessKey);
            _s3 = new AmazonS3Client(credentials, config);

            _logger.LogInformation("R2 configurado: bucket={Bucket}, baseUrl={BaseUrl}", _opts.Bucket, _opts.PublicBaseUrl);
        }

        public async Task<string> GenerarUrlPresignadaAsync(string llaveObjeto, string contentType, long tamanoBytes)
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _opts.Bucket,
                Key = llaveObjeto,
                Verb = HttpVerb.PUT,
                Expires = DateTime.UtcNow.AddSeconds(_opts.PresignTtlSeconds),
                ContentType = contentType,
                // Forzar Content-Type en la firma para que el cliente deba mandar el mismo
                // al hacer PUT. Sin esto, R2 rechaza con SignatureDoesNotMatch si el cliente
                // manda un Content-Type distinto al que se firmó.
                //
                // NOTA: NO agregamos headers extra a `request.Metadata` (ej. expected-size).
                // Cualquier header que AWSSDK ponga en metadata se incluye automáticamente en
                // `X-Amz-SignedHeaders`, y el cliente (browser) tendría que mandarlo exacto
                // en el PUT. Si no lo manda, R2 calcula una firma distinta y devuelve 403.
                // La validación de tamaño se hace en el controller `/confirmar`, no en R2.
            };

            return await Task.FromResult(_s3.GetPreSignedURL(request));
        }

        public async Task<bool> ExisteAsync(string llaveObjeto)
        {
            try
            {
                var metadata = await _s3.GetObjectMetadataAsync(_opts.Bucket, llaveObjeto);
                return metadata is not null;
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return false;
            }
        }

        public async Task EliminarAsync(string llaveObjeto)
        {
            try
            {
                await _s3.DeleteObjectAsync(_opts.Bucket, llaveObjeto);
                _logger.LogInformation("R2 objeto eliminado: {Key}", llaveObjeto);
            }
            catch (Exception ex)
            {
                // Best-effort: loguear y seguir. El GC o una limpieza manual lo recogerá después.
                _logger.LogWarning(ex, "R2 fallo eliminando objeto {Key}", llaveObjeto);
            }
        }

        public async Task<List<string>> ListarKeysAsync(string prefijo)
        {
            var keys = new List<string>();
            string? continuationToken = null;

            do
            {
                var request = new ListObjectsV2Request
                {
                    BucketName = _opts.Bucket,
                    Prefix = prefijo,
                    ContinuationToken = continuationToken,
                    MaxKeys = 1000,
                };

                var response = await _s3.ListObjectsV2Async(request);
                keys.AddRange(response.S3Objects.Select(o => o.Key));
                continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
            } while (continuationToken is not null);

            return keys;
        }

        public string ConstruirUrlPublica(string llaveObjeto)
        {
            var baseUrl = _opts.PublicBaseUrl.TrimEnd('/');
            return $"{baseUrl}/{llaveObjeto.TrimStart('/')}";
        }
    }
}
