using System.ComponentModel.DataAnnotations;
using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.Dtos.CajaDtos
{
    public class DtoMovimientoCrear
    {
        [Required]
        public string Tipo { get; set; } = string.Empty;

        [Required]
        public string Categoria { get; set; } = string.Empty;

        [Required]
        public string TipoPago { get; set; } = string.Empty;

        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal Monto { get; set; }

        [Required]
        public string Motivo { get; set; } = string.Empty;

        public MovimientoCaja Crear(int idCaja) => new MovimientoCaja(idCaja, Tipo, Categoria, TipoPago, Monto, Motivo);
    }
}
