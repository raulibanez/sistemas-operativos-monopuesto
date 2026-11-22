/* Prueba del parpadeo al escribir con la pantalla llena: abre plantilla/linux.html en un Chrome sin pantalla
 * (con su propio perfil), llena la terminal con más de 300 líneas, escribe 20 caracteres con teclas de verdad
 * (protocolo de DevTools: Input.dispatchKeyEvent) y registra el desplazamiento del área de texto en cada cambio
 * (MutationObserver, requestAnimationFrame, el evento scroll y las teclas e input en fase de captura). Falla si
 * en algún instante el desplazamiento baja del valor del final. Modos: libre, mision, demo (escritura letra a
 * letra de la demostración), nano, man y less.
 *
 *   python -m http.server 8791 --bind 127.0.0.1      (en la raíz del repositorio, en otra consola)
 *   node herramientas/linux-parpadeo.js [modo…]
 * Variables: CHROME (ruta de chrome.exe), PUERTO (8791), PERFIL (carpeta del perfil de Chrome). */
'use strict';
const { spawn, execFileSync } = require('child_process');
const os = require('os');
const path = require('path');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PUERTO = process.env.PUERTO || '8791';
const PERFIL = process.env.PERFIL || path.join(os.tmpdir(), 'linux-parpadeo-chrome');
const DEPURA = 9333;
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const MODOS = { libre: ['libre', 2], mision: ['mision-respuestas', 6], demo: ['demostracion', 3], nano: ['libre', 2], man: ['libre', 2], less: ['libre', 2] };

async function conecta() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${DEPURA}/json`);
      const p = (await r.json()).find((x) => x.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch (e) { /* todavía no */ }
    await espera(200);
  }
  throw new Error('Chrome no responde');
}

async function prueba(modo) {
  const [id, n] = MODOS[modo];
  const url = `http://127.0.0.1:${PUERTO}/plantilla/linux.html?v=${Date.now()}#${n}`;
  const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEPURA}`, `--user-data-dir=${PERFIL}`, '--window-size=1920,1080', '--no-first-run', '--disable-extensions', '--disk-cache-size=1', '--disable-application-cache', url], { stdio: 'ignore' });
  try {
    const ws = new WebSocket(await conecta());
    await new Promise((ok) => ws.addEventListener('open', ok));
    let sig = 0; const pend = new Map();
    ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } });
    const manda = (method, params) => new Promise((ok) => { const i = ++sig; pend.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
    const evalua = async (expr) => { const r = await manda('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : r; };
    for (let i = 0; i < 50 && !(await evalua(`!!(window.SOM && SOM.terminales && SOM.terminales.length > 3)`)); i++) await espera(200);
    await espera(500);
    // pantalla llena y, si toca, el programa abierto
    await evalua(`(() => { const t = SOM.terminales.find((x) => x.el.closest('section').dataset.deckId === '${id}'); window._t = t; t.enfoca(); t.lanza('cat /etc/services; ls -l /etc; cat /etc/services'); })()`);
    await espera(1500);
    const prog = { nano: 'nano /etc/services', man: 'man ls', less: 'less /etc/services' }[modo];
    if (prog) { await evalua(`_t.lanza(${JSON.stringify(prog)})`); await espera(800); }
    await evalua(`(() => {
      const t = _t, p = t.pantalla;
      window._r = { ref: p.scrollTop, min: p.scrollTop, minProg: 0, muestras: 0, lineas: (t.salida.textContent.match(/\\n/g) || []).length };
      const mira = () => { const r = window._r; r.muestras++; if (p.scrollTop < r.min) r.min = p.scrollTop; if (t.progTexto.scrollTop > r.minProg) r.minProg = t.progTexto.scrollTop; };
      new MutationObserver(mira).observe(t.el, { subtree: true, childList: true, characterData: true, attributes: true });
      p.addEventListener('scroll', mira);
      ['keydown', 'keypress', 'beforeinput', 'input', 'keyup', 'selectionchange'].forEach((e) => document.addEventListener(e, mira, true));
      window._vivo = true; const raf = () => { mira(); if (window._vivo) requestAnimationFrame(raf); }; requestAnimationFrame(raf);
    })()`);
    const texto = 'echo hola que tal ya';
    if (modo === 'demo') {
      await evalua(`_t.teclea(${JSON.stringify(texto)}, false)`);
      await espera(texto.length * 60 + 1500);
    } else {
      for (const c of texto) {
        await manda('Input.dispatchKeyEvent', { type: 'keyDown', text: c, key: c, unmodifiedText: c });
        await manda('Input.dispatchKeyEvent', { type: 'keyUp', key: c });
        await espera(70);
      }
      await espera(800);
    }
    const r = await evalua(`(() => { window._vivo = false; const r = window._r; r.final = _t.pantalla.scrollTop; r.linea = _t.entrada.value; r.prog = _t.programa ? _t.programa.tipo : ''; return r; })()`);
    ws.close();
    const bien = r.min >= r.ref && r.minProg === 0;
    return Object.assign({ modo, bien }, r);
  } finally {
    try { execFileSync('taskkill', ['/PID', String(ch.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { ch.kill(); }
    await espera(500);
  }
}

(async () => {
  const modos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MODOS);
  let mal = 0;
  for (const m of modos) {
    const r = await prueba(m);
    if (!r.bien) mal++;
    console.log(`${r.bien ? 'bien' : 'FALLA'}  ${m}: ${r.lineas} líneas, desplazamiento al empezar ${r.ref}, mínimo ${r.min}, al final ${r.final}, ${r.muestras} muestras${r.prog ? ', programa ' + r.prog : ''}${r.minProg ? ', el programa se desplazó ' + r.minProg : ''}; línea «${r.linea}»`);
  }
  process.exit(mal ? 1 : 0);
})();
