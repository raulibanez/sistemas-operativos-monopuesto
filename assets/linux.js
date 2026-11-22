/* Simulador de Linux (Ubuntu 24.04 en español) para las UT4 a UT7: núcleo sin DOM.
 *
 * Se carga en este orden (en el navegador con <script>, en Node con require):
 *   linux-datos.js    archivos de /etc y /proc, nombres de órdenes y mensajes copiados de una Ubuntu real
 *   linux.js          este archivo: utilidades, reloj, sistema de archivos con inodos, cuentas, imagen base
 *   linux-bash.js     intérprete: analizador (árbol sintáctico), expansiones, ejecución, sesión y API
 *   linux-ordenes.js  las órdenes (ls, cd, grep, apt…)
 *   linux-misiones.js las misiones con semilla
 *   linux-ayuda.js    páginas de man y textos de --help (se pide solo al usarlos)
 *
 * Regla de honestidad: lo que hace, lo hace como Ubuntu 24.04 en español (mismos mensajes y códigos de
 * salida, comprobados contra una máquina real en herramientas/linux-real.json). Lo que no sabe hacer lo dice
 * con un aviso propio (tipo 'aviso'), que la terminal pinta con otro estilo.
 *
 * Uso mínimo:
 *   const sis = SOM.linux.crea({ archivos: { '~/empresa/datos/resumen.csv': 'Mes,Vendedor,Ventas,Beneficio\n' } });
 *   const sh = sis.sesion();               // bash del usuario alumno en su carpeta personal
 *   const r = sh.ejecuta('ls -l empresa'); // { codigo, stdout, stderr, avisos, eventos, trazas, cambios }
 */
