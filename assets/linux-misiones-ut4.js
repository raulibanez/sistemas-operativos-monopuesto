/* Simulador de Linux · misiones de la UT4 (guion ut04.md, apartado 7) y el repaso de la unidad.
 *
 * Tres tipos de tarea (especificación, 3.5):
 *   estado     comprueba(e) mira el sistema simulado (la norma)
 *   respuesta  casillas (o un selector) donde se escribe un dato; se compara con el escenario de la semilla:
 *              esperado(e) da lo correcto, acepta(e) las formas que valen; deSalida(salidas, e) saca la respuesta
 *              de lo que escriben las órdenes de la solución (lo usan las pruebas para ver que cuadra)
 *   evento     comprueba(e) mira e.registro: una tecla (Ctrl+C sobre una orden, Tab), abrir la ayuda o la forma de
 *              una línea
 * Los pasos de la solución son órdenes (texto) u objetos: {orden, tab: true} (se escribe, Tab y luego Intro),
 * {orden, ctrlC: n} (Ctrl+C tras n segundos), {orden, teclas: [...]} (teclas para el programa a pantalla completa),
 * {orden, respuestas: [...]} (contraseñas y preguntas).
 */
(function (raiz) {
  'use strict';
  const SOM = (raiz.SOM = raiz.SOM || {});
  const L = (SOM.linux = SOM.linux || {});
  const U = L.util;
  const M = (L.misiones = L.misiones || {});
  const b = (t) => `<b>${t}</b>`, u = (t) => `<u>${t}</u>`;
  const APELLIDOS = ['garcia', 'lopez', 'martin', 'sanchez', 'perez', 'gomez', 'ruiz', 'diaz', 'moreno', 'alonso', 'romero', 'navarro'];
  const lineasDe = (t) => String(t || '').split('\n').filter((l) => l !== '');

  /* ---------- respuestas: normalizar y comparar ---------- */
  /* Espacios, coma o punto decimal, unidades («12G» = «12 GB» = «12 GiB»), barra final de una ruta y punto final.
   * Mayúsculas y tildes cuentan: en opciones, rutas, archivos, dispositivos y variables Linux las distingue. Solo en
   * las tareas de lenguaje corriente (t.natural: días, meses, el nombre del sistema) dan igual. */
  L.normalizaRespuesta = function (v, natural) {
    let x = String(v === undefined || v === null ? '' : v).trim()
      .replace(/\s+/g, ' ')
      .replace(/(\d)\.(\d)/g, '$1,$2')
      .replace(/(\d)\s*([kmgtKMGT])(i?[bB]|i)?\b/g, (m, d, u) => d + u.toUpperCase())
      .replace(/[.。]$/, '')
      .replace(/(.)\/+$/, '$1');
    if (natural) x = x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return x;
  };
  const sinTildes = (x) => L.normalizaRespuesta(x, true);
  // «4 paquetes», «0 segundos», «8 grupos»: un número con su unidad detrás vale como el número
  const soloNumero = (v) => { const m = String(v).trim().match(/^(\d+)\s+[a-záéíóúñü]+\.?$/i); return m ? m[1] : null; };
  function coincide(valor, aceptadas, natural) {
    const n = L.normalizaRespuesta(valor, natural);
    if (aceptadas.some((a) => L.normalizaRespuesta(a, natural) === n)) return true;
    const num = soloNumero(valor);
    return num !== null && aceptadas.some((a) => /^\d+$/.test(String(a)) && String(a) === num);
  }
  L.coincideRespuesta = coincide;
  // tarea de respuesta: compara cada casilla con lo que se acepta. avisa(valores, e) da un mensaje propio cuando el
  // dato es casi el bueno (mayúsculas o tildes distintas; o lo que diga la tarea)
  function respuesta(t) {
    const aceptadas = (e) => (t.acepta ? t.acepta(e) : t.esperado(e).map((x) => [x]));
    const propio = t.avisa;
    return Object.assign({}, t, {
      tipo: 'respuesta', fija: true,
      comprueba(e, valores) {
        if (!valores) return false;
        return aceptadas(e).every((lista, i) => valores[i] !== undefined && valores[i] !== '' && coincide(valores[i], lista, t.natural));
      },
      avisa(valores, e) {
        const m = propio && propio(valores, e);
        if (m) return m;
        let ac; try { ac = aceptadas(e); } catch (x) { return ''; }
        const casi = ac.some((lista, i) => valores[i] && !coincide(valores[i], lista, t.natural) && lista.some((a) => sinTildes(a) === sinTildes(valores[i])));
        return casi ? 'casi: en Linux las mayúsculas y las tildes cuentan. Escríbelo tal como sale en la terminal.' : '';
      }
    });
  }
  const evento = (t) => Object.assign({ tipo: 'evento', fija: true }, t);
  const estado = (t) => Object.assign({ tipo: 'estado' }, t);
  // las órdenes simples de una línea ya analizada (para las comprobaciones por la forma de la línea)
  function ordenesDe(arbol) {
    const out = [];
    const recorre = (n) => {
      if (!n) return;
      if (n.tipo === 'lista') n.items.forEach((i) => recorre(i.nodo));
      else if (n.tipo === 'y_o') { recorre(n.primero); n.resto.forEach((r) => recorre(r.nodo)); }
      else if (n.tipo === 'tuberia') n.ordenes.forEach(recorre);
      else if (n.tipo === 'simple' && n.palabras.length) out.push(n.palabras.map((p) => p.src));
    };
    recorre(arbol);
    return out;
  }
  L.ordenesDe = ordenesDe;
  const lineas = (e) => (e.registro || []).filter((x) => x.tipo === 'linea');
  // history -c, sola o con otras órdenes en la misma línea (history -c; clear)
  const borraHistorial = (e) => lineas(e).some((l) => { try { return ordenesDe(l.arbol).some((o) => o[0] === 'history' && o.slice(1).some((x) => /^-[a-z]*c/.test(x))); } catch (x) { return false; } });

  /* ================= M1 · Primeros pasos ================= */
  M['ut4-m1'] = {
    titulo: 'Primeros pasos', ut: 'UT4',
    generar(semilla) {
      const r = U.azar(semilla);
      const usuario = r.elige(['ana', 'luis', 'marta']);
      const equipo = 'som-' + r.elige(APELLIDOS);
      const palabra = r.elige(['terminal', 'ubuntu', 'linux', 'consola', 'prompt', 'bash']);
      const numero = r.ent(100, 999);
      const codigo = Array.from({ length: 6 }, () => r.elige('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))).join('');
      const archivo = `bienvenida-${palabra}-${numero}.txt`;
      const escenario = { usuario, nombreCompleto: usuario[0].toUpperCase() + usuario.slice(1), clave: usuario, equipo, archivos: { ['~/' + archivo]: `Tu código es: ${codigo}\n` } };
      const tareas = [
        respuesta({ html: `${u('Escribe')} tu usuario y el nombre del equipo.`, corta: 'Tu usuario y el nombre del equipo.', casillas: ['usuario', 'equipo'],
          pista: 'Mira el prompt, lo que sale antes del $: primero va tu usuario y, detrás de la @, el nombre del equipo.',
          pistaOrden: `No hace falta ninguna orden: el prompt es ${usuario}@${equipo}:~$`, solucion: ['whoami', 'hostname'],
          esperado: () => [usuario, equipo], deSalida: (s) => [s[0].trim(), s[1].trim()] }),
        respuesta({ html: `${u('Escribe')} la ruta completa de la carpeta en la que estás, la que escribe ${b('pwd')}.`, corta: 'La ruta completa de la carpeta en la que estás (pwd).', casillas: ['carpeta'],
          pista: 'La ruta completa empieza por / y va desde la raíz hasta tu carpeta. El ~ del prompt es un atajo para tu carpeta personal.',
          solucion: ['pwd'], esperado: () => ['/home/' + usuario], deSalida: (s) => [s[0].trim()],
          avisa: (v) => (/^~\/?$/.test(String(v[0]).trim()) ? '~ es tu carpeta personal, así que es la misma carpeta, pero aquí se pide la ruta completa, la que escribe pwd.' : '') }),
        respuesta({ html: `${u('Escribe')} la shell con la que trabajas.`, corta: 'La shell con la que trabajas.', casillas: ['shell'],
          pista: 'La shell está guardada en una variable que se llama SHELL. Con echo puedes ver lo que guarda una variable.',
          solucion: ['echo $SHELL'], esperado: () => ['/bin/bash'], acepta: () => [['/bin/bash', 'bash', '/usr/bin/bash']], deSalida: (s) => [s[0].trim()] }),
        respuesta({ html: `${u('Enseña')} el archivo que empieza por ${b('bienvenida')} y escribe el código que trae. Usa ${b('Tab')}.`, corta: 'El código del archivo bienvenida…', casillas: ['código'],
          pista: 'El nombre es muy largo. Escribe cat y el principio del nombre, y deja que Tab lo complete.',
          pistaOrden: 'Escribe «cat bien», pulsa Tab para completar el nombre y después Intro.', solucion: [{ orden: 'cat bien', tab: true }],
          esperado: () => [codigo], deSalida: (s) => [(s[0].match(/Tu código es: (\S+)/) || [])[1]] }),
        Object.assign(respuesta({ html: `${u('Lanza')} ${b('ping 10.0.2.2')}, ${u('páralo')} con ${b('Ctrl + C')} y escribe cuántos paquetes se transmitieron.`, corta: 'ping 10.0.2.2, Ctrl + C y cuántos paquetes se transmitieron.', casillas: ['paquetes'],
          pista: 'ping no para solo. Déjalo unos segundos, córtalo y lee el resumen que escribe al final.',
          pistaOrden: 'Escribe «ping 10.0.2.2», espera unos segundos y pulsa Ctrl + C. El número está en la línea «packets transmitted».', solucion: [{ orden: 'ping 10.0.2.2', ctrlC: 3 }],
          esperado: (e) => { const p = (e.registro || []).filter((x) => x.tipo === 'ping' && x.interrumpido).pop(); return [p ? String(p.transmitidos) : '?']; },
          deSalida: (s) => [(s[0].match(/(\d+) packets transmitted/) || [])[1]] }), {
          comprueba(e, valores) {
            const p = (e.registro || []).filter((x) => x.tipo === 'ping' && x.interrumpido && /^10\.0\.2\.2$/.test(x.destino)).pop();
            const corte = (e.registro || []).some((x) => x.tipo === 'tecla' && x.tecla === 'Ctrl+C' && x.orden === 'ping');
            return !!(p && corte && valores && coincide(valores[0], [String(p.transmitidos)]));
          } }),
        evento({ html: `${u('Limpia')} la pantalla y, después, ${u('enseña')} la carpeta actual, con las dos órdenes escritas en la misma línea.`, corta: 'clear y después pwd, en la misma línea.',
          pista: 'Puedes escribir dos órdenes en la misma línea si las separas con un punto y coma. Van en el orden en que se ejecutan.', solucion: ['clear; pwd'],
          // con ; o con && (no se ha enseñado, pero también deja las dos órdenes en la misma línea, una detrás de otra)
          comprueba: (e) => lineas(e).some((l) => { if (!/;|&&/.test(l.texto)) return false; const o = ordenesDe(l.arbol).map((x) => x[0]); const c = o.indexOf('clear'), w = o.lastIndexOf('pwd'); return c >= 0 && w > c; }) })
      ];
      return { titulo: this.titulo, escenario, tareas, tarea: `⟪Averigua⟫ tu usuario, el equipo, la carpeta, la shell y el código de ⟦${archivo}⟧, ⟪corta⟫ un ⟦ping⟧ con Ctrl + C y ⟪ejecuta⟫ ⟦clear; pwd⟧.`, variante: palabra, variantes: 6 };
    }
  };

  /* ================= M2 · Pide ayuda ================= */
  /* M2, tarea 2: la orden que hace algo, buscada con man -k con una palabra del enunciado. [orden, qué hace, búsqueda,
   * pista, otras que valen]. Comprobado con las descripciones reales (linux-whatis*.js): cada búsqueda da una lista
   * corta con la orden (used memory: 1 línea; conectado: 3; espacio: 8; fecha: 2) */
  const DESCRIPCIONES = [
    ['free', 'enseña la memoria libre y la usada (en inglés, «used memory»)', 'man -k "used memory"', 'Su descripción está en inglés: busca «used memory», entre comillas para que las dos palabras vayan juntas.'],
    ['who', 'enseña quién está conectado al sistema', 'man -k conectado', 'Prueba con la palabra «conectado», que sale en el enunciado.', ['users']],
    ['df', 'enseña el espacio libre de los discos', 'man -k espacio', 'Prueba con la palabra «espacio», que sale en el enunciado.'],
    ['touch', 'cambia la fecha de un archivo', 'man -k fecha', 'Prueba con la palabra «fecha», que sale en el enunciado.']];
  const TIPOS_ORDEN = [['cd', 'interna'], ['pwd', 'interna'], ['echo', 'interna'], ['history', 'interna'], ['ls', 'alias'], ['grep', 'alias'], ['cat', 'programa'], ['date', 'programa'], ['uname', 'programa']];
  M['ut4-m2'] = {
    titulo: 'Pide ayuda', ut: 'UT4',
    generar(semilla) {
      const r = U.azar(semilla);
      const nombres = r.baraja(['playa.jpg', 'montaña.jpg', 'cena.png', 'perro.jpg', 'fiesta.png', 'nieve.jpg', 'gato.png', 'boda.jpg']).slice(0, 5);
      const tamanos = r.baraja([184320, 236544, 312832, 97280, 451584, 155648, 520192]).slice(0, 5);
      const archivos = {};
      nombres.forEach((n, i) => { archivos['~/fotos/' + n] = { tam: tamanos[i], tipoArchivo: /png$/.test(n) ? 'PNG image data, 1920 x 1080, 8-bit/color RGB, non-interlaced' : 'JPEG image data, JFIF standard 1.01' }; });
      const mayor = nombres[tamanos.indexOf(Math.max(...tamanos))];
      const [orden, desc, busca, pistaBusca, otras] = r.elige(DESCRIPCIONES);
      const [orden3, tipo3] = r.elige(TIPOS_ORDEN);
      const orden4 = r.elige(['ls', 'date', 'cat']);
      const escenario = { archivos, historial: ['ls', 'cd fotos', 'ls -l', 'cd'] };
      const tareas = [
        respuesta({ html: `${u('Escribe')} el nombre del archivo más grande de la carpeta ${b('fotos')}.`, corta: 'El archivo más grande de fotos.', casillas: ['archivo'],
          pista: 'ls tiene una opción que ordena por tamaño. Búscala en ls --help: esa línea de la ayuda está en inglés, con la palabra «size».', solucion: ['ls -lS fotos'], esperado: () => [mayor],
          deSalida: (s) => [lineasDe(s[0])[1].split(/\s+/).pop()] }),
        respuesta({ html: `${u('Escribe')} el nombre de la orden que ${desc}.`, corta: `La orden que ${desc}.`, casillas: ['orden'],
          pista: 'man -k busca una palabra en las descripciones de todos los manuales. ' + pistaBusca, solucion: [busca], esperado: () => [orden], acepta: () => [[orden].concat(otras || [])],
          deSalida: (s) => [lineasDe(s[0]).some((l) => l.startsWith(orden + ' (')) ? orden : '?'] }),
        respuesta({ html: `${u('Averigua')} si ${b(orden3)} es una orden interna, un alias o un programa.`, corta: `¿${orden3}: interna, alias o programa?`, selector: ['interna', 'alias', 'programa'],
          pista: 'Hay una orden de bash que te dice si otra orden es interna, un alias o un programa. Se llama como «tipo» en inglés.', solucion: ['type ' + orden3], esperado: () => [tipo3],
          deSalida: (s) => [/orden interna/.test(s[0]) ? 'interna' : /alias/.test(s[0]) ? 'alias' : 'programa'] }),
        evento({ html: `${u('Abre')} el manual de GNU de ${b(orden4)} con ${b('info')} y ${u('sal')} con ${b('q')}.`, corta: `info ${orden4} y salir con q.`,
          pista: 'info se usa como man: detrás va el nombre de la orden. Para salir, se pulsa la misma tecla que en man.',
          pistaOrden: `Escribe «info ${orden4}» y, dentro, pulsa q.`, solucion: [{ orden: 'info ' + orden4, teclas: ['q'] }],
          comprueba: (e) => (e.registro || []).some((x) => x.tipo === 'ayuda' && x.programa === 'info' && x.tema === orden4) }),
        estado({ html: `${u('Lee')} la ayuda de ${b('history')} y ${u('borra')} el historial.`, corta: 'help history y borrar el historial.', fija: true,
          pista: 'history es una orden interna de bash, así que su ayuda no está en man, sino en help. Busca en ella la opción que borra la lista.', solucion: ['help history', 'history -c'],
          comprueba: (e) => borraHistorial(e) && !e.historial().some((h) => ['cd fotos', 'ls -l'].includes(h)) })
      ];
      return { titulo: this.titulo, escenario, tareas, tarea: `Con ⟦--help⟧, ⟦man -k⟧, ⟦type⟧, ⟦info⟧ y ⟦help⟧: ⟪averigua⟫ el archivo más grande de ⟦fotos⟧, la orden que ${desc}, qué es ⟦${orden3}⟧, ⟪abre⟫ ⟦info ${orden4}⟧ y ⟪borra⟫ el historial.`, variante: orden, variantes: 4 };
    }
  };

  /* ================= M3 · Explora el núcleo ================= */
  const MODULOS_M3 = [['usbhid', true], ['vboxguest', true], ['btrfs', false], ['nvidia', false]];
  M['ut4-m3'] = {
    titulo: 'Explora el núcleo', ut: 'UT4',
    generar(semilla) {
      const r = U.azar(semilla);
      const n = r.ent(31, 58);
      const rama = r.elige(['6.8.0', '6.17.0', '7.0.0']);
      const version = `${rama}-${n}-generic`;
      const arquitectura = r.r() < 0.25 ? 'aarch64' : 'x86_64';
      const gcc = r.elige(['13.3.0-6ubuntu2~24.04.1', '13.2.0-23ubuntu4', '14.2.0-4ubuntu2~24.04']);
      const [modulo, porDefecto] = r.elige(MODULOS_M3);
      const cargado = r.r() < 0.5;
      const modulos = { añade: [], quita: [] };
      if (cargado && !porDefecto) modulos.añade.push(modulo);
      if (!cargado && porDefecto) modulos.quita.push(modulo);
      const numero = rama === '6.8.0' ? String(n) : `${n}~24.04.1`;
      const escenario = { equipo: 'som-' + r.elige(APELLIDOS), nucleo: { version, numero, arquitectura, gcc, fecha: r.elige(['Tue Nov  4 18:08:19 UTC 2025', 'Fri Oct 10 09:12:44 UTC 2026', 'Sat Oct 31 06:52:47 UTC 2026']), modulos } };
      const busqueda = 'operating'.split('');
      const tareas = [
        respuesta({ html: `${u('Escribe')} la versión del núcleo de esta máquina.`, corta: 'La versión del núcleo.', casillas: ['versión'],
          pista: 'uname enseña datos del núcleo. Tiene una opción para la versión (en inglés, «kernel release»): búscala en uname --help.', solucion: ['uname -r'], esperado: () => [version], deSalida: (s) => [s[0].trim()] }),
        respuesta({ html: `${u('Escribe')} el tipo de procesador para el que está hecho el núcleo.`, corta: 'El tipo de procesador del núcleo.', casillas: ['procesador'],
          pista: 'uname tiene una opción para la máquina, es decir, para el tipo de procesador. Búscala en uname --help.', solucion: ['uname -m'], esperado: () => [arquitectura], deSalida: (s) => [s[0].trim()] }),
        respuesta({ html: `${u('Averigua')} si está cargado el módulo ${b(modulo)}.`, corta: `¿Está cargado ${modulo}?`, selector: ['sí', 'no'],
          pista: 'lsmod lista los módulos cargados. Con una tubería y grep te quedas solo con la línea del que buscas; si no sale nada, no está cargado.', solucion: [`lsmod | grep ${modulo}`],
          esperado: () => [cargado ? 'sí' : 'no'], deSalida: (s) => [s[0].trim() ? 'sí' : 'no'] }),
        respuesta({ html: `${u('Escribe')} la versión de gcc con la que se compiló el núcleo.`, corta: 'La versión de gcc del núcleo.', casillas: ['gcc'],
          pista: 'Hay un archivo del sistema, en la carpeta /proc, que guarda la versión del núcleo y con qué se compiló.', solucion: ['cat /proc/version'], esperado: () => [gcc.split('-')[0]],
          acepta: () => [[gcc.split('-')[0], gcc, 'Ubuntu ' + gcc, 'gcc ' + gcc.split('-')[0], 'gcc ' + gcc]], deSalida: (s) => [(s[0].match(/\(Ubuntu [^)]+\) (\S+),/) || [])[1]] }),
        respuesta({ html: `${u('Busca')} en el manual la opción de uname que enseña el sistema operativo, ${u('ejecútala')} y escribe lo que contesta la terminal.`, corta: 'Lo que contesta uname con la opción del sistema operativo.', casillas: ['respuesta'], natural: true,
          pista: 'Abre el manual de uname y busca dentro con / la opción del sistema operativo: su nombre largo, en inglés, lleva la palabra «operating». Después, ejecuta uname con esa opción.',
          pistaOrden: 'Escribe «man uname», busca con «/operating» e Intro y sal con q. La opción es -o: ejecuta «uname -o» y escribe lo que contesta.',
          avisa: (v) => (/^(-o|--operating-system)$/.test(String(v[0]).trim()) ? 'esa es la opción. Ahora ejecútala y escribe lo que contesta la terminal.' : ''), solucion: [{ orden: 'man uname', teclas: ['/'].concat(busqueda, ['Enter', 'q']) }, 'uname -o'],
          esperado: () => ['GNU/Linux'], deSalida: (s) => [s[1].trim()] })
      ];
      return { titulo: this.titulo, escenario, tareas, tarea: '⟪Averigua⟫ la versión del núcleo, el procesador, si está el módulo ⟦' + modulo + '⟧, la versión de gcc y el sistema operativo con ⟦uname⟧.', variante: modulo + (cargado ? '+' : '-'), variantes: 8 };
    }
  };

  /* ================= M4 · La máquina recién instalada ================= */
  M['ut4-m4'] = {
    titulo: 'La máquina recién instalada', ut: 'UT4', sudo: true,
    generar(semilla) {
      const r = U.azar(semilla);
      const tam = r.elige([30, 35, 40, 45, 50, 55, 60]);
      const swap = tam <= 30 ? 2 : r.elige([2, 4]);   // con 30 GB y 4 de swap no quedaría /home
      const orden = r.elige([['efi', 'raiz', 'swap', 'home'], ['efi', 'swap', 'raiz', 'home'], ['efi', 'raiz', 'home', 'swap']]);
      const sobra = r.elige(['cowsay', 'sl', 'figlet']);
      const ip = '10.0.2.' + r.elige([15, 15, 16, 20, 24]);
      const escenario = { disco: { tam, swap, orden }, sobrantes: [sobra], pendientes: r.ent(8, 36), ip };
      const swapNom = 'sda' + (orden.indexOf('swap') + 1);
      const tareas = [
        respuesta({ html: `${u('Escribe')} el tamaño de la partición montada en ${b('/home')}.`, corta: 'El tamaño de la partición de /home.', casillas: ['tamaño'],
          pista: 'Hay una orden que lista los discos y sus particiones, con el tamaño de cada una y dónde está montada.',
          pistaOrden: 'La orden es «lsblk». Busca la línea que acaba en /home y mira la columna SIZE.', solucion: ['lsblk'], esperado: (e) => [e.sis.disco.particiones.find((p) => p.clave === 'home').tam],
          deSalida: (s) => [lineasDe(s[0]).find((l) => /\s\/home$/.test(l)).trim().split(/\s+/)[3]] }),
        respuesta({ html: `${u('Escribe')} el nombre de la partición de intercambio.`, corta: 'El nombre de la partición de intercambio.', casillas: ['partición'],
          pista: 'La partición de intercambio sale en la misma lista de discos y particiones, marcada con [SWAP].',
          pistaOrden: 'La orden es «lsblk». El nombre es el de la línea que pone [SWAP].', solucion: ['lsblk'], esperado: () => [swapNom], acepta: () => [[swapNom, '/dev/' + swapNom, swapNom + ' [SWAP]']],
          deSalida: (s) => [lineasDe(s[0]).find((l) => /\[SWAP\]/.test(l)).replace(/^[^a-z]*/, '').split(/\s+/)[0]] }),
        respuesta({ html: `${u('Escribe')} la dirección IP de la máquina.`, corta: 'La dirección IP.', casillas: ['IP'],
          pista: 'Hay una orden de dos letras que enseña la configuración de la red. La IP de la tarjeta enp0s3 está en su línea inet.',
          pistaOrden: 'La orden es «ip a». La IP es la de la línea inet de enp0s3, sin el /24.', solucion: ['ip a'], esperado: () => [ip], acepta: () => [[ip, ip + '/24']],
          deSalida: (s) => [(s[0].match(/inet (10\.\S+)\/24/) || [])[1]] }),
        estado({ html: `${u('Actualiza')} la lista de paquetes.`, corta: 'Actualizar la lista de paquetes.', fija: true,
          pista: 'Los paquetes se manejan con apt, y para administrar el sistema hace falta sudo delante. apt tiene una acción que actualiza la lista.',
          pistaOrden: 'La orden es «sudo apt update». La contraseña es la tuya del simulador.', solucion: [{ orden: 'sudo apt update', respuestas: ['alumno'] }],
          comprueba: (e) => !!e.sis.listasAlDia }),
        estado({ html: `${u('Instala')} las actualizaciones pendientes.`, corta: 'Instalar las actualizaciones pendientes.',
          pista: 'Con la lista al día, apt tiene otra acción que instala las versiones nuevas. Antes de hacerlo, te pregunta si quieres seguir.',
          pistaOrden: 'La orden es «sudo apt upgrade». A la pregunta, pulsa Intro (o escribe s).', solucion: [{ orden: 'sudo apt upgrade', respuestas: [''] }],
          comprueba: (e) => !!e.sis.listasAlDia && e.sis.actualizables.length === 0 }),
        estado({ html: `${u('Quita')} el paquete ${b(sobra)}.`, corta: `Quitar ${sobra}.`,
          pista: 'apt también desinstala paquetes. La acción se llama como «quitar» en inglés.',
          pistaOrden: `La orden es «sudo apt remove ${sobra}». A la pregunta, pulsa Intro.`, solucion: [{ orden: `sudo apt remove ${sobra}`, respuestas: [''] }],
          comprueba: (e) => !e.sis.paquetes[sobra].esta })
      ];
      return { titulo: this.titulo, escenario, tareas, tarea: `⟪Averigua⟫ el tamaño de ⟦/home⟧, la partición de intercambio y la IP; ⟪actualiza⟫ el sistema y ⟪quita⟫ ⟦${sobra}⟧.`, variante: sobra, variantes: 3 };
    }
  };

  /* ================= M5 · Prepara el arranque ================= */
  // teclas de nano para cambiar un texto por otro: buscar (F6: Ctrl+W en el navegador cierra la pestaña), borrarlo con
  // Supr y escribir el nuevo
  const cambia = (antes, despues) => ['F6'].concat(antes.split(''), ['Enter'], Array(antes.length).fill('Delete'), despues.split(''));
  const linuxUbuntu = (cfg) => (cfg.match(/menuentry 'Ubuntu' [\s\S]*?\n\tlinux\t([^\n]*)/) || [])[1] || '';
  M['ut4-m5'] = {
    titulo: 'Prepara el arranque', ut: 'UT4', sudo: true, vista: 'arranque',   // en la diapositiva, con data-vista="arranque"
    generar(semilla) {
      const r = U.azar(semilla);
      const n = r.ent(3, 15);
      const mensajes = r.r() < 0.5;
      const cfg = (e) => e.sis.leeArchivo('/boot/grub/grub.cfg') || '';
      const tareas = [
        estado({ html: `${u('Haz')} que el menú de GRUB se vea al arrancar.`, corta: 'Que se vea el menú de GRUB.',
          pista: 'La configuración de GRUB está en el archivo /etc/default/grub. Para que el menú se vea, la línea GRUB_TIMEOUT_STYLE no puede decir hidden.',
          pistaOrden: 'Abre el archivo con «sudo nano /etc/default/grub», deja la línea GRUB_TIMEOUT_STYLE=menu, guarda con Ctrl + O y sal con Ctrl + X. Después, «sudo update-grub».',
          solucion: [], comprueba: (e) => /set timeout_style=menu/.test(cfg(e)) }),
        estado({ html: `${u('Haz')} que espere ${n} segundos.`, corta: `Que espere ${n} segundos.`,
          pista: 'En el mismo archivo, la línea GRUB_TIMEOUT dice cuántos segundos espera el menú.',
          pistaOrden: `En /etc/default/grub, deja la línea GRUB_TIMEOUT=${n}. Después, «sudo update-grub».`,
          solucion: [], comprueba: (e) => new RegExp(`set timeout_style=\\w+\\n    set timeout=${n}\\n`).test(cfg(e)) }),
        estado({ html: `${u('Haz')} que ${mensajes ? 'se vean los mensajes del arranque' : 'arranque sin el logotipo'}.`, corta: mensajes ? 'Que se vean los mensajes del arranque.' : 'Arrancar sin el logotipo.',
          pista: 'Los mensajes y el logotipo dependen de dos palabras de la línea GRUB_CMDLINE_LINUX_DEFAULT: quiet esconde los mensajes y splash enseña el logotipo.',
          pistaOrden: mensajes ? 'Deja la línea así: GRUB_CMDLINE_LINUX_DEFAULT="" (sin quiet ni splash, pero con las comillas). Después, «sudo update-grub».' : 'Deja la línea así: GRUB_CMDLINE_LINUX_DEFAULT="quiet" (sin splash). Después, «sudo update-grub».',
          solucion: [], comprueba: (e) => { const l = linuxUbuntu(cfg(e)); return !!l && !/\bsplash\b/.test(l) && (!mensajes || !/\bquiet\b/.test(l)); } }),
        estado({ html: `${u('Genera')} el menú nuevo.`, corta: 'Generar el menú nuevo.',
          pista: 'Lo que cambias en /etc/default/grub no cuenta hasta que se fabrica otra vez el menú, el archivo /boot/grub/grub.cfg. Hay una orden que lo hace.',
          pistaOrden: 'La orden es «sudo update-grub».',
          solucion: [], comprueba: (e) => { const g = e.sis.stat('/boot/grub/grub.cfg'), d = e.sis.stat('/etc/default/grub'); return !!g && !!d && d.mtime >= e.sis.t0 && g.mtime >= d.mtime; } })
      ];
      // la solución entera: editar con nano (tres cambios), guardar, salir y update-grub
      const teclas = cambia('GRUB_TIMEOUT_STYLE=hidden', 'GRUB_TIMEOUT_STYLE=menu').concat(cambia('GRUB_TIMEOUT=0', `GRUB_TIMEOUT=${n}`),
        cambia('"quiet splash"', mensajes ? '""' : '"quiet"'), ['Ctrl+O', 'Enter', 'Ctrl+X']);
      tareas[0].solucion = [{ orden: 'sudo nano /etc/default/grub', respuestas: ['alumno'], teclas }, 'sudo update-grub'];
      /* Columnas que necesita la terminal: las líneas de /etc/default/grub que se editan, antes y después del cambio,
       * enteras en nano con el cursor detrás (n + 3: nano desplaza la línea cuando el cursor llega a la penúltima
       * columna), y la orden con la que se abre, detrás del prompt. */
      const grub = String((L.datos.archivos || {})['/etc/default/grub'] || '').split('\n').filter((l) => /^GRUB_(TIMEOUT_STYLE|TIMEOUT|CMDLINE_LINUX_DEFAULT)=/.test(l));
      const editadas = grub.concat(['GRUB_TIMEOUT_STYLE=menu', `GRUB_TIMEOUT=${n}`, `GRUB_CMDLINE_LINUX_DEFAULT=${mensajes ? '""' : '"quiet"'}`]);
      const columnas = Math.max(...editadas.map((l) => [...l].length + 3), 'alumno@som:~$ sudo nano /etc/default/grub'.length + 1);
      return { titulo: this.titulo, escenario: {}, tareas, columnas, tarea: `⟪Cambia⟫ ⟦/etc/default/grub⟧ para que el menú se vea, espere ⟦${n}⟧ segundos y ${mensajes ? 'se vean los mensajes' : 'no salga el logotipo'}; ⟪genera⟫ el menú.`, variante: mensajes ? 'mensajes' : 'logotipo', variantes: 2 };
    }
  };

  /* ================= M6 · Quién, cuándo y dónde ================= */
  const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  M['ut4-m6'] = {
    titulo: 'Quién, cuándo y dónde', ut: 'UT4', sudo: true,
    generar(semilla) {
      const r = U.azar(semilla);
      const otro = r.elige(['ana', 'luis', 'marta']);
      const tty = r.elige(['tty3', 'tty4', 'tty5', 'tty6']);
      const suOrden = r.elige(['top', 'nano informe.txt', 'man ls']);
      const anio = r.ent(2026, 2027), mes = r.ent(0, 11), dia = r.ent(1, 28);
      const fecha = Date.UTC(anio, mes, dia, 8 + r.ent(0, 9), r.ent(0, 59));
      const otroAnio = r.ent(2026, 2028), otroMes = r.ent(1, 12), otroDia = r.ent(1, 28);
      const semana = DIAS_SEMANA[new Date(Date.UTC(otroAnio, otroMes - 1, otroDia)).getUTCDay()];
      const [formato, nombreFormato] = r.elige([['%d/%m/%Y', 'día/mes/año'], ['%Y-%m-%d', 'año-mes-día'], ['%B', 'el nombre del mes']]);
      const prog = r.elige(['uname', 'date', 'touch', 'top']);
      const escenario = { fecha, sesiones: [{ usuario: otro, tty, orden: suOrden }] };
      const mesNombre = U.MESES[otroMes - 1];
      const tareas = [
        respuesta({ html: `${u('Escribe')} tu número de usuario.`, corta: 'Tu número de usuario.', casillas: ['número'],
          pista: 'Hay una orden de dos letras que enseña tu número de usuario (uid) y tus grupos.',
          pistaOrden: 'La orden es «id». El número es el que va detrás de uid=.', solucion: ['id'],
          esperado: () => ['1000'], deSalida: (s) => [(s[0].match(/uid=(\d+)/) || [])[1]] }),
        respuesta({ html: `${u('Escribe')} en qué terminal ha iniciado sesión ${b(otro)}.`, corta: `La terminal de ${otro}.`, casillas: ['terminal'],
          pista: 'Una orden muy corta enseña quién ha iniciado sesión en el equipo y en qué terminal. Se llama como «quién» en inglés.',
          pistaOrden: 'La orden es «who». La terminal es la segunda columna.', solucion: ['who'],
          esperado: () => [tty], acepta: () => [[tty, '/dev/' + tty]], deSalida: (s) => [lineasDe(s[0]).find((l) => l.startsWith(otro + ' ')).split(/\s+/)[1]] }),
        respuesta({ html: `${u('Escribe')} qué orden está usando ${b(otro)}.`, corta: `La orden que usa ${otro}.`, casillas: ['orden'],
          pista: 'Hay una orden de una sola letra que, además de quién está conectado, enseña qué está haciendo cada uno.',
          pistaOrden: 'La orden es «w». Mira la última columna, WHAT.', solucion: ['w'],
          esperado: () => [suOrden.split(' ')[0]], acepta: () => [[suOrden.split(' ')[0], suOrden]], deSalida: (s) => [lineasDe(s[0]).find((l) => l.startsWith(otro + ' ')).trim().split(/\s+/).slice(7).join(' ')] }),
        estado({ html: `${u('Instala')} la orden ${b('cal')}.`, corta: 'Instalar cal.',
          pista: 'Escribe cal: como no está instalada, la terminal te dice en qué paquete está y cómo se instala.',
          pistaOrden: 'La orden es «sudo apt install ncal». La contraseña es la tuya del simulador.', solucion: [{ orden: 'sudo apt install ncal', respuestas: ['alumno'] }],
          comprueba: (e) => !!e.sis.paquetes.ncal.esta }),
        respuesta({ html: `${u('Escribe')} qué día de la semana cae el ${otroDia} de ${mesNombre} de ${otroAnio}.`, corta: `El día de la semana del ${otroDia}-${otroMes}-${otroAnio}.`, casillas: ['día'],
          pista: 'cal enseña el calendario de un mes. Si le das el mes y el año, enseña ese mes. Las columnas son los días de la semana: do lu ma mi ju vi sá.', solucion: [`cal ${otroMes} ${otroAnio}`], esperado: () => [semana], natural: true,
          acepta: () => [[semana, { domingo: 'do', lunes: 'lu', martes: 'ma', 'miércoles': 'mi', jueves: 'ju', viernes: 'vi', 'sábado': 'sá' }[semana]]],
          deSalida: (s) => {
            const ls = String(s[0]).replace(/\x1b\[[0-9;]*m|.\x08/g, '').split('\n');
            const cab = ls.findIndex((l) => /^\s*(do|lu)\s+(lu|ma)\s/.test(l));
            const nombres = ls[cab].trim().split(/\s+/);
            const largo = { do: 'domingo', lu: 'lunes', ma: 'martes', mi: 'miércoles', ju: 'jueves', vi: 'viernes', 'sá': 'sábado', sa: 'sábado' };
            for (const l of ls.slice(cab + 1)) for (let col = 0; col < 7; col++) if (l.substr(col * 3, 2).trim() === String(otroDia)) return [largo[nombres[col]]];
            return ['?'];
          } }),
        respuesta({ html: formato === '%B' ? `${u('Escribe')} el nombre completo del mes actual, como lo escribe ${b('date')} (no la abreviatura).` : `${u('Escribe')} la fecha de hoy con el formato ${nombreFormato}.`,
          corta: formato === '%B' ? 'El nombre completo del mes actual.' : `La fecha de hoy: ${nombreFormato}.`, casillas: ['fecha'], natural: formato === '%B',
          // la misma fecha sin los ceros de delante también vale; con otro formato, lo dice
          acepta: (e) => { const h = new Date(e.sis.ahora()), d = String(h.getUTCDate()), m = String(h.getUTCMonth() + 1), y = String(h.getUTCFullYear()); return [[U.strftime(formato, e.sis.ahora())].concat(formato === '%d/%m/%Y' ? [`${d}/${m}/${y}`] : formato === '%Y-%m-%d' ? [`${y}-${m}-${d}`] : [])]; },
          avisa: (v, e) => { const h = new Date(e.sis.ahora()); const x = String(v[0]); if (formato === '%B') return /^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?$/i.test(x.trim()) ? 'esa es la abreviatura: se pide el nombre completo del mes.' : ''; return x.includes(String(h.getUTCFullYear())) && x.includes(String(h.getUTCDate())) ? `es la fecha de hoy, pero se pide con el formato ${nombreFormato}.` : ''; },
          pista: 'date escribe la fecha con el formato que le pidas, con un + delante. Los formatos están en date --help.', solucion: ['date +' + formato],
          esperado: (e) => [U.strftime(formato, e.sis.ahora())], deSalida: (s) => [s[0].trim()] }),
        respuesta({ html: `${u('Escribe')} la ruta del programa ${b(prog)} y dónde está su página del manual.`, corta: `Ruta de ${prog} y de su manual.`, casillas: ['programa', 'manual'],
          pista: 'Una orden dice qué programa se ejecuta cuando escribes una orden. Otra, cuyo nombre en inglés significa «¿dónde está?», dice además dónde está su manual.', solucion: ['which ' + prog, 'whereis ' + prog],
          esperado: () => ['/usr/bin/' + prog, `/usr/share/man/man1/${prog}.1.gz`], deSalida: (s) => [s[0].trim(), s[1].trim().split(' ')[2]] })
      ];
      return { titulo: this.titulo, escenario, tareas, tarea: `⟪Averigua⟫ tu uid, la terminal y la orden de ⟦${otro}⟧, el día de la semana del ⟦${otroDia}-${otroMes}-${otroAnio}⟧, la fecha en formato ${nombreFormato} y dónde están ⟦${prog}⟧ y su manual; ⟪instala⟫ ⟦cal⟧.`, variante: suOrden, variantes: 3 };
    }
  };

  /* ================= M7 · Archivos y carpetas ================= */
  const PALABRAS = ['sol', 'mar', 'pan', 'luz', 'tren', 'nube', 'flor', 'río', 'casa', 'libro', 'reloj', 'mesa', 'llave', 'faro', 'puente'];
  M['ut4-m7'] = {
    titulo: 'Archivos y carpetas', ut: 'UT4',
    generar(semilla) {
      const r = U.azar(semilla);
      const nombre = r.elige(['informe', 'notas', 'pendiente', 'compras', 'ideas']);
      const reciente = r.r() < 0.5;
      const ocultos = r.baraja(['.recordatorio', '.notas_viejas', '.lista_secreta', '.borrador', '.config_juego']).slice(0, 3);
      const fechas = ['2023-02-14 10:00', '2023-09-01 18:30', '2026-11-20 20:15'];
      const archivos = {};
      ocultos.forEach((o, i) => { archivos['~/' + o] = { datos: 'oculto ' + i + '\n', mtime: fechas[i] }; });
      const nl = r.ent(8, 20);
      const texto = r.elige(['lista.txt', 'tareas.txt', 'apuntes.txt']);
      archivos['~/' + texto] = Array.from({ length: nl }, (_, i) => `Elemento ${i + 1} de la lista`).join('\n') + '\n';
      const largo = r.elige(['largo.txt', 'manual.txt', 'cuento.txt']);
      const ultima = r.elige(PALABRAS);
      archivos['~/' + largo] = Array.from({ length: 140 }, (_, i) => `Línea ${i + 1}: un texto largo para leer por páginas con more.`).join('\n') + `\nY la última palabra es ${ultima}\n`;
      const carpeta = r.elige(['/etc', '/tmp', '/usr/share']);
      const objetivo = reciente ? ocultos[2] : ocultos[0];
      const tareas = [
        estado({ html: `${u('Crea')} en tu carpeta personal un archivo vacío llamado ${b(nombre + '.txt')}.`, corta: `Crear ${nombre}.txt vacío.`,
          pista: 'Hay una orden que crea un archivo vacío si no existe (y, si ya existe, le cambia la fecha).', solucion: [`touch ${nombre}.txt`],
          comprueba: (e) => e.esArchivo(`~/${nombre}.txt`) && e.lee(`~/${nombre}.txt`) === '' }),
        respuesta({ html: `${u('Escribe')} el nombre del archivo oculto ${reciente ? 'más reciente' : 'más antiguo'} de tu carpeta personal.`, corta: `El archivo oculto ${reciente ? 'más reciente' : 'más antiguo'}.`, casillas: ['archivo'],
          pista: `Junta varias opciones de ls: una para ver los archivos ocultos, otra para ver la fecha (el formato largo) y otra para ordenar por fecha${reciente ? '' : ', y otra más para darle la vuelta al orden'}.`,
          solucion: [reciente ? 'ls -alt' : 'ls -altr'], esperado: () => [objetivo],
          deSalida: (s) => [lineasDe(s[0]).filter((l) => /^-/.test(l)).map((l) => l.split(/\s+/).pop()).find((n) => n.startsWith('.') && ocultos.concat(['.bashrc', '.profile', '.bash_logout']).includes(n))] }),
        respuesta({ html: `${u('Escribe')} cuántas líneas tiene ${b(texto)}.`, corta: `Cuántas líneas tiene ${texto}.`, casillas: ['líneas'],
          pista: 'cat enseña un archivo y tiene una opción que numera las líneas: el último número es el total.', solucion: [`cat -n ${texto}`],
          esperado: () => [String(nl)], deSalida: (s) => [lineasDe(s[0]).pop().trim().split(/\s+/)[0]] }),
        respuesta({ html: `${u('Escribe')} la última palabra de ${b(largo)}.`, corta: `La última palabra de ${largo}.`, casillas: ['palabra'],
          pista: 'El archivo es largo y no cabe en la pantalla. Usa una orden que lo enseñe página a página.',
          pistaOrden: `Escribe «more ${largo}» y ve pasando páginas con la barra espaciadora hasta el final.`, solucion: [{ orden: `more ${largo}`, teclas: Array(24).fill(' ') }],
          esperado: () => [ultima], deSalida: (s) => [(s[0].match(/Y la última palabra es (\S+)/) || [])[1]] }),
        respuesta({ html: `${u('Escribe')} cuántas tareas hay en total según ${b('top')}.`, corta: 'Cuántas tareas dice top.', casillas: ['tareas'],
          pista: 'top enseña los programas en marcha. El total de tareas está en la segunda línea, la que empieza por «Tareas».',
          pistaOrden: 'Escribe «top», lee la segunda línea y sal con q.', solucion: [{ orden: 'top', teclas: ['q'] }],
          esperado: (e) => [String(e.sis._procs.length + 1)], acepta: (e) => [[String(e.sis._procs.length + 1), String(e.sis._procs.length)]], deSalida: (s) => [(s[0].replace(/\x1b\[[0-9;]*m/g, '').match(/Tareas:\s+(\d+)/) || [])[1]] }),
        estado({ html: `${u('Deja')} la terminal en la carpeta ${b(carpeta)}.`, corta: `Terminar en ${carpeta}.`,
          pista: 'Necesitas la orden que cambia de carpeta, con la ruta completa de la carpeta detrás.', solucion: [`cd ${carpeta}`],
          comprueba: (e) => e.cwd === carpeta })
      ];
      /* Columnas que necesita la terminal para leer lo que piden las tareas sin que la línea se parta: la línea de
       * ls -l de cada archivo oculto (permisos, enlaces de 2 cifras, alumno alumno, tamaño, fecha y nombre), la
       * última de cat -n (el número ocupa 6 y el tabulador llega a la columna 8) y la última de more. */
      const bytes = (t) => new TextEncoder().encode(t).length;
      const anchoTam = String(Math.max(4096, bytes(archivos['~/' + texto]), bytes(archivos['~/' + largo]))).length;
      const nombres = ocultos.concat(['.bashrc', '.profile', '.bash_logout']);
      const columnas = Math.max(...nombres.map((o) => 10 + 1 + 2 + 1 + 6 + 1 + 6 + 1 + anchoTam + 1 + 12 + 1 + o.length),
        8 + `Elemento ${nl} de la lista`.length, `Y la última palabra es ${ultima}`.length);
      return { titulo: this.titulo, escenario: { archivos }, tareas, columnas, tarea: `⟪Crea⟫ ⟦${nombre}.txt⟧, ⟪averigua⟫ el oculto más ${reciente ? 'reciente' : 'antiguo'}, las líneas de ⟦${texto}⟧, la última palabra de ⟦${largo}⟧ y las tareas de ⟦top⟧, y ⟪acaba⟫ en ⟦${carpeta}⟧.`, variante: carpeta, variantes: 3 };
    }
  };

  /* ================= M8 · Tu terminal a tu gusto ================= */
  const ALIAS_M8 = [
    ['enseñe la fecha y tu usuario', ['hoy', 'quien', 'yo'], 'date; whoami', (o) => o.length === 2 && o.some((x) => x[0] === 'date') && o.some((x) => x[0] === 'whoami' || (x[0] === 'echo' && /^\$\{?(USER|LOGNAME)\}?$/.test(x[1] || '')))],
    ['enseñe también los archivos ocultos en formato largo', ['todo', 'largo', 'lso'], 'ls -la', (o) => o.length === 1 && o[0][0] === 'ls' && o[0].slice(1).some((x) => /^-[a-zA-Z]*[aA]/.test(x) || x === '--all' || x === '--almost-all') && o[0].slice(1).some((x) => /^-[a-zA-Z]*l/.test(x))],
    ['limpie la pantalla y enseñe dónde estás', ['donde', 'aqui', 'sitio'], 'clear; pwd', (o) => o.length === 2 && o[0][0] === 'clear' && (o[1][0] === 'pwd' || (o[1][0] === 'echo' && /^\$\{?PWD\}?$/.test(o[1][1] || '')))]
  ];
  M['ut4-m8'] = {
    titulo: 'Tu terminal a tu gusto', ut: 'UT4',
    generar(semilla) {
      const r = U.azar(semilla);
      const variable = r.elige(['HOME', 'LANG', 'USER', 'LOGNAME']);
      const [que, nombres, solA, valida] = r.elige(ALIAS_M8);
      const nombre = r.elige(nombres);
      const borra = r.elige(['la', 'l', 'll']);
      const texto = r.elige(['som>', 'linux$', 'yo:', 'aula>']);
      const nueva = r.elige(['ubuntu2026', 'pinguino24', 'terminal99', 'claveNueva7']);
      const valores = { HOME: '/home/alumno', LANG: 'es_ES.UTF-8', USER: 'alumno', LOGNAME: 'alumno' };
      const tareas = [
        respuesta({ html: `${u('Escribe')} la primera carpeta de la variable ${b('PATH')}.`, corta: 'La primera carpeta de PATH.', casillas: ['carpeta'],
          pista: 'La variable PATH guarda una lista de carpetas separadas por dos puntos (:). Enséñala como cualquier otra variable.', solucion: ['echo $PATH'],
          esperado: () => ['/usr/local/sbin'], deSalida: (s) => [s[0].trim().split(':')[0]] }),
        respuesta({ html: `${u('Escribe')} el valor de la variable ${b(variable)}.`, corta: `El valor de ${variable}.`, casillas: ['valor'],
          pista: 'Hay una orden que enseña todas las variables de la sesión. Con una tubería y grep te quedas solo con la línea que buscas.', solucion: ['env | grep ' + variable],
          esperado: () => [valores[variable]], acepta: () => [[valores[variable], variable + '=' + valores[variable]]], deSalida: (s) => [(lineasDe(s[0].replace(/\x1b\[[0-9;]*m|\x1b\[K/g, '')).find((l) => l.startsWith(variable + '=')) || '').split('=').slice(1).join('=')] }),
        estado({ html: `${u('Crea')} un alias llamado ${b(nombre)} que ${que}.`, corta: `Alias ${nombre}: ${que}.`, fija: true,
          pista: 'Un alias se escribe así: alias nombre=\'lo que hace\'. Las comillas simples hacen falta porque lleva espacios.', solucion: [`alias ${nombre}='${solA}'`],
          comprueba: (e) => { const v = e.sh.alias.get(nombre); if (!v) return false; try { return valida(ordenesDe(L.analiza(v))); } catch (x) { return false; } } }),
        estado({ html: `${u('Borra')} el alias ${b(borra)}.`, corta: `Borrar el alias ${borra}.`, fija: true,
          pista: 'La orden que borra un alias se llama como alias, con «un» delante.', solucion: ['unalias ' + borra], comprueba: (e) => !e.sh.alias.has(borra) }),
        estado({ html: `${u('Cambia')} el prompt para que sea ${b(texto)} seguido de un espacio.`, corta: `Prompt «${texto} ».`, fija: true,
          pista: 'El prompt se guarda en la variable PS1. Dale un valor nuevo entre comillas, sin espacios alrededor del =.', solucion: [`PS1="${texto} "`], comprueba: (e) => e.sh.valor('PS1') === texto + ' ' }),
        estado({ html: `${u('Cambia')} tu contraseña por ${b(nueva)}.`, corta: `Contraseña nueva: ${nueva}.`,
          pista: 'Hay una orden que cambia tu contraseña. Primero pide la actual (alumno) y después dos veces la nueva. No se ve lo que escribes.',
          pistaOrden: 'La orden es «passwd». Escribe alumno e Intro, y después dos veces la nueva, con Intro detrás de cada una.',
          solucion: [{ orden: 'passwd', respuestas: ['alumno', nueva, nueva] }], comprueba: (e) => e.sis.compruebaClave(e.sis.esc.usuario, nueva) }),
        estado({ html: `${u('Sal')} de la terminal con la orden que cierra la sesión.`, corta: 'Salir de la terminal.', fija: true,
          pista: 'La orden que termina la sesión de bash es una palabra inglesa que significa «salir». También vale Ctrl + D con la línea vacía.', solucion: ['exit'],
          // solo con exit (o Ctrl+D, que ejecuta exit): cerrar la ventana con el botón no vale
          comprueba: (e) => (e.registro || []).some((x) => x.tipo === 'salir' && !x.ventana) })
      ];
      return { titulo: this.titulo, escenario: {}, tareas, tarea: `⟪Averigua⟫ la primera carpeta de ⟦PATH⟧ y el valor de ⟦${variable}⟧; ⟪crea⟫ el alias ⟦${nombre}⟧, ⟪borra⟫ ⟦${borra}⟧, ⟪cambia⟫ el prompt a ⟦${texto} ⟧ y la contraseña a ⟦${nueva}⟧, y ⟪sal⟫.`, variante: nombre, variantes: 9 };
    }
  };

  /* ================= Repaso de la UT4: seis tareas cortas de tipos distintos ================= */
  // cada entrada: [tipo, generador(r) -> tarea]; de cada semilla salen 6 de tipos distintos
  const BANCO = [
    ['ir', () => ({ t: estado({ html: `${u('Ve')} a la carpeta ${b('/usr/share')}.`, corta: 'Ir a /usr/share.', fija: true, pista: 'Usa la orden que cambia de carpeta, con la ruta completa detrás.', solucion: ['cd /usr/share'], comprueba: (e) => e.cwd === '/usr/share' }) })],
    ['ir', () => ({ t: estado({ html: `${u('Ve')} a la carpeta raíz.`, corta: 'Ir a la raíz.', fija: true, pista: 'Usa la orden que cambia de carpeta. La carpeta raíz se escribe con una sola barra.', solucion: ['cd /'], comprueba: (e) => e.cwd === '/' }) })],
    ['ir', () => ({ t: estado({ html: `${u('Ve')} a la carpeta ${b('Documentos')} de tu carpeta personal.`, corta: 'Ir a Documentos.', fija: true, pista: 'Tu carpeta personal se escribe ~. La ruta es ~, una barra y el nombre de la carpeta.', solucion: ['cd ~/Documentos'], comprueba: (e) => e.cwd === e.home + '/Documentos' }) })],
    ['crear', (r) => { const n = r.elige(['hola', 'prueba', 'datos', 'tarea']) + '.txt'; return { t: estado({ html: `${u('Crea')} el archivo vacío ${b(n)} en tu carpeta personal.`, corta: `Crear ${n}.`, pista: 'Hay una orden que crea un archivo vacío. Tu carpeta personal se escribe ~.', solucion: ['touch ~/' + n], comprueba: (e) => e.esArchivo('~/' + n) }) }; }],
    ['crear', (r) => { const n = r.elige(['nota', 'aviso', 'leeme']) + '.txt'; return { t: estado({ html: `${u('Crea')} el archivo vacío ${b(n)} dentro de ${b('Escritorio')}.`, corta: `Crear Escritorio/${n}.`, pista: 'Usa la orden que crea un archivo vacío, con la ruta de la carpeta Escritorio delante del nombre.', solucion: [`touch ~/Escritorio/${n}`], comprueba: (e) => e.esArchivo('~/Escritorio/' + n) }) }; }],
    ['ayuda', () => ({ t: respuesta({ html: `${u('Escribe')} la opción de ${b('ls')} que ordena por tamaño.`, corta: 'Opción de ls que ordena por tamaño.', casillas: ['opción'], pista: 'Búscala en ls --help. Esa línea de la ayuda está en inglés: busca la palabra «size».', pistaOrden: 'La orden es «ls --help». La opción es la de la línea «sort by file size».', solucion: ['ls --help'], esperado: () => ['-S'], acepta: () => [['-S', '--sort=size']], deSalida: (s) => [/-S\s+sort by file size/.test(s[0]) ? '-S' : '?'] }) })],
    ['ayuda', () => ({ t: respuesta({ html: `${u('Escribe')} la opción de ${b('uname')} que enseña la versión del núcleo (kernel release).`, corta: 'Opción de uname para la versión del núcleo.', casillas: ['opción'], pista: 'Las opciones de una orden están en su ayuda, la que sale con --help.', solucion: ['uname --help'], esperado: () => ['-r'], acepta: () => [['-r', '--kernel-release']], deSalida: (s) => [/-r, --kernel-release/.test(s[0]) ? '-r' : '?'] }) })],
    ['ayuda', () => ({ t: respuesta({ html: `${u('Escribe')} la opción de ${b('cat')} que numera las líneas.`, corta: 'Opción de cat que numera.', casillas: ['opción'], pista: 'Búscala en la ayuda de cat, la que sale con --help. En inglés, numerar es «number».', solucion: ['cat --help'], esperado: () => ['-n'], acepta: () => [['-n', '--number']], deSalida: (s) => [/-n, --number/.test(s[0]) ? '-n' : '?'] }) })],
    ['ayuda', () => ({ t: evento({ html: `${u('Abre')} el manual de ${b('date')} y ${u('sal')} con ${b('q')}.`, corta: 'man date y q.', pista: 'El manual de una orden se abre con man y el nombre de la orden.', pistaOrden: 'Escribe «man date» y, dentro, pulsa q.', solucion: [{ orden: 'man date', teclas: ['q'] }], comprueba: (e) => (e.registro || []).some((x) => x.tipo === 'ayuda' && x.programa === 'man' && x.tema === 'date') }) })],
    ['tipo', (r) => { const [o, t] = r.elige(TIPOS_ORDEN); return { t: respuesta({ html: `${u('Averigua')} si ${b(o)} es interna, alias o programa.`, corta: `¿${o}?`, selector: ['interna', 'alias', 'programa'], pista: 'Hay una orden de bash que dice de qué tipo es otra orden. Se llama como «tipo» en inglés.', solucion: ['type ' + o], esperado: () => [t], deSalida: (s) => [/orden interna/.test(s[0]) ? 'interna' : /alias/.test(s[0]) ? 'alias' : 'programa'] }) }; }],
    ['sistema', () => ({ t: respuesta({ html: `${u('Escribe')} la versión del núcleo.`, corta: 'Versión del núcleo.', casillas: ['versión'], pista: 'uname tiene una opción para la versión del núcleo. Si no la recuerdas, está en uname --help.', solucion: ['uname -r'], esperado: (e) => [e.sis.nucleo.version], deSalida: (s) => [s[0].trim()] }) })],
    ['sistema', () => ({ t: respuesta({ html: `${u('Escribe')} el nombre del equipo.`, corta: 'Nombre del equipo.', casillas: ['equipo'], pista: 'Sale en el prompt, detrás de la @. uname también lo escribe con una de sus opciones.', solucion: ['uname -n'], esperado: (e) => [e.sis.esc.equipo], deSalida: (s) => [s[0].trim()] }) })],
    ['sistema', () => ({ t: respuesta({ html: `${u('Escribe')} el tamaño del disco ${b('sda')}.`, corta: 'Tamaño de sda.', casillas: ['tamaño'], pista: 'Hay una orden que lista los discos y las particiones con su tamaño. Mira la línea de sda.', solucion: ['lsblk'], esperado: (e) => [e.sis.disco.tam + 'G'], deSalida: (s) => [lineasDe(s[0]).find((l) => /^sda /.test(l)).split(/\s+/)[3]] }) })],
    ['usuarios', () => ({ t: respuesta({ html: `${u('Escribe')} cuántos grupos tienes.`, corta: 'Cuántos grupos tienes.', casillas: ['grupos'], pista: 'La orden que enseña tu número de usuario enseña también tus grupos, detrás de «grupos=». Cuéntalos.', solucion: ['id'], esperado: (e) => [String(e.sh.grupos.length)], deSalida: (s) => [String(((s[0].match(/grupos=(\S+)/) || [])[1] || '').split(',').length)] }) })],
    ['usuarios', () => ({ t: respuesta({ html: `${u('Escribe')} tu nombre de usuario.`, corta: 'Tu usuario.', casillas: ['usuario'], pista: 'Sale en el prompt, antes de la @. También hay una orden que lo escribe: en inglés, «¿quién soy?».', solucion: ['whoami'], esperado: (e) => [e.sis.esc.usuario], deSalida: (s) => [s[0].trim()] }) })],
    ['fecha', () => ({ t: respuesta({ html: `${u('Escribe')} el día de la semana de hoy.`, corta: 'El día de la semana de hoy.', casillas: ['día'], pista: 'date escribe la fecha con el formato que le pidas, con un + delante. El del día de la semana está en date --help.', solucion: ['date +%A'], esperado: (e) => [U.strftime('%A', e.sis.ahora())], natural: true, deSalida: (s) => [s[0].trim()] }) })],
    ['fecha', () => ({ t: respuesta({ html: `${u('Escribe')} el número del mes actual (del 1 al 12).`, corta: 'El número del mes.', casillas: ['número'], pista: 'date escribe la fecha con el formato que le pidas, con un + delante. El del mes en número está en date --help.', solucion: ['date +%m'], esperado: (e) => [String(+U.strftime('%m', e.sis.ahora()))], acepta: (e) => [[String(+U.strftime('%m', e.sis.ahora())), U.strftime('%m', e.sis.ahora())]], deSalida: (s) => [String(+s[0].trim())] }) })],
    ['paquetes', () => ({ sudo: true, t: estado({ html: `${u('Instala')} la orden ${b('tree')}.`, corta: 'Instalar tree.', pista: 'Los programas se instalan con apt, con sudo delante. Aquí el paquete se llama igual que la orden.', pistaOrden: 'La orden es «sudo apt install tree». La contraseña es la tuya del simulador.', solucion: [{ orden: 'sudo apt install tree', respuestas: ['alumno'] }], comprueba: (e) => e.sis.paquetes.tree.esta }) })],
    ['paquetes', () => ({ sudo: true, t: estado({ html: `${u('Instala')} la orden ${b('cal')}.`, corta: 'Instalar cal.', pista: 'Escribe cal: como no está instalada, la terminal te dice en qué paquete está y cómo se instala.', pistaOrden: 'La orden es «sudo apt install ncal». La contraseña es la tuya del simulador.', solucion: [{ orden: 'sudo apt install ncal', respuestas: ['alumno'] }], comprueba: (e) => e.sis.paquetes.ncal.esta }) })],
    ['alias', (r) => { const n = r.elige(['fecha', 'dia', 'ahora']); return { t: estado({ html: `${u('Crea')} el alias ${b(n)} que ejecute ${b('date')}.`, corta: `alias ${n}=date.`, fija: true, pista: 'Un alias se escribe así: alias nombre=orden.', solucion: [`alias ${n}=date`], comprueba: (e) => (e.sh.alias.get(n) || '').trim() === 'date' }) }; }],
    ['alias', () => ({ t: estado({ html: `${u('Borra')} el alias ${b('ll')}.`, corta: 'Borrar el alias ll.', fija: true, pista: 'La orden que borra un alias se llama como alias, con «un» delante.', solucion: ['unalias ll'], comprueba: (e) => !e.sh.alias.has('ll') }) })],
    ['historial', () => ({ t: estado({ html: `${u('Borra')} el historial de órdenes.`, corta: 'Borrar el historial.', fija: true, pista: 'El historial se maneja con history. En su ayuda (help history) está la opción que lo borra.', solucion: ['history -c'], comprueba: (e) => borraHistorial(e) }) })],
    ['variables', () => ({ t: respuesta({ html: `${u('Escribe')} el valor de la variable ${b('SHELL')}.`, corta: 'El valor de SHELL.', casillas: ['valor'], pista: 'echo enseña lo que guarda una variable si escribes $ delante de su nombre.', solucion: ['echo $SHELL'], esperado: () => ['/bin/bash'], deSalida: (s) => [s[0].trim()] }) })],
    ['variables', () => ({ t: respuesta({ html: `${u('Escribe')} la última carpeta de ${b('PATH')}.`, corta: 'La última carpeta de PATH.', casillas: ['carpeta'], pista: 'PATH guarda carpetas separadas por dos puntos (:). Enséñala como cualquier otra variable y mira la última.', solucion: ['echo $PATH'], esperado: () => ['/snap/bin'], deSalida: (s) => [s[0].trim().split(':').pop()] }) })],
    ['buscar', (r) => { const o = r.elige(['grep', 'cut', 'sort']); return { t: respuesta({ html: `${u('Escribe')} la ruta del programa ${b(o)}.`, corta: `Ruta de ${o}.`, casillas: ['ruta'], pista: 'Hay una orden que dice qué programa se ejecuta cuando escribes una orden, con su ruta completa.', solucion: ['which ' + o], esperado: () => ['/usr/bin/' + o], deSalida: (s) => [s[0].trim()] }) }; }],
    ['buscar', () => ({ t: respuesta({ html: `${u('Escribe')} dónde está la página del manual de ${b('ls')}.`, corta: 'El manual de ls.', casillas: ['ruta'], pista: 'Hay una orden que busca un programa y también su página del manual. Su nombre en inglés significa «¿dónde está?».', solucion: ['whereis ls'], esperado: () => ['/usr/share/man/man1/ls.1.gz'], deSalida: (s) => [s[0].trim().split(' ')[2]] }) })],
    ['linea', () => ({ t: evento({ html: `${u('Ejecuta')} ${b('whoami')} y ${b('date')} en una sola línea.`, corta: 'whoami y date en una línea.', pista: 'Dos órdenes van en la misma línea si las separas con un punto y coma.', solucion: ['whoami; date'], comprueba: (e) => lineas(e).some((l) => /;/.test(l.texto) && ['whoami', 'date'].every((o) => ordenesDe(l.arbol).some((x) => x[0] === o))) }) })],
    ['teclas', () => ({ t: evento({ html: `${u('Lanza')} ${b('ping 10.0.2.2')} y ${u('páralo')} con ${b('Ctrl + C')}.`, corta: 'ping y Ctrl + C.', pista: 'ping no para solo: déjalo unos segundos y córtalo con la combinación de teclas que para una orden.', pistaOrden: 'Escribe «ping 10.0.2.2», espera unos segundos y pulsa Ctrl + C.', solucion: [{ orden: 'ping 10.0.2.2', ctrlC: 2 }], comprueba: (e) => (e.registro || []).some((x) => x.tipo === 'ping' && x.interrumpido && /^10\.0\.2\.2$/.test(x.destino)) && (e.registro || []).some((x) => x.tipo === 'tecla' && x.tecla === 'Ctrl+C' && x.orden === 'ping') }) })],
    ['grub', () => ({ t: respuesta({ html: `${u('Escribe')} cuántos segundos espera el menú de GRUB según ${b('/etc/default/grub')}.`, corta: 'GRUB_TIMEOUT.', casillas: ['segundos'], pista: 'Enseña lo que hay dentro del archivo y busca la línea GRUB_TIMEOUT=.', solucion: ['cat /etc/default/grub'], esperado: () => ['0'], deSalida: (s) => [(s[0].replace(/\x1b\[[0-9;]*m|\x1b\[K/g, '').match(/GRUB_TIMEOUT=(\d+)/) || [])[1]] }) })]
  ];
  M['ut4-repaso'] = {
    titulo: 'Repaso de la UT4', ut: 'UT4',
    generar(semilla) {
      const r = U.azar(semilla);
      const tipos = [...new Set(BANCO.map((x) => x[0]))];
      const elegidos = r.baraja(tipos).slice(0, 6);
      let sudo = false;
      const tareas = elegidos.map((tp) => { const op = BANCO.filter((x) => x[0] === tp); const g = r.elige(op)[1](r); if (g.sudo) sudo = true; return g.t; });
      return { titulo: this.titulo, escenario: {}, tareas, sudo, tarea: '⟪Haz⟫ las seis tareas: ' + tareas.map((t) => t.corta).join(' · '), variante: elegidos.slice().sort().join(','), variantes: 50 };
    }
  };
  L.bancoRepasoUT4 = BANCO;

  // la solución entera de una misión, en el orden de sus tareas
  Object.keys(M).filter((k) => k.startsWith('ut4-')).forEach((k) => {
    const g = M[k].generar;
    M[k].generar = function (semilla) {
      const m = g.call(this, semilla);
      m.solucion = m.tareas.flatMap((t) => t.solucion);
      m.sudo = !!(m.sudo || M[k].sudo);
      m.vista = M[k].vista;
      return m;
    };
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof window !== 'undefined' ? window : globalThis);
