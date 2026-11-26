# Cotizador GZ Refrigeración — contexto y especificación

Estado al 17/08/2026. Base: `calculadora_gz_v14.html` publicada en
https://cotizadorgz.github.io/cotizador/calculadora_gz_v14.html

Fuentes de verdad: la **LISTA DE PRECIOS MAYO 2026 v3** (4 páginas) y las fórmulas
de abajo. Ante duda, manda la lista de precios.

---

## Estado

**Núcleo del motor v15 construido y verificado** (19/08/2026): `src/motor.js`,
`src/precios.js` (panel editable: tarifas, tablas, rangos, ajustes, dólares),
`src/perfiles.js` (los 15 productos) y `src/modelos.js` (catálogo publicado).
Suite de regresión en `test/regresion.html` — **737/737 casos exactos** contra la lista
publicada, más los bugs de la v14, las decisiones tomadas y el catálogo completo.

**Pantalla de cotización construida** (20/08/2026): `index.html`, `src/app.js`,
`src/estilos.css`. Los 15 productos con catálogo por HP y modo a medida, desglose
visible, ventiladores con stepper, las 4 columnas de precio y el texto para el cliente.
Los dos dólares se persisten por dispositivo. Archivos de PWA reales (`sw.js`,
`manifest.json`, iconos) — el service worker va **red primero, cache de respaldo**:
es una app de precios, vale más esperar que cotizar con una lista vieja.

**Panel de precios construido** (20/08/2026): `src/panel.js`. Recorre `PRECIOS` y arma
un campo por cada número editable — **142 campos en 11 grupos**, sin lista escrita a mano:
si mañana aparece un producto nuevo en `precios.js`, sus números aparecen solos.
Los cambios se guardan por dispositivo y se sincronizan con Exportar / Importar
(archivo o portapapeles). Botón **"Volver a fábrica"** para descartar todo.

La red de seguridad es **"Verificar contra la lista"**: después de cada edición corre
los 59 modelos publicados de `src/lista-publicada.js` y avisa cuáles dejaron de dar el
precio impreso. Ese archivo salió de `test/` a `src/` justamente para que lo usen las
dos cosas — la suite y el panel.

**Presupuesto multi-ítem construido** (20/08/2026). Se agregan ítems desde el resultado
de cada cotización; el **embalaje vive en el presupuesto**, no en el ítem, así que se
cobra una sola vez por pedido. El pedido se guarda en el dispositivo: si cerrás la app
en la mitad, sigue ahí.

Los importes en pesos se acumulan **ya redondeados línea por línea**, de modo que si el
cliente suma lo que ve le da exactamente el total impreso. La pantalla y el texto que se
copia salen los dos de `preciosPresupuesto()`, así que nunca pueden diferir.

**Historial construido** (20/08/2026): `src/historial.js`. Se registra solo cada vez
que se copia algo para un cliente — ítem suelto o presupuesto — con la fecha, el dólar
de ese día y **el texto tal cual salió**. Ordenado por día (Hoy / Ayer / fecha), tope
de 200 entradas. Cada entrada ofrece **Copiar como se envió** (el texto histórico, con
el dólar de aquel día) y **Recargar en el presupuesto** (para volver a cotizarlo al
dólar de hoy). El registro se hace antes de tocar el portapapeles: el historial es de
lo que cotizaste, no de si el copiado funcionó.

**Pantalla en celular** (20/08/2026): la grilla de 15 productos se pliega a un renglón
apenas elegís uno, con un botón "Cambiar" para volver a abrirla — pasa de 572px a 94px,
media pantalla de teléfono recuperada. Se descartó el desplegable de la v14: con 15
productos el selector nativo de iOS es una rueda que se lee de a un ítem por vez.

**Texto al cliente** (20/08/2026): todo lo que se copia arranca con
`*Presupuesto GZ Refrigeración*` y una segunda línea con el **nombre del cliente
(opcional)** y la fecha y hora. Ninguna columna de precio viene tildada de arranque:
se elige la que se quiere mandar y se pueden marcar varias.

**Respaldar estático = estático** (21/08/2026): el respaldar pasó a calcularse con la
misma fórmula que el evaporador estático 5/8" —batería + curvas + markup por tamaño— y
dejó de llevar el factor 1,04. Con la misma medida los dos dan **exactamente el mismo
precio**; lo único que los distingue es el nombre en la cotización. **Pendiente**: el
estático redondea para arriba cuando el decimal es ≥ 0,75 y el respaldar todavía no —
falta confirmar si también lo lleva.

**El respaldar llega hasta 16 secciones** (27/08/2026): cortaba en 8 y hacía falta 9 o
más. Como es literalmente la fórmula del estático, se le puso el mismo techo: **16**,
que es hasta donde llega la tabla de markup. Ese mismo día se definió el markup de 17 a 20
(ver abajo) y los dos rangos subieron a **20**.

**El markup por tamaño pasó al panel** (27/08/2026): la tabla de tramos
(3-5→4 · 6-8→6 · 9-12→8 · 13-14→10 · 15-16→12) estaba escrita en `perfiles.js`, que es
justo lo que el proyecto no hace: **ahora vive en `PRECIOS.markupEstatico`** y se edita
desde el panel. Dos consecuencias:

- La explicación del desglose **se arma desde la tabla**, así que agregar un tramo lo
  dice solo. Antes era un texto a mano que quedaba viejo al primer cambio.
- Arriba del último tramo el motor **ya no estira el importe**: avisa
  (`la tabla llega hasta 20 secciones y acá hay 22`) y no cotiza. Es el mismo criterio
  que el resto de las tablas — el bug #6 de la v14 era exactamente estirar en silencio.
  Antes esto no se notaba porque el rango cortaba en 16; **desde que el rango se puede
  ampliar desde el panel, la red hacía falta**.

De paso, el panel rotulaba **"hasta 5HP"** los tramos que en realidad son de secciones
(el markup y los costados del lateral doble). Ahora dice **"hasta 5 sec"** donde
corresponde, y sigue diciendo HP en col/dist.

**Markup de 17 a 20 secciones** (27/08/2026, decidido por Gabriel): la serie de la
lista sube **$2 cada dos secciones**, y se continúa igual — **17-18 → $14 · 19-20 → $16**.
Con eso el evaporador estático y el respaldar cotizan hasta **20 secciones**; de 21 en
adelante hay que agregar el tramo en el panel, y hasta que se agregue el motor avisa.
El título de MercadoLibre del peor caso (estático de 20 secciones × 3m) sigue dando
**60 justos**, así que el rango nuevo no lo desborda.

