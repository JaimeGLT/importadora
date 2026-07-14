namespace UsaAutoPartes.Application.Exceptions.AuthenticationExceptions
{
    /// <summary>
    /// Se lanza cuando un admin intenta eliminar a sí mismo o a otro administrador.
    /// </summary>
    public class EliminarUsuarioInvalidoException(string motivo) : Exception(motivo);
}
