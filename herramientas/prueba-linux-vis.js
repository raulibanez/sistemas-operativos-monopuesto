/* Pruebas de los simuladores visuales de la UT4 (assets/linux-vis.js), en Node:
 *
 *   node herramientas/prueba-linux-vis.js          todas
 *   node herramientas/prueba-linux-vis.js rapido   con 20 semillas por generador en lugar de 300
 *
 * Bloques: partes de una orden (con el analizador del núcleo), particiones (planes, tamaños, lsblk y hechos),
 * arranque (lectura de grub.cfg y estado de un sistema simulado), anatomía de ls -l y los generadores
 * version-nucleo y distro con cientos de semillas. */
'use strict';
const path = require('path');
const A = path.join(__dirname, '..', 'assets');
['linux-datos.js', 'linux.js', 'linux-bash.js', 'linux-ordenes.js', 'linux-sistema.js', 'linux-misiones.js', 'linux-misiones-ut4.js'].forEach((f) => require(path.join(A, f)));
globalThis.SOM.generadores = globalThis.SOM.generadores || {};     // en la página lo crea som.js
require(path.join(A, 'linux-vis.js'));
const SOM = globalThis.SOM, V = SOM.linuxVis, L = SOM.linux;
const rapido = process.argv.includes('rapido');
const fs = require('fs');
// datos medidos en la máquina real (fuera del repositorio; si no están, esas comprobaciones se saltan)
const MISC = path.join(__dirname, '..', '..', 'Misc', 'capturas-ut04', 'txt');
const SEMILLAS = rapido ? 20 : 300;

let total = 0, bien = 0;
const fallos = [];
function prueba(nombre, f) { total++; try { f(); bien++; } catch (e) { fallos.push(nombre + ': ' + (e && e.message)); } }
function igual(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg ? msg + ': ' : '') + `esperaba ${JSON.stringify(b)} y salió ${JSON.stringify(a)}`); }
function cierto(v, msg) { if (!v) throw new Error(msg || 'no se cumple'); }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function conSemilla(s, f) { const o = Math.random; Math.random = mulberry32(s); try { return f(); } finally { Math.random = o; } }
const papeles = (linea) => V.analizaOrden(linea).trozos.map((t) => t.texto + ':' + t.papel + (t.tipo ? '/' + t.tipo : ''));

