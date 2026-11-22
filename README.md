# Sistemas Operativos Monopuesto (0222)

Materiales del módulo en formato presentación 16:9 para web. Los alumnos siguen las presentaciones en clase y estudian desde ellas.

## Estructura

```
index.html          Portada con las diez unidades de trabajo
assets/             Motor de diapositivas (deck-stage.js), estilos y ejercicios (som.css, som.js), iconos
plantilla/          Tipos de diapositiva disponibles y ejercicios interactivos de prueba
herramientas/       Scripts de mantenimiento (aplica-notas.py vuelca las notas editadas en clase) y pruebas del simulador de Linux
ut01/ ... ut10/     Una presentación por unidad (index.html + img/)
```

## Cómo se construye una unidad

1. Se prepara y revisa un guion de la unidad (material de trabajo, fuera del repositorio).
2. Con el guion aprobado se genera `utNN/index.html` usando los tipos de diapositiva de `plantilla/`.
3. Se añaden las imágenes a `utNN/img/`, cada una con su crédito.
4. Se publica en GitHub Pages y se enlaza desde `index.html`.

## Ejercicios interactivos

En `assets/som.js` están los generadores de ejercicios con números al azar. Se insertan en una diapositiva con:

```html
<div class="ej" data-tipo="dec2bin" data-min="16" data-max="255"></div>
```

Todos se resuelven en vertical, con huecos, como en la pizarra: **Comprobar**, **Pista** (rellena la siguiente casilla y la explica), **Resolver**, **Otro ejercicio** y racha de aciertos. Tipos disponibles: `bin2dec` (tabla de pesos), `dec2bin` (divisiones entre 2), `decfrac2bin` (multiplicaciones por 2), `bases` (binario, octal, hexadecimal y decimal; `data-modo` fija uno de `bin2oct`, `bin2hex`, `oct2bin`, `hex2bin`, `hex2dec`), `sumabin`, `restabin` (con botón Invertir y signo), `logica` (`data-modo` NOT, AND, OR, XOR, NAND o NOR), `c1c2`, `restac2` (por pasos), `paridad` (`data-modo` `calcular` o `detectar`, `data-paridad` `par` o `impar`), `unidades` (`data-modo` `bits`, `binario` o `fabricante`), `ascii` (`data-modo` `codigo`, `caracter` o `caso`) e `ieee754` (simple precisión por campos). Atributos comunes: `data-bits`, `data-min`, `data-max`. Los quiz de opción múltiple usan la clase `quiz` con `data-correct`; con `data-preguntas="clave"` añaden el botón **Otra pregunta**, que alterna la pregunta de la diapositiva con las de repaso de `SOM.preguntas.clave` (en `assets/som.js`, barajadas y con las opciones en otro orden).

`ut01/hoja.html` genera hojas de ejercicios en papel con los mismos generadores y una semilla (seed) que elige quien la genera (la misma hoja sale siempre igual para la misma semilla y el mismo título): título, semilla, cuántos ejercicios de cada tipo, solucionario opcional al final y modo examen (solo la tarea en cada enunciado, sin las pistas que dan el método); la configuración queda en la dirección de la página. Lo normal es repartir a toda la clase la misma hoja con una semilla nueva; los alumnos generan en casa las que quieran.

Generadores de la UT2 (mismo formato de rejilla): `estados` (transiciones entre estados de un proceso), `planificacion` (el cronograma que resuelve el alumno: pulsa cada casilla para ponerla en ejecución, en espera o vacía; tiempos de espera y respuesta y medias; `data-modo` fija uno de `fifo`, `sjf`, `srtf`, `pne`, `pe`, `rr`), `paginacion` (`data-modo` `paginas`, `huecos` o `virtual`), `arranque` (ordenar los siete pasos; `data-modo` `uefi` o `bios`) y `sistemas-archivos` (elegir el sistema de archivos de un caso). El generador `bases` de la UT1 añade el modo `dec2hex`. Un generador puede definir `alEscribir(sv)`, que el motor llama cada vez que el alumno escribe (el de planificación colorea el cronograma).

