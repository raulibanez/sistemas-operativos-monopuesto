/* Prueba de las demostraciones: lee los guiones (<ol class="term-guion">) de una página de diapositivas y los
 * ejecuta en el simulador, con su escenario, paso a paso como lo haría la terminal: data-orden (se escribe y se
 * pulsa Intro), data-escribe (en la línea, en la contraseña o en el programa abierto) y data-tecla (al programa
 * abierto o a la línea). Ninguna orden debe dar un aviso del simulador ni un error, salvo las que lo esperan con
 * data-espera="aviso" o data-espera="error". Si al acabar el guion queda algo en marcha (man abierto, ping sin
 * cortar), sale como nota (leve: true): el profesor lo cierra a mano.
 *
 *   const { pruebaDemos } = require('./linux-demos.js');
 *   pruebaDemos(SOM.linux, html) -> [{ diapositiva, paso, orden, problema }]
 *   node herramientas/linux-demos.js [ut04/index.html]    escribe el resultado
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ENTIDADES = { '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
const desHtml = (t) => String(t).replace(/&(quot|amp|lt|gt|#39|apos|nbsp);/g, (m) => ENTIDADES[m]);
const atributo = (attrs, n) => { const m = attrs.match(new RegExp('\\s' + n + '="([^"]*)"')); return m ? desHtml(m[1]) : (new RegExp('\\s' + n + '(\\s|$)').test(attrs) ? '' : undefined); };
// lo que puede salir por la salida de errores sin ser un error: contraseña de sudo, mensajes de update-grub, exit
const ERR_ADMITIDOS = [/^\[sudo\] contraseña para \w+: ?$/, /^Sourcing file/, /^Generating grub/, /^Found /, /^Warning: os-prober/, /^Systems on them/, /^Check GRUB_DISABLE/, /^Adding boot menu/, /^done$/, /^exit$/, /^\^C$/];
const sinColor = (t) => String(t || '').replace(/\x1b\[[0-9;]*m|\x1b\[K/g, '');

// las demostraciones de una página: [{ diapositiva, escenario, cwd, pasos: [{tipo, valor, espera}] }]
function leeDemos(html) {
  const out = [];
  const re = /<div class="term"([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (atributo(attrs, 'data-guion') === undefined) continue;
    const antes = html.slice(0, m.index);
    const sec = [...antes.matchAll(/<section[^>]*data-label="([^"]*)"/g)].pop();
    const resto = html.slice(m.index);
    const ol = resto.match(/<ol class="term-guion"[^>]*>([\s\S]*?)<\/ol>/);
    if (!ol) continue;
    const pasos = [...ol[1].matchAll(/<li([^>]*)>/g)].map((x) => {
      const a = x[1];
      const orden = atributo(a, 'data-orden'), escribe = atributo(a, 'data-escribe'), tecla = atributo(a, 'data-tecla');
      const tipo = orden !== undefined ? 'orden' : escribe !== undefined ? 'escribe' : tecla !== undefined ? 'tecla' : 'explica';
      return { tipo, valor: orden !== undefined ? orden : escribe !== undefined ? escribe : tecla !== undefined ? tecla : '', espera: atributo(a, 'data-espera') };
    });
    out.push({ diapositiva: sec ? desHtml(sec[1]) : '(sin nombre)', escenario: atributo(attrs, 'data-escenario') || 'inicio', cwd: atributo(attrs, 'data-cwd'), pasos });
  }
  return out;
}

// ejecuta una demostración como la terminal y devuelve los problemas
function ejecutaDemo(L, demo, fecha) {
  const problemas = [];
  const esc = Object.assign({ fecha: fecha || '2026-11-21T09:30:00+01:00' }, (L.escenarios || {})[demo.escenario] || {}, demo.cwd ? { cwd: demo.cwd } : {});
  if (!(L.escenarios || {})[demo.escenario]) problemas.push({ paso: 0, orden: '', problema: `escenario desconocido «${demo.escenario}»` });
  const sis = L.crea(esc);
  let sh = sis.sesion({ columnas: 60, lineas: 20 });
  let linea = '', ej = null, r = null, prog = null, leyendo = false, entrada = '', actual = null, cerrada = false;
  const ev = [];
  // cierra la cuenta de la orden que estaba en marcha: avisos y errores contra lo esperado
  const cuenta = () => {
    if (!actual) return;
    const avisos = ev.filter((e) => e.tipo === 'aviso').map((e) => e.texto);
    const errores = sinColor(ev.filter((e) => e.tipo === 'err').map((e) => e.texto).join('')).split('\n').filter((l) => l.trim() && !ERR_ADMITIDOS.some((x) => x.test(l.trim())));
    const p = actual;
    const espera = p.espera || '';
    if (avisos.length && espera !== 'aviso') problemas.push({ paso: p.n, orden: p.orden, problema: 'aviso: ' + avisos.join(' | ') });
    if (errores.length && espera !== 'error' && !(espera === 'aviso' && avisos.length)) problemas.push({ paso: p.n, orden: p.orden, problema: 'error: ' + errores.join(' | ').slice(0, 300) });
    if (espera === 'aviso' && !avisos.length) problemas.push({ paso: p.n, orden: p.orden, problema: 'data-espera="aviso", pero no sale ningún aviso' + (errores.length ? ' (sale un error: ' + errores[0] + ')' : '') });
    if (espera === 'error' && !errores.length) problemas.push({ paso: p.n, orden: p.orden, problema: 'data-espera="error", pero no sale ningún error' });
    ev.length = 0; actual = null;
  };
  // conduce la orden hasta que pide algo (leer, programa) o acaba; ctrlC: corta la espera infinita
  const conduce = (siguienteEsCtrlC) => {
    let esperas = 0;
    for (let v = 0; v < 200000; v++) {
      if (r.fin) { if (r.salir) cerrada = true; ej = null; prog = null; leyendo = false; cuenta(); return; }
      if (r.tipo === 'leer') { leyendo = true; entrada = ''; return; }
      if (r.tipo === 'programa') { prog = r.programa; prog.pantalla(60, 20); return; }
      if (r.tipo === 'espera') {
        if (siguienteEsCtrlC && ++esperas >= 3) return;   // la tecla Ctrl+C del paso siguiente la corta
        if (!siguienteEsCtrlC && ++esperas > 2000) { problemas.push({ paso: actual && actual.n, orden: actual && actual.orden, problema: 'la orden no acaba sola (falta un paso con Ctrl+C)' }); r = ej.interrumpe(); continue; }
        sis.avanza(r.ms); r = ej.avanza(); continue;
      }
      if (r.tipo === 'ayuda' || r.tipo === 'carga') { try { require(path.join(__dirname, '..', 'assets', r.archivo || 'linux-ayuda.js')); } catch (e) { /* sin ese archivo */ } r = ej.avanza(); continue; }
      r = ej.avanza();
    }
  };
  const lanza = (texto, paso, siguienteEsCtrlC) => {
    actual = { n: paso.n, orden: texto, espera: paso.espera };
    ej = sh.lanzaLinea(texto, { alSalir: (t, x) => ev.push({ tipo: t, texto: x }), columnas: 60, lineas: 20 });
    if (ej.incompleto) { problemas.push({ paso: paso.n, orden: texto, problema: 'la línea queda incompleta (falta cerrar comillas o la tubería)' }); ej = null; actual = null; return; }
    r = ej.avanza();
    conduce(siguienteEsCtrlC);
  };
  demo.pasos.forEach((p, i) => {
    p.n = i + 1;
    const sigCtrlC = (demo.pasos[i + 1] || {}).tipo === 'tecla' && demo.pasos[i + 1].valor === 'Ctrl+C';
    if (p.tipo === 'explica') return;
    if (cerrada && !(p.tipo === 'tecla' && p.valor === 'Enter')) { problemas.push({ paso: p.n, orden: p.valor, problema: 'la terminal está cerrada (exit)' }); return; }
    if (p.tipo === 'orden') {
      if (ej) { problemas.push({ paso: p.n, orden: p.valor, problema: 'la orden anterior sigue en marcha' + (prog ? ' (' + prog.tipo + ' abierto)' : '') }); return; }
      lanza(p.valor, p, sigCtrlC);
      return;
    }
    if (p.tipo === 'escribe') {
      if (prog) { for (const ch of p.valor) { if (prog.tecla(ch) === 'fin') { prog = null; r = ej.avanza(); conduce(sigCtrlC); break; } } return; }
      if (leyendo) { entrada += p.valor; return; }
      if (ej) { problemas.push({ paso: p.n, orden: p.valor, problema: 'se escribe mientras la orden está en marcha y no lee nada' }); return; }
      linea += p.valor;
      return;
    }
    // teclas
    const k = p.valor === 'Space' ? ' ' : p.valor;
    if (prog) {
      const kk = k.startsWith('Ctrl+') && !prog.ctrl ? (k === 'Ctrl+C' ? 'q' : k) : k;
      if (prog.tecla(kk) === 'fin') { prog = null; r = ej.avanza(); conduce(sigCtrlC); }
      return;
    }
    if (leyendo) {
      if (k === 'Enter') { leyendo = false; r = ej.avanza(entrada); entrada = ''; conduce(sigCtrlC); return; }
      if (k === 'Ctrl+C') { leyendo = false; r = ej.interrumpe(); conduce(false); return; }
      if (k === 'Ctrl+D') { leyendo = false; r = ej.avanza(entrada || null); conduce(false); return; }
      return;
    }
    if (ej) {
      if (k === 'Ctrl+C') { r = ej.interrumpe(); conduce(false); return; }
      problemas.push({ paso: p.n, orden: p.valor, problema: 'tecla con la orden en marcha (no lee ni tiene programa)' });
      return;
    }
    if (cerrada) { if (k === 'Enter') { sh = sis.sesion({ columnas: 60, lineas: 20 }); cerrada = false; } return; }
    if (k === 'Enter') { const t = linea; linea = ''; lanza(t, p, sigCtrlC); return; }
    if (k === 'Tab') {
      const c = sh.completa(linea, linea.length);
      if (c.sustituye !== null && c.sustituye !== undefined) linea = linea.slice(0, c.inicio) + c.sustituye + linea.slice(c.fin);
      else if (!c.candidatos.length) problemas.push({ paso: p.n, orden: linea, problema: 'Tab no completa nada' });
      return;
    }
    if (k === 'ArrowUp') { linea = sh.hist[sh.hist.length - 1] || ''; return; }
    if (k === 'Ctrl+C' || k === 'Ctrl+U') { linea = ''; return; }
    if (k === 'Ctrl+L' || k === 'Escape' || k === 'ArrowDown') return;
    if (k.length === 1) { linea += k; return; }
    if (k === 'Ctrl+D') { if (!linea) lanza('exit', p, false); return; }
    problemas.push({ paso: p.n, orden: k, problema: 'tecla sin efecto en la línea' });
  });
  if (ej) problemas.push({ leve: true, paso: demo.pasos.length, orden: actual ? actual.orden : '', problema: 'al acabar el guion queda algo en marcha' + (prog ? ' (' + prog.tipo + ' abierto)' : leyendo ? ' (esperando lo que se escriba)' : '') });
  cuenta();
  return problemas;
}

