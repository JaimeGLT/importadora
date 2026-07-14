namespace UsaAutoPartes.Application.Exceptions.AuthenticationExceptions
{
    /// <summary>
    /// Se lanza cuando un usuario marcado como soft-deleted (EliminadoEn != null)
    /// intenta iniciar sesión o refrescar su token. Sus datos transaccionales
    /// (ventas, créditos, cajas) siguen existiendo en la BD para auditoría.
    /// </summary>
    public class UsuarioEliminadoException() : Exception("Esta cuenta fue eliminada. Contacta al administrador.");
}
