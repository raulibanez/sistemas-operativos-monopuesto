/* Hoja de comandos de Linux (UT4 a UT7) · Sistemas Operativos Monopuesto · © Raúl Ibáñez, CC BY-SA 4.0
 *
 * Datos de la hoja y código que la pinta. Cada unidad tiene grupos y cada grupo, fichas.
 * Una orden tiene una sola ficha, en la unidad donde se presenta; lo que le añaden las unidades
 * siguientes lleva su número de unidad y solo sale cuando el selector llega a ella.
 * Campos de una ficha:
 *   n     nombre (o varios separados por « · »)
 *   f     forma de escribirla (sinopsis): [ ] opcional, ... se repite, MAYÚSCULAS = dato tuyo
 *   m     1 = de memoria; 0 = de consulta
 *   int   1 = orden interna de bash (su ayuda está en help)
 *   inst  paquete que hay que instalar (no viene en Ubuntu 24.04)
 *   d     qué hace
 *   o     opciones: [opción, frase, unidad] o { h: 'subtítulo', ut: unidad }; sin unidad, la de la ficha
 *   e     ejemplos: [orden, qué hace, unidad]
 *   c     bloque de código (scripts, órdenes en varias líneas); cn, su nombre de archivo
 *   nota  aviso corto
 *   x     lo que cambia en una unidad posterior: { ut, d (otra frase), f (otra forma), m (otra marca), nota, c, cn }
 *   k     palabras extra para el buscador
 * En los textos, ‹así› se escribe en monoespaciada. */
'use strict';

// Última unidad publicada: las siguientes salen en el selector como «en preparación» y no se pintan.
const PUBLICADO_HASTA = 'ut4';

