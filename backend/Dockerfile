FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build 
WORKDIR /src

COPY UsaAutoPartes.Api/UsaAutoPartes.Api.sln UsaAutoPartes.Api/
COPY UsaAutoPartes.Api/UsaAutoPartes.Api/UsaAutoPartes.Api.csproj UsaAutoPartes.Api/UsaAutoPartes.Api/
COPY UsaAutoPartes.Api/UsaAutoPartes.Application/UsaAutoPartes.Application.csproj UsaAutoPartes.Api/UsaAutoPartes.Application/
COPY UsaAutoPartes.Api/UsaAutoPartes.Domain/UsaAutoPartes.Domain.csproj UsaAutoPartes.Api/UsaAutoPartes.Domain/
COPY UsaAutoPartes.Api/UsaAutoPartes.Infrastructure/UsaAutoPartes.Infrastructure.csproj UsaAutoPartes.Api/UsaAutoPartes.Infrastructure/
RUN dotnet restore UsaAutoPartes.Api/UsaAutoPartes.Api.sln

COPY UsaAutoPartes.Api/ UsaAutoPartes.Api/
RUN dotnet publish UsaAutoPartes.Api/UsaAutoPartes.Api/UsaAutoPartes.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet UsaAutoPartes.Api.dll"]
