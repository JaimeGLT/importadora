using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Net;
using UsaAutoPartes.Application.Exceptions.AuthenticationExceptions;
using UsaAutoPartes.Application.Exceptions.Autentication;
using UsaAutoPartes.Application.Exceptions.DataBaseException;
using UsaAutoPartes.Application.Exceptions.GenericExceptions;
using UsaAutoPartes.Application.Exceptions.ImagenExceptions;
using UsaAutoPartes.Domain.Entities.IdentityDb;

namespace UsaAutoPartes.Api.Handlers
{
    public class GlobalHandler : IExceptionHandler
    {
        private readonly ILogger<GlobalHandler> _logger;
        public GlobalHandler(ILogger<GlobalHandler> logger)
        {
            _logger = logger;
        }
        public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
        {
            if (exception is DbUpdateException dbEx)
            {
                var pgEx = FindPostgresException(dbEx);
                if (pgEx is not null)
                {
                    exception = pgEx.SqlState switch
                    {
                        "23505" => new UniqueConstraintException(ResolverUnico(pgEx.ConstraintName)),
                        "23503" => new ForeignKeyException(ResolverFK(pgEx.ConstraintName, pgEx.MessageText)),
                        _ => exception
                    };
                }
            }

            var (statuscode, message) = GetExceptionDetails(exception);

            _logger.LogError(exception, exception.Message);

            httpContext.Response.StatusCode = (int)statuscode;
            await httpContext.Response.WriteAsJsonAsync(new { message = message }, cancellationToken);
    
            return true;
        }

        private (HttpStatusCode statusCode, string message) GetExceptionDetails(Exception exception)
        {
            return exception switch
            {
                LoginFailException => (HttpStatusCode.Unauthorized, exception.Message),
                UsuarioDesactivadoException => (HttpStatusCode.Forbidden, exception.Message),
                UsuarioEliminadoException => (HttpStatusCode.Forbidden, exception.Message),
                RefreshTokenFailException => (HttpStatusCode.BadRequest, exception.Message),
                RegistroTransaccionFailException => (HttpStatusCode.BadRequest, exception.Message),
                UsuarioExisteException => (HttpStatusCode.Conflict, exception.Message),
                EntidadNoEncontradaException => (HttpStatusCode.NotFound, exception.Message),
                StockInsuficienteException => (HttpStatusCode.Conflict, exception.Message),
                UniqueConstraintException => (HttpStatusCode.Conflict, exception.Message),
                ForeignKeyException => (HttpStatusCode.BadRequest, exception.Message),
                PasswordIncorrectaException => (HttpStatusCode.BadRequest, exception.Message),
                CorreoDuplicadoException => (HttpStatusCode.Conflict, exception.Message),
                EliminarUsuarioInvalidoException => (HttpStatusCode.BadRequest, exception.Message),
                ImagenLimiteExcedidoException => (HttpStatusCode.BadRequest, exception.Message),
                ImagenTamanoExcedidoException => (HttpStatusCode.BadRequest, exception.Message),
                ImagenTipoInvalidoException => (HttpStatusCode.BadRequest, exception.Message),
                DbUpdateConcurrencyException => (HttpStatusCode.Conflict, "El registro fue modificado por otro usuario. Recargue la pantalla e intente de nuevo."),
                DbUpdateException dbUpdate => (HttpStatusCode.InternalServerError, ResolverDbUpdate(dbUpdate)),
                _ => (HttpStatusCode.InternalServerError, $"Ocurrio un error inesperado. {exception.Message}")
            };
        }

        private string ResolverDbUpdate(DbUpdateException dbEx)
        {
            var pgEx = FindPostgresException(dbEx);
            if (pgEx is not null)
            {
                return pgEx.SqlState switch
                {
                    "23502" => "Faltan datos obligatorios para guardar el registro.",
                    "22001" => "Uno de los campos supera la longitud máxima permitida.",
                    "42703" => "La base de datos no está actualizada. Ejecute las migraciones pendientes.",
                    _ => $"Error al guardar en base de datos: {pgEx.MessageText}"
                };
            }

            if (dbEx.InnerException is not null)
                return $"Error al guardar: {dbEx.InnerException.Message}";

            return $"Ocurrio un error inesperado. {dbEx.Message}";
        }

        private string ResolverUnico(string? constraintName)
        {
            return constraintName switch
            {
                "IX_Producto_Codigo_SinMarca" => "El código ya existe.",
                "IX_Producto_Codigo_Marca" => "El código ya existe para esa marca.",

                "IX_Importacion_Codigo" => "El código de importación ya existe.",
                "IX_Proveedor_Nombre" => "El nombre del proveedor ya existe.",
                "IX_Usuario_Email_EliminadoEn" => "El email del usuario ya existe.",
                "IX_Usuario_UserName_EliminadoEn" => "El nombre de usuario ya existe.",
                "UserNameIndex" => "El nombre de usuario ya está en uso.",
                "Id_nombre_descuento" => "El nombre de descuento ya existe",

                "IX_PiezaKit_Producto_Orden" => "Ya existe una pieza con ese orden en el kit. Reintenta la operación.",
                "IX_PiezaKit_Producto_CodigoPieza" => "Ya existe una pieza con ese código en el kit.",

                "IX_ProductoImagen_LlaveObjeto" => "Esta imagen ya fue registrada (key duplicada). Reintenta con un archivo nuevo.",
                "IX_ProductoImagen_Producto_Orden" => "Conflicto de orden en la galería. Reintenta la operación.",
                "IX_ProductoImagen_Producto_Principal" => "Conflicto al cambiar la imagen principal. Otro usuario modificó la galería. Recargue e intente de nuevo.",
                _ => "Ya existe un registro con esos datos."
            };
        }

        private string ResolverFK(string? constraintName, string? messageText)
        {
            bool esInsercion = (messageText?.Contains("insert or update") ?? false)
                            || (messageText?.Contains("insertar o actualizar") ?? false)
                            || (messageText?.Contains("inserción") ?? false);

            return esInsercion
                ? ResolverFK_Insercion(constraintName)
                : ResolverFK_Eliminacion(constraintName);
        }

        private string ResolverFK_Insercion(string? constraintName)
        {
            return constraintName switch
            {
                "FK_HistorialPrecio_Producto" => "Producto no encontrado para el historial",
                "FK_Importacion_Proveedor" => "El proveedor seleccionado no existe.",
                "FK_MovimientoCaja_Caja" => "La caja no existe.",
                "FK_PiezaKit_Producto" => "El producto no existe.",
                "FK_AjusteStock_Producto" => "El producto no existe.",
                "FK_AjusteStock_Usuario" => "El usuario no existe.",
                _ => "El registro relacionado no existe."
            };
        }

        private static PostgresException? FindPostgresException(Exception ex)
        {
            var current = ex as Exception;
            while (current is not null)
            {
                if (current is PostgresException pg) return pg;
                current = current.InnerException;
            }
            return null;
        }

        private string ResolverFK_Eliminacion(string? constraintName)
        {
            return constraintName switch
            {
                "FK_Importacion_Proveedor" => "Este proveedor tiene importaciones y no puede eliminarse.",
                _ => "El registro pertenece a otro y no puede eliminarse."
            };
        }
    }
}
