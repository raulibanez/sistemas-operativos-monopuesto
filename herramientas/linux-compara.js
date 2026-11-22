/* Compara el simulador con lo grabado en una Ubuntu real (linux-real.json). Lo usa prueba-linux.js; también
 * se puede ejecutar solo para ver las diferencias:
 *   node herramientas/linux-compara.js            resumen y diferencias
 *   node herramientas/linux-compara.js 'ls -la'   solo los casos que contienen ese texto, con detalle */
'use strict';
const path = require('path');
const fs = require('fs');
const A = path.join(__dirname, '..', 'assets');
['linux-datos.js', 'linux.js', 'linux-bash.js', 'linux-ordenes.js', 'linux-sistema.js', 'linux-ut4.js'].forEach((f) => require(path.join(A, f)));
const L = globalThis.SOM.linux;

// lo que cambia de una máquina a otra: usuario, equipo, fechas, números de inodo y de proceso
function normaliza(t, m) {
  if (t === null || t === undefined) return t;
  const u = m.usuario, eq = m.equipo;
  return String(t)
    .replace(new RegExp(eq, 'g'), 'som')
    .replace(/Lucía García/g, 'Alumno')
    .replace(new RegExp('\\b' + u + '\\b', 'g'), 'alumno')
    .replace(/bash: línea \d+: /g, 'bash: línea N: ')
    .replace(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) [ \d]\d (\d\d:\d\d| \d{4})/g, 'FECHA')
    .replace(/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{9} [+-]\d{4}/g, 'FECHA-LARGA')
    .replace(/\b(lun|mar|mié|jue|vie|sáb|dom) \d\d (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) \d{4} \d\d:\d\d:\d\d (CET|CEST|UTC)/g, (x) => (/2026 00:00:00 CET/.test(x) ? x : 'FECHA-DATE'))
    .replace(/^\d{4}$/m, (x) => (+x >= 2025 && +x <= 2030 ? 'AÑO' : x))
    .replace(/Inode: \d+/g, 'Inode: N')
    .replace(/Bloques: Total: \d+ +Libres: \d+ +Disponibles: \d+/g, 'BLOQUES');
}
function cargaReal() {
  const f = path.join(__dirname, 'linux-real.json');
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
// un sistema con el mismo escenario que la máquina real, montado con el propio simulador
function sistemaCaso(real) {
  const sis = L.crea({ fecha: real.maquina.fecha ? Date.parse(real.maquina.fecha) : '2026-11-21T09:30:00+01:00', carpetas: ['/tmp/simprueba/w'] });
  const sh = new L.Sesion(sis, { interactiva: false, sinTty: true, cwd: '/tmp/simprueba/w' });
  sh.nombreScriptActual = 'bash';
  const r = sh.ejecuta(real.fixture.join('\n'));
  if (r.stderr) throw new Error('El escenario falla en el simulador: ' + r.stderr);
  return { sis, sh };
}
function ejecutaCaso(real, caso) {
  const { sh } = sistemaCaso(real);
  sh.lineaActual = 1;
  const r = sh.ejecuta(caso.orden);
  return r;
}
function compara(filtro, detalle) {
  const real = cargaReal();
  if (!real) return null;
  const m = real.maquina;
  const res = [];
  for (const caso of real.casos) {
    if (filtro && !caso.orden.includes(filtro)) continue;
    let r;
    try { r = ejecutaCaso(real, caso); } catch (e) { res.push({ caso, error: e.stack }); continue; }
    const ord = (t) => (caso.ordenar ? t.split('\n').filter(Boolean).sort().join('\n') : t);
    const esperado = { stdout: ord(normaliza(caso.stdout, m)), stderr: normaliza(caso.stderr, m), codigo: caso.codigo };
    const obtenido = { stdout: ord(normaliza(r.stdout, m)), stderr: normaliza(r.stderr, m), codigo: r.codigo };
    const bien = esperado.stdout === obtenido.stdout && esperado.stderr === obtenido.stderr && esperado.codigo === obtenido.codigo;
    res.push({ caso, bien, esperado, obtenido, avisos: r.avisos });
    if (detalle && !bien) {
      console.log('\n=== ' + caso.orden);
      if (esperado.codigo !== obtenido.codigo) console.log(`código: real ${esperado.codigo}, simulador ${obtenido.codigo}`);
      if (esperado.stdout !== obtenido.stdout) console.log('--- stdout real\n' + esperado.stdout + '--- stdout simulador\n' + obtenido.stdout);
      if (esperado.stderr !== obtenido.stderr) console.log('--- stderr real\n' + esperado.stderr + '--- stderr simulador\n' + obtenido.stderr);
      if (r.avisos.length) console.log('avisos: ' + r.avisos.join(' | '));
    }
  }
  return res;
}
/* Las salidas de la máquina Ubuntu-SOM con UEFI (21-11-2026): solo la salida estándar, en una terminal con la
 * imagen base del simulador. Origen distinto de las de la máquina «Ubuntu» (casos): se marcan con caso.origen. */
function comparaUbuntuSom(filtro, detalle) {
  const real = cargaReal();
  if (!real || !real.ubuntuSom) return [];
  const m = real.ubuntuSom.maquina;
  const res = [];
  for (const caso of real.ubuntuSom.casos) {
    if (filtro && !caso.orden.includes(filtro)) continue;
    let r;
    try {
      const sis = L.crea({ fecha: Date.parse(m.fecha) });
      const sh = sis.sesion();
      sh.ejecuta('sudo true', { respuestas: ['alumno'] });
      r = sh.ejecuta(caso.simulador || caso.orden);
    } catch (e) { res.push({ caso: Object.assign({ origen: m.origen }, caso), error: e.stack }); continue; }
    const limpio = (t) => normaliza(String(t).replace(/\x1b\[[0-9;]*m|\x1b\[K/g, ''), m);
    const esperado = { stdout: limpio(caso.stdout), codigo: caso.codigo };
    const obtenido = { stdout: limpio(r.stdout), codigo: r.codigo };
    const bien = esperado.stdout === obtenido.stdout && esperado.codigo === obtenido.codigo && !r.avisos.length;
    res.push({ caso: Object.assign({ origen: m.origen }, caso), bien, esperado, obtenido, avisos: r.avisos });
    if (detalle && !bien) console.log('\n=== (Ubuntu-SOM) ' + caso.orden + '\n--- real\n' + esperado.stdout + '--- simulador\n' + obtenido.stdout + (r.avisos.length ? 'avisos: ' + r.avisos.join(' | ') + '\n' : ''));
  }
  return res;
}
/* Las salidas con manpages-es (copia temporal de la máquina «Ubuntu», 21-11-2026): sin terminal salvo las marcadas
 * con tty; las de sinManpagesEs, con el escenario manEs: false (antes de instalar el paquete). */
function comparaManpagesEs(filtro, detalle) {
  const real = cargaReal();
  if (!real || !real.manpagesEs) return [];
  const m = real.manpagesEs.maquina;
  const res = [];
  const limpio = (t) => (t === null || t === undefined ? t : normaliza(String(t).replace(/\x1b\[[0-9;]*m|\x1b\[K/g, ''), m).replace(/y \d+ no actualizados/g, 'y N no actualizados'));
  for (const caso of real.manpagesEs.casos) {
    if (filtro && !caso.orden.includes(filtro)) continue;
    let r;
    try {
      const sis = L.crea({ fecha: Date.parse(m.fecha), manEs: !caso.sinManpagesEs });
      let sh;
      if (caso.tty) { sh = sis.sesion(); sh.ejecuta('sudo true', { respuestas: ['alumno'] }); }
      else sh = new L.Sesion(sis, { interactiva: false, sinTty: true });
      r = sh.ejecuta(caso.simulador || caso.orden);
    } catch (e) { res.push({ caso: Object.assign({ origen: m.origen }, caso), error: e.stack }); continue; }
    const esperado = { stdout: limpio(caso.stdout), stderr: limpio(caso.stderr), codigo: caso.codigo };
    const obtenido = { stdout: limpio(r.stdout), stderr: caso.stderr === null ? null : limpio(r.stderr), codigo: r.codigo };
    const bien = esperado.stdout === obtenido.stdout && esperado.stderr === obtenido.stderr && esperado.codigo === obtenido.codigo && !r.avisos.length;
    res.push({ caso: Object.assign({ origen: m.origen }, caso), bien, esperado, obtenido, avisos: r.avisos });
    if (detalle && !bien) console.log('\n=== (manpages-es) ' + caso.orden + (caso.sinManpagesEs ? ' [sin el paquete]' : '') + '\n--- real\n' + esperado.stdout + (esperado.stderr ? '--- stderr real\n' + esperado.stderr : '') + '--- simulador\n' + obtenido.stdout + (obtenido.stderr ? '--- stderr simulador\n' + obtenido.stderr : '') + (r.avisos.length ? 'avisos: ' + r.avisos.join(' | ') + '\n' : '') + `código: real ${esperado.codigo}, simulador ${obtenido.codigo}`);
  }
  return res;
}
module.exports = { compara, comparaUbuntuSom, comparaManpagesEs, normaliza, cargaReal };
if (require.main === module) {
  const res = compara(process.argv[2], true);
  if (!res) { console.log('No hay herramientas/linux-real.json: grábalo con linux-graba-real.js'); process.exit(1); }
  const bien = res.filter((x) => x.bien).length;
  res.filter((x) => x.error).forEach((x) => console.log('ERROR en ' + x.caso.orden + '\n' + x.error));
  console.log(`\n${bien} de ${res.length} casos iguales que en la Ubuntu real`);
  const som = comparaUbuntuSom(process.argv[2], true);
  console.log(`${som.filter((x) => x.bien).length} de ${som.length} casos iguales que en la máquina Ubuntu-SOM con UEFI`);
  const es = comparaManpagesEs(process.argv[2], true);
  console.log(`${es.filter((x) => x.bien).length} de ${es.length} casos iguales que con manpages-es instalado`);
}
