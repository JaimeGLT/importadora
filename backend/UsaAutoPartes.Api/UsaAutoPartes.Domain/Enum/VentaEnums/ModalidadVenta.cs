namespace UsaAutoPartes.Domain.Enum.VentaEnums
{
    /// <summary>
    /// Modalidad de la orden de venta. Determina si la venta sigue el flujo
    /// completo (cajero → almacenero → escaneo → cobro) o si es un atajo
    /// directo desde el carrito. Usado para filtrar reportes y comisiones.
    /// </summary>
    public static class ModalidadVenta
    {
        /// <summary>Flujo normal: cajero → almacenero → escaneo → cobro.</summary>
        public const string Normal = "Normal";

        /// <summary>Atajo: cajero cobra directo sin pasar por almacén. Stock se descuenta de inmediato.</summary>
        public const string RapidaContado = "RapidaContado";

        /// <summary>Atajo: cajero registra crédito directo sin pasar por almacén. Stock se descuenta de inmediato.</summary>
        public const string RapidaCredito = "RapidaCredito";
    }
}