/* ================= 1. partes de una orden ================= */
prueba('orden: las seis líneas de la diapositiva 15', () => {
  igual(papeles('ls -l /etc'), ['ls:orden', '-l:opcion/corta', '/etc:argumento']);
  igual(papeles('ls --all'), ['ls:orden', '--all:opcion/larga']);
  igual(papeles('ls -la /home'), ['ls:orden', '-la:opcion/juntas', '/home:argumento']);
  igual(papeles('uname -r'), ['uname:orden', '-r:opcion/corta']);
  igual(papeles('echo Hola'), ['echo:orden', 'Hola:argumento']);
  igual(papeles('clear; pwd'), ['clear:orden', ';:separador', 'pwd:orden']);
});
prueba('orden: posiciones exactas en el texto', () => {
  const l = 'ls  -la   /home';
  V.analizaOrden(l).trozos.forEach((t) => igual(l.slice(t.ini, t.fin), t.texto));
  const m = 'clear;pwd>x';
  igual(V.analizaOrden(m).trozos.map((t) => [t.texto, t.papel, m.slice(t.ini, t.fin)]), [['clear', 'orden', 'clear'], [';', 'separador', ';'], ['pwd', 'orden', 'pwd'], ['>', 'redireccion', '>'], ['x', 'destino', 'x']]);
});
prueba('orden: líneas escritas a mano', () => {
  igual(papeles('ls-l'), ['ls-l:orden']);
  cierto(/No hay espacio entre/.test(V.explicaTrozo(V.analizaOrden('ls-l').trozos[0]).texto), 'avisa de ls-l');
  igual(papeles('ls -all'), ['ls:orden', '-all:opcion/juntas']);
  cierto(/--all/.test(V.explicaTrozo(V.analizaOrden('ls -all').trozos[1]).texto), 'avisa de -all con un guion');
  igual(papeles('echo "Hola mundo" -n'), ['echo:orden', '"Hola mundo":argumento', '-n:argumento']);
  igual(papeles('echo -n Hola'), ['echo:orden', '-n:opcion/corta', 'Hola:argumento']);
  igual(papeles('sudo apt update'), ['sudo:orden', 'apt:orden', 'update:argumento']);
  igual(papeles('cat /etc/passwd | grep alumno'), ['cat:orden', '/etc/passwd:argumento', '|:tuberia', 'grep:orden', 'alumno:argumento']);
  igual(papeles('ls > lista.txt 2> errores.txt'), ['ls:orden', '>:redireccion', 'lista.txt:destino', '2>:redireccion', 'errores.txt:destino']);
  igual(papeles('PS1="> "'), ['PS1="> ":asignacion']);
  igual(papeles('ls -- -a'), ['ls:orden', '--:fin-opciones', '-a:argumento']);
  igual(papeles('true && echo si || echo no'), ['true:orden', '&&:condicion', 'echo:orden', 'si:argumento', '||:condicion', 'echo:orden', 'no:argumento']);
  igual(papeles('uname --kernel-release'), ['uname:orden', '--kernel-release:opcion/larga']);
});
prueba('orden: errores del analizador', () => {
  cierto(/comilla '/.test(V.analizaOrden("echo 'sin cerrar").error), 'comilla');
  cierto(/después de \|/.test(V.analizaOrden('ls |').error), 'tubería');
  cierto(/sintaxis/.test(V.analizaOrden('ls ;; pwd').error), 'sintaxis');
  cierto(V.analizaOrden('   ').error, 'vacía');
});
prueba('orden: explicaciones de cada papel', () => {
  const ex = (l, i) => V.explicaTrozo(V.analizaOrden(l).trozos[i]);
  cierto(/formato largo/.test(ex('ls -l /etc', 1).texto), '-l');
  cierto(/ocultos/.test(ex('ls --all', 1).texto) && /-a/.test(ex('ls --all', 1).texto), '--all');
  cierto(/-l -a/.test(ex('ls -la /home', 1).texto), '-la juntas');
  cierto(/versión del núcleo/.test(ex('uname -r', 1).texto), '-r');
  cierto(/sobre qué/.test(ex('echo Hola', 1).texto), 'argumento');
  cierto(/dos órdenes/.test(ex('clear; pwd', 1).texto), ';');
  cierto(/variable/.test(ex('echo $SHELL', 1).texto), 'variable');
  cierto(/administrador/.test(ex('sudo apt update', 1).texto), 'sudo');
  V.analizaOrden('ls -l /etc; cat a | grep b > c && echo "x" &').trozos.forEach((t) => cierto(V.explicaTrozo(t).texto.length > 20, 'explicación de ' + t.texto));
});

/* ================= 2. particiones ================= */
const P = V.particiones;
const r2 = (x) => Math.round(x * 100) / 100;
const tams = (e) => e.partes.map((p) => [p.tipo, r2(p.tam)]);
prueba('particiones: los tres planes en un disco de 40 GB, en GB como el instalador', () => {
  const e = P.nuevoDisco(40, 4, 'uefi');
  igual(r2(e.disco), 42.95, 'el disco de 40 GiB son 42,95 GB');
  P.aplicaPlan(e, 'som');
  // el plan de la máquina real: sda1 1,13 GB, sda2 25,00 GB, sda3 2,00 GB y sda4 14,82 GB
  igual(e.partes.map((p) => [p.tipo, r2(p.tam), p.fs, p.montaje]), [['esp', 1.13, 'FAT32', '/boot/efi'], ['raiz', 25, 'ext4', '/'], ['swap', 2, 'swap', '[SWAP]'], ['home', 14.82, 'ext4', '/home']]);
  igual(P.libre(e), 0);
  P.aplicaPlan(e, 'defecto');
  igual(tams(e), [['esp', 1.13], ['raiz', 41.82]]);
  cierto(P.tieneSwapArchivo(e), 'swap en archivo');
  P.aplicaPlan(e, 'vacio');
  igual(e.partes.length, 0); igual(r2(P.libre(e)), 42.95);
});
prueba('particiones: lsblk igual que en la máquina real', () => {
  const e = P.aplicaPlan(P.nuevoDisco(40, 4, 'uefi'), 'som');
  igual(P.lsblk(e), [
    'NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS',
    'sda      8:0    0   40G  0 disk ',
    '├─sda1   8:1    0    1G  0 part /boot/efi',
    '├─sda2   8:2    0 23,3G  0 part /',
    '├─sda3   8:3    0  1,9G  0 part [SWAP]',
    '└─sda4   8:4    0 13,8G  0 part /home'].join('\n'));
  // las filas de sda del lsblk de la máquina Ubuntu-SOM real (Misc/capturas-ut04/txt/ubuntu-som/lsblk.txt)
  const real = ['sda 8:0 0 40G 0 disk', '├─sda1 8:1 0 1G 0 part /boot/efi', '├─sda2 8:2 0 23,3G 0 part /', '├─sda3 8:3 0 1,9G 0 part [SWAP]', '└─sda4 8:4 0 13,8G 0 part /home'];
  const mia = P.lsblk(e).split('\n').filter((l) => /sda/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim());
  igual(mia, real, 'filas de sda');
  if (fs.existsSync(MISC)) igual(mia, fs.readFileSync(path.join(MISC, 'ubuntu-som', 'lsblk.txt'), 'utf8').split('\n').filter((l) => /sda/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim()), 'lsblk.txt de la máquina real');
  igual(P.tamLsblk(0.5), '477M'); igual(P.tamLsblk(13.42), '12,5G');
});
prueba('particiones: la nota de lsblk sale con el reparto que hay', () => {
  igual(P.notaLsblk(P.aplicaPlan(P.nuevoDisco(40, 4, 'uefi'), 'som')), 'El instalador cuenta en GB y lsblk, en GiB, que son algo más grandes: los 25 GB de la raíz salen como 23,3G.');
  igual(P.notaLsblk(P.aplicaPlan(P.nuevoDisco(40, 4, 'uefi'), 'defecto')), 'El instalador cuenta en GB y lsblk, en GiB, que son algo más grandes: los 41,82 GB de la raíz salen como 39G.');
  igual(P.notaLsblk(P.aplicaPlan(P.nuevoDisco(40, 4, 'uefi'), 'vacio')), 'El instalador cuenta en GB y lsblk, en GiB, que son algo más grandes.');
});
prueba('particiones: tamaños con tope y suelo', () => {
  const e = P.aplicaPlan(P.nuevoDisco(40, 4, 'uefi'), 'som');
  cierto(!P.cambiaTam(e, 1, 30), 'sin libre no crece');
  cierto(P.cambiaTam(e, 3, 10), 'encoge /home'); igual(r2(P.libre(e)), 4.82);
  cierto(P.cambiaTam(e, 1, 99), 'crece hasta el libre'); igual(r2(e.partes[1].tam), 29.82); igual(P.libre(e), 0);
  cierto(P.cambiaTam(e, 0, 0), 'suelo'); igual(e.partes[0].tam, 0.5);
  P.cambiaTam(e, 0, 0.744); igual(e.partes[0].tam, 0.74, 'al céntimo de GB');
  igual(e.plan, 'propio');
});
prueba('particiones: añadir, quitar y cambiar de tipo', () => {
  const e = P.nuevoDisco(40, 4, 'uefi');
  const tipos = [];
  for (let i = 0; i < 4; i++) tipos.push(P.añadeParte(e).tipo);
  igual(tipos, ['esp', 'raiz', 'swap', 'home']);
  igual(tams(e), [['esp', 1.13], ['raiz', 25], ['swap', 2], ['home', 14.82]], 'lo mismo que el plan del módulo');
  igual(P.libre(e), 0); igual(P.añadeParte(e), null);
  P.quitaParte(e, 2); igual(r2(P.libre(e)), 2);
  igual(r2(P.añadeParte(e, 'otra').tam), 2);
  P.cambiaTipo(e, 3, 'swap'); igual([e.partes[3].fs, e.partes[3].montaje], ['swap', '[SWAP]']);
  const b = P.nuevoDisco(40, 4, 'bios'); igual(P.añadeParte(b).tipo, 'raiz', 'con BIOS no empieza por la ESP');
});
prueba('particiones: hechos, sin juicios', () => {
  const claves = (e) => P.hechosReparto(e).map((h) => h.k);
  const e = P.nuevoDisco(40, 4, 'uefi');
  igual(claves(e), ['sin-esp', 'sin-raiz', 'libre']);
  P.aplicaPlan(e, 'defecto'); igual(claves(e), ['swap-archivo', 'sin-home']);
  P.aplicaPlan(e, 'som'); igual(claves(e), ['home']);
  P.cambiaTam(e, 1, 20); igual(claves(e), ['raiz-pequena', 'home', 'libre']);
  P.cambiaTipo(e, 2, 'raiz'); cierto(claves(e).includes('repetido'), 'dos raíces');
  const todos = [];
  ['vacio', 'defecto', 'som'].forEach((pl) => { const x = P.aplicaPlan(P.nuevoDisco(40, 4, 'uefi'), pl); P.hechosReparto(x).forEach((h) => todos.push(h.t)); x.partes.forEach((p, i) => todos.push(...P.hechosParte(x, i))); });
  todos.forEach((t) => cierto(!/\b(bien|mal|correct|incorrect|error|mejor|peor|deberías|recomend)/i.test(t), 'juicio en: ' + t));
  todos.forEach((t) => cierto(!/\d+\.\d{3,}/.test(t) && !/\d,\d{3,}/.test(t), 'cifra sin redondear en: ' + t));
  cierto(P.hechosParte(P.aplicaPlan(P.nuevoDisco(40, 4, 'uefi'), 'som'), 0).some((t) => /no encuentra ningún cargador/.test(t)), 'ESP');
  cierto(P.hechosParte(P.aplicaPlan(P.nuevoDisco(40, 4, 'uefi'), 'som'), 0).some((t) => /1,13 GB/.test(t)), 'la ESP del instalador, 1,13 GB');
  cierto(P.hechosParte(P.aplicaPlan(P.nuevoDisco(40, 4, 'uefi'), 'som'), 1).some((t) => /al menos 25 GB/.test(t)), 'raíz');
  cierto(P.hechosParte(P.aplicaPlan(P.nuevoDisco(40, 4, 'uefi'), 'defecto'), 1).some((t) => /los datos viven dentro de \//.test(t)), '/home');
});
prueba('particiones: swap del instalador según la RAM y ESP en discos pequeños', () => {
  igual([0.5, 1, 2, 3, 4, 8, 16, 32, 64].map(P.swapArchivo), [1, 2, 2, 3, 4, 4, 8, 8, 8]);
  igual(tams(P.aplicaPlan(P.nuevoDisco(20, 4, 'uefi'), 'defecto')), [['esp', 0.56], ['raiz', 20.91]]);
  igual(P.aplicaPlan(P.nuevoDisco(40, 4, 'bios'), 'defecto').partes.map((p) => p.tipo), ['raiz']);
});

/* ================= 3. arranque ================= */
/* El menú de la máquina Ubuntu-SOM real (captura 15 de la UT4) y el de la máquina con dos sistemas (captura 18) */
const MENU_UN_SISTEMA = ['Ubuntu', 'Advanced options for Ubuntu', 'Memory test (memtest86+x64.efi)', 'Memory test (memtest86+x64.efi, serial console)', 'UEFI Firmware Settings'];
const MENU_DOS_SISTEMAS = ['Ubuntu', 'Advanced options for Ubuntu', 'Memory test (memtest86+x64.efi)', 'Memory test (memtest86+x64.efi, serial console)',
  'Ubuntu 24.04.5 LTS (24.04) (on /dev/sda2)', 'Advanced options for Ubuntu 24.04.5 LTS (24.04) (on /dev/sda2)', 'UEFI Firmware Settings'];
prueba('menú de GRUB: el grub.cfg de respaldo da las cinco entradas reales, en su orden', () => {
  const g = V.leeGrubCfg(V.grubCfgUbuntu());
  igual(g.entradas.map((e) => e.titulo), MENU_UN_SISTEMA);
  igual([g.estilo, g.espera], ['hidden', 0], 'con un sistema el menú no se ve');
  igual(V.leeGrubCfg(V.grubCfgUbuntu({ estilo: 'menu', espera: 5 })).espera, 5);
  igual(V.GRUB_TXT.cabecera, 'GNU GRUB  versión 2.12');
  igual(V.GRUB_TXT.cuenta(10), 'La entrada marcada se ejecutará automáticamente en 10 s.');
  igual(V.GRUB_TXT.ayuda, ['Use las teclas ↑ y ↓ para seleccionar la entrada marcada.', 'Pulse «Intro» para arrancar el SO seleccionado, «e» para editar las órdenes antes de arrancar o «c» para una línea de órdenes. «ESC» para volver al menú anterior.']);
});
prueba('menú de GRUB: los grub.cfg de la máquina real (uno y dos sistemas)', () => {
  if (!fs.existsSync(MISC)) { console.log('  (sin Misc/capturas-ut04: se salta)'); return; }
  const lee = (d) => V.leeGrubCfg(fs.readFileSync(path.join(MISC, d, 'grub.cfg.txt'), 'utf8'), 'efi');
  const uno = lee('ubuntu-som');
  igual(uno.entradas.map((e) => e.titulo), MENU_UN_SISTEMA);
  igual([uno.estilo, uno.espera, uno.indice, uno.quiet, uno.splash], ['hidden', 0, 0, true, true], 'un sistema: menú oculto, sin espera');
  const dos = lee('ubuntu-som-dos-sistemas');
  igual(dos.entradas.map((e) => e.titulo), MENU_DOS_SISTEMAS);
  igual([dos.estilo, dos.espera], ['menu', 10], 'dos sistemas: os-prober pone el menú y 10 s');
  igual(V.describeArranque(dos).espera, '10 segundos');
  igual(lee('ubuntu-som-dos-sistemas').entradas[5].hijos.length, 5, 'el submenú del otro sistema');
});
prueba('menú de GRUB: el del simulador de la terminal', () => {
  const g = V.estadoArranque(L.crea({}), 'efi');
  igual(g.entradas.slice(0, 2).map((e) => e.titulo), MENU_UN_SISTEMA.slice(0, 2));
  igual(g.entradas[g.entradas.length - 1].titulo, 'UEFI Firmware Settings');
});
prueba('grub.cfg de Ubuntu por defecto', () => {
  const g = V.leeGrubCfg(V.grubCfgUbuntu());
  igual([g.estilo, g.espera, g.indice, g.quiet, g.splash], ['hidden', 0, 0, true, true]);
  igual(g.entradas.map((e) => e.titulo), MENU_UN_SISTEMA);
  igual(V.leeGrubCfg(V.grubCfgUbuntu(), 'pc').entradas.map((e) => e.titulo), MENU_UN_SISTEMA.slice(0, 4), 'con BIOS no sale UEFI Firmware Settings');
  igual(g.entradas[1].hijos.length, 2);
  const d = V.describeArranque(g);
  igual([d.visible, d.espera, d.arranca, d.pantalla], [false, 'no espera', 'Ubuntu', 'con logotipo y sin mensajes']);
});
prueba('grub.cfg con el menú visible, 5 segundos y sin quiet splash', () => {
  const g = V.leeGrubCfg(V.grubCfgUbuntu({ estilo: 'menu', espera: 5, cmdline: '' }));
  igual([g.estilo, g.espera, g.quiet, g.splash], ['menu', 5, false, false]);
  igual(V.describeArranque(g).pantalla, 'con los mensajes del arranque');
  igual(V.describeArranque(V.leeGrubCfg(V.grubCfgUbuntu({ estilo: 'menu', espera: 3, cmdline: 'quiet' }))).pantalla, 'sin logotipo y casi sin mensajes');
  igual(V.leeGrubCfg(V.grubCfgUbuntu({ porDefecto: '2' })).indice, 2);
});
prueba('grub.cfg: la rama de recordfail no cuenta y un archivo escrito a mano también se lee', () => {
  const g = V.leeGrubCfg('if [ "${recordfail}" = 1 ] ; then\n  set timeout=30\nelse\n  set timeout=7\nfi\nmenuentry "Mi Linux" {\n linux /vmlinuz ro splash\n}\nmenuentry \'Otro\' {\n linux /vmlinuz ro\n}\nset default="1"\n');
  igual([g.estilo, g.espera, g.indice, g.splash, g.quiet], ['menu', 7, 1, false, false]);
  igual(g.entradas.map((e) => e.titulo), ['Mi Linux', 'Otro']);
  const v = V.leeGrubCfg('');
  cierto(v.vacio, 'vacío');
});
prueba('estado del arranque de un sistema simulado: sin grub.cfg y con el archivo cambiado', () => {
  const sis = L.crea({ fecha: '2026-11-21T09:30:00+01:00' });
  let g = V.estadoArranque(sis);
  cierto(g.porDefectoUbuntu || g.entradas.length > 0, 'lee algo');
  igual(g.estilo, 'hidden');
  igual(g.desfasado, false, 'recién instalado');
  sis.avanza(60000);
  sis.guarda('/etc/default/grub', sis.leeArchivo('/etc/default/grub').replace('GRUB_TIMEOUT_STYLE=hidden', 'GRUB_TIMEOUT_STYLE=menu'));
  g = V.estadoArranque(sis);
  igual(g.desfasado, true, 'archivo más nuevo que el menú');
  igual(g.estilo, 'hidden', 'el menú no cambia hasta fabricarlo');
  sis.avanza(60000);
  sis.guarda('/boot/grub/grub.cfg', V.grubCfgUbuntu({ estilo: 'menu', espera: 10 }));
  g = V.estadoArranque(sis);
  igual([g.desfasado, g.estilo, g.espera, g.porDefectoUbuntu], [false, 'menu', 10, false]);
  // sin /boot/grub/grub.cfg no falla
  // con el grub.cfg que trae el sistema simulado, los títulos salen tal cual están en el archivo
  const s2 = L.crea({});
  const real = V.estadoArranque(s2);
  cierto(real.entradas.length >= 1, 'lee el grub.cfg del sistema');
  // sin /boot/grub/grub.cfg no falla: enseña el de Ubuntu
  const dir = s2.fs.resuelve('/boot/grub', { uid: 0, gid: 0 }).ino;
  s2.fs.desenlaza(dir, 'grub.cfg', '/boot/grub/grub.cfg');
  const sin = V.estadoArranque(s2);
  igual([sin.porDefectoUbuntu, sin.entradas.length], [true, 5], 'sin grub.cfg: el de Ubuntu');
});
prueba('grub.cfg real de la imagen base: solo las entradas de la plataforma', () => {
  const cfg = L.crea({}).leeArchivo('/boot/grub/grub.cfg');
  cierto(cfg && /grub_platform/.test(cfg), 'el grub.cfg real tiene bloques por plataforma');
  const efi = V.leeGrubCfg(cfg, 'efi'), pc = V.leeGrubCfg(cfg, 'pc');
  igual([efi.estilo, efi.espera, efi.indice, efi.quiet, efi.splash], ['hidden', 0, 0, true, true], 'arranque normal');
  igual(efi.entradas[0].titulo, 'Ubuntu');
  igual(efi.entradas[1].titulo, 'Advanced options for Ubuntu');
  cierto(efi.entradas.some((e) => e.titulo === 'UEFI Firmware Settings'), 'con UEFI sale UEFI Firmware Settings');
  cierto(!pc.entradas.some((e) => e.titulo === 'UEFI Firmware Settings'), 'con BIOS no sale');
  // lo que esté dentro de un bloque de la otra plataforma no se cuenta
  const solo = (t, p) => V.leeGrubCfg(t, p).entradas.map((e) => e.titulo);
  const bloques = `if [ "$grub_platform" = "pc" ]; then
menuentry 'Memory test (memtest86+ia32.bin)' {
 linux /boot/memtest86+ia32.bin
}
fi
if [ "$grub_platform" = "efi" ]; then
menuentry 'Memory test (memtest86+x64.efi)' {
 linux /boot/memtest86+x64.efi
}
fi
if [ \${grub_platform} != pc ]; then
menuentry 'Solo fuera de pc' {
}
fi
`;
  igual(solo(bloques, 'efi'), ['Memory test (memtest86+x64.efi)', 'Solo fuera de pc']);
  igual(solo(bloques, 'pc'), ['Memory test (memtest86+ia32.bin)']);
  igual(V.estadoArranque(L.crea({}), 'efi').entradas.map((e) => e.titulo), efi.entradas.map((e) => e.titulo), 'la vista lee lo mismo');
});
prueba('vista: entradas resumidas, como mucho tres y «y N más»', () => {
  const e = (n) => Array.from({ length: n }, (_, i) => ({ titulo: 'E' + i }));
  igual(V.resumeEntradas(e(3)), ['E0', 'E1', 'E2']);
  igual(V.resumeEntradas(e(5)), ['E0', 'E1', 'E2', 'y 2 más']);
  igual(V.resumeEntradas([]), []);
});

/* ================= 4. anatomía de ls -l ================= */
prueba('linea: las cinco líneas de ls -l', () => {
  const F = V.formatos['ls-l'];
  F.lineas.forEach((l) => {
    const t = F.trocea(l.linea);
    cierto(t, 'trocea ' + l.linea);
    igual(t.trozos.map((x) => x.texto).join(''), l.linea, 'reconstruye la línea');
    igual(t.trozos.filter((x) => x.clave).map((x) => x.clave), ['tipo', 'permisos', 'enlaces', 'dueno', 'grupo', 'tamano', 'fecha', 'nombre']);
    t.trozos.filter((x) => x.clave).forEach((x) => cierto(F.campos.find((c) => c.clave === x.clave).explica(x.texto, t.ctx).length > 10, 'explica ' + x.clave));
  });
  const p = F.trocea('-rw-r--r-- 1 alumno alumno 807 nov 21 10:02 .profile');
  igual(p.trozos.filter((x) => x.clave).map((x) => x.texto), ['-', 'rw-r--r--', '1', 'alumno', 'alumno', '807', 'nov 21 10:02', '.profile']);
  const ex = (k) => F.campos.find((c) => c.clave === k).explica(p.trozos.find((x) => x.clave === k).texto, p.ctx);
  cierto(/^el tipo: - es un archivo; d, un directorio\./.test(ex('tipo')), 'tipo');
  cierto(/^los permisos: quién puede leer \(r\), escribir \(w\) y ejecutar \(x\)\./.test(ex('permisos')), 'permisos');
  igual(ex('nombre'), 'el nombre. El punto lo hace oculto.');
  const e = F.trocea('lrwxrwxrwx 1 root root 7 abr 22  2024 /bin -> usr/bin');
  igual(e.ctx.destino, 'usr/bin');
  cierto(/más de seis meses/.test(F.campos.find((c) => c.clave === 'fecha').explica('abr 22  2024', e.ctx)), 'año');
  cierto(F.trocea('esto no es ls') === null, 'no trocea otra cosa');
});
prueba('linea: las líneas coinciden con lo que saca ls -l en el simulador', () => {
  const sh = L.crea({}).sesion();
  const sin = (t) => t.replace(/\x1b\[[0-9;]*m/g, '');
  const F = V.formatos['ls-l'];
  ['/bin', '/usr/bin/uname'].forEach((r) => {
    const s = sin(sh.ejecuta('ls -l ' + r).stdout).trim();
    const mia = F.lineas.find((l) => l.linea.includes(r + ' ') || l.linea.endsWith(r)).linea;
    igual(mia.replace(/\s+/g, ' '), s.replace(/\s+/g, ' '), r);
  });
});

/* ================= 5. generadores con semillas ================= */
function revisaRejilla(g, nombre) {
  cierto(g.tarea && /⟪.+⟫/.test(g.tarea), nombre + ': tarea con verbo');
  cierto(g.enunciado, nombre + ': enunciado');
  cierto(g.variante !== undefined && g.variantes > 0, nombre + ': variante');
  cierto(typeof g.correcto === 'string' && !/undefined|NaN/.test(g.correcto), nombre + ': correcto');
  let casillas = 0;
  g.filas.forEach((f) => {
    if (f.linea) return;
    f.forEach((it) => {
      ['d', 'lbl', 'expl'].forEach((k) => { if (it[k] !== undefined) cierto(!/undefined|NaN|\[object/.test(String(it[k])), `${nombre}: ${k} = ${it[k]}`); });
      if (it.sel) {
        casillas++;
        cierto(it.sel.includes(it.c), `${nombre}: la respuesta ${it.c} no está en el selector`);
        cierto(!it.cmp || it.cmp(it.c), `${nombre}: cmp no acepta su respuesta`);
        cierto(it.sel[0] === '?', nombre + ': empieza por ?');
        cierto(new Set(it.sel).size === it.sel.length, nombre + ': opciones repetidas');
        cierto(it.expl, nombre + ': explicación');
      } else if (it.c !== undefined) {
        casillas++;
        cierto(it.filtro, nombre + ': filtro');
        igual(String(it.c).replace(it.filtro, ''), String(it.c), nombre + ': el filtro borra la respuesta');
        cierto(String(it.c).length <= (it.max || 1), nombre + ': cabe en max');
        cierto(it.expl, nombre + ': explicación');
      }
    });
  });
  cierto(casillas > 0, nombre + ': sin casillas');
}
prueba(`version-nucleo: ${SEMILLAS} semillas en cada modo`, () => {
  const G = SOM.generadores['version-nucleo'];
  cierto(G && G.rejilla, 'registrado en SOM.generadores');
  const vistas = new Set(), variantes = new Set();
  [null, 'uname', 'proc'].forEach((modo) => {
    for (let s = 1; s <= SEMILLAS; s++) {
      const g = conSemilla(s * 7919 + (modo ? modo.length : 0), () => G.generar(modo ? { modo } : {}));
      revisaRejilla(g, `version-nucleo ${modo} ${s}`);
      const [ordenEscrita, salida] = g.filas[0][1].d.split('\n');
      const m = salida.match(/(\d+)\.(\d+)\.(\d+)-(\d+)-(generic|lowlatency|oem)/);
      cierto(m, 'versión en la salida: ' + salida);
      const cs = g.filas.filter((f) => Array.isArray(f)).flat().filter((it) => it.c !== undefined).map((it) => String(it.c));
      igual(cs, [m[1], m[2], m[3], m[4], m[5]], 'casillas = partes de ' + m[0]);
      if (/proc/.test(ordenEscrita)) {
        cierto(/^Linux version \S+ \(buildd@lcy02-amd64-0\d\d\) \(x86_64-linux-gnu-gcc-13 .+\) #\S+ SMP PREEMPT_DYNAMIC (Sun|Mon|Tue|Wed|Thu|Fri|Sat) [A-Z][a-z]{2} [ \d]\d \d\d:\d\d:\d\d UTC 2\d{0,3}$/.test(salida), 'formato de /proc/version: ' + salida);
        // la versión (#… y la fecha) va en 64 caracteres como mucho: en los HWE se corta el año, como en la máquina real
        const uts = salida.slice(salida.indexOf(') #') + 2);
        cierto(uts.length <= 64, 'como mucho 64 caracteres: ' + uts);
        if (/~24\.04/.test(uts)) cierto(/UTC 2$/.test(uts), 'HWE: acaba en «UTC 2»: ' + uts);
        const f = salida.match(/(\w{3}) (\w{3}) +(\d+) [\d:]+ UTC (\d{4})$/);
        if (f) {
          const d = new Date(Date.UTC(+f[4], ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(f[2]), +f[3]));
          igual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()], f[1], 'día de la semana de ' + f.slice(2).join(' '));
        }
      } else igual(salida, m[0], 'uname -r da solo la versión');
      if (m[5] === 'oem') cierto(+m[4] >= 1000 && m[1] + '.' + m[2] === '6.8', 'oem: 6.8.0-10xx');
      if (m[5] === 'lowlatency') igual(m[1] + '.' + m[2], '6.8', 'lowlatency solo en 6.8');
      vistas.add(m[1] + '.' + m[2] + '-' + m[5]);
      variantes.add(g.variante);
    }
  });
  igual([...vistas].sort(), ['6.17-generic', '6.8-generic', '6.8-lowlatency', '6.8-oem', '7.0-generic'], 'salen todas las series y variantes');
  cierto(variantes.size >= 8, 'variantes para rotar: ' + variantes.size);
});
prueba(`distro: ${SEMILLAS} semillas en cada modo, todo sacado de la tabla`, () => {
  const G = SOM.generadores.distro;
  cierto(G && G.rejilla, 'registrado en SOM.generadores');
  const nombres = new Set(), casos = new Set();
  const por = (n) => V.DISTROS.find((x) => x.n === n);
  [null, 'datos', 'caso'].forEach((modo) => {
    for (let s = 1; s <= SEMILLAS; s++) {
      const g = conSemilla(s * 104729 + (modo ? modo.length : 3), () => G.generar(modo ? { modo } : {}));
      revisaRejilla(g, `distro ${modo} ${s}`);
      if (g.filas.length === 4) {
        const d = por(g.filas[0][1].d);
        cierto(d, 'la distribución está en la tabla');
        nombres.add(d.n);
        const [fam, paq, quien] = [1, 2, 3].map((k) => g.filas[k][1]);
        igual([fam.c, paq.c], [d.fam, d.paq], 'familia y paquete de la tabla');
        d.quien.forEach((q) => cierto(quien.cmp(q), 'acepta ' + q));
        quien.sel.filter((q) => q !== '?' && !d.quien.includes(q)).forEach((q) => cierto(!quien.cmp(q), 'no acepta ' + q));
      } else {
        // un caso es uno de los casos de una fila de la tabla; valen esa distribución y sus iguales
        const t = g.filas[0][1].d;
        const c = V.CASOS_DISTRO.find((x) => x.t === t);
        cierto(c, 'el caso está en la tabla: ' + t);
        const d = c.d;
        casos.add(c.k);
        const ok = [d.n].concat(d.iguales || []);
        const it = g.filas[2][1];
        igual(it.sel.length, 6, 'cinco opciones');
        igual(g.filas[1][1].d, it.sel.slice(1).join(' · '), 'las opciones a la vista son las del selector');
        it.sel.slice(1).forEach((o) => cierto(por(o), 'la opción está en la tabla: ' + o));
        ok.forEach((o) => { cierto(it.sel.includes(o), 'opción buena en el selector: ' + o); cierto(it.cmp(o), 'acepta ' + o); });
        it.sel.filter((o) => o !== '?' && !ok.includes(o)).forEach((o) => {
          cierto(!it.cmp(o), 'no acepta ' + o);
          // sin casos ambiguos: nunca sale una que se parece a la buena (en las dos direcciones)
          cierto(!(d.parecidas || []).includes(o) && !(por(o).parecidas || []).includes(d.n), `no salen juntas ${d.n} y ${o}`);
          ok.forEach((b) => cierto(!(por(b).parecidas || []).includes(o) && !(por(o).parecidas || []).includes(b), `no salen juntas ${b} y ${o}`));
        });
      }
    }
  });
  igual(nombres.size, V.DISTROS.length, 'salen todas las distribuciones');
  igual(casos.size, V.CASOS_DISTRO.length, 'salen todos los casos');
});
prueba('distro: los casos no dan la respuesta ni copian la tabla', () => {
  // palabras en minúscula y sin tildes, para comparar
  const pal = (t) => t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[a-z0-9]+/g) || [];
  const tramos = (t, n) => { const p = pal(t), r = new Set(); for (let i = 0; i + n <= p.length; i++) r.add(p.slice(i, i + n).join(' ')); return r; };
  cierto(V.CASOS_DISTRO.length >= 12, 'casos: ' + V.CASOS_DISTRO.length);
  V.CASOS_DISTRO.forEach(({ d, t }) => {
    const ok = [d.n].concat(d.iguales || []);
    // no nombra ninguna de las que valen (como palabra entera: «Ubuntu» no nombra Kubuntu)
    ok.forEach((n) => cierto(!new RegExp('(^|[^\\p{L}])' + n.replace(/ /g, '\\s+') + '($|[^\\p{L}])', 'iu').test(t), `el caso nombra ${n}: ${t}`));
    // no copia su frase «para qué se usa»: ningún tramo de cuatro palabras seguidas en común
    const comun = [...tramos(t, 4)].filter((x) => tramos(d.uso, 4).has(x));
    igual(comun, [], `el caso copia la frase de ${d.n}`);
    // frases completas: empieza en mayúscula y acaba en punto
    cierto(/^[A-ZÁÉÍÓÚÑ]/.test(t) && /\.$/.test(t), 'frase completa: ' + t);
    // una distribución que se nombra en el caso no puede ser una opción que despiste por el nombre: ha de ser parecida
    V.DISTROS.filter((x) => !ok.includes(x.n) && new RegExp('(^|[^\\p{L}])' + x.n + '($|[^\\p{L}])', 'u').test(t))
      .forEach((x) => cierto((d.parecidas || []).includes(x.n) || (x.parecidas || []).includes(d.n), `el caso de ${d.n} nombra ${x.n}, que puede salir como opción`));
  });
  // las que no tienen casos son las que comparten su uso con otra
  igual(V.DISTROS.filter((x) => !(x.casos || []).length).map((x) => x.n), ['Linux Mint', 'CentOS Stream']);
});
prueba('distro: la tabla de las diapositivas 32 a 34', () => {
  const d = (n) => V.DISTROS.find((x) => x.n === n);
  igual([d('Ubuntu').fam, d('Ubuntu').paq, d('Ubuntu').quien], ['Debian', '.deb con apt', ['una empresa']]);
  igual([d('Kali').fam, d('Fedora').fam, d('Manjaro').fam, d('Lubuntu').fam], ['Debian', 'Red Hat', 'Arch', 'Debian']);
  igual(d('Red Hat Enterprise Linux').paq, '.rpm con dnf');
  igual(d('Gentoo').paq, 'compila en tu equipo');
  igual(d('Slackware').paq, 'paquetes .txz');
  igual(d('Ubuntu').uso, 'Ordenadores de casa, de aula y de oficina; tiene versiones con cinco años de soporte.');
  igual(d('Slackware').uso, 'Equipos de quien quiere un sistema sencillo y configurarlo a mano; es la más antigua de las que siguen vivas.');
  // los escritorios solo cuentan si la frase lo dice
  cierto(/KDE Plasma/.test(d('Kubuntu').uso) && /ligero/.test(d('Xubuntu').uso) && /ligero/.test(d('Lubuntu').uso), 'escritorios en la frase');
  V.DISTROS.forEach((x) => {
    ['n', 'fam', 'paq', 'mantiene', 'uso'].forEach((k) => cierto(x[k] && typeof x[k] === 'string', `${x.n}: ${k}`));
    cierto(x.uso.length <= 110, 'frase corta: ' + x.uso);
    cierto(/una empresa/.test(x.mantiene) === x.quien.includes('una empresa') || x.quien.length === 2, `${x.n}: quién la mantiene cuadra con su texto`);
    (x.iguales || []).concat(x.parecidas || []).forEach((o) => cierto(d(o), `${x.n}: ${o} está en la tabla`));
    (x.iguales || []).forEach((o) => cierto((d(o).iguales || []).includes(x.n), `${x.n} y ${o}: iguales en las dos direcciones`));
  });
});
prueba('rota: varios del mismo tipo no se repiten en la hoja', () => {
  const G = SOM.generadores.distro;
  const lista = conSemilla(5, () => (SOM.rota ? SOM.rota(6, (j, k) => { const g = G.generar({ modo: 'caso' }); return { g, clave: g.variante, total: g.variantes }; }) : []));
  if (lista.length) igual(new Set(lista.map((g) => g.filas[0][1].d)).size, 6);
});
prueba('hoja: textos como las diapositivas (uname -m, GRUB y plan)', () => {
  const G = SOM.generadores;
  let visto = 0;
  for (let s = 1; s <= 200; s++) ['salida', 'orden'].forEach((modo) => {
    const g = conSemilla(s, () => G.uname.generar({ modo }));
    const it = g.filas.flat().find((x) => x.n === 0);
    if (/-m$/.test(it.c)) {
      visto++;
      igual(it.sol, it.c + ' (valen también -p e -i)', 'solucionario de -m');
      cierto(it.cmp(it.c.replace('-m', '-p')) && it.cmp(it.c.replace('-m', '-i')), 'acepta -p e -i');
      cierto(/También valen -p e -i/.test(g.correcto), 'la solución lo dice');
    } else cierto(!it.sol || it.sol === it.c, 'sin añadido: ' + it.c);
  });
  cierto(visto > 0, 'sale -m');
  const gr = conSemilla(3, () => G.grub.generar({}));
  cierto(/quiet: sin mensajes\. splash: con logotipo\./.test(gr.enunciado), 'quiet y splash por separado');
  cierto(!/con quiet splash, logotipo/.test(JSON.stringify(gr, (k, v) => (typeof v === 'function' ? undefined : v))), 'sin la redacción antigua');
  const pl = conSemilla(3, () => G['plan-instalacion'].generar({}));
  const ap = pl.filas.filter((f) => Array.isArray(f) && f[1] && /lvis-apartado/.test(f[1].clase || '')).map((f) => f[1].d);
  igual(ap, ['El sistema y la versión, y por qué.', 'Si sirve el equipo, requisito por requisito.', 'Cómo se va a instalar.', 'Las particiones: tamaño, sistema de archivos y punto de montaje.',
    'Los parámetros: idioma, teclado, usuario, equipo y huso horario.', 'Qué se hace antes y después de instalar.', 'Licencias: qué programas propietarios se van a instalar y con qué condiciones.'], 'los siete apartados de la diapositiva 50');
});

/* ================= 6. los generadores de la UT4 con los tipos y la cuenta de la antigua hoja en papel =================
 * (ut04/hoja.html ya no existe: la sustituye «Practica Linux». Se mantiene la prueba porque los generadores siguen en
 * som.js.) */
// SOM.rota de som.js (la hoja la usa para que varios del mismo tipo no se repitan); som.js no se carga en Node
function rota(n, saca) {
  const usadas = new Set(), lista = [];
  let ultima;
  for (let j = 0; j < n; j++) {
    let r = saca(j, 0);
    if (r.clave !== undefined && r.total > 1) {
      if (usadas.size >= r.total) usadas.clear();
      const repite = (x) => usadas.has(x.clave) || (!usadas.size && x.clave === ultima);
      for (let k = 1; repite(r) && k <= 500; k++) r = saca(j, k);
      usadas.add(r.clave); ultima = r.clave;
    }
    lista.push(r.g);
  }
  return lista;
}
// los tipos y su cuenta, como estaban en la antigua hoja de la UT4
const HOJA = [['nucleo', 'version-nucleo', null, 2], ['uname', 'uname', null, 2], ['distro', 'distro', 'datos', 2], ['caso', 'distro', 'caso', 1],
  ['grub', 'grub', null, 1], ['plan', 'plan-instalacion', null, 1], ['terminal', 'tareas-terminal', null, 1]];
const hashH = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) % 997; };
function hojaUT4(semilla, titulo) {
  const ht = hashH(titulo);
  const out = {};
  HOJA.forEach(([k, gen, modo, n]) => {
    const seed = semilla * 1000003 + ht * 1009 + hashH(k) * 101;
    out[k] = rota(n, (j, kk) => conSemilla(seed + j + kk * 7919, () => { const g = SOM.generadores[gen].generar(modo ? { modo } : {}); return { g, clave: g.variante, total: g.variantes }; }));
  });
  return out;
}
const texto = (g) => JSON.stringify(g, (k, v) => (typeof v === 'function' ? undefined : v instanceof RegExp ? String(v) : v));
prueba('hoja: la misma semilla da la misma hoja; otra semilla, otra', () => {
  const a = texto(hojaUT4(17, 'UT4 · Linux: instalación de Ubuntu')), b = texto(hojaUT4(17, 'UT4 · Linux: instalación de Ubuntu'));
  igual(a, b, 'misma semilla');
  cierto(a !== texto(hojaUT4(18, 'UT4 · Linux: instalación de Ubuntu')), 'otra semilla');
  cierto(a !== texto(hojaUT4(17, 'Otra hoja')), 'otro título');
});
prueba(`hoja: ${SEMILLAS} semillas sin casos imposibles ni repetidos dentro de la hoja`, () => {
  for (let s = 1; s <= SEMILLAS; s++) {
    const h = hojaUT4(s, 'UT4 · Linux: instalación de Ubuntu');
    ['nucleo', 'uname', 'distro', 'caso', 'grub'].forEach((k) => h[k].forEach((g, i) => revisaRejilla(g, `hoja ${s} ${k} ${i}`)));
    igual(new Set(h.nucleo.map((g) => g.filas[0][1].d)).size, 2, 'dos núcleos distintos');
    igual(new Set(h.uname.map((g) => g.variante)).size, 2, 'uname: una salida y una orden');
    igual(new Set(h.distro.map((g) => g.filas[0][1].d)).size, 2, 'dos distribuciones distintas');
    // GRUB: el cambio pedido no es lo que ya dice el archivo
    const gr = h.grub[0], archivo = gr.filas[0][1].d, linea = gr.filas.filter(Array.isArray).flat().find((it) => it.n === 3).c;
    cierto(!archivo.split('\n').includes(linea), `semilla ${s}: el cambio ${linea} ya está en el archivo`);
    // plan: el caso y los siete apartados con sitio para escribir
    const pl = h.plan[0];
    igual(pl.filas.filter((f) => Array.isArray(f) && f[1] && /lvis-renglones/.test(f[1].clase || '')).length, 7, 'siete apartados con renglones');
    // tareas de terminal: numeradas del 1 al final, sin repetir ninguna y cada una con su solución
    const bl = h.terminal[0].bloques;
    igual(bl.length, 2, 'dos bloques');
    const nums = [], textos = [];
    bl.forEach((b) => b.filas.forEach((f) => { if (/^\d+\.$/.test(f[0].lbl)) { nums.push(+f[0].lbl.slice(0, -1)); textos.push(f[1].d); } }));
    igual(nums, nums.map((x, i) => i + 1), 'numeradas seguidas');
    igual(new Set(textos).size, textos.length, `semilla ${s}: tareas repetidas`);
    cierto(nums.length >= 12 && nums.length <= 16, 'entre 12 y 16 tareas: ' + nums.length);
    const sols = bl.map((b) => b.correcto).join('\n').split('\n').filter((l) => /^\d+\. /.test(l));
    igual(sols.length, nums.length, 'una solución por tarea');
    sols.forEach((l) => cierto(!/undefined|\[object/.test(l) && l.length > 4, 'solución: ' + l));
    textos.forEach((t) => { cierto(/⟪[^⟫]+⟫/.test(t), 'verbo marcado: ' + t); cierto(!/<\/?[a-z]/.test(t), 'sin HTML: ' + t); });
    // ninguna tarea que necesite lo que solo existe en el simulador (otro usuario conectado, archivos de la misión) ni cambiar la contraseña
    textos.forEach((t) => cierto(!/ha iniciado sesión|está usando|líneas|última palabra|contraseña/.test(t), `semilla ${s}: tarea que no se puede hacer en la máquina: ${t}`));
    cierto(/exit/.test(bl[1].correcto.split('\n').pop()), 'acaba saliendo de la terminal');
  }
});
prueba('hoja: uname con los datos de la máquina real y GRUB con sus cuatro variables', () => {
  const G = SOM.generadores;
  const vistos = new Set();
  for (let s = 1; s <= 200; s++) {
    const g = conSemilla(s, () => G.uname.generar({ modo: 'salida' }));
    const sal = g.filas[0][1].d.split('\n')[1];
    if (/7\.0\.0-43-generic/.test(sal) || /UTC 2/.test(sal)) cierto(/^(7\.0\.0-43-generic|#43~24\.04\.1-Ubuntu SMP PREEMPT_DYNAMIC Sat Oct 31 06:52:47 UTC 2|Linux som-\w+ 7\.0\.0-43-generic #43~24\.04\.1-Ubuntu SMP PREEMPT_DYNAMIC Sat Oct 31 06:52:47 UTC 2 x86_64 x86_64 x86_64 GNU\/Linux)$/.test(sal), 'salida real: ' + sal);
    const op = g.filas[1][1];
    cierto(op.cmp(op.c) && op.cmp('--' + ({ s: 'kernel-name', n: 'nodename', r: 'kernel-release', v: 'kernel-version', m: 'machine', o: 'operating-system', a: 'all' })[op.c.slice(1)]), 'corta y larga');
    vistos.add(op.c);
    const o = conSemilla(s, () => G.uname.generar({ modo: 'orden' })).filas[0][1];
    cierto(o.cmp(o.c) && o.cmp(o.c.replace(' ', '  ')) && !o.cmp('uname'), 'orden: ' + o.c);
    const gr = conSemilla(s, () => G.grub.generar({}));
    const vars = gr.filas[0][1].d.split('\n').filter((l) => !l.startsWith('#')).map((l) => l.split('=')[0]);
    igual(vars, ['GRUB_DEFAULT', 'GRUB_TIMEOUT_STYLE', 'GRUB_TIMEOUT', 'GRUB_CMDLINE_LINUX_DEFAULT']);
    const resp = gr.filas.filter(Array.isArray).flat().filter((it) => it.n !== undefined).sort((a, b) => a.n - b.n).map((it) => it.c);
    const est = gr.filas[0][1].d.match(/STYLE=(\w+)/)[1], esp = gr.filas[0][1].d.match(/TIMEOUT=(\d+)/)[1], q = /"quiet splash"/.test(gr.filas[0][1].d);
    igual(resp.slice(0, 3), [est === 'menu' ? 'sí' : 'no', esp, q ? 'no' : 'sí'], 'respuestas del archivo');
    cierto(est === 'hidden' ? esp === '0' : +esp >= 3, 'el menú visible espera al menos 3 s');
    cierto(gr.filas.filter(Array.isArray).flat().find((it) => it.n === 4).cmp('sudo update-grub'), 'sudo update-grub');
  }
  igual([...vistos].sort(), ['-a', '-m', '-n', '-r', '-s', '-v'], 'salen todas las opciones, sin -o (se busca en el manual)');
});

console.log(`${bien} de ${total} pruebas bien.`);
if (fallos.length) { console.log(fallos.map((f) => '  ✗ ' + f).join('\n')); process.exitCode = 1; }
