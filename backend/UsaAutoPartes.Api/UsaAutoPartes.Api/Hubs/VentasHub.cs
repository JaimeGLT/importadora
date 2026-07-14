
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace UsaAutoPartes.Api.Hubs
{
    [Authorize]
    public class VentasHub : Hub
    {
        public async Task UnirseAGrupo(string grupo)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, grupo);
        }

        public async Task AbandonarGrupo(string grupo)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, grupo);
        }
    }
}
