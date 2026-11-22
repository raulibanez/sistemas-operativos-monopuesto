/* Simulador de Linux · simuladores visuales de la UT4 (orden, particiones, arranque, linea), vista «arranque» de la
 * terminal y generadores de rejilla version-nucleo y distro.
 *
 * Marcado (se monta solo al cargar la página; no hace falta tocar som.js):
 *   <div class="lvis" data-tipo="orden"></div>
 *       Partes de una línea de órdenes, con una terminal pequeña al lado (data-terminal="no" la quita).
 *       Líneas propias: <ol class="lvis-lineas" hidden><li>ls -l /etc</li>…</ol> dentro del div.
 *   <div class="lvis" data-tipo="particiones" data-disco="40" data-ram="4" data-firmware="uefi"></div>
 *       Repartir un disco, en modo exploración (sin corrección). data-plan="vacio | defecto | som" (el de partida).
 *   <div class="lvis" data-tipo="arranque" data-modo="cadena"></div>
 *       Del firmware al escritorio: Encender, Pulsar Esc y la frase de cada caja.
 *   <div class="lvis" data-tipo="linea" data-formato="ls-l"></div>
 *       Anatomía de una línea; líneas propias con <ol class="lvis-lineas" hidden><li data-nombre="…"
 *       data-orden="ls -l">-rw-r--r-- 1 …</li></ol>.
 * Vista de la terminal: <div class="term" data-vista="arranque"> llama a SOM.linux.vistas.arranque(el, sis, opciones),
 *   que devuelve { actualiza(cambios, sis) }.
 * Generadores (los monta som.js): <div class="ej" data-tipo="version-nucleo"></div> y
 *   <div class="ej" data-tipo="distro" data-modo="datos | caso"></div>.
 * La lógica, sin DOM, está en SOM.linuxVis (la prueba herramientas/prueba-linux-vis.js en Node).
 */
