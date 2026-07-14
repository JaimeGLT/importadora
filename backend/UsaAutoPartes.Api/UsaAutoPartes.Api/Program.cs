using Mapster;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using System.Text;
using HotChocolate.Data.Filters.Expressions;
using UsaAutoPartes.Api.Middleware;
using UsaAutoPartes.Api.Handlers;
using UsaAutoPartes.Api.Hubs;
using UsaAutoPartes.Api.Schema.Queries;
using UsaAutoPartes.Api.Schema.Types;
using UsaAutoPartes.Application.IRepositorio;
using UsaAutoPartes.Application.IServicios;
using UsaAutoPartes.Domain.Entities.IdentityDb;
using UsaAutoPartes.Domain.Enum.CookieNames;
using UsaAutoPartes.Domain.Enum.UsuarioEnums;
using UsaAutoPartes.Infrastructure.Data;
using UsaAutoPartes.Infrastructure.Data.Repositorio;
using UsaAutoPartes.Infrastructure.Servicios;
using UsaAutoPartes.Infrastructure.Servicios.Processors;
using UsaAutoPartes.Api.Filters;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);
var zonaHoraria = TimeZoneInfo.FindSystemTimeZoneById("SA Western Standard Time");
builder.Services.AddSingleton(zonaHoraria);

builder.Services.AddControllers();

// Límite de upload: 10 archivos * 20 MB + overhead de multipart.
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 250L * 1024 * 1024;
    options.ValueLengthLimit         = int.MaxValue;
});

builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Servers = new List<Microsoft.OpenApi.Models.OpenApiServer>
        {
            new() { Url = "https://importadora-posn.onrender.com" }
        };
        return Task.CompletedTask;
    });
});

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.JwtOptionsSecction));

builder.Services.AddDataProtection();

builder.Services.AddIdentityCore<Usuario>(opt =>
{
    opt.Password.RequireDigit = false;
    opt.Password.RequireLowercase = false;
    opt.Password.RequireNonAlphanumeric = false;
    opt.Password.RequireUppercase = false;
    opt.Password.RequiredLength = 6;
    opt.User.RequireUniqueEmail = true;
}).AddRoles<IdentityRole<Guid>>()
  .AddEntityFrameworkStores<AppDbContext>()
  .AddSignInManager()
  .AddDefaultTokenProviders();

builder.Services.AddDbContext<AppDbContext>(opt =>
{
    opt.UseNpgsql(builder.Configuration["ConexionDataBase:CadenaConexion"]);
} );

builder.Services.AddHttpClient();
builder.Services.AddScoped<IFacturaExtractorServicio, FacturaExtractorServicio>();
builder.Services.AddSingleton<IFacturaJobStore, FacturaJobStore>();
builder.Services.AddSingleton<IFacturaTrabajoQueue, FacturaTrabajoQueue>();
builder.Services.AddHostedService<FacturaProcesadorService>();
builder.Services.AddScoped<IExportProductoServicio, ExportProductoServicio>();
builder.Services.AddScoped<IAuthTokenProcessor, AuthTokenProcessor>();
builder.Services.AddScoped<IAuthenticationRepositorio, AuthenticationRepositorio>();
builder.Services.AddScoped<IProductoRepositorio, ProductoRepositorio>();
builder.Services.AddScoped<IProductoImagenRepositorio, ProductoImagenRepositorio>();
builder.Services.AddScoped<IUnitWork, UnitWork>();

// Cloudflare R2: opciones + servicio (singleton, sin estado por request) + GC de huérfanos.
builder.Services.Configure<CloudflareR2Options>(builder.Configuration.GetSection(CloudflareR2Options.SectionName));
builder.Services.AddSingleton<IR2StorageServicio, R2StorageServicio>();
builder.Services.AddHostedService<R2OrphanGcService>();
builder.Services.AddScoped<IUsuarioRepositorio, UsuarioRepositorio>();
builder.Services.AddScoped<IProveedorRepositorio, ProveedorRepositorio>();
builder.Services.AddScoped<IImportacionRepositorio, ImportacionRepositorio>();
builder.Services.AddScoped<IHistorialPrecioRepositorio, HistorialPrecioRepositorio>();
builder.Services.AddScoped<IDescuentoRepositorio, DescuentoRepositorio>();
builder.Services.AddScoped<ICajaRepositorio, CajaRepositorio>();
builder.Services.AddScoped<IMovimientoCajaRepositorio, MovimientoCajaRepositorio>();
builder.Services.AddScoped<IPiezaKitRepositorio, PiezaKitRepositorio>();
builder.Services.AddScoped<ITipoCambioRepositorio, TipoCambioRepositorio>();
builder.Services.AddScoped<IClienteRepositorio, ClienteRepositorio>();
builder.Services.AddScoped<IOrdenVentaRepositorio, OrdenVentaRepositorio>();
builder.Services.AddScoped<IAjusteStockRepositorio, AjusteStockRepositorio>();
builder.Services.AddScoped<IMarcaRepositorio, MarcaRepositorio>();
builder.Services.AddScoped<IMargenGananciaRepositorio, MargenGananciaRepositorio>();
builder.Services.AddScoped<IConfigVentaRepositorio, ConfigVentaRepositorio>();
builder.Services.AddScoped<ICreditoRepositorio, CreditoRepositorio>();
builder.Services.AddSignalR();
builder.Services.AddHostedService<BloqueoRecurrenteService>();
builder.Services.AddHostedService<RoleSeedService>();


