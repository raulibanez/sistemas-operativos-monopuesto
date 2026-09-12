# Sistemas Operativos Monopuesto (0222)

Materiales del módulo en formato presentación 16:9 para web. Los alumnos siguen las presentaciones en clase y estudian desde ellas.

## Estructura

```
index.html          Portada con las diez unidades de trabajo
assets/             Motor de diapositivas (deck-stage.js), estilos y ejercicios (som.css, som.js), iconos
plantilla/          Tipos de diapositiva disponibles y ejercicios interactivos de prueba
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

`ut01/hoja.html` genera hojas de ejercicios en papel con los mismos generadores y un número de lista como semilla (la misma hoja sale siempre igual para el mismo número): título, rango de alumnos, cuántos ejercicios de cada tipo y solucionario opcional al final; la configuración queda en la dirección de la página para imprimir toda la clase de una vez.

Un ejemplo resuelto se maqueta con la misma rejilla sin casillas: `<div class="sv compacta" style="grid-template-columns:…">` con `<span class="lbl">`, `<span class="d">` (y `d res`, `d carry`, `d tenue`) y `<div class="linea">`.

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

## Navegación

Flechas o espacio para avanzar, Inicio y Fin para ir al principio o al final, R para volver a la primera. Ctrl+P imprime una página por diapositiva.

## Licencia

- **Contenido** (diapositivas, textos, esquemas e imágenes propias): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es) — ver `LICENSE`. Se puede copiar, adaptar y reutilizar, incluso con fines comerciales, citando la autoría y compartiendo el resultado bajo la misma licencia.
- **Código** (`assets/deck-stage.js`, `assets/som.js`, `assets/som.css`): [MIT](LICENSE-CODE) — ver `LICENSE-CODE`.
- **Excepción: material de terceros.** Las fotografías e ilustraciones ajenas no están cubiertas por la licencia anterior. Cada una lleva su crédito y su licencia en el `figcaption` de la figura y se usan con fines educativos. Para reutilizarlas hay que acudir a la licencia original de cada una.

Autoría: Raúl Ibáñez, 2026. Atribución sugerida: «Raúl Ibáñez, *Sistemas Operativos Monopuesto (0222)*, CC BY-SA 4.0».
