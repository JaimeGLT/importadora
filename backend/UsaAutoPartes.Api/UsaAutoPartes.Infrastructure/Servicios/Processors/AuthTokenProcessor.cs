using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using UsaAutoPartes.Application.Dtos.Authentication;
using UsaAutoPartes.Application.IServicios;
using UsaAutoPartes.Domain.Enum.CookieNames;

namespace UsaAutoPartes.Infrastructure.Servicios.Processors
{
    public class AuthTokenProcessor : IAuthTokenProcessor
    {
        private readonly JwtOptions _jwtOptions;
        private readonly IHttpContextAccessor _http;
        public AuthTokenProcessor(IOptions<JwtOptions> JwtOptions, IHttpContextAccessor _http)
        {
            _jwtOptions = JwtOptions.Value;
            this._http = _http;
        }  
        
        public (string Token, DateTime expiresAuth) GenerateToken(DtoUsuarioToken datos)
        {
            var singniKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.SecretKey));

            var credentials = new SigningCredentials(singniKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, datos.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(JwtRegisteredClaimNames.Email, datos.Email),
                new Claim(ClaimTypes.Name, datos.Nombre),
                new Claim(ClaimTypes.Role, datos.Rol)
            };

            var expires = DateTime.UtcNow.AddMinutes(_jwtOptions.Experice);

            var Token = new JwtSecurityToken(
                issuer: _jwtOptions.Issuer,
                audience: _jwtOptions.Audience,
                claims: claims,
                expires: expires,
                signingCredentials: credentials
                );

            var jwtToken = new JwtSecurityTokenHandler().WriteToken(Token);

            return (jwtToken, expires);
        }

        public string GenerateRefresToken()
        {
            var num = new byte[64];

            using var run = RandomNumberGenerator.Create();

            run.GetBytes(num);

            return Convert.ToBase64String(num);
        }

        public void WriteAuthCookie(string CookieName, string Token, DateTime Expires)
        {
            var context = _http.HttpContext?? throw new Exception("No se pudo acceder al contexto HTTP");
            var isHttps = context.Request.IsHttps;

            context.Response.Cookies.Append(
                CookieName,
                Token,
                new CookieOptions
                {
                    HttpOnly = true,
                    Expires = Expires,
                    IsEssential = true,
                    Secure = isHttps,
                    SameSite = isHttps ? SameSiteMode.None : SameSiteMode.Lax,
                    Path = CookieName == CookiesNames.accessreload.ToString()
                   ? "/api/Auth/refresh"   // refresh token solo va a este endpoint
                   : "/"
                }
                );
        }
    }


}
