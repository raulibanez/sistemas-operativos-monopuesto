# Sistemas Operativos Monopuesto (0222)

Materiales del módulo en formato presentación 16:9 para web. Los alumnos siguen las presentaciones en clase y estudian desde ellas.

## Estructura

```
index.html          Portada con las diez unidades de trabajo
assets/             Motor de diapositivas (deck-stage.js), estilos y ejercicios (som.css, som.js), iconos
plantilla/          Tipos de diapositiva disponibles y ejercicios interactivos de prueba
herramientas/       Scripts de mantenimiento (aplica-notas.py vuelca las notas editadas en clase)
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

Todos se resuelven en vertical, con huecos, como en la pizarra: **Comprobar**, **Pista** (rellena la siguiente casilla y la explica), **Resolver**, **Otro ejercicio** y racha de aciertos. Tipos disponibles: `bin2dec` (tabla de pesos), `dec2bin` (divisiones entre 2), `decfrac2bin` (multiplicaciones por 2), `bases` (binario, octal, hexadecimal y decimal; `data-modo` fija uno de `bin2oct`, `bin2hex`, `oct2bin`, `hex2bin`, `hex2dec`), `sumabin`, `restabin` (con botón Invertir y signo), `logica` (`data-modo` NOT, AND, OR, XOR, NAND o NOR), `c1c2`, `restac2` (por pasos), `paridad` (`data-modo` `calcular` o `detectar`, `data-paridad` `par` o `impar`), `unidades` (`data-modo` `bits`, `binario` o `fabricante`), `ascii` (`data-modo` `codigo`, `caracter` o `caso`) e `ieee754` (simple precisión por campos). Atributos comunes: `data-bits`, `data-min`, `data-max`. Los quiz de opción múltiple usan la clase `quiz` con `data-correct`.

`ut01/hoja.html` genera hojas de ejercicios en papel con los mismos generadores y una semilla (seed) que elige quien la genera (la misma hoja sale siempre igual para la misma semilla y el mismo título): título, semilla, cuántos ejercicios de cada tipo, solucionario opcional al final y modo examen (solo la tarea en cada enunciado, sin las pistas que dan el método); la configuración queda en la dirección de la página. Lo normal es repartir a toda la clase la misma hoja con una semilla nueva; los alumnos generan en casa las que quieran.

Generadores de la UT2 (mismo formato de rejilla): `estados` (transiciones entre estados de un proceso), `planificacion` (el cronograma que resuelve el alumno: fila CPU, tiempos de espera y respuesta y medias; `data-modo` fija uno de `fifo`, `sjf`, `srtf`, `pne`, `pe`, `rr`), `paginacion` (`data-modo` `paginas`, `huecos` o `virtual`), `arranque` (ordenar los siete pasos; `data-modo` `uefi` o `bios`) y `sistemas-archivos` (elegir el sistema de archivos de un caso). El generador `bases` de la UT1 añade el modo `dec2hex`. Un generador puede definir `alEscribir(sv)`, que el motor llama cada vez que el alumno escribe (el de planificación colorea el cronograma).

`ut02/hoja.html` es la hoja en papel de la UT2: cronogramas de cada algoritmo (con el solucionario coloreado) y los demás ejercicios de la unidad, con el mismo mecanismo de semilla que la de la UT1.

`assets/som.js` incluye también un **simulador visual de planificación de procesos**, paso a paso, para explicar los algoritmos de la UT2: en la misma diapositiva van `<div class="sim-entrada"></div>` (datos de entrada editables y tabla de tiempos) y `<div class="sim" data-algo="fifo"></div>` (cronograma, cola de listos, CPU y explicación de cada instante). Algoritmos: `fifo`, `sjf`, `srtf`, `pne` y `pe` (prioridades no expulsivo y expulsivo, 1 = la más alta) y `rr` (con `data-q`); `data-procesos="0/7,2/4,3/3,5/2"` fija los datos iniciales. Reglas de empate: FIFO; en SRTF y prioridades expulsivo sigue el que está; en Round Robin el que llega entra en la cola antes que el que agota su quantum. Hay un ejemplo en `plantilla/`.

Un ejemplo resuelto se maqueta con la misma rejilla sin casillas: `<div class="sv compacta" style="grid-template-columns:…">` con `<span class="lbl">`, `<span class="d">` (y `d res`, `d carry`, `d tenue`) y `<div class="linea">`.

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
- **Código** (`assets/deck-stage.js`, `assets/som.js`, `assets/som.css`): [MIT](LICENSE-CODE) — ver `LICENSE-CODE`.
- **Excepción: material de terceros.** Las fotografías e ilustraciones ajenas no están cubiertas por la licencia anterior. Cada una lleva su crédito y su licencia en el `figcaption` de la figura y se usan con fines educativos. Para reutilizarlas hay que acudir a la licencia original de cada una.

Autoría: Raúl Ibáñez, 2026. Atribución sugerida: «Raúl Ibáñez, *Sistemas Operativos Monopuesto (0222)*, CC BY-SA 4.0».
