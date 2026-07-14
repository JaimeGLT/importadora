using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Application.Dtos.Authentication;

namespace UsaAutoPartes.Application.IServicios
{
    public interface IAuthTokenProcessor
    {
        (string Token, DateTime expiresAuth) GenerateToken(DtoUsuarioToken datos);

        string GenerateRefresToken();

        void WriteAuthCookie(string CookieName, string Token, DateTime Expires);
    }
}
