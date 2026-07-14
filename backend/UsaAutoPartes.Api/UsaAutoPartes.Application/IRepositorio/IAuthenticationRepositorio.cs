using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Application.Dtos.Autentication;
using UsaAutoPartes.Application.Dtos.Authentication;
using UsaAutoPartes.Application.IServicios;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface IAuthenticationRepositorio
    {
        Task Register(RequestRegister datos);
        Task<DtoUsuarioDatos> Login(RequestLogin datos);
        Task<DtoUsuarioDatos> RefreshTokenAsync(string? Token);
        Task LogoutAsync(Guid userId);
    }
}
