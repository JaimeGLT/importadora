using UsaAutoPartes.Domain.Entities.BasesEntidades;
using UsaAutoPartes.Domain.Enum.VentaEnums;

namespace UsaAutoPartes.Domain.Entities
{
    public class ConfigVenta : BaseEntity
    {
        public string ModoVenta { get; private set; } = Enum.VentaEnums.ModoVenta.Ambos;

        public ConfigVenta() { }

        public ConfigVenta(string modoVenta)
        {
            ModoVenta = modoVenta;
        }

        public void Actualizar(string modoVenta)
        {
            ModoVenta = modoVenta;
        }
    }
}
