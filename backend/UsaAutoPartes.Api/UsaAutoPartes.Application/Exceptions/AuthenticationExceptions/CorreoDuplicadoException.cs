namespace UsaAutoPartes.Application.Exceptions.AuthenticationExceptions
{
    /// <summary>
    /// Se lanza cuando el usuario intenta cambiar su correo a uno que ya está
    /// registrado por otra cuenta.
    /// </summary>
    public class CorreoDuplicadoException(string email) : Exception($"El correo {email} ya está registrado por otro usuario.");
}
