/* Simulador de Linux · terminal de GNOME (Ubuntu 24.04) dentro de una diapositiva.
 *
 * Se monta sola sobre cada <div class="term"> de la página (no hace falta tocar som.js):
 *   <div class="term"></div>                                   modo libre, en la carpeta personal
 *   <div class="term" data-escenario="empresa" data-cwd="~/empresa"></div>
 *   <div class="term" data-guion data-teclas> <ol class="term-guion" hidden> … </ol> </div>      demostración
 *   <div class="term" data-mision="ut4-m1"></div>                                                 misión
 *   <div class="term" data-mision="estructura" data-vista="arbol"></div>       misión con el árbol al lado
 * Pasos de una demostración (cada uno con su explicación dentro del <li>):
 *   <li data-orden="ls -l">     escribe la orden y espera a que se pulse Intro (o el botón)
 *   <li data-escribe="ec">      escribe sin pulsar Intro (en la línea, en una contraseña o en el programa abierto)
 *   <li data-tecla="Tab">       pulsa una tecla: Tab, Enter, Escape, Space, ArrowUp, ArrowDown, Ctrl+C, Ctrl+L,
 *                               Ctrl+O, Ctrl+X, Ctrl+W, Ctrl+K, Ctrl+Z, Ctrl+D o un carácter (q, n, /); va al
 *                               programa que esté abierto y siempre se ve en el indicador
 *   <li>                        solo la explicación
 *   data-espera="aviso" o "error" en un paso: lo que se espera que salga (lo usa la prueba de las demostraciones)
 * Con el foco en la terminal, Av Pág es el botón «Siguiente orden / Intro» (el mando de presentaciones).
 * Atributos: data-escenario (de SOM.linux.escenarios), data-cwd, data-semilla (misión), data-vista (vista
 * enchufable de SOM.linux.vistas: «arbol», con data-raiz para la carpeta, o las de linux-vis.js como «arranque»),
 * data-teclas (indicador grande de las teclas especiales), data-titulo-mision="no" (oculta el título).
 *
 * Vistas: SOM.linux.vistas[nombre] = function (el, sis, opciones) -> { actualiza(cambios, sis) }; opciones:
 * { terminal, sesion: () => sesión de bash, dataset }. La terminal la llama tras cada orden (cambios: lo que ha
 * cambiado en el disco) y con el sistema nuevo al reiniciar.
 *
 * El teclado lo recoge un <textarea> de verdad (así funciona también el teclado del móvil); la terminal dibuja
 * la línea y el cursor. Mientras tiene el foco, deck-stage no recibe las teclas; Esc devuelve el foco. Arrastrar
 * con el ratón selecciona; Ctrl+Mayús+C copia y Ctrl+Mayús+V pega, como en la terminal de GNOME.
 */
