namespace UsaAutoPartes.Application.Exceptions.CreditoExceptions
{
    /// <summary>Se lanza cuando dos operaciones concurrentes modifican el mismo crédito (RowVersion mismatch).</summary>
    public class CreditoConcurrenciaException() : Exception("El crédito fue modificado por otro usuario. Recargue la pantalla e intente de nuevo.");
}
