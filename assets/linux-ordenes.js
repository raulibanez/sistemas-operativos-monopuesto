/* Simulador de Linux · órdenes (1): internas de bash, archivos y carpetas, filtros de texto.
 * Cada orden es un generador function* (c) que recibe el contexto (c.args, c.sale, c.err, c.resuelve…) y
 * devuelve el código de salida. Los mensajes son los de Ubuntu 24.04 en español (coreutils 9.4, bash 5.2,
 * grep 3.11, findutils 4.9), copiados de la máquina de pruebas.
 */
(function (raiz) {
  'use strict';
  const SOM = (raiz.SOM = raiz.SOM || {});
  const L = (SOM.linux = SOM.linux || {});
  const U = L.util, ERR = L.ERR, ErrorSis = L.ErrorSis;
  const O = (L.ordenes = L.ordenes || {});
  const I = (L.internas = L.internas || {});

  /* ---------------- ayudas comunes ---------------- */
  const prueba = (n) => `Pruebe '${n} --help' para más información.\n`;
  const q = (s) => (/'/.test(s) ? '"' + s + '"' : "'" + s + "'");     // comillas de coreutils: 'nombre'
  const qq = (s) => '«' + s + '»';
  const comillasFind = (s) => '‘' + s + '’';
  // ¿la opción existe en Ubuntu? se mira en su --help (si está cargado); si no se sabe, se da por buena
  function opcionReal(nombre, op) {
    const h = L.ayuda && L.ayuda.help && L.ayuda.help[nombre];
    if (!h) return null;
    if (op.startsWith('--')) return new RegExp('(^|[\\s,\\[])' + op.replace(/[-]/g, '\\-') + '(?![\\w-])', 'm').test(h);
    return new RegExp('(^|[\\s,\\[])-' + op.replace(/^-/, '').replace(/[^\w]/g, '\\$&') + '(?![\\w-])', 'm').test(h.split('\n').map((l) => l.slice(0, 32)).join('\n'));
  }
  /* Opciones al estilo GNU: -la, -n 5, -n5, --lines=5, --all, prefijos únicos de las largas y "--".
   * spec: { cortas: 'alh', conArg: 'n', largas: {'all': 'a', 'lines': 'n=' (con argumento), 'color': 'color?' (argumento opcional)},
   *         codigo (de error, 1 por defecto), posix (las opciones solo antes de los operandos), numero (acepta -5 como -n 5) }
   * Devuelve {op, resto} o un número (código de error ya escrito). Las opciones que existen en Ubuntu pero no
   * en el simulador dan un aviso (y se devuelve el código 2). */
  function* opciones(c, spec) {
    const op = {}, resto = [];
    const cod = spec.codigo === undefined ? 1 : spec.codigo;
    const n = c.nombre;
    const args = c.args;
    const largas = spec.largas || {};
    const pon = (k, v) => { if (spec.listas && spec.listas.includes(k)) (op[k] = op[k] || []).push(v); else op[k] = v; };
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '--') { resto.push(...args.slice(i + 1)); break; }
      if (a === '--help') { yield* ayuda(c); return 0; }
      if (a === '--version') { c.aviso(`El simulador no copia la salida de ${n} --version.`); return 0; }
      if (a.startsWith('--') && a.length > 2) {
        const [nom, val] = a.slice(2).split(/=(.*)/s);
        let clave = Object.keys(largas).find((k) => k === nom);
        if (!clave) { const cand = Object.keys(largas).filter((k) => k.startsWith(nom)); if (cand.length === 1) clave = cand[0]; else if (cand.length > 1) { c.err(`${n}: option '--${nom}' is ambiguous; possibilities:${cand.map((x) => " '--" + x + "'").join('')}\n${prueba(n)}`); return cod; } }
        if (!clave) {
          yield { tipo: 'ayuda' };
          const real = opcionReal(n, '--' + nom);
          if (real) { c.sinOpcion('--' + nom); return 2; }
          c.err(`${n}: unrecognized option '${a}'\n${prueba(n)}`); return cod;
        }
        let dest = largas[clave];
        if (dest.endsWith('=')) {
          dest = dest.slice(0, -1);
          let v = val;
          if (v === undefined) { if (i + 1 >= args.length) { c.err(`${n}: option '--${clave}' requires an argument\n${prueba(n)}`); return cod; } v = args[++i]; }
          pon(dest, v);
        } else if (dest.endsWith('?')) pon(dest.slice(0, -1), val === undefined ? true : val);
        else { if (val !== undefined) { c.err(`${n}: option '--${clave}' doesn't allow an argument\n${prueba(n)}`); return cod; } pon(dest, true); }
        continue;
      }
      if (a[0] === '-' && a.length > 1 && !(spec.numero && /^-\d+$/.test(a) && false)) {
        if (spec.numero && /^-\d+$/.test(a)) { pon(spec.numero, a.slice(1)); continue; }
        if (spec.negativosSonOperandos && /^-\d/.test(a)) { resto.push(a); continue; }
        for (let j = 1; j < a.length; j++) {
          const ch = a[j];
          if ((spec.conArg || '').includes(ch)) {
            let v = a.slice(j + 1);
            if (!v) { if (i + 1 >= args.length) { c.err(`${n}: la opción requiere un argumento -- ${qq(ch)}\n${prueba(n)}`); return cod; } v = args[++i]; }
            pon(ch, v); break;
          }
          if ((spec.cortas || '').includes(ch)) { pon(ch, true); continue; }
          yield { tipo: 'ayuda' };
          const real = opcionReal(n, '-' + ch);
          if (real) { c.sinOpcion('-' + ch); return 2; }
          c.err(`${n}: opción incorrecta -- ${qq(ch)}\n${prueba(n)}`); return cod;
        }
        continue;
      }
      if (spec.posix) { resto.push(...args.slice(i)); break; }
      resto.push(a);
    }
    return { op, resto };
  }
  L.opciones = opciones;
  // idioma de los mensajes de una orden, como glibc: LC_ALL, después LC_MESSAGES y después LANG
  L.idiomaDe = (env) => {
    const v = (env && (env.LC_ALL || env.LC_MESSAGES || env.LANG)) || '';
    return /^es(_|$)/.test(v) ? 'es' : /^(C|POSIX)(\.|$)|^en(_|$)/.test(v) || v === '' ? 'en' : 'otro';
  };
  // texto de --help (de linux-ayuda.js, que se carga al pedirlo)
  function* ayuda(c, nombre) {
    nombre = nombre || c.nombre;
    if (L.idiomaDe(c.env) !== 'es') { c.aviso(`El simulador solo tiene la ayuda de ${nombre} en español. Con ${c.env.LC_ALL ? 'LC_ALL' : c.env.LC_MESSAGES ? 'LC_MESSAGES' : 'LANG'}=${c.env.LC_ALL || c.env.LC_MESSAGES || c.env.LANG || ''}, tu Ubuntu la da en inglés.`); return 0; }
    yield { tipo: 'ayuda' };
    if (L.registra) L.registra(c.sis, { tipo: 'ayuda', programa: '--help', tema: nombre });
    const h = L.ayuda && L.ayuda.help && L.ayuda.help[nombre];
    if (h === undefined) { c.aviso(`El simulador no tiene el texto de ayuda de ${nombre}. En tu Ubuntu, ${nombre} --help lo enseña.`); return 0; }
    c.sale(h);
    return 0;
  }
  L.ayudaDe = ayuda;
  const errSis = (e) => ERR[e.codigo] || e.message;
  // lee un archivo para una orden: devuelve el texto o lanza ErrorSis (los programas y archivos sin contenido dan aviso)
  function leeArchivo(c, ruta, opc) {
    const r = c.resuelve(ruta);
    const ino = r.ino;
    if (ino.tipo === 'd') throw new ErrorSis('EISDIR', ruta);
    if (!c.fs.puede(c.cred, ino, 'r')) throw new ErrorSis('EACCES', ruta);
    if (ino.tipo === 'c') {
      const m = ino.rdev[1];
      if (m === 3) return '';
      if ((opc || {}).dispositivo) return null;
      c.aviso(`${ruta} no se acaba nunca: el simulador no lo lee.`);
      return '';
    }
    if (ino.tipo === 'b') { c.aviso(`${ruta} es un disco entero: el simulador no guarda su contenido.`); return ''; }
    if (ino.elf) { c.aviso(`${ruta} es un programa (binario): el simulador no guarda su contenido. En tu Ubuntu saldrían caracteres raros.`); return ''; }
    if (ino.tam !== undefined && !ino.datos) { c.aviso(`El simulador no guarda el contenido de ${ruta}.`); return ''; }
    ino.atime = c.ahora();
    return ino.datos || '';
  }
  L.leeArchivo = leeArchivo;
  // lee los archivos de los operandos (o la entrada estándar): genera [{nombre, texto}] y escribe los errores
  function* entradas(c, archivos, mensaje) {
    const lista = archivos.length ? archivos : ['-'];
    const salida = [];
    let fallo = false;
    for (const f of lista) {
      if (f === '-') { salida.push({ nombre: '-', texto: yield* c.leeTodo(), estandar: true }); continue; }
      try { salida.push({ nombre: f, texto: leeArchivo(c, f) }); }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; fallo = true; c.err(mensaje(f, errSis(e), e)); }
    }
    return { lista: salida, fallo };
  }
  const lineas = (t) => { if (t === '') return []; const l = t.split('\n'); if (l[l.length - 1] === '') l.pop(); return l; };
  const conFin = (t) => (t === '' || t.endsWith('\n') ? t : t + '\n');

  /* colores de ls y tree: LS_COLORS */
  function coloresLs(env) {
    const m = {};
    (env.LS_COLORS || '').split(':').forEach((p) => { const [k, v] = p.split('='); if (k && v !== undefined) m[k] = v; });
    return m;
  }
  function colorDe(col, nombre, ino, destinoIno) {
    if (!ino) return col.mi || null;
    switch (ino.tipo) {
      case 'd': {
        const ow = ino.modo & 0o002, st = ino.modo & 0o1000;
        if (ow && st) return col.tw; if (ow) return col.ow; if (st) return col.st;
        return col.di;
      }
      case 'l': return destinoIno === null ? (col.or || col.ln) : col.ln;
      case 'c': return col.cd; case 'b': return col.bd; case 'p': return col.pi; case 's': return col.so;
    }
    if (ino.modo & 0o4000) return col.su;
    if (ino.modo & 0o2000) return col.sg;
    if (ino.modo & 0o111) return col.ex;
    const ext = Object.keys(col).filter((k) => k[0] === '*' && nombre.toLowerCase().endsWith(k.slice(1).toLowerCase())).sort((a, b) => b.length - a.length)[0];
    return ext ? col[ext] : null;
  }
  const pinta = (txt, sgr) => (sgr && sgr !== '00' && sgr !== '0' ? `\x1b[${sgr}m${txt}\x1b[0m` : txt);
  L.coloresLs = coloresLs; L.colorDe = colorDe; L.pinta = pinta;

  function modoTexto(ino) {
    const t = ino.tipo === '-' ? '-' : ino.tipo;
    const m = ino.modo;
    const b = (k, ch) => (m & k ? ch : '-');
    let s = t + b(0o400, 'r') + b(0o200, 'w');
    s += m & 0o4000 ? (m & 0o100 ? 's' : 'S') : b(0o100, 'x');
    s += b(0o40, 'r') + b(0o20, 'w');
    s += m & 0o2000 ? (m & 0o10 ? 's' : 'S') : b(0o10, 'x');
    s += b(0o4, 'r') + b(0o2, 'w');
    s += m & 0o1000 ? (m & 0o1 ? 't' : 'T') : b(0o1, 'x');
    return s;
  }
  L.modoTexto = modoTexto;
  // nombre como lo enseña ls en una terminal: entre comillas si lleva espacios o caracteres especiales
  function citaLs(n) {
    if (!/[\s'"\\$`!*?&;|<>(){}\[\]#~]/.test(n)) return n;
    if (!n.includes("'")) return "'" + n + "'";
    return '"' + n.replace(/(["\\$`])/g, '\\$1') + '"';
  }

  /* ============================== internas de bash ============================== */
  const bashErr = (c, t) => c.err(c.sh.prefijo() + t + '\n');
  I.cd = function* (c) {
    const sh = c.sh;
    let args = c.args.slice(), fisico = false;
    while (args.length && /^-[LPe]+$/.test(args[0])) { if (args[0].includes('P')) fisico = true; args.shift(); }
    if (args[0] === '--') args.shift();
    if (args.length > 1) { bashErr(c, 'cd: demasiados argumentos'); return 1; }
    let dest = args[0];
    let mostrar = false;
    if (dest === undefined) { dest = sh.valor('HOME'); if (dest === undefined) { bashErr(c, 'cd: HOME no está establecido'); return 1; } if (dest === '') return 0; }
    else if (dest === '-') { dest = sh.valor('OLDPWD'); if (dest === undefined) { bashErr(c, 'cd: OLDPWD no está establecido'); return 1; } mostrar = true; }
    if (dest === '') return 0;
    const logica = dest[0] === '/' ? L.normaliza(dest) : L.normaliza((sh.pwd === '/' ? '' : sh.pwd) + '/' + dest);
    let ino;
    try { ino = c.fs.resuelve(fisico ? dest : logica, c.cred, { cwd: sh.cwdIno }).ino; }
    catch (e) {
      if (!(e instanceof ErrorSis)) throw e;
      // si el camino lógico falla, bash prueba el físico
      try { ino = c.fs.resuelve(dest, c.cred, { cwd: sh.cwdIno }).ino; fisico = true; }
      catch (e2) { bashErr(c, `cd: ${args[0] === '-' ? dest : args[0] === undefined ? dest : args[0]}: ${errSis(e2)}`); return 1; }
    }
    if (ino.tipo !== 'd') { bashErr(c, `cd: ${args[0] || dest}: No es un directorio`); return 1; }
    if (!c.fs.puede(c.cred, ino, 'x')) { bashErr(c, `cd: ${args[0] || dest}: Permiso denegado`); return 1; }
    sh.asigna('OLDPWD', sh.pwd, true);
    sh.cwdIno = ino.n;
    sh.pwd = fisico ? c.fs.rutaDe(ino.n) : logica;
    sh.asigna('PWD', sh.pwd, true);
    if (mostrar) c.sale(sh.pwd + '\n');
    return 0;
  };
  I.pwd = function* (c) {
    let fisico = false;
    for (const a of c.args) {
      if (a === '-P') fisico = true; else if (a === '-L') fisico = false;
      else if (a === '--help') { yield* ayuda(c, 'pwd'); return 0; }
      else if (a[0] === '-' && a.length > 1) { bashErr(c, `pwd: ${a.slice(0, 2)}: opción inválida`); c.err('pwd: modo de empleo: pwd [-LP]\n'); return 2; }
      else break;
    }
    c.sale((fisico ? c.fs.rutaDe(c.sh.cwdIno) : c.sh.pwd) + '\n');
    return 0;
  };
  O.pwd = function* (c) { c.sale(c.fs.rutaDe(c.sh.cwdIno) + '\n'); return 0; };
  function* echo(c) {
    let args = c.args.slice(), n = false, e = false;
    while (args.length && /^-[neE]+$/.test(args[0])) { for (const ch of args[0].slice(1)) { if (ch === 'n') n = true; else if (ch === 'e') e = true; else e = false; } args.shift(); }
    let txt = args.join(' ');
    if (e) {
      let corta = false;
      txt = txt.replace(/\\(0[0-7]{0,3}|x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{1,4}|.)/g, (m, s) => {
        if (corta) return '';
        if (s[0] === '0') return String.fromCharCode(parseInt(s.slice(1) || '0', 8));
        if (s[0] === 'x') return String.fromCharCode(parseInt(s.slice(1), 16));
        if (s[0] === 'u') return String.fromCharCode(parseInt(s.slice(1), 16));
        switch (s) { case 'n': return '\n'; case 't': return '\t'; case '\\': return '\\'; case 'a': return '\x07'; case 'b': return '\b'; case 'e': case 'E': return '\x1b'; case 'f': return '\f'; case 'r': return '\r'; case 'v': return '\v'; case 'c': corta = true; return ''; }
        return m;
      });
      if (corta) { const k = txt.length; c.sale(txt.slice(0, k)); return 0; }
    }
    c.sale(txt + (n ? '' : '\n'));
    return 0;
  }
  I.echo = echo; O.echo = echo;
  // printf con %s %d %i %f %x %o %c %b %% y anchos; el formato se repite mientras queden argumentos
  function* printf(c) {
    if (!c.args.length) { bashErr(c, 'printf: modo de empleo: printf [-v var] formato [argumentos]'); return 2; }
    const fmt = c.args[0], args = c.args.slice(1);
    const escapa = (s) => s.replace(/\\(0[0-7]{0,3}|[0-7]{1,3}|x[0-9a-fA-F]{1,2}|.)/g, (m, x) => {
      if (/^[0-7]/.test(x)) return String.fromCharCode(parseInt(x, 8));
      if (x[0] === 'x') return String.fromCharCode(parseInt(x.slice(1), 16));
      return { n: '\n', t: '\t', '\\': '\\', a: '\x07', b: '\b', e: '\x1b', f: '\f', r: '\r', v: '\v', '"': '"' }[x] ?? m;
    });
    let k = 0, salida = '', codigo = 0;
    do {
      let usados = 0;
      salida += fmt.replace(/%([-+ #0]*)(\d+|\*)?(?:\.(\d+))?([sdifxXoceEgGb%])|\\(0[0-7]{0,3}|[0-7]{1,3}|x[0-9a-fA-F]{1,2}|.)/g, (m, fl, an, pr, t, esc) => {
        if (esc !== undefined) return escapa('\\' + esc);
        if (t === '%') return '%';
        let v = args[k++]; usados++;
        if (v === undefined) v = '';
        let s;
        switch (t) {
          case 's': s = pr !== undefined ? v.slice(0, +pr) : v; break;
          case 'b': s = escapa(v); break;
          case 'c': s = v[0] || ''; break;
          case 'd': case 'i': {
            const nv = v === '' ? 0 : /^'/.test(v) ? v.charCodeAt(1) : parseInt(v, 10);
            if (Number.isNaN(nv)) { bashErr(c, `printf: ${v}: se esperaba una expresión numérica`); codigo = 1; s = '0'; break; }
            s = String(Math.abs(nv)); if (pr !== undefined) s = s.padStart(+pr, '0');
            if (nv < 0) s = '-' + s; else if (fl && fl.includes('+')) s = '+' + s;
            break;
          }
          case 'x': case 'X': case 'o': { const nv = parseInt(v || '0', 10) || 0; s = nv.toString(t === 'o' ? 8 : 16); if (t === 'X') s = s.toUpperCase(); break; }
          default: { const nv = parseFloat(String(v || '0').replace(',', '.')) || 0; s = t === 'e' || t === 'E' ? nv.toExponential(pr === undefined ? 6 : +pr) : nv.toFixed(pr === undefined ? 6 : +pr); s = s.replace('.', ','); }
        }
        const ancho = an === '*' ? 0 : +(an || 0);
        if (s.length < ancho) s = fl && fl.includes('-') ? s.padEnd(ancho) : (fl && fl.includes('0') && /[dif]/.test(t) ? s.padStart(ancho, '0') : s.padStart(ancho));
        return s;
      });
      if (!usados) break;
    } while (k < args.length);
    c.sale(salida);
    return codigo;
  }
  I.printf = printf; O.printf = printf;
  I.true = function* () { return 0; }; I.false = function* () { return 1; }; I[':'] = function* () { return 0; };
  O.true = I.true; O.false = I.false;
  I.history = function* (c) {
    const sh = c.sh;
    const a = c.args;
    if (a[0] === '-c') { sh.hist.length = 0; sh.histBase = 0; return 0; }
    if (a[0] === '-d') {
      const n = +a[1];
      if (!a[1] || Number.isNaN(n) || n - sh.histBase < 1 || n - sh.histBase > sh.hist.length) { bashErr(c, `history: ${a[1] || ''}: posición en el historial fuera de rango`); return 1; }
      sh.hist.splice(n - sh.histBase - 1, 1); return 0;
    }
    if (a[0] && a[0][0] === '-') { c.aviso(`El simulador no tiene la opción ${a[0]} de history.`); return 2; }
    let desde = 0;
    if (a[0] !== undefined) {
      if (!/^\d+$/.test(a[0])) { bashErr(c, `history: ${a[0]}: se requiere un argumento numérico`); return 2; }
      desde = Math.max(0, sh.hist.length - +a[0]);
    }
    let t = '';
    for (let i = desde; i < sh.hist.length; i++) t += String(sh.histBase + i + 1).padStart(5) + '  ' + sh.hist[i] + '\n';
    c.sale(t);
    return 0;
  };
  const citaAlias = (v) => "'" + v.replace(/'/g, "'\\''") + "'";
  I.alias = function* (c) {
    const sh = c.sh;
    const args = c.args.filter((x) => x !== '-p');
    if (!args.length) { [...sh.alias.keys()].sort().forEach((k) => c.sale(`alias ${k}=${citaAlias(sh.alias.get(k))}\n`)); return 0; }
    let cod = 0;
    for (const a of args) {
      const m = a.match(/^([^=]+)=([\s\S]*)$/);
      if (m) {
        if (/[\s\/$`=|&;<>()"'\\]/.test(m[1])) { bashErr(c, `alias: \`${m[1]}': nombre de alias inválido`); cod = 1; continue; }
        sh.alias.set(m[1], m[2]); continue;
      }
      if (sh.alias.has(a)) c.sale(`alias ${a}=${citaAlias(sh.alias.get(a))}\n`);
      else { bashErr(c, `alias: ${a}: no encontrado`); cod = 1; }
    }
    return cod;
  };
  I.unalias = function* (c) {
    const sh = c.sh;
    if (!c.args.length) { c.err('unalias: modo de empleo: unalias [-a] nombre [nombre ...]\n'); return 2; }
    if (c.args[0] === '-a') { sh.alias.clear(); return 0; }
    let cod = 0;
    for (const a of c.args) { if (sh.alias.has(a)) sh.alias.delete(a); else { bashErr(c, `unalias: ${a}: no encontrado`); cod = 1; } }
    return cod;
  };
  I.exit = function* (c) {
    const sh = c.sh;
    if (c.args.length > 1 && /^-?\d+$/.test(c.args[0])) { if (sh.interactiva) c.err('exit\n'); bashErr(c, 'exit: demasiados argumentos'); return 1; }
    let cod = sh.ultimo;
    if (c.args.length) {
      if (!/^-?\d+$/.test(c.args[0])) { if (sh.interactiva) c.err('exit\n'); bashErr(c, `exit: ${c.args[0]}: se requiere un argumento numérico`); throw new L.SalidaShell(2); }
      cod = ((+c.args[0] % 256) + 256) % 256;
    }
    if (sh.interactiva && !sh.esSub) c.err('exit\n');
    throw new L.SalidaShell(cod);
  };
  I.logout = function* (c) { if (!c.sh.esLogin) { bashErr(c, 'logout: no es un shell de entrada: use `exit\''); return 1; } return yield* I.exit(c); };
  I.export = function* (c) {
    const sh = c.sh;
    let args = c.args.slice(), quitar = false;
    while (args.length && args[0][0] === '-') { if (args[0] === '-n') quitar = true; else if (args[0] !== '-p') { bashErr(c, `export: ${args[0]}: opción inválida`); c.err('export: modo de empleo: export [-fn] [nombre[=valor] ...] o export -p\n'); return 2; } args.shift(); }
    if (!args.length) {
      [...sh.vars.keys()].filter((k) => sh.vars.get(k).exp).sort().forEach((k) => { const v = sh.vars.get(k).v; c.sale(v === undefined ? `declare -x ${k}\n` : `declare -x ${k}="${v.replace(/(["\\$`])/g, '\\$1')}"\n`); });
      return 0;
    }
    let cod = 0;
    for (const a of args) {
      const m = a.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:=([\s\S]*))?$/);
      if (!m) { bashErr(c, `export: \`${a}': no es un identificador válido`); cod = 1; continue; }
      if (quitar) { const v = sh.vars.get(m[1]); if (v) v.exp = false; continue; }
      if (m[2] !== undefined) sh.asigna(m[1], m[2], true);
      else { const v = sh.vars.get(m[1]); if (v) v.exp = true; else sh.vars.set(m[1], { v: undefined, exp: true }); }
    }
    return cod;
  };
  I.unset = function* (c) {
    const sh = c.sh;
    let args = c.args.slice(), func = false;
    if (args[0] === '-f') { func = true; args.shift(); } else if (args[0] === '-v') args.shift();
    for (const a of args) { if (func) sh.funciones.delete(a); else { sh.vars.delete(a); if (!func) sh.funciones.delete(a); } }
    return 0;
  };
  I.type = function* (c) {
    const sh = c.sh;
    let args = c.args.slice(), todos = false, corto = false;
    while (args.length && args[0][0] === '-') { if (args[0].includes('a')) todos = true; if (args[0].includes('t')) corto = true; args.shift(); }
    let cod = 0;
    for (const a of args) {
      let hay = false;
      if (sh.alias.has(a)) { c.sale(corto ? 'alias\n' : `${a} es un alias de \`${sh.alias.get(a)}'\n`); hay = true; if (!todos) continue; }
      if (['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'function', '{', '}', '!', 'in', 'time', '[[', ']]', 'select'].includes(a)) { c.sale(corto ? 'keyword\n' : `${a} es una palabra clave del intérprete\n`); hay = true; if (!todos) continue; }
      if (sh.funciones.has(a)) { c.sale(corto ? 'function\n' : `${a} es una función\n`); hay = true; if (!todos) continue; }
      if (I[a]) { c.sale(corto ? 'builtin\n' : `${a} es una orden interna del intérprete de ordenes\n`); hay = true; if (!todos) continue; }
      const rutas = buscaEnPath(c, a, todos);
      rutas.forEach((r) => c.sale(corto ? 'file\n' : (sh.hash && sh.hash.has(a) && !todos ? `${a} está asociado (${r})\n` : `${a} es ${r}\n`)));
      if (rutas.length) hay = true;
      if (!hay) { bashErr(c, `type: ${a}: no encontrado`); cod = 1; }
    }
    return cod;
  };
  function buscaEnPath(c, nombre, todos) {
    const r = [];
    if (nombre.includes('/')) { try { const x = c.resuelve(nombre); if (x.ino.tipo === '-' && c.fs.puede(c.cred, x.ino, 'x')) r.push(nombre); } catch (e) { /* no */ } return r; }
    for (const d of (c.sh.valor('PATH') || '').split(':')) {
      if (!d) continue;
      try { const x = c.fs.resuelve(d + '/' + nombre, c.cred); if (x.ino.tipo === '-' && c.fs.puede(c.cred, x.ino, 'x')) { r.push(d + '/' + nombre); if (!todos) break; } } catch (e) { /* no */ }
    }
    return r;
  }
  L.buscaEnPath = buscaEnPath;
  I.help = function* (c) {
    yield { tipo: 'ayuda' };
    c.args.forEach((x) => L.registra && L.registra(c.sis, { tipo: 'ayuda', programa: 'help', tema: x }));
    const textos = (L.ayuda && L.ayuda.internas) || {};
    if (!c.args.length) { c.aviso('El simulador no copia la lista completa de help. Prueba «help cd» o «help history».'); return 0; }
    let cod = 0;
    for (const a of c.args) {
      if (textos[a]) c.sale(textos[a]);
      else if (I[a]) c.aviso(`El simulador no tiene el texto de help ${a}.`);
      else { bashErr(c, `help: no hay temas de ayuda que coincidan con \`${a}'.  Pruebe \`help help' o \`man -k ${a}' o \`info ${a}'.`); cod = 1; }
    }
    return cod;
  };
  I.source = function* (c) {
    if (!c.args.length) { bashErr(c, `${c.nombre}: se requiere un argumento de nombre de fichero`); c.err(`${c.nombre}: modo de empleo: ${c.nombre} nombre_fichero [argumentos]\n`); return 2; }
    let texto;
    try { texto = leeArchivo(c, c.args[0]); }
    catch (e) { if (e instanceof ErrorSis) { bashErr(c, `${c.args[0]}: ${errSis(e)}`); return 1; } throw e; }
    const sh = c.sh;
    const guarda = sh.posicionales;
    if (c.args.length > 1) sh.posicionales = c.args.slice(1);
    try { return yield* sh.ejecutaTexto(texto, { script: c.args[0], alias: true }); }
    finally { sh.posicionales = guarda; }
  };
  I['.'] = I.source;
  I.umask = function* (c) {
    const sh = c.sh;
    const a = c.args.filter((x) => x !== '-p');
    const simb = a[0] === '-S';
    if (simb) a.shift();
    if (!a.length) {
      const m = sh.umask();
      if (simb) { const p = (v) => 'rwx'.split('').filter((ch, i) => !(v & (4 >> i))).join(''); c.sale(`u=${p((m >> 6) & 7)},g=${p((m >> 3) & 7)},o=${p(m & 7)}\n`); }
      else c.sale(m.toString(8).padStart(4, '0') + '\n');
      return 0;
    }
    if (!/^[0-7]{1,4}$/.test(a[0])) { c.aviso('El simulador solo entiende la máscara en octal (umask 022).'); return 1; }
    sh.mascara = parseInt(a[0], 8);
    return 0;
  };
  I.set = function* (c) {
    const sh = c.sh;
    if (!c.args.length) { [...sh.vars.keys()].sort(U.comparaLocale).forEach((k) => { const v = sh.vars.get(k).v; if (v !== undefined) c.sale(`${k}=${/[^\w\/.:,-]/.test(v) ? "'" + v.replace(/'/g, "'\\''") + "'" : v}\n`); }); return 0; }
    for (const a of c.args) {
      if (a === '-f' || a === '-o' && false) sh.noglob = true;
      else if (a === '+f') sh.noglob = false;
      else if (a === '-u') sh.opcionU = true; else if (a === '+u') sh.opcionU = false;
      else { c.aviso(`El simulador todavía no tiene «set ${a}».`); return 0; }
    }
    return 0;
  };
  I.shopt = function* (c) { c.aviso('El simulador no tiene las opciones de shopt.'); return 0; };
  I.read = function* (c) {
    const sh = c.sh;
    let args = c.args.slice(), prompt = '', crudo = false;
    while (args.length && args[0][0] === '-') {
      const o = args.shift();
      if (o === '-p') prompt = args.shift() || '';
      else if (o === '-r') crudo = true;
      else if (o === '-s') { /* sin eco: se trata igual */ }
      else { c.aviso(`El simulador no tiene la opción ${o} de read.`); return 2; }
    }
    if (prompt) c.err(prompt);
    let linea = yield* c.leeLinea(prompt, true);
    if (linea === null) return 1;
    if (!crudo) linea = linea.replace(/\\(.)/g, '$1');
    const nombres = args.length ? args : ['REPLY'];
    if (!args.length) { sh.asigna('REPLY', linea); return 0; }
    const ifs = sh.valor('IFS') === undefined ? ' \t\n' : sh.valor('IFS');
    let resto = linea.replace(new RegExp('^[' + ifs.replace(/[\]\\^-]/g, '\\$&') + ']+'), '');
    nombres.forEach((n, i) => {
      if (i === nombres.length - 1) { sh.asigna(n, resto.replace(/[ \t\n]+$/, '')); return; }
      const m = resto.match(new RegExp('^([^' + ifs.replace(/[\]\\^-]/g, '\\$&') + ']*)[' + ifs.replace(/[\]\\^-]/g, '\\$&') + ']*([\\s\\S]*)$'));
      sh.asigna(n, m ? m[1] : ''); resto = m ? m[2] : '';
    });
    return 0;
  };
  // test y [ (lo básico; las expresiones completas son de la UT7)
  function* test(c) {
    let a = c.args.slice();
    if (c.nombre === '[') { if (a[a.length - 1] !== ']') { bashErr(c, '[: falta un `]\''); return 2; } a.pop(); }
    const archivo = (op, f) => { let ino; try { ino = c.resuelve(f, { seguir: op !== '-h' && op !== '-L' }).ino; } catch (e) { return false; }
      switch (op) { case '-e': case '-a': return true; case '-f': return ino.tipo === '-'; case '-d': return ino.tipo === 'd'; case '-h': case '-L': return ino.tipo === 'l';
        case '-r': return c.fs.puede(c.cred, ino, 'r'); case '-w': return c.fs.puede(c.cred, ino, 'w'); case '-x': return c.fs.puede(c.cred, ino, 'x'); case '-s': return c.fs.tam(ino) > 0;
        case '-b': return ino.tipo === 'b'; case '-c': return ino.tipo === 'c'; case '-p': return ino.tipo === 'p'; case '-S': return ino.tipo === 's'; } return false; };
    const ent = (x) => { if (!/^\s*-?\d+\s*$/.test(x)) { bashErr(c, `${c.nombre}: ${x}: se esperaba una expresión entera`); throw new Error('test'); } return parseInt(x, 10); };
    const evalua = (t) => {
      if (t.length === 0) return false;
      if (t[0] === '!') return !evalua(t.slice(1));
      if (t.length === 1) return t[0] !== '';
      if (t.length === 2) {
        if (t[0] === '-z') return t[1] === ''; if (t[0] === '-n') return t[1] !== '';
        if (/^-[eafdhLrwxsbcpS]$/.test(t[0])) return archivo(t[0], t[1]);
        bashErr(c, `${c.nombre}: ${t[0]}: se esperaba un operador unario`); throw new Error('test');
      }
      const i = t.indexOf('-a') > 0 ? t.indexOf('-a') : -1, o = t.indexOf('-o') > 0 ? t.indexOf('-o') : -1;
      if (o > 0) return evalua(t.slice(0, o)) || evalua(t.slice(o + 1));
      if (i > 0) return evalua(t.slice(0, i)) && evalua(t.slice(i + 1));
      if (t.length === 3) {
        const [x, op, y] = t;
        switch (op) {
          case '=': case '==': return x === y; case '!=': return x !== y; case '<': return x < y; case '>': return x > y;
          case '-eq': return ent(x) === ent(y); case '-ne': return ent(x) !== ent(y); case '-lt': return ent(x) < ent(y);
          case '-le': return ent(x) <= ent(y); case '-gt': return ent(x) > ent(y); case '-ge': return ent(x) >= ent(y);
          case '-nt': case '-ot': case '-ef': c.aviso(`El simulador todavía no tiene ${op} en test.`); return false;
        }
        bashErr(c, `${c.nombre}: ${op}: se esperaba un operador binario`); throw new Error('test');
      }
      bashErr(c, `${c.nombre}: demasiados argumentos`); throw new Error('test');
    };
    try { return evalua(a) ? 0 : 1; } catch (e) { if (e.message === 'test') return 2; throw e; }
  }
  I.test = test; I['['] = test; O.test = test; O['['] = test;

  /* ============================== ls ============================== */
  O.ls = function* (c) {
    const r = yield* opciones(c, { cortas: 'aAlrthidR1CFSsnUxgoLGpQBkv', codigo: 2,
      largas: { all: 'a', 'almost-all': 'A', 'human-readable': 'h', inode: 'i', directory: 'd', recursive: 'R', reverse: 'r', classify: 'F', color: 'color?', 'full-time': 'fulltime', size: 's', 'numeric-uid-gid': 'n', dereference: 'L', 'group-directories-first': 'gdf', 'no-group': 'G', 'indicator-style': 'indicador=', sort: 'sort=', 'time-style': 'timestyle=', 'ignore-backups': 'B', 'quote-name': 'Q', 'si': 'si' } });
    if (typeof r === 'number') return r;
    const op = r.op;
    if (op.fulltime) { op.l = true; }
    if (op.g || op.o || op.n) op.l = true;
    if (op.sort === 'time') op.t = true; else if (op.sort === 'size') op.S = true; else if (op.sort === 'none') op.U = true;
    const colorOpc = op.color === undefined ? 'never' : op.color === true ? 'always' : op.color;
    const conColor = colorOpc === 'always' || colorOpc === 'yes' || colorOpc === 'force' || ((colorOpc === 'auto' || colorOpc === 'tty' || colorOpc === 'if-tty') && c.ttyOut);
    const col = conColor ? coloresLs(c.env) : null;
    const fs = c.fs, ahora = c.ahora();
    let cod = 0;
    const args = r.resto.length ? r.resto : ['.'];
    const archivos = [], dirs = [];
    for (const a of args) {
      let ino, enlace = null;
      try {
        const sinSeguir = c.resuelve(a, { seguir: false }).ino;
        if (sinSeguir.tipo === 'l' && !op.L && (op.d || op.l || op.F) && !a.endsWith('/')) { ino = sinSeguir; }
        else { ino = c.resuelve(a).ino; if (sinSeguir.tipo === 'l') enlace = sinSeguir; }
      } catch (e) {
        if (!(e instanceof ErrorSis)) throw e;
        // enlace roto: ls lo enseña (no se puede seguir)
        try { const s = c.resuelve(a, { seguir: false }).ino; if (s.tipo === 'l') { archivos.push({ nombre: a, ino: s }); continue; } } catch (e2) { /* no existe */ }
        c.err(`ls: no se puede acceder a ${q(a)}: ${errSis(e)}\n`); cod = 2; continue;
      }
      if (ino.tipo === 'd' && !op.d) dirs.push({ nombre: a, ino: fs.montado(ino) });
      else archivos.push({ nombre: a, ino, enlace });
    }
    const ordena = (lista) => {
      let l = lista.slice();
      if (!op.U) {
        l.sort((x, y) => U.comparaLocale(x.nombre, y.nombre));
        if (op.t) l.sort((x, y) => (y.ino.mtime - x.ino.mtime) || ((y.ino.mns || 0) - (x.ino.mns || 0)));
        else if (op.S) l.sort((x, y) => fs.tam(y.ino) - fs.tam(x.ino));
        if (op.r) l.reverse();
      }
      if (op.gdf) l = l.filter((x) => x.ino.tipo === 'd').concat(l.filter((x) => x.ino.tipo !== 'd'));
      return l;
    };
    const salida = [];
    const nombreVisible = (e, enDir) => {
      let n = c.ttyOut && !op.Q ? citaLs(e.nombre) : (op.Q ? '"' + e.nombre + '"' : e.nombre);
      let destIno = null;
      if (e.ino.tipo === 'l') { try { destIno = fs.resuelve(e.ino.destino, c.cred, { cwd: e.dirIno || c.cwd }).ino; } catch (x) { destIno = null; } }
      if (col) n = pinta(n, colorDe(col, e.nombre, e.ino, destIno));
      if (op.F || op.indicador === 'classify' || op.p) {
        const t = e.ino.tipo;
        if (t === 'd') n += '/';
        else if (!op.p && t === 'l' && !op.l) n += '@';
        else if (!op.p && t === '-' && (e.ino.modo & 0o111)) n += '*';
        else if (!op.p && t === 'p') n += '|';
        else if (!op.p && t === 's') n += '=';
      }
      if (op.l && e.ino.tipo === 'l') {
        let dest = e.ino.destino;
        if (col) dest = pinta(dest, destIno ? colorDe(col, dest, destIno) : (col.or || col.ln));
        n += ' -> ' + dest;
      }
      void enDir;
      return n;
    };
    const largo = (lista, total) => {
      const filas = lista.map((e) => {
        const i = e.ino;
        const tam = (i.tipo === 'c' || i.tipo === 'b') ? null : fs.tam(i);
        return {
          ino: String(i.n), bloques: String(Math.ceil(fs.bloques(i) / 2)), modo: modoTexto(i), enlaces: String(fs.numEnlaces(i)),
          dueño: op.n ? String(i.uid) : c.sis.nombreUid(i.uid), grupo: op.n ? String(i.gid) : c.sis.nombreGid(i.gid),
          tam: tam === null ? null : (op.h ? U.humano(tam) : String(tam)), mayor: i.rdev ? String(i.rdev[0]) : '', menor: i.rdev ? String(i.rdev[1]) : '',
          fecha: op.fulltime ? U.fechaLarga(i.mtime, i.mns) : U.fechaLs(i.mtime, ahora), nombre: nombreVisible(e, true)
        };
      });
      const w = (k) => Math.max(0, ...filas.map((f) => (f[k] || '').length));
      const wMay = w('mayor'), wMen = w('menor');
      const wTam = Math.max(w('tam'), filas.some((f) => f.tam === null) ? wMay + 2 + wMen : 0);
      if (total) salida.push('total ' + (op.h ? U.humano(lista.reduce((s, e) => s + Math.ceil(fs.bloques(e.ino) / 2), 0) * 1024) : lista.reduce((s, e) => s + Math.ceil(fs.bloques(e.ino) / 2), 0)));
      filas.forEach((f) => {
        let s = '';
        if (op.i) s += f.ino.padStart(w('ino')) + ' ';
        if (op.s) s += f.bloques.padStart(w('bloques')) + ' ';
        s += f.modo + ' ' + f.enlaces.padStart(w('enlaces')) + ' ';
        if (!op.g) s += f.dueño.padEnd(w('dueño')) + ' ';
        if (!op.o && !op.G) s += f.grupo.padEnd(w('grupo')) + ' ';
        s += (f.tam === null ? (f.mayor.padStart(wMay) + ', ' + f.menor.padStart(wMen)).padStart(wTam) : f.tam.padStart(wTam)) + ' ';
        s += f.fecha + ' ' + f.nombre;
        salida.push(s);
      });
    };
    const corto = (lista) => {
      if (!lista.length) return;
      let nombres = lista.map((e) => (op.i ? String(e.ino.n).padStart(Math.max(...lista.map((x) => String(x.ino.n).length))) + ' ' : '') + (op.s ? String(Math.ceil(fs.bloques(e.ino) / 2)).padStart(Math.max(...lista.map((x) => String(Math.ceil(fs.bloques(x.ino) / 2)).length))) + ' ' : '') + nombreVisible(e));
      // si alguno va entre comillas, los demás llevan un espacio delante para que queden alineados
      if (c.ttyOut && lista.some((e) => citaLs(e.nombre) !== e.nombre)) nombres = nombres.map((n, k) => (citaLs(lista[k].nombre) === lista[k].nombre ? ' ' + n : n));
      const columnas = op['1'] ? false : (op.C || op.x || c.ttyOut);
      if (!columnas) { nombres.forEach((n) => salida.push(n)); return; }
      salida.push(...enColumnas(nombres, c.columnas || 80, !!op.x));
    };
    const contenido = (d) => {
      const dir = d.ino;
      if (!fs.puede(c.cred, dir, 'r')) return null;
      let lista = fs.entradas(dir).map(([n, i]) => ({ nombre: n, ino: i, dirIno: dir.n }));
      if (!op.a && !op.A && !op.f) lista = lista.filter((e) => e.nombre[0] !== '.');
      if (op.B) lista = lista.filter((e) => !e.nombre.endsWith('~'));
      if (op.L) lista = lista.map((e) => { if (e.ino.tipo !== 'l') return e; try { return Object.assign({}, e, { ino: fs.resuelve(e.ino.destino, c.cred, { cwd: dir.n }).ino }); } catch (x) { return e; } });
      // . y .. se ordenan con los demás: sin signos de puntuación son nombres vacíos y quedan los primeros
      if (op.a || op.f) lista = [{ nombre: '.', ino: dir }, { nombre: '..', ino: fs.padreDe(dir) }].concat(lista);
      return ordena(lista);
    };
    const avisos = new Set();
    const listaDir = (d, cabecera) => {
      const lista = contenido(d);
      if (cabecera) salida.push((c.ttyOut ? citaLs(d.nombre) : d.nombre) + ':');
      if (lista === null) { flush(); c.err(`ls: no se puede abrir el directorio ${q(d.nombre)}: Permiso denegado\n`); cod = 2; return; }
      if (d.ino.aviso && !avisos.has(d.ino.aviso)) avisos.add(d.ino.aviso);
      if (op.l) largo(lista, true); else corto(lista);
      if (op.R) {
        lista.filter((e) => e.ino.tipo === 'd' && e.nombre !== '.' && e.nombre !== '..').forEach((e) => {
          salida.push('');
          listaDir({ nombre: (d.nombre.endsWith('/') ? d.nombre : d.nombre + '/') + e.nombre, ino: fs.montado(e.ino) }, true);
        });
      }
    };
    const flush = () => { if (salida.length) { c.sale(salida.join('\n') + '\n'); salida.length = 0; } };
    const archOrd = ordena(archivos);
    if (archOrd.length) { if (op.l) largo(archOrd, false); else corto(archOrd); }
    const dOrd = ordena(dirs);
    dOrd.forEach((d, k) => {
      if (archOrd.length || k > 0) salida.push('');
      listaDir(d, args.length > 1 || op.R);
    });
    flush();
    avisos.forEach((a) => c.aviso(a));
    return cod;
  };
  // nombres en columnas, como ls (de arriba abajo; con porFilas, de izquierda a derecha)
  function enColumnas(nombres, ancho, porFilas) {
    const n = nombres.length;
    const lon = nombres.map((x) => U.anchoTexto(x.replace(/\x1b\[[0-9;]*m/g, '')));
    let mejor = null;
    for (let cols = Math.min(n, Math.max(1, Math.floor(ancho / 3))); cols >= 1; cols--) {
      const filas = Math.ceil(n / cols);
      const usadas = porFilas ? cols : Math.ceil(n / filas);
      const w = Array(usadas).fill(0);
      for (let i = 0; i < n; i++) { const k = porFilas ? i % cols : Math.floor(i / filas); w[k] = Math.max(w[k], lon[i]); }
      const total = w.reduce((s, x) => s + x + 2, 0) - 2;
      if (total < ancho || cols === 1) { mejor = { filas: porFilas ? Math.ceil(n / cols) : filas, cols: usadas, w }; break; }
    }
    const out = [];
    for (let f = 0; f < mejor.filas; f++) {
      let s = '', col = 0;
      for (let k = 0; k < mejor.cols; k++) {
        const i = porFilas ? f * mejor.cols + k : k * mejor.filas + f;
        if (i >= n) continue;
        const ultimo = porFilas ? (k === mejor.cols - 1 || i === n - 1) : (k === mejor.cols - 1 || (k + 1) * mejor.filas + f >= n);
        s += nombres[i];
        if (!ultimo) {
          // como ls: el hueco hasta la columna siguiente se rellena con tabuladores (cada 8) y espacios
          let desde = col + lon[i];
          const hasta = col + mejor.w[k] + 2;
          while (desde < hasta) { if (Math.floor(hasta / 8) > Math.floor((desde + 1) / 8)) { s += '\t'; desde += 8 - (desde % 8); } else { s += ' '; desde++; } }
          col = hasta;
        }
      }
      out.push(s);
    }
    return out;
  }
  L.enColumnas = enColumnas;
  O.dir = O.ls;

  /* ============================== crear, copiar, mover, borrar ============================== */
  O.mkdir = function* (c) {
    const r = yield* opciones(c, { cortas: 'pv', conArg: 'm', largas: { parents: 'p', verbose: 'v', mode: 'm=' } });
    if (typeof r === 'number') return r;
    if (!r.resto.length) { c.err(`mkdir: falta un operando\n${prueba('mkdir')}`); return 1; }
    let modo = 0o777 & ~c.sh.umask();
    if (r.op.m !== undefined) { const m = parseModo(r.op.m, 0o777); if (m === null) { c.err(`mkdir: modo inválido ${qq(r.op.m)}\n`); return 1; } modo = m; }
    let cod = 0;
    for (const a of r.resto) {
      const partes = a.split('/');
      const pasos = r.op.p ? partes.map((x, i) => partes.slice(0, i + 1).join('/')).filter((x, i) => partes[i] !== '' && partes[i] !== '.' && partes[i] !== '..') : [a.replace(/\/+$/, '') || a];
      for (const p of pasos) {
        const ultimo = p === pasos[pasos.length - 1];
        try {
          const res = c.resuelve(p, { faltaUltimo: true });
          if (res.ino) {
            if (r.op.p && res.ino.tipo === 'd') continue;
            throw new ErrorSis('EEXIST');
          }
          if (!c.fs.puede(c.cred, res.padre, 'w')) throw new ErrorSis('EACCES');
          const padre = res.padre;
          const ino = c.fs.nuevo('d', ultimo || !r.op.p ? modo : (0o777 & ~c.sh.umask()) | 0o300, c.uid, padre.modo & 0o2000 ? padre.gid : c.sh.gid);
          if (padre.modo & 0o2000) ino.modo |= 0o2000;
          c.fs.enlaza(padre, res.nombre, ino, c.rutaAbs(p));
          if (r.op.v) c.sale(`mkdir: se ha creado el directorio ${q(p)}\n`);
        } catch (e) {
          if (!(e instanceof ErrorSis)) throw e;
          c.err(`mkdir: no se puede crear el directorio ${qq(p)}: ${errSis(e)}\n`); cod = 1; break;
        }
      }
    }
    return cod;
  };
  // modo de chmod/mkdir -m: octal o simbólico (u+x, go-w, a=r…)
  function parseModo(txt, base, esDir) {
    if (/^[0-7]{1,4}$/.test(txt)) return parseInt(txt, 8);
    let m = base;
    for (const parte of txt.split(',')) {
      const k = parte.match(/^([ugoa]*)([-+=])([rwxXst]*|[ugo])$/);
      if (!k) return null;
      const quien = k[1] || 'a';
      let bits = 0;
      for (const ch of k[3]) {
        if (ch === 'r') bits |= 0o444; if (ch === 'w') bits |= 0o222; if (ch === 'x') bits |= 0o111;
        if (ch === 'X' && (esDir || (base & 0o111))) bits |= 0o111;
        if (ch === 's') bits |= 0o6000; if (ch === 't') bits |= 0o1000;
      }
      let masc = 0;
      if (/[ua]/.test(quien)) masc |= 0o4700; if (/[ga]/.test(quien)) masc |= 0o2070; if (/[oa]/.test(quien)) masc |= 0o1007;
      bits &= masc;
      if (k[2] === '+') m |= bits; else if (k[2] === '-') m &= ~bits; else m = (m & ~masc) | bits;
    }
    return m;
  }
  L.parseModo = parseModo;
  O.rmdir = function* (c) {
    const r = yield* opciones(c, { cortas: 'pv', largas: { parents: 'p', verbose: 'v', 'ignore-fail-on-non-empty': 'ignorar' } });
    if (typeof r === 'number') return r;
    if (!r.resto.length) { c.err(`rmdir: falta un operando\n${prueba('rmdir')}`); return 1; }
    let cod = 0;
    const borra = (p, comoPadre) => {
      try {
        const res = c.resuelve(p, { seguir: false });
        const ino = res.ino;
        if (ino.tipo !== 'd') throw new ErrorSis('ENOTDIR');
        if (ino.hijos.size) throw new ErrorSis('ENOTEMPTY');
        if (!c.fs.puede(c.cred, res.padre, 'w')) throw new ErrorSis('EACCES');
        if (ino.n === c.sh.cwdIno && false) throw new ErrorSis('EBUSY');
        if (r.op.v) c.sale(`rmdir: borrando el directorio, ${q(p)}\n`);
        c.fs.desenlaza(res.padre, res.nombre, c.rutaAbs(p));
        return true;
      } catch (e) {
        if (!(e instanceof ErrorSis)) throw e;
        if (e.codigo === 'ENOTEMPTY' && r.op.ignorar) return false;
        c.err(`rmdir: fallo al borrar ${comoPadre ? 'el directorio ' : ''}${q(p)}: ${errSis(e)}\n`); cod = 1; return false;
      }
    };
    for (const a of r.resto) {
      let p = a.replace(/\/+$/, '');
      if (!borra(p, false)) continue;
      if (r.op.p) { while (p.includes('/')) { p = p.slice(0, p.lastIndexOf('/')); if (!p) break; if (!borra(p, true)) break; } }
    }
    return cod;
  };
  const siONo = (r) => r !== null && /^[sSyY]/.test(r.trim());
  const tipoParaPregunta = (c, ino) => ino.tipo === 'd' ? 'el directorio' : ino.tipo === 'l' ? 'el enlace simbólico' : ino.tipo === 'c' ? 'el fichero especial de caracteres' : ino.tipo === 'b' ? 'el fichero especial de bloques' : (c.fs.tam(ino) === 0 ? 'el fichero regular vacío' : 'el fichero regular');
  O.rm = function* (c) {
    const r = yield* opciones(c, { cortas: 'rRfivdI', largas: { recursive: 'r', force: 'f', interactive: 'interactivo?', verbose: 'v', dir: 'd', 'no-preserve-root': 'nopreserve', 'preserve-root': 'preserve' } });
    if (typeof r === 'number') return r;
    const op = r.op;
    if (op.R) op.r = true;
    if (op.interactivo === true || op.interactivo === 'always') op.i = true;
    // la última de -f e -i es la que manda
    const ultimaFI = c.args.slice().reverse().find((a) => /^-[^-]*[fi]/.test(a));
    if (ultimaFI && op.f && op.i) { const s = ultimaFI.replace(/[^fi]/g, ''); if (s[s.length - 1] === 'f') op.i = false; else op.f = false; }
    if (!r.resto.length) { if (op.f) return 0; c.err(`rm: falta un operando\n${prueba('rm')}`); return 1; }
    const fs = c.fs;
    let cod = 0;
    const pregunta = function* (texto) { c.err(texto); const resp = yield* c.leeLinea(texto, true); return siONo(resp); };
    const borraUno = function* (ruta, res) {
      const ino = res.ino;
      const padre = res.padre;
      if (!fs.puede(c.cred, padre, 'w') || !fs.puede(c.cred, padre, 'x')) { c.err(`rm: no se puede borrar ${q(ruta)}: Permiso denegado\n`); cod = 1; return false; }
      if ((padre.modo & 0o1000) && c.uid !== 0 && ino.uid !== c.uid && padre.uid !== c.uid) { c.err(`rm: no se puede borrar ${q(ruta)}: Operación no permitida\n`); cod = 1; return false; }
      if (op.i) { if (!(yield* pregunta(`rm: ¿borrar ${tipoParaPregunta(c, ino)} ${q(ruta)}? (s/n) `))) return false; }
      else if (!op.f && ino.tipo !== 'l' && !fs.puede(c.cred, ino, 'w') && c.ttyIn) {
        if (!(yield* pregunta(`rm: ¿borrar ${tipoParaPregunta(c, ino)} ${q(ruta)}  protegido contra escritura? (s/n) `))) return false;
      }
      fs.desenlaza(padre, res.nombre, c.rutaAbs(ruta));
      if (op.v) c.sale(ino.tipo === 'd' ? `removed directory ${q(ruta)}\n` : `${q(ruta)} borrado\n`);
      return true;
    };
    const recursivo = function* (ruta, res) {
      const ino = res.ino;
      if (op.i && ino.hijos.size) { if (!(yield* pregunta(`rm: ¿descender al directorio ${q(ruta)}? (s/n) `))) return false; }
      if (!fs.puede(c.cred, ino, 'r') || !fs.puede(c.cred, ino, 'x')) {
        if (ino.hijos.size) { c.err(`rm: no se puede borrar ${q(ruta)}: Permiso denegado\n`); cod = 1; return false; }
      }
      let todos = true;
      for (const [nom, n] of [...ino.hijos]) {
        const hijo = fs.ino(n);
        const r2 = { ino: hijo, padre: ino, nombre: nom };
        const sub = ruta.replace(/\/$/, '') + '/' + nom;
        const ok = hijo.tipo === 'd' ? yield* recursivo(sub, r2) : yield* borraUno(sub, r2);
        if (!ok) todos = false;
      }
      if (!todos) return false;
      return yield* borraUno(ruta, res);
    };
    for (const a of r.resto) {
      const limpio = a.replace(/\/+$/, '') || a;
      if (/(^|\/)\.\.?$/.test(limpio) && op.r) { c.err(`rm: refusing to remove '.' or '..' directory: skipping ${q(a)}\n`); cod = 1; continue; }
      let res;
      try { res = c.resuelve(limpio, { seguir: false }); }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; if (op.f && e.codigo === 'ENOENT') continue; c.err(`rm: no se puede borrar ${q(a)}: ${errSis(e)}\n`); cod = 1; continue; }
      if (res.ino.n === fs.raiz && op.r && !op.nopreserve) { c.err(`rm: es peligroso operar recursivamente en '/'\nrm: use --no-preserve-root para inhabilitar esta medida de seguridad\n`); cod = 1; continue; }
      if (res.ino.tipo === 'd') {
        if (!op.r) {
          if (op.d && !res.ino.hijos.size) { yield* borraUno(a, res); continue; }
          c.err(`rm: no se puede borrar ${q(a)}: Es un directorio\n`); cod = 1; continue;
        }
        if (res.ino.montaje !== undefined || res.ino.raizDe !== undefined) { c.err(`rm: no se puede borrar ${q(a)}: Dispositivo o recurso ocupado\n`); cod = 1; continue; }
        yield* recursivo(a, res);
      } else yield* borraUno(a, res);
    }
    return cod;
  };
  // copia un inodo (y su contenido) para cp
  function copiaIno(c, src, conservar) {
    const fs = c.fs;
    const extra = { datos: src.datos };
    if (src.tam !== undefined) extra.tam = src.tam;
    if (src.prog) extra.prog = src.prog;
    if (src.elf) extra.elf = true;
    if (src.tipoArchivo) extra.tipoArchivo = src.tipoArchivo;
    const n = fs.nuevo(src.tipo === 'l' ? 'l' : '-', conservar ? src.modo : src.modo & ~c.sh.umask() & 0o7777, conservar && c.uid === 0 ? src.uid : c.uid, conservar && c.uid === 0 ? src.gid : c.sh.gid, src.tipo === 'l' ? { destino: src.destino } : extra);
    if (conservar) { n.mtime = src.mtime; n.atime = src.atime; n.mns = src.mns; }
    return n;
  }
  O.cp = function* (c) {
    const r = yield* opciones(c, { cortas: 'rRpivfanuTt', conArg: 't', largas: { recursive: 'r', preserve: 'p?', interactive: 'i', verbose: 'v', force: 'f', archive: 'a', 'no-clobber': 'n', update: 'u?', 'target-directory': 't=', 'no-target-directory': 'T', 'no-dereference': 'P' } });
    if (typeof r === 'number') return r;
    const op = r.op;
    if (op.R || op.a) op.r = true;
    if (op.a) op.p = true;
    const fs = c.fs;
    let ops = r.resto.slice();
    if (op.t) ops.push(op.t);
    if (!ops.length) { c.err(`cp: falta un archivo como argumento\n${prueba('cp')}`); return 1; }
    if (ops.length === 1) { c.err(`cp: falta el operando archivo de destino después de ${q(ops[0])}\n${prueba('cp')}`); return 1; }
    const destino = ops.pop();
    let destIno = null;
    try { destIno = c.resuelve(destino).ino; } catch (e) { if (!(e instanceof ErrorSis)) throw e; if (e.codigo !== 'ENOENT' || ops.length > 1) { c.err(`cp: target ${q(destino)}: ${errSis(e)}\n`); return 1; } }
    if (ops.length > 1 && (!destIno || destIno.tipo !== 'd')) { c.err(destIno ? `cp: target ${q(destino)}: No es un directorio\n` : `cp: target ${q(destino)}: No existe el archivo o el directorio\n`); return 1; }
    const enDir = destIno && destIno.tipo === 'd' && !op.T;
    let cod = 0;
    const pregunta = function* (texto) { c.err(texto); return siONo(yield* c.leeLinea(texto, true)); };
    // copia src (inodo, con ruta para los mensajes) a la ruta dst
    const copia = function* (src, srcRuta, dstRuta) {
      let res;
      try { res = c.resuelve(dstRuta, { faltaUltimo: true }); }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`cp: no se puede efectuar \`stat' sobre ${q(dstRuta)}: ${errSis(e)}\n`); cod = 1; return; }
      if (!res.ino && !c.fs.puede(c.cred, res.padre, 'x')) { c.err(`cp: no se puede efectuar \`stat' sobre ${q(dstRuta)}: Permiso denegado\n`); cod = 1; return; }
      if (src.tipo === 'd') {
        if (res.ino && res.ino.n === src.n) { c.err(`cp: no se puede copiar un directorio, ${q(srcRuta)}, en sí mismo, ${q(dstRuta + '/' + srcRuta.split('/').pop())}\n`); cod = 1; return; }
        // ¿destino dentro del origen?
        let x = res.padre, vueltas = 0; while (x && vueltas++ < 100) { if (x.n === src.n) { c.err(`cp: no se puede copiar un directorio, ${q(srcRuta)}, dentro de sí mismo, ${q(dstRuta)}\n`); cod = 1; return; } if (x.n === fs.raiz) break; x = fs.padreDe(x); }
        let d = res.ino;
        if (d && d.tipo !== 'd') { c.err(`cp: no se puede sobreescribir el no directorio ${q(dstRuta)} con el directorio ${q(srcRuta)}\n`); cod = 1; return; }
        if (!d) {
          if (!fs.puede(c.cred, res.padre, 'w')) { c.err(`cp: no se puede crear el directorio ${q(dstRuta)}: Permiso denegado\n`); cod = 1; return; }
          d = fs.nuevo('d', op.p ? src.modo : src.modo & ~c.sh.umask(), op.p && c.uid === 0 ? src.uid : c.uid, op.p && c.uid === 0 ? src.gid : c.sh.gid);
          fs.enlaza(res.padre, res.nombre, d, c.rutaAbs(dstRuta));
          if (op.v) c.sale(`${q(srcRuta)} -> ${q(dstRuta)}\n`);
        }
        if (!fs.puede(c.cred, src, 'r')) { c.err(`cp: no se puede acceder a ${q(srcRuta)}: Permiso denegado\n`); cod = 1; return; }
        for (const [nom, n] of [...src.hijos]) yield* copia(fs.ino(n), srcRuta.replace(/\/$/, '') + '/' + nom, dstRuta.replace(/\/$/, '') + '/' + nom);
        if (op.p) { d.mtime = src.mtime; d.mns = src.mns; }
        return;
      }
      if (!fs.puede(c.cred, src, 'r') && src.tipo !== 'l') { c.err(`cp: no se puede abrir ${q(srcRuta)} para lectura: Permiso denegado\n`); cod = 1; return; }
      if (res.ino) {
        if (res.ino.n === src.n) { c.err(`cp: ${q(srcRuta)} y ${q(dstRuta)} son el mismo fichero\n`); cod = 1; return; }
        if (res.ino.tipo === 'd') { c.err(`cp: no se puede sobreescribir el directorio ${q(dstRuta)} con un no directorio\n`); cod = 1; return; }
        if (op.n) return;
        if (op.u && res.ino.mtime >= src.mtime) return;
        if (op.i && !(yield* pregunta(`cp: ¿sobreescribir ${q(dstRuta)}? (s/n) `))) return;
        if (!fs.puede(c.cred, res.ino, 'w')) {
          if (op.f) { fs.desenlaza(res.padre, res.nombre, c.rutaAbs(dstRuta)); }
          else { c.err(`cp: no se puede crear el fichero regular ${q(dstRuta)}: Permiso denegado\n`); cod = 1; return; }
        } else {
          fs.escribe(res.ino, src.datos || '', false, c.rutaAbs(dstRuta));
          if (src.tam !== undefined) res.ino.tam = src.tam; else delete res.ino.tam;
          res.ino.elf = src.elf; res.ino.prog = src.prog;
          if (op.p) { res.ino.mtime = src.mtime; res.ino.modo = src.modo; }
          if (op.v) c.sale(`${q(srcRuta)} -> ${q(dstRuta)}\n`);
          return;
        }
      }
      if (!fs.puede(c.cred, res.padre, 'w')) { c.err(`cp: no se puede crear el fichero regular ${q(dstRuta)}: Permiso denegado\n`); cod = 1; return; }
      const nuevo = copiaIno(c, src, op.p);
      fs.enlaza(res.padre, res.nombre, nuevo, c.rutaAbs(dstRuta));
      if (op.v) c.sale(`${q(srcRuta)} -> ${q(dstRuta)}\n`);
    };
    for (const s of ops) {
      let src;
      try { src = c.resuelve(s, { seguir: !(op.a || op.P) || !c.resuelve(s, { seguir: false }).ino || c.resuelve(s, { seguir: false }).ino.tipo !== 'l' }).ino; }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`cp: no se puede efectuar \`stat' sobre ${q(s)}: ${errSis(e)}\n`); cod = 1; continue; }
      if (src.tipo === 'd' && !op.r) { c.err(`cp: -r not specified; omitting directory ${q(s)}\n`); cod = 1; continue; }
      const base = s.replace(/\/+$/, '').split('/').pop();
      const dst = enDir ? destino.replace(/\/+$/, '') + '/' + base : destino;
      yield* copia(src, s, dst);
    }
    return cod;
  };
  O.mv = function* (c) {
    const r = yield* opciones(c, { cortas: 'ivfnuTt', conArg: 't', largas: { interactive: 'i', verbose: 'v', force: 'f', 'no-clobber': 'n', update: 'u?', 'target-directory': 't=', 'no-target-directory': 'T' } });
    if (typeof r === 'number') return r;
    const op = r.op, fs = c.fs;
    let ops = r.resto.slice();
    if (op.t) ops.push(op.t);
    if (!ops.length) { c.err(`mv: falta un archivo como argumento\n${prueba('mv')}`); return 1; }
    if (ops.length === 1) { c.err(`mv: falta el operando archivo de destino después de ${q(ops[0])}\n${prueba('mv')}`); return 1; }
    const destino = ops.pop();
    let destIno = null;
    try { destIno = c.resuelve(destino).ino; } catch (e) { if (!(e instanceof ErrorSis)) throw e; if (e.codigo !== 'ENOENT' || ops.length > 1) { c.err(`mv: target ${q(destino)}: ${errSis(e)}\n`); return 1; } }
    if (ops.length > 1 && (!destIno || destIno.tipo !== 'd')) { c.err(destIno ? `mv: target ${q(destino)}: No es un directorio\n` : `mv: target ${q(destino)}: No existe el archivo o el directorio\n`); return 1; }
    const enDir = destIno && destIno.tipo === 'd' && !op.T;
    let cod = 0;
    for (const s of ops) {
      let src;
      try { src = c.resuelve(s.replace(/\/+$/, '') || s, { seguir: false }); }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`mv: no se puede efectuar \`stat' sobre ${q(s)}: ${errSis(e)}\n`); cod = 1; continue; }
      const base = s.replace(/\/+$/, '').split('/').pop();
      const dst = enDir ? destino.replace(/\/+$/, '') + '/' + base : destino;
      let res;
      try { res = c.resuelve(dst, { faltaUltimo: true, seguir: false }); }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`mv: no se puede mover ${q(s)} a ${q(dst)}: ${errSis(e)}\n`); cod = 1; continue; }
      if (res.ino && res.ino.n === src.ino.n) { c.err(`mv: ${q(s)} y ${q(dst)} son el mismo fichero\n`); cod = 1; continue; }
      // un directorio dentro de sí mismo
      if (src.ino.tipo === 'd') {
        let x = res.padre, dentro = false, vueltas = 0;
        while (x && vueltas++ < 100) { if (x.n === src.ino.n) { dentro = true; break; } if (x.n === fs.raiz) break; x = fs.padreDe(x); }
        if (dentro) { c.err(`mv: no se puede mover ${q(s)} a un directorio de sí mismo, ${q(dst)}\n`); cod = 1; continue; }
      }
      if (!fs.puede(c.cred, src.padre, 'w') || !fs.puede(c.cred, res.padre, 'w')) { c.err(`mv: no se puede mover ${q(s)} a ${q(dst)}: Permiso denegado\n`); cod = 1; continue; }
      if ((src.padre.modo & 0o1000) && c.uid !== 0 && src.ino.uid !== c.uid && src.padre.uid !== c.uid) { c.err(`mv: no se puede mover ${q(s)} a ${q(dst)}: Operación no permitida\n`); cod = 1; continue; }
      if (res.ino) {
        if (op.n) continue;
        if (op.u && res.ino.mtime >= src.ino.mtime) continue;
        if (op.i) { c.err(`mv: ¿sobreescribir ${q(dst)}? (s/n) `); if (!siONo(yield* c.leeLinea('', true))) continue; }
        if (res.ino.tipo === 'd' && src.ino.tipo !== 'd') { c.err(`mv: no se puede sobreescribir el directorio ${q(dst)} con un no directorio\n`); cod = 1; continue; }
        if (res.ino.tipo !== 'd' && src.ino.tipo === 'd') { c.err(`mv: no se puede sobreescribir el no directorio ${q(dst)} con el directorio ${q(s)}\n`); cod = 1; continue; }
        if (res.ino.tipo === 'd' && res.ino.hijos.size) { c.err(`mv: no se puede mover ${q(s)} a ${q(dst)}: El directorio no está vacío\n`); cod = 1; continue; }
        fs.desenlaza(res.padre, res.nombre, c.rutaAbs(dst));
      }
      const ino = src.ino;
      ino.enlaces++;   // que no se borre al quitar el nombre viejo
      fs.desenlaza(src.padre, src.nombre, c.rutaAbs(s));
      ino.enlaces--;
      fs.enlaza(res.padre, res.nombre, ino, c.rutaAbs(dst));
      fs.inodos.set(ino.n, ino);
      ino.ctime = c.ahora();
      if (op.v) c.sale(`renamed ${q(s)} -> ${q(dst)}\n`);
    }
    return cod;
  };
  O.touch = function* (c) {
    const r = yield* opciones(c, { cortas: 'acmhf', conArg: 'dtr', largas: { 'no-create': 'c', date: 'd=', reference: 'r=', time: 'time=', 'no-dereference': 'h' } });
    if (typeof r === 'number') return r;
    const op = r.op;
    if (!r.resto.length) { c.err(`touch: falta un archivo como argumento\n${prueba('touch')}`); return 1; }
    let t = c.ahora();
    if (op.d !== undefined) { t = U.leeFecha(op.d, c.ahora()); if (t === null) { c.err(`touch: fecha inválida ${qq(op.d)}\n`); return 1; } }
    if (op.t !== undefined) { t = U.leeFechaT(op.t); if (t === null) { c.err(`touch: formato de fecha inválido ${qq(op.t)}\n`); return 1; } }
    if (op.r !== undefined) { try { t = c.resuelve(op.r).ino.mtime; } catch (e) { c.err(`touch: falló al obtener los atributos de ${q(op.r)}: ${errSis(e)}\n`); return 1; } }
    let cod = 0;
    for (const a of r.resto) {
      try {
        const res = c.resuelve(a, { faltaUltimo: true });
        let ino = res.ino;
        if (!ino) {
          if (op.c) continue;
          if (!c.fs.puede(c.cred, res.padre, 'w')) throw new ErrorSis('EACCES');
          if (a.endsWith('/')) throw new ErrorSis('ENOENT');
          ino = c.fs.nuevo('-', 0o666 & ~c.sh.umask(), c.uid, res.padre.modo & 0o2000 ? res.padre.gid : c.sh.gid, { datos: '' });
          c.fs.enlaza(res.padre, res.nombre, ino, c.rutaAbs(a));
        } else if (c.uid !== 0 && ino.uid !== c.uid && !c.fs.puede(c.cred, ino, 'w')) throw new ErrorSis('EACCES');
        const ns = op.d || op.t || op.r ? 0 : c.sis.ns();
        if (!op.m || op.a) { ino.atime = t; ino.ans = ns; }
        if (!op.a || op.m) { ino.mtime = t; ino.mns = ns; }
        ino.ctime = c.ahora();
        c.fs.avisa('cambia', c.rutaAbs(a), ino);
      } catch (e) {
        if (!(e instanceof ErrorSis)) throw e;
        c.err(`touch: no se puede efectuar \`touch' sobre ${q(a)}: ${errSis(e)}\n`); cod = 1;
      }
    }
    return cod;
  };
  O.ln = function* (c) {
    const r = yield* opciones(c, { cortas: 'sfvnrTt', conArg: 't', largas: { symbolic: 's', force: 'f', verbose: 'v', 'no-dereference': 'n', relative: 'r', 'target-directory': 't=' } });
    if (typeof r === 'number') return r;
    const op = r.op, fs = c.fs;
    let ops = r.resto.slice();
    if (!ops.length) { c.err(`ln: falta un archivo como argumento\n${prueba('ln')}`); return 1; }
    let destino;
    if (op.t) destino = op.t; else if (ops.length === 1) destino = '.'; else destino = ops.pop();
    let destIno = null;
    try { destIno = c.resuelve(destino, { seguir: !op.n }).ino; } catch (e) { /* no existe */ }
    const enDir = destIno && destIno.tipo === 'd' && (ops.length > 1 || op.t || ops.length === 1 && destino === '.' || true);
    let cod = 0;
    for (const s of ops) {
      const base = s.replace(/\/+$/, '').split('/').pop();
      const dst = enDir && destIno ? destino.replace(/\/+$/, '') + '/' + base : destino;
      try {
        let srcIno = null;
        if (!op.s) {
          try { srcIno = c.resuelve(s).ino; } catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`ln: fallo al acceder a ${q(s)}: ${errSis(e)}\n`); cod = 1; continue; }
          if (srcIno.tipo === 'd') { c.err(`ln: ${s}: no se permiten enlaces fuertes para directorios\n`); cod = 1; continue; }
        }
        const res = c.resuelve(dst, { faltaUltimo: true, seguir: false });
        if (res.ino) {
          if (!op.f) throw new ErrorSis('EEXIST');
          if (res.ino.tipo === 'd') throw new ErrorSis('EISDIR');
          fs.desenlaza(res.padre, res.nombre, c.rutaAbs(dst));
        }
        if (!fs.puede(c.cred, res.padre, 'w')) throw new ErrorSis('EACCES');
        if (op.s) {
          const l = fs.nuevo('l', 0o777, c.uid, c.sh.gid, { destino: s });
          fs.enlaza(res.padre, res.nombre, l, c.rutaAbs(dst));
        } else fs.enlaza(res.padre, res.nombre, srcIno, c.rutaAbs(dst));
        if (op.v) c.sale(`${q(dst)} -> ${q(s)}\n`);
      } catch (e) {
        if (!(e instanceof ErrorSis)) throw e;
        c.err(`ln: fallo al crear el enlace ${op.s ? 'simbólico' : 'duro'} ${q(dst)}${e.codigo === 'EEXIST' ? '' : ''}: ${errSis(e)}\n`); cod = 1;
      }
    }
    return cod;
  };

  /* ============================== ver y filtrar texto ============================== */
  O.cat = function* (c) {
    const r = yield* opciones(c, { cortas: 'nbsEATvuet', largas: { number: 'n', 'number-nonblank': 'b', 'squeeze-blank': 's', 'show-ends': 'E', 'show-all': 'A', 'show-tabs': 'T', 'show-nonprinting': 'v' } });
    if (typeof r === 'number') return r;
    const op = r.op;
    if (op.A) { op.E = op.T = op.v = true; } if (op.e) { op.E = op.v = true; } if (op.t) { op.T = op.v = true; }
    const archivos = r.resto.length ? r.resto : ['-'];
    let num = 0, cod = 0, vacioPrevio = false;
    const transforma = (t) => {
      if (!op.n && !op.b && !op.s && !op.E && !op.T) return t;
      const ls = t.split('\n');
      const ultima = ls.pop();
      let out = '';
      const procesa = (l, fin) => {
        if (op.s) { if (l === '') { if (vacioPrevio) return; vacioPrevio = true; } else vacioPrevio = false; }
        let x = l;
        if (op.T) x = x.replace(/\t/g, '^I');
        if (op.b) { if (l !== '') x = String(++num).padStart(6) + '\t' + x; }
        else if (op.n) x = String(++num).padStart(6) + '\t' + x;
        out += x + (fin ? (op.E ? '$' : '') + '\n' : '');
      };
      ls.forEach((l) => procesa(l, true));
      if (ultima !== '') procesa(ultima, false);
      return out;
    };
    for (const f of archivos) {
      if (f === '-') {
        const e = c.io.fd[0];
        if (e && e.tipo === 'term') {
          for (;;) { const l = yield* c.leeLinea('', true); if (l === null) break; c.sale(transforma(l + '\n')); }
        } else c.sale(transforma(yield* c.leeTodo()));
        continue;
      }
      try { c.sale(transforma(leeArchivo(c, f))); }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`cat: ${f}: ${errSis(e)}\n`); cod = 1; }
    }
    return cod;
  };
  O.head = function* (c) { return yield* cabezaCola(c, true); };
  O.tail = function* (c) { return yield* cabezaCola(c, false); };
  function* cabezaCola(c, cabeza) {
    const n = c.nombre;
    const r = yield* opciones(c, { cortas: 'qvfF', conArg: 'nc', numero: 'n', largas: { lines: 'n=', bytes: 'c=', quiet: 'q', silent: 'q', verbose: 'v', follow: 'f?', retry: 'retry' } });
    if (typeof r === 'number') return r;
    const op = r.op;
    if (op.F) op.f = true;
    let modo = 'n', valor = op.n !== undefined ? op.n : '10';
    if (op.c !== undefined) { modo = 'c'; valor = op.c; }
    // tail -n +3 (desde la línea 3) y head -n -3 (todas menos las 3 últimas)
    let desde = false, menos = false;
    let v = String(valor);
    if (!cabeza && v[0] === '+') { desde = true; v = v.slice(1); }
    else if (cabeza && v[0] === '-') { menos = true; v = v.slice(1); }
    else if (v[0] === '-' && !cabeza) v = v.slice(1);
    const m = v.match(/^(\d+)([kKMG]?)$/);
    if (!m) { c.err(`${n}: el número de ${modo === 'n' ? 'líneas' : 'bytes'} no es válido: ${qq(valor)}\n`); return 1; }
    const k = +m[1] * ({ k: 1024, K: 1024, M: 1048576, G: 1073741824 }[m[2]] || 1);
    const archivos = r.resto.length ? r.resto : ['-'];
    const cab = (op.v || archivos.length > 1) && !op.q;
    let cod = 0, primero = true;
    const corta = (t) => {
      if (modo === 'c') {
        const b = new TextEncoder().encode(t);
        const sl = cabeza ? (menos ? b.slice(0, Math.max(0, b.length - k)) : b.slice(0, k)) : (desde ? b.slice(Math.max(0, k - 1)) : b.slice(Math.max(0, b.length - k)));
        return new TextDecoder().decode(sl);
      }
      const partes = t.split('\n');
      const final = partes[partes.length - 1] === '' ? partes.pop() === '' : false;
      let sel;
      if (cabeza) sel = menos ? partes.slice(0, Math.max(0, partes.length - k)) : partes.slice(0, k);
      else sel = desde ? partes.slice(Math.max(0, k - 1)) : (k === 0 ? [] : partes.slice(-k));
      if (!sel.length) return '';
      const ultimaEsFinal = cabeza ? (menos ? true : sel.length === partes.length ? final : true) : final;
      return sel.join('\n') + (ultimaEsFinal ? '\n' : '');
    };
    for (const f of archivos) {
      let texto;
      if (f === '-') texto = yield* c.leeTodo();
      else {
        try { texto = leeArchivo(c, f); }
        catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`${n}: no se puede abrir ${q(f)} para lectura: ${errSis(e)}\n`); cod = 1; continue; }
      }
      if (cab) { c.sale((primero ? '' : '\n') + `==> ${f === '-' ? 'entrada estándar' : f} <==\n`); }
      primero = false;
      c.sale(corta(texto));
    }
    // tail -f: espera a que el archivo crezca hasta Ctrl+C
    if (!cabeza && op.f && archivos.length && archivos[0] !== '-') {
      if (!c.ttyOut && c.io.enTuberia) { c.nota('En tu Ubuntu, tail -f seguiría esperando; el simulador para aquí.'); return cod; }
      const f = archivos[archivos.length - 1];
      let ino; try { ino = c.resuelve(f).ino; } catch (e) { return cod; }
      let largo = (ino.datos || '').length;
      for (;;) {
        yield { tipo: 'espera', ms: 1000, seguir: true };
        const t = ino.datos || '';
        if (t.length > largo) { c.sale(t.slice(largo)); largo = t.length; }
        else if (t.length < largo) { c.err(`tail: ${f}: fichero truncado\n`); largo = t.length; }
      }
    }
    return cod;
  }
  O.wc = function* (c) {
    const r = yield* opciones(c, { cortas: 'lwcmL', largas: { lines: 'l', words: 'w', bytes: 'c', chars: 'm', 'max-line-length': 'L' } });
    if (typeof r === 'number') return r;
    let op = r.op;
    if (!op.l && !op.w && !op.c && !op.m && !op.L) op = { l: true, w: true, c: true };
    const archivos = r.resto.length ? r.resto : ['-'];
    const filas = [];
    let cod = 0, soloRegulares = true, sumaTam = 0;
    for (const f of archivos) {
      let t;
      if (f === '-') { t = yield* c.leeTodo(); soloRegulares = false; }
      else {
        try {
          const ino = c.resuelve(f).ino;
          if (ino.tipo === 'd') { c.err(`wc: ${f}: Es un directorio\n`); cod = 1; soloRegulares = false; filas.push({ nombre: f, l: 0, w: 0, m: 0, c: 0, L: 0 }); continue; }
          t = leeArchivo(c, f);
          sumaTam += c.fs.tam(ino);
        } catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`wc: ${f}: ${errSis(e)}\n`); cod = 1; continue; }
      }
      const l = (t.match(/\n/g) || []).length;
      const w = (t.match(/[^\s]+/g) || []).length;
      const L = Math.max(0, ...t.split('\n').map((x) => U.anchoTexto(x.replace(/\t/g, '        '))));
      filas.push({ nombre: f === '-' && !r.resto.length ? '' : f, l, w, m: [...t].length, c: U.bytes(t), L });
    }
    if (filas.length > 1) filas.push({ nombre: 'total', l: filas.reduce((s, x) => s + x.l, 0), w: filas.reduce((s, x) => s + x.w, 0), m: filas.reduce((s, x) => s + x.m, 0), c: filas.reduce((s, x) => s + x.c, 0), L: Math.max(...filas.map((x) => x.L)) });
    const claves = ['l', 'w', 'm', 'c', 'L'].filter((k) => op[k]);
    let ancho = 1;
    if (!(claves.length === 1 && archivos.length === 1)) ancho = soloRegulares ? Math.max(1, String(sumaTam).length) : 7;
    filas.forEach((x) => c.sale(claves.map((k) => String(x[k]).padStart(ancho)).join(' ') + (x.nombre ? ' ' + x.nombre : '') + '\n'));
    return cod;
  };
  // claves de sort -k N[.C][,M[.C]][n r]
  O.sort = function* (c) {
    const r = yield* opciones(c, { cortas: 'rucmnfbhsVM', conArg: 'tko', listas: ['k'], largas: { reverse: 'r', unique: 'u', check: 'c', merge: 'm', 'numeric-sort': 'n', 'ignore-case': 'f', 'field-separator': 't=', key: 'k=', output: 'o=', 'ignore-leading-blanks': 'b', 'human-numeric-sort': 'h', stable: 's', 'version-sort': 'V', 'month-sort': 'M' }, codigo: 2 });
    if (typeof r === 'number') return r;
    const op = r.op;
    if (op.t !== undefined && op.t.length !== 1) { c.err(op.t === '' ? 'sort: separador vacío\n' : `sort: separador con varios caracteres ${qq(op.t)}\n`); return 2; }
    const leidos = yield* entradas(c, r.resto, (f, m) => `sort: no se puede leer: ${f}: ${m}\n`);
    if (leidos.fallo) return 2;
    let filas = [];
    leidos.lista.forEach((x) => filas.push(...lineas(x.texto)));
    const claves = (op.k || []).map((k) => {
      const m = k.match(/^(\d+)(?:\.(\d+))?([a-zA-Z]*)(?:,(\d+)(?:\.(\d+))?([a-zA-Z]*))?$/);
      if (!m || +m[1] === 0) return null;
      return { f1: +m[1], c1: +(m[2] || 1), f2: m[4] ? +m[4] : null, c2: m[5] ? +m[5] : 0, n: /n/.test(m[3] + (m[6] || '')), r: /r/.test(m[3] + (m[6] || '')), b: /b/.test(m[3] + (m[6] || '')), f: /f/.test(m[3] + (m[6] || '')) };
    });
    if (claves.some((k) => k === null)) { c.err(`sort: posición de campo no válida: ${qq(op.k.find((k, i) => claves[i] === null))}\n`); return 2; }
    const campos = (l) => {
      if (op.t !== undefined) return l.split(op.t);
      const out = []; const re = /\s*\S*/g; let m; while ((m = re.exec(l)) && m[0] !== '') out.push(m[0]); return out.length ? out : [''];
    };
    const extrae = (l, k) => {
      const fs = campos(l);
      const sep = op.t !== undefined ? op.t : '';
      const hasta = k.f2 === null ? fs.length : Math.min(k.f2, fs.length);
      let s = fs.slice(k.f1 - 1, hasta).join(sep);
      if (k.b || op.b) s = s.replace(/^\s+/, '');
      return s;
    };
    const num = (s) => { const m = String(s).match(/^\s*(-?\d+(?:,\d+)?)/); return m ? parseFloat(m[1].replace(',', '.')) : 0; };
    const cmpTexto = (a, b, f) => (f ? U.comparaLocale(a.toLowerCase(), b.toLowerCase()) : U.comparaLocale(a, b));
    const compara = (a, b) => {
      if (claves.length) {
        for (const k of claves) {
          const x = extrae(a, k), y = extrae(b, k);
          let d = (k.n || op.n) ? num(x) - num(y) : cmpTexto(x, y, k.f || op.f);
          if (d && (k.n || op.n) === false && !(k.n || op.n)) d = d;
          if (k.r) d = -d;
          if (d) return d;
        }
        if (op.u || op.s) return 0;
        return U.comparaLocale(a, b);
      }
      let d = op.n ? num(a) - num(b) : cmpTexto(op.b ? a.replace(/^\s+/, '') : a, op.b ? b.replace(/^\s+/, '') : b, op.f);
      if (!d && !op.u && !op.s && op.n) d = U.comparaLocale(a, b);
      return d;
    };
    const signo = op.r ? -1 : 1;
    const cmp = (a, b) => signo * compara(a, b) || 0;
    if (op.c) {
      for (let i = 1; i < filas.length; i++) {
        const d = cmp(filas[i - 1], filas[i]);
        if (d > 0 || (op.u && d === 0)) { c.err(`sort: ${r.resto[0] || '-'}:${i + 1}: fuera de secuencia: ${filas[i]}\n`); return 1; }
      }
      return 0;
    }
    filas = filas.map((l, i) => [l, i]).sort((a, b) => cmp(a[0], b[0]) || a[1] - b[1]).map((x) => x[0]);
    if (op.u) filas = filas.filter((l, i) => i === 0 || compara(filas[i - 1], l) !== 0);
    const texto = filas.length ? filas.join('\n') + '\n' : '';
    if (op.o) {
      try {
        const res = c.resuelve(op.o, { faltaUltimo: true });
        let ino = res.ino;
        if (!ino) { if (!c.fs.puede(c.cred, res.padre, 'w')) throw new ErrorSis('EACCES'); ino = c.fs.nuevo('-', 0o664, c.uid, c.sh.gid, { datos: '' }); c.fs.enlaza(res.padre, res.nombre, ino, c.rutaAbs(op.o)); }
        c.fs.escribe(ino, texto, false, c.rutaAbs(op.o));
      } catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`sort: no se puede abrir: ${op.o}: ${errSis(e)}\n`); return 2; }
      return 0;
    }
    c.sale(texto);
    return 0;
  };
  // listas de cut: 1,3-5,7-
  function leeLista(txt) {
    const rangos = [];
    for (const p of String(txt).split(',')) {
      let m;
      if ((m = p.match(/^(\d+)$/))) rangos.push([+m[1], +m[1]]);
      else if ((m = p.match(/^(\d*)-(\d*)$/)) && (m[1] || m[2])) rangos.push([m[1] ? +m[1] : 1, m[2] ? +m[2] : Infinity]);
      else return null;
      if (rangos[rangos.length - 1][0] === 0) return 0;
    }
    return rangos;
  }
  O.cut = function* (c) {
    const r = yield* opciones(c, { cortas: 'snz', conArg: 'dfcb', largas: { delimiter: 'd=', fields: 'f=', characters: 'c=', bytes: 'b=', 'only-delimited': 's', complement: 'complemento', 'output-delimiter': 'od=' } });
    if (typeof r === 'number') return r;
    const op = r.op;
    const cuantas = ['f', 'c', 'b'].filter((k) => op[k] !== undefined);
    if (!cuantas.length) { c.err(`cut: se debe indicar una lista de bytes, caracteres o campos\n${prueba('cut')}`); return 1; }
    if (cuantas.length > 1) { c.err(`cut: solo se puede indicar un tipo de lista\n${prueba('cut')}`); return 1; }
    const tipo = cuantas[0];
    if (op.d !== undefined && tipo !== 'f') { c.err(`cut: un delimitador de entrada solo se puede especificar cuando se opera con campos\n${prueba('cut')}`); return 1; }
    if (op.d !== undefined && [...op.d].length !== 1) { c.err(`cut: el delimitador debe ser un único carácter\n${prueba('cut')}`); return 1; }
    const lista = leeLista(op[tipo]);
    if (lista === 0) { c.err(`cut: los campos y las posiciones se numeran desde 1\n${prueba('cut')}`); return 1; }
    if (!lista) { c.err(`cut: rango de bytes o caracteres inválido\n${prueba('cut')}`); return 1; }
    const dentro = (i) => { const d = lista.some(([a, b]) => i >= a && i <= b); return op.complemento ? !d : d; };
    const delim = op.d !== undefined ? op.d : '\t';
    const odelim = op.od !== undefined ? op.od : delim;
    const leidos = yield* entradas(c, r.resto, (f, m) => `cut: ${f}: ${m}\n`);
    let out = '';
    for (const x of leidos.lista) {
      for (const l of lineas(x.texto)) {
        if (tipo === 'f') {
          if (!l.includes(delim)) { if (!op.s) out += l + '\n'; continue; }
          const cs = l.split(delim);
          out += cs.filter((v, i) => dentro(i + 1)).join(odelim) + '\n';
        } else {
          const b = new TextEncoder().encode(l);
          const sel = []; b.forEach((v, i) => { if (dentro(i + 1)) sel.push(v); });
          out += new TextDecoder().decode(new Uint8Array(sel)) + '\n';
        }
      }
    }
    c.sale(out);
    return leidos.fallo ? 1 : 0;
  };
  O.tee = function* (c) {
    const r = yield* opciones(c, { cortas: 'ai', largas: { append: 'a', 'ignore-interrupts': 'i' } });
    if (typeof r === 'number') return r;
    const texto = yield* c.leeTodo();
    let cod = 0;
    for (const f of r.resto) {
      try {
        const res = c.resuelve(f, { faltaUltimo: true });
        let ino = res.ino;
        if (ino && ino.tipo === 'd') throw new ErrorSis('EISDIR');
        if (!ino) { if (!c.fs.puede(c.cred, res.padre, 'w')) throw new ErrorSis('EACCES'); ino = c.fs.nuevo('-', 0o666 & ~c.sh.umask(), c.uid, c.sh.gid, { datos: '' }); c.fs.enlaza(res.padre, res.nombre, ino, c.rutaAbs(f)); }
        else if (!c.fs.puede(c.cred, ino, 'w')) throw new ErrorSis('EACCES');
        c.fs.escribe(ino, texto, !!r.op.a, c.rutaAbs(f));
      } catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`tee: ${f}: ${errSis(e)}\n`); cod = 1; }
    }
    c.sale(texto);
    return cod;
  };

  /* ---------------- grep ---------------- */
  // expresión regular básica (BRE) o extendida (ERE) de POSIX -> RegExp de JavaScript
  function regexPosix(pat, extendida, fija) {
    if (fija) return pat.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    let r = '', i = 0;
    const clases = { alpha: 'A-Za-zÀ-ÖØ-öø-ÿ', digit: '0-9', alnum: '0-9A-Za-zÀ-ÖØ-öø-ÿ', upper: 'A-ZÀ-ÖØ-Þ', lower: 'a-zß-öø-ÿ', space: '\\s', blank: ' \\t', punct: '!-\\/:-@\\[-`{-~', xdigit: '0-9A-Fa-f', print: ' -~', graph: '!-~', cntrl: '\\x00-\\x1f' };
    while (i < pat.length) {
      const ch = pat[i];
      if (ch === '[') {
        let j = i + 1, s = '[';
        if (pat[j] === '^') { s += '^'; j++; }
        if (pat[j] === ']') { s += '\\]'; j++; }
        while (j < pat.length && pat[j] !== ']') {
          if (pat[j] === '[' && pat[j + 1] === ':') { const f = pat.indexOf(':]', j); if (f > 0) { s += clases[pat.slice(j + 2, f)] || ''; j = f + 2; continue; } }
          s += pat[j] === '\\' ? '\\\\' : pat[j]; j++;
        }
        if (j >= pat.length) throw new Error('[ sin cerrar');
        r += s + ']'; i = j + 1; continue;
      }
      if (ch === '\\' && i + 1 < pat.length) {
        const d = pat[i + 1];
        if (!extendida && '(){}|+?'.includes(d)) r += d;
        else if (/[1-9]/.test(d)) r += '\\' + d;
        else if (d === '<') r += '\\b(?=\\w)'; else if (d === '>') r += '\\b(?<=\\w)';
        else if (d === 'b' || d === 'B' || d === 'w' || d === 'W' || d === 's' || d === 'S') r += '\\' + d;
        else r += d.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
        i += 2; continue;
      }
      if (!extendida && '(){}|+?'.includes(ch)) { r += '\\' + ch; i++; continue; }
      if (ch === '*' && (i === 0 || (!extendida && pat[i - 1] === '^' && i === 1))) { r += '\\*'; i++; continue; }
      if (ch === '/') { r += '\\/'; i++; continue; }
      r += ch; i++;
    }
    return r;
  }
  L.regexPosix = regexPosix;
  function* grep(c) {
    const r = yield* opciones(c, { cortas: 'ivncwlLrRhHoqsEFxGzaIZ', conArg: 'eABCfm', listas: ['e'], codigo: 2,
      largas: { 'ignore-case': 'i', 'invert-match': 'v', 'line-number': 'n', count: 'c', 'word-regexp': 'w', 'files-with-matches': 'l', 'files-without-match': 'L', recursive: 'r', 'dereference-recursive': 'R', 'no-filename': 'h', 'with-filename': 'H', 'only-matching': 'o', quiet: 'q', silent: 'q', 'no-messages': 's', 'extended-regexp': 'E', 'fixed-strings': 'F', 'line-regexp': 'x', regexp: 'e=', 'after-context': 'A=', 'before-context': 'B=', context: 'C=', color: 'color?', colour: 'color?', 'max-count': 'm=', 'basic-regexp': 'G', include: 'include=', exclude: 'exclude=' } });
    if (typeof r === 'number') return r;
    const op = r.op;
    if (c.nombre === 'egrep') op.E = true; if (c.nombre === 'fgrep') op.F = true;
    let patrones = op.e ? op.e.slice() : null;
    const resto = r.resto.slice();
    if (!patrones) {
      if (!resto.length) { c.err(`Modo de empleo: grep [OPCIÓN]... PATRONES [FICHERO]...\n${prueba('grep')}`); return 2; }
      patrones = resto.shift().split('\n');
    }
    let re;
    try {
      const partes = patrones.map((p) => {
        let x = regexPosix(p, op.E, op.F);
        if (op.x) x = '^(?:' + x + ')$';
        else if (op.w) x = '(?<![\\wÀ-ÿ])(?:' + x + ')(?![\\wÀ-ÿ])';
        return x;
      });
      re = new RegExp(partes.map((p) => '(?:' + p + ')').join('|'), 'g' + (op.i ? 'i' : '') + 'u');
    } catch (e) { c.err(`grep: Unmatched [, [^, [:, [., or [=\n`); return 2; }
    const colOpc = op.color === undefined ? 'never' : op.color === true ? 'auto' : op.color;
    const conColor = colOpc === 'always' || (colOpc === 'auto' && c.ttyOut);
    const C = (sgr, t) => (conColor ? `\x1b[${sgr}m\x1b[K${t}\x1b[m\x1b[K` : t);
    const antes = +(op.B !== undefined ? op.B : op.C !== undefined ? op.C : 0), despues = +(op.A !== undefined ? op.A : op.C !== undefined ? op.C : 0);
    // archivos que mirar
    const objetivos = [];
    let cod = 1, error = false;
    const recursivo = op.r || op.R;
    if (!resto.length) resto.push(recursivo ? '.' : '-');
    const varios = resto.length > 1 || recursivo;
    const nombreRec = (resto.length === 1 && resto[0] === '.' && !r.resto.length);
    const recorre = (ruta, ino, raiz) => {
      if (ino.tipo === 'd') {
        if (!recursivo) { if (!op.s) c.err(`grep: ${ruta}: Es un directorio\n`); error = true; return; }
        if (!c.fs.puede(c.cred, ino, 'r') || !c.fs.puede(c.cred, ino, 'x')) { if (!op.s) c.err(`grep: ${ruta}: Permiso denegado\n`); error = true; return; }
        for (const [nom, n] of c.fs.entradas(ino).map(([k, v]) => [k, v]).sort((a, b) => 0)) {
          const sub = (ruta === '.' && nombreRec ? '' : ruta.replace(/\/$/, '') + '/') + nom;
          let hijo = n;
          if (hijo.tipo === 'l') { if (!op.R) continue; try { hijo = c.fs.resuelve(hijo.destino, c.cred, { cwd: ino.n }).ino; } catch (e) { continue; } }
          recorre(sub, c.fs.montado(hijo), false);
        }
        return;
      }
      if (op.include && !L.casaPatron(op.include, ruta.split('/').pop())) return;
      if (op.exclude && L.casaPatron(op.exclude, ruta.split('/').pop())) return;
      objetivos.push({ ruta, ino });
      void raiz;
    };
    for (const f of resto) {
      if (f === '-') { objetivos.push({ ruta: '(entrada estándar)', estandar: true }); continue; }
      try { const ino = c.resuelve(f).ino; recorre(f, c.fs.montado(ino), true); }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; if (!op.s) c.err(`grep: ${f}: ${errSis(e)}\n`); error = true; }
    }
    const conNombre = op.H || (varios && !op.h);
    for (const o of objetivos) {
      let texto;
      if (o.estandar) texto = yield* c.leeTodo();
      else {
        if (!c.fs.puede(c.cred, o.ino, 'r')) { if (!op.s) c.err(`grep: ${o.ruta}: Permiso denegado\n`); error = true; continue; }
        if (o.ino.elf) { if (re.test('ELF')) { c.sale(`grep: ${o.ruta}: coincidencia en fichero binario\n`); cod = 0; } re.lastIndex = 0; continue; }
        if (o.ino.tipo === 'c' || o.ino.tipo === 'b') continue;
        texto = o.ino.datos || '';
      }
      const ls = lineas(texto);
      let cuenta = 0, ultimaImpresa = -1;
      const casa = (l) => { re.lastIndex = 0; const s = re.test(l); re.lastIndex = 0; return op.v ? !s : s; };
      const prefijo = (i, sep) => (conNombre ? C('35', o.ruta) + C('36', sep) : '') + (op.n ? C('32', String(i + 1)) + C('36', sep) : '');
      const resalta = (l) => (conColor && !op.v ? l.replace(re, (m) => (m ? `\x1b[01;31m\x1b[K${m}\x1b[m\x1b[K` : m)) : l);
      const marcadas = [];
      for (let i = 0; i < ls.length; i++) {
        if (op.m !== undefined && cuenta >= +op.m) break;
        if (casa(ls[i])) { cuenta++; marcadas.push(i); }
      }
      if (cuenta) cod = 0;
      if (op.q) { if (cuenta) return 0; continue; }
      if (op.l) { if (cuenta) c.sale(C('35', o.ruta) + '\n'); continue; }
      if (op.L) { if (!cuenta) c.sale(C('35', o.ruta) + '\n'); continue; }
      if (op.c) { c.sale((conNombre ? C('35', o.ruta) + C('36', ':') : '') + cuenta + '\n'); continue; }
      if (op.o && !op.v) {
        marcadas.forEach((i) => { re.lastIndex = 0; let m; while ((m = re.exec(ls[i])) !== null) { if (m[0] === '') { re.lastIndex++; continue; } c.sale(prefijo(i, ':') + (conColor ? `\x1b[01;31m\x1b[K${m[0]}\x1b[m\x1b[K` : m[0]) + '\n'); } re.lastIndex = 0; });
        continue;
      }
      const set = new Set(marcadas);
      const imprimir = [];
      marcadas.forEach((i) => { for (let k = Math.max(0, i - antes); k <= Math.min(ls.length - 1, i + despues); k++) imprimir.push(k); });
      const unicas = [...new Set(imprimir)].sort((a, b) => a - b);
      for (const k of unicas) {
        if ((antes || despues) && ultimaImpresa >= 0 && k > ultimaImpresa + 1) c.sale(C('36', '--') + '\n');
        c.sale(prefijo(k, set.has(k) ? ':' : '-') + (set.has(k) ? resalta(ls[k]) : ls[k]) + '\n');
        ultimaImpresa = k;
      }
      if ((antes || despues) && unicas.length) o.ultima = true;
    }
    return error && !(op.q && cod === 0) ? 2 : cod;
  }
  O.grep = grep; O.egrep = grep; O.fgrep = grep;

  /* ---------------- file y stat ---------------- */
  function tipoArchivo(c, ino, ruta) {
    if (ino.tipoArchivo) return ino.tipoArchivo;
    switch (ino.tipo) {
      case 'd': return (ino.modo & 0o1000 ? 'sticky, ' : '') + 'directory';
      case 'l': { try { c.fs.resuelve(ino.destino, { uid: 0, gid: 0 }, { cwd: c.fs.ino(c.cwd) ? undefined : undefined }); } catch (e) { /* roto */ } return null; }
      case 'c': return `character special (${ino.rdev[0]}/${ino.rdev[1]})`;
      case 'b': return `block special (${ino.rdev[0]}/${ino.rdev[1]})`;
      case 'p': return 'fifo (named pipe)';
      case 's': return 'socket';
    }
    if (ino.elf) {
      const id = (L.datos && L.datos.buildIds && L.datos.buildIds[ruta.split('/').pop()]) || null;
      return 'ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2' + (id ? ', BuildID[sha1]=' + id : '') + ', for GNU/Linux 3.2.0, stripped';
    }
    if (ino.virtual) return 'empty';
    const t = ino.datos || '';
    if (t === '' && ino.tam === undefined) return 'empty';
    if (ino.tam !== undefined && !t) return 'data';
    const ascii = /^[\x00-\x7f]*$/.test(t);
    const base = ascii ? 'ASCII text' : 'Unicode text, UTF-8 text';
    let desc;
    const primera = t.split('\n')[0];
    if (/^#!\s*\/(usr\/)?bin\/(env\s+)?bash/.test(primera)) desc = 'Bourne-Again shell script, ' + base + ' executable';
    else if (/^#!\s*\/(usr\/)?bin\/(env\s+)?sh\b/.test(primera)) desc = 'POSIX shell script, ' + base + ' executable';
    else if (/^#!\s*\/(usr\/)?bin\/(env\s+)?python3?/.test(primera)) desc = 'Python script, ' + base + ' executable';
    else if (esCSV(t)) desc = 'CSV ' + base;
    else desc = base;
    const largas = Math.max(...t.split('\n').map((l) => U.bytes(l)));
    const extras = [];
    if (largas > 300) extras.push(`with very long lines (${largas})`);
    if (/\r\n/.test(t)) extras.push('with CRLF line terminators');
    if (!t.endsWith('\n') && !t.endsWith('\r')) extras.push('with no line terminators');
    return desc + (extras.length ? ', ' + extras.join(', ') : '');
  }
  function esCSV(t) {
    const ls = lineas(t).filter((l) => l !== '');
    if (ls.length < 2) return false;
    for (const sep of [',', ';', '\t']) {
      const n = ls[0].split(sep).length;
      if (n > 1 && ls.every((l) => l.split(sep).length === n)) return true;
    }
    return false;
  }
  O.file = function* (c) {
    const r = yield* opciones(c, { cortas: 'bLhiz', largas: { brief: 'b', dereference: 'L', 'no-dereference': 'h', mime: 'i', 'mime-type': 'mimetype' } });
    if (typeof r === 'number') return r;
    if (!r.resto.length) { c.err('Usage: file [-bcCdEhikLlNnprsSvzZ0] [--apple] [--extension] [--mime-encoding]\n            [--mime-type] [-e <testname>] [-F <separator>]  [-f <namefile>]\n            [-m <magicfiles>] [-P <parameter=value>] [--exclude-quiet]\n            <file> ...\n       file -C [-m <magicfiles>]\n       file [--help]\n'); return 1; }
    if (r.op.i || r.op.mimetype) { c.aviso('El simulador no tiene los tipos MIME de file.'); return 0; }
    const ancho = Math.max(...r.resto.map((f) => [...f].length)) + 1;
    for (const f of r.resto) {
      let desc;
      try {
        let ino = c.resuelve(f, { seguir: !!r.op.L }).ino;
        if (ino.tipo === 'l') {
          let ok = true;
          try { c.resuelve(f); } catch (e) { ok = false; }
          desc = (ok ? 'symbolic link to ' : 'broken symbolic link to ') + ino.destino;
        } else desc = tipoArchivo(c, ino, c.rutaAbs(f));
        if (ino.tipo === '-' && !c.fs.puede(c.cred, ino, 'r')) desc = 'regular file, no read permission';
      } catch (e) {
        if (!(e instanceof ErrorSis)) throw e;
        desc = `cannot open \`${f}' (${{ ENOENT: 'No such file or directory', EACCES: 'Permission denied', ENOTDIR: 'Not a directory' }[e.codigo] || e.message})`;
      }
      c.sale(r.op.b ? desc + '\n' : (f + ':').padEnd(ancho) + ' ' + desc + '\n');
    }
    return 0;
  };
  O.stat = function* (c) {
    const r = yield* opciones(c, { cortas: 'fLt', conArg: 'c', largas: { 'file-system': 'f', dereference: 'L', format: 'c=', terse: 't' } });
    if (typeof r === 'number') return r;
    if (!r.resto.length) { c.err(`stat: falta un operando\n${prueba('stat')}`); return 1; }
    if (r.op.c !== undefined || r.op.t) { c.aviso('El simulador todavía no tiene stat -c ni stat -t.'); return 2; }
    let cod = 0;
    for (const f of r.resto) {
      let ino;
      try { ino = c.resuelve(f, { seguir: !!r.op.L || !!r.op.f }).ino; }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`stat: cannot statx ${q(f)}: ${errSis(e)}\n`); cod = 1; continue; }
      if (r.op.f) {
        const m = montajeDe(c, c.rutaAbs(f));
        const bloques = Math.floor(m.bloques / 4), libres = Math.floor((m.bloques - m.usados) / 4), disp = Math.floor((m.disponibles !== undefined ? m.disponibles : m.bloques - m.usados) / 4);
        c.sale(`  Fichero: "${f}"\n    ID: b85595a3b85e64b6 Longnombre: 255     Tipo: ${m.tipo === 'ext4' ? 'ext2/ext3' : m.tipo}\nTam. bloque: 4096       Tam. bloque fundamental: 4096\nBloques: Total: ${String(bloques).padEnd(10)} Libres: ${String(libres).padEnd(10)} Disponibles: ${disp}\nNodos-i: Total: ${String(m.nodos).padEnd(10)} Libres: ${m.nodos - m.nusados}\n`);
        continue;
      }
      const tipos = { '-': c.fs.tam(ino) === 0 ? 'fichero regular vacío' : 'fichero regular', d: 'directorio', l: 'enlace simbólico', c: 'fichero especial de caracteres', b: 'fichero especial de bloques', p: 'fifo', s: 'socket' };
      const nombre = ino.tipo === 'l' ? `${f} -> ${ino.destino}` : f;
      const dueño = c.sis.nombreUid(ino.uid), grupo = c.sis.nombreGid(ino.gid);
      const octal = (ino.modo & 0o7777).toString(8).padStart(4, '0');
      const disp = ino.tipo === 'c' || ino.tipo === 'b' ? '0,5' : (ino.dispositivo || '8,2');
      let s = `  Fichero: ${nombre}\n`;
      s += `  Tamaño: ${String(c.fs.tam(ino)).padEnd(10)}\tBloques: ${String(c.fs.bloques(ino)).padEnd(10)} Bloque E/S: ${String(4096).padEnd(6)} ${tipos[ino.tipo]}\n`;
      s += `Device: ${disp}\tInode: ${String(ino.n).padEnd(11)} Links: ${c.fs.numEnlaces(ino)}` + (ino.rdev ? `     Tipo de dispositivo: ${ino.rdev[0]},${ino.rdev[1]}` : '') + '\n';
      s += `Acceso: (${octal}/${modoTexto(ino)})  Uid: (${String(ino.uid).padStart(5)}/${dueño.padStart(8)})   Gid: (${String(ino.gid).padStart(5)}/${grupo.padStart(8)})\n`;
      s += `Acceso: ${U.fechaLarga(ino.atime, ino.ans)}\nModificación: ${U.fechaLarga(ino.mtime, ino.mns)}\n      Cambio: ${U.fechaLarga(ino.ctime, ino.cns)}\n    Creación: ${U.fechaLarga(ino.btime, ino.bns)}\n`;
      c.sale(s);
    }
    return cod;
  };
  // el sistema montado que contiene una ruta (el punto de montaje más largo)
  function montajeDe(c, ruta) {
    let mejor = null;
    for (const m of c.sis.montajes) if (ruta === m.en || ruta.startsWith(m.en === '/' ? '/' : m.en + '/')) { if (!mejor || m.en.length > mejor.en.length) mejor = m; }
    return mejor || c.sis.montajes.find((m) => m.en === '/');
  }
  L.montajeDe = montajeDe;

  /* ---------------- find ---------------- */
  O.find = function* (c) {
    const a = c.args.slice();
    const fs = c.fs;
    // rutas de partida: lo que va antes de la primera expresión
    const inicios = [];
    while (a.length && !/^[-!(),]/.test(a[0])) inicios.push(a.shift());
    if (a[0] === '--help') { yield* ayuda(c); return 0; }
    if (!inicios.length) inicios.push('.');
    let maxdepth = Infinity, mindepth = 0, cod = 0;
    const avisosGlobal = [];
    // análisis de la expresión: o := y ('-o' y)*; y := no ('-a'? no)*; no := ('!'|'-not') no | primario
    let i = 0;
    const falta = (p) => { c.err(`find: falta un parámetro para ${qq(p)}\n`); throw new Error('find'); };
    const num = (txt, p) => { const m = String(txt).match(/^([+-]?)(\d+)$/); if (!m) { c.err(`find: argumento no válido \`${txt}' para \`${p}'\n`); throw new Error('find'); } return { s: m[1], n: +m[2] }; };
    const compara = (v, x) => (x.s === '+' ? v > x.n : x.s === '-' ? v < x.n : v === x.n);
    let hayAccion = false, vistoTest = false;
    function primario() {
      const t = a[i++];
      if (t === undefined) return null;
      if (t === '(') { const e = o(); if (a[i] !== ')') { c.err('find: paréntesis sin pareja\n'); throw new Error('find'); } i++; return e; }
      const arg = () => { if (i >= a.length) falta(t); return a[i++]; };
      switch (t) {
        case '-name': case '-iname': { const p = arg(); vistoTest = true; return (e) => L.casaPatron(p, e.nombre, { mayus: t === '-iname' }); }
        case '-path': case '-wholename': case '-ipath': { const p = arg(); vistoTest = true; return (e) => L.casaPatron(p, e.ruta, { mayus: t === '-ipath' }); }
        case '-type': { const v = arg(); vistoTest = true; if (!/^[fdlcbps](,[fdlcbps])*$/.test(v)) { c.err(`find: Argumento desconocido para -type: ${v}\n`); throw new Error('find'); } const ts = v.split(',').map((x) => (x === 'f' ? '-' : x)); return (e) => ts.includes(e.ino.tipo); }
        case '-size': {
          const v = arg(); vistoTest = true;
          const m = v.match(/^([+-]?)(\d+)([bckwMG]?)$/);
          if (!m) { c.err(`find: argumento no válido \`${v}' para \`-size'\n`); throw new Error('find'); }
          const u = { b: 512, c: 1, w: 2, k: 1024, M: 1048576, G: 1073741824 }[m[3] || 'b'];
          return (e) => { const t = fs.tam(e.ino); const n = Math.ceil(t / u); return m[1] === '+' ? n > +m[2] : m[1] === '-' ? n < +m[2] : n === +m[2]; };
        }
        case '-mtime': case '-atime': case '-ctime': { const x = num(arg(), t); vistoTest = true; const k = { '-mtime': 'mtime', '-atime': 'atime', '-ctime': 'ctime' }[t]; return (e) => compara(Math.floor((c.ahora() - e.ino[k]) / 864e5), x); }
        case '-mmin': case '-amin': case '-cmin': { const x = num(arg(), t); vistoTest = true; const k = t[1] + 'time'; return (e) => compara(Math.ceil((c.ahora() - e.ino[k]) / 6e4), x); }
        case '-newer': { const ref = arg(); vistoTest = true; let mt; try { mt = c.resuelve(ref).ino.mtime; } catch (e) { c.err(`find: ${comillasFind(ref)}: ${errSis(e)}\n`); throw new Error('find'); } return (e) => e.ino.mtime > mt; }
        case '-empty': vistoTest = true; return (e) => (e.ino.tipo === 'd' ? e.ino.hijos.size === 0 : e.ino.tipo === '-' && fs.tam(e.ino) === 0);
        case '-user': { const u = arg(); vistoTest = true; const x = c.sis.usuario(/^\d+$/.test(u) ? +u : u); if (!x) { c.err(`find: el usuario ${qq(u)} no existe\n`); throw new Error('find'); } return (e) => e.ino.uid === x.uid; }
        case '-group': { const g = arg(); vistoTest = true; const x = c.sis.grupo(/^\d+$/.test(g) ? +g : g); if (!x) { c.err(`find: el grupo ${qq(g)} no existe\n`); throw new Error('find'); } return (e) => e.ino.gid === x.gid; }
        case '-perm': { const p = arg(); vistoTest = true; const m = p.match(/^([-\/]?)([0-7]{1,4})$/); if (!m) { c.aviso('El simulador solo entiende -perm en octal (-perm 644, -perm -u=x no).'); throw new Error('find'); } const v = parseInt(m[2], 8); return (e) => (m[1] === '-' ? (e.ino.modo & v) === v : m[1] === '/' ? (e.ino.modo & v) !== 0 : (e.ino.modo & 0o7777) === v); }
        case '-readable': vistoTest = true; return (e) => fs.puede(c.cred, e.ino, 'r');
        case '-writable': vistoTest = true; return (e) => fs.puede(c.cred, e.ino, 'w');
        case '-executable': vistoTest = true; return (e) => fs.puede(c.cred, e.ino, 'x');
        case '-maxdepth': case '-mindepth': {
          const v = arg();
          if (!/^\d+$/.test(v)) { c.err(`find: Expected a positive decimal integer argument to ${t}, but got ${q(v)}\n`); throw new Error('find'); }
          if (t === '-maxdepth') maxdepth = +v; else mindepth = +v;
          if (vistoTest) avisosGlobal.push(t);
          return () => true;
        }
        case '-true': return () => true;
        case '-false': return () => false;
        case '-print': hayAccion = true; return (e) => { c.sale(e.ruta + '\n'); return true; };
        case '-print0': hayAccion = true; return (e) => { c.sale(e.ruta + '\0'); return true; };
        case '-ls': hayAccion = true; return (e) => { c.sale(`${String(e.ino.n).padStart(9)} ${String(Math.ceil(fs.bloques(e.ino) / 2)).padStart(6)} ${modoTexto(e.ino)} ${String(fs.numEnlaces(e.ino)).padStart(3)} ${c.sis.nombreUid(e.ino.uid).padEnd(8)} ${c.sis.nombreGid(e.ino.gid).padEnd(8)} ${String(fs.tam(e.ino)).padStart(8)} ${U.fechaLs(e.ino.mtime, c.ahora())} ${e.ruta}${e.ino.tipo === 'l' ? ' -> ' + e.ino.destino : ''}\n`); return true; };
        case '-delete': hayAccion = true; return (e) => { e.borrar = true; return true; };
        case '-exec': case '-ok': case '-execdir': {
          hayAccion = true;
          const ord = [];
          while (i < a.length && a[i] !== ';' && !(a[i] === '+' && ord[ord.length - 1] === '{}')) ord.push(a[i++]);
          if (i >= a.length) { c.err(`find: falta un parámetro para ${qq(t)}\n`); throw new Error('find'); }
          const mas = a[i] === '+'; i++;
          if (!ord.length) { c.err(`find: falta un parámetro para ${qq(t)}\n`); throw new Error('find'); }
          return (e) => { e.exec = e.exec || []; e.exec.push({ ord, mas, ok: t === '-ok' }); return true; };
        }
        case '-printf': case '-fprint': case '-prune': case '-xdev': case '-mount': case '-regex': case '-iregex': case '-links': case '-inum': case '-samefile': case '-nouser': case '-nogroup': case '-depth': case '-follow': case '-L':
          c.aviso(`El simulador todavía no tiene ${t} en find. En tu Ubuntu sí funciona.`); throw new Error('find');
      }
      if (t === ')' ) { c.err('find: paréntesis sin pareja\n'); throw new Error('find'); }
      c.err(t[0] === '-' ? `find: predicado desconocido \`${t}'\n` : `find: las rutas deben preceder a la expresión: \`${t}'\n`);
      throw new Error('find');
    }
    function no() { if (a[i] === '!' || a[i] === '-not') { i++; const e = no(); if (!e) { c.err('find: se esperaba una expresión tras «!»\n'); throw new Error('find'); } return (x) => !e(x); } return primario(); }
    function y() {
      let e = no();
      while (i < a.length && a[i] !== '-o' && a[i] !== '-or' && a[i] !== ')' && a[i] !== ',') {
        if (a[i] === '-a' || a[i] === '-and') i++;
        const d = no(); const iz = e; e = (x) => iz(x) && d(x);
      }
      return e;
    }
    function o() { let e = y(); while (a[i] === '-o' || a[i] === '-or') { i++; const d = y(); const iz = e; e = (x) => iz(x) || d(x); } return e; }
    let expr;
    try { expr = a.length ? o() : () => true; if (i < a.length) { c.err(a[i] === ')' ? 'find: paréntesis sin pareja\n' : `find: predicado desconocido \`${a[i]}'\n`); return 1; } }
    catch (e) { if (e.message === 'find') return 1; throw e; }
    avisosGlobal.forEach((g) => c.err(`find: warning: you have specified the global option ${g} after the argument -${['name', 'type'].find(() => true)}, but global options are not positional, i.e., ${g} affects tests specified before it as well as those specified after it.  Please specify global options before other arguments.\n`));
    const pendientes = [];
    const visita = function* (ruta, ino, nivel, nombre) {
      const e = { ruta, ino, nombre };
      if (nivel >= mindepth) {
        const ok = expr(e);
        if (ok && !hayAccion) c.sale(ruta + '\n');
        if (e.exec) {
          for (const x of e.exec) {
            if (x.mas) { pendientes.push({ x, ruta }); continue; }
            const argv = x.ord.map((p) => p.replace(/\{\}/g, ruta));
            if (x.ok) { c.err(`< ${argv.join(' ')} ... ${ruta} > ? `); if (!siONo(yield* c.leeLinea('', true))) continue; }
            yield* c.sh.ejecutaPrograma(argv[0], argv, c.io, {});
          }
        }
        if (e.borrar) pendientes.push({ borrar: true, ruta, ino });
      }
      if (ino.tipo === 'd' && nivel < maxdepth) {
        if (!fs.puede(c.cred, ino, 'r') || !fs.puede(c.cred, ino, 'x')) { c.err(`find: ${comillasFind(ruta)}: Permiso denegado\n`); cod = 1; return; }
        for (const [nom, n] of [...ino.hijos]) {
          const hijo = fs.ino(n);
          if (!hijo) continue;
          yield* visita((ruta.endsWith('/') ? ruta : ruta + '/') + nom, fs.montado(hijo), nivel + 1, nom);
        }
      }
    };
    for (const ini of inicios) {
      let ino;
      try { ino = c.resuelve(ini, { seguir: false }).ino; if (ino.tipo === 'l' && ini.endsWith('/')) ino = c.resuelve(ini).ino; }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`find: ${comillasFind(ini)}: ${errSis(e)}\n`); cod = 1; continue; }
      yield* visita(ini, fs.montado(ino), 0, ini.replace(/\/+$/, '').split('/').pop() || ini);
    }
    // -exec … {} + (todas juntas) y -delete (de dentro afuera)
    const grupos = new Map();
    pendientes.filter((p) => p.x).forEach((p) => { if (!grupos.has(p.x)) grupos.set(p.x, []); grupos.get(p.x).push(p.ruta); });
    for (const [x, rutas] of grupos) { const argv = x.ord.slice(0, -1).concat(rutas); yield* c.sh.ejecutaPrograma(argv[0], argv, c.io, {}); }
    pendientes.filter((p) => p.borrar).reverse().forEach((p) => {
      try {
        const res = c.resuelve(p.ruta, { seguir: false });
        if (res.ino.tipo === 'd' && res.ino.hijos.size) { c.err(`find: no se puede borrar ${q(p.ruta)}: El directorio no está vacío\n`); cod = 1; return; }
        if (!fs.puede(c.cred, res.padre, 'w')) { c.err(`find: no se puede borrar ${q(p.ruta)}: Permiso denegado\n`); cod = 1; return; }
        fs.desenlaza(res.padre, res.nombre, c.rutaAbs(p.ruta));
      } catch (e) { if (!(e instanceof ErrorSis)) throw e; }
    });
    return cod;
  };

  /* ---------------- du ---------------- */
  O.du = function* (c) {
    const r = yield* opciones(c, { cortas: 'hsacSkmx', conArg: 'd', largas: { 'human-readable': 'h', summarize: 's', all: 'a', total: 'c', 'max-depth': 'd=', 'apparent-size': 'aparente', si: 'si' } });
    if (typeof r === 'number') return r;
    const op = r.op, fs = c.fs;
    const maxd = op.d !== undefined ? +op.d : (op.s ? 0 : Infinity);
    if (op.s && op.a) { c.err(`du: no se pueden resumir y mostrar todos los elementos a la vez\n${prueba('du')}`); return 1; }
    let cod = 0, total = 0;
    const fmt = (k) => (op.h ? U.humano(k * 1024) : String(k));
    const vistos = new Set();
    const tamaño = (ino, ruta, nivel) => {
      if (vistos.has(ino.n) && ino.tipo !== 'd') return 0;
      vistos.add(ino.n);
      let k = Math.ceil(fs.bloques(ino) / 2);
      if (op.aparente) k = Math.ceil(fs.tam(ino) / 1024);
      if (ino.tipo === 'd') {
        if (!fs.puede(c.cred, ino, 'r') || !fs.puede(c.cred, ino, 'x')) { c.err(`du: no se puede leer el directorio ${q(ruta)}: Permiso denegado\n`); cod = 1; if (nivel <= maxd) c.sale(fmt(k) + '\t' + ruta + '\n'); return k; }
        for (const [nom, n] of [...ino.hijos]) {
          const h = fs.ino(n);
          const sub = ruta.replace(/\/$/, '') + '/' + nom;
          const t = tamaño(fs.montado(h), sub, nivel + 1);
          k += t;
          if (h.tipo !== 'd' && op.a && nivel + 1 <= maxd) c.sale(fmt(t) + '\t' + sub + '\n');
        }
        if (nivel <= maxd) c.sale(fmt(k) + '\t' + ruta + '\n');
      } else if (nivel === 0) c.sale(fmt(k) + '\t' + ruta + '\n');
      return k;
    };
    for (const a of (r.resto.length ? r.resto : ['.'])) {
      try { const ino = c.resuelve(a).ino; total += tamaño(fs.montado(ino), a, 0); }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`du: no se puede acceder a ${q(a)}: ${errSis(e)}\n`); cod = 1; }
    }
    if (op.c) c.sale(fmt(total) + '\ttotal\n');
    return cod;
  };

  /* ---------------- tree (paquete tree) ---------------- */
  O.tree = function* (c) {
    const a = c.args.slice();
    const op = { L: Infinity };
    const dirs = [];
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (x === '--help') { yield* ayuda(c); return 0; }
      if (x === '-L') { const v = a[++i]; if (!/^\d+$/.test(v || '') || +v < 1) { c.err('tree: Invalid level, must be greater than 0.\n'); return 1; } op.L = +v; continue; }
      if (x === '--noreport') { op.noreport = true; continue; }
      if (x === '--dirsfirst') { op.dirsfirst = true; continue; }
      if (/^-[adfisCnph]+$/.test(x)) { for (const ch of x.slice(1)) op[ch] = true; continue; }
      if (x[0] === '-' && x.length > 1) { c.aviso(`El simulador no tiene la opción ${x} de tree. En tu Ubuntu sí funciona: consulta «man tree».`); return 2; }
      dirs.push(x);
    }
    if (!dirs.length) dirs.push('.');
    const conColor = (c.ttyOut && !op.n) || op.C;
    const col = conColor ? coloresLs(c.env) : null;
    let nd = 0, nf = 0, cod = 0;
    const fs = c.fs;
    const out = [];
    const nombre = (ruta, nom, ino) => {
      let destIno = null;
      if (ino.tipo === 'l') { try { destIno = fs.resuelve(ino.destino, c.cred, { cwd: c.cwd }).ino; } catch (e) { destIno = null; } }
      let s = op.f ? ruta : nom;
      if (col) s = pinta(s, colorDe(col, nom, ino, destIno));
      if (op.p) s = '[' + modoTexto(ino) + ']  ' + s;
      if (op.s || op.h) s = '[' + (op.h ? U.humano(fs.tam(ino)).padStart(4) : String(fs.tam(ino)).padStart(11)) + ']  ' + s;
      if (ino.tipo === 'l') s += ' -> ' + (col ? pinta(ino.destino, destIno ? colorDe(col, ino.destino, destIno) : col.or) : ino.destino);
      return s;
    };
    const rama = (ruta, dir, prefijo, nivel) => {
      if (!fs.puede(c.cred, dir, 'r')) { out[out.length - 1] += '  [error opening dir]'; return; }
      let ents = fs.entradas(dir).filter(([n]) => op.a || n[0] !== '.');
      if (op.d) ents = ents.filter(([n, i]) => { let x = i; if (x.tipo === 'l') { try { x = fs.resuelve(x.destino, c.cred, { cwd: dir.n }).ino; } catch (e) { return false; } } return x.tipo === 'd'; });
      ents.sort((x, y) => U.comparaLocale(x[0], y[0]));
      if (op.dirsfirst) ents = ents.filter(([, i]) => i.tipo === 'd').concat(ents.filter(([, i]) => i.tipo !== 'd'));
      ents.forEach(([nom, ino], k) => {
        const ultimo = k === ents.length - 1;
        const sub = ruta.replace(/\/$/, '') + '/' + nom;
        out.push((op.i ? '' : prefijo + (ultimo ? '└── ' : '├── ')) + nombre(sub, nom, ino));
        let real = ino;
        if (ino.tipo === 'l') { try { real = fs.resuelve(ino.destino, c.cred, { cwd: dir.n }).ino; } catch (e) { real = ino; } }
        if (real.tipo === 'd' && ino.tipo !== 'l') { nd++; if (nivel + 1 < op.L) rama(sub, fs.montado(real), prefijo + (ultimo ? '    ' : '│   '), nivel + 1); }
        else if (ino.tipo === 'l' && real.tipo === 'd') nd++;
        else nf++;
      });
    };
    for (const d of dirs) {
      let ino;
      try { ino = c.resuelve(d).ino; }
      catch (e) { out.push(`${d}  [error opening dir]`); cod = 2; continue; }
      if (ino.tipo !== 'd') { out.push(`${d}  [error opening dir]`); cod = 2; continue; }
      out.push(col ? pinta(d, colorDe(col, d, ino)) : d);
      nd++;
      rama(d, fs.montado(ino), '', 0);
    }
    if (!op.noreport) {
      out.push('');
      out.push(`${nd} director${nd === 1 ? 'y' : 'ies'}` + (op.d ? '' : `, ${nf} file${nf === 1 ? '' : 's'}`));
    }
    c.sale(out.join('\n') + '\n');
    return cod;
  };

  /* ---------------- pequeñas de coreutils ---------------- */
  O.basename = function* (c) {
    if (!c.args.length) { c.err(`basename: falta un operando\n${prueba('basename')}`); return 1; }
    let b = c.args[0].replace(/\/+$/, '').split('/').pop() || '/';
    if (c.args[1] && b.endsWith(c.args[1]) && b !== c.args[1]) b = b.slice(0, -c.args[1].length);
    c.sale(b + '\n'); return 0;
  };
  O.dirname = function* (c) {
    if (!c.args.length) { c.err(`dirname: falta un operando\n${prueba('dirname')}`); return 1; }
    c.args.forEach((a) => { const s = a.replace(/\/+$/, ''); const i = s.lastIndexOf('/'); c.sale((i < 0 ? '.' : i === 0 ? '/' : s.slice(0, i)) + '\n'); });
    return 0;
  };
  O.sleep = function* (c) {
    if (!c.args.length) { c.err(`sleep: falta un operando\n${prueba('sleep')}`); return 1; }
    let ms = 0;
    for (const a of c.args) {
      const m = a.replace(',', '.').match(/^(\d+(?:\.\d+)?)([smhd]?)$/);
      if (!m) { c.err(`sleep: intervalo de tiempo ${qq(a)} inválido\n${prueba('sleep')}`); return 1; }
      ms += +m[1] * ({ s: 1, m: 60, h: 3600, d: 86400 }[m[2] || 's']) * 1000;
    }
    while (ms > 0) { const p = Math.min(ms, 1000); yield { tipo: 'espera', ms: p }; ms -= p; }
    return 0;
  };
  O.seq = function* (c) {
    const n = c.args.map(Number);
    if (!c.args.length || n.some(Number.isNaN)) { c.err(c.args.length ? `seq: argumento de coma flotante inválido: ${qq(c.args.find((x) => Number.isNaN(+x)))}\n${prueba('seq')}` : `seq: falta un operando\n${prueba('seq')}`); return 1; }
    let [a, p, b] = n.length === 1 ? [1, 1, n[0]] : n.length === 2 ? [n[0], 1, n[1]] : n;
    let out = '';
    for (let v = a, k = 0; p > 0 ? v <= b : v >= b; v += p, k++) { out += v + '\n'; if (k > 100000) break; }
    c.sale(out); return 0;
  };
  O.yes = function* (c) {
    const t = (c.args.length ? c.args.join(' ') : 'y') + '\n';
    c.sale(t.repeat(200));
    c.nota('En tu Ubuntu, yes no para nunca (hasta Ctrl + C); el simulador escribe 200 líneas.');
    return 0;
  };
  O.env = function* (c) {
    let args = c.args.slice();
    const extra = {}, quitar = [];
    while (args.length) {
      if (args[0] === '-i' || args[0] === '-') { args.shift(); Object.keys(c.env).forEach((k) => quitar.push(k)); continue; }
      if (args[0] === '-u') { args.shift(); quitar.push(args.shift()); continue; }
      if (args[0] === '--help') { yield* ayuda(c); return 0; }
      if (/^[^=]+=/.test(args[0])) { const [k, ...v] = args.shift().split('='); extra[k] = v.join('='); continue; }
      break;
    }
    const env = Object.assign({}, c.env);
    quitar.forEach((k) => delete env[k]);
    Object.assign(env, extra);
    if (!args.length) {
      env._ = '/usr/bin/env';
      c.sale(Object.keys(env).map((k) => k + '=' + env[k]).join('\n') + '\n');
      return 0;
    }
    // las que se quitan (env -u, env -i) van como null: el programa no las recibe
    const paraOrden = Object.assign({}, extra);
    quitar.forEach((k) => { if (!(k in extra)) paraOrden[k] = null; });
    return yield* c.sh.ejecutaPrograma(args[0], args, c.io, paraOrden);
  };
  O.printenv = function* (c) {
    if (!c.args.length) { yield* O.env(Object.assign({}, c, { args: [] })); return 0; }
    let cod = 0;
    c.args.forEach((k) => { if (c.env[k] !== undefined) c.sale(c.env[k] + '\n'); else cod = 1; });
    return cod;
  };
  O.whoami = function* (c) {
    if (c.args.length) { if (c.args[0] === '--help') { yield* ayuda(c); return 0; } c.err(`whoami: operando extra ${qq(c.args[0])}\n${prueba('whoami')}`); return 1; }
    c.sale(c.usuario + '\n'); return 0;
  };
  O.id = function* (c) {
    const r = yield* opciones(c, { cortas: 'ugGnrz', largas: { user: 'u', group: 'g', groups: 'G', name: 'n', real: 'r' } });
    if (typeof r === 'number') return r;
    const op = r.op;
    if (r.resto.length > 1) { c.err(`id: operando extra ${qq(r.resto[1])}\n${prueba('id')}`); return 1; }
    let uid, gid, grupos, nombre;
    if (r.resto.length) {
      const u = c.sis.usuario(/^\d+$/.test(r.resto[0]) ? +r.resto[0] : r.resto[0]);
      if (!u) { c.err(`id: ${qq(r.resto[0])}: no existe ese usuario\n`); return 1; }
      uid = u.uid; gid = u.gid; nombre = u.nombre; grupos = c.sis.gruposDe(u.nombre).map((g) => g.gid);
    } else { uid = c.uid; gid = c.sh.gid; nombre = c.usuario; grupos = c.sh.grupos.slice(); }
    const gN = (g) => c.sis.nombreGid(g);
    if ([op.u, op.g, op.G].filter(Boolean).length > 1) { c.err(`id: no se puede mostrar más de una opción a la vez\n${prueba('id')}`); return 1; }
    if (op.n && !op.u && !op.g && !op.G) { c.err(`id: no se puede mostrar solamente los nombres o los ID reales en el formato predeterminado\n${prueba('id')}`); return 1; }
    if (op.u) { c.sale((op.n ? c.sis.nombreUid(uid) : uid) + '\n'); return 0; }
    if (op.g) { c.sale((op.n ? gN(gid) : gid) + '\n'); return 0; }
    if (op.G) { c.sale(grupos.map((g) => (op.n ? gN(g) : g)).join(' ') + '\n'); return 0; }
    c.sale(`uid=${uid}(${c.sis.nombreUid(uid)}) gid=${gid}(${gN(gid)}) grupos=${grupos.map((g) => `${g}(${gN(g)})`).join(',')}\n`);
    void nombre;
    return 0;
  };
  O.groups = function* (c) {
    if (!c.args.length) { c.sale(c.sh.grupos.map((g) => c.sis.nombreGid(g)).join(' ') + '\n'); return 0; }
    let cod = 0;
    c.args.forEach((n) => { const u = c.sis.usuario(n); if (!u) { c.err(`groups: ${qq(n)}: no existe ese usuario\n`); cod = 1; return; } c.sale(`${n} : ${c.sis.gruposDe(n).map((g) => g.nombre).join(' ')}\n`); });
    return cod;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof window !== 'undefined' ? window : globalThis);
