/* Simulador de Linux · órdenes (3), lo que añade la UT4: GRUB (update-grub y grub.cfg), systemctl status
 * display-manager, info, man -k / apropos / whatis, nano, un vi mínimo, dpkg-reconfigure y el registro de
 * eventos para las misiones. Las salidas y mensajes se copiaron de la máquina de pruebas (21-11-2026).
 */
(function (raiz) {
  'use strict';
  const SOM = (raiz.SOM = raiz.SOM || {});
  const L = (SOM.linux = SOM.linux || {});
  const U = L.util, ErrorSis = L.ErrorSis;
  const O = (L.ordenes = L.ordenes || {});
  const INV = (t) => `\x1b[7m${t}\x1b[27m`;
  const qq = (s) => '«' + s + '»';

  /* ---------------- registro de eventos (para las misiones) ----------------
   * sis.registro: [{tipo:'linea', texto, arbol} | {tipo:'ayuda', programa, tema} | {tipo:'tecla', tecla, orden}
   * | {tipo:'ping', destino, transmitidos, recibidos} | {tipo:'salir'}] */
  L.registra = function (sis, ev) { (sis.registro = sis.registro || []).push(Object.assign({ cuando: sis.ahora() }, ev)); };

  /* ---------------- GRUB ----------------
   * grub.cfg se fabrica con la salida real de grub-mkconfig de la máquina de pruebas, cambiando lo que depende de
   * /etc/default/grub (bloque del tiempo de espera, entrada por defecto y opciones de la línea linux), del núcleo y
   * del disco. El bloque del tiempo de espera sigue a util/grub.d/00_header.in de grub 2.12. */
  const PLANTILLA_GRUB = () => (L.datos && L.datos.grubCfg) || '';
  function leeDefaultGrub(texto) {
    const v = {};
    String(texto).split('\n').forEach((l) => {
      const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m) return;
      let x = m[2].trim();
      if (/^".*"$/.test(x) || /^'.*'$/.test(x)) x = x.slice(1, -1);
      v[m[1]] = x;
    });
    return v;
  }
  L.leeDefaultGrub = leeDefaultGrub;
  function bloqueEspera(estilo, t) {
    let s = 'if [ "${recordfail}" = 1 ] ; then\n  set timeout=30\nelse\n';
    s += `  if [ x$feature_timeout_style = xy ] ; then\n    set timeout_style=${estilo}\n    set timeout=${t}\n`;
    if (estilo === 'menu') s += `  # Fallback normal timeout code in case the timeout_style feature is\n  # unavailable.\n  else\n    set timeout=${t}\n`;
    else s += `  # Fallback hidden-timeout code in case the timeout_style feature is\n  # unavailable.\n  elif sleep --interruptible ${t} ; then\n    set timeout=0\n`;
    return s + '  fi\nfi\n';
  }
  L.generaGrubCfg = function (sis) {
    let t = PLANTILLA_GRUB();
    const v = leeDefaultGrub(sis.lee('/etc/default/grub'));
    const estilo = v.GRUB_TIMEOUT_STYLE || 'menu';
    const espera = v.GRUB_TIMEOUT !== undefined && v.GRUB_TIMEOUT !== '' ? v.GRUB_TIMEOUT : '5';
    t = t.replace(/if \[ "\$\{recordfail\}" = 1 \] ; then\n  set timeout=30\nelse\n[\s\S]*?\n  fi\nfi\n/, bloqueEspera(estilo, espera));
    t = t.replace('   set default="0"', `   set default="${/^\d+$/.test(v.GRUB_DEFAULT || '0') ? v.GRUB_DEFAULT || '0' : v.GRUB_DEFAULT}"`);
    const args = `ro ${v.GRUB_CMDLINE_LINUX || ''} ${v.GRUB_CMDLINE_LINUX_DEFAULT || ''}`;
    t = t.replace(/ro  quiet splash \$vt_handoff/g, args + ' $vt_handoff');
    t = t.replace(/7\.0\.0-43-generic/g, sis.nucleo.version);
    t = t.replace(/gpt2/g, sis.disco.raizGpt);
    return t;
  };
  O['update-grub'] = function* (c) { return yield* grubMkconfig(c, true); };
  O['grub-mkconfig'] = function* (c) {
    if (c.args[0] === '--help' || c.args[0] === '-h') { c.sale('Usage: grub-mkconfig [OPTION]\nGenerate a grub config file\n\n  -o, --output=FILE       output generated config to FILE [default=stdout]\n  -h, --help              print this message and exit\n  -V, --version           print the version information and exit\n\nReport bugs to <bug-grub@gnu.org>.\n'); return 0; }
    let salida = null;
    for (let i = 0; i < c.args.length; i++) { if (c.args[i] === '-o') salida = c.args[++i]; else if (c.args[i].startsWith('--output=')) salida = c.args[i].slice(9); }
    return yield* grubMkconfig(c, false, salida);
  };
  function* grubMkconfig(c, esUpdate, salida) {
    if (c.uid !== 0) { c.err('grub-mkconfig: You must run this as root\n'); return 1; }
    const sis = c.sis;
    const v = leeDefaultGrub(sis.lee('/etc/default/grub'));
    const k = sis.nucleo.version;
    const destino = esUpdate ? '/boot/grub/grub.cfg' : salida;
    c.err("Sourcing file `/etc/default/grub'\nGenerating grub configuration file ...\n");
    yield { tipo: 'espera', ms: 400 };
    c.err(`Found linux image: /boot/vmlinuz-${k}\nFound initrd image: /boot/initrd.img-${k}\nFound memtest86+ 64bit EFI image: /boot/memtest86+x64.efi\n`);
    yield { tipo: 'espera', ms: 400 };
    if (v.GRUB_DISABLE_OS_PROBER !== 'false') c.err('Warning: os-prober will not be executed to detect other bootable partitions.\nSystems on them will not be added to the GRUB boot configuration.\nCheck GRUB_DISABLE_OS_PROBER documentation entry.\n');
    else c.err('Warning: os-prober will be executed to detect other bootable partitions.\nIts output will be used to detect bootable binaries on them and create new boot entries.\n');
    c.err('Adding boot menu entry for UEFI Firmware Settings ...\n');
    // lo que en Ubuntu daría un error o un valor que GRUB no entiende: el simulador no lo escribe igual, lo avisa
    const lineasMal = String(sis.lee('/etc/default/grub') || '').split('\n').filter((l) => /^\s*GRUB_\w+\s+=|^\s*GRUB_\w+=\s/.test(l));
    // lo que dice la nota es lo mismo que usa grub.cfg (y la vista del arranque): el valor de otra línea buena o,
    // si no la hay, el que se usa cuando falta la variable
    if (lineasMal.length) {
      const linea = lineasMal[0].trim(), nombre = linea.match(/^GRUB_\w+/)[0];
      const queda = v[nombre] !== undefined ? `vale la otra línea, ${nombre}=${v[nombre]}`
        : nombre === 'GRUB_TIMEOUT' ? 'la variable se queda sin valor: sin ella, el menú espera 5 segundos'
          : nombre === 'GRUB_TIMEOUT_STYLE' ? 'la variable se queda sin valor: sin ella, el menú se enseña (menu)'
            : 'la variable se queda sin valor';
      c.aviso(`En /etc/default/grub, «${linea}» lleva espacios alrededor del =. En Ubuntu, update-grub da un error con esa línea y ${queda}; el simulador no escribe ese error. Escríbela sin espacios: ${linea.replace(/\s*=\s*/, '=')}`);
    }
    if (v.GRUB_TIMEOUT_STYLE !== undefined && !['menu', 'countdown', 'hidden'].includes(v.GRUB_TIMEOUT_STYLE)) c.aviso(`GRUB_TIMEOUT_STYLE=${v.GRUB_TIMEOUT_STYLE}: GRUB solo entiende menu, countdown o hidden, en minúsculas. El simulador no sabe qué haría GRUB con otro valor; escribe uno de esos tres.`);
    if (v.GRUB_TIMEOUT !== undefined && !/^-?\d+$/.test(v.GRUB_TIMEOUT)) c.aviso(`GRUB_TIMEOUT=${v.GRUB_TIMEOUT}: el tiempo de espera es un número de segundos, sin nada más.`);
    const cfg = L.generaGrubCfg(sis);
    if (!destino) c.sale(cfg);
    else {
      try {
        const r = c.resuelve(destino, { faltaUltimo: true });
        let ino = r.ino;
        if (!ino) { ino = c.fs.nuevo('-', 0o600, 0, 0, { datos: '' }); c.fs.enlaza(r.padre, r.nombre, ino, c.rutaAbs(destino)); }
        delete ino.tam;
        c.fs.escribe(ino, cfg, false, c.rutaAbs(destino));
        ino.modo = 0o600;
      } catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`grub-mkconfig: ${destino}: ${L.ERR[e.codigo]}\n`); return 1; }
    }
    c.err('done\n');
    return 0;
  }

  /* ---------------- systemctl status display-manager ---------------- */
  O.systemctl = function* (c) {
    const a = c.args.filter((x) => !/^--no-pager$|^-l$|^--full$/.test(x));
    const unidad = (a[1] || '').replace(/\.service$/, '');
    if (a[0] === 'status' && ['display-manager', 'gdm', 'gdm3'].includes(unidad)) {
      const sis = c.sis, equipo = sis.lee('/etc/hostname').trim();
      const inicio = sis.arranque + 18000;
      const seg = Math.floor((c.ahora() - inicio) / 1000);
      const hace = seg < 60 ? `${seg}s ago` : seg < 3600 ? `${Math.floor(seg / 60)}min ${seg % 60}s ago` : `${Math.floor(seg / 3600)}h ${Math.floor((seg % 3600) / 60)}min ago`;
      const desde = `${U.DIAS_EN[U.partes(inicio).sem]} ${U.strftime('%Y-%m-%d %H:%M:%S %Z', inicio)}`;
      const t = U.strftime('%b %d %H:%M:%S', inicio);
      const v = c.ttyOut ? (x) => `\x1b[0;1;32m${x}\x1b[0m` : (x) => x;
      const lineas = [
        `${v('●')} gdm.service - GNOME Display Manager`,
        '     Loaded: loaded (/usr/lib/systemd/system/gdm.service; static)',
        `     Active: ${v('active (running)')} since ${desde}; ${hace}`,
        '    Process: 1305 ExecStartPre=/usr/share/gdm/generate-config (code=exited, status=0/SUCCESS)',
        '   Main PID: 1313 (gdm3)',
        '      Tasks: 4 (limit: 3453)',
        '     Memory: 5.5M (peak: 6.5M)',
        '        CPU: 93ms',
        '     CGroup: /system.slice/gdm.service',
        '             └─1313 /usr/sbin/gdm3',
        '',
        `${t} ${equipo} systemd[1]: Starting gdm.service - GNOME Display Manager...`,
        `${t} ${equipo} systemd[1]: Started gdm.service - GNOME Display Manager.`,
        `${t} ${equipo} gdm-launch-environment][1320]: pam_unix(gdm-launch-environment:session): session opened for user gdm(uid=120) by (uid=0)`
      ];
      if (!c.ttyOut) { c.sale(lineas.join('\n') + '\n'); return 0; }
      // en la terminal sale con less (sin partir las líneas largas) y se cierra con q
      const p = L.paginador(lineas.join('\n') + '\n', 'systemctl', 'gdm');
      yield { tipo: 'programa', programa: p };
      return 0;
    }
    c.aviso(`El simulador todavía no tiene «systemctl ${a.join(' ')}» (se ve en la UT7). En la UT4 solo está systemctl status display-manager.`);
    return 1;
  };
  O['dpkg-reconfigure'] = function* (c) {
    if (c.uid !== 0) { c.err('/usr/sbin/dpkg-reconfigure debe ejecutarse como root\n'); return 1; }
    c.aviso(`El simulador no tiene las preguntas de dpkg-reconfigure${c.args[0] ? ' ' + c.args[0] : ''}. En tu Ubuntu se elige con las flechas, Tab para ir a Aceptar e Intro.`);
    return 1;
  };

  O.hostname = function* (c) {
    if (c.args.length && c.args[0][0] === '-' && !['-s', '--short'].includes(c.args[0])) return c.sinOpcion(c.args[0]);
    if (c.args.length && c.args[0][0] !== '-') { if (c.uid !== 0) { c.err('hostname: you must be root to change the host name\n'); return 1; } c.aviso('El simulador no cambia el nombre con hostname: usa sudo hostnamectl set-hostname.'); return 1; }
    c.sale(c.sis.lee('/etc/hostname').trim() + '\n');
    return 0;
  };

  /* ---------------- free: la memoria, de /proc/meminfo (procps 4: usado = total - disponible) ---------------- */
  const memoria = (sis) => {
    const m = {};
    sis.lee('/proc/meminfo').split('\n').forEach((l) => { const x = l.match(/^(\S+):\s+(\d+)/); if (x) m[x[1]] = +x[2]; });
    return m;
  };
  // como scale_size de procps: una cifra decimal si cabe en 5 caracteres; si no, entero redondeado
  function humanoFree(kib) {
    const bytes = kib * 1024;
    if (bytes < 1024) return bytes + 'B';
    const u = ['B', 'K', 'M', 'G', 'T', 'P'];
    for (let i = 1; i < u.length; i++) {
      const v = bytes / Math.pow(1024, i);
      let s = v.toFixed(1).replace('.', ',') + u[i] + 'i';
      if (s.length <= 5) return s;
      s = Math.round(v) + u[i] + 'i';
      if (s.length <= 5) return s;
    }
    return bytes + 'B';
  }
  O.free = function* (c) {
    let h = false, div = 1, total = false;
    for (const a of c.args) {
      if (a === '-h' || a === '--human') h = true;
      else if (a === '-b' || a === '--bytes') div = 1 / 1024;
      else if (a === '-k' || a === '--kibi') div = 1;
      else if (a === '-m' || a === '--mebi') div = 1024;
      else if (a === '-g' || a === '--gibi') div = 1048576;
      else if (a === '-t' || a === '--total') total = true;
      else if (a === '--help') { yield* L.ayudaDe(c, 'free'); return 0; }
      else return c.sinOpcion(a);
    }
    const m = memoria(c.sis);
    const tot = m.MemTotal, disp = m.MemAvailable, libre = m.MemFree, comp = m.Shmem || 0;
    const bc = (m.Buffers || 0) + (m.Cached || 0) + (m.SReclaimable || 0);
    const st = m.SwapTotal || 0, sl = m.SwapFree || 0;
    const f = (k) => (h ? humanoFree(k) : String(Math.floor(k / div)));
    const fila = (n, vs) => n.padEnd(8) + vs.map((v) => f(v).padStart(12)).join('');
    let t = ''.padEnd(8) + ['total', 'usado', 'libre', 'compartido', 'búf/caché', 'disponible'].map((x) => x.padStart(12)).join('') + '\n';
    t += fila('Mem:', [tot, tot - disp, libre, comp, bc, disp]) + '\n';
    t += fila('Inter:', [st, st - sl, sl]) + '\n';
    if (total) t += fila('Total:', [tot + st, tot - disp + st - sl, libre + sl]) + '\n';
    c.sale(t);
    return 0;
  };

  /* ---------------- efibootmgr: las entradas de arranque del firmware UEFI (las de Ubuntu-SOM) ---------------- */
  O.efibootmgr = function* (c) {
    const v = c.args.some((a) => /^-v+$/.test(a) || a === '--verbose');
    const otras = c.args.filter((a) => !/^-v+$/.test(a) && a !== '--verbose');
    if (otras.includes('--help') || otras.includes('-h')) { yield* L.ayudaDe(c, 'efibootmgr'); return 0; }
    if (otras.length) {
      if (c.uid !== 0) { c.err('Could not prepare Boot variable: Permission denied\n'); return 2; }
      c.aviso('El simulador no cambia las entradas de arranque del firmware: solo las enseña (efibootmgr o efibootmgr -v).');
      return 1;
    }
    const efi = c.sis.disco.particiones.find((p) => p.clave === 'efi');
    const num = c.sis.disco.particiones.indexOf(efi) + 1;
    const hex = (n) => '0x' + n.toString(16);
    const le = (n, b) => Array.from({ length: b }, (_, i) => ((n / Math.pow(256, i)) % 256 | 0).toString(16).padStart(2, '0')).join(' ');
    const guid = efi.guid.replace(/-/g, '');
    const guidLe = [guid.slice(6, 8), guid.slice(4, 6), guid.slice(2, 4), guid.slice(0, 2), guid.slice(10, 12), guid.slice(8, 10), guid.slice(14, 16), guid.slice(12, 14)].concat(guid.slice(16).match(/../g)).join(' ');
    const ruta = '\\EFI\\ubuntu\\shimx64.efi';
    const ruta16 = [...ruta].map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0') + ' 00').join(' ') + ' 00 00';
    let t = 'BootCurrent: 0003\nTimeout: 0 seconds\nBootOrder: 0003,0000,0002\n';
    t += 'Boot0000* UiApp\tFvVol(7cb8bdc9-f8eb-4f34-aaea-3ee4af6516a1)/FvFile(462caa21-7614-4503-836e-8ab6f4662331)\n';
    if (v) t += '      dp: 04 07 14 00 c9 bd b8 7c eb f8 34 4f aa ea 3e e4 af 65 16 a1 / 04 06 14 00 21 aa 2c 46 14 76 03 45 83 6e 8a b6 f4 66 23 31 / 7f ff 04 00\n';
    t += 'Boot0002* UEFI VBOX HARDDISK VB0bb8ad46-cad9bc4b \tPciRoot(0x0)/Pci(0xd,0x0)/Sata(0,65535,0){auto_created_boot_option}\n';
    if (v) t += '      dp: 02 01 0c 00 d0 41 03 0a 00 00 00 00 / 01 01 06 00 00 0d / 03 12 0a 00 00 00 ff ff 00 00 / 7f ff 04 00\n    data: 4e ac 08 81 11 9f 59 4d 85 0e e2 1a 52 2c 59 b2\n';
    t += `Boot0003* Ubuntu\tHD(${num},GPT,${efi.guid},${hex(efi.inicio)},${hex(efi.sectoresP)})/File(${ruta})\n`;
    if (v) t += `      dp: 04 01 2a 00 ${le(num, 4)} ${le(efi.inicio, 8)} ${le(efi.sectoresP, 8)} ${guidLe} 02 02 / 04 04 34 00 ${ruta16} / 7f ff 04 00\n`;
    c.sale(t);
    return 0;
  };

  /* ---------------- fdisk -l: la tabla de particiones (solo verla) ---------------- */
  O.fdisk = function* (c) {
    const a = c.args.slice();
    if (a.includes('--help') || a.includes('-h')) { yield* L.ayudaDe(c, 'fdisk'); return 0; }
    const listar = a.includes('-l') || a.includes('--list');
    const discos = a.filter((x) => x[0] !== '-');
    if (!listar) {
      if (c.uid !== 0 && discos.length) { c.err(`fdisk: no se puede abrir ${discos[0]}: Permiso denegado\n`); return 1; }
      c.aviso('El simulador no tiene el modo interactivo de fdisk (cambiaría la tabla de particiones). Para verla: sudo fdisk -l /dev/sda.');
      return 1;
    }
    const d = c.sis.disco;
    for (const x of discos) if (x !== '/dev/sda') { c.err(`fdisk: no se puede abrir ${x}: No existe el archivo o el directorio\n`); return 1; }
    if (c.uid !== 0) { if (discos.length) { c.err('fdisk: no se puede abrir /dev/sda: Permiso denegado\n'); return 1; } return 0; }
    const bytes = d.sectores * 512;
    let t = `Disco /dev/sda: ${L.tamLsblk(bytes).replace(/([KMGT])$/, ' $1iB')}, ${bytes} bytes, ${d.sectores} sectores\n`;
    t += 'Modelo de disco: VBOX HARDDISK   \nUnidades: sectores de 1 * 512 = 512 bytes\nTamaño de sector (lógico/físico): 512 bytes / 512 bytes\nTamaño de E/S (mínimo/óptimo): 512 bytes / 512 bytes\n';
    t += 'Tipo de etiqueta de disco: gpt\nIdentificador del disco: 3770D813-B779-4233-925E-511F93D337FB\n\n';
    const filas = d.particiones.map((p) => ['/dev/' + p.nombre, String(p.inicio), String(p.fin), String(p.sectoresP), L.tamLsblk(p.sectoresP * 512), p.tipoGpt]);
    const ancho = [10, 0, 0, 0, 0].map((m, k) => Math.max(m, ['Disposit.', 'Comienzo', 'Final', 'Sectores', 'Tamaño'][k].length, ...filas.map((f) => f[k].length)));
    const linea = (f) => f[0].padEnd(ancho[0]) + ' ' + [1, 2, 3, 4].map((k) => f[k].padStart(ancho[k])).join(' ') + ' ' + f[5];
    t += linea(['Disposit.', 'Comienzo', 'Final', 'Sectores', 'Tamaño', 'Tipo']) + '\n' + filas.map(linea).join('\n') + '\n';
    c.sale(t);
    if (!discos.length) c.nota('En tu Ubuntu, fdisk -l sin nada detrás enseña también los discos loop de los snaps (/dev/loop0…); el simulador enseña solo /dev/sda.');
    return 0;
  };

  /* ---------------- man -k, apropos y whatis ---------------- */
  /* man-db tiene dos bases de datos de descripciones: la de español (las páginas que hay en /usr/share/man/es) y la
   * general. man -k, apropos y whatis buscan primero en la de español y después en la general, sin repetir una
   * página (nombre y sección) que ya haya salido. linux-whatis.js es «apropos -l .» sin manpages-es: su bloque en
   * español acaba donde empieza la general (ldap.conf); linux-whatis-es.js es el bloque en español con el paquete. */
  function* cargaWhatis(c) {
    if (!L.whatis) yield { tipo: 'carga', archivo: 'linux-whatis.js' };
    const todas = (L.whatis || '').split('\n').filter(Boolean);
    const k = Math.max(0, todas.findIndex((l) => l.startsWith('ldap.conf (5)')));
    let es = todas.slice(0, k);
    if (L.manEs(c.sis)) { if (!L.whatisEs) yield { tipo: 'carga', archivo: 'linux-whatis-es.js' }; if (L.whatisEs) es = L.whatisEs.split('\n').filter(Boolean); }
    const g = ordenGeneral(todas.slice(k));
    return { es, primeras: g.primeras, general: g.porOrden, vacia: !todas.length };
  }
  /* En la base general, las páginas cuyo NAME empieza por «/» o «.» (/etc/adduser.conf, /proc/meminfo…, que se ven
   * como adduser.conf, proc_meminfo…) van al principio, antes de 00-upstream-settings. man -k las saca ahí cuando lo
   * buscado está en el nombre (man -k disk empieza por proc_diskstats); si solo está en la descripción, salen en su
   * sitio por orden alfabético (man -k memory). Comprobado en la máquina de pruebas (21-11-2026). */
  const nombreW = (l) => l.split(' (')[0];
  let ordenCache = { de: null };
  function ordenGeneral(general) {
    if (ordenCache.de === L.whatis && ordenCache.n === general.length) return ordenCache;
    const b = general.findIndex((l) => l.startsWith('00-upstream-settings (5)'));
    if (b < 0) return { primeras: [], porOrden: general };
    const primeras = general.slice(0, b), resto = general.slice(b);
    const nom = (l) => nombreW(l).toLowerCase();
    const delante = new Map();
    primeras.forEach((x) => {
      const n = nom(x);
      // el hueco del orden alfabético con los vecinos más parecidos (hay referencias que no están en orden)
      const comun = (a) => { let k = 0; while (k < a.length && a[k] === n[k]) k++; return k; };
      let j = resto.length, mejor = -1;
      for (let i = 1; i < resto.length; i++) {
        const p = nom(resto[i - 1]), q = nom(resto[i]);
        if (p <= n && n < q) { const s = Math.max(comun(p), comun(q)); if (s > mejor) { mejor = s; j = i; } }
      }
      if (!delante.has(j)) delante.set(j, []);
      delante.get(j).push(x);
    });
    const porOrden = [];
    const pon = (j) => (delante.get(j) || []).sort((x, y) => (nom(x) < nom(y) ? -1 : 1)).forEach((x) => porOrden.push(x));
    resto.forEach((l, i) => { pon(i); porOrden.push(l); });
    pon(resto.length);
    ordenCache = { de: L.whatis, n: general.length, primeras, porOrden };
    return ordenCache;
  }
  const clavePagina = (l) => l.split(' - ')[0].replace(/\s+$/, '');
  // lo que cumple la prueba, primero de la base en español y luego de la general (sin repetir página); de las
  // primeras de la general, al principio solo si lo buscado está en el nombre
  function buscaWhatis(db, prueba, enNombre) {
    const vistas = new Set(), out = [];
    const mete = (l) => { if (!vistas.has(clavePagina(l))) { out.push(l); vistas.add(clavePagina(l)); } };
    db.es.forEach((l) => { if (prueba(l)) mete(l); });
    db.primeras.forEach((l) => { if ((enNombre || prueba)(l)) mete(l); });
    db.general.forEach((l) => { if (prueba(l)) mete(l); });
    return out;
  }
  /* man-db corta la línea que no cabe en la terminal contando bytes, no letras: deja lo que quepa en columnas - 3 bytes
   * y añade «...». Antes, un nombre de más de 40 letras se queda en 37 y «...». El ancho es el de la terminal aunque la
   * salida vaya a una tubería (man -k memory | head), y 80 si no hay terminal. */
  const anchoMan = (c) => (c.ttyOut || c.ttyIn ? c.columnas : 80);
  const bytes = (s) => { let n = 0; for (const ch of s) { const k = ch.codePointAt(0); n += k < 0x80 ? 1 : k < 0x800 ? 2 : k < 0x10000 ? 3 : 4; } return n; };
  function recorta(l, cols) {
    const nom = nombreW(l);
    if (nom.length > 40) l = nom.slice(0, 37) + '...' + l.slice(nom.length);
    if (cols < 10 || bytes(l) <= cols) return l;
    let r = '', n = 0;
    for (const ch of l) { const b = bytes(ch); if (n + b > cols - 3) break; r += ch; n += b; }
    return r + '...';
  }
  L.apropos = function* (c, palabras) {
    const db = yield* cargaWhatis(c);
    if (db.vacia) { c.aviso('El simulador no ha podido cargar las descripciones de man -k.'); return 16; }
    const res = palabras.map((p) => { try { return new RegExp(p, 'i'); } catch (e) { return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); } });
    let cod = 0;
    res.forEach((re, i) => { if (!db.es.some((l) => re.test(l)) && !db.general.some((l) => re.test(l))) { c.err(`${palabras[i]}: nada apropiado.\n`); cod = 16; } });
    const hall = buscaWhatis(db, (l) => res.some((re) => re.test(l)), (l) => res.some((re) => re.test(nombreW(l))));
    hall.forEach((l) => c.sale(recorta(l, anchoMan(c)) + '\n'));
    L.registra(c.sis, { tipo: 'ayuda', programa: 'man -k', tema: palabras.join(' ') });
    return hall.length ? 0 : 16;
  };
  O.apropos = function* (c) {
    const pal = c.args.filter((x) => x[0] !== '-');
    if (!pal.length) { c.err('apropos ¿qué?\n'); return 1; }
    return yield* L.apropos(c, pal);
  };
  O.whatis = function* (c) {
    const pal = c.args.filter((x) => x[0] !== '-');
    if (!pal.length) { c.err('whatis ¿qué?\n'); return 1; }
    const db = yield* cargaWhatis(c);
    let cod = 0;
    pal.forEach((p) => {
      const estas = buscaWhatis(db, (l) => l.split(' (')[0] === p);
      if (!estas.length) { c.err(`${p}: nada apropiado.\n`); cod = 16; }
      estas.forEach((l) => c.sale(recorta(l, anchoMan(c)) + '\n'));
    });
    return cod;
  };

  /* ---------------- info ---------------- */
  O.info = function* (c) {
    const a = c.args.filter((x) => x[0] !== '-');
    if (c.args.includes('--version')) { c.sale('info (GNU texinfo) 7.1\n'); return 0; }
    if (!a.length) { c.aviso('El simulador no tiene el índice de info. Escribe info y una orden: info ls.'); return 0; }
    const n = a[0];
    if (!L.info) yield { tipo: 'carga', archivo: 'linux-info.js' };
    const nodo = L.info && L.info[n];
    L.registra(c.sis, { tipo: 'ayuda', programa: 'info', tema: n });
    if (nodo) {
      const cab = (nodo.match(/^File: (\S+)\.info,\s+Node: ([^,]+),/) || []);
      const texto = nodo + '\n';
      if (!c.ttyOut) { c.sale(texto); return 0; }
      const p = L.paginador(texto, 'info', `(${cab[1] || n})${cab[2] || 'Top'}`);
      yield { tipo: 'programa', programa: p };
      c.nota('El simulador solo copia el principio de ese apartado de info; en tu Ubuntu sigue con más páginas (espacio avanza, q sale).');
      return 0;
    }
    // sin manual de info: si hay página de man, info la enseña; si no, el error
    yield { tipo: 'carga', archivo: 'linux-ayuda.js' };
    const man = L.ayuda && L.ayuda.man && L.ayuda.man[n];
    let tiene = false;
    try { c.fs.resuelve(`/usr/share/man/man1/${n}.1.gz`, { uid: 0, gid: 0 }); tiene = true; } catch (e) { /* no */ }
    if (tiene && man && c.ttyOut) {
      const p = L.paginador(man, 'info', `(*manpages*)${n}`);
      p.aviso = `No existe ningún elemento de menú llamado '${n}' en el nodo '(dir)Top'`;
      yield { tipo: 'programa', programa: p };
      return 0;
    }
    c.err(`info: No existe ningún elemento de menú llamado '${n}' en el nodo '(dir)Top'\n`);
    return 1;
  };

  /* ---------------- nano ----------------
   * El editor a pantalla completa, con las barras de atajos de nano 7.2 en español. Teclas: flechas, Inicio, Fin,
   * Re Pág, Av Pág, Retroceso, Supr, Intro; Ctrl+O (y F3) guardar, Ctrl+X (y F2) salir, Ctrl+W (y F6) buscar,
   * Ctrl+K (y F9) cortar línea, Ctrl+U pegar, Ctrl+G ayuda. */
  const BARRA = [[['^G', 'Ayuda'], ['^O', 'Guardar'], ['^W', 'Buscar'], ['^K', 'Cortar'], ['^T', 'Ejecutar'], ['^C', 'Ubicación']],
    [['^X', 'Salir'], ['^R', 'Leer fich.'], ['^\\', 'Reemplazar'], ['^U', 'Pegar'], ['^J', 'Justificar'], ['^/', 'Ir a línea']]];
  const BARRA_BUSCAR = [[['^G', 'Ayuda'], ['M-C', 'Mayús/minús'], ['M-B', 'Ir atrás'], ['^P', 'Más viejo'], ['^T', 'Ir a línea']],
    [['^C', 'Cancelar'], ['M-R', 'Expr.reg.'], ['^R', 'Reemplazar'], ['^N', 'Más nuevo']]];
  const BARRA_ESCRIBIR = [[['^G', 'Ayuda'], ['M-D', 'Formato DOS'], ['M-A', 'Añadir'], ['M-B', 'Respaldar fichero']],
    [['^C', 'Cancelar'], ['M-M', 'Formato Mac'], ['M-P', 'Anteponer'], ['^T', 'Navegar']]];
  const BARRA_SALIR = [[[' S', 'Sí']], [[' N', 'No'], ['^C', 'Cancelar']]];
  /* La barra de atajos como la pinta nano 7 (bottombars): caben ((COLS + 40) / 20) * 2 atajos como mucho; cada
   * columna mide COLS / columnas (la última se queda lo que sobra) y la explicación se corta si no cabe. */
  function barra(filas, cols, anchoFijo) {
    if (anchoFijo) return filas.map((fila) => fila.map(([k, t], i) => INV(k) + ' ' + (i === fila.length - 1 ? t : (t + ' '.repeat(Math.max(1, anchoFijo - k.length - 1 - t.length))))).join(''));
    const numero = Math.min(filas[0].length + filas[1].length, Math.floor((cols + 40) / 20) * 2);
    const porFila = Math.max(1, Math.floor((numero + 1) / 2));
    const ancho = Math.floor(cols / porFila);
    return [0, 1].map((r) => {
      let s = '';
      for (let j = 0; j < porFila; j++) {
        const w = ancho + (j === porFila - 1 ? cols % ancho : 0);
        const it = filas[r][j];
        if (!it || j * 2 + r >= numero) { if (j < porFila - 1) s += ' '.repeat(w); continue; }
        const [k, t] = it;
        // nano 7 llena la columna hasta el atajo siguiente («Leer fich.^\ Reemplazar», también con 80 columnas). Se lee
        // mal, sobre todo en la terminal estrecha: el simulador deja siempre un espacio y corta la explicación una letra
        const resto = w - k.length - (j < porFila - 1 ? 1 : 0);
        const tag = resto >= 2 ? [...t].slice(0, resto - 1).join('') : '';
        s += INV(k) + (tag ? ' ' + tag : '');
        if (j < porFila - 1) s += ' '.repeat(Math.max(0, w - k.length - (tag ? 1 + [...tag].length : 0)));
      }
      return s;
    });
  }
  // corta una línea con colores a n columnas visibles
  function cortaA(l, n) {
    let k = 0, vis = 0;
    while (k < l.length) {
      if (l[k] === '\x1b') { const m = l.slice(k).match(/^\x1b\[[0-9;]*m/); if (m) { k += m[0].length; continue; } }
      if (vis >= n) return l.slice(0, k) + '\x1b[0m';
      vis++; k++;
    }
    return l;
  }
  function editorNano(c, ruta, texto, mensaje, soloLectura) {
    const st = { l: texto === null ? [''] : texto.replace(/\n$/, '').split('\n'), y: 0, x: 0, arriba: 0, mod: false, modo: 'editar', entrada: '', msj: mensaje, corte: [], ultimoCorte: false, busca: '' };
    if (texto === '') st.l = [''];
    let ultCols = 80, ultFilas = 24;
    const nombre = ruta;
    const guarda = (destino) => {
      const t = st.l.join('\n') + '\n';
      try {
        const r = c.resuelve(destino, { faltaUltimo: true });
        let ino = r.ino;
        if (ino && ino.tipo === 'd') throw new ErrorSis('EISDIR');
        if (!ino) {
          if (!c.fs.puede(c.cred, r.padre, 'w')) throw new ErrorSis('EACCES');
          ino = c.fs.nuevo('-', 0o666 & ~c.sh.umask(), c.uid, c.sh.gid, { datos: '' });
          c.fs.enlaza(r.padre, r.nombre, ino, c.rutaAbs(destino));
        } else if (!c.fs.puede(c.cred, ino, 'w')) throw new ErrorSis('EACCES');
        delete ino.tam;
        c.fs.escribe(ino, t, false, c.rutaAbs(destino));
        st.mod = false;
        const n = st.l.length;
        st.msj = n === 1 ? '[ 1 línea escrita ]' : `[ ${n} líneas escritas ]`;
        return true;
      } catch (e) {
        if (!(e instanceof ErrorSis)) throw e;
        st.msj = `[ Error al escribir ${destino}: ${L.ERR[e.codigo]} ]`;
        return false;
      }
    };
    const prog = {
      tipo: 'nano', titulo: 'nano',
      get modificado() { return st.mod; },
      pantalla(cols, filas) {
        ultCols = cols; ultFilas = filas;
        const out = [];
        const tit = nombre || 'Nuevo búfer';
        let cab = '  GNU nano 7.2';
        const centro = Math.max(cab.length + 2, Math.floor((cols - U.anchoTexto(tit)) / 2));
        cab = cab.padEnd(centro) + tit;
        if (st.mod) cab = cab.padEnd(cols - 11) + 'Modificado';
        out.push(INV(U.relleno(cab, cols)));
        const alto = filas - 4;
        if (st.y < st.arriba) st.arriba = st.y;
        if (st.y >= st.arriba + alto) st.arriba = st.y - alto + 1;
        for (let i = 0; i < alto; i++) {
          const n = st.arriba + i;
          if (n >= st.l.length) { out.push(''); continue; }
          let linea = st.l[n];
          let desde = 0;
          // la línea del cursor se desplaza como en nano 7.2 (get_page_start): desde que el cursor llega a la
          // penúltima columna; las demás líneas, desde el principio
          if (n === st.y) desde = L.inicioPaginaNano(st.x, cols);
          let vis = linea.slice(desde);
          let marcaFin = false;
          if (U.anchoTexto(vis) > cols) { vis = [...vis].slice(0, cols - 1).join(''); marcaFin = true; }
          if (n === st.y && st.modo === 'editar') {
            const cx = st.x - desde;
            const ch = vis[cx] || ' ';
            vis = vis.slice(0, cx) + INV(ch) + vis.slice(cx + 1);
          }
          out.push((desde ? '<' + vis.slice(1) : vis) + (marcaFin ? '>' : ''));
        }
        // línea de estado o pregunta
        if (st.modo === 'buscar') out.push(INV(U.relleno((st.busca ? `Buscar [${st.busca}]: ` : 'Buscar: ') + st.entrada, cols)));
        else if (st.modo === 'nombre') out.push(INV(U.relleno('Nombre del archivo a escribir: ' + st.entrada, cols)));
        else if (st.modo === 'salir') out.push(INV(U.relleno('¿Guardar el búfer modificado? ', cols)));
        else if (st.msj) { const m = st.msj; const iz = Math.max(0, Math.floor((cols - U.anchoTexto(m)) / 2)); out.push(' '.repeat(iz) + INV(m)); }
        else out.push('');
        const b = st.modo === 'buscar' ? BARRA_BUSCAR : st.modo === 'nombre' ? BARRA_ESCRIBIR : st.modo === 'salir' ? BARRA_SALIR : BARRA;
        out.push(...barra(b, cols, st.modo === 'salir' ? 16 : 0));
        // nada pasa del ancho de la terminal (en una ventana estrecha, nano corta el título y los mensajes)
        return out.map((l) => cortaA(l, cols));
      },
      tecla(k) {
        const map = { F2: 'Ctrl+X', F3: 'Ctrl+O', F6: 'Ctrl+W', F9: 'Ctrl+K' };
        if (map[k]) k = map[k];
        const linea = () => st.l[st.y];
        if (st.modo === 'salir') {
          if (/^[sSyY]$/.test(k)) { st.modo = 'nombre'; st.entrada = nombre || ''; st.trasGuardar = 'fin'; return; }
          if (/^[nN]$/.test(k)) return 'fin';
          if (k === 'Ctrl+C' || k === 'Escape') { st.modo = 'editar'; st.msj = '[ Cancelado ]'; }
          return;
        }
        if (st.modo === 'buscar' || st.modo === 'nombre') {
          if (k === 'Enter') {
            if (st.modo === 'buscar') {
              const p = st.entrada || st.busca;
              st.modo = 'editar'; st.entrada = '';
              if (!p) { st.msj = '[ Cancelado ]'; return; }
              st.busca = p;
              const n = st.l.length;
              for (let i = 0; i <= n; i++) {
                const yy = (st.y + i) % n;
                const desde = i === 0 ? st.x + 1 : 0;
                const pos = st.l[yy].toLowerCase().indexOf(p.toLowerCase(), desde);
                if (pos >= 0 && !(i === n && pos >= st.x + 1)) { st.y = yy; st.x = pos; st.msj = i > 0 && yy < st.y ? '[ Búsqueda reiniciada ]' : ''; return; }
              }
              st.msj = `[ No se encontró ${qq(p)} ]`;
              return;
            }
            const destino = st.entrada;
            st.modo = 'editar'; st.entrada = '';
            if (!destino) { st.msj = '[ Cancelado ]'; return; }
            const ok = guarda(destino);
            if (ok && st.trasGuardar === 'fin') return 'fin';
            st.trasGuardar = null;
            return;
          }
          if (k === 'Ctrl+C' || k === 'Escape') { st.modo = 'editar'; st.entrada = ''; st.trasGuardar = null; st.msj = '[ Cancelado ]'; return; }
          if (k === 'Backspace') { st.entrada = st.entrada.slice(0, -1); return; }
          if (k.length === 1) st.entrada += k;
          return;
        }
        st.msj = '';
        if (k !== 'Ctrl+K') st.ultimoCorte = false;
        switch (k) {
          case 'Ctrl+X':
            if (!st.mod) return 'fin';
            st.modo = 'salir'; return;
          case 'Ctrl+O': st.modo = 'nombre'; st.entrada = nombre || ''; return;
          // nano 7: Ctrl+S guarda sin preguntar el nombre (si el archivo aún no tiene, lo pregunta como Ctrl+O)
          case 'Ctrl+S': if (nombre) { guarda(nombre); return; } st.modo = 'nombre'; st.entrada = ''; return;
          case 'Ctrl+W': st.modo = 'buscar'; st.entrada = ''; return;
          case 'Ctrl+G': st.msj = '[ El simulador no tiene la ayuda de nano: mira los atajos de abajo ]'; return;
          case 'Ctrl+K': {
            if (!st.ultimoCorte) st.corte = [];
            st.corte.push(linea());
            st.ultimoCorte = true;
            if (st.l.length > 1) st.l.splice(st.y, 1); else st.l[0] = '';
            if (st.y >= st.l.length) st.y = st.l.length - 1;
            st.x = 0; st.mod = true; return;
          }
          case 'Ctrl+U':
            if (!st.corte.length) return;
            st.l.splice(st.y, 0, ...st.corte); st.y += st.corte.length; st.x = 0; st.mod = true; return;
          case 'Ctrl+C': st.msj = `[ línea ${st.y + 1}/${st.l.length} (${Math.round(((st.y + 1) / st.l.length) * 100)} %), col ${st.x + 1}/${linea().length + 1} (${Math.round(((st.x + 1) / (linea().length + 1)) * 100)} %), car ${st.l.slice(0, st.y).join('\n').length + st.x}/${st.l.join('\n').length} ]`; return;
          case 'ArrowUp': if (st.y > 0) { st.y--; st.x = Math.min(st.x, linea().length); } return;
          case 'ArrowDown': if (st.y < st.l.length - 1) { st.y++; st.x = Math.min(st.x, linea().length); } return;
          case 'ArrowLeft': if (st.x > 0) st.x--; else if (st.y > 0) { st.y--; st.x = linea().length; } return;
          case 'ArrowRight': if (st.x < linea().length) st.x++; else if (st.y < st.l.length - 1) { st.y++; st.x = 0; } return;
          case 'Home': st.x = 0; return;
          case 'End': st.x = linea().length; return;
          case 'PageDown': st.y = Math.min(st.l.length - 1, st.y + ultFilas - 4); st.x = 0; return;
          case 'PageUp': st.y = Math.max(0, st.y - ultFilas + 4); st.x = 0; return;
          case 'Enter': { const l = linea(); st.l.splice(st.y, 1, l.slice(0, st.x), l.slice(st.x)); st.y++; st.x = 0; st.mod = true; return; }
          case 'Backspace':
            if (st.x > 0) { const l = linea(); st.l[st.y] = l.slice(0, st.x - 1) + l.slice(st.x); st.x--; st.mod = true; }
            else if (st.y > 0) { const ant = st.l[st.y - 1]; st.x = ant.length; st.l.splice(st.y - 1, 2, ant + linea()); st.y--; st.mod = true; }
            return;
          case 'Delete':
            if (st.x < linea().length) { const l = linea(); st.l[st.y] = l.slice(0, st.x) + l.slice(st.x + 1); st.mod = true; }
            else if (st.y < st.l.length - 1) { st.l.splice(st.y, 2, linea() + st.l[st.y + 1]); st.mod = true; }
            return;
          case 'Tab': k = '\t'; break;
          case 'Space': k = ' '; break;
        }
        if (k.length === 1) { const l = linea(); st.l[st.y] = l.slice(0, st.x) + k + l.slice(st.x); st.x++; st.mod = true; }
      },
      // botones de la barra de teclas (el navegador se queda con Ctrl+W y otras)
      teclas: [['^O', 'Ctrl+O', 'Guardar'], ['^X', 'Ctrl+X', 'Salir'], ['^W', 'Ctrl+W', 'Buscar'], ['^K', 'Ctrl+K', 'Cortar'], ['^U', 'Ctrl+U', 'Pegar'], ['Intro', 'Enter', 'Intro'], ['S', 's', 'Sí'], ['N', 'n', 'No'], ['^C', 'Ctrl+C', 'Cancelar']],
      ctrl: true   // la terminal le pasa las teclas con Ctrl como «Ctrl+X»
    };
    void soloLectura;
    return prog;
  }
  L.editorNano = editorNano;
  O.nano = function* (c) {
    const a = c.args.filter((x) => x[0] !== '-' || x === '-');
    if (c.args.includes('--version') || c.args.includes('-V')) { c.sale(' GNU nano, versión 7.2\n (C) 2023 the Free Software Foundation and various contributors\n Opciones compiladas: --disable-libmagic --enable-utf8\n'); return 0; }
    if (c.args.includes('--help') || c.args.includes('-h')) { yield* L.ayudaDe(c, 'nano'); return 0; }
    if (!c.ttyOut || !c.ttyIn) { c.aviso('nano necesita la terminal: en el simulador no funciona con redirecciones ni tuberías.'); return 1; }
    const ruta = a[0] || null;
    let texto = null, msj = '[ Bienvenido a nano.  Para obtener ayuda básica, pulse Ctrl+G. ]';
    if (ruta) {
      try {
        const r = c.resuelve(ruta, { faltaUltimo: true });
        if (r.ino && r.ino.tipo === 'd') { msj = `[ «${ruta}» es un directorio ]`; texto = ''; }
        else if (r.ino) {
          if (!c.fs.puede(c.cred, r.ino, 'r')) { texto = ''; msj = `[ Error al leer ${ruta}: Permiso denegado ]`; }
          else {
            texto = r.ino.datos || '';
            const n = texto === '' ? 0 : texto.replace(/\n$/, '').split('\n').length;
            msj = n === 1 ? '[ 1 línea leída ]' : `[ ${n} líneas leídas ]`;
            if (!c.fs.puede(c.cred, r.ino, 'w')) msj = `[ El fichero ${qq(ruta)} no es de escritura ]`;
          }
        } else { texto = ''; msj = '[ Archivo nuevo ]'; if (!c.fs.puede(c.cred, r.padre, 'w')) msj = `[ El directorio ${qq(r.padre === c.fs.ino(c.fs.raiz) ? '/' : c.rutaAbs(ruta).replace(/\/[^/]*$/, ''))} no es de escritura ]`; }
      } catch (e) {
        if (!(e instanceof ErrorSis)) throw e;
        texto = ''; msj = `[ El directorio ${qq(ruta.replace(/\/[^/]*$/, ''))} no existe ]`;
      }
    }
    const p = editorNano(c, ruta, texto, msj);
    yield { tipo: 'programa', programa: p };
    return 0;
  };

  /* ---------------- vi (vim.tiny) mínimo: i, Esc, :w, :q, :q!, :wq, :x ---------------- */
  O.vi = function* (c) {
    if (!c.ttyOut) { c.aviso('vi necesita la terminal.'); return 1; }
    const ruta = c.args.find((x) => x[0] !== '-' && x[0] !== '+') || null;
    let texto = '', existe = false;
    if (ruta) { try { const r = c.resuelve(ruta); texto = r.ino.datos || ''; existe = true; } catch (e) { /* nuevo */ } }
    const st = { l: texto ? texto.replace(/\n$/, '').split('\n') : [''], y: 0, x: 0, modo: 'normal', cmd: '', mod: false };
    st.msj = ruta ? (existe ? `"${ruta}" ${st.l.length}L, ${texto.length}B` : `"${ruta}" [New]`) : '';
    const prog = {
      tipo: 'vi', titulo: 'vi',
      pantalla(cols, filas) {
        const out = [];
        for (let i = 0; i < filas - 1; i++) {
          if (i >= st.l.length) { out.push('\x1b[1;34m~\x1b[0m'); continue; }
          let l = st.l[i];
          if (i === st.y && st.modo !== 'comando') l = l.slice(0, st.x) + INV(l[st.x] || ' ') + l.slice(st.x + 1);
          out.push(l);
        }
        out.push(st.modo === 'comando' ? ':' + st.cmd : st.modo === 'insertar' ? '\x1b[1m-- INSERT --\x1b[22m' : st.msj);
        return out;
      },
      tecla(k) {
        const linea = () => st.l[st.y];
        if (st.modo === 'comando') {
          if (k === 'Enter') {
            const cmd = st.cmd.trim(); st.modo = 'normal'; st.cmd = '';
            const escribe = () => {
              if (!ruta) { st.msj = 'E32: No file name'; return false; }
              const t = st.l.join('\n') + '\n';
              const nuevo = !existe;
              try {
                const r = c.resuelve(ruta, { faltaUltimo: true });
                let ino = r.ino;
                if (!ino) { if (!c.fs.puede(c.cred, r.padre, 'w')) throw new ErrorSis('EACCES'); ino = c.fs.nuevo('-', 0o664, c.uid, c.sh.gid, { datos: '' }); c.fs.enlaza(r.padre, r.nombre, ino, c.rutaAbs(ruta)); }
                else if (!c.fs.puede(c.cred, ino, 'w')) throw new ErrorSis('EACCES');
                c.fs.escribe(ino, t, false, c.rutaAbs(ruta));
              } catch (e) { if (!(e instanceof ErrorSis)) throw e; st.msj = `"${ruta}" E212: Can't open file for writing`; return false; }
              st.msj = `"${ruta}" ${nuevo ? '[New] ' : ''}${st.l.length}L, ${t.length}B written`;
              existe = true; st.mod = false; return true;
            };
            if (cmd === 'q') { if (st.mod) { st.msj = 'E37: No write since last change (add ! to override)'; return; } return 'fin'; }
            if (cmd === 'q!') return 'fin';
            if (cmd === 'w') { escribe(); return; }
            if (cmd === 'wq' || cmd === 'x') { if (escribe()) return 'fin'; return; }
            st.msj = `E492: Not an editor command: ${cmd}`; return;
          }
          if (k === 'Escape') { st.modo = 'normal'; st.cmd = ''; return; }
          if (k === 'Backspace') { if (!st.cmd) st.modo = 'normal'; else st.cmd = st.cmd.slice(0, -1); return; }
          if (k.length === 1) st.cmd += k;
          return;
        }
        if (st.modo === 'insertar') {
          if (k === 'Escape') { st.modo = 'normal'; if (st.x > 0) st.x--; st.msj = ''; return; }
          if (k === 'Enter') { const l = linea(); st.l.splice(st.y, 1, l.slice(0, st.x), l.slice(st.x)); st.y++; st.x = 0; st.mod = true; return; }
          if (k === 'Backspace') { if (st.x > 0) { const l = linea(); st.l[st.y] = l.slice(0, st.x - 1) + l.slice(st.x); st.x--; st.mod = true; } return; }
          if (k === 'ArrowLeft') { if (st.x > 0) st.x--; return; }
          if (k === 'ArrowRight') { if (st.x < linea().length) st.x++; return; }
          if (k === 'ArrowUp') { if (st.y > 0) st.y--; st.x = Math.min(st.x, linea().length); return; }
          if (k === 'ArrowDown') { if (st.y < st.l.length - 1) st.y++; st.x = Math.min(st.x, linea().length); return; }
          if (k.length === 1) { const l = linea(); st.l[st.y] = l.slice(0, st.x) + k + l.slice(st.x); st.x++; st.mod = true; }
          return;
        }
        // modo normal
        if (k === ':') { st.modo = 'comando'; st.cmd = ''; return; }
        if (k === 'i') { st.modo = 'insertar'; return; }
        if (k === 'a') { st.modo = 'insertar'; if (linea().length) st.x++; return; }
        if (k === 'o') { st.l.splice(st.y + 1, 0, ''); st.y++; st.x = 0; st.modo = 'insertar'; st.mod = true; return; }
        if (k === 'x') { const l = linea(); if (l.length) { st.l[st.y] = l.slice(0, st.x) + l.slice(st.x + 1); st.mod = true; if (st.x >= st.l[st.y].length) st.x = Math.max(0, st.x - 1); } return; }
        if (k === 'h' || k === 'ArrowLeft') { if (st.x > 0) st.x--; return; }
        if (k === 'l' || k === 'ArrowRight') { if (st.x < linea().length - 1) st.x++; return; }
        if (k === 'k' || k === 'ArrowUp') { if (st.y > 0) st.y--; st.x = Math.min(st.x, Math.max(0, linea().length - 1)); return; }
        if (k === 'j' || k === 'ArrowDown') { if (st.y < st.l.length - 1) st.y++; st.x = Math.min(st.x, Math.max(0, linea().length - 1)); return; }
        if (k === 'Escape') { st.msj = ''; return; }
      },
      teclas: [['Esc', 'Escape', 'modo normal'], ['i', 'i', 'insertar'], [':q!', ':q!', 'salir sin guardar'], [':wq', ':wq', 'guardar y salir'], ['Intro', 'Enter', 'Intro']]
    };
    yield { tipo: 'programa', programa: prog };
    return 0;
  };

  /* ---------------- paquetes que pueden sobrar en un escenario ---------------- */
  Object.assign(L.PAQUETES, {
    cowsay: { version: '3.03+dfsg2-8', origen: 'noble/universe', descarga: '18,6 kB', instalado: '91,1 kB', ordenes: { cowsay: null, cowthink: null }, man: ['cowsay'], juegos: true },
    figlet: { version: '2.2.5-3', origen: 'noble/universe', descarga: '133 kB', instalado: '734 kB', ordenes: { figlet: null }, man: ['figlet'] },
    'kubuntu-desktop': { version: '1.450', origen: 'noble/universe', descarga: '1.392 MB', instalado: '4.861 MB', ordenes: {}, grande: true }
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof window !== 'undefined' ? window : globalThis);
