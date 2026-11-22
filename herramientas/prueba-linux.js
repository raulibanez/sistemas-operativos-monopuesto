/* Pruebas del simulador de Linux (núcleo, intérprete, órdenes y misiones), en Node:
 *
 *   node herramientas/prueba-linux.js          todas
 *   node herramientas/prueba-linux.js rapido   sin las 300 semillas por misión ni la comparación con la Ubuntu real
 *
 * Tres bloques: unidad (intérprete y órdenes), misiones (cada una resuelta con su solución en 300 semillas: sin
 * resolver no pasa ninguna tarea; resuelta, pasan todas) y fidelidad (linux-real.json, grabado en una Ubuntu
 * 24.04 real con linux-graba-real.js). */
'use strict';
const path = require('path');
const A = path.join(__dirname, '..', 'assets');
['linux-datos.js', 'linux.js', 'linux-bash.js', 'linux-ordenes.js', 'linux-sistema.js', 'linux-ut4.js', 'linux-misiones.js', 'linux-misiones-ut4.js', 'linux-ayuda.js'].forEach((f) => require(path.join(A, f)));
const L = globalThis.SOM.linux;
const rapido = process.argv.includes('rapido');

let total = 0, bien = 0;
const fallos = [];
function prueba(nombre, f) {
  total++;
  try { f(); bien++; } catch (e) { fallos.push(nombre + ': ' + (e && e.message)); }
}
function igual(a, b, msg) { if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperaba ${JSON.stringify(b)} y salió ${JSON.stringify(a)}`); }
function cierto(v, msg) { if (!v) throw new Error(msg || 'no se cumple'); }
const FECHA = '2026-11-21T09:30:00+01:00';
const nuevo = (esc) => { const sis = L.crea(Object.assign({ fecha: FECHA }, esc || {})); return { sis, sh: sis.sesion() }; };
const sinColor = (t) => t.replace(/\x1b\[[0-9;]*m|\x1b\[K/g, '');
// ejecuta varias líneas y devuelve la última respuesta
function corre(sh, lineas, opc) { let r; (Array.isArray(lineas) ? lineas : [lineas]).forEach((l) => { r = sh.ejecuta(l, opc); }); return r; }

/* ================= unidad: analizador ================= */
prueba('árbol: tubería con redirección', () => {
  const a = L.analiza('cat a.txt | grep -v x > out 2>&1 && echo ok');
  const yo = a.items[0].nodo;
  igual(yo.tipo, 'y_o'); igual(yo.resto[0].op, '&&');
  const t = yo.primero;
  igual(t.ordenes.length, 2);
  igual(t.ordenes[1].redirs.length, 2);
  igual(t.ordenes[1].redirs[1].op, '>&'); igual(t.ordenes[1].redirs[1].fd, 2);
});
prueba('árbol: comillas y partes', () => {
  const w = L.analiza(`echo "a $HOME $(pwd) $((1+2))" 'b $x' c\\ d`).items[0].nodo.primero.ordenes[0].palabras;
  igual(w.length, 4);
  igual(w[1].partes[0].t, 'dq');
  igual(w[1].partes[0].partes.map((p) => p.t).join(','), 'lit,var,lit,sub,lit,arit');
  igual(w[2].partes[0].t, 'sq');
  igual(w[3].partes[1].t, 'esc');
});
prueba('árbol: if, for, while y funciones', () => {
  const a = L.analiza('if true; then echo s; else echo n; fi; for x in a b; do echo $x; done; while false; do :; done; f() { echo f; }');
  igual(a.items.map((i) => i.nodo.primero.ordenes[0].tipo).join(','), 'si,para,mientras,funcion');
});
prueba('árbol: incompletos', () => {
  ['echo "a', "echo 'a", 'echo a |', 'echo a &&', 'echo $(ls', 'if true; then'].forEach((t) => {
    let inc = false; try { L.analiza(t); } catch (e) { inc = e instanceof L.Incompleto; }
    cierto(inc, 'debería estar incompleto: ' + t);
  });
});
prueba('árbol: errores de sintaxis', () => {
  [['echo a ;; b', ';;'], ['| echo', '|'], ['echo a | | b', '|'], ['echo )', ')'], ['ls; then', 'then']].forEach(([t, tok]) => {
    let e = null; try { L.analiza(t); } catch (x) { e = x; }
    cierto(e instanceof L.ErrorSintaxis, 'sin error: ' + t); igual(e.token, tok, t);
  });
});

/* ================= unidad: expansiones ================= */
const ex = (linea, esc) => { const { sh } = nuevo(esc); return corre(sh, linea).stdout; };
prueba('echo con comillas, escapes y variables', () => {
  igual(ex(`echo '$HOME' "$HOME" \\$HOME`), '$HOME /home/alumno $HOME\n');
  igual(ex('echo a\\ \\ b "c  d" e'), 'a  b c  d e\n');
  igual(ex('x=5; echo ${x}y "$x" ${z:-def} ${#x}'), '5y 5 def 1\n');
  igual(ex('f=resumen.csv; echo ${f%.csv} ${f#res} ${f/csv/txt}'), 'resumen umen.csv resumen.txt\n');
});
prueba('aritmética', () => {
  igual(ex('echo $((3+4*2)) $((10/3)) $((10%3)) $((2**10)) $((-7/2)) $(( (2+3)*4 ))'), '11 3 1 1024 -3 20\n');
  igual(ex('n=4; echo $((n*n)) $((n > 3)) $((n++)) $n'), '16 1 4 5\n');
  const { sh } = nuevo(); const r = corre(sh, 'echo $((1/0)); echo sigue');
  igual(r.stderr, 'bash: 1/0: división por 0 (el elemento de error es "0")\n'); igual(r.stdout, '');
});
prueba('llaves, tilde y comodines', () => {
  igual(ex('echo {a,b,c}.txt x{1..3} {5..1} {a..e} {01..03} {1..10..3}'), 'a.txt b.txt c.txt x1 x2 x3 5 4 3 2 1 a b c d e 01 02 03 1 4 7 10\n');
  igual(ex('echo ~ ~/x ~root ~noexiste'), '/home/alumno /home/alumno/x /root ~noexiste\n');
  const esc = { archivos: { '~/t/a.txt': '', '~/t/b.txt': '', '~/t/c.csv': '', '~/t/.oculto': '' }, cwd: '~/t' };
  igual(ex('echo *.txt ?.csv [ab].txt [^a].txt *.zzz', esc), 'a.txt b.txt c.csv a.txt b.txt b.txt *.zzz\n');
  // en una terminal interactiva, ! dentro de [ ] es una expansión del historial (como en bash)
  igual(nuevo(esc).sh.ejecuta('echo [!a].txt').stderr, 'bash: !a].txt: event not found\n');
  igual(ex('echo * .*', esc), 'a.txt b.txt c.csv .oculto\n');   // bash 5.2: globskipdots, .* no casa con . ni ..
  igual(ex('echo "*.txt" \\*.txt', esc), '*.txt *.txt\n');
  igual(sinColor(ex('ls -d /us*/b*')), '/usr/bin\n');
});
prueba('sustitución de órdenes y partición en campos', () => {
  igual(ex('echo $(echo uno) `echo dos` "$(printf "a  b")"'), 'uno dos a  b\n');
  igual(ex('x="a  b   c"; for i in $x; do echo "[$i]"; done'), '[a]\n[b]\n[c]\n');
  igual(ex('x=""; echo [$x] ["$x"]'), '[] []\n');
});
prueba('$? y && ||', () => {
  igual(ex('false; echo $?; true; echo $?; ls /noexiste 2>/dev/null; echo $?'), '1\n0\n2\n');
  igual(ex('true && echo si || echo no; false && echo si || echo no'), 'si\nno\n');
});

/* ================= unidad: redirecciones y tuberías ================= */
prueba('redirecciones > >> 2> 2>&1 < /dev/null', () => {
  const { sh, sis } = nuevo();
  corre(sh, ['echo uno > f', 'echo dos >> f', 'ls noexiste 2> err', 'ls f noexiste > todo 2>&1', 'wc -l < f > n', 'echo x > /dev/null']);
  igual(sis.leeArchivo('~/f'), 'uno\ndos\n');
  igual(sis.leeArchivo('~/err'), "ls: no se puede acceder a 'noexiste': No existe el archivo o el directorio\n");
  igual(sis.leeArchivo('~/todo'), "ls: no se puede acceder a 'noexiste': No existe el archivo o el directorio\nf\n");
  igual(sis.leeArchivo('~/n'), '2\n');
  igual(corre(sh, 'echo x > /root/y').stderr, 'bash: /root/y: Permiso denegado\n');
});
prueba('tubería y traza de cada tramo', () => {
  const { sh } = nuevo({ archivos: { '~/d.csv': 'Mes,Vendedor\nEnero,ana\nEnero,luis\nFebrero,ana\n' } });
  const r = corre(sh, 'cat d.csv | grep ana | wc -l');
  igual(r.stdout, '2\n');
  igual(r.trazas.length, 1);
  const t = r.trazas[0].tramos;
  igual(t.length, 3);
  igual(t[0].salida, 'Mes,Vendedor\nEnero,ana\nEnero,luis\nFebrero,ana\n');
  igual(sinColor(t[1].salida), 'Enero,ana\nFebrero,ana\n');
  igual(t[2].salida, '2\n');
});
prueba('cambios del sistema de archivos tras cada orden', () => {
  const { sh } = nuevo();
  const r = corre(sh, 'mkdir -p a/b; touch a/f; rm a/f');
  const tipos = r.cambios.map((c) => c.tipo + ' ' + c.ruta);
  cierto(tipos.includes('crea /home/alumno/a'), tipos.join('; '));
  cierto(tipos.includes('crea /home/alumno/a/b'));
  cierto(tipos.includes('borra /home/alumno/a/f'));
});

/* ================= unidad: alias, historial y la sesión ================= */
prueba('alias e historial', () => {
  const { sh } = nuevo();
  igual(sinColor(corre(sh, 'alias ll').stdout), "alias ll='ls -alF'\n");
  corre(sh, ['alias hola="echo hola mundo"']);
  igual(corre(sh, 'hola').stdout, 'hola mundo\n');
  corre(sh, 'unalias hola');
  igual(corre(sh, 'hola').stderr, 'hola: no se encontró la orden\n');
  corre(sh, ['echo uno', 'echo dos']);
  const r = corre(sh, '!!');
  igual(r.stdout, 'echo dos\ndos\n');
  igual(corre(sh, '!zz').stderr, 'bash: !zz: event not found\n');
  corre(sh, 'history -c');
  igual(corre(sh, 'history').stdout, '    1  history\n');
});
prueba('cd, pwd y OLDPWD', () => {
  const { sh } = nuevo();
  igual(corre(sh, 'cd /tmp; pwd; cd -; cd ..; pwd').stdout, '/tmp\n/home/alumno\n/home\n');
  igual(corre(sh, 'cd /bin; pwd; pwd -P').stdout, '/bin\n/usr/bin\n');
  igual(corre(sh, 'cd /root').stderr, 'bash: cd: /root: Permiso denegado\n');
  igual(corre(sh, 'cd noexiste').stderr, 'bash: cd: noexiste: No existe el archivo o el directorio\n');
  igual(corre(sh, 'cd a b').stderr, 'bash: cd: demasiados argumentos\n');
});
prueba('prompt de Ubuntu', () => {
  const { sh } = nuevo();
  igual(sh.prompt(), '\x1b]0;alumno@som: ~\x07\x1b[01;32malumno@som\x1b[00m:\x1b[01;34m~\x1b[00m$ ');
  corre(sh, 'cd /etc');
  cierto(sh.prompt().includes('\x1b[01;34m/etc'));
});
prueba('command-not-found y órdenes que el simulador no tiene', () => {
  const { sh } = nuevo();
  igual(corre(sh, 'tree').stderr, 'No se ha encontrado la orden «tree», pero se puede instalar con:\nsudo apt install tree\n');
  igual(corre(sh, 'cal').stderr, 'No se ha encontrado la orden «cal», pero se puede instalar con:\nsudo apt install ncal\n');
  const r = corre(sh, 'journalctl -b');
  igual(r.codigo, 127); cierto(r.avisos.length === 1 && /no sabe ejecutar|no tiene/.test(r.avisos[0]), r.avisos.join());
  // las erratas copiadas de la máquina real dan el mensaje real; las demás, el genérico y un aviso
  igual(corre(sh, 'mkdri x').stderr, 'Orden «mkdri» no encontrada. Quizá quiso decir:\n  la orden «mkdir» del paquete deb «coreutils (9.4-3ubuntu6.2)»\nPruebe con: sudo apt install <nombre del paquete deb>\n');
  const r2 = corre(sh, 'mkdirr x');
  igual(r2.stderr, 'mkdirr: no se encontró la orden\n'); cierto(/mkdir/.test(r2.avisos[0] || ''));
});
prueba('opción que el simulador no tiene: aviso, no error falso', () => {
  const { sh } = nuevo();
  const r = corre(sh, 'ls --author');
  igual(r.stderr, ''); cierto(/no tiene la opción --author/.test(r.avisos.join()));
  igual(corre(sh, 'ls --foo').stderr, "ls: unrecognized option '--foo'\nPruebe 'ls --help' para más información.\n");
});
prueba('Tab completa órdenes y rutas', () => {
  const { sh } = nuevo({ carpetas: ['~/empresa/datos'], archivos: { '~/notas.txt': '' } });
  igual(sh.completa('pw', 2).sustituye, 'pwd ');
  igual(sh.completa('cd emp', 6).sustituye, 'empresa/');
  igual(sh.completa('cat no', 6).sustituye, 'notas.txt ');
  const r = sh.completa('ls', 2);
  cierto(r.candidatos.includes('ls') && r.candidatos.includes('lsblk'));
});

/* ================= unidad: órdenes ================= */
prueba('ls -l, -a, -h, -i, -R y colores en la terminal', () => {
  const { sh } = nuevo({ archivos: { '~/d/a.txt': 'hola\n', '~/d/s.sh': { datos: '#!/bin/bash\n', modo: 0o775 } }, carpetas: ['~/d/sub'] });
  const l = corre(sh, 'ls -l d').stdout;
  cierto(/^total 12\n-rw-rw-r-- 1 alumno alumno    5 nov 21 09:30 a.txt\n/.test(sinColor(l)), l);
  cierto(l.includes('\x1b[01;34msub\x1b[0m') && l.includes('\x1b[01;32ms.sh\x1b[0m'), 'colores');
  igual(sinColor(corre(sh, 'ls -a d').stdout), '.  ..  a.txt  s.sh  sub\n');
  igual(corre(sh, '\\ls -R d | cat').stdout, 'd:\na.txt\ns.sh\nsub\n\nd/sub:\n');
});
prueba('mkdir, cp, mv, rm y sus errores', () => {
  const { sh, sis } = nuevo();
  corre(sh, ['mkdir -p e/{datos,backups}', 'echo x > e/datos/f.txt', 'cp e/datos/f.txt e/backups/', 'mv e/datos/f.txt e/datos/g.txt', 'cp -r e copia']);
  cierto(sis.esArchivo('~/e/backups/f.txt') && sis.esArchivo('~/e/datos/g.txt') && sis.esArchivo('~/copia/datos/g.txt'));
  igual(corre(sh, 'rmdir e').stderr, "rmdir: fallo al borrar 'e': El directorio no está vacío\n");
  igual(corre(sh, 'rm e').stderr, "rm: no se puede borrar 'e': Es un directorio\n");
  corre(sh, 'rm -r e');
  cierto(!sis.existe('~/e'));
  igual(corre(sh, 'mkdir copia').stderr, 'mkdir: no se puede crear el directorio «copia»: El archivo ya existe\n');
});
prueba('rm -i y cp -i preguntan', () => {
  const { sh, sis } = nuevo({ archivos: { '~/a': 'a\n', '~/b': 'b\n' } });
  let r = sh.ejecuta('rm -i a', { respuestas: ['n'] });
  igual(r.stderr, "rm: ¿borrar el fichero regular 'a'? (s/n) "); cierto(sis.existe('~/a'));
  sh.ejecuta('rm -i a', { respuestas: ['s'] }); cierto(!sis.existe('~/a'));
  r = sh.ejecuta('cp -i b b2; cp -i b b2', { respuestas: ['n'] }); igual(r.stderr, "cp: ¿sobreescribir 'b2'? (s/n) ");
});
prueba('permisos: lectura, escritura y ejecución de verdad', () => {
  const { sh } = nuevo({ archivos: { '~/p.sh': { datos: 'echo dentro\n', modo: 0o664 } } });
  igual(corre(sh, 'cat /etc/shadow').stderr, 'cat: /etc/shadow: Permiso denegado\n');
  igual(corre(sh, 'touch /etc/x').stderr, "touch: no se puede efectuar `touch' sobre '/etc/x': Permiso denegado\n");
  const r = corre(sh, './p.sh'); igual(r.stderr, 'bash: ./p.sh: Permiso denegado\n'); igual(r.codigo, 126);
  igual(corre(sh, 'bash p.sh').stdout, 'dentro\n');
});
prueba('grep, sort, cut, wc, head, tail, tee', () => {
  const csv = 'Mes,Vendedor,Ventas\nEnero,ana,1200\nEnero,luis,950\nFebrero,ana,1100\nFebrero,marta,1300\n';
  const { sh, sis } = nuevo({ archivos: { '~/r.csv': csv } });
  igual(corre(sh, 'grep -c ana r.csv').stdout, '2\n');
  igual(sinColor(corre(sh, 'grep -n luis r.csv').stdout), '3:Enero,luis,950\n');
  igual(corre(sh, 'tail -n +2 r.csv | cut -d, -f2 | sort -u').stdout, 'ana\nluis\nmarta\n');
  igual(corre(sh, 'sort -t, -k3 -n r.csv | head -1').stdout, 'Mes,Vendedor,Ventas\n');
  igual(corre(sh, 'tail -n +2 r.csv | sort -t, -k3 -nr | head -1').stdout, 'Febrero,marta,1300\n');
  igual(corre(sh, 'wc -l r.csv').stdout, '5 r.csv\n');
  igual(corre(sh, 'head -2 r.csv | tee t.txt | wc -l').stdout, '2\n');
  igual(sis.leeArchivo('~/t.txt'), 'Mes,Vendedor,Ventas\nEnero,ana,1200\n');
});
prueba('find con -name, -type, -size, -empty, -exec y -delete', () => {
  const { sh, sis } = nuevo({ archivos: { '~/p/a.log': 'x\n', '~/p/s/b.log': '', '~/p/s/c.txt': 'c\n' }, cwd: '~' });
  igual(corre(sh, 'find p -name "*.log" | sort').stdout, 'p/a.log\np/s/b.log\n');
  igual(corre(sh, 'find p -type d').stdout, 'p\np/s\n');
  igual(corre(sh, 'find p -empty').stdout, 'p/s/b.log\n');
  igual(corre(sh, 'find p -name c.txt -exec cat {} \\;').stdout, 'c\n');
  corre(sh, 'find p -type f -empty -delete');
  cierto(!sis.existe('~/p/s/b.log') && sis.existe('~/p/a.log'));
  igual(corre(sh, 'find /root').stderr, 'find: ‘/root’: Permiso denegado\n');
});
prueba('ln: enlaces duros y simbólicos con inodos', () => {
  const { sh, sis } = nuevo({ archivos: { '~/a.txt': 'hola\n' } });
  corre(sh, ['ln a.txt duro', 'ln -s a.txt blando']);
  igual(sis.stat('~/duro').ino, sis.stat('~/a.txt').ino);
  igual(sis.stat('~/a.txt').enlaces, 2);
  igual(sis.stat('~/blando', false).tipo, 'l');
  corre(sh, 'rm a.txt');
  igual(corre(sh, 'cat duro').stdout, 'hola\n');
  igual(corre(sh, 'cat blando').stderr, 'cat: blando: No existe el archivo o el directorio\n');
});
prueba('sudo pide la contraseña y la recuerda; apt install instala', () => {
  const { sh, sis } = nuevo();
  let r = sh.ejecuta('sudo cat /etc/shadow', { respuestas: ['mala', 'alumno'] });
  igual(r.stderr, 'Lo siento, pruebe otra vez.\n');
  cierto(r.stdout.includes('[sudo] contraseña para alumno: ') && r.stdout.includes('alumno:$6$'));
  r = sh.ejecuta('sudo apt install tree');
  cierto(!r.stdout.includes('[sudo]'), 'no debería volver a pedirla');
  cierto(/Configurando tree \(2\.1\.1-2ubuntu3\.24\.04\.2\)/.test(r.stdout), r.stdout);
  cierto(sis.existe('/usr/bin/tree'));
  r = sh.ejecuta('tree -L 1 /home');
  igual(r.stdout.replace(/\x1b\[[0-9;]*m/g, ''), '/home\n└── alumno\n\n2 directories, 0 files\n');
  r = sh.ejecuta('sudo -k; sudo ls', { respuestas: ['a', 'b', 'c'] });
  igual(r.stderr, 'Lo siento, pruebe otra vez.\nLo siento, pruebe otra vez.\nsudo: 3 intentos de contraseña incorrectos\n');
  igual(r.codigo, 1);
  igual(sh.ejecuta('apt install ncal').stderr, 'E: No se pudo abrir el fichero de bloqueo «/var/lib/dpkg/lock-frontend» - open (13: Permiso denegado)\nE: No se pudo obtener el bloqueo de la interfaz dpkg (/var/lib/dpkg/lock-frontend). ¿Es usted superusuario?\n');
});
prueba('cal después de instalar ncal', () => {
  const { sh } = nuevo({ instalados: ['ncal'] });
  const r = sh.ejecuta('cal 11 2026 | cat');
  igual(r.stdout.split('\n')[0], '   Noviembre 2026     ');
  igual(r.stdout.split('\n')[1], 'do lu ma mi ju vi sá  ');
  igual(r.stdout.split('\n')[2], ' 1  2  3  4  5  6  7  ');
});
prueba('locate necesita updatedb', () => {
  const { sh } = nuevo({ instalados: ['plocate'], archivos: { '~/informe-ventas.txt': 'x' } });
  igual(sh.ejecuta('locate informe').stderr, '/var/lib/plocate/plocate.db: No such file or directory\n');
  sh.ejecuta('sudo updatedb', { respuestas: ['alumno'] });
  igual(sh.ejecuta('locate informe-ventas').stdout, '/home/alumno/informe-ventas.txt\n');
});
prueba('passwd cambia la contraseña de verdad', () => {
  const { sh, sis } = nuevo();
  let r = sh.ejecuta('passwd', { respuestas: ['alumno', 'corta', 'nueva-clave1', 'nueva-clave1'] });
  cierto(r.stdout.includes('CONTRASEÑA INCORRECTA: La contraseña tiene menos de 8 caracteres'));
  cierto(r.stdout.includes('passwd: contraseña actualizada correctamente'));
  cierto(sis.compruebaClave('alumno', 'nueva-clave1'));
  cierto(/^alumno:\$y\$/m.test(sis.leeArchivo('/etc/shadow')), 'el hash pasa a yescrypt');
  r = sh.ejecuta('passwd', { respuestas: ['alumno', 'otra'] });
  cierto(r.stderr.includes('passwd: no se ha cambiado la contraseña'));
});
prueba('man y less abren un programa a pantalla completa', () => {
  const { sh } = nuevo();
  const r = sh.ejecuta('man ls', { lineas: 10 });
  igual(r.codigo, 0);
  igual(sh.ejecuta('man noexiste').stderr, 'Ninguna entrada del manual para noexiste\n');
  igual(sh.ejecuta('man tree').stderr, 'Ninguna entrada del manual para tree\n');
  cierto(sh.ejecuta('man ls | head -1').stdout.startsWith('LS(1)'));
  cierto(sh.ejecuta('ls --help | head -1').stdout.startsWith('Modo de empleo: ls'));
});
prueba('mount y umount de un disco nuevo', () => {
  const { sh, sis } = nuevo({ discos: [{ nombre: 'sdb', tam: '5G', particiones: [{ nombre: 'sdb1', tam: '5G', fs: 'ext4', archivos: { 'leeme.txt': 'disco de datos\n' } }] }] });
  corre(sh, 'sudo mkdir /mnt/datos', { respuestas: ['alumno'] });
  igual(corre(sh, 'mount /dev/sdb1 /mnt/datos').stderr, 'mount: /mnt/datos: debe ser superusuario para utilizar mount.\n       dmesg(1) puede ser que tenga más información tras el fallo de la llamada al sistema de montaje.\n');
  corre(sh, 'sudo mount /dev/sdb1 /mnt/datos');
  igual(corre(sh, 'cat /mnt/datos/leeme.txt').stdout, 'disco de datos\n');
  cierto(corre(sh, 'lsblk | grep sdb1').stdout.includes('/mnt/datos'));
  cierto(corre(sh, 'df -h /mnt/datos').stdout.includes('/dev/sdb1'));
  corre(sh, 'cd /mnt/datos');
  igual(corre(sh, 'sudo umount /mnt/datos').stderr, 'umount: /mnt/datos: el destino está ocupado.\n');
  corre(sh, ['cd', 'sudo umount /mnt/datos']);
  cierto(!sis.existe('/mnt/datos/leeme.txt'));
});
prueba('ping con -c, nslookup e ip', () => {
  const { sh } = nuevo();
  const r = sh.ejecuta('ping -c 2 google.com');
  cierto(/^PING google\.com \(172\.217\.20\.238\) 56\(84\) bytes of data\.\n64 bytes from muc12s03-in-f14\.1e100\.net/.test(r.stdout), r.stdout);
  cierto(/2 packets transmitted, 2 received, 0% packet loss, time 1\d\d\dms/.test(r.stdout), r.stdout);
  igual(sh.ejecuta('ping -c 1 noexiste.invalid').stderr, 'ping: noexiste.invalid: Nombre o servicio desconocido\n');
  cierto(sh.ejecuta('ip a').stdout.includes('inet 10.0.2.15/24 brd 10.0.2.255 scope global dynamic noprefixroute enp0s3'));
  igual(sh.ejecuta('ip r').stdout.split('\n')[0], 'default via 10.0.2.2 dev enp0s3 proto dhcp src 10.0.2.15 metric 100 ');
});
prueba('date, uname, id, who, uptime', () => {
  const { sh } = nuevo();
  cierto(/^sáb 21 nov 2026 09:30:0\d CET\n$/.test(sh.ejecuta('date').stdout));
  igual(sh.ejecuta('date +%A').stdout, 'sábado\n');
  igual(sh.ejecuta('uname -n').stdout, 'som\n');
  igual(sh.ejecuta('id').stdout, 'uid=1000(alumno) gid=1000(alumno) grupos=1000(alumno),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),100(users),114(lpadmin)\n');
  igual(sh.ejecuta('who').stdout, 'alumno   seat0        2026-11-21 09:26 (login screen)\nalumno   tty2         2026-11-21 09:26 (tty2)\n');
  cierto(/^ 09:30:\d\d up 4 min,  2 users,  load average: \d,\d\d, \d,\d\d, \d,\d\d\n$/.test(sh.ejecuta('uptime').stdout));
});
prueba('bash archivo.sh con argumentos y errores con número de línea', () => {
  const { sh } = nuevo({ archivos: { '~/s.sh': 'echo "hola $1"\nnoexiste\necho fin\n' } });
  const r = sh.ejecuta('bash s.sh ana');
  igual(r.stdout, 'hola ana\nfin\n');
  igual(r.stderr, 's.sh: línea 2: noexiste: orden no encontrada\n');
});
prueba('Ctrl+C interrumpe ping', () => {
  const { sh } = nuevo();
  const ev = [];
  const ej = sh.lanzaLinea('ping 8.8.8.8', { alSalir: (t, x) => ev.push(x) });
  let r = ej.avanza();
  igual(r.tipo, 'espera');
  r = ej.avanza(); r = ej.interrumpe();
  igual(r.fin, true); igual(r.codigo, 0);
  cierto(/2 packets transmitted, 2 received/.test(ev.join('')), ev.join(''));
});
prueba('exit cierra la sesión', () => {
  const { sh } = nuevo();
  const r = sh.ejecuta('exit 3');
  igual(r.salir, true); igual(r.codigo, 3); igual(r.stderr, 'exit\n');
});

/* ================= fase 1b: UT4 ================= */
prueba('/proc/version y uname -v como en la máquina real (cortados a 64 caracteres: «UTC 2»)', () => {
  const { sh } = nuevo();
  igual(corre(sh, 'cat /proc/version').stdout, 'Linux version 7.0.0-43-generic (buildd@lcy02-amd64-011) (x86_64-linux-gnu-gcc-13 (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, GNU ld (GNU Binutils for Ubuntu) 2.42) #43~24.04.1-Ubuntu SMP PREEMPT_DYNAMIC Sat Oct 31 06:52:47 UTC 2\n');
  igual(corre(sh, 'uname -v').stdout, '#43~24.04.1-Ubuntu SMP PREEMPT_DYNAMIC Sat Oct 31 06:52:47 UTC 2\n');
});
prueba('grub.cfg de la imagen base: el real, solo para root', () => {
  const { sis, sh } = nuevo();
  igual(sis.leeArchivo('/boot/grub/grub.cfg'), L.datos.grubCfg);
  cierto(/set timeout_style=hidden\n    set timeout=0/.test(L.datos.grubCfg) && /linux\t\/boot\/vmlinuz-7\.0\.0-43-generic root=UUID=\S+ ro  quiet splash \$vt_handoff/.test(L.datos.grubCfg));
  cierto(/Permiso denegado/.test(corre(sh, 'cat /boot/grub/grub.cfg').stderr));
});
prueba('update-grub regenera grub.cfg con /etc/default/grub', () => {
  const { sis, sh } = nuevo();
  sis.guarda('/etc/default/grub', sis.lee('/etc/default/grub').replace('GRUB_TIMEOUT_STYLE=hidden', 'GRUB_TIMEOUT_STYLE=menu').replace('GRUB_TIMEOUT=0', 'GRUB_TIMEOUT=7').replace('"quiet splash"', '""'));
  const r = corre(sh, 'sudo update-grub', { respuestas: ['alumno'] });
  cierto(/Generating grub configuration file \.\.\.\nFound linux image: \/boot\/vmlinuz-7\.0\.0-43-generic/.test(r.stderr), r.stderr);
  const g = sis.leeArchivo('/boot/grub/grub.cfg');
  cierto(/set timeout_style=menu\n    set timeout=7\n/.test(g) && /ro   \$vt_handoff/.test(g) && !/quiet splash/.test(g), g.slice(3000, 3800));
  igual(corre(sh, 'grub-mkconfig').stderr, 'grub-mkconfig: You must run this as root\n');
});
prueba('man: páginas de las secciones 1, 5 y 8 del sistema base', () => {
  const { sh } = nuevo();
  ['free', 'ping', 'sudo', 'lsmod', 'update-grub', 'systemctl', 'hostname'].forEach((o) => { const r = corre(sh, 'man ' + o, { teclas: ['q'] }); igual(r.stderr + r.avisos.join(), '', 'man ' + o); cierto(r.pantallas.length === 1, 'man ' + o); });
  igual(corre(sh, 'whereis ping').stdout, 'ping: /usr/bin/ping /usr/share/man/man8/ping.8.gz\n');
  igual(corre(sh, 'man 5 uname').stderr, 'No existe entrada de manual para uname en la sección 5\n');
});
prueba('man -k, apropos y whatis', () => {
  const { sh } = nuevo();
  const r = corre(sh, 'man -k memory');
  cierto(/^free \(1\) +- Display amount of free and used memory in the system$/m.test(r.stdout), r.stdout.slice(0, 400));
  igual(corre(sh, 'whatis lsblk').stdout, 'lsblk (8)            - list block devices\n');
  igual(corre(sh, 'apropos').stderr, 'apropos ¿qué?\n');
  igual(corre(sh, 'whatis zzz').stderr, 'zzz: nada apropiado.\n');
});
prueba('misiones de la UT4: pistas en dos niveles y aviso de ~ en M1', () => {
  const m1 = L.misiones['ut4-m1'].generar(5);
  const t2 = m1.tareas[1];
  igual(L.pistaOrden(t2), 'La orden es «pwd».');
  cierto(/ruta completa/.test(t2.avisa(['~'])) && !t2.avisa(['/home/x']), 'aviso de ~');
  cierto(!t2.comprueba({}, ['~']), '~ no vale como ruta completa');
  const m4 = L.misiones['ut4-m4'].generar(5);
  igual(L.pistaOrden(m4.tareas[3]), 'La orden es «sudo apt update». La contraseña es la tuya del simulador.');
  cierto(!/-o/.test(L.misiones['ut4-m3'].generar(5).tareas[4].pista) && /uname -o/.test(L.pistaOrden(L.misiones['ut4-m3'].generar(5).tareas[4])), 'M3, tarea 5: la opción, solo en la segunda pista');
  cierto(!L.bancoRepasoUT4.some((x) => x[0] === 'red'), 'la puerta de enlace sigue en el repaso');
});
prueba('man en una terminal estrecha: vuelve a llenar los párrafos sin partir palabras', () => {
  require(path.join(A, 'linux-ayuda-es.js'));
  for (const [pag, txt] of [['ls', L.ayudaEs.man.ls], ['lsblk', L.ayuda.man.lsblk], ['cp', L.ayudaEs.man.cp]]) {
    const orig = txt.split('\n');
    for (const ancho of [40, 52, 66, 100]) {
      const r = L.reflujoMan(orig, ancho);
      const palabras = (ls) => ls.join(' ').split(/\s+/).filter(Boolean).join(' ');
      igual(palabras(r), palabras(orig), `${pag} a ${ancho}`);
      cierto(r.slice(1).every((l) => [...l].length <= ancho - 2 || !/^ {7}/.test(l) || !/ /.test(l.trim())), `${pag} a ${ancho}: línea larga`);
    }
  }
  const { sh } = nuevo();
  const p = corre(sh, 'man ls', { teclas: ['q'], columnas: 52, lineas: 24 }).pantallas[0];
  cierto(/\n {7}Por defecto, +muestra +información +de +los\n/.test(sinColor(p)), sinColor(p).slice(0, 600));
});
prueba('misiones con vista: columnas que piden (M5 en nano, M7 con ls -l)', () => {
  const m5 = L.misiones['ut4-m5'].generar(3);
  igual(m5.columnas, 44);   // GRUB_CMDLINE_LINUX_DEFAULT="quiet splash" (41) + 3
  const linea = (cols) => {
    const { sh } = nuevo();
    const r = corre(sh, 'sudo nano /etc/default/grub', { respuestas: ['alumno'], teclas: ['Ctrl+W', ...'CMDLINE_LINUX_DEFAULT', 'Enter', 'End', 'Ctrl+X'], columnas: cols, lineas: 24 });
    // la última pantalla: el cursor al final de la línea (Ctrl+X sale sin más pantallas); la línea 10 del archivo
    return sinColor(r.pantallas[r.pantallas.length - 1]).split('\n')[10];
  };
  igual(linea(m5.columnas).trimEnd(), 'GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"');
  cierto(/^<lash"/.test(linea(m5.columnas - 1)), 'con una columna menos, nano ya desplaza la línea: ' + linea(m5.columnas - 1));
  for (let s = 0; s < 60; s++) {
    const m = L.misiones['ut4-m7'].generar(s * 7919 + 13);
    const sh = L.crea(Object.assign({ fecha: FECHA }, m.escenario)).sesion();
    const largas = sinColor(corre(sh, 'ls -alt').stdout).split('\n').filter((l) => / \.[^ .]\S*$/.test(l) && [...l].length > m.columnas);
    cierto(!largas.length && m.columnas <= 66, `M7 semilla ${s}: ${largas[0]}`);
  }
});
prueba('F12: apt list --upgradable, man -w, el aviso de troff y las líneas mal escritas de /etc/default/grub', () => {
  const { sh, sis } = nuevo({ pendientes: 3 });
  igual(sinColor(corre(sh, 'apt list --upgradable 2>/dev/null').stdout), 'Listando... Hecho\n');
  corre(sh, 'sudo apt update', { respuestas: ['alumno'] });
  const l = corre(sh, 'apt list --upgradable 2>/dev/null');
  igual(sinColor(l.stdout).split('\n').filter(Boolean).length, 4);
  cierto(/\[actualizable desde: /.test(l.stdout) && l.notas.length === 1 && !l.avisos.length, l.stdout);
  igual(corre(sh, 'man -w uname').stdout, '/usr/share/man/es/man1/uname.1.gz\n');
  igual(corre(sh, 'man -w lsblk').stdout, '/usr/share/man/man8/lsblk.8.gz\n');
  const m = corre(sh, 'man lsblk', { teclas: ['q'] });
  cierto(/^troff:/.test(m.stderr) && /^LSBLK\(8\)/.test(sinColor(m.pantallas[0])) && /Manual page lsblk\(8\)/.test(sinColor(m.pantallas[0])), sinColor(m.pantallas[0]).slice(0, 200));
  sis.guarda('/etc/default/grub', sis.lee('/etc/default/grub').replace('GRUB_TIMEOUT=0', 'GRUB_TIMEOUT = 15').replace('GRUB_TIMEOUT_STYLE=hidden', 'GRUB_TIMEOUT_STYLE=Menu'));
  const u = corre(sh, 'sudo update-grub', { respuestas: ['alumno'] });
  cierto(u.avisos.length === 2 && /espacios alrededor del =/.test(u.avisos[0]) && /menu, countdown o hidden/.test(u.avisos[1]), JSON.stringify(u.avisos));
  // N7 (22-11-2026): la nota dice lo mismo que grub.cfg (y la vista del arranque): sin la variable, 5 segundos
  cierto(/sin valor: sin ella, el menú espera 5 segundos/.test(u.avisos[0]) && /set timeout=5\n/.test(sis.lee('/boot/grub/grub.cfg')), u.avisos[0]);
});
/* ================= Practica Linux (linux-practica*.js) ================= */
require(path.join(A, 'linux-practica.js'));
require(path.join(A, 'linux-practica-ut4.js'));
{
  const P = L.practica;
  const banco = P.prepara(P.bancos[4]);
  const permitidas = P.ordenesUT[4];
  // las órdenes de un paso, una a una (con sudo, también la de detrás)
  const ordenesPaso = (paso) => P.ordenesDe(L.pasoMision(paso).orden).map((o) => (o[0] === 'sudo' ? o[1] : o[0]));
  const usaPermitidas = (paso) => ordenesPaso(paso).every((o) => permitidas.includes(o) || /^[A-Z_][A-Z0-9_]*=/.test(o) || /^(lista|donde|hoy)$/.test(o));
  const corre = (b, k, pasos, respuesta) => {
    const r = P.reconstruye(b, k, { fecha: FECHA });
    const desde = r.sis.registro.length;
    let c = P.contexto(r.sis, r.sh, { desde });
    pasos.forEach((p) => { c = P.ejecuta(r.sh, p, desde); });
    if (respuesta) c = P.contexto(r.sis, r.sh, { desde, salida: c.salida, linea: c.linea, respuesta: respuesta(c) });
    return c;
  };
  prueba(`Practica Linux UT4: ${banco.bloques.length} bloques y ${banco.bloques.reduce((n, b) => n + b.encargos.length, 0)} encargos bien escritos`, () => {
    const claves = new Set();
    banco.bloques.forEach((b) => b.encargos.forEach((e) => {
      cierto(e.pide && e.pistas && e.pistas.length === 2 && e.exp && e.sol && e.sol.length && typeof e.hecho === 'function', `${e.clave}: faltan campos`);
      cierto(!claves.has(e.clave), `${e.clave} repetida`); claves.add(e.clave);
      cierto(!/Ctrl\+[A-Z]/.test(e.pide + e.pistas.join(' ') + e.exp), `${e.clave}: tecla sin espacios`);
      cierto(!/examen|nota\b|UT\d/i.test(e.pide + e.pistas.join(' ') + e.exp), `${e.clave}: nombra el examen, la nota u otra unidad`);
    }));
  });
  banco.bloques.forEach((b) => prueba(`Practica Linux UT4, bloque ${b.id}: cada encargo sin hacer, hecho con su solución y sus alternativas, y sus despistes`, () => {
    b.encargos.forEach((e, k) => {
      const conRespuesta = e.casilla || e.selector;
      // antes de hacerlo, no está conseguido
      const r0 = P.reconstruye(b, k, { fecha: FECHA });
      const c0 = P.contexto(r0.sis, r0.sh, { desde: r0.sis.registro.length, respuesta: conRespuesta ? (e.casilla ? e.casilla.nombres.map(() => 'zz9') : ['zz9']) : null });
      cierto(!P.evalua(e, c0).hecho, `${e.clave}: ya está conseguido antes de hacerlo`);
      // la solución y las alternativas lo consiguen, solo con órdenes de la unidad
      [e.sol].concat(e.alt || []).forEach((pasos, j) => {
        pasos.forEach((p) => cierto(usaPermitidas(p), `${e.clave}: ${L.pasoMision(p).orden} usa una orden que la unidad no enseña`));
        const c = corre(b, k, pasos, conRespuesta ? (x) => e.esperado(x) : null);
        const ev = P.evalua(e, c);
        cierto(ev.hecho, `${e.clave}, ${j ? 'alternativa ' + j : 'solución'} (${pasos.map((p) => L.pasoMision(p).orden).join(' · ')}): no lo consigue. Salida: ${c.salida.slice(0, 300)} | ${ev.msg}`);
        if (conRespuesta) cierto(!P.evalua(e, corre(b, k, pasos, () => (e.casilla ? e.casilla.nombres.map(() => 'zz9') : ['zz9']))).hecho, `${e.clave}: acepta una respuesta mala`);
      });
      // los despistes no lo consiguen y dan su mensaje
      (e.despistes || []).forEach((d) => {
        const c = corre(b, k, d.pasos);
        const ev = P.evalua(e, c);
        cierto(!ev.hecho && d.msg.test(ev.msg), `${e.clave}, despiste ${d.pasos.map((p) => L.pasoMision(p).orden).join(' · ')}: ${ev.hecho ? 'lo da por bueno' : 'mensaje «' + ev.msg + '»'}`);
      });
    });
  }));
  // la verificación del 22-11-2026: casos que antes se daban por buenos sin serlo, o al revés
  const enc = (clave) => { for (const b of banco.bloques) { const k = b.encargos.findIndex((e) => e.clave === clave); if (k >= 0) return { b, k, e: b.encargos[k] }; } return null; };
  const evalua = (clave, pasos, opc) => { const x = enc(clave); const r = P.reconstruye(x.b, x.k, { fecha: FECHA }); const desde = r.sis.registro.length; let c = P.contexto(r.sis, r.sh, { desde }); if (opc && opc.antes) { opc.antes.forEach((p) => L.ejecutaPaso(r.sh, P.conClave(r.sh, p))); P.marcaInicio(r.sh); } pasos.forEach((p) => { c = P.ejecuta(r.sh, p, desde); }); if (opc && opc.respuesta) c = P.contexto(r.sis, r.sh, { desde, salida: c.salida, todo: opc.todo !== undefined ? opc.todo : c.salida, linea: c.linea, respuesta: opc.respuesta }); return P.evalua(x.e, c); };
  const nanoGrub = (...cambios) => ({ orden: 'sudo nano /etc/default/grub', respuestas: ['alumno'], teclas: [].concat(...cambios.map(([a, d]) => ['Ctrl+W'].concat(a.split(''), ['Enter'], Array(a.length).fill('Delete'), d.split(''))), ['Ctrl+O', 'Enter', 'Ctrl+X']) });
  prueba('Practica Linux UT4: GRUB, el menú solo cuenta si se ve (estilo menu y espera mayor que 0)', () => {
    const x = enc('administrar/menu'), y = enc('administrar/espera');
    cierto(y.k < x.k, 'primero la espera y después el menú');
    cierto(!evalua('administrar/menu', [nanoGrub(['GRUB_TIMEOUT_STYLE=hidden', 'GRUB_TIMEOUT_STYLE=menu'], ['GRUB_TIMEOUT=7', 'GRUB_TIMEOUT=0']), 'sudo update-grub']).hecho, 'menu con 0 segundos no vale');
    cierto(evalua('administrar/menu', [nanoGrub(['GRUB_TIMEOUT_STYLE=hidden', 'GRUB_TIMEOUT_STYLE=menu']), 'sudo update-grub']).hecho, 'menu con 7 segundos vale');
    const r = P.reconstruye(x.b, x.k, { fecha: FECHA });
    cierto(/GRUB_TIMEOUT=7/.test(r.sis.leeArchivo('/etc/default/grub')) && /GRUB_TIMEOUT_STYLE=hidden/.test(r.sis.leeArchivo('/etc/default/grub')), 'a mitad de bloque, el menú empieza con 7 segundos y escondido');
    cierto(!evalua('junto/arranque', [nanoGrub(['GRUB_TIMEOUT_STYLE=hidden', 'GRUB_TIMEOUT_STYLE=menu'], ['"quiet splash"', '"quiet"']), 'sudo update-grub']).hecho, '10.5 sin los 4 segundos no vale');
  });
  prueba('Practica Linux UT4: volver a la carpeta de antes es la anterior de verdad (OLDPWD)', () => {
    // en el encargo de la raíz, subir con cd .. tres veces (desde Documentos); en el siguiente, cd - lleva a /home
    const raiz = enc('moverse/raiz'), antes = enc('moverse/antes');
    const desdeRaiz = (pasos) => { const r = P.reconstruye(raiz.b, raiz.k, { fecha: FECHA }); ['cd ..', 'cd ..', 'cd ..'].forEach((p) => L.ejecutaPaso(r.sh, p)); P.marcaInicio(r.sh); let c; pasos.forEach((p) => { c = P.ejecuta(r.sh, p, 0); }); return P.evalua(antes.e, c); };
    cierto(desdeRaiz(['cd -']).hecho, 'cd .. tres veces y cd -: a /home');
    cierto(!desdeRaiz(['cd ~/Documentos']).hecho, 'volver a Documentos cuando la de antes era /home no vale');
    const m = evalua('moverse/antes', ['cd /tmp']);
    cierto(!m.hecho && /justo antes era ~\/Documentos/.test(m.msg), m.msg);
  });
  prueba('Practica Linux UT4: el gestor de pantalla, por el estado del servicio', () => {
    ['ls /etc', 'ls /etc | grep gdm', 'echo gdm'].forEach((o) => cierto(!evalua('administrar/gestor', [o]).hecho, o));
    cierto(evalua('administrar/gestor', [{ orden: 'systemctl status display-manager', teclas: ['q'] }]).hecho, 'systemctl status');
  });
  prueba('Practica Linux UT4: el historial vale aunque se haya borrado antes; borrarlo, solo en la misma terminal', () => {
    cierto(evalua('shell/historial', ['history'], { antes: ['history -c'] }).hecho, 'history tras history -c');
    cierto(!evalua('shell/historial', ['echo "  5  history"']).hecho, 'un echo que imita el historial');
    const x = enc('shell/borrahist'); const r = P.reconstruye(x.b, x.k, { fecha: FECHA });
    const sh2 = r.sis.sesion({ columnas: 80, lineas: 24 });
    cierto(!P.evalua(x.e, P.ejecuta(sh2, 'ls', 0)).hecho, 'en una terminal nueva no cuenta');
    const y = enc('shell/borra'); const r2 = P.reconstruye(y.b, y.k, { fecha: FECHA });
    const sh3 = r2.sis.sesion({ columnas: 80, lineas: 24 }); const ev = P.evalua(y.e, P.ejecuta(sh3, 'ls', 0));
    cierto(!ev.hecho && /Al cerrar la terminal/.test(ev.msg), 'borrar el alias: tras exit no cuenta ' + ev.msg);
  });
  prueba('Practica Linux UT4: el calendario de tres meses, y solo tres, sin depender de las mayúsculas', () => {
    ['cal -y', 'cal 2026', 'cal'].forEach((o) => cierto(!evalua('administrar/cal3', [o]).hecho, o));
    cierto(evalua('administrar/cal3', ['cal -3']).hecho, 'cal -3');
    // con los meses en minúscula (como podría escribirlos ncal en es_ES) también valen
    const x = enc('administrar/cal3'); const r = P.reconstruye(x.b, x.k, { fecha: FECHA });
    const c = P.ejecuta(r.sh, 'cal -3', r.sis.registro.length);
    cierto(x.e.hecho(Object.assign({}, c, { salida: c.salida.toLowerCase() })), 'meses en minúscula');
  });
  prueba('Practica Linux UT4: cada encargo empieza con lo que necesita (pre), también al llegar desde el anterior', () => {
    // al reconstruir, todos los pre se cumplen
    banco.bloques.forEach((b) => b.encargos.forEach((e, k) => { if (!e.pre) return; const r = P.reconstruye(b, k, { fecha: FECHA }); cierto(P.preOk(e, r.sis, r.sh), `${e.clave}: su pre no se cumple al reconstruir`); }));
    // 4.6 con cd / dos veces: el 4.7 no tiene salida con lo que queda (OLDPWD = /), así que su pre pide montarlo otra vez
    const raiz = enc('moverse/raiz'), antes = enc('moverse/antes');
    const r = P.reconstruye(raiz.b, raiz.k, { fecha: FECHA }); ['cd /', 'cd /'].forEach((p) => L.ejecutaPaso(r.sh, p));
    cierto(!P.preOk(antes.e, r.sis, r.sh), '4.7 tras cd / dos veces: no se puede hacer con ese estado');
    const r2 = P.reconstruye(antes.b, antes.k, { fecha: FECHA }); const c = P.ejecuta(r2.sh, 'cd -', 0);
    cierto(P.evalua(antes.e, c).hecho, '4.7 montado de nuevo: cd - lo cumple');
    // otros estados rotos que el anterior puede dejar sin fallar
    const roto = (clave, pasos) => { const x = enc(clave), prev = x.b.encargos[x.k - 1]; const rr = P.reconstruye(x.b, x.k, { fecha: FECHA }); pasos.forEach((p) => L.ejecutaPaso(rr.sh, P.conClave(rr.sh, p))); return !P.preOk(x.e, rr.sis, rr.sh) && !!prev; };
    cierto(roto('moverse/clase', ['cd /tmp']), '4.4: no estás en Documentos');
    cierto(roto('shell/borra', ['unalias hoy']), '8.5: el alias hoy ya no existe');
    cierto(roto('administrar/cal3', [{ orden: 'sudo apt remove ncal', respuestas: [''] }]), '9.4: ncal ya no está');
    cierto(roto('mirar/largo', ['cd fotos']), '5.3: no estás en tu carpeta personal');
  });
  prueba('Practica Linux UT4: «Ver solución» busca en nano con F6, no con Ctrl+W (en el navegador cierra la pestaña)', () => {
    banco.bloques.forEach((b) => b.encargos.forEach((e) => [e.sol].concat(e.alt || []).forEach((ps) => ps.forEach((p) => cierto(!(L.pasoMision(p).teclas || []).includes('Ctrl+W'), `${e.clave}: usa Ctrl+W`)))));
    ['ut4-m5'].forEach((id) => { for (let s = 1; s <= 20; s++) L.misiones[id].generar(s).tareas.forEach((t) => (t.solucion || []).forEach((p) => cierto(!(L.pasoMision(p).teclas || []).includes('Ctrl+W'), `${id}: Resolver usa Ctrl+W`))); });
  });
  prueba('Practica Linux UT4: el mensaje del ping habla del último intento', () => {
    const x = enc('primeros/ping');
    const c = corre(x.b, x.k, [{ orden: 'ping 10.0.2.2', ctrlC: 0.5 }, { orden: 'ping 8.8.8.8', ctrlC: 2.5 }]);
    cierto(/otra dirección/.test(P.evalua(x.e, c).msg), P.evalua(x.e, c).msg);
  });
  prueba('Practica Linux UT4: nano sin sudo en /etc/default/grub dice que hace falta sudo', () => {
    const x = enc('administrar/espera');
    const ev = P.evalua(x.e, corre(x.b, x.k, [{ orden: 'nano /etc/default/grub', teclas: ['F6'].concat('GRUB_TIMEOUT=0'.split(''), ['Enter'], Array(14).fill('Delete'), 'GRUB_TIMEOUT=7'.split(''), ['Ctrl+O', 'Enter', 'Ctrl+X', 'n']) }]));
    cierto(!ev.hecho && /sudo delante/.test(ev.msg), ev.msg);
  });
  prueba('Practica Linux UT4: en el selector la respuesta buena no es la primera opción', () => {
    banco.bloques.forEach((b) => b.encargos.forEach((e) => { if (!e.selector) return; const r = P.reconstruye(b, 0, { fecha: FECHA }); cierto(e.selector[0] !== e.esperado(P.contexto(r.sis, r.sh, {}))[0], `${e.clave}: la buena es la primera`); }));
  });
  prueba('Practica Linux UT4: el selector solo cuenta si antes se ha averiguado en la terminal', () => {
    const sin = evalua('ayuda/type', ['ls'], { respuesta: ['interna'] });
    cierto(!sin.hecho && /Primero averígualo/.test(sin.msg), 'sin type: ' + sin.msg);
    cierto(evalua('ayuda/type', ['type cd'], { respuesta: ['interna'] }).hecho, 'type cd e interna');
    cierto(!evalua('ayuda/type', ['type cd'], { respuesta: ['alias'] }).hecho, 'type cd y alias');
    const may = evalua('archivos/cuento', [], { respuesta: ['Faro'] });
    cierto(may.hecho, 'faro, en lenguaje corriente, sin mirar mayúsculas');
    const may2 = evalua('mirar/grande', ['ls -l fotos'], { respuesta: ['Montaña.jpg'] });
    cierto(!may2.hecho && /mayúsculas/.test(may2.msg), may2.msg);
    cierto(evalua('ayuda/helpcd', ['cd --help']).hecho, 'cd --help enseña la ayuda');
  });
}
prueba('manpages-es: instalado de serie, man en español en las órdenes traducidas', () => {
  const { sh } = nuevo();
  cierto(/^LS\(1\) +Órdenes de usuario +LS\(1\)\n\nNOMBRE\n {7}ls - lista el contenido de un directorio\n/.test(corre(sh, 'man ls | head -4').stdout));
  cierto(/\nNAME\n {7}lsblk - list block devices\n/.test(corre(sh, 'man lsblk | head -6').stdout), 'lsblk sigue en inglés');
  igual(corre(sh, 'whatis ls').stdout, 'ls (1)               - lista el contenido de un directorio\n');
  igual(corre(sh, 'man -k fecha').stdout, 'date (1)             - muestra o define la fecha y hora del sistema\ntouch (1)            - cambia la fecha de un archivo\n');
  igual(sinColor(corre(sh, 'apt list --installed manpages-es 2>/dev/null').stdout), 'Listando... Hecho\nmanpages-es/noble,now 4.21.0-2 all [instalado]\n');
  const r = corre(sh, 'sudo apt install manpages-es', { respuestas: ['alumno'] });
  cierto(/manpages-es ya está en su versión más reciente \(4\.21\.0-2\)\./.test(r.stdout), r.stdout);
});
prueba('manpages-es: sin el paquete (escenario sin-manpages-es) man sale en inglés hasta instalarlo', () => {
  const { sh } = nuevo(L.escenarios['sin-manpages-es']);
  cierto(/^LS\(1\) +User Commands +LS\(1\)\n\nNAME\n {7}ls - list directory contents\n/.test(corre(sh, 'man ls | head -4').stdout));
  const k = corre(sh, 'man -k fecha');
  igual(k.stdout + k.stderr + k.codigo, 'fecha: nada apropiado.\n16');
  igual(corre(sh, 'dpkg -l manpages-es').stderr, 'dpkg-query: no se ha encontrado ningún paquete que corresponda con manpages-es.\n');
  corre(sh, 'sudo apt install -y manpages-es', { respuestas: ['alumno'] });
  cierto(/\nNOMBRE\n {7}ls - lista el contenido de un directorio\n/.test(corre(sh, 'man ls | head -4').stdout), 'tras instalarlo');
  igual(corre(sh, 'whatis ls').stdout, 'ls (1)               - lista el contenido de un directorio\n');
  // man, apropos, whatis y which ya vienen en español sin el paquete
  cierto(/\nNOMBRE\n {7}man - /.test(corre(nuevo(L.escenarios['sin-manpages-es']).sh, 'man man | head -4').stdout), 'man man');
});
prueba('man -k: orden de man-db y líneas cortadas como en la máquina', () => {
  const { sh } = nuevo();
  const d = corre(sh, 'man -k disk').stdout.split('\n');
  igual(d[0], 'proc_diskstats (5)   - disk I/O statistics');
  const m = corre(sh, 'man -k memory').stdout.split('\n');
  cierto(m[0].startsWith('aligned_alloc (3)') && m.indexOf('proc_meminfo (5)     - memory usage') > 50, m.slice(0, 3).join('\n'));
  cierto(corre(sh, 'apropos pipewire-pulse-module-native').stdout.startsWith('pipewire-pulse-module-native-protocol... (7) - Pulseaudio TCP Protocol\n'));
  // en una terminal de 60 columnas corta al ancho de la terminal aunque vaya a una tubería (grabado el 21-11-2026)
  igual(corre(sh, 'man -k memory | head -2', { columnas: 60 }).stdout, 'aligned_alloc (3)    - allocate aligned memory\nalloca (3)           - allocate memory that is automatica...\n');
  igual(corre(sh, 'man -k directorio | head -1', { columnas: 80 }).stdout, 'basename (1)         - elimina la parte de directorios y sufijos de los nombr...\n');
});
prueba('paginadores: systemctl (lines … (END)), info (línea de modo) y la h de less', () => {
  const { sh } = nuevo();
  const s = corre(sh, 'systemctl status display-manager', { teclas: ['q'], columnas: 60, lineas: 20 });
  cierto(/lines 1-14\/14 \(END\)/.test(sinColor(s.pantallas[0])) && /> *$/m.test(sinColor(s.pantallas[0])), sinColor(s.pantallas[0]));
  const i = corre(sh, 'info ls', { teclas: ['q'] });
  cierto(/-----Info: \(coreutils\)ls invocation, \d+ lines --Top/.test(sinColor(i.pantallas[0])) && /Esto es Info, versión 7\.1/.test(i.pantallas[0]));
  const m = corre(sh, 'man ls', { teclas: ['h', 'q', 'q'] });
  cierto(/SUMMARY OF LESS COMMANDS/.test(sinColor(m.pantallas[1])) && /HELP -- Press RETURN/.test(sinColor(m.pantallas[1])));
  const b = corre(sh, 'man uname', { teclas: ['/', 'o', 'p', 'e', 'r', 'a', 't', 'i', 'n', 'g', 'Enter', 'q'] });
  cierto(/--operating-system/.test(sinColor(b.pantallas[b.pantallas.length - 1]).split('\n')[0]), sinColor(b.pantallas[b.pantallas.length - 1]).split('\n')[0]);
});
prueba('nano: buscar, cortar, escribir, guardar y salir', () => {
  const { sis, sh } = nuevo();
  const teclas = ['Ctrl+W'].concat('TIMEOUT=0'.split(''), ['Enter', 'Ctrl+K'], 'GRUB_TIMEOUT=5'.split(''), ['Enter', 'Ctrl+O', 'Enter', 'Ctrl+X']);
  const r = corre(sh, 'sudo nano /etc/default/grub', { respuestas: ['alumno'], teclas });
  igual(r.avisos.length, 0);
  const g = sis.leeArchivo('/etc/default/grub');
  cierto(/\nGRUB_TIMEOUT=5\nGRUB_DISTRIBUTOR=/.test(g) && !/GRUB_TIMEOUT=0/.test(g), g.slice(0, 400));
  cierto(/\[ 40 líneas escritas \]/.test(r.pantallas.join('\n')));
  // sin guardar: Ctrl+X pregunta y N sale sin cambiar nada
  const antes = sis.leeArchivo('/etc/default/grub');
  const r2 = corre(sh, 'sudo nano /etc/default/grub', { teclas: ['x', 'Ctrl+X', 'n'] });
  cierto(/¿Guardar el búfer modificado\?/.test(sinColor(r2.pantallas.join('\n'))));
  igual(sis.leeArchivo('/etc/default/grub'), antes);
  const r3 = corre(sh, 'nano /etc/default/grub', { teclas: ['Ctrl+X'] });
  cierto(/no es de escritura/.test(sinColor(r3.pantallas[0])), sinColor(r3.pantallas[0]));
});
prueba('ping sin -c hasta Ctrl+C, con el resumen', () => {
  const { sis, sh } = nuevo();
  const r = sh.ejecuta('ping 10.0.2.2', { ctrlCTras: 3 });
  cierto(/--- 10\.0\.2\.2 ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss, time 20\d\dms/.test(r.stdout), r.stdout);
  cierto(sis.registro.some((x) => x.tipo === 'tecla' && x.tecla === 'Ctrl+C' && x.orden === 'ping'));
});
prueba('apt: update descubre, upgrade [S/n], install ncal da cal, remove', () => {
  const { sis, sh } = nuevo({ pendientes: 5, sobrantes: ['cowsay'] });
  igual(corre(sh, 'cal').stderr, "No se ha encontrado la orden «cal», pero se puede instalar con:\nsudo apt install ncal\n");
  cierto(/0 actualizados/.test(corre(sh, 'sudo apt upgrade', { respuestas: ['alumno'] }).stdout));
  cierto(/Se pueden actualizar 5 paquetes/.test(corre(sh, 'sudo apt update').stdout));
  corre(sh, 'sudo apt upgrade', { respuestas: [''] });
  igual(sis.actualizables.length, 0);
  corre(sh, 'sudo apt install ncal', { respuestas: [''] });
  cierto(/do lu ma mi ju vi sá/.test(corre(sh, 'cal').stdout));
  corre(sh, 'sudo apt remove cowsay', { respuestas: [''] });
  cierto(!sis.paquetes.cowsay.esta);
});
prueba('escenario: núcleo, disco, sesiones, IP y fecha', () => {
  const { sh } = nuevo({ nucleo: { version: '6.8.0-41-generic', numero: '41', arquitectura: 'aarch64', modulos: { quita: ['usbhid'], añade: ['btrfs'] } }, disco: { tam: 50, swap: 4, orden: ['efi', 'swap', 'raiz', 'home'] }, sesiones: [{ usuario: 'luis', tty: 'tty4', orden: 'top' }], ip: '10.0.2.20' });
  igual(corre(sh, 'uname -rm').stdout, '6.8.0-41-generic aarch64\n');
  igual(corre(sh, 'lsmod | grep usbhid').stdout, '');
  cierto(/^btrfs /m.test(corre(sh, 'lsmod').stdout));
  const l = corre(sh, 'lsblk').stdout;
  // el instalador cuenta en GB decimales: 25 GB de raíz son 23,3G en lsblk y 4 GB de intercambio, 3,7G
  cierto(/sda +8:0 +0 +50G .*\n├─sda1 .* 1G .*\/boot\/efi\n├─sda2 .* 3,7G .*\[SWAP\]\n├─sda3 .* 23,3G .*\/\n└─sda4 .* 21,9G .*\/home/.test(l), l);
  cierto(/^luis +tty4 /m.test(corre(sh, 'who').stdout));
  cierto(/^luis +tty4 .* top$/m.test(corre(sh, 'w').stdout));
  cierto(/inet 10\.0\.2\.20\/24/.test(corre(sh, 'ip a').stdout));
});
prueba('passwd cambia la contraseña de verdad; exit cierra la sesión', () => {
  const { sis, sh } = nuevo();
  corre(sh, 'passwd', { respuestas: ['alumno', 'pinguino24', 'pinguino24'] });
  cierto(sis.compruebaClave('alumno', 'pinguino24'));
  cierto(/incorrecta|Lo siento/.test(corre(sh, 'sudo -k; sudo ls', { respuestas: ['alumno', 'alumno', 'alumno'] }).stderr));
  sh.ejecuta('exit');
  cierto(sis.sesionCerrada && sis.registro.some((x) => x.tipo === 'salir'));
});
prueba('/etc como en la máquina real: host.conf y Tab Tab', () => {
  const { sh } = nuevo();
  igual(corre(sh, 'cat /etc/host.conf').stdout, '# The "order" line is only used by old versions of the C library.\norder hosts,bind\nmulti on\n');
  // compgen -f /etc/host en la máquina real: hosts.allow hostname host.conf hosts.deny hosts
  igual(sh.completa('cat /etc/host', 13).candidatos.join(' '), 'host.conf hostname hosts hosts.allow hosts.deny');
  igual(sh.completa('cat /etc/pass', 13).candidatos.join(' '), 'passwd passwd-');
  igual(sh.completa('ls /etc/sub', 11).candidatos.join(' '), 'subgid subgid- subuid subuid-');
  igual(corre(sh, 'ls /etc').avisos.length, 0);
  // en la máquina real: 136 carpetas y 232 nombres sin los ocultos
  igual(corre(sh, 'ls -d /etc/*/ | wc -l').stdout, '136\n');
  igual(corre(sh, 'ls /etc | wc -l').stdout, '232\n');
  igual(corre(sh, 'cat /etc/passwd-').stdout, corre(sh, 'cat /etc/passwd').stdout);
});
prueba('env -u quita la variable; LANG=C: sin ayuda en español y con nota', () => {
  const { sh } = nuevo();
  igual(corre(sh, 'env -u LANG env | grep -c ^LANG=').stdout, '0\n');
  igual(corre(sh, 'env -u HOME printenv HOME; echo $?').stdout, '1\n');
  igual(corre(sh, 'env -u HOME HOME=/tmp printenv HOME').stdout, '/tmp\n');
  const r = corre(sh, 'LANG=C ls --help');
  igual(r.stdout, ''); cierto(/solo tiene la ayuda de ls en español/.test(r.avisos.join()));
  cierto(/en tu Ubuntu saldrían en inglés/.test(corre(sh, 'LC_ALL=C ls /nada').notas.join()));
  igual(corre(sh, 'ls /nada').notas.length, 0);
  cierto(/^Modo de empleo: ls/.test(corre(sh, 'LANG=es_ES.UTF-8 ls --help').stdout));
});
prueba('M8: salir cuenta con exit, no con el botón de cerrar la ventana', () => {
  const m = L.misiones['ut4-m8'].generar(77);
  const i = m.tareas.findIndex((t) => t.solucion.includes('exit'));
  const con = (hacer) => { const sis = L.crea(Object.assign({ fecha: FECHA }, m.escenario)); const sh = sis.sesion(); hacer(sis, sh); return L.estadoMision(m, sis, sh, null)[i]; };
  igual(con((sis, sh) => sh.ejecuta('exit')), true);
  // lo que hace el botón de cerrar de la terminal (linux-term.js, cierraVentana)
  igual(con((sis) => { L.registra(sis, { tipo: 'salir', ventana: true }); sis.sesionCerrada = true; }), false);
});
prueba('tamaño de la letra: escalones, columnas y programas que caben', () => {
  const E = L.ESCALAS_LETRA;
  cierto(E.includes(1) && E.every((v, i) => !i || v > E[i - 1]), 'escalones ordenados y con el 100 %');
  // la terminal de una misión con árbol: unos 920 px de texto con letra de 26 px (JetBrains Mono: 0,6 em)
  const cols = E.map((v) => L.columnasTerminal(920, 26 * 0.6 * v));
  igual(cols[E.indexOf(1)], 58);
  cierto(cols[E.length - 1] >= 38, 'al máximo caben unas 40 columnas: ' + cols[E.length - 1]);
  cierto(cols.every((c, i) => !i || c < cols[i - 1]), 'al ampliar, menos columnas');
  const sinCol = (t) => sinColor(t).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  E.forEach((v) => {
    const c = L.columnasTerminal(920, 26 * 0.6 * v), f = L.filasTerminal(600, 26 * 1.32 * v);
    const { sh } = nuevo();
    const ls = sh.ejecuta('ls /usr/bin', { columnas: c });
    cierto(sinCol(ls.stdout).split('\n').every((l) => l.length <= c), `ls a ${c} columnas`);
    for (const o of ['nano /etc/hostname', 'top', 'man ls']) {
      const r = sh.ejecuta(o, { columnas: c, lineas: f, teclas: o === 'nano /etc/hostname' ? ['Ctrl+X'] : ['q'] });
      const p = r.pantallas[0].split('\n');
      igual(p.length, f, `${o}: filas a ${Math.round(v * 100)} %`);
      cierto(p.every((l) => L.util.anchoTexto(sinCol(l)) <= c), `${o}: a ${c} columnas ninguna línea se pasa`);
    }
  });
});
prueba('command-not-found: LS, erratas y paquetes', () => {
  const { sh } = nuevo();
  igual(corre(sh, 'LS').stderr, 'LS: no se encontró la orden\n');
  cierto(/^No se ha encontrado la orden «sl», pero se puede instalar con:/.test(corre(sh, 'sl').stderr));
});
prueba('XDG, date con formato y dpkg-reconfigure', () => {
  const { sh } = nuevo();
  igual(corre(sh, 'echo $XDG_SESSION_TYPE $XDG_CURRENT_DESKTOP').stdout, 'wayland ubuntu:GNOME\n');
  igual(corre(sh, 'date +%d/%m/%Y').stdout, '21/11/2026\n');
  igual(corre(sh, 'date "+%A %B"').stdout, 'sábado noviembre\n');
  igual(corre(sh, 'dpkg-reconfigure gdm3').stderr, '/usr/sbin/dpkg-reconfigure debe ejecutarse como root\n');
});
prueba('respuestas: espacios, unidades y barra final; mayúsculas y tildes cuentan salvo en lenguaje corriente', () => {
  const n = L.normalizaRespuesta, c = L.coincideRespuesta;
  igual(n(' 12 GB '), n('12G')); igual(n('12 GiB'), n('12g')); igual(n('7,5G'), n('7.5 GB')); igual(n('/home/ana/'), '/home/ana');
  igual(n('Sí', true), n('si', true)); igual(n('GNU/Linux.', true), n('gnu/linux', true));
  cierto(n('sda3') !== n('sda4'));
  // F1: opciones, rutas, archivos y dispositivos distinguen mayúsculas y tildes
  for (const [mala, buena] of [['-s', '-S'], ['-R', '-r'], ['-N', '-n'], ['/HOME/MARTA', '/home/marta'], ['/dev/SDA3', '/dev/sda3'], ['montana.jpg', 'montaña.jpg'], ['BASH', 'bash'], ['TTY6', 'tty6']]) cierto(!c(mala, [buena]), mala);
  // F10: un número con su unidad detrás
  cierto(c('4 paquetes', ['4']) && c('0 segundos', ['0']) && c('8 grupos', ['8']) && !c('4 paquetes', ['5']), 'número con unidad');
});
prueba('misiones de la UT4: respuestas razonables que valen y malas que no (F1, F10)', () => {
  const ctx = (m, s) => { const sis = L.crea(Object.assign({ fecha: FECHA }, m.escenario)); const sh = sis.sesion(); return { sis, sh, e: L.contextoMision(sis, sh) }; };
  const rep = L.bancoRepasoUT4;
  const tarea = (tipo, re) => rep.filter((x) => x[0] === tipo).map((x) => x[1](L.util.azar(1)).t).find((t) => re.test(t.html));
  const ls = tarea('ayuda', /ls/), un = tarea('ayuda', /uname/), ca = tarea('ayuda', /cat/);
  cierto(ls.comprueba({}, ['-S']) && ls.comprueba({}, ['--sort=size']) && !ls.comprueba({}, ['-s']), 'ls -S');
  cierto(un.comprueba({}, ['--kernel-release']) && !un.comprueba({}, ['-R']), 'uname -r');
  cierto(!ca.comprueba({}, ['-N']) && ca.comprueba({}, ['--number']), 'cat -n');
  cierto(/mayúsculas/.test(ls.avisa(['-s'], {})) &&/mayúsculas/.test(un.avisa(['-R'], {})), 'aviso de mayúsculas');
  const m1 = L.misiones['ut4-m1'].generar(107); const c1 = ctx(m1);
  cierto(m1.tareas[1].comprueba(c1.e, ['/home/' + c1.sis.esc.usuario + '/']) && !m1.tareas[1].comprueba(c1.e, ['/HOME/' + c1.sis.esc.usuario.toUpperCase()]), 'M1 t2');
  const m4 = L.misiones['ut4-m4'].generar(103); const c4 = ctx(m4); const sw = m4.tareas[1].esperado(c4.e)[0];
  cierto(m4.tareas[1].comprueba(c4.e, [sw + ' [SWAP]']) && !m4.tareas[1].comprueba(c4.e, ['/dev/' + sw.toUpperCase()]), 'M4 t2');
  const m6 = L.misiones['ut4-m6'].generar(101); const c6 = ctx(m6); const tty = m6.tareas[1].esperado(c6.e)[0];
  cierto(m6.tareas[1].comprueba(c6.e, ['/dev/' + tty]) && !m6.tareas[1].comprueba(c6.e, [tty.toUpperCase()]), 'M6 t2');
  const dia = m6.tareas[4].esperado(c6.e)[0], abre = { domingo: 'do', lunes: 'lu', martes: 'ma', 'miércoles': 'mi', jueves: 'ju', viernes: 'vi', 'sábado': 'sá' }[dia];
  cierto(m6.tareas[4].comprueba(c6.e, [abre]) && m6.tareas[4].comprueba(c6.e, [dia.toUpperCase()]), 'M6 t5');
  for (let s = 0; s < 40; s++) {
    const m = L.misiones['ut4-m6'].generar(s * 7 + 1); const c = ctx(m); const t = m.tareas[5]; const bien = t.esperado(c.e)[0];
    if (/^\d\d\/\d\d\/\d{4}$/.test(bien)) cierto(t.comprueba(c.e, [bien.replace(/^0/, '').replace(/\/0/, '/')]), 'M6 t6 sin ceros ' + bien);
    if (/^[a-z]+$/.test(bien)) cierto(/abreviatura/.test(t.avisa([bien.slice(0, 3)], c.e)), 'M6 t6 abreviatura');
  }
  const m3 = L.misiones['ut4-m3'].generar(103); const c3 = ctx(m3); const g = m3.tareas[3].esperado(c3.e)[0];
  cierto(m3.tareas[3].comprueba(c3.e, ['gcc ' + g]), 'M3 t4');
  cierto(m3.tareas[4].comprueba(c3.e, ['gnu/linux']) && /ejecútala/.test(m3.tareas[4].avisa(['-o'], c3.e)), 'M3 t5');
  const m8 = L.misiones['ut4-m8'].generar(103); const c8 = ctx(m8);
  cierto(m8.tareas[0].comprueba(c8.e, ['/usr/local/sbin/']), 'M8 t1');
  const v = m8.tareas[1].esperado(c8.e)[0], nom = /HOME|LANG|USER|LOGNAME/.exec(m8.tareas[1].html)[0];
  cierto(m8.tareas[1].comprueba(c8.e, [nom + '=' + v]), 'M8 t2');
});
prueba('misiones de la UT4: tareas que solo valen hechas como se pide (F11)', () => {
  const corriendo = (m, lineasOrd, opc) => { const sis = L.crea(Object.assign({ fecha: FECHA }, m.escenario)); const sh = sis.sesion(); lineasOrd.forEach((l) => sh.ejecuta(l, opc || {})); return L.contextoMision(sis, sh); };
  const m1 = L.misiones['ut4-m1'].generar(3);
  cierto(!m1.tareas[5].comprueba(corriendo(m1, ['pwd; clear'])) && m1.tareas[5].comprueba(corriendo(m1, ['clear; pwd'])), 'M1 t6: el orden cuenta');
  // N6 (22-11-2026): con && también están en la misma línea, una detrás de otra
  cierto(m1.tareas[5].comprueba(corriendo(m1, ['clear && pwd'])) && !m1.tareas[5].comprueba(corriendo(m1, ['pwd && clear'])), 'M1 t6: clear && pwd vale');
  // N4: el enunciado de free no lleva escrita la respuesta
  for (let s = 1; s <= 60; s++) { const h = L.misiones['ut4-m2'].generar(s).tareas[1].html; cierto(!/free/.test(h), 'M2 t2 con la respuesta en el enunciado: ' + h); }
  const m2 = L.misiones['ut4-m2'].generar(3);
  cierto(m2.tareas[4].comprueba(corriendo(m2, ['help history', 'history -c; clear'])), 'M2 t5: history -c; clear');
  const ping = L.bancoRepasoUT4.find((x) => x[0] === 'teclas')[1]().t;
  const mr = { escenario: {} };
  cierto(!ping.comprueba(corriendo(mr, ['ping 8.8.8.8'], { ctrlCTras: 2 })), 'repaso: ping a otra IP');
  cierto(ping.comprueba(corriendo(mr, ['ping 10.0.2.2'], { ctrlCTras: 2 })), 'repaso: ping a 10.0.2.2');
  const hist = L.bancoRepasoUT4.find((x) => x[0] === 'historial')[1]().t;
  cierto(hist.comprueba(corriendo(mr, ['history -c; history'])), 'repaso: history -c; history');
  // M2 t2: cada búsqueda da una lista corta con la orden
  for (let s = 0; s < 80; s++) {
    const m = L.misiones['ut4-m2'].generar(s * 13 + 5); const t = m.tareas[1];
    const sis = L.crea(Object.assign({ fecha: FECHA }, m.escenario)); const sh = new L.Sesion(sis, { interactiva: false, sinTty: true });
    const salida = sh.ejecuta(t.solucion[0]).stdout.split('\n').filter(Boolean);
    cierto(salida.length <= 10 && salida.some((l) => l.startsWith(t.esperado({})[0] + ' (')), `M2 t2 ${t.solucion[0]}: ${salida.length} líneas`);
  }
});
prueba('avisos y notas: una nota no es un fallo', () => {
  const { sh } = nuevo();
  const r = corre(sh, 'man bash', { teclas: ['q'] });
  igual(r.avisos.length, 0); igual(r.notas.length, 1);
});
// las demostraciones de ut04/index.html (o, si no está, las listas del guion)
{
  const { leeDemos, ejecutaDemo, demosDelGuion } = require('./linux-demos.js');
  const fsx = require('fs');
  const ruta = path.join(__dirname, '..', 'ut04', 'index.html');
  const demos = fsx.existsSync(ruta) ? leeDemos(fsx.readFileSync(ruta, 'utf8')) : demosDelGuion();
  demos.forEach((d) => prueba(`demostración «${d.diapositiva}»`, () => {
    const graves = ejecutaDemo(L, d).filter((p) => !p.leve);
    if (graves.length) throw new Error(graves.map((p) => `paso ${p.paso} «${p.orden}»: ${p.problema}`).join('; '));
  }));
}

/* ================= misiones ================= */
const SEMILLAS = rapido ? 20 : 300;
// lo que puede salir por la salida de errores sin ser un fallo: la contraseña de sudo, update-grub, exit
const ERR_ADMITIDOS = [/^\[sudo\] contraseña para \w+: $/, /^Sourcing file/, /^Generating grub/, /^Found /, /^Warning: os-prober/, /^Adding boot menu/, /^done$/, /^exit$/, /^Systems on them/, /^Check GRUB_DISABLE/];
const erroresDe = (t) => sinColor(t || '').split('\n').filter((l) => l && !ERR_ADMITIDOS.some((x) => x.test(l))).join('\n');
// los pasos de una misión con la fecha fija; las fechas del escenario (M6) mandan
const creaMision = (m) => L.crea(Object.assign({ fecha: FECHA }, m.escenario));
for (const id of Object.keys(L.misiones)) {
  prueba(`misión ${id}: ${SEMILLAS} semillas`, () => {
    const vistas = new Set();
    for (let s = 0; s < SEMILLAS; s++) {
      const m = L.misiones[id].generar(s * 7919 + 13);
      cierto(m.tarea && m.variante !== undefined && m.variantes > 0, 'falta tarea o variante');
      cierto(m.tareas.every((t) => /<u>[^<]+<\/u>/.test(t.html) && t.pista && t.corta), 'texto de una tarea');
      cierto(m.solucion.length && m.tareas.every((t, i) => t.solucion.length || i > 0), 'falta la solución');
      // UT4: la primera pista no da la orden (la da la segunda); ninguna tarea necesita ip r, que la unidad no enseña
      if (id.startsWith('ut4-')) m.tareas.forEach((t, i) => {
        const ords = (t.solucion || []).map((p) => L.pasoMision(p).orden).filter((o) => !/--help$/.test(o));
        cierto(!ords.some((o) => o.includes(' ') && t.pista.includes(o)), `${id} tarea ${i + 1}: la primera pista da la orden (${t.pista})`);
        cierto(!(t.solucion || []).some((p) => /^ip r/.test(L.pasoMision(p).orden)), `${id} tarea ${i + 1}: ip r`);
        cierto([...t.html.matchAll(/<b>([^<]*)<\/b>/g)].every((x) => !/\s/.test(x[1]) || /^(ping 10\.0\.2\.2|Ctrl\s\+\s[A-Z])$/.test(x[1])), `${id} tarea ${i + 1}: letra de código para palabras corrientes (${t.html})`);
      });
      vistas.add(m.variante);
      const sis = creaMision(m);
      const sh = sis.sesion();
      const resp = [];
      // las respuestas correctas no se aceptan mal escritas
      m.tareas.forEach((t, i) => {
        if (t.tipo !== 'respuesta') return;
        const mal = (t.casillas || [1]).map(() => 'zz9');
        if (t.comprueba(L.contextoMision(sis, sh), mal)) throw new Error(`semilla ${s}: la tarea ${i + 1} acepta una respuesta mala`);
      });
      let hechas = L.estadoMision(m, sis, sh, null, resp);
      if (hechas.some(Boolean)) throw new Error(`semilla ${s}: sin hacer nada ya pasa la tarea ${hechas.indexOf(true) + 1}`);
      m.tareas.forEach((t, i) => {
        const salidas = [];
        for (const paso of t.solucion) {
          const r = L.ejecutaPaso(sh, paso);
          const err = erroresDe(r.stderr);
          if (err || r.avisos.length) throw new Error(`semilla ${s}: «${r.linea}» da ${err || r.avisos.join()}`);
          salidas.push(sinColor(r.stdout + (r.pantallas || []).join('\n')));
          hechas = L.estadoMision(m, sis, sh, hechas, resp);
        }
        // la respuesta, sacada de lo que han escrito las órdenes de la solución
        if (t.tipo === 'respuesta') {
          const e = L.contextoMision(sis, sh);
          const v = t.deSalida(salidas, e);
          if (!t.comprueba(e, v)) throw new Error(`semilla ${s}: tarea ${i + 1} (${t.corta}): de la salida sale ${JSON.stringify(v)} y se espera ${JSON.stringify(t.esperado(e))}\n${salidas.join('\n---\n').slice(0, 1500)}`);
          resp[i] = v;
          hechas = L.estadoMision(m, sis, sh, hechas, resp);
        }
      });
      const falta = hechas.indexOf(false);
      if (falta >= 0) throw new Error(`semilla ${s}: con la solución no pasa la tarea ${falta + 1} (${m.tareas[falta].corta})`);
      // cada tarea de estado o evento por separado: hacer las demás no la cumple
      for (let k = 0; k < m.tareas.length && s < 40; k++) {
        if (m.tareas[k].tipo === 'respuesta' || !m.tareas[k].solucion.length) continue;
        if (m.tareas.some((t, j) => j > k && t.despues === k) || m.tareas[k].despues !== undefined) continue;
        const sis2 = creaMision(m);
        const sh2 = sis2.sesion();
        let h2 = L.estadoMision(m, sis2, sh2, null);
        m.tareas.forEach((t, j) => { if (j !== k) t.solucion.forEach((o) => { L.ejecutaPaso(sh2, o); h2 = L.estadoMision(m, sis2, sh2, h2); }); });
        if (h2[k] && !['primeros-pasos', 'estructura'].includes(id)) throw new Error(`semilla ${s}: la tarea ${k + 1} pasa sin hacerla`);
      }
    }
    cierto(vistas.size > 1, 'todas las semillas dan la misma variante');
  });
}

/* ================= fidelidad con la Ubuntu real ================= */
let comparacion = null, comparacionSom = [], comparacionEs = [];
if (!rapido) {
  const { compara, comparaUbuntuSom, comparaManpagesEs } = require('./linux-compara.js');
  comparacion = compara();
  comparacionSom = comparaUbuntuSom();
  comparacionSom.forEach((c) => { total++; if (c.bien) bien++; else fallos.push('Ubuntu-SOM con UEFI (21-11-2026): ' + c.caso.orden + (c.error ? ' (error del simulador)' : '')); });
  comparacionEs = comparaManpagesEs();
  comparacionEs.forEach((c) => { total++; if (c.bien) bien++; else fallos.push('manpages-es (21-11-2026): ' + c.caso.orden + (c.caso.sinManpagesEs ? ' [sin el paquete]' : '') + (c.error ? ' (error del simulador)' : '')); });
  if (comparacion) {
    comparacion.forEach((c) => { total++; if (c.bien) bien++; else fallos.push('Ubuntu real: ' + c.caso.orden + (c.error ? ' (error del simulador)' : '')); });
  }
}

console.log(`${bien} de ${total} pruebas correctas`);
if (comparacion) console.log(`  de ellas, ${comparacion.filter((c) => c.bien).length} de ${comparacion.length} comparaciones con la Ubuntu real (herramientas/linux-real.json)`);
if (comparacionSom.length) console.log(`  y ${comparacionSom.filter((c) => c.bien).length} de ${comparacionSom.length} con la máquina Ubuntu-SOM con UEFI (21-11-2026)`);
if (comparacionEs.length) console.log(`  y ${comparacionEs.filter((c) => c.bien).length} de ${comparacionEs.length} con manpages-es instalado (copia temporal, 21-11-2026)`);
fallos.forEach((f) => console.log('  FALLA ' + f));
process.exit(fallos.length ? 1 : 0);
