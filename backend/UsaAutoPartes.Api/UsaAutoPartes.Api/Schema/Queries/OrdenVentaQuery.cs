using HotChocolate.Authorization;
using System.Security.Claims;
using UsaAutoPartes.Application.Dtos.ComisionDtos;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;
using UsaAutoPartes.Domain.Enum.VentaEnums;

namespace UsaAutoPartes.Api.Schema.Queries
{
    [ExtendObjectType("Query")]
    public class OrdenVentaQuery
    {
        // Cajero: sus propias órdenes
        [Authorize(Roles = new[] { UsuarioRoles.Cajero, UsuarioRoles.Admin, UsuarioRoles.Operador })]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        [UseSorting]
        [UseFiltering]
        public IQueryable<OrdenVenta> MisOrdenes(
            [Service] IOrdenVentaRepositorio _db,
            ClaimsPrincipal claims,
            DateTime? desde,
            DateTime? hasta)
        {
            var userId = Guid.Parse(claims.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            return _db.OrdenQuery()
                .Where(x => x.Id_Cajero == userId)
                .Where(x => (!desde.HasValue || x.FechaCompletada >= desde.Value)
                         && (!hasta.HasValue || x.FechaCompletada <= hasta.Value));
        }

        // Almacenero: órdenes pendientes disponibles para aceptar
        [Authorize(Roles = new[] { UsuarioRoles.Almacenero, UsuarioRoles.Admin })]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        [UseSorting]
        [UseFiltering]
        public IQueryable<OrdenVenta> OrdenesPendientes([Service] IOrdenVentaRepositorio _db)
        {
            return _db.OrdenQuery().Where(x => x.Estado == EstadosOrden.Pendiente);
        }

        // Almacenero: órdenes que aceptó
        [Authorize(Roles = new[] { UsuarioRoles.Almacenero, UsuarioRoles.Admin })]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        [UseSorting]
        [UseFiltering]
        public IQueryable<OrdenVenta> MisOrdenesAlmacen([Service] IOrdenVentaRepositorio _db, ClaimsPrincipal claims)
        {
            var userId = Guid.Parse(claims.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            return _db.OrdenQuery().Where(x => x.Id_Almacenero == userId);
        }

        // Operador: órdenes listas para escaneo
        [Authorize(Roles = new[] { UsuarioRoles.Operador, UsuarioRoles.Admin })]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        [UseSorting]
        [UseFiltering]
        public IQueryable<OrdenVenta> OrdenesListas([Service] IOrdenVentaRepositorio _db)
        {
            return _db.OrdenQuery().Where(x => x.Estado == EstadosOrden.Lista);
        }

        // Cajero/Operador: todas las órdenes disponibles para escanear (sin filtrar por usuario)
        [Authorize(Roles = new[] { UsuarioRoles.Cajero, UsuarioRoles.Operador, UsuarioRoles.Admin })]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        [UseSorting]
        [UseFiltering]
        public IQueryable<OrdenVenta> OrdenesParaEscaneo([Service] IOrdenVentaRepositorio _db)
        {
            return _db.OrdenQuery().Where(x =>
                x.Estado == EstadosOrden.Lista ||
                x.Estado == EstadosOrden.ConFaltantes);
        }

        // Admin: todas las órdenes
        [Authorize(Roles = new[] { UsuarioRoles.Admin })]
        [UsePaging(IncludeTotalCount = true, DefaultPageSize = 20)]
        [UseProjection]
        [UseSorting]
        [UseFiltering]
        public IQueryable<OrdenVenta> TodasOrdenes(
            [Service] IOrdenVentaRepositorio _db,
            DateTime? desde,
            DateTime? hasta)
        {
            return _db.OrdenQuery()
                .Where(x => (!desde.HasValue || x.FechaCompletada >= desde.Value)
                         && (!hasta.HasValue || x.FechaCompletada <= hasta.Value));
        }

        // Admin: resumen de comisiones por cajero en un rango de fechas
        [Authorize(Roles = new[] { UsuarioRoles.Admin })]
        public Task<List<ResumenComisionDto>> ResumenComisionesCajeros(
            [Service] IOrdenVentaRepositorio _db,
            DateTime desde,
            DateTime hasta)
        {
            return _db.GetResumenComisionesAsync(desde, hasta);
        }
    }
}