**Respaldo de cámara, 5 secciones dobles = $188/m** (27/08/2026): no está en la lista
impresa, sale de la **tabla hermana**. El lateral doble y el respaldo de cámara comparten
los tres valores que las dos tablas tienen —4 → 156, 6 → 218, 7 → 248— y el lateral doble
publica **5 → 188**. Los otros tres huecos (11, 13 y 14) **no se completaron**: el 11 caería
simétrico en 371, pero 13 y 14 caen entre 403 y 467, que no reparte en enteros. Se dejan
avisando hasta tener el dato.

## Las tres secciones (27/08/2026)

Tarjeta plegable propia, **abajo del todo y siempre a mano** — no cuelga de una
cotización, porque sirve justo al revés: para **reconocer un equipo que ya está armado**.
Se mide el alto de una sección y de ahí sale la familia.

    Sección Simple 5/8"     16 cm   ·  caño 5/8" · aleta 75 × 70 mm · aletas cada 10 mm
    Sección Doble 5/8"       6 cm   ·  caño 5/8" · aleta 60 × 60 mm · aletas cada 10 mm
    Sección Compacta 3/8"    5,5 cm ·  caño 3/8" · aleta 29 × 25 mm · aletas cada 8 mm
                                       (o 4 mm en las especiales)

Cada sección lista **qué productos la usan, sacado de los perfiles** (`perfil.aleta`),
no de una lista escrita a mano: si mañana cambia la aleta de un producto, la tarjeta lo
dice sola. Las carniceras aparecen en las dos, aclarando el modelo —3 secciones simples
o 4 dobles—, porque su aleta depende del modelo elegido.

El alto de cada sección entró en `PRECIOS.aletas[*].alto`, en **mm** porque así se mide,
y es editable desde el panel como cualquier otro número.

**Varios ítems libres, cooler y ventiladores a precio real** (03/09/2026)

**Ítems libres, ahora varios.** Había uno solo; ahora se agregan los que hagan falta
con **"+ Agregar otro ítem"**, y cada uno de más se saca con la ×. La primera fila
queda siempre a la vista, como antes. En el motor viajan en `extras`; `extra` en
singular se sigue aceptando porque lo usan las cotizaciones viejas.

Los nombres repetidos **se numeran** (`Adicional`, `Adicional 2`): el nombre es la
llave con la que se destilda una línea del desglose, así que dos iguales se sacarían
juntas. El nombre sale de un solo lugar —`itemsLibres()` en `motor.js`— y de ahí lo
toman el desglose, el texto al cliente y la publicación de ML, que no pueden diferir.
En el texto al cliente van enumerados en una frase (`— con patas reforzadas, adicional
y adicional 2`) en vez de repetir "— con" por cada uno.

**Coolers: en los 15 productos, USD 15 cada uno, con cantidad.** Viven en el desglose
al lado del colector, con un stepper igual al de los ventiladores y el importe a la
vista aunque la cantidad sea 0. Van a **precio final**, no a costo: entran derecho por
su importe, **sin el ×1,5 de los ventiladores** — es el mismo trato que los costados de
aluminio o la salida de cobre. El número está en `PRECIOS.adicionales.cooler`, editable
desde el panel.

La **cantidad manda**: `estado.coolerCant` es la única fuente de verdad y 0 es apagado;
la casilla no es más que un atajo para prenderlo en 1 y apagarlo. El renglón se llama
`Cooler` con uno y `3 × cooler` con varios, igual que los ventiladores, y el texto al
cliente sale `— con 3 coolers`. En el motor `cooler` es un número; `true` vale 1, para
las cotizaciones anteriores al 03/09/2026, cuando era una casilla sin cantidad.

**Ojo**: en la prueba a medida (`src/amedida-prueba.js`) el cooler está modelado como
un ventilador —`PRUEBA.cooler × 1,5`— y sigue en 0, esperando número. Ahí el cooler es
el ventilador del equipo, no un adicional, así que puede ser correcto que lleve markup;
**no se tocó**. Si tiene que valer lo mismo que acá, hay que decidirlo.

**El ventilador de 300mm se cobraba mal.** En techo 5/8", techo 3/8", lateral doble,
lateral simple y doble ataque, elegir un 300mm cobraba **$37,50** —el precio de un 200
o un 250— en vez de los **$66** que sale. Los cinco pasaron a `ventTarifa: "real"`.

No movió **ningún** precio publicado: los modelos de la lista llevan 200 o 250, que a
tarifa real cuestan lo mismo ($25 → $37,50). Las 59 filas siguen dando al centavo.

La tarifa **fija** queda ahora exactamente donde la decisión del 19/08/2026 dice que
tiene que estar: **lateral compacto, carniceras y piso torteras**. Antes el código la
aplicaba a cinco productos más que la decisión no mencionaba.

**El 300mm pasó a precio real en los 15 productos** (02/10/2026, decidido por Gabriel).
Los tres que habían quedado en tarifa fija —lateral compacto, carniceras y piso
torteras— seguían cobrando **$37,50** por un ventilador que **cuesta $44 (→ $66)**:
$28,50 de pérdida cada vez que se elegía uno. Esto **revisa la decisión del 19/08/2026**,
que decía tarifa fija "aunque se elija un v300": esa cláusula queda sin efecto.

**No movió ningún precio publicado**, por el mismo motivo que el 03/09: los modelos de
la lista llevan 200 o 250, que valen $25 en las dos tarifas. Las 59 filas siguen al
centavo y el panel sigue diciendo "Todo coincide con la lista impresa".

`ventiladores.costoFijo` queda en `precios.js` sin ningún producto que lo use. **No se
borró**: es un número del panel y sacarlo rompería los `gz15.precios` exportados que
lo tengan. Si en algún momento vuelve a hacer falta una tarifa plana, está ahí.

**De paso, un bug latente**: `app.js` calculaba el precio que se MUESTRA en el stepper
con una copia de la regla (`ventTarifa === "fija" ? costoFijo : costo`) en vez de llamar
a `costoVentilador()`. Mientras las dos copias coincidieran no se notaba, pero la de
`app.js` además ignoraba que `ventTarifa` puede ser una función del equipo. Ahora la
pantalla y el motor salen de la misma función: no pueden decir precios distintos.

**Dos renglones libres en el desglose** (21/08/2026): al final del desglose van
**Colector y distribuidor** e **ítem libre** (nombre e importe a elección), los dos
destildados. Están en los 15 productos: en cúbico y respaldo de cámara **conviven** con
el col/dist automático por HP, que sigue apareciendo como componente calculado — uno es
el que va con el aparato y el otro se agrega a mano. Si el ítem libre queda sin nombre
se cobra como "Adicional", nunca como un cargo sin identificar. Los dos se aclaran en el
texto al cliente (`— con colector y distribuidor — con patas reforzadas`).

