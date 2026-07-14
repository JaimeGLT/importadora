using Microsoft.AspNetCore.Mvc;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class HealthController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get()
        {
            return Ok(new { status = "ok", timestamp = DateTime.UtcNow });
        }
    }
}