function pruebaDemos(L, html) {
  const res = [];
  leeDemos(html).forEach((d) => ejecutaDemo(L, d).forEach((p) => res.push(Object.assign({ diapositiva: d.diapositiva }, p))));
  return res;
}

/* Sin ut04/index.html: las demostraciones del campo «Visual» del guion (guiones/ut04.md, 6.1). */
const DEMOS_GUION = [
  ['14', 'inicio', ['pwd', 'ls', 'echo Hola', 'echo $SHELL', ['LS', 'error']]],
  ['19', 'inicio', ['ls --help', 'uname --help']],
  ['21', 'inicio', ['man -k memory', 'man -k hostname']],
  ['22', 'inicio', [['man cd', 'error'], 'type cd', 'help cd', 'type ls', 'type cat']],
  ['27', 'inicio', ['lsmod', 'lsmod | grep vbox', 'lsmod | grep usbhid']],
  ['28', 'inicio', ['uname', 'uname -a', 'uname -r', 'cat /proc/version']],
  ['52', 'ubuntu-som', ['lsblk', 'uname -r', 'ip a']],
  ['72', 'inicio', ['echo $XDG_SESSION_TYPE', 'echo $XDG_CURRENT_DESKTOP']],
  ['77', 'inicio', ['whoami', 'id', 'who', 'w']],
  ['78', 'inicio', ['date', 'date +%d-%m-%Y', 'date +%A', ['cal', 'error']]],
  ['79', 'inicio', ['cd /etc', 'pwd', 'cd ..', 'cd -', 'cd ~', 'cd /', 'cd']],
  ['82', 'inicio', ['touch notas.txt', 'ls -l notas.txt', 'cat /etc/hostname', 'cat -n /etc/shells']],
  ['83', 'inicio', ['echo $HOME', 'echo $PWD', 'echo $PATH', 'env | grep HOME', 'PS1="> "']],
  ['84', 'inicio', ['which ls', 'whereis ls', 'which cd', 'type cd']],
  ['85', 'inicio', ['alias', 'alias hoy=date', 'hoy', 'unalias hoy', 'history', 'history -c']]
];
function demosDelGuion() {
  return DEMOS_GUION.map(([n, esc, ordenes]) => ({ diapositiva: 'guion ' + n, escenario: esc, pasos: ordenes.map((o) => (Array.isArray(o) ? { tipo: 'orden', valor: o[0], espera: o[1] } : { tipo: 'orden', valor: o })) }));
}

