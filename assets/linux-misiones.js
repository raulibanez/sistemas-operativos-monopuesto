/* Simulador de Linux · misiones con semilla (UT4 y UT5).
 *
 * Cada misión es un generador: generar(semilla) devuelve
 *   titulo      nombre de la misión
 *   escenario   lo que se pasa a SOM.linux.crea() (carpetas, archivos, carpeta de inicio)
 *   tareas      [{ html, corta, pista, solucion: [órdenes], comprueba(e) -> true/false, fija, despues }]
 *               html: frase completa con el verbo subrayado (<u>Crea</u>) y los datos en negrita;
 *               corta: la misma tarea en pocas palabras (hoja en papel); comprueba mira el ESTADO del sistema
 *               (e.existe, e.lee, e.lista, e.cwd…), no las órdenes; fija: una vez cumplida se queda cumplida
 *               (las que dependen de la carpeta actual o del historial); despues: índice de la tarea que tiene
 *               que estar cumplida antes
 *   solucion    todas las órdenes, en orden
 *   tarea       enunciado corto de la misión (hoja en papel), con ⟪verbo⟫ y ⟦datos⟧ como las demás hojas
 *   variante, variantes   qué caso ha salido y entre cuántos (SOM.rota)
 * Las pruebas (herramientas/prueba-linux.js) resuelven cada misión con su solución en 300 semillas.
 */
