# UsaAutoPartes.Api — Documentación del Proyecto

## Descripción General

**UsaAutoPartes** es una Web API desarrollada en **.NET** siguiendo los principios de **Clean Architecture**. Esta arquitectura divide el proyecto en capas bien definidas, donde cada una tiene una responsabilidad específica y las dependencias siempre apuntan hacia adentro (hacia el dominio), nunca hacia afuera.

El objetivo de esta organización es mantener el código **desacoplado, testeable y fácil de mantener**.

---

## Estructura de la Solución

La solución está compuesta por **4 proyectos**:

```
UsaAutoPartes.sln
├── UsaAutoPartes.Api             # Capa de Presentación (punto de entrada)
├── UsaAutoPartes.Application     # Capa de Aplicación (lógica de negocio)
├── UsaAutoPartes.Domain          # Capa de Dominio (entidades y contratos)
└── UsaAutoPartes.Infrastructure  # Capa de Infraestructura (BD, servicios externos)
```

---

## Descripción de Cada Capa

### 1. `UsaAutoPartes.Api` — Capa de Presentación
Es el **punto de entrada** de la aplicación. Aquí viven los controladores que reciben las peticiones HTTP y las delegan a la capa de aplicación. No contiene lógica de negocio.

```
UsaAutoPartes.Api/
├── Controllers/
│   ├── AuthController.cs           # Endpoints de autenticación (login, registro, etc.)
│   ├── DescuentoController.cs      # Endpoints para gestión de descuentos
│   ├── ProductoController.cs       # Endpoints para gestión de productos
│   └── ProveedorController.cs      # Endpoints para gestión de proveedores
│
├── Handlers/
│   └── GlobalHandler.cs            # Manejo global de errores y excepciones (middleware)
│
├── Schema/
│   ├── Queries/                    # Modelos de entrada para peticiones GET (parámetros de consulta)
│   │   ├── DescuentoQuery.cs
│   │   ├── ImportacionQuery.cs
│   │   ├── MeQuery.cs
│   │   ├── ProductoQuery.cs
│   │   └── ProveedorQuery.cs
│   │
│   └── Types/                      # Modelos de respuesta que se devuelven al cliente
│       ├── HistorialPrecioType.cs
│       ├── Importacion_DetalleType.cs
│       ├── ImportacionType.cs
│       ├── ProductoType.cs
│       └── ProveedorType.cs
│
├── appsettings.json                # Configuración general (cadena de conexión, JWT, etc.)
├── appsettings.Development.json    # Configuración específica para entorno de desarrollo
└── Program.cs                      # Punto de entrada: registro de servicios y middlewares
```

**Reglas para esta capa:**
- Los `Controllers` solo deben recibir la petición, llamar al servicio/comando correspondiente y retornar la respuesta. **Cero lógica de negocio aquí.**
- Los archivos en `Schema/Queries` representan los **parámetros de entrada** de los endpoints (lo que llega en el query string o body).
- Los archivos en `Schema/Types` representan los **modelos de respuesta** que se envían al cliente. Nunca exponer entidades del dominio directamente.
- `GlobalHandler.cs` centraliza el manejo de excepciones. Si necesitas capturar un nuevo tipo de error, hacerlo ahí.
- Toda configuración de variables de entorno va en `appsettings.json`. Los secretos sensibles **nunca** se suben al repositorio.

> ✅ Aquí va todo lo relacionado con HTTP: controladores, middlewares, filtros, configuración de Swagger, autenticación, inyección de dependencias.

---

### 2. `UsaAutoPartes.Application` — Capa de Aplicación
Contiene la **lógica de negocio de la aplicación**. Orquesta el flujo de datos entre la capa de dominio y la infraestructura. Es el corazón de la arquitectura.

