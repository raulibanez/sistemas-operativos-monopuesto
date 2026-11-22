/* Practica Linux (assets/linux-practica.js) en un Chrome sin pantalla, con teclas y clics del navegador:
 *   node herramientas/linux-practica-chrome.js [dirección] [carpeta-de-capturas]
 * Por defecto, http://127.0.0.1:8795/linux/practica.html?ut=4 (servidor local con la raíz del proyecto:
 * python -m http.server 8795). Sirve también una diapositiva con <div class="practica-linux" data-ut="4">.
 * El recorrido completo de todos los bloques (cada encargo con su solución tecleada; al acertar, Intro en la línea
 * vacía pasa al siguiente), entrar a mitad de bloque, recargar, «Ver solución», «Reiniciar el bloque» y los errores
 * de la consola. Abre su propio Chrome con un perfil en la carpeta temporal y, al acabar, cierra solo ese proceso. */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const S = require('os').tmpdir();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function abre(opc) {
  opc = opc || {};
  const puerto = opc.puerto || 9341;
  const args = ['--headless=new', '--hide-scrollbars', `--remote-debugging-port=${puerto}`, `--window-size=${opc.ventana || '1920,1080'}`, `--user-data-dir=${S}/som-linux-chrome-perfil${opc.perfil || ''}`, '--no-first-run', '--disable-extensions', '--disk-cache-size=1', 'about:blank'];
  if (opc.sinRed) args.push('--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1:9,MAP fonts.gstatic.com 127.0.0.1:9');
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', args, { stdio: 'ignore' });
  let lista;
  for (let k = 0; k < 60; k++) { try { lista = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json(); break; } catch (e) { await espera(250); } }
  const ws = new WebSocket(lista.find((x) => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = {};
  const errores = [];
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } else if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text); else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errores.push(m.params.args.map((x) => x.value || x.description).join(' ')); else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errores.push(m.params.entry.text + ' ' + (m.params.entry.url || '')); });
  const cdp = (method, params) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const evalua = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result && r.result.exceptionDetails) return 'ERROR ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description); return r.result && r.result.result ? r.result.result.value : r; };
  const foto = async (ruta) => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(require('path').dirname(ruta), { recursive: true }); fs.writeFileSync(ruta, Buffer.from(r.result.data, 'base64')); console.log('captura', ruta); };
  const centro = async (sel) => evalua(`(() => { const e = ${sel}; if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  const clic = async (sel) => {
    const r = await centro(sel);
    if (!r) { console.log('   no encuentro', sel); return false; }
    for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
    await espera(150);
    return true;
  };
  const TK = { Enter: ['Enter', 13, '\r'], Tab: ['Tab', 9, '\t'], Escape: ['Escape', 27], End: ['End', 35], Home: ['Home', 36], Backspace: ['Backspace', 8], Delete: ['Delete', 46], ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], ' ': ['Space', 32, ' '] };
  for (let i = 1; i <= 12; i++) TK['F' + i] = ['F' + i, 111 + i];
  const tecla = async (k, mod) => {
    let key = k, code, vk, text;
    if (TK[k]) { [code, vk, text] = TK[k]; if (k === ' ') key = ' '; }
    else if (k.length === 1) { code = /[a-z]/i.test(k) ? 'Key' + k.toUpperCase() : /\d/.test(k) ? 'Digit' + k : ''; vk = k.toUpperCase().charCodeAt(0); text = mod ? undefined : k; }
    await cdp('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, modifiers: mod || 0, text });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers: mod || 0 });
    await espera(60);
  };
  const ctrl = async (k) => {
    await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, modifiers: 2 });
    await tecla(k, 2);
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 });
  };
  const escribe = async (t) => { for (const ch of t) { if (/^[a-zA-Z0-9 ]$/.test(ch)) await tecla(ch); else { await cdp('Input.insertText', { text: ch }); await espera(40); } } };
  const ve = async (url, ms) => { await cdp('Page.navigate', { url: 'about:blank' }); await espera(200); await cdp('Page.navigate', { url }); await espera(ms || 5000); };
  const cierra = () => { try { ws.close(); } catch (e) { /* ya */ } chrome.kill(); console.log('Chrome cerrado (PID ' + chrome.pid + ')'); };
  await cdp('Network.enable'); await cdp('Network.setCacheDisabled', { cacheDisabled: true }); await cdp('Runtime.enable'); await cdp('Log.enable');
  console.log('Chrome lanzado, PID', chrome.pid);
  return { cdp, evalua, foto, clic, tecla, ctrl, escribe, ve, cierra, espera, chrome, errores };
}
const ARGS = process.argv.slice(2);
const URL_P = ARGS.find((a) => /^http/.test(a)) || 'http://127.0.0.1:8795/linux/practica.html?ut=4';
const OUT = (ARGS.find((a) => /[\\/]/.test(a) && !/^http/.test(a)) || require('path').join(require('os').tmpdir(), 'linux-practica-chrome')).replace(/\\/g, '/').replace(/\/?$/, '/');
const PR = `document.querySelector('.practica-linux')._practica`;
// la dirección sin caché (con ?v=…), y el #N de la diapositiva detrás si lo lleva
const conV = (u) => { const [a, h] = u.split('#'); return a + (a.includes('?') ? '&' : '?') + 'v=' + Date.now() + (h ? '#' + h : ''); };

async function prueba(abre) {
  const b = await abre({ puerto: 9351, perfil: '-recorrido' });
  const res = [];
  const ok = (cond, txt) => { res.push((cond ? 'bien  ' : 'MAL   ') + txt); console.log((cond ? 'bien  ' : 'MAL   ') + txt); };
  const ev = (x) => b.evalua(x);
  const espera = b.espera;
  const libre = async (ms) => { for (let k = 0; k < (ms || 8000) / 100; k++) { if (await ev(`(() => { const t = ${PR}.t; return !t.ej && !t.programa && !t.colaAcc; })()`)) return true; await espera(100); } return false; };
  async function paso(p0) {
    const p = await ev(`(() => { const t = ${PR}.t; const p = SOM.linux.practica.conClave(t.sh, ${JSON.stringify(p0)}); return typeof p === 'string' ? { orden: p } : p; })()`);
    await b.escribe(p.orden);
    if (p.tab) { await b.tecla('Tab'); await espera(300); }
    await b.tecla('Enter'); await espera(500);
    for (const r of p.respuestas || []) {
      let lee = false;
      for (let k = 0; k < 30 && !lee; k++) { lee = await ev(`!!${PR}.t.leyendo`); if (!lee) { if (await ev(`!${PR}.t.ej`)) break; await espera(100); } }
      if (!lee) break;
      await b.escribe(r); await b.tecla('Enter'); await espera(500);
    }
    if (p.ctrlC) { await espera(p.ctrlC * 1000); await b.ctrl('c'); await espera(500); }
    if (p.teclas) {
      for (let k = 0; k < 30 && !(await ev(`!!${PR}.t.programa`)); k++) await espera(100);
      for (const k of p.teclas) {
        if (/^Ctrl\+/.test(k)) await b.ctrl(k.slice(5).toLowerCase());
        else if (k === ' ') await b.tecla(' ');
        else if (k.length === 1) await b.escribe(k);
        else await b.tecla(k);
      }
      await espera(500);
    }
    await libre(8000);
  }
  async function resuelve() {
    const e = await ev(`(() => { const x = ${PR}.x.e; return { clave: x.clave, sol: x.sol, casilla: !!(x.casilla || x.selector) }; })()`);
    for (const p of e.sol) await paso(p);
    if (e.casilla) {
      const v = await ev(`${PR}.x.e.esperado(${PR}.contexto())`);
      const n = await ev(`document.querySelectorAll('.practica-linux .pl-casilla').length`);
      for (let j = 0; j < n; j++) {
        const esSel = await ev(`document.querySelectorAll('.practica-linux .pl-casilla')[${j}].tagName === 'SELECT'`);
        // el desplegable nativo no se abre en headless: se elige con value + change, y después «Comprobar»
        if (esSel) await ev(`(() => { const s = document.querySelectorAll('.practica-linux .pl-casilla')[${j}]; s.focus(); s.value = ${JSON.stringify(v[j])}; s.dispatchEvent(new Event('change')); })()`);
        else { await b.clic(`document.querySelectorAll('.practica-linux .pl-casilla')[${j}]`); await b.escribe(v[j]); }
      }
      if (!(await ev(`${PR}.hechoAhora`))) {
        if (await ev(`!!document.querySelector('.practica-linux .pl-selector')`)) await b.clic(`document.querySelector('.practica-linux .pl-comprobar')`);
        else await b.tecla('Enter');
        await espera(400);
      }
    }
    return e.clave;
  }
  try {
    await b.ve(conV(URL_P), 6000);
    await ev(`localStorage.clear()`);
    await b.ve(conV(URL_P), 7000);
    await b.clic(`${PR}.t.pantalla`);
    const total = await ev(`${PR}.lista.length`);
    let mal = 0;
    // 1. el recorrido completo
    for (let i = 0; i < total; i++) {
      const n0 = await ev(`${PR}.n`);
      const clave = await resuelve();
      const hecho = await ev(`${PR}.hechoAhora`);
      if (!hecho) { mal++; ok(false, `recorrido: ${clave} no se da por hecho (${await ev(`${PR}.fb.innerText`)})`); await ev(`${PR}.acierta()`); }
      if (i === 0 || clave === 'mirar/largo' || clave === 'ayuda/tamano' || clave === 'administrar/menu') await b.foto(`${OUT}recorrido-${clave.replace('/', '-')}.png`);
      if (i < total - 1) {
        // Intro en la línea vacía: al siguiente (el foco, en la terminal)
        if (await ev(`${PR}.t.cerrada`)) await b.clic(`document.querySelector('.practica-linux .pl-sig')`);
        else { await ev(`${PR}.t.enfoca()`); await b.tecla('Enter'); }
        await espera(400);
        const n1 = await ev(`${PR}.n`);
        if (n1 !== n0 + 1) { mal++; ok(false, `recorrido: tras ${clave}, Intro no pasa al siguiente (${n0} → ${n1})`); await ev(`${PR}.carga(${n0 + 1})`); }
      }
    }
    ok(!mal, `recorrido completo: ${total} encargos en ${await ev(`${PR}.banco.bloques.length`)} bloques, todos hechos tecleando su solución`);
    const puntos = await ev(`JSON.stringify(${PR}.guardado.hecho)`);
    ok(Object.keys(JSON.parse(puntos)).length === total && !/"sol"/.test(puntos), 'todos los puntos en verde (sin ver la solución)');
    // 2. entrar a mitad de bloque: Moverse por las carpetas, encargo 5 (sube), por su punto
    await ev(`localStorage.clear(); ${PR}.guardado = { hecho: {}, ultimo: null }`);
    await ev(`(() => { const s = document.querySelector('.practica-linux .pl-bloque'); s.value = '3'; s.dispatchEvent(new Event('change')); })()`);
    await espera(400);
    await b.clic(`document.querySelectorAll('.practica-linux .pl-puntos button')[4]`); await espera(500);
    const cwd = await ev(`${PR}.t.sh.pwd`);
    ok(cwd === '/home/alumno/Documentos/clase', 'entrar a mitad (Moverse, encargo 5): la terminal está en ' + cwd);
    await b.foto(`${OUT}mitad-de-bloque.png`);
    await b.clic(`${PR}.t.pantalla`);
    await resuelve();
    ok(await ev(`${PR}.hechoAhora`), 'entrar a mitad: el encargo se hace');
    // 3. recargar la página: vuelve al mismo encargo, con el sistema reconstruido
    await ev(`${PR}.carga(${PR}.n + 1)`);
    const antes = await ev(`${PR}.x.e.clave`);
    await b.ve(conV(URL_P), 7000);
    const despues = await ev(`${PR}.x.e.clave`), cwd2 = await ev(`${PR}.t.sh.pwd`);
    ok(antes === despues && cwd2 === '/home/alumno/Documentos', `recargar: vuelve a ${despues}, con la terminal en ${cwd2}`);
    // 4. Ver solución: un encargo con casilla y otro con nano
    for (const clave of ['mirar/oculto', 'administrar/menu']) {
      await ev(`${PR}.carga(${PR}.lista.findIndex((y) => y.e.clave === ${JSON.stringify(clave)}))`);
      await espera(400);
      await b.clic(`document.querySelector('.practica-linux .pl-sol')`);
      for (let k = 0; k < 120 && !(await ev(`${PR}.hechoAhora`)); k++) await espera(500);
      const marca = await ev(`${PR}.guardado.hecho[${JSON.stringify(clave)}]`);
      ok((await ev(`${PR}.hechoAhora`)) && marca === 'sol', `Ver solución (${clave}): la escribe en la terminal y queda en naranja (${marca})`);
      await b.foto(`${OUT}ver-solucion-${clave.replace('/', '-')}.png`);
    }
    // 5. Reiniciar el bloque
    await b.clic(`document.querySelector('.practica-linux .pl-reinicia')`); await espera(600);
    const r = await ev(`(() => { const p = ${PR}; return { k: p.x.k, bloque: p.x.b.id, menu: /timeout_style=menu/.test(p.t.sis.leeArchivo('/boot/grub/grub.cfg')), ncal: !!(p.t.sis.paquetes.ncal && p.t.sis.paquetes.ncal.esta) }; })()`);
    ok(r.k === 0 && r.bloque === 'administrar' && !r.menu && !r.ncal, 'Reiniciar el bloque: vuelve al primer encargo con el sistema como al principio ' + JSON.stringify(r));
    // 6. el foco: tras cada botón y cada hueco del ejercicio, un espacio y una «p» van a la terminal (en una
    // diapositiva, sin cambiar de diapositiva); en un bloque con el árbol, también la vista y sus botones
    const sitio = `(() => { const s = [...document.querySelectorAll('deck-stage > section')]; return s.length ? s.findIndex((x) => x.hasAttribute('data-deck-active')) : -1; })()`;
    await ev(`${PR}.carga(${PR}.lista.findIndex((y) => y.e.clave === 'moverse/etc'))`); await espera(400);
    const objetivos = ['.pl-pista', '.pl-pista', '.pl-reinicia', '.pl-sig', '.pl-ant', '.pl-puntos button:nth-child(2)', '.pl-puntos button:nth-child(1)', '.pl-pill', '.pl-texto', '.pl-fb', '.pl-num',
      '.term-ventanas .letra-mas', '.term-ventanas .letra-menos', '.term-ventanas .max', '.term-ventanas .max', '.term-bvista', '.term-bvista', '.term-titulo', '.term-foco'];
    let bienFoco = 0; const saltados = [];
    for (const o of objetivos) {
      const antes = await ev(sitio);
      await ev(`(() => { const t = ${PR}.t; t.entrada.value = ''; t.pinta(); })()`);
      if (!(await ev(`!!(document.querySelector('.practica-linux ${o}') || {}).offsetParent`))) { saltados.push(o); continue; }   // lo que no se ve aquí
      if (!(await b.clic(`document.querySelector('.practica-linux ${o}')`))) { ok(false, `foco: no encuentro ${o}`); continue; }
      await espera(350);
      await b.escribe(' p'); await espera(200);
      const f = await ev(`(() => { const t = ${PR}.t; return { aqui: document.activeElement === t.entrada && t.entrada.value === ' p', sitio: ${sitio}, pantalla: !!document.fullscreenElement }; })()`);
      if (f.aqui && f.sitio === antes && !f.pantalla) bienFoco++;
      else ok(false, `foco: tras pulsar ${o}, « p» ${f.aqui ? 'llega a la terminal' : 'NO llega a la terminal'}${f.sitio !== antes ? ' y la diapositiva cambia' : ''}${f.pantalla ? ' y pide pantalla completa' : ''}`);
    }
    await ev(`(() => { const t = ${PR}.t; t.entrada.value = ''; t.pinta(); })()`);
    // 7. el progreso no se pisa: otra copia (la diapositiva y la página) guarda lo suyo y se junta (verde gana a naranja)
    const prog = await ev(`(() => { const p = ${PR}, K = p.CLAVE;
      localStorage.setItem(K, JSON.stringify({ hecho: { 'primeros/carpeta': 'ok', 'sistema/version': 'ok' }, ultimo: 'sistema/version' }));
      p.guardado.hecho = { 'ayuda/help': 'ok', 'sistema/version': 'sol' }; p.guarda();
      const g = JSON.parse(localStorage.getItem(K)).hecho;
      window.dispatchEvent(new StorageEvent('storage', { key: K, newValue: JSON.stringify({ hecho: Object.assign({}, g, { 'ayuda/man': 'ok' }) }) }));
      return { g, enMemoria: p.guardado.hecho['ayuda/man'] }; })()`);
    ok(prog.g['primeros/carpeta'] === 'ok' && prog.g['ayuda/help'] === 'ok' && prog.g['sistema/version'] === 'ok' && prog.enMemoria === 'ok', 'el progreso de dos copias abiertas se junta y no se pierde ' + JSON.stringify(prog));
    // 8. el selector solo cuenta si antes se ha averiguado en la terminal
    await ev(`${PR}.carga(${PR}.lista.findIndex((y) => y.e.clave === 'ayuda/type'))`); await espera(300);
    // con las flechas no se comprueba nada (empieza en «elige» y la buena no es la primera); se comprueba con «Comprobar»
    await b.clic(`document.querySelector('.practica-linux .pl-selector')`);
    await b.tecla('Escape'); await ev(`document.querySelector('.practica-linux .pl-selector').focus()`);
    for (let k = 0; k < 3; k++) { await b.tecla('ArrowDown'); await espera(150); }
    const flechas = await ev(`({ hecho: ${PR}.hechoAhora, primera: document.querySelector('.practica-linux .pl-selector').options[1].value, empieza: document.querySelector('.practica-linux .pl-selector').options[0].value })`);
    ok(!flechas.hecho && flechas.primera !== 'interna' && flechas.empieza === '', 'selector: con las flechas no se comprueba; empieza en «elige» y la buena no es la primera ' + JSON.stringify(flechas));
    const elige = async (v) => { await ev(`(() => { const s = document.querySelector('.practica-linux .pl-selector'); s.value = '${v}'; s.dispatchEvent(new Event('change')); })()`); await b.clic(`document.querySelector('.practica-linux .pl-comprobar')`); await espera(200); return ev(`({ hecho: ${PR}.hechoAhora, fb: ${PR}.fb.innerText })`); };
    const s1 = await elige('interna');
    await ev(`${PR}.t.enfoca()`); await b.escribe('type cd'); await b.tecla('Enter'); await espera(500);
    // y con Intro en el selector (el teclado), como con «Comprobar»
    await ev(`(() => { const s = document.querySelector('.practica-linux .pl-selector'); s.focus(); s.value = 'interna'; s.dispatchEvent(new Event('change')); })()`);
    await b.tecla('Enter'); await espera(300);
    const s2 = await ev(`({ hecho: ${PR}.hechoAhora, fb: ${PR}.fb.innerText })`);
    ok(!s1.hecho && /Primero averígualo/.test(s1.fb) && s2.hecho, `selector: sin averiguarlo no cuenta («${s1.fb}»); con type cd e Intro, sí`);
    // 9. 4.7 después de repetir cd / en el 4.6: al pasar, el encargo se monta de nuevo y cd - lo cumple
    await ev(`${PR}.carga(${PR}.lista.findIndex((y) => y.e.clave === 'moverse/raiz'))`); await espera(300); await ev(`${PR}.t.enfoca()`);
    for (const o of ['cd /', 'cd /']) { await b.escribe(o); await b.tecla('Enter'); await espera(400); }
    await b.tecla('Enter'); await espera(500);
    const r47 = await ev(`({ clave: ${PR}.x.e.clave, fb: ${PR}.fb.innerText })`);
    await b.escribe('cd -'); await b.tecla('Enter'); await espera(500);
    ok(r47.clave === 'moverse/antes' && /no servía/.test(r47.fb) && (await ev(`${PR}.hechoAhora`)), '4.7 tras cd / dos veces: se monta de nuevo («' + r47.fb + '») y cd - lo cumple');
    // 10. «Repetir este encargo»: la terminal como al empezar este encargo, el mismo encargo y los puntos intactos
    await ev(`${PR}.carga(${PR}.lista.findIndex((y) => y.e.clave === 'shell/borra'))`); await espera(300); await ev(`${PR}.t.enfoca()`);
    await b.escribe('exit'); await b.tecla('Enter'); await espera(500); await b.tecla('Enter'); await espera(500);
    await b.escribe('unalias hoy'); await b.tecla('Enter'); await espera(500);
    const fbExit = await ev(`${PR}.fb.innerText`);
    const puntos0 = await ev(`JSON.stringify(${PR}.guardado.hecho)`);
    await b.clic(`document.querySelector('.practica-linux .pl-repite')`); await espera(500);
    const rep = await ev(`({ clave: ${PR}.x.e.clave, alias: ${PR}.t.sh.alias.has('hoy'), puntos: JSON.stringify(${PR}.guardado.hecho) })`);
    await b.foto(`${OUT}repetir-este-encargo.png`);
    await b.escribe('unalias hoy'); await b.tecla('Enter'); await espera(500);
    ok(/Repetir este encargo/.test(fbExit) && rep.clave === 'shell/borra' && rep.alias && rep.puntos === puntos0 && (await ev(`${PR}.hechoAhora`)), '«Repetir este encargo»: el mensaje lo nombra, se queda en 8.5 con el alias de vuelta, los puntos intactos y se puede hacer');
    const fila = await ev(`(() => { const bs = [...document.querySelectorAll('.practica-linux .pl-botones .btn')].filter((x) => x.offsetParent); const pie = document.querySelector('.practica-linux .pl-pie').getBoundingClientRect(); return { dentro: bs.every((x) => { const r = x.getBoundingClientRect(); return r.right <= pie.right + 1 && r.left >= pie.left - 1; }), n: bs.length }; })()`);
    ok(fila.dentro, 'los botones caben en la fila: ' + JSON.stringify(fila));
    // 11. atajos del navegador en una casilla y en el desplegable: parados, sin escribir nada; Ctrl + A sigue funcionando
    await ev(`${PR}.carga(${PR}.lista.findIndex((y) => y.e.clave === 'ayuda/tamano'))`); await espera(300);
    await b.clic(`document.querySelector('.practica-linux .pl-casilla')`);
    await ev(`window.__t = []; window.addEventListener('keydown', (e) => window.__t.push(e), true);`);
    const parados = [];
    for (const a of [['ctrl', 'r'], ['ctrl', 'p'], ['ctrl', 'l'], ['ctrl', 's'], ['ctrl', 'o'], ['ctrl', 'f'], ['F5'], ['F1'], ['F3']]) {
      await ev(`window.__t = []`);
      if (a[0] === 'ctrl') await b.ctrl(a[1]); else await b.tecla(a[0]);
      parados.push(await ev(`(() => { const e = window.__t.find((x) => x.key !== 'Control'); return !!e && e.defaultPrevented; })()`));
    }
    await ev(`window.__t = []`); await b.ctrl('a');
    const ctrlA = await ev(`(() => { const e = window.__t.find((x) => x.key !== 'Control'); return !!e && !e.defaultPrevented; })()`);
    const vacia = await ev(`document.querySelector('.practica-linux .pl-casilla').value === ''`);
    await ev(`document.querySelector('.practica-linux .pl-bloque').focus()`); await ev(`window.__t = []`); await b.tecla('F5');
    const enDesplegable = await ev(`(() => { const e = window.__t.find((x) => x.key === 'F5'); return !!e && e.defaultPrevented; })()`);
    ok(parados.every(Boolean) && ctrlA && vacia && enDesplegable, `atajos en la casilla y el desplegable: parados ${parados.filter(Boolean).length} de ${parados.length}, Ctrl + A libre ${ctrlA}, casilla vacía ${vacia}, F5 en el desplegable ${enDesplegable}`);
    ok(bienFoco === objetivos.length - saltados.length, `foco: tras ${bienFoco} de ${objetivos.length - saltados.length} clics en botones y huecos, las teclas van a la terminal${saltados.length ? ' (no se ven aquí: ' + saltados.join(', ') + ')' : ''}`);
    // 12. el árbol: en la carpeta en la que estás, el icono y el nombre en la misma línea (si «← estás aquí» no cabe, baja eso)
    for (const [clave, orden] of [['moverse/clase', 'cd clase'], ['moverse/linux', 'cd clase/linux'], ['mirar/ocultos', 'cd fotos']]) {
      await ev(`${PR}.carga(${PR}.lista.findIndex((y) => y.e.clave === '${clave}'))`); await espera(300); await ev(`${PR}.t.enfoca()`);
      await b.escribe(orden); await b.tecla('Enter'); await espera(600);
      const a = await ev(`(() => { const n = document.querySelector('.practica-linux .term-nodo.actual'); if (!n) return null; const tn = [...n.childNodes].find((x) => x.nodeType === 3 && x.data.trim()); const rg = document.createRange(); rg.selectNodeContents(tn); const rs = [...rg.getClientRects()]; const N = n.getBoundingClientRect(); return { nombre: tn.data.trim(), lineas: rs.length, arriba: Math.round(rs[0].top - N.top), alto: Math.round(N.height) }; })()`);
      ok(!!a && a.lineas === 1 && a.arriba < 12, `árbol, ${clave}: «${a && a.nombre}» en una línea con su icono ${JSON.stringify(a)}`);
      if (clave === 'moverse/linux') await b.foto(`${OUT}arbol-estas-aqui.png`);
    }
    const errores = b.errores.filter((x) => !/favicon/.test(x));
    ok(!errores.length, 'sin errores en la consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  } finally { b.cierra(); }
  // 13. a 400 px: el desplegable de bloques se lee entero, con su contador, en todos los bloques
  if (!/deck|ut0\d\/index/.test(URL_P)) {
    const m = await abre({ puerto: 9352, ventana: '400,800', perfil: '-400' });
    try {
      await m.cdp('Emulation.setDeviceMetricsOverride', { width: 400, height: 800, deviceScaleFactor: 2, mobile: true });
      await m.ve(conV(URL_P), 6000);
      const d = await m.evalua(`(() => { const p = ${PR}, s = document.querySelector('.pl-bloque'); const out = [];
        p.banco.bloques.forEach((bl, i) => { p.carga(p.lista.findIndex((y) => y.b === bl)); const t = s.options[s.selectedIndex].text; const c = document.createElement('span'); c.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + getComputedStyle(s).font; c.textContent = t; document.body.appendChild(c); const w = c.offsetWidth; c.remove(); out.push({ t, cabe: w + 36 <= s.clientWidth }); });
        p.carga(p.lista.findIndex((y) => y.e.clave === 'sistema/version')); return out; })()`);
      await m.foto(`${OUT}desplegable-400.png`);
      const malos = d.filter((x) => !x.cabe);
      ok(!malos.length, `a 400 px, el desplegable se lee entero en los ${d.length} bloques` + (malos.length ? ': no caben ' + malos.map((x) => x.t).join(' | ') : ` (p. ej. «${d[2].t}»)`));
    } finally { m.cierra(); }
  }
  const fallos = res.filter((x) => x.startsWith('MAL')).length;
  console.log(`\n${fallos ? 'HAY ' + fallos + ' PROBLEMAS' : 'Todo bien'}. Capturas en ${OUT}`);
  return fallos;
}
module.exports = prueba;
if (require.main === module) prueba(abre).then((f) => process.exit(f ? 1 : 0));