(function () {
  'use strict';
  const SOM = (window.SOM = window.SOM || {});
  const L = SOM.linux;
  if (!L) return;
  const base = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, '') : '../assets/';

  // escenarios de la terminal libre y de las demostraciones: en linux-misiones.js (también los usan las pruebas)
  L.escenarios = L.escenarios || { inicio: {} };

  /* ---------------- ANSI -> HTML ---------------- */
  const PALETA = ['#171421', '#C01C28', '#26A269', '#A2734C', '#12488B', '#A347BA', '#2AA1B3', '#D0CFCC', '#5E5C64', '#F66151', '#33D17A', '#E9AD0C', '#2A7BDE', '#C061CB', '#33C7DE', '#FFFFFF'];
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function nuevoSGR() { return { fg: null, bg: null, b: false, u: false, inv: false, dim: false }; }
  function aplicaSGR(st, codigos) {
    const c = codigos.length ? codigos : [0];
    for (let i = 0; i < c.length; i++) {
      const n = c[i];
      if (n === 0) Object.assign(st, nuevoSGR());
      else if (n === 1) st.b = true; else if (n === 2) st.dim = true; else if (n === 4) st.u = true; else if (n === 7) st.inv = true;
      else if (n === 22) { st.b = false; st.dim = false; } else if (n === 24) st.u = false; else if (n === 27) st.inv = false;
      else if (n >= 30 && n <= 37) st.fg = n - 30; else if (n === 39) st.fg = null;
      else if (n >= 40 && n <= 47) st.bg = n - 40; else if (n === 49) st.bg = null;
      else if (n >= 90 && n <= 97) st.fg = n - 90 + 8; else if (n >= 100 && n <= 107) st.bg = n - 100 + 8;
      else if ((n === 38 || n === 48) && c[i + 1] === 5) { const v = c[i + 2]; if (n === 38) st.fg = v < 16 ? v : null; else st.bg = v < 16 ? v : null; i += 2; }
    }
  }
  function estilo(st) {
    let fg = st.fg, bg = st.bg;
    if (st.b && fg !== null && fg < 8) fg += 8;    // negrita en colores brillantes
    let s = '';
    let cfg = fg !== null ? PALETA[fg] : null, cbg = bg !== null ? PALETA[bg] : null;
    if (st.inv) { const t = cfg || 'var(--term-texto)'; cfg = cbg || 'var(--term-fondo)'; cbg = t; }
    if (cfg) s += `color:${cfg};`;
    if (cbg) s += `background:${cbg};`;
    if (st.b) s += 'font-weight:700;';
    if (st.u) s += 'text-decoration:underline;';
    if (st.dim) s += 'opacity:.7;';
    return s;
  }
  // convierte un trozo de salida; st guarda los colores entre trozos; col, la columna (para los tabuladores)
  function ansiAHtml(texto, st, posicion, acciones) {
    texto = texto.replace(/_\x08(.)/g, '\x1b[4m$1\x1b[24m').replace(/(.)\x08\1/g, '\x1b[1m$1\x1b[22m').replace(/[^\n]\x08/g, '');
    let html = '', buf = '';
    const vacia = () => { if (!buf) return; const s = estilo(st); html += s ? `<span style="${s}">${esc(buf)}</span>` : esc(buf); buf = ''; };
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (ch === '\x1b') {
        const resto = texto.slice(i);
        let m;
        if ((m = resto.match(/^\x1b\[([0-9;]*)m/))) { vacia(); aplicaSGR(st, m[1] ? m[1].split(';').map(Number) : []); i += m[0].length - 1; continue; }
        if ((m = resto.match(/^\x1b\](\d+);([^\x07\x1b]*)(\x07|\x1b\\)/))) { if (acciones && m[1] === '0') acciones.titulo = m[2]; i += m[0].length - 1; continue; }
        if ((m = resto.match(/^\x1b\[([0-9;?]*)([A-Za-z])/))) {
          if (acciones && m[2] === 'J' && (m[1] === '2' || m[1] === '3')) { vacia(); html = ''; acciones.borra = true; posicion.col = 0; }
          i += m[0].length - 1; continue;
        }
        if ((m = resto.match(/^\x1b[()][0-9A-B]/))) { i += m[0].length - 1; continue; }
        continue;
      }
      if (ch === '\n') { buf += '\n'; posicion.col = 0; continue; }
      if (ch === '\t') { const n = 8 - (posicion.col % 8); buf += ' '.repeat(n); posicion.col += n; continue; }
      if (ch === '\r') continue;
      if (ch === '\x07') continue;
      buf += ch; posicion.col++;
    }
    vacia();
    return html;
  }
  L.ansiAHtml = ansiAHtml;

  /* ---------------- archivos que se cargan cuando hacen falta ---------------- */
  // linux-ayuda.js (man y --help), linux-whatis.js (man -k), linux-info.js, linux-ayuda-es.js y, si la página no
  // los trae, linux-ut4.js y linux-misiones-ut4.js
  // carga(archivo) da una promesa con true si ha llegado. Si falla (sin red), no cuenta como cargado: la siguiente
  // orden que lo necesite lo vuelve a pedir
  const cargas = {}, cargados = new Set();
  function carga(archivo) {
    if (!cargas[archivo]) cargas[archivo] = new Promise((ok) => {
      const s = document.createElement('script');
      s.src = base + archivo;
      s.onload = () => { cargados.add(archivo); ok(true); };
      s.onerror = () => { delete cargas[archivo]; s.remove(); ok(false); };
      document.head.appendChild(s);
    });
    return cargas[archivo];
  }
  const yaCargado = (archivo) => cargados.has(archivo) || (archivo === 'linux-ayuda.js' && !!L.ayuda) || (archivo === 'linux-whatis.js' && !!L.whatis) ||
    (archivo === 'linux-info.js' && !!L.info) || (archivo === 'linux-ayuda-es.js' && !!L.ayudaEs) || (archivo === 'linux-whatis-es.js' && !!L.whatisEs);
  /* La ayuda (unos 1,4 MB) empieza a bajarse en segundo plano la primera vez que una terminal pasa a estar en uso, no
   * al abrir la unidad: así, cuando se escribe man o --help, casi nunca hay que esperar. De una en una y sin prisa. */
  let precargando = false;
  L.precargaAyuda = function () {
    if (precargando || typeof document === 'undefined') return;
    precargando = true;
    const lista = ['linux-ayuda.js', 'linux-ayuda-es.js', 'linux-whatis.js', 'linux-whatis-es.js', 'linux-info.js'].filter((f) => !yaCargado(f));
    const siguiente = () => { const f = lista.shift(); if (!f) return; carga(f).then((bien) => { if (!bien) { precargando = false; return; } setTimeout(siguiente, 300); }); };
    setTimeout(siguiente, 1200);
  };

  /* ---------------- indicador de teclas ---------------- */
  const TECLAS = {
    ArrowUp: ['↑', 'orden anterior'], ArrowDown: ['↓', 'orden siguiente'], ArrowLeft: ['←', 'mueve el cursor'], ArrowRight: ['→', 'mueve el cursor'],
    Home: ['Inicio', 'al principio de la línea'], End: ['Fin', 'al final de la línea'], Tab: ['Tab', 'completa el nombre'], TabTab: ['Tab Tab', 'enseña las posibilidades'],
    Enter: ['Intro', 'ejecuta la orden'], Space: ['Espacio', ''], Escape: ['Esc', 'vuelve a las diapositivas'],
    'Ctrl+C': ['Ctrl + C', 'cancela'], 'Ctrl+L': ['Ctrl + L', 'limpia la pantalla'], 'Ctrl+A': ['Ctrl + A', 'al principio de la línea'], 'Ctrl+E': ['Ctrl + E', 'al final de la línea'],
    'Ctrl+U': ['Ctrl + U', 'borra lo escrito'], 'Ctrl+D': ['Ctrl + D', 'fin de la entrada'], 'Ctrl+DSalir': ['Ctrl + D', 'cierra la terminal'], 'Ctrl+K': ['Ctrl + K', 'borra hasta el final'],
    'Ctrl+W': ['Ctrl + W', 'borra la palabra anterior'], 'Ctrl+Z': ['Ctrl + Z', 'detiene la orden'],
    'Ctrl+Shift+C': ['Ctrl + Mayús + C', 'copia lo seleccionado'], 'Ctrl+Shift+V': ['Ctrl + Mayús + V', 'pega']
  };
  // en un programa a pantalla completa (man, less, top, nano) las teclas hacen otras cosas
  const TECLAS_PROG = {
    ArrowUp: ['↑', 'sube'], ArrowDown: ['↓', 'baja'], ArrowLeft: ['←', 'a la izquierda'], ArrowRight: ['→', 'a la derecha'], Enter: ['Intro', ''],
    PageDown: ['Av Pág', 'página siguiente'], PageUp: ['Re Pág', 'página anterior'], Space: ['Espacio', 'avanza'], Escape: ['Esc', ''],
    Home: ['Inicio', ''], End: ['Fin', ''], Tab: ['Tab', ''], Delete: ['Supr', 'borra'], q: ['q', 'sale'], '/': ['/', 'busca'], n: ['n', 'siguiente'], h: ['h', 'ayuda']
  };
  const etiquetaTecla = (k) => (k === 'Space' || k === ' ' ? 'Espacio' : k === 'Enter' ? 'Intro' : k === 'Escape' ? 'Esc' : k === 'Delete' ? 'Supr' : k);

  // la barra de atajos de nano se puede pulsar: «^O Guardar» -> Ctrl+O; « S Sí» -> s
  function barraPulsable(linea) {
    const partes = linea.split(/(\x1b\[7m(?:\^.|M-.| [SN])\x1b\[27m [^\x1b]*)/);
    if (partes.length < 2) return null;
    return partes.map((p) => {
      const m = p.match(/^\x1b\[7m(\^.|M-.| [SN])\x1b\[27m ([^\x1b]*)$/);
      if (!m) return p ? esc(p) : '';
      const k = m[1][0] === '^' ? 'Ctrl+' + m[1][1] : m[1][0] === ' ' ? m[1][1].toLowerCase() : null;
      const dentro = `<span class="term-inv">${esc(m[1])}</span> ${esc(m[2])}`;
      return k && /^Ctrl\+[A-Z]$|^[sn]$/.test(k) ? `<button type="button" class="term-atajo" data-k="${esc(k)}">${dentro}</button>` : `<span class="term-atajo-no">${dentro}</span>`;
    }).join('');
  }

  /* ============================== la terminal ============================== */
  class Terminal {
    constructor(el) {
      this.el = el;
      el._terminal = this;
      this.modo = el.hasAttribute('data-mision') ? 'mision' : (el.hasAttribute('data-guion') ? 'demo' : 'libre');
      this.vistaNombre = el.dataset.vista || '';
      this.conArbol = this.vistaNombre === 'arbol';
      this.conTeclas = el.hasAttribute('data-teclas');
      const guion = el.querySelector('.term-guion');
      this.pasos = guion ? [...guion.querySelectorAll('li')].map((li) => {
        const d = li.dataset;
        const tipo = d.orden !== undefined ? 'orden' : d.escribe !== undefined ? 'escribe' : d.tecla !== undefined ? 'tecla' : 'explica';
        return { tipo, valor: tipo === 'orden' ? d.orden : tipo === 'escribe' ? d.escribe : tipo === 'tecla' ? d.tecla : '', html: li.innerHTML, espera: d.espera };
      }) : [];
      if (!this.pasos.length && el.dataset.guion && L.guiones && L.guiones[el.dataset.guion]) this.pasos = L.guiones[el.dataset.guion].map((p) => Object.assign({ tipo: 'orden', valor: p.orden }, p));
      this.paso = 0;
      this.racha = 0;
      this.semilla = el.dataset.semilla ? +el.dataset.semilla : Math.floor(Math.random() * 1e9);
      this.construye();
      this.nuevaSesion();
      this.escucha();
    }

    /* ---------- estructura ---------- */
    construye() {
      const el = this.el;
      el.classList.add('term-montada', 'term-modo-' + this.modo);
      el.innerHTML = `
        <div class="term-col">
          <div class="term-ventana">
            <div class="term-barra"><span class="term-barra-izq" aria-hidden="true"></span><span class="term-titulo">alumno@som: ~</span><span class="term-ventanas"><button type="button" class="letra-menos" aria-label="Reducir la letra" title="Reducir la letra"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.2" cy="8.2" r="5.6"/><path d="M12.4 12.4 17.4 17.4"/><path d="M5.4 8.2h5.6"/></svg></button><button type="button" class="letra-mas" aria-label="Ampliar la letra" title="Ampliar la letra"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.2" cy="8.2" r="5.6"/><path d="M12.4 12.4 17.4 17.4"/><path d="M5.4 8.2h5.6M8.2 5.4v5.6"/></svg></button><i class="min" aria-hidden="true"></i><button type="button" class="max" aria-label="Maximizar" title="Maximizar"></button><button type="button" class="cerrar" aria-label="Cerrar la terminal" title="Cerrar"></button></span></div>
            <div class="term-pantalla" tabindex="-1">
              <div class="term-texto"><span class="term-salida"></span><span class="term-linea"></span></div>
              <span class="term-medida" aria-hidden="true">MMMMMMMMMM</span>
            </div>
            <!-- el textarea va fuera de la pantalla que se desplaza: si estuviera dentro, el navegador subiría la
                 pantalla hasta él (cerca del principio del texto) con cada tecla, y se vería un parpadeo -->
            <textarea class="term-entrada" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" rows="1" aria-label="Escribe aquí las órdenes de la terminal"></textarea>
            <div class="term-programa" tabindex="-1" hidden><div class="term-programa-texto"></div><div class="term-programa-teclas"></div></div>
            <div class="term-cerrada" hidden><p><b>La terminal se ha cerrado.</b> <code>exit</code> termina la sesión de bash y, en Ubuntu, la ventana de la terminal se cierra.</p><button type="button" class="btn btn-primary">Abrir otra terminal</button></div>
            <div class="term-tecla" hidden><b></b><span></span></div>
          </div>
          <div class="term-pie">
            <span class="term-foco">Pulsa en la terminal para escribir</span>
            <span class="term-acciones"></span>
          </div>
          <p class="term-explica" hidden></p>
          <p class="term-msj" role="status" aria-live="polite" hidden><span class="term-msj-texto"></span><span class="term-msj-pendiente"></span></p>
        </div>
        <div class="term-lado" hidden></div>`;
      const $ = (s) => el.querySelector(s);
      this.ventana = $('.term-ventana'); this.pantalla = $('.term-pantalla'); this.salida = $('.term-salida'); this.linea = $('.term-linea');
      this.entrada = $('.term-entrada'); this.medida = $('.term-medida'); this.titulo = $('.term-titulo'); this.foco = $('.term-foco');
      this.prog = $('.term-programa'); this.progTexto = $('.term-programa-texto'); this.progTeclas = $('.term-programa-teclas');
      this.tecla = $('.term-tecla'); this.acciones = $('.term-acciones'); this.explica = $('.term-explica'); this.lado = $('.term-lado');
      this.cerradaCaja = $('.term-cerrada');
      $('.term-ventanas .max').addEventListener('click', (e) => { e.stopPropagation(); this.maximiza(!this.maximizada); });
      $('.term-ventanas .letra-menos').addEventListener('click', (e) => { e.stopPropagation(); L.cambiaLetra(-1); });
      $('.term-ventanas .letra-mas').addEventListener('click', (e) => { e.stopPropagation(); L.cambiaLetra(1); });
      $('.term-ventanas .cerrar').addEventListener('click', (e) => { e.stopPropagation(); this.cierraVentana(); });
      this.aplicaEscala(false);
      $('.term-barra').addEventListener('dblclick', (e) => { if (e.target.closest('button')) return; e.preventDefault(); e.stopPropagation(); this.maximiza(!this.maximizada); });
      this.cerradaCaja.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); this.reabre(); this.enfoca(); });
      // botones del pie
      const boton = (texto, clase, f) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + clase; b.textContent = texto; b.addEventListener('click', (e) => { e.stopPropagation(); f(); }); this.acciones.appendChild(b); return b; };
      if (this.modo === 'demo') {
        this.bSiguiente = boton('Siguiente orden', 'btn-primary', () => this.siguienteOrden());
        this.bSiguiente.title = 'También con Av Pág cuando la terminal tiene el foco';
        this.contador = document.createElement('span'); this.contador.className = 'term-paso'; this.acciones.appendChild(this.contador);
      }
      if (this.modo !== 'mision') boton('Reiniciar', 'btn-ghost', () => this.reinicia());
      if (this.vistaNombre) this.bVista = boton('Ocultar la vista', 'btn-ghost term-bvista', () => { this.vistaElegida = true; this.pliegaVista(!this.el.classList.contains('term-vista-plegada')); });
      if (this.modo === 'mision') this.montaMision();
      // dónde va la vista: en una misión, en una columna a la izquierda de la terminal (el árbol, tan ancho como
      // pida hasta 250 px; las demás, 400 px); sin misión, en la columna lateral
      if (this.vistaNombre) {
        this.cajaVista = document.createElement('div');
        this.cajaVista.className = 'term-vista term-vista-' + this.vistaNombre;
        if (this.modo === 'mision') {
          el.classList.add('term-tres');
          if (!this.conArbol) el.classList.add('term-tres-ancha');
          const col = document.createElement('div'); col.className = 'term-arbol-col';
          col.appendChild(this.cajaVista);
          el.insertBefore(col, el.firstChild);
        } else this.lado.appendChild(this.cajaVista);
      }
      if (this.vistaNombre || this.modo === 'mision') { this.lado.hidden = false; el.classList.add('term-con-lado'); }
    }
    montaMision() {
      const m = L.misiones[this.el.dataset.mision];
      if (!m) { this.lado.textContent = 'Misión desconocida: ' + this.el.dataset.mision; return; }
      const caja = document.createElement('div');
      caja.className = 'term-mision';
      caja.innerHTML = `<p class="term-mision-titulo"></p><p class="term-mision-clave" hidden></p><ol class="term-tareas"></ol><button type="button" class="term-tareas-mas" hidden>Más tareas abajo ↓</button>
        <div class="ej-fila term-mision-botones"><button type="button" class="btn btn-ghost" data-a="pista">Pista</button><button type="button" class="btn btn-ghost" data-a="resolver">Resolver</button><button type="button" class="btn btn-ghost" data-a="otro">Otro ejercicio</button><button type="button" class="btn btn-ghost" data-a="reiniciar">Reiniciar</button></div>
        <p class="ej-racha">Aciertos seguidos: <b>0</b></p>`;
      // los mensajes de la misión van en una franja propia debajo de la terminal: la lista de tareas no cambia de tamaño
      this.msj = this.el.querySelector('.term-msj');
      this.msj.hidden = false;
      // la contraseña del simulador, en el pie de la terminal (deja sitio a las tareas)
      this.clave = caja.querySelector('.term-mision-clave');
      this.el.querySelector('.term-pie').insertBefore(this.clave, this.acciones);
      if (this.el.dataset.tituloMision === 'no') caja.querySelector('.term-mision-titulo').hidden = true;
      this.lado.appendChild(caja);
      this.cajaMision = caja;
      caja.querySelector('.term-mision-botones').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        e.stopPropagation();
        const a = b.dataset.a;
        if (a === 'pista') this.pista();
        else if (a === 'resolver') this.resolver();
        else if (a === 'otro') { this.semilla = Math.floor(Math.random() * 1e9); this.nuevaSesion(); this.enfoca(); }
        else if (a === 'reiniciar') { this.nuevaSesion(); this.enfoca(); }
      });
      // casillas de respuesta: Intro o «Comprobar»
      const ol = caja.querySelector('.term-tareas');
      ol.addEventListener('click', (e) => { const b = e.target.closest('.term-comprobar'); if (!b) return; e.stopPropagation(); this.compruebaRespuesta(+b.closest('li').dataset.i); });
      ol.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && e.target.closest('.term-casilla, .term-selector')) { e.preventDefault(); this.compruebaRespuesta(+e.target.closest('li').dataset.i); }
        if (e.key === 'Escape') { this.enUso = false; e.target.blur(); }
      });
      ['keyup', 'keypress'].forEach((ev) => ol.addEventListener(ev, (e) => e.stopPropagation()));
      ['keydown', 'keyup', 'keypress'].forEach((ev) => caja.addEventListener(ev, (e) => { if (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key.length === 1 || e.key === 'Enter')) e.stopPropagation(); }));
      ol.addEventListener('click', (e) => { if (e.target.closest('li.hecha') || !e.target.closest('input, select, button')) { e.stopPropagation(); this.enfoca(); } });
      ol.addEventListener('scroll', () => this.marcaSigue(), { passive: true });
      caja.querySelector('.term-tareas-mas').addEventListener('click', (e) => { e.stopPropagation(); ol.scrollBy({ top: ol.clientHeight * 0.8, behavior: 'smooth' }); });
    }

    /* ---------- sistema y sesión ---------- */
    nuevaSesion() {
      this.para();
      let esc0 = L.escenarios[this.el.dataset.escenario || 'inicio'] || {};
      this.mision = null;
      if (this.modo === 'mision' && L.misiones[this.el.dataset.mision]) {
        this.mision = L.misiones[this.el.dataset.mision].generar(this.semilla);
        esc0 = this.mision.escenario;
      }
      this.sis = L.crea(Object.assign({}, esc0, this.el.dataset.cwd ? { cwd: this.el.dataset.cwd } : {}));
      this.sh = this.sis.sesion({ columnas: 80, lineas: 24 });
      this.salida.innerHTML = '';
      this.sgr = nuevoSGR(); this.pos = { col: 0 };
      this.ej = null; this.leyendo = null; this.pendiente = ''; this.histIdx = null; this.tabs = 0; this.claveAvisada = false;
      this.cierra(false);
      this.entrada.value = '';
      this.programa = null; this.prog.hidden = true; this.el.classList.remove('term-en-programa');
      this.paso = 0; this.esperaDemo = undefined;
      this.explica.hidden = true;
      if (this.modo === 'demo') this.actualizaDemo();
      if (this.mision) {
        this.hechas = this.mision.tareas.map(() => false);
        this.respuestas = [];
        this.conAyuda = false; this.resuelta = false; this.nivelPista = {};
        this.pintaMision();
        this.mensaje('');
      }
      this.mide();
      this.pinta();
      this.actualizaVista([]);
    }
    reinicia() { this.nuevaSesion(); this.enfoca(); }
    para() {
      [this.temporizador, this.escribiendo, this.colaTimer].forEach((t) => t && clearTimeout(t));
      this.temporizador = this.escribiendo = this.colaTimer = null;
      if (this.refresco) clearInterval(this.refresco); this.refresco = null;
      this.colaAcc = null; this.colaOcupada = false;
    }
    // la vista enchufable: se monta la primera vez y luego se le pasan los cambios
    actualizaVista(cambios) {
      if (!this.cajaVista) return;
      if (!this.vista) {
        const f = L.vistas && L.vistas[this.vistaNombre];
        if (!f) {
          this.cajaVista.innerHTML = `<p class="term-vista-falta">No está la vista «${esc(this.vistaNombre)}».</p>`;
          if (!this.vistaReintento) { this.vistaReintento = true; window.addEventListener('load', () => { if (!this.vista) { this.cajaVista.innerHTML = ''; this.actualizaVista([]); } }); }
          return;
        }
        this.cajaVista.innerHTML = '';
        this.vista = f(this.cajaVista, this.sis, { terminal: this, sesion: () => this.sh, dataset: this.el.dataset }) || {};
        return;
      }
      if (this.vista.actualiza) { try { this.vista.actualiza(cambios, this.sis); } catch (e) { /* la vista no debe parar la terminal */ } }
    }
    // columnas y filas que caben (medidas sin la escala de deck-stage)
    mideSolo() {
      const w = this.medida.offsetWidth / 10, h = this.medida.offsetHeight;
      if (!w || !this.pantalla.clientWidth) return false;
      const est = getComputedStyle(this.pantalla);
      const ancho = this.pantalla.clientWidth - parseFloat(est.paddingLeft) - parseFloat(est.paddingRight);
      const alto = this.pantalla.clientHeight - parseFloat(est.paddingTop) - parseFloat(est.paddingBottom);
      this.cols = L.columnasTerminal(ancho, w);
      this.filas = L.filasTerminal(alto, h);
      this.anchoCar = w; this.altoLinea = h;
      return true;
    }
    mide() {
      this.ajustaCasillas();
      this.reservaMensaje();
      if (!this.mideSolo()) return;
      this.decideVista();
    }
    /* La franja de mensajes de la misión se queda siempre con el alto del mensaje más largo que puede salir en esta
     * misión (las pistas de sus tareas, sus órdenes y el de misión completa) con el ancho que tiene ahora: así la
     * terminal y la lista de tareas no cambian de tamaño cuando sale un mensaje. */
    reservaMensaje() {
      const f = this.msj;
      if (!f || !this.mision || !f.clientWidth) return;
      const txt = f.querySelector('.term-msj-texto'), antes = txt.textContent;
      const ancho = f.clientWidth;
      if (this.reservaPara === ancho + ':' + this.semilla) return;
      const largos = ['Misión completa. Con pistas o con Resolver no cuenta para la racha: prueba Otro ejercicio.', 'Resolver empieza desde la línea de órdenes: corta antes la orden que está en marcha con Ctrl\u00a0+\u00a0C y vuelve a pulsarlo.'];
      this.mision.tareas.forEach((t, i) => { const o = L.pistaOrden(t); largos.push(`Tarea ${i + 1}: ${t.pista}${o ? ' (Si vuelves a pulsar Pista, verás la orden.)' : ''}`); if (o) largos.push(`Tarea ${i + 1}: ${o}`); });
      f.style.height = 'auto';
      let alto = 0;
      for (const m of largos) { txt.textContent = m; alto = Math.max(alto, f.scrollHeight); }
      txt.textContent = antes;
      f.style.height = alto + 'px';
      this.reservaPara = ancho + ':' + this.semilla;
    }
    /* En una misión con la vista al lado (sin ampliar), la terminal necesita las columnas que pide la misión
     * (m.columnas, calculadas con sus datos) y como poco COLS_MISION. Se prueba, por este orden: la vista al lado;
     * al lado con la letra de la terminal un escalón más pequeña; y, si no es el árbol, debajo del panel de tareas.
     * Si nada sirve, la vista se pliega y el botón «Ver la vista» del pie la enseña; si se pulsa ese botón, manda lo
     * que se elija. Se decide de nuevo cada vez que cambia el ancho o cargan las fuentes. */
    decideVista() {
      if (this.modo !== 'mision' || !this.vistaNombre || this.vistaElegida || this.decidiendo) return;
      if (!this.pantalla.clientWidth) return;
      this.decidiendo = true;
      const min = Math.max(L.COLS_MISION, (this.mision && this.mision.columnas) || 0);
      const opciones = [[false, 0], [false, -1]].concat(this.conArbol ? [] : [[true, 0], [true, -1]]);
      const antes = [this.el.classList.contains('term-vista-abajo'), this.pasoLetra || 0, this.el.classList.contains('term-vista-plegada')];
      this.el.classList.remove('term-vista-plegada');
      let buena = null;
      for (const [abajo, paso] of opciones) {
        this.reparto(abajo, paso);
        this.reservaMensaje();
        this.mideSolo();
        if (this.cols >= min) { buena = [abajo, paso]; break; }
      }
      if (!buena) { this.reparto(false, 0); this.el.classList.add('term-vista-plegada'); this.mideSolo(); }
      if (this.bVista) this.bVista.textContent = buena ? 'Ocultar la vista' : 'Ver la vista';
      this.decidiendo = false;
      const ahora = [this.el.classList.contains('term-vista-abajo'), this.pasoLetra || 0, this.el.classList.contains('term-vista-plegada')];
      if (ahora.join() !== antes.join()) { this.pinta(); if (this.programa) this.pintaPrograma(); if (this.vista) requestAnimationFrame(() => this.actualizaVista([])); }
    }
    // dónde va la vista (al lado o debajo de las tareas) y el escalón de letra de esta terminal (0 o -1)
    reparto(abajo, paso) {
      if (this.cajaVista) {
        const col = this.el.querySelector('.term-arbol-col');
        if (abajo && this.cajaVista.parentNode !== this.lado) this.lado.appendChild(this.cajaVista);
        if (!abajo && col && this.cajaVista.parentNode !== col) col.appendChild(this.cajaVista);
      }
      this.el.classList.toggle('term-vista-abajo', !!abajo);
      if ((this.pasoLetra || 0) !== paso) { this.pasoLetra = paso; this.aplicaEscala(false); }
    }

    /* ---------- salida ---------- */
    escribe(tipo, texto) {
      if (tipo === 'aviso' || tipo === 'nota') {
        if (this.pos.col !== 0) { this.salida.insertAdjacentHTML('beforeend', '\n'); this.pos.col = 0; }
        const d = document.createElement('div');
        d.className = tipo === 'nota' ? 'term-aviso term-nota' : 'term-aviso';
        d.innerHTML = '<b>Simulador</b> ';
        d.appendChild(document.createTextNode(texto));
        this.salida.appendChild(d);
        this.recorta(1);
        return;
      }
      const acc = {};
      const html = ansiAHtml(texto, this.sgr, this.pos, acc);
      if (acc.borra) { this.salida.innerHTML = ''; this.nLineas = 0; }
      if (acc.titulo !== undefined) this.titulo.textContent = acc.titulo;
      // lo nuevo se añade al final: lo que ya está pintado no se toca
      if (html) this.salida.insertAdjacentHTML('beforeend', tipo === 'err' ? `<span class="term-err">${html}</span>` : html);
      this.recorta((html.match(/\n/g) || []).length);
    }
    // como una terminal real, se guardan las últimas 2000 líneas: lo más antiguo se quita por arriba (sin repintar)
    recorta(nuevas) {
      const MAX = 2000;
      this.nLineas = (this.nLineas || 0) + (nuevas || 0);
      if (this.nLineas <= MAX + 200) return;
      let sobran = this.nLineas - MAX;
      const cuenta = (t) => (t.match(/\n/g) || []).length;
      while (sobran > 0 && this.salida.firstChild) {
        const n = this.salida.firstChild;
        const k = n.nodeType === 1 && n.classList.contains('term-aviso') ? 1 : cuenta(n.textContent);
        if (k <= sobran) { this.salida.removeChild(n); sobran -= k; this.nLineas -= k; continue; }
        // el primer trozo tiene más líneas de las que sobran: se recorta por dentro
        const textos = [];
        const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) textos.push(w.currentNode);
        for (const t of textos) {
          const c = cuenta(t.data);
          if (c <= sobran) { sobran -= c; this.nLineas -= c; t.data = c ? t.data.slice(t.data.lastIndexOf('\n') + 1) : ''; if (!sobran) break; continue; }
          let i = -1; for (let j = 0; j < sobran; j++) i = t.data.indexOf('\n', i + 1);
          t.data = t.data.slice(i + 1); this.nLineas -= sobran; sobran = 0; break;
        }
        break;
      }
    }
    // la línea que se está escribiendo, con el cursor
    pinta() {
      const v = this.entrada.value;
      const ini = this.entrada.selectionStart;
      let pre = '';
      if (!this.ej && !this.cerrada) pre = this.pendiente ? ansiAHtml(this.sh.prompt('PS2'), nuevoSGR(), { col: 0 }, {}) : ansiAHtml(this.sh.prompt(), nuevoSGR(), { col: 0 }, {});
      if (this.titulo && !this.ej && !this.cerrada) { const t = {}; ansiAHtml(this.sh.prompt(), nuevoSGR(), { col: 0 }, t); if (t.titulo) this.titulo.textContent = t.titulo; }
      const oculto = this.leyendo && this.leyendo.eco === false;
      let cuerpo;
      const cursor = (ch) => `<span class="term-cursor${this.conFoco ? '' : ' apagado'}">${esc(ch)}</span>`;
      if (this.cerrada) cuerpo = '';
      else if (oculto) {
        // la contraseña no se ve; la primera vez de cada sesión, el aviso del simulador debajo
        cuerpo = cursor(' ') + (this.leyendo.aviso ? '<span class="term-aviso term-nota term-aviso-clave"><b>Simulador</b> La contraseña no se ve al escribir: escríbela y pulsa Intro.</span>' : '');
      } else {
        const c = Math.min(ini, v.length);
        const bajo = v[c] && v[c] !== '\n' ? v[c] : ' ';
        cuerpo = esc(v.slice(0, c)) + cursor(bajo) + esc(v.slice(c + (v[c] && v[c] !== '\n' ? 1 : 0)));
      }
      this.linea.innerHTML = this.cargandoAyuda ? '<span class="term-cargando">Cargando la ayuda…</span>' : (this.ej && !this.leyendo ? '' : pre + cuerpo);
      this.abajo();
    }
    abajo() { this.pantalla.scrollTop = this.pantalla.scrollHeight; }

    /* ---------- teclado y ratón ---------- */
    escucha() {
      const t = this.entrada;
      // que deck-stage no reciba nada de lo que se escribe aquí
      ['keydown', 'keyup', 'keypress'].forEach((ev) => t.addEventListener(ev, (e) => e.stopPropagation()));
      t.addEventListener('keydown', (e) => this.alPulsar(e));
      t.addEventListener('input', () => {
        if (this.programa) { const v = t.value; t.value = ''; for (const ch of v) { if (!this.programa.ctrl) this.muestraTecla(ch); this.teclaPrograma(ch); } return; }
        this.tabs = 0; this.pinta();
      });
      t.addEventListener('paste', (e) => { e.preventDefault(); const d = e.clipboardData || window.clipboardData; this.pega((d && d.getData('text')) || this.portapapeles || ''); });
      t.addEventListener('select', () => this.pinta());
      document.addEventListener('selectionchange', () => { if (document.activeElement === t) this.pinta(); });
      t.addEventListener('focus', () => { this.conFoco = true; this.el.classList.add('term-activa'); this.foco.textContent = document.querySelector('deck-stage') ? 'Escribiendo en la terminal · Esc vuelve a las diapositivas' : 'Escribiendo en la terminal · Esc deja de escribir'; this.pinta(); });
      t.addEventListener('blur', () => { this.conFoco = false; this.el.classList.remove('term-activa'); this.foco.textContent = 'Pulsa en la terminal para escribir'; this.pinta(); });
      // ratón: un clic sin arrastrar da el foco a la terminal; arrastrar selecciona (y se copia con Ctrl+Mayús+C)
      const seleccionAqui = () => { const s = window.getSelection && window.getSelection(); return s && !s.isCollapsed && this.ventana.contains(s.anchorNode) ? s : null; };
      this.ventana.addEventListener('mousedown', (e) => { if (e.target.closest('button')) return; e.stopPropagation(); });
      this.ventana.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        e.stopPropagation();
        if (seleccionAqui()) { this.foco.textContent = 'Texto seleccionado · Ctrl + Mayús + C lo copia'; (this.programa ? this.prog : this.pantalla).focus({ preventScroll: true }); return; }
        e.preventDefault();
        this.enfoca();
      });
      // con el foco en la pantalla (después de seleccionar): Ctrl+Mayús+C copia; lo demás vuelve a la línea
      [this.pantalla, this.prog].forEach((zona) => {
        zona.addEventListener('keydown', (e) => {
          e.stopPropagation();
          const l = e.key.length === 1 ? e.key.toLowerCase() : e.key;
          if (e.ctrlKey && e.shiftKey && l === 'c') { e.preventDefault(); this.copia(); return; }
          if (this.teclaLetra(e)) return;
          if (e.key === 'Escape') { this.enUso = false; zona.blur(); return; }
          if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
          this.enfoca();
          if (e.key.length !== 1 || e.ctrlKey) this.alPulsar(e);
        });
        ['keyup', 'keypress'].forEach((ev) => zona.addEventListener(ev, (e) => e.stopPropagation()));
        zona.addEventListener('focus', () => this.el.classList.add('term-activa'));
        zona.addEventListener('blur', () => { if (document.activeElement !== t) this.el.classList.remove('term-activa'); });
      });
      this.el.addEventListener('click', (e) => e.stopPropagation());
      // un clic en el bloque que no sea en un campo de texto (las lupas, maximizar, la vista y sus botones, la racha,
      // un hueco sin nada) deja el foco en la terminal al acabar su acción: así las teclas no van a la presentación
      const esCampo = (x) => !!x && x !== t && (x.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(x.tagName));
      this.el.addEventListener('click', (e) => {
        if (esCampo(e.target) || e.target.closest('input, select, textarea')) return;
        setTimeout(() => { const a = document.activeElement; if ((a && this.el.contains(a) && esCampo(a)) || seleccionAqui()) return; this.enfoca(); }, 0);
      }, true);
      // la rueda mueve la pantalla de la terminal, no las diapositivas
      this.pantalla.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
      this.prog.addEventListener('wheel', (e) => { e.stopPropagation(); if (this.programa && this.programa.tipo !== 'nano') { e.preventDefault(); this.teclaPrograma(e.deltaY > 0 ? 'ArrowDown' : 'ArrowUp'); } }, { passive: false });
      const pulsaBoton = (e) => { const b = e.target.closest('button[data-k]'); if (!b) return; e.stopPropagation(); this.muestraTecla(b.dataset.k); this.teclaPrograma(b.dataset.k); this.enfoca(); };
      this.progTeclas.addEventListener('click', pulsaBoton);
      this.progTexto.addEventListener('click', pulsaBoton);
      // al pulsar un atajo, el foco se queda en la terminal: si se fuera, el pie cambiaría de texto (en un móvil
      // estrecho, de dos líneas a una), la terminal cambiaría de tamaño, nano se repintaría entre el mousedown y el
      // mouseup y el clic se perdería
      [this.progTeclas, this.progTexto].forEach((z) => z.addEventListener('mousedown', (e) => { if (e.target.closest('button[data-k]')) e.preventDefault(); }));
      window.addEventListener('resize', () => { this.mide(); this.pinta(); if (this.programa) this.pintaPrograma(); });
      // la primera medida puede ser con la letra de reserva: se mide otra vez cuando llegan las fuentes y cada vez
      // que cambia el tamaño de la terminal, antes de que se toque nada
      // (y el árbol, que se encaja en su panel según el sitio que tenga)
      const otraVez = () => { this.mide(); this.pinta(); if (this.programa) this.pintaPrograma(); if (this.vista && this.vista.encaja) this.vista.encaja(); };
      if (document.fonts) { if (document.fonts.ready) document.fonts.ready.then(otraVez); if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', otraVez); }
      if (typeof ResizeObserver === 'function') { let ultimo = ''; new ResizeObserver(() => { const k = this.el.clientWidth + 'x' + this.el.clientHeight; if (k !== ultimo) { ultimo = k; otraVez(); } }).observe(this.el); }
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !this.maximizada || this.el.contains(document.activeElement)) return;
        e.preventDefault(); e.stopPropagation(); this.maximiza(false);
      }, true);
      this.escuchaUso(esCampo);
      const stage = document.querySelector('deck-stage');
      if (stage) stage.addEventListener('slidechange', () => {
        const sec = this.el.closest('section');
        const activa = sec && sec.hasAttribute('data-deck-active');
        if (!activa) { this.enUso = false; if (this.el.contains(document.activeElement)) document.activeElement.blur(); if (this.maximizada) this.maximiza(false); }
        else requestAnimationFrame(() => { this.mide(); this.pinta(); if (this.programa) this.pintaPrograma(); if (this.vista && this.vista.encaja) this.vista.encaja(); });
      });
    }
    /* El bloque «en uso» (aprobado por el profesor el 22-11-2026: «queremos el teclado en la ventana para que sea lo
     * más realista posible, no que haga cosas de Chrome»). Empieza con el primer clic dentro del bloque de la terminal
     * o cuando el foco entra en él (también con Tab); acaba con Esc, con un clic fuera o cuando el foco sale. El bloque
     * es la terminal con su panel; en «Practica Linux», todo el ejercicio (this.bloque). Mientras dura:
     *  - ninguna tecla llega a la presentación ni a los atajos de la página: un botón enfocado se pulsa con el espacio
     *    o con Intro, como en cualquier página, y la diapositiva no se mueve;
     *  - los atajos del navegador que una página puede parar (Ctrl + L, R, S, O, F, P…, F1-F12 salvo F11) van a la
     *    terminal, y si el foco se había quedado en un botón o en la página, la tecla va a la terminal.
     * Fuera de uso, la presentación responde al teclado como siempre. */
    escuchaUso(esCampo) {
      this.enUso = false;
      const bloque = () => this.bloque || this.el;
      const dentro = (x) => !!x && x.nodeType === 1 && bloque().contains(x);
      const visible = () => { const sec = this.el.closest('section'); return !sec || !document.querySelector('deck-stage') || sec.hasAttribute('data-deck-active'); };
      const usa = (si) => { this.enUso = si; if (si && L.precargaAyuda) L.precargaAyuda(); };
      document.addEventListener('pointerdown', (e) => { usa(dentro(e.target) && visible()); }, true);
      // con el foco en la terminal, pulsar un botón del bloque con el ratón no se lo quita: si se fuera, el pie cambiaría
      // de texto (y a veces de alto), todo se movería entre el mousedown y el mouseup y el clic se perdería (le pasaba
      // a «Abrir otra terminal»). El botón hace lo suyo igual y el foco ya está donde tiene que acabar
      document.addEventListener('mousedown', (e) => { if (document.activeElement === this.entrada && dentro(e.target) && e.target.closest('button')) e.preventDefault(); }, true);
      document.addEventListener('focusin', (e) => { usa(dentro(e.target) && visible()); });
      const deNavegador = (e) => (e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) || (/^F([1-9]|1[0-2])$/.test(e.key) && e.key !== 'F11');
      // en una casilla, un selector o el desplegable del bloque, los atajos del navegador también se paran (sin escribir
      // nada); copiar, pegar, cortar, seleccionar todo y deshacer siguen funcionando. En la fase de captura, antes de
      // que la casilla pare la tecla
      document.addEventListener('keydown', (e) => {
        if (!this.enUso || !dentro(e.target) || !esCampo(e.target)) return;
        const edita = e.ctrlKey && !e.altKey && !e.metaKey && /^[cvxazy]$/i.test(e.key);
        if (deNavegador(e) && !edita) e.preventDefault();
      }, true);
      const tecla = (e) => {
        if (!this.enUso) return;
        const a = e.target;
        const enPagina = !a || a === document || a === document.body || a === document.documentElement;
        if (!enPagina && !dentro(a)) { this.enUso = false; return; }
        if (e.key === 'Escape') { if (e.type === 'keydown') { this.enUso = false; if (dentro(document.activeElement)) document.activeElement.blur(); } return; }
        e.stopPropagation();   // a la presentación (deck-stage escucha en window) no llega
        if (e.type !== 'keydown' || this.cerrada || !visible()) return;
        if (!enPagina && (esCampo(a) || a === this.entrada)) return;   // las casillas y la terminal ya se ocupan
        const enBoton = !enPagina && !!a.closest('button, select, a[href], [tabindex]');
        // en un botón: el espacio, Intro y Tab hacen lo de siempre (pulsarlo, ir al siguiente)
        if (enBoton && !deNavegador(e) && (e.key === ' ' || e.key === 'Enter' || e.key === 'Tab' || e.key.length !== 1)) return;
        if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
        // lo demás va a la terminal: las letras se escriben y las teclas especiales hacen lo suyo
        this.enfoca();
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          if (this.programa) { this.teclaPrograma(e.key); return; }
          const t = this.entrada, i = t.selectionStart, j = t.selectionEnd;
          t.value = t.value.slice(0, i) + e.key + t.value.slice(j);
          t.setSelectionRange(i + 1, i + 1);
          t.dispatchEvent(new Event('input'));
        } else { if (deNavegador(e)) e.preventDefault(); this.alPulsar(e); }
      };
      ['keydown', 'keyup', 'keypress'].forEach((ev) => document.addEventListener(ev, tecla));
    }
    enfoca() { this.entrada.focus({ preventScroll: true }); this.mide(); this.pinta(); }
    /* Maximizar: la terminal cubre la diapositiva (o la página) con la misma letra, así que salen más columnas y
     * más líneas. En la diapositiva, position: fixed se coloca respecto al lienzo de deck-stage, que está escalado
     * con transform; en una página normal, respecto a la ventana. */
    maximiza(si) {
      this.maximizada = !!si;
      this.el.classList.toggle('term-max', this.maximizada);
      const b = this.el.querySelector('.term-ventanas .max');
      b.setAttribute('aria-label', si ? 'Restaurar' : 'Maximizar'); b.title = si ? 'Restaurar' : 'Maximizar';
      if (!si) { this.vistaElegida = false; this.pliegaVista(false); }
      const ajusta = () => {
        this.mide();
        // sin misión, si con la vista al lado quedan menos de 60 columnas, la vista se pliega (el botón la enseña);
        // en una misión decide decideVista, con las columnas que pide la misión
        if (si && this.vistaNombre && this.modo !== 'mision' && this.cols < 60 && !this.el.classList.contains('term-vista-plegada')) { this.pliegaVista(true); this.mide(); }
        this.pinta(); if (this.programa) this.pintaPrograma();
        if (this.vista) this.actualizaVista([]);
      };
      ajusta();
      requestAnimationFrame(ajusta);
    }
    pliegaVista(si) {
      this.el.classList.toggle('term-vista-plegada', !!si);
      if (this.bVista) this.bVista.textContent = si ? 'Ver la vista' : 'Ocultar la vista';
      requestAnimationFrame(() => { this.mide(); this.pinta(); if (this.programa) this.pintaPrograma(); if (this.vista) this.actualizaVista([]); });
    }
    // el botón de cerrar de la barra hace lo mismo que exit: se acaba la sesión de bash
    cierraVentana() {
      if (this.cerrada) return;
      const ej = this.ej;
      this.para();
      if (ej && ej.gen) { try { ej.gen.return(); } catch (e) { /* la orden ya había acabado */ } }
      this.ej = null; this.leyendo = null; this.pendiente = ''; this.entrada.value = '';
      if (this.programa) { this.programa = null; this.prog.hidden = true; this.el.classList.remove('term-en-programa'); }
      if (L.registra) L.registra(this.sis, { tipo: 'salir', ventana: true });
      this.sis.sesionCerrada = true;
      this.cierra(true);
      this.pinta();
      if (this.mision) this.compruebaMision();
    }
    copia() {
      const s = window.getSelection && window.getSelection();
      const texto = s && !s.isCollapsed && this.ventana.contains(s.anchorNode) ? s.toString() : '';
      this.muestraTecla('Ctrl+Shift+C');
      if (!texto) return;
      this.portapapeles = texto;
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      if (!ok && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).catch(() => {});
    }
    // pega en la línea (o en el programa abierto); como bash 5.2, sin ejecutar hasta que se pulse Intro
    pega(texto) {
      texto = String(texto || '').replace(/\r\n?/g, '\n');
      if (!texto) return;
      this.muestraTecla('Ctrl+Shift+V');
      if (this.programa) { for (const ch of texto) this.teclaPrograma(ch === '\n' ? 'Enter' : ch); return; }
      if (this.cerrada) return;
      const t = this.entrada, a = t.selectionStart, b = t.selectionEnd;
      t.value = t.value.slice(0, a) + texto + t.value.slice(b);
      const p = a + texto.length; t.setSelectionRange(p, p);
      this.pinta();
    }
    muestraTecla(clave, forzar) {
      if (!this.conTeclas && !forzar) return;
      const p = this.programa;
      let par = null;
      if (p) {
        const k = clave === 'Space' ? ' ' : clave;
        const t = (p.teclas || []).find((x) => x[1] === k);
        if (t) par = [etiquetaTecla(clave), t[2] === t[0] ? '' : t[2]];
        else par = TECLAS_PROG[clave] || (clave.startsWith('Ctrl+') || clave.startsWith('F') ? TECLAS[clave] || [clave, ''] : null);
        if (!par && clave.length === 1 && !p.ctrl) par = [clave, ''];
      } else par = TECLAS[clave] || (clave.length === 1 ? [clave, ''] : null);
      if (!par) return;
      // las combinaciones, como en las diapositivas: «Ctrl + C»
      this.tecla.querySelector('b').textContent = par[0].replace(/(Ctrl|Mayús)\+(?=\S)/g, '$1 + ');
      this.tecla.querySelector('span').textContent = par[1];
      this.tecla.querySelector('span').hidden = !par[1];
      this.tecla.hidden = false;
      this.tecla.classList.remove('sale'); void this.tecla.offsetWidth; this.tecla.classList.add('sale');
      clearTimeout(this.tTecla);
      this.tTecla = setTimeout(() => { this.tecla.hidden = true; }, 2500);
    }
    alPulsar(e) {
      const t = this.entrada;
      const k = e.key;
      const ctrl = e.ctrlKey && !e.altKey && !e.metaKey;
      const l = k.length === 1 ? k.toLowerCase() : k;
      if (this.teclaLetra(e)) return;
      // copiar y pegar como en la terminal de GNOME; Ctrl+V no pega (en bash inserta el carácter siguiente tal cual)
      if (ctrl && e.shiftKey && l === 'c') { e.preventDefault(); this.copia(); return; }
      if (ctrl && e.shiftKey && l === 'v') { if (!(navigator.userAgent || '').includes('Firefox')) return; e.preventDefault(); this.pega(this.portapapeles || ''); return; }
      if (ctrl && l === 'v') { e.preventDefault(); return; }
      // Av Pág: el botón de la demostración (el mando de presentaciones manda Av Pág)
      if (k === 'PageDown' && this.modo === 'demo') { e.preventDefault(); this.siguienteOrden(); return; }
      if (k === 'Escape') { e.preventDefault(); if (this.programa) { this.muestraTecla('Escape'); this.teclaPrograma('Escape'); return; } this.muestraTecla('Escape'); this.enUso = false; t.blur(); return; }
      if (this.programa) {
        const p = this.programa;
        if (ctrl && /^[a-z\\/_\]]$/.test(l)) {
          e.preventDefault();
          const n = 'Ctrl+' + l.toUpperCase();
          this.muestraTecla(n);
          this.teclaPrograma(p.ctrl ? n : n === 'Ctrl+C' ? 'q' : n);
          return;
        }
        if (/^F\d{1,2}$/.test(k)) { e.preventDefault(); this.muestraTecla(k); this.teclaPrograma(k); return; }
        const especiales = ['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Backspace', 'Delete', 'Tab', ' '];
        if (especiales.includes(k)) {
          e.preventDefault();
          if (!p.ctrl || !['Enter', ' ', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight'].includes(k)) this.muestraTecla(k === ' ' ? 'Space' : k);
          this.teclaPrograma(k);
        }
        return;   // las letras llegan por input
      }
      if (this.cerrada) { if (k === 'Enter') { e.preventDefault(); this.reabre(); } else if (k.length === 1 || k === 'Backspace') e.preventDefault(); return; }
      if (ctrl) {
        if (l === 'd') { e.preventDefault(); this.ctrlD(); return; }
        if (l === 'z') { e.preventDefault(); this.pulsaTecla('Ctrl+Z'); return; }
        if (['c', 'l', 'a', 'e', 'u', 'k', 'w'].includes(l)) { e.preventDefault(); this.pulsaTecla('Ctrl+' + l.toUpperCase()); return; }
        // los demás atajos con letra (Ctrl + R, S, O, F, P…) son de la terminal, no del navegador; Ctrl + X, el de cortar
        if (/^[a-z]$/.test(l) && l !== 'x') e.preventDefault();
        return;
      }
      // F1-F12 (salvo F11, pantalla completa): en bash no hacen nada y el navegador no tiene que hacer lo suyo
      if (/^F([1-9]|10|12)$/.test(k)) { e.preventDefault(); return; }
      if (k === 'Enter') { e.preventDefault(); this.intro(); return; }
      if (k === 'Tab') { e.preventDefault(); this.tabulador(); return; }
      if (this.leyendo) return;   // leyendo una línea para una orden: sin historial
      if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); this.muestraTecla(k); this.historial(k === 'ArrowUp' ? -1 : 1); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End') { this.muestraTecla(k); setTimeout(() => this.pinta(), 0); return; }
    }
    // tamaño de la letra con el teclado: Ctrl+«+» amplía, Ctrl+«−» reduce, Ctrl+0 vuelve al 100 % (en vez del zoom del navegador)
    teclaLetra(e) {
      if (!e.ctrlKey || e.altKey || e.metaKey) return false;
      const k = e.key, c = e.code || '';
      const paso = k === '+' || k === '=' || c === 'NumpadAdd' ? 1 : k === '-' || c === 'NumpadSubtract' ? -1 : k === '0' || c === 'Numpad0' ? 0 : null;
      if (paso === null) return false;
      e.preventDefault();
      L.cambiaLetra(paso);
      return true;
    }
    // aplica el tamaño de letra común: la letra, las columnas y las filas, y lo que haya abierto (nano, man, top…)
    aplicaEscala(repinta) {
      const lista = L.ESCALAS_LETRA;
      // la preferencia común y, si esta terminal lo necesita para que quepa su misión, un escalón menos
      const v = lista[Math.max(0, lista.indexOf(L.escalaLetra()) + (this.pasoLetra || 0))] || L.escalaLetra();
      this.el.style.setProperty('--term-escala', String(v));
      const bm = this.el.querySelector('.term-ventanas .letra-menos'), bM = this.el.querySelector('.term-ventanas .letra-mas');
      if (bm) { bm.disabled = v <= lista[0]; bm.title = `Reducir la letra (ahora ${Math.round(v * 100)} %)`; }
      if (bM) { bM.disabled = v >= lista[lista.length - 1]; bM.title = `Ampliar la letra (ahora ${Math.round(v * 100)} %)`; }
      if (repinta === false) return;
      this.mide(); this.pinta();
      if (this.programa) this.pintaPrograma();
      if (this.vista && this.vista.encaja) requestAnimationFrame(() => this.vista.encaja());
    }
    // una tecla con nombre (guion, Resolver, teclado): al programa abierto o a la línea
    pulsaTecla(nombre, forzar) {
      if (nombre === ' ') nombre = 'Space';
      if (nombre !== 'Tab') this.muestraTecla(nombre, forzar);
      if (this.programa) {
        let k = nombre === 'Space' ? ' ' : nombre;
        if (k.startsWith('Ctrl+') && !this.programa.ctrl) k = k === 'Ctrl+C' ? 'q' : k;
        this.teclaPrograma(k);
        return;
      }
      if (this.cerrada) { if (nombre === 'Enter') this.reabre(); return; }
      const t = this.entrada;
      const inserta = (s) => { const a = t.selectionStart; t.value = t.value.slice(0, a) + s + t.value.slice(t.selectionEnd); t.setSelectionRange(a + s.length, a + s.length); this.pinta(); };
      switch (nombre) {
        case 'Enter': this.intro(); return;
        case 'Tab': if (forzar) this.muestraTecla('Tab', true); this.tabulador(); return;
        case 'ArrowUp': case 'ArrowDown': if (!this.leyendo) this.historial(nombre === 'ArrowUp' ? -1 : 1); return;
        case 'Ctrl+C': this.ctrlC(); return;
        case 'Ctrl+D': this.ctrlD(); return;
        case 'Ctrl+L': this.salida.innerHTML = ''; this.nLineas = 0; this.pos.col = 0; this.pinta(); return;
        case 'Ctrl+A': t.setSelectionRange(0, 0); this.pinta(); return;
        case 'Ctrl+E': t.setSelectionRange(t.value.length, t.value.length); this.pinta(); return;
        case 'Ctrl+U': { const c = t.selectionStart; t.value = t.value.slice(c); t.setSelectionRange(0, 0); this.pinta(); return; }
        case 'Ctrl+K': t.value = t.value.slice(0, t.selectionStart); this.pinta(); return;
        case 'Ctrl+W': { const c = t.selectionStart; const antes = t.value.slice(0, c).replace(/\S+\s*$/, ''); t.value = antes + t.value.slice(c); t.setSelectionRange(antes.length, antes.length); this.pinta(); return; }
        case 'Ctrl+Z':
          if (this.ej && !this.leyendo) this.escribe('aviso', 'El simulador no detiene órdenes con Ctrl + Z (no tiene trabajos en segundo plano). Para cortar una orden, Ctrl + C.');
          return;
        case 'Escape': return;
        case 'Space': inserta(' '); return;
        default: if (nombre.length === 1) inserta(nombre);
      }
    }
    historial(dir) {
      const h = this.sh.hist;
      if (this.histIdx === null) { if (dir > 0) return; this.borrador = this.entrada.value; this.histIdx = h.length; }
      let i = this.histIdx + dir;
      if (i < 0) i = 0;
      if (i >= h.length) { this.histIdx = null; this.entrada.value = this.borrador || ''; }
      else { this.histIdx = i; this.entrada.value = h[i]; }
      const n = this.entrada.value.length; this.entrada.setSelectionRange(n, n);
      this.pinta();
    }
    tabulador() {
      const t = this.entrada;
      if (this.leyendo || this.cerrada) return;
      const c = t.selectionStart;
      const r = this.sh.completa(t.value, c);
      this.tabs++;
      if (L.registra) L.registra(this.sis, { tipo: 'tecla', tecla: 'Tab' });
      if (r.sustituye !== null && r.sustituye !== undefined) {
        this.muestraTecla('Tab');
        t.value = t.value.slice(0, r.inicio) + r.sustituye + t.value.slice(r.fin);
        const p = r.inicio + r.sustituye.length; t.setSelectionRange(p, p);
        this.tabs = r.unico ? 0 : 1;
        this.pinta(); return;
      }
      if (r.candidatos.length > 1 && this.tabs >= 2) {
        this.muestraTecla('TabTab');
        this.escribe('out', this.textoPrompt() + t.value + '\n');
        const cand = r.candidatos;
        if (cand.length > 100) this.escribe('aviso', `Hay ${cand.length} posibilidades. En tu Ubuntu, bash pregunta antes de enseñarlas todas.`);
        else this.escribe('out', L.enColumnas(cand, this.cols || 80, false).join('\n') + '\n');
        this.tabs = 0;
        this.pinta(); return;
      }
      this.muestraTecla('Tab');
    }
    textoPrompt() { return this.pendiente ? this.sh.prompt('PS2') : this.sh.prompt(); }
    ctrlC() {
      const t = this.entrada;
      if (this.ej) {
        if (this.temporizador) { clearTimeout(this.temporizador); this.temporizador = null; }
        if (this.leyendo) { this.escribe('out', '^C\n'); this.leyendo = null; }
        else this.escribe('out', '^C');
        t.value = '';
        const r = this.ej.interrumpe();
        if (this.pos.col !== 0 && r.fin) this.escribe('out', '\n');
        this.conduce(r);
        return;
      }
      this.escribe('out', this.textoPrompt() + t.value + '^C\n');
      t.value = ''; this.pendiente = ''; this.histIdx = null;
      this.sh.ultimo = 130;
      this.pinta();
    }
    ctrlD() {
      const t = this.entrada;
      if (this.leyendo) {
        this.muestraTecla('Ctrl+D');
        if (t.value) { const v = t.value; t.value = ''; this.escribe('out', v); this.conduceLeer(v, true); return; }
        this.leyendo = null;
        this.conduce(this.ej.avanza(null));
        return;
      }
      if (this.ej || this.cerrada) return;
      if (t.value) { const c = t.selectionStart; t.value = t.value.slice(0, c) + t.value.slice(c + 1); t.setSelectionRange(c, c); this.pinta(); return; }
      this.muestraTecla('Ctrl+DSalir');
      this.escribe('out', this.textoPrompt());
      this.lanza('exit', true);
    }
    intro() {
      const t = this.entrada;
      const v = t.value;
      if (this.cerrada) return;
      t.value = '';
      this.histIdx = null; this.tabs = 0;
      // con una orden en marcha (bajando la ayuda, un ping…), lo escrito no se pierde: se queda en la línea para cuando acabe
      if (this.ej && !this.leyendo) { t.value = v; return; }
      if (this.leyendo) {
        const eco = this.leyendo.eco !== false;
        this.escribe('out', (eco ? v : '') + '\n');
        this.conduceLeer(v);
        return;
      }
      if (this.ej) return;
      this.escribe('out', this.textoPrompt() + v + '\n');
      if (this.esperaDemo !== undefined) { this.esperaDemo = undefined; this.actualizaDemo(); }
      this.lanza(this.pendiente + v);
    }
    conduceLeer(v) { const ej = this.ej; this.leyendo = null; this.pinta(); this.conduce(ej.avanza(v)); }

    /* ---------- ejecución ---------- */
    lanza(linea) {
      this.mide();
      const ej = this.sh.lanzaLinea(linea, { alSalir: (tipo, x) => this.escribe(tipo, x), columnas: this.cols || 80, lineas: this.filas || 24 });
      if (ej.incompleto) { this.pendiente = linea + '\n'; this.pinta(); return; }
      this.pendiente = '';
      this.ej = ej;
      this.pinta();
      this.conduce(ej.avanza());
    }
    conduce(r) {
      const ej = this.ej;
      for (let vueltas = 0; vueltas < 10000; vueltas++) {
        if (!ej) return;
        if (r.fin) { this.acaba(r); return; }
        if (r.tipo === 'leer') {
          this.leyendo = { eco: r.eco };
          if (r.eco === false && !this.claveAvisada) { this.claveAvisada = true; this.leyendo.aviso = true; }
          this.pinta(); return;
        }
        if (r.tipo === 'espera') { this.temporizador = setTimeout(() => { this.temporizador = null; if (this.ej === ej) this.conduce(ej.avanza()); }, Math.min(r.ms, 1500)); this.pinta(); return; }
        if (r.tipo === 'programa') { this.abrePrograma(r.programa); return; }
        if (r.tipo === 'ayuda' || r.tipo === 'carga') {
          const f = r.archivo || 'linux-ayuda.js';
          if (!yaCargado(f)) {
            // mientras baja, la terminal lo dice; si no llega (sin red), la orden se corta y se puede repetir
            this.cargandoAyuda = true; this.pinta();
            carga(f).then((bien) => {
              this.cargandoAyuda = false;
              if (this.ej !== ej) { this.pinta(); return; }
              if (bien) { this.conduce(ej.avanza()); return; }
              try { if (ej.gen) ej.gen.return(); } catch (e) { /* ya había acabado */ }
              this.escribe('aviso', 'No se ha podido cargar la ayuda del simulador: puede que no haya conexión. Vuelve a escribir la orden dentro de un momento.');
              this.acaba({ fin: true, codigo: 1 });
            });
            return;
          }
          r = ej.avanza(); continue;
        }
        if (r.tipo === 'respira') { this.temporizador = setTimeout(() => { if (this.ej === ej) this.conduce(ej.avanza()); }, 0); return; }
        r = ej.avanza();
      }
    }
    acaba(r) {
      const ej = this.ej;
      this.ej = null; this.leyendo = null;
      if (r.salir) this.cierra(true);
      this.pinta();
      this.trasOrden(ej);
    }
    // exit: la terminal se cierra; el botón abre otra (bash nuevo, mismo sistema)
    cierra(si) {
      this.cerrada = si;
      this.cerradaCaja.hidden = !si;
      this.el.classList.toggle('term-cerrada-si', si);
      if (si) this.titulo.textContent = 'Terminal';
    }
    reabre() {
      const hist = this.sh.hist;
      this.sh = this.sis.sesion({ columnas: this.cols, lineas: this.filas });
      this.sh.hist = hist;
      this.cierra(false);
      this.claveAvisada = false;
      this.salida.innerHTML = ''; this.nLineas = 0; this.pos.col = 0; this.sgr = nuevoSGR();
      this.entrada.value = '';
      this.pinta();
      if (this.vista) this.actualizaVista([]);
      if (this.mision) this.compruebaMision();
    }
    trasOrden(ej) {
      this.actualizaVista((ej && ej.cambios) || []);
      if (this.mision) this.compruebaMision();
    }

    /* ---------- programas a pantalla completa ---------- */
    abrePrograma(p) {
      // lo que se tecleó mientras la orden arrancaba (bajando la ayuda) se guarda para la línea de después
      if (this.entrada.value) { this.lineaGuardada = this.entrada.value; this.entrada.value = ''; }
      this.programa = p;
      this.prog.hidden = false;
      this.el.classList.add('term-en-programa');
      this.progTeclas.innerHTML = (p.teclas || []).filter((x) => !(p.tipo === 'nano' && /^Ctrl\+|^[sn]$/.test(x[1]))).map(([nombre, k, que]) => `<button type="button" data-k="${esc(k)}"><kbd>${esc(nombre)}</kbd>${que && que !== nombre ? ' ' + esc(que) : ''}</button>`).join('');
      if (p.tipo === 'nano') this.progTeclas.insertAdjacentHTML('beforeend', '<span class="term-programa-nota">Pulsa los atajos de la barra de nano. Ctrl + W cierra la pestaña del navegador: para buscar, F6 o «^W Buscar».</span>');
      this.pintaPrograma();
      if (p.refresco) this.refresco = setInterval(() => { if (this.programa === p) this.pintaPrograma(); }, p.refresco);
    }
    pintaPrograma() {
      const p = this.programa;
      if (!p) return;
      this.mide();
      const est = getComputedStyle(this.progTexto);
      const ancho = this.progTexto.clientWidth - parseFloat(est.paddingLeft) - parseFloat(est.paddingRight);
      const alto = this.progTexto.clientHeight - parseFloat(est.paddingTop) - parseFloat(est.paddingBottom);
      // man, info y top están hechos para 80 columnas: si no caben, la letra de esta pantalla baja (nunca de 18 px)
      let cols = Math.floor(ancho / (this.anchoCar || 15.6));
      this.progTexto.style.fontSize = '';
      if ((p.tipo === 'man' || p.tipo === 'top' || p.tipo === 'info') && cols < 80) {
        const tam = Math.max(Math.round(18 * L.escalaLetra()), Math.floor(parseFloat(getComputedStyle(this.pantalla).fontSize) * cols / 80));
        this.progTexto.style.fontSize = tam + 'px';
        cols = Math.floor(ancho / ((this.anchoCar || 15.6) * tam / parseFloat(getComputedStyle(this.pantalla).fontSize)));
      }
      const lh = parseFloat(getComputedStyle(this.progTexto).lineHeight) || this.altoLinea || 32;
      const filas = Math.max(5, Math.floor(alto / lh));
      if (!(cols >= 20)) cols = Math.max(20, this.cols || 80);
      const lineas = p.pantalla(cols, filas);
      if (p.mensaje) { lineas[lineas.length - 1] = '\x1b[7m' + p.mensaje + '\x1b[27m'; p.mensaje = ''; }
      const st = nuevoSGR();
      this.progTexto.innerHTML = lineas.map((l, i) => {
        const barra = p.tipo === 'nano' && i >= lineas.length - 2 ? barraPulsable(l) : null;
        return '<div>' + (barra !== null ? barra : (ansiAHtml(l, st, { col: 0 }, {}) || ' ')) + '</div>';
      }).join('');
    }
    teclaPrograma(k) {
      const p = this.programa;
      if (!p) return;
      const r = p.tecla(k);
      if (r === 'fin') {
        this.programa = null; this.prog.hidden = true; this.el.classList.remove('term-en-programa');
        if (p.tipo === 'more' && p.mostrado) this.escribe('out', p.mostrado() + '\n');
        if (this.refresco) { clearInterval(this.refresco); this.refresco = null; }
        const ej = this.ej;
        if (ej) this.conduce(ej.avanza());
        if (this.lineaGuardada) { this.entrada.value = this.lineaGuardada; this.lineaGuardada = ''; const n = this.entrada.value.length; this.entrada.setSelectionRange(n, n); this.pinta(); }
        if (document.activeElement === this.prog) this.enfoca();
        return;
      }
      this.pintaPrograma();
    }

    /* ---------- demostración ---------- */
    actualizaDemo() {
      if (!this.contador) return;
      const n = this.pasos.length;
      this.contador.textContent = !n ? '' : this.paso === 0 ? (n === 1 ? '1 paso' : `${n} pasos`) : `Paso ${Math.min(this.paso, n)} de ${n}`;
      if (this.esperaDemo !== undefined) this.bSiguiente.textContent = 'Intro ↵';
      else this.bSiguiente.textContent = this.paso >= n ? 'Volver a empezar' : this.paso === 0 ? 'Empezar' : 'Siguiente';
    }
    siguienteOrden() {
      if (this.escribiendo) return;
      if (this.esperaDemo !== undefined) { this.enfoca(); this.intro(); return; }
      if (this.paso >= this.pasos.length) { if (this.ej) return; this.nuevaSesion(); this.actualizaDemo(); return; }
      const p = this.pasos[this.paso];
      // una orden nueva espera a que acabe la anterior (las teclas y lo escrito van a lo que está en marcha)
      if (p.tipo === 'orden' && (this.ej || this.cerrada)) return;
      this.paso++;
      this.explica.innerHTML = p.html;
      this.explica.hidden = !String(p.html || '').trim();
      if (p.tipo === 'orden') this.teclea(p.valor, false);
      else if (p.tipo === 'escribe') this.escribeTexto(p.valor);
      else if (p.tipo === 'tecla') { this.enfoca(); this.pulsaTecla(p.valor, true); }
      this.actualizaDemo();
    }
    // escribe una orden letra a letra en una línea limpia; si ejecutar, pulsa Intro al acabar
    teclea(orden, ejecutar, alAcabar) {
      const t = this.entrada;
      t.value = '';
      this.enfoca();
      let i = 0;
      const sig = () => {
        if (i < orden.length) { t.value += orden[i++]; t.setSelectionRange(t.value.length, t.value.length); this.pinta(); this.escribiendo = setTimeout(sig, 38 + (orden[i - 1] === ' ' ? 60 : 0)); return; }
        this.escribiendo = null;
        if (ejecutar) { setTimeout(() => this.intro(), 260); return; }
        if (alAcabar) { alAcabar(); return; }
        this.esperaDemo = orden;
        this.actualizaDemo();
      };
      sig();
    }
    // escribe sin Intro donde esté el cursor: la línea, una contraseña o el programa abierto
    escribeTexto(texto, alAcabar) {
      this.enfoca();
      const letras = [...String(texto)];
      let i = 0;
      const sig = () => {
        if (i < letras.length) {
          const ch = letras[i++];
          if (this.programa) this.teclaPrograma(ch);
          else { const t = this.entrada, a = t.selectionStart; t.value = t.value.slice(0, a) + ch + t.value.slice(t.selectionEnd); t.setSelectionRange(a + 1, a + 1); this.pinta(); }
          this.escribiendo = setTimeout(sig, 45);
          return;
        }
        this.escribiendo = null;
        this.actualizaDemo();
        if (alAcabar) alAcabar();
      };
      sig();
    }

    /* ---------- misión ---------- */
    necesitaClave() {
      const m = this.mision;
      return !!(m.sudo || (m.solucion || []).some((p) => /\b(sudo|passwd)\b/.test(L.pasoMision(p).orden)));
    }
    htmlRespuesta(t, i) {
      if (t.tipo !== 'respuesta') return '';
      let campos;
      if (t.selector) campos = `<select class="term-selector" data-c="0" aria-label="Respuesta de la tarea ${i + 1}"><option value="">— elige —</option>${t.selector.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
      else {
        // la casilla, tan ancha como la respuesta más larga que se acepta (a saltos de 4 letras, para no dar pistas):
        // la esperada y las otras formas que valen (nano informe.txt, /dev/tty3…)
        let largos = [];
        try {
          const ctx = L.contextoMision(this.sis, this.sh);
          const otras = t.acepta ? t.acepta(ctx) || [] : [];
          largos = t.esperado(ctx).map((x, j) => Math.max([...String(x)].length, ...(Array.isArray(otras[j]) ? otras[j] : []).map((y) => [...String(y)].length)));
        } catch (e) { largos = []; }
        campos = (t.casillas || ['respuesta']).map((c, j) => {
          const n = Math.max([...c].length, largos[j] || 0) + 2;
          // un poco de aire detrás de la respuesta más larga (N5: «nano informe.txt» cabía sin un píxel de sobra)
          const ancho = n > 12 ? `style="width:${Math.ceil((n + 1) / 4) * 4}ch"` : '';
          return `<input class="term-casilla" data-c="${j}" data-largo="${n - 1}" type="text" ${ancho} placeholder="${esc(c)}" aria-label="${esc(c)} (tarea ${i + 1})" autocomplete="off" autocapitalize="off" spellcheck="false">`;
        });
        // con dos casillas anchas, la segunda baja de línea, pero el ✓ siempre va pegado a la última
        const fin = campos.pop();
        campos = campos.join('') + `<span class="term-resp-fin">${fin}`;
      }
      if (t.selector) campos = `<span class="term-resp-fin">${campos}`;
      return ` <span class="term-resp">${campos}<button type="button" class="term-comprobar" aria-label="Comprobar la tarea ${i + 1}" title="Comprobar (o Intro)">✓</button></span></span>`;
    }
    pintaMision() {
      const m = this.mision, caja = this.cajaMision;
      if (!caja) return;
      caja.querySelector('.term-mision-titulo').textContent = m.titulo;
      const cl = this.clave;
      cl.hidden = !this.necesitaClave();
      cl.innerHTML = `Tu contraseña: <b>${esc(this.sis.esc.clave)}</b>`;
      caja.querySelector('.term-tareas').innerHTML = m.tareas.map((t, i) => `<li data-i="${i}" class="${t.tipo === 'respuesta' ? 'con-resp' : ''}"><span class="term-check" aria-hidden="true"></span><span class="term-tarea-texto">${t.html}${this.htmlRespuesta(t, i)}</span></li>`).join('');
      this.marcaTareas();
      this.ajustaCasillas();
    }
    /* Las casillas de una tarea van en una sola línea con su ✓ (se estrechan un poco si hace falta); solo si alguna
     * se quedaría más estrecha que su respuesta, la segunda casilla baja de línea (el ✓ sigue pegado a ella). */
    ajustaCasillas() {
      if (!this.cajaMision) return;
      this.cajaMision.querySelectorAll('.term-resp').forEach((r) => {
        r.classList.remove('term-resp-parte');
        const ins = [...r.querySelectorAll('.term-casilla')];
        if (ins.length < 2 || !r.offsetWidth) return;
        // lo que necesita cada casilla: su respuesta más larga (data-largo letras) con su relleno y su borde
        const encoge = ins.some((x) => { const e = getComputedStyle(x); const ch = parseFloat(e.fontSize) * 0.6; const falta = (+x.dataset.largo || 0) * ch + parseFloat(e.paddingLeft) + parseFloat(e.paddingRight) + parseFloat(e.borderLeftWidth) * 2; return x.offsetWidth < falta - 1; });
        if (encoge) r.classList.add('term-resp-parte');
      });
      // si aun así la lista no cabe entera, se aprieta (menos aire entre tareas, la misma letra)
      const ol = this.cajaMision.querySelector('.term-tareas');
      ol.classList.remove('term-tareas-justa');
      if (ol.clientHeight && ol.scrollHeight > ol.clientHeight + 1) ol.classList.add('term-tareas-justa');
      this.marcaSigue();
    }
    // si la lista aún no cabe (una página baja, como terminal.html a 1366 × 768), se ve claro que sigue
    marcaSigue() {
      if (!this.cajaMision) return;
      const ol = this.cajaMision.querySelector('.term-tareas'), mas = this.cajaMision.querySelector('.term-tareas-mas');
      if (!ol || !mas) return;
      const sigue = ol.clientHeight > 0 && ol.scrollTop + ol.clientHeight < ol.scrollHeight - 2;
      mas.hidden = !sigue;
      ol.classList.toggle('term-tareas-sigue', sigue);
    }
    marcaTareas() {
      const lis = this.cajaMision.querySelectorAll('.term-tareas li');
      this.hechas.forEach((h, i) => {
        const li = lis[i]; if (!li) return;
        li.classList.toggle('hecha', !!h);
        li.querySelectorAll('input, select, .term-comprobar').forEach((x) => { x.disabled = !!h; x.tabIndex = h ? -1 : 0; });
      });
      this.cajaMision.querySelector('.ej-racha b').textContent = this.racha;
    }
    // el mensaje de la misión, en su franja; i: la tarea de la que habla, que se resalta y se trae a la vista
    mensaje(t, clase, i) {
      if (!this.msj) return;
      this.msj.querySelector('.term-msj-texto').textContent = t;
      this.msj.className = 'term-msj' + (clase ? ' ' + clase : '') + (t ? ' con-texto' : '');
      this.msjTarea = t ? i : undefined; this.msjClase = t ? clase : undefined;
      const lis = this.cajaMision ? [...this.cajaMision.querySelectorAll('.term-tareas li')] : [];
      lis.forEach((li, k) => li.classList.toggle('aludida', !!t && k === i));
      if (t && i !== undefined && lis[i]) {
        // la tarea, a la vista dentro de la lista (medido sin la escala de deck-stage)
        const ol = lis[i].parentNode, a = lis[i].getBoundingClientRect(), o = ol.getBoundingClientRect();
        const k = o.height / (ol.offsetHeight || o.height || 1) || 1;
        if (a.top < o.top) ol.scrollTop -= (o.top - a.top) / k + 4;
        else if (a.bottom > o.bottom) ol.scrollTop += (a.bottom - o.bottom) / k + 4;
      }
      this.pintaPendiente();
    }
    // en pantallas estrechas, la franja enseña la tarea pendiente cuando no hay mensaje (linux/terminal.html)
    pintaPendiente() {
      if (!this.msj || !this.mision) return;
      const i = this.hechas ? this.hechas.findIndex((h) => !h) : -1;
      this.msj.querySelector('.term-msj-pendiente').textContent = i < 0 ? '' : `Tarea ${i + 1}: ${this.mision.tareas[i].corta}`;
    }
    compruebaRespuesta(i, callado) {
      const li = this.cajaMision.querySelectorAll('.term-tareas li')[i];
      if (!li) return;
      const valores = [...li.querySelectorAll('.term-casilla, .term-selector')].map((x) => x.value.trim());
      const campos = [...li.querySelectorAll('.term-casilla, .term-selector')];
      if (valores.some((v) => v === '')) { if (!callado) { this.mensaje(`Tarea ${i + 1}: escribe la respuesta antes de comprobarla.`, '', i); campos[valores.findIndex((v) => v === '')].focus({ preventScroll: true }); } return; }
      this.respuestas[i] = valores;
      this.compruebaMision();
      if (!this.hechas[i] && !callado) {
        li.classList.remove('mal'); void li.offsetWidth; li.classList.add('mal');
        const t = this.mision.tareas[i];
        let aviso = '';
        try { aviso = t.avisa ? t.avisa(valores, L.contextoMision(this.sis, this.sh)) : ''; } catch (e) { aviso = ''; }
        this.mensaje(`Tarea ${i + 1}: ${aviso || 'no es eso. Vuelve a mirarlo en la terminal.'}`, 'ko', i);
        // la casilla sigue con el foco para corregirla
        if (campos[0] && !campos.includes(document.activeElement)) campos[0].focus({ preventScroll: true });
      } else if (this.hechas[i] && !callado) { if (!this.resuelta) this.mensaje(''); this.enfoca(); }
    }
    compruebaMision() {
      const antes = this.hechas.slice();
      this.hechas = L.estadoMision(this.mision, this.sis, this.sh, this.hechas, this.respuestas);
      this.marcaTareas();
      const lis = this.cajaMision.querySelectorAll('.term-tareas li');
      this.hechas.forEach((h, i) => { if (h && !antes[i] && lis[i]) { lis[i].classList.remove('mal'); lis[i].classList.add('recien'); } });
      // un «no es eso» o una pista de una tarea que ya está hecha se quitan
      if (this.msjTarea !== undefined && this.hechas[this.msjTarea] && !antes[this.msjTarea]) this.mensaje('');
      // una tarea que vuelve a pendiente: el mensaje de misión cumplida ya no vale
      if (this.resuelta && !this.hechas.every(Boolean)) { this.resuelta = false; if (this.msjClase === 'ok') this.mensaje(''); }
      if (this.hechas.every(Boolean) && !this.resuelta) {
        this.resuelta = true;
        // la racha sube una vez por ejercicio (con Reiniciar no se puede repetir el mismo para subirla)
        this.contadas = this.contadas || new Set();
        if (!this.conAyuda && !this.contadas.has(this.semilla)) { this.contadas.add(this.semilla); this.racha++; this.mensaje('¡Misión cumplida! Pulsa Otro ejercicio para seguir practicando.', 'ok'); }
        else if (!this.conAyuda) this.mensaje('Misión cumplida otra vez. Este ejercicio ya contó para la racha: pulsa Otro ejercicio.', 'ok');
        else this.mensaje('Misión completa. Con pistas o con Resolver no cuenta para la racha: prueba Otro ejercicio.', 'ok');
        this.marcaTareas();
      }
      this.pintaClave();
      this.pintaPendiente();
    }
    // la contraseña del panel: si se ha cambiado con passwd, lo dice
    pintaClave() {
      const cl = this.clave;
      if (!cl || cl.hidden) return;
      const u = this.sis.esc.usuario, original = this.sis.esc.clave, ahora = this.sis.claves && this.sis.claves[u];
      cl.innerHTML = ahora === undefined || ahora === original ? `Tu contraseña: <b>${esc(original)}</b>` : `Tu contraseña ahora: <b>${esc(ahora)}</b>`;
    }
    // Pista en dos niveles: la primera vez, dónde mirar o qué idea usar; la segunda, la orden
    pista() {
      const i = this.hechas.findIndex((h) => !h);
      if (i < 0) { this.mensaje('Ya está todo hecho.', 'ok'); this.enfoca(); return; }
      this.conAyuda = true; this.racha = 0; this.marcaTareas();
      const t = this.mision.tareas[i], orden = L.pistaOrden(t);
      this.nivelPista = this.nivelPista || {};
      const n = (this.nivelPista[i] = (this.nivelPista[i] || 0) + 1);
      if (n === 1 || !orden) this.mensaje(`Tarea ${i + 1}: ${t.pista}${orden ? ' (Si vuelves a pulsar Pista, verás la orden.)' : ''}`, '', i);
      else this.mensaje(`Tarea ${i + 1}: ${orden}`, '', i);
      this.enfoca();
    }
    // Resolver: escribe las órdenes que faltan, con sus teclas, contraseñas y respuestas, y rellena las casillas
    resolver() {
      if (this.colaAcc) return;
      if (this.hechas.every(Boolean)) { this.mensaje('Ya está todo hecho.', 'ok'); this.enfoca(); return; }
      if (this.programa) { this.mensaje(`Resolver empieza desde la línea de órdenes: sal antes de ${this.programa.tipo === 'systemctl' ? 'la ayuda' : this.programa.tipo} (con ${this.programa.tipo === 'nano' ? 'Ctrl\u00a0+\u00a0X' : 'q'}) y vuelve a pulsarlo.`, 'ko'); this.enfoca(); return; }
      if (this.ej) { this.mensaje('Resolver empieza desde la línea de órdenes: corta antes la orden que está en marcha con Ctrl\u00a0+\u00a0C y vuelve a pulsarlo.', 'ko'); this.enfoca(); return; }
      if (this.cerrada) this.reabre();
      this.conAyuda = true; this.racha = 0; this.marcaTareas();
      const m = this.mision;
      const pasos = [], vistos = new Set();
      m.tareas.forEach((t, i) => {
        if (this.hechas[i]) return;
        // una tarea sin pasos propios se cumple con los de la anterior que sí los tiene
        let j = i; while (j > 0 && !m.tareas[j].solucion.length) j--;
        if (!vistos.has(j)) { vistos.add(j); m.tareas[j].solucion.forEach((p) => pasos.push(p)); }
        if (t.tipo === 'respuesta') pasos.push({ rellena: i });
      });
      if (!pasos.length) { this.mensaje('Ya está todo hecho.', 'ok'); return; }
      this.mensaje('Así se resuelve: mira cómo se escribe cada orden en la terminal.');
      this.colaAcc = pasos.flatMap((p) => this.accionesDe(p));
      this.colaEsperas = 0;
      this.sigueCola();
    }
    accionesDe(paso) {
      if (paso.rellena !== undefined) return [{ cuando: 'linea', pausa: 400, hace: () => this.rellena(paso.rellena) }];
      const p = L.pasoMision(paso);
      const a = [{ cuando: 'linea', hace: () => this.teclea(p.orden, false, () => {}) }];
      if (p.tab) a.push({ cuando: 'tecleado', pausa: 600, hace: () => this.pulsaTecla('Tab', true) });
      a.push({ cuando: 'tecleado', pausa: 350, hace: () => { this.esperaDemo = undefined; this.intro(); } });
      // cada respuesta: se escribe y, al acabar, Intro; mientras tanto la cola espera
      (p.respuestas || []).forEach((r) => a.push({ cuando: 'leer', pausa: 300, hace: () => { this.colaOcupada = true; this.escribeTexto(r, () => setTimeout(() => { this.colaOcupada = false; this.intro(); }, 200)); } }));
      if (p.ctrlC) a.push({ cuando: 'marcha', antes: p.ctrlC * 1000 + 300, hace: () => this.pulsaTecla('Ctrl+C', true) });
      (p.teclas || []).forEach((k) => a.push({ cuando: 'programa', pausa: k.length === 1 ? 60 : 420, hace: () => this.pulsaTecla(k, k.length > 1) }));
      return a;
    }
    // ¿se puede hacer ya la acción? 'si', 'no' (esperar) o 'salta' (ya no hace falta)
    condicion(a) {
      if (this.escribiendo || this.colaOcupada) return 'no';
      if (a.cuando === 'linea') return !this.ej && !this.cerrada ? 'si' : 'no';
      if (a.cuando === 'tecleado') return 'si';
      if (a.cuando === 'leer') return !this.ej ? 'salta' : this.leyendo ? 'si' : 'no';
      if (a.cuando === 'marcha') return !this.ej ? 'salta' : 'si';
      if (a.cuando === 'programa') return this.programa ? 'si' : !this.ej ? 'salta' : 'no';
      return 'si';
    }
    sigueCola() {
      if (this.colaTimer) { clearTimeout(this.colaTimer); this.colaTimer = null; }
      const cola = this.colaAcc;
      const a = cola && cola[0];
      if (!a) { this.colaAcc = null; return; }
      const v = this.condicion(a);
      if (v === 'salta') { cola.shift(); this.sigueCola(); return; }
      if (v === 'no') { if (++this.colaEsperas > 600) { this.colaAcc = null; return; } this.colaTimer = setTimeout(() => this.sigueCola(), 100); return; }
      this.colaEsperas = 0;
      cola.shift();
      const hazlo = () => { if (this.colaAcc !== cola) return; a.hace(); this.colaTimer = setTimeout(() => this.sigueCola(), a.pausa || 300); };
      if (a.antes) this.colaTimer = setTimeout(hazlo, a.antes); else hazlo();
    }
    rellena(i) {
      const t = this.mision.tareas[i];
      const li = this.cajaMision.querySelectorAll('.term-tareas li')[i];
      if (!li || this.hechas[i]) return;
      let v;
      try { v = t.esperado(L.contextoMision(this.sis, this.sh)); } catch (e) { return; }
      li.querySelectorAll('.term-casilla, .term-selector').forEach((x, j) => { x.value = v[j] !== undefined ? v[j] : ''; });
      this.compruebaRespuesta(i, true);
    }
  }

  /* ---------------- vista «arbol»: las carpetas que se crean, se borran y dónde estás ---------------- */
  L.vistas = L.vistas || {};
  L.vistas.arbol = function (el, sis, opciones) {
    opciones = opciones || {};
    const ds = opciones.dataset || {};
    const raizR = ds.raiz || '~';
    el.classList.add('term-arbol');
    let previo = null, temp = null;
    // con otra raíz (/, /etc…): el primer nivel y solo la rama que lleva a la carpeta actual, con su contenido directo
    function ramaHacia(base, actual) {
      const nodo = (r, nombre, nivel, abrir) => {
        const s = sis.stat(r);
        if (!s) return null;
        const sl = sis.stat(r, false) || s;
        const n = { nombre, ruta: r, tipo: s.tipo === 'd' ? 'd' : sl.tipo, ino: s.ino };
        const dentro = r === actual || r === '/' || actual.startsWith(r + '/');
        if (s.tipo === 'd' && sl.tipo !== 'l' && abrir && (nivel === 0 || dentro)) {
          n.hijos = (sis.lista(r) || []).filter((h) => h.nombre[0] !== '.').map((h) => {
            const rh = (r === '/' ? '' : r) + '/' + h.nombre;
            return nodo(rh, h.nombre, nivel + 1, r !== actual && (actual === rh || actual.startsWith(rh + '/')));
          }).filter(Boolean);
        }
        return n;
      };
      return nodo(base, base === '/' ? '/' : base.split('/').pop(), 0, true);
    }
    function pinta(cambios) {
      const sh = opciones.sesion && opciones.sesion();
      const base = sis.expandeTilde(raizR);
      const personal = raizR === '~' || base === sis.home();
      const t = personal || !sh ? sis.arbol(raizR, { profundidad: 6 }) : ramaHacia(base, sh.pwd);
      const cwd = sh ? sh.cwdIno : null;
      const marcas = {};
      (cambios || []).forEach((c) => { if (c.ruta) marcas[c.ruta] = c.tipo === 'borra' ? 'borra' : (marcas[c.ruta] === 'crea' ? 'crea' : c.tipo); });
      // lo borrado se ve un momento tachado: se mezcla el árbol anterior con el nuevo
      const fantasmas = (prev, nuevo) => {
        if (!prev || !prev.hijos) return nuevo;
        const res = Object.assign({}, nuevo, { hijos: (nuevo.hijos || []).map((h) => fantasmas((prev.hijos || []).find((p) => p.nombre === h.nombre), h)) });
        (prev.hijos || []).forEach((p) => { if (!res.hijos.some((h) => h.nombre === p.nombre)) res.hijos.push(Object.assign({}, p, { borrado: true, hijos: undefined })); });
        res.hijos.sort((a, b) => L.util.comparaLocale(a.nombre, b.nombre));
        return res;
      };
      // la carpeta snap de la carpeta personal no se enseña en el árbol: solo ocupa sitio
      if (raizR === '~' && t && t.hijos) t.hijos = t.hijos.filter((h) => h.nombre !== 'snap');
      const vista = previo && (cambios || []).some((c) => c.tipo === 'borra') ? fantasmas(previo, t) : t;
      previo = t;
      const nodo = (n, nivel) => {
        if (!n) return '';
        const clases = ['term-nodo', n.tipo === 'd' ? 'dir' : n.tipo === 'l' ? 'enl' : 'arch'];
        if (n.ino === cwd && n.tipo === 'd' && !n.borrado) clases.push('actual');
        if (n.borrado) clases.push('borrado');
        else if (marcas[n.ruta] === 'crea') clases.push('nuevo');
        else if (marcas[n.ruta] === 'cambia') clases.push('cambiado');
        const nombre = nivel === 0 ? raizR : n.nombre;
        let s = `<li><span class="${clases.join(' ')}">${esc(nombre)}${n.tipo === 'd' && nivel > 0 ? '/' : ''}</span>`;
        if (n.hijos && n.hijos.length) s += '<ul>' + n.hijos.map((h) => nodo(h, nivel + 1)).join('') + '</ul>';
        return s + '</li>';
      };
      el.innerHTML = `<p class="term-arbol-titulo">${raizR === '~' ? 'Tu carpeta personal' : 'Carpetas de ' + esc(raizR)}</p><ul class="term-arbol-raiz">${nodo(vista, 0)}</ul>`;
      if (temp) clearTimeout(temp);
      if (vista !== t) temp = setTimeout(() => { temp = null; pinta([]); }, 1800);
      encaja();
      // la carpeta actual, siempre a la vista (medidas sin la escala de deck-stage)
      const act = el.querySelector('.actual');
      if (act) {
        const ra = act.getBoundingClientRect(), re = el.getBoundingClientRect();
        const k = (re.height / el.offsetHeight) || 1;
        if (el.scrollHeight > el.clientHeight) el.scrollTop = Math.max(0, el.scrollTop + (ra.top - re.top) / k - el.clientHeight / 2);
        if (el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, el.scrollLeft + (ra.left - re.left) / k - 24);
      }
      tapa();
    }
    /* Si el árbol no cabe en su panel: primero la letra baja un escalón y otro (22 y 20 px, nunca menos); si aún no
     * cabe, las carpetas y archivos sin nada abierto dentro se ponen en filas, uno detrás de otro, como los escribe
     * ls (así cabe la raíz entera, con sus veinte carpetas). Solo baja: donde la letra ya es menor (M7), no la sube. */
    function encaja() {
      el.classList.remove('term-arbol-l22', 'term-arbol-l20', 'term-arbol-filas');
      el.style.maxHeight = '';
      if (!el.clientHeight) return;
      const no = () => el.scrollHeight > el.clientHeight + 1;
      const n0 = el.querySelector('.term-nodo');
      const letra = n0 ? parseFloat(getComputedStyle(n0).fontSize) : 0;
      if (no() && letra > 22) el.classList.add('term-arbol-l22');
      if (no() && letra > 20) { el.classList.remove('term-arbol-l22'); el.classList.add('term-arbol-l20'); }
      if (no()) el.classList.add('term-arbol-filas');
    }
    // si aun así hay que desplazar, el borde de abajo no corta una línea por la mitad: el panel se acorta lo que asoma
    // de la línea que no cabe entera (después de cada orden; al desplazarlo a mano, no)
    function tapa() {
      el.style.maxHeight = '';
      if (el.scrollHeight <= el.clientHeight + 1) return;
      const re = el.getBoundingClientRect(), k = (re.height / el.offsetHeight) || 1;
      // arriba: si una línea asoma a medias, el panel sube hasta enseñarla entera
      const arriba = re.top + el.clientTop * k;
      el.querySelectorAll('.term-nodo').forEach((x) => { const r = x.getBoundingClientRect(); if (r.top < arriba - 1 && r.bottom > arriba + 1) el.scrollTop = Math.max(0, el.scrollTop - (arriba - r.top) / k); });
      const abajo = re.top + (el.clientTop + el.clientHeight) * k;
      let px = 0;
      el.querySelectorAll('.term-nodo').forEach((x) => { const r = x.getBoundingClientRect(); if (r.top < abajo - 1 && r.bottom > abajo + 1) px = Math.max(px, (abajo - r.top) / k); });
      if (px > 0) el.style.maxHeight = Math.floor(el.offsetHeight - px) + 'px';
    }
    pinta([]);
    // encaja(): otra vez, cuando cambia el sitio que tiene (al llegar a la diapositiva, al cambiar de tamaño)
    const reencaja = () => { encaja(); const act = el.querySelector('.actual'); if (act && el.scrollHeight > el.clientHeight) { const ra = act.getBoundingClientRect(), re = el.getBoundingClientRect(); const k = (re.height / el.offsetHeight) || 1; el.scrollTop = Math.max(0, el.scrollTop + (ra.top - re.top) / k - el.clientHeight / 2); } tapa(); };
    return { el, encaja: reencaja, actualiza(cambios, nuevo) { if (nuevo && nuevo !== sis) { sis = nuevo; previo = null; } pinta(cambios); } };
  };

  SOM.Terminal = Terminal;
  // API para las páginas de prueba: SOM.terminales[0].teclea('ls', true)
  SOM.terminales = SOM.terminales || [];
  /* Tamaño de la letra: una preferencia de quien mira, común a todas las terminales de la página y recordada en
   * localStorage (si no hay almacenamiento, funciona igual sin recordar). No toca las misiones ni la semilla. */
  const CLAVE_LETRA = 'som-linux-letra';
  let escala = 1;
  try { const v = parseFloat(window.localStorage.getItem(CLAVE_LETRA)); if (L.ESCALAS_LETRA.includes(v)) escala = v; } catch (e) { /* sin almacenamiento */ }
  L.escalaLetra = () => escala;
  L.ponLetra = function (v) {
    if (!L.ESCALAS_LETRA.includes(v)) return;
    escala = v;
    try { window.localStorage.setItem(CLAVE_LETRA, String(v)); } catch (e) { /* sin almacenamiento */ }
    SOM.terminales.forEach((t) => { if (t.aplicaEscala) t.aplicaEscala(); });
  };
  L.cambiaLetra = function (paso) {
    const lista = L.ESCALAS_LETRA;
    const i = lista.indexOf(escala);
    L.ponLetra(paso === 0 ? 1 : lista[Math.max(0, Math.min(lista.length - 1, i + paso))]);
  };
  function init() {
    const els = [...document.querySelectorAll('.term:not(.term-montada)')];
    if (!els.length) return;
    // lo que la página no trae y hace falta: las órdenes de la UT4 y sus misiones
    const faltan = [];
    if (!L.generaGrubCfg) faltan.push('linux-ut4.js');
    if (els.some((el) => /^ut4-/.test(el.dataset.mision || '')) && !(L.misiones && L.misiones['ut4-m1'])) faltan.push('linux-misiones-ut4.js');
    const monta = () => els.forEach((el) => { if (!el.classList.contains('term-montada')) SOM.terminales.push(new Terminal(el)); });
    if (!faltan.length) { monta(); return; }
    faltan.reduce((p, f) => p.then(() => carga(f)), Promise.resolve()).then(monta);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
