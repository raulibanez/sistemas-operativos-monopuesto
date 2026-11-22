/* Simulador de Linux · «Practica Linux» de la UT4: los encargos, por bloques, de fácil a difícil y en el orden de la
 * unidad. Solo con lo que la unidad enseña (la lista de «Tus comandos»). Ver linux-practica.js para los campos. */
(function (raiz) {
  'use strict';
  const SOM = (raiz.SOM = raiz.SOM || {});
  const L = (SOM.linux = SOM.linux || {});
  const P = (L.practica = L.practica || {});
  P.bancos = P.bancos || {};

  /* ---------- ayudas para escribir las comprobaciones ---------- */
  const tiene = (...ts) => (c) => ts.every((t) => c.salida.includes(t));
  const sale = (t) => (c) => c.lineas.some((l) => l.trim() === t);
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  // nano: cambiar un texto por otro (buscar con F6, borrar con Supr, escribir el nuevo), guardar y salir. Se busca con F6
  // y no con Ctrl+W, que en un navegador de verdad cierra la pestaña
  const cambia = (antes, despues) => ['F6'].concat(antes.split(''), ['Enter'], Array(antes.length).fill('Delete'), despues.split(''));
  const guardaYSal = ['Ctrl+O', 'Enter', 'Ctrl+X'];
  const linuxUbuntu = (cfg) => (cfg.match(/menuentry 'Ubuntu' [\s\S]*?\n\tlinux\t([^\n]*)/) || [])[1] || '';
  // los meses de cal, sin depender de las mayúsculas (cal los escribe con mayúscula; ncal en es_ES podría no hacerlo)
  const mesSale = (c, k) => new RegExp('(^|\\s)' + MESES[(k + 12) % 12] + '(\\s|$)', 'im').test(c.salida);
  const grub = {
    menu: (c) => /set timeout_style=menu/.test(c.grubCfg()),
    // la espera que dice grub.cfg (null si no se sabe)
    segundos: (c) => { const m = c.grubCfg().match(/set timeout_style=\w+\n    set timeout=(-?\d+)\n/); return m ? +m[1] : null; },
    // el menú se ve de verdad: estilo menu y una espera mayor que 0 (con 0 arranca enseguida; es lo que dice la vista
    // del arranque de M5); -1 es esperar sin límite
    menuVisible: (c) => grub.menu(c) && grub.segundos(c) !== 0,
    espera: (c, n) => new RegExp(`set timeout_style=\\w+\\n    set timeout=${n}\\n`).test(c.grubCfg()),
    sinLogo: (c) => { const l = linuxUbuntu(c.grubCfg()); return !!l && !/\bsplash\b/.test(l); },
    sinQuiet: (c) => { const l = linuxUbuntu(c.grubCfg()); return !!l && !/\bquiet\b/.test(l); },
    // /etc/default/grub cambiado pero el menú sin fabricar otra vez
    sinFabricar: (c) => { const g = c.sis.stat('/boot/grub/grub.cfg'), d = c.sis.stat('/etc/default/grub'); return !!g && !!d && d.mtime > g.mtime; }
  };
  const avisoGrub = (c) => (grub.sinFabricar(c) ? 'Has cambiado /etc/default/grub, pero el menú no se ha vuelto a fabricar: falta la orden que lo genera.' : '');
  // un archivo que se pedía en un sitio y está en otro, o con el nombre casi igual
  function archivoMal(c, ruta) {
    const quiere = c.abs(ruta), nom = quiere.split('/').pop();
    const otros = c.busca(nom).filter((r) => r !== quiere);
    if (otros.length && !c.existe(ruta)) return `Has creado ${nom}, pero en otra carpeta: ${c.corta(otros[0])}. Se pide en ${c.corta(quiere.slice(0, quiere.lastIndexOf('/')))}.`;
    const casi = c.buscaParecido(nom);
    if (casi.length) return `Hay un archivo que se llama casi igual: ${c.corta(casi[0])}. En Linux las mayúsculas y las tildes cuentan.`;
    const sinExt = c.busca(nom.replace(/\.[^.]+$/, ''));
    if (sinExt.length && nom.includes('.')) return `El archivo se llama ${sinExt[0].split('/').pop()}: falta la extensión. Tiene que llamarse ${nom}.`;
    if (c.esDir(ruta)) return `${nom} es una carpeta y se pedía un archivo.`;
    return '';
  }
  // el orden en que salen unos nombres en la pantalla
  const enOrden = (c, nombres) => { const pos = nombres.map((n) => c.salida.search(new RegExp('(^|\\s)' + n.replace(/\./g, '\\.') + '(\\s|$)', 'm'))); return pos.every((p) => p >= 0) && pos.every((p, i) => i === 0 || p > pos[i - 1]); };
  // un alias que hace lo que se pide (sus órdenes, ya analizadas)
  const aliasHace = (c, n, prueba) => { const v = c.alias(n); if (v === null) return false; return prueba(P.ordenesDe(v)); };
  const lsLargoOcultos = (o) => o.length === 1 && o[0][0] === 'ls' && o[0].slice(1).some((x) => /^-[a-zA-Z]*[aA]/.test(x) || x === '--all') && o[0].slice(1).some((x) => /^-[a-zA-Z]*l/.test(x));
  // lo que un encargo necesita al empezar (pre): si lo que dejó el anterior no sirve, el componente lo monta de nuevo
  const enCasa = (c) => c.cwd === c.home;
  const enCarpeta = (r) => (c) => c.cwd === c.home + r;
  const limpiaYCarpeta = (o) => o.length === 2 && o[0][0] === 'clear' && (o[1][0] === 'pwd' || (o[1][0] === 'echo' && /^\$\{?PWD\}?$/.test(o[1][1] || '')));

  /* ---------- escenarios ---------- */
  const fotos = {
    '~/fotos/playa.jpg': { tam: 236544, tipoArchivo: 'JPEG image data, JFIF standard 1.01', mtime: '2026-07-14 12:00' },
    '~/fotos/montaña.jpg': { tam: 451584, tipoArchivo: 'JPEG image data, JFIF standard 1.01', mtime: '2026-08-02 09:30' },
    '~/fotos/cena.png': { tam: 97280, tipoArchivo: 'PNG image data, 1920 x 1080, 8-bit/color RGB, non-interlaced', mtime: '2026-09-20 21:15' },
    '~/fotos/perro.jpg': { tam: 312832, tipoArchivo: 'JPEG image data, JFIF standard 1.01', mtime: '2026-10-05 17:40' },
    '~/.notas_viejas': { datos: 'notas de hace tiempo\n', mtime: '2023-02-14 10:00' },
    '~/.recordatorio': { datos: 'llamar a casa\n', mtime: '2026-11-20 20:15' }
  };
  const receta = 'Tortilla de patatas\n4 patatas\n5 huevos\nAceite y sal\nPelar y freír las patatas\nBatir los huevos y mezclar\n';
  const cuento = Array.from({ length: 140 }, (_, i) => `Línea ${i + 1}: un texto largo para leer por páginas.`).join('\n') + '\nY la última palabra es faro\n';
  const marta = [{ usuario: 'marta', tty: 'tty3', orden: 'nano informe.txt' }];

  P.bancos[4] = { ut: 4, nombre: 'Practica Linux', bloques: [
    /* ================= 1. Primeros pasos ================= */
    { id: 'primeros', nombre: 'Primeros pasos', escenario: { archivos: { '~/bienvenida-a-linux.txt': 'Bienvenida a la terminal de Linux.\nAquí todo se hace escribiendo órdenes.\n' } }, encargos: [
      { id: 'carpeta',
        pide: 'Enseña en qué carpeta estás.',
        pistas: ['Hay una orden que escribe la ruta completa de la carpeta en la que estás. El prompt solo enseña un atajo, ~.', 'La orden tiene tres letras: las iniciales de «print working directory».'],
        sol: ['pwd'], alt: [['echo $PWD']],
        exp: '‹pwd› escribe la ruta completa de la carpeta en la que estás, desde la raíz. En el prompt, ‹~› es un atajo de tu carpeta personal.',
        hecho: (c) => c.lineas.some((l) => l.trim() === c.cwd) },
      { id: 'lista',
        pre: enCasa,
        pide: 'Enseña lo que hay en esta carpeta.',
        pistas: ['Hay una orden de dos letras que lista lo que hay en una carpeta.', 'Viene del inglés «list»: son sus dos primeras consonantes.'],
        sol: ['ls'], alt: [['ls -l'], ['ls -a']],
        exp: '‹ls› enseña lo que hay en la carpeta en la que estás. Las carpetas salen en azul y los archivos, en blanco.',
        hecho: tiene('bienvenida-a-linux.txt', 'Documentos') },
      { id: 'eco',
        pide: 'Escribe en la pantalla la frase Hola, Linux.',
        pistas: ['Hay una orden que repite en la pantalla lo que le escribes detrás. Su nombre significa «eco» en inglés.', 'Escribe esa orden y, detrás, la frase. Si la pones entre comillas, va entera tal cual.'],
        sol: ['echo "Hola, Linux"'], alt: [['echo Hola, Linux'], ["echo 'Hola, Linux'"]],
        exp: '‹echo› escribe lo que le pones detrás. Las comillas no salen en la pantalla: sirven para que la frase vaya junta.',
        hecho: sale('Hola, Linux'),
        cerca: (c) => (/no se encontró la orden|orden no encontrada/.test(c.salida) && /^\s*hola/i.test(c.linea) ? 'La terminal ha leído «Hola,» como el nombre de una orden. Hace falta una orden que escriba en la pantalla lo que le pones detrás.'
          : c.lineas.some((l) => /hola,? linux/i.test(l)) ? 'Ya sale la frase, pero no igual: revisa la coma y las mayúsculas.' : ''),
        despistes: [{ pasos: ['Hola, Linux'], msg: /nombre de una orden/ }, { pasos: ['echo hola linux'], msg: /coma y las mayúsculas/ }] },
      { id: 'bienvenida',
        pre: enCasa,
        pide: 'Enseña lo que pone dentro del archivo de bienvenida. Para no escribir el nombre entero, deja que la terminal lo complete.',
        pistas: ['Hay una orden de tres letras que enseña lo que pone dentro de un archivo.', 'La orden es ‹cat›. Detrás, escribe el principio del nombre del archivo y pulsa Tab: la terminal completa el resto.'],
        sol: [{ orden: 'cat bien', tab: true }], alt: [['cat bienvenida-a-linux.txt'], ['more bienvenida-a-linux.txt']],
        exp: '‹cat› enseña el contenido de un archivo. Tab completa nombres: si solo hay una posibilidad, la escribe entera; si hay varias, con dos Tab las enseña.',
        hecho: tiene('Aquí todo se hace escribiendo órdenes.'),
        cerca: (c) => (/No existe el archivo/.test(c.salida) ? 'No hay ningún archivo con ese nombre aquí. Escribe el principio del nombre y pulsa Tab para que la terminal lo complete sin erratas.' : ''),
        despistes: [{ pasos: ['cat bienvenida.txt'], msg: /pulsa Tab/ }] },
      { id: 'dosordenes',
        pide: 'Limpia la pantalla y, después, enseña la carpeta actual, con las dos órdenes escritas en la misma línea.',
        pistas: ['Para escribir dos órdenes en la misma línea, se separan con un signo de puntuación. Van en el orden en que se ejecutan.', 'El signo es el punto y coma. La orden que limpia la pantalla se llama como «limpiar» en inglés.'],
        sol: ['clear; pwd'], alt: [['clear;pwd'], ['clear; echo $PWD'], ['clear && pwd']],
        exp: 'El punto y coma separa órdenes en la misma línea: se ejecutan una detrás de otra. Ctrl + L también limpia la pantalla.',
        hecho: (c) => limpiaYCarpeta(c.ordenes) && c.lineas.some((l) => l.trim() === c.cwd),
        cerca: (c) => {
          const o = c.ordenes.map((x) => x[0]), ic = o.indexOf('clear'), ip = o.lastIndexOf('pwd');
          if (ic >= 0 && ip >= 0 && ip < ic) return 'Están las dos órdenes, pero al revés: la carpeta sale y enseguida se borra. Primero se limpia.';
          if (ic >= 0 && ip > ic) return 'Están las dos, y en su orden, pero la línea lleva más cosas. Se piden solo esas dos: limpiar y enseñar la carpeta.';
          if (o.length === 1 && o[0] === 'clear') return 'La pantalla está limpia. Ahora hazlo con las dos órdenes en la misma línea.';
          if (o.length === 1 && o[0] === 'pwd') return 'Sale la carpeta. Falta limpiar antes la pantalla, en la misma línea.';
          return '';
        },
        despistes: [{ pasos: ['pwd; clear'], msg: /al revés/ }, { pasos: ['clear'], msg: /misma línea/ }, { pasos: ['clear; ls; pwd'], msg: /más cosas/ }] },
      { id: 'ping',
        pide: 'Comprueba que la máquina tiene red: envía paquetes a la dirección 10.0.2.2 y para la orden cuando lleve unos cuantos.',
        pistas: ['Hay una orden que envía paquetes a una dirección y espera la respuesta. No para nunca ella sola: una combinación de teclas corta la orden que está en marcha.', 'La orden es ‹ping›, seguida de la dirección. Cuando lleve unos cuantos paquetes, pulsa Ctrl + C.'],
        sol: [{ orden: 'ping 10.0.2.2', ctrlC: 3 }],
        exp: 'Ctrl + C corta la orden que está en marcha. Al pararlo, ping escribe un resumen: los paquetes enviados, los recibidos y los perdidos.',
        // al menos dos paquetes y cortado con el teclado
        hecho: (c) => c.registro.some((x) => x.tipo === 'ping' && x.interrumpido && x.destino === '10.0.2.2' && x.transmitidos >= 2),
        // el mensaje habla del último ping, no de cualquiera de los intentos
        cerca: (c) => {
          const p = c.registro.filter((x) => x.tipo === 'ping').pop();
          if (!p) return '';
          if (p.destino !== '10.0.2.2') return p.interrumpido ? 'Has parado un ping, pero a otra dirección. Se pide 10.0.2.2.' : 'Ese ping iba a otra dirección y ha parado solo. Se pide 10.0.2.2, y pararlo tú con el teclado.';
          if (!p.interrumpido) return 'Ese ping ha parado solo. Se pide pararlo tú con el teclado, cuando lleve unos cuantos paquetes.';
          return 'Lo has parado enseguida: deja que envíe unos cuantos paquetes antes de cortarlo.';
        },
        despistes: [{ pasos: [{ orden: 'ping 8.8.8.8', ctrlC: 2 }], msg: /otra dirección/ }, { pasos: ['ping -c 3 10.0.2.2'], msg: /pararlo tú/ }, { pasos: [{ orden: 'ping 10.0.2.2', ctrlC: 0.5 }], msg: /enseguida/ },
          { pasos: [{ orden: 'ping 10.0.2.2', ctrlC: 0.5 }, { orden: 'ping 8.8.8.8', ctrlC: 2.5 }], msg: /otra dirección/ }, { pasos: [{ orden: 'ping 10.0.2.2', ctrlC: 0.5 }, 'ping -c 3 10.0.2.2'], msg: /ha parado solo/ }] }
    ] },

    /* ================= 2. Pedir ayuda ================= */
    { id: 'ayuda', nombre: 'Pedir ayuda', escenario: {}, encargos: [
      { id: 'help',
        pide: 'Enseña la ayuda corta de ls, la que sale en la misma terminal sin abrir nada.',
        pistas: ['Casi todas las órdenes tienen una opción larga que enseña su ayuda: dos guiones y una palabra en inglés.', 'La palabra es «help», con dos guiones delante. Va detrás del nombre de la orden.'],
        sol: ['ls --help'],
        exp: '‹--help› enseña cómo se escribe la orden y sus opciones. En la primera línea, lo que va entre corchetes se puede poner o no.',
        hecho: tiene('Modo de empleo: ls') },
      { id: 'man',
        pide: 'Abre el manual de uname y, cuando lo hayas mirado, sal de él.',
        pistas: ['El manual de una orden se abre con una orden de tres letras seguida del nombre.', 'La orden es ‹man›, seguida del nombre de la orden. Dentro, la tecla q sale.'],
        sol: [{ orden: 'man uname', teclas: ['q'] }],
        exp: '‹man› abre el manual completo. Dentro, la barra espaciadora avanza, / busca una palabra y q sale.',
        hecho: (c) => c.ayuda('man', 'uname') },
      { id: 'tamano',
        pide: 'Busca en el manual de ls la opción que ordena los archivos por tamaño y escríbela.',
        casilla: { nombres: ['opción'], esperado: () => ['-S'], acepta: () => [['-S', '--sort=size']] },
        pistas: ['Abre el manual de ls y busca dentro, con /, una palabra que tenga que ver con el tamaño.', 'Dentro del manual, busca ‹/tamaño› o ‹/grande›: la opción está al principio de la línea.'],
        sol: [{ orden: 'man ls', teclas: ['/'].concat('grande'.split(''), ['Enter', 'q']) }],
        exp: 'En el manual, / busca una palabra y n salta a la siguiente. La opción es ‹-S›: ‹ls -lS› lista del más grande al más pequeño.' },
      { id: 'mank',
        pide: 'Averigua cómo se llama la orden que cambia la fecha de un archivo y escribe su nombre.',
        casilla: { nombres: ['orden'], esperado: () => ['touch'] },
        pistas: ['‹man -k› busca una palabra en las descripciones de todos los manuales. Sirve cuando no sabes cómo se llama una orden.', 'Busca con una palabra del enunciado, por ejemplo «fecha».'],
        sol: ['man -k fecha'],
        exp: '‹man -k› busca en las descripciones de los manuales. El número entre paréntesis es la sección: el 1 son las órdenes.' },
      { id: 'type',
        pide: 'Averigua si cd es un programa, un alias o una orden interna de la shell.',
        selector: ['programa', 'alias', 'interna'], esperado: () => ['interna'],   // la buena no es la primera
        // la respuesta solo cuenta si antes se ha averiguado en la terminal (que haya salido de qué tipo es cd)
        antes: { ok: (c) => /^cd es (una orden interna|un alias|\/)|^builtin$/m.test(c.todo), msg: 'Primero averígualo en la terminal: hay una orden que dice de qué tipo es otra. Después, elige la respuesta.' },
        pistas: ['Hay una orden que dice de qué tipo es otra orden. Su nombre en inglés significa «tipo».', 'La orden es ‹type›, y detrás va el nombre de la orden que quieres averiguar.'],
        sol: ['type cd'], alt: [['type -t cd']],
        exp: 'Las órdenes internas son parte de la shell. Su ayuda está en ‹help›.' },
      { id: 'helpcd',
        pide: 'Enseña la ayuda de la orden interna cd.',
        pistas: ['Las órdenes internas tienen su ayuda en una orden que se llama como «ayuda» en inglés.', 'La orden es ‹help›, y detrás va el nombre de la orden interna.'],
        sol: ['help cd'], alt: [['cd --help']],
        exp: '‹help› enseña la ayuda de las órdenes internas de bash, como cd, history o alias. ‹cd --help› enseña lo mismo.',
        hecho: tiene('cd: cd [-L'),
        cerca: (c) => (/Ninguna entrada del manual para cd/.test(c.salida) ? 'cd no tiene manual propio porque es interna de la shell: su ayuda está en otra orden.' : ''),
        despistes: [{ pasos: ['man cd'], msg: /interna de la shell/ }] },
      { id: 'info',
        pide: 'Abre el manual de GNU de la orden date y sal de él.',
        pistas: ['Además de man, hay otro manual, el de GNU, que se abre con una orden de cuatro letras.', 'La orden es ‹info›, seguida del nombre de la orden. Para salir, la misma tecla que en man.'],
        sol: [{ orden: 'info date', teclas: ['q'] }],
        exp: '‹info› abre el manual de GNU, más largo que man y con enlaces entre páginas. Se sale con q.',
        hecho: (c) => c.ayuda('info', 'date') }
    ] },

    /* ================= 3. El sistema ================= */
    { id: 'sistema', nombre: 'El sistema: núcleo, módulos, discos y red', corto: 'El sistema', escenario: {}, encargos: [
      { id: 'version',
        pide: 'Enseña la versión del núcleo de esta máquina.',
        pistas: ['Hay una orden que enseña datos del núcleo. Su ayuda (con --help) dice qué opción da la versión, en inglés «kernel release».', 'La orden es ‹uname›; la opción, la letra de «release».'],
        sol: ['uname -r'], alt: [['uname -a'], ['cat /proc/version'], ['uname --kernel-release']],
        exp: '‹uname -r› da la versión del núcleo. ‹uname -a› lo da todo junto, y ‹/proc/version› dice además con qué se compiló.',
        hecho: (c) => c.salida.includes(c.sis.nucleo.version) },
      { id: 'maquina',
        pide: 'Enseña para qué tipo de procesador está hecho el núcleo.',
        pistas: ['La orden que enseña datos del núcleo también dice para qué procesador está hecho. Busca la opción en su ayuda.', 'La orden es ‹uname›; la opción, la letra de «machine».'],
        sol: ['uname -m'], alt: [['uname -a'], ['uname --machine']],
        exp: 'x86_64 son los procesadores de 64 bits de Intel y AMD; aarch64, los ARM, como los de los móviles.',
        hecho: (c) => c.salida.includes(c.sis.nucleo.arquitectura || 'x86_64') },
      { id: 'modulo',
        pide: 'Enseña si está cargado el módulo vboxguest, sin ver la lista entera de módulos.',
        pistas: ['Hay una orden que lista los módulos cargados. Lo que escribe una orden puede pasar a otra que deje solo las líneas que te interesan.', 'La lista la da ‹lsmod›. Detrás va una tubería, |, y la orden que deja pasar solo las líneas con una palabra, ‹grep›, con el nombre del módulo.'],
        sol: ['lsmod | grep vboxguest'],
        exp: 'La tubería | pasa lo que escribe una orden a la siguiente. ‹grep› deja solo las líneas que llevan la palabra.',
        hecho: (c) => c.salida.includes('vboxguest') && c.lineas.filter((l) => l.trim()).length <= 4,
        cerca: (c) => (c.salida.includes('vboxguest') ? 'vboxguest sale, pero en medio de toda la lista. Se pide solo su línea: hay una forma de quedarse solo con las líneas que llevan una palabra.' : ''),
        despistes: [{ pasos: ['lsmod'], msg: /toda la lista/ }] },
      { id: 'discos',
        pide: 'Enseña los discos de la máquina y sus particiones.',
        pistas: ['Hay una orden que lista los dispositivos de bloque: discos, particiones, lectores…', 'Empieza por ls y acaba en blk, de «block».'],
        sol: ['lsblk'],
        exp: '‹lsblk› dibuja cada disco con sus particiones debajo. La columna MOUNTPOINTS dice en qué carpeta está montada cada una.',
        hecho: (c) => /sda1/.test(c.salida) && /\bdisk\b/.test(c.salida) && /\bpart\b/.test(c.salida) },
      { id: 'home',
        pide: 'Escribe el tamaño de la partición en la que está /home.',
        casilla: { nombres: ['tamaño'], esperado: (c) => [c.sis.disco.particiones.find((p) => p.clave === 'home').tam] },
        pistas: ['En la lista de discos y particiones, busca la línea que acaba en /home.', 'Mira la columna SIZE de esa línea, con la letra de la unidad.'],
        sol: ['lsblk'],
        exp: 'Cada partición tiene su tamaño y su punto de montaje. /home es donde están las carpetas personales.' },
      { id: 'ip',
        pide: 'Enseña la dirección IP de la máquina.',
        pistas: ['Hay una orden de dos letras para la red. Con una letra detrás, enseña las direcciones de cada tarjeta.', 'La orden es ‹ip› y la letra, la de «address». La dirección está en la línea inet de enp0s3.'],
        sol: ['ip a'], alt: [['ip address'], ['ip a | grep inet']],
        exp: '‹ip a› enseña las direcciones de cada tarjeta de red. lo es la red interna de la propia máquina (127.0.0.1).',
        hecho: tiene('10.0.2.15') },
      { id: 'wayland',
        pide: 'Enseña qué tipo de sesión gráfica estás usando: X11 o Wayland.',
        pistas: ['Hay una variable de la sesión que lo guarda. Su nombre empieza por XDG_SESSION.', 'La variable se llama XDG_SESSION_TYPE. Una variable se enseña con ‹echo›, con un signo delante de su nombre.'],
        sol: ['echo $XDG_SESSION_TYPE'], alt: [['env | grep XDG_SESSION_TYPE']],
        exp: 'Ubuntu 24.04 usa Wayland. X11 es el sistema antiguo, que todavía se puede elegir al iniciar sesión.',
        hecho: (c) => /wayland/.test(c.salida) && !/\$XDG/.test(c.salida) }
    ] },

    /* ================= 4. Moverse por las carpetas ================= */
    { id: 'moverse', nombre: 'Moverse por las carpetas', corto: 'Moverse por carpetas', vista: 'arbol', escenario: { carpetas: ['~/Documentos/clase/linux', '~/Documentos/clase/redes', '~/Documentos/viajes'] }, encargos: [
      { id: 'etc',
        pide: 'Ve a la carpeta donde el sistema guarda su configuración.',
        pistas: ['La configuración de Linux está en una carpeta de la raíz de tres letras: la de «etcétera».', 'La orden que cambia de carpeta es ‹cd›. La ruta empieza por / porque sale de la raíz.'],
        sol: ['cd /etc'],
        exp: 'Una ruta que empieza por / sale de la raíz y vale estés donde estés: es una ruta absoluta.',
        hecho: (c) => c.cwd === '/etc',
        cerca: (c) => (c.cwd.startsWith('/etc/') ? 'Estás dentro de una carpeta de /etc. Se pide la propia /etc.' : ''),
        despistes: [{ pasos: ['cd /etc/apt'], msg: /propia \/etc/ }] },
      { id: 'casa',
        pide: 'Vuelve a tu carpeta personal.',
        pistas: ['Es la misma orden que cambia de carpeta. Tu carpeta personal tiene un atajo, el que sale en el prompt.', 'La orden es ‹cd›. Prueba a escribirla sin nada detrás, o con el atajo de tu carpeta personal.'],
        sol: ['cd'], alt: [['cd ~'], ['cd /home/alumno']],
        exp: '‹cd› sin nada detrás vuelve a tu carpeta personal. ‹~› es su atajo: ‹cd ~› hace lo mismo.',
        hecho: (c) => c.cwd === c.home },
      { id: 'documentos',
        pre: enCasa,
        pide: 'Entra en la carpeta Documentos.',
        pistas: ['Documentos está dentro de tu carpeta personal, que es donde estás.', 'Desde tu carpeta personal basta con el nombre de la carpeta, con la D mayúscula.'],
        sol: ['cd Documentos'], alt: [['cd ~/Documentos'], ['cd /home/alumno/Documentos']],
        exp: 'Una ruta sin / delante sale de la carpeta en la que estás: es una ruta relativa.',
        hecho: (c) => c.cwd === c.home + '/Documentos',
        cerca: (c) => (/No existe/.test(c.salida) && /documentos/.test(c.linea) ? 'Esa carpeta no existe así: el nombre empieza por mayúscula, y en Linux las mayúsculas cuentan.' : ''),
        despistes: [{ pasos: ['cd documentos'], msg: /mayúscula/ }] },
      { id: 'clase',
        pre: enCarpeta('/Documentos'),
        pide: 'Entra en la carpeta clase, que está aquí dentro.',
        pistas: ['clase está dentro de la carpeta en la que estás.', 'Escribe la orden que cambia de carpeta y el principio del nombre; Tab completa el resto.'],
        sol: ['cd clase'], alt: [['cd ~/Documentos/clase']],
        exp: 'Tab completa los nombres de las carpetas igual que los de los archivos.',
        hecho: (c) => c.cwd === c.home + '/Documentos/clase' },
      { id: 'sube',
        pre: enCarpeta('/Documentos/clase'),
        pide: 'Sube a la carpeta que contiene a esta.',
        pistas: ['Hay un nombre especial que siempre señala la carpeta de arriba, la que contiene a la actual.', 'Son dos puntos seguidos, detrás de la orden que cambia de carpeta.'],
        sol: ['cd ..'], alt: [['cd ~/Documentos']],
        exp: '‹..› es la carpeta de arriba y ‹.› la carpeta en la que estás. Las dos están en todas las carpetas.',
        hecho: (c) => c.cwd === c.home + '/Documentos' },
      { id: 'raiz',
        pide: 'Ve a la carpeta raíz, la que contiene a todas las demás.',
        pistas: ['La raíz se escribe con un solo signo.', 'La raíz es la barra, /, sola.'],
        sol: ['cd /'],
        exp: 'En Linux todo cuelga de la raíz, /: también los discos y las memorias USB, que aparecen dentro de carpetas.',
        hecho: (c) => c.cwd === '/' },
      { id: 'antes',
        pre: (c) => !!c.inicio.oldpwd && c.inicio.oldpwd !== c.inicio.cwd,
        pide: 'Vuelve a la carpeta en la que estabas justo antes.',
        pistas: ['‹cd› tiene un atajo para volver a la carpeta de antes del último cambio.', 'Es un guion detrás de la orden que cambia de carpeta.'],
        sol: ['cd -'], alt: [['cd ~/Documentos']],
        exp: '‹cd -› vuelve a la carpeta anterior y escribe su ruta. Si lo repites, vas y vienes entre las dos.',
        // la carpeta anterior de verdad: la que guardaba OLDPWD al empezar el encargo
        hecho: (c) => !!c.inicio.oldpwd && c.cwd === c.inicio.oldpwd && c.cwd !== c.inicio.cwd,
        cerca: (c) => (!c.mismaSesion ? 'Esta terminal es nueva y no recuerda dónde estabas. Pulsa «Repetir este encargo» para dejarla como al empezarlo.'
          : c.cwd === c.inicio.cwd ? `Sigues en ${c.corta(c.cwd)}. La carpeta en la que estabas justo antes era ${c.corta(c.inicio.oldpwd)}.`
            : `Estás en ${c.corta(c.cwd)}, pero la carpeta en la que estabas justo antes era ${c.corta(c.inicio.oldpwd)}.`),
        despistes: [{ pasos: ['cd /tmp'], msg: /justo antes era ~\/Documentos/ }] },
      { id: 'linux',
        pre: enCarpeta('/Documentos'),
        pide: 'Ve a la carpeta linux, que está dentro de clase, con una sola orden.',
        pistas: ['Una ruta puede atravesar varias carpetas, separadas por /.', 'Desde Documentos, la ruta es clase/linux; desde cualquier sitio, ~/Documentos/clase/linux.'],
        sol: ['cd clase/linux'], alt: [['cd ~/Documentos/clase/linux'], ['cd /home/alumno/Documentos/clase/linux']],
        exp: 'La ruta junta las carpetas con /. Con Tab después de cada barra, la terminal te completa el camino.',
        hecho: (c) => c.cwd === c.home + '/Documentos/clase/linux',
        cerca: (c) => (c.cwd === c.home + '/Documentos/clase' ? 'Estás en clase: te falta entrar en linux.' : ''),
        despistes: [{ pasos: ['cd clase'], msg: /falta entrar en linux/ }] }
    ] },

    /* ================= 5. Mirar lo que hay ================= */
    { id: 'mirar', nombre: 'Mirar lo que hay', vista: 'arbol', escenario: { archivos: fotos }, encargos: [
      { id: 'ocultos',
        pre: enCasa,
        pide: 'Enseña todo lo que hay en tu carpeta personal, también los archivos ocultos.',
        pistas: ['Los archivos ocultos empiezan por punto. La orden que lista tiene una opción para enseñarlos todos, en inglés «all».', 'La opción es ‹-a›.'],
        sol: ['ls -a'], alt: [['ls -la'], ['ls --all']],
        exp: 'Un archivo que empieza por punto no sale con ‹ls›: es oculto. Con ‹-a› salen todos, también ‹.› y ‹..›.',
        hecho: tiene('.bashrc', '.recordatorio'),
        cerca: (c) => (c.salida.includes('Documentos') && !c.salida.includes('.bashrc') ? 'Esa es la lista normal: los archivos ocultos, los que empiezan por punto, no salen. Hay una opción para enseñarlos.' : ''),
        despistes: [{ pasos: ['ls'], msg: /ocultos/ }] },
      { id: 'etc',
        pre: enCasa,
        pide: 'Enseña lo que hay en /etc sin moverte de tu carpeta personal.',
        pistas: ['La orden que lista lo que hay acepta detrás la ruta de otra carpeta.', 'Escribe ‹ls /etc›.'],
        sol: ['ls /etc'], alt: [['ls -l /etc']],
        exp: '‹ls carpeta› lista otra carpeta sin entrar en ella. Muchas órdenes funcionan igual: actúan sobre la ruta que les pones.',
        hecho: (c) => c.salida.includes('hostname') && c.salida.includes('passwd') && c.cwd === c.home,
        cerca: (c) => (c.cwd === '/etc' ? 'Te has movido a /etc. Vuelve a tu carpeta personal y hazlo sin cambiar de carpeta: la orden que lista acepta una ruta detrás.' : ''),
        despistes: [{ pasos: ['cd /etc', 'ls'], msg: /Te has movido/ }] },
      { id: 'largo',
        pre: enCasa,
        pide: 'Enseña los archivos de la carpeta fotos con su tamaño y su fecha.',
        pistas: ['La orden que lista tiene una opción para el formato largo: una línea por archivo con sus datos.', 'La opción del formato largo es ‹-l›. Detrás, el nombre de la carpeta.'],
        sol: ['ls -l fotos'], alt: [['ls -l ~/fotos'], ['ls -la fotos']],
        exp: 'En el formato largo, la quinta columna es el tamaño en bytes y después va la fecha de la última modificación.',
        hecho: (c) => /^-[rwx-]{9}.*\splaya\.jpg$/m.test(c.salida),
        cerca: (c) => (c.salida.includes('playa.jpg') ? 'Salen los nombres, pero sin tamaño ni fecha: hace falta el formato largo.' : ''),
        despistes: [{ pasos: ['ls fotos'], msg: /formato largo/ }] },
      { id: 'reciente',
        pre: enCasa,
        pide: 'Enseña los archivos de fotos ordenados por fecha, el más reciente primero.',
        pistas: ['La orden que lista tiene una opción para ordenar por fecha, en inglés «time».', 'La opción de la fecha es ‹-t›. Con ‹-l› verás también las fechas.'],
        sol: ['ls -lt fotos'], alt: [['ls -t fotos']],
        exp: '‹-t› ordena por fecha de modificación, del más reciente al más antiguo.',
        hecho: (c) => enOrden(c, ['perro.jpg', 'cena.png', 'montaña.jpg', 'playa.jpg']),
        cerca: (c) => (enOrden(c, ['playa.jpg', 'montaña.jpg', 'cena.png', 'perro.jpg']) ? 'Salen por fecha, pero al revés: el más reciente tiene que ir primero.' : c.salida.includes('playa.jpg') ? 'Salen por orden alfabético; se piden por fecha.' : ''),
        despistes: [{ pasos: ['ls fotos'], msg: /alfabético/ }, { pasos: ['ls -tr fotos'], msg: /al revés/ }] },
      { id: 'antiguo',
        pre: enCasa,
        pide: 'Ahora, al revés: el más antiguo primero.',
        pistas: ['Hay una opción que da la vuelta a cualquier orden de ‹ls›, en inglés «reverse».', 'La opción que da la vuelta es ‹-r›. Se junta con ‹-t›.'],
        sol: ['ls -ltr fotos'], alt: [['ls -tr fotos'], ['ls -l -t -r fotos']],
        exp: '‹-r› da la vuelta al orden. ‹ls -ltr› es muy útil: lo último que ha cambiado queda abajo, justo encima del prompt.',
        hecho: (c) => enOrden(c, ['playa.jpg', 'montaña.jpg', 'cena.png', 'perro.jpg']),
        cerca: (c) => (enOrden(c, ['perro.jpg', 'cena.png', 'montaña.jpg', 'playa.jpg']) ? 'Ese es el orden de antes: se pide al revés, el más antiguo primero.' : ''),
        despistes: [{ pasos: ['ls -lt fotos'], msg: /orden de antes/ }] },
      { id: 'grande',
        pre: enCasa,
        pide: 'Escribe el nombre del archivo más grande de la carpeta fotos.',
        casilla: { nombres: ['archivo'], esperado: () => ['montaña.jpg'] },
        pistas: ['En el formato largo, la quinta columna es el tamaño.', 'Lista fotos con ‹-l› y compara los números de la quinta columna.'],
        sol: ['ls -l fotos'],
        exp: 'En el formato largo se comparan los tamaños de un vistazo. ‹ls -lS› los ordena del más grande al más pequeño.' },
      { id: 'oculto',
        pre: enCasa,
        pide: 'Escribe el nombre del archivo oculto más antiguo de tu carpeta personal.',
        casilla: { nombres: ['archivo'], esperado: () => ['.notas_viejas'] },
        pistas: ['Junta varias opciones de ‹ls›: ver los ocultos, el formato largo y ordenar por fecha.', 'Junta ‹-a›, ‹-l›, ‹-t› y ‹-r›: los más antiguos salen arriba.'],
        sol: ['ls -altr'],
        exp: 'Las opciones cortas se juntan: ‹-altr› es ‹-a›, ‹-l›, ‹-t› y ‹-r› a la vez.' }
    ] },

    /* ================= 6. Crear y ver archivos ================= */
    { id: 'archivos', nombre: 'Crear y ver archivos', vista: 'arbol', escenario: { archivos: { '~/Documentos/receta.txt': receta, '~/cuento.txt': cuento } }, encargos: [
      { id: 'vacio',
        pre: enCasa,
        pide: 'Crea en tu carpeta personal un archivo vacío llamado lista-compra.txt.',
        pistas: ['Hay una orden que crea un archivo vacío si no existe. Si ya existe, solo le cambia la fecha.', 'La orden es ‹touch›, y detrás va el nombre del archivo.'],
        sol: ['touch lista-compra.txt'], alt: [['touch ~/lista-compra.txt']],
        exp: '‹touch› crea archivos vacíos. Si el archivo ya existe, no lo borra: le pone la fecha de ahora.',
        hecho: (c) => c.esArchivo('~/lista-compra.txt') && c.lee('~/lista-compra.txt') === '',
        cerca: (c) => archivoMal(c, '~/lista-compra.txt'),
        despistes: [{ pasos: ['touch Lista-compra.txt'], msg: /casi igual/ }, { pasos: ['touch lista-compra'], msg: /extensión/ }, { pasos: ['touch Documentos/lista-compra.txt'], msg: /otra carpeta/ }] },
      { id: 'horario',
        pre: enCasa,
        pide: 'Crea dentro de Documentos un archivo vacío llamado horario.txt, sin moverte de tu carpeta personal.',
        pistas: ['La orden que crea archivos acepta una ruta delante del nombre.', 'Delante del nombre del archivo va la carpeta: Documentos/horario.txt.'],
        sol: ['touch Documentos/horario.txt'], alt: [['touch ~/Documentos/horario.txt']],
        exp: 'Casi todas las órdenes aceptan rutas: no hace falta entrar en una carpeta para crear algo dentro.',
        hecho: (c) => c.esArchivo('~/Documentos/horario.txt') && c.cwd === c.home,
        cerca: (c) => (c.esArchivo('~/Documentos/horario.txt') ? 'El archivo está en su sitio, pero te has movido: vuelve a tu carpeta personal.' : archivoMal(c, '~/Documentos/horario.txt')),
        despistes: [{ pasos: ['touch horario.txt'], msg: /otra carpeta/ }, { pasos: ['cd Documentos', 'touch horario.txt'], msg: /te has movido/ }] },
      { id: 'receta',
        pre: enCasa,
        pide: 'Enseña lo que pone en el archivo receta.txt, que está en Documentos.',
        pistas: ['La orden que enseña un archivo acepta su ruta, igual que las demás.', 'Detrás de la orden que enseña archivos, pon la ruta: Documentos/receta.txt.'],
        sol: ['cat Documentos/receta.txt'], alt: [['more Documentos/receta.txt'], ['cat ~/Documentos/receta.txt']],
        exp: '‹cat› enseña el archivo entero de golpe. Para uno largo es mejor ‹more›, que va página a página.',
        hecho: tiene('Batir los huevos y mezclar'),
        cerca: (c) => (/receta\.txt: No existe/.test(c.salida) ? 'Aquí no hay ningún receta.txt: está dentro de Documentos. Pon la ruta delante del nombre.' : ''),
        despistes: [{ pasos: ['cat receta.txt'], msg: /dentro de Documentos/ }] },
      { id: 'numeros',
        pre: enCasa,
        pide: 'Enseña receta.txt con el número de cada línea delante.',
        pistas: ['La orden que enseña archivos tiene una opción para numerar las líneas, en inglés «number».', 'La opción es ‹-n›. Detrás, la ruta del archivo.'],
        sol: ['cat -n Documentos/receta.txt'],
        exp: '‹-n› numera las líneas: el último número dice cuántas tiene el archivo.',
        hecho: (c) => /^\s+1\tTortilla de patatas$/m.test(c.salida) && /^\s+6\t/m.test(c.salida),
        cerca: (c) => (c.salida.includes('Tortilla de patatas') ? 'Sale la receta, pero sin los números de línea.' : ''),
        despistes: [{ pasos: ['cat Documentos/receta.txt'], msg: /sin los números/ }] },
      { id: 'cuento',
        pre: enCasa,
        pide: 'Escribe la última palabra del archivo cuento.txt, que es muy largo.',
        casilla: { nombres: ['palabra'], esperado: () => ['faro'], natural: true },
        pistas: ['El archivo no cabe en la pantalla. Hay una orden que lo enseña página a página.', 'La orden es ‹more›, y la barra espaciadora pasa de página.'],
        sol: [{ orden: 'more cuento.txt', teclas: Array(12).fill(' ') }],
        exp: '‹more› para en cada pantalla: la barra espaciadora avanza una página, Intro una línea y q sale.' },
      { id: 'hostname',
        pide: 'Enseña lo que pone en el archivo de configuración /etc/hostname.',
        pistas: ['Es un archivo de texto: se enseña como cualquier otro, con su ruta.', 'Se enseña con la misma orden que cualquier archivo de texto, con la ruta /etc/hostname detrás.'],
        sol: ['cat /etc/hostname'], alt: [['more /etc/hostname']],
        exp: 'La configuración de Linux son archivos de texto que están en /etc: se pueden leer con ‹cat›. Este guarda el nombre del equipo.',
        hecho: (c) => c.lineas.some((l) => l.trim() === c.sis.esc.equipo) }
    ] },

    /* ================= 7. Quién, cuándo y dónde está un programa ================= */
    { id: 'quien', nombre: 'Quién, cuándo y dónde está un programa', corto: 'Quién, cuándo y dónde', escenario: { sesiones: marta }, encargos: [
      { id: 'usuario',
        pide: 'Enseña tu nombre de usuario.',
        pistas: ['Hay una orden que contesta a «¿quién soy?» en inglés.', 'Son las palabras inglesas «who am I», juntas y sin espacios.'],
        sol: ['whoami'], alt: [['echo $USER'], ['id']],
        exp: '‹whoami› escribe tu usuario. También sale en el prompt, antes de la @.',
        hecho: (c) => c.lineas.some((l) => l.trim() === c.sis.esc.usuario) || new RegExp(`uid=\\d+\\(${c.sis.esc.usuario}\\)`).test(c.salida) },
      { id: 'id',
        pide: 'Enseña tu número de usuario y los grupos a los que perteneces.',
        pistas: ['Hay una orden de dos letras que enseña tus números de usuario y de grupo.', 'Son las dos primeras letras de «identidad».'],
        sol: ['id'],
        exp: 'uid es tu número de usuario: el 1000 es el del primer usuario que se crea. El grupo sudo es el de los que pueden administrar.',
        hecho: (c) => /uid=\d+/.test(c.salida) && /grupos=/.test(c.salida) },
      { id: 'quienes',
        pide: 'Enseña quién más ha iniciado sesión en el equipo.',
        pistas: ['Hay una orden que contesta a «¿quién?» en inglés.', 'Tiene tres letras. Hay otra de una sola letra que da más datos.'],
        sol: ['who'], alt: [['w'], ['who -a']],
        exp: '‹who› lista las sesiones abiertas y en qué terminal está cada una.',
        hecho: (c) => /^marta\s+tty3/m.test(c.salida) },
      { id: 'que',
        pide: 'Escribe qué orden está usando marta.',
        casilla: { nombres: ['orden'], esperado: () => ['nano'], acepta: () => [['nano', 'nano informe.txt']] },
        pistas: ['Hay una orden de una sola letra que, además de quién está conectado, enseña qué hace cada uno.', 'Es la inicial de «who». Mira la última columna, WHAT.'],
        sol: ['w'],
        exp: '‹w› es ‹who› con más datos: desde cuándo está cada uno, cuánto lleva sin tocar el teclado y qué orden está usando.' },
      { id: 'fecha',
        pide: 'Enseña la fecha de hoy con el formato día-mes-año, separados por guiones.',
        pistas: ['La orden de la fecha acepta un formato con + delante. Los formatos están en su ayuda, con --help.', '%d es el día, %m el mes y %Y el año. Van detrás de un +, con guiones entre ellos.'],
        sol: ['date +%d-%m-%Y'],
        exp: '‹date +formato› escribe la fecha como quieras: ‹%d›, ‹%m›, ‹%Y›, ‹%H:%M›…',
        hecho: (c) => c.lineas.some((l) => l.trim() === L.util.strftime('%d-%m-%Y', c.sis.ahora())),
        cerca: (c) => (c.salida.includes(String(new Date(c.sis.ahora()).getUTCFullYear())) ? 'Sale la fecha, pero no con ese formato: se pide día-mes-año con guiones, por ejemplo 05-03-2026.' : ''),
        despistes: [{ pasos: ['date'], msg: /no con ese formato/ }] },
      { id: 'which',
        pide: 'Enseña dónde está el archivo del programa que se ejecuta al escribir ls.',
        pistas: ['Hay una orden que contesta a «¿cuál?» en inglés: dice qué programa se ejecuta.', 'La palabra inglesa es «which» («cuál»). Detrás va el nombre de la orden.'],
        sol: ['which ls'], alt: [['whereis ls']],
        exp: '‹which› busca el programa en las carpetas de la variable PATH. ls está en /usr/bin, como casi todas las órdenes.',
        hecho: tiene('/usr/bin/ls') },
      { id: 'manual',
        pide: 'Enseña dónde está guardada la página del manual de uname.',
        pistas: ['Hay una orden que contesta a «¿dónde está?» en inglés: busca el programa y también su manual.', 'La orden es ‹whereis›, todo junto. Detrás va el nombre de la orden.'],
        sol: ['whereis uname'],
        exp: '‹whereis› busca el programa y su manual. Los manuales están comprimidos: por eso acaban en .gz.',
        hecho: tiene('/usr/share/man/man1/uname.1.gz') }
    ] },

    /* ================= 8. Variables, alias e historial ================= */
    { id: 'shell', nombre: 'Variables, alias e historial', corto: 'Variables, alias, historial', escenario: {}, encargos: [
      { id: 'path',
        pide: 'Enseña la lista de carpetas en las que la shell busca los programas.',
        pistas: ['Esa lista está en una variable de la sesión. Su nombre en inglés significa «camino».', 'La variable se llama PATH. Se enseña con ‹echo›, con un signo delante de su nombre.'],
        sol: ['echo $PATH'], alt: [['env | grep PATH']],
        exp: 'Cuando escribes una orden, la shell la busca en las carpetas de PATH, por orden. Si no está en ninguna: «orden no encontrada».',
        hecho: tiene('/usr/local/sbin:/usr/local/bin') },
      { id: 'env',
        pide: 'Enseña todas las variables de la sesión.',
        pistas: ['Hay una orden que enseña todas las variables del entorno, en inglés «environment».', 'Son las tres primeras letras de «environment».'],
        sol: ['env'],
        exp: '‹env› enseña cada variable con su valor: NOMBRE=valor. Para una sola, mejor ‹echo $NOMBRE›.',
        hecho: (c) => /^HOME=/m.test(c.salida) && /^PATH=/m.test(c.salida) && /^SHELL=/m.test(c.salida) },
      { id: 'lista',
        pide: 'Haz que escribir lista haga lo mismo que una lista larga con los archivos ocultos.',
        pistas: ['Un alias es un nombre corto para una orden más larga. Se crea con ‹alias nombre=\'orden\'›.', 'Detrás de ‹alias› van el nombre, el signo = y, entre comillas simples, la orden que lista con las opciones ‹-l› y ‹-a›.'],
        sol: ["alias lista='ls -la'"], alt: [['alias lista="ls -la"'], ["alias lista='ls -l -a'"]],
        exp: 'Desde ahora, ‹lista› ejecuta ‹ls -la›. El alias dura hasta que cierras la terminal; para que dure siempre, se escribe en el archivo .bashrc.',
        hecho: (c) => aliasHace(c, 'lista', lsLargoOcultos),
        cerca: (c) => (c.alias('lista') !== null ? 'El alias lista existe, pero no hace una lista larga con los ocultos: revisa lo que va entre comillas.' : /alias: .*no encontrado/.test(c.salida) ? 'Para crearlo, va el nombre, el signo = y la orden entre comillas, todo junto.' : ''),
        despistes: [{ pasos: ["alias lista='ls -l'"], msg: /no hace una lista larga/ }] },
      { id: 'hoy',
        pide: 'Haz que escribir hoy enseñe la fecha.',
        pistas: ['Igual que antes: alias, el nombre, el signo = y la orden.', 'La orden de la fecha es ‹date›. Sin espacios alrededor del =.'],
        sol: ['alias hoy=date'], alt: [["alias hoy='date'"]],
        exp: 'Si la orden no lleva espacios, las comillas no hacen falta.',
        hecho: (c) => aliasHace(c, 'hoy', (o) => o.length === 1 && o[0][0] === 'date') },
      { id: 'borra',
        pre: (c) => c.alias('hoy') !== null,
        pide: 'Borra el alias hoy: ya no hace falta.',
        pistas: ['Igual que hay una orden que crea alias, hay otra que los borra. Las dos son internas de la shell.', 'Es ‹unalias›, seguido del nombre del alias.'],
        sol: ['unalias hoy'],
        exp: '‹unalias› borra un alias. Con ‹alias› solo, sin nada detrás, ves todos los que hay.',
        // en la misma terminal: al cerrarla, los alias se pierden todos y eso no es borrar este
        hecho: (c) => c.mismaSesion && c.alias('hoy') === null,
        cerca: (c) => (!c.mismaSesion ? 'Al cerrar la terminal se pierden todos los alias, así que esto no cuenta como borrar hoy. Pulsa «Repetir este encargo» y bórralo con su orden.' : c.alias('hoy') !== null ? 'El alias hoy sigue ahí: compruébalo con ‹alias›.' : ''),
        despistes: [{ pasos: ['alias'], msg: /sigue ahí/ }] },
      { id: 'prompt',
        pide: 'Cambia el prompt para que sea solo el signo > seguido de un espacio.',
        pistas: ['El prompt se guarda en una variable de cuatro letras: PS1.', 'La variable es PS1; el valor, entre comillas: el signo > y un espacio. Sin espacios alrededor del =.'],
        sol: ['PS1="> "'], alt: [["PS1='> '"]],
        exp: 'PS1 es el texto del prompt. Al abrir otra terminal vuelve a ser el de siempre.',
        hecho: (c) => c.valor('PS1') === '> ',
        cerca: (c) => (c.valor('PS1') === '>' ? 'Falta el espacio detrás de >: sin él, lo que escribes queda pegado al prompt.' : /PS1: no se encontró la orden/.test(c.salida) ? 'Con espacios alrededor del =, la terminal lo lee como una orden. Escríbelo todo junto.' : ''),
        despistes: [{ pasos: ['PS1=">"'], msg: /Falta el espacio/ }, { pasos: ['PS1 = "> "'], msg: /todo junto/ }] },
      { id: 'historial',
        pide: 'Enseña las órdenes que has escrito hasta ahora.',
        pistas: ['La shell guarda las órdenes que escribes. Hay una orden que las enseña numeradas, en inglés «historial».', 'Es la palabra inglesa para «historia».'],
        sol: ['history'],
        exp: 'Con ↑ recuperas las órdenes de una en una; ‹history› las enseña todas, numeradas.',
        // que haya salido el historial, sea cual sea su contenido: la última línea numerada es la propia orden
        hecho: (c) => { const u = c.lineas.filter((l) => l.trim()).pop() || '', m = u.match(/^\s*\d+\s+(.*)$/); return !!m && c.sh.hist.length > 0 && m[1].trim() === c.sh.hist[c.sh.hist.length - 1].trim(); },
        despistes: [{ pasos: ['echo $HISTSIZE'], msg: /pide una pista/ }] },
      { id: 'borrahist',
        pide: 'Borra el historial de órdenes.',
        pistas: ['Lo hace la misma orden del historial con una opción. Búscala en su ayuda: ‹help history›.', 'La opción es ‹-c›, de «clear».'],
        sol: ['history -c'],
        exp: '‹-c› vacía el historial de esta terminal. Su ayuda está en ‹help history› porque history es una orden interna.',
        // vacío ahora, en la misma terminal (si ya estaba vacío al empezar, hace falta borrarlo otra vez)
        hecho: (c) => c.mismaSesion && c.sh.hist.length === 0,
        cerca: (c) => (!c.mismaSesion ? 'Esta terminal es nueva: su historial es otro. Pulsa «Repetir este encargo» y bórralo con la opción de la orden del historial.' : ''),
        despistes: [{ pasos: ['history'], msg: /pide una pista/ }] }
    ] },

    /* ================= 9. Administrar el sistema ================= */
    { id: 'administrar', nombre: 'Administrar el sistema', corto: 'Administrar', escenario: { sobrantes: ['sl'], pendientes: 9 }, encargos: [
      { id: 'update',
        pide: 'Actualiza la lista de programas que se pueden instalar y actualizar. Tu contraseña es alumno.',
        pistas: ['Los programas se manejan con ‹apt›. Para administrar el sistema hace falta ‹sudo› delante, y te pide tu contraseña.', 'Delante, ‹sudo›; después, ‹apt› y la acción «update», que significa «actualizar».'],
        sol: [{ orden: 'sudo apt update', respuestas: ['alumno'] }],
        exp: '‹apt update› no instala nada: descarga la lista de versiones nuevas. Después se instalan con ‹apt upgrade›.',
        hecho: (c) => !!c.sis.listasAlDia,
        despistes: [{ pasos: ['apt update'], msg: /sudo delante/ }] },
      { id: 'upgrade',
        pre: (c) => !!c.sis.listasAlDia,
        pide: 'Instala las actualizaciones pendientes.',
        pistas: ['‹apt› tiene otra acción que instala las versiones nuevas. Antes de hacerlo, pregunta si quieres seguir.', 'La acción es «upgrade», «mejorar». A la pregunta, pulsa Intro.'],
        sol: [{ orden: 'sudo apt upgrade', respuestas: [''] }],
        exp: 'Primero ‹update› (la lista) y después ‹upgrade› (las versiones nuevas): siempre en ese orden.',
        hecho: (c) => !!c.sis.listasAlDia && c.sis.actualizables.length === 0,
        cerca: (c) => (/Abortado|Cancelado/.test(c.salida) ? 'Has contestado que no a la pregunta, así que no se ha instalado nada. Pulsa Intro o escribe s.' : '') },
      { id: 'cal',
        pide: 'Instala la orden cal, la del calendario.',
        pistas: ['Escribe ‹cal›: como no está instalada, la terminal te dice en qué paquete viene y cómo se instala.', 'El paquete se llama ncal; la acción de ‹apt› para instalar es «install».'],
        sol: [{ orden: 'sudo apt install ncal', respuestas: ['alumno'] }],
        exp: 'Una orden y su paquete no siempre se llaman igual. Si escribes una orden que no está, Ubuntu te dice qué paquete la trae.',
        hecho: (c) => c.paquete('ncal'),
        cerca: (c) => (/localizar el paquete cal\b/.test(c.salida) ? 'No hay ningún paquete que se llame cal. Escribe cal: la terminal te dice en qué paquete viene.' : ''),
        despistes: [{ pasos: [{ orden: 'sudo apt install cal', respuestas: ['alumno'] }], msg: /en qué paquete viene/ }] },
      { id: 'cal3',
        pre: (c) => c.paquete('ncal'),
        pide: 'Enseña con ella el calendario del mes pasado, este y el que viene, los tres juntos.',
        pistas: ['La orden del calendario tiene una opción para enseñar tres meses.', 'La opción es un guion y el número de meses.'],
        sol: ['cal -3'],
        exp: '‹cal› enseña el mes actual con hoy marcado. ‹-3› añade el de antes y el de después; ‹-y›, el año entero.',
        // solo los tres meses: el de antes, este y el siguiente, y ninguno más
        hecho: (c) => { const m = new Date(c.sis.ahora()).getUTCMonth(); return [m - 1, m, m + 1].every((k) => mesSale(c, k)) && ![m - 2, m + 2].some((k) => mesSale(c, k)); },
        cerca: (c) => {
          const m = new Date(c.sis.ahora()).getUTCMonth();
          if ([m - 1, m, m + 1, m + 2].every((k) => mesSale(c, k))) return 'Salen más meses de los que se piden. Se piden tres: el de antes, este y el siguiente.';
          return mesSale(c, m) ? 'Sale el calendario de este mes. Se piden tres: el de antes, este y el siguiente.' : '';
        },
        despistes: [{ pasos: ['cal'], msg: /Se piden tres/ }, { pasos: ['cal -y'], msg: /más meses/ }] },
      { id: 'quita',
        pre: (c) => c.paquete('sl'),
        pide: 'Quita el programa sl, que no se usa.',
        pistas: ['‹apt› también desinstala. La acción se llama como «quitar» en inglés.', 'La acción es «remove». A la pregunta, pulsa Intro.'],
        sol: [{ orden: 'sudo apt remove sl', respuestas: [''] }],
        exp: '‹apt remove› quita el programa. ‹apt purge› quita además su configuración.',
        hecho: (c) => !c.paquete('sl') },
      { id: 'gestor',
        pide: 'Enseña qué gestor de pantalla usa este Ubuntu: el programa que pide la contraseña al iniciar sesión.',
        pistas: ['El gestor de pantalla es un servicio del sistema. Hay una orden que enseña el estado de un servicio: su nombre es display-manager.', 'La orden es ‹systemctl›, con la acción «status» y el nombre del servicio. Sal con q.'],
        sol: [{ orden: 'systemctl status display-manager', teclas: ['q'] }],
        exp: 'Ubuntu usa GDM, el gestor de GNOME. Con otros escritorios cambia: Kubuntu, por ejemplo, usa SDDM.',
        // lo que escribe el estado del servicio, no la palabra gdm suelta (en /etc hay una carpeta gdm3)
        hecho: (c) => /gdm\.service|GNOME Display Manager/.test(c.salida),
        cerca: (c) => (/gdm/.test(c.salida) ? 'Sale gdm, pero eso no dice qué gestor está funcionando. Se pide el estado del servicio display-manager.' : ''),
        despistes: [{ pasos: ['ls /etc'], msg: /estado del servicio/ }] },
      { id: 'espera',
        pide: 'Haz que el arranque espere 7 segundos antes de arrancar solo.',
        pistas: ['La configuración de GRUB está en /etc/default/grub: se edita con nano y con sudo. Una de sus líneas dice cuántos segundos espera.', 'Deja GRUB_TIMEOUT=7, guarda con Ctrl + O, sal con Ctrl + X y fabrica el menú con ‹update-grub›, con ‹sudo› delante.'],
        sol: [{ orden: 'sudo nano /etc/default/grub', respuestas: ['alumno'], teclas: cambia('GRUB_TIMEOUT=0', 'GRUB_TIMEOUT=7').concat(guardaYSal) }, 'sudo update-grub'],
        exp: '/etc/default/grub es lo que se edita; /boot/grub/grub.cfg lo fabrica ‹update-grub› y no se toca a mano. Con GRUB_TIMEOUT_STYLE=hidden, la espera es a ciegas: el menú no se ve.',
        hecho: (c) => grub.espera(c, 7),
        cerca: (c) => { const a = avisoGrub(c); if (a) return a; const s = grub.segundos(c); return s !== null && s !== 0 && s !== 7 ? `El arranque espera ${s} segundos. Se piden 7.` : ''; },
        despistes: [{ pasos: [{ orden: 'sudo nano /etc/default/grub', respuestas: ['alumno'], teclas: cambia('GRUB_TIMEOUT=0', 'GRUB_TIMEOUT=7').concat(guardaYSal) }], msg: /no se ha vuelto a fabricar/ }] },
      { id: 'menu',
        pre: (c) => (grub.segundos(c) || 0) > 0,
        pide: 'Haz que durante esa espera se vea el menú de GRUB.',
        pistas: ['En el mismo archivo, la línea GRUB_TIMEOUT_STYLE dice si el menú se enseña o se esconde durante la espera.', 'Deja GRUB_TIMEOUT_STYLE=menu y vuelve a fabricar el menú.'],
        sol: [{ orden: 'sudo nano /etc/default/grub', respuestas: ['alumno'], teclas: cambia('GRUB_TIMEOUT_STYLE=hidden', 'GRUB_TIMEOUT_STYLE=menu').concat(guardaYSal) }, 'sudo update-grub'],
        exp: 'Con menu, el menú se ve mientras dura la espera, y la cuenta atrás se para en cuanto pulsas una flecha. Con 0 segundos no llegaría a verse.',
        // se ve de verdad: estilo menu y una espera mayor que 0
        hecho: grub.menuVisible,
        cerca: (c) => avisoGrub(c) || (grub.menu(c) && grub.segundos(c) === 0 ? 'El estilo ya es menu, pero la espera es de 0 segundos: el menú no llegaría a verse.' : /set timeout_style=countdown/.test(c.grubCfg()) ? 'Con countdown se ve una cuenta atrás, no el menú.' : ''),
        despistes: [{ pasos: [{ orden: 'sudo nano /etc/default/grub', respuestas: ['alumno'], teclas: cambia('GRUB_TIMEOUT_STYLE=hidden', 'GRUB_TIMEOUT_STYLE=menu').concat(cambia('GRUB_TIMEOUT=7', 'GRUB_TIMEOUT=0'), guardaYSal) }, 'sudo update-grub'], msg: /0 segundos/ }] },
      { id: 'mensajes',
        pide: 'Haz que al arrancar se vean los mensajes del sistema en vez del logotipo.',
        pistas: ['Los mensajes y el logotipo dependen de dos palabras de la línea GRUB_CMDLINE_LINUX_DEFAULT: quiet esconde los mensajes y splash enseña el logotipo.', 'Deja GRUB_CMDLINE_LINUX_DEFAULT="" (con las comillas) y vuelve a fabricar el menú.'],
        sol: [{ orden: 'sudo nano /etc/default/grub', respuestas: ['alumno'], teclas: cambia('"quiet splash"', '""').concat(guardaYSal) }, 'sudo update-grub'],
        exp: 'Sin quiet ni splash se ve cada paso del arranque: es lo que se mira cuando una máquina no arranca bien.',
        hecho: (c) => grub.sinLogo(c) && grub.sinQuiet(c),
        cerca: (c) => avisoGrub(c) || (grub.sinLogo(c) ? 'Ya no sale el logotipo, pero los mensajes siguen escondidos: falta quitar quiet.' : '') }
    ] },

    /* ================= 10. Todo junto ================= */
    { id: 'junto', nombre: 'Todo junto', vista: 'arbol', escenario: { sesiones: marta }, encargos: [
      { id: 'ideas',
        pre: enCasa,
        pide: 'Entra en Documentos, crea allí un archivo vacío llamado ideas.txt y enseña lo que hay en la carpeta en formato largo.',
        pistas: ['Son tres órdenes: una para entrar, otra para crear el archivo y otra para listar con una opción.', 'Primero, ‹cd› a Documentos; después, ‹touch› con el nombre; al final, la orden que lista con ‹-l›.'],
        sol: ['cd Documentos', 'touch ideas.txt', 'ls -l'], alt: [['cd ~/Documentos; touch ideas.txt; ls -l'], ['touch Documentos/ideas.txt', 'cd Documentos', 'ls -la']],
        exp: 'Con ; puedes escribir las tres órdenes en una línea. El archivo nuevo sale con tamaño 0.',
        hecho: (c) => c.cwd === c.home + '/Documentos' && c.esArchivo('~/Documentos/ideas.txt') && /^-[rwx-]{9}.*\sideas\.txt$/m.test(c.salida),
        cerca: (c) => { const m = archivoMal(c, '~/Documentos/ideas.txt'); if (m) return m; if (c.esArchivo('~/Documentos/ideas.txt') && c.cwd !== c.home + '/Documentos') return 'ideas.txt ya está en Documentos. Falta entrar en esa carpeta.'; if (c.esArchivo('~/Documentos/ideas.txt')) return 'Ya está el archivo. Falta enseñar la carpeta en formato largo.'; if (c.cwd === c.home + '/Documentos') return 'Ya estás en Documentos. Ahora crea allí el archivo.'; return ''; },
        despistes: [{ pasos: ['touch ideas.txt'], msg: /otra carpeta/ }, { pasos: ['cd Documentos', 'touch ideas.txt', 'ls'], msg: /formato largo/ }] },
      { id: 'donde',
        pide: 'Crea un alias llamado donde que limpie la pantalla y después enseñe la carpeta actual. Luego, pruébalo.',
        pistas: ['El alias lleva dos órdenes separadas por punto y coma, todo entre comillas simples.', 'Entre comillas simples: ‹clear›, un punto y coma y ‹pwd›. Después, escribe el nombre del alias.'],
        sol: ["alias donde='clear; pwd'", 'donde'], alt: [['alias donde="clear; pwd"', 'donde']],
        exp: 'Un alias puede llevar varias órdenes. Al escribir su nombre, se ejecutan todas en orden.',
        hecho: (c) => aliasHace(c, 'donde', limpiaYCarpeta) && c.linea.trim() === 'donde' && c.lineas.some((l) => l.trim() === c.cwd),
        cerca: (c) => (aliasHace(c, 'donde', limpiaYCarpeta) ? 'El alias está bien. Falta probarlo: escribe su nombre.' : c.alias('donde') !== null ? 'El alias donde existe, pero no hace lo que se pide: primero limpiar y después la carpeta.' : ''),
        despistes: [{ pasos: ["alias donde='clear; pwd'"], msg: /Falta probarlo/ }, { pasos: ["alias donde='pwd; clear'"], msg: /no hace lo que se pide/ }] },
      { id: 'marta',
        pide: 'Escribe en qué terminal ha iniciado sesión marta y qué orden está usando.',
        casilla: { nombres: ['terminal', 'orden'], esperado: () => ['tty3', 'nano'], acepta: () => [['tty3', '/dev/tty3'], ['nano', 'nano informe.txt']] },
        pistas: ['Las dos cosas salen en la misma lista: la de quién está conectado y qué hace.', 'Escribe ‹w›: la terminal está en la columna TTY y la orden, en WHAT.'],
        sol: ['w'],
        exp: '‹w› lo dice todo en una línea por usuario. ‹who› solo dice quién y dónde.' },
      { id: 'calendario',
        pide: 'Instala la orden cal y enseña con ella el calendario del año entero. Tu contraseña es alumno.',
        pistas: ['El paquete de cal se llama ncal. Después, cal tiene una opción para el año entero, en inglés «year».', 'Primero, ‹sudo apt install› con el paquete ncal; después, ‹cal› con la opción ‹-y›.'],
        sol: [{ orden: 'sudo apt install ncal', respuestas: ['alumno'] }, 'cal -y'],
        exp: '‹cal -y› enseña los doce meses. ‹cal 3 2027› enseña un mes concreto.',
        hecho: (c) => c.paquete('ncal') && mesSale(c, 0) && mesSale(c, 11),
        cerca: (c) => (!c.paquete('ncal') ? '' : /\b(lu|do)\b/i.test(c.salida) ? 'Ya está instalada. Falta el año entero: cal tiene una opción para eso.' : 'Ya está instalada. Ahora enseña con ella el calendario del año entero.'),
        despistes: [{ pasos: [{ orden: 'sudo apt install ncal', respuestas: ['alumno'] }, 'cal'], msg: /Falta el año entero/ }] },
      { id: 'arranque',
        pide: 'Haz que el arranque espere 4 segundos con el menú a la vista y sin el logotipo.',
        pistas: ['Son tres líneas de /etc/default/grub: GRUB_TIMEOUT_STYLE, GRUB_TIMEOUT y GRUB_CMDLINE_LINUX_DEFAULT. Después hay que fabricar el menú.', 'Deja menu, 4 y "quiet", guarda, sal y ejecuta ‹sudo update-grub›.'],
        sol: [{ orden: 'sudo nano /etc/default/grub', respuestas: ['alumno'], teclas: cambia('GRUB_TIMEOUT_STYLE=hidden', 'GRUB_TIMEOUT_STYLE=menu').concat(cambia('GRUB_TIMEOUT=0', 'GRUB_TIMEOUT=4'), cambia('"quiet splash"', '"quiet"'), guardaYSal) }, 'sudo update-grub'],
        exp: 'Los tres cambios van en el mismo archivo y basta con fabricar el menú una vez, al final.',
        hecho: (c) => grub.menuVisible(c) && grub.espera(c, 4) && grub.sinLogo(c),
        cerca: (c) => { const a = avisoGrub(c); if (a) return a; const falta = [!grub.menuVisible(c) && 'que se vea el menú', !grub.espera(c, 4) && 'los 4 segundos', !grub.sinLogo(c) && 'quitar el logotipo'].filter(Boolean); return falta.length < 3 ? 'Vas bien. Falta ' + falta.join(' y ') + '.' : ''; } },
      { id: 'salir',
        pide: 'Cambia tu contraseña por linux2026 y, después, cierra la sesión de la terminal.',
        pistas: ['Hay una orden que cambia la contraseña: pide la actual (alumno) y dos veces la nueva. Para cerrar la sesión hay otra orden.', 'La contraseña se cambia con ‹passwd›; la sesión se cierra con ‹exit›.'],
        sol: [{ orden: 'passwd', respuestas: ['alumno', 'linux2026', 'linux2026'] }, 'exit'],
        exp: 'Lo que se escribe en una contraseña no se ve, ni con asteriscos. ‹exit› (o Ctrl + D con la línea vacía) termina la sesión y cierra la ventana.',
        hecho: (c) => c.sis.compruebaClave(c.sis.esc.usuario, 'linux2026') && c.registro.some((x) => x.tipo === 'salir' && !x.ventana),
        cerca: (c) => (c.sis.compruebaClave(c.sis.esc.usuario, 'linux2026') ? 'La contraseña ya es la nueva. Falta cerrar la sesión con la orden que la termina.' : ''),
        despistes: [{ pasos: [{ orden: 'passwd', respuestas: ['alumno', 'linux2026', 'linux2026'] }], msg: /Falta cerrar la sesión/ }] }
    ] }
  ] };

  if (typeof module !== 'undefined' && module.exports) module.exports = P.bancos[4];
})(typeof window !== 'undefined' ? window : globalThis);