module.exports = { leeDemos, ejecutaDemo, pruebaDemos, demosDelGuion };

if (require.main === module) {
  const A = path.join(__dirname, '..', 'assets');
  ['linux-datos.js', 'linux.js', 'linux-bash.js', 'linux-ordenes.js', 'linux-sistema.js', 'linux-ut4.js', 'linux-misiones.js', 'linux-ayuda.js'].forEach((f) => require(path.join(A, f)));
  const L = globalThis.SOM.linux;
  const ruta = process.argv[2] || path.join(__dirname, '..', 'ut04', 'index.html');
  let demos;
  if (fs.existsSync(ruta)) demos = leeDemos(fs.readFileSync(ruta, 'utf8'));
  else { console.log('No está ' + ruta + ': pruebo las listas del guion.'); demos = demosDelGuion(); }
  let n = 0;
  demos.forEach((d) => {
    const ps = ejecutaDemo(L, d);
    const graves = ps.filter((p) => !p.leve);
    n += graves.length;
    console.log(`${graves.length ? 'MAL ' : ps.length ? 'nota' : 'bien'}  ${d.diapositiva} (${d.pasos.length} pasos)`);
    ps.forEach((p) => console.log(`      ${p.leve ? '(nota) ' : ''}paso ${p.paso} «${p.orden}»: ${p.problema}`));
  });
  console.log(`${demos.length} demostraciones, ${n} problemas`);
  process.exit(n ? 1 : 0);
}