**Explicaciones por componente** (21/08/2026): tocando el nombre de un renglón del
desglose se abre cómo se calcula — el rango de los costados, la tabla de precio/metro,
el markup del ventilador, los tamaños de bandeja. **Salen del panel de precios**, así que
si cambiás un valor la explicación lo refleja sola y nunca queda desactualizada.

**Bug del formulario, corregido** (21/08/2026): los `defaults` del perfil (por ejemplo
`uniones: 0` en la columna para batea) se aplicaban dentro de `cotizar()` pero nunca
llegaban al formulario, así que el campo quedaba vacío y **Calcular no se habilitaba
nunca** para ese producto. El grupo "Todos cotizan" de la suite ahora barre los 15
productos con valores válidos y verifica el total de cada uno contra la fórmula.

**Coma o punto** (20/08/2026): el teclado del iPhone en español escribe coma y un
`input type=number` sólo acepta punto, así que lo tipeado se perdía en silencio. Los
campos con decimales pasaron a `type=text` con `inputmode=decimal` y todo se lee con
`leerNumero()`, que acepta las dos. Los campos enteros siguen siendo `number`.

**Historial plegable** (20/08/2026): se titula **"Historial en este dispositivo"**, para
que quede claro de entrada que no se comparte entre la PC y el celular. Arranca cerrado,
con la cantidad de cotizaciones en el encabezado, y cada renglón tiene su botón **Copiar** sin necesidad
de desplegarlo.

**Grilla reordenable** (20/08/2026): botón "Customizar grilla" con flechas para subir y
bajar cada producto. El orden se guarda por dispositivo y tolera que aparezcan productos
nuevos —se agregan al final— con un botón para volver al orden original.

**Desglose plegable con ítems que se sacan** (20/08/2026): el desglose arranca cerrado
y el encabezado muestra el total. Al abrirlo, cada **componente** —batería, ventiladores
y adicionales— tiene un casillero tildado: al destildarlo la línea queda tachada, a la
vista con su importe, pero deja de sumar. Los renglones **derivados** (baja temperatura,
cantidad, embalaje) no llevan casillero porque son consecuencia de los otros, y la baja
temperatura se aplica sobre la base ya recortada. El texto al cliente agrega
`_No incluye: salida de cobre_`, y dentro de un presupuesto la aclaración va debajo del
ítem que corresponde. Cambiar cualquier dato del producto vuelve a tildar todo.

**Ayudas en el formulario** (20/08/2026): cada campo numérico trae un ejemplo de
relleno (`ej. 12`, `ej. 0.36`) y los dos compactos de 3/8" —evaporador estático y
forzador lateral— muestran la referencia de secciones a HP que tenía la v14:
`8 sec = 1/3HP · 12 = 1/2HP · 16 = 3/4HP · 20 = 1HP`. Son los únicos dos productos
donde la v14 la mostraba, porque son los que se piden por secciones.

**Botón Calcular** (20/08/2026): los precios no aparecen hasta apretarlo, como en la
v14. Cualquier cambio en el producto —medida, modelo, opciones, ventiladores, cantidad—
apaga el resultado y hay que volver a calcular: si hay un precio en pantalla, es el de
lo que está cargado. El embalaje y el nombre del cliente sí actualizan en vivo, porque
son datos del pedido y no del producto. El botón queda deshabilitado mientras falte
algún campo.

**Medidas en el texto al cliente** (20/08/2026): los productos que se identifican por
su medida la llevan, en formato `3 sec x 3,70m` con dos decimales siempre —estáticos,
los tres laterales, columna para batea, doble ataque y piso torteras—. **No la llevan**
cúbico, respaldo de cámara, carniceras, condensador ni los dos de techo: en el techo el
ancho es el de la batería, idéntico en todos los modelos, así que no le dice nada al
cliente y el HP ya identifica el equipo.

### Alcance del guardado local

Todo lo que la app guarda —historial, presupuesto en curso, precios editados y los dos
dólares— vive en el `localStorage` **de ese navegador en ese dispositivo**. No hay
sincronización: lo que cotiza Gabriel en el celular no aparece en la PC de su hermana
ni al revés. El panel de precios tiene Exportar/Importar justamente para cubrir eso a
mano; el historial todavía no.

**La v15 está funcionalmente completa.** Falta probarla en uso y publicarla.

## Arreglo: copiar condensador con ventilador (25/11/2026, app 17.4)

**Síntoma**: en Condensadores, con la casilla "Con ventilador" tildada, "Copiar para el
cliente" no hacía nada. Sin ventilador copiaba bien.

**Causa**: al copiar, el historial arma también la descripción de ML
(`descripcionML` en `src/mercadolibre.js`). Ahí la casilla del condensador, que es una
función `(e, P)` porque nombra el ventilador desde la lista de precios, se llamaba sin
`P` → `TypeError` y el clic moría antes de llegar al portapapeles. Publicar en ML un
condensador con ventilador tenía el mismo problema.

**Arreglo**: `mercadolibre.js` importa `PRECIOS` y se lo pasa a la casilla. De paso, el
resumen de la ficha técnica tiraba error en cada cálculo del condensador (tiene
frigorías pero no superficie): ahora muestra sólo las frigorías. Caso nuevo en la
regresión → **824/824**. Cache del service worker `gz-v15-29`.

## Evaporador para góndola (16/11/2026, app 17.3)

Producto nuevo `gon`, en la grilla después de la columna para batea. Se vende como la
columna —por metro— pero **siempre enchapado**, en dos medidas:

    6 secciones  $176 por metro
    8 secciones  $224 por metro

- **Colector y distribuidor tildado por defecto** con $30 (`adicionales.colectorGondola`,
  editable en el panel). Se puede destildar o cambiar el monto en el desglose. Los $30
  son el col/dist del cúbico en su primer tramo (2 y 2,5HP): **a confirmar**, porque el
  del cúbico va por HP y la góndola no tiene HP.
- **Ventiladores** 200/250/300 a los precios de siempre (300 a precio real, $66) y
  casilla de **300mm reforzados** ($90), igual que el cúbico. Arranca sin ventiladores.
- Aleta doble y largo hasta 9m como la columna: **provisional**, sin confirmar.
- Grupo "Góndola" en la suite.

## Aviso de despacho (27/10/2026, app 17.2)

