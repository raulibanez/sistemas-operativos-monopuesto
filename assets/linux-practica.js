/* Simulador de Linux · «Practica Linux»: encargos de una frase, uno cada vez, sobre la terminal viva.
 *
 *   <div class="practica-linux" data-ut="4"></div>
 *
 * Arriba, el bloque (un desplegable que salta de bloque y dice cuántos lleva hechos), un punto por encargo (verde:
 * hecho sin ver la solución; naranja: con la solución) y el encargo en grande. Debajo, la terminal (y, si el bloque
 * la lleva, la vista del árbol) y una franja con lo que dice la comprobación, Pista (dos), Ver solución y Reiniciar
 * el bloque. Lo hecho se guarda en ese navegador.
 *
 * Después de cada orden se mira si el encargo está conseguido: por el estado del sistema (carpeta, archivos, alias,
 * variables, paquetes, GRUB, contraseña…), por lo que ha salido en la pantalla («enseña…»: vale cualquier orden que
 * lo enseñe) o, si no hay otra forma, por una casilla o un evento (abrir un manual, cortar un ping). Nunca por el
 * nombre de la orden tecleada. Si no está y el alumno ha hecho algo cercano, el mensaje lo dice en términos del
 * resultado.
 *
 * Cada bloque es una sesión con su escenario y sus encargos se apoyan unos en otros. Al entrar a mitad de bloque o
 * al recargar, el sistema se reconstruye aplicando en silencio las soluciones de los encargos anteriores.
 *
 * Los bancos están en linux-practica-ut4.js (SOM.linux.practica.bancos[4]). Cada bloque: { id, nombre, escenario,
 * vista ('arbol'), encargos }. Cada encargo:
 *   pide      el encargo, una frase              pistas  dos: dónde mirar y, después, algo más cerca
 *   pre(c)    lo que necesita al empezar (la carpeta, un alias, un paquete…). Si al pasar del anterior no se cumple,
 *             el sistema se monta como al entrar por su punto
 *   sol       pasos de la solución (como en las misiones: texto o { orden, tab, ctrlC, teclas, respuestas })
 *   alt       otras soluciones (para las pruebas)  exp  la explicación al acertar
 *   hecho(c)  ¿está conseguido?                   cerca(c)  mensaje si lo hecho se acerca (o '')
 *   casilla   { nombres: [...], esperado(c), acepta(c), natural }  o  selector: [...] con esperado(c)
 *   despistes [{ pasos, msg: /…/ }] para las pruebas: lo que hace un despistado y lo que tiene que decir el mensaje
 * c (el contexto): sis, sh, home, cwd, abs(r), corta(r), existe, esDir, esArchivo, lee, lista, salida (lo que ha
 * salido con la última orden, sin colores; también lo de man, less o systemctl), lineas, linea (la última orden),
 * ordenes (sus órdenes simples), registro (lo ocurrido desde que empezó el encargo), ayuda(programa, tema),
 * alias(n), valor(n), paquete(n), grubCfg(), defaultGrub(), busca(nombre), buscaParecido(nombre), respuesta. */
