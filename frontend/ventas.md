Las ventas se realizan de la siguiente manera,  se  
  tienen 3 "pasos": 1. El cajero busca el producto en  
  el inventario(ya sea producto normal, o producto     
  kit), si este es producto kit entonces puede hacer   
  como una orden de venta parcial, es decir, que       
  puede seleccionar parte de ese kit que se van a      
  agregar a la venta. Digamos yo tengo un kit con 3    
  piezas, puede que el cliente solo quiera 1 pieza de  
  ese kit, entonces esa orden seria parcial, además    
  de eso oviamente en la orden puedo agregar mas       
  producto normal o kit, tu entiedes ya el flujo.      
  Esta orden que se crea, se la envia al               
  almacenero(este es el nuevo rol), el almacenero va   
  a recibir la orden con los datos exactos que envió   
  el cajero, si le pidieron solo traer cierto          
  producto ahí le aparece solo traer cierto producto   
  o ciertas piezas de tal kit. Ahora el almacenero     
  tiene que poder aceptar la orden, es decir cada      
  almacenero tiene su propia cuenta y si aceptan la    
  orden de venta que lleva del cajero entonces esa     
  orden de venta solo la pueden copmletar ellos, y     
  solo les apareceria al que la aceptó. Ahora cuando   
  el cajero acepta la orden le aparecera todo lo que   
  tiene que llevar a caja, si es que no hay nada, se   
  puede marcar el producto como incompleto y enviar    
  una nota opcional que diga porque no está el         
  producto o pieza. Cuando el almacenero tiene todos   
  los productos tiene que marcar el pedido como        
  listo, una vez marcado como listo lleva los          
  productos de manera presencial al cajero. Ahí el     
  cajero corobora que son los productos que el         
  cliente pidió con el mismo cliente. En el momento    
  de concretar la venta, se hará lo siguiente,         
  fisicamente se habilita un punto extra que va a      
  serpara el rol (operador), en este punto se hace lo  
  siguiente: Una persona con pistola láser escanea     
  los productos físicos que el almacenero trajo. Al    
  escanear se confirma que el producto físico está
  ahí realmente. Para kits, en ese momento el
  operador selecciona qué partes se confirman y pone
  el precio libre. Al confirmar el escaneo es cuando
  se hace el descuento real del stock — no antes.
  Lo maneja un tercer rol — ni cajero ni almacenero.
  Es el operador del punto de escaneo, que está
  parado al lado de caja validando lo físico. Como no
  hay precios para las piezas entonces en el           
  frontend se habilitará un campo input para los que   
  son kit que ponga a cuanto está vendiendo las        
  piezas sueltas o nose y ese seria el precio al que   
  está vendiendo el kit. Entiendes como es el flujo y  
  lo que hay que hacer?, hazme preguntas.  


Entiendo el flujo completo. Preguntas antes de       
  diseñar:                                             
                                                       
  Sobre la orden:              
  1. ¿La orden tiene cliente asociado (nombre/teléfono)
   o es anónima?                                       
  2. Si el almacenero marca todo incompleto, ¿el cajero
   decide si cancela o sigue?                          
  3. ¿Puede el cajero cancelar una orden ya aceptada   
  por almacenero?

  Sobre precios:
  4. Productos normales — ¿precio viene del sistema o
  el operador también lo pone libre?
  5. ¿Descuentos del módulo existente aplican a ventas?

  Sobre almaceneros:
  6. Si hay 3 almaceneros conectados, la orden llega a
  todos y el primero que acepta la toma — ¿correcto?

  Sobre stock y cantidades:
  7. Si pido 2 unidades de un kit completo, ¿descuenta
  2 del kit y 2 × CantidadPorKit de cada pieza?
  8. ¿Qué pasa si el operador no escanea algo — ese
  ítem queda sin confirmar y no se descuenta?

  Sobre caja:
  9. Al completar la venta, ¿se registra
  automáticamente como movimiento en la caja del
  cajero, o el cajero lo registra manual?

───────────────────────────────────────────────────────
❯ 1. Eso depende si se lo quiere asociar a algun      
  cliente a la venta, la venta puede ser con o sin     
  cliente asociado. 2. Si. 3. Si puede cancelarla. 4.  
  4. No, ese precio viene del sistema. 5. Si, si se    
  selecciona un descuento definido entonces este se    
  tiene que registrar que se hizo descuento a ese      
  producto. 6. correcto 7. correcto 8. correcto. 9.    
  si, se registra automaáticamente.    

