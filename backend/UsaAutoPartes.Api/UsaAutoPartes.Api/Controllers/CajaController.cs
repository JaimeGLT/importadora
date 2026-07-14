using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using UsaAutoPartes.Application.Dtos.CajaDtos;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Enum.CajaEnums;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;

namespace UsaAutoPartes.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = $"{UsuarioRoles.Admin},{UsuarioRoles.Cajero}, {UsuarioRoles.Operador}")]
    public class CajaController(ICajaRepositorio _caja, IMovimientoCajaRepositorio _movimiento) : ControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> AbrirCaja(DtoAbrirCaja datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var cajaActiva = await _caja.GetCajaActivaByUsuario(userId);
            if (cajaActiva is not null) return Conflict(new { message = "Ya tienes una caja abierta." });

            var caja = datos.Crear(userId);
            await _caja.Crear(caja);
            await _caja.GuardarAsync();

            return Created("", new { message = "Caja abierta." });
        }

        [HttpPost("{id:int}/Movimiento")]
        public async Task<IActionResult> AgregarMovimiento(int id, DtoMovimientoCrear datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var caja = await _caja.Obtener(id);
            if (caja.UsuarioId != userId) return Forbid();
            if (caja.Estado == EstadosCaja.Cerrada) return BadRequest(new { message = "La caja ya está cerrada." });

            var categoriasIngreso = new[] { CategoriaMovimiento.Ventas, CategoriaMovimiento.CobranzaCredito, CategoriaMovimiento.Transferencia, CategoriaMovimiento.OtroIngreso };
            var categoriasEgreso = new[] { CategoriaMovimiento.Compra, CategoriaMovimiento.GastoOperativo, CategoriaMovimiento.Transferencia, CategoriaMovimiento.OtroEgreso };

            if (datos.Tipo == TipoMovimiento.Ingreso && !categoriasIngreso.Contains(datos.Categoria))
                return BadRequest(new { message = "Categoría inválida para ingreso." });

            if (datos.Tipo == TipoMovimiento.Egreso && !categoriasEgreso.Contains(datos.Categoria))
                return BadRequest(new { message = "Categoría inválida para egreso." });

            if (datos.Tipo != TipoMovimiento.Ingreso && datos.Tipo != TipoMovimiento.Egreso)
                return BadRequest(new { message = "Tipo de movimiento inválido." });

            var movimiento = datos.Crear(id);
            await _movimiento.Crear(movimiento);
            await _movimiento.GuardarAsync();

            return Created("", new { message = "Movimiento registrado." });
        }

        [HttpPost("Cerrar/{id:int}")]
        public async Task<IActionResult> CerrarCaja(int id, DtoCerrarCaja datos)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var caja = await _caja.Obtener(id);
            if (caja.UsuarioId != userId) return Forbid();
            if (caja.Estado == EstadosCaja.Cerrada) return BadRequest(new { message = "La caja ya está cerrada." });

            var movimientos = _movimiento.Query()
                .Where(x => x.Id_Caja == id)
                .ToList();

            var totalIngresos = movimientos.Where(x => x.Tipo == TipoMovimiento.Ingreso).Sum(x => x.Monto);
            var ingresoEfectivo = movimientos.Where(x => x.Tipo == TipoMovimiento.Ingreso && x.TipoPago == TipoPago.Efectivo).Sum(x => x.Monto);
            var ingresoQR = movimientos.Where(x => x.Tipo == TipoMovimiento.Ingreso && x.TipoPago == TipoPago.QR).Sum(x => x.Monto);
            var ingresoTarjeta = movimientos.Where(x => x.Tipo == TipoMovimiento.Ingreso && x.TipoPago == TipoPago.Tarjeta).Sum(x => x.Monto);
            var totalEgresos = movimientos.Where(x => x.Tipo == TipoMovimiento.Egreso).Sum(x => x.Monto);
            var egresoEfectivo = movimientos.Where(x => x.Tipo == TipoMovimiento.Egreso && x.TipoPago == TipoPago.Efectivo).Sum(x => x.Monto);

            // Desglose ventas contado vs cobros de crédito del día.
            // - Ventas al contado: ingresos con Categoria == Ventas.
            // - Cobros de crédito: ingresos con Categoria == CobranzaCredito.
            // Las transferencias y otros ingresos quedan en IngresoEfectivo/QR/Tarjeta
            // pero NO se cuentan ni como ventas ni como cobranzas.
            var ingresoVentas = movimientos.Where(x => x.Tipo == TipoMovimiento.Ingreso && x.Categoria == CategoriaMovimiento.Ventas);
            var ingresoCobranzas = movimientos.Where(x => x.Tipo == TipoMovimiento.Ingreso && x.Categoria == CategoriaMovimiento.CobranzaCredito);

            var ingresoVentasTotal = ingresoVentas.Sum(x => x.Monto);
            var ingresoCobranzasTotal = ingresoCobranzas.Sum(x => x.Monto);
            var ingresoCobranzaEfectivo = ingresoCobranzas.Where(x => x.TipoPago == TipoPago.Efectivo).Sum(x => x.Monto);
            var ingresoCobranzaQR = ingresoCobranzas.Where(x => x.TipoPago == TipoPago.QR).Sum(x => x.Monto);
            var ingresoCobranzaTarjeta = ingresoCobranzas.Where(x => x.TipoPago == TipoPago.Tarjeta).Sum(x => x.Monto);

            var efectivoEsperado = caja.MontoInicial + ingresoEfectivo - egresoEfectivo;

            if (datos.MontoContado != efectivoEsperado && string.IsNullOrWhiteSpace(datos.Justificacion))
                return BadRequest(new { message = "El monto contado no coincide con el esperado. Ingresa una justificación." });

            caja.Cerrar(datos.MontoContado, datos.Justificacion);
            await _caja.GuardarAsync();

            var resumen = new DtoCajaResumen
            {
                Estado = caja.Estado,
                FechaInicio = caja.FechaInicio,
                FechaCierre = caja.FechaCierre,
                MontoInicial = caja.MontoInicial,
                TotalIngresos = totalIngresos,
                IngresoEfectivo = ingresoEfectivo,
                IngresoQR = ingresoQR,
                IngresoTarjeta = ingresoTarjeta,
                TotalEgresos = totalEgresos,
                EfectivoEsperado = efectivoEsperado,
                MontoContado = datos.MontoContado,
                Justificacion = datos.Justificacion,
                IngresoVentasTotal = ingresoVentasTotal,
                IngresoCobranzasTotal = ingresoCobranzasTotal,
                IngresoCobranzaEfectivo = ingresoCobranzaEfectivo,
                IngresoCobranzaQR = ingresoCobranzaQR,
                IngresoCobranzaTarjeta = ingresoCobranzaTarjeta,
            };

            return Ok(resumen);
        }
    }
}
