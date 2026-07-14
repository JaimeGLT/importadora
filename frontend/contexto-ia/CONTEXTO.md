# CLAUDE.md

## Qué es el sistema
El sistema es un sistema de gestión de inventario y ventas para un importadora de autopartes.

## Roles y permisos
- El administrador "admin" puede realizar todas las acciones del sistema y acceder a todos los modulos.
- El almacenero "almacenero" puede ver solo el submódulo de almacén donde le llegan los pedidos.
- El cajero "cajero" puede ver y utilizar el módulo de caja, el submódulo de ventas y de reservas

## Módulos y estado
El sistema cuenta con los siguientes modulos:
- Dashboard 
- Inventario:
- Importaciones:
- Caja:
- Ventas: 
- reportes:
- Sistema:

## Stack técnico
- React + typeScript para el frontend.
- Libreria TanStack para las tablas personalizadas.
- React Select: Para selects que permitan realizar busqueda, generalmente usado en modales donde se deben buscar o productos o codigos de productos en selects.
- Zustand: Para el almacenamiento por ahora de los datos, hasta que exista backend.
## Patrones de datos
El proyecto utiliza GrahpQL para las peticiones GET y API REST para las peticiones POST, PUT, DELETE.
- Se utiliza el archivo lib/graphql.ts para hacer las peticiones GET.
- Las queries están en la carpeta lib/queries/[modulo].queries.ts.
- Se utiliza el archivo lib/api.ts para hacer las peticiones POST, PUT, DELETE.