`ut02/hoja.html` es la hoja en papel de la UT2: cronogramas de cada algoritmo (con el solucionario coloreado) y los demás ejercicios de la unidad, con el mismo mecanismo de semilla que la de la UT1.

Generadores de la UT3: `anfitrion` (sistema anfitrión, número de invitados, tipo de hipervisor y licencia del programa de un caso), `recursos` (RAM que le queda al anfitrión, si las máquinas caben encendidas a la vez, núcleos máximos por máquina y disco ocupado, con las reglas del módulo: 4 GB para el anfitrión, la mitad de los hilos por máquina, disco dinámico = lo escrito), `archivos-vm` (qué guarda un archivo de la carpeta de una máquina y de qué programa es el formato), `modos-red` (`data-modo` `caso`, `matriz` o `ip`: elegir el modo para un caso, quién ve a quién en VMware, o deducir el modo a partir del ipconfig del anfitrión) y `ficha-vm` (solo para la hoja: la ficha de máquina del examen práctico). `ut03/hoja.html` genera las hojas de la UT3 con el mismo mecanismo de semilla. Las rejillas altas llevan la clase `mini` para que quepan los botones y el mensaje.

`assets/som.js` incluye también un **simulador visual de planificación de procesos**, paso a paso, para explicar los algoritmos de la UT2: en la misma diapositiva van `<div class="sim-entrada"></div>` (datos de entrada editables y tabla de tiempos) y `<div class="sim" data-algo="fifo"></div>` (cronograma, cola de listos, CPU y explicación de cada instante). Algoritmos: `fifo`, `sjf`, `srtf`, `pne` y `pe` (prioridades no expulsivo y expulsivo, 1 = la más alta) y `rr` (con `data-q`); `data-procesos="0/7,2/4,3/3,5/2"` fija los datos iniciales. Reglas de empate: FIFO; en SRTF y prioridades expulsivo sigue el que está; en Round Robin el que llega entra en la cola antes que el que agota su quantum. Hay un ejemplo en `plantilla/`.

Un ejemplo resuelto se maqueta con la misma rejilla sin casillas: `<div class="sv compacta" style="grid-template-columns:…">` con `<span class="lbl">`, `<span class="d">` (y `d res`, `d carry`, `d tenue`) y `<div class="linea">`.

## Simulador de Linux

Para las unidades de Linux (UT4 a UT7) hay una terminal de Ubuntu 24.04 que funciona dentro de la diapositiva. Lo que hace, lo hace como una Ubuntu real en español (los mensajes y los códigos de salida se comparan con una máquina de verdad); lo que no sabe hacer lo dice con un aviso amarillo del simulador, nunca con una salida inventada. Las tareas de las misiones se corrigen mirando el estado del sistema (si la carpeta existe, qué tiene el archivo) o el dato que se escribe en la casilla, no la orden que se escribió.

La página necesita, además de `som.css`, `deck-stage.js` y `som.js`:

```html
<link rel="stylesheet" href="../assets/linux.css">
<script src="../assets/linux-datos.js"></script>
<script src="../assets/linux.js"></script>
<script src="../assets/linux-bash.js"></script>
<script src="../assets/linux-ordenes.js"></script>
<script src="../assets/linux-sistema.js"></script>
<script src="../assets/linux-ut4.js"></script>
<script src="../assets/linux-misiones.js"></script>
<script src="../assets/linux-misiones-ut4.js"></script>
<script src="../assets/linux-term.js"></script>
```

`linux-ut4.js` trae lo que pide la UT4: `nano` (y un `vi` mínimo), `update-grub` y `grub-mkconfig` (fabrican `/boot/grub/grub.cfg` a partir de `/etc/default/grub`, como GRUB 2.12), `systemctl status display-manager`, `info`, `man -k`, `apropos`, `whatis`, `hostname` y `dpkg-reconfigure`. Si la página no lo trae, la terminal lo carga antes de montarse (y lo mismo `linux-misiones-ut4.js` si hay una misión `ut4-…`). Con las vistas de `linux-vis.js` (por ejemplo `arranque`), se añaden también `linux-vis.css` y `linux-vis.js`.

