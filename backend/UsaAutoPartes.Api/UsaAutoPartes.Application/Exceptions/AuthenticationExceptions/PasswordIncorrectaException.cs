namespace UsaAutoPartes.Application.Exceptions.AuthenticationExceptions
{
    /// <summary>
    /// Se lanza cuando el usuario intenta cambiar su contraseña pero la contraseña
    /// actual proporcionada no coincide con la almacenada.
    /// </summary>
    public class PasswordIncorrectaException() : Exception("La contraseña actual es incorrecta.");
}
