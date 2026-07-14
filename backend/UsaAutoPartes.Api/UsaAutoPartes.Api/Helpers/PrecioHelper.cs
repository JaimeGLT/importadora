namespace UsaAutoPartes.Api.Helpers;

public static class PrecioHelper
{
    /// <summary>
    /// Calcula el precio de venta aplicando un margen sobre el costo (ya convertido a BS).
    /// Redondea hacia arriba a 2 decimales.
    /// </summary>
    public static decimal CalcularPrecioConMargen(decimal costoTotalBs, decimal margenValor)
        => Math.Ceiling(costoTotalBs * margenValor * 100) / 100;
}