Se cargan solos la primera vez que hacen falta: `linux-ayuda.js` (páginas de `man`, textos de `--help` y la ayuda de `less`), `linux-whatis.js` (las descripciones de `man -k`, `apropos` y `whatis` sin manpages-es), `linux-info.js` (el primer nodo de `info` de las órdenes de coreutils), `linux-ayuda-es.js` (las páginas en español de manpages-es) y `linux-whatis-es.js` (sus descripciones en español). Como en la máquina Ubuntu-SOM de la unidad, el paquete `manpages-es` viene instalado: `man` sale en español en las órdenes que traduce y en inglés en las demás (`lsblk`, `find`, `sudo`, `apt`…), y `man -k` busca primero en las descripciones en español. El escenario `sin-manpages-es` (o `manEs: false`) es la máquina antes de instalarlo, para enseñar el cambio con `sudo apt install manpages-es`. Los textos de esos archivos y de `linux-datos.js` están copiados de Ubuntu 24.04 y conservan la licencia de cada programa.

Cada `<div class="term">` se convierte en una terminal. Se pulsa en ella para escribir (el rótulo de debajo dice quién tiene el teclado) y Esc devuelve las flechas a las diapositivas. Funcionan Intro, ↑ ↓ (historial), ← →, Inicio, Fin, Tab (completa; dos veces enseña las posibilidades), Ctrl+C, Ctrl+L, Ctrl+A, Ctrl+E, Ctrl+U, Ctrl+K y Ctrl+D. Arrastrar con el ratón selecciona; Ctrl+Mayús+C copia y Ctrl+Mayús+V pega en la línea, como en la terminal de GNOME (Ctrl+V no pega). `man`, `less`, `more`, `top`, `info`, `systemctl status` y `nano` se abren a pantalla completa dentro de la ventana; `man` vuelve a llenar los párrafos al ancho de la terminal, sin partir palabras, como el de Ubuntu; en `nano` la barra de atajos de abajo se puede pulsar (el navegador se queda con Ctrl+W: para buscar, F6 o «^W Buscar»). La contraseña no se ve al escribir y, la primera vez de cada sesión, un aviso lo dice. `exit` cierra la terminal y deja el botón «Abrir otra terminal»; el botón de cerrar de la barra hace lo mismo. El de maximizar (o doble clic en la barra) hace que la terminal cubra toda la diapositiva, o toda la página, con la misma letra y más columnas y líneas; las tareas de la misión, los botones de la demostración y las vistas siguen al lado (las vistas se pueden plegar). Se restaura con el mismo botón, con un segundo Esc cuando la terminal ya no tiene el teclado o al cambiar de diapositiva. La salida guarda las últimas 2000 líneas, como una terminal real. Las dos lupas de la barra (o Ctrl y «+», Ctrl y «−», Ctrl+0 con la terminal activa) cambian el tamaño de la letra en escalones de 70, 80, 90, 100, 115, 130 y 150 %: es una preferencia de quien mira, común a todas las terminales de la página y recordada en el navegador; cambian las columnas y las filas, el texto ya escrito se vuelve a ajustar al ancho y lo que esté abierto (nano, man, top) se repinta.

Modo libre, con un escenario preparado y el botón Reiniciar:

```html
<div class="term" data-escenario="empresa" data-cwd="~/empresa"></div>
```

Modo demostración: el botón (o Av Pág con la terminal activa, que es lo que manda el mando de presentaciones) da cada paso; la explicación sale debajo. Con `data-teclas`, las teclas especiales se ven en grande con lo que hacen durante 2,5 s:

```html
<div class="term" data-guion data-teclas data-escenario="ubuntu-som">
  <ol class="term-guion" hidden>
    <li data-orden="sudo nano /etc/default/grub">Escribe la orden y espera a que se pulse Intro.</li>
    <li data-escribe="alumno">Escribe sin Intro: en la línea, en la contraseña o en el programa abierto.</li>
    <li data-tecla="Enter">Pulsa una tecla y la enseña en el indicador.</li>
    <li data-tecla="Ctrl+W">En nano, buscar.</li>
    <li>Un paso solo con la explicación.</li>
  </ol>
</div>
```

