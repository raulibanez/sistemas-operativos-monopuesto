// Genera guiones/practica-linux-ut4.md: la lista entera de encargos de Practica Linux UT4, para leerla de un tirón.
// Uso: node herramientas/linux-practica-lista.js
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', 'assets') + path.sep;
['linux-datos.js', 'linux.js', 'linux-bash.js', 'linux-ordenes.js', 'linux-sistema.js', 'linux-ut4.js', 'linux-misiones.js', 'linux-misiones-ut4.js', 'linux-practica.js', 'linux-practica-ut4.js'].forEach((f) => require(R + f));
const L = globalThis.SOM.linux, P = L.practica;
const banco = P.prepara(P.bancos[4]);
const md = (t) => String(t).replace(/‹([^›]+)›/g, '`$1`');
// lo que hace «Ver solución» con las teclas de cada paso: en nano, qué línea cambia y por qué; en man, info, more o
// systemctl, las teclas tal cual (búsquedas, barra espaciadora, q)
const nombreTecla = (k) => (k === ' ' ? 'barra espaciadora' : k === 'Enter' ? 'Intro' : k.replace(/^Ctrl\+/, 'Ctrl + '));
function teclas(x) {
  const t = x.teclas;
  if (/\bnano\b/.test(x.orden)) {
    const cambios = []; let i = 0;
    while (i < t.length) {
      if (t[i] !== 'Ctrl+W' && t[i] !== 'F6') { i++; continue; }
      const tecla = t[i] === 'F6' ? 'F6' : 'Ctrl + W';
      if (!cambios.length) cambios.push(`busca con ${tecla}`);
      let busca = ''; i++;
      while (i < t.length && t[i] !== 'Enter') busca += t[i++];
      i++; let borra = 0; while (t[i] === 'Delete') { borra++; i++; }
      let pone = ''; while (i < t.length && t[i].length === 1) pone += t[i++];
      cambios.push(borra === busca.length ? `cambia \`${busca}\` por \`${pone}\`` : `busca \`${busca}\`, borra ${borra} caracteres y escribe \`${pone}\``);
    }
    const guarda = t.includes('Ctrl+O') ? '; guarda con Ctrl + O e Intro y sale con Ctrl + X' : '';
    return ` (en nano: ${cambios.join('; ') || 'sin cambios'}${guarda})`;
  }
  const partes = []; let i = 0;
  while (i < t.length) {
    if (t[i] === '/') { let b = ''; i++; while (i < t.length && t[i] !== 'Enter') b += t[i++]; i++; partes.push('/' + b + ' e Intro'); continue; }
    let n = 1; while (t[i + n] === t[i]) n++;
    partes.push(t[i] === ' ' && n > 1 ? 'barra espaciadora hasta el final' : t[i] === 'q' ? 'q para salir' : nombreTecla(t[i]) + (n > 1 ? ' ×' + n : ''));
    i += n;
  }
  return ` (${partes.join(', ')})`;
}
const paso = (p) => { const x = L.pasoMision(p); let s = '`' + x.orden + '`'; if (x.tab) s += ' + Tab + Intro'; if (x.ctrlC) s += ` (Ctrl + C a los ${x.ctrlC} s)`; if (x.respuestas) s += ` (responde: ${x.respuestas.map((r) => (r === '' ? 'Intro' : r)).join(', ')})`; if (x.teclas) s += teclas(x); return s; };
let out = '# Practica Linux · UT4 · los encargos\n\nGenerado de `assets/linux-practica-ut4.js`. Por cada encargo: lo que se pide, las dos pistas, la solución (la que escribe «Ver solución»), otras soluciones que también valen, la explicación al acertar y los despistes previstos con su mensaje.\n';
let n = 0;
banco.bloques.forEach((b, i) => {
  out += `\n## ${i + 1}. ${b.nombre}\n\n_${b.encargos.length} encargos${b.vista ? ', con el árbol de carpetas al lado' : ''}._\n`;
  b.encargos.forEach((e, k) => {
    n++;
    out += `\n### ${i + 1}.${k + 1} ${md(e.pide)}\n\n`;
    if (e.casilla) out += `- **Casilla:** ${e.casilla.nombres.join(', ')}\n`;
    if (e.selector) out += `- **Selector:** ${e.selector.join(' / ')}\n`;
    out += `- **Pista 1:** ${md(e.pistas[0])}\n- **Pista 2:** ${md(e.pistas[1])}\n`;
    out += `- **Solución:** ${e.sol.map(paso).join(' y ')}\n`;
    if (e.alt && e.alt.length) out += `- **También vale:** ${e.alt.map((a) => a.map(paso).join(' y ')).join(' · ')}\n`;
    out += `- **Al acertar:** ${md(e.exp)}\n`;
    (e.despistes || []).forEach((d) => {
      const r = P.reconstruye(b, k, { fecha: '2026-11-21T09:30:00+01:00' }); const desde = r.sis.registro.length; let c;
      d.pasos.forEach((p) => { c = P.ejecuta(r.sh, p, desde); });
      out += `- **Despiste** ${d.pasos.map(paso).join(' y ')} → «${md(P.evalua(e, c).msg)}»\n`;
    });
  });
});
out += `\n---\n${n} encargos en ${banco.bloques.length} bloques.\n`;
const f = path.join(__dirname, '..', 'guiones', 'practica-linux-ut4.md');
fs.writeFileSync(f, out);
console.log(f, n);