(function (raiz) {
  'use strict';
  const SOM = (raiz.SOM = raiz.SOM || {});
  const L = (SOM.linux = SOM.linux || {});

  /* ---------------- utilidades ---------------- */
  const codifica = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const bytes = (s) => (codifica ? codifica.encode(s).length : unescape(encodeURIComponent(s)).length);
  const relleno = (s, n, izq) => { s = String(s); const f = ' '.repeat(Math.max(0, n - anchoTexto(s))); return izq ? f + s : s + f; };
  // ancho en columnas de la terminal (los caracteres combinados no ocupan; los asiáticos anchos ocupan 2)
  function anchoTexto(s) {
    let n = 0;
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      if (c >= 0x300 && c <= 0x36f) continue;
      n += (c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xff60) || (c >= 0x1f300 && c <= 0x1faff))) ? 2 : 1;
    }
    return n;
  }
  // orden alfabético del locale es_ES.UTF-8 de glibc: sin signos de puntuación, sin tildes y sin mayúsculas en la
  // primera pasada; luego tildes, minúsculas antes que mayúsculas y, si siguen empatados, los bytes
  const cotejo = typeof Intl !== 'undefined' ? new Intl.Collator('es-ES', { ignorePunctuation: true, sensitivity: 'variant', caseFirst: 'lower' }) : null;
  const comparaLocale = (a, b) => { const c = cotejo ? cotejo.compare(a, b) : 0; return c || (a < b ? -1 : a > b ? 1 : 0); };
  // generador con semilla (el mismo que las hojas en papel del sitio)
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function azar(semilla) {
    const r = mulberry32(semilla >>> 0);
    const ent = (min, max) => Math.floor(r() * (max - min + 1)) + min;
    return { r, ent, elige: (a) => a[Math.floor(r() * a.length)], baraja: (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; } };
  }
  // tamaño legible como coreutils (-h): potencias de 1024, una cifra decimal por debajo de 10, redondeo hacia arriba, coma decimal
  function humano(n, sufijoB) {
    const u = ['', 'K', 'M', 'G', 'T', 'P'];
    if (n < 1024) return String(n) + (sufijoB && n ? '' : '');
    let i = 0, x = n;
    while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; }
    if (x < 10) { let y = Math.ceil(x * 10 - 1e-9) / 10; if (y >= 10) return '10' + u[i]; return y.toFixed(1).replace('.', ',') + u[i]; }
    let y = Math.ceil(x - 1e-9);
    if (y >= 1024 && i < u.length - 1) return '1,0' + u[i + 1];
    return y + u[i];
  }
  const numES = (n, dec) => n.toFixed(dec).replace('.', ',');
  const milES = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  /* ---------------- reloj y fechas (zona Europe/Madrid) ---------------- */
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DIAS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // último domingo de un mes a la 01:00 UTC (cambio de hora de la UE)
  function ultimoDomingo(anio, mes) { const d = new Date(Date.UTC(anio, mes + 1, 0, 1)); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.getTime(); }
  function desfase(ms) {   // minutos respecto a UTC en Madrid
    const a = new Date(ms).getUTCFullYear();
    return ms >= ultimoDomingo(a, 2) && ms < ultimoDomingo(a, 9) ? 120 : 60;
  }
  // descompone una fecha (ms UTC) en hora de Madrid
  function partes(ms) {
    const off = desfase(ms), d = new Date(ms + off * 60000);
    return { a: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(),
      ms: d.getUTCMilliseconds(), sem: d.getUTCDay(), off, zona: off === 120 ? 'CEST' : 'CET',
      yday: Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1 };
  }
  // hora local de Madrid -> ms UTC
  function desdeLocal(a, m, d, h, mi, s) {
    const aprox = Date.UTC(a, m, d, h || 0, mi || 0, s || 0);
    let ms = aprox - 60 * 60000;
    ms = aprox - desfase(ms) * 60000;
    return aprox - desfase(ms) * 60000;
  }
  const p2 = (n) => String(n).padStart(2, '0');
  // strftime con los nombres del locale es_ES.UTF-8; ns: nanosegundos para %N
  function strftime(fmt, ms, opc) {
    const t = partes(ms), utc = opc && opc.utc;
    const q = utc ? (() => { const d = new Date(ms); return { a: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), sem: d.getUTCDay(), off: 0, zona: 'UTC', yday: t.yday }; })() : t;
    const ns = (opc && opc.ns !== undefined) ? opc.ns : (ms % 1000) * 1e6;
    const off = (q.off >= 0 ? '+' : '-') + p2(Math.floor(Math.abs(q.off) / 60)) + p2(Math.abs(q.off) % 60);
    return fmt.replace(/%([-_0^#]?)([a-zA-Z%+:])/g, (todo, flag, c) => {
      let v;
      switch (c) {
        case 'a': v = DIAS_C[q.sem]; break;
        case 'A': v = DIAS[q.sem]; break;
        case 'b': case 'h': v = MESES_C[q.m]; break;
        case 'B': v = MESES[q.m]; break;
        case 'c': v = `${DIAS_C[q.sem]} ${p2(q.d)} ${MESES_C[q.m]} ${q.a} ${p2(q.h)}:${p2(q.mi)}:${p2(q.s)}`; break;
        case 'C': v = p2(Math.floor(q.a / 100)); break;
        case 'd': v = p2(q.d); break;
        case 'D': v = `${p2(q.m + 1)}/${p2(q.d)}/${p2(q.a % 100)}`; break;
        case 'e': v = String(q.d).padStart(2, ' '); break;
        case 'F': v = `${q.a}-${p2(q.m + 1)}-${p2(q.d)}`; break;
        case 'H': v = p2(q.h); break;
        case 'I': v = p2(((q.h + 11) % 12) + 1); break;
        case 'j': v = String(q.yday).padStart(3, '0'); break;
        case 'k': v = String(q.h).padStart(2, ' '); break;
        case 'l': v = String(((q.h + 11) % 12) + 1).padStart(2, ' '); break;
        case 'm': v = p2(q.m + 1); break;
        case 'M': v = p2(q.mi); break;
        case 'n': v = '\n'; break;
        case 'N': v = String(Math.floor(ns)).padStart(9, '0'); break;
        case 'p': v = q.h < 12 ? 'AM' : 'PM'; break;
        case 'P': v = q.h < 12 ? 'am' : 'pm'; break;
        case 'r': v = `${p2(((q.h + 11) % 12) + 1)}:${p2(q.mi)}:${p2(q.s)} ${q.h < 12 ? 'AM' : 'PM'}`; break;
        case 'R': v = `${p2(q.h)}:${p2(q.mi)}`; break;
        case 's': v = String(Math.floor(ms / 1000)); break;
        case 'S': v = p2(q.s); break;
        case 't': v = '\t'; break;
        case 'T': v = `${p2(q.h)}:${p2(q.mi)}:${p2(q.s)}`; break;
        case 'u': v = String(q.sem || 7); break;
        case 'U': { const d0 = (q.yday - 1 + 7 - q.sem) ; v = p2(Math.floor((d0 + 7) / 7) - (d0 % 7 === 0 ? 0 : 0)); v = p2(Math.floor((q.yday + 6 - q.sem) / 7)); break; }
        case 'w': v = String(q.sem); break;
        case 'W': v = p2(Math.floor((q.yday + 6 - ((q.sem + 6) % 7)) / 7)); break;
        case 'x': v = `${p2(q.d)}/${p2(q.m + 1)}/${p2(q.a % 100)}`; break;
        case 'X': v = `${p2(q.h)}:${p2(q.mi)}:${p2(q.s)}`; break;
        case 'y': v = p2(q.a % 100); break;
        case 'Y': v = String(q.a); break;
        case 'z': v = off; break;
        case ':': v = off.slice(0, 3) + ':' + off.slice(3); break;
        case 'Z': v = q.zona; break;
        case '%': v = '%'; break;
        case '+': v = `${DIAS_C[q.sem]} ${p2(q.d)} ${MESES_C[q.m]} ${q.a} ${p2(q.h)}:${p2(q.mi)}:${p2(q.s)} ${q.zona}`; break;
        default: return todo;
      }
      if (flag === '-') v = v.replace(/^[0 ]+(?=\d)/, '');
      else if (flag === '_') v = v.replace(/^0+(?=\d)/, (z) => ' '.repeat(z.length));
      else if (flag === '^') v = v.toUpperCase();
      return v;
    });
  }
  // fecha de ls -l: «nov 21 09:13» si es de los últimos seis meses, «ene 15  2026» si no
  function fechaLs(ms, ahora) {
    const t = partes(ms);
    const reciente = ms <= ahora + 3600e3 && ahora - ms < 15778476000;
    return MESES_C[t.m] + ' ' + String(t.d).padStart(2, ' ') + ' ' + (reciente ? p2(t.h) + ':' + p2(t.mi) : ' ' + t.a);
  }
  // fecha completa con nanosegundos (stat, ls --full-time)
  const fechaLarga = (ms, ns) => strftime('%Y-%m-%d %H:%M:%S.%N %z', ms, { ns });
  // lee una fecha como date -d y touch -d (formatos habituales); devuelve ms o null
  function leeFecha(txt, ahora) {
    const s = String(txt).trim();
    let m;
    if (s === '' || s === 'now' || s === 'ahora') return ahora;
    if ((m = s.match(/^@(-?\d+)$/))) return +m[1] * 1000;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/))) return desdeLocal(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    if ((m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/))) { const t = partes(ahora); return desdeLocal(t.a, t.m, t.d, +m[1], +m[2], +(m[3] || 0)); }
    const t = partes(ahora), hoy = desdeLocal(t.a, t.m, t.d, 0, 0, 0);
    if (s === 'today' || s === 'hoy') return ahora;
    if (s === 'yesterday' || s === 'ayer') return ahora - 864e5;
    if (s === 'tomorrow' || s === 'mañana') return ahora + 864e5;
    if ((m = s.match(/^([+-]?\d+) (day|days|week|weeks|hour|hours|minute|minutes|month|months|year|years)( ago)?$/))) {
      let n = +m[1] * (m[3] ? -1 : 1);
      const u = { day: 864e5, days: 864e5, week: 6048e5, weeks: 6048e5, hour: 36e5, hours: 36e5, minute: 6e4, minutes: 6e4 }[m[2]];
      if (u) return ahora + n * u;
      const meses = /month/.test(m[2]) ? n : n * 12;
      return desdeLocal(t.a, t.m + meses, t.d, t.h, t.mi, t.s);
    }
    void hoy;
    return null;
  }
  // touch -t [[CC]YY]MMDDhhmm[.ss]
  function leeFechaT(s) {
    const m = String(s).match(/^(\d{2}|\d{4})?(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d{2}))?$/);
    if (!m) return null;
    let a = m[1] ? +m[1] : new Date().getFullYear();
    if (m[1] && m[1].length === 2) a += a < 69 ? 2000 : 1900;
    return desdeLocal(a, +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }

  /* ---------------- errores del sistema (errno) ---------------- */
  const ERR = {
    ENOENT: 'No existe el archivo o el directorio', ENOTDIR: 'No es un directorio', EACCES: 'Permiso denegado',
    EISDIR: 'Es un directorio', EEXIST: 'El archivo ya existe', ENOTEMPTY: 'El directorio no está vacío',
    ELOOP: 'Demasiados niveles de enlaces simbólicos', EBUSY: 'Dispositivo o recurso ocupado', EPERM: 'Operación no permitida',
    EINVAL: 'Argumento inválido', EROFS: 'Sistema de ficheros de sólo lectura', EXDEV: 'Enlace entre dispositivos no válido',
    ENAMETOOLONG: 'Nombre de archivo demasiado largo'
  };
  class ErrorSis extends Error { constructor(codigo, ruta) { super(ERR[codigo] || codigo); this.codigo = codigo; this.ruta = ruta; } }

  /* ---------------- sistema de archivos con inodos ----------------
   * Cada inodo: n (número), tipo ('-' archivo, 'd' directorio, 'l' enlace simbólico, 'c' y 'b' dispositivos,
   * 'p' tubería, 's' socket), modo (permisos con setuid 4000, setgid 2000 y sticky 1000), uid, gid, enlaces
   * (nombres que apuntan a él), datos (texto de un archivo), hijos (Map nombre -> número, directorio), destino
   * (enlace), rdev ([mayor, menor]), fechas en ms (atime, mtime, ctime, btime) y sus nanosegundos.
   * Opcionales: tam (tamaño fijo de un archivo cuyo contenido no se guarda: programas, imágenes), prog (la
   * orden del simulador que ejecuta: los programas de /usr/bin), virtual (tamaño 0, como en /proc), aviso
   * (lo que dice el simulador al listar un directorio que no está completo), dispositivo (en qué disco está). */
  class SistemaArchivos {
    constructor(sis) {
      this.sis = sis;
      this.inodos = new Map();
      this.siguiente = 2;
      this.oyentes = [];
      this.raiz = this.nuevo('d', 0o755, 0, 0).n;
    }
    nuevo(tipo, modo, uid, gid, extra) {
      const ahora = this.sis.ahora(), ns = this.sis.ns();
      const n = extra && extra.n ? extra.n : this.siguiente++;
      if (n >= this.siguiente) this.siguiente = n + 1;
      const ino = Object.assign({ n, tipo, modo, uid, gid, enlaces: 0, atime: ahora, mtime: ahora, ctime: ahora, btime: ahora,
        ans: ns, mns: ns, cns: ns, bns: ns, dispositivo: '8,2' }, extra || {});
      ino.n = n;
      if (tipo === 'd') ino.hijos = ino.hijos || new Map();
      if (tipo === '-' && ino.datos === undefined) ino.datos = '';
      this.inodos.set(n, ino);
      return ino;
    }
    ino(n) { return this.inodos.get(n); }
    // aviso de cambio (crea, cambia, borra) con la ruta, para la vista de árbol y las misiones
    avisa(tipo, ruta, ino) { const ev = { tipo, ruta, ino }; this.oyentes.forEach((f) => f(ev)); }
    tam(ino) {
      if (ino.tam !== undefined) return ino.tam;
      if (ino.virtual) return 0;
      if (ino.tipo === '-') return bytes(ino.datos);
      if (ino.tipo === 'l') return bytes(ino.destino);
      if (ino.tipo === 'd') { let t = 32; ino.hijos.forEach((v, k) => { t += 8 + ((bytes(k) + 3) & ~3); }); return Math.max(4096, Math.ceil(t / 4096) * 4096); }
      return 0;
    }
    bloques(ino) {   // bloques de 512 bytes, como stat (los archivos ocupan bloques enteros de 4 KiB)
      if (ino.virtual || ino.tipo === 'l' || ino.tipo === 'c' || ino.tipo === 'b') return 0;
      if (ino.tipo === 'd') return this.tam(ino) / 512;
      const t = this.tam(ino);
      return t ? Math.ceil(t / 4096) * 8 : 0;
    }
    numEnlaces(ino) {
      if (ino.tipo !== 'd') return ino.enlaces;
      if (ino.nlinkFijo) return ino.nlinkFijo;
      let n = 2;
      ino.hijos.forEach((h) => { const x = this.ino(h); if (x && x.tipo === 'd') n++; });
      return n;
    }
    // lista de [nombre, inodo] de un directorio (sin . ni ..), en el orden en que se crearon
    entradas(dir) { return [...dir.hijos].map(([k, v]) => [k, this.ino(v)]); }

    /* permisos: 'r', 'w' o 'x' para unas credenciales {uid, gid, grupos} */
    puede(cred, ino, que) {
      const bit = { r: 4, w: 2, x: 1 }[que];
      if (cred.uid === 0) return que !== 'x' || ino.tipo === 'd' || (ino.modo & 0o111) !== 0;
      let m;
      if (cred.uid === ino.uid) m = (ino.modo >> 6) & 7;
      else if (cred.gid === ino.gid || (cred.grupos || []).includes(ino.gid)) m = (ino.modo >> 3) & 7;
      else m = ino.modo & 7;
      return (m & bit) !== 0;
    }

    /* Resuelve una ruta. cwd: inodo de partida de las relativas; seguir: seguir el enlace del último componente.
     * Devuelve { ino, padre (inodo del directorio que lo contiene), nombre, existe } o lanza ErrorSis
     * (ENOENT, ENOTDIR, EACCES, ELOOP). Con faltaUltimo: true, que no exista el último componente no es error
     * (para crear): devuelve ino null y el padre. Los puntos de montaje se atraviesan solos. */
    resuelve(ruta, cred, opc) {
      opc = opc || {};
      if (ruta === '') throw new ErrorSis('ENOENT', ruta);
      let actual = ruta[0] === '/' ? this.ino(this.raiz) : this.ino(opc.cwd || this.raiz);
      if (!actual) throw new ErrorSis('ENOENT', ruta);
      const comps = ruta.split('/').filter((c) => c !== '');
      let saltos = opc._saltos || 0;
      let padre = null, nombre = '.';
      for (let i = 0; i < comps.length; i++) {
        const c = comps[i], ultimo = i === comps.length - 1;
        actual = this.montado(actual);
        if (actual.tipo !== 'd') throw new ErrorSis('ENOTDIR', ruta);
        if (!this.puede(cred, actual, 'x')) throw new ErrorSis('EACCES', ruta);
        if (c === '.') { nombre = '.'; padre = actual; continue; }
        if (c === '..') { padre = actual; actual = this.padreDe(actual); nombre = '..'; continue; }
        const h = actual.hijos.get(c);
        if (h === undefined) {
          if (ultimo && opc.faltaUltimo) return { ino: null, padre: actual, nombre: c, existe: false };
          throw new ErrorSis('ENOENT', ruta);
        }
        const sig = this.ino(h);
        if (sig.tipo === 'l' && (!ultimo || opc.seguir !== false)) {
          if (++saltos > 40) throw new ErrorSis('ELOOP', ruta);
          const resto = comps.slice(i + 1).join('/');
          const nueva = sig.destino + (resto ? '/' + resto : '');
          const r = this.resuelve(nueva, cred, Object.assign({}, opc, { cwd: sig.destino[0] === '/' ? this.raiz : actual.n, _saltos: saltos }));
          if (r.existe === false) return r;
          return r;
        }
        padre = actual; nombre = c; actual = sig;
      }
      if (padre === null) padre = actual;
      return { ino: this.montado(actual), padre, nombre, existe: true };
    }
    // si el directorio es un punto de montaje, la raíz del sistema montado
    montado(ino) { let x = ino; let n = 0; while (x && x.montaje !== undefined && n++ < 8) x = this.ino(x.montaje); return x; }
    // directorio padre: se busca por los hijos (los directorios no guardan «..»); en la raíz, la raíz
    padreDe(dir) {
      if (dir.n === this.raiz) return dir;
      if (dir.raizDe !== undefined) { const pm = this.ino(dir.raizDe); return pm ? this.padreDe(pm) : this.ino(this.raiz); }   // raíz de un sistema montado
      if (dir.padre !== undefined && this.ino(dir.padre)) return this.ino(dir.padre);
      return this.ino(this.raiz);
    }
    // ruta absoluta de un inodo de directorio (para pwd -P); recorre desde la raíz
    rutaDe(n) {
      const partes = [];
      let x = this.ino(n), vueltas = 0;
      while (x && x.n !== this.raiz && vueltas++ < 100) {
        if (x.raizDe !== undefined) { x = this.ino(x.raizDe); continue; }   // raíz de un sistema montado: su punto de montaje
        const p = this.ino(x.padre);
        if (!p) break;
        let nom = null;
        for (const [k, v] of p.hijos) if (v === x.n) { nom = k; break; }
        if (nom === null) break;
        partes.unshift(nom); x = p;
      }
      return '/' + partes.join('/');
    }
    // crea una entrada en un directorio (sin comprobar permisos: eso lo hace quien llama)
    enlaza(dir, nombre, ino, ruta) {
      dir.hijos.set(nombre, ino.n);
      ino.enlaces++;
      if (ino.tipo === 'd') ino.padre = dir.n;
      const t = this.sis.ahora(), ns = this.sis.ns();
      dir.mtime = dir.ctime = t; dir.mns = dir.cns = ns;
      if (ino.enlaces > 1) { ino.ctime = t; ino.cns = ns; }
      this.avisa('crea', ruta, ino);
    }
    desenlaza(dir, nombre, ruta) {
      const n = dir.hijos.get(nombre);
      const ino = this.ino(n);
      dir.hijos.delete(nombre);
      const t = this.sis.ahora(), ns = this.sis.ns();
      dir.mtime = dir.ctime = t; dir.mns = dir.cns = ns;
      if (ino) {
        ino.enlaces--;
        ino.ctime = t; ino.cns = ns;
        if (ino.enlaces <= 0) this.inodos.delete(n);
      }
      this.avisa('borra', ruta, ino);
    }
    // escribe en un archivo (truncar o añadir)
    escribe(ino, texto, añadir, ruta) {
      ino.datos = añadir ? (ino.datos || '') + texto : texto;
      delete ino.tam;
      const t = this.sis.ahora(), ns = this.sis.ns();
      ino.mtime = ino.ctime = t; ino.mns = ino.cns = ns;
      this.avisa('cambia', ruta, ino);
    }
    toca(ino, ruta) { const t = this.sis.ahora(), ns = this.sis.ns(); ino.mtime = ino.ctime = ino.atime = t; ino.mns = ino.cns = ino.ans = ns; this.avisa('cambia', ruta, ino); }
  }

  /* ---------------- el sistema: archivos, cuentas, reloj, procesos, paquetes, discos y red ---------------- */
  const DATOS = () => L.datos || { archivos: {}, ordenesUbuntu: [], internasBash: [], binarios: {}, lsColors: '', actualizables: [], cnf: {} };

  class Sistema {
    /* escenario:
     *   usuario      'alumno'          (UID 1000, administrador: grupo sudo)
     *   nombreCompleto 'Alumno'
     *   clave        'alumno'          contraseña del usuario
     *   equipo       'som'             nombre del equipo
     *   fecha        '2026-11-21T09:30:00+01:00' o ms: reloj fijo que avanza un segundo por orden;
     *                sin fecha, el reloj sigue la hora real
     *   cwd          carpeta en la que empieza la sesión ('~' por defecto)
     *   archivos     { ruta: contenido | {datos, modo, uid, gid, mtime, tipo:'d'|'l', destino} }
     *                (las rutas pueden empezar por ~; las carpetas intermedias se crean solas)
     *   carpetas     [ruta, …]
     *   usuarios     [{nombre, uid, grupos, clave, nombreCompleto}]   cuentas extra (ana, luis, marta…)
     *   grupos       [{nombre, gid, miembros}]
     *   instalados   ['tree', …]        paquetes que no vienen en Ubuntu y ya están instalados
     *   discos       [{nombre:'sdb', tam:'5G', particiones:[{nombre:'sdb1', tam:'5G', fs:'ext4', archivos:{…}}]}]
     *   historial    ['ls', …]         órdenes ya escritas (para history y ↑) */
    constructor(esc) {
      esc = this.esc = Object.assign({ usuario: 'alumno', nombreCompleto: 'Alumno', clave: 'alumno', equipo: 'som' }, esc || {});
      this.relojFijo = esc.fecha !== undefined && esc.fecha !== null;
      this.t0 = this.relojFijo ? (typeof esc.fecha === 'number' ? esc.fecha : Date.parse(esc.fecha)) : Date.now();
      this.real0 = Date.now();
      this.extra = 0;        // ms añadidos al reloj (órdenes que esperan, avance de las misiones)
      this.contNs = 123456789;
      this.arranque = this.t0 - (4 * 60 + 37) * 1000;
      this.fs = new SistemaArchivos(this);
      this.pidSig = 2840;
      this.claves = {};      // contraseñas en claro de cada cuenta, para poder comprobarlas (el hash de /etc/shadow es de mentira)
      this.nucleo = L.nucleoDe(esc.nucleo);
      this.disco = L.discoDe(esc.disco);
      this.sesiones = (esc.sesiones || []).map((x) => Object.assign({ desde: 40 }, x));
      this.ip = esc.ip || '10.0.2.15';
      this.paquetes = crearPaquetes((esc.instalados || []).concat(esc.sobrantes || [], esc.manEs === false ? [] : ['manpages-es']));
      // actualizaciones pendientes: las reales de la máquina de pruebas (o las n primeras); apt update las descubre
      const todas = DATOS().actualizables.slice();
      this.actualizables = typeof esc.pendientes === 'number' ? todas.slice(0, esc.pendientes) : todas;
      this.listasAlDia = false;
      this.montajes = [];
      this.discos = [];
      this.oyentes = [];
      this.fs.oyentes.push((ev) => this.oyentes.forEach((f) => f(ev)));
      construyeImagen(this);
      this.registro = [];
      L.aplicaEscenario(this, esc);
    }
    // milisegundos del reloj virtual
    ahora() { return this.relojFijo ? this.t0 + this.extra : Date.now() + this.extra; }
    ns() {   // crecen dentro del mismo milisegundo: lo creado después es más nuevo
      const t = this.ahora();
      if (t !== this.ultT) { this.ultT = t; this.subNs = 1000 + (t % 997) * 13; }
      this.subNs += 1000 + (this.subNs % 7);
      return (((t % 1000) + 1000) % 1000) * 1e6 + Math.min(this.subNs, 999999);
    }
    avanza(ms) { this.extra += ms; }
    cred(usuario) { const u = this.usuario(usuario); return { uid: u.uid, gid: u.gid, grupos: this.gruposDe(u.nombre).map((g) => g.gid) }; }

    /* cuentas: se leen de /etc/passwd, /etc/group y /etc/shadow cada vez, de modo que cambiarlos los cambia */
    lee(ruta) { try { const r = this.fs.resuelve(ruta, { uid: 0, gid: 0 }); return r.ino.tipo === '-' ? r.ino.datos : ''; } catch (e) { return ''; } }
    guarda(ruta, texto) { const r = this.fs.resuelve(ruta, { uid: 0, gid: 0 }); this.fs.escribe(r.ino, texto, false, ruta); }
    usuarios() {
      return this.lee('/etc/passwd').split('\n').filter(Boolean).map((l) => {
        const c = l.split(':');
        return { nombre: c[0], uid: +c[2], gid: +c[3], gecos: c[4] || '', home: c[5] || '/', shell: c[6] || '' };
      });
    }
    grupos() {
      return this.lee('/etc/group').split('\n').filter(Boolean).map((l) => {
        const c = l.split(':');
        return { nombre: c[0], gid: +c[2], miembros: (c[3] || '').split(',').filter(Boolean) };
      });
    }
    usuario(x) { const us = this.usuarios(); return typeof x === 'number' ? us.find((u) => u.uid === x) : us.find((u) => u.nombre === x); }
    grupo(x) { const gs = this.grupos(); return typeof x === 'number' ? gs.find((g) => g.gid === x) : gs.find((g) => g.nombre === x); }
    nombreUid(uid) { const u = this.usuario(uid); return u ? u.nombre : String(uid); }
    nombreGid(gid) { const g = this.grupo(gid); return g ? g.nombre : String(gid); }
    // grupos de un usuario: el principal y los de /etc/group en los que aparece, en el orden de id
    gruposDe(nombre) {
      const u = this.usuario(nombre);
      if (!u) return [];
      const gs = this.grupos();
      const prin = gs.find((g) => g.gid === u.gid) || { nombre: String(u.gid), gid: u.gid, miembros: [] };
      return [prin].concat(gs.filter((g) => g.gid !== u.gid && g.miembros.includes(nombre)));
    }
    compruebaClave(usuario, clave) { return this.claves[usuario] !== undefined && this.claves[usuario] === clave; }
    cambiaClave(usuario, clave) {
      this.claves[usuario] = clave;
      const dia = Math.floor(this.ahora() / 864e5);
      const lineas = this.lee('/etc/shadow').split('\n').filter(Boolean).map((l) => {
        const c = l.split(':');
        if (c[0] !== usuario) return l;
        c[1] = hashClave(clave, 'y', this.ahora()); c[2] = String(dia);
        return c.join(':');
      });
      this.guarda('/etc/shadow', lineas.join('\n') + '\n');
    }

    /* procesos: los del sistema y los de la sesión gráfica, más los que se lanzan */
    nuevoPid() { return this.pidSig += 1 + (this.pidSig % 3 === 0 ? 1 : 0); }
    procesos() { return this._procs; }

    // aviso tras cada cambio en los archivos
    alCambiar(f) { this.oyentes.push(f); return () => { this.oyentes = this.oyentes.filter((x) => x !== f); }; }
    sesion(opc) { return new L.Sesion(this, opc || {}); }

    /* consultas para las vistas y las misiones (como root: no dependen de los permisos) */
    stat(ruta, seguir) {
      try {
        const r = this.fs.resuelve(this.expandeTilde(ruta), { uid: 0, gid: 0 }, { seguir: seguir !== false });
        const i = r.ino;
        return { ino: i.n, tipo: i.tipo, modo: i.modo, uid: i.uid, gid: i.gid, usuario: this.nombreUid(i.uid), grupo: this.nombreGid(i.gid),
          tam: this.fs.tam(i), enlaces: this.fs.numEnlaces(i), mtime: i.mtime, destino: i.destino };
      } catch (e) { return null; }
    }
    existe(ruta) { return this.stat(ruta, false) !== null; }
    esDir(ruta) { const s = this.stat(ruta); return !!s && s.tipo === 'd'; }
    esArchivo(ruta) { const s = this.stat(ruta); return !!s && s.tipo === '-'; }
    leeArchivo(ruta) { try { const r = this.fs.resuelve(this.expandeTilde(ruta), { uid: 0, gid: 0 }); return r.ino.tipo === '-' ? r.ino.datos : null; } catch (e) { return null; } }
    lista(ruta) {
      try {
        const r = this.fs.resuelve(this.expandeTilde(ruta), { uid: 0, gid: 0 });
        if (r.ino.tipo !== 'd') return null;
        return this.fs.entradas(r.ino).map(([n, i]) => ({ nombre: n, tipo: i.tipo, ino: i.n })).sort((a, b) => comparaLocale(a.nombre, b.nombre));
      } catch (e) { return null; }
    }
    // árbol de carpetas desde una ruta: {nombre, ruta, tipo, hijos:[…]} (sin ocultos salvo que se pida)
    arbol(ruta, opc) {
      opc = opc || {};
      const prof = opc.profundidad === undefined ? 6 : opc.profundidad;
      const base = this.expandeTilde(ruta);
      const hazNodo = (r, nombre, nivel) => {
        const s = this.stat(r);
        if (!s) return null;
        const nodo = { nombre, ruta: r, tipo: s.tipo === 'd' ? 'd' : this.stat(r, false).tipo, ino: s.ino };
        if (s.tipo === 'd' && nivel < prof && this.stat(r, false).tipo !== 'l') {
          nodo.hijos = (this.lista(r) || []).filter((h) => opc.ocultos || h.nombre[0] !== '.')
            .map((h) => hazNodo((r === '/' ? '' : r) + '/' + h.nombre, h.nombre, nivel + 1)).filter(Boolean);
        }
        return nodo;
      };
      return hazNodo(base, base === '/' ? '/' : base.split('/').pop(), 0);
    }
    home(usuario) { const u = this.usuario(usuario || this.esc.usuario); return u ? u.home : '/'; }
    expandeTilde(ruta) { return String(ruta).replace(/^~(?=\/|$)/, this.home()); }
  }

  // hash de /etc/shadow con el aspecto de los de Ubuntu ($6$ del instalador, $y$ de passwd); no es el de verdad
  function hashClave(clave, tipo, sal) {
    const abc = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let h = 2166136261 ^ (sal | 0);
    const r = mulberry32(h);
    for (const ch of clave + String(sal)) { h = Math.imul(h ^ ch.charCodeAt(0), 16777619); }
    const r2 = mulberry32(h >>> 0);
    const trozo = (n, f) => Array.from({ length: n }, () => abc[Math.floor(f() * 64)]).join('');
    if (tipo === 'y') return '$y$j9T$' + trozo(22, r) + '$' + trozo(43, r2);
    return '$6$' + trozo(16, r) + '$' + trozo(86, r2);
  }

  /* ---------------- paquetes ----------------
   * Los que se enseñan y no vienen instalados. ordenes: lo que deja en /usr/bin. Datos de apt show y apt-get -s
   * de la máquina de pruebas (21-11-2026). */
  const PAQUETES = {
    tree: { version: '2.1.1-2ubuntu3.24.04.2', origen: 'noble-updates/universe', descarga: '47,4 kB', instalado: '111 kB', ordenes: { tree: 'tree' }, man: ['tree'] },
    ncal: { version: '12.1.8', origen: 'noble/universe', descarga: '21,0 kB', instalado: '59,4 kB', ordenes: { ncal: 'ncal', cal: 'ncal' }, man: ['ncal', 'cal'] },
    // las páginas de man en español (Ubuntu-SOM lo lleva instalado; escenario manEs: false para el antes y el después)
    'manpages-es': { version: '4.21.0-2', origen: 'noble/universe', arq: 'all', descarga: '980 kB', instalado: '1.653 kB', ordenes: {}, man: [], fuente: 'manpages-l10n', descripcion: 'Spanish man pages' },
    plocate: { version: '1.1.19-2ubuntu2', origen: 'noble/universe', descarga: '139 kB', instalado: '524 kB', ordenes: { plocate: 'locate', locate: 'locate', updatedb: 'updatedb', 'plocate-build': null }, man: ['plocate', 'locate', 'updatedb'], deps: ['liburing2'] },
    liburing2: { version: '2.5-1build1', origen: 'noble/main', descarga: '21,1 kB', instalado: '59,4 kB', ordenes: {}, auto: true },
    htop: { version: '3.3.0-4build1', origen: 'noble/main', descarga: '171 kB', instalado: '434 kB', ordenes: { htop: null }, man: ['htop'] },
    'net-tools': { version: '2.10-0.1ubuntu4.4', origen: 'noble-updates/main', descarga: '204 kB', instalado: '811 kB', ordenes: { ifconfig: null, netstat: null, route: null, arp: null }, man: [] },
    sl: { version: '5.02-1', origen: 'noble/universe', descarga: '12,7 kB', instalado: '60,4 kB', ordenes: { sl: null }, man: ['sl'] },
  };
  function crearPaquetes(instalados) {
    const p = {};
    Object.keys(PAQUETES).forEach((k) => { p[k] = Object.assign({ nombre: k, esta: instalados.includes(k) }, PAQUETES[k]); });
    return p;
  }

  /* ---------------- imagen base Ubuntu-SOM ----------------
   * Árbol FHS de una Ubuntu 24.04.5 recién instalada (como la de la práctica 4.6: ESP, raíz, swap y /home), con
   * los archivos de /etc y /proc copiados de la máquina de pruebas y los programas que el simulador sabe
   * ejecutar. No está todo: los directorios incompletos llevan un aviso que sale al listarlos. */
  const AVISO_INCOMPLETO = (d) => `El simulador no copia todo lo que hay en ${d}: solo lo que necesitan las órdenes que sabe ejecutar.`;
  // programas: [ruta, orden del simulador (null = solo existe), tamaño]
  const PROGRAMAS = 'ls cat cp mv rm mkdir rmdir touch pwd date echo env printenv uname whoami id who w top more less head tail wc sort cut tee grep file stat ln df du mount umount lsblk find hostnamectl lsusb lspci ip ping nslookup man sudo apt apt-get passwd clear whereis which lsmod nano vi true false printf bash sh dircolors tput uptime kmod systemctl vim.tiny basename dirname sleep seq yes groups info apropos whatis hostname free efibootmgr dpkg'.split(' ');
  const PROGRAMAS_SBIN = ['update-grub', 'grub-mkconfig', 'dpkg-reconfigure', 'fdisk'];
  function construyeImagen(sis) {
    const fs = sis.fs, D = DATOS();
    const raiz = fs.ino(fs.raiz);
    const fechaFija = (txt) => {   // 'abr 22 2024' o 'nov 17 18:38'
      const m = String(txt).match(/^(\w+) +(\d+) +(\d+):(\d+)$/) || String(txt).match(/^(\w+) +(\d+) +(\d{4})$/);
      if (!m) return sis.ahora();
      const mes = MESES_C.indexOf(m[1]);
      if (m[4] !== undefined) return desdeLocal(2026, mes, +m[2], +m[3], +m[4], 0);
      return desdeLocal(+m[3], mes, +m[2], 12, 0, 0);
    };
    const instalacion = fechaFija('nov 17 18:38');
    const arranque = sis.arranque;
    // crea (o devuelve) un directorio por su ruta absoluta
    const dir = (ruta, modo, uid, gid, fecha) => {
      let actual = raiz, hasta = '';
      for (const c of ruta.split('/').filter(Boolean)) {
        hasta += '/' + c;
        let h = actual.hijos.get(c);
        let x = h !== undefined ? fs.ino(h) : null;
        if (!x) { x = fs.nuevo('d', 0o755, 0, 0); fs.enlaza(actual, c, x, ''); fijaFecha(x, fecha || instalacion); }
        if (x.tipo === 'l') x = fs.resuelve(hasta, { uid: 0, gid: 0 }).ino;
        actual = x;
      }
      if (modo !== undefined) actual.modo = modo;
      if (uid !== undefined) { actual.uid = uid; actual.gid = gid; }
      return actual;
    };
    const fijaFecha = (ino, ms) => { ino.atime = ino.mtime = ino.ctime = ino.btime = ms; };
    const archivo = (ruta, datos, modo, uid, gid, extra, fecha) => {
      const partesR = ruta.split('/'), nom = partesR.pop();
      const d = dir(partesR.join('/') || '/');
      const ino = fs.nuevo('-', modo === undefined ? 0o644 : modo, uid || 0, gid || 0, Object.assign({ datos: datos || '' }, extra || {}));
      fs.enlaza(d, nom, ino, '');
      fijaFecha(ino, fecha || instalacion);
      return ino;
    };
    const enlace = (ruta, destino, fecha) => {
      const partesR = ruta.split('/'), nom = partesR.pop();
      const d = dir(partesR.join('/') || '/');
      const ino = fs.nuevo('l', 0o777, 0, 0, { destino });
      fs.enlaza(d, nom, ino, '');
      fijaFecha(ino, fecha || instalacion);
      return ino;
    };
    const disp = (ruta, tipo, rdev, modo, gid) => {
      const partesR = ruta.split('/'), nom = partesR.pop();
      const d = dir(partesR.join('/'));
      const ino = fs.nuevo(tipo, modo, 0, gid || 0, { rdev });
      fs.enlaza(d, nom, ino, '');
      fijaFecha(ino, arranque);
      return ino;
    };
    raiz.modo = 0o755; fijaFecha(raiz, instalacion);
    // la raíz, como la de la máquina de pruebas (ls -la /)
    enlace('/bin', 'usr/bin', fechaFija('abr 22 2024'));
    dir('/bin.usr-is-merged', 0o755, 0, 0, fechaFija('feb 26 2024'));
    dir('/boot', 0o755, 0, 0, fechaFija('nov 17 19:04'));
    dir('/boot/efi', 0o755, 0, 0, fechaFija('ene 1 1970'));
    dir('/boot/grub', 0o755, 0, 0, fechaFija('nov 17 18:42'));
    dir('/cdrom', 0o555, 0, 0, fechaFija('sep 15 01:19'));
    dir('/dev', 0o755, 0, 0, arranque);
    dir('/etc', 0o755, 0, 0, fechaFija('nov 17 19:04'));
    dir('/home', 0o755, 0, 0);
    enlace('/lib', 'usr/lib', fechaFija('abr 22 2024'));
    enlace('/lib64', 'usr/lib64', fechaFija('abr 22 2024'));
    dir('/lib.usr-is-merged', 0o755, 0, 0, fechaFija('abr 8 2024'));
    dir('/lost+found', 0o700, 0, 0, fechaFija('nov 17 18:32'));
    dir('/media', 0o755, 0, 0, fechaFija('nov 17 18:59'));
    dir('/mnt', 0o755, 0, 0, fechaFija('sep 14 21:03'));
    dir('/opt', 0o755, 0, 0, fechaFija('nov 17 19:04'));
    dir('/proc', 0o555, 0, 0, arranque).virtual = true;
    dir('/root', 0o700, 0, 0, fechaFija('nov 17 18:47'));
    dir('/run', 0o755, 0, 0, arranque);
    enlace('/sbin', 'usr/sbin', fechaFija('abr 22 2024'));
    dir('/sbin.usr-is-merged', 0o755, 0, 0, fechaFija('mar 31 2024'));
    dir('/snap', 0o755, 0, 0, fechaFija('sep 14 21:09'));
    dir('/srv', 0o755, 0, 0, fechaFija('sep 14 21:03'));
    dir('/sys', 0o555, 0, 0, arranque).virtual = true;
    dir('/tmp', 0o1777, 0, 0, arranque);
    dir('/usr', 0o755, 0, 0, fechaFija('sep 14 21:03'));
    dir('/var', 0o755, 0, 0, fechaFija('nov 17 18:47'));
    ['/usr/bin', '/usr/sbin', '/usr/lib', '/usr/lib64', '/usr/local/bin', '/usr/local/sbin', '/usr/share/man/man1', '/usr/share/man/man5', '/usr/share/man/man7', '/usr/share/man/man8', '/usr/share/doc', '/usr/share/zoneinfo/Europe', '/usr/games', '/usr/local/games', '/usr/include', '/usr/src',
      '/var/log', '/var/cache/apt/archives', '/var/lib/dpkg', '/var/lib/apt/lists', '/var/mail', '/var/spool', '/var/backups', '/var/lib/plocate',
      '/etc/apt/sources.list.d', '/etc/default', '/etc/skel', '/etc/sudoers.d', '/etc/systemd', '/etc/ssh', '/etc/cron.d', '/etc/cron.daily', '/etc/profile.d', '/etc/alternatives', '/etc/NetworkManager', '/etc/netplan',
      '/opt/VBoxGuestAdditions-7.2.22', '/run/user/1000', '/run/lock', '/media/' + sis.esc.usuario].forEach((d) => dir(d));
    dir('/var/tmp', 0o1777, 0, 0, arranque);
    dir('/var/mail', 0o2775, 0, 8);
    dir('/var/log', 0o775, 0, 104);
    dir('/run/user/1000', 0o700, 1000, 1000, arranque);
    dir('/media/' + sis.esc.usuario, 0o750, 0, 0, arranque);
    ['/usr/bin', '/usr/sbin', '/usr/lib', '/dev', '/usr/share/man/man1', '/var/log', '/proc', '/sys', '/snap', '/usr/share/doc', '/var/lib/dpkg', '/run'].forEach((d) => { dir(d).aviso = AVISO_INCOMPLETO(d); });
    // archivos copiados de la máquina real (cambiando el usuario y el equipo)
    Object.keys(D.archivos || {}).forEach((ruta) => {
      let datos = D.archivos[ruta];
      if (/^\/proc\//.test(ruta)) { archivo(ruta, datos, 0o444, 0, 0, { virtual: true }, arranque); return; }
      archivo(ruta, datos, 0o644);
    });
    // el resto de /etc de la máquina de pruebas: los archivos con su contenido (o solo su tamaño) y las carpetas
    // vacías con el aviso de que no están completas
    const etc = fs.resuelve('/etc', { uid: 0, gid: 0 }).ino;
    (D.etc || []).forEach((e) => {
      if (etc.hijos.has(e.n)) return;
      const ruta = '/etc/' + e.n;
      if (e.t === 'd') { dir(ruta, e.m, e.u || 0, e.g, e.f).aviso = AVISO_INCOMPLETO(ruta); return; }
      if (e.t === 'l') { enlace(ruta, e.destino, e.f); return; }
      archivo(ruta, e.datos !== undefined ? e.datos : '', e.m, e.u || 0, e.g, e.datos !== undefined ? null : { tam: e.tam }, e.f);
    });
    fs.resuelve('/proc/version', { uid: 0, gid: 0 }).ino.datos = sis.nucleo.proc;
    enlace('/etc/os-release', '../usr/lib/os-release', fechaFija('ago 20 2026'));
    enlace('/etc/localtime', '/usr/share/zoneinfo/Europe/Madrid', fechaFija('nov 17 18:47'));
    archivo('/usr/share/zoneinfo/Europe/Madrid', '', 0o644, 0, 0, { tam: 2614 }, fechaFija('oct 10 2026'));
    enlace('/etc/mtab', '../proc/self/mounts');
    archivo('/etc/fstab', fstab(sis.disco), 0o644);
    archivo('/etc/shadow', '', 0o640, 0, 42);
    archivo('/etc/gshadow', '', 0o640, 0, 42);
    archivo('/etc/sudoers', SUDOERS, 0o440, 0, 0, null, fechaFija('ene 29 2024'));
    archivo('/etc/debian_version', 'trixie/sid\n', 0o644);
    archivo('/etc/machine-id', '83e6d051f9ec4b24a7522a44a1daf67e\n', 0o444);
    // sin /swap.img: Ubuntu-SOM tiene partición de intercambio (con ella, el instalador no crea el archivo)
    archivo('/var/log/syslog', '', 0o640, 102, 4, { tam: 182344 }, arranque + 200000);
    archivo('/var/log/auth.log', '', 0o640, 102, 4, { tam: 12093 }, arranque + 200000);
    archivo('/var/log/dpkg.log', '', 0o644, 0, 0, { tam: 291840 });
    // programas (tamaño y fecha de los de la máquina de pruebas)
    PROGRAMAS.forEach((p) => {
      const info = D.binarios['/usr/bin/' + p];
      if (info && info.destino) { enlace('/usr/bin/' + p, info.destino, fechaFija(info.fecha)); return; }
      const modo = info && info.modo && info.modo[3] === 's' ? 0o4755 : 0o755;
      const ino = archivo('/usr/bin/' + p, '', modo, 0, 0, { tam: info ? info.tam : 35336, prog: p, elf: true }, info ? fechaFija(info.fecha) : fechaFija('ago 25 17:09'));
      void ino;
    });
    PROGRAMAS_SBIN.forEach((p) => archivo('/usr/sbin/' + p, '', 0o755, 0, 0, { tam: p === 'update-grub' ? 64 : 37000, prog: p, elf: p !== 'update-grub' }, fechaFija('abr 8 2024')));
    enlace('/usr/bin/editor', '/etc/alternatives/editor', fechaFija('sep 14 21:06'));
    fs.ino(fs.resuelve('/usr/bin/kmod', { uid: 0, gid: 0 }).ino.n).prog = 'lsmod';
    fs.ino(fs.resuelve('/usr/bin/vim.tiny', { uid: 0, gid: 0 }).ino.n).prog = 'vi';
    enlace('/etc/alternatives/vi', '/usr/bin/vim.tiny', fechaFija('mar 31 2024'));
    enlace('/etc/alternatives/which', '/usr/bin/which.debianutils', fechaFija('mar 31 2024'));
    enlace('/etc/alternatives/editor', '/bin/nano', fechaFija('sep 14 21:06'));
    { const w = fs.resuelve('/usr/bin/which', { uid: 0, gid: 0 }, { seguir: false }).ino; if (w.tipo !== 'l') { /* ya es enlace */ } }
    archivo('/usr/bin/which.debianutils', '', 0o755, 0, 0, { tam: 1209, prog: 'which' }, fechaFija('abr 8 2024'));
    archivo('/usr/sbin/updatedb', null, 0o755);   // se quita abajo si plocate no está
    fs.desenlaza(dir('/usr/sbin'), 'updatedb', '');
    enlace('/sbin/init', '../lib/systemd/systemd');
    // páginas de man (las de las órdenes que tienen; los archivos .gz existen para whereis)
    PAGINAS_MAN.forEach((n) => archivo('/usr/share/man/man1/' + n + '.1.gz', '', 0o644, 0, 0, { tam: 2000 + n.length * 311 }));
    // las demás páginas del sistema base que el simulador tiene copiadas, cada una en su sección
    Object.entries(PAGINAS_MAN_SECCION).forEach(([s, ns]) => ns.split(' ').forEach((n) => archivo(`/usr/share/man/man${s}/${n}.${s}.gz`, '', 0o644, 0, 0, { tam: 1900 + n.length * 277 })));
    archivo('/usr/share/man/man5/passwd.5.gz', '', 0o644, 0, 0, { tam: 2104 });
    archivo('/usr/share/man/man8/ping.8.gz', '', 0o644, 0, 0, { tam: 6235 });
    archivo('/usr/share/man/man8/mount.8.gz', '', 0o644, 0, 0, { tam: 24113 });
    archivo('/usr/share/man/man8/umount.8.gz', '', 0o644, 0, 0, { tam: 4021 });
    archivo('/usr/share/man/man8/lsmod.8.gz', '', 0o644, 0, 0, { tam: 1210 });
    archivo('/usr/share/man/man8/apt.8.gz', '', 0o644, 0, 0, { tam: 4877 });
    archivo('/usr/share/man/man8/sudo.8.gz', '', 0o644, 0, 0, { tam: 11800 });
    archivo('/usr/share/man/man8/ip.8.gz', '', 0o644, 0, 0, { tam: 4120 });
    archivo('/usr/share/info/grep.info.gz', '', 0o644);
    // dispositivos
    disp('/dev/null', 'c', [1, 3], 0o666); disp('/dev/zero', 'c', [1, 5], 0o666); disp('/dev/random', 'c', [1, 8], 0o666);
    disp('/dev/urandom', 'c', [1, 9], 0o666); disp('/dev/tty', 'c', [5, 0], 0o666, 5); disp('/dev/full', 'c', [1, 7], 0o666);
    disp('/dev/sda', 'b', [8, 0], 0o660, 6); disp('/dev/sda1', 'b', [8, 1], 0o660, 6); disp('/dev/sda2', 'b', [8, 2], 0o660, 6);
    disp('/dev/sda3', 'b', [8, 3], 0o660, 6); disp('/dev/sda4', 'b', [8, 4], 0o660, 6); disp('/dev/sr0', 'b', [11, 0], 0o660, 24);
    for (let i = 0; i < 10; i++) disp('/dev/loop' + i, 'b', [7, i], 0o660, 6);
    disp('/dev/tty1', 'c', [4, 1], 0o620, 5); disp('/dev/tty2', 'c', [4, 2], 0o620, 5);
    dir('/dev/pts'); disp('/dev/pts/0', 'c', [136, 0], 0o620, 5);
    enlace('/dev/stdin', '/proc/self/fd/0', arranque); enlace('/dev/stdout', '/proc/self/fd/1', arranque); enlace('/dev/stderr', '/proc/self/fd/2', arranque);
    enlace('/dev/cdrom', 'sr0', arranque);
    // núcleo en /boot
    const kv = sis.nucleo.version;
    archivo('/boot/vmlinuz-' + kv, '', 0o600, 0, 0, { tam: 17070472 }, fechaFija('oct 30 21:07'));
    archivo('/boot/initrd.img-' + kv, '', 0o644, 0, 0, { tam: 81683781 }, fechaFija('nov 17 19:04'));
    archivo('/boot/config-' + kv, '', 0o644, 0, 0, { tam: 308206 }, fechaFija('oct 30 20:50'));
    archivo('/boot/System.map-' + kv, '', 0o600, 0, 0, { tam: 10525718 }, fechaFija('oct 30 20:50'));
    enlace('/boot/vmlinuz', 'vmlinuz-' + kv); enlace('/boot/initrd.img', 'initrd.img-' + kv);
    enlace('/boot/vmlinuz.old', 'vmlinuz-' + kv); enlace('/boot/initrd.img.old', 'initrd.img-' + kv);
    archivo('/boot/grub/grub.cfg', '', 0o600, 0, 0, null, fechaFija('nov 17 18:42'));
    [['ia32.bin', 151176], ['ia32.efi', 155648], ['x64.bin', 152384], ['x64.efi', 156672]].forEach(([n, t]) => archivo('/boot/memtest86+' + n, '', 0o644, 0, 0, { tam: t }, fechaFija('mar 17 2025')));
    dir('/boot/grub').aviso = AVISO_INCOMPLETO('/boot/grub');
    // la partición del sistema EFI (ESP): el cargador shim, GRUB y el gestor de MOK
    const efi = fechaFija('nov 21 12:39');
    ['/boot/efi/EFI', '/boot/efi/EFI/BOOT', '/boot/efi/EFI/ubuntu'].forEach((d) => dir(d, 0o755, 0, 0, efi));
    [['BOOT/BOOTX64.EFI', 966664], ['BOOT/fbx64.efi', 88344], ['BOOT/mmx64.efi', 856280], ['ubuntu/BOOTX64.CSV', 108], ['ubuntu/grubx64.efi', 2660232], ['ubuntu/mmx64.efi', 856280], ['ubuntu/shimx64.efi', 966664]]
      .forEach(([n, t]) => archivo('/boot/efi/EFI/' + n, '', 0o755, 0, 0, { tam: t, elf: /\.efi$/i.test(n) }, efi));
    archivo('/boot/efi/EFI/ubuntu/grub.cfg', `search.fs_uuid ${sis.disco.particiones.find((p) => p.clave === 'raiz').uuid} root hd0,${sis.disco.raizGpt} \nset prefix=($root)'/boot/grub'\nconfigfile $prefix/grub.cfg\n`, 0o755, 0, 0, null, efi);
    ['/sys/firmware', '/sys/firmware/efi', '/sys/firmware/efi/efivars'].forEach((d) => { dir(d, 0o755, 0, 0, arranque).virtual = true; });
    // las fechas de las carpetas, como en la máquina (la raíz de la ESP no tiene fecha: 1 de enero de 1970)
    [['/boot', fechaFija('nov 17 19:04')], ['/boot/grub', fechaFija('nov 17 18:42')], ['/boot/efi', fechaFija('ene 1 1970')], ['/boot/efi/EFI', efi], ['/boot/efi/EFI/BOOT', efi], ['/boot/efi/EFI/ubuntu', efi]]
      .forEach(([d, f]) => fijaFecha(fs.resuelve(d, { uid: 0, gid: 0 }).ino, f));
    // discos y montajes de Ubuntu-SOM (máquina con UEFI, 21-11-2026): GPT con ESP de 1075 MiB, raíz de 25 GB del
    // instalador (23,3G en lsblk), intercambio de 2 GB (1,9G) y /home con el resto (13,8G en un disco de 40 GiB)
    sis.discos = [
      { nombre: 'sda', mm: '8:0', tam: L.tamLsblk(sis.disco.sectores * 512), tipo: 'disk', particiones: sis.disco.particiones },
      { nombre: 'sr0', mm: '11:0', rm: 1, tam: '1024M', ro: 1, tipo: 'rom', particiones: [] }
    ];
    sis.disco.particiones.forEach((p, i) => { if (i >= 4) disp('/dev/' + p.nombre, 'b', [8, i + 1], 0o660, 6); });
    sis.snaps = [['bare/5', '4K'], ['firefox/8863', '260,8M'], ['gnome-46-2404/164', '614,5M'], ['core24/2124', '66,8M'], ['firmware-updater/226', '16,5M'],
      ['gtk-common-themes/1535', '91,7M'], ['mesa-2404/1839', '402M'], ['snap-store/1390', '11,8M'], ['snapd/27738', '50,3M'], ['snapd-desktop-integration/391', '828K']];
    sis.snaps.forEach(([s]) => dir('/snap/' + s, 0o755, 0, 0, fechaFija('sep 14 21:09')));
    // sistemas montados (df): tamaños en bloques de 1 KiB
    sis.montajes = [
      { disp: 'tmpfs', en: '/run', tipo: 'tmpfs', opc: 'rw,nosuid,nodev,noexec,relatime,size=398800k,mode=755,inode64', bloques: 398800, usados: 2760, nodos: 498500, nusados: 1020 },
      sis.disco.montajeRaiz,
      { disp: 'tmpfs', en: '/dev/shm', tipo: 'tmpfs', opc: 'rw,nosuid,nodev,inode64', bloques: 1994000, usados: 0, nodos: 498500, nusados: 1 },
      { disp: 'tmpfs', en: '/run/lock', tipo: 'tmpfs', opc: 'rw,nosuid,nodev,noexec,relatime,size=5120k,inode64', bloques: 5120, usados: 8, nodos: 498500, nusados: 4 },
      { disp: 'efivarfs', en: '/sys/firmware/efi/efivars', tipo: 'efivarfs', opc: 'rw,nosuid,nodev,noexec,relatime', bloques: 256, usados: 12, disponibles: 240, nodos: 0, nusados: 0 },
      sis.disco.montajeHome,
      sis.disco.montajeEfi,
      { disp: 'tmpfs', en: '/run/user/1000', tipo: 'tmpfs', opc: 'rw,nosuid,nodev,relatime,size=398796k,nr_inodes=99699,mode=700,uid=1000,gid=1000,inode64', bloques: 398796, usados: 152, nodos: 99699, nusados: 91 }
    ];
    // procesos de una sesión de escritorio recién abierta
    const t = sis.arranque;
    const P = (pid, ppid, uid, orden, ni, estado, virt, res, shr, cpu, mem, seg, tty, ruta) => ({ pid, ppid, uid, orden, ni, estado, virt, res, shr, cpu, mem, tiempo: seg, tty: tty || '?', inicio: t + pid * 37, ruta: ruta || orden });
    sis._procs = [
      P(1, 0, 0, 'systemd', 0, 'S', 23068, 14436, 9752, 0, 0.4, 1.85, '?', '/sbin/init splash'),
      P(2, 0, 0, 'kthreadd', 0, 'S', 0, 0, 0, 0, 0, 0.03),
      P(14, 2, 0, 'ksoftirqd/0', 0, 'S', 0, 0, 0, 0, 0, 0.02),
      P(15, 2, 0, 'rcu_preempt', 0, 'I', 0, 0, 0, 0, 0, 0.11),
      P(56, 2, 0, 'kswapd0', 0, 'S', 0, 0, 0, 0, 0, 0),
      P(312, 1, 0, 'systemd-journal', -1, 'S', 50432, 16752, 15600, 0, 0.4, 0.31, '?', '/usr/lib/systemd/systemd-journald'),
      P(371, 1, 0, 'systemd-udevd', 0, 'S', 30284, 8064, 4992, 0, 0.2, 0.42, '?', '/usr/lib/systemd/systemd-udevd'),
      P(523, 1, 991, 'systemd-resolve', 0, 'S', 21592, 12672, 10624, 0, 0.3, 0.12, '?', '/usr/lib/systemd/systemd-resolved'),
      P(611, 1, 101, 'dbus-daemon', 0, 'S', 11524, 6272, 4096, 0, 0.2, 0.71, '?', '@dbus-daemon --system --address=systemd: --nofork --nopidfile --systemd-activation --syslog-only'),
      P(640, 1, 0, 'NetworkManager', 0, 'S', 334840, 22144, 18048, 0, 0.6, 0.35, '?', '/usr/sbin/NetworkManager --no-daemon'),
      P(702, 1, 0, 'cron', 0, 'S', 7196, 2816, 2560, 0, 0.1, 0, '?', '/usr/sbin/cron -f -P'),
      P(888, 1, 0, 'gdm3', 0, 'S', 372460, 11232, 9440, 0, 0.3, 0.02, '?', '/usr/sbin/gdm3'),
      P(1460, 1, 1000, 'systemd', 0, 'S', 20748, 12416, 9472, 0, 0.3, 0.21, '?', '/usr/lib/systemd/systemd --user'),
      P(1512, 888, 1000, 'gdm-wayland-ses', 0, 'S', 233392, 6272, 5760, 0, 0.2, 0, 'tty2', '/usr/libexec/gdm-wayland-session env GNOME_SHELL_SESSION_MODE=ubuntu /usr/bin/gnome-session --session=ubuntu'),
      P(1518, 1512, 1000, 'gnome-session-b', 0, 'S', 524536, 17280, 15104, 0, 0.4, 0.05, 'tty2', '/usr/libexec/gnome-session-binary --session=ubuntu'),
      P(1633, 1460, 1000, 'gnome-shell', 0, 'S', 4846964, 286312, 128404, 1.3, 7.1, 21.43, '?', '/usr/bin/gnome-shell'),
      P(2103, 1460, 1000, 'gnome-terminal-', 0, 'S', 646792, 55168, 41216, 0.3, 1.4, 1.22, '?', '/usr/libexec/gnome-terminal-server'),
      P(2131, 2103, 1000, 'bash', 0, 'S', 11888, 5376, 3456, 0, 0.1, 0.01, 'pts/0', 'bash')
    ];
    sis.pidBash = 2131;
    // otras sesiones del escenario (who, w y top): un usuario en una consola de texto con una orden en marcha
    sis.sesiones.forEach((s, i) => {
      const pid = 3100 + i * 40;
      s.pidLogin = pid;
      sis._procs.push(P(pid, 1, 0, 'login', 0, 'S', 10476, 4352, 3584, 0, 0.1, 0.02, s.tty, '/bin/login -p --'));
      s.pidBash = pid + 7;
      s.pidOrden = pid + 19;
    });
  }
  const PAGINAS_MAN = 'ls cat cp mv rm mkdir rmdir touch pwd date echo env printenv uname whoami id who w top more less head tail wc sort cut tee grep file stat ln df du find hostnamectl lsusb lspci lsblk nslookup man passwd clear whereis which nano vi bash uptime sleep seq yes groups basename dirname dircolors tty test'.split(' ');
  const PAGINAS_MAN_SECCION = {
    1: 'free hostname apropos whatis info ps kill su printf true false systemctl crontab',
    5: 'passwd crontab',
    7: 'hier',
    8: 'lsmod ip ping sudo apt apt-get mount umount update-grub grub-mkconfig dpkg-reconfigure'
  };
  const SUDOERS = '#\n# This file MUST be edited with the \'visudo\' command as root.\n#\n# Please consider adding local content in /etc/sudoers.d/ instead of\n# directly modifying this file.\n#\n# See the man page for details on how to write a sudoers file.\n#\nDefaults\tenv_reset\nDefaults\tmail_badpass\nDefaults\tsecure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin"\nDefaults\tuse_pty\n\n# User privilege specification\nroot\tALL=(ALL:ALL) ALL\n\n# Members of the admin group may gain root privileges\n%admin ALL=(ALL) ALL\n\n# Allow members of group sudo to execute any command\n%sudo\tALL=(ALL:ALL) ALL\n\n# See sudoers(5) for more information on "@include" directives:\n\n@includedir /etc/sudoers.d\n';
  function fstab(d) {
    const p = (m) => d.particiones.find((x) => x.montaje === m);
    const raiz = p('/'), efi = p('/boot/efi'), home = p('/home'), swap = p('[SWAP]');
    return '# /etc/fstab: static file system information.\n#\n# Use \'blkid\' to print the universally unique identifier for a\n# device; this may be used with UUID= as a more robust way to name devices\n# that works even if disks are added and removed. See fstab(5).\n#\n# <file system> <mount point>   <type>  <options>       <dump>  <pass>\n'
      + `# / was on /dev/${raiz.nombre} during curtin installation\n/dev/disk/by-uuid/${raiz.uuid} / ext4 defaults 0 1\n`
      + `/dev/disk/by-uuid/${swap.uuid} none swap sw 0 0\n`
      + `# /home was on /dev/${home.nombre} during curtin installation\n/dev/disk/by-uuid/${home.uuid} /home ext4 defaults 0 1\n`
      + `# /boot/efi was on /dev/${efi.nombre} during curtin installation\n/dev/disk/by-uuid/${efi.uuid} /boot/efi vfat defaults 0 1\n`;
  }
  /* Núcleo del escenario (para uname, /proc/version, /boot, lsmod y grub.cfg). Por defecto, el de la máquina de
   * pruebas. n: { version, numero (el #43…), fecha (de compilación), arquitectura ('x86_64' | 'aarch64'), gcc,
   * binutils, modulos: { añade: [], quita: [] } } */
  L.nucleoDe = function (n) {
    n = Object.assign({ version: '7.0.0-43-generic', numero: '43~24.04.1', fecha: 'Sat Oct 31 06:52:47 UTC 2026', arquitectura: 'x86_64', gcc: '13.3.0-6ubuntu2~24.04.1', binutils: '2.42', modulos: {} }, n || {});
    const arm = n.arquitectura === 'aarch64';
    // la versión que guarda el núcleo cabe en 64 caracteres: el resto se corta (por eso acaba en «UTC 2»)
    n.compilacion = ('#' + n.numero + '-Ubuntu SMP PREEMPT_DYNAMIC ' + n.fecha).slice(0, 64);
    const base = n.gcc.split('-')[0], mayor = base.split('.')[0];
    n.proc = `Linux version ${n.version} (buildd@${arm ? 'bos03-arm64-024' : 'lcy02-amd64-011'}) (${n.arquitectura}-linux-gnu-gcc-${mayor} (Ubuntu ${n.gcc}) ${base}, GNU ld (GNU Binutils for Ubuntu) ${n.binutils}) ${n.compilacion}\n`;
    n.modulos = Object.assign({ añade: [], quita: [] }, n.modulos);
    return n;
  };
  /* Disco de Ubuntu-SOM: tam (GB), swap (GB) y el orden de las particiones ('efi', 'raiz', 'swap', 'home'). /home se
   * queda con el resto. Devuelve las particiones de lsblk y lo que df necesita de cada sistema montado. */
  L.discoDe = function (d) {
    d = Object.assign({ tam: 40, swap: 2, raiz: 25, orden: ['efi', 'raiz', 'swap', 'home'] }, d || {});
    // sectores de 512 bytes; el instalador cuenta en GB decimales y alinea a MiB: 25 GB -> 23842 MiB (23,3G en lsblk)
    const total = d.tam * 2097152;
    const gb = (g) => Math.ceil((g * 1e9) / 1048576) * 2048;
    const sect = { efi: 1075 * 2048, raiz: gb(d.raiz), swap: gb(d.swap) };
    sect.home = total - 2048 - 2048 - sect.efi - sect.raiz - sect.swap;   // la primera empieza en 2048 y la última acaba 2049 antes del final
    const datos = {
      efi: { fs: 'vfat', fsver: 'FAT32', uuid: '0BEE-FF4B', guid: '33063dc8-9cac-4a1a-841b-490e50c9e0ef', montaje: '/boot/efi', tipoGpt: 'Sistema EFI' },
      raiz: { fs: 'ext4', fsver: '1.0', uuid: 'b6f132c6-2aeb-46b0-854f-f47854e6191f', montaje: '/', tipoGpt: 'Sistema de ficheros de Linux' },
      swap: { fs: 'swap', fsver: '1', uuid: 'df6c895f-c130-401a-a6a8-dac038c493e0', montaje: '[SWAP]', tipoGpt: 'Linux swap' },
      home: { fs: 'ext4', fsver: '1.0', uuid: 'a8ad98f6-f1c3-40f4-be2c-2696957c0ae7', montaje: '/home', tipoGpt: 'Sistema de ficheros de Linux' }
    };
    let ini = 2048;
    d.sectores = total;
    d.particiones = d.orden.map((k, i) => {
      const n = sect[k];
      const p = Object.assign({ clave: k, nombre: 'sda' + (i + 1), mm: '8:' + (i + 1), tipo: 'part', inicio: ini, fin: ini + n - 1, sectoresP: n, tam: L.tamLsblk(n * 512) }, datos[k]);
      ini += n;
      return p;
    });
    const parte = (k) => d.particiones.find((p) => p.clave === k);
    const nombre = (k) => '/dev/' + parte(k).nombre;
    // ext4: lo que deja el formato (bloques de 1 KiB), lo ocupado por la instalación y el 5 % reservado para root
    const ext4 = (k, factor, usados) => { const b = Math.round((sect[k] / 2) * factor); return { bloques: b, usados, disponibles: b - usados - Math.round(b * 0.05), nodos: Math.round(sect[k] / 32), nusados: k === 'raiz' ? 174280 : 31 }; };
    d.montajeRaiz = Object.assign({ disp: nombre('raiz'), en: '/', tipo: 'ext4', opc: 'rw,relatime' }, ext4('raiz', 0.974847, 6480000));
    d.montajeHome = Object.assign({ disp: nombre('home'), en: '/home', tipo: 'ext4', opc: 'rw,relatime' }, ext4('home', 0.978364, 16000));
    d.montajeEfi = { disp: nombre('efi'), en: '/boot/efi', tipo: 'vfat', opc: 'rw,relatime,fmask=0022,dmask=0022,codepage=437,iocharset=iso8859-1,shortname=mixed,errors=remount-ro', bloques: 1098632, usados: 6284, disponibles: 1092348, nodos: 0, nusados: 0 };
    // lsblk -f: espacio libre (redondeado como lsblk) y porcentaje usado
    [['raiz', d.montajeRaiz], ['home', d.montajeHome], ['efi', d.montajeEfi]].forEach(([k, m]) => { parte(k).disp = L.tamLsblk(m.disponibles * 1024); parte(k).uso = Math.round((m.usados * 100) / m.bloques) + '%'; });
    d.raizGpt = 'gpt' + (d.orden.indexOf('raiz') + 1);
    return d;
  };
  /* Tamaño de la letra de la terminal (preferencia de quien mira, linux-term.js): escalones sobre --term-letra.
   * Al 150 % la terminal de una misión con árbol (59 columnas al 100 %) se queda en unas 40 columnas. */
  L.ESCALAS_LETRA = [0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5];
  // columnas y filas que caben en un hueco (en píxeles) con un ancho de carácter y un alto de línea dados
  L.columnasTerminal = (ancho, anchoCar) => Math.max(20, Math.floor(ancho / anchoCar));
  // columnas que necesita como poco la terminal de una misión con vista (cada misión puede pedir más: m.columnas)
  L.COLS_MISION = 40;
  /* nano 7.2 (winio.c, get_page_start): primera columna que se ve de la línea del cursor. La línea no se desplaza
   * mientras el cursor quepa dejando dos columnas libres: una línea de n letras con el cursor detrás necesita n + 3. */
  L.inicioPaginaNano = (x, cols) => (x === 0 || x + 2 < cols ? 0 : cols > 8 ? x - 6 - ((x - 6) % (cols - 8)) : x - (cols - 1));
  L.filasTerminal = (alto, altoLinea) => Math.max(5, Math.floor(alto / altoLinea));
  // tamaño legible como lsblk y fdisk (util-linux): potencias de 1024, una cifra decimal redondeada y coma
  L.tamLsblk = function (bytes) {
    const u = ['B', 'K', 'M', 'G', 'T', 'P'];
    let e = 0;
    while (e < 5 && bytes >= Math.pow(1024, e + 1)) e++;
    if (!e) return bytes + 'B';
    const base = Math.pow(1024, e);
    let dec = Math.floor(bytes / base);
    let frac = Math.floor(((bytes - dec * base) * 1000) / base);
    frac = Math.floor((frac + 50) / 100);
    if (frac === 10) { dec++; frac = 0; }
    return dec + (frac ? ',' + frac : '') + u[e];
  };

  // ¿tiene la máquina las páginas de man en español?
  L.manEs = (sis) => !!(sis.paquetes['manpages-es'] && sis.paquetes['manpages-es'].esta);
  // registro de lo que pasa en la sesión (para las misiones); linux-ut4.js usa el mismo
  L.registra = L.registra || function (sis, ev) { (sis.registro = sis.registro || []).push(Object.assign({ cuando: sis.ahora() }, ev)); };

  /* El escenario: usuario, equipo, carpeta personal con las carpetas de un usuario de escritorio, cuentas
   * extra, archivos y paquetes instalados. Se puede llamar también desde las misiones. */
  L.aplicaEscenario = function (sis, esc) {
    const fs = sis.fs, root = { uid: 0, gid: 0 };
    const u = esc.usuario;
    // passwd y group: el usuario del escenario en lugar de alumno
    if (u !== 'alumno') {
      ['/etc/passwd', '/etc/group'].forEach((r) => sis.guarda(r, sis.lee(r).replace(/\balumno\b/g, u)));
    }
    sis.guarda('/etc/passwd', sis.lee('/etc/passwd').replace(new RegExp('^' + u + ':x:1000:1000:[^:]*:', 'm'), u + ':x:1000:1000:' + esc.nombreCompleto + ':'));
    sis.guarda('/etc/hostname', esc.equipo + '\n');
    sis.guarda('/etc/hosts', sis.lee('/etc/hosts').replace(/^127\.0\.1\.1 .*$/m, '127.0.1.1 ' + esc.equipo));
    // shadow y gshadow a partir de passwd y group
    const dia = Math.floor((sis.t0 - 4 * 864e5) / 864e5);
    sis.guarda('/etc/shadow', sis.usuarios().map((x) => x.nombre + ':' + (x.uid === 1000 ? hashClave(esc.clave, '6', 7) : '*') + ':' + dia + ':0:99999:7:::').join('\n') + '\n');
    sis.guarda('/etc/gshadow', sis.grupos().map((g) => g.nombre + ':' + (g.gid === 1000 ? '!' : '*') + '::' + g.miembros.join(',')).join('\n') + '\n');
    sis.claves[u] = esc.clave;
    // las copias de seguridad (passwd-, group-, shadow-, gshadow-) y los rangos de subuid y subgid, del usuario del escenario
    [['/etc/passwd-', '/etc/passwd'], ['/etc/group-', '/etc/group'], ['/etc/shadow-', '/etc/shadow'], ['/etc/gshadow-', '/etc/gshadow']].forEach(([c, o]) => {
      try { const i = fs.resuelve(c, root).ino; i.datos = sis.lee(o); delete i.tam; } catch (e) { /* no está */ }
    });
    ['/etc/subuid', '/etc/subgid', '/etc/subuid-', '/etc/subgid-'].forEach((r) => { try { const i = fs.resuelve(r, root).ino; i.datos = (i.datos || '').replace(/^alumno:/m, u + ':'); } catch (e) { /* no está */ } });
    (esc.grupos || []).forEach((g) => L.creaGrupo(sis, g.nombre, g.gid, g.miembros || []));
    (esc.usuarios || []).forEach((x) => L.creaUsuario(sis, x));
    // carpeta personal: la crea el instalador con el esqueleto y las carpetas de escritorio en español
    L.creaHome(sis, u, 1000, 1000, true, Math.min(sis.t0 - 3600e3, desdeLocal(2026, 10, 17, 18, 48, 0)));
    // carpetas y archivos del escenario
    const home = sis.home(u);
    const abs = (r) => r.replace(/^~(?=\/|$)/, home).replace(/^(?!\/)/, home + '/');
    const cred = { uid: 1000, gid: 1000, grupos: [1000] };
    const creaDirs = (ruta, dueño) => {
      let actual = fs.ino(fs.raiz), r = '';
      for (const c of ruta.split('/').filter(Boolean)) {
        r += '/' + c;
        let h = actual.hijos.get(c);
        let x = h !== undefined ? fs.ino(h) : null;
        if (!x) { x = fs.nuevo('d', 0o775, dueño.uid, dueño.gid); fs.enlaza(actual, c, x, r); }
        actual = fs.montado(x);
      }
      return actual;
    };
    const dueñoDe = (ruta, spec) => {
      if (spec && spec.uid !== undefined) return { uid: spec.uid, gid: spec.gid !== undefined ? spec.gid : spec.uid };
      if (spec && spec.usuario) { const x = sis.usuario(spec.usuario); return { uid: x.uid, gid: x.gid }; }
      return ruta.startsWith(home) || ruta.startsWith('/tmp') ? cred : root;
    };
    (esc.carpetas || []).forEach((c) => { const r = abs(c); creaDirs(r, dueñoDe(r)); });
    Object.keys(esc.archivos || {}).forEach((k) => {
      let v = esc.archivos[k];
      const r = abs(k);
      if (typeof v === 'string' || v === null) v = { datos: v || '' };
      const dueño = dueñoDe(r, v);
      const partesR = r.split('/'), nom = partesR.pop();
      const d = creaDirs(partesR.join('/'), dueño);
      if (d.hijos.has(nom)) { const viejo = d.hijos.get(nom); if (fs.ino(viejo).tipo === 'd' && v.tipo === 'd') return; fs.desenlaza(d, nom, r); }
      let ino;
      if (v.tipo === 'd') ino = fs.nuevo('d', v.modo !== undefined ? v.modo : 0o775, dueño.uid, dueño.gid);
      else if (v.tipo === 'l') ino = fs.nuevo('l', 0o777, dueño.uid, dueño.gid, { destino: v.destino });
      else ino = fs.nuevo('-', v.modo !== undefined ? v.modo : 0o664, dueño.uid, dueño.gid, Object.assign({ datos: v.datos || '' }, v.tam !== undefined ? { tam: v.tam, tipoArchivo: v.tipoArchivo } : {}));
      fs.enlaza(d, nom, ino, r);
      if (v.mtime !== undefined) { const ms = typeof v.mtime === 'number' ? v.mtime : leeFecha(v.mtime, sis.ahora()); ino.mtime = ino.atime = ino.ctime = ms; }
    });
    // paquetes ya instalados
    Object.values(sis.paquetes).forEach((p) => { if (p.esta) L.instalaPaquete(sis, p.nombre, true); });
    (esc.discos || []).forEach((d) => L.añadeDisco(sis, d));
    // procesos de las otras sesiones (el usuario ya existe)
    sis.sesiones.forEach((s) => {
      if (!sis.usuario(s.usuario)) L.creaUsuario(sis, { nombre: s.usuario });
      const uid = sis.usuario(s.usuario).uid;
      const t0 = sis.arranque + 3 * 60000;
      sis._procs.push({ pid: s.pidBash, ppid: s.pidLogin, uid, orden: 'bash', ni: 0, estado: 'S', virt: 11888, res: 5248, shr: 3456, cpu: 0, mem: 0.1, tiempo: 0.01, tty: s.tty, inicio: t0, ruta: '-bash' });
      const ord = s.orden || 'top';
      sis._procs.push({ pid: s.pidOrden, ppid: s.pidBash, uid, orden: ord.split(' ')[0], ni: 0, estado: ord.startsWith('top') ? 'R' : 'S', virt: 12108, res: 5900, shr: 3720, cpu: ord.startsWith('top') ? 0.3 : 0, mem: 0.1, tiempo: 0.4, tty: s.tty, inicio: t0 + 60000, ruta: ord });
    });
    sis.historialInicial = (esc.historial || []).slice();
    // grub.cfg generado con /etc/default/grub (como lo dejó el instalador)
    // (sin linux-ut4.js, el de la máquina de pruebas tal cual)
    { const g = fs.resuelve('/boot/grub/grub.cfg', root).ino; g.datos = L.generaGrubCfg ? L.generaGrubCfg(sis) : (DATOS().grubCfg || ''); delete g.tam; }
    if (esc.defaultGrub) { sis.guarda('/etc/default/grub', esc.defaultGrub); }
  };

  L.creaHome = function (sis, nombre, uid, gid, escritorio, fecha) {
    const fs = sis.fs;
    const home = fs.resuelve('/home', { uid: 0, gid: 0 }).ino;
    if (home.hijos.has(nombre)) return;
    const h = fs.nuevo('d', 0o750, uid, gid);
    fs.enlaza(home, nombre, h, '/home/' + nombre);
    const ruta = '/home/' + nombre;
    ['.bashrc', '.profile', '.bash_logout'].forEach((f) => {
      const src = fs.resuelve('/etc/skel/' + f, { uid: 0, gid: 0 }).ino;
      const ino = fs.nuevo('-', 0o644, uid, gid, { datos: src.datos });
      ino.mtime = ino.atime = ino.ctime = ino.btime = src.mtime;
      fs.enlaza(h, f, ino, ruta + '/' + f);
    });
    if (escritorio) {
      ['Descargas', 'Documentos', 'Escritorio', 'Imágenes', 'Música', 'Plantillas', 'Público', 'Vídeos'].forEach((d) => {
        const x = fs.nuevo('d', 0o755, uid, gid); fs.enlaza(h, d, x, ruta + '/' + d);
      });
      const snap = fs.nuevo('d', 0o700, uid, gid); fs.enlaza(h, 'snap', snap, ruta + '/snap');
      ['firefox', 'snapd-desktop-integration'].forEach((d) => { const x = fs.nuevo('d', 0o755, uid, gid); fs.enlaza(snap, d, x, ruta + '/snap/' + d); });
      ['.cache', '.config', '.local'].forEach((d) => { const x = fs.nuevo('d', 0o700, uid, gid); fs.enlaza(h, d, x, ruta + '/' + d); });
      const sudo = fs.nuevo('-', 0o644, uid, gid, { datos: '' }); fs.enlaza(h, '.sudo_as_admin_successful', sudo, ruta + '/.sudo_as_admin_successful');
      fs.desenlaza(h, '.sudo_as_admin_successful', ruta);   // se crea con el primer sudo
    }
    // fechas de la instalación (las carpetas del escritorio se crean al entrar por primera vez)
    if (fecha) {
      const pon = (ino) => { ino.mtime = ino.atime = ino.ctime = ino.btime = fecha; };
      pon(h); fs.entradas(h).forEach(([n, i]) => { if (i.tipo === 'd') { pon(i); fs.entradas(i).forEach(([m, j]) => pon(j)); } });
    }
  };
  L.creaGrupo = function (sis, nombre, gid, miembros) {
    if (sis.grupo(nombre)) return;
    if (gid === undefined) gid = Math.max(1000, ...sis.grupos().filter((g) => g.gid >= 1000 && g.gid < 60000).map((g) => g.gid + 1));
    sis.guarda('/etc/group', sis.lee('/etc/group') + `${nombre}:x:${gid}:${(miembros || []).join(',')}\n`);
    sis.guarda('/etc/gshadow', sis.lee('/etc/gshadow') + `${nombre}:!::${(miembros || []).join(',')}\n`);
  };
  // cuenta como la crea adduser: grupo propio con el mismo número, carpeta con el esqueleto, shell bash
  L.creaUsuario = function (sis, x) {
    if (sis.usuario(x.nombre)) return;
    const libres = sis.usuarios().filter((u) => u.uid >= 1000 && u.uid < 60000).map((u) => u.uid);
    const uid = x.uid !== undefined ? x.uid : Math.max(1000, ...libres.map((n) => n + 1));
    L.creaGrupo(sis, x.nombre, uid, []);
    const gid = sis.grupo(x.nombre).gid;
    sis.guarda('/etc/passwd', sis.lee('/etc/passwd') + `${x.nombre}:x:${uid}:${gid}:${x.nombreCompleto || ''},,,:/home/${x.nombre}:/bin/bash\n`);
    const dia = Math.floor(sis.ahora() / 864e5);
    sis.guarda('/etc/shadow', sis.lee('/etc/shadow') + `${x.nombre}:${hashClave(x.clave || x.nombre, 'y', uid)}:${dia}:0:99999:7:::\n`);
    sis.claves[x.nombre] = x.clave || x.nombre;
    (x.grupos || []).forEach((g) => {
      if (!sis.grupo(g)) L.creaGrupo(sis, g);
      sis.guarda('/etc/group', sis.lee('/etc/group').split('\n').map((l) => {
        const c = l.split(':');
        if (c[0] !== g) return l;
        const m = (c[3] || '').split(',').filter(Boolean); if (!m.includes(x.nombre)) m.push(x.nombre);
        c[3] = m.join(','); return c.join(':');
      }).join('\n'));
    });
    L.creaHome(sis, x.nombre, uid, gid, false);
  };
  // instala un paquete: sus programas en /usr/bin y sus páginas de man
  L.instalaPaquete = function (sis, nombre, callado) {
    const p = sis.paquetes[nombre];
    if (!p) return false;
    const fs = sis.fs, bin = fs.resuelve('/usr/bin', { uid: 0, gid: 0 }).ino, sbin = fs.resuelve('/usr/sbin', { uid: 0, gid: 0 }).ino;
    (p.deps || []).forEach((d) => L.instalaPaquete(sis, d, true));
    const juegos = fs.resuelve('/usr/games', { uid: 0, gid: 0 }).ino;
    Object.keys(p.ordenes).forEach((o) => {
      const dest = o === 'updatedb' ? sbin : p.juegos ? juegos : bin;
      if (dest.hijos.has(o)) return;
      if (nombre === 'ncal' && o === 'cal') { const l = fs.nuevo('l', 0o777, 0, 0, { destino: 'ncal' }); fs.enlaza(dest, o, l, '/usr/bin/cal'); return; }
      if (nombre === 'plocate' && o === 'locate') { const l = fs.nuevo('l', 0o777, 0, 0, { destino: 'plocate' }); fs.enlaza(dest, o, l, '/usr/bin/locate'); return; }
      const ino = fs.nuevo('-', o === 'plocate' ? 0o2755 : 0o755, 0, o === 'plocate' ? 999 : 0, { tam: 60000 + o.length * 1777, prog: p.ordenes[o] || undefined, elf: true });
      if (!p.ordenes[o]) ino.noSimulado = o;
      fs.enlaza(dest, o, ino, (dest === sbin ? '/usr/sbin/' : dest === juegos ? '/usr/games/' : '/usr/bin/') + o);
    });
    const man = fs.resuelve('/usr/share/man/man1', { uid: 0, gid: 0 }).ino;
    (p.man || []).forEach((m) => { if (!man.hijos.has(m + '.1.gz')) { const i = fs.nuevo('-', 0o644, 0, 0, { tam: 1800 }); fs.enlaza(man, m + '.1.gz', i, '/usr/share/man/man1/' + m + '.1.gz'); } });
    p.esta = true;
    void callado;
    return true;
  };
  L.quitaPaquete = function (sis, nombre) {
    const p = sis.paquetes[nombre];
    if (!p || !p.esta) return false;
    const fs = sis.fs;
    Object.keys(p.ordenes).forEach((o) => {
      const dir = o === 'updatedb' ? '/usr/sbin' : p.juegos ? '/usr/games' : '/usr/bin';
      const d = fs.resuelve(dir, { uid: 0, gid: 0 }).ino;
      if (d.hijos.has(o)) fs.desenlaza(d, o, dir + '/' + o);
    });
    const man = fs.resuelve('/usr/share/man/man1', { uid: 0, gid: 0 }).ino;
    (p.man || []).forEach((m) => { if (man.hijos.has(m + '.1.gz')) fs.desenlaza(man, m + '.1.gz', ''); });
    p.esta = false;
    return true;
  };
  // disco extra (sdb…) sin montar: cada partición tiene su propio árbol de archivos
  L.añadeDisco = function (sis, d) {
    const fs = sis.fs;
    const letra = d.nombre;
    const mayor = 8, base = (letra.charCodeAt(2) - 97) * 16;
    const disco = { nombre: letra, mm: mayor + ':' + base, tam: d.tam || '5G', tipo: 'disk', particiones: [] };
    (d.particiones || []).forEach((p, i) => {
      const r = fs.nuevo('d', 0o755, 0, 0, { dispositivo: mayor + ',' + (base + i + 1) });
      const lf = fs.nuevo('d', 0o700, 0, 0); fs.enlaza(r, 'lost+found', lf, '');
      Object.keys(p.archivos || {}).forEach((k) => { const ino = fs.nuevo('-', 0o644, 0, 0, { datos: p.archivos[k] }); fs.enlaza(r, k, ino, ''); });
      disco.particiones.push({ nombre: p.nombre, mm: mayor + ':' + (base + i + 1), tam: p.tam || d.tam, tipo: 'part', fs: p.fs || 'ext4', fsver: '1.0', uuid: p.uuid || ('0b1d' + i + 'c2e-5a7f-4d3b-8e9c-1f2a3b4c5d6e'), etiqueta: p.etiqueta || '', raiz: r.n, bloques: p.bloques || 5074592 });
      const dv = fs.nuevo('b', 0o660, 0, 6, { rdev: [mayor, base + i + 1] });
      fs.enlaza(fs.resuelve('/dev', { uid: 0, gid: 0 }).ino, p.nombre, dv, '/dev/' + p.nombre);
    });
    const dv = fs.nuevo('b', 0o660, 0, 6, { rdev: [mayor, base] });
    fs.enlaza(fs.resuelve('/dev', { uid: 0, gid: 0 }).ino, letra, dv, '/dev/' + letra);
    sis.discos.splice(sis.discos.length - 1, 0, disco);
  };

  L.crea = (esc) => new Sistema(esc);
  Object.assign(L, { Sistema, SistemaArchivos, ErrorSis, ERR, util: { bytes, relleno, anchoTexto, comparaLocale, mulberry32, azar, humano, numES, milES,
    strftime, partes, desdeLocal, fechaLs, fechaLarga, leeFecha, leeFechaT, DIAS, DIAS_C, MESES, MESES_C, MESES_EN, DIAS_EN, hashClave }, PAQUETES });

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof window !== 'undefined' ? window : globalThis);