Teclas de `data-tecla`: `Tab`, `Enter`, `Escape`, `Space`, `ArrowUp`, `ArrowDown`, `Ctrl+C`, `Ctrl+L`, `Ctrl+O`, `Ctrl+X`, `Ctrl+W`, `Ctrl+K`, `Ctrl+Z`, `Ctrl+D` o un carácter (`q`, `n`, `/`). Van al programa que esté abierto (man, nano…) o, si no hay, a la línea. `data-espera="aviso"` o `data-espera="error"` en un paso dice que ahí se espera un aviso del simulador o un error (lo usa la prueba de las demostraciones).

Modo misión: lista de tareas que se ponen en verde solas, con Pista, Resolver, Otro ejercicio, Reiniciar y racha de aciertos, como los ejercicios `.ej`. Las tareas van en un panel de 560 px (520 px si la misión lleva una vista al lado) con letra de 24 px como mínimo, para que se lean proyectadas. Los mensajes (pista, «no es eso», misión completa) salen en una franja debajo de la terminal, con `aria-live` y el alto reservado para el mensaje más largo de esa misión, así que la lista de tareas no cambia nunca de tamaño; la tarea de la que habla el mensaje se resalta y se trae a la vista. Pista tiene dos niveles: la primera vez dice dónde mirar o qué idea usar (`pista`) y la segunda, la orden (`pistaOrden` o, si no la hay, las órdenes de la solución). Pista y una casilla acertada devuelven el teclado a la terminal; una casilla fallada se queda con él para corregirla; dentro del bloque de la misión, letras, cifras e Intro no llegan a la presentación. En los enunciados, la letra de código (`<b>`) es solo para lo que se teclea o se lee en la terminal, y las combinaciones de teclas se escriben como en las diapositivas, «Ctrl + C». Si la misión lleva una vista al lado, la terminal necesita las columnas que pide la misión (`columnas`, calculadas con sus datos: en M5, las líneas de `/etc/default/grub` que se editan, enteras en nano con el cursor detrás; en M7, las líneas de `ls -l` de los ocultos) y como poco `SOM.linux.COLS_MISION` (40). Se prueba la vista al lado, después al lado con la letra de esa terminal un escalón más pequeña y, si no es el árbol, debajo del panel de tareas; si nada sirve, se pliega y el botón «Ver la vista» la enseña. Se vuelve a decidir cuando cargan las fuentes y cuando cambia el tamaño. Las tareas de respuesta llevan su casilla (tan ancha como la respuesta) o un selector, y se comprueban con Intro o con «Comprobar». Mayúsculas y tildes cuentan (en opciones, rutas, archivos, dispositivos y variables Linux las distingue) salvo en las tareas de lenguaje corriente (`natural`: días, meses); dan igual los espacios, la barra final de una ruta, «12G» o «12 GB» y una unidad detrás de un número («4 paquetes»). Cada tarea puede aceptar más formas (`acepta`) y dar un mensaje propio cuando el dato es casi el bueno (`avisa`). La racha sube una vez por ejercicio. Si la misión necesita `sudo`, el pie de la terminal dice la contraseña (y la nueva, si se cambia con `passwd`). Resolver escribe las órdenes que faltan, con sus teclas (Tab, Ctrl + C, las de nano), las contraseñas y las respuestas de las casillas; con un programa abierto o una orden en marcha, dice qué hacer antes:

```html
<div class="term" data-mision="ut4-m1"></div>
<div class="term" data-mision="ut4-m5" data-vista="arranque"></div>
<div class="term" data-mision="estructura" data-vista="arbol"></div>
```

Misiones: `ut4-m1` a `ut4-m8` (las del guion de la UT4) y `ut4-repaso` (seis tareas cortas de tipos distintos, de un banco de toda la unidad); `primeros-pasos`, `estructura`, `copiar-mover-borrar`, `redirecciones` y `buscar` (UT4 y UT5).

