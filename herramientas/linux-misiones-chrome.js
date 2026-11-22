/* Las nueve misiones de la UT4 en un Chrome sin pantalla, con teclas y clics del navegador (protocolo de depuración):
 *   node herramientas/linux-misiones-chrome.js [ut4-m1,ut4-m5…] [sinred] [carpeta-de-capturas]
 * Necesita un servidor local en http://127.0.0.1:8795 con la raíz del proyecto (python -m http.server 8795); otro
 * puerto, con la variable SOM_PUERTO. Con «foco», solo la prueba 3; con «red», solo la 4 (la ayuda sin red y con la red lenta).
 * 1. Cada misión al entrar, con la pista (y la más larga), con un error y completa: la lista de tareas no cambia de
 *    tamaño, la tarea aludida se ve, el mensaje cabe en su franja, el foco vuelve a la terminal y nada se sale.
 * 2. M5 y M7 hechas a mano de principio a fin (nano, update-grub, «Reiniciar la máquina», ls -l con el árbol) y lo
 *    que pasa con la racha, Resolver, exit y passwd (F8 y F9 de la prueba del 21-11-2026).
 * 3. El foco (N1 de la prueba del 22-11-2026): en cada misión, un clic en cada botón del bloque (lupas, maximizar y
 *    restaurar, la vista y sus botones, Pista, Otro ejercicio, Reiniciar, ✓) y en los huecos sin nada (la racha, el
 *    pie, la barra, el panel); después, un espacio y una «p» tienen que llegar a la terminal (o a la casilla que se
 *    haya enfocado), sin cambiar de diapositiva ni pedir pantalla completa.
 * Abre su propio Chrome con un perfil en la carpeta temporal y, al acabar, cierra solo ese proceso. sinred: sin las
 * fuentes de Google (la terminal usa Consolas). */
'use strict';
const ARGS = process.argv.slice(2);
const SOLO = (ARGS.find((a) => /^ut4-/.test(a)) || '').split(',').filter(Boolean);
const SIN_RED = ARGS.includes('sinred');
const SOLO_FOCO = ARGS.includes('foco');
const BASE = 'http://127.0.0.1:' + (process.env.SOM_PUERTO || 8795);
const OUT = (ARGS.find((a) => /[\\/]/.test(a)) || require('path').join(require('os').tmpdir(), 'linux-misiones-chrome')).replace(/\\/g, '/').replace(/\/?$/, '/');
const T = `document.querySelector('section[data-deck-active] .term')`;
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
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } });
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
  const TK = { Enter: ['Enter', 13, '\r'], Tab: ['Tab', 9, '\t'], Escape: ['Escape', 27], End: ['End', 35], Home: ['Home', 36], Backspace: ['Backspace', 8], ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], ' ': ['Space', 32, ' '] };
  for (let i = 1; i <= 12; i++) TK['F' + i] = ['F' + i, 111 + i];
  TK.ArrowRight = ['ArrowRight', 39]; TK.ArrowLeft = ['ArrowLeft', 37];
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
  await cdp('Network.enable'); await cdp('Network.setCacheDisabled', { cacheDisabled: true });
  console.log('Chrome lanzado, PID', chrome.pid);
  return { cdp, evalua, foto, clic, tecla, ctrl, escribe, ve, cierra, espera, chrome };
}


