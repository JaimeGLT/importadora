using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = UsuarioRoles.Admin)]
    public class MarcaController(IMarcaRepositorio _marca) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> Listar()
        {
            var marcas = await _marca.Query().OrderBy(m => m.Nombre).ToListAsync();
            return Ok(marcas.Select(m => new { m.Id, m.Nombre }));
        }

        [HttpPost]
        public async Task<IActionResult> Crear(DtoMarcaCU datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var nombre = datos.Nombre.Trim();
            var existe = await _marca.ObtenerPorNombre(nombre);
            if (existe is not null) return Conflict(new { message = "Ya existe una marca con ese nombre" });

            var marca = new Marca { Nombre = nombre };

            await _marca.Crear(marca);
            await _marca.GuardarAsync();

            return Created("", new { message = "Marca creada", id = marca.Id, nombre = marca.Nombre });
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Editar(int id, DtoMarcaCU datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var marca = await _marca.Obtener(id);

            marca.Nombre = datos.Nombre.Trim();

            await _marca.GuardarAsync();

            return Ok(new { message = "Marca actualizada" });
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Eliminar(int id)
        {
            await _marca.Eliminar(id);
            await _marca.GuardarAsync();

            return Ok(new { message = "Marca eliminada" });
        }
    }

    public class DtoMarcaCU
    {
        [System.ComponentModel.DataAnnotations.Required]
        public required string Nombre { get; set; }
    }
}