const HOJA = [
/* ============================================================ UT4 */
{ ut: 4, t: 'Instalación de Ubuntu: primeras órdenes', g: [

{ g: 'La línea de órdenes', f: [
  { n: 'Partes de una orden', m: 1, k: 'opción argumento sintaxis',
    d: 'Una orden tiene tres partes, separadas por espacios: la orden (qué hacer), las opciones (cómo hacerlo) y los argumentos (sobre qué).',
    o: [
      ['-a', 'Opción corta: un guion y una letra.'],
      ['--all', 'Opción larga: dos guiones y una palabra.'],
      ['-la', 'Varias opciones cortas se juntan: ‹ls -la› es lo mismo que ‹ls -l -a›.'],
      ['ORDEN ; ORDEN', 'El punto y coma separa dos órdenes escritas en la misma línea.'],
    ],
    e: [['ls -l /etc', 'ls es la orden, -l la opción y /etc el argumento.']],
    nota: 'Mayúsculas y minúsculas cuentan: ‹LS› no es ‹ls›.' },
  { n: 'Teclas de la terminal', m: 1, k: 'atajos tabulador historial cortar copiar pegar autocompletar',
    d: 'Estas teclas ahorran trabajo y evitan errores al escribir.',
    o: [
      ['Tab', 'Completa el nombre de una orden, de una carpeta o de un archivo.'],
      ['Tab Tab', 'Enseña todas las posibilidades cuando hay varias.'],
      ['↑ ↓', 'Recuperan las órdenes que ya escribiste.'],
      ['Ctrl+C', 'Corta la orden que está en marcha. En la terminal no copia.'],
      ['Ctrl+L', 'Limpia la pantalla.'],
      ['Ctrl+Mayús+C', 'Copia lo seleccionado.'],
      ['Ctrl+Mayús+V', 'Pega en la línea.'],
      ['Ctrl+Alt+T', 'Abre una terminal en el escritorio de Ubuntu.'],
    ],
    e: [['clear; pwd', 'Limpia la pantalla y después enseña la carpeta actual.']] },
]},

{ g: 'Pedir ayuda', f: [
  { n: '--help', f: 'ORDEN --help', m: 1, k: 'ayuda sinopsis opciones modo de empleo buscar opción ayuda',
    d: 'Enseña un resumen de las opciones de una orden. La primera línea es la sinopsis: cómo se escribe la orden.',
    o: [
      { h: 'Cómo se lee la sinopsis' },
      ['[ ]', 'Lo de dentro es opcional.'],
      ['...', 'Se puede repetir.'],
      ['|', 'Una cosa o la otra.'],
      ['MAYÚSCULAS', 'Se cambian por un dato tuyo.'],
      ['--help | grep PALABRA', 'Solo las líneas de la ayuda con esa palabra.', 5],
      ['/PALABRA en man', 'Busca dentro del manual; n salta a la siguiente.', 5],
    ],
    e: [['uname --help', 'La ayuda de uname. Empieza por «Modo de empleo: uname [OPCIÓN]...».'], ['ls --help | grep size', 'Las líneas de la ayuda de ls que hablan del tamaño, entre ellas la de -S.', 5]],
    nota: 'Algunas órdenes aceptan también ‹-h›, pero no todas: en ‹ls›, ‹-h› significa otra cosa.',
    x: [
      { ut: 5, d: 'Para encontrar una opción enseguida, se busca una palabra dentro de la ayuda.', nota: 'Parte de la ayuda de Ubuntu está sin traducir: si no sale nada en español, se prueba en inglés.' },
    ] },
  { n: 'man', f: 'man [SECCIÓN] ORDEN', m: 1, k: 'manual ayuda buscar apropos secciones manual formato archivo',
    d: 'Abre el manual completo de una orden: su nombre, su sinopsis, su descripción y después las opciones, una a una.',
    o: [
      ['↑ ↓ · espacio', 'Se mueve por la página.'],
      ['/palabra Intro', 'Busca la palabra.'],
      ['n', 'Salta al siguiente resultado.'],
      ['q', 'Sale del manual.'],
      ['h', 'Ayuda de las teclas del propio man.'],
      ['-k PALABRA', 'Busca la palabra en las descripciones de todos los manuales. Sirve cuando no sabes cómo se llama la orden. Es lo mismo que ‹apropos›.'],
      ['1', 'Órdenes de los usuarios.', 6],
      ['5', 'Formato de los archivos: ‹man 5 passwd› explica /etc/passwd.', 6],
      ['7', 'Temas generales: ‹man 7 signal›.', 6],
      ['8', 'Órdenes de administración.', 6],
    ],
    e: [['man -k hostname', 'Lista las páginas que hablan de hostname. Cada resultado lleva su sección entre paréntesis: hostname (1) es la orden.'], ['man 5 passwd', 'Explica el archivo /etc/passwd, campo a campo. ‹man passwd› explica la orden.', 6]],
    nota: 'Con el paquete ‹manpages-es›, muchas páginas salen en español y se busca en español (‹/tamaño›). Las que no están traducidas salen en inglés.',
    x: [
      { ut: 6, d: 'El manual está dividido en secciones. Si una página está en varias, se dice cuál con un número.' },
    ] },
  { n: 'help', f: 'help [ORDEN]', m: 1, int: 1, k: 'ayuda internas bash',
    d: 'Explica las órdenes internas de bash, las que son parte de la propia shell y no tienen página de manual. Sin nada detrás, las lista todas.',
    e: [['help cd', 'La ayuda de cd, que es una orden interna.']] },
  { n: 'type', f: 'type ORDEN', m: 0, int: 1, k: 'interna alias programa ruta',
    d: 'Dice qué es una orden: una orden interna de bash, un alias (un nombre corto para otra orden) o un programa, con su ruta.',
    e: [['type ls', 'Responde que ls es un alias de ‹ls --color=auto›.'], ['type cd', 'Responde que cd es una orden interna.']] },
  { n: 'info', f: 'info ORDEN', m: 0, k: 'manual gnu ayuda',
    d: 'Abre el manual de GNU de una orden. Es más largo que man y está dividido en apartados. Sale con q.',
    e: [['info ls', 'Abre el manual de GNU de ls.']] },
]},

{ g: 'Moverse por las carpetas', f: [
  { n: 'pwd', f: 'pwd', m: 1, k: 'carpeta actual directorio ruta dónde estoy',
    d: 'Enseña la ruta de la carpeta en la que estás.',
    e: [['pwd', 'En tu carpeta personal escribe /home/alumno.']] },
  { n: 'cd', f: 'cd [CARPETA]', m: 1, int: 1, k: 'cambiar carpeta directorio entrar subir',
    d: 'Cambia de carpeta. El prompt enseña después la carpeta nueva.',
    o: [
      ['cd /', 'Va a la raíz: la carpeta que lo contiene todo.'],
      ['cd ..', 'Sube a la carpeta de arriba.'],
      ['cd -', 'Vuelve a la carpeta anterior.'],
      ['cd ~ · cd', 'Vuelve a tu carpeta personal.'],
      ['cd .', 'El punto es la carpeta actual: te deja donde estás.'],
    ],
    e: [['cd /usr/share', 'Entra en una carpeta escribiendo su camino.']],
    nota: 'Entre ‹cd› y ‹..› va un espacio: ‹cd..› da error.' },
  { n: 'ls', f: 'ls [OPCIÓN]... [FICHERO]...', m: 1, k: 'listar contenido archivos carpeta ocultos listar ocultos tamaño inodo recursivo uid gid números',
    d: 'Lista lo que hay en una carpeta. Sin nada detrás, lista la carpeta actual; con una ruta, otra carpeta sin entrar en ella.',
    o: [
      ['-a', 'También los archivos ocultos, que empiezan por punto.'],
      ['-l', 'Formato largo: una línea por archivo, con tipo, permisos, enlaces, propietario, grupo, tamaño, fecha y nombre.'],
      ['-r', 'En orden inverso.'],
      ['-t', 'Por fecha, el más reciente primero.'],
      ['-A', 'Los ocultos, sin . ni ..', 5],
      ['-h', 'Los tamaños en K, M y G (con -l).', 5],
      ['-i', 'El número de inodo delante de cada archivo.', 5],
      ['-d', 'La carpeta misma, no lo que tiene dentro.', 5],
      ['-R', 'Entra en todas las subcarpetas.', 5],
      ['-S', 'Ordena por tamaño, el mayor primero.', 5],
      ['--color=never', 'Sin colores. Con colores, azul es carpeta y cian, enlace.', 5],
      ['-n', 'Como -l, pero con el UID y el GID en lugar de los nombres.', 6],
    ],
    e: [['ls -ltr /etc', 'Formato largo, del más antiguo al más reciente.'], ['ls -ld /etc', 'Una sola línea: la de la carpeta /etc, no la de lo que tiene dentro.', 5], ['ls -ln ~/empresa', '1000 1000 en lugar de alumno alumno.', 6]],
    x: [
      { ut: 5, d: 'Las opciones se juntan: ‹ls -lah›.' },
    ] },
]},

{ g: 'Ver y crear archivos', f: [
  { n: 'touch', f: 'touch FICHERO...', m: 1, k: 'crear archivo vacío fecha',
    d: 'Crea un archivo vacío. Si ya existe, le pone la fecha y la hora de ahora.',
    e: [['touch notas.txt', 'Crea notas.txt, que ocupa 0 bytes.']] },
  { n: 'cat', f: 'cat [OPCIÓN]... [FICHERO]...', m: 1, k: 'ver contenido archivo mostrar leer',
    d: 'Enseña lo que tiene un archivo, entero y de golpe. Con varios, los enseña uno detrás de otro.',
    o: [
      ['-n', 'Numera las líneas.'],
    ],
    e: [['cat -n /etc/shells', 'La lista de shells del sistema, con las líneas numeradas.'], ['cat /proc/version', 'La versión del núcleo y con qué se compiló.']] },
  { n: 'more', f: 'more FICHERO', m: 0, k: 'ver páginas archivo largo',
    d: 'Enseña un archivo por páginas. Solo avanza.',
    o: [
      ['espacio', 'Avanza una pantalla.'],
      ['q', 'Sale.'],
    ],
    e: [['more /etc/services', 'Enseña el archivo de servicios de red pantalla a pantalla.']] },
]},

{ g: 'Quién y cuándo', f: [
  { n: 'whoami', f: 'whoami', m: 0, k: 'usuario nombre quién soy',
    d: 'Escribe tu nombre de usuario.',
    e: [['whoami', 'Escribe alumno.']] },
  { n: 'id', f: 'id [USUARIO]', m: 0, k: 'uid gid grupos usuario número uid gid grupos otro usuario',
    d: 'Enseña tu número de usuario (uid), tu grupo principal (gid) y todos los grupos en los que estás. Un grupo reúne a varios usuarios para darles los mismos permisos.',
    o: [
      ['USUARIO', 'Los datos de otro usuario.', 6],
      ['-u', 'Solo el UID.', 6],
      ['-g', 'Solo el GID del grupo primario.', 6],
      ['-G', 'Todos los grupos.', 6],
      ['-n', 'Nombres en vez de números (con -u, -g o -G).', 6],
    ],
    e: [['id', 'uid=1000(alumno): el primer usuario del sistema. El grupo sudo lo hace administrador.'], ['id -Gn ana', 'Los nombres de los grupos de ana.', 6]] },
  { n: 'who', f: 'who [OPCIÓN]', m: 0, k: 'conectados sesión usuarios terminal nivel ejecución',
    d: 'Enseña quién ha iniciado sesión, en qué terminal y desde cuándo.',
    o: [
      ['-a', 'Todos los datos que conoce: también la hora del arranque y el nivel de ejecución.'],
      ['-r', 'El nivel de ejecución actual, con la hora del arranque.', 7],
    ],
    e: [['who', 'Una línea por cada sesión abierta.'], ['who -r', 'Lo mismo que runlevel, con la fecha y la hora.', 7]] },
  { n: 'w', f: 'w', m: 0, k: 'conectados actividad usuarios',
    d: 'Enseña lo mismo que who y, además, qué está haciendo cada usuario y la carga del equipo.',
    e: [['w', 'Las sesiones abiertas y la orden que tiene en marcha cada una.']] },
  { n: 'date', f: 'date [+FORMATO]', m: 0, k: 'fecha hora día formato',
    d: 'Enseña la fecha y la hora. Con + y un formato, las escribe como quieras.',
    o: [
      ['%d', 'El día del mes.'],
      ['%m', 'El mes, en número.'],
      ['%Y', 'El año.'],
      ['%H · %M', 'La hora y los minutos.'],
      ['%A', 'El nombre del día de la semana.'],
    ],
    e: [['date +%d-%m-%Y', 'Escribe la fecha como 21-11-2026.']],
    nota: '‹%m› es el mes y ‹%M›, los minutos. Los demás formatos están en ‹date --help›.' },
  { n: 'cal', f: 'cal [OPCIÓN] [[MES] AÑO]', m: 0, inst: 'ncal', k: 'calendario mes año',
    d: 'Enseña un calendario. Sin nada detrás, el mes actual.',
    o: [
      ['-3', 'El mes anterior, el actual y el siguiente.'],
      ['-y', 'El año entero.'],
      ['-m MES', 'Un mes del año actual: ‹cal -m 3› es marzo.'],
      ['MES AÑO', 'Un mes de un año concreto.'],
    ],
    e: [['cal 3 2027', 'El calendario de marzo de 2027.']],
    nota: 'Si no está instalada, la terminal dice cómo instalarla.' },
]},

{ g: 'El sistema y el hardware', f: [
  { n: 'uname', f: 'uname [OPCIÓN]...', m: 0, k: 'sistema núcleo kernel versión procesador',
    d: 'Enseña datos del sistema: el núcleo, el nombre del equipo y el procesador. Sin opciones, solo dice Linux.',
    o: [
      ['-s · --kernel-name', 'El nombre del núcleo: Linux.'],
      ['-n · --nodename', 'El nombre del equipo.'],
      ['-r · --kernel-release', 'La versión del núcleo.'],
      ['-v · --kernel-version', 'Cuándo se compiló el núcleo.'],
      ['-m · --machine', 'El tipo de procesador: x86_64.'],
      ['-p · --processor', 'El procesador. En Ubuntu suele repetir x86_64.'],
      ['-i · --hardware-platform', 'La plataforma. En Ubuntu suele repetir x86_64.'],
      ['-o · --operating-system', 'El sistema operativo: GNU/Linux.'],
      ['-a · --all', 'Todo a la vez.'],
    ],
    e: [['uname -r', 'La versión del núcleo, por ejemplo 7.0.0-31-generic.']] },
  { n: 'lsmod', f: 'lsmod', m: 0, k: 'módulos núcleo kernel controladores',
    d: 'Lista los módulos del núcleo que están cargados: su nombre, su tamaño y cuántos los usan.',
    e: [['lsmod | grep usbhid', 'Solo la línea de usbhid, el módulo de teclados y ratones USB: si sale, está cargado.']] },
  { n: 'lsblk', f: 'lsblk', m: 0, k: 'discos particiones montaje tamaño uuid sistema de archivos',
    d: 'Lista los discos y sus particiones, con su tamaño y su punto de montaje.',
    o: [
      ['-f', 'Añade el sistema de archivos y el UUID, un identificador que no cambia.', 5],
    ],
    e: [['lsblk', 'sda es el disco y sda1, sda2… sus particiones. Las líneas loop son programas snap, no particiones.'], ['lsblk -f', 'Los discos con su sistema de archivos (ext4, vfat, swap) y su UUID.', 5]] },
  { n: 'top', f: 'top', m: 0, k: 'procesos programas consumo memoria cpu ordenar memoria cpu matar prioridad carga',
    d: 'Enseña los programas en marcha y lo que gastan. Se actualiza solo.',
    o: [
      ['q', 'Sale.'],
      ['M', 'Ordena por memoria.', 6],
      ['P', 'Ordena por procesador.', 6],
      ['k', 'Termina un proceso: pide su PID.', 6],
      ['r', 'Cambia la prioridad de un proceso.', 6],
      ['q', 'Sale.', 6],
    ],
    e: [['top', 'La lista de procesos, ordenada por el uso del procesador.'], ['top', 'Dentro, M enseña arriba lo que más memoria gasta.', 6]],
    x: [
      { ut: 6, d: 'top se actualiza cada 3 segundos. Arriba hay un resumen: tiempo encendido, carga media, tareas por estado, procesador y memoria.' },
    ] },
]},

{ g: 'La shell: variables, alias e historial', f: [
  { n: 'echo', f: 'echo [TEXTO]...', m: 1, int: 1, k: 'escribir mostrar texto variable salto de línea tabulador',
    d: 'Escribe en la pantalla lo que pongas detrás. Con $ delante de un nombre, escribe el valor de esa variable.',
    o: [
      ['-n', 'No salta de línea al final.', 7],
      ['-e', 'Entiende códigos especiales: ‹\\n› salto de línea, ‹\\t› tabulador, ‹\\c› corta ahí lo que se escribe.', 7],
    ],
    e: [['echo $HOME', 'Escribe tu carpeta personal: /home/alumno.'], ['echo -e "Nombre\\tEdad\\nAna\\t17"', 'Escribe dos líneas en columnas.', 7]] },
  { n: 'Variables de la sesión', m: 0, k: 'variable entorno home path shell prompt ps1 escritorio wayland user hostname oldpwd lang term ps2',
    d: 'Una variable guarda un dato con un nombre. Con $ delante, la shell pone su valor.',
    o: [
      ['$HOME', 'Tu carpeta personal.'],
      ['$PWD', 'La carpeta donde estás.'],
      ['$PATH', 'Las carpetas donde la shell busca los programas, separadas por dos puntos.'],
      ['$SHELL', 'La shell de tu cuenta: /bin/bash.'],
      ['$PS1', 'El formato del prompt.'],
      ['$XDG_SESSION_TYPE', 'El servidor gráfico de la sesión: wayland o x11.'],
      ['$XDG_CURRENT_DESKTOP', 'El escritorio: ubuntu:GNOME.'],
      ['$USER · $LOGNAME', 'Tu nombre de usuario.', 7],
      ['$HOSTNAME', 'El nombre del equipo.', 7],
      ['$TERM', 'El tipo de terminal.', 7],
      ['$OLDPWD', 'La carpeta anterior (la que usa ‹cd -›).', 7],
      ['$LANG', 'El idioma: es_ES.UTF-8.', 7],
      ['$PS2', 'El prompt de continuación, >: sale cuando una orden sigue en la línea siguiente.', 7],
      { h: 'Códigos de PS1', ut: 7 },
      ['\\u · \\h · \\w', 'El usuario, el equipo y la carpeta.', 7],
      ['\\$', 'Un $, o # si eres root.', 7],
    ],
    e: [['PS1="> "', 'Cambia el prompt hasta que cierres la terminal.'], ['PS1="[SOM] \\w \\$ "', 'Cambia el prompt hasta que cierres la terminal.', 7]],
    x: [
      { ut: 7, d: 'Más variables que ya existen al abrir la terminal.' },
    ] },
  { n: 'env', f: 'env', m: 0, k: 'variables entorno quitar variable',
    d: 'Enseña todas las variables de entorno, una por línea.',
    o: [
      ['-u NOMBRE ORDEN', 'Ejecuta una orden sin esa variable. La terminal no cambia.', 7],
    ],
    e: [['env | grep HOME', 'Solo la línea de la variable HOME.'], ['env -u LANG ls --help | head -3', 'Sin LANG, la ayuda de ls sale en inglés.', 7]],
    x: [
      { ut: 7, d: 'env enseña solo las variables de entorno: las locales no salen.' },
    ] },
  { n: 'alias', f: "alias [NOMBRE='ORDEN']", m: 0, int: 1, k: 'atajo nombre corto',
    d: 'Crea un nombre corto para una orden más larga. Sin nada detrás, enseña los alias que hay. Un alias creado así dura hasta que cierras la terminal.',
    e: [["alias quien='clear; whoami; date'", 'Crea el alias quien, que ejecuta las tres órdenes. Las comillas hacen falta porque lleva espacios.']] },
  { n: 'unalias', f: 'unalias NOMBRE', m: 0, int: 1, k: 'borrar alias',
    d: 'Borra un alias.',
    e: [['unalias quien', 'Borra el alias quien.']] },
  { n: 'history', f: 'history [OPCIÓN]', m: 1, int: 1, k: 'historial órdenes escritas borrar',
    d: 'Enseña las órdenes que has escrito, numeradas.',
    o: [
      ['-c', 'Borra el historial.'],
    ],
    e: [['history | grep apt', 'Solo las órdenes del historial que llevaban apt.']] },
  { n: 'clear', f: 'clear', m: 0, k: 'limpiar pantalla borrar',
    d: 'Limpia la pantalla, igual que Ctrl+L.',
    e: [['clear', 'Deja la pantalla vacía con el prompt arriba.']] },
  { n: 'passwd', f: 'passwd', m: 0, k: 'contraseña cambiar clave contraseña otro usuario',
    d: 'Cambia tu contraseña. Pide la actual y dos veces la nueva. Lo que escribes no se ve.',
    e: [['passwd', 'Cambia la contraseña de tu usuario.'], ['sudo passwd luis', 'Cambia la contraseña de luis.', 6]],
    x: [
      { ut: 6, d: 'Con sudo, cambia la contraseña de otro usuario sin saber la anterior.' },
    ] },
  { n: 'exit', f: 'exit [N]', m: 0, int: 1, k: 'salir cerrar terminal código',
    d: 'Cierra la terminal o la shell en la que estás. Con un número detrás, termina con ese código de salida.',
    e: [['exit', 'Cierra la terminal.']] },
]},

{ g: '¿Dónde está un programa?', f: [
  { n: 'which', f: 'which ORDEN', m: 0, k: 'ruta programa dónde está buscar',
    d: 'Dice la ruta del programa que se ejecuta con ese nombre. Solo busca programas en las carpetas del PATH.',
    e: [['which ls', 'Escribe /usr/bin/ls.']],
    nota: '‹which cd› no responde nada: cd no es un programa, es una orden interna.' },
  { n: 'whereis', f: 'whereis ORDEN', m: 0, k: 'ruta programa manual fuente buscar',
    d: 'Busca el programa, su código fuente y su página del manual.',
    e: [['whereis ls', 'El programa /usr/bin/ls y su manual.']] },
]},

{ g: 'Administrar el sistema', f: [
  { n: 'sudo', f: 'sudo ORDEN', m: 1, k: 'administrador root superusuario permisos root administrador grupo sudo',
    d: 'Ejecuta una orden como administrador. Pide tu contraseña, que no se ve mientras la escribes.',
    o: [
      ['-i', 'Abre una shell de root. El prompt termina en #. Se sale con exit.', 6],
    ],
    e: [['sudo apt update', 'Ejecuta apt update como administrador.'], ['sudo -i', 'Abre una shell de administrador.', 6]],
    x: [
      { ut: 6, d: 'Solo pueden usarlo los usuarios del grupo sudo. Pide tu contraseña, no la de root; durante 15 minutos no la vuelve a pedir en esa terminal. Cada uso queda apuntado en /var/log/auth.log.' },
    ] },
  { n: 'apt', f: 'sudo apt ORDEN [PAQUETE]', m: 1, k: 'instalar actualizar desinstalar quitar programa paquete buscar paquete dependencias repositorio purgar deb',
    d: 'Es el gestor de paquetes de Ubuntu: instala, actualiza y quita programas de los repositorios.',
    o: [
      ['update', 'Descarga la lista de paquetes nuevos. No instala nada.'],
      ['upgrade', 'Instala las versiones nuevas. Pregunta «¿Desea continuar? [S/n]»: Intro es sí.'],
      ['install PAQUETE', 'Instala un programa.'],
      ['remove PAQUETE', 'Quita un programa.'],
      ['purge PAQUETE', 'Quita el paquete y también su configuración. remove deja la configuración.', 7],
      ['autoremove', 'Quita las dependencias que ya no necesita ningún paquete.', 7],
      ['search TEXTO', 'Busca paquetes por su nombre o su descripción.', 7],
      ['show PAQUETE', 'La información de un paquete, esté instalado o no.', 7],
      ['list --installed', 'Los paquetes instalados.', 7],
      ['install ./ARCHIVO.deb', 'Instala un .deb descargado y lo que le falte. El ./ dice que es un archivo.', 7],
      ['clean', 'Borra los paquetes descargados que guarda en /var/cache/apt/archives.', 7],
    ],
    e: [['sudo apt install ncal', 'Instala el paquete ncal, que trae la orden cal.'], ['sudo apt purge synaptic', 'Quita synaptic y su configuración.', 7]],
    nota: 'Siempre primero ‹update› y después ‹upgrade›.',
    x: [
      { ut: 7, d: 'apt busca en los repositorios (servidores con miles de paquetes firmados por la distribución), descarga cada paquete con sus dependencias (los otros paquetes que necesita) y lo instala. La lista de repositorios está en /etc/apt/sources.list.d/ubuntu.sources.', nota: 'Consultar (search, show, list) no necesita sudo.' },
    ] },
  { n: 'nano', f: 'nano FICHERO', m: 1, k: 'editor texto editar archivo editor pegar cortar',
    d: 'Es un editor de texto que funciona dentro de la terminal. Abajo enseña sus atajos: ^ significa Ctrl.',
    o: [
      ['Ctrl+O', 'Guarda: confirma con Intro.'],
      ['Ctrl+X', 'Sale; si hay cambios sin guardar, pregunta.'],
      ['Ctrl+W', 'Busca.'],
      ['Ctrl+K', 'Corta la línea.'],
      ['Ctrl+U', 'Pega la línea cortada con Ctrl+K.', 5],
    ],
    e: [['sudo nano /etc/default/grub', 'Abre la configuración de GRUB. Lleva sudo porque es un archivo del sistema.'], ['nano ~/.bashrc', 'Abre tu archivo de configuración de bash.', 5]],
    x: [
      { ut: 5, d: '‹nano FICHERO› abre el archivo; si no existe, lo crea al guardar.' },
    ] },
  { n: 'update-grub', f: 'sudo update-grub', m: 0, k: 'arranque grub menú',
    d: 'Fabrica el menú de arranque, /boot/grub/grub.cfg, a partir de /etc/default/grub. Se ejecuta después de cambiar ese archivo.',
    o: [
      { h: 'En /etc/default/grub' },
      ['GRUB_DEFAULT', 'La entrada que arranca sola; 0 es la primera.'],
      ['GRUB_TIMEOUT_STYLE', 'hidden oculta el menú; menu lo enseña.'],
      ['GRUB_TIMEOUT', 'Los segundos que espera.'],
    ],
    e: [['sudo update-grub', 'Fabrica el menú nuevo con los cambios de /etc/default/grub.']] },
  { n: 'grep', f: 'ORDEN | grep PALABRA', m: 1, k: 'buscar filtrar líneas tubería buscar texto líneas filtrar contexto',
    d: 'La barra | (tubería) pasa lo que escribe una orden a la siguiente. grep deja pasar solo las líneas que contienen la palabra.',
    o: [
      ['-i', 'No distingue mayúsculas de minúsculas.', 5],
      ['-v', 'Las líneas que no lo tienen.', 5],
      ['-n', 'Añade el número de línea.', 5],
      ['-c', 'Solo cuenta las líneas.', 5],
      ['-w', 'La palabra entera: Ana, pero no Mariana.', 5],
      ['-l', 'Solo dice en qué archivos está.', 5],
      ['-r', 'Busca en la carpeta y en todo lo que tiene dentro.', 5],
      ['-A N · -B N', 'Añade N líneas de después (after) o de antes (before).', 5],
      ['-C N', 'Añade N líneas de antes y N de después.', 5],
      ['^texto', 'Las líneas que empiezan por el texto.', 5],
      ['texto$', 'Las líneas que terminan en el texto.', 5],
    ],
    e: [['lsmod | grep e1000', 'Solo la línea del módulo de la tarjeta de red de la máquina virtual.'], ['grep -c bash$ /etc/passwd', 'Cuenta los usuarios cuya shell es bash: sus líneas terminan en bash.', 5]],
    nota: 'La | está en la tecla del 1, con AltGr.',
    x: [
      { ut: 5, d: 'Enseña las líneas que contienen un texto, en archivos o en lo que le llega por una tubería.', f: 'grep [OPCIÓN]... PATRÓN [FICHERO]...', nota: 'Si el patrón lleva espacios, va entre comillas.' },
    ] },
]},

{ g: 'El escritorio', f: [
  { n: 'systemctl', f: 'systemctl status SERVICIO', m: 0, k: 'servicio estado gestor de pantalla gdm servicio arrancar parar habilitar demonio targets',
    d: 'Un servicio es un programa que funciona en segundo plano. systemctl status enseña si está en marcha. Sale con q.',
    o: [
      { h: 'Consultar', ut: 7 },
      ['status SERVICIO', 'Si está activo y habilitado, su PID y sus últimos mensajes.', 7],
      ['is-active · is-enabled', 'Responden solo a una de las dos cosas.', 7],
      ['list-units --type=service', 'Los servicios cargados ahora y su estado.', 7],
      ['list-unit-files --type=service --state=enabled', 'Los que arrancan solos al encender.', 7],
      ['cat SERVICIO', 'Enseña el archivo de la unidad.', 7],
      ['list-timers', 'Los temporizadores: tareas programadas de systemd.', 7],
      { h: 'Ahora', ut: 7 },
      ['start · stop', 'Arranca o para el servicio.', 7],
      ['restart', 'Lo para y lo vuelve a arrancar.', 7],
      { h: 'En cada arranque', ut: 7 },
      ['enable · disable', 'Lo habilita o lo deshabilita.', 7],
      ['enable --now', 'Lo habilita y lo arranca a la vez.', 7],
      { h: 'El sistema', ut: 7 },
      ['get-default', 'El target con el que arranca el equipo.', 7],
      ['isolate TARGET', 'Cambia a otro target: ‹multi-user.target› cierra el escritorio.', 7],
      ['suspend', 'Suspende el equipo.', 7],
    ],
    e: [['systemctl status display-manager', 'El estado del gestor de pantalla: gdm, activo.'], ['sudo systemctl enable --now cron', 'cron funciona ahora y arrancará en cada encendido.', 7]],
    x: [
      { ut: 7, d: 'Maneja systemd, el proceso con PID 1, que arranca los servicios. Un servicio activo está funcionando ahora; uno habilitado arrancará solo al encender el equipo. Cambiar un servicio necesita sudo; consultarlo, no.', f: 'systemctl ORDEN [UNIDAD]', m: 1 },
    ] },
  { n: 'dpkg-reconfigure', f: 'sudo dpkg-reconfigure PAQUETE', m: 0, k: 'configurar paquete gestor de pantalla sddm gdm3',
    d: 'Vuelve a hacer las preguntas de configuración de un paquete ya instalado.',
    e: [['sudo dpkg-reconfigure sddm', 'Con KDE Plasma instalado, pregunta otra vez qué gestor de pantalla se usa: gdm3 (el de GNOME) o sddm (el de KDE).']] },
]},

{ g: 'La red', f: [
  { n: 'ip', f: 'ip a', m: 1, k: 'red dirección ip tarjeta ifconfig puerta de enlace ruta router',
    d: 'Enseña la configuración de red. ‹ip a› da las direcciones IP de cada tarjeta.',
    o: [
      ['ip r', 'La puerta de enlace: por dónde sale el equipo a otras redes.', 5],
    ],
    e: [['ip a', 'En la red NAT de VirtualBox, la dirección de la máquina es 10.0.2.15.'], ['ip r', 'En la red NAT de VirtualBox, la puerta de enlace es 10.0.2.2.', 5]],
    nota: '‹ifconfig› no viene instalada en Ubuntu: está en el paquete net-tools. ‹ip› hace lo mismo.' },
  { n: 'ping', f: 'ping EQUIPO', m: 0, k: 'red conexión comprobar llegar',
    d: 'Comprueba si llega a otro equipo: le manda un paquete cada segundo y espera la respuesta. No para solo: se corta con Ctrl+C.',
    e: [['ping 10.0.2.2', 'Comprueba que llega a la puerta de enlace de la red NAT de VirtualBox.']] },
]},

]},

/* ============================================================ UT5 */
{ ut: 5, t: 'Uso y configuración del sistema: archivos, filtros y búsquedas', g: [

{ g: 'Rutas, comodines y comillas', f: [
  { n: 'Rutas', m: 1, k: 'ruta absoluta relativa camino',
    d: 'Una ruta es el camino hasta un archivo o una carpeta. La absoluta empieza en la raíz, por /, y es la misma estés donde estés. La relativa empieza en la carpeta donde estás.',
    o: [
      ['/', 'La raíz.'],
      ['.', 'La carpeta actual.'],
      ['..', 'La carpeta de arriba.'],
      ['~', 'Tu carpeta personal: /home/alumno.'],
    ],
    e: [['cd ../../backups', 'Desde ~/empresa/datos/ventas, sube dos carpetas y entra en backups.']] },
  { n: 'Comodines', f: '*  ?  [ ]  { }', m: 1, k: 'patrón asterisco interrogación varios archivos',
    d: 'Un comodín es un carácter que sustituye a otros. Bash cambia el patrón por la lista de nombres que encajan y después ejecuta la orden.',
    o: [
      ['*', 'Cualquier texto, también ninguno.'],
      ['?', 'Exactamente un carácter.'],
      ['[ ]', 'Un carácter de la lista o del rango: ‹informe[1-3].txt›.'],
      ['{ }', 'Cada palabra de la lista, exista o no: ‹{enero,febrero}›.'],
    ],
    e: [['ls *.csv', 'Los archivos de la carpeta actual que terminan en .csv.']],
    nota: '‹*› no coge los archivos ocultos. Antes de borrar con un patrón, se prueba con ‹ls›.' },
  { n: 'Escape y comillas', f: '\\  " "  \' \'', m: 0, k: 'espacios nombre barra invertida comillas dobles simples',
    d: 'Bash separa los argumentos por los espacios. Un nombre con espacios hay que protegerlo.',
    o: [
      ['\\', 'La barra invertida (escape) hace que el carácter siguiente sea normal: ‹Mis\\ informes›.'],
      ['" "', 'Las comillas dobles protegen los espacios. Dentro, ‹$HOME› se cambia por su valor.'],
      ["' '", 'Las comillas simples lo protegen todo: dentro no se cambia nada.'],
    ],
    e: [['mkdir "Mis informes"', 'Crea una sola carpeta llamada «Mis informes».']],
    nota: 'El tabulador escribe el escape por ti.' },
]},

{ g: 'Ver lo que hay', f: [
  { n: 'Tipos de archivo', m: 0, k: 'tipo directorio enlace dispositivo bloques caracteres socket tubería',
    d: 'El primer carácter de cada línea de ‹ls -l› dice el tipo de archivo.',
    o: [
      ['-', 'Archivo normal.'],
      ['d', 'Directorio (carpeta).'],
      ['l', 'Enlace simbólico.'],
      ['c', 'Dispositivo de caracteres: se lee y escribe carácter a carácter, en orden (/dev/tty1).'],
      ['b', 'Dispositivo de bloques: se lee y escribe a trozos, en cualquier orden (/dev/sda).'],
      ['s', 'Socket: un punto por el que dos programas se comunican.'],
      ['p', 'Tubería con nombre: un archivo por el que un programa pasa datos a otro.'],
    ],
    e: [['ls -l /dev/sda', 'La línea empieza por b: el disco es un dispositivo de bloques.']] },
  { n: 'tree', f: 'tree [OPCIÓN]... [CARPETA]', m: 0, inst: 'tree', k: 'árbol carpetas dibujar',
    d: 'Dibuja el árbol de carpetas y archivos.',
    o: [
      ['-L N', 'Baja solo N niveles.'],
      ['-d', 'Solo las carpetas.'],
      ['-a', 'También los ocultos.'],
    ],
    e: [['tree -L 1 /', 'Las carpetas de la raíz, sin entrar en ellas.']] },
  { n: 'file', f: 'file FICHERO...', m: 0, k: 'tipo archivo contenido extensión',
    d: 'Mira el contenido, no la extensión, y dice qué tipo de archivo es.',
    e: [['file /usr/bin/ls', 'Dice que es un programa ejecutable (ELF).']] },
  { n: 'stat', f: 'stat [OPCIÓN] FICHERO', m: 0, k: 'inodo ficha fechas tamaño bloques',
    d: 'Enseña la ficha entera de un archivo, su inodo: tamaño, bloques, número de inodo, enlaces, permisos, dueño y fechas. El inodo es la ficha que el sistema de archivos guarda de cada archivo.',
    o: [
      ['-f', 'Los datos del sistema de archivos, no los de un archivo.'],
    ],
    e: [['stat -f /', 'Los bloques y los inodos del sistema de archivos de la raíz.']] },
  { n: 'tty', f: 'tty', m: 0, k: 'terminal dispositivo',
    d: 'Dice en qué terminal escribes. La Terminal del escritorio es /dev/pts/0, /dev/pts/1…',
    e: [['tty', 'Escribe el dispositivo de tu terminal, por ejemplo /dev/pts/0.']] },
]},

{ g: 'Crear, copiar, mover y borrar', f: [
  { n: 'mkdir', f: 'mkdir [OPCIÓN] CARPETA...', m: 1, k: 'crear carpeta directorio',
    d: 'Crea carpetas.',
    o: [
      ['-p', 'Crea también las carpetas intermedias que falten. Si ya existen, no da error.'],
    ],
    e: [['mkdir -p empresa/{datos,backups,scripts}', 'Crea empresa y, dentro, sus tres carpetas.']] },
  { n: 'rmdir', f: 'rmdir CARPETA...', m: 0, k: 'borrar carpeta vacía directorio',
    d: 'Borra carpetas vacías. Si tienen algo dentro, no las borra.',
    e: [['rmdir informes', 'Borra la carpeta informes, que está vacía.']] },
  { n: 'cp', f: 'cp [OPCIÓN]... ORIGEN DESTINO', m: 1, k: 'copiar copia duplicar',
    d: 'Copia archivos y carpetas. El original se queda donde estaba. Si el destino es una carpeta, la copia entra con el mismo nombre.',
    o: [
      ['-R · -r', 'Copia una carpeta con todo lo que tiene dentro.'],
      ['-p', 'Conserva la fecha, los permisos y el dueño del original.'],
      ['-i', 'Pregunta antes de sustituir un archivo que ya existe.'],
    ],
    e: [['cp -R datos backups/datos-copia', 'Copia la carpeta datos entera con el nombre datos-copia.']] },
  { n: 'mv', f: 'mv ORIGEN DESTINO', m: 1, k: 'mover mueve renombrar cambiar nombre',
    d: 'Mueve archivos y carpetas a otro sitio: el original desaparece de donde estaba. También sirve para cambiar el nombre.',
    e: [['mv backups/resumen.csv backups/enero.csv', 'Cambia el nombre del archivo.'], ['mv backups/enero.csv scripts/', 'Lo mueve a la carpeta scripts.']] },
  { n: 'rm', f: 'rm [OPCIÓN]... FICHERO...', m: 1, k: 'borrar eliminar archivos carpetas',
    d: 'Borra archivos; con -r, carpetas enteras. En la terminal no hay papelera: lo que se borra no se recupera.',
    o: [
      ['-r · -R', 'Borra la carpeta y todo lo que tiene dentro.'],
      ['-i', 'Pregunta antes de cada archivo.'],
      ['-f', 'No pregunta ni avisa si el archivo no existe.'],
    ],
    e: [['rm -r backups/datos-copia', 'Borra la carpeta datos-copia con todo lo de dentro.']] },
  { n: 'ln', f: 'ln [-s] ORIGINAL NOMBRE', m: 0, k: 'enlace acceso directo duro simbólico',
    d: 'Crea un enlace: otro nombre para un archivo.',
    o: [
      ['(sin opción)', 'Enlace duro: otro nombre para el mismo inodo. Borrar uno no borra los datos. Solo dentro de la misma partición y no sirve para carpetas.'],
      ['-s', 'Enlace simbólico: un archivo pequeño que guarda la ruta del otro. Si se borra el original, queda roto. Es el acceso directo de Linux.'],
    ],
    e: [['ln -s datos/resumen.csv ventas', 'Crea el enlace simbólico ventas, que lleva a datos/resumen.csv.']] },
]},

{ g: 'Ver y editar archivos', f: [
  { n: 'less', f: 'less FICHERO', m: 1, k: 'ver páginas archivo largo buscar',
    d: 'Enseña un archivo por páginas y deja moverse por él hacia delante y hacia atrás.',
    o: [
      ['↑ ↓ · espacio', 'Se mueve por el archivo.'],
      ['/palabra', 'Busca la palabra; n salta a la siguiente.'],
      ['q', 'Sale.'],
    ],
    e: [['less /etc/services', 'Abre el archivo de servicios de red para leerlo con calma.']] },
  { n: 'head', f: 'head [-n N] FICHERO', m: 0, k: 'principio primeras líneas',
    d: 'Enseña las primeras líneas de un archivo: 10, si no se dice otra cosa.',
    o: [
      ['-n N', 'Las N primeras.'],
    ],
    e: [['head -n 3 datos/resumen.csv', 'Las 3 primeras líneas: la cabecera y dos filas.']] },
  { n: 'tail', f: 'tail [OPCIÓN] FICHERO', m: 1, k: 'final últimas líneas registro seguir',
    d: 'Enseña las últimas líneas de un archivo: 10, si no se dice otra cosa.',
    o: [
      ['-n N', 'Las N últimas.'],
      ['-n +N', 'Desde la línea N hasta el final: ‹-n +2› lo enseña todo menos la cabecera.'],
      ['-f', 'Se queda esperando y enseña cada línea nueva. Ctrl+C sale.'],
    ],
    e: [['tail -n +2 datos/resumen.csv', 'Todas las filas del CSV, sin la cabecera.']] },
  { n: 'wc', f: 'wc [OPCIÓN] FICHERO', m: 0, k: 'contar líneas palabras bytes caracteres',
    d: 'Cuenta las líneas, las palabras y los bytes de un archivo.',
    o: [
      ['-l', 'Solo las líneas.'],
      ['-w', 'Las palabras.'],
      ['-c', 'Los bytes.'],
      ['-m', 'Los caracteres. Una ñ o una letra con tilde es un carácter y dos bytes.'],
      ['-L', 'La longitud de la línea más larga.'],
    ],
    e: [['wc -l datos/resumen.csv', 'Cuántas líneas tiene el archivo, con la cabecera.']] },
  { n: 'vi', f: 'vi FICHERO', m: 0, k: 'editor salir vim',
    d: 'Otro editor de texto, que está en todos los Linux. Basta con saber salir.',
    o: [
      ['Esc :q! Intro', 'Sale sin guardar.'],
      ['Esc :wq Intro', 'Guarda y sale.'],
    ],
    e: [['vi datos/resumen.csv', 'Abre el archivo en vi.']] },
]},

{ g: 'Redirecciones y tuberías', f: [
  { n: 'Redirecciones', f: '>  >>  2>  2>>  2>&1  <', m: 1, k: 'salida entrada errores guardar archivo canal',
    d: 'Todo programa tiene tres canales: la entrada (0, normalmente el teclado), la salida (1, la pantalla) y los errores (2, también la pantalla). Las redirecciones mandan cada canal a otro sitio.',
    o: [
      ['> archivo', 'La salida va al archivo. Si existe, lo vacía antes.'],
      ['>> archivo', 'La salida se añade al final del archivo.'],
      ['2> archivo', 'Los errores van al archivo; la salida sigue en pantalla.'],
      ['2>> archivo', 'Los errores se añaden al final del archivo.'],
      ['> archivo 2>&1', 'La salida y los errores van al mismo archivo.'],
      ['2> /dev/null', 'Los errores desaparecen: /dev/null se traga todo.'],
      ['< archivo', 'La orden lee del archivo en vez del teclado.'],
    ],
    e: [['ls datos noexiste > todo.txt 2>&1', 'Guarda en todo.txt la lista y el error.'], ['cat > compra.txt', 'Escribe en compra.txt lo que teclees. Ctrl+D termina.']],
    nota: '‹sort datos.txt > datos.txt› deja el archivo vacío: ‹>› lo vacía antes de que sort lo lea.' },
  { n: 'Tubería', f: 'ORDEN | ORDEN', m: 1, k: 'pipe barra encadenar conectar',
    d: 'La tubería | conecta la salida de una orden con la entrada de la siguiente. Se pueden encadenar todas las que haga falta. Los errores no entran en la tubería: van a la pantalla.',
    e: [['cat datos/resumen.csv | grep Marzo | wc -l', 'Cuenta las líneas que tienen Marzo.']] },
  { n: 'tee', f: 'tee [-a] FICHERO', m: 0, k: 'guardar y ver a la vez',
    d: 'Guarda en un archivo lo que le llega y, además, lo deja pasar a la pantalla o a la orden siguiente.',
    o: [
      ['-a', 'Añade al final en vez de vaciar el archivo.'],
    ],
    e: [['ls -l datos | tee listado.txt', 'Sale en pantalla y queda guardado en listado.txt.']] },
]},

{ g: 'Filtrar datos', f: [
  { n: 'sort', f: 'sort [OPCIÓN]... [FICHERO]...', m: 0, k: 'ordenar alfabético numérico repetidos',
    d: 'Ordena las líneas: por defecto, de la A a la Z y comparando carácter a carácter.',
    o: [
      ['-r', 'Al revés.'],
      ['-n', 'Compara como números: sin -n, 870 sale después de 1560.'],
      ['-t CARÁCTER', 'El separador de los campos: ‹-t,› es la coma.'],
      ['-k N', 'Ordena por el campo N.'],
      ['-u', 'Quita las líneas repetidas.'],
      ['-c', 'No ordena: dice si ya está ordenado.'],
      ['-m', 'Une archivos que ya están ordenados, sin volver a ordenarlos.'],
    ],
    e: [['tail -n +2 datos/resumen.csv | sort -t, -k3 -n', 'Las filas, sin la cabecera, de la venta menor a la mayor (campo 3).']] },
  { n: 'cut', f: 'cut OPCIÓN... [FICHERO]...', m: 0, k: 'columnas campos cortar csv',
    d: 'Se queda con unas columnas de cada línea.',
    o: [
      ['-d CARÁCTER', 'El separador de los campos. Sin -d, el separador es el tabulador.'],
      ['-f LISTA', 'Los campos que quieres: ‹-f2›, ‹-f1,3› o ‹-f2-4›.'],
      ['-c LISTA', 'Por posiciones de carácter: ‹-c1-3›.'],
      ['-b LISTA', 'Por posiciones de byte.'],
    ],
    e: [['cut -d, -f2 datos/resumen.csv', 'La segunda columna de cada línea: los vendedores.'], ['cut -d: -f1 /etc/passwd', 'Los nombres de los usuarios del sistema.']] },
]},

{ g: 'Buscar archivos', f: [
  { n: 'find', f: 'find [CARPETA] [CONDICIÓN]...', m: 1, k: 'buscar archivos nombre tamaño fecha',
    d: 'Recorre una carpeta y todo lo que tiene dentro, y enseña lo que cumple las condiciones. El patrón va entre comillas para que bash no lo cambie antes.',
    o: [
      ['-name "PATRÓN"', 'Por nombre, con comodines.'],
      ['-iname "PATRÓN"', 'Por nombre, sin distinguir mayúsculas.'],
      ['-type f · d · l', 'Archivos, carpetas o enlaces.'],
      ['-size +100k', 'Más de 100 KB; con -, menos. También M y G.'],
      ['-mtime -7', 'Modificados en los últimos 7 días; +30, hace más de 30.'],
      ['-maxdepth N', 'No baja más de N niveles.'],
      ['-empty', 'Vacíos.'],
      ['-a · -o · -not', 'Junta condiciones: y, o, no.'],
      ['-exec ORDEN {} \\;', 'Ejecuta la orden con cada archivo encontrado: {} es el archivo y \\; cierra la orden.'],
    ],
    e: [['find ~/empresa -name "*.csv"', 'Todos los .csv de ~/empresa y de sus subcarpetas.'], ['find ~/empresa -name "*.log" -exec cp {} ~/copias/ \\;', 'Copia a ~/copias cada .log que encuentra.']] },
  { n: 'locate', f: 'locate NOMBRE', m: 0, inst: 'plocate', k: 'buscar nombre rápido lista updatedb',
    d: 'Busca archivos por su nombre en una lista de todos los archivos del sistema. Es muy rápido, pero la lista se actualiza una vez al día.',
    o: [
      ['sudo updatedb', 'Actualiza la lista. Después, locate encuentra también los archivos nuevos.'],
    ],
    e: [['locate resumen.csv', 'Las rutas de todos los archivos que se llaman así.']] },
  { n: 'du', f: 'du [OPCIÓN]... [FICHERO]...', m: 0, k: 'ocupa espacio tamaño carpeta',
    d: 'Dice cuánto ocupan unos archivos o carpetas.',
    o: [
      ['-h', 'En K, M y G.'],
      ['-s', 'Solo el total.'],
    ],
    e: [['du -hs ~/empresa', 'El total que ocupa ~/empresa.']] },
]},

{ g: 'Discos y montaje', f: [
  { n: 'df', f: 'df [OPCIÓN]... [CARPETA]', m: 1, k: 'espacio libre disco sistema de archivos',
    d: 'Enseña cada sistema de archivos montado: su tamaño, lo usado, lo libre y dónde está montado.',
    o: [
      ['-h', 'Los tamaños en K, M y G.'],
      ['-i', 'Los inodos usados y libres.'],
    ],
    e: [['df -h /home', 'Solo el sistema de archivos de /home, con los tamaños en G.']],
    nota: 'Los /dev/loop son aplicaciones snap: cada una se monta como un disco pequeño.' },
  { n: 'mount', f: 'mount [DISPOSITIVO CARPETA]', m: 0, k: 'montar partición disco fstab',
    d: 'Sin nada detrás, enseña todo lo que está montado. Con un dispositivo y una carpeta, engancha la partición a esa carpeta.',
    o: [
      ['-a', 'Monta todo lo que dice /etc/fstab. Un error sale ahora, no al arrancar.'],
      ['-o remount,rw /', 'Vuelve a montar la raíz para poder escribir en ella (en el modo de recuperación).'],
      { h: 'En /etc/fstab' },
      ['UUID carpeta tipo opciones', 'Una línea por partición que se monta sola al arrancar. Con la opción nofail, si falta el disco, el equipo arranca igual.'],
    ],
    e: [['sudo mount /dev/sdb1 /mnt/datos', 'Engancha la partición sdb1 a la carpeta /mnt/datos.'], ['mount | grep ^/dev/sd', 'Solo los montajes de las particiones del disco.']] },
  { n: 'umount', f: 'umount CARPETA', m: 0, k: 'desmontar partición',
    d: 'Desengancha una partición de su carpeta. Si algo de dentro está en uso, avisa.',
    e: [['sudo umount /mnt/datos', 'Desmonta lo que había en /mnt/datos.']] },
]},

{ g: 'Red, equipo y dispositivos', f: [
  { n: 'hostnamectl', f: 'hostnamectl [set-hostname NOMBRE]', m: 0, k: 'nombre equipo cambiar host',
    d: 'Enseña el nombre del equipo y datos del sistema. Con set-hostname, cambia el nombre.',
    o: [
      ['set-hostname NOMBRE', 'Cambia el nombre del equipo (con sudo).'],
    ],
    e: [['sudo hostnamectl set-hostname som-garcia', 'El equipo pasa a llamarse som-garcia.']],
    nota: 'hostnamectl cambia /etc/hostname; en /etc/hosts sigue el nombre viejo y se cambia a mano.' },
  { n: 'lsusb', f: 'lsusb', m: 0, k: 'usb dispositivos conectados',
    d: 'Lista los dispositivos conectados por USB.',
    e: [['lsusb', 'Una línea por dispositivo USB.']] },
  { n: 'lspci', f: 'lspci', m: 0, k: 'tarjetas hardware gráfica red',
    d: 'Lista las tarjetas de dentro del equipo: gráfica, red, sonido…',
    e: [['lspci', 'En una máquina virtual, el hardware que imita VirtualBox.']] },
]},

{ g: 'Tu entorno y tu primer script', f: [
  { n: '~/.bashrc y los archivos ocultos', m: 0, k: 'configuración alias bashrc profile ocultos',
    d: 'Lo que configuras se guarda en tu carpeta personal, en archivos cuyo nombre empieza por punto. Un alias escrito al final de ~/.bashrc se carga en cada terminal nueva.',
    o: [
      ['~/.profile', 'Órdenes que se ejecutan al iniciar sesión.'],
      ['~/.bashrc', 'Órdenes que bash ejecuta cada vez que abres una terminal.'],
      ['~/.bash_logout', 'Órdenes que se ejecutan al salir de una sesión iniciada en la consola.'],
      ['~/.bash_history', 'El historial de órdenes.'],
      ['~/.config', 'La configuración de las aplicaciones del escritorio.'],
    ],
    e: [['echo "alias datos=\'cd ~/empresa/datos\'" >> ~/.bashrc', 'Añade un alias al final de .bashrc. Funciona en las terminales que se abran después.']] },
  { n: 'bash', f: 'bash SCRIPT', m: 0, k: 'script ejecutar órdenes archivo automatizar',
    d: 'Ejecuta un script: un archivo de texto con órdenes, una por línea. Bash las ejecuta en orden, como si las escribieras tú.',
    e: [['bash ~/empresa/scripts/informe.sh > ~/empresa/informe.txt', 'Ejecuta el script y guarda lo que escribe en informe.txt.']] },
]},

]},

/* ============================================================ UT6 */
{ ut: 6, t: 'Usuarios, grupos, permisos y procesos', g: [

{ g: 'Permisos', f: [
  { n: 'Permisos rwx', m: 1, k: 'permisos lectura escritura ejecución propietario grupo otros octal',
    d: 'Los nueve caracteres que van detrás del tipo en ‹ls -l› son tres tríos de permisos: el del propietario (u), el del grupo (g) y el de otros (o). Un guion significa que ese permiso falta.',
    o: [
      { h: 'En un archivo · en un directorio' },
      ['r · 4', 'Leer: ver el contenido · ver la lista de nombres.'],
      ['w · 2', 'Escribir: cambiar el contenido · crear, borrar y renombrar lo de dentro.'],
      ['x · 1', 'Ejecutar: lanzarlo como programa · entrar y usar lo de dentro.'],
      { h: 'En octal: se suman 4, 2 y 1' },
      ['755 · rwxr-xr-x', 'Programas, scripts y carpetas que todos pueden usar.'],
      ['644 · rw-r--r--', 'Documentos que todos pueden leer.'],
      ['750 · rwxr-x---', 'Carpetas que solo usa tu grupo.'],
      ['640 · rw-r-----', 'Documentos que solo lee tu grupo.'],
      ['700 · 600', 'Carpetas y archivos privados.'],
      ['777 · rwxrwxrwx', 'Cualquiera puede hacerlo todo, también borrar o cambiar.'],
    ],
    e: [['ls -l informe.sh', 'Con -rwxr-x---, alumno lo lee, lo cambia y lo ejecuta; su grupo lo lee y lo ejecuta; los demás, nada.']],
    nota: 'Se aplica un solo trío: el del propietario, si lo eres; si no, el del grupo, si estás en él; si no, el de otros. root no está sujeto a los permisos.' },
  { n: 'chmod', f: 'chmod [OPCIÓN]... MODO[,MODO]... FICHERO...', m: 1, k: 'cambiar permisos ejecución octal',
    d: 'Cambia los permisos de un archivo o de un directorio. Solo puede hacerlo su propietario (o root).',
    o: [
      ['u · g · o · a', 'A quién: propietario, grupo, otros o todos.'],
      ['+ · - · =', 'Añade, quita o deja exactamente esos permisos.'],
      ['r · w · x', 'Qué permisos.'],
      ['X', 'x solo a los directorios y a lo que ya era ejecutable.'],
      ['NNN', 'Los nueve permisos de una vez, en octal: ‹chmod 640 notas.txt›.'],
      ['-R', 'Cambia un directorio y todo lo que contiene.'],
    ],
    e: [['chmod u+x informe.sh', 'Da permiso de ejecución al propietario. Después, el script se lanza con ‹./informe.sh›.'], ['chmod g-w,o-r notas.txt', 'Dos cambios a la vez, separados por una coma.']],
    nota: '‹=› quita lo que no nombras: ‹o=› deja a otros sin nada.' },
  { n: 'Permisos especiales', m: 0, k: 'setuid setgid sticky bit carpeta de grupo',
    d: 'Tres permisos más para casos concretos. Su cifra se suma y va delante de las otras tres: ‹chmod 2770 ventas›.',
    o: [
      ['setuid · u+s · 4', 'En un programa: se ejecuta con los permisos de su propietario. Sale una s en la x del propietario: ‹-rwsr-xr-x› (/usr/bin/passwd, 4755).'],
      ['setgid · g+s · 2', 'En un directorio: lo que se crea dentro hereda el grupo del directorio. Sale una s en la x del grupo: ‹drwxrws---›.'],
      ['sticky · +t · 1', 'En un directorio: cada archivo solo lo borra o renombra su propietario. Sale una t en la x de otros: ‹drwxrwxrwt› (/tmp, 1777).'],
    ],
    e: [['sudo chmod 3770 /srv/ventas', 'rwxrwx--- con setgid y sticky bit: una carpeta de grupo donde nadie borra lo de otro.']],
    nota: 'Si debajo no hay x, la letra sale en mayúscula: S o T. Para quitar un especial de un directorio, con letras: ‹chmod g-s›, ‹chmod -t›.' },
  { n: 'umask', f: 'umask [-S] [MÁSCARA]', m: 0, int: 1, k: 'máscara permisos por defecto nuevos archivos',
    d: 'Enseña o cambia la máscara: los permisos que se quitan a todo lo que se crea. Los archivos parten de 666 y los directorios, de 777.',
    o: [
      ['(sin nada)', 'Enseña la máscara. En Ubuntu, la de los usuarios es 0002.'],
      ['-S', 'La enseña en letras: lo que sí se deja.'],
      ['MÁSCARA', 'Cambia la máscara hasta que cierras la terminal. Para siempre, se escribe al final de ~/.bashrc.'],
      { h: 'Cálculo' },
      ['Directorios', '777 menos la máscara: 777 − 033 = 744.'],
      ['Archivos', '666 AND (NOT máscara): con 033 sale 644. En los archivos no vale restar.'],
    ],
    e: [['umask 027', 'Desde ese momento, los archivos nacen con 640 y los directorios con 750.']] },
  { n: 'chown', f: 'chown [-R] USUARIO[:GRUPO] FICHERO...', m: 1, k: 'propietario dueño cambiar grupo',
    d: 'Cambia el propietario de un archivo y, con dos puntos, también el grupo. Solo puede hacerlo root.',
    o: [
      ['-R', 'Cambia una carpeta y todo lo que contiene.'],
    ],
    e: [['sudo chown luis:ventas informe.txt', 'informe.txt pasa a ser de luis y del grupo ventas.']] },
  { n: 'chgrp', f: 'chgrp [-R] GRUPO FICHERO...', m: 0, k: 'grupo cambiar',
    d: 'Cambia solo el grupo. El propietario puede hacerlo sin sudo si está en el grupo nuevo.',
    o: [
      ['-R', 'Cambia una carpeta y todo lo que contiene.'],
    ],
    e: [['sudo chgrp -R ventas /srv/ventas', 'La carpeta y todo lo de dentro pasan al grupo ventas.']] },
]},

{ g: 'Cambiar de usuario', f: [
  { n: 'su', f: 'su [-] [USUARIO]', m: 0, k: 'cambiar usuario sustituir',
    d: 'Abre una shell como otro usuario. Pide la contraseña de ese usuario. ‹exit› vuelve al anterior.',
    o: [
      ['-', 'Hace además lo mismo que un inicio de sesión: va a la carpeta del usuario y carga su configuración.'],
      ['(sin usuario)', 'Intenta entrar como root. En Ubuntu falla, porque la cuenta de root está bloqueada.'],
    ],
    e: [['su - ana', 'Entra como ana, en /home/ana y con su configuración.']] },
]},

{ g: 'Cuentas de usuario y grupos', f: [
  { n: 'Archivos de las cuentas', m: 0, k: 'passwd shadow group gshadow skel uid gid usuarios',
    d: 'Las cuentas se guardan en archivos de texto: una línea por cuenta y los campos separados por dos puntos. No se editan a mano: para eso están las órdenes de cuentas.',
    o: [
      ['/etc/passwd', 'Los usuarios: nombre:x:UID:GID:datos:carpeta:shell. Lo leen todos.'],
      ['/etc/shadow', 'Las contraseñas, guardadas como hash (un resumen que no se puede deshacer). Solo lo leen root y el grupo shadow.'],
      ['/etc/group', 'Los grupos y sus miembros secundarios.'],
      ['/etc/gshadow', 'Las contraseñas y los administradores de los grupos. Solo lo leen root y el grupo shadow.'],
      ['/etc/skel', 'Lo que se copia a la carpeta de cada usuario nuevo.'],
      { h: 'Números de usuario (UID)' },
      ['0', 'root, el administrador.'],
      ['1 a 999', 'Usuarios del sistema: los usan los servicios y no inician sesión.'],
      ['1000 en adelante', 'Usuarios normales. El creado al instalar tiene el 1000.'],
    ],
    e: [['cut -d: -f1,3 /etc/passwd', 'El nombre y el UID de cada usuario.']],
    nota: 'Si la shell de un usuario es /usr/sbin/nologin, no puede iniciar sesión.' },
  { n: 'adduser', f: 'sudo adduser [OPCIÓN]... USUARIO [GRUPO]', m: 0, k: 'crear usuario cuenta nueva',
    d: 'Crea un usuario en un solo paso: su grupo, su UID, su carpeta con lo de /etc/skel y su contraseña. Intro deja en blanco los datos personales.',
    o: [
      ['--ingroup GRUPO', 'Usa como grupo primario uno que ya existe.'],
      ['--gid GID', 'Lo mismo, con el número del grupo.'],
      ['--home RUTA', 'Elige otra carpeta personal.'],
      ['USUARIO GRUPO', 'Con dos nombres, mete en el grupo a un usuario que ya existe.'],
    ],
    e: [['sudo adduser luis', 'Crea el usuario luis, su grupo luis y /home/luis.'], ['sudo adduser luis ventas', 'Mete a luis en el grupo ventas.']] },
  { n: 'deluser', f: 'sudo deluser [OPCIÓN] USUARIO [GRUPO]', m: 0, k: 'borrar usuario eliminar cuenta',
    d: 'Borra una cuenta. Sin opciones, su carpeta se queda. No borra a un usuario que tiene procesos en marcha.',
    o: [
      ['--remove-home', 'Borra también la carpeta personal.'],
      ['--remove-all-files', 'Borra todos sus archivos, estén donde estén.'],
      ['USUARIO GRUPO', 'Con dos nombres, saca al usuario del grupo.'],
    ],
    e: [['sudo deluser --remove-home luis', 'Borra la cuenta de luis y /home/luis.']] },
  { n: 'addgroup', f: 'sudo addgroup GRUPO', m: 0, k: 'crear grupo',
    d: 'Crea un grupo.',
    e: [['sudo addgroup ventas', 'Crea el grupo ventas.']] },
  { n: 'delgroup', f: 'sudo delgroup GRUPO', m: 0, k: 'borrar grupo',
    d: 'Borra un grupo. No borra el grupo primario de nadie.',
    e: [['sudo delgroup ventas', 'Borra el grupo ventas.']] },
  { n: 'usermod', f: 'sudo usermod OPCIÓN... USUARIO', m: 0, k: 'modificar usuario grupos shell carpeta',
    d: 'Cambia los datos de una cuenta que ya existe.',
    o: [
      ['-aG GRUPO', 'Añade un grupo secundario sin quitar los otros (a de append, añadir).'],
      ['-g GRUPO', 'Cambia el grupo primario.'],
      ['-s SHELL', 'Cambia la shell de inicio.'],
      ['-d CARPETA -m', 'Cambia la carpeta personal y mueve lo que tenía.'],
      ['-l NOMBRE', 'Cambia el nombre de usuario.'],
      ['-u UID', 'Cambia el UID.'],
    ],
    e: [['sudo usermod -aG ventas luis', 'Mete a luis en ventas sin sacarlo de sus otros grupos.']],
    nota: '‹-G› sin ‹-a› sustituye todos los grupos secundarios: el usuario puede quedarse fuera del grupo sudo.' },
  { n: 'groupmod', f: 'sudo groupmod OPCIÓN GRUPO', m: 0, k: 'modificar grupo nombre gid',
    d: 'Cambia los datos de un grupo.',
    o: [
      ['-n NOMBRE', 'Cambia el nombre del grupo.'],
      ['-g GID', 'Cambia el GID del grupo.'],
    ],
    e: [['sudo groupmod -n comercial ventas', 'El grupo ventas pasa a llamarse comercial.']] },
  { n: 'gpasswd', f: 'sudo gpasswd [OPCIÓN] GRUPO', m: 0, k: 'añadir quitar usuario grupo contraseña',
    d: 'Mete y saca usuarios de un grupo. Sin opciones, pone una contraseña al grupo.',
    o: [
      ['-a USUARIO', 'Mete al usuario en el grupo.'],
      ['-d USUARIO', 'Saca al usuario del grupo.'],
    ],
    e: [['sudo gpasswd -d luis ventas', 'Saca a luis del grupo ventas.']] },
  { n: 'groups', f: 'groups [USUARIO]', m: 0, k: 'grupos usuario',
    d: 'Enumera los grupos de un usuario; sin nombre, los tuyos.',
    e: [['groups luis', 'Escribe los grupos de luis, por ejemplo «luis : luis ventas compras».']] },
  { n: 'chfn', f: 'chfn [-f NOMBRE] [USUARIO]', m: 0, k: 'datos personales nombre completo teléfono',
    d: 'Cambia los datos personales de una cuenta: nombre completo, despacho y teléfonos. Sin sudo, solo los tuyos.',
    o: [
      ['-f NOMBRE', 'Cambia el nombre completo.'],
    ],
    e: [['sudo chfn -f "Luis Pérez" luis', 'Pone «Luis Pérez» como nombre completo de luis.']] },
  { n: 'chsh', f: 'chsh -s SHELL [USUARIO]', m: 0, k: 'cambiar shell inicio',
    d: 'Cambia la shell de inicio por otra de las que hay en /etc/shells.',
    o: [
      ['-s SHELL', 'La shell nueva.'],
    ],
    e: [['chsh -s /bin/sh', 'Tu shell de inicio pasa a ser sh.']] },
  { n: 'newgrp', f: 'newgrp GRUPO', m: 0, k: 'grupo primario temporal',
    d: 'Abre una shell con otro grupo como primario, hasta ‹exit›. Lo que crees mientras tanto nace de ese grupo. Solo funciona con tus propios grupos.',
    e: [['newgrp ventas', 'Lo que crees a continuación será del grupo ventas.']] },
  { n: 'mkpasswd', f: 'mkpasswd -m ALGORITMO -S SAL', m: 0, inst: 'whois', k: 'hash contraseña sal cifrar',
    d: 'Calcula el hash de una contraseña con el algoritmo y la sal que se le digan. La sal son unos caracteres al azar que hacen que dos contraseñas iguales den hashes distintos.',
    o: [
      ['-m ALGORITMO', 'El algoritmo: sha-512.'],
      ['-S SAL', 'La sal: con sha-512, de 8 a 16 caracteres.'],
    ],
    e: [['mkpasswd -m sha-512 -S salsal12', 'Pide la contraseña y escribe su hash. Con la misma contraseña y la misma sal, sale siempre lo mismo.']] },
]},

{ g: 'Ver los procesos', f: [
  { n: 'ps', f: 'ps [OPCIÓN]...', m: 1, k: 'procesos pid listar ejecución',
    d: 'Hace una foto de los procesos en el momento en que se ejecuta. Un proceso es un programa en ejecución; cada uno tiene un número, el PID, y lo crea otro, su padre (PPID).',
    o: [
      ['(sin nada)', 'Los procesos de esta terminal.'],
      ['-e · -A', 'Todos los del sistema.'],
      ['-f', 'Formato completo: propietario, PID, PPID, hora y orden.'],
      ['-ely', 'Formato largo, con la prioridad (columna NI).'],
      ['aux', 'Todos, con %CPU, %MEM y estado. Va sin guion.'],
    ],
    e: [['ps aux | grep sleep', 'Los procesos sleep. La última línea es el propio grep.']] },
  { n: 'Estados de un proceso', m: 0, k: 'stat estado zombi dormido detenido',
    d: 'La columna STAT de ‹ps aux› dice el estado con una letra.',
    o: [
      ['R', 'En ejecución, o listo para ejecutarse.'],
      ['S', 'Dormido: espera algo (una tecla, un dato, que pase el tiempo).'],
      ['D', 'Esperando al disco u otro dispositivo; no se puede interrumpir.'],
      ['T', 'Detenido, hasta que alguien lo reanude.'],
      ['Z', 'Zombi: ha terminado, pero su padre aún no lo ha recogido.'],
      ['I', 'Hilo del núcleo sin trabajo.'],
      ['< · N · +', 'Detrás: prioridad alta, prioridad baja, ocupa la terminal.'],
    ],
    e: [['man ps', 'La tabla completa se busca con ‹/STATE›.']] },
  { n: 'pstree', f: 'pstree [OPCIÓN]...', m: 0, k: 'árbol procesos padre hijo systemd',
    d: 'Dibuja el árbol de procesos: de quién cuelga cada uno. Arriba está systemd, el primer proceso, con PID 1.',
    o: [
      ['-p', 'Enseña los PID.'],
      ['-u', 'Enseña dónde un proceso cambia de usuario.'],
    ],
    e: [['pstree -p', 'El árbol con los PID: tu bash y el pstree que cuelga de él.']] },
  { n: 'htop', f: 'htop', m: 0, inst: 'htop', k: 'procesos colores ratón',
    d: 'Hace lo mismo que top, con colores y ratón.',
    e: [['htop', 'Abre el monitor de procesos. Sale con q o F10.']] },
]},

{ g: 'Actuar sobre los procesos', f: [
  { n: 'sleep', f: 'sleep SEGUNDOS', m: 0, k: 'esperar pausa',
    d: 'Espera los segundos que se le digan y termina. No estropea nada: sirve para practicar con procesos.',
    e: [['sleep 60', 'Ocupa la terminal un minuto.']] },
  { n: '& · jobs · fg · bg', f: 'ORDEN &   jobs   fg %N   bg %N', m: 0, int: 1, k: 'segundo plano primer plano trabajos detener reanudar ctrl+z',
    d: 'Una orden en primer plano ocupa la terminal hasta que acaba. Con & al final, va al segundo plano: se ejecuta y la terminal queda libre. Cada una es un trabajo de esta terminal, con su número.',
    o: [
      ['ORDEN &', 'La lanza en segundo plano. Bash enseña su número y su PID: [1] 2345.'],
      ['Ctrl+C', 'Termina la orden de primer plano.'],
      ['Ctrl+Z', 'Detiene la orden de primer plano, sin terminarla.'],
      ['jobs', 'Enumera los trabajos de esta terminal con su número y su estado.'],
      ['fg %N', 'Trae el trabajo N al primer plano.'],
      ['bg %N', 'Reanuda en segundo plano un trabajo detenido.'],
    ],
    e: [['sleep 300 &', 'Lanza sleep en segundo plano: la terminal queda libre.']] },
  { n: 'Señales', m: 0, k: 'señal sigterm sigkill terminar matar',
    d: 'Una señal es un aviso que se envía a un proceso. Cada una tiene un número y un nombre.',
    o: [
      ['15 · SIGTERM', 'Terminar ordenadamente. Es la que se envía si no se dice otra.'],
      ['9 · SIGKILL', 'Terminar a la fuerza, sin poder evitarlo. Es el último recurso.'],
      ['2 · SIGINT', 'Interrumpir. La envía Ctrl+C.'],
      ['20 · SIGTSTP', 'Detenerse. La envía Ctrl+Z.'],
      ['19 · SIGSTOP', 'Detenerse, sin poder evitarlo.'],
      ['18 · SIGCONT', 'Seguir. La envían fg y bg.'],
      ['1 · SIGHUP', 'Se ha cerrado la terminal.'],
    ],
    e: [['man 7 signal', 'El manual de las señales.']] },
  { n: 'kill', f: 'kill [-SEÑAL] PID|%N', m: 1, int: 1, k: 'terminar matar proceso señal',
    d: 'Envía una señal a un proceso. Sin decir cuál, envía la 15, que le pide que termine. Un usuario solo puede enviar señales a sus propios procesos; root, a todos.',
    o: [
      ['-9', 'Envía la 9: termina a la fuerza.'],
      ['-l', 'Enumera todas las señales.'],
      ['%N', 'El trabajo N de esta terminal, en vez de un PID.'],
    ],
    e: [['kill -9 2345', 'Termina a la fuerza el proceso con PID 2345.']],
    nota: '‹man kill› explica /usr/bin/kill; la orden interna de bash está en ‹help kill›.' },
  { n: 'killall', f: 'killall [-SEÑAL] NOMBRE', m: 0, k: 'terminar todos procesos nombre',
    d: 'Envía la señal a todos los procesos que se llaman así. Pide el nombre exacto, no un trozo.',
    e: [['killall sleep', 'Termina todos los procesos sleep.']] },
  { n: 'nohup', f: 'nohup ORDEN &', m: 0, k: 'seguir cerrar terminal segundo plano',
    d: 'Lanza una orden protegida contra la señal de cierre de la terminal: sigue funcionando aunque se cierre. Lo que escriba va al archivo nohup.out.',
    e: [['nohup sleep 600 &', 'sleep sigue vivo después de cerrar la terminal.']] },
  { n: 'nice', f: 'nice -n N ORDEN', m: 0, k: 'prioridad lanzar',
    d: 'Lanza una orden con otra prioridad. El valor nice va de −20 (más prioridad) a 19 (menos); por defecto es 0.',
    o: [
      ['-n N', 'El valor nice.'],
    ],
    e: [['nice -n 10 sleep 900 &', 'Lanza sleep con valor 10: cede el procesador a los demás.']],
    nota: 'Un usuario normal solo puede subir el valor de sus procesos (darles menos prioridad). Bajarlo necesita sudo.' },
  { n: 'renice', f: 'renice -n N -p PID', m: 0, k: 'cambiar prioridad proceso',
    d: 'Cambia el valor nice de un proceso que ya está en marcha. La columna NI de ‹ps -ely› lo enseña.',
    o: [
      ['-n N', 'El valor nuevo.'],
      ['-p PID', 'El proceso.'],
    ],
    e: [['renice -n 15 -p 2500', 'El proceso 2500 pasa a tener valor nice 15.']] },
  { n: 'time', f: 'time ORDEN', m: 0, int: 1, k: 'tiempo tarda medir',
    d: 'Ejecuta la orden y, al acabar, dice cuánto ha tardado. Es una palabra reservada de bash: su ayuda está en ‹help time›.',
    o: [
      ['real', 'El tiempo de reloj, de principio a fin.'],
      ['user', 'El tiempo de procesador que ha usado el programa.'],
      ['sys', 'El tiempo de procesador que ha usado el sistema trabajando para él.'],
    ],
    e: [['time sleep 2', 'real es 2 segundos; user y sys, casi 0: sleep solo espera.']] },
  { n: 'Órdenes en varias líneas', f: 'ORDEN \\', m: 0, k: 'barra invertida continuar línea larga',
    d: 'Una \\ al final de la línea hace que la orden siga en la siguiente. Bash enseña > mientras espera el resto. Se ejecuta al pulsar Intro en la línea que no termina en \\.',
    c: 'find ~/empresa -type f \\\n  -name "*.csv" \\\n  -mtime -7',
    e: [['find ~/empresa -type f -name "*.csv" -mtime -7', 'Es la misma orden en una sola línea.']],
    nota: 'La \\ tiene que ser lo último de la línea: un espacio detrás la estropea.' },
]},

{ g: 'Memoria y registros', f: [
  { n: 'free', f: 'free [-h]', m: 0, k: 'memoria ram swap libre disponible',
    d: 'Dice cuánta memoria RAM y cuánta swap hay, y cuánta se usa. La swap es la parte del disco que hace de memoria cuando la RAM se llena.',
    o: [
      ['-h', 'En K, M y G.'],
    ],
    e: [['free -h', 'La columna disponible es la memoria que pueden usar los programas que abras ahora.']],
    nota: 'Que libre sea pequeña es normal: Linux usa la memoria que sobra como caché (búf/caché) y la devuelve cuando hace falta.' },
  { n: 'Registros del sistema', m: 0, k: 'logs trazas var log auth syslog',
    d: 'Linux apunta lo que pasa en archivos de texto llamados registros (logs), en /var/log. Se leen con less, grep y tail.',
    o: [
      ['/var/log/syslog', 'Mensajes generales del sistema.'],
      ['/var/log/auth.log', 'Inicios de sesión, sudo, su y cambios de cuentas.'],
      ['/var/log/kern.log', 'Mensajes del núcleo.'],
      ['/var/log/dpkg.log', 'Programas instalados y desinstalados.'],
    ],
    e: [['grep COMMAND /var/log/auth.log', 'Todo lo que se ha hecho con sudo: quién, cuándo y qué orden.'], ['tail -f /var/log/auth.log', 'Enseña en directo lo que se va apuntando.']] },
  { n: 'last', f: 'last', m: 0, k: 'inicios sesión arranques quién entró',
    d: 'Enumera los últimos inicios de sesión y los arranques del equipo.',
    e: [['last | head -5', 'Las cinco entradas más recientes.']] },
]},

]},

/* ============================================================ UT7 */
{ ut: 7, t: 'Servicios, scripts, paquetes, tareas e impresión', g: [

{ g: 'Variables y entorno', f: [
  { n: 'Variables', f: 'NOMBRE=VALOR', m: 0, k: 'variable crear valor local entorno',
    d: 'Una variable es un nombre que guarda un valor, que puede cambiar. Se crea dándole un valor, sin espacios alrededor del =, y se usa con $ delante.',
    o: [
      ['nombre=Ana', 'Crea la variable o cambia su valor.'],
      ['$nombre', 'Se cambia por su valor.'],
      ['"Hola, $nombre"', 'Dentro de comillas dobles también se cambia.'],
      ["'Hola, $nombre'", 'Dentro de comillas simples no: sale tal cual.'],
      { h: 'Dónde vive' },
      ['Local', 'Solo existe en la terminal donde se creó.'],
      ['De entorno', 'La reciben también los programas que se abren desde esa terminal (sus procesos hijos).'],
    ],
    e: [['saludo="Buenos días"', 'El valor lleva espacios: va entre comillas.']],
    nota: 'Mayúsculas y minúsculas cuentan: ‹nombre› y ‹NOMBRE› son dos variables.' },
  { n: 'set', f: 'set', m: 0, int: 1, k: 'variables locales listar',
    d: 'Enseña todas las variables de la terminal, locales y de entorno, y también las funciones. Saca cientos de líneas.',
    e: [['set | grep ciudad', 'Solo la variable ciudad, aunque sea local.']] },
  { n: 'export', f: 'export NOMBRE[=VALOR]', m: 0, int: 1, k: 'variable entorno exportar path',
    d: 'Convierte una variable en variable de entorno: la recibirán los programas que se abran después desde esa terminal. Sin nada detrás, enseña las exportadas.',
    e: [['export PATH=$PATH:$HOME/empresa/scripts', 'Añade la carpeta de tus scripts al final del PATH: ‹$PATH:› pone lo que había, y detrás va la carpeta nueva.']],
    nota: '‹PATH=$HOME/scripts›, sin ‹$PATH:›, deja la lista solo con esa carpeta: ya no funciona ni ‹ls›. Se arregla cerrando la terminal.' },
  { n: 'unset', f: 'unset NOMBRE', m: 0, int: 1, k: 'borrar variable',
    d: 'Borra una variable.',
    e: [['unset ciudad', 'Borra la variable ciudad: ‹echo $ciudad› escribe una línea vacía.']] },
  { n: '$( )', f: '$(ORDEN)', m: 0, k: 'sustitución salida orden fecha variable',
    d: 'Se cambia por lo que escribe esa orden. Sirve para meter el resultado de una orden en un texto o en una variable.',
    e: [['fecha=$(date +%Y%m%d)', 'Guarda la fecha como 20270302 en la variable fecha.'], ['echo "Hoy es $(date +%A)"', 'Escribe, por ejemplo, «Hoy es martes».']],
    nota: 'En date, ‹%m› es el mes y ‹%M›, los minutos. ‹%F› es lo mismo que ‹%Y-%m-%d›.' },
  { n: 'source', f: 'source ARCHIVO', m: 0, int: 1, k: 'aplicar cambios bashrc recargar',
    d: 'Ejecuta un archivo en la terminal actual. Sirve para aplicar los cambios de ~/.bashrc sin cerrarla.',
    e: [['source ~/.bashrc', 'Aplica ya lo que se haya cambiado en .bashrc.']] },
  { n: 'Archivos de inicio de bash', m: 0, k: 'profile bashrc environment locale inicio sesión',
    d: 'Para que una variable o un alias duren, se escriben en un archivo que bash ejecuta él solo. Los de /etc valen para todos los usuarios; los de tu carpeta, solo para ti.',
    o: [
      { h: 'Al iniciar sesión' },
      ['/etc/environment', 'El PATH de todos.'],
      ['/etc/default/locale', 'El idioma (LANG).'],
      ['/etc/profile · ~/.profile', 'Órdenes de inicio de sesión.'],
      { h: 'Cada vez que abres una terminal' },
      ['/etc/bash.bashrc · ~/.bashrc', 'Alias, prompt y variables de la terminal.'],
      { h: 'Al cerrar la sesión' },
      ['~/.bash_logout', 'Órdenes de salida.'],
    ],
    e: [["echo 'export PATH=$PATH:$HOME/empresa/scripts' >> ~/.bashrc", 'Lo añade al final de .bashrc, entre comillas simples para que no se cambie aún.']],
    nota: 'La Terminal del escritorio no inicia sesión: solo lee ~/.bashrc. Inician sesión las consolas de texto, SSH y ‹su -›.' },
]},

{ g: 'Scripts', f: [
  { n: 'Script', f: '#!/bin/bash', m: 0, k: 'script programa shebang comentario ejecutar',
    d: 'Un script es un archivo de texto con órdenes de la shell. Bash las ejecuta una a una, de arriba abajo, como si las escribieras tú.',
    cn: 'hola.sh', c: '#!/bin/bash\n# Saluda al usuario\necho "Hola, mundo"',
    o: [
      ['#!/bin/bash', 'Primera línea: el programa que ejecuta el script (se lee shebang).'],
      ['# texto', 'Comentario: bash no lo ejecuta.'],
      ['chmod u+x hola.sh', 'Da permiso de ejecución.'],
      ['./hola.sh', 'Lo ejecuta con su ruta. Sin ./, bash lo busca en el PATH.'],
      ['bash hola.sh', 'Lo ejecuta aunque no tenga permiso de ejecución.'],
      ['bash -x hola.sh', 'Enseña cada orden, ya con los valores puestos, antes de ejecutarla. Así se ve dónde falla.'],
      ['exit N', 'Termina el script con el código N: 0 si ha ido bien, otro número si no.'],
    ],
    e: [['./hola.sh', 'Escribe «Hola, mundo».']] },
  { n: 'Argumentos y variables especiales', f: './SCRIPT ARG1 ARG2...', m: 0, k: 'argumentos parámetros $1 $# $? shift',
    d: 'Un script recibe datos al ejecutarlo: se escriben detrás de su nombre y se llaman argumentos. Bash rellena él solo estas variables.',
    cn: 'presenta.sh', c: '#!/bin/bash\necho "Me llamo $1 y tengo $2 años"',
    o: [
      ['$0', 'El nombre del script, como se escribió.'],
      ['$1 · $2…', 'Cada argumento: el primero, el segundo…'],
      ['$#', 'Cuántos argumentos hay.'],
      ['$*', 'Todos los argumentos juntos.'],
      ['$?', 'El código de salida de la última orden: 0 si ha ido bien.'],
      ['$$', 'El PID del proceso del script.'],
      ['shift', 'Quita el primer argumento y corre los demás: el que era $2 pasa a ser $1.'],
    ],
    e: [['./presenta.sh Ana 17', 'Escribe «Me llamo Ana y tengo 17 años». Un argumento con espacios va entre comillas.']] },
  { n: 'read', f: 'read [-p "PREGUNTA"] VARIABLE', m: 0, int: 1, k: 'leer teclado preguntar entrada usuario',
    d: 'Para el script, espera a que el usuario escriba algo y pulse Intro, y lo guarda en una variable. Sin nombre de variable, lo guarda en REPLY.',
    o: [
      ['-p "TEXTO"', 'Enseña antes una pregunta.'],
    ],
    e: [['read -p "¿Cómo te llamas? " nombre', 'Pregunta el nombre y lo guarda en la variable nombre.']] },
  { n: '[ ] · test', f: '[ CONDICIÓN ]', m: 0, int: 1, k: 'condición comparar test verdadero falso números textos archivos',
    d: 'Comprueba una condición: deja 0 en $? si es verdad y 1 si es mentira. Los espacios dentro de los corchetes son obligatorios. Todas las condiciones están en ‹help test›.',
    o: [
      { h: 'Números enteros' },
      ['-eq · -ne', 'Igual (equal) · distinto (not equal).'],
      ['-lt · -le', 'Menor (less than) · menor o igual.'],
      ['-gt · -ge', 'Mayor (greater than) · mayor o igual.'],
      { h: 'Textos (las variables, entre comillas dobles)' },
      ['"$a" = "$b" · !=', 'Son iguales · son distintos.'],
      ['-z "$a" · -n "$a"', 'El texto está vacío · no está vacío.'],
      { h: 'Archivos' },
      ['-e · -f · -d', 'Existe · es un archivo normal · es un directorio.'],
      ['-L', 'Es un enlace simbólico.'],
      ['-r · -w · -x', 'Tienes permiso de lectura, escritura o ejecución.'],
      ['a -nt b · a -ot b', 'a es más reciente (newer than) · más antiguo (older than) que b.'],
    ],
    e: [['[ 5 -gt 3 ]; echo $?', 'Escribe 0: es verdad.']],
    nota: 'No se usan ‹<› ni ‹>›: en la terminal son redirecciones.' },
  { n: 'Juntar condiciones', f: '&&  ||  !  [[ ]]', m: 0, k: 'y o no and or not condiciones',
    d: 'Con && tienen que ser verdad las dos; con ||, basta con una; ! le da la vuelta.',
    o: [
      ['[ … ] && [ … ]', 'Y: las dos.'],
      ['[ … ] || [ … ]', 'O: basta con una.'],
      ['! [ … ]', 'No: le da la vuelta.'],
      ['-a · -o', 'Y y o dentro de un solo [ ].'],
      ['[[ … ]]', 'La forma moderna de bash: admite && y || dentro y no falla con variables vacías.'],
      ['ORDEN && ORDEN', 'Entre dos órdenes: la segunda solo si la primera va bien.'],
      ['ORDEN || ORDEN', 'La segunda solo si la primera falla: ‹cd carpeta || exit 1›.'],
    ],
    e: [['mkdir copia && echo "Creada"', 'Escribe «Creada» solo si mkdir ha funcionado.']] },
  { n: 'if', f: 'if CONDICIÓN; then … [elif …] [else …] fi', m: 0, int: 1, k: 'decidir si condición else elif',
    d: 'Ejecuta unas órdenes solo si la condición es verdad. elif añade más condiciones, que se comprueban por orden; else, lo que se hace si ninguna es verdad. fi cierra el bloque.',
    cn: 'notas.sh', c: '#!/bin/bash\nnota=$1\nif [ $nota -ge 9 ]; then echo "Sobresaliente"\nelif [ $nota -ge 5 ]; then echo "Aprobado"\nelse echo "Suspenso"\nfi',
    e: [['./notas.sh 7', 'Escribe «Aprobado»: la primera condición es mentira y la segunda, verdad.']],
    nota: '‹then› en la misma línea que ‹if› necesita el ‹;› antes.' },
  { n: 'case', f: 'case $VARIABLE in PATRÓN) … ;; esac', m: 0, int: 1, k: 'elegir opciones menú patrón',
    d: 'Compara una variable con varios patrones y ejecuta la rama del primero que encaja. Cada rama termina con ;;. | separa varios patrones y * encaja con todo. esac cierra.',
    cn: 'dia.sh', c: '#!/bin/bash\ndia=$1\ncase $dia in\n    lunes) echo "Organiza la semana" ;;\n    sabado|domingo) echo "Descansa" ;;\n    *) echo "Sigue con tu plan" ;;\nesac',
    e: [['./dia.sh domingo', 'Escribe «Descansa».']] },
  { n: 'for', f: 'for VARIABLE in LISTA; do … done', m: 0, int: 1, k: 'bucle repetir lista cada',
    d: 'Repite las órdenes una vez por cada elemento de una lista. En cada vuelta, la variable toma el valor siguiente. done cierra el bucle.',
    cn: 'frutas.sh', c: '#!/bin/bash\nfor fruta in manzana pera naranja; do\n    echo "Me gusta la $fruta"\ndone',
    o: [
      ['{1..5}', 'Un rango de números.'],
      ['*.txt', 'Un comodín: una vuelta por cada archivo.'],
    ],
    e: [['for f in *.txt; do wc -l "$f"; done', 'Cuenta las líneas de cada .txt de la carpeta.']] },
  { n: 'while', f: 'while CONDICIÓN; do … done', m: 0, int: 1, k: 'bucle mientras repetir',
    d: 'Repite las órdenes mientras la condición sea verdad. Si nunca deja de serlo, el bucle no acaba: se corta con Ctrl+C.',
    cn: 'cuenta.sh', c: '#!/bin/bash\nn=3\nwhile [ $n -gt 0 ]; do\n    echo $n\n    n=$((n - 1))\ndone',
    e: [['./cuenta.sh', 'Escribe 3, 2 y 1, uno por línea.']],
    nota: '‹RANDOM› da un número al azar distinto cada vez: ‹$((RANDOM % 10 + 1))› queda entre 1 y 10.' },
  { n: '$(( ))', f: '$((EXPRESIÓN))', m: 0, k: 'cuentas aritmética sumar restar contador',
    d: 'Hace cuentas con números enteros y se cambia por el resultado. Dentro no hace falta poner $ a las variables.',
    o: [
      ['+ · -', 'Suma y resta.'],
      ['*', 'Multiplicación.'],
      ['/', 'División entera: ‹$((7 / 2))› da 3.'],
      ['%', 'El resto de la división: ‹$((7 % 2))› da 1.'],
    ],
    e: [['n=$((n + 1))', 'Suma uno al contador n.']] },
  { n: 'Funciones', f: 'NOMBRE() { … }', m: 0, k: 'función reutilizar',
    d: 'Una función es un grupo de órdenes con nombre. Se define antes de usarla y después se usa como una orden nueva. Recibe argumentos igual que un script: $1, $2, $#.',
    cn: 'bienvenida.sh', c: '#!/bin/bash\nsaluda() {\n    echo "Hola, $1. Bienvenida a la empresa."\n}\nsaluda Ana\nsaluda Marta',
    e: [['./bienvenida.sh', 'Escribe el saludo dos veces, con Ana y con Marta.']],
    nota: 'También se escribe ‹function saluda { … }›.' },
]},

{ g: 'Servicios y arranque', f: [
  { n: 'Niveles de ejecución y targets', m: 0, k: 'runlevel target modo rescate gráfico',
    d: 'Un nivel de ejecución (runlevel) dice qué funciona en el equipo. systemd los cambia por targets: grupos de servicios que se arrancan juntos.',
    o: [
      ['0 · poweroff.target', 'Apagar.'],
      ['1 o S · rescue.target', 'Rescate: solo root, sin red.'],
      ['2, 3, 4 · multi-user.target', 'Varios usuarios, sin escritorio.'],
      ['5 · graphical.target', 'Con escritorio.'],
      ['6 · reboot.target', 'Reiniciar.'],
    ],
    e: [['systemctl get-default', 'Escribe graphical.target.']] },
  { n: 'runlevel', f: 'runlevel', m: 0, k: 'nivel ejecución actual',
    d: 'Dice el nivel de ejecución anterior y el actual.',
    e: [['runlevel', 'Escribe N 5: no había nivel anterior (N) y el actual es el 5.']] },
  { n: 'journalctl', f: 'journalctl [OPCIÓN]...', m: 0, k: 'diario registro servicios mensajes errores',
    d: 'Lee el diario de systemd, donde se guardan los mensajes de todos los servicios. Para leerlo entero hay que ser administrador o estar en el grupo adm.',
    o: [
      ['-u SERVICIO', 'Los mensajes de un servicio.'],
      ['-b', 'Desde el último arranque.'],
      ['-p err', 'Solo los errores.'],
      ['-f', 'En directo, según llegan. Ctrl+C sale.'],
      ['--disk-usage', 'Cuánto ocupa el diario.'],
      ['--vacuum-size=100M', 'Deja el diario en 100 MB como mucho (con sudo).'],
    ],
    e: [['journalctl -u cron -b', 'Los mensajes de cron desde el último arranque. Las opciones se juntan.']] },
  { n: 'systemd-analyze', f: 'systemd-analyze blame', m: 0, k: 'arranque lento tiempo servicios',
    d: 'Con blame, ordena los servicios por lo que tardaron en arrancar.',
    e: [['systemd-analyze blame | head -5', 'Los cinco servicios que más tardaron.']] },
  { n: 'uptime', f: 'uptime', m: 0, k: 'tiempo encendido carga media rendimiento',
    d: 'Dice cuánto tiempo lleva encendido el equipo, cuántos usuarios hay y la carga media en el último minuto y en los últimos 5 y 15. La carga media es cuántos procesos usan el procesador o esperan para usarlo.',
    e: [['uptime', 'Si la carga pasa del número de núcleos, hay procesos haciendo cola.']] },
  { n: 'shutdown', f: 'sudo shutdown [OPCIÓN] [CUÁNDO] ["MENSAJE"]', m: 0, k: 'apagar reiniciar programar',
    d: 'Apaga o reinicia el equipo, ahora o más tarde, avisando a los usuarios.',
    o: [
      ['-h', 'Apaga.'],
      ['-r', 'Reinicia.'],
      ['now', 'Ahora.'],
      ['+MIN', 'Dentro de MIN minutos.'],
      ['-c', 'Cancela un apagado programado.'],
    ],
    e: [['sudo shutdown -h +15 "Mantenimiento"', 'Apaga dentro de 15 minutos y avisa con ese mensaje.']],
    nota: '‹shutdown -h› apaga, no suspende. Para suspender: ‹systemctl suspend›.' },
  { n: 'poweroff · reboot · halt', f: 'sudo poweroff', m: 0, k: 'apagar reiniciar parar',
    d: 'poweroff apaga, reboot reinicia y halt para el sistema sin cortar la corriente.',
    e: [['sudo reboot', 'Reinicia el equipo ahora.']] },
]},

{ g: 'Paquetes', f: [
  { n: 'apt-get', f: 'sudo apt-get ORDEN [PAQUETE]', m: 0, k: 'paquetes scripts',
    d: 'Hace lo mismo que apt, con una salida que no cambia entre versiones. Se usa en los scripts.',
    e: [['sudo apt-get update', 'Descarga la lista de paquetes, como apt update.']] },
  { n: 'dpkg', f: 'dpkg OPCIÓN [PAQUETE|ARCHIVO]', m: 0, k: 'paquete deb instalado archivos de qué paquete',
    d: 'Instala y consulta paquetes .deb uno a uno. No resuelve las dependencias: apt va por encima y lo hace.',
    o: [
      ['-i ARCHIVO.deb', 'Instala un .deb (con sudo). Si falta una dependencia, da error y queda a medias.'],
      ['-l', 'Lista los instalados con su estado: ii instalado; rc quitado, pero con su configuración.'],
      ['-L PAQUETE', 'Los archivos que instaló un paquete.'],
      ['-S RUTA', 'De qué paquete es un archivo.'],
    ],
    e: [['dpkg -S /usr/bin/nano', 'Dice que /usr/bin/nano es del paquete nano.']] },
  { n: 'snap', f: 'snap ORDEN [NOMBRE]', m: 0, k: 'snap store paquete aislado',
    d: 'Maneja los snaps: paquetes de la Snap Store que llevan dentro todo lo que necesitan, funcionan aislados y se actualizan solos. Firefox y el App Center son snaps.',
    o: [
      ['list', 'Los snaps instalados.'],
      ['install NOMBRE', 'Instala un snap (con sudo).'],
      ['remove NOMBRE', 'Lo quita (con sudo).'],
      ['refresh', 'Los actualiza ahora (con sudo).'],
    ],
    e: [['snap list', 'Los snaps instalados con su versión.']] },
  { n: 'rpm · yum · dnf', f: 'rpm -i PAQUETE.rpm', m: 0, k: 'red hat fedora suse paquetes rpm',
    d: 'Son las órdenes de paquetes de otra familia de distribuciones: Red Hat, Fedora y SUSE, que usan el formato .rpm. No funcionan en Ubuntu.',
    o: [
      ['rpm -i PAQUETE.rpm', 'Instala un .rpm, como dpkg -i.'],
      ['yum install PAQUETE', 'El gestor de Red Hat 7 y CentOS 7, como apt.'],
      ['dnf install PAQUETE', 'El que sustituye a yum en Fedora y en Red Hat 8 y siguientes.'],
    ],
    e: [['sudo dnf install htop', 'En Fedora, instala htop.']] },
]},

{ g: 'Empaquetar y comprimir', f: [
  { n: 'tar', f: 'tar -OPCIONES PAQUETE [ARCHIVO]...', m: 1, k: 'empaquetar comprimir descomprimir copia tgz',
    d: 'Empaqueta: junta muchos archivos y carpetas en uno solo, que no ocupa menos. Con z, además lo comprime con gzip: sale un .tar.gz (o .tgz).',
    o: [
      ['-c', 'Crea un paquete.'],
      ['-x', 'Extrae lo que tiene.'],
      ['-t', 'Enseña lo que contiene.'],
      ['-v', 'Enseña cada archivo mientras trabaja.'],
      ['-f NOMBRE', 'El nombre del paquete, que va justo detrás: la f va la última.'],
      ['-z', 'Comprime o descomprime con gzip.'],
      ['-C CARPETA', 'Extrae en otra carpeta, o empaqueta desde ella.'],
    ],
    e: [['tar -zcvf datos.tar.gz datos', 'Empaqueta y comprime la carpeta datos.'], ['tar -zxvf datos.tar.gz -C /tmp/prueba', 'Lo extrae dentro de /tmp/prueba, que tiene que existir.']] },
  { n: 'gzip', f: 'gzip [OPCIÓN] ARCHIVO', m: 0, k: 'comprimir descomprimir gz',
    d: 'Comprime un archivo: queda ARCHIVO.gz y desaparece el original. Trabaja con archivos sueltos: no junta varios en uno.',
    o: [
      ['-d', 'Descomprime, como gunzip.'],
      ['-r', 'Comprime por separado cada archivo de la carpeta.'],
    ],
    e: [['gzip informe.txt', 'Queda informe.txt.gz, que ocupa menos.']] },
  { n: 'gunzip', f: 'gunzip ARCHIVO.gz', m: 0, k: 'descomprimir gz',
    d: 'Descomprime un .gz.',
    e: [['gunzip informe.txt.gz', 'Vuelve a quedar informe.txt.']] },
  { n: 'zip', f: 'zip [-r] ARCHIVO.zip ARCHIVO...', m: 0, k: 'comprimir empaquetar windows',
    d: 'Empaqueta y comprime a la vez en un .zip, que se abre también en Windows.',
    o: [
      ['-r', 'Incluye las carpetas con todo lo que tienen dentro.'],
    ],
    e: [['zip -r fotos.zip fotos', 'Mete la carpeta fotos en fotos.zip.']] },
  { n: 'unzip', f: 'unzip [-l] ARCHIVO.zip', m: 0, k: 'extraer descomprimir zip',
    d: 'Extrae un .zip.',
    o: [
      ['-l', 'Enseña lo que tiene, sin extraer.'],
    ],
    e: [['unzip -l fotos.zip', 'La lista de archivos de fotos.zip.']] },
]},

{ g: 'Programar tareas', f: [
  { n: 'crontab', f: 'crontab [OPCIÓN]', m: 0, k: 'cron programar tarea automática hora',
    d: 'Cada usuario tiene su tabla de tareas programadas, su crontab. El servicio cron mira cada minuto si toca ejecutar alguna.',
    o: [
      ['-e', 'Edita tu tabla. La primera vez pregunta qué editor usar.'],
      ['-l', 'Enseña tu tabla.'],
      ['-r', 'Borra tu tabla entera, sin preguntar.'],
    ],
    e: [['crontab -l', 'Las tareas programadas de tu usuario.']] },
  { n: 'Línea de crontab', f: 'MIN HORA DÍA MES DÍA-SEMANA ORDEN', m: 0, k: 'campos minuto hora día cron formato',
    d: 'Una línea de crontab tiene cinco campos de tiempo y después la orden. El formato completo está en ‹man 5 crontab›.',
    o: [
      ['minuto', 'De 0 a 59.'],
      ['hora', 'De 0 a 23.'],
      ['día del mes', 'De 1 a 31.'],
      ['mes', 'De 1 a 12.'],
      ['día de la semana', 'De 0 a 7: 0 y 7 son el domingo.'],
      ['*', 'Cualquiera.'],
      ['1-5 · 1,15 · */10', 'Un rango, una lista y «cada 10».'],
    ],
    e: [['30 14 * * 1-5 /home/alumno/empresa/scripts/copia.sh', 'Ejecuta la copia de lunes a viernes a las 14:30.']],
    nota: 'En crontab, rutas completas y la salida a un archivo: ‹>> /home/alumno/cron.log 2>&1›. /etc/crontab, la tabla del sistema, lleva un campo más, el usuario, entre la hora y la orden.' },
  { n: 'at', f: 'at HORA', m: 0, inst: 'at', k: 'una vez programar hora',
    d: 'Ejecuta una orden una sola vez, a una hora. Se escribe la orden y se termina con Ctrl+D.',
    e: [['at 12:00', 'Lo que escribas a continuación se ejecutará hoy a las 12:00.']] },
]},

{ g: 'Acceso remoto e impresión', f: [
  { n: 'ssh', f: 'ssh [-p PUERTO] USUARIO@EQUIPO', m: 0, k: 'remoto conectar otro equipo servidor cifrado',
    d: 'Entra en otro equipo por la red y usa su terminal. Todo lo que viaja, la contraseña incluida, va cifrado. El cliente viene instalado; el servidor, no.',
    o: [
      ['-p PUERTO', 'El puerto del servidor, si no es el 22.'],
    ],
    e: [['ssh -p 2222 alumno@127.0.0.1', 'Desde PowerShell, entra en la máquina virtual por el puerto 2222 que reenvía VirtualBox.']],
    nota: 'Servidor: ‹sudo apt install openssh-server›; ‹systemctl status ssh› dice si está activo.' },
  { n: 'lpstat', f: 'lpstat [-p] [-d]', m: 0, k: 'impresoras predeterminada cups',
    d: 'Enseña las impresoras que conoce CUPS, el servicio de impresión.',
    o: [
      ['-p', 'Las impresoras y su estado.'],
      ['-d', 'La impresora predeterminada.'],
    ],
    e: [['lpstat -p -d', 'Las impresoras y cuál es la predeterminada.']],
    nota: 'Impresora que guarda en PDF: ‹sudo apt install printer-driver-cups-pdf›.' },
  { n: 'lp · lpr', f: 'lp ARCHIVO', m: 0, k: 'imprimir',
    d: 'Mandan un archivo a la impresora. El trabajo espera en una cola, /var/spool/cups, hasta que la impresora está libre.',
    e: [['lp informe.txt', 'Imprime informe.txt en la impresora predeterminada.']] },
  { n: 'lpq', f: 'lpq', m: 0, k: 'cola impresión trabajos',
    d: 'Enseña la cola de impresión: los trabajos que esperan, con su número.',
    e: [['lpq', 'Los trabajos pendientes.']] },
  { n: 'lprm · cancel', f: 'lprm NÚMERO', m: 0, k: 'cancelar quitar trabajo impresión',
    d: 'Quitan un trabajo de la cola de impresión.',
    e: [['cancel 3', 'Quita de la cola el trabajo 3.']] },
]},

]},

];