// error y completas. Comprueba que la lista de tareas no cambia de tamaño, que la tarea aludida se ve, que el mensaje
// cabe en su franja, que el foco vuelve a la terminal y que nada se sale.
// la diapositiva de cada misión: se busca por data-mision (los números cambian cuando se quita o se añade una)
const DIAPOS = { 'ut4-m1': 0, 'ut4-m2': 0, 'ut4-m3': 0, 'ut4-m4': 0, 'ut4-m5': 0, 'ut4-m6': 0, 'ut4-m7': 0, 'ut4-m8': 0, 'ut4-repaso': 0 };
async function buscaDiapos(b) {
  await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}`, 6000);
  const m = await b.evalua(`Object.fromEntries([...document.querySelectorAll('deck-stage > section')].map((s, i) => { const t = s.querySelector('.term[data-mision]'); return t ? [t.dataset.mision, i + 1] : null; }).filter(Boolean))`);
  Object.assign(DIAPOS, m);
}
async function pruebaMisiones() {
  const solo = SOLO.length ? SOLO : Object.keys(DIAPOS);
  const b = await abre({ puerto: 9344, sinRed: SIN_RED });
  const problemas = [];
  await buscaDiapos(b);
  const estado = async () => b.evalua(`(() => { const el = ${T}, t = el._terminal; const ol = el.querySelector('.term-tareas'), msj = el.querySelector('.term-msj');
    const r = (x) => x.getBoundingClientRect(); const o = r(ol);
    const lis = [...ol.querySelectorAll('li')];
    const al = lis.findIndex((li) => li.classList.contains('aludida'));
    const vis = (li) => { const q = r(li); return q.top >= o.top - 1 && q.bottom <= o.bottom + 1; };
    const fuera = [...el.querySelectorAll('.term-mision-botones button, .ej-racha, .term-mision-clave, .term-pie button, .lvis-botones button, .term-ventana')].filter((x) => x.offsetParent && (r(x).bottom > r(el).bottom + 2 || r(x).right > r(el).right + 2)).map((x) => x.textContent.trim().slice(0, 20) || x.className);
    return { cols: t.cols, filas: t.filas, alto: Math.round(o.height), desborda: ol.scrollHeight > ol.clientHeight + 1, aludida: al, aludidaVisible: al < 0 || vis(lis[al]), msj: msj.innerText.trim(), msjCabe: msj.scrollHeight <= msj.clientHeight + 1, hechas: t.hechas.join(''), racha: el.querySelector('.ej-racha b').textContent, foco: document.activeElement === t.entrada, fuera, plegada: el.classList.contains('term-vista-plegada'), abajo: el.classList.contains('term-vista-abajo'), letra: getComputedStyle(el).getPropertyValue('--term-escala') }; })()`);
  try {
    for (const id of solo.filter((x) => DIAPOS[x])) {   // solo las misiones que están en la unidad
      const n = DIAPOS[id];
      await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}#${n}`, 6000);
      const e0 = await estado();
      console.log(`\n== ${id} (diapositiva ${n}) al entrar:`, JSON.stringify(e0));
      await b.foto(`${OUT}${id}-1-entrada.png`);
      // Pista con el ratón y, sin tocar nada más, se escribe: tiene que ir a la terminal
      await b.clic(`${T}.querySelector('[data-a=pista]')`);
      const e1 = await estado();
      await b.escribe('pwd'); await b.tecla('Enter'); await b.espera(500);
      const pwdOk = await b.evalua(`${T}.querySelector('.term-salida').innerText.includes('/home/')`);
      const diapo = await b.evalua(`document.querySelector('section[data-deck-active] .term') ? ${T}.closest('section') === document.querySelector('section[data-deck-active]') : false`);
      console.log('   pista:', JSON.stringify(e1), '| tras Pista, «pwd» llega a la terminal:', pwdOk, '| sigue en la diapositiva:', diapo);
      if (!pwdOk) problemas.push(id + ': tras Pista el teclado no va a la terminal');
      if (e1.alto !== e0.alto) problemas.push(id + ': la lista cambia de alto con la pista');
      if (!e1.aludidaVisible || !e1.msjCabe) problemas.push(id + ': la pista no se ve entera o tapa la tarea');
      await b.foto(`${OUT}${id}-2-pista.png`);
      // la pista más larga de la misión, en su tarea (puesta con la función de la terminal)
      const larga = await b.evalua(`(() => { const t = ${T}._terminal; let m = [-1, '']; t.mision.tareas.forEach((x, i) => { const o = SOM.linux.pistaOrden(x); const s = 'Tarea ' + (i + 1) + ': ' + x.pista + (o ? ' (Si vuelves a pulsar Pista, verás la orden.)' : ''); if (s.length > m[1].length) m = [i, s]; }); t.mensaje(m[1], '', m[0]); return m[0]; })()`);
      const e2 = await estado();
      console.log(`   pista más larga (tarea ${larga + 1}):`, JSON.stringify(e2));
      if (e2.alto !== e0.alto || !e2.aludidaVisible || !e2.msjCabe) problemas.push(id + ': la pista más larga no cabe o tapa la tarea');
      await b.foto(`${OUT}${id}-3-pista-larga.png`);
      // un error: la primera casilla con un dato falso e Intro
      const conCasilla = await b.evalua(`!!${T}.querySelector('li:not(.hecha) .term-casilla')`);
      if (conCasilla) {
        await b.clic(`${T}.querySelector('li:not(.hecha) .term-casilla')`);
        await b.escribe('zz9'); await b.tecla('Enter'); await b.espera(400);
        const e3 = await estado();
        const focoCasilla = await b.evalua(`document.activeElement && document.activeElement.classList.contains('term-casilla')`);
        console.log('   error:', JSON.stringify(e3), '| el foco sigue en la casilla:', focoCasilla);
        if (e3.alto !== e0.alto || !e3.aludidaVisible || !focoCasilla) problemas.push(id + ': el error esconde la tarea o pierde el foco');
        await b.foto(`${OUT}${id}-4-error.png`);
      }
      // completa con Resolver
      await b.clic(`${T}.querySelector('[data-a=resolver]')`);
      for (let k = 0; k < 150; k++) { await b.espera(1000); const e = await b.evalua(`${T}._terminal.hechas.every(Boolean) && !${T}._terminal.colaAcc`); if (e) break; }
      await b.espera(1200);
      const e4 = await estado();
      console.log('   completa:', JSON.stringify(e4));
      if (e4.alto !== e0.alto || !e4.msjCabe || e4.fuera.length) problemas.push(id + ': completa, algo no cabe ' + JSON.stringify(e4.fuera));
      await b.foto(`${OUT}${id}-5-completa.png`);
      // Resolver otra vez sobre la misión completa: no toca la racha
      const r0 = e4.racha;
      await b.clic(`${T}.querySelector('[data-a=resolver]')`);
      const e5 = await estado();
      if (e5.racha !== r0 || !/todo hecho/.test(e5.msj)) problemas.push(id + ': Resolver sobre la misión completa cambia la racha');
      if (e0.fuera.length || e4.fuera.length) problemas.push(id + ': se sale ' + JSON.stringify(e0.fuera.concat(e4.fuera)));
    }
  } finally { b.cierra(); }
  console.log('\nPROBLEMAS:', problemas.length ? '\n - ' + problemas.join('\n - ') : 'ninguno');
  return problemas.length;
}
async function pruebaAMano() {
  const b = await abre({ puerto: 9345 });
  const res = [];
  const ok = (cond, txt) => { res.push((cond ? 'bien  ' : 'MAL   ') + txt); console.log((cond ? 'bien  ' : 'MAL   ') + txt); };
  const orden = async (o, ms) => { await b.escribe(o); await b.tecla('Enter'); await b.espera(ms || 700); };
  const hechas = async () => b.evalua(`${T}._terminal.hechas.map((h) => (h ? 1 : 0)).join('')`);
  const casilla = async (i, valores) => {
    for (let j = 0; j < valores.length; j++) { await b.clic(`${T}.querySelectorAll('.term-tareas li')[${i}].querySelectorAll('.term-casilla, .term-selector')[${j}]`); await b.escribe(valores[j]); }
    await b.tecla('Enter'); await b.espera(400);
  };
  const esperado = async (i) => b.evalua(`${T}._terminal.mision.tareas[${i}].esperado(SOM.linux.contextoMision(${T}._terminal.sis, ${T}._terminal.sh))`);
  const msj = async () => b.evalua(`${T}.querySelector('.term-msj').innerText.trim()`);
  try {
    await buscaDiapos(b);
    /* ---------- M5 a mano ---------- */
    await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}#${DIAPOS['ut4-m5']}`, 6000);
    const n = await b.evalua(`+(/espere (\\d+) segundos/.exec(${T}.querySelector('.term-tareas').innerText) || [])[1]`);
    const mensajes = await b.evalua(`/mensajes/.test(${T}.querySelector('.term-tareas').innerText)`);
    await b.clic(`${T}.querySelector('.term-pantalla')`);
    await orden('sudo nano /etc/default/grub', 900); await orden('alumno', 1000);
    // F6 busca; Fin; se borra el valor y se escribe el nuevo
    await b.tecla('F6'); await b.escribe('TIMEOUT_STYLE='); await b.tecla('Enter'); await b.tecla('End');
    for (let k = 0; k < 6; k++) await b.tecla('Backspace');
    await b.escribe('menu');
    await b.tecla('F6'); await b.escribe('GRUB_TIMEOUT='); await b.tecla('Enter'); await b.tecla('End'); await b.tecla('Backspace'); await b.escribe(String(n));
    await b.tecla('F6'); await b.escribe('LINUX_DEFAULT='); await b.tecla('Enter'); await b.tecla('End');
    for (let k = 0; k < 13; k++) await b.tecla('Backspace');
    await b.escribe(mensajes ? '"' : 'quiet"');
    await b.foto(`${OUT}m5-amano-1-nano-final-de-linea.png`);
    const linea = await b.evalua(`[...${T}.querySelectorAll('.term-programa-texto > div')].map((d) => d.textContent).find((x) => /LINUX_DEFAULT/.test(x))`);
    ok(/^GRUB_CMDLINE_LINUX_DEFAULT="(quiet)?"\s*$/.test(linea), `M5: en nano se ve entera la línea editada con el cursor detrás: ${JSON.stringify(linea)}`);
    await b.ctrl('o'); await b.espera(300); await b.tecla('Enter'); await b.espera(300); await b.ctrl('x'); await b.espera(600);
    await orden('sudo update-grub', 2500);
    ok((await hechas()) === '1111', 'M5 hecha a mano: ' + await hechas());
    await b.foto(`${OUT}m5-amano-2-hecha.png`);
    await b.clic(`${T}.querySelector('.lvis-botones .btn-primary')`);
    await b.espera(1200);
    await b.foto(`${OUT}m5-amano-3-reinicio-firmware.png`);
    const botones = await b.evalua(`(() => { const el = ${T}; const v = el.querySelector('.lvis-vista-arranque').getBoundingClientRect(); return [...el.querySelectorAll('.lvis-botones button')].filter((x) => !x.hidden && x.offsetParent).map((x) => { const r = x.getBoundingClientRect(); return { t: x.textContent, dentro: r.top >= v.top && r.bottom <= v.bottom + 1 && r.right <= v.right + 1, alto: Math.round(r.height) }; }); })()`);
    ok(botones.length >= 2 && botones.every((x) => x.dentro), 'M5: los botones de la vista se ven enteros durante el arranque: ' + JSON.stringify(botones));
    const ultimo = botones[botones.length - 1];
    if (ultimo) { await b.clic(`[...${T}.querySelectorAll('.lvis-botones button')].filter((x) => !x.hidden && x.offsetParent).pop()`); }
    await b.espera(2500);
    await b.foto(`${OUT}m5-amano-4-menu-grub.png`);
    await b.espera(9000);
    await b.foto(`${OUT}m5-amano-5-arranque.png`);
    // maximizada: la vista y sus botones también se ven
    await b.clic(`${T}.querySelector('.term-ventanas .max')`); await b.espera(800);
    await b.clic(`${T}.querySelector('.lvis-botones .btn-primary')`); await b.espera(1200);
    const botonesMax = await b.evalua(`(() => { const el = ${T}; const v = el.querySelector('.lvis-vista-arranque').getBoundingClientRect(); return [...el.querySelectorAll('.lvis-botones button')].filter((x) => !x.hidden && x.offsetParent).map((x) => { const r = x.getBoundingClientRect(); return { t: x.textContent, dentro: r.top >= v.top && r.bottom <= v.bottom + 1 && r.right <= v.right + 1 }; }); })()`);
    ok(botonesMax.every((x) => x.dentro), 'M5 maximizada: botones de la vista dentro: ' + JSON.stringify(botonesMax));
    await b.foto(`${OUT}m5-amano-6-maximizada.png`);
    await b.tecla('Escape'); await b.tecla('Escape');

    /* ---------- M7 a mano ---------- */
    await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}#${DIAPOS['ut4-m7']}`, 6000);
    const arbol = await b.evalua(`!${T}.classList.contains('term-vista-plegada') && !!${T}.querySelector('.term-arbol-col .term-arbol')`);
    ok(arbol, 'M7: el árbol se ve al entrar');
    await b.clic(`${T}.querySelector('.term-pantalla')`); await b.espera(500);
    ok(await b.evalua(`!${T}.classList.contains('term-vista-plegada')`), 'M7: el árbol sigue tras el primer clic');
    const nombre = await b.evalua(`/llamado (\\S+)\\.txt/.exec(${T}.querySelector('.term-tareas').innerText)[1]`);
    await orden(`touch ${nombre}.txt`);
    const reciente = await b.evalua(`/más reciente/.test(${T}.querySelector('.term-tareas').innerText)`);
    await orden(reciente ? 'ls -alt' : 'ls -altr', 900);
    const partidas = await b.evalua(`(() => { const t = ${T}._terminal; const txt = t.salida.innerText.split('\\n').filter((l) => / \\.(recordatorio|notas_viejas|lista_secreta|borrador|config_juego)$/.test(l)); return { cols: t.cols, lineas: txt, largo: Math.max(...txt.map((l) => l.length)) }; })()`);
    ok(partidas.lineas.length === 3 && partidas.largo <= partidas.cols, `M7: las líneas de ls -l de los ocultos caben sin partirse (${partidas.largo} de ${partidas.cols} columnas)`);
    await b.foto(`${OUT}m7-amano-1-ls.png`);
    await casilla(1, await esperado(1));
    const texto = await b.evalua(`/tiene (\\S+\\.txt)/.exec(${T}.querySelector('.term-tareas').innerText)[1]`);
    await orden(`cat -n ${texto}`);
    await casilla(2, await esperado(2));
    const largo = await b.evalua(`/palabra de (\\S+\\.txt)/.exec(${T}.querySelector('.term-tareas').innerText)[1]`);
    await orden(`more ${largo}`, 800);
    for (let k = 0; k < 12; k++) await b.tecla(' ');
    await b.espera(500);
    await casilla(3, await esperado(3));
    await orden('top', 1200); await b.tecla('q'); await b.espera(600);
    await casilla(4, await esperado(4));
    const carpeta = await b.evalua(`/en la carpeta (\\S+?)\\.?$/m.exec(${T}.querySelector('.term-tareas li:last-child').innerText)[1]`);
    await b.clic(`${T}.querySelector('.term-pantalla')`);
    await orden(`cd ${carpeta}`);
    ok((await hechas()) === '111111', 'M7 hecha a mano: ' + await hechas());
    ok(/Misión cumplida/.test(await msj()) && (await b.evalua(`${T}.querySelector('.ej-racha b').textContent`)) === '1', 'M7: misión cumplida y racha 1');
    await b.foto(`${OUT}m7-amano-2-hecha.png`);
    // F8: una tarea vuelve a pendiente -> el mensaje de misión cumplida se quita
    await orden('cd');
    ok(!/Misión cumplida/.test(await msj()) && (await hechas()) === '111110', 'F8: al volver a pendiente se quita «misión cumplida»');
    await orden(`cd ${carpeta}`);
    ok(/otra vez|Misión cumplida/.test(await msj()) && (await b.evalua(`${T}.querySelector('.ej-racha b').textContent`)) === '1', 'F9: la racha no sube dos veces con el mismo ejercicio');
    // F8: exit y otra terminal -> la tarea 6 vuelve a pendiente
    await orden('exit', 600);
    await b.clic(`${T}.querySelector('.term-cerrada button')`); await b.espera(500);
    ok((await hechas()) === '111110', 'F8: tras exit y otra terminal, la tarea 6 vuelve a pendiente');
    // F9: Reiniciar y repetirla no sube la racha
    await b.clic(`${T}.querySelector('[data-a=reiniciar]')`); await b.espera(500);
    await b.clic(`${T}.querySelector('[data-a=resolver]')`);
    for (let k = 0; k < 120; k++) { await b.espera(1000); if (await b.evalua(`${T}._terminal.hechas.every(Boolean) && !${T}._terminal.colaAcc`)) break; }
    const r1 = await b.evalua(`${T}.querySelector('.ej-racha b').textContent`);
    await b.clic(`${T}.querySelector('[data-a=resolver]')`);
    ok((await b.evalua(`${T}.querySelector('.ej-racha b').textContent`)) === r1 && /todo hecho/.test(await msj()), 'F9: Resolver sobre la misión completa no toca la racha');

    /* ---------- F9: Resolver con man abierto y con ping en marcha; con la terminal cerrada ---------- */
    await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}#${DIAPOS['ut4-m1']}`, 6000);
    await b.clic(`${T}.querySelector('.term-pantalla')`);
    await orden('man ls', 900);
    await b.clic(`${T}.querySelector('[data-a=resolver]')`);
    ok(/sal antes de man/.test(await msj()), 'F9: Resolver con man abierto lo dice: ' + await msj());
    await b.tecla('q'); await b.espera(300);
    await orden('ping 10.0.2.2', 1500);
    await b.clic(`${T}.querySelector('[data-a=resolver]')`);
    ok(/corta antes/.test(await msj()), 'F9: Resolver con ping en marcha lo dice');
    await b.clic(`${T}.querySelector('.term-pantalla')`); await b.ctrl('c'); await b.espera(500);
    // F8: un «no es eso» que se queda viejo cuando la tarea se marca sola
    const pings = await b.evalua(`(${T}._terminal.sis.registro || []).filter((x) => x.tipo === 'ping' && x.interrumpido).pop().transmitidos`);
    await casilla(4, [String(pings + 1)]);
    ok(/no es eso/.test(await msj()), 'F8: el número mal da «no es eso»');
    await b.clic(`${T}.querySelector('.term-pantalla')`);
    await orden('ping 10.0.2.2', 300);
    for (let k = 0; k < 30; k++) { await b.espera(200); const tr = await b.evalua(`(() => { const t = ${T}._terminal; return t.ej ? 1 : 0; })()`); if (!tr) break; if (k === Math.max(0, pings) * 5) { await b.ctrl('c'); } }
    await b.ctrl('c'); await b.espera(600);
    const hecha5 = (await hechas())[4] === '1';
    ok(!hecha5 || !/no es eso/.test(await msj()), `F8: si la tarea se marca sola, el «no es eso» se quita (hecha: ${hecha5})`);
    await orden('exit', 600);
    await b.clic(`${T}.querySelector('[data-a=resolver]')`);
    await b.espera(1500);
    ok(!(await b.evalua(`${T}._terminal.cerrada`)), 'F9: Resolver con la terminal cerrada abre otra y sigue');
    await b.foto(`${OUT}m1-resolver-tras-exit.png`);

    /* ---------- M8: la contraseña del pie, tras passwd ---------- */
    await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}#${DIAPOS['ut4-m8']}`, 6000);
    await b.clic(`${T}.querySelector('.term-pantalla')`);
    const nueva = await b.evalua(`/contraseña por (\\S+?)\\./.exec(${T}.querySelector('.term-tareas').innerText)[1]`);
    await orden('passwd', 600); await orden('alumno', 500); await orden(nueva, 500); await orden(nueva, 800);
    const pie = await b.evalua(`${T}.querySelector('.term-mision-clave').innerText`);
    ok(pie.includes(nueva), 'F8: el pie dice la contraseña nueva tras passwd: ' + pie);
    await b.foto(`${OUT}m8-passwd.png`);
  } finally { b.cierra(); }
  console.log('\n' + res.filter((x) => x.startsWith('MAL')).length + ' fallos de ' + res.length);
  return res.filter((x) => x.startsWith('MAL')).length;
}

