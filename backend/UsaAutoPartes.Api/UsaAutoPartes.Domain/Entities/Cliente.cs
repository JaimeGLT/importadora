using UsaAutoPartes.Domain.Entities.BasesEntidades;

namespace UsaAutoPartes.Domain.Entities
{
    public class Cliente : BaseEntity
    {
        public string Nombre { get; private set; } = string.Empty;
        public string Apellido { get; private set; } = string.Empty;
        public string Telefono { get; private set; } = string.Empty;
        public string? Direccion { get; private set; }
        public string? CorreoElectronico { get; private set; }

        public Cliente() { }

        public Cliente(string nombre, string apellido, string telefono, string? direccion = null, string? correoElectronico = null)
        {
            Nombre = nombre;
            Apellido = apellido;
            Telefono = telefono;
            Direccion = direccion;
            CorreoElectronico = correoElectronico;
        }

        public void Actualizar(string nombre, string apellido, string telefono, string? direccion = null, string? correoElectronico = null)
        {
            Nombre = nombre;
            Apellido = apellido;
            Telefono = telefono;
            Direccion = direccion;
            CorreoElectronico = correoElectronico;
        }
    }
}