/* ============================================================ página */
if (typeof module !== 'undefined' && module.exports) { module.exports = HOJA; module.exports.PUBLICADO_HASTA = PUBLICADO_HASTA; }
else (function () {
  const UTS = HOJA.map((u) => u.ut);
  const PUB = Math.min(+String(PUBLICADO_HASTA).replace(/\D/g, '') || UTS[0], UTS[UTS.length - 1]);
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = (t) => esc(t).replace(/‹([^›]+)›/g, '<code>$1</code>');
  const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'orden';
  const pill = (ut, base) => (ut && ut > base ? `<span class="utp" title="Se añade en la UT${ut}">UT${ut}</span>` : '');

  // ids únicos
  const ids = new Set();
  HOJA.forEach((u) => u.g.forEach((g) => g.f.forEach((f) => {
    let id = slug(f.n);
    while (ids.has(id)) id += '-b';
    ids.add(id); f.id = id; f.ut = u.ut;
  })));

  // la ficha tal como queda hasta la unidad «h»: lo añadido después no sale
  function vista(f, h) {
    const x = (f.x || []).filter((e) => e.ut <= h);
    const v = { n: f.n, f: f.f, m: f.m, d: [[f.d, 0]], nota: [], o: [], e: [], c: f.c ? [[f.c, f.cn, 0]] : [] };
    if (f.nota) v.nota.push([f.nota, 0]);
    x.forEach((e) => {
      if (e.f) v.f = e.f;
      if (e.m !== undefined) v.m = e.m;
      if (e.d) v.d.push([e.d, e.ut]);
      if (e.nota) v.nota.push([e.nota, e.ut]);
      if (e.c) v.c.push([e.c, e.cn, e.ut]);
    });
    (f.o || []).forEach((o) => { const ut = Array.isArray(o) ? o[2] : o.ut; if (!ut || ut <= h) v.o.push(o); });
    (f.e || []).forEach((e) => { if (!e[2] || e[2] <= h) v.e.push(e); });
    const partes = [f.n, v.f || '', f.k || ''];
    v.d.forEach((d) => partes.push(d[0])); v.nota.forEach((d) => partes.push(d[0]));
    v.o.forEach((o) => { if (Array.isArray(o)) partes.push(o[0], o[1]); else partes.push(o.h); });
    v.e.forEach((e) => partes.push(e[0], e[1]));
    v.texto = norm(partes.join(' ').replace(/[‹›]/g, ''));
    return v;
  }

  function ficha(f, v) {
    const cls = ['ficha', v.m ? 'memo' : 'cons'];
    if (/^[A-ZÁÉÍÓÚÑ]/.test(f.n)) cls.push('concepto');
    let h = `<article class="${cls.join(' ')}" id="${f.id}">`;
    h += '<header class="fh"><h4 class="fn">' + f.n.split(' · ').map((x) => '<span>' + esc(x) + '</span>').join('<i>·</i>') + '</h4>';
    h += '<span class="marcas">';
    h += v.m ? '<span class="marca m" title="De uso diario: conviene saberla sin mirar">de memoria</span>'
             : '<span class="marca c" title="Se busca en la ayuda cuando hace falta">de consulta</span>';
    if (f.int) h += '<span class="marca i" title="Orden interna de bash: su ayuda está en help">interna</span>';
    h += '</span>';
    if (v.f && v.f !== f.n) h += '<span class="forma"><code>' + esc(v.f) + '</code></span>';
    h += '</header>';
    v.d.forEach((d) => { h += '<p class="fd">' + pill(d[1], f.ut) + fmt(d[0]) + '</p>'; });
    v.c.forEach((c) => { h += '<pre class="cod">' + (c[1] ? '<span class="codn">' + esc(c[1]) + pill(c[2], f.ut) + '</span>' : '') + esc(c[0]) + '</pre>'; });
    if (v.o.length) {
      h += '<dl class="ops">';
      v.o.forEach((o) => {
        if (!Array.isArray(o)) { h += '<dt class="sub">' + fmt(o.h) + pill(o.ut, f.ut) + '</dt>'; return; }
        h += '<dt><code>' + esc(o[0]) + '</code></dt><dd>' + pill(o[2], f.ut) + fmt(o[1]) + '</dd>';
      });
      h += '</dl>';
    }
    v.e.forEach((e, i) => {
      h += '<div class="ej"><span class="ejt">' + (v.e.length > 1 ? 'Ejemplo ' + (i + 1) : 'Ejemplo') + pill(e[2], f.ut) + '</span>';
      h += '<code class="ejo">' + esc(e[0]) + '</code><span class="ejd">' + fmt(e[1]) + '</span></div>';
    });
    if (f.inst) h += '<p class="inst"><b>No viene instalada:</b> <code>sudo apt install ' + esc(f.inst) + '</code></p>';
    v.nota.forEach((n) => { h += '<p class="nota">' + pill(n[1], f.ut) + fmt(n[0]) + '</p>'; });
    return h + '</article>';
  }

  let hasta = PUB, q = '';
  const vistas = {};
  function pinta() {
    let h = '';
    HOJA.filter((u) => u.ut <= hasta).forEach((u) => {
      h += `<section class="ut" data-ut="${u.ut}" id="ut${u.ut}">`;
      h += `<h2 class="utt"><span class="utn">UT${u.ut}</span> ${esc(u.t)}</h2>`;
      h += '<nav class="grupos">' + u.g.map((g, i) => `<a href="#ut${u.ut}-g${i}">${esc(g.g)}</a>`).join('') + '</nav>';
      u.g.forEach((g, i) => {
        h += `<div class="grupo" id="ut${u.ut}-g${i}"><h3 class="gt">${esc(g.g)}</h3><div class="fichas">`;
        g.f.forEach((f) => { const v = vista(f, hasta); vistas[f.id] = v; h += ficha(f, v); });
        h += '</div></div>';
      });
      h += '</section>';
    });
    $('#hoja').innerHTML = h;
  }

  function lee() {
    const p = new URLSearchParams(location.search);
    const m = /^ut?(\d+)$/i.exec(p.get('hasta') || '');
    if (m && UTS.includes(+m[1]) && +m[1] <= PUB) hasta = +m[1];
    q = p.get('q') || '';
  }
  function escribe() {
    const p = new URLSearchParams(location.search);
    p.set('hasta', 'ut' + hasta);
    if (q) p.set('q', q); else p.delete('q');
    history.replaceState(null, '', location.pathname + '?' + p.toString() + location.hash);
  }
  function filtra() {
    // palabras del buscador; las de más de 4 letras se recortan («copiar» encuentra «copia»)
    const pal = norm(q).split(/\s+/).filter(Boolean).map((w) => (w.length > 4 ? w.replace(/(ar|er|ir|es|s)$/, '') : w));
    // si lo buscado es justo el nombre de una orden («ls», «cp»), solo sale su ficha
    const exacta = norm(q.trim());
    const nombres = (el) => el.querySelector('.fn').textContent.split('·').map((x) => norm(x.trim()));
    const porNombre = exacta && [...document.querySelectorAll('.ficha')].some((el) => nombres(el).includes(exacta));
    let total = 0;
    document.querySelectorAll('section.ut').forEach((s) => {
      let vis = 0;
      s.querySelectorAll('.grupo').forEach((gEl) => {
        let vg = 0;
        gEl.querySelectorAll('.ficha').forEach((el) => {
          const ok = porNombre ? nombres(el).includes(exacta) : pal.every((w) => vistas[el.id].texto.includes(w));
          el.hidden = !ok; if (ok) vg++;
        });
        gEl.hidden = vg === 0; vis += vg;
      });
      s.hidden = vis === 0;
      s.querySelector('nav.grupos').hidden = !!q;
      total += vis;
    });
    $('.guia').classList.toggle('buscando', !!q);
    $('#cuenta').textContent = q ? (total === 1 ? '1 ficha' : total + ' fichas') : '';
    $('#vacio').hidden = total !== 0;
  }
  function aplica() {
    document.querySelectorAll('.sel button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.ut === hasta)));
    document.querySelectorAll('.hasta-txt').forEach((e) => { e.textContent = 'hasta la UT' + hasta; });
    document.title = 'Hoja de comandos de Linux · hasta la UT' + hasta;
    const ley = $('#leyenda-ut'); if (ley) ley.hidden = hasta <= UTS[0];
    pinta();
    filtra();
  }

  document.addEventListener('DOMContentLoaded', () => {
    lee();
    const sel = $('.sel');
    sel.innerHTML = UTS.map((u) => (u <= PUB
      ? `<button type="button" data-ut="${u}">UT${u}</button>`
      : `<button type="button" data-ut="${u}" disabled title="En preparación">UT${u}<small>en preparación</small></button>`)).join('');
    sel.addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b || b.disabled) return;
      hasta = +b.dataset.ut; escribe(); aplica();
    });
    const caja = $('#buscar');
    caja.value = q;
    caja.addEventListener('input', () => { q = caja.value.trim(); escribe(); filtra(); });
    $('#imprimir').addEventListener('click', () => window.print());
    escribe();
    aplica();
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  });
})();