// 3. el foco tras cada botón y cada hueco del bloque
async function pruebaFoco() {
  const b = await abre({ puerto: 9346 });
  const res = [];
  const ok = (cond, txt) => { res.push((cond ? 'bien  ' : 'MAL   ') + txt); if (!cond) console.log('MAL   ' + txt); };
  const diapo = `[...document.querySelectorAll('deck-stage > section')].findIndex((s) => s.hasAttribute('data-deck-active'))`;
  try {
    await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}`, 6000);
    const misiones = await b.evalua(`[...document.querySelectorAll('deck-stage > section')].map((s, i) => { const t = s.querySelector('.term[data-mision]'); return t ? [t.dataset.mision, i + 1] : null; }).filter(Boolean)`);
    for (const [id, n] of misiones.filter(([m]) => !SOLO.length || SOLO.includes(m))) {
      await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}#${n}`, 5000);
      await b.clic(`${T}.querySelector('.term-pantalla')`);
      // en M5, la vista del arranque con sus botones: update-grub y «Reiniciar la máquina» (y lo que salga después)
      if (id === 'ut4-m5') { await b.escribe('sudo update-grub'); await b.tecla('Enter'); await b.espera(400); await b.escribe('alumno'); await b.tecla('Enter'); await b.espera(2500); }
      const objetivos = await b.evalua(`(() => { const el = ${T}; const q = (s) => [...el.querySelectorAll(s)].filter((x) => x.offsetParent);
        const lista = [];
        q('.term-ventanas .letra-mas, .term-ventanas .letra-menos').forEach((x) => lista.push('.term-ventanas .' + x.className));
        lista.push('.term-ventanas .max', '.term-ventanas .max');
        if (q('.term-bvista').length) lista.push('.term-bvista', '.term-bvista');
        q('[data-a=pista], [data-a=otro], [data-a=reiniciar]').forEach((x) => lista.push('[data-a=' + x.dataset.a + ']'));
        if (q('.term-comprobar').length) lista.push('.term-comprobar');
        lista.push('.ej-racha', '.term-foco', '.term-titulo', '.term-mision-botones');
        // la vista del arranque: «Reiniciar la máquina» y, después, los botones que van saliendo (Pulsar Esc, Intro)
        if (q('.term-vista button').length) lista.push('vista 0', 'vista 0', 'vista 0');
        return lista; })()`);
      const o2 = [];
      for (const o of objetivos) {
        const sel = /^vista /.test(o) ? `[...${T}.querySelectorAll('.term-vista button')].filter((x) => x.offsetParent)[${+o.slice(6)}]` : `${T}.querySelector('${o}')`;
        const antes = await b.evalua(diapo);
        await b.evalua(`(() => { const t = ${T}._terminal; t.entrada.value = ''; t.pinta(); })()`);
        const rotulo = await b.evalua(`(() => { const x = ${sel}; return x ? (x.textContent.trim() || x.getAttribute('aria-label') || '').slice(0, 30) : ''; })()`);
        if (!(await b.clic(sel))) continue;
        await b.espera(350);
        if (rotulo && /^vista /.test(o)) o2.push(rotulo);
        await b.escribe(' p');
        await b.espera(250);
        const r = await b.evalua(`(() => { const el = ${T}, t = el && el._terminal; const a = document.activeElement;
          return { diapo: ${diapo}, pantalla: !!document.fullscreenElement,
            enTerminal: !!t && a === t.entrada && (t.entrada.value === ' p' || !!t.programa), enCasilla: !!el && !!a && /^(INPUT|SELECT)$/.test(a.tagName) && el.contains(a) }; })()`);
        ok(r.diapo === antes && !r.pantalla && (r.enTerminal || r.enCasilla), `${id}: tras pulsar ${o}, « p» ${r.enTerminal ? 'llega a la terminal' : r.enCasilla ? 'va a la casilla' : 'NO llega a la terminal'}${r.diapo !== antes ? ' y la diapositiva cambia' : ''}${r.pantalla ? ' y pide pantalla completa' : ''}`);
        if (r.diapo !== antes) { await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}#${n}`, 4000); continue; }
        await b.evalua(`(() => { const t = ${T}._terminal; t.entrada.value = ''; t.pinta(); const c = document.activeElement; if (c && c.tagName === 'INPUT') c.value = ''; })()`);
      }
      console.log(`${id}: ${objetivos.length} clics comprobados${o2.length ? ' (en la vista: ' + o2.join(', ') + ')' : ''}`);
    }
    // con el teclado: Esc (deja la terminal) y Tab o Mayús + Tab hasta cada botón del bloque; el espacio tiene que
    // pulsar el botón y la diapositiva no se mueve. En las misiones y en todas las demostraciones.
    const conTerminal = await b.evalua(`[...document.querySelectorAll('deck-stage > section')].map((s, i) => { const t = s.querySelector('.term'); return t ? [t.dataset.mision || (t.hasAttribute('data-guion') ? 'demostración' : 'libre'), i + 1] : null; }).filter(Boolean)`);
    for (const [id, n] of conTerminal.filter(([m]) => !SOLO.length || SOLO.includes(m))) {
      await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}#${n}`, 4000);
      let probados = 0; const nombres = [];
      for (const atras of [false, true]) {
        for (let i = 1; i <= 14; i++) {
          // vuelta al principio: la terminal como al entrar, con el foco en ella, y Esc
          await b.evalua(`(() => { const t = ${T}._terminal; if (t.cerrada) t.reabre(); if (t.maximizada) t.maximiza(false); if (t.programa) t.teclaPrograma('q'); SOM.linux.cambiaLetra(0); t.entrada.value = ''; t.enfoca(); })()`);
          await b.clic(`${T}.querySelector('.term-pantalla')`);
          await b.tecla('Escape'); await b.espera(80);
          for (let k = 0; k < i; k++) await b.tecla('Tab', atras ? 8 : 0);
          const f = await b.evalua(`(() => { const sec = document.querySelector('section[data-deck-active]'), a = document.activeElement; const el = ${T}; if (!el || !a || !el.contains(a)) return { fuera: true }; if (a.tagName !== 'BUTTON' || a.disabled) return { otro: a.tagName + '.' + a.className };
            window.__pulsado = 0; a.addEventListener('click', () => { window.__pulsado++; }, { capture: true, once: true }); return { boton: (a.getAttribute('aria-label') || a.textContent.trim()).slice(0, 30) }; })()`);
          if (f.fuera) break;
          if (!f.boton) continue;
          const antes = await b.evalua(diapo);
          await b.tecla(' '); await b.espera(250);
          const r = await b.evalua(`({ diapo: ${diapo}, pulsado: window.__pulsado, pantalla: !!document.fullscreenElement })`);
          probados++; nombres.push(f.boton);
          ok(r.diapo === antes && r.pulsado === 1 && !r.pantalla, `${id} (diapositiva ${n}): ${atras ? 'Mayús + Tab' : 'Tab'} ×${i} hasta «${f.boton}» y espacio: ${r.pulsado ? 'lo pulsa' : 'NO lo pulsa'}${r.diapo !== antes ? ', y la diapositiva cambia' : ''}`);
          if (r.diapo !== antes) await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}#${n}`, 4000);
        }
      }
      console.log(`${id} (diapositiva ${n}): ${probados} botones pulsados con Tab y espacio (${[...new Set(nombres)].join(', ')})`);
    }
    await b.evalua(`SOM.linux.cambiaLetra(0)`);
    // los atajos del navegador que una página puede parar: con la terminal en uso van a ella (el navegador no hace lo
    // suyo: ni recarga, ni guarda, ni busca, ni imprime) y la diapositiva no cambia. Con el foco en la terminal y con
    // el foco en un botón del bloque. Ctrl + W, Ctrl + T y Ctrl + N se los reserva el navegador: no se prueban.
    const atajos = [['ctrl', 'r'], ['ctrl', 's'], ['ctrl', 'o'], ['ctrl', 'f'], ['ctrl', 'p'], ['ctrl', 'l'], ['ctrl', 'u'], ['ctrl', 'k'], ['ctrl', 'a'], ['ctrl', 'e'], ['ctrl', 'd'],
      ['F1'], ['F3'], ['F5'], ['F6'], ['F7'], ['F10'], ['F12']];
    const primera = conTerminal.find(([m]) => m === 'ut4-m1') || conTerminal[0];
    await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}#${primera[1]}`, 4000);
    await b.evalua(`window.__marca = 1; window.__teclas = []; window.addEventListener('keydown', (e) => window.__teclas.push(e), true);`);
    for (const enBoton of [false, true]) {
      for (const a of atajos) {
        await b.evalua(`(() => { const t = ${T}._terminal; if (t.cerrada) t.reabre(); t.entrada.value = 'x'; t.entrada.setSelectionRange(0, 0); t.pinta(); window.__teclas = []; })()`);
        await b.clic(`${T}.querySelector('.term-pantalla')`);
        if (enBoton) { await b.evalua(`${T}.querySelector('.term-ventanas .letra-mas').focus()`); }
        const antes = await b.evalua(diapo);
        if (a[0] === 'ctrl') await b.ctrl(a[1]); else await b.tecla(a[0]);
        await b.espera(300);
        const r = await b.evalua(`(() => { const ev = window.__teclas.find((e) => e.type === 'keydown' && !/^(Control)$/.test(e.key)); return { marca: window.__marca, diapo: ${diapo}, parado: !!ev && ev.defaultPrevented }; })()`);
        const nombre = (a[0] === 'ctrl' ? 'Ctrl + ' + a[1].toUpperCase() : a[0]) + (enBoton ? ' (con el foco en un botón)' : '');
        ok(r.marca === 1 && r.diapo === antes && r.parado, `atajo ${nombre}: ${r.parado ? 'va a la terminal' : 'el navegador hace lo suyo'}${r.diapo !== antes ? ', y la diapositiva cambia' : ''}${r.marca !== 1 ? ', y la página se recarga' : ''}`);
        if (r.marca !== 1) await b.evalua(`window.__marca = 1; window.__teclas = []; window.addEventListener('keydown', (e) => window.__teclas.push(e), true);`);
      }
    }
    // en una casilla de la misión, los atajos del navegador también se paran, sin escribir nada; Ctrl + A sigue libre
    await b.clic(`${T}.querySelector('.term-casilla')`);
    for (const a of [['ctrl', 'r'], ['ctrl', 'p'], ['ctrl', 'l'], ['F5'], ['F1']]) {
      await b.evalua(`window.__teclas = []`);
      if (a[0] === 'ctrl') await b.ctrl(a[1]); else await b.tecla(a[0]);
      const r = await b.evalua(`(() => { const ev = window.__teclas.find((e) => e.type === 'keydown' && e.key !== 'Control'); return { parado: !!ev && ev.defaultPrevented, vacia: document.activeElement.value === '' }; })()`);
      ok(r.parado && r.vacia, `en una casilla, ${a[0] === 'ctrl' ? 'Ctrl + ' + a[1].toUpperCase() : a[0]}: ${r.parado ? 'parado' : 'el navegador hace lo suyo'}${r.vacia ? '' : ' y escribe en la casilla'}`);
    }
    await b.evalua(`window.__teclas = []`); await b.ctrl('a');
    ok(await b.evalua(`(() => { const ev = window.__teclas.find((e) => e.type === 'keydown' && e.key !== 'Control'); return !!ev && !ev.defaultPrevented; })()`), 'en una casilla, Ctrl + A sigue siendo seleccionar todo');
    // fuera de uso (Esc), la presentación sigue respondiendo: Av Pág pasa de diapositiva
    await b.clic(`${T}.querySelector('.term-pantalla')`); await b.tecla('Escape'); await b.espera(100);
    const d0 = await b.evalua(diapo);
    await b.tecla('ArrowRight'); await b.espera(400);
    ok((await b.evalua(diapo)) === d0 + 1, 'después de Esc, la flecha derecha pasa de diapositiva');
  } finally { b.cierra(); }
  const mal = res.filter((x) => x.startsWith('MAL')).length;
  console.log(`foco: ${res.length - mal} de ${res.length} bien`);
  return mal;
}