Claro. Antes de implementar, confirmo mi             
  entendimiento del modelo de datos:
                                                       
  Roles nuevos: Almacenero, Operador
                                                       
  Entidades nuevas:                                    
                                                       
  OrdenVenta — Id, Id_Cajero, Id_Almacenero?,          
  NombreCliente?, TelefonoCliente?, Id_Caja, Estado    
  (Pendiente/Aceptada/Lista/Completada/Cancelada),
  Fecha, FechaCompletada?, NotaCancelacion?

  OrdenVentaItem — Id, Id_Orden, Id_Producto, Cantidad,
   EsParcial, Estado (Pendiente/Incompleto/Confirmado),
   NotaIncompleto?, PrecioUnitario, Id_Descuento?

  OrdenVentaItemPieza — Id, Id_Item, Id_Pieza,
  Cantidad, PrecioUnitario (puesto por operador),
  Confirmado, NotaIncompleto?

  Preguntas pendientes:

  1. ¿NombreCliente + TelefonoCliente como strings
  opcionales es suficiente, o hay entidad Cliente
  separada planeada?
  2. Descuento en piezas de kit — ¿aplica sobre el
  precio que pone el operador, o descuentos solo para
  productos normales?
  3. El precio del producto normal en la venta — ¿usa
  Precio (ya en Bs con conversión) o requiere recalculo
   con TipoCambio en ese momento?
1. Deberia ser una entidad separada que se pueda    
  relacionar con las ventas para tener un historial y  
  posible fidelizacion en un futuro. Los campos        
  necesarios deberias ser básicos nomás, como          
  nombreCliente, apellido y telefonoCliente. 2. Esos   
  descuentos se aplican al precio base del producto.   
  Ya depende si se hace la venta con el precio de      
  importacion, o con el precio del dolar del dia. Si   
  se ingrsa manual el operador ya queda ese como       
  precio final sin descuento. Cuando se utilize el     
  precio de descuento se te enviará el id y valor del  
  desucento seleccionado junto con el producto. 4.     
  ya usa en Bs. Si no tienes mas pregutnas entonces    
  empezemos, empezaremos de apoco, no todo en uno.
















Flujo ventas
Endpoints de ventas — resumen por rol                
                                         
  ---                                                  
  CAJERO — crea y cancela órdenes
                                                       
  Endpoint: POST /api/OrdenVenta                     
  Qué hace: Crea la orden con los productos que el
    cliente quiere. Valida que tenga caja abierta.
    Reserva el stock. Notifica a todos los almaceneros
    via SignalR.
  ────────────────────────────────────────
  Endpoint: POST /api/OrdenVenta/{id}/Cancelar
  Qué hace: Cancela la orden. Libera todas las reservas

    de stock. Notifica al almacenero si ya había
    aceptado.

  ---
  ALMACENERO — gestiona la preparación física

  Endpoint: POST /api/OrdenVenta/{id}/Aceptar
  Qué hace: Toma la orden para él. Solo uno puede
    aceptarla. Notifica al cajero que alguien la tomó.
  ────────────────────────────────────────
  Endpoint: POST
    /api/OrdenVenta/{id}/Items/{itemId}/Incompleto
  Qué hace: Marca un producto que no pudo traer, con
    nota opcional explicando por qué.
  ────────────────────────────────────────
  Endpoint: POST /api/OrdenVenta/{id}/Lista
  Qué hace: Marca que ya tiene todo lo que pudo
    conseguir y va hacia caja. Notifica al cajero.

  ---
  OPERADOR — valida físicamente y cierra la venta

  Endpoint: POST
    /api/OrdenVenta/{id}/Items/{itemId}/Confirmar
  Qué hace: Escanea un producto regular o kit completo.

    En este momento se descuenta el stock real.
  ────────────────────────────────────────
  Endpoint: POST
    /api/OrdenVenta/{id}/Items/{itemId}/Piezas/{piezaIt
  emId}/Confirmar
  Qué hace: Escanea una pieza suelta de kit parcial. El

    operador pone el precio manualmente. Descuenta
  stock
     de esa pieza.
  ────────────────────────────────────────
  Endpoint: POST /api/OrdenVenta/{id}/Completar
  Qué hace: Cierra la venta. Calcula el total de lo
    confirmado, crea el movimiento en la caja del
  cajero
     como ingreso de Ventas, y notifica a todos via
    SignalR.

  ---
  Flujo resumido:

  Cajero crea orden
      ↓ SignalR → Almaceneros ven NuevaOrden
  Almacenero acepta
      ↓ SignalR → Cajero ve OrdenAceptada
  Almacenero marca ítems incompletos (opcional)
  Almacenero marca Lista
      ↓ SignalR → Cajero ve OrdenLista
  Operador escanea cada producto/pieza
  Operador completa
      ↓ Stock descontado, MovimientoCaja creado,
  SignalR OrdenCompletada