```
UsaAutoPartes.Application/
├── Dtos/                               # Objetos de transferencia de datos entre capas
│   ├── Authentication/                 # DTOs relacionados al login y registro de usuarios
│   ├── DescuentoDtos/                  # DTOs para operaciones de descuentos
│   ├── ImportacionDtos/                # DTOs para operaciones de importación
│   ├── ProductosDtos/                  # DTOs para operaciones de productos
│   └── ProveedorDto/                   # DTOs para operaciones de proveedores
│
├── Exceptions/                         # Excepciones personalizadas de la aplicación
│   ├── AuthenticationExceptions/       # Errores de autenticación (ej. credenciales inválidas)
│   ├── DataBaseException/              # Errores relacionados a la base de datos
│   └── GenericExceptions/              # Errores genéricos reutilizables
│
├── IRepositorio/                       # Interfaces de repositorios (contratos que implementa Infrastructure)
│   ├── IAuthenticationRepositorio.cs
│   ├── IDescuentoRepositorio.cs
│   ├── IGenericRepositorio.cs          # Repositorio genérico con operaciones CRUD base
│   ├── IHistorialPrecioRepositorio.cs
│   ├── IImportacionRepositorio.cs
│   ├── IProductoRepositorio.cs
│   ├── IProveedorRepositorio.cs
│   ├── IUnitWork.cs                    # Patrón Unit of Work para manejar transacciones
│   └── IUsuarioRepositorio.cs
│
└── IServicios/                         # Interfaces de servicios externos o transversales
    └── IAuthTokenProcessor.cs          # Contrato para generación y validación de tokens JWT
```

**Reglas para esta capa:**
- Los `Dtos` son los únicos objetos que viajan entre `Api` y `Application`. **Nunca pasar entidades del dominio hacia arriba.**
- Las interfaces en `IRepositorio` definen los contratos. La implementación real vive en `Infrastructure`. Si necesitas una nueva operación de BD, primero declara el método aquí.
- Las interfaces en `IServicios` definen contratos de servicios externos (tokens, correos, etc.). Su implementación también va en `Infrastructure`.
- Si surge un nuevo tipo de error de negocio, crear la excepción en `Exceptions` en la subcarpeta que corresponda.
- `IUnitWork` se usa cuando una operación requiere múltiples cambios en BD que deben confirmarse o revertirse juntos.

> ✅ Aquí van los DTOs, interfaces de repositorios y servicios, y excepciones de negocio.

---

### 3. `UsaAutoPartes.Domain` — Capa de Dominio
Contiene las **entidades del negocio** y las reglas que son completamente independientes de cualquier framework o tecnología. Es la capa más interna y no depende de ninguna otra.

```
UsaAutoPartes.Domain/
├── Entities/                           # Entidades principales del negocio
│   ├── BasesEntidades/                 # Clases base que heredan las demás entidades (ej. Id, fechas de auditoría)
│   ├── IdentityDb/                     # Entidades relacionadas a autenticación e identidad de usuarios
│   ├── Descuento.cs
│   ├── HistorialPrecio.cs
│   ├── Importacion.cs
│   ├── Importacion_Detalle.cs
│   ├── Producto.cs
│   └── Proveedor.cs
│
└── Enum/                               # Enumeraciones del dominio
    ├── AuthEnums/                      # Enums relacionados a roles y estados de autenticación
    ├── InventarioEnums/                # Enums relacionados al inventario (ej. estado de producto)
    └── UsuarioEnums/                   # Enums relacionados al estado o tipo de usuario
```

**Reglas para esta capa:**
- Las entidades en `Entities` son la **fuente de verdad** del negocio. Representan las tablas de la base de datos pero no deben contener ninguna referencia a Entity Framework ni a ningún otro framework.
- `BasesEntidades` contiene la clase base que todas las entidades heredan (generalmente tiene propiedades como `Id`, `FechaCreacion`, `FechaModificacion`). Si necesitas agregar un campo de auditoría global, hacerlo aquí.
- `IdentityDb` contiene las entidades de usuario e identidad. Modificar con cuidado ya que afecta la autenticación.
- Los `Enum` definen valores fijos del negocio. Nunca usar números mágicos en el código — siempre referenciar los enums de esta carpeta.
- **Esta capa no referencia ninguna otra capa del proyecto.**

> ✅ Aquí van las entidades, clases base, enumeraciones de negocio y cualquier regla pura del dominio.

---

### 4. `UsaAutoPartes.Infrastructure` — Capa de Infraestructura
Implementa los **detalles técnicos**: acceso a base de datos, consumo de APIs externas, envío de correos, etc. Depende de `Domain` y `Application`, nunca al revés.