builder.Services.AddAuthentication(opt =>
{
    opt.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    opt.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    opt.DefaultSignInScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    var jwtoptions = builder.Configuration.GetSection(JwtOptions.JwtOptionsSecction)
    .Get<JwtOptions>() ?? throw new ArgumentException(nameof(JwtOptions));

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtoptions.Issuer,
        ValidAudience = jwtoptions.Audience,
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtoptions.SecretKey))
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accesstoken = context.Request.Cookies[CookiesNames.access.ToString()];

            if (!string.IsNullOrEmpty(accesstoken))
            {
                context.Token = accesstoken;
            }

            return Task.CompletedTask;
        }
    };
});

builder.Services.AddMapster();
builder.Services.AddAuthorization();
builder.Services.AddExceptionHandler<GlobalHandler>();

//CORS

var origins = builder.Configuration.GetSection("Cors:Origins")
    .Get<string[]>() ?? [];

builder.Services.AddCors(X =>
{
    X.AddPolicy("CorsPoliticy", polity =>
    {
        polity.WithOrigins(origins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
    });
        
});

builder.Services.AddGraphQLServer()
    .ModifyRequestOptions(opt => opt.IncludeExceptionDetails = true)
    .ModifyCostOptions(options => options.EnforceCostLimits = false)
    .ModifyPagingOptions(opt =>
    {
        opt.MaxPageSize = int.MaxValue;
        opt.DefaultPageSize = 20;
    })
    .AddQueryType(d => d.Name("Query"))
    .AddTypeExtension<ProductoQuery>()
    .AddTypeExtension<ProveedorQuery>()
    .AddTypeExtension<ImportacionQuery>()
    .AddTypeExtension<DescuentoQuery>()
    .AddTypeExtension<CajaQuery>()
    .AddTypeExtension<TipoCambioQuery>()
    .AddTypeExtension<ClienteQuery>()
    .AddTypeExtension<OrdenVentaQuery>()
    .AddTypeExtension<MargenGananciaQuery>()
    .AddTypeExtension<ConfigVentaQuery>()
    .AddTypeExtension<MarcaQuery>()
    .AddTypeExtension<AjusteStockQuery>()
    .AddTypeExtension<ImportacionDetalleExtensions>()
    .AddTypeExtension<CreditoQuery>()
    .AddType<ProductoType>()
    .AddType<ProductoImagenType>()
    .AddType<MeQuery>()
    .AddType<ProveedorType>()
    .AddType<ImportacionType>()
    .AddType<HistorialPrecioType>()
    .AddType<Importacion_DetalleType>()
    .AddType<CajaType>()
    .AddType<MovimientoCajaType>()
    .AddType<PiezaKitType>()
    .AddType<TipoCambioType>()
    .AddType<ClienteType>()
    .AddType<OrdenVentaType>()
    .AddType<OrdenVentaItemType>()
    .AddType<OrdenVentaItemPiezaType>()
    .AddType<DescuentoType>()
    .AddType<CreditoType>()
    .AddType<CreditoItemType>()
    .AddType<CreditoPagoType>()
    .AddAuthorization()
    .AddProjections()
    .AddFiltering(x => x
        .AddDefaults()
        .AddProviderExtension(new QueryableFilterProviderExtension(p => p
            .AddFieldHandler<ILikeStringContainsHandler>()
        ))
    )
    .AddSorting();

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseExceptionHandler(_ => { });
if (!app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}
app.UseCors("CorsPoliticy");
app.UseAuthentication();
app.UseMiddleware<UsuarioBloqueadoMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapHub<VentasHub>("/hubs/ventas");
app.MapGraphQL().AllowAnonymous();
app.MapOpenApi().AllowAnonymous();
app.MapScalarApiReference(options =>
{
    options.WithTitle("UsaAutoPartes API")
        .WithTheme(ScalarTheme.DeepSpace);
}).AllowAnonymous();

// Las migraciones se ejecutan en deploy con 'dotnet ef database update'.
// El seed inicial de roles lo hace RoleSeedService (idempotente, no bloquea el arranque).

app.Run();