(function (raiz) {
  'use strict';
  const SOM = (raiz.SOM = raiz.SOM || {});
  SOM.linux = SOM.linux || {};
  const V = (SOM.linuxVis = SOM.linuxVis || {});
  const hayDOM = typeof document !== 'undefined';

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const elige = (a) => a[rnd(0, a.length - 1)];
  const baraja = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const variante = (clave, total) => ({ variante: clave, variantes: total });
  const numES = (x) => String(x).replace('.', ',');
  const gb = (x) => numES(Math.round(x * 100) / 100) + ' GB';

  /* ============================== 1. Partes de una orden ============================== */
  /* Qué hace cada orden de la unidad y qué significan sus opciones (frases de las diapositivas 14, 15, 28, 54,
   * 77 a 85). Lo que no está aquí se explica solo por su papel: orden, opción o argumento. */
  const ORDENES = {
    ls: { que: 'ls lista lo que hay en una carpeta.', arg: 'la carpeta que se lista, sin entrar en ella. Sin argumento, ls lista la carpeta en la que estás.',
      cortas: { l: 'en formato largo, una línea por archivo', a: 'también los archivos ocultos, que empiezan por punto', r: 'en orden inverso', t: 'por fecha, el más reciente primero' },
      largas: { all: 'a', reverse: 'r' } },
    uname: { que: 'uname dice qué sistema es.',
      cortas: { s: 'el nombre del núcleo: Linux', n: 'el nombre del equipo', r: 'la versión del núcleo', v: 'cuándo se compiló el núcleo', m: 'el tipo de procesador: x86_64', o: 'el sistema operativo: GNU/Linux', p: 'el procesador', i: 'la plataforma', a: 'todo a la vez' },
      largas: { 'kernel-name': 's', nodename: 'n', 'kernel-release': 'r', 'kernel-version': 'v', machine: 'm', 'operating-system': 'o', processor: 'p', 'hardware-platform': 'i', all: 'a' } },
    echo: { que: 'echo escribe en la pantalla lo que pongas detrás.', arg: 'lo que echo escribe en la pantalla.',
      cortas: { n: 'sin salto de línea al final', e: 'entiende las secuencias con barra, como \\n', E: 'no entiende las secuencias con barra' }, soloCortas: 'neE' },
    clear: { que: 'clear limpia la pantalla.' },
    pwd: { que: 'pwd enseña la carpeta en la que estás.' },
    cd: { que: 'cd cambia de carpeta.', arg: 'la carpeta a la que vas. Sin argumento, cd vuelve a tu carpeta personal.' },
    cat: { que: 'cat enseña lo que hay dentro de un archivo.', arg: 'el archivo que se enseña.', cortas: { n: 'numera las líneas' }, largas: { number: 'n' } },
    more: { que: 'more enseña un archivo largo pantalla a pantalla.', arg: 'el archivo que se enseña.' },
    man: { que: 'man abre el manual de una orden.', arg: 'la orden de la que se abre el manual.', cortas: { k: 'busca una palabra en las descripciones de todas las órdenes' } },
    touch: { que: 'touch crea un archivo vacío, o cambia la fecha de uno que ya existe.', arg: 'el archivo que se crea o se actualiza.' },
    date: { que: 'date enseña la fecha y la hora.' },
    cal: { que: 'cal enseña un calendario.', cortas: { 3: 'el mes anterior, el actual y el siguiente', y: 'el año entero', m: 'pide un mes' } },
    whoami: { que: 'whoami dice tu nombre de usuario.' },
    id: { que: 'id dice tu número de usuario (uid) y tus grupos.' },
    who: { que: 'who dice quién ha iniciado sesión y en qué terminal.', cortas: { a: 'da más datos' } },
    w: { que: 'w dice quién ha iniciado sesión y qué está haciendo cada uno.' },
    history: { que: 'history enseña las órdenes que ya escribiste.', cortas: { c: 'borra el historial' } },
    alias: { que: 'alias crea un nombre corto para una orden, o enseña los que hay.' },
    unalias: { que: 'unalias borra un alias.', arg: 'el alias que se borra.' },
    which: { que: 'which dice dónde está el programa de una orden.', arg: 'la orden que se busca.' },
    whereis: { que: 'whereis dice dónde están el programa y la página del manual de una orden.', arg: 'la orden que se busca.' },
    type: { que: 'type dice si una orden es interna, un alias o un programa.', arg: 'la orden por la que se pregunta.' },
    help: { que: 'help enseña la ayuda de las órdenes internas de bash.', arg: 'la orden interna de la que se pide ayuda.' },
    lsblk: { que: 'lsblk lista los discos y sus particiones.' },
    lsmod: { que: 'lsmod lista los módulos del núcleo que están cargados.' },
    grep: { que: 'grep deja solo las líneas que contienen una palabra.', arg: 'la palabra que se busca, o el archivo donde se busca.' },
    nano: { que: 'nano es un editor de texto que funciona dentro de la terminal.', arg: 'el archivo que se abre.' },
    passwd: { que: 'passwd cambia tu contraseña.' },
    exit: { que: 'exit cierra la terminal.' },
    env: { que: 'env enseña las variables de la terminal.' },
    sudo: { que: 'sudo ejecuta como administrador la orden que va detrás.', tras: true },
    apt: { que: 'apt es el gestor de paquetes de Ubuntu: instala, actualiza y quita programas.',
      args: { update: 'update: descarga la lista de paquetes nuevos. No instala nada.', upgrade: 'upgrade: instala las versiones nuevas.', install: 'install: instala un programa.', remove: 'remove: quita un programa.' } },
    'update-grub': { que: 'update-grub fabrica el menú de GRUB a partir de /etc/default/grub.' }
  };
  const PAPELES = {
    orden: { nombre: 'orden', frase: 'qué hacer' },
    opcion: { nombre: 'opción', frase: 'cómo hacerlo; empieza por guion' },
    argumento: { nombre: 'argumento', frase: 'sobre qué' },
    separador: { nombre: 'separador', frase: 'separa dos órdenes' },
    tuberia: { nombre: 'tubería', frase: 'pasa la salida a la orden siguiente' },
    condicion: { nombre: 'condición', frase: 'la orden siguiente depende de esta' },
    fondo: { nombre: 'segundo plano', frase: 'no espera a que acabe' },
    redireccion: { nombre: 'redirección', frase: 'cambia a dónde va la salida' },
    destino: { nombre: 'destino', frase: 'el archivo de la redirección' },
    asignacion: { nombre: 'variable', frase: 'guarda un valor' },
    otro: { nombre: 'otra cosa', frase: 'esta vista no la explica' }
  };
  V.ORDENES = ORDENES;
  V.PAPELES = PAPELES;

  /* Trocea una línea con el analizador del núcleo (SOM.linux.analiza): cada trozo con su papel y su posición en el
   * texto. Devuelve { trozos: [{ini, fin, texto, papel, …}], error } */
  function analizaOrden(src) {
    const L = SOM.linux;
    src = String(src || '');
    if (!src.trim()) return { trozos: [], error: 'Escribe una línea.' };
    if (!L.analiza) return { trozos: [], error: 'Para analizar una línea hace falta el simulador de Linux en la página.' };
    let arbol;
    try { arbol = L.analiza(src); }
    catch (e) { return { trozos: [], error: mensajeAnalisis(e) }; }
    const trozos = [];
    const simple = (n) => {
      let cmd = null, finOpc = false, zonaOpc = true;
      n.palabras.forEach((w) => {
        const t = { ini: w.ini, fin: w.fin, texto: w.src, partes: w.partes };
        if (!cmd) { t.papel = 'orden'; cmd = w.src; t.orden = cmd; trozos.push(t); return; }
        t.orden = cmd;
        const info = ORDENES[cmd] || {};
        if (info.tras && trozos.length && trozos[trozos.length - 1].orden === cmd && trozos[trozos.length - 1].papel === 'orden' && !/^-/.test(w.src)) {
          // sudo ORDEN …: la palabra que sigue es otra orden
          t.papel = 'orden'; t.trasDe = cmd; cmd = w.src; t.orden = cmd; finOpc = false; zonaOpc = true; trozos.push(t); return;
        }
        const lit = w.partes.length === 1 && w.partes[0].t === 'lit';
        if (cmd === 'echo') {
          if (zonaOpc && lit && /^-[neE]+$/.test(w.src)) { t.papel = 'opcion'; t.tipo = w.src.length > 2 ? 'juntas' : 'corta'; }
          else { zonaOpc = false; t.papel = 'argumento'; }
        } else if (!finOpc && lit && w.src === '--') { t.papel = 'fin-opciones'; finOpc = true; }
        else if (!finOpc && lit && /^--[^-]/.test(w.src)) { t.papel = 'opcion'; t.tipo = 'larga'; }
        else if (!finOpc && lit && /^-[^-]/.test(w.src)) { t.papel = 'opcion'; t.tipo = w.src.length > 2 ? 'juntas' : 'corta'; }
        else t.papel = 'argumento';
        trozos.push(t);
      });
      n.redirs.forEach((r) => { if (r.destino && r.destino.ini !== undefined) trozos.push({ ini: r.destino.ini, fin: r.destino.fin, texto: r.destino.src, papel: 'destino', op: r.op }); });
    };
    const nodo = (n) => {
      if (!n) return;
      if (n.tipo === 'simple') simple(n);
      else if (n.tipo === 'subshell' || n.tipo === 'grupo') lista(n.lista);
    };
    const lista = (l) => l.items.forEach((it) => {
      const yo = it.nodo;
      [yo.primero].concat(yo.resto.map((r) => r.nodo)).forEach((tb) => tb.ordenes.forEach(nodo));
    });
    lista(arbol);
    trozos.sort((a, b) => a.ini - b.ini);
    // lo que no es palabra: ; | && || & > < asignaciones (se reconoce por su texto, entre las palabras)
    const resto = [];
    let p = 0;
    const huecos = trozos.map((t) => [t.ini, t.fin]).concat([[src.length, src.length]]);
    huecos.forEach(([a, b]) => {
      const tramo = src.slice(p, a);
      const re = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
      let m;
      while ((m = re.exec(tramo))) {
        const texto = m[0], ini = p + m.index;
        // un operador pegado a otro (clear;pwd>x) llega junto: se separa por sus símbolos, fuera de las comillas
        partePorSimbolos(texto).forEach(([x, d]) => resto.push(clasificaSimbolo(x, ini + d)));
      }
      p = Math.max(p, b);
    });
    const todos = trozos.concat(resto).sort((a, b) => a.ini - b.ini);
    todos.forEach((t, i) => { t.i = i; });
    return { trozos: todos, error: null };
  }
  // [[texto, desplazamiento], …]: los operadores (; | || && & > >> 2> < …) aparte; lo entrecomillado no se corta
  function partePorSimbolos(s) {
    const OPS = ['&>>', '&>', '>>', '>&', '||', '&&', '|', ';', '&', '>', '<'];
    const out = [];
    let i = 0, ini = 0, q = null;
    const suelta = (fin) => { if (fin > ini) out.push([s.slice(ini, fin), ini]); };
    while (i < s.length) {
      const c = s[i];
      if (q) { if (c === q) q = null; i++; continue; }
      if (c === '"' || c === "'") { q = c; i++; continue; }
      const op = OPS.find((o) => s.startsWith(o, i));
      if (op) {
        // un número pegado delante es el descriptor de la redirección (2>, 2>>, 2>&1)
        let a = i;
        if (op[0] === '>' || op === '>&') { while (a > ini && /\d/.test(s[a - 1])) a--; if (a > ini && !/^\d+$/.test(s.slice(ini, a)) ) a = i; }
        suelta(a);
        let f = i + op.length;
        if (op === '>&') while (f < s.length && /\d/.test(s[f])) f++;
        out.push([s.slice(a, f), a]);
        i = ini = f;
        continue;
      }
      i++;
    }
    suelta(s.length);
    return out;
  }
  function clasificaSimbolo(x, ini) {
    const t = { ini, fin: ini + x.length, texto: x };
    if (x === ';') t.papel = 'separador';
    else if (x === '|') t.papel = 'tuberia';
    else if (x === '&&' || x === '||') t.papel = 'condicion';
    else if (x === '&') t.papel = 'fondo';
    else if (/^(\d*>>|\d*>&\d*|&>>|&>|\d*>|<)$/.test(x)) t.papel = 'redireccion';
    else if (/^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(x)) t.papel = 'asignacion';
    else t.papel = 'otro';
    return t;
  }
  function mensajeAnalisis(e) {
    const L = SOM.linux;
    if (L.Incompleto && e instanceof L.Incompleto) {
      const b = e.busca;
      if (b === "'" || b === '"' || b === '`') return `La línea no está terminada: falta cerrar la comilla ${b}.`;
      if (b === '|' || b === '&&' || b === '||') return `La línea no está terminada: después de ${b} tiene que venir otra orden.`;
      return 'La línea no está terminada: falta algo al final.';
    }
    if (L.ErrorSintaxis && e instanceof L.ErrorSintaxis) return `bash no entiende la línea: hay un error de sintaxis cerca de «${e.token === 'newline' ? 'el final' : e.token}».`;
    return 'bash no entiende esta línea.';
  }
  // explicación de un trozo: { titulo, texto } en HTML
  function explicaTrozo(t, todos) {
    const P = PAPELES[t.papel] || PAPELES.otro;
    const c = `<code>${esc(t.texto)}</code>`;
    const info = ORDENES[t.orden] || {};
    const fr = [];
    if (t.papel === 'orden') {
      fr.push(`${c} es la <b>orden</b>: qué hacer.`);
      if (t.trasDe) fr.push(`Va detrás de <code>${esc(t.trasDe)}</code>, que la ejecuta como administrador.`);
      if (ORDENES[t.texto]) fr.push(esc(ORDENES[t.texto].que));
      else {
        const m = t.texto.match(/^([a-z]+)(-{1,2}\S+)$/);
        if (m && ORDENES[m[1]]) fr.push(`No hay espacio entre <code>${esc(m[1])}</code> y <code>${esc(m[2])}</code>: la terminal lo lee como una sola orden, <code>${esc(t.texto)}</code>, que no existe. Los espacios separan las partes: <code>${esc(m[1] + ' ' + m[2])}</code>.`);
      }
    } else if (t.papel === 'opcion') {
      if (t.tipo === 'larga') {
        const nom = t.texto.slice(2).split('=')[0];
        fr.push(`${c} es una <b>opción larga</b>: dos guiones y una palabra. Dice cómo hacerlo.`);
        const corta = info.largas && info.largas[nom];
        if (corta && info.cortas && info.cortas[corta]) fr.push(`En <code>${esc(t.orden)}</code>: ${esc(info.cortas[corta])}. Es lo mismo que <code>-${esc(corta)}</code>.`);
      } else if (t.tipo === 'juntas') {
        const letras = t.texto.slice(1).split('');
        const lista = letras.map((l) => `<code>-${esc(l)}</code>`).join(', ').replace(/, ([^,]*)$/, ' y $1');
        fr.push(`${c} son varias <b>opciones cortas juntas</b>: ${lista}. Es lo mismo que <code>${esc(letras.map((l) => '-' + l).join(' '))}</code>.`);
        const dichas = [...new Set(letras)].filter((l) => info.cortas && info.cortas[l]);
        if (dichas.length) fr.push(dichas.map((l) => `<code>-${esc(l)}</code>: ${esc(info.cortas[l])}.`).join(' '));
        if (info.largas && info.largas[t.texto.slice(1)]) fr.push(`La opción larga lleva dos guiones: <code>--${esc(t.texto.slice(1))}</code>.`);
      } else {
        fr.push(`${c} es una <b>opción corta</b>: un guion y una letra. Dice cómo hacerlo.`);
        const l = t.texto.slice(1);
        if (info.cortas && info.cortas[l]) fr.push(`En <code>${esc(t.orden)}</code>: ${esc(info.cortas[l])}.`);
      }
    } else if (t.papel === 'argumento') {
      fr.push(`${c} es un <b>argumento</b>: sobre qué.`);
      if (info.args && info.args[t.texto]) fr.push(esc(info.args[t.texto]));
      else if (info.arg) fr.push(`En <code>${esc(t.orden)}</code>, ${esc(info.arg)}`);
      const partes = t.partes || [];
      const hondo = (ps) => ps.some((x) => x.t === 'var' || (x.t === 'dq' && hondo(x.partes || [])));
      if (partes.some((x) => x.t === 'dq' || x.t === 'sq')) fr.push('Las comillas juntan lo que va dentro en un solo argumento, con sus espacios.');
      if (hondo(partes)) fr.push('Lleva una variable, un nombre que guarda un dato: la terminal la cambia por su valor antes de ejecutar la orden.');
    } else if (t.papel === 'separador') {
      fr.push('<code>;</code> <b>separa dos órdenes</b>. Con <code>;</code> se escriben dos órdenes en la misma línea: primero se ejecuta la de la izquierda y después la de la derecha.');
    } else if (t.papel === 'tuberia') {
      fr.push('<code>|</code> es una <b>tubería</b>: lo que sale de la orden de la izquierda entra en la de la derecha.');
    } else if (t.papel === 'condicion') {
      fr.push(t.texto === '&&' ? '<code>&amp;&amp;</code> ejecuta la orden de la derecha solo si la de la izquierda ha salido bien.' : '<code>||</code> ejecuta la orden de la derecha solo si la de la izquierda ha fallado.');
    } else if (t.papel === 'fondo') {
      fr.push('<code>&amp;</code> deja la orden trabajando en segundo plano y devuelve el prompt enseguida.');
    } else if (t.papel === 'redireccion') {
      const x = t.texto;
      fr.push(x === '<' ? `${c} es una <b>redirección</b>: la orden lee lo que necesita de un archivo, no del teclado.`
        : /^2>/.test(x) ? `${c} es una <b>redirección</b>: los mensajes de error van a un archivo en lugar de a la pantalla.`
          : /&>|>&/.test(x) ? `${c} es una <b>redirección</b>: la salida y los errores van al mismo sitio.`
            : />>/.test(x) ? `${c} es una <b>redirección</b>: la salida se añade al final de un archivo en lugar de salir en la pantalla.`
              : `${c} es una <b>redirección</b>: la salida va a un archivo en lugar de a la pantalla. Si el archivo ya existe, se vacía antes.`);
    } else if (t.papel === 'destino' && /&$/.test(t.op || '') && /^\d+$/.test(t.texto)) {
      fr.push(t.texto === '1' ? `${c} es la salida normal de la orden: <code>2&gt;&amp;1</code> manda los errores al mismo sitio que la salida.` : `${c} es el número de un canal de la orden: la redirección lo junta con el de delante.`);
    } else if (t.papel === 'destino') {
      fr.push(`${c} es el <b>archivo</b> de la redirección: ahí va (o de ahí sale) lo que dice el símbolo de delante.`);
    } else if (t.papel === 'asignacion') {
      fr.push(`${c} guarda un valor en una <b>variable</b>: el nombre va antes del <code>=</code> y el valor, detrás, sin espacios.`);
    } else if (t.papel === 'fin-opciones') {
      fr.push('<code>--</code> marca el final de las opciones: lo que va detrás son argumentos, aunque empiece por guion.');
    } else {
      fr.push(`${c}: el analizador de bash lo reconoce, pero esta vista no explica esta parte.`);
    }
    void todos;
    return { titulo: P.nombre, texto: fr.join(' ') };
  }
  V.analizaOrden = analizaOrden;
  V.explicaTrozo = explicaTrozo;
  V.LINEAS_ORDEN = ['ls -l /etc', 'ls --all', 'ls -la /home', 'uname -r', 'echo Hola', 'clear; pwd'];

  /* ============================== 2. Particiones ============================== */
  /* Colores fijos de cada tipo de partición. Los usan también la tabla de la diapositiva 42 y el SVG de la 41:
   * en CSS, var(--part-esp) …, o las clases .part-esp …; en JS, SOM.linuxVis.COLORES_PARTICION. */
  V.COLORES_PARTICION = { esp: '#F4C20D', raiz: '#0B4AB5', swap: '#7C8799', home: '#1E9E62', otra: '#7A4FC9', libre: '#FFFFFF' };
  const TIPOS = {
    esp: { nombre: 'ESP', corto: 'ESP', largo: 'Partición del sistema EFI (ESP)', fs: ['FAT32'], montaje: ['/boot/efi'], tam: 1 },
    raiz: { nombre: 'Raíz', corto: 'Raíz', largo: 'Raíz', fs: ['ext4', 'btrfs', 'xfs'], montaje: ['/'], tam: 25 },
    swap: { nombre: 'Intercambio', corto: 'swap', largo: 'Intercambio (swap)', fs: ['swap'], montaje: ['[SWAP]'], tam: 2 },
    home: { nombre: '/home', corto: '/home', largo: 'Personal (/home)', fs: ['ext4', 'btrfs', 'xfs'], montaje: ['/home'], tam: null },
    otra: { nombre: 'Otra', corto: 'Otra', largo: 'Otra partición', fs: ['ext4', 'FAT32', 'exFAT', 'NTFS', 'sin formato'], montaje: ['ninguno', '/datos', '/srv'], tam: null }
  };
  V.TIPOS_PARTICION = TIPOS;
  /* Tamaños en GB decimales (mil millones de bytes), como los cuenta el instalador de Ubuntu: el disco de 40 GiB
   * de VirtualBox (data-disco="40") sale como 42,95 GB. lsblk cuenta en GiB, así que en su tabla la raíz de 25 GB sale
   * como 23,3G, igual que en la máquina real. */
  const GIB = 1.073741824;                                  // GB que tiene un GiB
  const ESP_GB = 1075 * 1048576 / 1e9;                      // la ESP del instalador: 1075 MiB = 1,13 GB
  const ESP_PEQ_GB = 538 * 1048576 / 1e9;                   // en discos de menos de 23 GiB: 538 MiB = 0,56 GB
  const r2 = (x) => Math.round(x * 100) / 100;
  const r05 = (x) => Math.round(x * 2) / 2;
  const casiCero = (x) => (Math.abs(x) < 0.005 ? 0 : x);
  const sumaTam = (ps) => ps.reduce((a, p) => a + p.tam, 0);
  let idParte = 0;
  const parte = (tipo, tam) => ({ id: ++idParte, tipo, tam, fs: TIPOS[tipo].fs[0], montaje: TIPOS[tipo].montaje[0] });
  // tamaño del archivo de intercambio del instalador según la RAM (curtin, swap.py; tope 8 GB)
  function swapArchivo(ram) {
    let s;
    if (ram < 1) s = 2 * ram; else if (ram < 2) s = 2; else if (ram < 4) s = ram; else if (ram < 16) s = 4; else s = ram / 2;
    return Math.min(8, r05(s));
  }
  // data-disco es el tamaño del disco virtual en VirtualBox (GiB); el reparto se hace en GB, como en el instalador
  function nuevoDisco(disco, ram, firmware) {
    const giB = Math.max(8, +disco || 40);
    return { discoGiB: giB, disco: giB * GIB, ram: +ram || 4, firmware: firmware === 'bios' ? 'bios' : 'uefi', partes: [], plan: 'vacio' };
  }
  // planes de partida: el que hace Ubuntu al borrar el disco, el del módulo y el disco vacío. Con 40 GiB, el del
  // módulo queda como en la máquina real: sda1 1,13 GB, sda2 25 GB, sda3 2 GB y sda4 14,82 GB
  function aplicaPlan(est, plan) {
    const d = est.disco;
    const esp = est.discoGiB >= 23 ? ESP_GB : ESP_PEQ_GB;   // subiquity: 1075 MiB en discos de 23 GiB o más
    if (plan === 'defecto') {
      est.partes = est.firmware === 'uefi' ? [parte('esp', esp), parte('raiz', d - esp)] : [parte('raiz', d)];
    } else if (plan === 'som') {
      const p = [parte('esp', esp), parte('raiz', Math.min(25, d - esp - 2.5)), parte('swap', 2)];
      const resto = casiCero(d - sumaTam(p));
      if (resto >= 0.5) p.push(parte('home', resto));
      est.partes = p;
    } else est.partes = [];
    est.plan = plan;
    return est;
  }
  const libre = (est) => Math.max(0, casiCero(est.disco - sumaTam(est.partes)));
  // cambia el tamaño de una partición (al céntimo de GB) sin pasar del espacio libre ni bajar de 0,5 GB
  function cambiaTam(est, i, nuevo) {
    const p = est.partes[i];
    if (!p || isNaN(+nuevo)) return false;
    const max = p.tam + libre(est);
    let v = Math.max(0.5, r2(+nuevo));
    if (v > max - 0.005) v = max;
    if (Math.abs(v - p.tam) < 0.001) return false;
    p.tam = v; est.plan = 'propio';
    return true;
  }
  // añade una partición del tipo pedido (o del primero que falte) con su tamaño habitual o el libre que quede
  function añadeParte(est, tipo) {
    const l = libre(est);
    if (l < 0.5) return null;
    if (!tipo) tipo = ['esp', 'raiz', 'swap', 'home'].find((t) => !est.partes.some((p) => p.tipo === t)) || 'otra';
    if (tipo === 'esp' && est.firmware === 'bios') tipo = ['raiz', 'swap', 'home'].find((t) => !est.partes.some((p) => p.tipo === t)) || 'otra';
    const habitual = tipo === 'esp' ? ESP_GB : TIPOS[tipo].tam;
    const p = parte(tipo, habitual ? Math.min(habitual, l) : l);
    est.partes.push(p); est.plan = 'propio';
    return p;
  }
  function quitaParte(est, i) { est.partes.splice(i, 1); est.plan = 'propio'; }
  function cambiaTipo(est, i, tipo) {
    const p = est.partes[i];
    if (!p || !TIPOS[tipo]) return;
    p.tipo = tipo; p.fs = TIPOS[tipo].fs[0]; p.montaje = TIPOS[tipo].montaje[0]; est.plan = 'propio';
  }
  const nombreParte = (i) => 'sda' + (i + 1);
  const tieneSwapArchivo = (est) => !est.partes.some((p) => p.tipo === 'swap') && est.partes.some((p) => p.tipo === 'raiz');
  // tamaño en GB como lo cuenta el instalador y tamaño como lo escribe lsblk, en GiB (23,3G, 1G, 538M)
  function tamLsblk(x) { const g = x / GIB; return g < 1 ? Math.round(g * 1024) + 'M' : numES(Math.round(g * 10) / 10) + 'G'; }
  function lsblk(est) {
    const filas = [['sda', '8:0', tamLsblk(est.disco), 'disk', '']];
    est.partes.forEach((p, i) => {
      const mp = p.fs === 'sin formato' || p.montaje === 'ninguno' ? '' : p.montaje;
      filas.push([(i === est.partes.length - 1 ? '└─' : '├─') + nombreParte(i), '8:' + (i + 1), tamLsblk(p.tam), 'part', mp]);
    });
    const anN = Math.max(4, ...filas.map((f) => f[0].length));
    const anS = Math.max(5, ...filas.map((f) => f[2].length));
    const mm = (s) => { const [a, b] = s.split(':'); return a.padStart(3) + ':' + b.padEnd(3); };
    const lin = ['NAME'.padEnd(anN) + ' MAJ:MIN RM ' + 'SIZE'.padStart(anS) + ' RO TYPE MOUNTPOINTS'];
    filas.forEach((f) => lin.push(f[0].padEnd(anN) + ' ' + mm(f[1]) + '  0 ' + f[2].padStart(anS) + '  0 ' + f[3] + ' ' + f[4]));
    return lin.join('\n');
  }
  // hechos de una partición (o del espacio libre con i = -1): lo que es y lo que pasa sin ella
  function hechosParte(est, i) {
    if (i < 0) return ['Espacio sin repartir: ningún sistema lo usa hasta que se crea una partición en él.'];
    const p = est.partes[i];
    const h = [];
    const hay = (t) => est.partes.some((x) => x.tipo === t);
    if (p.tipo === 'esp') {
      h.push('Guarda los cargadores de arranque. La necesita el firmware UEFI.');
      h.push('El instalador la crea sola, de 1,13 GB, en FAT32 y montada en /boot/efi.');
      h.push(est.firmware === 'uefi' ? 'Sin ESP, el firmware UEFI no encuentra ningún cargador.' : 'Con BIOS, el firmware no usa la ESP: lee el cargador del principio del disco.');
    } else if (p.tipo === 'raiz') {
      h.push('El sistema y los programas.');
      h.push('El instalador pide al menos 25 GB para Ubuntu.' + (p.tam < 25 ? ` Esta tiene ${gb(p.tam)}.` : ''));
      if (!hay('home')) h.push('Sin /home aparte, los datos viven dentro de /.');
      if (tieneSwapArchivo(est)) h.push(`Sin partición de intercambio, Ubuntu usa un archivo dentro de /: /swap.img, de ${gb(swapArchivo(est.ram))}.`);
    } else if (p.tipo === 'swap') {
      h.push('Hace de memoria cuando la RAM se llena.');
      h.push(`Para hibernar hace falta tanta swap como RAM: con ${gb(est.ram)} de RAM, ${gb(est.ram)}.`);
      h.push('Sin partición de intercambio, Ubuntu usa un archivo, /swap.img.');
    } else if (p.tipo === 'home') {
      h.push('Los archivos y la configuración de cada usuario.');
      h.push('Con /home aparte, reinstalar el sistema no borra los archivos de los usuarios.');
      h.push('Sin /home aparte, los datos viven dentro de /.');
    } else {
      h.push('Una partición más, para datos o para otro sistema.');
      const F = { FAT32: 'FAT32 la leen Windows, macOS y Linux, pero no admite archivos de 4 GiB o más.', exFAT: 'exFAT la leen Windows, macOS y Linux, y admite archivos grandes.', NTFS: 'NTFS es el sistema de archivos de Windows.', ext4: 'ext4 es el sistema de archivos de Linux.', 'sin formato': 'Sin formato no se puede guardar nada en ella hasta formatearla.' };
      if (F[p.fs]) h.push(F[p.fs]);
      h.push(p.montaje === 'ninguno' || p.fs === 'sin formato' ? 'Sin punto de montaje, Linux no la enseña en ninguna carpeta.' : `Se ve dentro de la carpeta ${p.montaje}, su punto de montaje.`);
    }
    return h;
  }
  // hechos del reparto entero, en el orden en que se suelen mirar
  function hechosReparto(est) {
    const h = [];
    const de = (t) => est.partes.filter((p) => p.tipo === t);
    if (est.firmware === 'uefi' && !de('esp').length) h.push({ k: 'sin-esp', t: 'Sin ESP, el firmware UEFI no encuentra ningún cargador.' });
    const raiz = de('raiz');
    if (!raiz.length) h.push({ k: 'sin-raiz', t: 'Sin raíz (/), no hay dónde instalar el sistema.' });
    else if (raiz[0].tam < 25) h.push({ k: 'raiz-pequena', t: `La raíz tiene ${gb(raiz[0].tam)}. El instalador pide al menos 25 GB para Ubuntu.` });
    if (raiz.length && !de('swap').length) h.push({ k: 'swap-archivo', t: `Sin partición de intercambio, Ubuntu usa un archivo, /swap.img, de ${gb(swapArchivo(est.ram))}.` });
    if (raiz.length) h.push(de('home').length ? { k: 'home', t: 'Con /home aparte, reinstalar el sistema no borra los archivos de los usuarios.' } : { k: 'sin-home', t: 'Sin /home aparte, los datos viven dentro de /.' });
    const usos = {};
    est.partes.forEach((p) => { if (p.montaje !== 'ninguno' && p.montaje !== '[SWAP]' && p.fs !== 'sin formato') usos[p.montaje] = (usos[p.montaje] || 0) + 1; });
    Object.keys(usos).filter((m) => usos[m] > 1).forEach((m) => h.push({ k: 'repetido', t: `Hay ${usos[m]} particiones montadas en ${m}. En cada carpeta solo se monta una.` }));
    const l = libre(est);
    if (l >= 0.5) h.push({ k: 'libre', t: `Quedan ${gb(l)} sin repartir.` });
    return h;
  }
  // la diferencia entre el GB del instalador y el GiB de lsblk, con la primera partición del reparto que se vea bien
  // (la raíz si la hay): «los 25 GB de la raíz salen como 23,3G»
  function notaLsblk(est) {
    const base = 'El instalador cuenta en GB y lsblk, en GiB, que son algo más grandes';
    const p = est.partes.find((x) => x.tipo === 'raiz') || est.partes.find((x) => x.tam >= 2);
    if (!p) return base + '.';
    const nombre = { esp: 'la ESP', raiz: 'la raíz', swap: 'el intercambio', home: '/home', otra: nombreParte(est.partes.indexOf(p)) }[p.tipo];
    return `${base}: los ${gb(p.tam)} de ${nombre} salen como ${tamLsblk(p.tam)}.`;
  }
  V.particiones = { notaLsblk, GIB, ESP_GB, nuevoDisco, aplicaPlan, libre, cambiaTam, añadeParte, quitaParte, cambiaTipo, lsblk, hechosParte, hechosReparto, swapArchivo, tamLsblk, tieneSwapArchivo, nombreParte };

  /* ============================== 3. Arranque ============================== */
  const CADENA = [
    { id: 'uefi', nombre: 'UEFI', frase: 'El firmware comprueba el hardware y busca un cargador en la ESP.', ms: 2000 },
    { id: 'grub', nombre: 'GRUB', frase: 'Enseña el menú y carga el núcleo elegido.', ms: 1500 },
    { id: 'nucleo', nombre: 'Núcleo e initrd', frase: 'Arranca el núcleo. El initrd es un sistema de archivos pequeño con lo necesario para encontrar el disco.', ms: 2400 },
    { id: 'systemd', nombre: 'systemd', frase: 'El primer programa del sistema. Arranca todos los demás.', ms: 2200 },
    { id: 'gdm3', nombre: 'gdm3', frase: 'La pantalla de inicio de sesión.', ms: 0 },
    { id: 'escritorio', nombre: 'Tu escritorio', frase: 'Tu sesión, con tus programas.', ms: 0 }
  ];
  V.CADENA_ARRANQUE = CADENA;
  /* Textos de la pantalla de GRUB 2.12 en español, copiados línea a línea de la captura del menú de Ubuntu-SOM
   * (ut04/img/captura-15-grub-ubuntu-som.webp y la 18, con la cuenta atrás). Los títulos de las entradas no se
   * traducen: salen del grub.cfg, en inglés, como en la máquina real. */
  const GRUB_TXT = {
    cabecera: 'GNU GRUB  versión 2.12',
    ayuda: ['Use las teclas ↑ y ↓ para seleccionar la entrada marcada.', 'Pulse «Intro» para arrancar el SO seleccionado, «e» para editar las órdenes antes de arrancar o «c» para una línea de órdenes. «ESC» para volver al menú anterior.'],
    cuenta: (n) => `La entrada marcada se ejecutará automáticamente en ${n} s.`
  };
  V.GRUB_TXT = GRUB_TXT;

  /* grub.cfg como lo fabrica update-grub en Ubuntu 24.04 a partir de /etc/default/grub (resumido: las partes que
   * cambian con GRUB_TIMEOUT_STYLE, GRUB_TIMEOUT, GRUB_DEFAULT y GRUB_CMDLINE_LINUX_DEFAULT). Se usa cuando el
   * sistema simulado no tiene grub.cfg. */
  function grubCfgUbuntu(o) {
    o = Object.assign({ estilo: 'hidden', espera: 0, porDefecto: '0', cmdline: 'quiet splash', nucleo: '7.0.0-43-generic', uuid: '4f1c2b7e-8d3a-4c55-9b61-2e7a0c9d5f13' }, o || {});
    const cab = o.estilo === 'hidden' || o.estilo === 'countdown'
      ? `    set timeout_style=${o.estilo}\n    set timeout=${o.espera}\n  # Fallback hidden-timeout code in case the timeout_style feature is\n  # unavailable.\n  elif sleep --interruptible ${o.espera} ; then\n    set timeout=0\n  fi`
      : `    set timeout_style=menu\n    set timeout=${o.espera}\n  # Fallback normal timeout code in case the timeout_style feature is\n  # unavailable.\n  else\n    set timeout=${o.espera}\n  fi`;
    const linea = (extra) => `\tlinux\t/boot/vmlinuz-${o.nucleo} root=UUID=${o.uuid} ro ${extra} $vt_handoff`.replace(/ +/g, ' ').replace(' $vt', ' $vt');
    return `#
# DO NOT EDIT THIS FILE
#
# It is automatically generated by grub-mkconfig using templates
# from /etc/grub.d and settings from /etc/default/grub
#

### BEGIN /etc/grub.d/00_header ###
if [ -s $prefix/grubenv ]; then
  set have_grubenv=true
  load_env
fi
if [ "\${next_entry}" ] ; then
   set default="\${next_entry}"
   set next_entry=
   save_env next_entry
   set boot_once=true
else
   set default="${o.porDefecto}"
fi
set locale_dir=$prefix/locale
set lang=es_ES
insmod gettext
terminal_output gfxterm
if [ "\${recordfail}" = 1 ] ; then
  set timeout=30
else
  if [ x$feature_timeout_style = xy ] ; then
${cab}
fi
### END /etc/grub.d/00_header ###

### BEGIN /etc/grub.d/10_linux ###
menuentry 'Ubuntu' --class ubuntu --class gnu-linux --class gnu --class os $menuentry_id_option 'gnulinux-simple-${o.uuid}' {
\trecordfail
\tload_video
\tinsmod gzio
\tinsmod part_gpt
\tinsmod ext2
\tsearch --no-floppy --fs-uuid --set=root ${o.uuid}
${linea(o.cmdline)}
\tinitrd\t/boot/initrd.img-${o.nucleo}
}
submenu 'Advanced options for Ubuntu' $menuentry_id_option 'gnulinux-advanced-${o.uuid}' {
\tmenuentry 'Ubuntu, with Linux ${o.nucleo}' --class ubuntu --class gnu-linux --class gnu --class os $menuentry_id_option 'gnulinux-${o.nucleo}-advanced-${o.uuid}' {
\t\trecordfail
\t\tload_video
${'\t' + linea(o.cmdline)}
\t\tinitrd\t/boot/initrd.img-${o.nucleo}
\t}
\tmenuentry 'Ubuntu, with Linux ${o.nucleo} (recovery mode)' --class ubuntu --class gnu-linux --class gnu --class os $menuentry_id_option 'gnulinux-${o.nucleo}-recovery-${o.uuid}' {
\t\trecordfail
\t\tload_video
\t\tlinux\t/boot/vmlinuz-${o.nucleo} root=UUID=${o.uuid} ro recovery nomodeset dis_ucode_ldr
\t\tinitrd\t/boot/initrd.img-${o.nucleo}
\t}
}
### END /etc/grub.d/10_linux ###

### BEGIN /etc/grub.d/20_memtest86+ ###
menuentry "Memory test (memtest86+x64.efi)" --class memtest $menuentry_id_option 'memtest86+' {
\tinsmod part_gpt
\tinsmod ext2
\tsearch --no-floppy --fs-uuid --set=root ${o.uuid}
\tlinux\t/boot/memtest86+x64.efi
}
menuentry 'Memory test (memtest86+x64.efi, serial console)' --class memtest $menuentry_id_option 'memtest86+-serial' {
\tinsmod part_gpt
\tinsmod ext2
\tsearch --no-floppy --fs-uuid --set=root ${o.uuid}
\tlinux\t/boot/memtest86+x64.efi console=ttyS0,115200
}
### END /etc/grub.d/20_memtest86+ ###

### BEGIN /etc/grub.d/30_uefi-firmware ###
if [ "$grub_platform" = "efi" ]; then
\tfwsetup --is-supported
\tif [ "$?" = 0 ]; then
\t\tmenuentry 'UEFI Firmware Settings' $menuentry_id_option 'uefi-firmware' {
\t\t\tfwsetup
\t\t}
\tfi
fi
### END /etc/grub.d/30_uefi-firmware ###
`;
  }
  V.grubCfgUbuntu = grubCfgUbuntu;

  /* Lee un grub.cfg: estilo del menú (hidden, menu, countdown), segundos de espera, entrada por defecto, entradas de
   * primer nivel (con las del submenú dentro) y si la entrada por defecto lleva quiet y splash.
   * Sigue los if/elif/else/fi del archivo como los evaluaría GRUB en un arranque normal: la rama de recordfail (30 s
   * después de un arranque fallido) no cuenta, las comprobaciones de feature_… son ciertas en GRUB 2.12 y las de
   * $grub_platform se comparan con la plataforma ('efi' con firmware UEFI, 'pc' con BIOS), de modo que solo se
   * cuentan las entradas que ese equipo enseñaría. Lo que no se puede saber (variables del entorno) se da por bueno. */
  function evaluaSi(cond, plataforma, r) {
    let m;
    // [ "${timeout}" = 0 ]: con el valor que lleva puesto hasta esa línea
    if (r && (m = cond.match(/\$\{?timeout\}?"?\s*(!=|=)\s*"?(-?\d+)"?/))) return ((r.espera === null ? 5 : r.espera) === +m[2]) !== (m[1] === '!=');
    if (/\$\{?recordfail\}?"?\s*=\s*"?1/.test(cond)) return false;
    if (/\$\{?recordfail\}?"?\s*!=\s*"?1/.test(cond)) return true;
    if (/x\$\{?feature_\w+\}?\s*=\s*xy/.test(cond)) return true;
    if ((m = cond.match(/(x?)"?\$\{?grub_platform\}?"?\s*(!=|=)\s*"?(\w+)"?/))) {
      const v = m[1] ? m[3].replace(/^x/, '') : m[3];
      return (v === plataforma) !== (m[2] === '!=');
    }
    return null;
  }
  function leeGrubCfg(texto, plataforma) {
    plataforma = plataforma || 'efi';
    const r = { estilo: null, espera: null, porDefecto: '0', entradas: [], vacio: !String(texto || '').trim(), plataforma };
    const lineas = String(texto || '').split('\n');
    const pila = [];         // menuentry y submenu abiertos
    const ramas = [];        // if abiertos: { cond: true | false | null, tomada }
    const activo = () => ramas.every((x) => x.cond !== false);
    lineas.forEach((bruta) => {
      const l = bruta.trim();
      if (!l || l[0] === '#') return;
      let m;
      // entradas y órdenes de la línea, solo si la rama en la que están vale
      if (activo()) {
        if (!pila.length) {
          if ((m = l.match(/^set timeout_style=["']?(\w+)/))) r.estilo = m[1];
          if ((m = l.match(/^set timeout=["']?(-?\d+)/))) r.espera = +m[1];
          if ((m = l.match(/^set default=["']?([^"'\s]*)/)) && m[1] && m[1][0] !== '$') r.porDefecto = m[1];
        }
        if ((m = l.match(/^(menuentry|submenu)\s+(['"])(.*?)\2(.*)$/))) {
          const e = { titulo: m[3], tipo: m[1], hijos: [], linux: null, id: ((m[4].match(/\$menuentry_id_option\s+'([^']+)'/) || [])[1]) || null };
          if (pila.length) pila[pila.length - 1].hijos.push(e); else r.entradas.push(e);
          if (/\{\s*$/.test(l)) pila.push(Object.assign(e, { _ramas: ramas.length }));
          return;
        }
        if ((m = l.match(/^linux\s+(\S+)\s*(.*)$/)) && pila.length) { pila[pila.length - 1].linux = m[2]; return; }
      }
      if (l === '}' && pila.length && pila[pila.length - 1]._ramas === ramas.length) { delete pila.pop()._ramas; return; }
      // if, elif, else y fi (también varios en una línea: «if …; then if …; then», «fi; fi»)
      l.split(';').map((x) => x.trim()).forEach((x) => {
        if (/^if\b/.test(x)) { const c = evaluaSi(x, plataforma, r); ramas.push({ cond: c, tomada: c === true }); }
        else if (/^elif\b/.test(x) && ramas.length) { const f = ramas[ramas.length - 1]; if (f.tomada) f.cond = false; else { f.cond = evaluaSi(x, plataforma, r); f.tomada = f.cond === true; } }
        else if (/^else\b/.test(x) && ramas.length) { const f = ramas[ramas.length - 1]; f.cond = f.tomada ? false : true; f.tomada = true; }
        else if (/^fi\b/.test(x) && ramas.length) ramas.pop();
      });
    });
    if (r.estilo === null) r.estilo = 'menu';
    if (r.espera === null) r.espera = 5;     // valor de GRUB si grub.cfg no dice nada
    // entrada por defecto: número entre las de primer nivel, o su id o su título
    let i = /^\d+$/.test(r.porDefecto) ? +r.porDefecto : r.entradas.findIndex((e) => e.id === r.porDefecto || e.titulo === r.porDefecto);
    if (i < 0 || i >= r.entradas.length) i = 0;
    r.indice = i;
    let e = r.entradas[i];
    while (e && e.tipo === 'submenu' && e.hijos.length) e = e.hijos[0];
    const args = e && e.linux ? e.linux.split(/\s+/) : [];
    r.quiet = args.includes('quiet');
    r.splash = args.includes('splash');
    r.cmdline = e ? e.linux : null;
    return r;
  }
  V.leeGrubCfg = leeGrubCfg;
  // lo que se ve al encender con esa configuración, en frases (para la vista y las pruebas)
  function describeArranque(g) {
    const visible = g.estilo === 'menu' && g.espera !== 0;
    const menu = g.estilo === 'menu' ? (g.espera === 0 ? 'no llega a verse: con 0 segundos arranca enseguida' : 'se ve al encender')
      : g.estilo === 'countdown' ? 'oculto: en su lugar sale una cuenta atrás' : 'oculto: sale si pulsas Esc al encender';
    const espera = g.espera < 0 ? 'hasta que elijas una entrada' : g.espera === 0 ? 'no espera' : `${g.espera} ${g.espera === 1 ? 'segundo' : 'segundos'}`;
    const ent = g.entradas[g.indice];
    const pantalla = g.splash ? (g.quiet ? 'con logotipo y sin mensajes' : 'con logotipo') : (g.quiet ? 'sin logotipo y casi sin mensajes' : 'con los mensajes del arranque');
    return { visible, menu, espera, arranca: ent ? ent.titulo : '—', pantalla };
  }
  V.describeArranque = describeArranque;
  // las entradas de primer nivel tal como están en grub.cfg: como mucho tres y «y N más»
  function resumeEntradas(entradas, max) {
    max = max || 3;
    const t = (entradas || []).map((e) => e.titulo);
    return t.length <= max ? t : t.slice(0, max).concat([`y ${t.length - max} más`]);
  }
  V.resumeEntradas = resumeEntradas;
  // instante de modificación con más precisión que stat (los nanosegundos del inodo, si se pueden leer)
  function marcaTiempo(sis, ruta) {
    const s = sis.stat(ruta);
    if (!s) return null;
    let ns = 0;
    try { ns = sis.fs.resuelve(ruta, { uid: 0, gid: 0 }).ino.mns || 0; } catch (e) { ns = 0; }
    return s.mtime * 1e6 + (ns % 1e6);
  }
  // estado del arranque de un sistema simulado: grub.cfg leído y si /etc/default/grub es más reciente
  const plataformaDe = (firmware) => (firmware === 'bios' ? 'pc' : 'efi');
  V.plataformaDe = plataformaDe;
  function estadoArranque(sis, plataforma) {
    const cfg = sis.leeArchivo('/boot/grub/grub.cfg');
    const falta = cfg === null || !String(cfg).trim();
    const g = leeGrubCfg(falta ? grubCfgUbuntu() : cfg, plataforma || 'efi');
    g.porDefectoUbuntu = falta;
    const tD = marcaTiempo(sis, '/etc/default/grub'), tC = marcaTiempo(sis, '/boot/grub/grub.cfg');
    g.desfasado = tD !== null && (tC === null || tD > tC);
    return g;
  }
  V.estadoArranque = estadoArranque;

  /* ============================== 4. Anatomía de una línea ============================== */
  /* Formatos de línea. Cada uno: campos (clave, rótulo y explicación) y trocea(linea) -> lista de
   * {clave, texto} (los espacios entre campos van como {texto} sin clave). Fase 1: ls -l. */
  const LS_TIPOS = { '-': 'es un archivo normal', d: 'es un directorio (una carpeta)', l: 'es un enlace simbólico: un nombre que apunta a otro archivo', c: 'es un dispositivo de caracteres', b: 'es un dispositivo de bloques, como un disco', p: 'es una tubería con nombre', s: 'es un socket' };
  V.formatos = {
    'ls-l': {
      titulo: 'Una línea de ls -l',
      campos: [
        { clave: 'tipo', rotulo: 'tipo', explica: (v) => `el tipo: - es un archivo; d, un directorio. Aquí, ${v}: ${LS_TIPOS[v] || 'otro tipo de archivo'}.` },
        { clave: 'permisos', rotulo: 'permisos', explica: (v, c) => 'los permisos: quién puede leer (r), escribir (w) y ejecutar (x).' + (c.tipo === 'l' ? ' En un enlace simbólico salen todos: cuentan los del archivo al que apunta.' : /x/.test(v) && c.tipo === '-' ? ' Lleva x: se puede ejecutar. En la terminal, ls lo pinta en verde.' : '') },
        { clave: 'enlaces', rotulo: 'enlaces', explica: (v, c) => 'los enlaces: cuántos nombres tiene el archivo.' + (c.tipo === 'd' ? ' En un directorio cuentan también el punto (.) de dentro y el .. de cada subcarpeta.' : '') },
        { clave: 'dueno', rotulo: 'propietario', explica: (v) => `el propietario: el usuario dueño del archivo, ${v}.` },
        { clave: 'grupo', rotulo: 'grupo', explica: (v) => `el grupo del archivo, ${v}.` },
        { clave: 'tamano', rotulo: 'tamaño', explica: (v, c) => 'el tamaño en bytes.' + (c.tipo === 'd' ? ` Un directorio ocupa ${v}: lo que mide su lista de nombres, no lo que hay dentro.` : c.tipo === 'l' ? ` En un enlace, el tamaño es el número de letras del destino: ${c.destino || ''} tiene ${v}.` : v === '0' ? ' 0: el archivo está vacío.' : '') },
        { clave: 'fecha', rotulo: 'fecha', explica: (v) => 'la fecha de la última modificación.' + (/\d{4}$/.test(v) ? ' Si el archivo tiene más de seis meses, sale el año en lugar de la hora.' : '') },
        { clave: 'nombre', rotulo: 'nombre', explica: (v, c) => c.tipo === 'l' ? `el nombre del enlace y, detrás de la flecha, a dónde apunta: ${c.destino}.` : (/^\./.test(v.split('/').pop()) ? 'el nombre. El punto lo hace oculto.' : c.tipo === 'd' ? 'el nombre de la carpeta.' : v.includes('/') ? 'el nombre, con el camino de carpetas que se pidió a ls.' : 'el nombre del archivo.') }
      ],
      // -rw-r--r-- 1 alumno alumno 807 nov 21 10:02 .profile
      trocea(linea) {
        const m = String(linea).match(/^([-dlcbps])([rwxsStT-]{9}[.+@]?)(\s+)(\d+)(\s+)(\S+)(\s+)(\S+)(\s+)(\d+(?:,\s*\d+)?)(\s+)(\S+\s+\d+\s+(?:\d{1,2}:\d{2}|\d{4}))(\s)(.+)$/);
        if (!m) return null;
        const t = [{ clave: 'tipo', texto: m[1] }, { clave: 'permisos', texto: m[2] }, { texto: m[3] }, { clave: 'enlaces', texto: m[4] }, { texto: m[5] },
          { clave: 'dueno', texto: m[6] }, { texto: m[7] }, { clave: 'grupo', texto: m[8] }, { texto: m[9] }, { clave: 'tamano', texto: m[10] }, { texto: m[11] },
          { clave: 'fecha', texto: m[12] }, { texto: m[13] }, { clave: 'nombre', texto: m[14] }];
        const ctx = { tipo: m[1], destino: (m[14].split(' -> ')[1]) || '' };
        return { trozos: t, ctx };
      },
      lineas: [
        { nombre: 'Archivo oculto', orden: 'ls -la', linea: '-rw-r--r-- 1 alumno alumno 807 nov 21 10:02 .profile' },
        { nombre: 'Archivo', orden: 'ls -l notas.txt', linea: '-rw-rw-r-- 1 alumno alumno 0 nov 21 10:05 notas.txt' },
        { nombre: 'Directorio', orden: 'ls -l', linea: 'drwxr-xr-x 2 alumno alumno 4096 nov 17 18:48 Documentos' },
        { nombre: 'Enlace', orden: 'ls -l /bin', linea: 'lrwxrwxrwx 1 root root 7 abr 22  2024 /bin -> usr/bin' },
        { nombre: 'Ejecutable', orden: 'ls -l /usr/bin/uname', linea: '-rwxr-xr-x 1 root root 35336 ago 25 17:09 /usr/bin/uname' }
      ]
    }
  };

  /* ============================== 5. Generadores de rejilla ============================== */
  const MESES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DIAS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dos = (n) => String(n).padStart(2, '0');
  // fecha de compilación al azar entre dos (año, mes), como la escribe el núcleo: Sat Oct 31 06:52:47 UTC 2026
  function fechaCompila(a0, m0, a1, m1) {
    const t0 = Date.UTC(a0, m0 - 1, 1), t1 = Date.UTC(a1, m1 - 1, 28);
    const d = new Date(t0 + Math.floor(Math.random() * (t1 - t0)));
    return `${DIAS_EN[d.getUTCDay()]} ${MESES_EN[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${dos(rnd(0, 23))}:${dos(rnd(0, 59))}:${dos(rnd(0, 59))} UTC ${d.getUTCFullYear()}`;
  }
  /* Núcleos de Ubuntu 24.04: el 6.8 con el que salió (generic, lowlatency y oem, con su numeración 10xx) y los HWE
   * de las versiones puntuales, 6.17 y 7.0 (generic). */
  const SERIES = [
    { serie: '6.8', v: [6, 8, 0], variantes: ['generic', 'lowlatency', 'oem'], rev: [31, 90], revOem: [1020, 1090], hwe: false, fecha: [2024, 4, 2026, 10] },
    { serie: '6.17', v: [6, 17, 0], variantes: ['generic'], rev: [14, 40], hwe: true, fecha: [2026, 2, 2026, 10] },
    { serie: '7.0', v: [7, 0, 0], variantes: ['generic'], rev: [25, 45], hwe: true, fecha: [2026, 8, 2026, 11] }
  ];
  const VARIANTE_TXT = {
    generic: 'generic es la variante para ordenadores normales.',
    lowlatency: 'lowlatency es la variante de baja latencia: responde antes, para grabar y tocar audio en directo.',
    oem: 'oem es la variante para los ordenadores que traen Ubuntu instalado de fábrica.'
  };
  function generaNucleo() {
    const s = elige(SERIES);
    const vari = elige(s.variantes);
    const rev = vari === 'oem' ? rnd(s.revOem[0], s.revOem[1]) : rnd(s.rev[0], s.rev[1]);
    const release = `${s.v.join('.')}-${rev}-${vari}`;
    const build = vari === 'oem' ? `#${rev - 1000}-Ubuntu` : vari === 'lowlatency' ? `#${rev}.1-Ubuntu` : s.hwe ? `#${rev}~24.04.1-Ubuntu` : `#${rev}-Ubuntu`;
    const gcc = s.hwe ? 'x86_64-linux-gnu-gcc-13 (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0' : 'x86_64-linux-gnu-gcc-13 (Ubuntu 13.3.0-6ubuntu2~24.04) 13.3.0';
    // la versión del núcleo (#… SMP PREEMPT_DYNAMIC y la fecha) se guarda en 64 caracteres como mucho: en los HWE se
    // corta el año, como en la máquina real («… UTC 2»). Solo cambia el texto, no los sorteos
    const maquina = `(buildd@lcy02-amd64-0${rnd(10, 99)})`;
    const uts = `${build} SMP PREEMPT_DYNAMIC ${fechaCompila(...s.fecha)}`.slice(0, 64);
    const proc = `Linux version ${release} ${maquina} (${gcc}, GNU ld (GNU Binutils for Ubuntu) 2.42) ${uts}`;
    return { serie: s.serie, v: s.v, rev, vari, release, proc };
  }
  V.generaNucleo = generaNucleo;

  const GEN = {};
  /* ---------- UT4 · cómo se lee la versión del núcleo ---------- */
  GEN['version-nucleo'] = {
    titulo: 'Lee la versión del núcleo',
    rejilla: true,
    modos: [{ t: 'uname -r', v: 'uname' }, { t: 'cat /proc/version', v: 'proc' }, { t: 'Al azar', v: null }],
    generar(cfg) {
      const fuente = cfg.modo || (rnd(0, 1) ? 'uname' : 'proc');
      const k = generaNucleo();
      const [a, b, c] = k.v;
      const salida = fuente === 'uname' ? k.release : k.proc;
      const orden = fuente === 'uname' ? 'uname -r' : 'cat /proc/version';
      const dondeProc = fuente === 'proc' ? ` En /proc/version, la versión va detrás de «Linux version».` : '';
      const num = (v, n, expl) => ({ c: String(v), clase: 'num', max: 4, filtro: /[^0-9]/g, n, expl });
      return {
        ...variante(k.serie + '-' + (k.vari === 'generic' ? fuente : k.vari), cfg.modo ? 5 : 8),
        enunciado: 'Lee lo que enseña la terminal y escribe cada parte de la versión del núcleo en su casilla.',
        tarea: `⟪Escribe⟫ las cinco partes de la versión del núcleo que enseña ⟦${orden}⟧: versión principal, secundaria, corrección, revisión de Ubuntu y variante.`,
        // las casillas en una fila, como se escribe la versión: principal.secundaria.corrección-revisión-variante
        columnas: '104px 88px 22px 88px 22px 88px 22px 104px 22px 176px', clase: 'texto lvis-version',
        filas: [
          [{ lbl: 'terminal' }, { d: '$ ' + orden + '\n' + salida, clase: 'texto lvis-salida' + (fuente === 'proc' ? ' larga' : ''), span: 9 }],
          { linea: true, clase: 'suave', desde: 1 },
          [{ lbl: 'versión' }, num(a, 0, `${a} es la versión principal: la primera cifra.${dondeProc}`), { d: '.', clase: 'op' },
            num(b, 1, `${b} es la versión secundaria: la cifra que va entre los dos puntos.`), { d: '.', clase: 'op' },
            num(c, 2, `${c} es la corrección: la tercera cifra, antes del guion.`), { d: '-', clase: 'op' },
            num(k.rev, 3, `${k.rev} es la revisión de Ubuntu: va detrás del guion. Ubuntu toma la versión de kernel.org y le pone su número.`), { d: '-', clase: 'op' },
            { sel: ['?', 'generic', 'lowlatency', 'oem'], c: k.vari, clase: 'txt', n: 4, expl: `${VARIANTE_TXT[k.vari]} Es la última parte, detrás del segundo guion.` }],
          [{ lbl: '' }, { d: 'principal', clase: 'peq lvis-pie' }, { d: '' }, { d: 'secundaria', clase: 'peq lvis-pie' }, { d: '' }, { d: 'corrección', clase: 'peq lvis-pie' }, { d: '' },
            { d: 'revisión de Ubuntu', clase: 'peq lvis-pie' }, { d: '' }, { d: 'variante', clase: 'peq lvis-pie' }]
        ],
        resumen: `Versión principal ${a}, secundaria ${b}, corrección ${c} y revisión de Ubuntu ${k.rev}. ${VARIANTE_TXT[k.vari]}`,
        correcto: `Correcto: ${k.release} es la versión ${a}, secundaria ${b}, corrección ${c}, revisión de Ubuntu ${k.rev} y variante ${k.vari}. ${VARIANTE_TXT[k.vari]}`
      };
    }
  };

  /* ---------- UT4 · ¿qué distribución? ----------
     Una sola tabla de datos, la de las diapositivas 32 a 34 (una línea por distribución): familia, formato de paquete,
     quién la mantiene y para qué se usa. De ella salen todas las preguntas y todos los casos del ejercicio.
     casos: situaciones que se resuelven solo con su «para qué se usa», sin copiar la frase ni nombrar la distribución.
     En un caso valen ella y las que la tabla da por iguales (iguales), y nunca salen como opción las que se parecen
     demasiado (parecidas, en las dos direcciones). Sin casos, la distribución no se pregunta en ese modo (su uso lo
     comparte otra). quien: lo que vale en la casilla «quién la mantiene» (una empresa o la comunidad). */
  const DISTROS = [
    { n: 'Debian', fam: 'Debian', paq: '.deb con apt', mantiene: 'la comunidad (voluntarios)', quien: ['la comunidad'],
      uso: 'Servidores y equipos que necesitan un sistema muy estable.', parecidas: ['Ubuntu', 'Ubuntu Server', 'Red Hat Enterprise Linux', 'CentOS Stream'],
      casos: ['El ayuntamiento quiere un ordenador que guarde los archivos de todos los departamentos. Lo que más le importa es que no falle y que funcione igual durante años.'] },
    { n: 'Ubuntu', fam: 'Debian', paq: '.deb con apt', mantiene: 'Canonical, una empresa', quien: ['una empresa'],
      uso: 'Ordenadores de casa, de aula y de oficina; tiene versiones con cinco años de soporte.', parecidas: ['Debian', 'Ubuntu Server', 'Kubuntu', 'Xubuntu', 'Lubuntu', 'Linux Mint'],
      casos: ['Un instituto prepara su aula de informática, con ordenadores de 8 GB de memoria. Quiere el mismo sistema durante varios cursos y que reciba actualizaciones todo ese tiempo.',
        'Una gestoría va a cambiar los ordenadores de su oficina. Busca un sistema para el trabajo de cada día que tenga actualizaciones durante varios años.'] },
    { n: 'Ubuntu Server', fam: 'Debian', paq: '.deb con apt', mantiene: 'Canonical, una empresa', quien: ['una empresa'],
      uso: 'Servidores: es Ubuntu sin escritorio.', parecidas: ['Debian', 'Ubuntu', 'Red Hat Enterprise Linux', 'CentOS Stream'],
      casos: ['Un instituto quiere un servidor para guardar los trabajos del alumnado. Se va a manejar solo desde la terminal, así que no necesita escritorio.'] },
    { n: 'Kubuntu', fam: 'Debian', paq: '.deb con apt', mantiene: 'la comunidad', quien: ['la comunidad'],
      uso: 'Ubuntu con el escritorio KDE Plasma.', parecidas: ['Ubuntu', 'Linux Mint'],
      casos: ['Marta está acostumbrada al escritorio KDE Plasma y quiere seguir con él, pero en un sistema de la familia de Ubuntu.'] },
    { n: 'Xubuntu', fam: 'Debian', paq: '.deb con apt', mantiene: 'la comunidad', quien: ['la comunidad'],
      uso: 'Ordenadores con poca memoria: Ubuntu con el escritorio ligero Xfce.', iguales: ['Lubuntu'], parecidas: ['Ubuntu', 'Linux Mint'],
      casos: ['Un portátil antiguo, con muy poca memoria, va lentísimo con el escritorio normal de Ubuntu. Su dueño quiere seguir usándolo para navegar y escribir.'] },
    { n: 'Lubuntu', fam: 'Debian', paq: '.deb con apt', mantiene: 'la comunidad', quien: ['la comunidad'],
      uso: 'Ordenadores con poca memoria: Ubuntu con el escritorio ligero LXQt.', iguales: ['Xubuntu'], parecidas: ['Ubuntu', 'Linux Mint'],
      casos: ['La asociación de vecinos tiene ordenadores viejos que andan justos de memoria. Quiere darles otra vida con un sistema de la familia de Ubuntu que gaste poco.'] },
    { n: 'Linux Mint', fam: 'Debian', paq: '.deb con apt', mantiene: 'la comunidad', quien: ['la comunidad'],
      uso: 'Ordenadores de casa; sale de Ubuntu.', parecidas: ['Ubuntu', 'Kubuntu', 'Xubuntu', 'Lubuntu'] },
    { n: 'Kali', fam: 'Debian', paq: '.deb con apt', mantiene: 'OffSec, una empresa', quien: ['una empresa'],
      uso: 'Auditorías de seguridad, normalmente en una máquina virtual.',
      casos: ['Una empresa contrata a una experta para buscar los fallos de seguridad de su red. Ella quiere un sistema preparado para ese trabajo y lo usará dentro de una máquina virtual.'] },
    { n: 'Red Hat Enterprise Linux', fam: 'Red Hat', paq: '.rpm con dnf', mantiene: 'Red Hat, una empresa', quien: ['una empresa'],
      uso: 'Servidores de empresa, con soporte de pago.', parecidas: ['Debian', 'Ubuntu', 'Ubuntu Server', 'CentOS Stream'],
      casos: ['Un banco necesita un sistema para los servidores de sus cuentas. Quiere que una empresa le ayude si algo falla, aunque tenga que pagar por ello.'] },
    { n: 'Fedora', fam: 'Red Hat', paq: '.rpm con dnf', mantiene: 'la comunidad, con el apoyo de Red Hat', quien: ['la comunidad'],
      uso: 'Probar antes que nadie lo que después llega a Red Hat Enterprise Linux.', parecidas: ['CentOS Stream'],
      casos: ['A Sergio le gusta estrenar las novedades. Quiere probar hoy lo que dentro de un tiempo llegará a los servidores de las empresas que trabajan con Red Hat.'] },
    { n: 'CentOS Stream', fam: 'Red Hat', paq: '.rpm con dnf', mantiene: 'Red Hat y la comunidad', quien: ['una empresa', 'la comunidad'],
      uso: 'Ver la próxima versión de Red Hat Enterprise Linux antes de que salga.', parecidas: ['Fedora'] },
    { n: 'Arch', fam: 'Arch', paq: 'paquetes de pacman', mantiene: 'la comunidad', quien: ['la comunidad'],
      uso: 'Montar el sistema pieza a pieza, a tu gusto.', parecidas: ['Manjaro', 'Gentoo', 'Slackware'],
      casos: ['Pablo quiere construir su sistema desde cero y elegir él cada parte, una por una. No le importa tardar.'] },
    { n: 'Manjaro', fam: 'Arch', paq: 'paquetes de pacman', mantiene: 'la comunidad y una empresa (Manjaro GmbH)', quien: ['la comunidad', 'una empresa'],
      uso: 'Arch ya montado, con escritorio y listo para usar.', parecidas: ['Arch'],
      casos: ['Nuria quiere un sistema de la familia Arch, pero no quiere montar nada: busca uno que traiga el escritorio y funcione nada más instalarlo.'] },
    { n: 'Gentoo', fam: 'Gentoo', paq: 'compila en tu equipo', mantiene: 'la comunidad', quien: ['la comunidad'],
      uso: 'Compilar cada programa en tu equipo, ajustado a él.', parecidas: ['Arch', 'Slackware'],
      casos: ['Iván no quiere programas ya preparados: quiere que su propio ordenador compile todos los programas, a la medida de su procesador.'] },
    { n: 'Slackware', fam: 'Slackware', paq: 'paquetes .txz', mantiene: 'su creador, Patrick Volkerding, con voluntarios', quien: ['la comunidad'],
      uso: 'Equipos de quien quiere un sistema sencillo y configurarlo a mano; es la más antigua de las que siguen vivas.', parecidas: ['Arch', 'Gentoo'],
      casos: ['Elena busca una distribución simple por dentro y sin asistentes, en la que ella misma lo configure todo a mano. Prefiere la más veterana de las que todavía se mantienen.'] }
  ];
  const FAM = ['?'].concat([...new Set(DISTROS.map((d) => d.fam))]);
  const PAQ = ['?'].concat([...new Set(DISTROS.map((d) => d.paq))]);
  const QUIEN = ['?', 'una empresa', 'la comunidad'];
  const fichaDistro = (d) => `${d.n}: familia ${d.fam}, ${d.paq}. La mantiene ${d.mantiene}. ${d.uso}`;
  // todos los casos, en el orden de la tabla: { d, t, k } (k: la clave para no repetir en la hoja)
  const CASOS_DISTRO = [];
  DISTROS.forEach((d) => (d.casos || []).forEach((t, j) => CASOS_DISTRO.push({ d, t, k: d.n + ' ' + j })));
  // las que no pueden salir como opción en un caso de d: las parecidas, en las dos direcciones
  const pareceA = (d, x) => (d.parecidas || []).includes(x.n) || (x.parecidas || []).includes(d.n);
  V.DISTROS = DISTROS;
  V.CASOS_DISTRO = CASOS_DISTRO;
  GEN.distro = {
    titulo: '¿Qué distribución?',
    rejilla: true,
    modos: [{ t: 'Familia y paquetes', v: 'datos' }, { t: 'Elige para un caso', v: 'caso' }, { t: 'Al azar', v: null }],
    generar(cfg) {
      const modo = cfg.modo || (rnd(0, 1) ? 'datos' : 'caso');
      if (modo === 'datos') {
        const d = elige(DISTROS), x = fichaDistro(d);
        return {
          ...(cfg.modo ? variante(d.n, DISTROS.length) : variante(modo, 2)),
          enunciado: 'Di su familia, su formato de paquete y quién la mantiene: una empresa o la comunidad.',
          tarea: `⟪Rodea⟫ la familia, el formato de paquete y quién mantiene ⟦${d.n}⟧.`,
          columnas: '280px 560px', clase: 'texto',
          filas: [
            [{ lbl: 'distribución' }, { d: d.n, clase: 'dato' }],
            [{ lbl: 'familia' }, { sel: FAM, c: d.fam, clase: 'txt', n: 0, expl: x }],
            [{ lbl: 'paquetes' }, { sel: PAQ, c: d.paq, clase: 'txt', n: 1, expl: x }],
            [{ lbl: 'quién la mantiene' }, { sel: QUIEN, c: d.quien[0], clase: 'txt', n: 2, cmp: (q) => d.quien.includes(q), expl: x + (d.quien.length > 1 ? ' Valen las dos respuestas.' : '') }]
          ],
          correcto: `Correcto. ${x}`
        };
      }
      const caso = elige(CASOS_DISTRO), d = caso.d;
      const ok = [d.n].concat(d.iguales || []);
      const otras = baraja(DISTROS.filter((x) => !ok.includes(x.n) && !pareceA(d, x))).slice(0, 5 - ok.length).map((x) => x.n);
      const op = baraja(ok.concat(otras));
      const e = ok.map((n) => `${n}: ${DISTROS.find((x) => x.n === n).uso}`).join(' ');
      return {
        ...(cfg.modo ? variante(caso.k, CASOS_DISTRO.length) : variante(modo, 2)),
        enunciado: 'Elige para un caso: piensa para qué se usa cada distribución y quédate con la que encaja. Puede haber más de una buena.',
        tarea: '⟪Lee⟫ el caso y ⟪rodea⟫ la distribución que encaja con él. Puede haber más de una buena.',
        columnas: '280px 560px', clase: 'texto',
        // el selector se pulsa para pasar de una a otra: las opciones se ven todas en la fila de encima
        filas: [
          [{ lbl: 'caso' }, { d: caso.t, clase: 'texto' }],
          [{ lbl: 'opciones' }, { d: op.join(' · '), clase: 'texto lvis-opciones' }],
          [{ lbl: 'distribución' }, { sel: ['?'].concat(op), c: ok[0], clase: 'txt', n: 0, cmp: (x) => ok.includes(x), expl: e }]
        ],
        correcto: `Correcto. ${e}`
      };
    }
  };

  /* ---------- UT4 · uname: qué opción da una salida y qué orden da un dato ----------
     Las salidas son las de la máquina Ubuntu-SOM (uname -a en la máquina real: Linux som-apellido 7.0.0-43-generic
     #43~24.04.1-Ubuntu SMP PREEMPT_DYNAMIC Sat Oct 31 06:52:47 UTC 2 x86_64 x86_64 x86_64 GNU/Linux); solo cambia el
     nombre del equipo. Las opciones y lo que enseñan, las de la diapositiva «uname: qué sistema es»; la de
     -o (el sistema operativo) no: se busca en el manual, y en papel no hay manual. */
  const UNAME_VERSION = '#43~24.04.1-Ubuntu SMP PREEMPT_DYNAMIC Sat Oct 31 06:52:47 UTC 2';
  const UNAME_OPC = [
    { c: 's', l: 'kernel-name', que: 'el nombre del núcleo', sal: () => 'Linux' },
    { c: 'n', l: 'nodename', que: 'el nombre del equipo', sal: (eq) => eq },
    { c: 'r', l: 'kernel-release', que: 'la versión del núcleo', sal: () => '7.0.0-43-generic' },
    { c: 'v', l: 'kernel-version', que: 'cuándo se compiló el núcleo', sal: () => UNAME_VERSION },
    { c: 'm', l: 'machine', que: 'el tipo de procesador', sal: () => 'x86_64', tambien: ['p', 'i'] },
    { c: 'a', l: 'all', que: 'todo a la vez', sal: (eq) => `Linux ${eq} 7.0.0-43-generic ${UNAME_VERSION} x86_64 x86_64 x86_64 GNU/Linux` }
  ];
  const APELLIDOS_EQ = ['garcia', 'lopez', 'martin', 'sanchez', 'perez', 'gomez', 'ruiz', 'diaz', 'moreno', 'alonso', 'romero', 'navarro'];
  const sinEspacios = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
  // las formas de una opción que valen: -r, --kernel-release (y, para el procesador, también -p e -i, que en Ubuntu dicen lo mismo)
  const formasOpcion = (o) => ['-' + o.c, '--' + o.l].concat((o.tambien || []).map((x) => '-' + x));
  GEN.uname = {
    titulo: 'uname',
    rejilla: true,
    modos: [{ t: '¿Qué opción?', v: 'salida' }, { t: 'Escribe la orden', v: 'orden' }, { t: 'Al azar', v: null }],
    generar(cfg) {
      const modo = cfg.modo || (rnd(0, 1) ? 'salida' : 'orden');
      const i = rnd(0, UNAME_OPC.length - 1), o = UNAME_OPC[i];
      const equipo = 'som-' + elige(APELLIDOS_EQ);
      const v = cfg.modo ? variante(o.c, UNAME_OPC.length) : variante(modo, 2);
      const QUE = ['?'].concat(UNAME_OPC.map((x) => x.que));
      const expl = `-${o.c} (o --${o.l}) enseña ${o.que}${o.tambien ? '. En Ubuntu, -p y -i suelen repetir x86_64' : ''}.`;
      // lo que también vale, para el solucionario: «-m (valen también -p e -i)»
      const tambien = o.tambien ? ` (valen también ${o.tambien.map((x) => '-' + x).join(' e ')})` : '';
      const tambienTxt = o.tambien ? ` También valen ${o.tambien.map((x) => '-' + x).join(' e ')}, que en Ubuntu suelen repetir x86_64.` : '';
      if (modo === 'salida') {
        const formas = formasOpcion(o);
        return {
          ...v,
          enunciado: 'Cada opción de uname enseña un dato. La opción corta lleva un guion y una letra; la larga, dos guiones y una palabra. Las dos valen.',
          tarea: `⟪Escribe⟫ la opción de ⟦uname⟧ que da esta salida y ⟪rodea⟫ qué enseña.`,
          columnas: '230px 470px', clase: 'texto',
          filas: [
            [{ lbl: 'terminal' }, { d: '$ uname ___\n' + o.sal(equipo), clase: 'texto lvis-salida' }],
            [{ lbl: 'opción' }, { c: '-' + o.c, sol: '-' + o.c + tambien, clase: 'txt', max: 24, filtro: /[^a-zA-Z\- ]/g, n: 0, cmp: (x) => formas.includes(sinEspacios(x)), expl }],
            [{ lbl: 'qué enseña' }, { sel: QUE, c: o.que, clase: 'txt', n: 1, expl }]
          ],
          correcto: `Correcto: uname -${o.c} (o uname --${o.l}) enseña ${o.que}.${tambienTxt}`
        };
      }
      const formas = formasOpcion(o).map((x) => 'uname ' + x);
      return {
        ...v,
        enunciado: 'Escribe la orden entera, con su opción. Vale la opción corta (un guion y una letra) o la larga (dos guiones y una palabra).',
        tarea: `⟪Escribe⟫ la orden que enseña ⟦${o.que}⟧.`,
        columnas: '230px 470px', clase: 'texto',
        filas: [
          [{ lbl: 'orden' }, { c: 'uname -' + o.c, sol: 'uname -' + o.c + tambien, clase: 'txt', max: 40, filtro: /[^a-zA-Z\- ]/g, n: 0, cmp: (x) => formas.includes(sinEspacios(x)), expl }]
        ],
        correcto: `Correcto: uname -${o.c}, o uname --${o.l}.${tambienTxt}`
      };
    }
  };

  /* ---------- UT4 · GRUB: leer /etc/default/grub y escribir la línea para un comportamiento ----------
     Solo las cuatro variables que explica la unidad, sobre el /etc/default/grub de la máquina Ubuntu-SOM
     (GRUB_DEFAULT=0, GRUB_TIMEOUT_STYLE=hidden, GRUB_TIMEOUT=0, GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"). */
  const GRUB_CAMBIOS = [
    { k: 'menu', pide: 'que el menú se vea al encender', linea: 'GRUB_TIMEOUT_STYLE=menu', si: (c) => c.estilo !== 'menu' },
    { k: 'oculto', pide: 'que el menú no se vea al encender', linea: 'GRUB_TIMEOUT_STYLE=hidden', si: (c) => c.estilo === 'menu' },
    { k: 'espera', pide: null, linea: null, si: () => true },
    { k: 'mensajes', pide: 'que se vean los mensajes del arranque', linea: 'GRUB_CMDLINE_LINUX_DEFAULT=""', acepta: ['GRUB_CMDLINE_LINUX_DEFAULT=""', "GRUB_CMDLINE_LINUX_DEFAULT=''", 'GRUB_CMDLINE_LINUX_DEFAULT='], si: (c) => c.quiet },
    { k: 'logotipo', pide: 'que arranque con el logotipo y sin mensajes', linea: 'GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"', acepta: ['GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"', "GRUB_CMDLINE_LINUX_DEFAULT='quiet splash'"], si: (c) => !c.quiet },
    { k: 'segunda', pide: 'que arranque sola la segunda entrada del menú', linea: 'GRUB_DEFAULT=1', si: () => true }
  ];
  GEN.grub = {
    titulo: 'GRUB',
    rejilla: true,
    generar() {
      const menu = rnd(0, 1) === 1;
      const conf = { estilo: menu ? 'menu' : 'hidden', espera: menu ? elige([3, 5, 10, 15, 30]) : 0, quiet: rnd(0, 1) === 1 };
      const cmd = conf.quiet ? '"quiet splash"' : '""';
      const archivo = ['# If you change this file, run \'update-grub\' afterwards to update', '# /boot/grub/grub.cfg.',
        'GRUB_DEFAULT=0', `GRUB_TIMEOUT_STYLE=${conf.estilo}`, `GRUB_TIMEOUT=${conf.espera}`, `GRUB_CMDLINE_LINUX_DEFAULT=${cmd}`].join('\n');
      const posibles = GRUB_CAMBIOS.filter((c) => c.si(conf));
      const cambio = Object.assign({}, elige(posibles));
      if (cambio.k === 'espera') {
        const n = elige([2, 4, 6, 7, 8, 12, 20].filter((x) => x !== conf.espera));
        cambio.pide = `que espere ${n} segundos`; cambio.linea = `GRUB_TIMEOUT=${n}`;
      }
      const acepta = (cambio.acepta || [cambio.linea]).map((x) => x.replace(/\s+/g, ''));
      const SN = ['?', 'sí', 'no'];
      const visible = conf.estilo === 'menu';
      return {
        ...variante(conf.estilo + (conf.quiet ? '-quiet' : '-mensajes'), 4),
        enunciado: 'GRUB_TIMEOUT_STYLE: hidden oculta el menú; menu lo enseña. GRUB_TIMEOUT: los segundos que espera. GRUB_CMDLINE_LINUX_DEFAULT: quiet: sin mensajes. splash: con logotipo. Sin ellos, se ven los mensajes del arranque. GRUB_DEFAULT: la entrada que arranca sola; 0 es la primera. Después de cambiar el archivo, el menú se fabrica con sudo update-grub.',
        tarea: `⟪Lee⟫ el archivo ⟦/etc/default/grub⟧ y ⟪contesta⟫. Después ⟪escribe⟫ la línea que hay que poner para ⟦${cambio.pide}⟧ y la orden que fabrica el menú nuevo.`,
        columnas: '330px 470px', clase: 'texto',
        filas: [
          [{ lbl: '/etc/default/grub (extracto)' }, { d: archivo, clase: 'texto lvis-salida lvis-archivo' }],
          [{ lbl: '¿se ve el menú al encender?' }, { sel: SN, c: visible ? 'sí' : 'no', clase: 'txt', n: 0, expl: visible ? 'Sí: GRUB_TIMEOUT_STYLE=menu enseña el menú.' : 'No: GRUB_TIMEOUT_STYLE=hidden oculta el menú. Se ve pulsando Esc al encender.' }],
          [{ lbl: '¿cuántos segundos espera?' }, { c: String(conf.espera), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 1, expl: `GRUB_TIMEOUT=${conf.espera}: espera ${conf.espera} ${conf.espera === 1 ? 'segundo' : 'segundos'}.` }],
          [{ lbl: '¿se ven los mensajes del arranque?' }, { sel: SN, c: conf.quiet ? 'no' : 'sí', clase: 'txt', n: 2, expl: conf.quiet ? 'No: quiet quita los mensajes (y splash pone el logotipo).' : 'Sí: sin quiet ni splash se ven los mensajes del arranque.' }],
          { linea: true, clase: 'suave', desde: 1 },
          [{ lbl: 'línea para ' + cambio.pide }, { c: cambio.linea, clase: 'txt', max: 60, filtro: /[^A-Za-z0-9_="' ]/g, n: 3, cmp: (x) => acepta.includes(String(x).replace(/\s+/g, '')), expl: `${cambio.linea}: ${cambio.k === 'segunda' ? 'GRUB_DEFAULT cuenta desde 0, así que la segunda entrada es la 1' : cambio.k === 'espera' ? 'GRUB_TIMEOUT son los segundos que espera' : cambio.k === 'menu' || cambio.k === 'oculto' ? 'hidden oculta el menú; menu lo enseña' : 'quiet: sin mensajes; splash: con logotipo; sin ellos, se ven los mensajes del arranque'}.` }],
          [{ lbl: 'orden que fabrica el menú nuevo' }, { c: 'sudo update-grub', clase: 'txt', max: 40, filtro: /[^a-z\- ]/g, n: 4, cmp: (x) => ['sudo update-grub', 'update-grub'].includes(sinEspacios(x)), expl: 'sudo update-grub fabrica /boot/grub/grub.cfg con lo que dice /etc/default/grub. Sin ella, el menú no cambia.' }]
        ],
        correcto: `Correcto: el menú ${visible ? 'se ve' : 'no se ve (oculto)'}, espera ${conf.espera} s y ${conf.quiet ? 'no se ven los mensajes (quiet splash)' : 'se ven los mensajes del arranque'}. Para ${cambio.pide}: ${cambio.linea}, y después sudo update-grub.`
      };
    }
  };

  /* ---------- UT4 · caso para el plan de instalación (solo para la hoja) ----------
     Requisitos de Ubuntu 24.04 Desktop de la diapositiva «¿Sirve este ordenador?»: procesador de 64 bits y doble núcleo a
     2 GHz, 4 GB de RAM y 25 GB libres; firmware UEFI o BIOS. Datos del instalador comprobados en la máquina real: con UEFI
     crea él solo la ESP de 1 GB, y cuenta en GB (un disco de 40 GiB son 42,95 GB). */
  // los siete apartados, con la redacción de la diapositiva «Plan de instalación» (práctica)
  const PLAN_APARTADOS = ['El sistema y la versión, y por qué.', 'Si sirve el equipo, requisito por requisito.', 'Cómo se va a instalar.', 'Las particiones: tamaño, sistema de archivos y punto de montaje.',
    'Los parámetros: idioma, teclado, usuario, equipo y huso horario.', 'Qué se hace antes y después de instalar.', 'Licencias: qué programas propietarios se van a instalar y con qué condiciones.'];
  const PLAN_CASOS = [
    { equipo: 'Portátil con Intel Core i5 de 64 bits (4 núcleos a 2,4 GHz), 8 GB de RAM, SSD de 512 GB y firmware UEFI.', dueno: 'Lucía, estudiante de 1.º de SMR.', uso: 'Estudiar, programar y hacer las prácticas del curso.', conserva: 'Windows 11 y sus apuntes: quiere elegir el sistema al encender.',
      clave: 'Sirve: 64 bits, 4 núcleos a 2,4 GHz, 8 GB y espacio de sobra. Ubuntu 24.04 LTS junto a Windows (multiarranque), con copia de los apuntes antes; las dos comparten la ESP que ya tiene el disco.' },
    { equipo: 'PC de sobremesa con Intel Core 2 Duo de 64 bits a 2,2 GHz, 4 GB de RAM, disco duro de 250 GB y BIOS.', dueno: 'La asociación de vecinos del barrio.', uso: 'Navegar, escribir cartas e imprimir.', conserva: 'Nada: los documentos ya están copiados en un USB.',
      clave: 'Sirve justo: 64 bits, doble núcleo a 2,2 GHz, 4 GB (el mínimo) y disco de sobra. Borrar el disco e instalar; con BIOS no hay ESP. Un escritorio ligero (Xubuntu o Lubuntu) gasta menos memoria.' },
    { equipo: 'Netbook con Intel Atom de 32 bits a 1,6 GHz, 2 GB de RAM y 32 GB de almacenamiento.', dueno: 'Mario, que lo tiene en un cajón.', uso: 'Que su hijo navegue y haga los deberes.', conserva: 'Nada.',
      clave: 'No sirve: Ubuntu 24.04 pide un procesador de 64 bits, 4 GB de RAM y 25 GB libres, y este tiene 32 bits, 2 GB y 32 GB. El plan dice que no se instala y propone otra salida (otro equipo).' },
    { equipo: 'Máquina virtual de VirtualBox: 4 GB de RAM, 2 procesadores, disco de 40 GB y UEFI.', dueno: 'Tú, para practicar en clase.', uso: 'Las prácticas de Linux del curso.', conserva: 'Nada: la máquina es nueva.',
      clave: 'Sirve: 4 GB, 2 procesadores y 40 GB (42,95 GB para el instalador). Instalación manual con el plan del módulo: ESP de 1 GB (la crea el instalador), raíz de 25 GB, intercambio de 2 GB y /home con el resto. Instantánea al terminar.' },
    { equipo: 'PC de una tienda con Intel Core i3 de 64 bits (4 núcleos a 3,1 GHz), 16 GB de RAM, SSD de 1 TB y UEFI.', dueno: 'Carmen, dueña de una papelería.', uso: 'Hacer las facturas y atender la tienda en línea.', conserva: 'La carpeta de facturas, que está en el disco.',
      clave: 'Sirve de sobra. Copia de la carpeta de facturas antes de instalar (fuera del equipo); /home aparte para que reinstalar no borre los datos. Con UEFI, el instalador crea la ESP de 1 GB.' },
    { equipo: 'Portátil con AMD Ryzen 5 de 64 bits (6 núcleos a 3,3 GHz), 16 GB de RAM, SSD de 20 GB libres y UEFI.', dueno: 'Álex, que quiere probar Linux.', uso: 'Navegar y ver vídeos.', conserva: 'Windows 11 y todos sus archivos.',
      clave: 'El procesador y la memoria sirven, pero solo quedan 20 GB libres y Ubuntu pide 25 GB: hay que liberar espacio antes, o probar Ubuntu desde el USB sin instalarlo, o en una máquina virtual.' },
    { equipo: 'PC del aula de informática con Intel Core i7 de 64 bits (8 núcleos a 2,9 GHz), 32 GB de RAM, SSD de 1 TB y UEFI.', dueno: 'El instituto.', uso: 'Clases de programación durante varios cursos.', conserva: 'Nada: el disco se borra al empezar el curso.',
      clave: 'Sirve de sobra. Ubuntu 24.04 LTS (cinco años de actualizaciones). Borrar el disco e instalar; la ESP de 1 GB la crea el instalador. Usuario sin datos personales y huso horario de Madrid.' },
    { equipo: 'Ordenador antiguo con AMD Athlon 64 X2 a 2,0 GHz, 4 GB de RAM, disco de 160 GB y BIOS.', dueno: 'Rosa, que lo usa en la cocina.', uso: 'Recetas, música y videollamadas.', conserva: 'Las fotos de la familia, que están en el disco.',
      clave: 'Sirve justo: 64 bits, doble núcleo a 2 GHz y 4 GB. Copia de las fotos antes de borrar el disco; con BIOS no hay ESP. Un escritorio ligero va mejor con 4 GB.' }
  ];
  GEN['plan-instalacion'] = {
    titulo: 'Plan de instalación',
    rejilla: true,
    soloHoja: true,
    generar() {
      const i = rnd(0, PLAN_CASOS.length - 1), c = PLAN_CASOS[i];
      const filas = [
        [{ lbl: 'equipo' }, { d: c.equipo, clase: 'texto' }],
        [{ lbl: 'dueño' }, { d: c.dueno, clase: 'texto' }],
        [{ lbl: 'para qué lo quiere' }, { d: c.uso, clase: 'texto' }],
        [{ lbl: 'qué hay que conservar' }, { d: c.conserva, clase: 'texto' }],
        { linea: true, clase: 'suave', desde: 1 }
      ];
      PLAN_APARTADOS.forEach((a, k) => {
        filas.push([{ lbl: (k + 1) + '.' }, { d: a, clase: 'texto lvis-apartado' }]);
        filas.push([{ lbl: '' }, { d: '', clase: 'lvis-renglones' + (k === 3 ? ' altos' : '') }]);
      });
      return {
        ...variante(i, PLAN_CASOS.length),
        enunciado: 'Ubuntu 24.04 Desktop pide un procesador de 64 bits y doble núcleo a 2 GHz, 4 GB de RAM y 25 GB libres. Con firmware UEFI, el instalador crea él solo la partición del sistema EFI (ESP) de 1 GB. El instalador cuenta en GB: un disco de 40 GiB aparece como 42,95 GB.',
        tarea: '⟪Lee⟫ el caso y ⟪escribe⟫ su ⟦plan de instalación⟧ con los siete apartados.',
        columnas: '150px 1560px', clase: 'texto',
        filas,
        correcto: 'Lo que tiene que decir el plan: ' + c.clave
      };
    }
  };

  /* ---------- UT4 · tareas para hacer en la máquina (solo para la hoja) ----------
     Del banco de misiones de la UT4 (assets/linux-misiones-ut4.js: M3, M6, M7 y M8), con los datos de la semilla, en el
     formato de los ejercicios de terminal: preparación, las tareas de la unidad y la limpieza final. Solo las que se
     pueden hacer en la máquina Ubuntu-SOM de cada uno: las que necesitan los archivos o las sesiones de la misión
     (otro usuario conectado, lista.txt, largo.txt) no entran, ni cambiar la contraseña. Cada tarea dice qué hay que
     conseguir; la solución (una posible) va en el solucionario. */
  const TT_PREPARA = [
    { html: '<u>Borra</u> el <b>historial</b> de órdenes.', sol: ['history -c'] },
    { html: '<u>Escribe</u> la <b>fecha y la hora</b> de ahora.', casillas: ['fecha y hora'], resp: ['la de ahora'], sol: ['date'] },
    { html: '<u>Escribe</u> la <b>dirección IP</b> de la máquina.', casillas: ['IP'], resp: ['10.0.2.15 (en NAT)'], sol: ['ip a'] },
    { html: '<u>Ve</u> a tu <b>carpeta personal</b>.', sol: ['cd'] }
  ];
  // de cada misión, las tareas que valen en la máquina real y cuántas salen; resp: la respuesta en Ubuntu-SOM (o de qué depende)
  const TT_MISIONES = [
    { k: 'ut4-m3', parte: 'El núcleo', usa: [0, 1, 2, 3, 4], cuantas: 2,
      resp: (m, i) => [['7.0.0-43-generic'], ['x86_64'], ['según lsmod'], ['13.3.0'], ['GNU/Linux']][i] },
    { k: 'ut4-m6', parte: 'Quién, cuándo y dónde', usa: [0, 3, 4, 5, 6], cuantas: 2,
      resp: (m, i) => (i === 0 ? ['1000'] : i === 4 || i === 6 ? m.tareas[i].esperado({}) : i === 5 ? ['la de hoy'] : null) },
    { k: 'ut4-m7', parte: 'Archivos y carpetas', usa: [0, 1, 4, 5], cuantas: 2,
      resp: (m, i) => (i === 1 ? ['según tu carpeta'] : i === 4 ? ['según top'] : null) },
    { k: 'ut4-m8', parte: 'Tu terminal a tu gusto', usa: [0, 1, 2, 3, 4], cuantas: 3,
      resp: (m, i) => (i === 0 ? ['/usr/local/sbin'] : i === 1 ? [/^(HOME)$/.test(m.variable) ? '/home/tu usuario' : /^(USER|LOGNAME)$/.test(m.variable) ? 'tu usuario' : 'es_ES.UTF-8'] : null) }
  ];
  const deHtml = (h) => String(h).replace(/<u>(.*?)<\/u>/g, '⟪$1⟫').replace(/<b>(.*?)<\/b>/g, '⟦$1⟧').replace(/<[^>]+>/g, '');
  // una orden de la solución de una misión, en texto: con Tab, lo que se teclea dentro de man o more, si pide contraseña
  function ordenTexto(p) {
    if (typeof p === 'string') return p;
    let t = p.orden;
    if (p.tab) t += ' y Tab';
    if (p.ctrlC) t += ' y, al rato, Ctrl + C';
    const k = p.teclas || [];
    const i = k.indexOf('/');
    if (i >= 0) t += ', dentro /' + k.slice(i + 1, k.indexOf('Enter', i)).join('') + ' e Intro';
    if (k.includes('q')) t += ', q para salir';
    else if (k.length && k.every((x) => x === ' ')) t += ', espacio hasta el final';
    if ((p.respuestas || []).some(Boolean)) t += ' (pide tu contraseña)';
    return t;
  }
  GEN['tareas-terminal'] = {
    titulo: 'Tareas en la terminal',
    rejilla: true,
    soloHoja: true,
    generar() {
      const L = SOM.linux || {};
      const M = L.misiones || {};
      if (!TT_MISIONES.every((x) => M[x.k])) throw new Error('Falta el banco de misiones de la UT4 (linux-misiones-ut4.js).');
      let num = 0;
      const tarea = (t, resp, sol) => ({ n: ++num, html: t.html, casillas: t.casillas || (t.selector ? ['respuesta'] : []), selector: t.selector, resp, sol });
      const bloques = [];
      // preparación
      bloques.push({ titulo: 'Preparación', tareas: TT_PREPARA.map((t) => tarea(t, t.resp, t.sol)) });
      // las tareas de la unidad: de cada misión, unas cuantas al azar, en su orden
      const partes = TT_MISIONES.map((x) => {
        const m = M[x.k].generar(rnd(1, 999999999));
        if (x.k === 'ut4-m8') m.variable = (m.tareas[1].html.match(/<b>([A-Z]+)<\/b>/) || [])[1];
        const elegidas = baraja(x.usa).slice(0, x.cuantas).sort((a, b) => a - b);
        return { titulo: x.parte, tareas: elegidas.map((i) => { const t = m.tareas[i]; return tarea(t, t.tipo === 'estado' || t.tipo === 'evento' ? null : x.resp(m, i), t.solucion.map(ordenTexto)); }), clave: x.k + ':' + elegidas.join('') };
      });
      // en el papel van en dos bloques (el recuadro de un ejercicio no se parte entre páginas): preparación, núcleo y
      // quién, cuándo y dónde; después archivos, la terminal a tu gusto y la limpieza final
      bloques[0].tareas.push(...partes[0].tareas, ...partes[1].tareas);
      bloques[0].secciones = [['Preparación', 4], [partes[0].titulo, partes[0].tareas.length], [partes[1].titulo, partes[1].tareas.length]];
      const fin = tarea({ html: '<u>Sal</u> de la terminal con la orden que <b>cierra la sesión</b>.' }, null, ['exit']);
      bloques.push({ tareas: partes[2].tareas.concat(partes[3].tareas, [fin]), secciones: [[partes[2].titulo, partes[2].tareas.length], [partes[3].titulo, partes[3].tareas.length], ['Limpieza final', 1]] });
      const total = num;
      const g = bloques.map((b, j) => {
        const filas = [];
        let k = 0;
        b.secciones.forEach(([tit, cuantas]) => {
          filas.push([{ lbl: '' }, { d: tit, clase: 'texto lvis-seccion', span: 2 }]);
          b.tareas.slice(k, k + cuantas).forEach((t) => {
            const casilla = (q) => ({ c: (t.resp || [])[q] || '—', clase: 'txt', max: 60, filtro: /[\u0000-\u001f]/g });
            const varias = t.casillas.length > 1;
            filas.push([{ lbl: t.n + '.' }, { d: deHtml(t.html), clase: 'texto' }, !t.casillas.length ? { d: '☐ hecho', clase: 'peq' }
              : t.selector ? { sel: ['?'].concat(t.selector), c: (t.resp || ['—'])[0], clase: 'txt' } : varias ? { d: '' } : casilla(0)]);
            if (varias) t.casillas.forEach((cas, q) => filas.push([{ lbl: '' }, { d: cas, clase: 'peq lvis-casilla' }, casilla(q)]));
          });
          k += cuantas;
        });
        const sol = b.tareas.map((t) => `${t.n}. ${t.sol.join(' · ')}`).join('\n');
        return {
          titulo: b.titulo,
          enunciado: j === 0 ? 'Cada tarea dice qué hay que conseguir, no qué orden usar: la que elijas vale si llega al resultado. Si la tarea pide un dato, escribe en su casilla lo que te responda la máquina.' : '',
          tarea: j === 0 ? `⟪Haz⟫ en tu máquina ⟦Ubuntu-SOM⟧ las ⟦${total}⟧ tareas, en orden. Si una tarea pide un dato, ⟪escríbelo⟫ en su casilla; si no, ⟪marca⟫ la casilla cuando la hayas hecho.` : '⟪Sigue⟫ con las tareas, en orden.',
          columnas: '70px 1080px 540px', clase: 'texto lvis-tareas',
          filas,
          correcto: 'Una solución posible (valen otras órdenes que lleguen al mismo resultado):\n' + sol
        };
      });
      return Object.assign({}, g[0], { ...variante(partes.map((p) => p.clave).join('|'), 50), bloques: g });
    }
  };

  V.generadores = GEN;
  // som.js crea SOM.generadores al cargarse: se añaden ahora si ya existe y, por si esta página carga este archivo
  // antes que som.js, otra vez al terminar de leer la página (antes de que som.js monte los ejercicios)
  const registra = () => { if (SOM.generadores) Object.keys(GEN).forEach((k) => { SOM.generadores[k] = GEN[k]; }); };
  registra();

  /* ============================== interfaz (solo en el navegador) ============================== */
  if (!hayDOM) return;
  document.addEventListener('DOMContentLoaded', registra);

  const crea = (tag, clase, html) => { const x = document.createElement(tag); if (clase) x.className = clase; if (html !== undefined) x.innerHTML = html; return x; };
  const boton = (texto, clase, f) => { const b = crea('button', 'btn ' + clase); b.type = 'button'; b.textContent = texto; if (f) b.addEventListener('click', (e) => { e.stopPropagation(); f(e); }); return b; };
  const parpadea = (x) => { if (!x) return; x.classList.remove('lvis-recien'); void x.offsetWidth; x.classList.add('lvis-recien'); };
  // que un toque dentro del simulador no pase de diapositiva en el móvil, ni las teclas de los campos lleguen a deck-stage
  function protege(el) {
    el.addEventListener('click', (e) => { e.preventDefault(); });
    el.addEventListener('keydown', (e) => { const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) e.stopPropagation(); });
  }
  const reducido = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Lo que se mide (letra que cabe, rótulos, particiones estrechas) se vuelve a medir al llegar a la diapositiva y al
   * cambiar el tamaño de la ventana: en una diapositiva que no se ve, todo mide 0. */
  const vigilados = [];
  function alVer(el, f) { vigilados.push({ el, f }); }
  function vigila() {
    window.addEventListener('resize', () => vigilados.forEach((v) => { if (v.el.offsetWidth) v.f(); }));
    const stage = document.querySelector('deck-stage');
    if (stage) stage.addEventListener('slidechange', (e) => {
      const sec = e.detail && e.detail.slide;
      requestAnimationFrame(() => vigilados.forEach((v) => { if (sec && sec.contains(v.el)) v.f(); }));
    });
  }

  /* ---------- 1. orden ---------- */
  function montaOrden(el) {
    const propias = el.querySelector('.lvis-lineas');
    const lineas = propias ? [...propias.querySelectorAll('li')].map((li) => li.textContent.trim()) : V.LINEAS_ORDEN.slice();
    const conTerm = el.dataset.terminal !== 'no';
    el.innerHTML = '';
    el.classList.add('lvis-orden', 'lvis-montado');
    if (conTerm) el.classList.add('lvis-con-term');
    const tarjeta = crea('div', 'lvis-tarjeta');
    tarjeta.innerHTML = `
      <div class="lvis-sel" role="group" aria-label="Líneas de ejemplo"></div>
      <div class="lvis-escribe"><input class="lvis-campo" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="O escribe tu línea y pulsa Intro" aria-label="Escribe una línea de órdenes"><button type="button" class="btn btn-ghost lvis-analiza">Analizar</button></div>
      <div class="lvis-escena"><div class="lvis-trozos"></div><div class="lvis-rotulos"></div></div>
      <div class="lvis-leyenda" role="group" aria-label="Papeles"></div>
      <div class="lvis-msg"></div>
      <div class="lvis-botones"></div>`;
    el.appendChild(tarjeta);
    let term = null;
    if (conTerm) {
      const col = crea('div', 'lvis-term-col');
      term = crea('div', 'term');
      term.dataset.escenario = el.dataset.escenario || 'inicio';
      col.appendChild(term);
      el.appendChild(col);
      if (SOM.Terminal && !term.classList.contains('term-montada')) { const t = new SOM.Terminal(term); (SOM.terminales = SOM.terminales || []).push(t); }
    }
    const $ = (s) => tarjeta.querySelector(s);
    const sel = $('.lvis-sel'), campo = $('.lvis-campo'), trozosEl = $('.lvis-trozos'), rotulos = $('.lvis-rotulos'), leyenda = $('.lvis-leyenda'), msg = $('.lvis-msg'), botones = $('.lvis-botones');
    let actual = '', an = null, elegido = null, papelElegido = null, todos = false;
    const bTodos = boton('Enseñar todos los papeles', 'btn-ghost', () => { todos = !todos; pinta(); });
    const bEjecutar = boton('Ejecutar en la terminal', 'btn-primary', () => ejecuta());
    botones.appendChild(bTodos);
    if (conTerm) botones.appendChild(bEjecutar);
    lineas.forEach((l) => {
      const b = crea('button', 'lvis-chip mono'); b.type = 'button'; b.textContent = l;
      b.addEventListener('click', (e) => { e.stopPropagation(); campo.value = ''; carga(l); });
      sel.appendChild(b);
    });
    const leer = () => { const v = campo.value.trim(); if (v) carga(v); };
    campo.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); leer(); } });
    $('.lvis-analiza').addEventListener('click', (e) => { e.stopPropagation(); leer(); });

    function carga(linea) {
      actual = linea; elegido = null; papelElegido = null; todos = false;
      an = analizaOrden(linea);
      sel.querySelectorAll('.lvis-chip').forEach((b) => b.classList.toggle('activo', b.textContent === linea));
      pinta();
      if (an.error) { msg.innerHTML = `<b>No se puede partir esta línea.</b> ${esc(an.error)}`; msg.classList.add('aviso'); }
    }
    function pinta() {
      msg.classList.remove('aviso');
      trozosEl.innerHTML = '';
      rotulos.innerHTML = '';
      bTodos.textContent = todos ? 'Ocultar los papeles' : 'Enseñar todos los papeles';
      bEjecutar.disabled = !!(an && an.error) || !actual;
      if (!an || an.error) { trozosEl.textContent = actual; leyenda.innerHTML = ''; return; }
      // la línea con cada trozo como botón y los espacios tal cual
      let p = 0;
      an.trozos.forEach((t) => {
        if (t.ini > p) trozosEl.appendChild(document.createTextNode(actual.slice(p, t.ini)));
        const b = crea('button', 'lvis-trozo papel-' + t.papel.replace('fin-opciones', 'opcion'));
        b.type = 'button'; b.textContent = t.texto; b.dataset.i = t.i;
        const vis = todos || elegido === t.i || papelElegido === t.papel;
        b.classList.toggle('visto', vis);
        b.classList.toggle('elegido', elegido === t.i);
        b.setAttribute('aria-pressed', elegido === t.i ? 'true' : 'false');
        b.addEventListener('click', (e) => { e.stopPropagation(); elegido = elegido === t.i ? null : t.i; papelElegido = null; pinta(); });
        trozosEl.appendChild(b);
        p = t.fin;
      });
      if (p < actual.length) trozosEl.appendChild(document.createTextNode(actual.slice(p)));
      ajustaLetra(trozosEl, 68, 34);
      // rótulos debajo de los trozos que se ven
      requestAnimationFrame(() => ponRotulos(trozosEl, rotulos, an.trozos.filter((t) => todos || elegido === t.i || papelElegido === t.papel).map((t) => ({ i: t.i, texto: (PAPELES[t.papel] || PAPELES.otro).nombre, clase: 'papel-' + t.papel.replace('fin-opciones', 'opcion') }))));
      // leyenda: los papeles que hay en la línea
      const hay = [...new Set(an.trozos.map((t) => (t.papel === 'fin-opciones' ? 'opcion' : t.papel)))];
      const orden = ['orden', 'opcion', 'argumento', 'separador', 'tuberia', 'condicion', 'fondo', 'redireccion', 'destino', 'asignacion', 'otro'];
      leyenda.innerHTML = '';
      orden.filter((x) => hay.includes(x)).forEach((x) => {
        const b = crea('button', 'lvis-chip papel-' + x + (papelElegido === x ? ' activo' : ''));
        b.type = 'button'; b.innerHTML = `<i></i><b>${esc(PAPELES[x].nombre)}</b>: ${esc(PAPELES[x].frase)}`;
        b.addEventListener('click', (e) => { e.stopPropagation(); papelElegido = papelElegido === x ? null : x; elegido = null; pinta(); });
        leyenda.appendChild(b);
      });
      // explicación
      if (elegido !== null) {
        const t = an.trozos[elegido];
        const ex = explicaTrozo(t, an.trozos);
        msg.innerHTML = `<span class="lvis-etq papel-${t.papel.replace('fin-opciones', 'opcion')}">${esc(ex.titulo)}</span> ${ex.texto}`;
      } else if (papelElegido) {
        const n = an.trozos.filter((t) => t.papel === papelElegido).length;
        const P = PAPELES[papelElegido];
        msg.innerHTML = `<span class="lvis-etq papel-${papelElegido}">${esc(P.nombre)}</span> ${n === 1 ? 'Hay uno' : `Hay ${n}`} en esta línea: ${esc(P.frase)}. Pulsa ${n === 1 ? 'el trozo' : 'cada trozo'} para ver qué hace.`;
      } else if (todos) {
        msg.innerHTML = 'Cada trozo con su papel. Pulsa uno para ver qué hace.';
      } else {
        msg.innerHTML = 'Pulsa cada trozo de la línea para ver qué papel tiene: <b>orden</b>, <b>opción</b> o <b>argumento</b>.';
      }
    }
    function ejecuta() {
      if (!term || !actual || (an && an.error)) return;
      const t = term._terminal;
      if (!t) { msg.textContent = 'La terminal no está disponible en esta página.'; return; }
      if (t.ej || t.escribiendo || t.programa) { msg.innerHTML = 'Espera a que acabe lo que está haciendo la terminal.'; return; }
      if (t.cerrada && t.reabre) t.reabre();
      t.teclea(actual, true);
      // la orden se escribe sola: el teclado vuelve a las diapositivas (se pulsa en la terminal para seguir en ella)
      if (t.entrada) t.entrada.blur();
    }
    protege(tarjeta);
    alVer(el, () => { if (an && !an.error) pinta(); });
    carga(lineas[0]);
  }
  // letra de la línea grande: la más grande (entre max y min) con la que cabe en el ancho
  function ajustaLetra(caja, max, min) {
    caja.style.fontSize = max + 'px';
    const ancho = caja.clientWidth;
    if (!ancho) return;
    let f = max;
    while (f > min && caja.scrollWidth > ancho + 1) { f -= 2; caja.style.fontSize = f + 'px'; }
  }
  // rótulos centrados debajo de cada trozo; si dos se pisan, el segundo baja a otra fila
  function ponRotulos(linea, capa, lista) {
    capa.innerHTML = '';
    const filas = [];
    // los trozos y la capa de rótulos se miden respecto al mismo padre posicionado (.lvis-escena)
    const base = -capa.offsetLeft;
    lista.forEach((r) => {
      const t = linea.querySelector(`[data-i="${r.i}"]`);
      if (!t) return;
      const e = crea('span', 'lvis-rotulo ' + r.clase, esc(r.texto));
      capa.appendChild(e);
      const w = e.offsetWidth, c = base + t.offsetLeft + t.offsetWidth / 2;
      let x = Math.max(0, c - w / 2);
      let f = filas.findIndex((fin) => x > fin + 10);
      if (f < 0) { f = filas.length; filas.push(-1e9); }
      filas[f] = x + w;
      e.style.left = x + 'px';
      e.style.top = (f * 46) + 'px';
      e.style.setProperty('--centro', (c - x) + 'px');
    });
    capa.style.height = (Math.max(1, filas.length) * 46) + 'px';
  }

  /* ---------- 2. particiones ---------- */
  function montaParticiones(el) {
    const P = V.particiones;
    const est = P.nuevoDisco(el.dataset.disco || 40, el.dataset.ram || 4, el.dataset.firmware || 'uefi');
    P.aplicaPlan(est, el.dataset.plan || 'vacio');
    el.classList.add('lvis-particiones', 'lvis-tarjeta', 'lvis-montado');
    const fw = est.firmware === 'uefi' ? 'UEFI' : 'BIOS';
    el.innerHTML = `
      <div class="lvis-cab">
        <div class="lvis-planes" role="group" aria-label="Repartos de partida"></div>
        <p class="lvis-disco">Disco <b>sda</b> de <b>${gb(est.disco)}</b> · <b>${gb(est.ram)}</b> de RAM · firmware <b>${fw}</b></p>
      </div>
      <div class="lvis-barra-caja"><div class="lvis-barra"></div><div class="lvis-escala"><span>0</span><span>${gb(est.disco)}</span></div></div>
      <div class="lvis-abajo">
        <div class="lvis-ficha"></div>
        <div class="lvis-lado">
          <p class="lvis-subt">Así lo enseñaría <code>lsblk</code></p>
          <pre class="lvis-lsblk"></pre>
          <p class="lvis-nota-lsblk"></p>
          <p class="lvis-subt">Este reparto</p>
          <ul class="lvis-hechos"></ul>
        </div>
      </div>`;
    const $ = (s) => el.querySelector(s);
    const planes = $('.lvis-planes'), barra = $('.lvis-barra'), ficha = $('.lvis-ficha'), pre = $('.lvis-lsblk'), hechos = $('.lvis-hechos'), notaLsblk = $('.lvis-nota-lsblk');
    const PLANES = [['defecto', 'Lo que hace Ubuntu por defecto'], ['som', 'El plan de Ubuntu-SOM'], ['vacio', 'Vacío']];
    PLANES.forEach(([k, t]) => {
      const b = boton(t, 'btn-ghost', () => { P.aplicaPlan(est, k); elegida = est.partes.length ? 0 : -1; pinta(); parpadea(barra); });
      b.dataset.plan = k; planes.appendChild(b);
    });
    let elegida = est.partes.length ? 0 : -1;      // índice de la partición elegida; -1 = el espacio libre
    let recien = null;                             // id de la partición que acaba de cambiar

    function pinta() {
      planes.querySelectorAll('button').forEach((b) => { const on = b.dataset.plan === est.plan; b.classList.toggle('activo', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      if (elegida >= est.partes.length) elegida = est.partes.length - 1;
      if (elegida < 0 && P.libre(est) < 0.5 && est.partes.length) elegida = 0;
      pintaBarra(); pintaFicha();
      pre.textContent = P.lsblk(est);
      notaLsblk.innerHTML = esc(P.notaLsblk(est)).replace('lsblk', '<code>lsblk</code>');
      const hs = P.hechosReparto(est);
      hechos.innerHTML = hs.map((h) => `<li>${esc(h.t)}</li>`).join('') || '<li>El disco está vacío.</li>';
    }
    function pintaBarra() {
      barra.innerHTML = '';
      const l = P.libre(est);
      est.partes.forEach((p, i) => {
        const b = crea('div', `lvis-part part-${p.tipo}` + (i === elegida ? ' elegida' : '') + (p.id === recien ? ' lvis-recien' : ''));
        b.style.flexGrow = p.tam;
        b.setAttribute('role', 'button'); b.tabIndex = 0;
        b.setAttribute('aria-label', `${P.nombreParte(i)}, ${TIPOS[p.tipo].largo}, ${gb(p.tam)}`);
        b.innerHTML = `<span class="n">${P.nombreParte(i)}</span><b class="largo">${esc(TIPOS[p.tipo].nombre)}</b><b class="corto">${esc(TIPOS[p.tipo].corto)}</b><span class="t">${gb(p.tam)}</span>` +
          (p.tipo === 'raiz' && P.tieneSwapArchivo(est) ? `<span class="swapimg">/swap.img ${gb(P.swapArchivo(est.ram))}</span>` : '');
        const elige = () => { elegida = i; pinta(); };
        b.addEventListener('click', (e) => { e.stopPropagation(); elige(); });
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); elige(); } });
        // borde que se arrastra (y con las flechas, si tiene el foco)
        const h = crea('button', 'lvis-tirador'); h.type = 'button';
        h.setAttribute('aria-label', `Cambiar el tamaño de ${P.nombreParte(i)}: arrastra o usa las flechas`);
        h.innerHTML = '<i></i>';
        h.addEventListener('click', (e) => { e.stopPropagation(); });
        h.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); elegida = i; if (P.cambiaTam(est, i, p.tam + (e.key === 'ArrowLeft' ? -0.5 : 0.5))) { recien = p.id; } pinta(); const n = barra.querySelectorAll('.lvis-tirador')[i]; if (n) n.focus(); }
        });
        h.addEventListener('pointerdown', (e) => arrastra(e, i, h));
        b.appendChild(h);
        barra.appendChild(b);
      });
      if (l >= 0.5) {
        const f = crea('div', 'lvis-part part-libre' + (elegida === -1 ? ' elegida' : ''));
        f.style.flexGrow = l;
        f.setAttribute('role', 'button'); f.tabIndex = 0;
        f.innerHTML = `<b>Libre</b><span class="t">${gb(l)}</span>`;
        f.addEventListener('click', (e) => { e.stopPropagation(); elegida = -1; pinta(); });
        f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); elegida = -1; pinta(); } });
        barra.appendChild(f);
      }
      // las estrechas solo enseñan lo esencial
      barra.querySelectorAll('.lvis-part').forEach((b) => { b.classList.toggle('estrecha', b.offsetWidth < 200); b.classList.toggle('mini', b.offsetWidth < 190); });
      recien = null;
    }
    function arrastra(e, i, h) {
      e.preventDefault(); e.stopPropagation();
      const p = est.partes[i];
      const escala = barra.getBoundingClientRect().width / barra.offsetWidth || 1;
      const porGB = barra.offsetWidth / est.disco;
      const x0 = e.clientX, t0 = p.tam;
      elegida = i;
      try { h.setPointerCapture(e.pointerId); } catch (x) { /* sin captura */ }
      el.classList.add('arrastrando');
      const mueve = (ev) => {
        const dx = (ev.clientX - x0) / escala;
        // al arrastrar, de medio en medio GB; si se llega al final del espacio libre, todo lo que queda
        if (P.cambiaTam(est, i, Math.round((t0 + dx / porGB) * 2) / 2)) {
          // se repinta sin perder el tirador que se está arrastrando
          pintaBarraArrastre();
        }
      };
      const suelta = () => {
        el.classList.remove('arrastrando');
        h.removeEventListener('pointermove', mueve); h.removeEventListener('pointerup', suelta); h.removeEventListener('pointercancel', suelta);
        recien = p.id; pinta();
      };
      h.addEventListener('pointermove', mueve); h.addEventListener('pointerup', suelta); h.addEventListener('pointercancel', suelta);
    }
    // durante el arrastre solo cambian los anchos y los rótulos, no los elementos
    function pintaBarraArrastre() {
      const bs = barra.querySelectorAll('.lvis-part');
      est.partes.forEach((p, i) => { const b = bs[i]; if (!b) return; b.style.flexGrow = p.tam; b.querySelector('.t').textContent = gb(p.tam); });
      const l = P.libre(est);
      let f = barra.querySelector('.part-libre');
      if (l >= 0.5 && !f) { f = crea('div', 'lvis-part part-libre'); f.innerHTML = '<b>Libre</b><span class="t"></span>'; barra.appendChild(f); }
      if (f) { if (l < 0.5) f.remove(); else { f.style.flexGrow = l; f.querySelector('.t').textContent = gb(l); } }
      barra.querySelectorAll('.lvis-part').forEach((b) => { b.classList.toggle('estrecha', b.offsetWidth < 200); b.classList.toggle('mini', b.offsetWidth < 190); });
      pre.textContent = P.lsblk(est);
      notaLsblk.innerHTML = esc(P.notaLsblk(est)).replace('lsblk', '<code>lsblk</code>');
      const hs = P.hechosReparto(est);
      hechos.innerHTML = hs.map((x) => `<li>${esc(x.t)}</li>`).join('');
      const tam = ficha.querySelector('.lvis-tam input');
      if (tam && est.partes[elegida]) tam.value = numES(Math.round(est.partes[elegida].tam * 100) / 100);
      planes.querySelectorAll('button').forEach((b) => b.classList.toggle('activo', b.dataset.plan === est.plan));
    }
    function grupo(titulo, opciones, valor, f) {
      const g = crea('div', 'lvis-grupo');
      g.innerHTML = `<span class="lvis-gt">${esc(titulo)}</span>`;
      const c = crea('div', 'lvis-pastillas');
      opciones.forEach(([v, t, clase]) => {
        const b = crea('button', 'lvis-chip' + (clase ? ' ' + clase : '') + (v === valor ? ' activo' : ''));
        b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', v === valor ? 'true' : 'false');
        b.addEventListener('click', (e) => { e.stopPropagation(); f(v); });
        c.appendChild(b);
      });
      g.appendChild(c);
      return g;
    }
    function pintaFicha() {
      ficha.innerHTML = '';
      const l = P.libre(est);
      if (elegida < 0) {
        ficha.innerHTML = `<p class="lvis-ficha-tit"><i class="muestra part-libre"></i>${est.partes.length ? 'Espacio libre' : 'Disco vacío'} · ${gb(l)}</p>`;
        ficha.appendChild(grupo('Crear una partición aquí', Object.keys(TIPOS).filter((t) => t !== 'esp' || est.firmware === 'uefi').map((t) => [t, TIPOS[t].nombre, 'tipo-' + t]), null, (t) => {
          const p = P.añadeParte(est, t);
          if (p) { elegida = est.partes.indexOf(p); recien = p.id; }
          pinta();
        }));
        const ul = crea('ul', 'lvis-hechos');
        ul.innerHTML = P.hechosParte(est, -1).map((h) => `<li>${esc(h)}</li>`).join('');
        ficha.appendChild(ul);
        return;
      }
      const p = est.partes[elegida];
      const T = TIPOS[p.tipo];
      ficha.innerHTML = `<p class="lvis-ficha-tit"><i class="muestra part-${p.tipo}"></i>${P.nombreParte(elegida)} · ${esc(T.largo)}</p>`;
      ficha.appendChild(grupo('Tipo', Object.keys(TIPOS).map((t) => [t, TIPOS[t].nombre, 'tipo-' + t]), p.tipo, (t) => { P.cambiaTipo(est, elegida, t); recien = p.id; pinta(); }));
      if (T.fs.length > 1) ficha.appendChild(grupo('Sistema de archivos', T.fs.map((x) => [x, x]), p.fs, (x) => { p.fs = x; if (x === 'sin formato') p.montaje = 'ninguno'; est.plan = 'propio'; recien = p.id; pinta(); }));
      else ficha.appendChild(grupo('Sistema de archivos', [[p.fs, p.fs]], p.fs, () => {}));
      const montajes = p.fs === 'sin formato' ? ['ninguno'] : T.montaje;
      ficha.appendChild(grupo('Punto de montaje', montajes.map((x) => [x, x === '[SWAP]' ? 'ninguno: es intercambio' : x]), p.montaje, (x) => { p.montaje = x; est.plan = 'propio'; recien = p.id; pinta(); }));
      // tamaño: − / campo / + y quitar
      const t = crea('div', 'lvis-grupo lvis-tam');
      t.innerHTML = '<span class="lvis-gt">Tamaño</span>';
      const fila = crea('div', 'lvis-pastillas');
      const menos = boton('−', 'btn-ghost lvis-mas', () => { if (P.cambiaTam(est, elegida, p.tam - (p.tam <= 1 ? 0.5 : 1))) recien = p.id; pinta(); });
      const mas = boton('+', 'btn-ghost lvis-mas', () => { if (P.cambiaTam(est, elegida, p.tam + (p.tam < 1 ? 0.5 : 1))) recien = p.id; pinta(); });
      menos.setAttribute('aria-label', 'Más pequeña'); mas.setAttribute('aria-label', 'Más grande');
      menos.disabled = p.tam <= 0.5; mas.disabled = l < 0.5;
      const inp = crea('input', 'lvis-campo num'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.value = numES(Math.round(p.tam * 100) / 100); inp.setAttribute('aria-label', 'Tamaño en GB');
      const aplica = () => { const v = parseFloat(inp.value.replace(',', '.')); if (!isNaN(v)) { if (P.cambiaTam(est, elegida, v)) recien = p.id; } pinta(); };
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); aplica(); } });
      inp.addEventListener('change', aplica);
      const u = crea('span', 'lvis-unidad', 'GB');
      const quitar = boton('Quitar la partición', 'btn-ghost', () => { P.quitaParte(est, elegida); elegida = Math.min(elegida, est.partes.length - 1); if (elegida < 0 && P.libre(est) >= 0.5) elegida = -1; pinta(); });
      [menos, inp, u, mas, quitar].forEach((x) => fila.appendChild(x));
      t.appendChild(fila);
      ficha.appendChild(t);
      const ul = crea('ul', 'lvis-hechos');
      ul.innerHTML = P.hechosParte(est, elegida).map((h) => `<li>${esc(h)}</li>`).join('');
      ficha.appendChild(ul);
    }
    protege(el);
    pinta();
    alVer(el, () => pintaBarra());
  }

  /* ---------- 3. arranque: pantalla simulada ---------- */
  const lineasMensajes = (n, conOk) => {
    let s = '', t = 0.0;
    for (let i = 0; i < n; i++) {
      t += Math.random() * 0.4;
      const w = 30 + Math.floor(Math.random() * 60);
      s += conOk && i > n / 3 ? `<p><span class="ok">[  OK  ]</span><i style="width:${w}%"></i></p>` : `<p><span class="ts">[${t.toFixed(6).padStart(12, ' ')}]</span><i style="width:${w}%"></i></p>`;
    }
    return s;
  };
  // HTML de la pantalla en cada fase: apagado, uefi, grub (oculto o con menú), nucleo, systemd, gdm3, escritorio
  function htmlPantalla(f, o) {
    o = o || {};
    if (f === 'apagado') return '<div class="lvis-scr apagado"><span class="lvis-scr-nota">Apagada</span></div>';
    if (f === 'uefi') return '<div class="lvis-scr uefi"><span class="lvis-fabricante">logotipo del fabricante</span></div>';
    if (f === 'grub-oculto') return `<div class="lvis-scr negro"><span class="lvis-scr-nota">menú de GRUB oculto${o.cuenta > 0 ? ` · espera ${o.cuenta} s` : ''}</span></div>`;
    if (f === 'grub') {
      const ents = (o.entradas || []).map((e, i) => `<li class="${i === o.sel ? 'sel' : ''}" data-e="${i}">${i === o.sel ? '*' : ' '}${esc(e.titulo)}</li>`).join('');
      return `<div class="lvis-scr grub"><p class="g-cab">${esc(GRUB_TXT.cabecera)}</p><ul class="g-caja">${ents}</ul><p class="g-ayuda">${GRUB_TXT.ayuda.map(esc).join('<br>')}</p><p class="g-pie">${o.cuenta > 0 ? esc(GRUB_TXT.cuenta(o.cuenta)) : ''}</p></div>`;
    }
    if (f === 'nucleo' || f === 'systemd') {
      if (o.splash) return '<div class="lvis-scr splash"><span class="lvis-giro" aria-hidden="true"></span><span class="lvis-marca">ubuntu</span></div>';
      if (o.quiet) return '<div class="lvis-scr negro"><span class="lvis-cursor" aria-hidden="true">_</span></div>';
      return `<div class="lvis-scr mensajes">${lineasMensajes(f === 'nucleo' ? 9 : 11, f === 'systemd')}</div>`;
    }
    if (f === 'gdm3') return '<div class="lvis-scr gdm"><span class="hora">10:02</span><span class="avatar" aria-hidden="true"></span><span class="nombre">Alumno</span><span class="clave">Contraseña</span></div>';
    if (f === 'escritorio') return '<div class="lvis-scr escritorio"><span class="barra-sup"><span>Actividades</span><span>21 de nov 10:02</span><span></span></span><span class="dock"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="ventana"></span></div>';
    return '<div class="lvis-scr negro"></div>';
  }
  V.htmlPantalla = htmlPantalla;

  /* ---------- 3a. arranque en modo cadena ---------- */
  function montaCadena(el) {
    el.classList.add('lvis-cadena', 'lvis-tarjeta', 'lvis-montado');
    el.innerHTML = `
      <div class="lvis-cab"><div class="lvis-botones"></div><p class="lvis-estado" aria-live="polite"></p></div>
      <ol class="lvis-cajas"></ol>
      <div class="lvis-abajo"><div class="lvis-monitor"><div class="lvis-pantalla"></div></div><div class="lvis-lado"><div class="lvis-msg"></div><p class="lvis-pie-pantalla"></p></div></div>`;
    const $ = (s) => el.querySelector(s);
    const cajas = $('.lvis-cajas'), pantalla = $('.lvis-pantalla'), msg = $('.lvis-msg'), estadoEl = $('.lvis-estado'), botones = $('.lvis-botones');
    const pie = $('.lvis-pie-pantalla');
    const PIES = { apagado: 'Pantalla apagada.', uefi: 'El logotipo del fabricante, mientras el firmware comprueba el hardware.', 'grub-oculto': 'Negro: en Ubuntu-SOM el menú de GRUB está oculto.', grub: 'El menú de GRUB, con la entrada que arranca resaltada.', nucleo: 'El logotipo de Ubuntu mientras arranca el núcleo.', systemd: 'El logotipo de Ubuntu mientras systemd arranca los servicios.', gdm3: 'La pantalla de inicio de sesión.', escritorio: 'El escritorio de Ubuntu.' };
    const ENTRADAS = leeGrubCfg(grubCfgUbuntu(), plataformaDe(el.dataset.firmware)).entradas;
    // fase: -1 apagado, 0..5 cajas; estado: 'apagado' | 'andando' | 'pausa' | 'menu' | 'login' | 'fin'
    let fase = -1, estado = 'apagado', esc_ = false, tardeEsc = false, temp = null, resta = 0, desde = 0, vista = null, selMenu = 0;
    CADENA.forEach((c, i) => {
      const li = crea('li', 'lvis-caja');
      const b = crea('button', ''); b.type = 'button';
      b.innerHTML = `<span class="num">${i + 1}</span><b>${esc(c.nombre)}</b>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); vista = vista === i ? null : i; pinta(); });
      li.appendChild(b);
      cajas.appendChild(li);
    });
    const bEnc = boton('Encender', 'btn-primary', () => principal());
    const bEsc = boton('Pulsar Esc', 'btn-ghost', () => pulsaEsc());
    const bApagar = boton('Apagar', 'btn-ghost', () => apaga());
    [bEnc, bEsc, bApagar].forEach((b) => botones.appendChild(b));

    const para = () => { if (temp) { clearTimeout(temp); temp = null; } };
    function programa(ms) { para(); resta = ms; desde = Date.now(); temp = setTimeout(avanza, ms); }
    function avanza() {
      temp = null;
      const sig = fase + 1;
      if (sig >= CADENA.length) return;
      fase = sig; vista = null;
      if (fase > 2) tardeEsc = false;
      const c = CADENA[fase];
      if (c.id === 'grub' && esc_) { estado = 'menu'; selMenu = 0; pinta(); return; }
      if (c.id === 'gdm3') { estado = 'login'; pinta(); return; }
      if (c.id === 'escritorio') { estado = 'fin'; pinta(); return; }
      estado = 'andando';
      pinta();
      programa(reducido() ? Math.max(1200, c.ms) : c.ms);
    }
    function principal() {
      if (estado === 'apagado' || estado === 'fin') { arranca(false); return; }
      if (estado === 'andando') { para(); resta = Math.max(0, resta - (Date.now() - desde)); estado = 'pausa'; pinta(); return; }
      if (estado === 'pausa') { estado = 'andando'; pinta(); programa(resta || 300); return; }
      if (estado === 'menu') { eligeEntrada(selMenu); return; }
      if (estado === 'login') { avanza(); }
    }
    function arranca(conEsc) {
      para(); fase = -1; esc_ = conEsc; tardeEsc = false; vista = null; estado = 'andando';
      avanza();
    }
    function pulsaEsc() {
      if (estado === 'apagado' || estado === 'fin') { arranca(true); return; }
      const id = fase >= 0 ? CADENA[fase].id : null;
      if (id === 'uefi') { esc_ = true; tardeEsc = false; pinta(); return; }
      if (id === 'grub' && estado !== 'menu') { para(); esc_ = true; estado = 'menu'; selMenu = 0; pinta(); return; }
      if (estado === 'menu') return;
      tardeEsc = true; pinta();
    }
    function eligeEntrada(i) {
      selMenu = i;
      const e = ENTRADAS[i];
      if (!e || i !== 0) { estado = 'menu'; pinta(); msg.innerHTML = `<b>${esc(e ? e.titulo : '')}</b>: esta entrada no se simula aquí. Elige <b>Ubuntu</b>, o pruébala en tu máquina Ubuntu-SOM.`; return; }
      esc_ = false; estado = 'andando'; pinta(); programa(CADENA[fase].ms);
    }
    function apaga() { para(); fase = -1; estado = 'apagado'; esc_ = false; tardeEsc = false; vista = null; pinta(); }

    function pinta() {
      // cajas: hechas, la actual y la que se mira
      [...cajas.children].forEach((li, i) => {
        li.classList.toggle('hecha', i < fase || (i === fase && estado === 'fin'));
        li.classList.toggle('actual', i === fase && estado !== 'fin');
        li.classList.toggle('vista', i === vista);
        li.querySelector('button').setAttribute('aria-pressed', i === vista ? 'true' : 'false');
      });
      // pantalla
      const id = fase >= 0 ? CADENA[fase].id : 'apagado';
      const previa = vista !== null && (estado === 'apagado' || estado === 'fin' || estado === 'pausa');
      const mira = previa ? CADENA[vista].id : id;
      let f = mira;
      if (mira === 'grub') f = estado === 'menu' || previa ? 'grub' : 'grub-oculto';
      pantalla.innerHTML = htmlPantalla(f, { entradas: ENTRADAS, sel: selMenu, splash: true, quiet: true });
      pie.textContent = PIES[f] || '';
      pantalla.querySelectorAll('.g-caja li').forEach((li) => {
        li.addEventListener('click', (e) => { e.stopPropagation(); if (estado === 'menu') eligeEntrada(+li.dataset.e); });
      });
      el.classList.toggle('en-menu', estado === 'menu');
      // botones
      bEnc.textContent = { apagado: 'Encender', andando: 'Pausa', pausa: 'Seguir', menu: 'Intro: arrancar Ubuntu', login: 'Iniciar sesión', fin: 'Volver a encender' }[estado];
      bApagar.disabled = estado === 'apagado';
      bEsc.disabled = estado === 'menu' || estado === 'login';
      // estado y frase
      const nombre = fase >= 0 ? CADENA[fase].nombre : '';
      estadoEl.innerHTML = {
        apagado: 'El ordenador está <b>apagado</b>.',
        andando: `Arrancando: <b>${esc(nombre)}</b>${esc_ && id === 'uefi' ? ' · Esc pulsada' : ''}`,
        pausa: `En pausa en <b>${esc(nombre)}</b>`,
        menu: 'Parado en el <b>menú de GRUB</b>',
        login: 'Esperando a que <b>inicies sesión</b>',
        fin: 'Arranque <b>terminado</b>'
      }[estado];
      if (vista !== null) msg.innerHTML = `<span class="lvis-etq">${esc(CADENA[vista].nombre)}</span> ${esc(CADENA[vista].frase)}`;
      else if (estado === 'apagado') msg.innerHTML = 'Pulsa <b>Encender</b> para ver el arranque paso a paso, o pulsa una caja para leer qué hace. Con <b>Pulsar Esc</b> el arranque se para en el menú de GRUB.';
      else if (tardeEsc) msg.innerHTML = 'Llegas tarde: GRUB ya ha cargado el núcleo. El Esc hay que pulsarlo justo al encender. Pulsa <b>Apagar</b> y vuelve a probar.';
      else if (estado === 'menu') msg.innerHTML = `<span class="lvis-etq">GRUB</span> Con Esc, GRUB enseña su menú y espera. Elige una entrada o pulsa <b>Intro: arrancar Ubuntu</b>.`;
      else if (fase >= 0) {
        const c = CADENA[fase];
        msg.innerHTML = `<span class="lvis-etq">${esc(c.nombre)}</span> ${esc(c.frase)}` + (c.id === 'grub' ? ' En Ubuntu-SOM el menú está oculto: pasa sin que se vea.' : '') + (c.id === 'gdm3' ? ' Pulsa <b>Iniciar sesión</b>.' : '');
      }
    }
    protege(el);
    pinta();
  }

  /* ---------- 3b. vista «arranque» junto a la terminal ---------- */
  function vistaArranque(el, sis, opciones) {
    opciones = opciones || {};
    // todo va dentro de una caja propia: la terminal puede dar reglas a los hijos directos de su columna lateral
    el.innerHTML = `
      <div class="lvis-vista-arranque">
        <p class="lvis-vt">Al encender la máquina</p>
        <div class="lvis-monitor peq"><div class="lvis-pantalla"></div></div>
        <dl class="lvis-dl"></dl>
        <p class="lvis-franja" hidden>Has cambiado el archivo, pero el menú no se ha vuelto a fabricar.</p>
        <p class="lvis-nota" hidden>Se enseña el menú que fabrica Ubuntu por defecto: este sistema no tiene un grub.cfg con contenido.</p>
        <div class="lvis-botones"></div>
      </div>`;
    const $ = (s) => el.querySelector(s);
    const pantalla = $('.lvis-pantalla'), dl = $('.lvis-dl'), franja = $('.lvis-franja'), nota = $('.lvis-nota'), botones = $('.lvis-botones');
    let g = null, previo = null, temp = null, fase = null, cuenta = 0, conEsc = false, sel = 0, conMenu = false;
    // plataforma del equipo simulado: data-firmware de la terminal (uefi por defecto; bios = pc)
    const fw = (opciones.dataset && opciones.dataset.firmware) || (el.closest && el.closest('[data-firmware]') && el.closest('[data-firmware]').dataset.firmware) || 'uefi';
    const plataforma = plataformaDe(fw);
    const bRe = boton('Reiniciar la máquina', 'btn-primary', () => reinicia());
    const bEsc = boton('Pulsar Esc', 'btn-ghost', () => pulsaEsc());
    const bIntro = boton('Intro', 'btn-ghost', () => intro());
    [bRe, bEsc, bIntro].forEach((b) => botones.appendChild(b));
    const para = () => { if (temp) { clearTimeout(temp); temp = null; } };
    const luego = (f, ms) => { para(); temp = setTimeout(() => { temp = null; f(); }, ms); };

    function lee() {
      try { g = estadoArranque(sis, plataforma); } catch (e) { g = leeGrubCfg(grubCfgUbuntu(), plataforma); g.porDefectoUbuntu = true; g.desfasado = false; }
    }
    function pintaDatos() {
      const d = describeArranque(g);
      const ent = resumeEntradas(g.entradas);
      const filas = [['Menú', d.menu, 'menu'], ['Espera', d.espera, 'espera'], ['Arranca', d.arranca, 'arranca'], ['Pantalla', d.pantalla, 'pantalla'],
        ['Entradas', ent.join(' · '), 'entradas']];
      dl.innerHTML = filas.map(([k, v, c]) => `<div data-k="${c}"><dt>${esc(k)}</dt><dd>${c === 'entradas' ? ent.map((x) => `<span title="${esc(x)}">${esc(x)}</span>`).join('') : esc(v)}</dd></div>`).join('');
      if (previo) filas.forEach(([, v, c], i) => { if (previo[i] !== v) parpadea(dl.querySelector(`[data-k="${c}"]`)); });
      previo = filas.map((f) => f[1]);
      franja.hidden = !g.desfasado;
      nota.hidden = !g.porDefectoUbuntu;
    }
    // pantalla en reposo: lo que se vería en el momento del menú
    function pintaReposo() {
      fase = null; para();
      const visible = g.estilo === 'menu' && g.espera !== 0;
      pantalla.innerHTML = visible ? htmlPantalla('grub', { entradas: g.entradas, sel: g.indice, cuenta: g.espera > 0 ? g.espera : 0 }) : htmlPantalla('grub-oculto', { cuenta: g.estilo === 'hidden' ? g.espera : 0 });
      botonesFase();
    }
    function botonesFase() {
      bRe.textContent = fase && fase !== 'gdm3' ? 'Volver a empezar' : 'Reiniciar la máquina';
      bEsc.hidden = !(fase === 'uefi' || (fase === 'grub' && !conMenu));
      bIntro.hidden = !(fase === 'grub' && conMenu);
    }
    /* reinicio: firmware → GRUB (menú fijo con Esc, menú con cuenta atrás, oculto con espera o nada) → núcleo →
     * systemd → inicio de sesión */
    function reinicia() { lee(); pintaDatos(); conEsc = false; conMenu = false; fase = 'uefi'; pantalla.innerHTML = htmlPantalla('uefi'); botonesFase(); luego(trasFirmware, 1600); }
    function trasFirmware() {
      sel = g.indice;
      if (conEsc) { menuFijo(); return; }
      if (g.estilo === 'menu' && g.espera !== 0) { cuenta = g.espera; menuCuenta(); return; }
      if (g.estilo !== 'menu' && g.espera > 0) { cuenta = g.espera; ocultoCuenta(); return; }
      nucleo();
    }
    function pintaMenu(c, pie) {
      fase = 'grub'; conMenu = true;
      pantalla.innerHTML = htmlPantalla('grub', { entradas: g.entradas, sel, cuenta: c });
      if (pie) pantalla.querySelector('.g-pie').textContent = pie;
      pantalla.querySelectorAll('.g-caja li').forEach((li) => li.addEventListener('click', (e) => { e.stopPropagation(); para(); sel = +li.dataset.e; intro(); }));
      botonesFase();
    }
    function menuFijo(pie) { para(); pintaMenu(0, pie); }
    function menuCuenta() {
      pintaMenu(cuenta > 0 ? cuenta : 0);
      if (g.espera < 0) return;                      // espera hasta que se elija
      luego(() => { cuenta--; if (cuenta <= 0) nucleo(); else menuCuenta(); }, 1000);
    }
    function ocultoCuenta() {
      fase = 'grub'; conMenu = false;
      pantalla.innerHTML = htmlPantalla('grub-oculto', { cuenta });
      botonesFase();
      luego(() => { cuenta--; if (cuenta <= 0) nucleo(); else ocultoCuenta(); }, 1000);
    }
    function nucleo() {
      fase = 'nucleo'; conMenu = false; botonesFase();
      pantalla.innerHTML = htmlPantalla('nucleo', g);
      luego(() => { fase = 'systemd'; pantalla.innerHTML = htmlPantalla('systemd', g); luego(() => { fase = 'gdm3'; pantalla.innerHTML = htmlPantalla('gdm3'); botonesFase(); }, 1800); }, 2000);
    }
    function pulsaEsc() {
      if (fase === 'uefi') { conEsc = true; bEsc.hidden = true; return; }
      if (fase === 'grub' && !conMenu) menuFijo();
    }
    function intro() {
      if (fase !== 'grub' || !conMenu) return;
      para();
      const e = g.entradas[sel];
      if (e && (e.tipo !== 'menuentry' || /UEFI/.test(e.titulo))) { menuFijo('Esta entrada no se simula aquí: elige la primera.'); return; }
      nucleo();
    }
    function actualiza(cambios, nuevo) {
      if (nuevo) sis = nuevo;
      const antes = g ? JSON.stringify([g.estilo, g.espera, g.indice, g.quiet, g.splash, g.entradas.map((e) => e.titulo), g.desfasado, g.porDefectoUbuntu]) : null;
      lee();
      const ahora = JSON.stringify([g.estilo, g.espera, g.indice, g.quiet, g.splash, g.entradas.map((e) => e.titulo), g.desfasado, g.porDefectoUbuntu]);
      pintaDatos();
      if (antes !== ahora || !fase) pintaReposo();
      if (antes && antes !== ahora) parpadea(el.querySelector('.lvis-monitor'));
      void cambios;
    }
    protege(el);
    lee(); pintaDatos(); pintaReposo();
    return { actualiza, el };
  }
  SOM.linux.vistas = SOM.linux.vistas || {};
  SOM.linux.vistas.arranque = vistaArranque;

  /* Puente mientras la terminal no monta vistas por sí misma: si una <div class="term" data-vista="arranque"> no tiene
   * la vista dentro cuando ya está montada, se monta aquí en su columna lateral y se actualiza tras cada orden. */
  function puenteVistas() {
    document.querySelectorAll('.term[data-vista="arranque"]').forEach((el) => {
      const t = el._terminal;
      if (!t || el.querySelector('.lvis-vista-arranque')) return;
      let lado = el.querySelector('.term-lado');
      if (!lado) { lado = crea('div', 'term-lado'); el.appendChild(lado); }
      const caja = crea('div', '');
      lado.appendChild(caja);
      lado.hidden = false;
      el.classList.add('term-con-lado');
      const v = vistaArranque(caja, t.sis, { terminal: t });
      const tras = t.trasOrden.bind(t);
      t.trasOrden = (ej) => { tras(ej); v.actualiza((ej && ej.cambios) || [], t.sis); };
      const nueva = t.nuevaSesion.bind(t);
      t.nuevaSesion = () => { nueva(); v.actualiza([], t.sis); };
      t.vistaArranque = v;
    });
  }

  /* ---------- 4. linea ---------- */
  function montaLinea(el) {
    const F = V.formatos[el.dataset.formato || 'ls-l'];
    if (!F) { el.textContent = 'Formato de línea desconocido: ' + el.dataset.formato; return; }
    const propias = el.querySelector('.lvis-lineas');
    const lineas = propias ? [...propias.querySelectorAll('li')].map((li, i) => ({ nombre: li.dataset.nombre || 'Línea ' + (i + 1), orden: li.dataset.orden || '', linea: li.textContent.trim() })) : F.lineas;
    el.classList.add('lvis-linea', 'lvis-tarjeta', 'lvis-montado');
    el.innerHTML = `
      <div class="lvis-cab"><div class="lvis-sel" role="group" aria-label="Líneas"></div></div>
      <div class="lvis-escena"><p class="lvis-prompt"></p><div class="lvis-trozos"></div><div class="lvis-rotulos"></div></div>
      <div class="lvis-leyenda" role="group" aria-label="Campos"></div>
      <div class="lvis-msg"></div>
      <div class="lvis-botones"></div>`;
    const $ = (s) => el.querySelector(s);
    const sel = $('.lvis-sel'), prompt = $('.lvis-prompt'), trozosEl = $('.lvis-trozos'), rotulos = $('.lvis-rotulos'), leyenda = $('.lvis-leyenda'), msg = $('.lvis-msg'), botones = $('.lvis-botones');
    let actual = 0, t = null, elegido = null, encima = null, todos = false;
    const bTodos = boton('Enseñar todos los nombres', 'btn-ghost', () => { todos = !todos; pinta(); });
    const bOtra = boton('Otra línea', 'btn-ghost', () => carga((actual + 1) % lineas.length));
    botones.appendChild(bTodos); botones.appendChild(bOtra);
    lineas.forEach((l, i) => { const b = crea('button', 'lvis-chip'); b.type = 'button'; b.textContent = l.nombre; b.addEventListener('click', (e) => { e.stopPropagation(); carga(i); }); sel.appendChild(b); });
    const campo = (k) => F.campos.find((c) => c.clave === k);
    function carga(i) {
      actual = i; elegido = null; encima = null;
      t = F.trocea(lineas[i].linea);
      pinta();
    }
    function pinta() {
      sel.querySelectorAll('.lvis-chip').forEach((b, i) => { b.classList.toggle('activo', i === actual); b.setAttribute('aria-pressed', i === actual ? 'true' : 'false'); });
      bTodos.textContent = todos ? 'Ocultar los nombres' : 'Enseñar todos los nombres';
      const L = lineas[actual];
      prompt.innerHTML = L.orden ? `<span class="pr">alumno@som</span>:<span class="ru">~</span>$ ${esc(L.orden)}` : '';
      trozosEl.innerHTML = '';
      if (!t) { trozosEl.textContent = L.linea; msg.textContent = 'Esta línea no tiene el formato esperado.'; return; }
      t.trozos.forEach((x, i) => {
        if (!x.clave) { trozosEl.appendChild(document.createTextNode(x.texto)); return; }
        const b = crea('button', 'lvis-trozo campo-' + x.clave); b.type = 'button'; b.textContent = x.texto; b.dataset.i = i;
        const vis = todos || elegido === x.clave || encima === x.clave;
        b.classList.toggle('visto', vis); b.classList.toggle('elegido', elegido === x.clave);
        b.setAttribute('aria-pressed', elegido === x.clave ? 'true' : 'false');
        b.addEventListener('click', (e) => { e.stopPropagation(); elegido = elegido === x.clave ? null : x.clave; encima = null; pinta(); });
        b.addEventListener('mouseenter', () => { if (encima !== x.clave) { encima = x.clave; pintaSuave(); } });
        b.addEventListener('mouseleave', () => { if (encima === x.clave) { encima = null; pintaSuave(); } });
        trozosEl.appendChild(b);
      });
      ajustaLetra(trozosEl, 64, 30);
      leyenda.innerHTML = '';
      F.campos.filter((c) => t.trozos.some((x) => x.clave === c.clave)).forEach((c) => {
        const b = crea('button', 'lvis-chip campo-' + c.clave + (elegido === c.clave ? ' activo' : '')); b.type = 'button';
        b.innerHTML = `<i></i>${esc(c.rotulo)}`;
        b.addEventListener('click', (e) => { e.stopPropagation(); elegido = elegido === c.clave ? null : c.clave; pinta(); });
        leyenda.appendChild(b);
      });
      pintaSuave();
    }
    // solo lo que cambia al pasar el ratón: resaltes, rótulos y explicación
    function pintaSuave() {
      const k = encima || elegido;
      trozosEl.querySelectorAll('.lvis-trozo').forEach((b) => {
        const c = t.trozos[+b.dataset.i].clave;
        b.classList.toggle('visto', todos || c === elegido || c === encima);
        b.classList.toggle('encima', c === encima && c !== elegido);
      });
      const vis = t.trozos.map((x, i) => ({ x, i })).filter(({ x }) => x.clave && (todos || x.clave === elegido || x.clave === encima));
      requestAnimationFrame(() => ponRotulos(trozosEl, rotulos, vis.map(({ x, i }) => ({ i, texto: campo(x.clave).rotulo, clase: 'campo-' + x.clave }))));
      if (k) {
        const x = t.trozos.find((y) => y.clave === k);
        const c = campo(k);
        const frase = c.explica(x.texto, t.ctx);
        msg.innerHTML = `<span class="lvis-etq campo-${k}">${esc(c.rotulo)}</span> <code>${esc(x.texto)}</code>: ${esc(frase)}`;
      } else msg.innerHTML = 'Pulsa cada parte de la línea para ver qué dice. También puedes pulsar los nombres de abajo.';
    }
    protege(el);
    alVer(el, () => { if (t) pinta(); });
    carga(0);
  }

  /* ---------- montaje ---------- */
  const MONTA = { orden: montaOrden, particiones: montaParticiones, linea: montaLinea, arranque: (el) => montaCadena(el) };
  function init() {
    registra();
    document.querySelectorAll('.lvis[data-tipo]:not(.lvis-montado)').forEach((el) => {
      const f = MONTA[el.dataset.tipo];
      if (!f) { el.textContent = 'Simulador desconocido: ' + el.dataset.tipo; return; }
      try { f(el); } catch (e) { el.textContent = 'No se ha podido montar el simulador ' + el.dataset.tipo + '.'; if (window.console) console.error(e); }
    });
    setTimeout(puenteVistas, 0);
    vigila();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