Vistas: `data-vista="nombre"` busca `SOM.linux.vistas[nombre]`, una función `(el, sis, opciones)` que pinta en `el` y devuelve `{ actualiza(cambios, sis) }`; la terminal la llama tras cada orden (con lo que ha cambiado en el disco) y con el sistema nuevo al reiniciar. `opciones` trae `terminal`, `sesion()` (la sesión de bash: carpeta actual, variables) y `dataset` (los `data-` del elemento). En una misión, la vista va en una columna a la izquierda de la terminal (el árbol, tan ancho como pida hasta 250 px; las demás, 400 px) y las tareas a la derecha; sin misión, en la columna de la derecha. `arbol` está en `linux-term.js` (con `data-raiz` para la carpeta de la que sale); las demás, en `linux-vis.js`.

Atributos: `data-escenario` (`inicio`, `empresa`, `ubuntu-som` o `sin-manpages-es`; se añaden en `SOM.linux.escenarios`), `data-cwd`, `data-guion`, `data-teclas`, `data-mision`, `data-semilla` (fija el ejercicio de la misión), `data-titulo-mision="no"`, `data-vista` y `data-raiz`. Hay un ejemplo de cada modo en `plantilla/linux.html`.

El escenario (lo que se pasa a `SOM.linux.crea`) puede cambiar, además de usuario, equipo, carpetas y archivos: `nucleo` (`version`, `numero`, `arquitectura`, `gcc`, `fecha`, `modulos: { añade, quita }`, para `uname`, `/proc/version` y `lsmod`), `disco` (`tam` en GB, `swap`, `orden` de las particiones `efi`, `raiz`, `swap` y `home`, para `lsblk`, `df` y `/etc/fstab`), `sesiones` (`[{ usuario, tty, orden }]`, otros usuarios con sesión abierta para `who` y `w`), `ip`, `fecha`, `pendientes` (cuántas actualizaciones descubre `apt update`), `sobrantes` (paquetes instalados de más), `defaultGrub` y `manEs` (`false`: sin manpages-es).

El núcleo no usa la página y funciona también en Node, para las pruebas y para otros simuladores:

```js
const sis = SOM.linux.crea({ archivos: { '~/empresa/datos/resumen.csv': 'Mes,Vendedor,Ventas,Beneficio\n' } });
const sh = sis.sesion();
const r = sh.ejecuta('cut -d, -f2 empresa/datos/resumen.csv | sort -u');
// r.stdout, r.stderr, r.avisos, r.notas, r.codigo, r.trazas (lo que sale de cada tramo de la tubería), r.cambios, r.pantallas
sh.ejecuta('sudo nano /etc/default/grub', { respuestas: ['alumno'], teclas: ['Ctrl+W', 'T', 'I', 'Enter', 'Ctrl+X'] });
sh.ejecuta('ping 10.0.2.2', { ctrlCTras: 3 });   // Ctrl+C a los 3 segundos
sis.stat('~/empresa'); sis.lista('~/empresa'); sis.leeArchivo('~/empresa/datos/resumen.csv'); sis.alCambiar((ev) => …);
sis.registro;   // lo que ha pasado: líneas escritas, Ctrl+C sobre una orden, Tab, ayuda abierta, ping, exit
```

Un aviso (`r.avisos`) dice que el simulador no sabe hacer algo; una nota (`r.notas`) avisa de una diferencia con Ubuntu en algo que sí hace (por ejemplo, que recorta una página de `man`). Las dos se ven igual en la terminal.

Cada misión es un generador con semilla (`generar(semilla)`) que devuelve el escenario, las tareas, la solución, `tarea` (enunciado corto para la hoja en papel) y `variante`. Cada tarea es de uno de tres tipos: `estado` (mira el sistema), `respuesta` (casillas o selector; `esperado(e)` da lo correcto y `deSalida(salidas, e)` lo saca de lo que escriben las órdenes de la solución) o `evento` (una tecla, abrir la ayuda o la forma de la línea, en `sis.registro`). Los pasos de la solución son órdenes o `{ orden, tab, ctrlC, teclas, respuestas }`; `SOM.linux.ejecutaPaso(sh, paso)` los ejecuta.

