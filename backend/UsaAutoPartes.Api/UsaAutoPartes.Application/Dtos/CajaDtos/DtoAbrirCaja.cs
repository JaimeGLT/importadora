using System.ComponentModel.DataAnnotations;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.Dtos.CajaDtos
{
    public class DtoAbrirCaja
    {
        [Required]
        [Range(0, double.MaxValue)]
        public decimal MontoInicial { get; set; }

        [Required]
        public DateTime FechaInicio { get; set; }

        public Caja Crear(Guid usuarioId) => new Caja(usuarioId, MontoInicial, FechaInicio);
    }
}