(function (raiz) {
  'use strict';
  const SOM = (raiz.SOM = raiz.SOM || {});
  const L = (SOM.linux = SOM.linux || {});
  const P = (L.practica = L.practica || {});
  P.bancos = P.bancos || {};

  /* ---------------- núcleo (también en Node, para las pruebas) ---------------- */
  P.limpia = (t) => String(t || '').replace(/\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07|.\x08/g, '');
  // las órdenes que la unidad enseña (las pruebas comprueban que ninguna solución usa otra)
  P.ordenesUT = {
    4: ['pwd', 'ls', 'cd', 'touch', 'cat', 'more', 'whoami', 'id', 'who', 'w', 'date', 'cal', 'uname', 'lsmod', 'lsblk', 'top', 'echo', 'env', 'alias', 'unalias',
      'history', 'clear', 'passwd', 'exit', 'which', 'whereis', 'sudo', 'apt', 'nano', 'update-grub', 'grep', 'systemctl', 'ip', 'ping', 'man', 'help', 'type', 'info']
  };
  const ordenesDe = (linea) => { try { return L.ordenesDe ? L.ordenesDe(L.analiza(linea)) : []; } catch (e) { return []; } };
  P.ordenesDe = ordenesDe;

  P.contexto = function (sis, sh, o) {
    o = o || {};
    const home = sis.home();
    const abs = (r) => { r = String(r); if (r === '~' || r.startsWith('~/')) return home + r.slice(1); return r[0] === '/' ? r : (sh.pwd === '/' ? '' : sh.pwd) + '/' + r; };
    const salida = P.limpia(o.salida || '');
    // cómo estaba la sesión al empezar el encargo (P.marcaInicio): la carpeta y la anterior. Si la terminal se ha
    // cerrado y abierto otra, la sesión es nueva y no lo tiene
    const inicio = o.inicio || sh.inicioEncargo || null;
    const registro = (sis.registro || []).slice(o.desde || 0);
    // los archivos y carpetas con ese nombre (o con uno parecido) en la carpeta personal y en /tmp
    const recorre = (prueba) => {
      const out = [];
      const va = (r, n) => { if (n > 5) return; (sis.lista(r) || []).forEach((x) => { const rr = (r === '/' ? '' : r) + '/' + x.nombre; if (prueba(x.nombre)) out.push(rr); if (sis.esDir(rr) && !/^\.(cache|local|config)$|^snap$/.test(x.nombre)) va(rr, n + 1); }); };
      va(home, 0); va('/tmp', 0);
      return out;
    };
    const minus = (x) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return {
      sis, sh, home, abs, salida, registro,
      todo: P.limpia(o.todo || o.salida || ''),   // lo que ha salido desde que empezó el encargo
      inicio: inicio || {}, mismaSesion: !!inicio,
      get cwd() { return sh.pwd; },
      corta: (r) => (r === home ? '~' : r.startsWith(home + '/') ? '~' + r.slice(home.length) : r),
      existe: (r) => sis.existe(abs(r)),
      esDir: (r) => sis.esDir(abs(r)),
      esArchivo: (r) => sis.esArchivo(abs(r)),
      lee: (r) => sis.leeArchivo(abs(r)),
      lista: (r) => (sis.lista(abs(r)) || []).map((x) => x.nombre),
      lineas: salida.split('\n'),
      linea: o.linea || '',
      ordenes: ordenesDe(o.linea || ''),
      respuesta: o.respuesta || null,
      ayuda: (prog, tema) => registro.some((x) => x.tipo === 'ayuda' && x.programa === prog && (!tema || x.tema === tema)),
      lineasEscritas: () => registro.filter((x) => x.tipo === 'linea'),
      alias: (n) => (sh.alias.has(n) ? sh.alias.get(n) : null),
      valor: (n) => sh.valor(n),
      paquete: (n) => !!(sis.paquetes[n] && sis.paquetes[n].esta),
      grubCfg: () => sis.leeArchivo('/boot/grub/grub.cfg') || '',
      defaultGrub: () => sis.leeArchivo('/etc/default/grub') || '',
      busca: (nombre) => recorre((x) => x === nombre),
      buscaParecido: (nombre) => recorre((x) => x !== nombre && minus(x) === minus(nombre))
    };
  };

  // lo que dice cualquier encargo cuando la orden ha dado un error típico
  function mensajeGeneral(c) {
    const s = c.salida;
    if (/No existe el archivo o el directorio/.test(s)) return 'Esa ruta no existe. Revisa cómo está escrita: las mayúsculas, las tildes y las barras cuentan.';
    if (/no se encontró la orden|orden no encontrada|No se ha encontrado la orden/.test(s)) return 'La terminal no conoce esa orden: revisa cómo está escrita.';
    if (/intentos de contraseña incorrectos|Lo siento, pruebe otra vez/.test(s)) return `Esa no es la contraseña. La tuya en el simulador es ${(c.sis.esc && c.sis.esc.clave) || 'alumno'}: escríbela aunque no se vea y pulsa Intro.`;
    // nano sin sudo en un archivo del administrador (/etc/default/grub): lo abre, pero no lo puede guardar
    if (/no es de escritura|Error al escribir/.test(s)) return 'Ese archivo es del administrador: tú no lo puedes cambiar. Ábrelo con sudo delante para poder guardarlo.';
    if (/Permiso denegado|superusuario|ser root|You must run this as root/.test(s)) return 'Para eso hacen falta permisos de administrador: la orden va con sudo delante.';
    if (/opción incorrecta|opción no válida|invalid option/.test(s)) return 'Esa opción no existe. Las opciones de cada orden están en su ayuda, con --help.';
    return '';
  }
  // el encargo, ¿conseguido? Si no, el mensaje (o '')
  // ningún intento que no cuenta se queda sin mensaje: si no hay uno propio, este (generico: true)
  P.FALTA = 'Todavía no se ve lo que pide el encargo. Vuelve a leerlo y, si no sabes por dónde seguir, pide una pista.';
  const sinTildes = (x) => String(x).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  P.evalua = function (enc, c) {
    let hecho = false;
    try { hecho = !!enc.hecho(c); } catch (e) { hecho = false; }
    if (hecho) return { hecho: true, msg: '' };
    // una casilla o el selector con la respuesta escrita: qué le pasa
    if ((enc.casilla || enc.selector) && c.respuesta) {
      if (enc.antes && !enc.antes.ok(c)) return { hecho: false, msg: enc.antes.msg };
      let ac = [];
      try { ac = enc.casilla && enc.casilla.acepta ? enc.casilla.acepta(c) : enc.esperado(c).map((x) => [x]); } catch (e) { ac = []; }
      const casi = ac.some((lista, i) => c.respuesta[i] && lista.some((a) => sinTildes(a) === sinTildes(c.respuesta[i])));
      return { hecho: false, msg: casi ? 'Casi: en Linux las mayúsculas y las tildes cuentan. Escríbelo tal como sale en la terminal.' : 'Ese no es el dato. Vuelve a mirarlo en la terminal.' };
    }
    let msg = '';
    try { msg = (enc.cerca && enc.cerca(c)) || ''; } catch (e) { msg = ''; }
    msg = msg || mensajeGeneral(c);
    return msg ? { hecho: false, msg } : { hecho: false, msg: P.FALTA, generico: true };
  };
  // las casillas y el selector: hecho cuando la respuesta es buena
  P.prepara = function (banco) {
    if (banco.preparado) return banco;
    banco.bloques.forEach((b) => b.encargos.forEach((e) => {
      e.clave = b.id + '/' + e.id;
      if ((e.casilla || e.selector) && !e.hecho) {
        e.hecho = (c) => {
          if (!c.respuesta) return false;
          if (e.antes && !e.antes.ok(c)) return false;   // primero hay que averiguarlo en la terminal
          const ac = e.casilla && e.casilla.acepta ? e.casilla.acepta(c) : e.esperado(c).map((x) => [x]);
          const coincide = L.coincideRespuesta || ((v, l) => l.some((x) => String(x).trim() === String(v).trim()));
          return ac.every((lista, i) => c.respuesta[i] !== undefined && c.respuesta[i] !== '' && coincide(c.respuesta[i], lista, e.casilla && e.casilla.natural));
        };
        if (!e.esperado && e.casilla) e.esperado = e.casilla.esperado;
      }
    }));
    banco.preparado = true;
    return banco;
  };
  // un paso con sudo: la contraseña delante si sudo la va a pedir (después de usarlo, tarda un rato en volver a pedirla)
  P.conClave = function (sh, paso) {
    const p = L.pasoMision(paso);
    if (!/^\s*sudo\b/.test(p.orden)) return paso;
    const clave = sh.sis.esc.clave || 'alumno';
    const pide = !(sh.sudoHasta > sh.sis.ahora());
    const r = (p.respuestas || []).filter((x) => x !== clave);
    return Object.assign({}, p, { respuestas: pide ? [clave].concat(r) : r });
  };
  // cómo está la sesión al empezar un encargo (lo usan «vuelve a la carpeta de antes» y los encargos que no valen
  // si se ha cerrado la terminal)
  P.marcaInicio = function (sh) { sh.inicioEncargo = { cwd: sh.pwd, oldpwd: sh.valor('OLDPWD') || '' }; };
  // ¿sirve el estado que hay para empezar el encargo? (e.pre: lo que necesita; sin pre, siempre)
  P.preOk = function (e, sis, sh) {
    if (!e.pre) return true;
    P.marcaInicio(sh);
    try { return !!e.pre(P.contexto(sis, sh, {})); } catch (x) { return false; }
  };
  // el sistema al empezar el encargo k del bloque: el escenario y, en silencio, las soluciones de los anteriores
  P.reconstruye = function (bloque, k, opc) {
    const sis = L.crea(Object.assign({}, bloque.escenario || {}, (opc && opc.fecha) ? { fecha: opc.fecha } : {}));
    const sh = sis.sesion({ columnas: 80, lineas: 24 });
    for (let j = 0; j < k; j++) (bloque.encargos[j].sol || []).forEach((p) => { try { L.ejecutaPaso(sh, P.conClave(sh, p)); } catch (e) { /* sigue */ } });
    P.marcaInicio(sh);
    return { sis, sh };
  };
  // ejecuta un paso en Node y da el contexto de después (lo usan las pruebas)
  P.ejecuta = function (sh, paso, desde) {
    const r = L.ejecutaPaso(sh, P.conClave(sh, paso));
    const salida = (r.stdout || '') + (r.stderr || '') + (r.pantallas || []).map((x) => P.limpia(x)).join('\n');
    return P.contexto(sh.sis, sh, { salida, linea: r.linea, desde });
  };

  /* ---------------- el componente en la página ---------------- */
  if (typeof document === 'undefined') { if (typeof module !== 'undefined' && module.exports) module.exports = P; return; }
  const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  // ‹así› se escribe en letra de código
  const fmt = (t) => esc(t).replace(/‹([^›]+)›/g, '<code>$1</code>');
  const base = (() => { const s = document.currentScript && document.currentScript.src; return s ? s.slice(0, s.lastIndexOf('/') + 1) : 'assets/'; })();
  const cargados = new Set();
  // si la descarga falla (sin red), no cuenta como cargado: la próxima vez se vuelve a pedir
  function cargaScript(f) {
    if (cargados.has(f)) return Promise.resolve(true);
    return new Promise((ok) => {
      const s = document.createElement('script'); s.src = base + f;
      s.onload = () => { cargados.add(f); ok(true); };
      s.onerror = () => { s.remove(); ok(false); };
      document.head.appendChild(s);
    });
  }
  // lo que hace falta además del simulador: las misiones (comparar respuestas) y el banco. La ayuda (man, info, man -k,
  // --help: unos 1,4 MB) no se carga aquí: la terminal la pide la primera vez que se usa, como en las misiones
  function dependencias(ut) {
    const faltan = [];
    if (!L.generaGrubCfg) faltan.push('linux-ut4.js');
    if (!L.ejecutaPaso) faltan.push('linux-misiones.js');
    if (!L.coincideRespuesta) faltan.push('linux-misiones-ut4.js');
    if (!P.bancos[ut]) faltan.push('linux-practica-ut' + ut + '.js');
    if (!SOM.Terminal) faltan.push('linux-term.js');   // si la página no la trae (o no llegó a cargarse)
    return faltan.reduce((p, f) => p.then(() => cargaScript(f)), Promise.resolve());
  }

  function monta(el) {
    if (el.dataset.montada) return;
    el.dataset.montada = '1';
    const ut = el.dataset.ut || '4';
    el.innerHTML = '<p class="pl-cargando">Cargando la terminal…</p>';
    const espera = () => (SOM.Terminal ? Promise.resolve() : new Promise((ok) => window.addEventListener('load', ok, { once: true })));
    // si falta algo porque no se ha podido bajar (sin red), se dice y se puede volver a intentar
    const fallo = (txt) => {
      el.innerHTML = `<p class="pl-cargando">${txt} <button type="button" class="btn btn-primary pl-reintenta">Volver a intentarlo</button></p>`;
      el.querySelector('.pl-reintenta').addEventListener('click', () => { delete el.dataset.montada; monta(el); });
    };
    espera().then(() => dependencias(ut)).then(() => {
      const sinRed = !L.ejecutaPaso || !L.coincideRespuesta || !L.generaGrubCfg;
      if (!SOM.Terminal || sinRed || (!P.bancos[ut] && !cargados.has('linux-practica-ut' + ut + '.js') && !document.querySelector(`script[src$="linux-practica-ut${ut}.js"]`))) { fallo('No se ha podido cargar el ejercicio: puede que no haya conexión.'); return; }
      if (!P.bancos[ut]) { el.textContent = 'No hay encargos para la unidad ' + ut + '.'; return; }
      new Practica(el, P.prepara(P.bancos[ut]), ut);
    });
  }

  class Practica {
    constructor(el, banco, ut) {
      this.el = el; this.banco = banco; this.ut = ut;
      el._practica = this;   // para las pruebas en el navegador
      this.lista = [];
      banco.bloques.forEach((b) => b.encargos.forEach((e, k) => this.lista.push({ b, e, k })));
      this.CLAVE = 'som-practica-linux-ut' + ut;
      this.guardado = { hecho: {}, ultimo: null };
      try { this.guardado = Object.assign(this.guardado, JSON.parse(localStorage.getItem(this.CLAVE)) || {}); } catch (e) { /* sin almacenamiento */ }
      el.classList.add('pl');
      el.innerHTML =
        '<div class="pl-cab"><span class="pl-pill">Practica Linux</span><select class="pl-bloque" aria-label="Bloque de encargos"></select><span class="pl-donde"></span><div class="pl-puntos" role="group" aria-label="Encargos del bloque"></div></div>'
        + '<div class="pl-pide"><span class="pl-num"></span><div class="pl-pide-txt"><p class="pl-texto"></p><div class="pl-resp" hidden></div></div></div>'
        + '<div class="pl-cuerpo"></div>'
        + '<div class="pl-pie"><p class="pl-fb" role="status" aria-live="polite"></p><div class="pl-botones"><button type="button" class="btn btn-ghost pl-pista">Pista</button>'
        + '<button type="button" class="btn btn-ghost pl-sol">Ver solución</button><button type="button" class="btn btn-ghost pl-repite">Repetir este encargo</button><button type="button" class="btn btn-ghost pl-reinicia">Reiniciar el bloque</button>'
        + '<button type="button" class="btn btn-ghost pl-ant">← Anterior</button><button type="button" class="btn btn-ghost pl-sig">Siguiente →</button></div></div>';
      const $ = (s) => el.querySelector(s);
      this.$ = $;
      this.fb = $('.pl-fb'); this.cuerpo = $('.pl-cuerpo'); this.resp = $('.pl-resp');
      // las teclas dentro del ejercicio no cambian de diapositiva
      ['keydown', 'keyup', 'keypress'].forEach((t) => el.addEventListener(t, (e) => { if (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key.length === 1 || /^(Enter|Arrow|Page|Home|End|Backspace|Delete|Tab|F\d)/.test(e.key))) e.stopPropagation(); }));
      $('.pl-pista').addEventListener('click', () => this.pista());
      $('.pl-sol').addEventListener('click', () => this.solucion());
      $('.pl-repite').addEventListener('click', () => this.repiteEncargo());
      $('.pl-reinicia').addEventListener('click', () => this.reiniciaBloque());
      $('.pl-ant').addEventListener('click', () => { if (this.n > 0) this.carga(this.n - 1); });
      $('.pl-sig').addEventListener('click', () => this.siguiente());
      $('.pl-puntos').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.carga(+b.dataset.n); });
      $('.pl-bloque').addEventListener('change', (e) => {
        const b = this.banco.bloques[+e.target.value];
        const ks = this.lista.map((x, i) => i).filter((i) => this.lista[i].b === b);
        const k = ks.find((i) => !this.guardado.hecho[this.lista[i].e.clave]);
        this.carga(k === undefined ? ks[0] : k);
        this.t.enfoca();
      });
      // un clic en el ejercicio que no sea en un campo (los botones, los puntos, el encargo, un hueco) deja el foco
      // en la terminal al acabar su acción, como en las misiones: así las teclas no van a la presentación
      const esCampo = (x) => !!x && x !== (this.t && this.t.entrada) && (x.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(x.tagName));
      el.addEventListener('click', (e) => {
        if (esCampo(e.target) || e.target.closest('input, select, textarea')) return;
        setTimeout(() => { const a = document.activeElement; if (!this.t || (a && el.contains(a) && esCampo(a))) return; const s = window.getSelection && window.getSelection(); if (s && !s.isCollapsed && el.contains(s.anchorNode)) return; this.t.enfoca(); }, 0);
      }, true);
      if (window.matchMedia) { const mq = window.matchMedia('(max-width: 700px)'); const f = () => { if (this.x) this.cabecera(); }; if (mq.addEventListener) mq.addEventListener('change', f); }
      window.addEventListener('storage', (e) => {
        if (e.key !== this.CLAVE || !e.newValue) return;
        try { this.junta(JSON.parse(e.newValue)); } catch (x) { return; }
        if (this.x) this.cabecera();
      });
      const ult = this.lista.findIndex((x) => x.e.clave === this.guardado.ultimo);
      const primero = this.lista.findIndex((x) => !this.guardado.hecho[x.e.clave]);
      this.carga(ult >= 0 ? ult : primero >= 0 ? primero : 0);
    }
    /* Lo hecho se guarda en el navegador con una clave por unidad, la misma en la diapositiva y en practica.html: antes
     * de escribir se lee lo que haya y se junta (nunca se pierde un punto; verde gana a naranja), y cada copia abierta
     * se entera de lo que guarda la otra (evento storage). */
    junta(otro) {
      const h = this.guardado.hecho;
      Object.entries((otro && otro.hecho) || {}).forEach(([k, v]) => { if (h[k] !== 'ok' && (v === 'ok' || v === 'sol')) h[k] = v; });
    }
    guarda() {
      try {
        let otro = null; try { otro = JSON.parse(localStorage.getItem(this.CLAVE)); } catch (e) { otro = null; }
        this.junta(otro);
        localStorage.setItem(this.CLAVE, JSON.stringify(this.guardado));
      } catch (e) { /* sin almacenamiento */ }
    }
    di(tipo, texto) { this.fb.className = 'pl-fb' + (tipo ? ' ' + tipo : ''); this.fb.innerHTML = texto; this.fbTipo = tipo; }

    // la terminal del bloque (otra si cambia la vista)
    terminal(bloque) {
      const vista = bloque.vista || '';
      if (this.t && this.tVista === vista) return this.t;
      this.cuerpo.innerHTML = '';
      const tel = document.createElement('div');
      tel.className = 'term';
      tel.dataset.escenario = 'inicio';
      if (vista) tel.dataset.vista = vista;
      this.cuerpo.appendChild(tel);
      const t = new SOM.Terminal(tel);
      t.bloque = this.el;   // el bloque «en uso» es todo el ejercicio: sus botones tampoco pasan teclas a la presentación
      SOM.terminales.push(t);
      this.t = t; this.tVista = vista;
      // sin el Reiniciar de la terminal libre: aquí se reinicia el bloque
      [...t.acciones.querySelectorAll('button')].forEach((b) => { if (b.textContent === 'Reiniciar') b.remove(); });
      const yo = this;
      // lo que sale con cada orden (también lo de man, less o systemctl) y la comprobación al acabar
      const lanza = t.lanza.bind(t), escribe = t.escribe.bind(t), abre = t.abrePrograma.bind(t), tras = t.trasOrden.bind(t), intro = t.intro.bind(t);
      t.lanza = function (linea) { yo.captura = ''; yo.lineaActual = linea; return lanza(linea); };
      t.escribe = function (tipo, texto) { if (yo.captura !== null && yo.captura !== undefined && (tipo === 'out' || tipo === 'err')) { yo.captura += texto; yo.todo += texto; } return escribe(tipo, texto); };
      t.abrePrograma = function (p) { const r = abre(p); try { const pan = '\n' + (p.pantalla(t.cols || 80, t.filas || 24) || []).join('\n') + '\n'; yo.captura = (yo.captura || '') + pan; yo.todo += pan; } catch (e) { /* sin pantalla */ } return r; };
      t.trasOrden = function (ej) { tras(ej); yo.comprueba(); };
      // con el encargo hecho, Intro en la línea vacía pasa al siguiente (el foco no sale de la terminal)
      t.intro = function () { if (yo.hechoAhora && !t.entrada.value.trim() && !t.ej && !t.leyendo && !t.pendiente) { yo.siguiente(); return; } return intro(); };
      t.nuevaSesion = function () { yo.carga(yo.n, true); };
      return t;
    }
    // pone el sistema reconstruido en la terminal
    ponSistema(sis, sh) {
      const t = this.t;
      t.para();
      t.sis = sis; t.sh = sh;
      t.salida.innerHTML = ''; t.nLineas = 0; t.pos = { col: 0 };
      t.ej = null; t.leyendo = null; t.pendiente = ''; t.entrada.value = ''; t.histIdx = null; t.tabs = 0;
      t.programa = null; t.prog.hidden = true; t.el.classList.remove('term-en-programa');
      t.cierra(false);
      t.mide(); t.pinta();
      if (t.vista && t.vista.actualiza) t.vista.actualiza([], sis); else t.actualizaVista([]);
    }

    carga(n, reconstruir) {
      const x = this.lista[n];
      if (!x) return;
      const antes = this.lista[this.n];
      // seguir con el mismo sistema solo al pasar al siguiente del mismo bloque con el actual ya hecho
      let sigue = !reconstruir && antes && antes.b === x.b && n === this.n + 1 && this.hechoAhora && this.t && !this.t.cerrada;
      // y si lo que dejó el anterior sirve para este (su «pre»); si no, se monta como al entrar por su punto
      let rehecho = false;
      if (sigue && !P.preOk(x.e, this.t.sis, this.t.sh)) { sigue = false; rehecho = true; }
      this.n = n; this.x = x; this.nPista = 0; this.conSol = false; this.hechoAhora = false;
      this.guardado.ultimo = x.e.clave; this.guarda();
      const t = this.terminal(x.b);
      if (!sigue) { const r = P.reconstruye(x.b, x.k); this.ponSistema(r.sis, r.sh); }
      this.desde = (t.sis.registro || []).length;
      this.captura = null; this.todo = '';
      P.marcaInicio(t.sh);
      this.$('.pl-num').textContent = String(x.k + 1);
      this.$('.pl-texto').innerHTML = fmt(x.e.pide);
      this.$('.pl-pista').textContent = 'Pista';
      this.pintaRespuesta();
      this.di('', rehecho ? 'La terminal está como al empezar este encargo: lo que quedó del anterior no servía para hacerlo.' : sigue || x.k === 0 ? 'Escribe en la terminal. Cuando lo consigas, saldrá aquí.' : 'La terminal está como si hubieras hecho los encargos anteriores de este bloque.');
      this.cabecera();
      // un encargo que ya estaba conseguido al llegar (por ejemplo, la carpeta en la que ya estás) no cuenta aún
      if (document.activeElement && this.el.contains(document.activeElement) && !this.resp.contains(document.activeElement)) t.enfoca();
    }
    cabecera() {
      const $ = this.$, x = this.x, h = this.guardado.hecho;
      const bloques = this.banco.bloques;
      // en una pantalla estrecha, el nombre corto del bloque (si lo tiene): el contador «(3 de 7)» tiene que leerse
      const estrecha = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
      $('.pl-bloque').innerHTML = bloques.map((b, i) => `<option value="${i}"${b === x.b ? ' selected' : ''}>${i + 1}. ${esc(estrecha && b.corto ? b.corto : b.nombre)} (${b.encargos.filter((e) => h[e.clave]).length} de ${b.encargos.length})</option>`).join('');
      $('.pl-donde').textContent = `Encargo ${x.k + 1} de ${x.b.encargos.length}`;
      $('.pl-puntos').innerHTML = this.lista.map((y, i) => (y.b === x.b ? `<button type="button" data-n="${i}" class="${h[y.e.clave] || ''}${i === this.n ? ' aqui' : ''}" title="Encargo ${y.k + 1}" aria-label="Encargo ${y.k + 1}${h[y.e.clave] === 'ok' ? ', hecho' : h[y.e.clave] === 'sol' ? ', hecho con la solución' : ''}"></button>` : '')).join('');
      $('.pl-ant').disabled = this.n === 0;
      $('.pl-sig').disabled = this.n === this.lista.length - 1;
      $('.pl-sig').classList.toggle('btn-primary', this.hechoAhora);
      $('.pl-sig').classList.toggle('btn-ghost', !this.hechoAhora);
    }
    // la casilla o el selector del encargo, si lo lleva
    pintaRespuesta() {
      const e = this.x.e;
      if (!e.casilla && !e.selector) { this.resp.hidden = true; this.resp.innerHTML = ''; return; }
      this.resp.hidden = false;
      const campos = e.selector
        ? `<select class="pl-casilla pl-selector" aria-label="Respuesta"><option value="">— elige —</option>${e.selector.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`
        : e.casilla.nombres.map((nm) => `<input class="pl-casilla" type="text" placeholder="${esc(nm)}" aria-label="${esc(nm)}" autocomplete="off" autocapitalize="off" spellcheck="false">`).join('');
      this.resp.innerHTML = campos + '<button type="button" class="btn btn-primary pl-comprobar">Comprobar</button>';
      this.resp.querySelector('.pl-comprobar').addEventListener('click', () => this.compruebaRespuesta());
      this.resp.querySelectorAll('.pl-casilla').forEach((x) => x.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); this.compruebaRespuesta(); } }));
      // el selector se comprueba con «Comprobar» o con Intro, no al moverlo: con las flechas se acertaría probando
    }
    contexto(extra) {
      const t = this.t;
      return P.contexto(t.sis, t.sh, Object.assign({ salida: this.captura || '', todo: this.todo || '', linea: this.lineaActual || '', desde: this.desde }, extra || {}));
    }
    // después de cada orden
    comprueba() {
      if (this.hechoAhora) return;
      const e = this.x.e;
      // con casilla, después de cada orden solo se avisa de un error; el dato se comprueba al escribirlo
      if (e.casilla || e.selector) {
        const r = P.evalua(Object.assign({}, e, { hecho: () => false }), this.contexto());
        if (this.fbTipo === 'pista') return;
        if (r.msg && !r.generico) this.di('ko', '<b>Todavía no.</b> ' + fmt(r.msg));
        else this.di('', e.selector ? 'Cuando lo sepas, elige la respuesta arriba.' : 'Cuando tengas el dato, escríbelo arriba y pulsa Intro o «Comprobar».');
        return;
      }
      const r = P.evalua(e, this.contexto());
      this.captura = null;
      if (r.hecho) this.acierta();
      else if (r.msg && !(r.generico && this.fbTipo === 'pista')) this.di('ko', '<b>Todavía no.</b> ' + fmt(r.msg));
    }
    compruebaRespuesta() {
      const vals = [...this.resp.querySelectorAll('.pl-casilla')].map((x) => x.value.trim());
      if (vals.some((v) => !v)) { this.di('ko', 'Escribe la respuesta antes de comprobarla.'); return; }
      const r = P.evalua(this.x.e, this.contexto({ respuesta: vals }));
      if (r.hecho) { this.acierta(); this.resp.querySelectorAll('input, select, button').forEach((x) => { x.disabled = true; }); this.t.enfoca(); }
      else { this.di('ko', '<b>Todavía no.</b> ' + fmt(r.msg)); if (!(this.x.e.antes && !this.x.e.antes.ok(this.contexto()))) this.resp.querySelector('.pl-casilla').focus(); }
    }
    acierta() {
      const e = this.x.e;
      this.hechoAhora = true;
      const h = this.guardado.hecho;
      h[e.clave] = this.conSol && h[e.clave] !== 'ok' ? 'sol' : 'ok';
      this.guarda();
      const ultimo = this.n === this.lista.length - 1;
      this.di('ok', '<b>¡Hecho!</b> ' + fmt(e.exp) + (ultimo ? ' Has llegado al último encargo.' : ' <span class="pl-sigue">Pulsa Intro con la línea vacía o «Siguiente» para seguir.</span>'));
      this.cabecera();
    }
    siguiente() { if (this.n < this.lista.length - 1) { this.carga(this.n + 1); this.t.enfoca(); } }
    pista() {
      const e = this.x.e;
      this.nPista = Math.min(this.nPista + 1, e.pistas.length);
      this.di('pista', `<b>Pista ${this.nPista} de ${e.pistas.length}.</b> ` + fmt(e.pistas[this.nPista - 1]));
      this.$('.pl-pista').textContent = this.nPista < e.pistas.length ? 'Otra pista' : 'Pista';
      this.t.enfoca();
    }
    // la solución se escribe en la terminal, como una demostración
    solucion() {
      const t = this.t, e = this.x.e;
      if (t.colaAcc) return;
      if (t.programa) { this.di('ko', `Antes, sal de ${t.programa.tipo} (con ${t.programa.tipo === 'nano' ? 'Ctrl + X' : 'q'}).`); t.enfoca(); return; }
      if (t.ej) { this.di('ko', 'Antes, corta la orden que está en marcha con Ctrl + C.'); t.enfoca(); return; }
      if (t.cerrada) t.reabre();
      this.conSol = true;
      const h = this.guardado.hecho;
      if (!h[e.clave]) { h[e.clave] = 'sol'; this.guarda(); this.cabecera(); }
      this.di('pista', '<b>Solución.</b> Mira cómo se escribe en la terminal.');
      // cada paso se prepara al llegarle el turno: si sudo pedirá la contraseña depende de lo que haya pasado antes
      const acciones = (e.sol || []).map((p) => ({ cuando: 'linea', pausa: 50, hace: () => { if (t.colaAcc) t.colaAcc.unshift(...t.accionesDe(P.conClave(t.sh, p))); } }));
      if (e.casilla || e.selector) acciones.push({ cuando: 'linea', pausa: 300, hace: () => {
        let v = [];
        try { v = e.esperado(this.contexto()); } catch (x) { v = []; }
        this.resp.querySelectorAll('.pl-casilla').forEach((x, j) => { x.value = v[j] !== undefined ? v[j] : ''; });
        this.compruebaRespuesta();
      } });
      t.colaAcc = acciones; t.colaEsperas = 0; t.sigueCola();
    }
    // la terminal como al empezar este encargo (los puntos no se tocan)
    repiteEncargo() {
      this.carga(this.n, true);
      this.di('', 'La terminal está como al empezar este encargo.');
      this.t.enfoca();
    }
    reiniciaBloque() {
      const i = this.lista.findIndex((y) => y.b === this.x.b);
      this.carga(i, true);
      this.di('', 'El bloque está como al principio.');
      this.t.enfoca();
    }
  }

  // en una presentación, el ejercicio se monta (y carga su banco) al llegar a su diapositiva, no al abrir la unidad
  function montaCuandoSeVea(el) {
    const sec = el.closest('section'), stage = document.querySelector('deck-stage');
    if (!stage || !sec) { monta(el); return; }
    const mira = () => { if (sec.hasAttribute('data-deck-active')) { stage.removeEventListener('slidechange', mira); monta(el); } };
    stage.addEventListener('slidechange', mira);
    mira();
    window.addEventListener('load', mira, { once: true });
  }
  function init() { document.querySelectorAll('.practica-linux').forEach(montaCuandoSeVea); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  P.monta = monta;
})(typeof window !== 'undefined' ? window : globalThis);