```
UsaAutoPartes.Infrastructure/
├── Data/
│   ├── ConfigDbContext/                    # Configuración de tablas con Entity Framework (Fluent API)
│   │   ├── ConfigDescuento.cs
│   │   ├── ConfigHistorialPrecio.cs
│   │   ├── ConfigImportacion.cs
│   │   ├── ConfigImportacion_Detalle.cs
│   │   ├── ConfigProducto.cs
│   │   ├── ConfigProveedor.cs
│   │   ├── ConfigRefreshToken.cs
│   │   └── ConfigUsuario.cs
│   │
│   ├── Repositorio/                        # Implementaciones concretas de las interfaces de Application
│   │   ├── AuthenticationRepositorio.cs
│   │   ├── DescuentoRepositorio.cs
│   │   ├── GenericRepositorio.cs           # Implementación base con operaciones CRUD reutilizables
│   │   ├── HistorialPrecioRepositorio.cs
│   │   ├── ImportacionRepositorio.cs
│   │   ├── ProductoRepositorio.cs
│   │   ├── ProveedorRepositorio.cs
│   │   ├── UnitWork.cs                     # Implementación del Unit of Work
│   │   └── UsuarioRepositorio.cs
│   │
│   └── AppDbContext.cs                     # DbContext principal: registra entidades y configuraciones
│
├── Migrations/                             # Migraciones generadas automáticamente por EF Core
│   └── (archivos generados automáticamente, no editar a mano)
│
└── Servicios/
    └── Processors/
        ├── AuthTokenProcessor.cs           # Implementación de generación y validación de tokens JWT
        └── JwtOptions.cs                   # Clase de configuración con las opciones del JWT (secret, expiración, etc.)
```

**Reglas para esta capa:**
- Cada archivo en `Repositorio` implementa exactamente la interfaz correspondiente en `Application/IRepositorio`. **Si agregas un método a la interfaz, debes implementarlo aquí.**
- Los archivos en `ConfigDbContext` configuran cómo cada entidad se mapea a su tabla en la BD (nombre de tabla, columnas, relaciones, índices). Toda configuración de EF Core va aquí, nunca dentro de la entidad.
- `AppDbContext.cs` es el contexto principal. Aquí se registran los `DbSet` y se aplican las configuraciones de `ConfigDbContext`.
- La carpeta `Migrations` es **generada automáticamente** por EF Core. Nunca editar estos archivos a mano. Para crear una migración usar: `dotnet ef migrations add NombreMigracion`.
- `AuthTokenProcessor.cs` implementa `IAuthTokenProcessor` de `Application/IServicios`. Si cambias la lógica del token, solo tocas este archivo.
- `JwtOptions.cs` mapea la sección de configuración JWT del `appsettings.json`. Si agregas una nueva opción de JWT, declararla aquí.

> ✅ Aquí van los repositorios concretos, DbContext, configuraciones de EF Core, migraciones e implementaciones de servicios externos.

---

## Diagrama de Dependencias

```
[ Api ]
   ↓
[ Application ]
   ↓
[ Domain ]
   ↑
[ Infrastructure ] ──→ [ Domain ]
```

> La regla más importante: **ninguna capa interna conoce a las capas externas.**

---

## Reglas de Organización — Leer Antes de Modificar

| Regla | Descripción |
|-------|-------------|
| 🚫 No mezclar capas | Cada archivo debe vivir en la capa que le corresponde |
| 🚫 No lógica en controladores | Los controladores solo reciben y delegan, nunca procesan |
| 🚫 No acceso a BD desde Api o Domain | Solo `Infrastructure` accede a la base de datos |
| ✅ Usar interfaces | La comunicación entre capas siempre debe ser a través de interfaces definidas en `Domain` o `Application` |
| ✅ Un archivo, una responsabilidad | Cada clase debe tener un único propósito claro |


## Flujo de una Petición (Ejemplo)

Para entender cómo las capas interactúan, este es el flujo típico de una petición:

```
Cliente HTTP
    ↓
[Api] ProductoController.cs              # Recibe el request HTTP
    ↓
[Application] IProductoRepositorio       # Llama al contrato del repositorio
    ↓
[Infrastructure] ProductoRepositorio.cs  # Ejecuta la consulta real a la BD
    ↓
[Domain] Producto.cs                     # La entidad que se persiste o retorna
    ↓
[Api] Schema/Types/ProductoType.cs       # Se mapea al modelo de respuesta y se retorna al cliente
```
# IMPORTANTE
No utilizar desserialización