(function (raiz) {
  'use strict';
  const SOM = (raiz.SOM = raiz.SOM || {});
  const L = (SOM.linux = SOM.linux || {});
  const U = L.util;
  const M = (L.misiones = L.misiones || {});
  const b = (t) => `<b>${t}</b>`, u = (t) => `<u>${t}</u>`;
  const VENDEDORES = ['ana', 'luis', 'marta'];
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const lineas = (t) => (t || '').split('\n').filter((l) => l !== '');

  /* Escenarios con nombre para data-escenario (terminal libre y demostraciones; también los usan las pruebas). */
  const CSV = 'Mes,Vendedor,Ventas,Beneficio\nEnero,ana,1200,300\nEnero,luis,950,180\nEnero,marta,1300,350\nFebrero,ana,1100,260\nFebrero,luis,800,120\nFebrero,marta,1250,330\nMarzo,ana,1400,380\nMarzo,luis,1050,210\nMarzo,marta,990,190\n';
  L.escenarios = Object.assign({
    inicio: {},
    empresa: {
      carpetas: ['~/empresa/backups', '~/empresa/scripts'],
      archivos: { '~/empresa/datos/resumen.csv': CSV, '~/empresa/datos/clientes.txt': 'Talleres Pérez\nFrutas Ana\nPapelería Luis\n', '~/empresa/notas.txt': 'Reunión el lunes a las 9.\n' }
    },
    // la máquina de la práctica: disco de 40 GB con ESP de 1 GB, raíz de 25, intercambio de 2 y /home con el resto
    'ubuntu-som': { disco: { tam: 40, swap: 2, orden: ['efi', 'raiz', 'swap', 'home'] } },
    // la misma máquina antes de sudo apt install manpages-es: man en inglés
    'sin-manpages-es': { manEs: false }
  }, L.escenarios || {});

  // contexto de las comprobaciones: consultas sobre el sistema y la sesión
  L.contextoMision = function (sis, sh) {
    const home = sis.home();
    const abs = (r) => (r[0] === '/' ? r : r.replace(/^~(?=\/|$)/, home).replace(/^(?!\/)/, home + '/'));
    return {
      sis, sh, home,
      get cwd() { return sh.pwd; },
      abs,
      existe: (r) => sis.existe(abs(r)),
      esDir: (r) => sis.esDir(abs(r)),
      esArchivo: (r) => sis.esArchivo(abs(r)),
      lee: (r) => sis.leeArchivo(abs(r)),
      lista: (r) => (sis.lista(abs(r)) || []).map((x) => x.nombre),
      stat: (r) => sis.stat(abs(r)),
      historial: () => sh.hist.slice(),
      registro: sis.registro || [],
      enCarpeta: (r) => { const s = sis.stat(abs(r)); return !!s && sis.fs.resuelve(sh.pwd, { uid: 0, gid: 0 }).ino.n === s.ino; }
    };
  };

  /* ---------- UT4 · primeros pasos: history -c, cd, touch, volver ---------- */
  M['primeros-pasos'] = {
    titulo: 'Primeros pasos en la terminal', ut: 'UT4',
    generar(semilla) {
      const r = U.azar(semilla);
      const base = r.elige(['Documentos', 'Escritorio', 'Descargas']);
      const carpeta = r.elige(['apuntes', 'clase', 'trabajos', 'curso']);
      const sub = r.elige(['tema1', 'tema2', 'linux', 'terminal']);
      const archivo = r.elige(['notas.txt', 'resumen.txt', 'pendiente.txt', 'dudas.txt']);
      const ruta = `${base}/${carpeta}/${sub}`;
      const otros = ['Documentos', 'Escritorio', 'Descargas'].filter((x) => x !== base);
      const escenario = {
        carpetas: [`~/${base}/${carpeta}/${sub}`, `~/${base}/${carpeta}/otros`, `~/${otros[0]}/${r.elige(['fotos', 'viejo', 'varios'])}`],
        archivos: { [`~/${base}/${carpeta}/leeme.txt`]: 'Aquí van los apuntes del curso.\n' },
        historial: ['ls', 'cd Documentos', 'pwd', 'cd', 'date']
      };
      const tareas = [
        { html: `${u('Borra')} el historial de órdenes de la terminal.`, corta: 'Borra el historial.', pista: 'history tiene una opción para borrarlo: history -c', solucion: ['history -c'],
          fija: true, comprueba: (e) => e.historial().length === 0 },
        { html: `${u('Entra')} en la carpeta ${b(ruta)}, que está en tu carpeta personal.`, corta: `Entra en ${ruta}.`, pista: `Con una sola orden: cd ${ruta}`, solucion: [`cd ${ruta}`],
          fija: true, comprueba: (e) => e.enCarpeta(`~/${ruta}`) },
        { html: `${u('Crea')} en esa carpeta el archivo vacío ${b(archivo)}.`, corta: `Crea ${archivo} vacío en ${sub}.`, pista: `touch crea un archivo vacío: touch ${archivo}`, solucion: [`touch ${archivo}`],
          comprueba: (e) => e.esArchivo(`~/${ruta}/${archivo}`) && e.lee(`~/${ruta}/${archivo}`) === '' },
        { html: `${u('Vuelve')} a tu carpeta personal.`, corta: 'Vuelve a tu carpeta personal.', pista: 'cd sin nada detrás (o cd ~) te lleva a tu carpeta personal.', solucion: ['cd'],
          fija: true, despues: 1, comprueba: (e) => e.cwd === e.home }
      ];
      return { titulo: this.titulo, escenario, tareas, solucion: tareas.flatMap((t) => t.solucion),
        tarea: `⟪Borra⟫ el historial, ⟪entra⟫ en ⟦${ruta}⟧, ⟪crea⟫ ⟦${archivo}⟧ vacío y ⟪vuelve⟫ a tu carpeta personal.`,
        variante: base + '/' + archivo, variantes: 12 };
    }
  };

  /* ---------- UT5 · estructura de carpetas con mkdir -p y llaves ---------- */
  M['estructura'] = {
    titulo: 'La estructura de la empresa', ut: 'UT5',
    generar(semilla) {
      const r = U.azar(semilla);
      const raizE = r.elige(['empresa', 'oficina', 'negocio']);
      const subs = r.elige([['datos', 'backups', 'scripts'], ['datos', 'copias', 'informes'], ['ventas', 'compras', 'direccion']]);
      const anio = String(r.ent(2025, 2027));
      const meses = r.baraja(['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio']).slice(0, 3);
      const script = r.elige(['informe.sh', 'copia.sh', 'limpia.sh']);
      const d0 = subs[0];
      const tareas = [
        { html: `${u('Crea')} la carpeta ${b(raizE)} en tu carpeta personal.`, corta: `Crea ~/${raizE}.`, pista: `mkdir ${raizE}`, solucion: [`mkdir ${raizE}`],
          comprueba: (e) => e.esDir(`~/${raizE}`) },
        { html: `${u('Crea')} dentro de ${b(raizE)} las carpetas ${b(subs[0])}, ${b(subs[1])} y ${b(subs[2])}.`, corta: `Crea ${subs.join(', ')} dentro de ${raizE}.`,
          pista: `Las llaves escriben los tres nombres por ti: mkdir ${raizE}/{${subs.join(',')}}`, solucion: [`mkdir ${raizE}/{${subs.join(',')}}`],
          comprueba: (e) => subs.every((s) => e.esDir(`~/${raizE}/${s}`)) },
        { html: `${u('Crea')} la carpeta ${b(`${raizE}/${d0}/${anio}/${meses[0]}`)}, con las intermedias que falten.`, corta: `Crea ${raizE}/${d0}/${anio}/${meses[0]}.`,
          pista: `-p crea también las carpetas intermedias: mkdir -p ${raizE}/${d0}/${anio}/${meses[0]}`, solucion: [`mkdir -p ${raizE}/${d0}/${anio}/${meses[0]}`],
          comprueba: (e) => e.esDir(`~/${raizE}/${d0}/${anio}/${meses[0]}`) },
        { html: `${u('Crea')} también, junto a ${b(meses[0])}, las carpetas ${b(meses[1])} y ${b(meses[2])}.`, corta: `Crea ${meses[1]} y ${meses[2]} junto a ${meses[0]}.`,
          pista: `mkdir ${raizE}/${d0}/${anio}/{${meses[1]},${meses[2]}}`, solucion: [`mkdir ${raizE}/${d0}/${anio}/{${meses[1]},${meses[2]}}`],
          comprueba: (e) => e.esDir(`~/${raizE}/${d0}/${anio}/${meses[1]}`) && e.esDir(`~/${raizE}/${d0}/${anio}/${meses[2]}`) },
        { html: `${u('Crea')} el archivo vacío ${b(script)} dentro de ${b(`${raizE}/${subs[2]}`)}.`, corta: `Crea ${raizE}/${subs[2]}/${script} vacío.`,
          pista: `touch ${raizE}/${subs[2]}/${script}`, solucion: [`touch ${raizE}/${subs[2]}/${script}`],
          comprueba: (e) => e.esArchivo(`~/${raizE}/${subs[2]}/${script}`) }
      ];
      return { titulo: this.titulo, escenario: {}, tareas, solucion: tareas.flatMap((t) => t.solucion),
        tarea: `⟪Crea⟫ en tu carpeta personal la estructura ⟦${raizE}/{${subs.join(',')}}⟧ y ⟦${raizE}/${d0}/${anio}/{${meses.join(',')}}⟧, y el archivo ⟦${raizE}/${subs[2]}/${script}⟧.`,
        variante: raizE + ':' + subs[0], variantes: 9 };
    }
  };

  /* ---------- UT5 · copiar, mover, cambiar de nombre y borrar ---------- */
  M['copiar-mover-borrar'] = {
    titulo: 'Ordena la carpeta de la empresa', ut: 'UT5',
    generar(semilla) {
      const r = U.azar(semilla);
      const fecha = `2026-${String(r.ent(1, 12)).padStart(2, '0')}-${String(r.ent(1, 28)).padStart(2, '0')}`;
      const reunion = r.elige(['acta-reunion.txt', 'reunion-lunes.txt', 'notas-reunion.txt']);
      const nuevoNombre = r.elige(['clientes.txt', 'contactos.txt', 'agenda.txt']);
      const viejoNombre = r.elige(['clientes-viejo.txt', 'lista.txt', 'telefonos.txt']);
      const borrador = r.elige(['borrador.txt', 'prueba.txt', 'temporal.txt']);
      const vieja = r.elige(['antiguo', 'viejo', 'papelera']);
      const docs = r.elige(['documentos', 'docs', 'actas']);
      const csv = 'Mes,Vendedor,Ventas,Beneficio\n' + VENDEDORES.map((v) => `${MESES[r.ent(0, 2)]},${v},${r.ent(8, 14) * 100},${r.ent(10, 40) * 10}`).join('\n') + '\n';
      const escenario = {
        carpetas: ['~/empresa/backups', `~/empresa/${docs}`],
        archivos: {
          '~/empresa/datos/resumen.csv': csv,
          [`~/empresa/datos/${reunion}`]: 'Reunión del equipo de ventas.\nAsisten: ana, luis y marta.\n',
          [`~/empresa/datos/${viejoNombre}`]: 'ana 600111222\nluis 600333444\n',
          [`~/empresa/datos/${borrador}`]: 'prueba\n',
          [`~/empresa/${vieja}/2024.csv`]: 'Mes,Vendedor,Ventas,Beneficio\n',
          [`~/empresa/${vieja}/notas/varias.txt`]: 'notas viejas\n'
        },
        cwd: '~/empresa'
      };
      const destCopia = `backups/resumen-${fecha}.csv`;
      const tareas = [
        { html: `${u('Copia')} ${b('datos/resumen.csv')} en la carpeta ${b('backups')} con el nombre ${b(`resumen-${fecha}.csv`)}.`, corta: `Copia resumen.csv a ${destCopia}.`,
          pista: `cp origen destino: cp datos/resumen.csv ${destCopia}`, solucion: [`cp datos/resumen.csv ${destCopia}`],
          comprueba: (e) => e.lee(`~/empresa/${destCopia}`) === csv && e.lee('~/empresa/datos/resumen.csv') === csv },
        { html: `${u('Mueve')} el archivo ${b(`datos/${reunion}`)} a la carpeta ${b(docs)}.`, corta: `Mueve ${reunion} a ${docs}.`,
          pista: `mv datos/${reunion} ${docs}/`, solucion: [`mv datos/${reunion} ${docs}/`],
          comprueba: (e) => e.esArchivo(`~/empresa/${docs}/${reunion}`) && !e.existe(`~/empresa/datos/${reunion}`) },
        { html: `${u('Cambia')} el nombre de ${b(`datos/${viejoNombre}`)} a ${b(nuevoNombre)}, sin sacarlo de ${b('datos')}.`, corta: `Renombra ${viejoNombre} a ${nuevoNombre}.`,
          pista: `mv también cambia nombres: mv datos/${viejoNombre} datos/${nuevoNombre}`, solucion: [`mv datos/${viejoNombre} datos/${nuevoNombre}`],
          comprueba: (e) => e.esArchivo(`~/empresa/datos/${nuevoNombre}`) && !e.existe(`~/empresa/datos/${viejoNombre}`) },
        { html: `${u('Borra')} el archivo ${b(`datos/${borrador}`)}.`, corta: `Borra ${borrador}.`, pista: `rm datos/${borrador}`, solucion: [`rm datos/${borrador}`],
          comprueba: (e) => !e.existe(`~/empresa/datos/${borrador}`) && e.esArchivo('~/empresa/datos/resumen.csv') },
        { html: `${u('Borra')} la carpeta ${b(vieja)} con todo lo que tiene dentro.`, corta: `Borra ${vieja} y su contenido.`,
          pista: `rmdir solo borra carpetas vacías; para borrar con el contenido: rm -r ${vieja}`, solucion: [`rm -r ${vieja}`],
          comprueba: (e) => !e.existe(`~/empresa/${vieja}`) && e.esDir('~/empresa/datos') }
      ];
      return { titulo: this.titulo, escenario, tareas, solucion: tareas.flatMap((t) => t.solucion),
        tarea: `Dentro de ⟦~/empresa⟧: ⟪copia⟫ ⟦resumen.csv⟧ a ⟦${destCopia}⟧, ⟪mueve⟫ ⟦${reunion}⟧ a ⟦${docs}⟧, ⟪renombra⟫ ⟦${viejoNombre}⟧ a ⟦${nuevoNombre}⟧ y ⟪borra⟫ ⟦${borrador}⟧ y la carpeta ⟦${vieja}⟧.`,
        variante: docs + ':' + vieja, variantes: 9 };
    }
  };

  /* ---------- UT5 · redirecciones y filtros sobre resumen.csv ---------- */
  M['redirecciones'] = {
    titulo: 'Las ventas del trimestre', ut: 'UT5',
    generar(semilla) {
      const r = U.azar(semilla);
      const meses = r.baraja(MESES.slice(0, 6)).slice(0, 3).sort((x, y) => MESES.indexOf(x) - MESES.indexOf(y));
      const filas = [];
      meses.forEach((m) => r.baraja(VENDEDORES).forEach((v) => { if (r.r() < 0.85 || filas.filter((f) => f[0] === m).length === 0) filas.push([m, v, r.ent(6, 15) * 100, r.ent(8, 45) * 10]); }));
      VENDEDORES.forEach((v) => { if (!filas.some((f) => f[1] === v)) filas.push([meses[2], v, r.ent(6, 15) * 100, r.ent(8, 45) * 10]); });
      const csv = 'Mes,Vendedor,Ventas,Beneficio\n' + filas.map((f) => f.join(',')).join('\n') + '\n';
      const quien = r.elige(VENDEDORES);
      const salidaV = r.elige([`ventas-${quien}.csv`, `${quien}.csv`]);
      const errores = r.elige(['errores.txt', 'fallos.txt']);
      const noexiste = r.elige(['informe2025.csv', 'datos-viejos.csv', 'balance.csv']);
      const lineasQuien = lineas(csv).filter((l) => l.split(',')[1] === quien);
      const vendedores = [...new Set(filas.map((f) => f[1]))].sort(U.comparaLocale);
      const total = lineas(csv).length;
      const escenario = {
        archivos: { '~/empresa/datos/resumen.csv': csv, '~/empresa/datos/registro.txt': 'Registro de informes\n' },
        cwd: '~/empresa/datos'
      };
      const solE = `ls ${noexiste} 2> ${errores}`;
      const tareas = [
        { html: `${u('Guarda')} en ${b(salidaV)} las líneas de ${b('resumen.csv')} de ${b(quien)}.`, corta: `Las líneas de ${quien} a ${salidaV}.`,
          pista: `grep busca y > guarda lo que sale: grep ${quien} resumen.csv > ${salidaV}`, solucion: [`grep ${quien} resumen.csv > ${salidaV}`],
          comprueba: (e) => { const t = e.lee(`~/empresa/datos/${salidaV}`); return t !== null && lineas(t).join('\n') === lineasQuien.join('\n'); } },
        { html: `${u('Guarda')} en ${b('vendedores.txt')} la lista de vendedores, ordenada y sin repetir (sin la cabecera).`, corta: 'Vendedores sin repetir a vendedores.txt.',
          pista: 'Corta la columna 2, quita la cabecera y ordena sin repetir: tail -n +2 resumen.csv | cut -d, -f2 | sort -u > vendedores.txt',
          solucion: ['tail -n +2 resumen.csv | cut -d, -f2 | sort -u > vendedores.txt'],
          comprueba: (e) => { const t = e.lee('~/empresa/datos/vendedores.txt'); return t !== null && lineas(t).join('\n') === vendedores.join('\n'); } },
        { html: `${u('Añade')} al final de ${b('registro.txt')} el número de líneas que tiene ${b('resumen.csv')}.`, corta: 'Añade a registro.txt cuántas líneas tiene resumen.csv.',
          pista: 'wc -l cuenta líneas y >> añade sin borrar lo que había: wc -l resumen.csv >> registro.txt', solucion: ['wc -l resumen.csv >> registro.txt'],
          comprueba: (e) => { const t = e.lee('~/empresa/datos/registro.txt'); if (!t || !t.startsWith('Registro de informes\n')) return false; const l = lineas(t); return l.length === 2 && new RegExp('^\\s*' + total + '(\\s+resumen\\.csv)?$').test(l[1]); } },
        { html: `${u('Guarda')} en ${b(errores)} el mensaje de error que da ${b('ls ' + noexiste)} (ese archivo no existe).`, corta: `El error de ls ${noexiste} a ${errores}.`,
          pista: `Los errores salen por la salida 2: ${solE}`, solucion: [solE],
          comprueba: (e) => (e.lee(`~/empresa/datos/${errores}`) || '').includes(`ls: no se puede acceder a '${noexiste}': No existe el archivo o el directorio`) }
      ];
      return { titulo: this.titulo, escenario, tareas, solucion: tareas.flatMap((t) => t.solucion),
        tarea: `Con ⟦resumen.csv⟧: ⟪guarda⟫ las ventas de ⟦${quien}⟧ en ⟦${salidaV}⟧ y los vendedores sin repetir en ⟦vendedores.txt⟧, ⟪añade⟫ a ⟦registro.txt⟧ cuántas líneas tiene y ⟪guarda⟫ el error de ⟦ls ${noexiste}⟧ en ⟦${errores}⟧.`,
        variante: quien, variantes: 3 };
    }
  };

  /* ---------- UT5 · buscar con find ---------- */
  M['buscar'] = {
    titulo: 'Encuentra los archivos', ut: 'UT5',
    generar(semilla) {
      const r = U.azar(semilla);
      const proy = r.elige(['proyecto', 'web', 'tienda']);
      const carpetas = r.baraja(['src', 'docs', 'img', 'datos', 'pruebas', 'config']).slice(0, 4);
      const archivos = {};
      const logs = [], vacios = [], txts = [];
      carpetas.forEach((cp, i) => {
        const n = r.ent(2, 4);
        for (let k = 0; k < n; k++) {
          const tipo = r.elige(['log', 'txt', 'csv', 'md', 'log', 'txt']);
          const nombre = `${r.elige(['informe', 'error', 'nota', 'lista', 'cambios', 'datos'])}${i}${k}.${tipo}`;
          const vacio = r.r() < 0.25;
          const ruta = `${proy}/${cp}${k === n - 1 && i % 2 === 0 ? '/viejo' : ''}/${nombre}`;
          archivos['~/' + ruta] = vacio ? '' : `Contenido de ${nombre}\n`;
          if (tipo === 'log') logs.push(ruta);
          if (tipo === 'txt') txts.push(ruta);
          if (vacio) vacios.push(ruta);
        }
      });
      if (!logs.length) { const ruta = `${proy}/${carpetas[0]}/arranque.log`; archivos['~/' + ruta] = 'iniciado\n'; logs.push(ruta); }
      if (!vacios.length) { const ruta = `${proy}/${carpetas[1]}/vacio${r.ent(1, 9)}.txt`; archivos['~/' + ruta] = ''; vacios.push(ruta); txts.push(ruta); }
      const listaLogs = r.elige(['logs.txt', 'registros.txt']);
      const escenario = { archivos, cwd: '~' };
      const noVacios = Object.keys(archivos).filter((k) => archivos[k] !== '').map((k) => k.slice(2));
      // las rutas de la lista pueden ser relativas (proyecto/…), con ./ o absolutas
      const normaliza = (e, l) => l.trim().replace(/^\.\//, '').replace(new RegExp('^' + e.home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/'), '').replace(/^~\//, '');
      const tareas = [
        { html: `${u('Guarda')} en ${b('~/' + listaLogs)} la lista de los archivos ${b('.log')} que hay dentro de ${b(proy)}, en cualquier subcarpeta.`, corta: `Lista de .log de ${proy} a ${listaLogs}.`,
          pista: `find busca en todas las subcarpetas: find ${proy} -name "*.log" > ${listaLogs}`, solucion: [`find ${proy} -name "*.log" > ${listaLogs}`],
          comprueba: (e) => { const t = e.lee('~/' + listaLogs); if (t === null) return false; const ls = lineas(t).map((l) => normaliza(e, l)).sort(); return ls.join('\n') === logs.slice().sort().join('\n'); } },
        { html: `${u('Guarda')} en ${b('~/cuantos.txt')} cuántos archivos ${b('.txt')} hay dentro de ${b(proy)} (solo el número).`, corta: `Cuántos .txt hay en ${proy}, a cuantos.txt.`,
          pista: `find los encuentra y wc -l los cuenta: find ${proy} -name "*.txt" | wc -l > cuantos.txt`, solucion: [`find ${proy} -name "*.txt" | wc -l > cuantos.txt`],
          comprueba: (e) => { const t = e.lee('~/cuantos.txt'); return t !== null && t.trim() === String(txts.length); } },
        { html: `${u('Borra')} todos los archivos vacíos que hay dentro de ${b(proy)}.`, corta: `Borra los archivos vacíos de ${proy}.`,
          pista: `find los encuentra con -empty -type f y -delete los borra: find ${proy} -type f -empty -delete`, solucion: [`find ${proy} -type f -empty -delete`],
          comprueba: (e) => vacios.every((v) => !e.existe('~/' + v)) && noVacios.every((v) => e.existe('~/' + v)) }
      ];
      return { titulo: this.titulo, escenario, tareas, solucion: tareas.flatMap((t) => t.solucion),
        tarea: `En ⟦~/${proy}⟧: ⟪guarda⟫ la lista de los ⟦.log⟧ en ⟦${listaLogs}⟧ y cuántos ⟦.txt⟧ hay en ⟦cuantos.txt⟧, y ⟪borra⟫ los archivos vacíos.`,
        variante: proy, variantes: 3 };
    }
  };

  /* Estado de una misión en marcha: qué tareas se cumplen (las fijas se quedan cumplidas). */
  // respuestas: [índice de tarea] -> lista de valores escritos en sus casillas (tareas de tipo respuesta)
  L.estadoMision = function (m, sis, sh, previo, respuestas) {
    const e = L.contextoMision(sis, sh);
    const hechas = m.tareas.map((t, i) => {
      if (t.fija && previo && previo[i]) return true;
      if (t.despues !== undefined && !(previo && previo[t.despues])) return false;
      if (t.tipo === 'respuesta' && !(respuestas && respuestas[i])) return false;
      try { return !!t.comprueba(e, respuestas && respuestas[i]); } catch (x) { return false; }
    });
    return hechas;
  };
  // un paso de una solución, de principio a fin (Resolver y pruebas): texto u objeto {orden, tab, ctrlC, teclas, respuestas}
  L.pasoMision = (paso) => (typeof paso === 'string' ? { orden: paso } : paso);
  /* Pistas en dos niveles: la primera (t.pista) dice dónde mirar o qué idea usar; la segunda, la orden: t.pistaOrden
   * o, si no la hay, las órdenes de la solución. null si la tarea no tiene segundo nivel. */
  L.pistaOrden = function (t) {
    if (t.pistaOrden) return t.pistaOrden;
    const pasos = (t.solucion || []).map(L.pasoMision);
    if (!pasos.length || pasos.some((p) => p.teclas || p.ctrlC)) return null;
    const ords = pasos.map((p) => '«' + p.orden + '»' + (p.tab ? ' (con Tab)' : ''));
    const lista = ords.length === 1 ? ords[0] : ords.slice(0, -1).join(', ') + ' y después ' + ords[ords.length - 1];
    return (ords.length === 1 ? 'La orden es ' : 'Las órdenes son ') + lista + '.' + (pasos.some((p) => p.respuestas && p.respuestas.includes('alumno')) ? ' La contraseña es la tuya del simulador.' : '');
  };
  L.ejecutaPaso = function (sh, paso, opc) {
    const p = L.pasoMision(paso);
    let linea = p.orden;
    if (p.tab) {
      const c = sh.completa(linea, linea.length);
      if (c.sustituye !== null) linea = linea.slice(0, c.inicio) + c.sustituye + linea.slice(c.fin);
      if (L.registra) L.registra(sh.sis, { tipo: 'tecla', tecla: 'Tab' });
      linea = linea.replace(/\s+$/, '');
    }
    const r = sh.ejecuta(linea, Object.assign({ respuestas: p.respuestas, teclas: p.teclas, ctrlCTras: p.ctrlC }, opc || {}));
    r.linea = linea;
    return r;
  };
  L.listaMisiones = () => Object.keys(M).map((k) => ({ id: k, titulo: M[k].titulo, ut: M[k].ut }));

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof window !== 'undefined' ? window : globalThis);