Caja plegable **"Aviso de despacho"** en la pantalla principal: foto del remito de Vía
Cargo → mensaje para el comprador de ML. Reemplaza a la página de prueba
`prueba-despacho.html`, que se borró. Lectura en `src/despacho.js`, pantalla en
`src/despacho-app.js`, 42 casos en la suite (grupo "Aviso de despacho").

**Por qué texto y no la foto:** ML rechaza la foto del remito ("incumple nuestras
políticas") por los teléfonos, CUIT y domicilios. Y la mensajería corta en **350
caracteres**: la app cuenta y avisa si se pasa.

**El formato acordado** (no lleva la firma GZ: no hacía falta y suma caracteres):

```
Hola! Ya despachamos tu pedido por Vía Cargo.
Guía: 999039578401
Remito: 5535-52895
Fecha: 27/10/2026
Destino: Florencio Varela (entrega a domicilio)
Destinatario: Carlos Sycz
1 bulto - 7 kg
Total a abonar en destino: $32.000
Avisanos cuando lo recibas. Gracias!
```

De dónde sale cada campo, medido con fotos reales:

- **Guía**: del código de barras (Code 128, con checksum) y contrastada contra el OCR.
- **Remito, destinatario**: OCR de la hoja entera.
- **Destino**: OCR de una zona recortada de la mitad derecha. Con **ENTREGA A
  DOMICILIO** el destino es la localidad del comprador, no la sucursal
  (`HUDSON(CDS11)` → Florencio Varela).
- **Importes y peso**: OCR de la tabla de servicios recortada, x3 en gris. Renglón por
  renglón: el primer monto de P. REEMBOLSO **no va** (es plata para el remitente); la
  comisión de al lado sí. Si queda un importe ilegible, hace una segunda pasada.
- **Fecha**: la de hoy, editable. El recuadro de fecha no se lee.

**El total siempre se confirma a mano.** En una foto con un pliegue el OCR leyó
14.349,99 donde decía 14.949,99 las tres veces que se probó. Como el total de Vía Cargo
vino **redondo en miles** en los cuatro remitos vistos, una suma que no cierra en miles
dispara un aviso en rojo.

Opción **"Guía con guiones"** (`9990-3957-8401`) por si el filtro de ML toma los 12
dígitos por un teléfono. Los destinos corregidos a mano se recuerdan (`gz15.despacho`).

**Nunca guardar remitos en esta carpeta**: se publica en GitHub y tienen nombre,
domicilio, teléfono y DNI del comprador. La suite usa textos inventados.

## Publicación en MercadoLibre (26/08/2026)

Botón **Publicar** en la fila de MercadoLibre del resultado y en cada renglón del
historial. Habla con el bot de GZ, que corre 24/7, tiene el token de ML y crea la
publicación a partir de la plantilla `MLA2029099995`.

    POST https://gzbot.duckdns.org/publicar
    headers: X-API-Key · Content-Type: application/json
    body: titulo · descripcion · precio · plantilla · clave_idempotencia · pausar_a_las_horas
    200: { ok, item_id, titulo, link, precio, pausa_programada }
    error: { ok:false, error } con HTTP 400 / 401 / 429 / 500
    409: duplicado reciente (mismo título, precio y plantilla en los últimos 30 min).
         Trae además item_id y link de la publicación que ya existe: se muestra como
         aviso con el link, no como error.

**La clave no está en el repositorio** — la app es pública. Se le pide al usuario una
vez y queda en `localStorage` de ese dispositivo, igual que los dólares. CORS no es
seguridad: sólo la clave protege la cuenta.

### El título (corregido el 26/08/2026)

ML **pausó una publicación** porque el título empezaba con el modificador
(`A Medida - Columna Para Batea`). Tomando como referencia las 33 publicaciones activas
de la cuenta que nunca fueron moderadas, el patrón que funciona es:

    Evaporador → tipo → especificaciones → "A Medida" al final

Ejemplos aceptados por ML: `Evaporador Forzado Cúbico Para Cámara Frigorífica 3/4 Hp`,
`Evaporador Columna Para Batea Carnicera 3x1.70 Mtrs`.

Reglas: **empezar siempre por el producto** (28 de 33 arrancan con "Evaporador"), nunca
por un modificador, y no pasar de 60 caracteres. Cada producto tiene nombre largo y
corto: si no entra, se acorta la aplicación (`Para Cámara Frigorífica` → nombre corto),
después se saca "A Medida" y por último la especificación.

La **especificación** es el HP si el producto lo tiene, y si no la medida
(`4x1,70 Mtrs`). Es lo que distingue una publicación de otra. Verificado con el peor
caso de los 15 productos: el más largo da 60 justos.

**El nombre del cliente salió del título.** Con la especificación adentro ya se
distinguen entre sí, y un nombre propio en un título público es exactamente el tipo de
cosa que ML modera.

**Todo el detalle va en la descripción** — medida, aclaraciones, lo que no incluye,
plazo de fabricación y vencimiento.

**Dos protecciones distintas y complementarias**: la clave de idempotencia cubre el
corte de conexión (mismo pedido reintentado) y el 409 del servidor cubre el doble clic
(dos pedidos iguales seguidos). Hacen falta las dos.

**Clave de idempotencia** generada al apretar Calcular, una por cotización. Si se corta
la conexión y se reintenta, el bot devuelve la publicación original en vez de crear una
segunda. Se renueva sola al cambiar cualquier dato del producto.

Cuando una publicación sale bien, **el link queda pegado a esa cotización en el
historial** (por la clave de idempotencia). El renglón muestra una marca `ML` y adentro
aparece **Copiar link de la publicación**, para recuperarlo días después sin entrar a
MercadoLibre. Si se publicó sin haber copiado el texto antes, se crea una entrada nueva.

La publicación **se pausa sola a las 24 horas** (no se borra: es reversible y no se
pierden las preguntas). La foto 2 de la plantilla la saca el bot, no la calculadora.

## Ficha técnica en la app (26/08/2026)

`src/ficha.js`. Sale de la misma cotización, no hay que cargar nada: tarjeta plegable
debajo de los precios, con el resumen (`7.560 frig/h · 38,9 m²`) en el encabezado.

El texto que copia va en **formato de WhatsApp**, con la etiqueta en negrita y el valor
al lado, un renglón por fila. Alinear con espacios no sirve: WhatsApp no usa
monoespaciada y las columnas quedarían corridas.

    *Forzador cúbico de cámara 4HP — 6F6C x 1,50m*

    *Potencia Sugerida:* 4 HP
    *Frig./Hora:* 7.560 - Dt = 8 °C
    ...

**Potencia a mano**: los productos que no traen HP como dato muestran un selector
*dentro de la ficha* —no entre los campos del producto, porque no afecta al precio— y
al elegirlo aparecen frigorías y watts. Se ofrece sólo cuando hace falta: donde el HP
ya existe, el selector no aparece.

**El HP de los compactos** sale de la tabla de secciones (8=1/3 · 12=1/2 · 16=3/4 ·
20=1HP). Fuera de esas cuatro no se inventa un HP intermedio: la ficha sale sin
frigorías. Los productos sin HP (estáticos, laterales, columna, doble ataque, carniceras)
muestran sólo la geometría; el condensador, al revés, muestra frigorías sin superficie.

**Casilla de aleta de 4 mm** en los dos compactos de 3/8": duplica la superficie.

El cúbico enchapado a medida no trae `secDobles`, sólo la batería tipo `5F6C`: los caños
se deducen de ahí (5 × 6 ÷ 2 = 15 secciones dobles).

### Pendiente para la próxima tanda

1. ~~Botón "Ficha técnica"~~ → hecho.
2. ~~Tarjeta plegable con las tres secciones~~ → hecha el 27/08/2026, ver arriba.
3. ~~Casilla de aleta de 4 mm en compactos~~ → hecha.
4. ~~Ampliar el rango del respaldar~~ → hecho el 27/08/2026: llega a **16 secciones**.
5. ~~Definir el markup del estático arriba de 16 secciones~~ → hecho el 27/08/2026:
   **17-18 → $14 · 19-20 → $16**, y de 21 en adelante avisa en vez de estirar.
6. **Los huecos del respaldo de cámara**: el de **5 → 188** se completó el 27/08/2026
   desde la tabla del lateral doble. Faltan **11, 13 y 14 secciones dobles**, que no
   tienen dato: 11 caería simétrico entre 10 (339) y 12 (403) → 371, y 13 y 14 caen
   entre 403 y 467, que no reparte en enteros (~424,3 y ~445,7). Hoy no se inventan:
   `deTabla` avisa y no cotiza. **Hace falta el número de la lista.**
7. ~~Subir la v15.9~~ → publicado. Al 27/08/2026 en línea está la **16.6**, servida
   desde `https://cotizadorgz.github.io/cotizador/v15/`. La **16.7** ya está armada en
   `~/Desktop/subir-a-github/v15` y **falta arrastrarla a GitHub**. Al 03/09/2026 la
   carpeta lleva la **16.9** (20 archivos, verificada corriendo sola desde ahí).

   **La carpeta se sigue llamando `v15` a propósito** (decidido el 27/08/2026): el
   nombre de la carpeta es la URL. Manteniéndolo, la app se actualiza en el mismo
   `/cotizador/v15/`, la PWA ya instalada en el celular y en la PC de la hermana se
   pone al día sola y ningún link mandado queda apuntando a una versión vieja. Una
   carpeta nueva —`v16`, `v17`— sería una publicación **en paralelo**, no un reemplazo:
   la vieja seguiría sirviendo para siempre. El número de versión vive en
   `src/app.js` (`VERSION`), no en el nombre de la carpeta.
8. ~~Integración con MercadoLibre~~ → hecha, ver arriba.

**No quedan preguntas abiertas de fórmula**, salvo los tres huecos del respaldo de
cámara (11, 13 y 14 secciones dobles), que necesitan el dato de la lista. Lo de ordenar
la lista impresa quedó escrito como hoja de correcciones (ver más abajo).

Como no hay Node en la máquina, la suite corre en el navegador:
`python3 serve.py` → http://localhost:8765/test/regresion.html

## Decisión tomada

Reescritura como **motor de componentes** (v15). La v14 queda intacta hasta
reemplazarla. Todo producto se descompone siempre igual:

    base         = batería + ventiladores + adicionales
    batería      = precio_metro × ancho_m
    ventiladores = Σ(cantidad × costo_unitario) × 1.5
    adicionales  = costados + col/dist + bandeja + salida Cu + curvas + uniones
                   + cooler + libres
    total        = base × cantidad + embalaje

Cada producto es un **perfil de datos** (tabla de precio/metro, ventiladores por
defecto, reglas de adicionales, rangos válidos), no una rama de `if/else`.

Objetivos: modo libre en todos los productos, desglose visible del cálculo,
panel de precios editable (sin tocar código), presupuesto multi-ítem,
PWA offline real, historial local.

---

## Las 15 fórmulas

Precios en USD, sin IVA (IVA 10,5%). Ventiladores: v200 $25 · v250 $25 · v300 $44 ·
v300 reforzado $60, todos ×1,5 → $37,50 / $37,50 / $66 / $90.

| # | Producto | Fórmula |
|---|---|---|
| 1 | Evaporador estático 5/8" | `sec × ancho × 30 + sec × 0,25 + markup` · markup (`PRECIOS.markupEstatico`, editable): 3-5→4, 6-8→6, 9-12→8, 13-14→10, 15-16→12 · arriba de 16 avisa, no estira · si decimal ≥0,75 redondea arriba |
| 2 | Evap. estático compacto 3/8" | `sec × ancho × 20 + sec × 0,25 + 8` |
| 3 | Respaldar estático 5/8" | **Desde 21/08/2026 usa la misma fórmula que el estático 5/8"**: `sec × ancho × 30 + sec × 0,25 + markup`. Antes era `(sec × 30) × ancho × 1,04`. Se eliminó `respaldarFactor`. Rango 2 a **16** secciones desde el 27/08/2026. |
| 4 | Forzador lateral doble 5/8" | c/chapa: `pm[sec] × ancho + vents` — pm 2→83, 3→126, 4→156, 5→188, 6→218, 7→248<br>s/chapa: `pm_sc[sec] × ancho + costados` — pm_sc = sec×30 · costados 8 (2-5sec) / 12 (6-7sec) |
| 5 | Forzador lateral simple 5/8" | c/chapa: `pm[sec] × ancho + vents` — pm 2→105, 3→139, 4→192, 5→224<br>s/chapa: `(sec × 30) × ancho + 8` |
| 6 | Forzador lateral compacto 3/8" | c/chapa: `sec × ancho × 24 + vents + sec × 0,25`<br>s/chapa: `sec × ancho × 20 + sec × 0,25 + 8` |
| 7 | Columna para batea 5/8" | `sec_dobles × ancho × 24 + uniones × 8` |
| 8 | Forzador cúbico cámara | c/chapa: `bat × ancho + vents + col/dist` — bat 3F4C→222, 4F4C→282, 4F6C→380, 5F6C→463, 6F6C→547<br>s/chapa: **ver reconstruidas** |
| 9 | Forzador respaldo cámara | c/chapa: `pm[sec_dobles] × ancho + vents + col/dist` — pm 4→156, 6→218, 7→248, 8→275, 9→306, 10→339, 12→403, 15→467<br>s/chapa: **ver reconstruidas** |
| 10 | Forzador techo 5/8" | c/bandeja: **ver reconstruidas** · s/bandeja: `sec × 0,35 × 24 + 16` (8 costados + 8 salida Cu) |
| 11 | Forzador techo 3/8" | c/bandeja: **ver reconstruidas** · s/bandeja: `sec × 0,33 × 20 + 46` (8 costados + 30 col/dist + 8 curvas) |
| 12 | Respaldo carniceras | `pm × ancho + vents` — pm 139 (simples 3sec) / 156 (dobles 4sec) · vents: Mod.73/93/104→2×v250, Mod.124→3, Mod.154→4 |
| 13 | Forzador doble ataque | `pm[sec] × ancho + vents + 8` — pm 5→188, 6→218, 7→248 · default 2×v200 |
| 15 | Condensador | Precio fijo por modelo: 1/4HP→64,80 · 1/3→92,20 · 1/2→119,60 · 3/4→204,50 · 1HP→266<br>Casilla **con ventilador**: 1/4-1/2 → 1×v200 ($37,50) · 3/4 y 1HP → 1×v300 ($66)<br>Casilla **con base**: 1/4-1/2 → +$15 · 3/4 y 1HP → +$20 |
| 14 | Forzador piso torteras | c/chapa: `97 × ancho + vents` (3sec) · `129,33 × ancho + vents` (4sec)<br>s/chapa: `72 × ancho + 5` (3sec) · `96 × ancho + 5` (4sec)<br>defaults 3sec: hasta 1/2HP→2×v200 · 3/4HP (1,6m y 1,7m)→3×v200 |

**Col/dist** — cúbico c/chapa: 2-2,5HP→30, 3-4HP→40, 5HP→45, 6HP→50.
Respaldo cámara: 2HP→30, 3HP→40.

**Ventiladores por defecto** — cúbico: hasta 1HP→v250, desde 1,5HP→v300.
Respaldo cámara: hasta 1HP→v250, desde 1,5HP→v300.

**Ventilador 300mm reforzado** — casilla opcional, sólo cúbico y respaldo de cámara.
$60 × 1,5 = **$90**. Reemplaza al ventilador por defecto sin cambiar la cantidad.

### Precios de venta

    Lista        = USD × dólar_oficial          (sin IVA)
    +5%          = USD × 1,05 × dólar_oficial
    +10,5%       = USD × 1,105 × dólar_oficial  (IVA incluido)
    MercadoLibre = USD ÷ 0,71 × dólar_ML        (IVA incluido — es +40,85% sobre base)

**Baja temperatura** (cúbico y respaldo cámara): `precio base × 1,80`.
El embalaje NO se multiplica por este factor.

---

## Fórmulas reconstruidas

En la v14 estos 4 casos eran tablas de números sueltos, sin fórmula. Reconstruidas
y verificadas exactas contra los 25 valores. Con esto quedan **liberados**: se puede
cotizar cualquier medida, no sólo los modelos de tabla.

    Cúbico sin enchapado     = sec_dobles × ancho × 24 + 10 + col/dist_sc
    Respaldo cámara s/ench.  = sec_dobles × ancho × 24 + 10 + col/dist
    Techo (con bandeja)      = (fórmula sin bandeja) + bandeja + 37,50
                               bandeja 800mm = 43,50  |  1000mm = 51,75

**Las baterías cúbicas son secciones dobles:** `sec_dobles = filas × columnas ÷ 2`
→ 3F4C=6, 4F4C=8, 4F6C=12, 5F6C=15, 6F6C=18. Cúbico, respaldo de cámara y columna
de batea usan la misma tarifa de **$24 por sección doble por metro**.

`col/dist_sc` (sólo cúbico sin enchapado) = col/dist + 10 → 2-2,5HP→40, 3-4HP→50,
5HP→55, 6HP→60. En respaldo de cámara el col/dist es igual en ambas versiones.

---

## Verificación contra la lista de precios (mayo 2026)

Se cotejaron las **58 filas** publicadas contra las fórmulas: **57 dan exacto al centavo.**

### Resuelto (19/08/2026): respaldo cámara 2HP = 588,80

Lista: **USD 588,80** · fórmula: **USD 568,80** (`339 × 1,20 + 132 + 30`) · dif **$20**.
Se adopta el número de la lista, que es el que ve el cliente. El $20 entra como
**ajuste nombrado** (`rcam-2hp-20` en `src/precios.js`), visible en el desglose y
borrable desde el panel — no se toca la tabla de col/dist.

Se descartó col/dist 2HP = $50: encaja exacto, pero deja el 2HP más caro de col/dist
que el 3HP ($40, verificado al centavo contra `467 × 1,4 + 198 + 40 = 891,80`).
El origen del $20 sigue sin explicarse.

### Resuelto: los costados

Todos los costados del sistema son **de aluminio** (confirmado 19/08/2026). Es un solo
concepto; lo que cambia es **cuánto aluminio lleva cada producto**:

    piso torteras                       $5
    compacto, lateral simple, lateral
    compacto, techo 5/8", techo 3/8",
    doble ataque                        $8
    lateral doble 2-5 secciones         $8   ·  6-7 secciones  $12
    cúbico, respaldo de cámara          $10

Y sólo se cobran en las versiones **sin enchapar**: en las enchapadas ya van dentro
del precio/metro. Los techos son la excepción aparente — ahí la variante es la bandeja
plástica, no el enchapado, así que los costados van en las dos.

### Los costados NO van en los laterales enchapados

La lista confirma que van **sin** costados: 1/3HP simple = `139 × 0,40 + 37,50 = 93,10` ✓
y 1/2HP doble = `156 × 0,40 + 37,50 = 99,90` ✓. Los costados ya están dentro del
precio/metro enchapado. Sumarlos subiría todos los laterales enchapados 4-10%.

---

## Bugs de la v14 a corregir en v15

1. **Baja temperatura infla el embalaje** — `(base + emb) × 1,80` en vez de `base × 1,80 + emb`.
2. **5 variables CSS inexistentes** (`--color-text-primary`, `--color-text-secondary`,
   `--color-border-tertiary`, `--color-background-info`, `--color-text-info`) →
   el selector de ventiladores queda sin bordes y con texto negro.
3. **La PWA no funciona offline** — service worker y manifest registrados desde `blob:`,
   que el navegador rechaza. Necesita `sw.js` y `manifest.json` como archivos reales.
4. **Dólar ML clavado** en `DML=1600`.
5. **El dólar oficial no se persiste** — si la API falla y se carga a mano, se pierde al recargar.
6. **Fallbacks que inventan precios** — `PM_FD_SC[sec] || (sec*20)`: fuera de tabla
   calcula sin avisar.
7. **El ancho de carniceras se parsea del texto de la etiqueta** (`m[0].split("x")[1]`).
8. `maximum-scale=1.0` bloquea el zoom en iOS.
9. **Código muerto**: `FD_CC`, `FD_SC`, `FS_CC`, `FS_SC`, `RESP_PM`, `PM_RCAM`,
   `DA_ANCHOS`, `daLabel`, `PT3_CC_PM`, `PT4_CC_PM`. Ojo: `FD_CC` y `FS_CC` son en
   realidad la lista de precios publicada.

---

## Decidido: dólar MercadoLibre

Pasa de constante a **campo editable persistido**. Al abrir, muestra siempre el
último valor escrito; nunca vuelve a 1600. El 1600 queda sólo como semilla inicial
en un dispositivo nuevo. Al lado, la fecha de última edición.
Mismo tratamiento para el dólar oficial: si la API falla, arranca con el último
valor conocido en vez de vacío.

Se guarda por dispositivo. El export/import del panel de precios cubre la sincronización
entre la compu y el celular.

---

## Decisiones tomadas el 19/08/2026

- **Ventiladores**: tarifa **fija de $25** (→ $37,50 con el ×1,5) en compactos,
  carniceras y piso torteras, aunque se elija un v300. **Precio real** en cúbico y
  respaldo de cámara, donde el v300 sale $44 (→ $66): es lo único que hace cerrar
  la lista publicada (cúbico 2HP = 578,70 exige $66; con $25 daría 521,70).
  **Corregido el 03/09/2026**: el código aplicaba la tarifa fija a cinco productos
  que esta decisión no menciona —los dos techos, los dos laterales de 5/8" y el doble
  ataque—, así que ahí un 300mm salía $37,50. Los cinco pasaron a precio real; la
  tarifa fija quedó sólo en los tres que dice este renglón.
- **Embalaje**: uno **por pedido**, no por unidad. `total = base × cantidad + embalaje`.
- **Respaldo cámara 2HP**: se adopta **588,80** con ajuste nombrado de $20.
- **Lateral doble sin enchapar**: **$24** por sección por metro. Confirmado. La v14
  cobraba $30 — es la única diferencia de precio real entre v14 y v15.
- **Ventilador 300mm reforzado**: casilla nueva, **sólo en cúbico y respaldo de cámara**.
  Costo $60 + 50% = **$90**. Al tildarla **se descuentan todos los ventiladores por
  defecto del modelo** y entran en su lugar los reforzados, en la cantidad que se elija.
  Arranca con la cantidad del modelo. Disponible en todos los modelos, chicos incluidos.
- **Col/dist**: arranca recién en **2HP**, tanto en cúbico como en respaldo de cámara.
  Los importes de las dos tablas quedan como están, +10 del cúbico sin enchapar incluido.
- **Las 4 columnas**: `Precio de lista` · `Sin factura` (+5%) · `Con factura` (IVA 10,5%)
  · `MercadoLibre`. Las dos del medio son las que ve el cliente: sin factura sale 5,5%
  más barato que con factura.
- **Texto al cliente**: sin medidas y sin cantidad de secciones. El enchapado no se
  menciona; sólo se aclara cuando va **sin enchapar / sin bandeja y sin ventilador**.
  El **dólar oficial aparece en todos los textos copiados menos el de MercadoLibre**.
  A los laterales y estáticos les alcanza con el nombre del producto: no llevan HP.
- **Piso torteras 4 secciones**: siempre arranca en 2 ventiladores, cantidad libre, sin avisos.
- **Respaldo cámara 3/4HP y 1HP**: 2×v250, siguiendo la lista.
- **Baja temperatura**: sólo cúbico y respaldo de cámara. Confirmado.
- **Costados de aluminio**: es el mismo concepto en todos los productos, cambia el
  importe según cuánto aluminio lleva cada uno — piso torteras $5 · laterales, compacto,
  techos y doble ataque $8 (los laterales dobles de 6-7 secciones $12) · cúbico y
  respaldo de cámara $10. En las versiones enchapadas no se cobran: ya están dentro
  del precio/metro.
- **Cúbicos y respaldos**: catálogo por HP para el uso normal + fórmula liberada para
  medidas fuera de estándar.
- **Condensadores** (20/08/2026): categoría nueva, 5 modelos de precio fijo sin medida
  ni fórmula. El ventilador y la base se cobran aparte, cada uno con su casilla, y el
  importe de los dos depende del modelo. El ventilador va a precio real (v200 $37,50 /
  v300 $66), igual que en cúbico y respaldo de cámara.
- **Soportes y defensas** (26/11/2026): categoría nueva `sop`, al final de la grilla.
  Pieza (soporte / defensa / soporte + defensa) y tamaño 200/250/300mm. **Precio
  final, sin markup**: 200 y 250 → USD 4, 300 → USD 8, cada pieza (`PRECIOS.soportes`,
  editable desde el panel). El combo sale en dos renglones, así se puede destildar uno.
  Es un perfil `accesorio`: sin ventiladores, sin ficha, sin colector ni cooler (sí
  ítems libres) y **sin botón de publicar en ML**. La etiqueta al cliente la arma el
  perfil (`etiqueta`): "Soporte y defensa para ventilador 300mm". Los tests que
  recorren "todos los productos" usan `EQUIPOS` (ORDEN sin accesorios). 851/851.
- **Usuarios**: sólo Gabriel y su hermana. Sin login ni panel protegido; la sincronización
  entre dispositivos va por export/import.

## Pendiente de definir

1. ~~Respaldo cámara 2HP~~ → resuelto: 588,80.
2. ~~Lateral doble sin enchapado~~ → resuelto: $24.
3. ~~Col/dist del cúbico sin enchapado~~ → resuelto: los precios están bien y arrancan en 2HP.
4. ~~El "+10" fijo de cúbico y respaldo cámara sin enchapado~~ → resuelto: son los
   **costados de aluminio**. Aparece sólo en esos dos productos y sólo sin enchapar;
   en la versión enchapada los costados ya están dentro del precio/metro.
5. ~~Piso torteras 4sec~~ → resuelto: siempre 2 por defecto, cantidad libre.
6. ~~`cant_v × 25 × 1,5` vs `cant_v × precio_v × 1,5`~~ → resuelto.
7. **Rangos válidos** — ya están cargados en `PRECIOS.rangos` (panel editable).
   Confirmados: laterales hasta **1,50m**, techos hasta **1m** y columnas para batea
   hasta **9m** de ancho, y el respaldar hasta **16 secciones** (27/08/2026). El resto son
   provisorios; si alguno frena una cotización se amplía desde el panel, sin tocar código.
   **Ojo**: ampliar un rango desde el panel no amplía las tablas que cuelgan de él. El
   markup del estático ahora avisa cuando se pasa; las tablas de precio/metro ya lo hacían.
8. ~~Las 4 columnas de precio~~ → resueltas.
9. ~~Costos de ventiladores~~ → vigentes. Se agregó el 300mm reforzado.
10. ~~Embalaje~~ → uno por pedido.
11. ~~Baja temperatura~~ → sólo cúbico y respaldo de cámara.
12. ~~El ancho de la lista es el gabinete~~ → resuelto. Cúbicos y respaldos de cámara
    se piden **siempre por HP**: la app los ofrece como catálogo de modelos y el ancho
    viene con el modelo, ya en medida de batería. Además queda la **fórmula liberada**
    para los pedidos fuera de estándar, con el campo etiquetado **"ancho de batería"**
    y el aviso de que la lista publica el gabinete. En laterales no hay ambigüedad:
    el ancho que dice el cliente entra derecho en la fórmula.
13. ~~Identificación en el texto al cliente~~ → resuelto: alcanza con el nombre.

## Ficha técnica (21/08/2026)

Descifrada a partir de tres fichas de referencia y verificada contra la geometría real
de las aletas. **Frigorías y watts son exactos; la superficie sale de medidas propias.**

    frigorías/h = HP × 1.890            (a Dt = 8 °C)
    watts       = frigorías × 1,163     (conversión kcal/h → W, redondeo a la centena)
    superficie  = caños × área_por_caño × (largo ÷ separación_aletas) × 2 caras

**Área por caño** = paso entre agujeros × ancho de aleta. Una sección son 2 caños:

| Sección | Paso × ancho | Por caño | Por sección |
|---|---|---|---|
| Simple 5/8" | 75 × 70 mm | 52,50 cm² | 105,00 cm² |
| Doble 5/8" | 60 × 60 mm | 36,00 cm² | 72,00 cm² |
| Compacta 3/8" | 29 × 25 mm | 7,25 cm² | 14,50 cm² |

La doble se auto-verifica: la aleta de 2 secciones es un cuadrado de 120 × 120 mm =
144 cm² con 4 caños → 36 cm² por caño = 60 × 60. Los dos caminos coinciden.

**Separación de aletas**: 10 mm en 5/8" · 8 mm en compactos y condensadores ·
**4 mm** opcional en compactos especiales (duplica la superficie).

**Qué aleta lleva cada producto**:

- **Simple 5/8"** — evaporador estático, respaldar, lateral simple, carniceras (todas menos Mod.154)
- **Doble 5/8"** — lateral doble, cúbico, respaldo de cámara, columna de batea, doble ataque, techo 5/8", carnicera Mod.154, piso torteras
- **Compacta 3/8"** — compacto estático, lateral compacto, techo 3/8", condensadores

**Diámetro de caño**: 5/8" en todo, salvo compactos, condensadores y techo 3/8".

### Advertencia sobre los compactos

Las dos filas de la ficha vienen de fuentes distintas: la superficie es geometría medida
y las frigorías son la regla comercial HP × 1.890. En los equipos de 5/8" las dos
concuerdan (117 a 224 frig/m²), pero en los de 3/8" no: el lateral compacto de 1/2HP da
**602 frig/m²**, más del triple que un cúbico. O el caño fino con aletas juntas rinde
mucho más, o la regla del 1.890 no aplica a esa familia. **Sin resolver** — conviene
revisarlo antes de publicar fichas de compactos.

### Ojo con las fichas hechas por IA

Las tres fichas de referencia traían las superficies inventadas: se calculaban las
frigorías con HP × 1.890 y después se dividía por ~241 para producir un m² que encajara.
También aparecía un motor Ø350 que no existe en la lista (el cúbico 4HP lleva Ø300).

### A ordenar en la lista de precios

Los cinco puntos de acá abajo están escritos como **hoja de correcciones para pasarle a
quien mantiene la lista impresa**, con las cuentas corridas contra el motor:
https://claude.ai/code/artifact/4b838e82-53ec-4fc7-9b9f-6c9a1df27217 (27/08/2026).
Dos son correcciones de la lista (el ANCHO y los ventiladores del piso torteras), una ya
está alineada (2×250 del respaldo de cámara) y dos son decisiones de Gabriel (el techo
5/8" y el respaldo mini de 1/2HP). **La única que cuesta plata es la del ANCHO.**

- La columna **ANCHO** es el gabinete, no la batería. En cúbicos es batería + 100mm
  en los 9 modelos, salvo el de 2,5HP (dice 1050mm, la batería es 1050mm → debería
  decir 1150mm). En respaldo de cámara la relación es irregular (+0, +50, +50, +20,
  +100, +0). **Trampa real**: quien lee "1000mm" de la lista y lo tipea en cotización
  libre obtiene 323 en vez de 310,60.
- **Piso torteras 1250mm**: la lista dice `3x200` pero el precio (196,25) es de 2
  ventiladores. Con 3 daría 233,75. El precio está bien, la columna VENT. no.
- **Respaldo cámara 3/4HP y 1HP**: la lista dice `2x250`, la calculadora usa `2x200`.
  Mismo precio ($25 c/u), pero el texto de la cotización sale con el ventilador equivocado.
- **Techo 5/8"**: la lista los publica juntos como `1/3-1/2 HP`. Confirmado que valen
  igual (los dos son 6 sec × 0,35m con bandeja de 800mm = USD 147,40). La nota vieja
  decía que en la calculadora convenía unificarlos: **se descartó el 27/08/2026**. Desde
  que existe la ficha técnica el HP no es decorativo —de ahí salen las frigorías, y
  1/3HP y 1/2HP dan 624 y 945 frig/h—, así que unificarlos ahorraría una fila del
  catálogo y rompería la ficha de los dos. Se dejan separados; lo que conviene es que
  la lista aclare "mismo precio" al lado de la fila.
- **Respaldo cámara "1/2HP mini — 4 dobles x1,0m" (USD 231)**: está en la calculadora
  y no en la lista publicada.