Página de práctica libre: `linux/terminal.html`, la terminal a toda página para practicar en casa (también en el móvil). Se elige la unidad, el modo libre o una misión, y la semilla; la dirección guarda las tres (`?ut=4&m=ut4-m3&s=123456`), así que basta con pasar el enlace para que un compañero tenga el mismo ejercicio. En pantallas estrechas las tareas van debajo y la letra baja hasta que caben al menos 40 columnas; debajo de la terminal hay botones para las teclas que el móvil no tiene (Tab, flechas, Ctrl+C, Ctrl+D, Ctrl+L, q, Esc).

Pruebas: `node herramientas/prueba-linux.js` (intérprete, órdenes, cada misión resuelta con su solución en 300 semillas —sin resolver no pasa ninguna tarea, resuelta pasan todas y la respuesta de cada casilla sale de lo que escriben las órdenes—, las demostraciones de `ut04/index.html` y la comparación con la Ubuntu real). `node herramientas/linux-parpadeo.js` (con un servidor local en el puerto 8791) escribe con teclas de verdad en un Chrome sin pantalla, con la terminal llena, y comprueba que la vista no salta al principio con cada tecla (modos libre, misión, demostración, nano, man y less). `node herramientas/linux-misiones-chrome.js` (con un servidor local en el puerto 8795) juega las nueve misiones de la UT4 en un Chrome sin pantalla con teclas y clics del navegador: al entrar, con la pista, con un error y completas, y lo que pasa con el foco (también tras cada botón y cada hueco del bloque: con `foco`, solo esa parte; otro puerto, con `SOM_PUERTO`), la racha, Resolver, `exit` y `passwd`. `node herramientas/linux-practica-chrome.js [dirección]` hace lo mismo con «Practica Linux» (`assets/linux-practica.js` y su banco `assets/linux-practica-ut4.js`; la lista de encargos está en `guiones/practica-linux-ut4.md`): el recorrido completo de los encargos tecleando su solución, entrar a mitad de bloque, recargar, «Ver solución», «Reiniciar el bloque» y el foco. `node herramientas/linux-demos.js [página]` prueba solo las demostraciones: ninguna orden debe dar un aviso ni un error salvo las que llevan `data-espera`. La imagen base es la máquina Ubuntu-SOM con UEFI de la unidad (40 GiB: ESP de 1 GB en /boot/efi, raíz de 23,3G, intercambio de 1,9G y /home de 13,8G): `lsblk`, `lsblk -f`, `df -h`, `free -h`, `/etc/fstab`, `/etc/default/grub`, `/boot/grub/grub.cfg`, `ls /boot`, la ESP, `efibootmgr -v` y `sudo fdisk -l /dev/sda` dan lo mismo que las capturas de esa máquina, guardadas en `linux-real.json` (apartado `ubuntuSom`, origen «máquina Ubuntu-SOM con UEFI, 21-11-2026»). Con manpages-es, `man` de las órdenes traducidas y de las que no, `man -k`, `whatis`, `apt list`, `apt show`, `apt install manpages-es` y `dpkg -l` dan lo mismo que en una copia temporal de la máquina de pruebas con el paquete instalado (apartado `manpagesEs`, 21-11-2026; los casos marcados `sinManpagesEs`, antes de instalarlo). La comparación usa `herramientas/linux-real.json`, que se graba con `node herramientas/linux-graba-real.js` en una máquina Ubuntu 24.04 de VirtualBox con las Guest Additions (los casos están en `herramientas/linux-casos.js`); `node herramientas/linux-compara.js` enseña las diferencias que haya.

## Título con letra animada

