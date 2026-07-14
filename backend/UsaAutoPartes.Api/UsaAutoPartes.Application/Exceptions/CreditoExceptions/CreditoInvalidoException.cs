namespace UsaAutoPartes.Application.Exceptions.CreditoExceptions
{
    /// <summary>Se lanza cuando el crédito no admite la operación solicitada (ya pagado, cancelado, monto inválido, etc.).</summary>
    public class CreditoInvalidoException(string message) : Exception(message);
}
