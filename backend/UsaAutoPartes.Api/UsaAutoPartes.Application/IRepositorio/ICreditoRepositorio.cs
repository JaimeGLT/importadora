using UsaAutoPartes.Domain.Entities;

namespace UsaAutoPartes.Application.IRepositorio
{
    public interface ICreditoRepositorio : IGenericRepositorio<Credito>
    {
        /// <summary>Query base para usar en listados GraphQL con paginación y filtros.</summary>
        IQueryable<Credito> CreditoQuery();

        /// <summary>Carga el crédito con su cliente, items, pagos y el usuario que recibió cada pago.</summary>
        Task<Credito?> GetConItemsYPagosAsync(int id);

        /// <summary>Carga el crédito + RowVersion para chequeo de concurrencia antes de mutar.</summary>
        Task<Credito?> GetParaActualizarAsync(int id);
    }
}
