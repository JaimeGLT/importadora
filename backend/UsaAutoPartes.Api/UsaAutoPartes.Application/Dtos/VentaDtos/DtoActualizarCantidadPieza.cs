using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.VentaDtos
{
    public class DtoActualizarCantidadPieza
    {
        /// <summary>
        /// Nueva cantidad de la pieza. Si llega a 0, el backend elimina la pieza.
        /// </summary>
        [Range(1, int.MaxValue, ErrorMessage = "La cantidad debe ser mayor o igual a 1.")]
        public int Cantidad { get; set; }
    }
}
