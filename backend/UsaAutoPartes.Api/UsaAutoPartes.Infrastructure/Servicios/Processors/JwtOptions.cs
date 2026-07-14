using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsaAutoPartes.Infrastructure.Servicios.Processors
{
    public  class JwtOptions
    {
        public const string JwtOptionsSecction = "JwtOptions";
        public string SecretKey { get; set; } = string.Empty; 

        public string Issuer { get; set; } = string.Empty;

        public string Audience { get; set; } = string.Empty;

        public int Experice { get; set; }
    }
}
