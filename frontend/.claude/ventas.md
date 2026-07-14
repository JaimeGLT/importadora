Flujo completo del sistema de ventas de repuestos (Negocio de mostrador - Cochabamba)

1. Búsqueda del producto

El cajero busca el repuesto mientras el cliente está en el mostrador. La búsqueda funciona por número de parte, descripción, o filtro por vehículo (marca → modelo → año). El sistema muestra en tiempo real el stock disponible, calculado así:

Stock disponible = Stock total - Stock reservado

Nunca se muestra el stock total crudo porque puede inducir a error. Si hay varias marcas o calidades del mismo repuesto, el sistema las muestra todas para que el cajero elija con el cliente.

Validaciones:





Si el stock disponible es 0, el sistema advierte antes de continuar



Si hay productos similares de distintas marcas, se muestran todos

2. Creación de la orden de venta

Como el cliente está parado en el mostrador y decide en el momento, no hay cotización. El cajero arma la orden directamente con los productos que el cliente pidió y confirma.

En este momento exacto ocurren dos cosas:





Se genera la orden de venta formal



Se reserva el stock inmediatamente

La reserva significa que esas unidades quedan bloqueadas para esta orden y ningún otro cajero puede venderlas. El stock disponible baja inmediatamente en las pantallas de los otros cajeros en tiempo real.

Validaciones críticas:





Si entre que el cajero armó la orden y la confirmó otro cajero vendió las últimas unidades, el sistema alerta antes de confirmar



Si la orden tiene varios productos y uno no tiene stock, el sistema pregunta: ¿confirmar solo los que tienen stock o cancelar todo?



Si dos cajeros intentan vender el mismo producto al mismo tiempo, solo el primero en confirmar obtiene la reserva, el segundo recibe alerta de stock insuficiente

3. Generación de la orden de picking

Una vez confirmada la venta, el sistema genera automáticamente la orden de picking que les llega a los almaceneros de dos formas simultáneas:





📺 Aparece en la pantalla del almacén



🖨️ Se imprime el ticket en la impresora térmica del almacén

El ticket impreso muestra por cada producto:

Orden #045 — Cajero: Juan
──────────────────────────────
1. Filtro aceite Toyota
   Código:      FT-2234
   Cantidad:    2 unidades
   Ubicación:   Estante B3
──────────────────────────────
2. Pastillas freno Nissan
   Código:      PF-1190
   Cantidad:    1 unidad
   Ubicación:   Estante A1
──────────────────────────────

Validaciones:





Solo se genera picking para productos con reserva confirmada



Si un producto no tiene stock, no va al picking, el cajero ya fue alertado en el paso anterior

4. Proceso de picking en almacén

El almacenero disponible ve las órdenes pendientes en su pantalla y toma una orden. En ese momento la orden se bloquea para él y el otro almacenero no puede tomarla.

Pantalla almacén:
Orden #045 — 3 productos  [Tomar]
Orden #046 — 1 producto   [Tomar]
Orden #047 — 2 productos  [Tomar]

Con el ticket en mano y la pistola, va al almacén. Por cada producto:





Va a la ubicación indicada en el ticket



Toma las unidades físicas



Escanea el código de barras con la pistola



El sistema valida en pantalla:

✅ FT-2234 - Filtro aceite Toyota — CORRECTO
   Ingresa cantidad recogida: [2]

❌ Código no pertenece a esta orden
   Vuelve al estante y busca FT-2234

Validaciones de cantidad:





Si la cantidad es igual a la solicitada → ítem marcado como completo ✅



Si la cantidad es menor → picking parcial, registra cuántas se encontraron



Si la cantidad es mayor → el sistema lo rechaza, no puede despachar más de lo vendido



Si no encuentra el producto → puede reportar discrepancia, genera alerta para el administrador

5. Picking parcial — decisión del cajero
Si el almacenero no pudo completar todos los productos, el cajero recibe una notificación en tiempo real con el detalle:
Orden #045 — Picking incompleto
✅ Filtro aceite Toyota   2/2 encontrados
❌ Pastillas freno Nissan 0/1 encontrados
El cajero habla con el cliente y elige una opción en el sistema:

Entregar lo que hay → se factura solo lo encontrado, lo que falta se anota para cuando llegue
Cancelar toda la orden → se libera toda la reserva de stock

Validaciones:

Si se entrega parcial, la factura refleja solo lo que físicamente sale del almacén
Las unidades no despachadas vuelven al stock disponible inmediatamente


6. Descuento definitivo del stock
El stock solo se descuenta de forma definitiva cuando el picking queda confirmado y la mercadería va a salir del almacén. Hasta ese momento solo estaba reservado.
El sistema registra un movimiento de salida con:
Fecha y hora:     19/04/2026 10:32
Orden de venta:   #045
Producto:         FT-2234
Cantidad:         2 unidades
Almacenero:       Carlos
Ese registro es permanente, no se puede borrar, solo corregir con un movimiento inverso documentado.

7. Facturación y cobro
Con el picking confirmado, el cajero genera la factura. El sistema no permite facturar si el picking no está confirmado.
La factura se basa en lo que realmente se despachó, no en lo que se ordenó originalmente. Métodos de pago: efectivo, tarjeta o QR.
Validaciones:

No se puede facturar sin picking confirmado
La factura una vez emitida no se modifica, si hay error se anula y se emite una nueva, ambas quedan registradas


8. Entrega al cliente
El almacenero lleva las piezas al mostrador. El cajero entrega al cliente junto con su factura. La orden queda cerrada.

9. Cierre del día
Al final del día el sistema permite cuadrar:
Lo vendido = Lo despachado = Lo cobrado
Si estos tres números no coinciden hay un error en algún paso que debe investigarse. Todo movimiento queda registrado con usuario, fecha y hora.


# notas importantes
El módulo de ventas debe ser completamente en tiempo real, el backend esta hecho con c# mediante ASP.NET Core SignalR para los websockets, como ahora no hay conexion, puedes simular todo pero que sea en tiempo real.