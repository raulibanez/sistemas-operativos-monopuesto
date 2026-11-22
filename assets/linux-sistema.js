/* Simulador de Linux · órdenes (2): información del sistema, paginadores (more, less, man), top, sudo,
 * passwd, apt, discos (lsblk, df, mount) y red (ip, ping, nslookup). Salidas y mensajes de la máquina
 * Ubuntu 24.04.5 de pruebas, con el usuario, el equipo y las fechas del escenario.
 */
(function (raiz) {
  'use strict';
  const SOM = (raiz.SOM = raiz.SOM || {});
  const L = (SOM.linux = SOM.linux || {});
  const U = L.util, ERR = L.ERR, ErrorSis = L.ErrorSis;
  const O = (L.ordenes = L.ordenes || {});
  const opciones = L.opciones, ayuda = L.ayudaDe, leeArchivo = L.leeArchivo;
  const prueba = (n) => `Pruebe '${n} --help' para más información.\n`;
  const qq = (s) => '«' + s + '»';
  const q = (s) => "'" + s + "'";
  const errSis = (e) => ERR[e.codigo] || e.message;
  const D = () => L.datos || {};
  const INV = (t) => `\x1b[7m${t}\x1b[27m`;

  /* ---------------- tiempo de funcionamiento y carga ---------------- */
  function arriba(c) {
    const s = Math.floor((c.ahora() - c.sis.arranque) / 1000);
    const dias = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    let t = 'up ';
    if (dias) t += dias + (dias === 1 ? ' day, ' : ' days, ');
    t += h ? String(h).padStart(2) + ':' + String(m).padStart(2, '0') : m + ' min';
    return t;
  }
  function carga(c) {
    const s = (c.ahora() - c.sis.arranque) / 1000;
    const a = Math.max(0.02, 0.35 * Math.exp(-s / 900) + 0.04), b = Math.max(0.05, 0.3 * Math.exp(-s / 2400) + 0.06), d = Math.max(0.05, 0.2 * Math.exp(-s / 6000) + 0.08);
    return [a, b, d].map((x) => U.numES(x, 2)).join(', ');
  }
  const usuarios = (c) => 2 + (c.sis.sesiones || []).length;
  function cabeceraUptime(c) { const n = usuarios(c); return ` ${U.strftime('%H:%M:%S', c.ahora())} ${arriba(c)},  ${n} user${n === 1 ? '' : 's'},  load average: ${carga(c)}`; }
  O.uptime = function* (c) {
    if (c.args[0] === '-p') { const s = Math.floor((c.ahora() - c.sis.arranque) / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); const p = []; if (h) p.push(h + (h === 1 ? ' hour' : ' hours')); p.push(m + (m === 1 ? ' minute' : ' minutes')); c.sale('up ' + p.join(', ') + '\n'); return 0; }
    if (c.args[0] === '-s') { c.sale(U.strftime('%Y-%m-%d %H:%M:%S', c.sis.arranque) + '\n'); return 0; }
    if (c.args.length) { if (c.args[0] === '--help') { yield* ayuda(c); return 0; } return c.sinOpcion(c.args[0]); }
    c.sale(cabeceraUptime(c) + '\n');
    return 0;
  };
  const horaLogin = (c) => c.sis.arranque + 41000;
  O.who = function* (c) {
    const r = yield* opciones(c, { cortas: 'abqrHmTsu', largas: { all: 'a', boot: 'b', count: 'q', runlevel: 'r', heading: 'H', mesg: 'T' } });
    if (typeof r === 'number') return r;
    const op = r.op;
    const f = U.strftime('%Y-%m-%d %H:%M', horaLogin(c)), fb = U.strftime('%Y-%m-%d %H:%M', c.sis.arranque);
    const u = c.sis.esc.usuario;
    if (r.resto.length === 2 && r.resto.join(' ').toLowerCase() === 'am i') return 0;
    const otras = c.sis.sesiones || [];
    if (op.q) { c.sale([u, u].concat(otras.map((s) => s.usuario)).join(' ') + `\n# users=${2 + otras.length}\n`); return 0; }
    const lineas = [];
    if (op.H) lineas.push('NOMBRE   LÍNEA        TIEMPO           COMENTARIO');
    if (op.b || op.a) lineas.push(`         arranque del sistema ${fb}`);
    if (op.r || op.a) lineas.push(`         \`run-level' 5 ${fb}`);
    if (!op.b && !op.r) {
      lineas.push(`${u.padEnd(8)} seat0        ${f} (login screen)`);
      lineas.push(`${u.padEnd(8)} tty2         ${f} (tty2)`);
      otras.forEach((s) => lineas.push(`${s.usuario.padEnd(8)} ${s.tty.padEnd(12)} ${U.strftime('%Y-%m-%d %H:%M', c.sis.arranque + s.desde * 1000)}`));
    }
    if (op.a || op.u || op.T || op.m) c.nota('El simulador da who con las columnas de siempre: en tu Ubuntu, -a, -u y -T añaden columnas de estado.');
    c.sale(lineas.join('\n') + (lineas.length ? '\n' : ''));
    return 0;
  };
  O.w = function* (c) {
    const sinCab = c.args.includes('-h');
    const otras = c.args.filter((a) => a !== '-h');
    if (otras.length && otras[0][0] === '-') { if (otras[0] === '--help') { yield* ayuda(c); return 0; } return c.sinOpcion(otras[0]); }
    const u = c.sis.esc.usuario;
    const idle = Math.floor((c.ahora() - horaLogin(c)) / 1000);
    const idleTxt = idle < 60 ? idle + ',00s' : Math.floor(idle / 60) + ':' + String(idle % 60).padStart(2, '0');
    let t = '';
    if (!sinCab) t += cabeceraUptime(c) + '\nUSUARIO  TTY      DESDE            LOGIN@   IDLE   JCPU   PCPU  WHAT\n';
    if (!otras.length || otras.includes(u)) t += `${u.padEnd(8)} tty2     tty2             ${U.strftime('%H:%M', horaLogin(c))}    ${idleTxt.padStart(5)}  0.04s  0.04s /usr/libexec/gnome-session-binary --session=ubuntu\n`;
    (c.sis.sesiones || []).forEach((s) => {
      if (otras.length && !otras.includes(s.usuario)) return;
      const desde = c.sis.arranque + s.desde * 1000, quieto = Math.floor((c.ahora() - desde) / 1000) % 3000;
      const id = quieto < 60 ? quieto + ',00s' : Math.floor(quieto / 60) + ':' + String(quieto % 60).padStart(2, '0');
      t += `${s.usuario.padEnd(8)} ${s.tty.padEnd(8)} -                ${U.strftime('%H:%M', desde)}    ${id.padStart(5)}  0.12s  0.05s ${s.orden || 'top'}\n`;
    });
    c.sale(t);
    return 0;
  };
  O.uname = function* (c) {
    const r = yield* opciones(c, { cortas: 'asnrvmpio', largas: { all: 'a', 'kernel-name': 's', nodename: 'n', 'kernel-release': 'r', 'kernel-version': 'v', machine: 'm', processor: 'p', 'hardware-platform': 'i', 'operating-system': 'o' } });
    if (typeof r === 'number') return r;
    if (r.resto.length) { c.err(`uname: operando extra ${qq(r.resto[0])}\n${prueba('uname')}`); return 1; }
    const op = r.op;
    const k = c.sis.nucleo;
    const v = { s: 'Linux', n: c.sis.lee('/etc/hostname').trim() || c.sis.esc.equipo, r: k.version, v: k.compilacion, m: k.arquitectura, p: k.arquitectura, i: k.arquitectura, o: 'GNU/Linux' };
    const orden = 'snrvmpio'.split('');
    const sel = op.a ? orden : orden.filter((k) => op[k]);
    c.sale((sel.length ? sel : ['s']).map((k) => v[k]).join(' ') + '\n');
    return 0;
  };
  O.hostnamectl = function* (c) {
    const a = c.args.slice();
    const nombre = c.sis.lee('/etc/hostname').trim();
    if (!a.length || a[0] === 'status') {
      if (a.includes('--static') || a.includes('--transient') || a.includes('--pretty')) { c.sale(nombre + '\n'); return 0; }
      const fw = U.partes(c.ahora());
      const años = fw.a - 2006 - (fw.m < 11 ? 1 : 0), meses = (fw.m - 11 + 12) % 12;
      c.sale(` Static hostname: ${nombre}\n       Icon name: computer-vm\n         Chassis: vm 🖴\n      Machine ID: 83e6d051f9ec4b24a7522a44a1daf67e\n         Boot ID: 89b0a5abfb0b4b1bbb12c3dfa2e930a3\n  Virtualization: oracle\nOperating System: Ubuntu 24.04.5 LTS\n          Kernel: Linux ${c.sis.nucleo.version}\n    Architecture: ${c.sis.nucleo.arquitectura === 'aarch64' ? 'arm64' : 'x86-64'}\n Hardware Vendor: innotek GmbH\n  Hardware Model: VirtualBox\nFirmware Version: VirtualBox\n   Firmware Date: Fri 2006-12-01\n    Firmware Age: ${años}y ${meses}month ${Math.floor((fw.d - 1) / 7)}w ${(fw.d - 1) % 7}d\n`);
      return 0;
    }
    if (a[0] === 'hostname' && a.length === 1) { c.sale(nombre + '\n'); return 0; }
    if (a[0] === 'set-hostname' || (a[0] === 'hostname' && a.length === 2)) {
      const nuevo = a[1];
      if (!nuevo) { c.err('Too few arguments.\n'); return 1; }
      if (c.uid !== 0) { c.err('Could not set static hostname: Access denied\n'); c.aviso('En tu Ubuntu, en una sesión de escritorio, se abre una ventana que pide la contraseña. Con sudo delante funciona sin preguntar.'); return 1; }
      if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$/.test(nuevo)) { c.err(`Invalid hostname '${nuevo}'\n`); return 1; }
      c.sis.guarda('/etc/hostname', nuevo + '\n');
      c.sis.esc.equipo = nuevo;
      return 0;
    }
    if (a[0] === '--help') { yield* ayuda(c); return 0; }
    c.aviso(`El simulador no tiene «hostnamectl ${a[0]}». En tu Ubuntu sí funciona.`);
    return 1;
  };
  O.lsusb = function* (c) {
    if (c.args.length) return c.sinOpcion(c.args[0]);
    c.sale('Bus 001 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub\nBus 001 Device 002: ID 80ee:0021 VirtualBox USB Tablet\nBus 002 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub\n');
    return 0;
  };
  O.lspci = function* (c) {
    if (c.args.length) return c.sinOpcion(c.args[0]);
    c.sale(['00:00.0 Host bridge: Intel Corporation 440FX - 82441FX PMC [Natoma] (rev 02)', '00:01.0 ISA bridge: Intel Corporation 82371SB PIIX3 ISA [Natoma/Triton II]', '00:01.1 IDE interface: Intel Corporation 82371AB/EB/MB PIIX4 IDE (rev 01)', '00:02.0 VGA compatible controller: VMware SVGA II Adapter', '00:03.0 Ethernet controller: Intel Corporation 82540EM Gigabit Ethernet Controller (rev 02)', '00:04.0 System peripheral: InnoTek Systemberatung GmbH VirtualBox Guest Service', '00:05.0 Multimedia audio controller: Intel Corporation 82801AA AC\'97 Audio Controller (rev 01)', '00:06.0 USB controller: Apple Inc. KeyLargo/Intrepid USB', '00:07.0 Bridge: Intel Corporation 82371AB/EB/MB PIIX4 ACPI (rev 08)', '00:0b.0 USB controller: Intel Corporation 82801FB/FBM/FR/FW/FRW (ICH6 Family) USB2 EHCI Controller', '00:0d.0 SATA controller: Intel Corporation 82801HM/HEM (ICH8M/ICH8M-E) SATA Controller [AHCI mode] (rev 02)'].join('\n') + '\n');
    return 0;
  };
  O.lsmod = function* (c) {
    if (c.args.length) { c.err('Usage: lsmod\n'); return 1; }
    c.sale(L.lsmodDe(c.sis));
    return 0;
  };
  // módulos que el escenario puede añadir (con los que dependen de ellos), como los enseña lsmod
  const MODULOS = {
    btrfs: ['btrfs                2015232  0', 'blake2b_generic        24576  0', 'xor                    20480  1 btrfs', 'raid6_pq              126976  1 btrfs'],
    nvidia: ['nvidia_drm            135168  0', 'nvidia_modeset       1638400  1 nvidia_drm', 'nvidia             104071168  1 nvidia_modeset'],
    vboxsf: ['vboxsf                 45056  0'],
    usbhid: ['usbhid                 77824  0'],
    vboxguest: ['vboxguest             516096  3'],
    uvcvideo: ['uvcvideo              155648  0', 'videobuf2_vmalloc      20480  1 uvcvideo'],
    bluetooth: ['bluetooth            1032192  0'],
    e1000: ['e1000                 180224  0']
  };
  L.lsmodDe = function (sis) {
    let ls = (D().lsmod || 'Module                  Size  Used by\n').replace(/\n$/, '').split('\n');
    const q = sis.nucleo.modulos.quita || [], a = sis.nucleo.modulos.añade || [];
    ls = ls.filter((l, i) => i === 0 || !q.includes(l.split(/\s+/)[0]));
    // los módulos quitados tampoco aparecen en «Used by» de los demás
    if (q.length) ls = ls.map((l, i) => {
      const m = i && l.match(/^(\S+\s+\d+\s+)(\d+)( (\S+))?$/);
      if (!m || !m[4]) return l;
      const quedan = m[4].split(',').filter((x) => x && !q.includes(x));
      const n = +m[2] - (m[4].split(',').filter(Boolean).length - quedan.length);
      return (m[1] + n).replace(/\s+\d+$/, (x) => x) + (quedan.length ? ' ' + quedan.join(',') + (m[4].endsWith(',') ? ',' : '') : '');
    });
    a.forEach((m) => { if (!ls.some((l) => l.split(/\s+/)[0] === m)) ls.splice(1, 0, ...(MODULOS[m] || [m.padEnd(22) + '  16384  0'])); });
    return ls.join('\n') + '\n';
  };
  O.kmod = function* (c) { if (c.args[0] === 'list') return yield* O.lsmod(Object.assign({}, c, { args: [] })); c.aviso('El simulador solo tiene «kmod list» (lo mismo que lsmod).'); return 1; };
  O.clear = function* (c) {
    if (c.args.length && c.args[0] !== '-x') { if (c.args[0] === '--help' || c.args[0] === '-V') return c.sinOpcion(c.args[0]); c.err(`clear: opción incorrecta -- '${c.args[0].slice(1, 2)}'\nusage: clear [-options]\n\nOptions:\n  -T TERM     use this instead of $TERM\n  -V          print curses-version\n  -x          do not try to clear scrollback\n`); return 1; }
    c.sale(c.args[0] === '-x' ? '\x1b[H\x1b[2J' : '\x1b[H\x1b[2J\x1b[3J');
    return 0;
  };
  O.tput = function* (c) {
    if (c.args[0] === 'clear') { c.sale('\x1b[H\x1b[2J'); return 0; }
    if (c.args[0] === 'cols') { c.sale(c.columnas + '\n'); return 0; }
    if (c.args[0] === 'lines') { c.sale(c.lineas + '\n'); return 0; }
    c.aviso('El simulador solo tiene tput clear, cols y lines.'); return 1;
  };
  O.dircolors = function* (c) {
    if (c.args[0] === '-p' || c.args[0] === '--print-database') { c.aviso('El simulador no copia la base de datos de dircolors.'); return 0; }
    c.sale(`LS_COLORS='${D().lsColors || ''}';\nexport LS_COLORS\n`);
    return 0;
  };
  O.whereis = function* (c) {
    const r = yield* opciones(c, { cortas: 'bmsul', largas: {} });
    if (typeof r === 'number') return r;
    if (!r.resto.length) { c.err('whereis: no especificado ningún argumento.\nPruebe \'whereis --help\' para más información.\n'); return 1; }
    const fs = c.fs, root = { uid: 0, gid: 0 };
    const dirsBin = ['/usr/bin', '/usr/sbin', '/usr/lib', '/usr/local/bin', '/usr/local/sbin', '/usr/games'];
    const dirsMan = ['/usr/share/man/man1', '/usr/share/man/man5', '/usr/share/man/man8'];
    for (const n of r.resto) {
      const hallados = [];
      const busca = (dir, filtro) => {
        try {
          const d = fs.resuelve(dir, root).ino;
          [...d.hijos.keys()].filter(filtro).sort(U.comparaLocale).forEach((k) => hallados.push(dir + '/' + k));
        } catch (e) { /* no existe */ }
      };
      if (!r.op.m && !r.op.s) dirsBin.forEach((d) => busca(d, (k) => k === n));
      if (!r.op.b && !r.op.s) { dirsMan.forEach((d) => busca(d, (k) => k.split('.')[0] === n)); busca('/usr/share/info', (k) => k.split('.')[0] === n); }
      c.sale(n + ':' + hallados.map((h) => ' ' + h).join('') + '\n');
    }
    return 0;
  };
  O.which = function* (c) {
    let a = c.args.slice(), todos = false;
    if (a[0] === '-a') { todos = true; a.shift(); }
    if (a[0] && a[0][0] === '-' && a[0] !== '-a') { c.err('Illegal option ' + a[0] + '\nUsage: /usr/bin/which [-as] args\n'); return 2; }
    let cod = 0;
    for (const n of a) { const rs = L.buscaEnPath(c, n, todos); if (rs.length) rs.forEach((x) => c.sale(x + '\n')); else cod = 1; }
    return cod;
  };

  /* ---------------- date y cal ---------------- */
  O.date = function* (c) {
    const r = yield* opciones(c, { cortas: 'uRI', conArg: 'ds', largas: { date: 'd=', utc: 'u', universal: 'u', 'rfc-email': 'R', 'iso-8601': 'I?', set: 's=', reference: 'r=' } });
    if (typeof r === 'number') return r;
    const op = r.op;
    let t = c.ahora();
    if (op.s !== undefined) { if (c.uid !== 0) { c.err('date: no se puede establecer la fecha: Operación no permitida\n'); const t2 = U.leeFecha(op.s, t); if (t2 !== null) c.sale(U.strftime('%a %d %b %Y %H:%M:%S %Z', t2) + '\n'); return 1; } c.aviso('El simulador no cambia la hora del sistema.'); return 0; }
    if (op.d !== undefined) { const t2 = U.leeFecha(op.d, t); if (t2 === null) { c.err(`date: fecha ${qq(op.d)} inválida\n`); return 1; } t = t2; }
    if (op.r !== undefined) { try { t = c.resuelve(op.r).ino.mtime; } catch (e) { c.err(`date: ${op.r}: ${errSis(e)}\n`); return 1; } }
    const fmts = r.resto.filter((x) => x[0] === '+');
    const otros = r.resto.filter((x) => x[0] !== '+');
    if (fmts.length > 1 || (fmts.length && otros.length) || otros.length > 1) { c.err(`date: operando extra ${qq((fmts.length ? (otros[0] || fmts[1]) : otros[1]))}\n${prueba('date')}`); return 1; }
    if (otros.length) { c.err(`date: fecha ${qq(otros[0])} inválida\n`); return 1; }
    let fmt = fmts.length ? fmts[0].slice(1) : '%a %d %b %Y %H:%M:%S %Z';
    if (op.R) fmt = '%a, %d %b %Y %H:%M:%S %z';
    if (op.I) fmt = op.I === 'seconds' ? '%Y-%m-%dT%H:%M:%S%:z' : '%Y-%m-%d';
    if (op.R) { const p = U.partes(t); c.sale(`${U.DIAS_EN[p.sem]}, ${String(p.d).padStart(2, '0')} ${U.MESES_EN[p.m]} ${p.a} ${U.strftime('%H:%M:%S %z', t)}\n`); return 0; }
    c.sale(U.strftime(fmt, t, { utc: !!op.u }) + '\n');
    return 0;
  };
  // calendarios de ncal (paquete ncal): cal y ncal -C, con los nombres del locale
  const MESC = U.MESES.map((m) => m[0].toUpperCase() + m.slice(1));
  const centra = (s, w) => { const l = U.anchoTexto(s); const iz = Math.floor((w - l) / 2); return ' '.repeat(Math.max(0, iz)) + s + ' '.repeat(Math.max(0, w - l - iz)); };
  function mesBloque(a, m, hoy, conAnio, resaltar) {
    const lineas = [centra(MESC[m] + (conAnio ? ' ' + a : ''), 20) + '  ', 'do lu ma mi ju vi sá  '];
    const primero = new Date(Date.UTC(a, m, 1)).getUTCDay();
    const dias = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
    const celdas = Array(primero).fill('  ');
    for (let d = 1; d <= dias; d++) {
      let s = String(d).padStart(2);
      if (hoy && hoy.a === a && hoy.m === m && hoy.d === d) s = resaltar ? INV(s) : s.split('').map((ch) => (ch === ' ' ? ' ' : '_\b' + ch)).join('');
      celdas.push(s);
    }
    while (celdas.length < 42) celdas.push('  ');
    for (let w = 0; w < 6; w++) lineas.push(celdas.slice(w * 7, w * 7 + 7).join(' ') + '  ');
    return lineas;
  }
  function* calendario(c) {
    const ncal = c.nombre === 'ncal';
    const a = c.args.slice();
    const op = {};
    const ops = [];
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (x === '-m') { op.m = a[++i]; continue; }
      if (/^-[3yCjbwM1]+$/.test(x)) { for (const ch of x.slice(1)) op[ch] = true; continue; }
      if (x === '--help' || x === '-h' && !ncal) { c.err('Usage: cal [general options] [-jy] [[month] year]\n       cal [general options] [-j] [-m month] [year]\n       ncal -C [general options] [-jy] [[month] year]\n       ncal -C [general options] [-j] [-m month] [year]\n       ncal [general options] [-bhJjpwySM] [-H yyyy-mm-dd] [-s country_code] [-W number of days] [[month] year]\n       ncal [general options] [-Jeo] [year]\nGeneral options: [-31] [-A months] [-B months] [-d yyyy-mm]\n'); return 64; }
      if (x[0] === '-' && x.length > 1) {
        if (/^-[ABdHsWeoJpS]/.test(x)) { c.aviso(`El simulador no tiene la opción ${x} de ${c.nombre}.`); return 2; }
        c.err(`${c.nombre}: opción incorrecta -- ${qq(x[1])}\nUsage: cal [general options] [-jy] [[month] year]\n       cal [general options] [-j] [-m month] [year]\n       ncal -C [general options] [-jy] [[month] year]\n       ncal -C [general options] [-j] [-m month] [year]\n       ncal [general options] [-bhJjpwySM] [-H yyyy-mm-dd] [-s country_code] [-W number of days] [[month] year]\n       ncal [general options] [-Jeo] [year]\nGeneral options: [-31] [-A months] [-B months] [-d yyyy-mm]\n`); return 64;
      }
      ops.push(x);
    }
    const hoy = U.partes(c.ahora());
    let anio = hoy.a, mes = hoy.m, todoAnio = !!op.y;
    if (ops.length === 1) { if (!/^\d+$/.test(ops[0]) || +ops[0] < 1 || +ops[0] > 9999) { c.err(`${c.nombre}: year \`${ops[0]}' not in range 1..9999\n`); return 64; } anio = +ops[0]; todoAnio = true; }
    if (ops.length === 2) {
      const mm = +ops[0];
      if (!/^\d+$/.test(ops[0]) || mm < 1 || mm > 12) { c.err(`${c.nombre}: ${ops[0]} is neither a month number (1..12) nor a name\n`); return 64; }
      mes = mm - 1; anio = +ops[1];
    }
    if (op.m !== undefined) { const mm = +op.m; if (!(mm >= 1 && mm <= 12)) { c.err(`${c.nombre}: ${op.m} is neither a month number (1..12) nor a name\n`); return 64; } mes = mm - 1; }
    const resaltar = c.ttyOut;
    const marcaHoy = c.ttyOut ? hoy : null;
    const vertical = ncal && !op.C;
    let out = [];
    if (vertical) {
      if (todoAnio || op['3']) { c.aviso('El simulador solo tiene ncal (vertical) de un mes; prueba ncal -C o cal.'); return 2; }
      const prim = new Date(Date.UTC(anio, mes, 1)).getUTCDay(), dias = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
      const fila = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
      out.push(centra(MESC[mes] + ' ' + anio, 22));
      const lunesPrimero = (prim + 6) % 7;
      const semanas = Math.ceil((lunesPrimero + dias) / 7);
      fila.forEach((n, k) => {
        let s = n;
        for (let w = 0; w < Math.max(semanas, 5); w++) {
          const d = w * 7 + k - lunesPrimero + 1;
          let v = d >= 1 && d <= dias ? String(d).padStart(2) : '  ';
          if (marcaHoy && d === hoy.d && mes === hoy.m && anio === hoy.a) v = INV(v);
          s += ' ' + v;
        }
        out.push(s);
      });
      c.sale(out.join('\n') + '\n');
      return 0;
    }
    const junta = (bloques) => { const l = []; for (let i = 0; i < 8; i++) l.push(bloques.map((b) => b[i]).join('')); return l; };
    if (todoAnio) {
      out.push(centra(String(anio), 60).replace(/\s+$/, ''));
      for (let t = 0; t < 4; t++) {
        const bl = [0, 1, 2].map((k) => mesBloque(anio, t * 3 + k, marcaHoy, false, resaltar));
        out.push(...junta(bl));
        if (t < 3) out.push('');
      }
    } else if (op['3']) {
      const meses = [-1, 0, 1].map((k) => { const d = new Date(Date.UTC(anio, mes + k, 1)); return [d.getUTCFullYear(), d.getUTCMonth()]; });
      const mismoAnio = meses.every(([y]) => y === meses[1][0]);
      if (mismoAnio) out.push(centra(String(anio), 60).replace(/\s+$/, ''));
      out.push(...junta(meses.map(([y, mm]) => mesBloque(y, mm, marcaHoy, !mismoAnio, resaltar))));
    } else out.push(...mesBloque(anio, mes, marcaHoy, true, resaltar));
    c.sale(out.join('\n') + '\n');
    return 0;
  }
  O.ncal = calendario;

  /* ---------------- paginadores: more, less y man ---------------- */
  // corta las líneas largas al ancho de la pantalla (como hace la terminal)
  function trocea(lineas, ancho) {
    ancho = Math.max(10, ancho || 80);
    const out = [];
    lineas.forEach((l) => {
      const limpio = l.replace(/\x1b\[[0-9;]*m/g, '');
      if (U.anchoTexto(limpio) <= ancho) { out.push(l); return; }
      let resto = l;
      while (resto.length) {
        let k = 0, vis = 0;
        while (k < resto.length && vis < ancho) { if (resto[k] === '\x1b') { const m = resto.slice(k).match(/^\x1b\[[0-9;]*m/); if (m) { k += m[0].length; continue; } } vis++; k++; }
        out.push(resto.slice(0, k)); resto = resto.slice(k);
      }
    });
    return out;
  }
  // corta una línea a n columnas visibles, sin marca (como top)
  function cortaA(l, n) {
    let k = 0, vis = 0;
    while (k < l.length) {
      if (l[k] === '\x1b') { const m = l.slice(k).match(/^\x1b\[[0-9;]*m/); if (m) { k += m[0].length; continue; } }
      if (vis >= n) return l.slice(0, k) + '\x1b[0m';
      vis++; k++;
    }
    return l;
  }
  // corta una línea a n columnas visibles (con los colores) y marca el corte con > en vídeo inverso (less -S)
  function cortaVisible(l, n) {
    if (U.anchoTexto(l.replace(/\x1b\[[0-9;]*m/g, '')) <= n) return l;
    let k = 0, vis = 0;
    while (k < l.length && vis < n - 1) { if (l[k] === '\x1b') { const m = l.slice(k).match(/^\x1b\[[0-9;]*m/); if (m) { k += m[0].length; continue; } } vis++; k++; }
    return l.slice(0, k) + '\x1b[0m\x1b[7m>\x1b[27m';
  }
  /* man da formato a la página para el ancho de la terminal: las páginas guardadas están hechas para 80 columnas
   * (texto hasta la columna 78) y, con otro ancho, se vuelven a llenar los párrafos sin partir palabras, justificados
   * como los de groff. Un párrafo es una serie de líneas con la misma sangría en la que cada línea, menos la última,
   * llega casi al margen; una línea con etiqueta («-S     ordena…») sigue en la sangría de la línea de debajo. Las
   * líneas cortas sueltas (sinopsis, listas, ejemplos) se dejan como están si caben. */
  const ANCHO_MAN = 78;
  function reflujoMan(lineas, ancho) {
    const L2 = Math.max(20, ancho - 2);
    const largo = (l) => [...l].length;
    const sangria = (l) => l.match(/^ */)[0].length;
    const lleno = (l) => largo(l) >= ANCHO_MAN - 14;
    // cabecera y pie: tres partes separadas por espacios y, al final, el nombre con la sección: LS(1)
    const tresPartes = (l) => { const p = l.trim().split(/\s{2,}/); return p.length === 3 && /\(\w+\)$/.test(p[2]) ? p : null; };
    const coloca = (p) => {
      const [a, b, c] = p, libre = L2 - largo(a) - largo(c);
      if (libre < largo(b) + 2) return [a, b, c].join(' ');
      const izq = Math.floor((L2 - largo(b)) / 2) - largo(a);
      const i = Math.max(1, izq), d = Math.max(1, L2 - largo(a) - i - largo(b) - largo(c));
      return a + ' '.repeat(i) + b + ' '.repeat(d) + c;
    };
    // llena las palabras en líneas de L2 con sangría; la primera puede llevar delante una etiqueta
    const llena = (palabras, sang, primera) => {
      const out = [];
      let actual = primera !== undefined ? primera : ' '.repeat(sang), vacia = true;
      const filas = [];
      palabras.forEach((w) => {
        if (!vacia && largo(actual) + 1 + largo(w) > L2) { filas.push(actual); actual = ' '.repeat(sang) + w; return; }
        actual += (vacia ? '' : ' ') + w; vacia = false;
      });
      filas.push(actual);
      // justificadas, menos la última; los huecos que sobran, alternando desde la derecha y desde la izquierda
      filas.forEach((f, k) => {
        if (k === filas.length - 1 || largo(f) >= L2) { out.push(f); return; }
        const cab = f.match(/^ */)[0], resto = f.slice(cab.length);
        const etiqueta = k === 0 && primera !== undefined ? (primera.match(/^ *\S+(?: \S+)* {2,}/) || [''])[0] : '';
        const cuerpo = etiqueta ? f.slice(etiqueta.length) : resto;
        const ws = cuerpo.split(' ');
        if (ws.length < 2) { out.push(f); return; }
        let falta = L2 - largo(f);
        const huecos = ws.slice(0, -1).map(() => 1);
        for (let j = 0; falta > 0; j++, falta--) huecos[k % 2 ? j % huecos.length : huecos.length - 1 - (j % huecos.length)]++;
        out.push((etiqueta || cab) + ws.map((w, j) => w + (j < huecos.length ? ' '.repeat(huecos[j]) : '')).join(''));
      });
      return out;
    };
    const out = [];
    let cabecera = false;
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (!l.trim()) { out.push(''); continue; }
      const p = tresPartes(l);
      if (p && (!cabecera || i >= lineas.length - 3)) { cabecera = true; out.push(coloca(p)); continue; }
      const s = sangria(l);
      if (!s) { out.push(l); continue; }   // títulos de sección y avisos
      // línea con etiqueta: el texto sigue en la sangría de la línea de debajo
      const sig = lineas[i + 1] || '';
      const m = l.match(/^( *)(\S+(?: \S+)*?)( {2,})(\S.*)$/);
      let sangTexto = s, primera, palabras = [], j = i;
      if (m && sig.trim() && sangria(sig) === m[1].length + m[2].length + m[3].length) {
        sangTexto = sangria(sig);
        primera = m[1] + m[2] + m[3];
        palabras = m[4].trim().split(/\s+/);
        if (!lleno(l)) { out.push(...llena(palabras, sangTexto, primera)); continue; }
        j = i + 1;
        palabras = palabras.concat(sig.trim().split(/\s+/));
        let ult = sig;
        while (lleno(ult) && lineas[j + 1] && lineas[j + 1].trim() && sangria(lineas[j + 1]) === sangTexto && !tresPartes(lineas[j + 1])) { j++; ult = lineas[j]; palabras = palabras.concat(ult.trim().split(/\s+/)); }
        out.push(...llena(palabras, sangTexto, primera));
        i = j;
        continue;
      }
      // párrafo: líneas seguidas con la misma sangría mientras la anterior llegue casi al margen
      let ult = l;
      palabras = l.trim().split(/\s+/);
      while (lleno(ult) && lineas[j + 1] && lineas[j + 1].trim() && sangria(lineas[j + 1]) === s && !tresPartes(lineas[j + 1])) { j++; ult = lineas[j]; palabras = palabras.concat(ult.trim().split(/\s+/)); }
      if (j === i && largo(l) <= L2) { out.push(l); continue; }
      out.push(...llena(palabras, s));
      i = j;
    }
    return out;
  }
  L.reflujoMan = reflujoMan;
  // negritas y subrayados de man (x\bx, _\bx) -> colores de la terminal
  const sobreimpreso = (t) => t.replace(/_\x08(.)/g, '\x1b[4m$1\x1b[24m').replace(/(.)\x08\1/g, '\x1b[1m$1\x1b[22m').replace(/\x1b\[24m\x1b\[4m/g, '').replace(/\x1b\[22m\x1b\[1m/g, '');
  /* Programa a pantalla completa de paginar. tipo: 'less' | 'more' | 'man' | 'systemctl' (less -FRSXMK: líneas
   * cortadas, «lines 1-14/14 (END)») | 'info' (línea de modo y área de eco) | 'ayuda-less' (la h de less). */
  function paginador(texto, tipo, nombre, extra) {
    const corta = tipo === 'systemctl';
    const base = sobreimpreso(texto).replace(/\n$/, '').split('\n');
    const negritas = (ls) => (tipo !== 'man' ? ls : ls.map((l, i) => {
      if (i > 0 && /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ0-9 ,/-]+$/.test(l)) return `\x1b[1m${l}\x1b[22m`;
      return l.replace(/^( {7})((?:--?[\w-]+|!)(?:, (?:--?[\w-]+))*)/, (m, s, o) => s + `\x1b[1m${o}\x1b[22m`);
    }));
    const todas = negritas(base);
    // las líneas para un ancho: man vuelve a dar formato a la página; los demás cortan las líneas largas
    const porAncho = {};
    const lineasDe = (ancho) => {
      if (corta) return todas.map((l) => cortaVisible(l, ancho));
      if (tipo !== 'man' || ancho === 80) return trocea(todas, ancho);
      return porAncho[ancho] || (porAncho[ancho] = trocea(negritas(reflujoMan(base, ancho)), ancho));
    };
    const st = { arriba: 0, busca: null, escribiendo: null, mensaje: '', fin: false };
    let ultimoAncho = 80, ultimoAlto = 24;
    const prog = {
      tipo, titulo: nombre,
      pantalla(ancho, alto) {
        ultimoAncho = ancho; ultimoAlto = alto;
        if (st.ayuda) return st.ayuda.pantalla(ancho, alto);
        const ls = lineasDe(ancho);
        const cabe = alto - (tipo === 'info' ? 2 : 1);
        const maxArriba = Math.max(0, ls.length - (tipo === 'more' ? cabe : 1));
        if (st.arriba > maxArriba) st.arriba = Math.max(0, tipo === 'less' || tipo === 'man' ? Math.min(st.arriba, Math.max(0, ls.length - cabe)) : maxArriba);
        const vista = ls.slice(st.arriba, st.arriba + cabe);
        const final = st.arriba + cabe >= ls.length;
        while (vista.length < cabe) vista.push(tipo === 'more' || tipo === 'info' ? '' : '\x1b[1m~\x1b[22m');
        let estado;
        if (tipo === 'info') {
          // línea de modo de info y, debajo, el área de eco
          const pos = ls.length <= cabe ? 'All' : st.arriba === 0 ? 'Top' : final ? 'Bot' : Math.round((st.arriba / Math.max(1, ls.length - cabe)) * 100) + '%';
          const modo = `-----Info: ${nombre}, ${ls.length} lines --${pos}`;
          vista.push(INV((modo + '-'.repeat(Math.max(0, ancho - U.anchoTexto(modo)))).slice(0, ancho)));
          vista.push(st.escribiendo !== null ? 'Buscar expresión regular: ' + st.escribiendo : st.mensaje || (st.eco !== undefined ? st.eco : (prog.aviso || 'Esto es Info, versión 7.1. Teclee H para ayuda, h para cursillo.')));
          st.eco = '';
          st.fin = final;
          return vista.map((l) => cortaA(l, ancho));
        }
        if (st.escribiendo !== null) estado = '/' + st.escribiendo;
        else if (st.mensaje) estado = INV(st.mensaje);
        else if (tipo === 'more') estado = INV(`--Más--(${Math.min(100, Math.round(((st.arriba + cabe) / ls.length) * 100))}%)`);
        else if (tipo === 'systemctl') estado = INV(`lines ${st.arriba + 1}-${Math.min(st.arriba + cabe, ls.length)}/${ls.length}${final ? ' (END)' : ''}`);
        else if (tipo === 'ayuda-less') estado = INV('HELP -- ' + (final ? 'END -- Press g to see it again, or q when done' : 'Press RETURN for more, or q when done'));
        else if (tipo === 'man') { if (final) st.vistoFin = true; estado = INV(` Manual page ${nombre} line ${st.arriba + 1}${st.vistoFin ? '/' + ls.length : ''}${final ? ' (END)' : ''} (press h for help or q to quit)`); }
        else estado = final ? INV('(END)') : (st.arriba === 0 && nombre ? INV(nombre) : ':');
        vista.push(estado);
        st.fin = final;
        return vista.map((l) => cortaA(l, ancho));   // la línea de estado de less se corta si no cabe
      },
      tecla(k) {
        if (st.ayuda) { if (st.ayuda.tecla(k) === 'fin') st.ayuda = null; return; }
        const ls = corta ? todas : lineasDe(ultimoAncho);
        const cabe = ultimoAlto - (tipo === 'info' ? 2 : 1);
        st.mensaje = '';
        if (st.escribiendo !== null) {
          if (k === 'Enter') { st.busca = st.escribiendo; st.escribiendo = null; return prog.siguiente(); }
          if (k === 'Escape') { st.escribiendo = null; return; }
          if (k === 'Backspace') { if (!st.escribiendo) st.escribiendo = null; else st.escribiendo = st.escribiendo.slice(0, -1); return; }
          if (k.length === 1) st.escribiendo += k;
          return;
        }
        const max = Math.max(0, ls.length - cabe);
        switch (k) {
          case 'q': case 'Q': case ':q': return 'fin';
          case ' ': case 'f': case 'PageDown': case 'z':
            if (tipo === 'more' && st.arriba + cabe >= ls.length) return 'fin';
            st.arriba = Math.min(tipo === 'more' ? ls.length : max, st.arriba + cabe);
            if (tipo === 'more' && st.arriba >= ls.length - 0) return 'fin';
            return;
          case 'b': case 'PageUp': st.arriba = Math.max(0, st.arriba - cabe); return;
          case 'Enter': case 'j': case 'ArrowDown': case 'e':
            if (tipo === 'more' && st.arriba + cabe >= ls.length) return 'fin';
            st.arriba = Math.min(tipo === 'more' ? ls.length : max, st.arriba + 1); return;
          case 'k': case 'y': case 'ArrowUp': st.arriba = Math.max(0, st.arriba - 1); return;
          case 'd': st.arriba = Math.min(max, st.arriba + Math.floor(cabe / 2)); return;
          case 'u': st.arriba = Math.max(0, st.arriba - Math.floor(cabe / 2)); return;
          case 'g': case '<': case 'Home': st.arriba = 0; return;
          case 'G': case '>': case 'End': st.arriba = max; return;
          case '/': st.escribiendo = ''; return;
          case 'N': return prog.siguiente(true);
          case 'h': case 'H': {
            if (tipo === 'info') { st.mensaje = 'El simulador no tiene el cursillo de info: espacio avanza, b retrocede, / busca y q sale.'; return; }
            const h = L.ayuda && L.ayuda.help && L.ayuda.help['less-h'];
            if (tipo === 'ayuda-less') return;
            if (h && tipo !== 'more') { st.ayuda = paginador(h, 'ayuda-less', ''); st.ayuda.pantalla(ultimoAncho, ultimoAlto); return; }
            st.mensaje = tipo === 'more' ? 'Sin ayuda de more: espacio avanza, q sale' : 'Sin ayuda de less: espacio, b, / y q'; return;
          }
          case 'n': case 'p': case 't': case '[': case ']':
            if (tipo === 'info' && k !== 'n') { st.mensaje = 'El simulador solo tiene el principio de este nodo de info: no pasa a otros nodos.'; return; }
            if (k === 'n') return prog.siguiente();
            return;
        }
      },
      // lo que more ha ido escribiendo en la terminal (se queda en pantalla al salir, como en Ubuntu)
      mostrado() { const ls = lineasDe(ultimoAncho); return ls.slice(0, Math.min(ls.length, st.arriba + ultimoAlto - 1)).join('\n'); },
      siguiente(atras) {
        if (tipo === 'info' && !st.busca) { st.mensaje = 'El simulador solo tiene el principio de este nodo de info: no pasa a otros nodos.'; return; }
        if (!st.busca) return;
        const ls = lineasDe(ultimoAncho);
        let re; try { re = new RegExp(st.busca, 'i'); } catch (e) { st.mensaje = 'Patrón no válido'; return; }
        if (atras) { for (let i = st.arriba - 1; i >= 0; i--) if (re.test(ls[i].replace(/\x1b\[[0-9;]*m/g, ''))) { st.arriba = i; return; } }
        else { for (let i = st.arriba + 1; i < ls.length; i++) if (re.test(ls[i].replace(/\x1b\[[0-9;]*m/g, ''))) { st.arriba = i; return; } }
        st.mensaje = 'Pattern not found  (press RETURN)';
      },
      // atajos para los botones de la terminal
      teclas: tipo === 'more' ? [['espacio', ' ', 'página siguiente'], ['Intro', 'Enter', 'una línea'], ['q', 'q', 'salir']]
        : tipo === 'systemctl' ? [['espacio', ' ', 'avanzar'], ['↓', 'ArrowDown', 'bajar'], ['h', 'h', 'ayuda'], ['q', 'q', 'salir']]
          : [['espacio', ' ', 'avanzar'], ['b', 'b', 'retroceder'], ['/', '/', 'buscar'], ['n', 'n', 'siguiente'], ['h', 'h', 'ayuda'], ['q', 'q', 'salir']]
    };
    void extra;
    return prog;
  }
  L.paginador = paginador;
  O.less = function* (c) {
    const archivos = c.args.filter((a) => a[0] !== '-' || a === '-');
    const ops = c.args.filter((a) => a[0] === '-' && a !== '-');
    if (ops.includes('--help')) { c.aviso('El simulador no tiene la ayuda de less: dentro de less, q sale, espacio avanza, b retrocede y / busca.'); return 0; }
    if (ops.some((o) => !/^-[NSFRXi]+$/.test(o))) return c.sinOpcion(ops.find((o) => !/^-[NSFRXi]+$/.test(o)));
    let texto = '', nombre = '', cod = 0;
    if (!archivos.length) {
      if (c.ttyIn) { c.err('Missing filename ("less --help" for help)\n'); return 1; }
      texto = yield* c.leeTodo();
    } else {
      for (const f of archivos) {
        try { texto += f === '-' ? yield* c.leeTodo() : leeArchivo(c, f); nombre = nombre || f; }
        catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(e.codigo === 'EISDIR' ? `${f} is a directory\n` : `${f}: ${errSis(e)}\n`); cod = 1; }
      }
      if (archivos.length > 1) c.nota('El simulador junta todos los archivos en uno; en tu Ubuntu, less pasa de uno a otro con :n.');
      if (!texto && cod) return cod;
    }
    if (!c.ttyOut) { c.sale(texto); return cod; }
    if (ops.some((o) => o.includes('N'))) texto = texto.replace(/\n$/, '').split('\n').map((l, i) => String(i + 1).padStart(7) + ' ' + l).join('\n') + '\n';
    yield { tipo: 'programa', programa: paginador(texto, 'less', nombre) };
    return cod;
  };
  O.more = function* (c) {
    const archivos = c.args.filter((a) => a[0] !== '-');
    if (c.args.some((a) => a === '--help')) { yield* ayuda(c); return 0; }
    let cod = 0;
    const trozos = [];
    if (!archivos.length) {
      if (c.ttyIn) { c.err('more: falta un operando\nPruebe \'more --help\' para más información.\n'); return 1; }
      trozos.push({ nombre: null, texto: yield* c.leeTodo() });
    }
    for (const f of archivos) {
      try { trozos.push({ nombre: f, texto: leeArchivo(c, f) }); }
      catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(e.codigo === 'EISDIR' ? `\n*** ${f}: directorio ***\n\n` : `more: no se puede abrir ${f}: ${errSis(e)}\n`); cod = 1; }
    }
    const cab = (n) => `::::::::::::::\n${n}\n::::::::::::::\n`;
    const todo = trozos.map((t) => (t.nombre !== null && (!c.ttyOut || trozos.length > 1) ? cab(t.nombre) : '') + t.texto).join('');
    if (!c.ttyOut) { c.sale(todo); return cod; }
    const filas = trocea(todo.replace(/\n$/, '').split('\n'), c.columnas || 80);
    if (filas.length < (c.lineas || 24)) { c.sale(todo); return cod; }
    yield { tipo: 'programa', programa: paginador(todo, 'more', archivos[0] || '') };
    return cod;
  };
  O.man = function* (c) {
    let a = c.args.slice();
    if (!a.length) { c.err('¿Qué página de manual quiere?\nPor ejemplo, pruebe \'man man\'.\n'); return 1; }
    if (a[0] === '-k') { if (a.length < 2) { c.err('apropos ¿qué?\n'); return 1; } return yield* L.apropos(c, a.slice(1)); }
    if (a[0] === '-f') return yield* L.ordenes.whatis(Object.assign({}, c, { args: a.slice(1) }));
    if (a[0] === '--help' || a[0] === '-h') { yield* ayuda(c, 'man'); return 0; }
    const soloRuta = a[0] === '-w' || a[0] === '--where' || a[0] === '--path' || a[0] === '--location';
    if (soloRuta) { a.shift(); if (!a.length) { c.aviso('El simulador no tiene man -w sin página (en Ubuntu da la lista de carpetas del manual).'); return 1; } }
    let seccion = null;
    if (/^\d$/.test(a[0]) && a.length > 1) seccion = a.shift();
    yield { tipo: 'ayuda' };
    let paginas = (L.ayuda && L.ayuda.man) || {};
    // escenario con manpages-es instalado: las páginas que tiene, en español
    if (L.manEs(c.sis)) { if (!L.ayudaEs) yield { tipo: 'carga', archivo: 'linux-ayuda-es.js' }; if (L.ayudaEs) paginas = Object.assign({}, paginas, L.ayudaEs.man); }
    let cod = 0;
    for (const n of a) {
      const clave = seccion && paginas[n + '.' + seccion] ? n + '.' + seccion : n;
      // la página existe solo si está su archivo en /usr/share/man (los paquetes sin instalar no la tienen)
      let instalada = false;
      ['1', '5', '7', '8'].forEach((s) => { if (!seccion || seccion === s) { try { c.fs.resuelve(`/usr/share/man/man${s}/${n}.${s}.gz`, { uid: 0, gid: 0 }); instalada = true; } catch (e) { /* no */ } } });
      if (!instalada || paginas[clave] === undefined) {
        if (instalada) { c.aviso(`El simulador no tiene copiada la página de man de ${n}. En tu Ubuntu, man ${n} la enseña.`); cod = 16; continue; }
        c.err(seccion ? `No existe entrada de manual para ${n} en la sección ${seccion}\n` : `Ninguna entrada del manual para ${n}\n`); cod = 16; continue;
      }
      const p = paginas[clave];
      L.registra(c.sis, { tipo: 'ayuda', programa: 'man', tema: n });
      const sec = (p.match(/^\S+\((\d)\w*\)/m) || [])[1] || seccion || '1';
      // man -w: dónde está la página que enseñaría man
      if (soloRuta) { c.sale(`/usr/share/man/${L.manEs(c.sis) && L.ayudaEs && L.ayudaEs.man[clave] !== undefined ? 'es/' : ''}man${sec}/${n}.${sec}.gz\n`); continue; }
      if (!c.ttyOut) { c.sale(p.replace(/.\x08/g, '')); continue; }
      // los avisos de troff (lsblk) salen en la terminal antes de que se abra la página, no dentro
      const avisosTroff = (p.match(/^troff:.*\n/gm) || []).join('');
      if (avisosTroff) c.err(avisosTroff);
      yield { tipo: 'programa', programa: paginador(avisosTroff ? p.replace(/^troff:.*\n/gm, '') : p, 'man', `${n}(${sec})`) };
      if (L.ayuda.recortadas && L.ayuda.recortadas.includes(clave)) c.nota(`El simulador recorta la página de man de ${n}: deja el nombre, la sinopsis y las opciones que se enseñan. En tu Ubuntu está entera.`);
    }
    return cod;
  };

  /* ---------------- top ---------------- */
  function topPantalla(c, ancho, alto, orden) {
    const sis = c.sis;
    const ps = sis._procs.slice();
    const ahora = c.ahora();
    const ejec = ps.filter((p) => p.estado === 'R').length;
    const lineas = [];
    const N = (t) => `\x1b[1m${t}\x1b[22m`;
    lineas.push(`top - ${U.strftime('%H:%M:%S', ahora)} ${arriba(c)},  ${usuarios(c)} users,  load average: ${carga(c)}`);
    lineas.push(`Tareas:${N(' ' + String(ps.length).padStart(3) + ' ')}total,${N(' ' + String(ejec).padStart(3) + ' ')}ejecutar,${N(' ' + String(ps.length - ejec).padStart(4) + ' ')}hibernar,${N('    0 ')}detener,${N('    0 ')}zombie`);
    const r = U.mulberry32(Math.floor(ahora / 3000));
    const us = 1 + r() * 4, sy = 0.5 + r() * 2;
    lineas.push(`%Cpu(s): ${U.numES(us, 1).padStart(4)} us, ${U.numES(sy, 1).padStart(4)} sy,  0,0 ni, ${U.numES(100 - us - sy, 1).padStart(4)} id,  0,0 wa,  0,0 hi,  0,0 si,  0,0 st `);
    const libre = 1351.7 - (r() * 20);
    lineas.push(`MiB Mem :   3894,5 total,   ${U.numES(libre, 1)} libre,    ${U.numES(3894.5 - libre - 1761.3, 1)} usado,   1761,3 búf/caché    `);
    lineas.push(`MiB Intercambio:   1908,0 total,   1908,0 libre,      0,0 usado.   ${U.numES(libre + 1433.6, 1)} dispon `);
    lineas.push('');
    lineas.push(INV('    PID USUARIO   PR  NI    VIRT    RES    SHR S  %CPU  %MEM     HORA+ ORDEN'.padEnd(ancho)));
    ps.forEach((p) => { if (p.orden === 'top') p.cpu = 0.3 + r() * 0.4; else if (p.orden === 'gnome-shell') p.cpu = 0.7 + r() * 1.5; });
    const orden2 = orden === 'mem' ? (a, b) => b.mem - a.mem || a.pid - b.pid : (a, b) => b.cpu - a.cpu || a.pid - b.pid;
    ps.sort(orden2);
    const hueco = Math.max(0, ancho - 72);
    for (const p of ps) {
      if (lineas.length >= alto) break;
      const t = p.tiempo + (p.orden === 'gnome-shell' ? (ahora - sis.arranque) / 400000 : 0);
      const tiempo = Math.floor(t / 60) + ':' + U.numES(t % 60, 2).replace(',', '.').padStart(5, '0');
      let nom = p.orden;
      if (nom.length > hueco) nom = nom.slice(0, Math.max(0, hueco - 1)) + '+';
      const pr = p.ni === -20 ? '0' : p.ni === -1 ? '19' : String(20 + p.ni);
      lineas.push(`${String(p.pid).padStart(7)} ${c.sis.nombreUid(p.uid).slice(0, 8).padEnd(8)} ${pr.padStart(3)} ${String(p.ni).padStart(3)} ${String(p.virt).padStart(7)} ${String(p.res).padStart(6)} ${String(p.shr).padStart(6)} ${p.estado} ${U.numES(p.cpu, 1).padStart(5)} ${U.numES(p.mem, 1).padStart(5)} ${tiempo.padStart(9)} ${nom}`);
    }
    return lineas;
  }
  O.top = function* (c) {
    const a = c.args.slice();
    let lote = false, vueltas = Infinity;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === '-b') lote = true;
      else if (a[i] === '-n') vueltas = +a[++i];
      else if (/^-n\d+$/.test(a[i])) vueltas = +a[i].slice(2);
      else if (/^-bn\d+$/.test(a[i])) { lote = true; vueltas = +a[i].slice(3); }
      else if (a[i] === '-h') { c.sale('  procps-ng 4.0.4\nUsage:\n  top -hv | -bcEeHiOSs1 -d secs -n max -u|U user -p pid(s) -o field -w [num]\n'); return 0; }
      else return c.sinOpcion(a[i]);
    }
    if (lote || !c.ttyOut) {
      const n = Number.isFinite(vueltas) ? vueltas : (c.ttyOut ? 1 : 1);
      if (!Number.isFinite(vueltas)) c.nota('En tu Ubuntu, top -b sigue escribiendo cada 3 segundos hasta Ctrl + C; el simulador escribe una vez.');
      for (let k = 0; k < n; k++) { if (k) { yield { tipo: 'espera', ms: 3000 }; c.sale('\n'); } c.sale(topPantalla(c, 80, 9999, 'cpu').join('\n') + '\n'); }
      return 0;
    }
    let orden = 'cpu';
    const prog = {
      tipo: 'top', titulo: 'top', refresco: 3000,
      // como top: lo que no cabe a lo ancho se corta (sin la marca de less)
      pantalla: (ancho, alto) => topPantalla(c, ancho, alto, orden).map((l) => cortaA(l, ancho)),
      tecla: (k) => {
        if (k === 'q' || k === 'Q') return 'fin';
        if (k === 'M') orden = 'mem'; else if (k === 'P') orden = 'cpu';
        else if (k === 'k' || k === 'r') prog.mensaje = 'El simulador todavía no tiene k ni r en top (se ven en la UT6).';
      },
      teclas: [['q', 'q', 'salir'], ['M', 'M', 'ordenar por memoria'], ['P', 'P', 'ordenar por CPU']]
    };
    yield { tipo: 'programa', programa: prog };
    return 0;
  };

  /* ---------------- sudo y passwd ---------------- */
  const leeClave = function* (c, prompt) { c.sh.emiteEv('out', prompt); const r = yield { tipo: 'leer', eco: false, prompt }; c.sh.emiteEv('out', '\n'); return r; };
  O.sudo = function* (c) {
    const a = c.args.slice();
    let usuarioDest = 'root';
    while (a.length && a[0][0] === '-') {
      const o = a.shift();
      if (o === '-k' || o === '-K') { c.sh.sudoHasta = -1; if (!a.length) return 0; continue; }
      if (o === '-u') { usuarioDest = a.shift(); continue; }
      if (o === '--') break;
      if (o === '-h' || o === '--help') { yield* ayuda(c, 'sudo'); return 0; }
      if (o === '-i' || o === '-s' || o === '-l' || o === '-v' || o === '-e') { c.aviso(`El simulador todavía no tiene sudo ${o} (se ve en la UT6).`); return 1; }
      c.err(`sudo: opción inválida -- '${o.slice(1, 2)}'\nuso: sudo -h | -K | -k | -V\n`); return 1;
    }
    if (!a.length) { c.err('uso: sudo -h | -K | -k | -V\nuso: sudo -v [-ABkNnS] [-g grupo] [-h host] [-p prompt] [-u usuario]\nuso: sudo -l [-ABkNnS] [-g grupo] [-h host] [-p prompt] [-U usuario]\n            [-u usuario] [orden [arg ...]]\nuso: sudo [-ABbEHkNnPS] [-r rol] [-t tipo] [-C num] [-D directorio]\n            [-g grupo] [-h host] [-p prompt] [-R directorio] [-T tiempo]\n            [-u usuario] [VAR=valor] [-i | -s] [orden [arg ...]]\nuso: sudo -e [-ABkNnS] [-r rol] [-t tipo] [-C num] [-D directorio]\n            [-g grupo] [-h host] [-p prompt] [-R directorio] [-T tiempo]\n            [-u usuario] archivo ...\n'); return 1; }
    const sis = c.sis;
    const dest = sis.usuario(usuarioDest);
    if (!dest) { c.err(`sudo: usuario desconocido ${usuarioDest}\n`); return 1; }
    const enSudo = c.uid === 0 || sis.gruposDe(c.usuario).some((g) => g.nombre === 'sudo' || g.nombre === 'admin');
    if (c.uid !== 0 && c.ahora() > c.sh.sudoHasta && c.sh.sinTty) { c.err('sudo: a terminal is required to read the password; either use the -S option to read from standard input or configure an askpass helper\nsudo: se requiere una contraseña\n'); return 1; }
    if (c.uid !== 0 && c.ahora() > c.sh.sudoHasta) {
      let bien = false;
      for (let intento = 0; intento < 3; intento++) {
        const clave = yield* leeClave(c, `[sudo] contraseña para ${c.usuario}: `);
        if (clave === null) { c.err('sudo: se requiere una contraseña\n'); return 1; }
        if (sis.compruebaClave(c.usuario, clave)) { bien = true; break; }
        yield { tipo: 'espera', ms: 2000 };
        if (intento < 2) c.err('Lo siento, pruebe otra vez.\n');
      }
      if (!bien) { c.err('sudo: 3 intentos de contraseña incorrectos\n'); return 1; }
      if (!enSudo) { c.err(`${c.usuario} no está en el archivo sudoers.\n`); return 1; }
      c.sh.sudoHasta = c.ahora() + 15 * 60000;
      // el primer sudo correcto deja este archivo en la carpeta personal
      try {
        const home = c.fs.resuelve(sis.home(c.usuario), { uid: 0, gid: 0 }).ino;
        if (!home.hijos.has('.sudo_as_admin_successful')) { const f = c.fs.nuevo('-', 0o644, c.uid, c.sh.gid, { datos: '' }); c.fs.enlaza(home, '.sudo_as_admin_successful', f, sis.home(c.usuario) + '/.sudo_as_admin_successful'); }
      } catch (e) { /* sin carpeta */ }
    } else if (c.uid !== 0 && !enSudo) { c.err(`${c.usuario} no está en el archivo sudoers.\n`); return 1; }
    // la orden se ejecuta como el otro usuario, con el PATH seguro de /etc/sudoers
    const sub = c.sh.copia();
    sub.uid = dest.uid; sub.gid = dest.gid; sub.grupos = sis.gruposDe(dest.nombre).map((g) => g.gid); sub.usuario = dest.nombre;
    sub.interactiva = false; sub.interactivaPadre = false; sub.esSudo = true;
    const env = { HOME: dest.home, USER: dest.nombre, LOGNAME: dest.nombre, SUDO_USER: c.usuario, SUDO_UID: String(c.uid), SUDO_GID: String(c.sh.gid), SUDO_COMMAND: '/usr/bin/' + a.join(' '), PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin', MAIL: '/var/mail/' + dest.nombre, SHELL: '/bin/bash' };
    Object.keys(env).forEach((k) => sub.asigna(k, env[k], true));
    let extra = {};
    while (a.length && /^[A-Za-z_]\w*=/.test(a[0])) { const [k, ...v] = a.shift().split('='); extra[k] = v.join('='); }
    const nombre = a[0];
    if (L.internas[nombre] && !L.buscaEnPath(Object.assign({}, c, { sh: sub }), nombre).length) { c.err(`sudo: ${nombre}: orden no encontrada\n`); return 1; }
    // sudo no ve las órdenes internas: busca en el PATH
    const rutas = L.buscaEnPath({ sh: sub, fs: c.fs, cred: sub.cred(), resuelve: (r) => c.fs.resuelve(r, sub.cred(), { cwd: sub.cwdIno }) }, nombre);
    if (!nombre.includes('/') && !rutas.length) {
      const D2 = D();
      if ((D2.ordenesUbuntu || []).includes(nombre)) { c.aviso(`El simulador no tiene la orden «${nombre}». En tu Ubuntu sí funciona.`); return 1; }
      c.err(`sudo: ${nombre}: orden no encontrada\n`); return 1;
    }
    return yield* sub.ejecutaPrograma(nombre, a, c.io, extra);
  };
  O.passwd = function* (c) {
    const sis = c.sis;
    const a = c.args.slice();
    if (a[0] === '--help' || a[0] === '-h') { yield* ayuda(c); return 0; }
    if (a[0] === '-S') {
      const u = a[1] || c.usuario;
      if (u !== c.usuario && c.uid !== 0) { c.err('passwd: Permiso denegado.\n'); return 1; }
      const linea = sis.lee('/etc/shadow').split('\n').find((l) => l.startsWith(u + ':'));
      if (!linea) { c.err(`passwd: el usuario «${u}» no existe\n`); return 1; }
      const cs = linea.split(':');
      const est = cs[1].startsWith('!') ? 'L' : cs[1] === '*' || cs[1] === '' ? (cs[1] === '' ? 'NP' : 'L') : 'P';
      c.sale(`${u} ${est} ${U.strftime('%Y-%m-%d', +cs[2] * 864e5 + 43200000)} ${cs[3]} ${cs[4]} ${cs[5]} ${cs[6] || -1}\n`);
      return 0;
    }
    if (a[0] && a[0][0] === '-') { c.aviso(`El simulador todavía no tiene passwd ${a[0]} (se ve en la UT6).`); return 1; }
    const u = a[0] || c.usuario;
    if (!sis.usuario(u)) { c.err(`passwd: el usuario «${u}» no existe\n`); return 1; }
    if (u !== c.usuario && c.uid !== 0) { c.err('passwd: Usted no puede ver o cambiar la información de la contraseña para ' + u + '.\n'); return 1; }
    if (c.uid !== 0) {
      c.sale(`Cambiando la contraseña de ${u}.\n`);
      const actual = yield* leeClave(c, 'Contraseña actual: ');
      if (actual === null) { c.err('passwd: Error de manipulación del testigo de autenticación\npasswd: no se ha cambiado la contraseña\n'); return 10; }
      if (!sis.compruebaClave(u, actual)) {
        const otra = yield* leeClave(c, 'Contraseña actual: ');
        yield { tipo: 'espera', ms: 2000 };
        if (otra === null || !sis.compruebaClave(u, otra)) { c.err('passwd: Error de manipulación del testigo de autenticación\npasswd: no se ha cambiado la contraseña\n'); return 10; }
      }
    }
    for (let intento = 0; intento < 3; intento++) {
      const n1 = yield* leeClave(c, 'Nueva contraseña: ');
      if (n1 === null) { c.err('passwd: Error de manipulación del testigo de autenticación\npasswd: no se ha cambiado la contraseña\n'); return 10; }
      if (c.uid !== 0) {
        if ([...n1].length < 8) { c.sale('CONTRASEÑA INCORRECTA: La contraseña tiene menos de 8 caracteres\n'); continue; }
        if (sis.compruebaClave(u, n1)) { c.sale('CONTRASEÑA INCORRECTA: La contraseña es idéntica a la anterior\n'); continue; }
      }
      const n2 = yield* leeClave(c, 'Vuelva a escribir la nueva contraseña: ');
      if (n2 === null) { c.err('passwd: Error de manipulación del testigo de autenticación\npasswd: no se ha cambiado la contraseña\n'); return 10; }
      if (n1 !== n2) { c.sale('Las contraseñas no coinciden.\n'); continue; }
      sis.cambiaClave(u, n1);
      c.sale('passwd: contraseña actualizada correctamente\n');
      return 0;
    }
    c.err('passwd: Se ha agotado el número máximo de reintentos para el servicio\npasswd: no se ha cambiado la contraseña\n');
    return 10;
  };

  /* ---------------- apt y apt-get ---------------- */
  const VERSIONES = { nano: '7.2-2ubuntu0.2', coreutils: '9.4-3ubuntu6.3', bash: '5.2.21-2ubuntu4', grep: '3.11-4build1', findutils: '4.9.0-5build1', procps: '2:4.0.4-4ubuntu3.3', iproute2: '6.1.0-1ubuntu6.4', 'iputils-ping': '3:20240117-1ubuntu0.1', sudo: '1.9.15p5-3ubuntu5.24.04.4', apt: '2.8.4ubuntu0.1', 'vim-tiny': '2:9.1.0016-1ubuntu7.20', file: '1:5.45-3build1', less: '590-2ubuntu2.1', usbutils: '1:017-3build1', pciutils: '1:3.10.0-2build1', kmod: '31+20240202-2ubuntu7.2', passwd: '1:4.13+dfsg1-4ubuntu3.2', 'man-db': '2.12.0-4build2', mount: '2.39.3-9ubuntu6.6', 'util-linux': '2.39.3-9ubuntu6.6', 'bind9-dnsutils': '1:9.18.39-0ubuntu0.24.04.9' };
  const BASE_DATOS = 152345;
  // apt show manpages-es en la máquina de pruebas (21-11-2026)
  const SHOW_MANPAGES_ES = 'Package: manpages-es\nVersion: 4.21.0-2\nPriority: optional\nSection: universe/doc\nSource: manpages-l10n\nOrigin: Ubuntu\nMaintainer: Ubuntu Developers <ubuntu-devel-discuss@lists.ubuntu.com>\nOriginal-Maintainer: Dr. Helge Kreutzmann <debian@helgefjell.de>\nBugs: https://bugs.launchpad.net/ubuntu/+filebug\nInstalled-Size: 1.653 kB\nSuggests: man-browser, manpages\nConflicts: manpages-es-extra\nBreaks: util-linux-locales (<< 2.39.1-3)\nHomepage: https://manpages-l10n-team.pages.debian.net/manpages-l10n/\nDownload-Size: 980 kB\nAPT-Manual-Installed: yes\nAPT-Sources: http://archive.ubuntu.com/ubuntu noble/universe amd64 Packages\nDescription: páginas de manual en español\n This package contains manual pages translated into Spanish, originating\n from a large number of projects which do not ship translated man pages\n themselves, including the traditional Linux manpages. The exact projects\n and man pages might change from release to release, so please look at the\n actually shipped files for the current set.\n .\n The following sections are included:\n  * 1 = User programs (e.g. ls, ln)\n  * 4 = Devices (e.g. hd, sd).\n  * 5 = File formats and protocols, syntaxes of several system\n        files (e.g. wtmp, /etc/passwd, nfs).\n  * 6 = Games etc.\n  * 7 = Conventions and standards, macro packages, etc.\n        (e.g. nroff, ascii).\n  * 8 = System administration commands.\n .\n The original (software) packages contain additional manual pages which\n have not been translated yet.\n\n';
  /* dpkg -l: solo la lista de los paquetes que conoce el simulador; en la terminal, con el paginador (less -S),
   * como dpkg-query */
  O.dpkg = function* (c) {
    const a = c.args.slice();
    if (a[0] !== '-l' && a[0] !== '--list') { c.aviso('El simulador solo tiene dpkg -l con el nombre de un paquete (por ejemplo, dpkg -l manpages-es).'); return 1; }
    const nombres = a.slice(1);
    const sis = c.sis;
    if (!nombres.length || nombres.some((n) => !sis.paquetes[n] && !VERSIONES[n])) {
      const n = nombres.find((x) => !sis.paquetes[x] && !VERSIONES[x]);
      if (n && /^[a-z0-9][a-z0-9.+-]*$/.test(n) && !(D().paquetesConocidos || []).includes(n)) { c.err(`dpkg-query: no se ha encontrado ningún paquete que corresponda con ${n}.\n`); return 1; }
      c.aviso('El simulador solo tiene dpkg -l con el nombre de un paquete que conoce (por ejemplo, dpkg -l manpages-es).'); return 1;
    }
    const filas = [];
    for (const n of nombres) {
      const p = sis.paquetes[n];
      if (!p) { c.aviso(`El simulador no tiene la ficha de dpkg de ${n}.`); return 1; }
      if (!p.esta) { c.err(`dpkg-query: no se ha encontrado ningún paquete que corresponda con ${n}.\n`); return 1; }
      if (!p.descripcion) { c.aviso(`El simulador no tiene la ficha de dpkg de ${n}.`); return 1; }
      filas.push(`ii  ${n.padEnd(14)} ${p.version.padEnd(12)} ${(p.arq || 'amd64').padEnd(12)} ${p.descripcion}`);
    }
    const t = 'Deseado=desconocido(U)/Instalar/eliminaR/Purgar/retener(H)\n| Estado=No/Inst/ficheros-Conf/desempaqUetado/medio-conF/medio-inst(H)/espera-disparo(W)/pendienTe-disparo\n|/ Err?=(ninguno)/requiere-Reinst (Estado,Err: mayúsc.=malo)\n||/ Nombre         Versión      Arquitectura Descripción\n+++-==============-============-============-=================================\n' + filas.join('\n') + '\n';
    if (!c.ttyOut) { c.sale(t); return 0; }
    yield { tipo: 'programa', programa: L.paginador(t, 'systemctl', 'dpkg') };
    return 0;
  };
  O.apt = function* (c) { return yield* apt(c, false); };
  O['apt-get'] = function* (c) { return yield* apt(c, true); };
  function* apt(c, esGet) {
    const sis = c.sis;
    const a = c.args.slice();
    let si = false, simular = false;
    const resto = [];
    for (const x of a) { if (x === '-y' || x === '--yes' || x === '--assume-yes') si = true; else if (x === '-s' || x === '--simulate' || x === '--dry-run') simular = true; else if (x === '--help' || x === '-h') { yield* ayuda(c, esGet ? 'apt-get' : 'apt'); return 0; } else if ((x === '--installed' || x === '--upgradable') && !esGet) resto.push(x); else if (x[0] === '-' && x !== '-') { return c.sinOpcion(x); } else resto.push(x); }
    const sub = resto.shift();
    const tty = c.ttyOut;
    const hecho = (t) => t + (tty ? ' Hecho' : '') + '\n';
    if (!esGet && !tty) c.err('\nWARNING: apt does not have a stable CLI interface. Use with caution in scripts.\n\n');
    if (!sub) { if (esGet) c.sale('apt 2.8.4ubuntu0.1 (amd64)\n'); yield* ayuda(c, esGet ? 'apt-get' : 'apt'); return 1; }
    const pendientes = () => (sis.listasAlDia ? sis.actualizables.length : 0);
    const resumen = (act, nuevos, borrar) => `${act} actualizados, ${nuevos} nuevos se instalarán, ${borrar} para eliminar y ${pendientes() - act} no actualizados.\n`;
    const leyendo = () => { c.sale(hecho('Leyendo lista de paquetes...') + hecho('Creando árbol de dependencias...') + hecho('Leyendo la información de estado...')); };
    const sinPermiso = (bloqueo) => {
      if (bloqueo === 'lists') { c.sale(tty ? 'Leyendo lista de paquetes... Hecho\n' : 'Leyendo lista de paquetes...\n'); c.err('E: No se pudo abrir el fichero de bloqueo «/var/lib/apt/lists/lock» - open (13: Permiso denegado)\nE: No se pudo bloquear el directorio /var/lib/apt/lists/\n'); }
      else c.err('E: No se pudo abrir el fichero de bloqueo «/var/lib/dpkg/lock-frontend» - open (13: Permiso denegado)\nE: No se pudo obtener el bloqueo de la interfaz dpkg (/var/lib/dpkg/lock-frontend). ¿Es usted superusuario?\n');
      return 100;
    };
    const confirma = function* () {
      if (si) return true;
      const texto = '¿Desea continuar? [S/n] ';
      c.sale(texto);
      const r = yield* c.leeLinea(texto, true);
      if (r === null || /^[sSyY]?$/.test(r.trim())) return true;
      c.sale('Abortado.\n');
      return false;
    };
    const lista = (nombres) => { let l = '', linea = ' '; nombres.forEach((n) => { if (linea.length + n.length + 1 > 79) { l += linea + '\n'; linea = ' '; } linea += ' ' + n; }); return l + linea + '\n'; };
    switch (sub) {
      case 'update': {
        if (c.uid !== 0) return sinPermiso('lists');
        const fuentes = [['Obj', 'http://security.ubuntu.com/ubuntu noble-security InRelease'], ['Obj', 'http://archive.ubuntu.com/ubuntu noble InRelease'], ['Obj', 'http://archive.ubuntu.com/ubuntu noble-updates InRelease'], ['Obj', 'http://archive.ubuntu.com/ubuntu noble-backports InRelease']];
        for (let i = 0; i < fuentes.length; i++) { yield { tipo: 'espera', ms: 300 }; c.sale(`${fuentes[i][0]}:${i + 1} ${fuentes[i][1]}\n`); }
        leyendo();
        sis.listasAlDia = true;
        c.sale(pendientes() ? `Se pueden actualizar ${pendientes()} paquetes. Ejecute «apt list --upgradable» para verlos.\n` : 'Todos los paquetes están actualizados.\n');
        return 0;
      }
      case 'upgrade': case 'full-upgrade': case 'dist-upgrade': {
        if (c.uid !== 0 && !simular) return sinPermiso();
        leyendo();
        c.sale(hecho('Calculando la actualización...'));
        const ps = sis.listasAlDia ? sis.actualizables : [];
        if (!ps.length) { c.sale(resumen(0, 0, 0)); return 0; }
        c.sale('Se actualizarán los siguientes paquetes:\n' + lista(ps.map((p) => p[0])));
        c.sale(resumen(ps.length, 0, 0));
        c.sale(`Se necesita descargar ${U.numES(ps.length * 1.9, 1)} MB de archivos.\nSe utilizarán ${ps.length * 37} kB de espacio de disco adicional después de esta operación.\n`);
        if (!(yield* confirma())) return 1;
        for (let i = 0; i < ps.length; i++) { if (i % 6 === 0) yield { tipo: 'espera', ms: 200 }; c.sale(`Des:${i + 1} http://archive.ubuntu.com/ubuntu ${ps[i][1]} amd64 ${ps[i][0]} ${ps[i][3]} ${ps[i][2]} [${100 + i * 37} kB]\n`); }
        c.sale(`Descargados ${U.numES(ps.length * 1.9, 1)} MB en 2s (${U.numES(ps.length * 0.95, 1)} MB/s)\n(Leyendo la base de datos ... ${BASE_DATOS} ficheros o directorios instalados actualmente.)\n`);
        for (const p of ps) { c.sale(`Preparando para desempaquetar .../${p[0]}_${p[2].replace(/^\d+:/, '')}_${p[3]}.deb ...\nDesempaquetando ${p[0]} (${p[2]}) sobre (${p[4]}) ...\n`); }
        for (const p of ps) c.sale(`Configurando ${p[0]} (${p[2]}) ...\n`);
        c.sale('Procesando disparadores para man-db (2.12.0-4build2) ...\n');
        c.nota('El simulador resume la salida de apt upgrade: en tu Ubuntu la lista y los tamaños dependen de las actualizaciones de ese día.');
        sis.actualizables = [];
        return 0;
      }
      case 'install': case 'reinstall': {
        if (!resto.length) { if (c.uid !== 0) return sinPermiso(); leyendo(); c.sale(resumen(0, 0, 0)); return 0; }
        if (c.uid !== 0 && !simular) return sinPermiso();
        if (simular) c.sale('NOTA: ¡Esto es sólo una simulación!\n      apt-get necesita privilegios de administrador para la ejecución real.\n      Tenga también en cuenta que se han desactivado los bloqueos,\n      ¡no dependa la situación real actual de la relevancia de esto!\n');
        leyendo();
        const nuevos = [], adicionales = [], ya = [];
        for (const n of resto) {
          const p = sis.paquetes[n];
          if (p) { if (p.esta) ya.push(n); else { (p.deps || []).forEach((d) => { if (!sis.paquetes[d].esta && !nuevos.includes(d)) { nuevos.push(d); adicionales.push(d); } }); nuevos.push(n); } continue; }
          if (VERSIONES[n]) { ya.push(n); continue; }
          if ((D().ordenesUbuntu || []).length && /^[a-z0-9][a-z0-9.+-]+$/.test(n) && !/^noexiste/.test(n) && (D().paquetesConocidos || []).includes(n)) { c.aviso(`El simulador no tiene el paquete «${n}».`); return 100; }
          c.err(`E: No se ha podido localizar el paquete ${n}\n`); return 100;
        }
        ya.forEach((n) => c.sale(`${n} ya está en su versión más reciente (${sis.paquetes[n] ? sis.paquetes[n].version : VERSIONES[n]}).\n`));
        if (!nuevos.length) { c.sale(resumen(0, 0, 0)); return 0; }
        if (nuevos.some((n) => sis.paquetes[n].grande)) { c.aviso('El simulador no instala kubuntu-desktop: son más de mil paquetes y unos 4 GB. Hazlo en tu máquina Ubuntu-SOM, con una instantánea antes.'); return 1; }
        if (adicionales.length) c.sale('Se instalarán los siguientes paquetes adicionales:\n' + lista(adicionales));
        c.sale('Se instalarán los siguientes paquetes NUEVOS:\n' + lista(nuevos.slice().sort()));
        c.sale(resumen(0, nuevos.length, 0));
        if (simular) { nuevos.forEach((n) => c.sale(`Inst ${n} (${sis.paquetes[n].version} Ubuntu:24.04/${sis.paquetes[n].origen.split('/')[0]} [amd64])\n`)); nuevos.forEach((n) => c.sale(`Conf ${n} (${sis.paquetes[n].version} Ubuntu:24.04/${sis.paquetes[n].origen.split('/')[0]} [amd64])\n`)); return 0; }
        const kb = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.')) * (/MB/.test(s) ? 1000 : 1);
        const desc = nuevos.reduce((s, n) => s + kb(sis.paquetes[n].descarga), 0), inst = nuevos.reduce((s, n) => s + kb(sis.paquetes[n].instalado), 0);
        // como SizeToStr de apt: una cifra decimal por debajo de 100 y enteros con punto de miles por debajo de 10 000
        const fmtKb = (k) => { const f = (v, u) => (v < 100 ? U.numES(v, 1) : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')) + ' ' + u; return k < 10000 ? f(k, 'kB') : f(k / 1000, 'MB'); };
        c.sale(`Se necesita descargar ${fmtKb(desc)} de archivos.\nSe utilizarán ${fmtKb(inst)} de espacio de disco adicional después de esta operación.\n`);
        if (adicionales.length && !(yield* confirma())) return 1;
        for (let i = 0; i < nuevos.length; i++) { yield { tipo: 'espera', ms: 300 }; const p = sis.paquetes[nuevos[i]]; c.sale(`Des:${i + 1} http://archive.ubuntu.com/ubuntu ${p.origen} amd64 ${p.nombre} ${p.arq || 'amd64'} ${p.version} [${p.descarga}]\n`); }
        c.sale(`Descargados ${fmtKb(desc)} en 0s (${fmtKb(desc * 3.2)}/s)\n`);
        let bd = BASE_DATOS + Object.values(sis.paquetes).filter((p) => p.esta).length * 9;
        nuevos.forEach((n, i) => {
          const p = sis.paquetes[n];
          c.sale(`Seleccionando el paquete ${n} previamente no seleccionado.\n`);
          if (i === 0) c.sale(`(Leyendo la base de datos ... ${bd} ficheros o directorios instalados actualmente.)\n`);
          c.sale(`Preparando para desempaquetar .../${n}_${p.version}_${p.arq || 'amd64'}.deb ...\nDesempaquetando ${n} (${p.version}) ...\n`);
        });
        nuevos.forEach((n) => { L.instalaPaquete(sis, n); c.sale(`Configurando ${n} (${sis.paquetes[n].version}) ...\n`); });
        c.sale('Procesando disparadores para man-db (2.12.0-4build2) ...\n');
        if (nuevos.includes('liburing2')) c.sale('Procesando disparadores para libc-bin (2.39-0ubuntu8.7) ...\n');
        return 0;
      }
      case 'remove': case 'purge': case 'autoremove': {
        if (sub === 'autoremove') { if (c.uid !== 0) return sinPermiso(); leyendo(); c.sale(resumen(0, 0, 0)); return 0; }
        if (c.uid !== 0 && !simular) return sinPermiso();
        leyendo();
        const quitar = [];
        for (const n of resto) {
          const p = sis.paquetes[n];
          if (p && p.esta) { quitar.push(n); continue; }
          if (p || VERSIONES[n] === undefined) { if (!p && !VERSIONES[n]) { c.err(`E: No se ha podido localizar el paquete ${n}\n`); return 100; } c.sale(`El paquete «${n}» no está instalado, no se eliminará\n`); continue; }
          c.aviso(`El simulador no deja quitar «${n}»: es parte del sistema base y las órdenes del simulador lo necesitan.`); return 1;
        }
        if (!quitar.length) { c.sale(resumen(0, 0, 0)); return 0; }
        c.sale('Los siguientes paquetes se ELIMINARÁN:\n' + lista(quitar.map((n) => n + (sub === 'purge' ? '*' : ''))));
        c.sale(resumen(0, 0, quitar.length));
        c.sale(`Se liberarán ${quitar.map((n) => sis.paquetes[n].instalado).join(' + ')} después de esta operación.\n`);
        if (!(yield* confirma())) return 1;
        c.sale(`(Leyendo la base de datos ... ${BASE_DATOS + 20} ficheros o directorios instalados actualmente.)\n`);
        quitar.forEach((n) => { c.sale(`Desinstalando ${n} (${sis.paquetes[n].version}) ...\n`); L.quitaPaquete(sis, n); });
        c.sale('Procesando disparadores para man-db (2.12.0-4build2) ...\n');
        return 0;
      }
      case 'list': {
        // apt list --upgradable: lo que se puede actualizar (lo que descubrió apt update); los datos son de una Ubuntu 24.04
        if (resto.includes('--upgradable') && !resto.some((x) => x[0] !== '-')) {
          c.sale(hecho('Listando...'));
          (sis.listasAlDia ? sis.actualizables : []).forEach((p) => c.sale(`${tty ? `\x1b[32m${p[0]}\x1b[0m` : p[0]}/${p[1]} ${p[2]} ${p[3]} [actualizable desde: ${p[4]}]\n`));
          c.nota('El simulador escribe esta lista con el formato de apt, pero no la ha comparado con la de una Ubuntu en español: los paquetes y las versiones dependen de las actualizaciones de ese día.');
          return 0;
        }
        // apt list [--installed] paquete…: los paquetes que conoce el simulador (la lista entera de Ubuntu es muy larga)
        const nombres = resto.filter((x) => x[0] !== '-');
        const conocidos = nombres.filter((n) => sis.paquetes[n]);
        if (!nombres.length || conocidos.length < nombres.length) { c.aviso('El simulador solo enseña apt list con el nombre de un paquete que conoce (por ejemplo, apt list --installed manpages-es).'); return 1; }
        c.sale(hecho('Listando...'));
        const instalados = resto.includes('--installed');
        conocidos.forEach((n) => {
          const p = sis.paquetes[n];
          if (instalados && !p.esta) return;
          const nom = tty ? `\x1b[32m${n}\x1b[0m` : n;
          c.sale(`${nom}/${p.origen.split('/')[0]}${p.esta ? ',now' : ''} ${p.version} ${p.arq || 'amd64'}${p.esta ? ' [instalado]' : ''}\n`);
        });
        return 0;
      }
      case 'show': {
        const n = resto.find((x) => x[0] !== '-');
        if (n === 'manpages-es') { c.sale(SHOW_MANPAGES_ES.replace('APT-Manual-Installed: yes\n', sis.paquetes[n].esta ? 'APT-Manual-Installed: yes\n' : '')); return 0; }
        c.aviso(`El simulador no tiene la ficha de apt show${n ? ' ' + n : ''}: solo la de manpages-es.`); return 1;
      }
      case 'search': case 'policy': case 'depends': case 'source': case 'clean': case 'edit-sources': case 'satisfy':
        c.aviso(`El simulador todavía no tiene «${c.nombre} ${sub}» (se ve en la UT7).`); return 1;
    }
    c.err(`E: Orden inválida ${sub}\n`);
    return 1;
  }

  /* ---------------- discos: lsblk, df, mount, umount ---------------- */
  function tabla(filas, cab, alinear) {
    const w = cab.map((h, k) => Math.max(U.anchoTexto(h), ...filas.map((f) => U.anchoTexto(String(f[k] === undefined ? '' : f[k])))));
    const fila = (f) => f.map((v, k) => { v = String(v === undefined ? '' : v); const last = k === f.length - 1; return alinear[k] === 'd' ? U.relleno(v, w[k], true) : (last ? v : U.relleno(v, w[k])); }).join(' ');
    return [fila(cab)].concat(filas.map(fila)).join('\n') + '\n';
  }
  O.lsblk = function* (c) {
    const r = yield* opciones(c, { cortas: 'fdlpamnr', largas: { fs: 'f', nodeps: 'd', list: 'l', paths: 'p', all: 'a', noheadings: 'n' } });
    if (typeof r === 'number') return r;
    const op = r.op, sis = c.sis;
    const discos = [];
    if (!op.d || true) sis.snaps.forEach(([s, t], i) => discos.push({ nombre: 'loop' + i, mm: '7:' + i, tam: t, ro: 1, tipo: 'loop', montaje: '/snap/' + s, fs: 'squashfs', fsver: '4.0', uso: '100%', disp: '0', particiones: [] }));
    sis.discos.forEach((d) => discos.push(d));
    let lista = [];
    const mont = (p) => { const m = sis.montajes.find((x) => x.disp === '/dev/' + p.nombre); return m ? m.en : (p.montaje === '[SWAP]' ? '[SWAP]' : (p.montaje && p.raiz === undefined ? p.montaje : '')); };
    discos.forEach((d) => {
      lista.push({ nombre: d.nombre, d, prefijo: '' });
      if (!op.d) (d.particiones || []).forEach((p, k) => lista.push({ nombre: p.nombre, d: p, prefijo: k === d.particiones.length - 1 ? '└─' : '├─' }));
    });
    if (r.resto.length) {
      const sel = [];
      for (const x of r.resto) {
        const n = x.replace(/^\/dev\//, '');
        const i = lista.findIndex((e) => e.nombre === n);
        if (i < 0) { c.err(`lsblk: ${x}: no es un dispositivo de bloques\n`); return 32; }
        sel.push(Object.assign({}, lista[i], { prefijo: '' }));
        if (lista[i].prefijo === '' && !op.d) for (let k = i + 1; k < lista.length && lista[k].prefijo; k++) sel.push(lista[k]);
      }
      lista = sel;
    }
    const nom = (e) => (op.l ? '' : e.prefijo) + (op.p ? '/dev/' : '') + e.nombre;
    let salida;
    if (op.f) {
      const filas = lista.map((e) => { const d = e.d; const m = mont(d); const montado = m && m !== '[SWAP]'; return [nom(e), d.fs && d.tipo !== 'disk' ? d.fs : '', d.fsver && d.tipo !== 'disk' ? d.fsver : '', d.etiqueta || '', d.tipo === 'loop' ? '' : (d.uuid || ''), montado ? (d.disp !== undefined ? d.disp : '') : '', montado ? (d.uso || '') : '', m]; });
      salida = tabla(filas, ['NAME', 'FSTYPE', 'FSVER', 'LABEL', 'UUID', 'FSAVAIL', 'FSUSE%', 'MOUNTPOINTS'], ['i', 'i', 'i', 'i', 'i', 'd', 'd', 'i']);
    } else {
      const filas = lista.map((e) => { const d = e.d; const [ma, mi] = d.mm.split(':'); return [nom(e), ma.padStart(3) + ':' + mi.padEnd(3), String(d.rm || 0), d.tam, String(d.ro || 0), d.tipo, mont(d)]; });
      salida = tabla(filas, ['NAME', 'MAJ:MIN', 'RM', 'SIZE', 'RO', 'TYPE', 'MOUNTPOINTS'], ['i', 'i', 'd', 'd', 'd', 'i', 'i']);
      salida = salida.replace(/^NAME( *)MAJ:MIN/, (m, s) => 'NAME' + s + 'MAJ:MIN');
    }
    if (op.n) salida = salida.split('\n').slice(1).join('\n');
    c.sale(salida);
    return 0;
  };
  O.df = function* (c) {
    const r = yield* opciones(c, { cortas: 'hiTaHkPl', conArg: 't', largas: { 'human-readable': 'h', inodes: 'i', 'print-type': 'T', all: 'a', si: 'H', type: 't=', total: 'total', local: 'l' } });
    if (typeof r === 'number') return r;
    const op = r.op, sis = c.sis;
    let ms = sis.montajes.slice();
    let cod = 0;
    if (r.resto.length) {
      const sel = [];
      for (const f of r.resto) {
        try { c.resuelve(f); sel.push(L.montajeDe(c, c.rutaAbs(f))); }
        catch (e) { if (!(e instanceof ErrorSis)) throw e; c.err(`df: ${f}: ${errSis(e)}\n`); cod = 1; }
      }
      ms = sel;
      if (!ms.length) return cod;
    }
    if (op.t) ms = ms.filter((m) => m.tipo === op.t);
    const h = (k) => U.humano(k * 1024);
    const uso = (u, d) => (u + d === 0 ? '-' : Math.ceil((u * 100) / (u + d)) + '%');
    let cab, filas, alin;
    if (op.i) {
      cab = ['S.ficheros'].concat(op.T ? ['Tipo'] : [], ['Nodos-i', 'NUsados', 'NLibres', 'NUso%', 'Montado en']);
      filas = ms.map((m) => [m.disp].concat(op.T ? [m.tipo] : [], m.nodos ? [op.h ? h(m.nodos / 1024 | 0) : m.nodos, op.h ? String(m.nusados) : m.nusados, op.h ? h((m.nodos - m.nusados) / 1024 | 0) : m.nodos - m.nusados, uso(m.nusados, m.nodos - m.nusados)] : ['0', '0', '0', '-'], [m.en]));
    } else {
      cab = ['S.ficheros'].concat(op.T ? ['Tipo'] : [], op.h ? ['Tamaño', 'Usados', 'Disp'] : ['bloques de 1K', 'Usados', 'Disponibles'], ['Uso%', 'Montado en']);
      filas = ms.map((m) => { const disp = m.disponibles !== undefined ? m.disponibles : m.bloques - m.usados; return [m.disp].concat(op.T ? [m.tipo] : [], op.h ? [h(m.bloques), m.usados ? h(m.usados) : '0', h(disp)] : [m.bloques, m.usados, disp], [uso(m.usados, disp), m.en]); });
    }
    alin = cab.map((x, k) => (k === 0 || x === 'Tipo' || k === cab.length - 1 ? 'i' : 'd'));
    // la primera columna mide al menos 14 (como df)
    const w0 = Math.max(14, ...filas.map((f) => String(f[0]).length));
    // con -h, las columnas de tamaño miden al menos 5 (como df)
    if (op.h) filas.forEach((f) => f.forEach((v, k) => { if (k > 0 && k < f.length - 2 && cab[k] !== 'Tipo') f[k] = String(v).padStart(5); }));
    const t = tabla(filas.map((f) => [String(f[0]).padEnd(w0)].concat(f.slice(1))), [cab[0].padEnd(w0)].concat(cab.slice(1)), alin);
    c.sale(t);
    return cod;
  };
  const SISTEMAS_VIRTUALES = ['sysfs on /sys type sysfs (rw,nosuid,nodev,noexec,relatime)', 'proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)', 'udev on /dev type devtmpfs (rw,nosuid,relatime,size=1966520k,nr_inodes=491630,mode=755,inode64)', 'devpts on /dev/pts type devpts (rw,nosuid,noexec,relatime,gid=5,mode=620,ptmxmode=000)'];
  O.mount = function* (c) {
    const sis = c.sis;
    const a = c.args.slice();
    const opc = {};
    const ops = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i] === '-t') { opc.t = a[++i]; continue; }
      if (a[i] === '-o') { opc.o = a[++i]; continue; }
      if (a[i] === '-a') { opc.a = true; continue; }
      if (a[i] === '-l') continue;
      if (a[i] === '--help' || a[i] === '-h') { yield* ayuda(c); return 0; }
      if (a[i][0] === '-') return c.sinOpcion(a[i]);
      ops.push(a[i]);
    }
    if (!ops.length && !opc.a) {
      // la lista de la máquina de pruebas, con las particiones de Ubuntu-SOM y lo que se haya montado después
      const reales = (D().montajes || SISTEMAS_VIRTUALES).slice();
      const propios = (m) => `${m.disp} on ${m.en} type ${m.tipo} (${m.opc})`;
      let l = [];
      reales.forEach((x) => {
        if (/^\/dev\/sda2 on \/ /.test(x)) { sis.montajes.filter((m) => m.disp === '/dev/sda2').forEach((m) => l.push(propios(m))); return; }
        if (/ on \/run\/user\/1000 /.test(x)) { l.push(x); sis.montajes.filter((m) => m.disp === '/dev/sda4' || m.disp === '/dev/sda1').forEach((m) => l.splice(l.length - 1, 0, propios(m))); return; }
        l.push(x);
      });
      sis.montajes.filter((m) => m.parte).forEach((m) => l.push(propios(m)));
      if (opc.t) l = l.filter((x) => x.includes(' type ' + opc.t + ' '));
      c.sale(l.join('\n') + '\n');
      return 0;
    }
    const fallo = (destino, msg) => { c.err(`mount: ${destino}: ${msg}\n       dmesg(1) puede ser que tenga más información tras el fallo de la llamada al sistema de montaje.\n`); return 32; };
    if (c.uid !== 0) return fallo(ops[ops.length - 1] || '', 'debe ser superusuario para utilizar mount.');
    // mount -a: lo que hay en /etc/fstab y aún no está montado
    let pares = [];
    if (opc.a) {
      sis.lee('/etc/fstab').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).forEach((l) => {
        const [disp, en, tipo] = l.trim().split(/\s+/);
        if (en === 'none' || tipo === 'swap') return;
        if (sis.montajes.some((m) => m.en === en)) return;
        pares.push([disp, en, tipo]);
      });
    } else if (ops.length === 2) pares.push([ops[0], ops[1], opc.t]);
    else {
      const linea = sis.lee('/etc/fstab').split('\n').find((l) => l.trim().split(/\s+/)[1] === ops[0] || l.trim().split(/\s+/)[0] === ops[0]);
      if (!linea) return fallo(ops[0], 'no se puede encontrar en /etc/fstab.');
      const [disp, en, tipo] = linea.trim().split(/\s+/);
      pares.push([disp, en, tipo]);
    }
    for (const [dispTxt, en, tipo] of pares) {
      // el dispositivo por nombre, por UUID= o por /dev/disk/by-uuid/
      let part = null;
      const uuid = (dispTxt.match(/^(?:UUID=|\/dev\/disk\/by-uuid\/)(.+)$/) || [])[1];
      sis.discos.forEach((d) => (d.particiones || []).forEach((p) => { if (('/dev/' + p.nombre === dispTxt) || (uuid && p.uuid === uuid)) part = p; }));
      if (!part) { if (sis.montajes.some((m) => m.disp === dispTxt)) return fallo(en, `${dispTxt} ya está montado en ${sis.montajes.find((m) => m.disp === dispTxt).en}.`); return fallo(en, `el dispositivo especial ${dispTxt} no existe.`); }
      if (part.raiz === undefined) return fallo(en, `${'/dev/' + part.nombre} ya está montado en ${part.montaje}.`);
      let pm;
      try { pm = c.resuelve(en).ino; } catch (e) { return fallo(en, 'el punto de montaje no existe.'); }
      if (pm.tipo !== 'd') return fallo(en, 'el punto de montaje no es un directorio.');
      if (sis.montajes.some((m) => m.disp === '/dev/' + part.nombre)) return fallo(en, `/dev/${part.nombre} ya está montado en ${sis.montajes.find((m) => m.disp === '/dev/' + part.nombre).en}.`);
      if (tipo && tipo !== 'auto' && tipo !== part.fs) return fallo(en, `tipo de sistema de ficheros incorrecto, opción incorrecta, superbloque incorrecto en /dev/${part.nombre}, falta la página de códigos o el programa auxiliar, o algún otro error.`);
      const raizFs = c.fs.ino(part.raiz);
      pm.montaje = raizFs.n; raizFs.raizDe = pm.n;
      const ruta = c.rutaAbs(en);
      sis.montajes.push({ disp: '/dev/' + part.nombre, en: ruta, tipo: part.fs, opc: 'rw,relatime', bloques: part.bloques, usados: 24, disponibles: part.bloques - 24 - Math.floor(part.bloques * 0.05), nodos: 327680, nusados: 11, parte: part, punto: pm.n });
      c.fs.avisa('cambia', ruta, pm);
    }
    return 0;
  };
  O.umount = function* (c) {
    const sis = c.sis;
    const ops = c.args.filter((x) => x[0] !== '-');
    if (c.args.includes('--help')) { yield* ayuda(c); return 0; }
    if (!ops.length) { c.err('Usage:\n umount [-hV]\n umount -a [options]\n umount [options] <source> | <directory>\n'); return 1; }
    let cod = 0;
    for (const x of ops) {
      const ruta = x.startsWith('/dev/') ? x : c.rutaAbs(x);
      const m = sis.montajes.find((y) => y.en === ruta || y.disp === x);
      if (!m) {
        try { c.resuelve(x); c.err(`umount: ${x}: no montado.\n`); cod = 1; } catch (e) { c.err(`umount: ${x}: no se ha encontrado el punto de montaje.\n`); cod = 32; }
        continue;
      }
      if (c.uid !== 0) { c.err(`umount: ${x}: debe ser superusuario para desmontar.\n`); cod = 32; continue; }
      if (!m.parte) { c.aviso(`El simulador no deja desmontar ${m.en}: el sistema lo necesita.`); cod = 32; continue; }
      const dentro = c.fs.rutaDe(c.sh.cwdIno);
      if (dentro === m.en || dentro.startsWith(m.en + '/')) { c.err(`umount: ${m.en}: el destino está ocupado.\n`); cod = 32; continue; }
      const pm = c.fs.ino(m.punto);
      const raizFs = c.fs.ino(pm.montaje);
      delete pm.montaje; if (raizFs) delete raizFs.raizDe;
      sis.montajes = sis.montajes.filter((y) => y !== m);
      c.fs.avisa('cambia', m.en, pm);
    }
    return cod;
  };

  /* ---------------- red: ip, ping, nslookup ---------------- */
  const RED = {
    mac: '08:00:27:60:16:29', ip: '10.0.2.15', ip6t: 'fd17:625c:f037:2:e266:88ff:7440:90f0', ip6m: 'fd17:625c:f037:2:a00:27ff:fe60:1629', ip6l: 'fe80::a00:27ff:fe60:1629',
    // nombres que se resuelven y responden (como desde la máquina de pruebas, en NAT)
    hosts: {
      'google.com': { v4: '172.217.20.238', v6: '2a00:1450:4003:809::200e', inverso: 'muc12s03-in-f14.1e100.net', ttl: 118, ms: 13 },
      'www.google.com': { v4: '142.250.200.68', v6: '2a00:1450:4003:80e::2004', inverso: 'mad41s14-in-f4.1e100.net', ttl: 118, ms: 13 },
      'ubuntu.com': { v4: '185.125.190.20', extra4: ['185.125.190.29', '185.125.190.21'], v6: '2620:2d:4000:1::27', extra6: ['2620:2d:4000:1::26', '2620:2d:4000:1::28'], ttl: 51, ms: 41 },
      'archive.ubuntu.com': { v4: '185.125.190.81', extra4: ['91.189.91.82', '185.125.190.83'], ttl: 51, ms: 42 },
      'es.wikipedia.org': { v4: '185.15.58.224', v6: '2a02:ec80:600:ed1a::1', inverso: 'text-lb.drmrs.wikimedia.org', ttl: 55, ms: 22 },
      'educa.jcyl.es': { v4: '212.79.130.86', ttl: 54, ms: 18 },
    }
  };
  const ipDe = (c) => c.sis.ip || RED.ip;
  function validoHasta(c) { const s = Math.floor((c.ahora() - c.sis.arranque) / 1000); return { v: Math.max(0, 86400 - s - 279), p: Math.max(0, 14400 - s - 276) }; }
  O.ip = function* (c) {
    let a = c.args.slice();
    const op = {};
    while (a.length && a[0][0] === '-') { const o = a.shift(); if (o === '-br' || o === '-brief') op.br = true; else if (o === '-4') op.v4 = true; else if (o === '-6') op.v6 = true; else if (o === '-c' || o === '-color') op.color = true; else if (o === '-h' || o === '--help' || o === 'help') { yield* ayuda(c); return 0; } else { c.err(`Option "${o}" is unknown, try "ip -help".\n`); return 255; } }
    const obj = a.shift() || '';
    const objetos = { a: 'address', addr: 'address', address: 'address', r: 'route', ro: 'route', route: 'route', l: 'link', li: 'link', link: 'link', n: 'neigh', neigh: 'neigh', neighbour: 'neigh', x: 'xfrm', xfrm: 'xfrm' };
    const o = objetos[obj] || (obj ? Object.keys(objetos).find((k) => k.startsWith(obj) && k.length > 1) && objetos[Object.keys(objetos).find((k) => k.startsWith(obj))] : null);
    if (!obj) { yield* ayuda(c); return 255; }
    if (!o) { c.err(`Object "${obj}" is unknown, try "ip help".\n`); return 1; }
    if (o === 'xfrm' && !a.length) { c.err('Usage: ip xfrm XFRM-OBJECT { COMMAND | help }\nwhere  XFRM-OBJECT := state | policy | monitor\n'); return 255; }
    const accion = a.shift() || 'show';
    let disp = null;
    if (a[0] === 'dev') a.shift();
    if (a.length) disp = a.shift();
    const t = validoHasta(c);
    if (o === 'address' && /^(s|sh|sho|show|list|l|ls)$/.test(accion)) {
      if (disp && disp !== 'lo' && disp !== 'enp0s3') { c.err(`Device "${disp}" does not exist.\n`); return 1; }
      if (op.br) {
        let s = '';
        if (!disp || disp === 'lo') s += 'lo               UNKNOWN        ' + (op.v6 ? '' : '127.0.0.1/8 ') + (op.v4 ? '' : '::1/128 ') + '\n';
        if (!disp || disp === 'enp0s3') s += 'enp0s3           UP             ' + (op.v6 ? '' : ipDe(c) + '/24 ') + (op.v4 ? '' : `${RED.ip6t}/64 ${RED.ip6m}/64 ${RED.ip6l}/64 `) + '\n';
        c.sale(s); return 0;
      }
      let s = '';
      if (!disp || disp === 'lo') {
        s += '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n';
        if (!op.v4 && !op.v6) s += '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n';
        if (!op.v6) s += '    inet 127.0.0.1/8 scope host lo\n       valid_lft forever preferred_lft forever\n';
        if (!op.v4) s += '    inet6 ::1/128 scope host noprefixroute \n       valid_lft forever preferred_lft forever\n';
      }
      if (!disp || disp === 'enp0s3') {
        s += '2: enp0s3: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000\n';
        if (!op.v4 && !op.v6) s += `    link/ether ${RED.mac} brd ff:ff:ff:ff:ff:ff\n`;
        if (!op.v6) s += `    inet ${ipDe(c)}/24 brd 10.0.2.255 scope global dynamic noprefixroute enp0s3\n       valid_lft ${t.v}sec preferred_lft ${t.v}sec\n`;
        if (!op.v4) s += `    inet6 ${RED.ip6t}/64 scope global temporary dynamic \n       valid_lft ${t.v + 3}sec preferred_lft ${t.p + 3}sec\n    inet6 ${RED.ip6m}/64 scope global dynamic mngtmpaddr \n       valid_lft ${t.v + 3}sec preferred_lft ${t.p + 3}sec\n    inet6 ${RED.ip6l}/64 scope link \n       valid_lft forever preferred_lft forever\n`;
      }
      c.sale(s); return 0;
    }
    if (o === 'route' && /^(s|sh|sho|show|list|l|ls)$/.test(accion)) {
      c.sale(`default via 10.0.2.2 dev enp0s3 proto dhcp src ${ipDe(c)} metric 100 \n10.0.2.0/24 dev enp0s3 proto kernel scope link src ${ipDe(c)} metric 100 \n`);
      return 0;
    }
    if (o === 'link' && /^(s|sh|sho|show|list|l|ls)$/.test(accion)) {
      if (op.br) { c.sale(`lo               UNKNOWN        00:00:00:00:00:00 <LOOPBACK,UP,LOWER_UP> \nenp0s3           UP             ${RED.mac} <BROADCAST,MULTICAST,UP,LOWER_UP> \n`); return 0; }
      c.sale(`1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n2: enp0s3: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default qlen 1000\n    link/ether ${RED.mac} brd ff:ff:ff:ff:ff:ff\n`);
      return 0;
    }
    if (['add', 'del', 'delete', 'change', 'replace', 'set', 'flush'].includes(accion)) {
      if (c.uid !== 0) { c.err('RTNETLINK answers: Operation not permitted\n'); return 2; }
      c.aviso(`El simulador no cambia la red con «ip ${obj} ${accion}» (en el aula se configura con Configuración › Red o con netplan).`); return 1;
    }
    c.aviso(`El simulador no tiene «ip ${obj} ${accion}».`);
    return 1;
  }
  // a qué IP va un nombre; null si no se resuelve
  function resuelveNombre(c, n) {
    const equipo = c.sis.lee('/etc/hostname').trim();
    if (/^\d+\.\d+\.\d+\.\d+$/.test(n)) return { ip: n, nombre: null };
    if (n === 'localhost') return { ip: '127.0.0.1', nombre: 'localhost' };
    if (n === 'ip6-localhost') return { ip: '::1', nombre: 'ip6-localhost', v6: true };
    if (n === equipo) return { ip: '127.0.1.1', nombre: equipo };
    const h = RED.hosts[n.toLowerCase()];
    if (h) return { ip: h.v4, nombre: n, info: h };
    // /etc/hosts
    for (const l of c.sis.lee('/etc/hosts').split('\n')) { const p = l.trim().split(/\s+/); if (p.length > 1 && p.slice(1).includes(n) && !p[0].startsWith('#')) return { ip: p[0], nombre: n }; }
    return null;
  }
  O.ping = function* (c) {
    const a = c.args.slice();
    let cuenta = Infinity, espera = null, ip4 = false, silencio = false;
    const destinos = [];
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (x === '-c') { const v = a[++i]; if (!/^\d+$/.test(v || '') || +v < 1) { c.err(`ping: invalid argument: '${v || ''}': out of range: 1 <= value <= 9223372036854775807\n`); return 1; } cuenta = +v; continue; }
      if (/^-c\d+$/.test(x)) { cuenta = +x.slice(2); continue; }
      if (x === '-W' || x === '-w' || x === '-i' || x === '-s' || x === '-t') { espera = a[++i]; continue; }
      if (x === '-4') { ip4 = true; continue; }
      if (x === '-q') { silencio = true; continue; }
      if (x === '-h' || x === '--help') { yield* ayuda(c); return 2; }
      if (x[0] === '-') return c.sinOpcion(x);
      destinos.push(x);
    }
    void espera;
    if (!destinos.length) { c.err('ping: usage error: Se debe especificar la dirección de destino\n'); return 1; }
    const destino = destinos[destinos.length - 1];
    const r = resuelveNombre(c, destino);
    if (!r) { c.err(`ping: ${destino}: Nombre o servicio desconocido\n`); return 2; }
    if (r.v6 && ip4) { r.ip = '127.0.0.1'; r.v6 = false; }
    // ¿responde? la propia máquina, la puerta de enlace de NAT, los nombres conocidos y las IP públicas
    const ip = r.ip;
    const privada = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
    const propia = ip === '::1' || ip.startsWith('127.') || ip === ipDe(c);
    const responde = propia || ip === '10.0.2.2' || ip === '10.0.2.3' || !!r.info || (!privada && !/^(0\.|255\.|22[4-9]\.|23\d\.)/.test(ip));
    const info = r.info || (ip === '8.8.8.8' || ip === '8.8.4.4' ? { ttl: 118, ms: 14 } : ip === '1.1.1.1' ? { ttl: 56, ms: 11 } : { ttl: 56, ms: 24 });
    const base = propia ? 0.04 : ip.startsWith('10.0.2.') ? 0.3 : info.ms;
    const ttl = propia || ip.startsWith('10.0.2.') ? 64 : info.ttl;
    const rnd = U.mulberry32(Math.floor(c.ahora() / 1000) ^ ip.length * 7919);
    const etiqueta = r.nombre ? `${r.nombre} (${ip})` : ip;
    const desde = r.v6 ? `${r.nombre} (${ip})` : (r.info && r.info.inverso ? `${r.info.inverso} (${ip})` : (r.nombre && propia ? `${r.nombre} (${ip})` : ip));
    if (propia && !r.nombre) void 0;
    c.sale(r.v6 ? `PING ${r.nombre} (${ip}) 56 data bytes\n` : `PING ${r.nombre || ip} (${ip}) 56(84) bytes of data.\n`);
    const tiempos = [];
    let enviados = 0;
    const t0 = c.ahora();
    const fmtT = (t) => (t < 1 ? t.toFixed(3) : t < 10 ? t.toFixed(2) : t < 100 ? t.toFixed(1) : t.toFixed(0));
    let interrumpido = false;
    try {
      while (enviados < cuenta) {
        if (enviados > 0) yield { tipo: 'espera', ms: 1000 };
        enviados++;
        if (responde) {
          const t = base * (0.85 + rnd() * 0.35) + (base > 5 && rnd() < 0.1 ? rnd() * 30 : 0);
          tiempos.push(t);
          if (!silencio) c.sale(`64 bytes from ${desde}: icmp_seq=${enviados} ttl=${ttl} time=${fmtT(t)} ms\n`);
        }
        if (cuenta === Infinity && !c.ttyOut && c.io.enTuberia && enviados >= 4) { c.nota('En tu Ubuntu, ping seguiría hasta que pulses Ctrl + C; el simulador para tras 4 paquetes.'); break; }
      }
    } catch (e) { if (!(e instanceof L.Interrupcion)) throw e; interrumpido = true; }
    if (!responde && !interrumpido) yield { tipo: 'espera', ms: 1000 };
    const recibidos = tiempos.length;
    L.registra(c.sis, { tipo: 'ping', destino, transmitidos: enviados, recibidos, interrumpido });
    const tiempo = Math.max(0, (enviados - 1) * 1000 + Math.round(rnd() * 45));
    c.sale(`\n--- ${r.nombre || ip} ping statistics ---\n${enviados} packets transmitted, ${recibidos} received, ${Math.round(((enviados - recibidos) / enviados) * 100)}% packet loss, time ${enviados > 1 ? tiempo : 0}ms\n`);
    if (recibidos) {
      const min = Math.min(...tiempos), max = Math.max(...tiempos), med = tiempos.reduce((s, x) => s + x, 0) / recibidos;
      const mdev = Math.sqrt(tiempos.reduce((s, x) => s + x * x, 0) / recibidos - med * med) || 0;
      c.sale(`rtt min/avg/max/mdev = ${min.toFixed(3)}/${med.toFixed(3)}/${max.toFixed(3)}/${mdev.toFixed(3)} ms\n`);
    } else c.sale('\n');
    void etiqueta;
    return recibidos ? 0 : 1;
  };
  O.nslookup = function* (c) {
    const a = c.args.filter((x) => x[0] !== '-');
    if (!a.length) { c.aviso('El simulador no tiene el modo interactivo de nslookup: escribe el nombre detrás (nslookup ubuntu.com).'); return 1; }
    const n = a[0];
    let s = 'Server:\t\t127.0.0.53\nAddress:\t127.0.0.53#53\n\n';
    const equipo = c.sis.lee('/etc/hostname').trim();
    if (n === 'localhost') { s += 'Name:\tlocalhost\nAddress: 127.0.0.1\nName:\tlocalhost\nAddress: ::1\n\n'; c.sale(s); return 0; }
    if (n === equipo) { s += `Name:\t${equipo}\nAddress: 127.0.1.1\n\n`; c.sale(s); return 0; }
    const h = RED.hosts[n.toLowerCase().replace(/\.$/, '')];
    if (!h) { c.sale(s + `** server can't find ${n}: NXDOMAIN\n\n`); return 1; }
    s += 'Non-authoritative answer:\n';
    [h.v4].concat(h.extra4 || []).forEach((x) => { s += `Name:\t${n}\nAddress: ${x}\n`; });
    [h.v6].concat(h.extra6 || []).filter(Boolean).forEach((x) => { s += `Name:\t${n}\nAddress: ${x}\n`; });
    c.sale(s + '\n');
    return 0;
  };

  /* ---------------- locate (plocate) ---------------- */
  O.updatedb = function* (c) {
    if (c.uid !== 0) { c.err('updatedb: can not open a temporary file for `/var/lib/plocate/plocate.db\'\n'); return 1; }
    const fs = c.fs, root = { uid: 0, gid: 0 };
    const rutas = [];
    const recorre = (ruta, ino) => {
      rutas.push(ruta);
      if (ino.tipo !== 'd' || ino.virtual || ['/proc', '/sys', '/tmp', '/var/tmp', '/dev', '/run', '/snap', '/media'].includes(ruta)) return;
      for (const [k, n] of ino.hijos) recorre((ruta === '/' ? '' : ruta) + '/' + k, fs.montado(fs.ino(n)));
    };
    recorre('/', fs.ino(fs.raiz));
    c.sis.bdLocate = rutas;
    try { const d = fs.resuelve('/var/lib/plocate', root).ino; if (!d.hijos.has('plocate.db')) fs.enlaza(d, 'plocate.db', fs.nuevo('-', 0o640, 0, 999, { tam: rutas.length * 9 }), '/var/lib/plocate/plocate.db'); } catch (e) { /* nada */ }
    yield { tipo: 'espera', ms: 1500 };
    return 0;
  };
  O.locate = function* (c) {
    const a = c.args.slice();
    let mayus = false, cuenta = false, limite = Infinity, base = false;
    const pats = [];
    for (let i = 0; i < a.length; i++) { if (a[i] === '-i') mayus = true; else if (a[i] === '-c') cuenta = true; else if (a[i] === '-l' || a[i] === '-n') limite = +a[++i]; else if (a[i] === '-b') base = true; else if (a[i] === '--help') { yield* ayuda(c, 'locate'); return 0; } else if (a[i][0] === '-') return c.sinOpcion(a[i]); else pats.push(a[i]); }
    if (!c.sis.bdLocate) { c.err('/var/lib/plocate/plocate.db: No such file or directory\n'); return 1; }
    if (!pats.length) { c.err('plocate: no pattern to search for specified\n'); return 1; }
    const casa = (r) => pats.every((p) => {
      const objetivo = base ? r.split('/').pop() : r;
      if (/[*?[]/.test(p)) return L.casaPatron(p.includes('/') || base ? p : '*' + p + '*', objetivo, { mayus });
      return mayus ? objetivo.toLowerCase().includes(p.toLowerCase()) : objetivo.includes(p);
    });
    // solo lo que el usuario puede ver
    const visible = (r) => { try { c.resuelve(r, { seguir: false }); return true; } catch (e) { return false; } };
    const hall = c.sis.bdLocate.filter(casa).filter(visible).slice(0, limite);
    if (cuenta) c.sale(hall.length + '\n'); else c.sale(hall.map((x) => x + '\n').join(''));
    return hall.length ? 0 : 1;
  };

  /* ---------------- bash, sh, nano, vi ---------------- */
  O.bash = function* (c) {
    const a = c.args.slice();
    if (a[0] === '--version') { c.sale('GNU bash, versión 5.2.21(1)-release (x86_64-pc-linux-gnu)\nCopyright (C) 2022 Free Software Foundation, Inc.\nLicencia GPLv3+: GPL de GNU versión 3 o posterior <http://gnu.org/licenses/gpl.html>\n\nEsto es software libre, es libre para modificar y redistribuirlo.\nNo hay NINGUNA GARANTÍA, a la extensión permitida por la ley.\n'); return 0; }
    if (a[0] === '--help') { yield* ayuda(c, 'bash'); return 0; }
    if (a[0] === '-x' || a[0] === '-n' || a[0] === '-v') { c.aviso(`El simulador todavía no tiene bash ${a[0]} (se ve en la UT7).`); return 1; }
    // un hijo de bash: hereda solo las variables exportadas
    const hijo = c.sh.copia();
    hijo.vars = new Map([...c.sh.vars].filter(([k, v]) => v.exp).map(([k, v]) => [k, Object.assign({}, v)]));
    [['IFS', ' \t\n'], ['PS4', '+ ']].forEach(([k, v]) => hijo.vars.set(k, { v, exp: false }));
    hijo.asigna('SHLVL', String((+c.sh.valor('SHLVL') || 1) + 1), true);
    hijo.alias = new Map(); hijo.interactiva = false; hijo.interactivaPadre = false; hijo.funciones = new Map(); hijo.esGuion = true;
    hijo.pid = c.proc ? c.proc.pid : c.sis.nuevoPid();
    if (a[0] === '-c') {
      if (a.length < 2) { c.err('bash: -c: la opción requiere un argumento\n'); return 2; }
      hijo.nombreScript = a[2] || 'bash'; hijo.posicionales = a.slice(3);
      hijo.nombreScriptActual = 'bash';
      try { return yield* hijo.ejecutaEn(a[1], c.io, { script: 'bash: -c' }); } catch (e) { if (e instanceof L.SalidaShell || e instanceof L.CortaLinea) return e.codigo; throw e; }
    }
    if (!a.length) { c.aviso('El simulador todavía no abre un bash dentro de otro: escribe las órdenes aquí mismo o usa bash archivo.sh.'); return 0; }
    const archivo = a[0];
    let texto;
    try { texto = leeArchivo(c, archivo); }
    catch (e) {
      if (!(e instanceof ErrorSis)) throw e;
      c.err(`bash: ${archivo}: ${e.codigo === 'EISDIR' ? 'es un directorio' : errSis(e)}\n`);
      return e.codigo === 'ENOENT' ? 127 : 126;
    }
    hijo.nombreScript = c.extra.comoGuion || archivo; hijo.posicionales = a.slice(1);
    hijo.nombreScriptActual = c.extra.comoGuion || archivo;
    if (/^#!\s*\/(usr\/)?bin\/(env\s+)?(python|perl|node)/.test(texto)) { c.aviso('El simulador solo ejecuta guiones de bash.'); return 126; }
    try { return yield* hijo.ejecutaEn(texto, c.io, { script: c.extra.comoGuion || archivo }); }
    catch (e) { if (e instanceof L.SalidaShell || e instanceof L.CortaLinea) return e.codigo; throw e; }
  };
  O.sh = function* (c) {
    if (c.args.length && c.args[0][0] !== '-') c.nota('En Ubuntu, sh es dash, no bash: los guiones sencillos funcionan igual, pero algunos mensajes de error cambian. El simulador lo ejecuta con bash.');
    return yield* O.bash(c);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof window !== 'undefined' ? window : globalThis);
