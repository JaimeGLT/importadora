using System.ComponentModel.DataAnnotations;

namespace UsaAutoPartes.Application.Dtos.ConfigVentaDtos
{
    public class DtoConfigVenta
    {
        [Required]
        public string ModoVenta { get; set; } = string.Empty;
    }
}
