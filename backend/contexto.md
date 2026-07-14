## Contexto: qué estás construyendo
Tenemos un ERP para una importadora de autopartes. Los productos pueden ser de dos tipos:
- Producto normal: vive solo, tiene su propio stock, se vende como unidad.
- Producto kit: está compuesto por piezas. Cada pieza tiene una cantidad requerida para armar un kit completo. Las piezas se pueden vender sueltas sin vender el kit completo. El sistema también permite importar productos masivamente via Excel, donde los productos existentes suman stock y los nuevos se crean.

El problema central: dos fuentes de verdad
La base de datos tiene esto:
```
Producto.Stock_Actual        ← campo en la tabla de productos
PiezaKit.StockActual         ← campo en la tabla de piezas
```

Para un kit, ambos campos intentan representar el stock al mismo tiempo. Eso es una contradicción. En cuanto el stock de una pieza se mueve por cualquier razón (venta parcial, importación, ajuste), uno de los dos queda desactualizado. Y el sistema no tiene forma de saber cuál está mintiendo.

## Qué está mal ahora mismo
1. Problema 1 — Producto.Stock_Actual no debería escribirse directo para kits

El stock real de un kit vive en sus piezas. Producto.Stock_Actual para kits solo debería existir como un número calculado que se actualiza como consecuencia de cambios en las piezas, nunca como origen. Si en algún lugar del código escribes directo a Producto.Stock_Actual para un kit sin pasar por las piezas, ese es el camino que va a desincronizar todo.

2. Problema 2 — El campo Piezas en la tabla Producto es basura
Mirando los datos reales, ese campo es un integer que vale casi siempre 1, a veces 0. No sirve para nada ahora que tienes la tabla PiezaKit. Es un remanente de antes. No lo uses para ninguna lógica y eventualmente elimínalo.

3. Problema 3 — StockReservado existe en las dos tablas y nadie definió cuál manda
Tienes Producto.StockReservado y PiezaKit.StockReservado. Misma pregunta que con el stock: cuando reservas piezas de un kit, ¿cuál actualizas? Si no tienes una regla explícita y consistente en todo el código, vas a tener el mismo desastre que con el stock principal.

4. Problema 4 — Las ventas parciales pueden dejar el kit en estado "0 ensamblables pero con piezas en bodega"

Esto no es un bug, es la realidad del negocio. Pero si tu UI solo muestra Producto.Stock_Actual sin distinguir stock ensamblable de stock físico, el dueño va a ver cero y va a pensar que no tiene nada, cuando en realidad tiene piezas sueltas en SUS CAJAS en bodega.

## Las reglas que tiene que seguir todo tu código
1. Regla 0 — El único lugar donde se escribe stock de un kit es PiezaKit.StockActual
Producto.Stock_Actual para kits es de solo lectura desde el punto de vista de la lógica de negocio. Se calcula así:
```
Stock_Actual (kit) = min(PiezaKit.StockActual / CantidadPorKit)
                     para todas las piezas del kit
```
Después de cualquier operación que toque piezas, recalculas y guardas ese valor en Producto.Stock_Actual. Nunca al revés.

2. Al crear un kit con stock inicial de N:
```
    Por cada pieza:
        PiezaKit.StockActual = N × CantidadPorKit

    Producto.Stock_Actual = N   (o recalculado desde piezas, da lo mismo)
```

3. Al vender N kits completos:
```
    Por cada pieza:
    PiezaKit.StockActual -= N × CantidadPorKit

    Producto.Stock_Actual = recalcular min(StockActual / CantidadPorKit)
```

4. Al vender X unidades sueltas de una pieza:
```
    PiezaKit.StockActual -= X   (solo esa pieza)

    Producto.Stock_Actual = recalcular min(StockActual / CantidadPorKit)
```
Después de esto el kit puede quedar en 0 ensamblables aunque otras piezas tengan stock. Eso es correcto, es la realidad física.

5. Al importar N unidades de un kit via Excel:
```
Por cada pieza:
    PiezaKit.StockActual += N × CantidadPorKit

Producto.Stock_Actual = recalcular min(StockActual / CantidadPorKit)
```
Si las piezas estaban desbalanceadas por ventas parciales previas, el stock ensamblable resultante va a ser menor que stock_anterior + N. Eso no es un error, es correcto. El dueño puede ver el detalle pieza por pieza si quiere entender por qué.

## Al ajustar stock manualmente:
La UI no debe permitir escribir un número directo en el stock del kit. Debe pedir un delta: "¿cuántas unidades agregar o quitar?", y ese delta se distribuye a las piezas multiplicado por su cantidad.
```
Por cada pieza:
    PiezaKit.StockActual += delta × CantidadPorKit

    Producto.Stock_Actual = recalcular
```
Si el usuario quiere ajustar una pieza específica porque físicamente tiene una cantidad diferente, que lo haga directamente en la pieza, no en el kit.

## Los dos conceptos de stock que debes mostrar en la UI
1. Para productos normales, solo hay uno: Stock_Actual.
2. Para kits, hay dos y debes mostrar ambos en la ficha del producto:
- Stock ensamblable — cuántos kits completos puedo armar ahora mismo. Este es el que va en el listado general de inventario. Se calcula como min(StockActual / CantidadPorKit) para todas las piezas.
- Stock físico — cuántas piezas individuales existen en bodega en total, aunque estén incompletas. Se calcula como sum(StockActual) de todas las piezas. Este no tiene mucha utilidad operacional pero refleja la realidad de la bodega.
- En el listado general, muestra el ensamblable. En la ficha del kit, muestra ambos con una nota tipo "X kits completos · Y piezas en bodega".

## Qué eliminar o ignorar
- Producto.Piezas — no lo uses para ninguna lógica. Un kit es kit si tiene filas en PiezaKit, no por este campo. Elimínalo cuando puedas hacer la migración sin romper nada.

- Producto.EsKit — no es un error tenerlo, pero es redundante. Puedes calcularlo como EXISTS (SELECT 1 FROM PiezaKit WHERE Id_Producto = ?). Si lo dejas, asegúrate de que siempre esté sincronizado con la existencia real de piezas.

## IMPORTANTE
No usar deserializacion