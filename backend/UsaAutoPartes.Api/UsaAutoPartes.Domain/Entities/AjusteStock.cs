using System;
using UsaAutoPartes.Domain.Entities.BasesEntidades;
using UsaAutoPartes.Domain.Entities.IdentityDb;

namespace UsaAutoPartes.Domain.Entities
{
    public class AjusteStock : BaseEntity
    {
        public required int Id_Producto { get; set; }

        public required int CantidadAnterior { get; set; }

        public required int CantidadNueva { get; set; }

        public required string Motivo { get; set; }

        public string Nota { get; set; } = string.Empty;

        public DateTime Fecha { get; set; }

        public Guid? UsuarioId { get; set; }

        public Producto? Producto { get; set; }

        public Usuario? Usuario { get; set; }
    }
}