// 4. la ayuda (man, --help…) sin red y con la red lenta: sin red, la orden se corta con un mensaje que lo dice y, con
// red otra vez, funciona; con red lenta, la terminal dice «Cargando la ayuda…» y lo tecleado no se pierde. Y la ayuda
// empieza a bajar sola al pulsar en una terminal, no al abrir la unidad
async function pruebaRed() {
  const res = [];
  const ok = (c, t) => { res.push(c); console.log((c ? 'bien  ' : 'MAL   ') + t); };
  const red = (b, o) => b.cdp('Network.emulateNetworkConditions', Object.assign({ offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, o));
  const m1 = async (b) => { await buscaDiapos(b); await b.ve(`${BASE}/ut04/index.html?v=${Date.now()}#${DIAPOS['ut4-m1']}`, 5000); };
  let b = await abre({ puerto: 9347, perfil: '-sinred' });
  try {
    await m1(b);
    await red(b, { offline: true });
    await b.clic(`${T}.querySelector('.term-pantalla')`);
    await b.escribe('man ls'); await b.tecla('Enter'); await b.espera(2500);
    const s1 = await b.evalua(`${T}._terminal.salida.innerText.slice(-300)`);
    ok(/No se ha podido cargar la ayuda/.test(s1) && !/no tiene copiada/.test(s1) && !(await b.evalua(`!!${T}._terminal.ej`)), 'sin red: «No se ha podido cargar la ayuda…» y la orden se corta');
    await red(b, {});
    await b.escribe('man ls'); await b.tecla('Enter');
    for (let k = 0; k < 40 && !(await b.evalua(`!!${T}._terminal.programa`)); k++) await b.espera(250);
    ok(await b.evalua(`!!${T}._terminal.programa && ${T}._terminal.progTexto.innerText.includes('LS(1)')`), 'con red otra vez: man ls se abre');
    await b.tecla('q');
  } finally { b.cierra(); }
  b = await abre({ puerto: 9348, perfil: '-precarga' });
  try {
    await m1(b); await b.espera(2500);
    const antes = await b.evalua(`performance.getEntriesByType('resource').some((r) => r.name.includes('linux-ayuda.js'))`);
    await b.clic(`${T}.querySelector('.term-pantalla')`);
    for (let k = 0; k < 40 && !(await b.evalua(`!!SOM.linux.ayuda && !!SOM.linux.info`)); k++) await b.espera(250);
    ok(!antes && (await b.evalua(`!!SOM.linux.ayuda && !!SOM.linux.whatis && !!SOM.linux.info`)), 'la ayuda no baja al abrir la diapositiva y baja sola al pulsar en la terminal');
  } finally { b.cierra(); }
  b = await abre({ puerto: 9349, perfil: '-lenta' });
  try {
    await m1(b);
    await red(b, { latency: 400, downloadThroughput: 32000, uploadThroughput: 32000 });
    await b.clic(`${T}.querySelector('.term-pantalla')`);
    await b.escribe('man ls'); await b.tecla('Enter'); await b.espera(800);
    const aviso = await b.evalua(`${T}.querySelector('.term-linea').innerText`);
    await b.foto(`${OUT}red-lenta-cargando.png`);
    await b.escribe('ls'); await b.tecla('Enter'); await b.espera(300);
    const guardado = await b.evalua(`${T}._terminal.entrada.value`);
    for (let k = 0; k < 200 && !(await b.evalua(`!!${T}._terminal.programa`)); k++) await b.espera(250);
    await b.tecla('q'); await b.espera(500);
    ok(/Cargando la ayuda/.test(aviso) && guardado === 'ls' && (await b.evalua(`${T}._terminal.entrada.value`)) === 'ls', `red lenta: «${aviso}», y lo tecleado («${guardado}») sigue en la línea al acabar`);
  } finally { b.cierra(); }
  const mal = res.filter((x) => !x).length;
  console.log(`red: ${res.length - mal} de ${res.length} bien`);
  return mal;
}

(async () => {
  if (SOLO_FOCO) { const f = await pruebaFoco(); console.log(f ? `HAY ${f} PROBLEMAS` : 'Todo bien'); process.exit(f ? 1 : 0); }
  if (ARGS.includes('red')) { const r = await pruebaRed(); console.log(r ? `HAY ${r} PROBLEMAS` : 'Todo bien'); process.exit(r ? 1 : 0); }
  const a = await pruebaMisiones();
  const b = SOLO.length ? 0 : await pruebaAMano();
  const f = await pruebaFoco();
  const r = SOLO.length ? 0 : await pruebaRed();
  console.log(`\n${a + b + f + r ? 'HAY ' + (a + b + f + r) + ' PROBLEMAS' : 'Todo bien'}. Capturas en ${OUT}`);
  process.exit(a + b + f + r ? 1 : 0);
})();