Un título con la clase `letra` se pinta palabra a palabra al entrar en la diapositiva con la técnica de las letras sincronizadas de Apple Music (la de [am-lyrics](https://github.com/binimum/am-lyrics)): el texto es transparente y se colorea con `background-clip: text`; un degradado con el borde difuminado barre cada palabra de izquierda a derecha, y el tiempo de cada una depende de su longitud. Las palabras dentro de `<b>` se pintan carácter a carácter y cada letra, al pasar el barrido, crece un poco, sube y brilla con un halo ancho que se apaga despacio. El halo es del color de `--letra-glow` (blanco sobre fondo oscuro, que es donde luce; en claro es azul y más discreto). Se reinicia cada vez que se vuelve a la diapositiva y se desactiva con `prefers-reduced-motion`:

```html
<h2 class="letra">Test <b>masivo</b> en clase</h2>
```

Variables opcionales en el elemento: `--letra-off` (color apagado), `--letra-on` (encendido), `--letra-glow` (brillo) y `--letra-pluma` (anchura del borde difuminado, 0,75 em). Sobre fondo oscuro (`.dark`) se pinta en blanco.

## Pregunta a la clase

Diapositiva con una pregunta y un panel de ideas que se revela al pulsar (texto, imágenes o una sola imagen):

```html
<div class="revela">
  <div class="revela-cuerpo">… ideas del profesor …</div>
  <button class="btn btn-primary revela-btn">Ver ideas</button>
</div>
```

## Fotos con atribución

Toda foto ajena va dentro de una figura con su crédito. La marca © es visible siempre, la ficha aparece al pasar el ratón (y al imprimir) y un clic abre la foto a pantalla completa (Esc o clic para cerrar):

```html
<figure class="foto">
  <img src="img/foto.jpg" alt="…" title="Foto: autor · fuente · licencia">
  <figcaption class="credito">Descripción. Foto: autor, fuente, licencia <a href="…">CC BY-SA 4.0</a>. Sin modificaciones.</figcaption>
</figure>
```

Una imagen mucho más alta que ancha (una infografía, un ranking largo) se recorta en la diapositiva con `object-fit:cover` y, con la clase `scroll`, el visor la abre a todo el ancho y con scroll vertical en vez de encogerla para que quepa entera:

```html
<figure class="foto scroll" style="height:520px">
  <img src="img/ranking.png" alt="…" style="object-fit:cover;object-position:center top">
  <figcaption class="credito">…</figcaption>
</figure>
```

## Marcadores numerados sobre una foto

Para una foto anotada (una placa base, un panel de conectores): números sobre la imagen y una lista al lado. Al pasar el ratón por un elemento de la lista se resalta su número en la foto, y al revés. La figura debe tener el mismo `aspect-ratio` que la imagen para que los porcentajes coincidan:

```html
<figure class="foto" style="aspect-ratio:1600/1312;height:auto">
  <img src="img/placa-base.jpg" alt="…" title="…">
  <span class="marca" style="left:29%;top:46%">1</span>
  <figcaption class="credito">…</figcaption>
</figure>
<ol>
  <li data-marca="1">Zócalo del microprocesador…</li>
</ol>
```

## Galería de fotos

Varias fotos en el mismo hueco, con flechas para pasar y un pie que cambia con cada una. Cada foto lleva su crédito como siempre y se amplía con clic. Un elemento de la misma diapositiva con `data-ir="2"` salta a la segunda foto al pulsarlo (útil para enlazar cada paso de una lista con su imagen):

```html
<div class="galeria">
  <figure class="foto" data-pie="<b>Figura 1.2.</b> Ábaco chino…">…</figure>
  <figure class="foto" data-pie="<b>Figura 1.3.</b> Pascalina…">…</figure>
</div>
```

Por defecto la galería ocupa toda la altura del hueco; con `style="--galeria-alto:560px;--galeria-flex:none"` se fija la altura del marco.

Para capturas de pantalla, `class="foto captura"`: la imagen se ve entera (sin recortar) sobre el mismo gris azulado (`#E9EDF3`) que el fondo de los montajes de `ut01/img/captura-*.webp`.

## Ver las presentaciones en local

Las miniaturas del carril lateral toman los estilos de `assets/som.css`; abriendo el HTML directamente desde disco (`file://`) el navegador no se los pasa y las miniaturas salen sin estilo. En GitHub Pages funciona sin más. Para verlo igual en local, sirve la carpeta con un servidor sencillo:

```
python -m http.server 8000
```

y abre `http://localhost:8000/`.

## Notas del profesor

Cada diapositiva lleva sus notas en un `<aside class="notas">` como primer hijo de la sección (admite HTML: negritas, listas, enlaces). Formato de cada nota: primera línea en negrita con qué hacer (pregunta, demo con la orden en `<code>`, pizarra), después los datos que no están en la diapositiva en una lista corta, el error típico si lo hay y el enlace a otra sección o práctica; entre 150 y 400 caracteres. El criterio de evaluación que cubre la diapositiva va en `data-criterio` de la sección, no en la nota; la ventana lo muestra como pastilla. No se ven en la diapositiva; la tecla **N** abre `assets/notas.html` en una ventana aparte, que muestra las notas de la diapositiva actual, la siguiente y un reloj, y se actualiza al cambiar de diapositiva. Desde esa ventana también se puede avanzar y retroceder.

La ventana tiene dos pestañas:

- **Guion**: las notas publicadas. Se pueden editar en clase; los cambios se guardan en el `localStorage` del navegador y se marcan como "Editado en este navegador".
- **Bitácora**: notas privadas de clase (qué cambiar, qué ha funcionado), por diapositiva y para toda la unidad. No se publican nunca.

Lo guardado vive solo en ese navegador y en ese ordenador: al acabar la clase, **Exportar** descarga un JSON con todo (`notas-utNN-fecha.json`); **Importar** fusiona un JSON en otro ordenador conservando la versión más reciente de cada nota. Al terminar la unidad, el script vuelca el JSON al repositorio:

```
python herramientas/aplica-notas.py notas-ut01-2026-10-15.json --ver   # muestra el antes y el después
python herramientas/aplica-notas.py notas-ut01-2026-10-15.json         # escribe en ut01/index.html
```

Las notas de guion cambiadas se escriben en su `<aside>` (localizado por `data-label`, que debe ser único en la unidad) y la bitácora se guarda como Markdown junto al JSON, fuera del repositorio.

## Buscador dentro de la unidad

Tecla B, o el botón «Buscar» de la barra flotante, abre un panel que busca en las diapositivas de la presentación abierta (rótulo y texto visible, sin las notas del profesor ni los ejercicios y simuladores generados). No necesita servidor: el índice se construye en el navegador a partir del propio documento, así que funciona igual en GitHub Pages o abriendo el archivo. Se busca sin distinguir tildes ni mayúsculas; ↑ ↓ para moverse por los resultados, Enter para saltar a la diapositiva y Esc para cerrar. Está en `assets/som.js` (`montaBuscador`) y `assets/som.css` (`.buscador`).

## Navegación

Flechas o espacio para avanzar, Inicio y Fin para ir al principio o al final, R para volver a la primera. Ctrl+P imprime una página por diapositiva. N abre la ventana de notas del profesor, C la calculadora y B el buscador de la unidad.

Para volver: el rótulo del módulo de la portada y el botón «Inicio» de la barra flotante (aparece al mover el ratón; no sale en pantalla completa ni al imprimir) llevan a la página principal del módulo; la pastilla con el número de sección, arriba a la derecha, salta al índice de la unidad; la diapositiva de cierre lleva botones a la página principal y a la unidad siguiente.

## Licencia

- **Contenido** (diapositivas, textos, esquemas e imágenes propias): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es) — ver `LICENSE`. Se puede copiar, adaptar y reutilizar, incluso con fines comerciales, citando la autoría y compartiendo el resultado bajo la misma licencia.
- **Código** (`assets/deck-stage.js`, `assets/som.js`, `assets/som.css` y el simulador de Linux, `assets/linux*.js` y `assets/linux.css`, salvo los textos copiados de Ubuntu): [MIT](LICENSE-CODE) — ver `LICENSE-CODE`.
- **Excepción: material de terceros.** Las fotografías e ilustraciones ajenas no están cubiertas por la licencia anterior. Cada una lleva su crédito y su licencia en el `figcaption` de la figura y se usan con fines educativos. Para reutilizarlas hay que acudir a la licencia original de cada una.

Autoría: Raúl Ibáñez, 2026. Atribución sugerida: «Raúl Ibáñez, *Sistemas Operativos Monopuesto (0222)*, CC BY-SA 4.0».
