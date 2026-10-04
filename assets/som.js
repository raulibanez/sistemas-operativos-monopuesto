/* Motor común de las presentaciones de Sistemas Operativos Monopuesto.
 *
 *  1. Numera las diapositivas ("03 / 72").
 *  2. Quiz de opción múltiple:
 *       <div class="quiz" data-correct="1" data-ok="..." data-ko="...">
 *         <p class="quiz-fb">Selecciona una opción.</p>
 *         <div class="quiz-opts"> <button class="quiz-opt">…</button> … </div>
 *         <button class="btn btn-ghost quiz-reset">Reiniciar</button>
 *       </div>
 *     Con data-preguntas="clave" se añade «Otra pregunta», que pasa por las de SOM.preguntas.clave.
 *  3. Panel que se revela (pregunta a la clase):
 *       <div class="revela"> <div class="revela-cuerpo">…</div> <button class="btn btn-primary revela-btn">Ver ideas</button> </div>
 *  4. Galería de fotos en el mismo hueco, con flechas y pie que cambia:
 *       <div class="galeria"> <figure class="foto" data-pie="Figura 1.2. …">…</figure> … </div>
 *     Un elemento de la misma diapositiva con data-ir="2" salta a la segunda foto.
 *     Una <figure class="foto scroll"> (imagen mucho más alta que ancha) se abre en el visor
 *     a todo el ancho y con scroll vertical, en vez de encogida para caber entera.
 *  5. Ejercicio generado con números al azar, resuelto en vertical con huecos:
 *       <div class="ej" data-tipo="dec2bin" data-min="16" data-max="255"></div>
 *     Tipos disponibles en SOM.generadores: bin2dec, dec2bin, decfrac2bin, bases, sumabin,
 *     restabin, logica, c1c2, restac2, paridad, unidades, ascii, ieee754 (UT1); estados, planificacion,
 *     paginacion, arranque, sistemas-archivos (UT2); anfitrion, recursos, archivos-vm, modos-red,
 *     ficha-vm (UT3, esta solo para la hoja). Atributos: data-bits,
 *     data-min, data-max, data-modo (modo fijo de los que tienen modos) y data-paridad (par | impar).
 *  6. Simulador visual de planificación de procesos, paso a paso:
 *       <div class="sim-entrada"></div> (datos) y <div class="sim" data-algo="fifo"></div> (cronograma)
 *     en la misma diapositiva. Algoritmos: fifo, sjf, srtf, pne, pe, rr (data-q). SOM.simulaPlan expone el motor.
 *  7. Notas del profesor: cada sección lleva un <aside class="notas">…</aside> como primer hijo
 *     (HTML, oculto por CSS). La tecla N abre assets/notas.html en una ventana aparte con las
 *     notas de la diapositiva actual; se actualiza al cambiar de diapositiva.
 *  8. Calculadora básica (disposición del iPhone): la tecla C abre assets/calc.html en un panel
 *     flotante que se arrastra por la cabecera; el botón ⧉ la extrae a una pestaña nueva.
 *  9. Teorema fundamental de la numeración paso a paso (Anterior / Siguiente / Otro número, selector de base 2, 8, 10, 16
 *     y el número se puede escribir a mano pulsándolo):
 *       <div class="sumatorio" data-numero="52318" data-base="10"> <div class="sum-cuerpo">…</div> </div>
 */
(function () {
  'use strict';

  const SOM = (window.SOM = window.SOM || {});

  /* ---------- utilidades ---------- */
  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const baraja = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const bin =(n, bits) => n.toString(2).padStart(bits || 0, '0');
  const agrupa = (s) => s.replace(/\B(?=(\d{4})+(?!\d))/g, ' ');
  const esBin = (s) => /^[01]+$/.test(s);
  const limpia = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

  /* ---------- generadores de ejercicios ----------
   * Los ejercicios "de rejilla" (rejilla: true) se resuelven en vertical, como en la pizarra:
   * el generador devuelve un objeto g con
   *   enunciado  texto de la consigna
 *   cabecera   (opcional) pastilla delante del enunciado, p. ej. 'Hexadecimal → decimal' (útil en Al azar)
   *   columnas   grid-template-columns de la rejilla
   *   clase      clases extra de la rejilla ('compacta' para 8 o 9 celdas por fila)
   *   filas      lista de filas; cada fila es una lista de elementos:
   *                {lbl:'texto'}                        etiqueta de la fila
   *                {d:'1', clase, span, espejo:'id'}    dato visible (espejo: copia lo que se escribe en la casilla id)
   *                {c:'valor', clase, max, filtro, n, id, expl, cmp, span}   casilla que rellena el alumno
 *   Cada generador devuelve además `tarea` (enunciado corto, solo lo que se pide) para la hoja de examen
 *   en papel, y los datos con `pista: true` solo se imprimen en la hoja de práctica.
   *                {sel:['+','−'], c:'−', expl}          botón que alterna entre opciones
   *              o {linea:true} para la raya de la operación
   *   n          orden de resolución de las casillas (menor primero); sin n, orden de aparición
   *   expl       explicación de la casilla (la usa Pista)
   *   correcto   mensaje al acertar
   *   espejo     función (id, valorEscrito) -> texto que se muestra en los espejos
   *   valida     función () -> mensaje de error o null, antes de corregir las casillas
   *   acciones   botones extra [{texto, accion(api)}]
   * y el generador puede tener modos: [{t:'texto', v:'valor'}] que se muestran como botones, o, si la
   * diapositiva tiene un esquema .ej-mapa, mapa: {modo: {o, d, por, via}} para elegir pulsando en él (ver bases).
   */
  const inv = (s) => s.replace(/[01]/g, (x) => (x === '1' ? '0' : '1'));
  const sup = (n) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
  const numES = (x) => String(x).replace('.', ',');
  const aNum = (v) => parseFloat(String(v).replace(',', '.').replace('−', '-'));
  const unos = (s) => s.split('').filter((x) => x === '1').length;
  const NOMBRE_BASE = { 2: 'binario', 8: 'octal', 10: 'decimal', 16: 'hexadecimal' };

  /* Tabla de pesos: dígitos en una base -> decimal (binario y hexadecimal a decimal) */
  function tablaPesos(digs, base) {
    const w = digs.length;
    const fBits = [{ lbl: NOMBRE_BASE[base] }], fPos = [{ lbl: 'posición' }];
    const fVal = base === 16 ? [{ lbl: 'valor' }] : null;
    const fPeso = [{ lbl: 'peso ' + base + 'ⁿ' }], fProd = [{ lbl: base === 2 ? 'bit × peso' : 'valor × peso' }];
    let suma = 0; const sumandos = [];
    for (let i = 0; i < w; i++) {
      const e = w - 1 - i, peso = Math.pow(base, e), dv = parseInt(digs[i], base), prod = dv * peso;
      suma += prod; if (prod) sumandos.push(prod);
      fBits.push({ d: digs[i] });
      fPos.push({ d: base + sup(e), clase: 'peq' });
      if (fVal) fVal.push({ c: String(dv), clase: 'num', max: 2, filtro: /[^0-9]/g, n: e,
        expl: dv > 9 ? `${digs[i]} es la letra que sigue: A = 10, B = 11, C = 12, D = 13, E = 14, F = 15. ${digs[i]} vale ${dv}` : `${digs[i]} vale ${dv}` });
      fPeso.push({ c: String(peso), clase: 'num', max: 4, filtro: /[^0-9]/g, n: 100 + e,
        expl: e === 0 ? `Posición 0 (la de la derecha): ${base}⁰ = 1, cualquier número elevado a 0 vale 1` : `Posición ${e}, contando desde 0 por la derecha: ${base}${sup(e)} = ${peso}` });
      fProd.push({ c: String(prod), clase: 'num', max: 5, filtro: /[^0-9]/g, n: 200 + e,
        expl: dv === 0 ? `Posición ${e}: 0 × ${peso} = 0. Un 0 no aporta nada a la suma` : `Posición ${e}: ${dv} × ${peso} = ${prod}` });
    }
    const filas = [fBits, fPos];
    if (fVal) filas.push(fVal);
    filas.push(fPeso, fProd, { linea: true });
    filas.push([{ lbl: 'decimal' }, { c: String(suma), clase: 'num', max: 6, filtro: /[^0-9]/g, span: w, n: 300,
      expl: `Sumo los productos distintos de cero: ${sumandos.join(' + ')} = ${suma}` }]);
    return { filas, suma, sumandos };
  }

  SOM.generadores = {

    /* 3.1 binario -> decimal, entero o con coma (hasta tres bits tras la coma: 0,5; 0,25; 0,125) */
    bin2dec: {
      titulo: 'De binario a decimal',
      rejilla: true,
      modos: [{ t: 'Entero', v: null }, { t: 'Con coma', v: 'coma' }, { t: 'Al azar', v: 'azar' }],
      generar(cfg) {
        const modo = cfg.modo === 'azar' ? (rnd(0, 1) ? 'coma' : 'entero') : (cfg.modo || 'entero');
        if (modo === 'coma') {
          const ne = rnd(2, 4), nf = rnd(2, 3);
          const ent = bin(rnd(1 << (ne - 1), (1 << ne) - 1));          // sin ceros a la izquierda
          const fra = bin(2 * rnd(0, (1 << (nf - 1)) - 1) + 1, nf);     // acaba en 1: sin ceros a la derecha
          const aFrac = (v) => { const m = String(v).match(/^(\d+)\/(\d+)$/); return m ? m[1] / m[2] : aNum(v); };
          const fBits = [{ lbl: 'binario' }], fPos = [{ lbl: 'posición' }], fPeso = [{ lbl: 'peso 2ⁿ' }], fProd = [{ lbl: 'bit × peso' }];
          let suma = 0; const sumandos = [];
          ent.split('').forEach((d, i) => {
            const e = ne - 1 - i, peso = 1 << e, prod = +d * peso;
            suma += prod; if (prod) sumandos.push(prod);
            fBits.push({ d }); fPos.push({ d: '2' + sup(e), clase: 'peq' });
            fPeso.push({ c: String(peso), clase: 'num', max: 1, filtro: /[^0-9]/g, n: 100 + e,
              expl: e === 0 ? 'Posición 0, la primera a la izquierda de la coma: 2⁰ = 1' : `Posición ${e}, contando desde 0 a la izquierda de la coma: 2${sup(e)} = ${peso}` });
            fProd.push({ c: String(prod), clase: 'num', max: 1, filtro: /[^0-9]/g, n: 200 + e,
              expl: prod ? `Posición ${e}: 1 × ${peso} = ${peso}` : `Posición ${e}: 0 × ${peso} = 0. Un 0 no aporta nada a la suma` });
          });
          fBits.push({ d: ',', clase: 'op' }); fPos.push({ d: '' }); fPeso.push({ d: '' }); fProd.push({ d: '' });
          fra.split('').forEach((d, i) => {
            const k = i + 1, peso = 1 / (1 << k), p = numES(peso), prod = +d * peso;
            suma += prod; if (prod) sumandos.push(p);
            fBits.push({ d }); fPos.push({ d: '2⁻' + sup(k), clase: 'peq' });
            fPeso.push({ c: p, clase: 'num dec', max: 5, filtro: /[^0-9.,/]/g, n: 110 + k, cmp: (v) => aFrac(v) === peso,
              expl: k === 1 ? 'Posición −1, la primera a la derecha de la coma: 2⁻¹ = 1/2 = 0,5' : `Posición −${k}: 2⁻${sup(k)} = 1/${1 << k} = ${p}, la mitad del peso anterior` });
            fProd.push({ c: numES(prod), clase: 'num dec', max: 5, filtro: /[^0-9.,/]/g, n: 210 + k, cmp: (v) => aFrac(v) === prod,
              expl: prod ? `Posición −${k}: 1 × ${p} = ${p}` : `Posición −${k}: 0 × ${p} = 0. Un 0 no aporta nada a la suma` });
          });
          const w = ne + 1 + nf, res = numES(suma);
          return {
            enunciado: 'Escribe el peso de cada posición, multiplica por el bit y suma. A la derecha de la coma, cada peso es la mitad del anterior. Coma o punto, da igual.',
            tarea: 'Pasa el número binario a decimal.',
            columnas: `120px repeat(${ne}, 74px) 28px repeat(${nf}, 96px)`, clase: 'compacta',
            filas: [fBits, fPos, fPeso, fProd, { linea: true },
              [{ lbl: 'decimal' }, { c: res, clase: 'num dec', max: 7, filtro: /[^0-9.,]/g, span: w, n: 300, cmp: (v) => aNum(v) === suma,
                expl: `Sumo los productos distintos de cero: ${sumandos.join(' + ')} = ${res}` }]],
            correcto: `Correcto: ${ent},${fra} (2 = ${sumandos.join(' + ')} = ${res} (10`
          };
        }
        const bits = cfg.bits || 8;
        const n = rnd(cfg.min || 16, cfg.max || (1 << bits) - 1);
        const b = bin(n, bits);
        const t = tablaPesos(b.split(''), 2);
        return {
          enunciado: 'Escribe el peso de cada posición, multiplica por el bit y suma. Empieza por la derecha.',
          tarea: 'Pasa el número binario a decimal.',
          columnas: `120px repeat(${bits}, 74px)`, clase: 'compacta',
          filas: t.filas,
          correcto: `Correcto: ${agrupa(b)} (2 = ${t.sumandos.join(' + ')} = ${n} (10`
        };
      }
    },

    /* 3.2 decimal -> binario, parte entera */
    dec2bin: {
      titulo: 'De decimal a binario',
      rejilla: true,
      generar(cfg) {
        const n = rnd(cfg.min || 16, cfg.max || 255);
        const pasos = [];
        let q = n;
        while (q > 0) { pasos.push({ q, c: Math.floor(q / 2), r: q % 2 }); q = Math.floor(q / 2); }
        const filas = pasos.map((p, k) => [
          k === 0 ? { d: String(n) } : { d: '', espejo: 'q' + (k - 1) },
          { d: ':', clase: 'op' }, { d: '2' }, { d: '=', clase: 'op' },
          { c: String(p.c), clase: 'num', id: 'q' + k, max: 3, filtro: /[^0-9]/g, n: 2 * k,
            expl: `${p.q} entre 2 son ${p.c}` + (p.r ? ` y sobra 1 (${p.c} × 2 = ${2 * p.c}, y ${p.q} − ${2 * p.c} = 1)` : ' y no sobra nada') },
          { lbl: 'resto' },
          { c: String(p.r), n: 2 * k + 1,
            expl: p.r ? `${p.q} es impar: ${p.c} × 2 = ${2 * p.c} y sobra 1` : `${p.q} es par: ${p.c} × 2 = ${p.q} justo, resto 0` }
        ]);
        const restos = pasos.map((p) => p.r);
        const b = bin(n);
        filas.push({ linea: true });
        filas.push([{ lbl: 'restos de abajo arriba' },
          { c: b, clase: 'bin', max: b.length, filtro: /[^01]/g, span: 6, n: 999,
            expl: `Leo los restos de abajo arriba: ${restos.slice().reverse().join(' ')} → ${b}. El primer resto es el bit de la derecha (el de menos peso)` }]);
        return {
          enunciado: 'Divide entre 2 hasta que el cociente sea 0. Cada fila empieza con el cociente de la anterior.',
          tarea: `Pasa ${n} a binario.`,
          columnas: '110px 36px 50px 40px 110px 80px 62px', clase: 'compacta mini micro',
          filas,
          espejo: (id, v) => v || '?',
          correcto: `Correcto: ${n} (10 = ${agrupa(b)} (2. Compruébalo sumando pesos: ${b.split('').map((x, i) => x === '1' ? 1 << (b.length - 1 - i) : 0).filter(Boolean).join(' + ')} = ${n}`
        };
      }
    },

    /* 3.3 decimal -> binario, parte fraccionaria */
    decfrac2bin: {
      titulo: 'Fracciones decimales a binario',
      rejilla: true,
      generar(cfg) {
        const den = cfg.max || 32;
        const k = rnd(1, den - 1);
        const f = k / den;                       // expansión binaria finita
        const pasos = [];
        let x = f;
        while (x > 0 && pasos.length < 8) { const p = x * 2, e = Math.floor(p), fr = p - e; pasos.push({ x, p, e, fr }); x = fr; }
        const filas = pasos.map((p, i) => [
          i === 0 ? { d: numES(p.x), clase: 'dec' } : { d: '', espejo: 'p' + (i - 1), clase: 'dec' },
          { d: '× 2', clase: 'op' }, { d: '=', clase: 'op' },
          { c: numES(p.p), clase: 'num dec', id: 'p' + i, max: 8, filtro: /[^0-9.,]/g, n: 2 * i,
            cmp: (v) => aNum(v) === p.p,
            expl: `${numES(p.x)} × 2 = ${numES(p.p)}` },
          { lbl: 'entero' },
          { c: String(p.e), n: 2 * i + 1,
            expl: p.e ? `${numES(p.p)} llega a 1: me quedo el 1 como dígito y sigo con la parte decimal, ${numES(p.fr)}` : `${numES(p.p)} no llega a 1: el dígito es 0 y sigo multiplicando ${numES(p.p)}` }
        ]);
        const bits = pasos.map((p) => p.e).join('');
        filas.push({ linea: true });
        filas.push([{ lbl: 'de arriba abajo' },
          { c: '0,' + bits, clase: 'bin', max: bits.length + 2, filtro: /[^01.,]/g, span: 5, n: 999,
            cmp: (v) => v.replace('.', ',') === '0,' + bits,
            expl: `Los enteros leídos de arriba abajo, detrás de la coma: 0,${bits}. La parte entera sigue siendo 0` }]);
        return {
          enunciado: 'Multiplica por 2 y separa la parte entera. Sigue con la parte decimal hasta que quede 0.',
          tarea: `Pasa ${numES(f)} a binario.`,
          columnas: '130px 60px 40px 150px 80px 62px', clase: 'compacta',
          filas,
          espejo: (id, v) => { const y = aNum(v); return isNaN(y) ? '?' : numES(+(y - Math.floor(y)).toFixed(6)); },
          correcto: `Correcto: ${numES(f)} (10 = 0,${bits} (2. Se termina porque la parte decimal llega a 0; con 0,1 no pasaría nunca.`
        };
      }
    },

    /* 3.4 cambios entre binario, octal, hexadecimal y decimal */
    bases: {
      titulo: 'Entre bases',
      rejilla: true,
      modos: [{ t: 'Binario → octal', v: 'bin2oct' }, { t: 'Binario → hexadecimal', v: 'bin2hex' }, { t: 'Octal → binario', v: 'oct2bin' }, { t: 'Hexadecimal → binario', v: 'hex2bin' }, { t: 'Octal → hexadecimal', v: 'oct2hex' }, { t: 'Hexadecimal → octal', v: 'hex2oct' }, { t: 'Binario → decimal', v: 'bin2dec' }, { t: 'Octal → decimal', v: 'oct2dec' }, { t: 'Hexadecimal → decimal', v: 'hex2dec' }, { t: 'Decimal → binario', v: 'dec2bin' }, { t: 'Decimal → octal', v: 'dec2oct' }, { t: 'Decimal → hexadecimal', v: 'dec2hex' }, { t: 'Al azar', v: null }],
      // Con el esquema de cambios de base en la diapositiva (.ej-mapa), sustituye a los botones: origen,
      // destino, base de paso y flechas de cada modo. En las flechas de la tabla, la punta que se queda.
      mapa: {
        bin2oct: { o: 'bin', d: 'oct', via: { 'tabla-oct': 'ini' } },
        bin2hex: { o: 'bin', d: 'hex', via: { 'tabla-hex': 'fin' } },
        oct2bin: { o: 'oct', d: 'bin', via: { 'tabla-oct': 'fin' } },
        hex2bin: { o: 'hex', d: 'bin', via: { 'tabla-hex': 'ini' } },
        oct2hex: { o: 'oct', d: 'hex', por: 'bin', via: { 'tabla-oct': 'fin', 'tabla-hex': 'fin' } },
        hex2oct: { o: 'hex', d: 'oct', por: 'bin', via: { 'tabla-hex': 'ini', 'tabla-oct': 'ini' } },
        bin2dec: { o: 'bin', d: 'dec', via: { 'teo-bin': '' } },
        oct2dec: { o: 'oct', d: 'dec', via: { 'teo-oct': '' } },
        hex2dec: { o: 'hex', d: 'dec', via: { 'teo-hex': '' } },
        dec2bin: { o: 'dec', d: 'bin', via: { alg: '' } },
        dec2oct: { o: 'dec', d: 'oct', por: 'bin', via: { alg: '', 'tabla-oct': 'ini' } },
        dec2hex: { o: 'dec', d: 'hex', por: 'bin', via: { alg: '', 'tabla-hex': 'fin' } }
      },
      generar(cfg) {
        const todos = ['bin2oct', 'bin2hex', 'oct2bin', 'hex2bin', 'oct2hex', 'hex2oct', 'bin2dec', 'oct2dec', 'hex2dec', 'dec2bin', 'dec2oct', 'dec2hex'];
        const modo = cfg.modo || todos[rnd(0, todos.length - 1)];
        if (modo === 'bin2dec' || modo === 'dec2bin') {
          // Los ejercicios de antes (binario de 8 bits; decimal hasta 255), con su cabecera
          return Object.assign(SOM.generadores[modo].generar({}), { modo, cabecera: modo === 'bin2dec' ? 'Binario → decimal' : 'Decimal → binario' });
        }
        if (modo === 'oct2hex' || modo === 'hex2oct') {
          // Por el binario: cada dígito a sus bits, todo junto y otra vez en grupos, ahora del otro tamaño.
          // Una columna por bit, para que los grupos de 3 y los de 4 queden sobre los mismos bits.
          const [bo, bd] = modo === 'oct2hex' ? [8, 16] : [16, 8];
          const go = bo === 8 ? 3 : 4, gd = bd === 8 ? 3 : 4;
          const k = rnd(bo === 8 ? 3 : 2, bo === 8 ? 4 : 3);           // dígitos del dato: 12 bits como mucho
          const n = rnd(Math.pow(bo, k - 1) + 1, Math.pow(bo, k) - 1);
          const s = n.toString(bo).toUpperCase(), b = n.toString(2), res = n.toString(bd).toUpperCase();
          const kd = Math.ceil(b.length / gd), w = Math.max(k * go, kd * gd);
          const rell = b.padStart(kd * gd, '0'), grupos = rell.match(new RegExp(`.{${gd}}`, 'g'));
          const hueco = (x) => (x ? [{ d: '', span: x }] : []);
          const may = (t) => t[0].toUpperCase() + t.slice(1);
          return {
            modo,
            cabecera: `${may(NOMBRE_BASE[bo])} → ${NOMBRE_BASE[bd]}`,
            enunciado: `Cada dígito son ${go} bits; júntalos y vuelve a agrupar de ${gd} en ${gd} desde la derecha. No se pasa por decimal.`,
            tarea: `Pasa ${s} de ${NOMBRE_BASE[bo]} a ${NOMBRE_BASE[bd]}.`,
            columnas: `150px repeat(${w}, 46px)`, clase: 'compacta',
            filas: [
              [{ lbl: NOMBRE_BASE[bo] }, ...hueco(w - k * go), ...s.split('').map((d) => ({ d, clase: 'ancho', span: go }))],
              [{ lbl: `grupos de ${go}` }, ...hueco(w - k * go), ...s.split('').map((d, i) => { const v = parseInt(d, bo); return { c: bin(v, go), clase: 'bin', max: go, filtro: /[^01]/g, span: go, n: i,
                expl: `${d} vale ${v}, que en ${go} bits es ${bin(v, go)}` + (v < (1 << (go - 1)) ? ' (con los ceros a la izquierda para completar el grupo)' : '') }; })],
              [{ lbl: 'binario' }, { c: b, clase: 'bin', max: k * go, filtro: /[^01]/g, span: w, n: 100, cmp: (v) => v.replace(/^0+(?=.)/, '') === b,
                expl: `Junto los grupos${b.length < k * go ? ' y quito los ceros de la izquierda que sobran' : ''}: ${b}` }],
              [{ lbl: `grupos de ${gd}` }, ...hueco(w - kd * gd), ...grupos.map((g, i) => ({ c: g, clase: 'bin', max: gd, filtro: /[^01]/g, span: gd, n: 200 + kd - i,
                expl: `Cuento de ${gd} en ${gd} desde la derecha: el grupo ${kd - i} es ${g}` + (i === 0 && rell !== b ? ' (le he puesto ceros a la izquierda para completarlo)' : '') }))],
              [{ lbl: NOMBRE_BASE[bd] }, ...hueco(w - kd * gd), ...grupos.map((g, i) => { const v = parseInt(g, 2); return { c: v.toString(bd).toUpperCase(), clase: bd === 16 ? 'hex' : '', max: 1, filtro: bd === 16 ? /[^0-9a-fA-F]/g : /[^0-7]/g, span: gd, n: 300 + kd - i,
                expl: `${g} en binario vale ${v}` + (v > 9 ? `, que en hexadecimal se escribe ${v.toString(16).toUpperCase()}` : '') }; })]
            ],
            correcto: `Correcto: ${s} (${bo} = ${b} (2 = ${res} (${bd}`
          };
        }
        const base = modo.includes('oct') ? 8 : 16, gr = base === 8 ? 3 : 4;
        if (modo === 'dec2oct' || modo === 'dec2hex') {
          // Por el binario: divisiones entre 2 (en papel) y grupos de 3 o 4 bits con la tabla.
          // Nunca se divide entre 8 ni entre 16.
          const k = rnd(2, base === 8 ? 4 : 3);                       // dígitos del resultado
          const n = rnd(Math.pow(base, k - 1) + 1, Math.pow(base, k) - 1);
          const b = n.toString(2), rell = b.padStart(k * gr, '0');
          const grupos = rell.match(new RegExp(`.{${gr}}`, 'g'));
          const res = n.toString(base).toUpperCase();
          return {
            modo,
            cabecera: `Decimal → ${NOMBRE_BASE[base]}`,
            enunciado: `Pasa a binario dividiendo entre 2 y agrupa de ${gr} en ${gr} bits con la tabla. Así no hay que dividir entre ${base}.`,
            tarea: `Pasa ${n} de decimal a ${NOMBRE_BASE[base]}.`,
            columnas: `170px repeat(${k}, 150px)`,
            filas: [
              [{ lbl: 'decimal' }, { d: String(n), clase: 'ancho', span: k }],
              [{ lbl: 'binario' }, { c: b, clase: 'bin', max: k * gr, filtro: /[^01]/g, span: k, n: 0,
                expl: `Divisiones entre 2 y los restos de abajo arriba, como en el ejercicio Decimal a binario: ${n} = ${b}` }],
              [{ lbl: `grupos de ${gr}` }, ...grupos.map((g, i) => ({ c: g, clase: 'bin', max: gr, filtro: /[^01]/g, n: 1 + k - i,
                expl: `Cuento de ${gr} en ${gr} desde la derecha: el grupo ${k - i} es ${g}` + (i === 0 && rell !== b ? ' (le he puesto ceros a la izquierda para completarlo)' : '') }))],
              [{ lbl: NOMBRE_BASE[base] }, ...grupos.map((g, i) => { const v = parseInt(g, 2); return { c: v.toString(base).toUpperCase(), clase: base === 16 ? 'hex' : '', max: 1, filtro: base === 16 ? /[^0-9a-fA-F]/g : /[^0-7]/g, n: 100 + k - i,
                expl: `${g} en binario vale ${v}` + (v > 9 ? `, que en hexadecimal se escribe ${v.toString(16).toUpperCase()}` : '') }; })]
            ],
            correcto: `Correcto: ${n} (10 = ${b} (2 = ${res} (${base}`
          };
        }
        if (modo === 'oct2dec' || modo === 'hex2dec') {
          // Teorema fundamental: cada dígito por el peso de su posición, y se suma.
          const k = rnd(2, 3);
          const n = rnd(Math.pow(base, k - 1) + 1, Math.pow(base, k) - 1);
          const h = n.toString(base).toUpperCase();
          const t = tablaPesos(h.split(''), base);
          return {
            modo,
            cabecera: `${NOMBRE_BASE[base][0].toUpperCase() + NOMBRE_BASE[base].slice(1)} → decimal`,
            enunciado: `Teorema fundamental: el valor de cada dígito por el peso de su posición (${base}ⁿ), y se suma.`,
            tarea: `Pasa ${h} de ${NOMBRE_BASE[base]} a decimal.`,
            columnas: `130px repeat(${k}, 130px)`, clase: 'compacta', filas: t.filas,
            correcto: `Correcto: ${h} (${base} = ${t.sumandos.join(' + ')} = ${n} (10`
          };
        }
        if (modo === 'bin2oct' || modo === 'bin2hex') {
          const bits = rnd(gr + 2, gr * 3);
          const n = rnd(1 << (bits - 1), (1 << bits) - 1);
          const b = n.toString(2), k = Math.ceil(b.length / gr), rell = b.padStart(k * gr, '0');
          const grupos = rell.match(new RegExp(`.{${gr}}`, 'g'));
          const res = n.toString(base).toUpperCase();
          return {
            modo,
            cabecera: `Binario → ${NOMBRE_BASE[base]}`,
            enunciado: `Separa en grupos de ${gr} bits empezando por la derecha y traduce cada grupo con la tabla.`,
            tarea: `Pasa el número binario a ${NOMBRE_BASE[base]}.`,
            columnas: `170px repeat(${k}, 150px)`,
            filas: [
              [{ lbl: 'binario' }, { d: b, clase: 'ancho', span: k }],
              [{ lbl: `grupos de ${gr}` }, ...grupos.map((g, i) => ({ c: g, clase: 'bin', max: gr, filtro: /[^01]/g, n: k - i,
                expl: `Cuento de ${gr} en ${gr} desde la derecha: el grupo ${k - i} es ${g}` + (i === 0 && rell !== b ? ' (le he puesto ceros a la izquierda para completarlo)' : '') }))],
              [{ lbl: NOMBRE_BASE[base] }, ...grupos.map((g, i) => { const v = parseInt(g, 2); return { c: v.toString(base).toUpperCase(), clase: base === 16 ? 'hex' : '', max: 1, filtro: base === 16 ? /[^0-9a-fA-F]/g : /[^0-7]/g, n: 100 + k - i,
                expl: `${g} en binario vale ${v}` + (v > 9 ? `, que en hexadecimal se escribe ${v.toString(16).toUpperCase()}` : '') }; })]
            ],
            correcto: `Correcto: ${b} (2 = ${res} (${base}`
          };
        }
        // octal o hexadecimal -> binario
        const k = rnd(2, base === 8 ? 4 : 3);
        const n = rnd(Math.pow(base, k - 1) + 1, Math.pow(base, k) - 1);
        const s = n.toString(base).toUpperCase();
        const b = n.toString(2);
        return {
          modo,
          cabecera: `${NOMBRE_BASE[base][0].toUpperCase() + NOMBRE_BASE[base].slice(1)} → binario`,
          enunciado: `Cada dígito se convierte en su grupo de ${gr} bits, con ceros a la izquierda si hace falta.`,
          tarea: `Pasa ${s} de ${NOMBRE_BASE[base]} a binario.`,
          columnas: `170px repeat(${k}, 150px)`,
          filas: [
            [{ lbl: NOMBRE_BASE[base] }, ...s.split('').map((d) => ({ d, clase: 'ancho' }))],
            [{ lbl: `grupos de ${gr}` }, ...s.split('').map((d, i) => { const v = parseInt(d, base); return { c: bin(v, gr), clase: 'bin', max: gr, filtro: /[^01]/g, n: i,
              expl: `${d} vale ${v}, que en ${gr} bits es ${bin(v, gr)}` + (v < (1 << (gr - 1)) ? ' (con los ceros a la izquierda para completar el grupo)' : '') }; })],
            [{ lbl: 'todo junto' }, { c: b, clase: 'bin', max: k * gr, filtro: /[^01]/g, span: k, n: 100,
              expl: `Junto los grupos y quito los ceros de la izquierda que sobran: ${b}` }]
          ],
          correcto: `Correcto: ${s} (${base} = ${b} (2`
        };
      }
    },

    /* suma en binario, vertical con acarreos */
    sumabin: {
      titulo: 'Suma en binario',
      rejilla: true,
      generar(cfg) {
        const bits = cfg.bits || 5;
        const a = rnd(1 << (bits - 2), (1 << bits) - 1);
        const b = rnd(1 << (bits - 2), (1 << bits) - 1);
        const s = a + b, w = bin(s).length;
        const A = bin(a, w), B = bin(b, w), S = bin(s, w);
        const la = bin(a).length, lb = bin(b).length;
        const fLleva = [{ lbl: 'me llevo' }], fA = [{ lbl: '' }], fB = [{ lbl: '+' }], fS = [{ lbl: 'resultado' }];
        let carry = 0; const expl = [];
        // se recorre de derecha a izquierda; e = número de columna desde la derecha (0 = la primera)
        for (let i = w - 1; i >= 0; i--) {
          const e = w - 1 - i, t = +A[i] + +B[i] + carry;
          const sumandos = [A[i], B[i]].concat(carry ? ['1 que me llevaba'] : []).join(' + ');
          const sale = t > 1 ? 1 : 0;
          const base = `Columna ${e + 1}: ${sumandos} son ${t}` + (t > 1 ? `, que en binario es ${bin(t)}` : '');
          fS[i + 1] = { c: S[i], n: 2 * e, expl: base + (t > 1 ? ` → escribo ${t % 2} y me llevo 1` : ` → escribo ${t}`) };
          if (i > 0) fLleva[i] = { c: String(sale), clase: 'carry', n: 2 * e + 1, expl: base + (sale ? ' → me llevo 1 a la columna siguiente' : ' → no me llevo nada: acarreo 0') };
          expl.unshift(fS[i + 1].expl);
          carry = sale;
        }
        fLleva[w] = { d: '' };
        for (let i = 0; i < w; i++) { fA.push({ d: i >= w - la ? A[i] : '' }); fB.push({ d: i >= w - lb ? B[i] : '' }); }
        return {
          enunciado: 'Rellena los acarreos y el resultado, columna a columna, empezando por la derecha.',
          tarea: 'Suma los dos números binarios.',
          columnas: `170px repeat(${w}, 86px)`,
          filas: [fLleva, fA, fB, { linea: true }, fS],
          correcto: `Correcto: ${a} + ${b} = ${s}, es decir ${agrupa(S)} en binario.`,
          resumen: expl.join('\n')
        };
      }
    },

    /* 3.5 resta en binario con préstamos; si el sustraendo es mayor hay que invertir y poner el signo */
    restabin: {
      titulo: 'Resta en binario',
      rejilla: true,
      generar(cfg) {
        const bits = cfg.bits || 5;
        let a = rnd(1 << (bits - 2), (1 << bits) - 1), b = rnd(1, (1 << bits) - 1);
        if (a === b) b = a - 1;
        const neg = b > a, M = neg ? b : a, S = neg ? a : b;   // se resta siempre mayor − menor
        const w = bits;
        const Mb = bin(M, w), Sb = bin(S, w), R = [];
        const pide = new Array(w).fill(0);
        let br = 0; const exR = new Array(w), exP = new Array(w);
        for (let i = w - 1; i >= 0; i--) {
          const e = w - 1 - i;
          pide[i] = br;
          let d = +Mb[i] - +Sb[i] - br;
          const lo = `${Mb[i]} − ${Sb[i]}` + (br ? ' − 1 que me pidieron' : '');
          if (d < 0) {
            d += 2; br = 1;
            exR[i] = `Columna ${e + 1}: ${lo} no se puede. Pido 1 a la columna de la izquierda: ahora tengo ${+Mb[i] + 2} (10 en binario) y ${+Mb[i] + 2} − ${Sb[i]}${pide[i] ? ' − 1' : ''} = ${d}`;
          } else {
            br = 0;
            exR[i] = `Columna ${e + 1}: ${lo} = ${d}`;
          }
          exP[i] = br ? `La columna ${e + 1} no podía restar y pide 1 a la columna ${e + 2}` : `La columna ${e + 1} no pide nada`;
          R[i] = String(d);
        }
        const g = {
          enunciado: 'Resta columna a columna desde la derecha. Si en una columna no puedes, pide 1 a la de la izquierda. Fíjate antes en cuál de los dos números es mayor.',
          tarea: 'Resta los dos números binarios y pon el signo del resultado.',
          columnas: `150px 62px repeat(${w}, 86px)`,
          invertido: false,
          correcto: neg ? `Correcto: ${a} − ${b} = −(${b} − ${a}) = −${M - S}, es decir −${agrupa(bin(M - S))} en binario.` : `Correcto: ${a} − ${b} = ${a - b}, es decir ${agrupa(bin(a - b))} en binario.`,
          valida: () => {
            if (neg && !g.invertido) return 'Mira bien los dos números: el de abajo es mayor que el de arriba, y así no se puede restar. Pulsa Invertir para ponerlos en orden y marca el signo −.';
            if (!neg && g.invertido) return 'Has invertido los números, pero el de arriba ya era el mayor. Vuelve a pulsar Invertir.';
            return null;
          },
          acciones: [{ texto: 'Invertir', accion(api) { g.invertido = !g.invertido; g.filas = construye(); api.repinta(); } }],
          resumen: exR.slice().reverse().join('\n')
        };
        function construye() {
          const arriba = bin(g.invertido ? b : a, w), abajo = bin(g.invertido ? a : b, w);
          const fPide = [{ lbl: 'pido' }, { d: '' }], fA = [{ lbl: '' }, { d: '' }], fB = [{ lbl: '−' }, { d: '' }];
          const fR = [{ lbl: 'resultado' }, { sel: ['+', '−'], c: neg ? '−' : '+', n: 1000, expl: neg ? 'El sustraendo era mayor que el minuendo: el resultado lleva signo −' : 'El minuendo era mayor: el resultado es positivo' }];
          for (let i = 0; i < w; i++) {
            const e = w - 1 - i;
            fPide.push(i < w - 1 ? { c: String(pide[i]), clase: 'carry', n: 2 * (e - 1) + 1, expl: exP[i + 1] } : { d: '' });
            fA.push({ d: arriba[i] });
            fB.push({ d: abajo[i] });
            fR.push({ c: R[i], n: 2 * e, expl: exR[i] });
          }
          return [fPide, fA, fB, { linea: true, desde: 3 }, fR];
        }
        g.filas = construye();
        return g;
      }
    },

    /* 3.6 operaciones lógicas bit a bit */
    logica: {
      titulo: 'Operaciones lógicas',
      rejilla: true,
      modos: [{ t: 'NOT', v: 'NOT' }, { t: 'AND', v: 'AND' }, { t: 'OR', v: 'OR' }, { t: 'XOR', v: 'XOR' }, { t: 'NAND', v: 'NAND' }, { t: 'NOR', v: 'NOR' }, { t: 'Al azar', v: null }],
      generar(cfg) {
        const ops = {
          NOT: { f: (x) => 1 - x, regla: 'NOT invierte el bit: 0 pasa a 1 y 1 pasa a 0' },
          AND: { f: (x, y) => x & y, regla: 'AND solo da 1 si los dos bits son 1' },
          OR: { f: (x, y) => x | y, regla: 'OR da 1 si alguno de los dos bits es 1' },
          XOR: { f: (x, y) => x ^ y, regla: 'XOR da 1 solo si los dos bits son distintos' },
          NAND: { f: (x, y) => 1 - (x & y), regla: 'NAND es lo contrario de AND: solo da 0 si los dos son 1' },
          NOR: { f: (x, y) => 1 - (x | y), regla: 'NOR es lo contrario de OR: solo da 1 si los dos son 0' }
        };
        const bits = cfg.bits || 8;
        const op = cfg.modo || Object.keys(ops)[rnd(0, 5)];
        const a = rnd(1, (1 << bits) - 1), b = rnd(1, (1 << bits) - 1);
        const A = bin(a, bits), B = bin(b, bits);
        const fA = [{ lbl: 'A' }], fB = [{ lbl: 'B' }], fR = [{ lbl: op === 'NOT' ? 'NOT A' : `A ${op} B` }];
        let r = '';
        for (let i = 0; i < bits; i++) {
          const e = bits - 1 - i;
          const v = op === 'NOT' ? ops.NOT.f(+A[i]) : ops[op].f(+A[i], +B[i]);
          r += v;
          fA.push({ d: A[i] }); fB.push({ d: B[i] });
          fR.push({ c: String(v), n: e, expl: `Columna ${e + 1}: ` + (op === 'NOT' ? `NOT ${A[i]} = ${v}` : `${A[i]} ${op} ${B[i]} = ${v}`) + `. ${ops[op].regla}` });
        }
        const filas = op === 'NOT' ? [fA, { linea: true }, fR] : [fA, fB, { linea: true }, fR];
        return {
          enunciado: op === 'NOT' ? 'NOT trabaja con un solo número: invierte cada bit.' : `Aplica ${op} bit a bit: cada columna se opera por separado, sin acarreos. ${ops[op].regla}.`,
          tarea: `Calcula ${op === 'NOT' ? 'NOT A' : 'A ' + op + ' B'} bit a bit.`,
          columnas: `130px repeat(${bits}, 74px)`, clase: 'compacta',
          filas,
          correcto: `Correcto: ${op === 'NOT' ? 'NOT ' + A : A + ' ' + op + ' ' + B} = ${r}`
        };
      }
    },

    /* 3.7 complemento a 1 y a 2 */
    c1c2: {
      titulo: 'Complemento a 1 y a 2',
      rejilla: true,
      generar(cfg) {
        const bits = cfg.bits || 8;
        const n = rnd(1, (1 << bits) - 2);
        const N = bin(n, bits), C1 = inv(N), C2 = bin((parseInt(C1, 2) + 1) % (1 << bits), bits);
        const fN = [{ lbl: 'número' }], f1 = [{ lbl: 'C1: invierto' }], f2 = [{ lbl: 'C2 = C1 + 1' }];
        const ex2 = new Array(bits);
        let carry = 1;
        for (let i = bits - 1; i >= 0; i--) {
          const e = bits - 1 - i;
          if (!carry) ex2[i] = `Columna ${e + 1}: ya no llega acarreo, se copia el bit del C1 (${C1[i]})`;
          else if (C1[i] === '1') ex2[i] = `Columna ${e + 1}: el C1 tiene 1 y le sumo 1: 1 + 1 = 10, escribo 0 y me llevo 1`;
          else { ex2[i] = `Columna ${e + 1}: el C1 tiene 0 y le llega el 1: 0 + 1 = 1, y ya no me llevo nada`; carry = 0; }
        }
        for (let i = 0; i < bits; i++) {
          const e = bits - 1 - i;
          fN.push({ d: N[i] });
          f1.push({ c: C1[i], n: e, expl: `Columna ${e + 1}: el bit era ${N[i]}, invertido es ${C1[i]}` });
          f2.push({ c: C2[i], n: 100 + e, expl: ex2[i] });
        }
        return {
          enunciado: 'Complemento a 1: invierte todos los bits. Complemento a 2: suma 1 al complemento a 1 (empieza por la derecha y lleva el acarreo).',
          tarea: 'Calcula el complemento a 1 y el complemento a 2 del número.',
          columnas: `150px repeat(${bits}, 74px)`, clase: 'compacta',
          filas: [fN, f1, f2],
          correcto: `Correcto: C1(${N}) = ${C1} y C2 = ${C2}. Truco: de derecha a izquierda se copian los bits hasta el primer 1 incluido, y se invierten los demás.`
        };
      }
    },

    /* 3.8 resta en complemento a 2, por pasos */
    restac2: {
      titulo: 'Resta en complemento a 2',
      rejilla: true,
      generar(cfg) {
        const bits = cfg.bits || 8;
        let a = rnd(1, (1 << bits) - 1), b = rnd(1, (1 << bits) - 1);
        if (a === b) b = (b % ((1 << bits) - 1)) + 1;
        const neg = b > a;
        const A = bin(a, bits), B = bin(b, bits), C1 = inv(B), C2 = bin((parseInt(C1, 2) + 1) % (1 << bits), bits);
        const suma = a + parseInt(C2, 2), SB = bin(suma, bits + 1);   // bits + 1 columnas
        const res = SB.slice(1);
        const fB = [{ lbl: 'B (sustraendo)' }, { d: '' }], f1 = [{ lbl: 'C1 de B' }, { d: '' }], f2 = [{ lbl: 'C2 = C1 + 1' }, { d: '' }];
        const fLleva = [{ lbl: 'me llevo' }, { d: '' }], fA = [{ lbl: 'A (minuendo)' }, { d: '' }], fC = [{ lbl: '+ C2 de B' }, { d: '' }];
        const fS = [{ lbl: 'suma' }];
        // explicaciones del C2
        const ex2 = new Array(bits); let carry = 1;
        for (let i = bits - 1; i >= 0; i--) {
          const e = bits - 1 - i;
          if (!carry) ex2[i] = `Columna ${e + 1}: ya no hay acarreo, se copia el bit del C1 (${C1[i]})`;
          else if (C1[i] === '1') ex2[i] = `Columna ${e + 1}: 1 + 1 = 10, escribo 0 y me llevo 1`;
          else { ex2[i] = `Columna ${e + 1}: 0 + 1 = 1, se acabó el acarreo`; carry = 0; }
        }
        for (let i = 0; i < bits; i++) {
          const e = bits - 1 - i;
          fB.push({ d: B[i] });
          f1.push({ c: C1[i], n: e, expl: `Columna ${e + 1}: el bit de B era ${B[i]}, invertido es ${C1[i]}` });
          f2.push({ c: C2[i], id: 'c2' + i, n: 100 + e, expl: ex2[i] });
          fA.push({ d: A[i] });
          fC.push({ d: '', espejo: 'c2' + i });
        }
        // suma A + C2 con acarreos; la casilla de la izquierda es el bit que sobra
        carry = 0; const exS = [];
        const cel = new Array(bits + 1), lleva = new Array(bits + 1);
        for (let i = bits - 1; i >= 0; i--) {
          const e = bits - 1 - i, t = +A[i] + +C2[i] + carry;
          const sumandos = [A[i], C2[i]].concat(carry ? ['1 que me llevaba'] : []).join(' + ');
          const sale = t > 1 ? 1 : 0;
          const base = `Columna ${e + 1}: ${sumandos} son ${t}` + (t > 1 ? ` (${bin(t)} en binario)` : '');
          cel[i + 1] = { c: SB[i + 1], n: 200 + 2 * e, expl: base + (t > 1 ? ` → escribo ${t % 2} y me llevo 1` : ` → escribo ${t}`) };
          lleva[i] = { c: String(sale), clase: 'carry', n: 200 + 2 * e + 1, expl: base + (sale ? ' → me llevo 1' : ' → no me llevo nada') };
          exS.unshift(cel[i + 1].expl);
          carry = sale;
        }
        cel[0] = { c: SB[0], clase: 'sobra', n: 200 + 2 * bits, expl: neg ? 'No hay ningún 1 de más: el resultado es negativo y ya está en complemento a 2' : 'Sobra un 1 que se descarta: no cabe en ' + bits + ' bits y el resultado es positivo' };
        // fila "me llevo": sobre cada columna va el acarreo que sale de la columna de su derecha;
        // el acarreo de la columna de más a la izquierda es el bit que sobra y va en la fila de la suma
        const fL = fLleva;
        for (let i = 0; i < bits; i++) fL.push(i < bits - 1 ? lleva[i + 1] : { d: '' });
        const fD = [{ lbl: 'A − B' }, { c: String(a - b), clase: 'num dec', max: 5, filtro: /[^0-9\-−]/g, span: bits + 1, n: 999,
          cmp: (v) => aNum(v) === a - b,
          expl: neg ? `No sobró ningún 1: el resultado ${res} es negativo y está en complemento a 2. Le hago el C2 para leerlo: ${bin(b - a, bits)} = ${b - a}, así que vale −${b - a}` : `Sobró un 1 que se descarta; ${res} es ${a - b}` }];
        return {
          enunciado: 'Complemento a 2 del sustraendo, suma con el minuendo y decide qué pasa con el bit que sobra.',
          tarea: 'Calcula A − B en complemento a 2.',
          columnas: `130px repeat(${bits + 1}, 62px)`, clase: 'compacta mini',
          filas: [fB, f1, f2, { linea: true, clase: 'suave' }, fL, fA, fC, { linea: true }, [...fS, ...cel], fD],
          espejo: (id, v) => v || '·',
          correcto: neg ? `Correcto: ${a} − ${b} = −${b - a}. No sobró ningún 1: ${res} está en complemento a 2 y representa −${b - a}.` : `Correcto: ${a} − ${b} = ${a - b}. Se descarta el 1 que sobra y queda ${res}.`,
          resumen: exS.join('\n')
        };
      }
    },

    /* 3.9 bit de paridad: calcularlo o detectar un error */
    paridad: {
      titulo: 'Bit de paridad',
      rejilla: true,
      modos: [{ t: 'Calcular el bit', v: 'calcular' }, { t: 'Detectar un error', v: 'detectar' }, { t: 'Al azar', v: null }],
      generar(cfg) {
        const modo = cfg.modo || (rnd(0, 1) ? 'calcular' : 'detectar');
        const tipo = cfg.paridad || (rnd(0, 1) ? 'par' : 'impar');
        const dato = bin(rnd(1, 127), 7);
        const u = unos(dato);
        const pb = tipo === 'par' ? u % 2 : 1 - (u % 2);
        const explica = `El dato tiene ${u} unos (${u % 2 ? 'impar' : 'par'}). Paridad ${tipo}: el total de unos, contando el bit de paridad, tiene que ser ${tipo}; por eso el bit vale ${pb}`;
        if (modo === 'calcular') {
          return {
            enunciado: `Paridad ${tipo}: cuenta los unos del dato y añade a la izquierda el bit que haga que el total de unos sea ${tipo}.`,
            tarea: `Añade al dato el bit de paridad ${tipo}.`,
            columnas: '190px repeat(8, 64px)', clase: 'compacta',
            filas: [
              [{ lbl: 'dato (7 bits)' }, { d: '' }, ...dato.split('').map((d) => ({ d }))],
              [{ lbl: 'unos que tiene' }, { c: String(u), clase: 'num', max: 1, filtro: /[^0-9]/g, span: 8, n: 0, expl: `Cuento los unos del dato: ${u}` }],
              [{ lbl: `paridad ${tipo}` }, { c: String(pb), clase: 'par', n: 1, expl: explica }, ...dato.split('').map((d) => ({ d, clase: 'tenue' }))]
            ],
            correcto: `Correcto: se envía ${pb}${dato}. ${explica}.`
          };
        }
        // detectar: palabra recibida con o sin un bit cambiado
        let palabra = String(pb) + dato;
        const err = rnd(0, 1) === 1;
        let pos = -1;
        if (err) { pos = rnd(0, 7); palabra = palabra.slice(0, pos) + inv(palabra[pos]) + palabra.slice(pos + 1); }
        const ut = unos(palabra);
        return {
          enunciado: `Se ha recibido esta palabra con paridad ${tipo} (el bit de paridad es el de la izquierda). ¿Ha llegado bien?`,
          tarea: `Palabra recibida con paridad ${tipo} (el bit de paridad es el de la izquierda). ¿Ha llegado bien?`,
          columnas: '190px repeat(8, 64px)', clase: 'compacta',
          filas: [
            [{ lbl: 'recibido' }, ...palabra.split('').map((d, i) => ({ d, clase: i === 0 ? 'marca' : '' }))],
            [{ lbl: 'unos en total' }, { c: String(ut), clase: 'num', max: 1, filtro: /[^0-9]/g, span: 8, n: 0, expl: `Cuento todos los unos, el de paridad incluido: ${ut}` }],
            [{ lbl: 'veredicto' }, { sel: ['sin error', 'con error'], c: err ? 'con error' : 'sin error', span: 8, n: 1,
              expl: `${ut} unos es ${ut % 2 ? 'impar' : 'par'}. Con paridad ${tipo} ${(ut % 2 === 0) === (tipo === 'par') ? 'cuadra: no se detecta ningún error' : 'no cuadra: hay un error'}` }]
          ],
          correcto: err ? `Correcto: hay un error (se cambió el bit ${8 - pos} contando desde la derecha). La paridad lo detecta, pero no dice cuál es.` : `Correcto: la paridad cuadra. Ojo: si hubieran cambiado dos bits, también cuadraría y el error pasaría desapercibido.`
        };
      }
    }
,

    /* 3.10 unidades de información: bits y bytes, unidades binarias y disco del fabricante */
    unidades: {
      titulo: 'Unidades de información',
      rejilla: true,
      modos: [{ t: 'Bits y bytes', v: 'bits' }, { t: 'Entre unidades', v: 'binario' }, { t: 'Disco del fabricante', v: 'fabricante' }, { t: 'Al azar', v: null }],
      generar(cfg) {
        const modo = cfg.modo || ['bits', 'binario', 'fabricante'][rnd(0, 2)];
        const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        const sinSep = (v) => String(v).replace(/[\s.]/g, '');
        if (modo === 'bits') {
          const aBits = rnd(0, 1) === 1;
          const nB = rnd(2, 64), nb = nB * 8;
          return {
            enunciado: aBits ? 'Pasa de bytes a bits.' : 'Pasa de bits a bytes.',
            tarea: aBits ? 'Pasa de bytes a bits.' : 'Pasa de bits a bytes.',
            columnas: '190px 200px 140px', clase: 'compacta',
            filas: [
              [{ lbl: 'dato' }, { d: aBits ? String(nB) : String(nb), clase: 'ancho' }, { d: aBits ? 'bytes' : 'bits', clase: 'peq' }],
              { linea: true },
              [{ lbl: 'resultado' }, { c: aBits ? String(nb) : String(nB), clase: 'num', max: 4, filtro: /[^0-9]/g, n: 0,
                expl: aBits ? `Un byte son 8 bits: ${nB} × 8 = ${nb} bits` : `Un byte son 8 bits: ${nb} ÷ 8 = ${nB} bytes` }, { d: aBits ? 'bits' : 'bytes', clase: 'peq' }]
            ],
            correcto: aBits ? `Correcto: ${nB} bytes son ${nb} bits.` : `Correcto: ${nb} bits son ${nB} bytes.`
          };
        }
        if (modo === 'binario') {
          // de una unidad a otra, de 1 a 4 saltos en cualquier dirección; se pide la expresión, no el cálculo
          const U = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
          const i = rnd(0, U.length - 1);
          let j = rnd(0, U.length - 2); if (j >= i) j++;         // destino distinto del origen
          const pasos = Math.abs(j - i), sube = j > i;           // sube: a una unidad mayor (se divide)
          const k = rnd(2, 12);
          const op = sube ? '÷' : '×';
          const SUP = ['', '¹', '²', '³', '⁴'], SUP10 = ['', '¹⁰', '²⁰', '³⁰', '⁴⁰'];
          const expr = [String(k)].concat(Array(pasos).fill('1024')).join(` ${op} `);
          const exprPot = `${k} ${op} 1024${SUP[pasos]}`;
          const camino = sube ? U.slice(i, j + 1) : U.slice(j, i + 1).reverse();
          // se aceptan: k × 1024 × 1024…, k × 1024^p, k × 2^(10p) (con x, *, ·, ÷, :, /, paréntesis y espacios a gusto)
          const normU = (t) => String(t).toLowerCase().replace(/\s+/g, '').replace(/[×x*·]/g, '*').replace(/[÷:]/g, '/').replace(/\*\*/g, '^').replace(/[()]/g, '')
            .replace(/¹⁰/g, '^10').replace(/²⁰/g, '^20').replace(/³⁰/g, '^30').replace(/⁴⁰/g, '^40').replace(/¹/g, '^1').replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4');
          const opN = sube ? '/' : '*';
          const validas = [normU(expr), `${k}${opN}1024^${pasos}`, `${k}${opN}2^${10 * pasos}`];
          if (!sube) validas.push(String(k * Math.pow(1024, pasos)));   // si alguien lo calcula, también vale
          const cmpExpr = (v) => validas.includes(normU(v));
          return {
            enunciado: `Pasa ${k} ${U[i]} a ${U[j]}. Cada salto entre unidades vecinas es multiplicar o dividir por 1024 (2¹⁰). Escribe la expresión, sin calcularla.`,
            tarea: `Pasa ${k} ${U[i]} a ${U[j]}. Escribe la expresión, sin calcularla.`,
            columnas: '150px 470px 90px', clase: 'compacta',
            filas: [
              [{ lbl: 'dato' }, { d: `${k} ${U[i]}`, clase: 'ancho' }, { d: `a ${U[j]}`, clase: 'peq' }],
              [{ lbl: 'saltos' }, { c: String(pasos), clase: 'num', max: 1, filtro: /[^0-9]/g, n: 0,
                expl: `De ${U[i]} a ${U[j]}: ${camino.join(' → ')}, ${pasos} salto${pasos > 1 ? 's' : ''}` }, { d: '' }],
              { linea: true },
              [{ lbl: 'resultado' }, { c: expr, clase: 'num', max: 40, filtro: /[^0-9xX×*·÷:/^()\s]/g, n: 1, cmp: cmpExpr,
                expl: `Hacia una unidad ${sube ? 'mayor se divide entre' : 'menor se multiplica por'} 1024 en cada salto: ${expr}${pasos > 1 ? `, o ${exprPot}` : ''}` }, { d: U[j], clase: 'peq' }]
            ],
            correcto: `Correcto: ${k} ${U[i]} = ${pasos > 1 ? exprPot : expr} ${U[j]}${pasos > 1 ? ` = ${k} ${op} 2${SUP10[pasos]} ${U[j]}` : ''}. Regla: hacia una unidad mayor se divide, hacia una menor se multiplica.`
          };
        }
        // fabricante: GB o TB decimales -> GiB que muestra el sistema
        const enTB = rnd(0, 1) === 1;
        const n = enTB ? [1, 2, 4, 8][rnd(0, 3)] : [120, 240, 250, 256, 480, 500, 512, 1000, 2000][rnd(0, 8)];
        const bytes = n * (enTB ? 1e12 : 1e9);
        const gib = bytes / Math.pow(2, 30);
        const gibTxt = numES(gib.toFixed(1));
        return {
          enunciado: `El fabricante anuncia ${n} ${enTB ? 'TB' : 'GB'} (prefijos decimales) y el sistema mide en GiB (2³⁰ bytes). Este modo se hace con calculadora.`,
          tarea: `El fabricante anuncia ${n} ${enTB ? 'TB' : 'GB'}. ¿Cuántos GiB muestra el sistema?`,
          columnas: '210px 330px 110px', clase: 'compacta',
          filas: [
            [{ lbl: 'anunciado' }, { d: `${n} ${enTB ? 'TB' : 'GB'}`, clase: 'ancho' }, { d: '' }],
            [{ lbl: 'en bytes' }, { c: String(bytes), clase: 'num', max: 16, filtro: /[^0-9\s.]/g, n: 0, cmp: (x) => sinSep(x) === String(bytes),
              expl: `${enTB ? 'T' : 'G'} decimal es 10${enTB ? '¹²' : '⁹'}: ${n} × 10${enTB ? '¹²' : '⁹'} = ${miles(bytes)} bytes` }, { d: 'bytes', clase: 'peq' }],
            [{ lbl: '1 GiB' }, { d: '1 073 741 824', clase: 'dec' }, { d: 'bytes', clase: 'peq' }],
            { linea: true },
            [{ lbl: 'GiB que verás' }, { c: gibTxt, clase: 'num dec', max: 8, filtro: /[^0-9.,]/g, n: 1,
              cmp: (x) => Math.abs(aNum(x) - gib) <= gib * 0.01,
              expl: `${miles(bytes)} ÷ 1 073 741 824 = ${gibTxt} GiB (vale con un decimal o redondeado)` }, { d: 'GiB', clase: 'peq' }]
          ],
          correcto: `Correcto: ${n} ${enTB ? 'TB' : 'GB'} anunciados son ${gibTxt} GiB. No falta espacio: son dos formas de contar los mismos ${miles(bytes)} bytes.`
        };
      }
    },

    /* 3.12 código ASCII: carácter -> código, código -> carácter, mayúscula <-> minúscula */
    ascii: {
      titulo: 'Código ASCII',
      rejilla: true,
      modos: [{ t: 'Carácter → código', v: 'codigo' }, { t: 'Código → carácter', v: 'caracter' }, { t: 'Mayúscula ↔ minúscula', v: 'caso' }, { t: 'Al azar', v: null }],
      generar(cfg) {
        const modo = cfg.modo || ['codigo', 'caracter', 'caso'][rnd(0, 2)];
        const RANGOS = [
          { nombre: 'mayúsculas', base: 65, primero: 'A', n: 26, sel: 'mayúsculas 65–90' },
          { nombre: 'minúsculas', base: 97, primero: 'a', n: 26, sel: 'minúsculas 97–122' },
          { nombre: 'dígitos', base: 48, primero: '0', n: 10, sel: 'dígitos 48–57' }
        ];
        const r = RANGOS[modo === 'caso' ? rnd(0, 1) : rnd(0, 2)];
        const pos = rnd(0, r.n - 1), cod = r.base + pos, ch = String.fromCharCode(cod);
        const b8 = bin(cod, 8), hx = cod.toString(16).toUpperCase();
        const filtroChar = /[^0-9A-Za-z]/g;
        const exBase = `${ch} es ${r.nombre === 'dígitos' ? 'un dígito' : 'una letra ' + r.nombre.slice(0, -1)}: ${r.nombre === 'dígitos' ? 'los dígitos empiezan' : 'las ' + r.nombre + ' empiezan'} en ${r.primero} = ${r.base}`;
        const exPos = r.nombre === 'dígitos' ? `El dígito ${ch} está ${pos} posiciones después del 0` : `Contando ${r.primero} = 0, ${ch} es la posición ${pos} del alfabeto (sin ñ)`;
        const exBin = `${cod} en binario de 8 bits: ${b8.match(/.{4}/g).join(' ')}`;
        const exHex = `${b8.slice(0, 4)} = ${hx[0]}, ${b8.slice(4)} = ${hx[1]} → ${hx}`;
        if (modo === 'codigo') {
          return {
            enunciado: 'Del carácter a su código ASCII. Basta con recordar tres anclas: A = 65, a = 97 y 0 = 48.',
            tarea: `Escribe el código ASCII de «${ch}» en decimal, binario y hexadecimal.`,
            columnas: '210px 200px 1fr', clase: 'compacta mini',
            filas: [
              [{ lbl: 'carácter' }, { d: ch, clase: 'ancho' }, { d: '' }],
              [{ lbl: 'código base' }, { c: String(r.base), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 0, expl: exBase }, { d: 'A = 65 · a = 97 · 0 = 48', clase: 'peq', pista: true }],
              [{ lbl: 'posición' }, { c: String(pos), clase: 'num', max: 2, filtro: /[^0-9]/g, n: 1, expl: exPos }, { d: 'contando desde 0', clase: 'peq', pista: true }],
              [{ lbl: 'decimal' }, { c: String(cod), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 2, expl: `${r.base} + ${pos} = ${cod}` }, { d: 'base + posición', clase: 'peq', pista: true }],
              [{ lbl: 'binario' }, { c: b8, clase: 'bin', max: 8, filtro: /[^01]/g, n: 3, expl: exBin }, { d: '8 bits', clase: 'peq' }],
              [{ lbl: 'hexadecimal' }, { c: hx, clase: 'hex', max: 2, filtro: /[^0-9a-fA-F]/g, n: 4, expl: exHex }, { d: 'grupos de 4 bits', clase: 'peq', pista: true }]
            ],
            correcto: `Correcto: «${ch}» = ${cod} = ${b8} = ${hx} en hexadecimal.`
          };
        }
        if (modo === 'caracter') {
          return {
            enunciado: 'Del código ASCII al carácter. Primero decide en qué rango cae el número.',
            tarea: '¿Qué carácter tiene este código ASCII?',
            columnas: '210px 240px 1fr', clase: 'compacta',
            filas: [
              [{ lbl: 'código' }, { d: b8, clase: 'ancho' }, { d: 'binario', clase: 'peq' }],
              [{ lbl: 'decimal' }, { c: String(cod), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 0, expl: `${b8} = ${b8.split('').map((x, i) => x === '1' ? 1 << (7 - i) : 0).filter(Boolean).join(' + ')} = ${cod}` }, { d: 'suma de pesos', clase: 'peq', pista: true }],
              [{ lbl: 'rango' }, { sel: RANGOS.map((x) => x.sel), c: r.sel, n: 1, expl: `${cod} está entre ${r.base} y ${r.base + r.n - 1}: ${r.nombre}` }, { d: 'pulsa para cambiar', clase: 'peq' }],
              [{ lbl: 'posición' }, { c: String(pos), clase: 'num', max: 2, filtro: /[^0-9]/g, n: 2, expl: `${cod} − ${r.base} = ${pos}` }, { d: `código − ${r.base}`, clase: 'peq', pista: true }],
              [{ lbl: 'carácter' }, { c: ch, max: 1, filtro: filtroChar, n: 3, cmp: (v) => v === ch, expl: `${pos} posiciones después de ${r.primero}: ${ch}` }, { d: r.nombre === 'dígitos' ? '0 1 2 3 4 5 6 7 8 9' : (r.nombre === 'mayúsculas' ? 'A B C D E F G H I J K L M…' : 'a b c d e f g h i j k l m…'), clase: 'peq', pista: true }]
            ],
            correcto: `Correcto: ${b8} (${cod}) es el carácter «${ch}».`
          };
        }
        // caso: mayúscula <-> minúscula (solo letras)
        const aMayus = r.base === 97;                 // la letra dada es minúscula: hay que restar 32
        const cod2 = aMayus ? cod - 32 : cod + 32, ch2 = String.fromCharCode(cod2), b2 = bin(cod2, 8);
        return {
          enunciado: `Pasa «${ch}» a ${aMayus ? 'mayúscula' : 'minúscula'}. Las dos letras se diferencian en 32, que es un solo bit.`,
          tarea: `Pasa «${ch}» a ${aMayus ? 'mayúscula' : 'minúscula'} en ASCII.`,
          columnas: '210px 240px 1fr', clase: 'compacta mini',
          filas: [
            [{ lbl: 'carácter' }, { d: ch, clase: 'ancho' }, { d: '' }],
            [{ lbl: 'código' }, { c: String(cod), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 0, expl: exBase + `, y ${ch} está ${pos} después: ${cod}` }, { d: 'A = 65 · a = 97', clase: 'peq', pista: true }],
            [{ lbl: 'operación' }, { sel: ['− 32', '+ 32'], c: aMayus ? '− 32' : '+ 32', n: 1, expl: aMayus ? 'La mayúscula está 32 por debajo de la minúscula: se resta 32' : 'La minúscula está 32 por encima de la mayúscula: se suma 32' }, { d: 'pulsa para cambiar', clase: 'peq' }],
            [{ lbl: 'nuevo código' }, { c: String(cod2), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 2, expl: `${cod} ${aMayus ? '−' : '+'} 32 = ${cod2}` }, { d: '' }],
            [{ lbl: 'carácter' }, { c: ch2, max: 1, filtro: filtroChar, n: 3, cmp: (v) => v === ch2, expl: `${cod2} es «${ch2}»` }, { d: aMayus ? 'en mayúscula' : 'en minúscula', clase: 'peq' }],
            [{ lbl: `${ch} en binario` }, { d: b8, clase: 'ancho' }, { d: 'el tercer bit por la izquierda vale 32', clase: 'peq', pista: true }],
            [{ lbl: `${ch2} en binario` }, { c: b2, clase: 'bin', max: 8, filtro: /[^01]/g, n: 4, expl: `Solo cambia el bit de peso 32 (el tercero por la izquierda): ${b8} → ${b2}` }, { d: 'solo cambia un bit', clase: 'peq', pista: true }]
          ],
          correcto: `Correcto: «${ch}» (${cod}) y «${ch2}» (${cod2}) solo se diferencian en el bit de peso 32.`
        };
      }
    },

    /* 3.11 IEEE 754 de simple precisión, por campos */
    ieee754: {
      titulo: 'IEEE 754 simple precisión',
      rejilla: true,
      generar(cfg) {
        const POOL = [10.5, -6.25, 0.375, 12, -0.75, 5.5, 100, -18.125, 0.1875, 3.75, 7, -40, 0.5, -1, 2.5, 22, 0.0625, 13.25, -9.5, 1.5, 6, -0.625, 20, 33, 4.5, -3.125, 0.25, 11.5, -14, 9.75, 0.875, -2.75, 64, 17.5];
        const x = POOL[rnd(0, POOL.length - 1)];
        const neg = x < 0, a = Math.abs(x);
        const ent = Math.floor(a), frac = a - ent;
        let fb = '';
        for (let f = frac, k = 0; f > 0 && k < 12; k++) { f *= 2; fb += f >= 1 ? '1' : '0'; if (f >= 1) f -= 1; }
        const eb = ent.toString(2);
        const binTxt = (ent ? eb : '0') + (fb ? ',' + fb : '');
        // normalizar: 1,xxx × 2^e
        const todo = (ent ? eb : '') + fb;                       // todos los bits sin coma
        const primer1 = todo.indexOf('1');
        const e = ent ? eb.length - 1 : -(fb.indexOf('1') + 1);
        const mant = todo.slice(primer1 + 1).replace(/0+$/, '');
        const mant23 = mant.padEnd(23, '0');
        const E = e + 127, E8 = bin(E, 8);
        const bits32 = (neg ? '1' : '0') + E8 + mant23;
        const hex = parseInt(bits32, 2).toString(16).toUpperCase().padStart(8, '0');
        const norm = '1' + (mant ? ',' + mant : '') + ' × 2' + sup(String(Math.abs(e))).replace(/^/, e < 0 ? '⁻' : '');
        const xTxt = numES(a);
        return {
          enunciado: 'Binario, normalizar (1,… × 2ᵉ), exponente + 127 y mantisa de 23 bits sin el 1 implícito.',
          tarea: `Representa ${numES(x)} en IEEE 754 de simple precisión.`,
          columnas: '230px 120px 1fr', clase: 'compacta mini',
          filas: [
            [{ lbl: 'número' }, { d: numES(x), clase: 'ancho', span: 2 }],
            [{ lbl: 'signo' }, { c: neg ? '1' : '0', n: 0, expl: neg ? 'Es negativo: el bit de signo vale 1' : 'Es positivo: el bit de signo vale 0' }, { d: '0 positivo · 1 negativo', clase: 'peq', pista: true }],
            [{ lbl: 'en binario' }, { c: binTxt, clase: 'bin', max: 16, filtro: /[^01.,]/g, span: 2, n: 1, cmp: (v) => v.replace('.', ',') === binTxt,
              expl: `Parte entera ${ent} = ${ent ? eb : '0'}` + (fb ? `; parte decimal ${numES(frac)} = 0,${fb} (multiplicando por 2)` : '') + ` → ${binTxt}` }],
            [{ lbl: 'exponente' }, { c: String(e), clase: 'num', max: 3, filtro: /[^0-9\-−]/g, n: 2, cmp: (v) => aNum(v) === e,
              expl: `Muevo la coma hasta dejar un solo 1 delante: ${norm}. ` + (e >= 0 ? `La coma se ha movido ${e} posiciones a la izquierda` : `La coma se ha movido ${-e} posiciones a la derecha, así que el exponente es negativo`) }, { d: `${xTxt} = ${norm}`, clase: 'peq', pista: true }],
            [{ lbl: 'exponente + 127' }, { c: String(E), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 3, expl: `${e} + 127 = ${E} (el sesgo evita guardar exponentes negativos)` }, { d: 'sesgo 127', clase: 'peq', pista: true }],
            [{ lbl: 'exponente 8 bits' }, { c: E8, clase: 'bin', max: 8, filtro: /[^01]/g, n: 4, span: 2, expl: `${E} en binario de 8 bits: ${E8}` }],
            [{ lbl: 'mantisa 23 bits' }, { c: mant23, clase: 'bin', max: 23, filtro: /[^01]/g, n: 5, span: 2, expl: `Lo que queda detrás de la coma en ${norm.split(' ×')[0]} sin el 1 implícito: ${mant || '(nada)'}, y ceros hasta completar 23 bits` }],
            { linea: true },
            [{ lbl: 'hexadecimal' }, { c: hex, clase: 'hex', max: 8, filtro: /[^0-9a-fA-F]/g, n: 6, span: 2, expl: `${bits32.match(/.{4}/g).join(' ')} → ${hex}` }]
          ],
          correcto: `Correcto: ${numES(x)} = ${neg ? '−' : ''}${norm} → ${hex.match(/.{2}/g).join(' ')} en hexadecimal.`
        };
      }
    },

    /* ---------- UT2 · estados de un proceso ---------- */
    estados: {
      titulo: 'Estados de un proceso',
      rejilla: true,
      generar() {
        const OPC = ['?', 'nuevo', 'listo', 'en ejecución', 'bloqueado', 'terminado'];
        const TR = ['?', '1', '2', '3', '4', 'ninguna'];
        const S = [
          { t: 'El proceso pide leer un archivo del disco y tiene que esperar a que llegue el dato.', de: 'en ejecución', a: 'bloqueado', tr: '1', e: 'Pide una E/S: suelta la CPU y espera el recurso. Es la única transición que inicia el propio proceso.' },
          { t: 'En Round Robin, el proceso agota su quantum sin haber terminado.', de: 'en ejecución', a: 'listo', tr: '2', e: 'El sistema le quita la CPU sin que haya terminado: vuelve a la cola de listos.' },
          { t: 'En prioridades expulsivo llega un proceso más prioritario y lo desaloja.', de: 'en ejecución', a: 'listo', tr: '2', e: 'Lo expulsan: no ha terminado ni espera nada, así que sigue listo, en la cola.' },
          { t: 'El planificador lo elige y entra en la CPU.', de: 'listo', a: 'en ejecución', tr: '3', e: 'Estaba listo, esperando turno, y el planificador le da la CPU.' },
          { t: 'Llega del disco el dato que estaba esperando.', de: 'bloqueado', a: 'listo', tr: '4', e: 'Ya tiene lo que esperaba, pero la CPU está ocupada: va al final de la cola de listos, nunca directo a ejecución.' },
          { t: 'El usuario pulsa la tecla que el proceso llevaba un rato esperando.', de: 'bloqueado', a: 'listo', tr: '4', e: 'Llega el recurso (la tecla): pasa a listo y espera turno en la cola.' },
          { t: 'Manda una página a la impresora y tiene que esperar a que la cola la acepte.', de: 'en ejecución', a: 'bloqueado', tr: '1', e: 'Espera un recurso de E/S: se bloquea hasta que esté disponible.' },
          { t: 'Ejecuta su última instrucción.', de: 'en ejecución', a: 'terminado', tr: 'ninguna', e: 'Solo se puede terminar desde la CPU. No es ninguna de las cuatro transiciones entre los tres estados.' },
          { t: 'Llega por la red el paquete que el proceso esperaba.', de: 'bloqueado', a: 'listo', tr: '4', e: 'Ya tiene lo que esperaba: a la cola de listos, al final.' },
          { t: 'En SRTF llega otro proceso al que le queda menos tiempo que a él.', de: 'en ejecución', a: 'listo', tr: '2', e: 'SRTF es expulsivo: el nuevo lo desaloja y él vuelve a la cola de listos.' },
          { t: 'El sistema acaba de crearlo y lo admite en la cola.', de: 'nuevo', a: 'listo', tr: 'ninguna', e: 'Un proceso recién creado entra en la cola de listos. No es ninguna de las cuatro transiciones entre los tres estados.' },
          { t: 'Termina de escribirse en el disco lo que había pedido guardar.', de: 'bloqueado', a: 'listo', tr: '4', e: 'La E/S que esperaba ha terminado: pasa a listo y espera turno.' },
          { t: 'La CPU queda libre y él es el primero de la cola de listos (FIFO).', de: 'listo', a: 'en ejecución', tr: '3', e: 'El planificador elige al primero de la cola y le da la CPU.' },
          { t: 'Pide leer del teclado y todavía no hay nada escrito.', de: 'en ejecución', a: 'bloqueado', tr: '1', e: 'No puede seguir sin el dato: se bloquea hasta que el usuario escriba.' },
          { t: 'En prioridades no expulsivo termina el proceso que estaba en la CPU y él es el más prioritario de los que esperan.', de: 'listo', a: 'en ejecución', tr: '3', e: 'Al quedar libre la CPU, el planificador elige al más prioritario de los listos.' }
        ];
        const s = S[rnd(0, S.length - 1)];
        return {
          enunciado: 'Lee lo que le pasa al proceso y elige el estado de origen, el de destino y el número de la transición en la figura.',
          tarea: 'Lee lo que le pasa al proceso: ¿de qué estado a qué estado pasa, y por qué transición de la figura?',
          columnas: '190px 640px', clase: 'texto',
          filas: [
            [{ lbl: 'qué pasa' }, { d: s.t, clase: 'texto' }],
            [{ lbl: 'estaba en' }, { sel: OPC, c: s.de, clase: 'txt', n: 0, expl: `Estaba en ${s.de}. ${s.e}` }],
            [{ lbl: 'pasa a' }, { sel: OPC, c: s.a, clase: 'txt', n: 1, expl: `Pasa a ${s.a}. ${s.e}` }],
            [{ lbl: 'transición' }, { sel: TR, c: s.tr, clase: 'txt', n: 2, expl: s.tr === 'ninguna' ? s.e : `Es la transición ${s.tr} de la figura: ${s.de} → ${s.a}.` }]
          ],
          correcto: `Correcto: ${s.de} → ${s.a}` + (s.tr === 'ninguna' ? '.' : ` (transición ${s.tr}).`)
        };
      }
    },

    /* ---------- UT2 · planificación de procesos (el ejercicio del examen) ---------- */
    planificacion: {
      titulo: 'Planificación de procesos',
      rejilla: true,
      modos: [{ t: 'FIFO', v: 'fifo' }, { t: 'SJF', v: 'sjf' }, { t: 'SRTF', v: 'srtf' }, { t: 'Prio. no exp.', v: 'pne' }, { t: 'Prio. exp.', v: 'pe' }, { t: 'RR q = 2', v: 'rr' }, { t: 'Al azar', v: null }],
      generar(cfg) {
        const ALGOS = ['fifo', 'sjf', 'srtf', 'pne', 'pe', 'rr'];
        const NOM = { fifo: 'FIFO', sjf: 'SJF', srtf: 'SRTF', pne: 'prioridades no expulsivo', pe: 'prioridades expulsivo', rr: 'Round Robin con q = 2' };
        const algo = cfg.modo || ALGOS[rnd(0, 5)];
        const q = 2, N = 4;
        const prs = [1, 2, 3, 4].sort(() => Math.random() - .5);
        const procs = [];
        for (let i = 0; i < N; i++) procs.push({ ll: i === 0 ? 0 : rnd(1, 6), ej: rnd(2, 5), pr: prs[i] });
        procs.sort((a, b) => a.ll - b.ll);
        procs[0].ll = 0;
        const R = simulaPlan(procs, algo, q);
        const T = R.T, W = 1 + T;
        const conPrio = algo === 'pne' || algo === 'pe';
        const P = (i) => 'P' + (i + 1);
        const fill = (row) => { const usado = row.reduce((a, it) => a + (it.span || 1), 0); if (usado < W) row.push({ d: '', span: W - usado }); return row; };
        const lista = (ids) => ids.map(P).join(' y ');
        const motivo = (ev) => {
          const p = [];
          if (ev.llegan.length) p.push(`llega ${lista(ev.llegan)}`);
          if (ev.requeue !== null) p.push(`${P(ev.requeue)} agota su quantum y vuelve al final de la cola`);
          if (ev.expulsa) p.push(`${P(ev.expulsa.entra)} expulsa a ${P(ev.expulsa.sale)} (${algo === 'srtf' ? `le quedan ${ev.expulsa.kEntra} frente a ${ev.expulsa.kSale}` : `prioridad ${ev.expulsa.kEntra} frente a ${ev.expulsa.kSale}`})`);
          if (ev.ocioso) { p.push('nadie está listo: la CPU queda libre (escribe −)'); return p.join('; ') + '.'; }
          if (ev.entra !== null) {
            const i = ev.entra, solo = ev.colaAntes.length === 1;
            const por = { fifo: 'el primero de la cola', sjf: `el de menor ejecución (${procs[i].ej})`, srtf: `el que menos tiempo tiene pendiente (${ev.claveEntra})`, pne: `el de mayor prioridad (${procs[i].pr})`, pe: `el de mayor prioridad (${procs[i].pr})`, rr: 'el primero de la cola' }[algo];
            p.push(`entra ${P(i)}, ${solo ? 'el único que espera' : por}`);
          } else p.push(`sigue ${P(ev.ejecuta)}` + (ev.llegan.length && !['srtf', 'pe', 'rr'].includes(algo) ? ' (no expulsivo)' : ''));
          return p.join('; ') + `. Entre t = ${ev.t} y t = ${ev.t + 1} se ejecuta ${P(ev.ejecuta)}.`;
        };
        const fmt = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
        const cmpMedia = (suma) => (v) => { const s = String(v).replace(/\s+/g, ''); return s === `${suma}/${N}` || Math.abs(aNum(s) - suma / N) < 0.001; };
        const sumEsp = R.esp.reduce((a, b) => a + b, 0), sumResp = R.resp.reduce((a, b) => a + b, 0);
        const filas = [];
        filas.push(fill([{ lbl: 'proceso' }, ...procs.map((p, i) => ({ d: P(i), clase: 'ph p' + (i + 1) }))]));
        filas.push(fill([{ lbl: 'llegada' }, ...procs.map((p) => ({ d: String(p.ll), clase: 'dato' }))]));
        filas.push(fill([{ lbl: 'ejecución' }, ...procs.map((p) => ({ d: String(p.ej), clase: 'dato' }))]));
        if (conPrio) filas.push(fill([{ lbl: 'prioridad' }, ...procs.map((p) => ({ d: String(p.pr), clase: 'dato' }))]));
        filas.push({ linea: true, clase: 'suave', desde: 1 });
        filas.push([{ lbl: 't' }, ...R.units.map((ev) => ({ d: String(ev.t), clase: 'peq' }))]);
        filas.push([{ lbl: 'CPU' }, ...R.units.map((ev, u) => ({ c: ev.ocioso ? '−' : String(ev.ejecuta + 1), clase: 'cpu', max: 1, filtro: /[^1-4−-]/g, n: u, cmp: ev.ocioso ? (v) => v === '−' || v === '-' : null, expl: `t = ${ev.t}: ` + motivo(ev) }))]);
        procs.forEach((p, i) => filas.push([{ lbl: P(i) }, ...R.units.map(() => ({ d: '', clase: 'celda' }))]));
        filas.push({ linea: true, clase: 'suave', desde: 1 });
        filas.push(fill([{ lbl: 'respuesta' }, ...procs.map((p, i) => ({ c: String(R.resp[i]), clase: 'num', max: 2, filtro: /[^0-9]/g, n: 100 + i, expl: `${P(i)} termina en t = ${R.fin[i]}: respuesta = fin − llegada = ${R.fin[i]} − ${p.ll} = ${R.resp[i]}` }))]));
        filas.push(fill([{ lbl: 'espera' }, ...procs.map((p, i) => ({ c: String(R.esp[i]), clase: 'num', max: 2, filtro: /[^0-9]/g, n: 200 + i, expl: `${P(i)}: espera = respuesta − ejecución = ${R.resp[i]} − ${p.ej} = ${R.esp[i]}` }))]));
        filas.push(fill([{ lbl: 'respuesta media' }, { c: `${sumResp}/${N}`, clase: 'dec', max: 7, filtro: /[^0-9,./]/g, span: 3, n: 300, cmp: cmpMedia(sumResp), expl: `(${R.resp.join(' + ')}) / ${N} = ${sumResp}/${N} = ${fmt(sumResp / N)}` }]));
        filas.push(fill([{ lbl: 'espera media' }, { c: `${sumEsp}/${N}`, clase: 'dec', max: 7, filtro: /[^0-9,./]/g, span: 3, n: 301, cmp: cmpMedia(sumEsp), expl: `(${R.esp.join(' + ')}) / ${N} = ${sumEsp}/${N} = ${fmt(sumEsp / N)}` }]));
        return {
          enunciado: `${NOM[algo][0].toUpperCase() + NOM[algo].slice(1)}. Fila CPU: el proceso (1 a 4) de cada unidad de tiempo; luego los tiempos y las medias (fracción o coma).`,
          tarea: `${NOM[algo][0].toUpperCase() + NOM[algo].slice(1)}: cronograma, tiempos de respuesta y de espera de cada proceso, y las dos medias.`,
          columnas: `118px repeat(${T}, ${T > 16 ? 36 : 42}px)`, clase: 'plan' + (T > 16 ? ' xs' : ''),
          filas,
          alEscribir(sv) {
            const cpu = [...sv.querySelectorAll('.cpu')], celdas = [...sv.querySelectorAll('.d.celda')];
            celdas.forEach((c) => { c.className = 'd celda'; });
            cpu.forEach((inp, u) => {
              const v = parseInt(inp.value !== undefined ? inp.value : inp.textContent, 10);
              if (v >= 1 && v <= N && celdas[(v - 1) * T + u]) celdas[(v - 1) * T + u].classList.add('on', 'p' + v);
            });
          },
          correcto: `Correcto. ${NOM[algo][0].toUpperCase() + NOM[algo].slice(1)}: orden ${R.units.map((ev) => (ev.ocioso ? '−' : P(ev.ejecuta))).join(' ')}; espera media ${sumEsp}/${N} = ${fmt(sumEsp / N)}, respuesta media ${sumResp}/${N} = ${fmt(sumResp / N)}.`
        };
      }
    },

    /* ---------- UT2 · paginación y fragmentación ---------- */
    paginacion: {
      titulo: 'Paginación y fragmentación',
      rejilla: true,
      modos: [{ t: 'Páginas', v: 'paginas' }, { t: 'Huecos', v: 'huecos' }, { t: 'Memoria virtual', v: 'virtual' }, { t: 'Al azar', v: null }],
      generar(cfg) {
        const modo = cfg.modo || ['paginas', 'huecos', 'virtual'][rnd(0, 2)];
        const SN = ['?', 'sí', 'no'];
        if (modo === 'paginas') {
          const pag = [1, 2, 4, 8][rnd(0, 3)];
          let tam = rnd(5, 200); if (tam % pag === 0) tam += 1;
          const np = Math.ceil(tam / pag), ocupa = np * pag, frag = ocupa - tam;
          return {
            enunciado: 'Un proceso se reparte en páginas de tamaño fijo. Calcula cuántas necesita, cuánto ocupa en total y cuánto se pierde en la última página.',
            tarea: 'Páginas que necesita el proceso, memoria que ocupa y fragmentación interna.',
            columnas: '300px 150px 90px',
            filas: [
              [{ lbl: 'tamaño del proceso' }, { d: String(tam), clase: 'dato' }, { lbl: 'KiB' }],
              [{ lbl: 'tamaño de página' }, { d: String(pag), clase: 'dato' }, { lbl: 'KiB' }],
              [{ lbl: 'páginas necesarias' }, { c: String(np), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 0, expl: `${tam} / ${pag} = ${(tam / pag).toFixed(2).replace('.', ',')}: se redondea hacia arriba, porque una página a medias también hay que tenerla. ${np} páginas.` }, { lbl: '' }],
              [{ lbl: 'ocupa en memoria' }, { c: String(ocupa), clase: 'num', max: 4, filtro: /[^0-9]/g, n: 1, expl: `${np} páginas × ${pag} KiB = ${ocupa} KiB.` }, { lbl: 'KiB' }],
              [{ lbl: 'fragmentación interna' }, { c: String(frag), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 2, expl: `Ocupa ${ocupa} KiB para guardar ${tam} KiB: ${ocupa} − ${tam} = ${frag} KiB perdidos dentro de la última página.` }, { lbl: 'KiB' }]
            ],
            correcto: `Correcto: ${np} páginas, ${ocupa} KiB ocupados y ${frag} KiB de fragmentación interna.`
          };
        }
        if (modo === 'huecos') {
          const k = rnd(3, 4);
          const huecos = Array.from({ length: k }, () => rnd(2, 9));
          const total = huecos.reduce((a, b) => a + b, 0);
          const mayor = Math.max(...huecos);
          const cabe = Math.random() < 0.5;
          const tam = cabe ? rnd(2, mayor) : rnd(mayor + 1, Math.max(mayor + 1, total));
          const idx = huecos.findIndex((h) => h >= tam);
          const enHueco = idx >= 0 ? String(idx + 1) : 'ninguno';
          const HU = ['?', ...huecos.map((h, i) => String(i + 1)), 'ninguno'];
          const FEN = ['?', 'fragmentación externa', 'fragmentación interna', 'no hay fragmentación'];
          const fen = tam <= mayor ? 'no hay fragmentación' : (tam <= total ? 'fragmentación externa' : 'no hay fragmentación');
          const fenExpl = tam > mayor && tam <= total ? `Hay ${total} KiB libres en total pero ningún hueco de ${tam} KiB seguidos: fragmentación externa (habría que compactar).` : (tam <= mayor ? 'Cabe en un hueco: no hay fragmentación que impida cargarlo.' : `Ni juntando todos los huecos (${total} KiB) cabe: falta memoria, no es fragmentación.`);
          return {
            enunciado: 'Con particiones de tamaño variable, un proceso solo cabe en un hueco igual o mayor que él, aunque la suma de los huecos sea suficiente.',
            tarea: '¿Cabe el proceso? ¿En qué hueco? ¿Qué fragmentación hay?',
            columnas: `300px repeat(${k}, 90px)`,
            filas: [
              [{ lbl: 'huecos libres (KiB)' }, ...huecos.map((h) => ({ d: String(h), clase: 'dato' }))],
              [{ lbl: 'proceso que quiere entrar' }, { d: String(tam) + ' KiB', clase: 'dato', span: k }],
              [{ lbl: 'memoria libre en total' }, { c: String(total), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 0, expl: `${huecos.join(' + ')} = ${total} KiB libres en total.`, span: k }],
              [{ lbl: '¿cabe?' }, { sel: SN, c: tam <= mayor ? 'sí' : 'no', clase: 'txt', n: 1, expl: tam <= mayor ? `Sí: el hueco ${idx + 1} tiene ${huecos[idx]} KiB y el proceso necesita ${tam}.` : `No: el hueco mayor tiene ${mayor} KiB y el proceso necesita ${tam} seguidos.`, span: k }],
              [{ lbl: 'en el hueco' }, { sel: HU, c: enHueco, clase: 'txt', n: 2, expl: idx >= 0 ? `El primero en el que cabe es el hueco ${idx + 1} (${huecos[idx]} KiB).` : 'No cabe en ninguno.', span: k }],
              [{ lbl: 'fenómeno' }, { sel: FEN, c: fen, clase: 'txt', n: 3, expl: fenExpl, span: k }]
            ],
            correcto: `Correcto. ${fenExpl}`
          };
        }
        const pag = [2, 4, 8][rnd(0, 2)];
        const tam = rnd(20, 200);
        const np = Math.ceil(tam / pag);
        const marcos = Math.random() < 0.5 ? rnd(np, np + 10) : rnd(Math.max(1, np - 12), np - 1);
        const cabe = marcos >= np;
        const faltan = cabe ? 0 : np - marcos;
        return {
          enunciado: 'Con memoria virtual, en la RAM solo tiene que estar la parte del proceso que se usa. Calcula si cabe entero o cuántas páginas quedan en el disco.',
          tarea: '¿Cabe el proceso entero en la RAM? Si no, ¿cuántas páginas quedan en el disco?',
          columnas: '300px 150px 90px',
          filas: [
            [{ lbl: 'tamaño del proceso' }, { d: String(tam), clase: 'dato' }, { lbl: 'KiB' }],
            [{ lbl: 'tamaño de página' }, { d: String(pag), clase: 'dato' }, { lbl: 'KiB' }],
            [{ lbl: 'marcos libres en la RAM' }, { d: String(marcos), clase: 'dato' }, { lbl: '' }],
            [{ lbl: 'páginas del proceso' }, { c: String(np), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 0, expl: `${tam} / ${pag}, redondeado hacia arriba: ${np} páginas.` }, { lbl: '' }],
            [{ lbl: '¿cabe entero?' }, { sel: SN, c: cabe ? 'sí' : 'no', clase: 'txt', n: 1, expl: cabe ? `Sí: ${np} páginas y ${marcos} marcos libres.` : `No: ${np} páginas y solo ${marcos} marcos libres.` }, { lbl: '' }],
            [{ lbl: 'páginas que quedan en disco' }, { c: String(faltan), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 2, expl: cabe ? 'Cabe entero: ninguna. La memoria virtual no hace falta.' : `${np} − ${marcos} = ${faltan} páginas se quedan en el disco y se traen cuando el proceso las toca (fallo de página).` }, { lbl: '' }]
          ],
          correcto: cabe ? `Correcto: ${np} páginas caben en ${marcos} marcos.` : `Correcto: ${np} páginas, ${marcos} marcos: ${faltan} páginas esperan en el disco.`
        };
      }
    },

    /* ---------- UT2 · ordena el arranque ---------- */
    arranque: {
      titulo: 'Ordena el arranque',
      rejilla: true,
      modos: [{ t: 'UEFI y GPT', v: 'uefi' }, { t: 'BIOS y MBR', v: 'bios' }, { t: 'Al azar', v: null }],
      generar(cfg) {
        const modo = cfg.modo || ['uefi', 'bios'][rnd(0, 1)];
        const uefi = modo === 'uefi';
        const PASOS = [
          { t: uefi ? 'El procesador ejecuta el firmware UEFI guardado en la flash de la placa' : 'El procesador ejecuta la BIOS guardada en la flash de la placa', e: 'Lo primero al dar corriente: el procesador solo sabe ejecutar lo que hay en la memoria de la placa.' },
          { t: 'POST: se comprueban memoria, procesador, teclado y gráfica', e: 'El firmware comprueba el hardware antes de buscar nada en el disco.' },
          { t: 'Se busca un dispositivo de arranque según el orden configurado', e: 'Disco, USB, DVD o red: el primero de la lista que tenga algo arrancable.' },
          { t: uefi ? 'Se ejecuta el cargador (.efi) de la partición EFI' : 'Se ejecuta el código del MBR, el sector 0 del disco', e: uefi ? 'El firmware UEFI lee un archivo de la partición EFI (FAT32): Windows Boot Manager o GRUB.' : 'La BIOS carga el sector 0 y le pasa el control: ahí está el cargador y la tabla de particiones.' },
          { t: 'El cargador lleva el núcleo del sistema operativo a la memoria', e: 'Es el momento en que el sistema operativo empieza a existir en la RAM.' },
          { t: 'El núcleo comprueba el sistema de archivos y arranca los servicios', e: 'Con el núcleo en marcha se montan los discos y arrancan los procesos del sistema.' },
          { t: 'Aparece la pantalla de inicio de sesión', e: 'El equipo está listo y espera al usuario.' }
        ];
        const orden = PASOS.map((p, i) => i).sort(() => Math.random() - .5);
        const filas = orden.map((i) => [{ d: PASOS[i].t, clase: 'texto', span: 4 }, { c: String(i + 1), clase: 'num', max: 1, filtro: /[^1-7]/g, n: i, expl: `Paso ${i + 1}: ${PASOS[i].t}. ${PASOS[i].e}` }]);
        return {
          enunciado: `Arranque con ${uefi ? 'UEFI y GPT' : 'BIOS y MBR'}: escribe junto a cada paso su número de orden, del 1 (al dar corriente) al 7 (equipo listo).`,
          tarea: `Arranque con ${uefi ? 'UEFI y GPT' : 'BIOS y MBR'}: numera los pasos del 1 al 7.`,
          columnas: 'repeat(4, 185px) 84px', clase: 'texto',
          filas,
          correcto: 'Correcto: ' + PASOS.map((p, i) => `${i + 1} ${p.t.split(':')[0].split(' ').slice(0, 4).join(' ')}…`).join(' · ')
        };
      }
    },

    /* ---------- UT2 · qué sistema de archivos ---------- */
    'sistemas-archivos': {
      titulo: '¿Qué sistema de archivos?',
      rejilla: true,
      generar() {
        const SN = ['?', 'sí', 'no'];
        const FS = ['?', 'FAT32', 'exFAT', 'NTFS', 'ext4', 'APFS', 'UDF'];
        const C = [
          { t: 'El disco interno donde vas a instalar Windows 11.', varios: 'no', grande: 'sí', permisos: 'sí', sistema: 'sí', fs: ['NTFS'], e: 'Es el disco del sistema: el nativo de Windows, con permisos y journaling.' },
          { t: 'El disco interno donde vas a instalar Ubuntu.', varios: 'no', grande: 'sí', permisos: 'sí', sistema: 'sí', fs: ['ext4'], e: 'Es el disco del sistema: el nativo de Linux, con permisos y journaling.' },
          { t: 'Un pendrive de 16 GB para llevar apuntes y presentaciones al aula, que se enchufa en cualquier PC.', varios: 'sí', grande: 'no', permisos: 'no', sistema: 'no', fs: ['FAT32', 'exFAT'], e: 'Lo tiene que leer todo y los archivos son pequeños: FAT32 (o exFAT).' },
          { t: 'Un pendrive para ver películas en la tele del salón; algunas películas ocupan 6 GB.', varios: 'sí', grande: 'sí', permisos: 'no', sistema: 'no', fs: ['exFAT'], e: 'Varios aparatos y archivos de más de 4 GiB: exFAT. FAT32 no admite ese tamaño.' },
          { t: 'Un disco externo para mover vídeos entre un portátil con Windows y un Mac.', varios: 'sí', grande: 'sí', permisos: 'no', sistema: 'no', fs: ['exFAT'], e: 'Windows y Mac escriben los dos en exFAT; NTFS en Mac es solo lectura.' },
          { t: 'Un disco externo para las copias de seguridad de un PC con Windows.', varios: 'no', grande: 'sí', permisos: 'sí', sistema: 'no', fs: ['NTFS'], e: 'Solo Windows, archivos grandes y conviene conservar permisos y journaling: NTFS.' },
          { t: 'La tarjeta microSD de 32 GB de una cámara de fotos antigua.', varios: 'sí', grande: 'no', permisos: 'no', sistema: 'no', fs: ['FAT32'], e: 'Las cámaras piden FAT32 en tarjetas de hasta 32 GB.' },
          { t: 'La tarjeta de 128 GB de una consola portátil.', varios: 'sí', grande: 'sí', permisos: 'no', sistema: 'no', fs: ['exFAT'], e: 'A partir de 64 GB los aparatos usan exFAT.' },
          { t: 'Un DVD que vas a grabar con las fotos del viaje.', varios: 'sí', grande: 'no', permisos: 'no', sistema: 'no', fs: ['UDF'], e: 'Los discos ópticos grabados van en UDF.' },
          { t: 'El disco de un MacBook donde va instalado macOS.', varios: 'no', grande: 'sí', permisos: 'sí', sistema: 'sí', fs: ['APFS'], e: 'Es el disco del sistema de un Mac: APFS.' },
          { t: 'Una partición de datos compartida en un PC que tiene Windows y Ubuntu instalados.', varios: 'sí', grande: 'sí', permisos: 'no', sistema: 'no', fs: ['exFAT', 'NTFS'], e: 'Los dos sistemas la tienen que escribir: exFAT, o NTFS (Linux lo escribe con su driver).' },
          { t: 'Un pendrive con la imagen de instalación de Windows (un archivo de 5 GB) para arrancar un PC.', varios: 'sí', grande: 'sí', permisos: 'no', sistema: 'no', fs: ['exFAT', 'NTFS'], e: 'Un archivo de más de 4 GiB descarta FAT32: exFAT o NTFS, según lo que admita el firmware.' },
          { t: 'Un pendrive para el USB del coche, que solo reproduce música.', varios: 'sí', grande: 'no', permisos: 'no', sistema: 'no', fs: ['FAT32'], e: 'Los reproductores antiguos solo leen FAT32 y las canciones son pequeñas.' },
          { t: 'El disco de un servidor Linux con las carpetas personales de veinte usuarios.', varios: 'no', grande: 'sí', permisos: 'sí', sistema: 'sí', fs: ['ext4'], e: 'Permisos por usuario, journaling y disco de trabajo: ext4.' },
          { t: 'Un disco externo de 4 TB solo para un PC con Windows, con vídeos de más de 10 GB.', varios: 'no', grande: 'sí', permisos: 'no', sistema: 'no', fs: ['NTFS', 'exFAT'], e: 'Solo Windows y archivos enormes: NTFS (o exFAT si no hacen falta permisos).' }
        ];
        const c = C[rnd(0, C.length - 1)];
        return {
          enunciado: 'Lee el caso, contesta a las cuatro preguntas y elige el sistema de archivos. Si hay dos opciones válidas, cualquiera de las dos vale.',
          tarea: 'Lee el caso y elige el sistema de archivos. Si hay dos opciones válidas, cualquiera vale.',
          columnas: '330px 470px', clase: 'texto',
          filas: [
            [{ lbl: 'caso' }, { d: c.t, clase: 'texto' }],
            [{ lbl: '¿lo leerán varios sistemas o aparatos?' }, { sel: SN, c: c.varios, clase: 'txt', n: 0, expl: c.varios === 'sí' ? 'Sí: tiene que leerlo más de un sistema o aparato, así que hay que buscar uno que entiendan todos.' : 'No: lo usa un solo sistema, así que puede llevar su sistema de archivos nativo.' }],
            [{ lbl: '¿archivos de más de 4 GiB?' }, { sel: SN, c: c.grande, clase: 'txt', n: 1, expl: c.grande === 'sí' ? 'Sí: eso descarta FAT32, que no admite archivos de 4 GiB o más.' : 'No: FAT32 sirve.' }],
            [{ lbl: '¿permisos y seguridad?' }, { sel: SN, c: c.permisos, clase: 'txt', n: 2, expl: c.permisos === 'sí' ? 'Sí: hacen falta permisos, así que NTFS, ext4 o APFS.' : 'No: no hacen falta permisos.' }],
            [{ lbl: '¿es el disco del sistema o de trabajo?' }, { sel: SN, c: c.sistema, clase: 'txt', n: 3, expl: c.sistema === 'sí' ? 'Sí: journaling obligatorio, nunca FAT.' : 'No: puede ir sin journaling.' }],
            [{ lbl: 'sistema de archivos' }, { sel: FS, c: c.fs[0], clase: 'txt', n: 4, cmp: (v) => c.fs.includes(v), expl: c.e }]
          ],
          correcto: `Correcto: ${c.fs.join(' o ')}. ${c.e}`
        };
      }
    },
    /* ---------- UT3 · anfitrión e invitados ---------- */
    anfitrion: {
      titulo: 'Anfitrión e invitado',
      rejilla: true,
      generar() {
        const PROG = [
          { n: 'VMware Workstation Pro', tipo: 'tipo 2', lic: 'propietario gratuito', hosts: 'pc', exT: 'Es un programa que se instala sobre un sistema operativo: hipervisor de tipo 2.', exL: 'Es propietario y gratuito para cualquier uso desde noviembre de 2024: se usa sin pagar, pero el código no está publicado.' },
          { n: 'VirtualBox', tipo: 'tipo 2', lic: 'libre', hosts: 'todos', exT: 'Es un programa que se instala sobre un sistema operativo: hipervisor de tipo 2.', exL: 'El paquete base es software libre (GPLv3): el código está publicado. El Extension Pack, aparte, es propietario.' },
          { n: 'Hyper-V', tipo: 'tipo 1', lic: 'incluido en Windows', hosts: 'winpro', exT: 'Hyper-V es de tipo 1: aunque se active desde Windows, se coloca por debajo y el propio Windows pasa a funcionar sobre él.', exL: 'Viene con Windows 11 Pro, Education y Enterprise: va incluido en la licencia de Windows.' },
          { n: 'VMware Fusion', tipo: 'tipo 2', lic: 'propietario gratuito', hosts: 'mac', exT: 'Es un programa que se instala sobre macOS: hipervisor de tipo 2.', exL: 'Es la versión de VMware para Mac: propietaria y gratuita, como Workstation Pro.' },
          { n: 'Parallels Desktop', tipo: 'tipo 2', lic: 'propietario de pago', hosts: 'mac', exT: 'Es un programa que se instala sobre macOS: hipervisor de tipo 2.', exL: 'Parallels Desktop es propietario y de pago (suscripción).' }
        ];
        const EQ = {
          pc: [['Un portátil', 'Windows 11 Home'], ['Un PC del aula', 'Windows 11 Education'], ['Un portátil', 'Windows 11 Pro'], ['Un PC de sobremesa', 'Ubuntu 24.04'], ['Un portátil', 'Linux Mint 22']],
          todos: [['Un portátil', 'Windows 11 Home'], ['Un PC del aula', 'Windows 11 Education'], ['Un PC de sobremesa', 'Ubuntu 24.04'], ['Un PC de sobremesa', 'Debian 13'], ['Un MacBook con chip de Apple', 'macOS']],
          winpro: [['Un PC del aula', 'Windows 11 Education'], ['Un portátil', 'Windows 11 Pro'], ['Un servidor pequeño', 'Windows Server 2025']],
          mac: [['Un MacBook con chip de Apple', 'macOS']]
        };
        const INV = ['Ubuntu 24.04', 'Windows 11', 'Debian 13', 'Alpine Linux', 'Windows Server 2025', 'Fedora 42', 'Windows XP', 'Linux Mint 22', 'MS-DOS 6.22'];
        const INV_ARM = ['Ubuntu 24.04 para ARM', 'Windows 11 para ARM', 'Debian 13 para ARM', 'Fedora 42 para ARM'];
        const p = PROG[rnd(0, PROG.length - 1)];
        const lista = EQ[p.hosts];
        const [eq, so] = lista[rnd(0, lista.length - 1)];
        const k = rnd(2, 3);
        const inv = baraja((so === 'macOS' ? INV_ARM : INV).filter((x) => x !== so)).slice(0, k);
        const nombres = inv.length === 2 ? `una con ${inv[0]} y otra con ${inv[1]}` : `una con ${inv[0]}, otra con ${inv[1]} y otra con ${inv[2]}`;
        const t = p.n === 'Hyper-V'
          ? `${eq} con ${so} tiene activado Hyper-V. Dentro hay ${k} máquinas virtuales: ${nombres}.`
          : `${eq} con ${so} tiene instalado ${p.n}. Dentro hay ${k} máquinas virtuales: ${nombres}.`;
        const OPC = ['?'].concat(baraja([so].concat(inv)));
        return {
          enunciado: 'Lee el caso y contesta: cuál es el sistema anfitrión, cuántos invitados hay, de qué tipo es el hipervisor y qué licencia tiene el programa.',
          tarea: 'Sistema anfitrión, número de invitados, tipo de hipervisor y licencia del programa.',
          columnas: '230px 620px', clase: 'texto',
          filas: [
            [{ lbl: 'caso' }, { d: t, clase: 'texto' }],
            [{ lbl: 'sistema anfitrión' }, { sel: OPC, c: so, clase: 'txt', n: 0, expl: `El anfitrión es el sistema instalado en el equipo real: ${so}. Los que están dentro de las máquinas virtuales son los invitados.` }],
            [{ lbl: 'número de invitados' }, { c: String(k), clase: 'num', max: 1, filtro: /[^0-9]/g, n: 1, expl: `Cada máquina virtual tiene su sistema invitado: ${inv.join(', ')}. Son ${k}.` }],
            [{ lbl: 'tipo de hipervisor' }, { sel: ['?', 'tipo 1', 'tipo 2'], c: p.tipo, clase: 'txt', n: 2, expl: p.exT }],
            [{ lbl: 'licencia del programa' }, { sel: ['?', 'libre', 'propietario gratuito', 'propietario de pago', 'incluido en Windows'], c: p.lic, clase: 'txt', n: 3, expl: p.exL }]
          ],
          correcto: `Correcto: anfitrión ${so}, ${k} invitados, ${p.n} es de ${p.tipo} y ${p.lic === 'libre' ? 'software libre' : p.lic}.`
        };
      }
    },

    /* ---------- UT3 · ¿cabe en mi ordenador? (reparto de recursos) ----------
       Reglas del módulo: al anfitrión con Windows 11 se le dejan al menos 4 GB; a cada máquina,
       como mucho la mitad de los hilos; un disco dinámico ocupa lo escrito y uno fijo, todo. */
    recursos: {
      titulo: '¿Cabe en mi ordenador?',
      rejilla: true,
      generar() {
        const RAM = [8, 16, 16, 32][rnd(0, 3)];
        const HILOS = [4, 8, 8, 12, 16][rnd(0, 4)];
        const LIBRE = [120, 200, 250, 500][rnd(0, 3)];
        const NOM = baraja(['Ubuntu', 'Windows 11', 'Debian', 'Alpine', 'Servidor']);
        const k = rnd(2, 3);
        const vms = [];
        for (let i = 0; i < k; i++) {
          const nombre = NOM[i], ligera = nombre === 'Alpine';
          const ram = ligera ? 1 : [2, 4, 4, 6, 8][rnd(0, 4)];
          const nucleos = ligera ? 1 : [1, 2, 2, 4][rnd(0, 3)];
          const max = ligera ? 8 : (nombre === 'Windows 11' ? 64 : [25, 30, 40, 50][rnd(0, 3)]);
          const fijo = !ligera && Math.random() < 0.3;
          const usado = fijo ? max : rnd(Math.min(3, max - 2), Math.max(4, Math.floor(max * 0.6)));
          vms.push({ nombre, ram, nucleos, max, fijo, usado });
        }
        let suma = vms.reduce((a, v) => a + v.ram, 0);
        while (suma > RAM - 1) {                       // que no salga una memoria negativa
          const v = vms.reduce((a, b) => (b.ram > a.ram ? b : a));
          v.ram = Math.max(1, v.ram - 2); suma = vms.reduce((a, x) => a + x.ram, 0);
        }
        const queda = RAM - suma, aLaVez = queda >= 4 ? 'sí' : 'no';
        const maxNuc = HILOS / 2;
        const ocupa = vms.reduce((a, v) => a + v.usado, 0);
        const SN = ['?', 'sí', 'no'];
        const filas = [
          [{ lbl: 'tu equipo' }, { d: RAM + ' GB de RAM', clase: 'texto' }, { d: HILOS + ' hilos', clase: 'texto' }, { d: LIBRE + ' GB libres', clase: 'texto' }]
        ];
        vms.forEach((v) => filas.push([{ lbl: v.nombre }, { d: v.ram + ' GB de RAM', clase: 'texto' }, { d: v.nucleos + (v.nucleos === 1 ? ' núcleo' : ' núcleos'), clase: 'texto' },
          { d: v.fijo ? `fijo · ${v.max} GB` : `dinámico · ${v.max} GB máx. · ${v.usado} GB escritos`, clase: 'texto' }]));
        filas.push({ linea: true, clase: 'suave', desde: 1 });
        filas.push([{ lbl: 'RAM que le queda al anfitrión' }, { c: String(queda), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 0, expl: `Con todas encendidas: ${RAM} − (${vms.map((v) => v.ram).join(' + ')}) = ${queda} GB.` }, { d: 'GB', clase: 'peq' }, { d: '' }]);
        filas.push([{ lbl: '¿se pueden encender todas a la vez?' }, { sel: SN, c: aLaVez, clase: 'txt', n: 1, span: 2, expl: aLaVez === 'sí' ? `Le quedan ${queda} GB al anfitrión: llega a los 4 GB que necesita Windows 11. Sí.` : `Al anfitrión le quedarían ${queda} GB y Windows 11 necesita al menos 4: no. Hay que encenderlas por turnos o darles menos memoria.` }, { d: '' }]);
        filas.push([{ lbl: 'núcleos máximos por máquina' }, { c: String(maxNuc), clase: 'num', max: 2, filtro: /[^0-9]/g, n: 2, expl: `Como mucho, la mitad de los hilos del procesador: ${HILOS} / 2 = ${maxNuc}.` }, { d: '' }, { d: '' }]);
        filas.push([{ lbl: 'disco que ocupan ahora' }, { c: String(ocupa), clase: 'num', max: 4, filtro: /[^0-9]/g, n: 3, expl: `Un disco fijo ocupa todo su tamaño desde el principio; uno dinámico, solo lo escrito: ${vms.map((v) => `${v.usado} (${v.nombre}, ${v.fijo ? 'fijo' : 'dinámico'})`).join(' + ')} = ${ocupa} GB.` }, { d: 'GB', clase: 'peq' }, { d: '' }]);
        return {
          enunciado: 'Reglas: 4 GB para el anfitrión; la mitad de los hilos por máquina; dinámico ocupa lo escrito y fijo, todo.',
          tarea: 'RAM que le queda al anfitrión, si se pueden encender a la vez, núcleos máximos por máquina y disco ocupado.',
          columnas: '210px 170px 130px 370px', clase: 'texto mini',
          filas,
          correcto: `Correcto: le quedan ${queda} GB al anfitrión (${aLaVez === 'sí' ? 'se pueden encender a la vez' : 'no se pueden encender a la vez'}), como mucho ${maxNuc} núcleos por máquina y ${ocupa} GB de disco ocupados.`
        };
      }
    },

    /* ---------- UT3 · ¿qué es este archivo? ---------- */
    'archivos-vm': {
      titulo: '¿Qué es este archivo?',
      rejilla: true,
      generar() {
        const Q = ['?', 'configuración', 'disco virtual', 'firmware', 'instantánea', 'memoria', 'máquina exportada', 'imagen de instalación'];
        const P = ['?', 'VMware', 'VirtualBox', 'Hyper-V', 'QEMU y KVM', 'cualquiera'];
        const A = [
          { e: 'Ubuntu 64-bit.vmx', q: 'configuración', p: 'VMware', x: 'El .vmx es un archivo de texto con la configuración de la máquina de VMware: memoria, núcleos, discos, red.' },
          { e: 'Ubuntu 64-bit.vmdk', q: 'disco virtual', p: 'VMware', x: 'VMDK es el formato de disco virtual de VMware (VirtualBox también sabe abrirlo).' },
          { e: 'Ubuntu 64-bit-s003.vmdk', q: 'disco virtual', p: 'VMware', x: 'Es un trozo del disco virtual de VMware: el disco se dividió en varios archivos (-s001, -s002…).' },
          { e: 'Ubuntu 64-bit.nvram', q: 'firmware', p: 'VMware', x: 'El .nvram guarda la configuración del firmware (BIOS o UEFI) de la máquina de VMware.' },
          { e: 'Ubuntu 64-bit-Snapshot1.vmsn', q: 'instantánea', p: 'VMware', x: 'Cada .vmsn guarda el estado de una instantánea de VMware.' },
          { e: 'Ubuntu 64-bit-Snapshot1.vmem', q: 'memoria', p: 'VMware', x: 'El .vmem es la memoria RAM de la máquina guardada en el disco (de una instantánea tomada con la máquina encendida).' },
          { e: 'Ubuntu.vbox', q: 'configuración', p: 'VirtualBox', x: 'El .vbox es la configuración de la máquina de VirtualBox, en XML.' },
          { e: 'Ubuntu.vdi', q: 'disco virtual', p: 'VirtualBox', x: 'VDI (Virtual Disk Image) es el formato nativo de disco de VirtualBox.' },
          { e: 'Ubuntu.vhdx', q: 'disco virtual', p: 'Hyper-V', x: 'VHDX es el formato de disco virtual de Hyper-V (el antiguo era VHD).' },
          { e: 'ubuntu.qcow2', q: 'disco virtual', p: 'QEMU y KVM', x: 'QCOW2 es el disco virtual de QEMU y KVM, los hipervisores libres de Linux.' },
          { e: 'Alpine.ova', q: 'máquina exportada', p: 'cualquiera', x: 'OVA es una máquina exportada en un solo archivo, en formato abierto: la importan VMware, VirtualBox y otros.' },
          { e: 'Alpine.ovf', q: 'máquina exportada', p: 'cualquiera', x: 'OVF es el formato abierto de exportación: un archivo que describe la máquina, con sus discos al lado.' },
          { e: 'ubuntu-24.04-desktop-amd64.iso', q: 'imagen de instalación', p: 'cualquiera', x: 'Una ISO es la imagen de un disco: se pone en la unidad de CD/DVD virtual para instalar. Sirve en cualquier programa.' },
          { e: 'Win11_Spanish_x64.iso', q: 'imagen de instalación', p: 'cualquiera', x: 'La ISO de instalación de Windows 11: se pone en la unidad de CD/DVD virtual. Sirve en cualquier programa.' }
        ];
        const a = A[rnd(0, A.length - 1)];
        return {
          enunciado: 'Lee el nombre del archivo de la carpeta de una máquina virtual y elige qué guarda y a qué programa pertenece ese formato.',
          tarea: '¿Qué guarda este archivo y de qué programa es el formato?',
          columnas: '230px 620px', clase: 'texto',
          filas: [
            [{ lbl: 'archivo' }, { d: a.e, clase: 'texto' }],
            [{ lbl: 'qué guarda' }, { sel: Q, c: a.q, clase: 'txt', n: 0, expl: a.x }],
            [{ lbl: 'formato de' }, { sel: P, c: a.p, clase: 'txt', n: 1, expl: a.x }]
          ],
          correcto: `Correcto: ${a.q}, ${a.p === 'cualquiera' ? 'formato abierto que sirve en cualquier programa' : 'de ' + a.p}. ${a.x}`
        };
      }
    },

    /* ---------- UT3 · modos de red (VMware salvo donde se dice) ---------- */
    'modos-red': {
      titulo: 'Modos de red',
      rejilla: true,
      modos: [{ t: 'Casos', v: 'caso' }, { t: 'Quién ve a quién', v: 'matriz' }, { t: 'Por la IP', v: 'ip' }, { t: 'Al azar', v: null }],
      generar(cfg) {
        const modo = cfg.modo || ['caso', 'matriz', 'ip'][rnd(0, 2)];
        const SN = ['?', 'sí', 'no'];
        if (modo === 'caso') {
          const MOD = ['?', 'NAT', 'puente', 'solo anfitrión', 'segmento LAN', 'sin red'];
          const C = [
            { t: 'Solo quieres navegar por internet y descargar actualizaciones desde la máquina virtual.', m: ['NAT'], e: 'NAT: sale a internet a través del anfitrión y nadie de fuera la ve. Es el modo por defecto.' },
            { t: 'Montas una web en la máquina virtual y tiene que verla toda la clase desde sus PC.', m: ['puente'], e: 'Puente: la máquina es un equipo más de la red del aula, con su propia IP, y los demás PC llegan a ella.' },
            { t: 'Dos máquinas virtuales tienen que hablar entre ellas y con nadie más: ni internet ni el anfitrión.', m: ['segmento LAN'], e: 'Segmento LAN (red interna en VirtualBox): una red que solo existe entre esas máquinas.' },
            { t: 'Vas a probar un programa sospechoso y no quieres que tenga ninguna conexión.', m: ['sin red'], e: 'Sin red (adaptador desconectado): el programa no puede comunicarse con nada. Antes, una instantánea.' },
            { t: 'La máquina virtual tiene que recibir su IP del router de casa, como el móvil o el portátil.', m: ['puente'], e: 'Puente: se conecta a la red física como un equipo más y el router le da su IP.' },
            { t: 'Quieres entrar desde tu Windows (el anfitrión) a una web de la máquina virtual, sin internet y sin que la vea nadie más.', m: ['solo anfitrión'], e: 'Solo anfitrión: una red privada entre el anfitrión y las máquinas virtuales, sin salida a internet.' },
            { t: 'La red del centro no deja conectar equipos nuevos, pero la máquina virtual necesita internet.', m: ['NAT'], e: 'NAT: hacia fuera solo se ve la IP del anfitrión, que sí está autorizado.' },
            { t: 'Un compañero tiene que hacer ping a tu máquina virtual desde su PC.', m: ['puente'], e: 'Puente: es el único modo en el que los demás PC del aula llegan a la máquina virtual sin configurar nada más.' },
            { t: 'Tres máquinas virtuales forman su propia red de laboratorio, sin salir de tu ordenador ni tocar el anfitrión.', m: ['segmento LAN'], e: 'Segmento LAN: las tres comparten una red aislada que no llega ni al anfitrión ni a internet.' },
            { t: 'Dos máquinas virtuales de VMware tienen que verse entre ellas y tener internet, sin que las vea el resto del aula.', m: ['NAT'], e: 'NAT de VMware: todas las máquinas en NAT comparten la red VMnet8, se ven entre ellas y salen a internet por el anfitrión.' },
            { t: 'Un servidor y un cliente virtuales que controlas desde el anfitrión, aislados de la red del aula y de internet.', m: ['solo anfitrión'], e: 'Solo anfitrión: las máquinas y el anfitrión se ven; internet y el aula, no.' },
            { t: 'Instalas Ubuntu en una máquina recién creada y quieres que descargue los paquetes sin complicarte.', m: ['NAT'], e: 'NAT: funciona sin configurar nada, con la conexión del anfitrión.' }
          ];
          const c = C[rnd(0, C.length - 1)];
          return {
            enunciado: 'Lee el caso y elige el modo de red del adaptador de la máquina virtual.',
            tarea: 'Elige el modo de red para el caso.',
            columnas: '230px 620px', clase: 'texto',
            filas: [
              [{ lbl: 'caso' }, { d: c.t, clase: 'texto' }],
              [{ lbl: 'modo de red' }, { sel: MOD, c: c.m[0], clase: 'txt', n: 0, cmp: (v) => c.m.includes(v), expl: c.e }]
            ],
            correcto: `Correcto: ${c.m.join(' o ')}. ${c.e}`
          };
        }
        if (modo === 'matriz') {
          const T = {
            'NAT': [['sí', 'Sale a internet por el anfitrión, que hace de router.'], ['sí', 'El anfitrión tiene un adaptador (VMnet8) en esa misma red.'], ['sí', 'Todas las máquinas en NAT de VMware comparten la red VMnet8.'], ['no', 'Desde fuera solo se ve la IP del anfitrión: el resto del aula no llega a la máquina.']],
            'puente': [['sí', 'Es un equipo más de la red: sale por el router como los demás.'], ['sí', 'Anfitrión y máquina están en la misma red física.'], ['sí', 'Si las dos están en puente, están en la misma red.'], ['sí', 'Tiene su propia IP en la red del aula: los demás PC la ven.']],
            'solo anfitrión': [['no', 'Es una red privada sin router: no hay salida a internet.'], ['sí', 'El anfitrión tiene un adaptador (VMnet1) en esa red.'], ['sí', 'Las máquinas en solo anfitrión comparten la red VMnet1.'], ['no', 'La red solo existe dentro del anfitrión.']],
            'segmento LAN': [['no', 'Es una red aislada: no hay salida.'], ['no', 'El anfitrión no tiene adaptador en un segmento LAN.'], ['sí', 'Las máquinas del mismo segmento se ven entre ellas, y solo ellas.'], ['no', 'La red solo existe entre esas máquinas virtuales.']],
            'sin red': [['no', 'El adaptador está desconectado.'], ['no', 'El adaptador está desconectado.'], ['no', 'El adaptador está desconectado.'], ['no', 'El adaptador está desconectado.']]
          };
          const nombres = Object.keys(T);
          const m = nombres[rnd(0, nombres.length - 1)];
          const PR = ['¿sale a internet?', '¿se comunica con el anfitrión?', '¿se comunica con otra máquina en el mismo modo?', '¿la ven los demás PC del aula?'];
          return {
            enunciado: `En VMware Workstation Pro, una máquina virtual tiene el adaptador de red en modo ${m}. Contesta sí o no a cada pregunta.`,
            tarea: `Adaptador en modo ${m} (VMware): ¿internet?, ¿anfitrión?, ¿otra máquina en el mismo modo?, ¿los demás PC del aula?`,
            columnas: '460px 220px', clase: 'texto',
            filas: [[{ lbl: 'modo de red' }, { d: m, clase: 'dato' }]].concat(PR.map((q, i) => [{ lbl: q }, { sel: SN, c: T[m][i][0], clase: 'txt', n: i, expl: T[m][i][1] }])),
            correcto: `Correcto. En ${m}: internet ${T[m][0][0]}, anfitrión ${T[m][1][0]}, otra máquina ${T[m][2][0]}, aula ${T[m][3][0]}.`
          };
        }
        const aula = [['192.168.1', rnd(20, 90)], ['10.20.5', rnd(20, 90)], ['192.168.0', rnd(20, 90)]][rnd(0, 2)];
        const A = rnd(100, 250); let B = rnd(100, 250); if (B === A) B = A === 250 ? 100 : A + 1;
        const CASOS = [
          { ip: `${aula[0]}.${rnd(100, 200)}`, m: 'puente', p: 'cualquiera', e: 'Está en la misma red que la tarjeta Ethernet del anfitrión: la máquina es un equipo más del aula. Modo puente, en cualquiera de los dos programas.' },
          { ip: `192.168.${A}.${rnd(128, 254)}`, m: 'NAT', p: 'VMware', e: `Está en la red de VMnet8 (192.168.${A}.0), que es la del NAT de VMware.` },
          { ip: `192.168.${B}.${rnd(128, 254)}`, m: 'solo anfitrión', p: 'VMware', e: `Está en la red de VMnet1 (192.168.${B}.0), que es la de solo anfitrión de VMware.` },
          { ip: '10.0.2.15', m: 'NAT', p: 'VirtualBox', e: 'Es la dirección que da siempre el NAT de VirtualBox: cada máquina tiene su propia red 10.0.2.0 y por eso no se ven entre ellas.' },
          { ip: `192.168.56.${rnd(101, 150)}`, m: 'solo anfitrión', p: 'VirtualBox', e: 'Está en la red del adaptador VirtualBox Host-Only (192.168.56.1): solo anfitrión de VirtualBox.' }
        ];
        const c = CASOS[rnd(0, CASOS.length - 1)];
        return {
          enunciado: 'El ipconfig del anfitrión y la IP de la máquina virtual: ¿en qué modo de red está y con qué programa?',
          tarea: 'Con el ipconfig del anfitrión y la IP de la máquina virtual: modo de red y programa.',
          columnas: '400px 290px', clase: 'texto mini',
          filas: [
            [{ lbl: 'Ethernet (red del aula)' }, { d: `${aula[0]}.${aula[1]}`, clase: 'dato' }],
            [{ lbl: 'VMware Network Adapter VMnet1' }, { d: `192.168.${B}.1`, clase: 'dato' }],
            [{ lbl: 'VMware Network Adapter VMnet8' }, { d: `192.168.${A}.1`, clase: 'dato' }],
            [{ lbl: 'VirtualBox Host-Only Network' }, { d: '192.168.56.1', clase: 'dato' }],
            { linea: true, clase: 'suave', desde: 1 },
            [{ lbl: 'IP de la máquina virtual' }, { d: c.ip, clase: 'dato' }],
            [{ lbl: 'modo de red' }, { sel: ['?', 'NAT', 'puente', 'solo anfitrión'], c: c.m, clase: 'txt', n: 0, expl: c.e }],
            [{ lbl: 'programa' }, { sel: ['?', 'VMware', 'VirtualBox', 'cualquiera'], c: c.p, clase: 'txt', n: 1, expl: c.e }]
          ],
          correcto: `Correcto: ${c.m}${c.p === 'cualquiera' ? '' : ' de ' + c.p}. ${c.e}`
        };
      }
    },

    /* ---------- UT3 · ficha de máquina virtual (solo para la hoja: examen práctico) ---------- */
    'ficha-vm': {
      titulo: 'Ficha de máquina virtual',
      rejilla: true,
      generar() {
        const SO = [
          { so: 'Alpine Linux (ISO virt)', ram: ['512 MB', '1 GB'], nuc: [1], disco: [8, 10, 12] },
          { so: 'Ubuntu 24.04 (sesión en vivo, sin instalar)', ram: ['4 GB'], nuc: [2], disco: [25, 30] },
          { so: 'Windows 11 (sin instalar)', ram: ['4 GB'], nuc: [2], disco: [64] }
        ];
        const s = SO[rnd(0, SO.length - 1)];
        const nombre = ['examen', 'som', 'lab', 'prueba'][rnd(0, 3)] + '-' + rnd(10, 99);
        const red = ['NAT', 'solo anfitrión', 'segmento LAN «lab' + rnd(1, 9) + '»'][rnd(0, 2)];
        const insta = ['Recién creada', 'Antes de tocar', 'Base', 'Inicio'][rnd(0, 3)];
        const dividido = Math.random() < 0.5 ? 'sí, en varios archivos' : 'no, un solo archivo';
        const filas = [
          [{ lbl: 'nombre' }, { d: nombre, clase: 'texto' }],
          [{ lbl: 'sistema invitado' }, { d: s.so, clase: 'texto' }],
          [{ lbl: 'memoria' }, { d: s.ram[rnd(0, s.ram.length - 1)], clase: 'texto' }],
          [{ lbl: 'núcleos' }, { d: String(s.nuc[rnd(0, s.nuc.length - 1)]), clase: 'texto' }],
          [{ lbl: 'disco' }, { d: `${s.disco[rnd(0, s.disco.length - 1)]} GB, dinámico, ${dividido}`, clase: 'texto' }],
          [{ lbl: 'red' }, { d: red, clase: 'texto' }],
          [{ lbl: 'instantánea' }, { d: `«${insta}», con la máquina apagada`, clase: 'texto' }],
          [{ lbl: 'clon enlazado' }, { d: `${nombre}-clon, a partir de esa instantánea`, clase: 'texto' }],
          [{ lbl: 'comprobación' }, { d: s.so.startsWith('Windows') ? 'arrancar hasta la primera pantalla del instalador' : 'arrancar las dos y anotar la IP de cada una (ip a)', clase: 'texto' }]
        ];
        if (s.so.startsWith('Windows')) filas.splice(5, 0, [{ lbl: 'seguridad' }, { d: 'UEFI, arranque seguro y TPM (anota la contraseña)', clase: 'texto' }]);
        return {
          enunciado: 'Crea en VMware Workstation Pro una máquina virtual con esta ficha y enseña el resultado al profesor en tu pantalla.',
          tarea: 'Crea la máquina virtual de la ficha y enséñala en tu pantalla.',
          columnas: '230px 620px', clase: 'texto',
          filas,
          correcto: 'Se comprueba en la pantalla de cada uno: configuración de la máquina, árbol de instantáneas, clon y red.'
        };
      }
    },
  };


  /* ---------- ejercicio de rejilla (vertical, con huecos, como en la pizarra) ---------- */
  function montaRejilla(el, gen, cfg) {
    el.innerHTML =
      '<p class="ej-enunciado"></p>' +
      '<div class="ej-ops" hidden></div>' +
      '<div class="sv"></div>' +
      '<div class="ej-fila">' +
      '  <button class="btn btn-primary ej-comprobar">Comprobar</button>' +
      '  <button class="btn btn-ghost ej-pista">Pista</button>' +
      '  <button class="btn btn-ghost ej-resolver">Resolver</button>' +
      '  <span class="ej-acciones"></span>' +
      '  <button class="btn btn-ghost ej-otro">Otro ejercicio</button>' +
      '  <span class="ej-racha">Aciertos seguidos: <b>0</b></span>' +
      '</div>' +
      '<p class="ej-fb"></p>';
    const $ = (s) => el.querySelector(s);
    const sv = $('.sv'), fb = $('.ej-fb'), racha = $('.ej-racha b'), enunciado = $('.ej-enunciado'), ops = $('.ej-ops'), acciones = $('.ej-acciones');
    let g, orden = [], celdas = [], conPista = false, resuelto = false, aciertos = 0;
    const estado = { modo: cfg.modo || null };
    // Esquema de la misma diapositiva que hace de selector de modo (gen.mapa): nodos [data-n], flechas [data-a]
    const seccion = el.closest('section');
    const mapa = gen.mapa && seccion ? seccion.querySelector('.ej-mapa') : null;
    let origen = null;   // nodo de origen pulsado, a la espera del destino

    const norm = (v) => String(v || '').trim().replace(/\s+/g, '').replace('.', ',').toUpperCase();
    const valorDe = (c) => (c.tagName === 'BUTTON' ? c._it.sel[+c.dataset.i] : c.value);
    const bien = (c) => { const v = valorDe(c); if (!v) return false; return c._it.cmp ? c._it.cmp(v) : norm(v) === norm(c.dataset.valor); };
    const pon = (c, v) => {
      if (c.tagName === 'BUTTON') { const i = Math.max(0, c._it.sel.indexOf(v)); c.dataset.i = i; c.textContent = c._it.sel[i]; }
      else c.value = v;
    };
    const mensaje = (t, clase) => { fb.textContent = t; fb.className = 'ej-fb' + (clase ? ' ' + clase : ''); };

    function espejos() {
      if (g && g.alEscribir) g.alEscribir(sv);
      sv.querySelectorAll('[data-espejo]').forEach((s) => {
        const c = celdas.find((x) => x.dataset.id === s.dataset.espejo);
        const v = c ? valorDe(c) : '';
        s.textContent = g.espejo ? g.espejo(s.dataset.espejo, v) : (v || '?');
        s.classList.toggle('vacio', !v);
      });
    }

    function pinta(conservar) {
      const previos = {};
      if (conservar) celdas.forEach((c) => { if (c.dataset.id) previos[c.dataset.id] = valorDe(c); });
      sv.className = 'sv' + (g.clase ? ' ' + g.clase : '');
      sv.style.gridTemplateColumns = g.columnas || '';
      sv.innerHTML = '';
      celdas = [];
      g.filas.forEach((fila) => {
        if (fila.linea) {
          const l = document.createElement('div');
          l.className = 'linea' + (fila.clase ? ' ' + fila.clase : '');
          l.style.gridColumn = (fila.desde || 2) + ' / -1';
          sv.appendChild(l);
          return;
        }
        fila.forEach((it) => {
          let x;
          if (it.lbl !== undefined) { x = document.createElement('span'); x.className = 'lbl'; x.textContent = it.lbl; }
          else if (it.sel) {
            x = document.createElement('button'); x.type = 'button';
            x.className = 'c sel' + (it.clase ? ' ' + it.clase : '');
            x._it = it; x.dataset.valor = it.c; x.dataset.i = '0'; x.textContent = it.sel[0];
            x.addEventListener('click', (e) => { e.stopPropagation(); x.dataset.i = String((+x.dataset.i + 1) % it.sel.length); x.textContent = it.sel[+x.dataset.i]; x.classList.remove('ok', 'ko', 'pista'); });
            x.addEventListener('keydown', (e) => e.stopPropagation());
            celdas.push(x);
          } else if (it.c !== undefined) {
            x = document.createElement('input');
            x.className = 'c' + (it.clase ? ' ' + it.clase : '');
            x.maxLength = it.max || 1; x.autocomplete = 'off'; x.spellcheck = false;
            x.inputMode = /hex|dec/.test(it.clase || '') ? 'text' : 'numeric';
            x.dataset.valor = it.c; x._it = it;
            if (it.id) x.dataset.id = it.id;
            celdas.push(x);
          } else {
            x = document.createElement('span');
            x.className = 'd' + (it.clase ? ' ' + it.clase : '');
            x.textContent = it.d || '';
            if (it.espejo) x.dataset.espejo = it.espejo;
          }
          if (it.span) x.style.gridColumn = 'span ' + it.span;
          sv.appendChild(x);
        });
      });
      // orden de resolución: por n (menor primero); sin n, por orden de aparición
      orden = celdas.map((c, k) => ({ c, k })).sort((p, q) => ((p.c._it.n ?? 1e9) - (q.c._it.n ?? 1e9)) || (p.k - q.k)).map((p) => p.c);
      orden.forEach((c, k) => {
        if (c.tagName !== 'INPUT') return;
        const it = c._it, max = it.max || 1;
        c.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); if (max > 1 && orden[k + 1] && c.value) orden[k + 1].focus(); else comprobar(); return; }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const j = celdas.indexOf(c) + (e.key === 'ArrowLeft' ? -1 : 1);
            if (celdas[j]) { celdas[j].focus(); e.preventDefault(); }
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const j = k + (e.key === 'ArrowUp' ? -1 : 1);
            if (orden[j]) { orden[j].focus(); e.preventDefault(); }
          }
        });
        c.addEventListener('input', () => {
          c.value = c.value.replace(it.filtro || /[^01]/g, '');
          c.value = max === 1 ? c.value.slice(-1) : c.value.slice(0, max);
          c.classList.remove('ok', 'ko');
          espejos();
          if (max === 1 && c.value && orden[k + 1]) orden[k + 1].focus();
        });
      });
      if (conservar) celdas.forEach((c) => { if (c.dataset.id && previos[c.dataset.id] !== undefined) pon(c, previos[c.dataset.id]); });
      acciones.innerHTML = '';
      (g.acciones || []).forEach((a) => {
        const b = document.createElement('button');
        b.className = 'btn btn-ghost'; b.textContent = a.texto;
        b.addEventListener('click', () => { a.accion(api); });
        acciones.appendChild(b);
      });
      espejos();
      if (orden[0]) orden[0].focus();
    }

    const api = { repinta: () => { pinta(true); mensaje(''); } };

    function nuevo() {
      g = gen.generar(Object.assign({}, cfg, { modo: estado.modo }));
      origen = null;
      if (mapa) marcaMapa();
      enunciado.textContent = '';
      if (g.cabecera) { const b = document.createElement('b'); b.className = 'ej-cab'; b.textContent = g.cabecera; enunciado.appendChild(b); }
      enunciado.appendChild(document.createTextNode(g.enunciado || ''));
      conPista = false; resuelto = false;
      mensaje('');
      pinta(false);
    }

    function comprobar() {
      if (g.valida) { const m = g.valida(); if (m) { mensaje(m, 'ko'); return; } }
      let mal = 0, vacias = 0;
      orden.forEach((c) => {
        if (c.tagName === 'INPUT' && !c.value) { vacias++; c.classList.remove('ok'); c.classList.add('ko'); return; }
        const ok = bien(c);
        c.classList.toggle('ok', ok); c.classList.toggle('ko', !ok);
        if (!ok) mal++;
      });
      if (mal === 0 && vacias === 0) {
        if (!resuelto && !conPista) { aciertos++; racha.textContent = aciertos; }
        resuelto = true;
        mensaje(typeof g.correcto === 'function' ? g.correcto() : (g.correcto || 'Correcto.'), 'ok');
      } else {
        if (mal) { aciertos = 0; racha.textContent = '0'; }
        mensaje((mal ? `${mal} casilla${mal > 1 ? 's' : ''} mal. ` : '') + (vacias ? `${vacias} sin rellenar.` : ''), 'ko');
      }
    }

    function pista() {
      if (g.valida) { const m = g.valida(); if (m) { mensaje(m, 'ko'); return; } }
      const c = orden.find((x) => !bien(x));
      if (!c) { mensaje('Ya está todo resuelto.', 'ok'); return; }
      conPista = true; aciertos = 0; racha.textContent = '0';
      pon(c, c.dataset.valor);
      c.classList.remove('ko', 'ok'); c.classList.add('pista');
      espejos();
      mensaje(c._it.expl || '');
      const i = orden.indexOf(c);
      if (orden[i + 1]) orden[i + 1].focus();
    }

    function resolver() {
      if (g.valida) { const m = g.valida(); if (m) { mensaje(m, 'ko'); return; } }
      conPista = true; resuelto = true; aciertos = 0; racha.textContent = '0';
      orden.forEach((c) => { pon(c, c.dataset.valor); c.classList.remove('ko', 'pista'); c.classList.add('ok'); });
      espejos();
      mensaje(g.resumen || orden.map((c) => c._it.expl).filter(Boolean).join('\n'));
    }

    // Camino del ejercicio en pantalla (origen, destino, base de paso y flechas) opaco y el resto casi
    // transparente; mientras se elige, el origen pulsado y los destinos posibles.
    const modoDe = (o, d) => Object.keys(gen.mapa).find((m) => gen.mapa[m].o === o && gen.mapa[m].d === d);
    const nombreNodo = (n) => mapa.querySelector(`[data-n="${n}"]`).textContent.trim().toLowerCase();
    function marcaMapa() {
      const c = gen.mapa[g.modo] || {}, via = c.via || {};
      mapa.querySelectorAll('[data-n]').forEach((n) => {
        const v = n.dataset.n;
        n.setAttribute('class', origen ? (v === origen ? 'origen' : modoDe(origen, v) ? 'posible' : 'apagado')
          : ([c.o, c.d, c.por].includes(v) ? 'camino' : 'apagado'));
      });
      mapa.querySelectorAll('[data-a]').forEach((a) => a.setAttribute('class', !origen && a.dataset.a in via ? 'camino ' + via[a.dataset.a] : 'apagado'));
      mapa.querySelector('.ej-mapa-azar').classList.toggle('activo', !estado.modo);
      mapa.querySelector('.ej-mapa-estado').textContent = origen ? `Desde ${nombreNodo(origen)}: pulsa el destino.`
        : estado.modo ? `Solo ${nombreNodo(c.o)} → ${nombreNodo(c.d)}.` : 'Un camino distinto en cada ejercicio.';
    }

    if (mapa) {
      mapa.querySelectorAll('[data-n]').forEach((n) => {
        n.setAttribute('role', 'button'); n.setAttribute('tabindex', '0');
        n.setAttribute('aria-label', nombreNodo(n.dataset.n));
        const pulsa = () => {
          const m = origen && modoDe(origen, n.dataset.n);
          if (m) { estado.modo = m; nuevo(); return; }
          origen = origen === n.dataset.n ? null : n.dataset.n;
          marcaMapa();
        };
        n.addEventListener('click', pulsa);
        n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pulsa(); } });
      });
      mapa.querySelector('.ej-mapa-azar').addEventListener('click', () => { estado.modo = null; nuevo(); });
    } else if (gen.modos) {
      ops.hidden = false;
      gen.modos.forEach((m) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = m.t;
        b.classList.toggle('activo', (m.v || null) === estado.modo);
        b.addEventListener('click', () => {
          estado.modo = m.v || null;
          ops.querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
          nuevo();
        });
        ops.appendChild(b);
      });
    }
    $('.ej-comprobar').addEventListener('click', comprobar);
    $('.ej-pista').addEventListener('click', pista);
    $('.ej-resolver').addEventListener('click', resolver);
    $('.ej-otro').addEventListener('click', nuevo);
    nuevo();
  }

  /* ---------- montaje de un ejercicio ---------- */
  function montaEjercicio(el) {
    const tipo = el.dataset.tipo;
    const gen = SOM.generadores[tipo];
    if (!gen) { el.textContent = 'Tipo de ejercicio desconocido: ' + tipo; return; }
    const cfg = {};
    ['min', 'max', 'bits'].forEach((k) => { if (el.dataset[k]) cfg[k] = parseInt(el.dataset[k], 10); });
    ['modo', 'paridad'].forEach((k) => { if (el.dataset[k]) cfg[k] = el.dataset[k]; });
    if (gen.rejilla) return montaRejilla(el, gen, cfg);

    el.innerHTML =
      '<p class="ej-enunciado"></p>' +
      '<p class="ej-dato"></p>' +
      '<div class="ej-fila">' +
      '  <input class="ej-input" type="text" autocomplete="off" spellcheck="false" placeholder="Tu respuesta">' +
      '  <button class="btn btn-primary ej-comprobar">Comprobar</button>' +
      '</div>' +
      '<div class="ej-fila">' +
      '  <button class="btn btn-ghost ej-solucion">Ver solución</button>' +
      '  <button class="btn btn-ghost ej-otro">Otro ejercicio</button>' +
      '  <span class="ej-racha">Aciertos seguidos: <b>0</b></span>' +
      '</div>' +
      '<p class="ej-fb"></p>' +
      '<pre class="ej-sol" hidden></pre>';

    const $ = (s) => el.querySelector(s);
    const enunciado = $('.ej-enunciado'), dato = $('.ej-dato'), input = $('.ej-input');
    const fb = $('.ej-fb'), sol = $('.ej-sol'), racha = $('.ej-racha b');
    let actual, resuelto = false, aciertos = 0;

    function nuevo() {
      actual = gen.generar(cfg);
      enunciado.textContent = actual.pregunta;
      dato.innerHTML = actual.dato + (actual.unidad ? ' <small>' + actual.unidad + '</small>' : '');
      dato.classList.toggle('largo', actual.dato.length > 14);
      sol.textContent = actual.solucion;
      sol.hidden = true;
      input.value = '';
      input.className = 'ej-input';
      fb.textContent = '';
      fb.className = 'ej-fb';
      resuelto = false;
      input.focus();
    }

    function comprobar() {
      const r = limpia(input.value);
      if (!r) { fb.textContent = 'Escribe una respuesta.'; fb.className = 'ej-fb'; return; }
      if (actual.comprueba(r)) {
        if (!resuelto) { aciertos++; racha.textContent = aciertos; }
        resuelto = true;
        input.className = 'ej-input ok';
        fb.textContent = 'Correcto.';
        fb.className = 'ej-fb ok';
      } else {
        aciertos = 0; racha.textContent = '0';
        input.className = 'ej-input ko';
        fb.textContent = 'No es correcto. Inténtalo otra vez o mira la solución.';
        fb.className = 'ej-fb ko';
      }
    }

    $('.ej-comprobar').addEventListener('click', comprobar);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); comprobar(); } });
    input.addEventListener('keydown', (e) => e.stopPropagation());
    $('.ej-solucion').addEventListener('click', () => {
      sol.hidden = !sol.hidden;
      if (!sol.hidden) { aciertos = 0; racha.textContent = '0'; resuelto = true; }
    });
    $('.ej-otro').addEventListener('click', nuevo);
    nuevo();
  }

  /* ---------- preguntas de repaso de los quiz («Otra pregunta») ----------
     Un quiz con data-preguntas="clave" pasa por las preguntas de SOM.preguntas.clave, sobre lo visto
     desde el quiz anterior. p: enunciado; o: opciones; c: índice de la correcta (desde 0; aquí siempre
     la primera, porque las opciones se barajan al enseñarlas); exp: explicación, que sale al responder,
     se acierte o no. Lo que va entre `acentos graves` se pinta en monoespaciada (bits, códigos). */
  SOM.preguntas = SOM.preguntas || {};

  // UT1 · 1.1 El sistema informático (diapositiva 12)
  SOM.preguntas.sistema = [
    { p: '¿Qué es un sistema informático?', o: ['Hardware y software que procesan y automatizan la información', 'Solo las piezas físicas: la caja, la pantalla y el teclado', 'Los programas instalados en un ordenador, sin el hardware', 'Una red de ordenadores que comparten archivos e impresoras'], c: 0, exp: 'Hardware (lo físico) y software (programas y datos) que procesan y automatizan la información, con el ordenador en el centro. También cuenta el personal que lo maneja.' },
    { p: 'Además del hardware y el software, ¿qué forma parte del sistema informático?', o: ['El personal que lo maneja y lo mantiene', 'La corriente eléctrica que lo alimenta', 'El mueble y la sala donde está instalado', 'La empresa que fabricó sus componentes'], c: 0, exp: 'El personal que lo hace funcionar y lo mantiene también es parte del sistema. La corriente, la sala o el fabricante, no.' },
    { p: 'Las fotos guardadas en un disco duro, ¿qué son?', o: ['Software: son datos, aunque el disco sea hardware', 'Hardware: están guardadas dentro de una pieza física', 'Hardware, porque ocupan espacio en el disco', 'Depende de si el disco es interno o externo'], c: 0, exp: 'Lo grabado es información, y la información es software. El disco se toca y es hardware; las fotos, no.' },
    { p: '¿Qué regla usamos para distinguir el hardware del software?', o: ['Si se puede tocar, es hardware', 'Si cuesta dinero, es hardware', 'Si va dentro de la caja, es hardware', 'Si usa electricidad, es hardware'], c: 0, exp: 'El hardware es lo físico, lo que se puede tocar. El software es lo lógico: programas y datos.' },
    { p: 'Un banco procesa millones de operaciones pequeñas de miles de clientes, sin parar nunca. ¿Qué usa?', o: ['Un mainframe', 'Un superordenador', 'Una estación de trabajo', 'Un ordenador personal'], c: 0, exp: 'El mainframe atiende a cientos de usuarios a la vez con millones de operaciones pequeñas y está hecho para no parar nunca.' },
    { p: 'Simular el clima con miles de procesadores calculando en paralelo es trabajo de…', o: ['Un superordenador', 'Un mainframe', 'Un servidor en rack', 'Una estación de trabajo'], c: 0, exp: 'El superordenador trabaja para un solo problema enorme y se fabrica a medida para grandes organismos científicos o militares.' },
    { p: '¿Qué distingue a un servidor de una estación de trabajo?', o: ['El uso: uno sirve a otros equipos; la otra, a un profesional', 'El tamaño: el servidor es siempre mucho más grande', 'El precio: la estación de trabajo cuesta siempre más', 'El sistema operativo: el servidor solo puede funcionar con Linux'], c: 0, exp: 'No es el tamaño sino el uso: el servidor da servicio a los demás equipos de la red; la estación de trabajo es para un profesional con tareas exigentes.' },
    { p: 'Para saber de qué tipo es un sistema informático, ¿qué hay que preguntarse?', o: ['¿Para quién trabaja?', '¿Cuánto espacio ocupa?', '¿Qué marca lo fabrica?', '¿Qué sistema operativo lleva?'], c: 0, exp: 'Un problema enorme (superordenador), muchos usuarios (mainframe), otros equipos (servidor) o una persona (ordenador personal).' },
    { p: '¿Cuál de estos aparatos NO es un sistema informático?', o: ['Una bombilla incandescente', 'Una videoconsola', 'Un coche eléctrico', 'Un router de fibra'], c: 0, exp: 'Todo aparato con procesador y programa es un sistema informático. Una bombilla incandescente no procesa nada.' },
    { p: 'La palabra «informática» viene de…', o: ['Información y automática', 'Información y matemática', 'Informe y electrónica', 'Información y práctica'], c: 0, exp: 'Informática es información automática: procesar información sin intervención humana.' },
    { p: 'En la pirámide DIKW, «39, 110, 1015», sin más contexto, son…', o: ['Datos', 'Información', 'Conocimiento', 'Sabiduría'], c: 0, exp: 'Son cifras sueltas: datos. Con contexto pasan a ser información: 39 °C y 110 pulsaciones son fiebre y taquicardia.' },
    { p: '«Este paciente tiene 39 °C: fiebre». En la pirámide DIKW, eso es…', o: ['Información', 'Datos', 'Conocimiento', 'Sabiduría'], c: 0, exp: 'Son datos con contexto: información. Saber que la fiebre con dolor de garganta suele ser una infección ya es conocimiento.' }
  ];

  // UT1 · 1.2 Evolución histórica (diapositiva 25)
  SOM.preguntas.historia = [
    { p: '¿Qué idea aportan las tarjetas perforadas?', o: ['Separar la máquina de lo que hace: cambiar de tarjetas', 'Usar la electricidad en lugar de engranajes y manivelas', 'Contar en binario en lugar de con las diez cifras', 'Hacer las máquinas lo bastante pequeñas para una mesa'], c: 0, exp: 'El dibujo del telar o el programa del ordenador están en las tarjetas: cambiar de tarea es cambiar de tarjetas, no de máquina.' },
    { p: '¿Cuándo pasa una máquina de calcular a ser un ordenador?', o: ['Cuando guarda el programa dentro de la máquina', 'Cuando funciona con electricidad y no con engranajes', 'Cuando tiene pantalla y teclado para ver y escribir', 'Cuando calcula en binario en lugar de en decimal'], c: 0, exp: 'Hay ordenador cuando hay programa interno: recibe datos, los procesa según el programa guardado y produce una salida. Cambiar de tarea es cargar otro programa.' },
    { p: '¿Quién formalizó la idea del programa guardado en la misma memoria que los datos?', o: ['John von Neumann', 'Charles Babbage', 'Blaise Pascal', 'Herman Hollerith'], c: 0, exp: 'Von Neumann describió la arquitectura de programa almacenado: instrucciones y datos en la misma memoria. Sigue siendo la base de tu ordenador y de tu móvil.' },
    { p: '¿Por qué se considera a Ada Lovelace la primera programadora?', o: ['Escribió el primer algoritmo publicado para una máquina', 'Construyó la Máquina Analítica que Babbage había diseñado', 'Programó el ENIAC cableando sus paneles con otras mujeres', 'Inventó el lenguaje Ada, que hoy se usa en aviación'], c: 0, exp: 'En sus notas describió paso a paso cómo la Máquina Analítica calcularía los números de Bernoulli: el primer algoritmo publicado para una máquina.' },
    { p: '¿Qué separa una generación de ordenadores de la siguiente?', o: ['El componente que calcula: válvula, transistor, chip', 'El sistema operativo que llevan: MS-DOS, Unix o Windows', 'El país donde se fabrican las piezas y se monta la máquina', 'El tamaño de la pantalla y la forma de la carcasa'], c: 0, exp: 'Cada generación nace con un componente nuevo que hace lo mismo más pequeño, más barato y más fiable.' },
    { p: '¿Qué componente define la 1.ª generación?', o: ['La válvula de vacío', 'El transistor', 'El circuito integrado', 'El microprocesador'], c: 0, exp: 'Válvulas de vacío: ordenadores del tamaño de una habitación, de uso científico y militar, cuyas válvulas se fundían continuamente.' },
    { p: '¿En qué generación aparece el microprocesador?', o: ['4.ª generación', '2.ª generación', '3.ª generación', '5.ª generación'], c: 0, exp: 'En la 4.ª: toda la CPU en un solo chip. Abarató tanto el ordenador que nació el ordenador personal.' },
    { p: 'Frente a la válvula de vacío, el transistor…', o: ['Es más pequeño y fiable, y consume menos', 'Necesita calentarse antes de conducir', 'Es más rápido, pero bastante más caro', 'Solo sirve para amplificar el sonido'], c: 0, exp: 'No necesita vacío ni filamento: es más pequeño, no se funde, consume menos y es más barato. Calentarse era el defecto de la válvula.' },
    { p: 'Un circuito integrado (chip) es…', o: ['Muchos transistores en una pastilla de silicio', 'Una válvula de vacío más pequeña y que no se calienta', 'La placa base con todos sus conectores en miniatura', 'Un disco de silicio donde se graban los programas'], c: 0, exp: 'Menos tamaño, coste y consumo, y más capacidad. Es la tecnología de la 3.ª generación.' },
    { p: 'Un microprocesador es…', o: ['Toda la unidad central de proceso en un chip', 'La memoria RAM completa metida en un solo chip', 'Un transistor muy pequeño de silicio y óxido', 'Un chip con cuatro puertas lógicas NAND'], c: 0, exp: 'Unidad de control, unidad aritmético-lógica y registros en un solo chip. Es la tecnología de la 4.ª generación.' },
    { p: 'El PC de IBM tuvo tanto éxito que…', o: ['Se volvió un estándar que copiaron otras marcas', 'IBM fabricó durante años todos los ordenadores', 'Apple copió su diseño para fabricar el Macintosh', 'Se prohibió vender ordenadores de otras marcas'], c: 0, exp: 'Su éxito creó un estándar: otras marcas vendieron compatibles y aparecieron los clónicos. Apple siguió otro camino con el Macintosh.' },
    { p: '¿Qué dice la ley de Moore?', o: ['Los transistores de un chip se duplican cada dos años', 'La frecuencia de los micros se duplica cada dos años', 'El precio de los ordenadores baja a la mitad cada año', 'La memoria RAM de un PC se duplica cada seis meses'], c: 0, exp: 'Es una tendencia que la industria ha cumplido durante cincuenta años, no una ley física. Y se está frenando: el silicio se acerca a sus límites.' },
    { p: '¿Por qué la frecuencia de los micros lleva años estancada en 3-5 GHz?', o: ['Subir más genera demasiado calor', 'La memoria RAM no lo soporta', 'Lo prohíbe una norma europea', 'Los programas no lo aprovechan'], c: 0, exp: 'Por el calor. El rendimiento crece por otros caminos: más núcleos, hilos, frecuencia turbo y memoria caché.' },
    { p: 'Según la ley de Huang, el rendimiento de las GPU crece gracias a…', o: ['El paralelismo y el hardware especializado', 'Subir la frecuencia de reloj cada dos años', 'Fabricar chips cada vez más grandes', 'Usar memoria RAM más rápida y barata'], c: 0, exp: 'Miles de núcleos sencillos trabajando a la vez y hardware especializado, no más frecuencia. Es la base de la inteligencia artificial actual.' }
  ];

  // UT1 · 1.3 Componentes hardware (diapositiva 38)
  SOM.preguntas.hardware = [
    { p: 'Desde el punto de vista físico, el hardware se divide en…', o: ['Lo de dentro de la carcasa, periféricos y memorias auxiliares', 'La CPU, la memoria principal y los buses que las comunican', 'Dispositivos de entrada, unidad de proceso y de salida', 'La placa base, la fuente de alimentación y los discos'], c: 0, exp: 'Dentro de la carcasa van placa, micro, RAM, fuente y discos; los periféricos meten o sacan información; las memorias auxiliares guardan con el equipo apagado.' },
    { p: '¿Para qué sirve el chipset de la placa base?', o: ['Comunica el micro con el resto: USB, SATA, red, sonido', 'Guarda la hora y la configuración con el equipo apagado', 'Convierte la corriente de la fuente para el micro', 'Guarda el sistema operativo mientras está encendido'], c: 0, exp: 'El chipset comunica el micro con el resto de la placa. La hora y la configuración las conserva la pila de botón.' },
    { p: 'Una pantalla táctil es un periférico…', o: ['De entrada y salida', 'Solo de entrada', 'Solo de salida', 'De almacenamiento'], c: 0, exp: 'Muestra la imagen (salida) y recibe los toques (entrada). Igual que la impresora multifunción o los cascos con micrófono.' },
    { p: 'Frente a la memoria principal, las memorias auxiliares…', o: ['No se borran al apagar, caben más y son más lentas', 'Se borran al apagar, caben menos y son más rápidas', 'No se borran al apagar, caben menos y son más rápidas', 'Se borran al apagar, caben más y son igual de rápidas'], c: 0, exp: 'Son no volátiles, tienen mucha más capacidad que la RAM y son más lentas que ella.' },
    { p: 'Guardar tus archivos en OneDrive o Google Drive es usar…', o: ['Una memoria auxiliar remota, que necesita red', 'Memoria principal ampliada a través de internet', 'Un periférico de salida conectado por wifi', 'La memoria ROM del servidor de la empresa'], c: 0, exp: 'Tus archivos están en el disco del ordenador de otro, y hace falta red para llegar a ellos.' },
    { p: '¿Qué tres elementos forman la CPU?', o: ['Unidad de control, UAL y registros', 'Unidad de control, RAM y disco duro', 'UAL, memoria principal y buses', 'Registros, chipset y bus de datos'], c: 0, exp: 'La unidad de control manda, la unidad aritmético-lógica calcula y los registros guardan los datos intermedios. La RAM y el disco están fuera del micro.' },
    { p: '¿Qué bus lleva la información en los dos sentidos?', o: ['El bus de datos', 'El bus de direcciones', 'El bus de control', 'Los tres por igual'], c: 0, exp: 'Solo el de datos: la CPU lee y escribe. La dirección sale siempre de la CPU, y las señales de control, de la unidad de control.' },
    { p: '¿Por qué un sistema de 32 bits no aprovecha más de 4 GB de RAM?', o: ['Con 32 bits solo hay 2³² direcciones distintas: 4 GB', 'Microsoft lo limita en la licencia de las versiones básicas', 'Los módulos de RAM de 32 bits no pasan de 4 GB', 'El bus de datos no puede llevar más de 4 GB a la vez'], c: 0, exp: 'El ancho del bus de direcciones limita la memoria que se puede usar. Con 64 bits el límite deja de ser un problema.' },
    { p: '¿Qué hace la unidad de control?', o: ['Interpreta las instrucciones y ordena a cada parte cuándo actuar', 'Suma, resta y compara los datos, y deja el resultado en el acumulador', 'Guarda el programa y sus datos mientras se ejecuta', 'Conecta los periféricos con el micro a través de la placa'], c: 0, exp: 'Es el director de orquesta: interpreta cada instrucción y da las órdenes por el bus de control. Las cuentas las hace la unidad aritmético-lógica.' },
    { p: '¿Qué registro guarda la dirección de la siguiente instrucción?', o: ['El contador de programa (CP)', 'El registro de instrucción (RI)', 'El acumulador (AC)', 'El registro de estado (RE)'], c: 0, exp: 'El CP apunta siempre a la siguiente instrucción. El RI guarda la que se está ejecutando, y el acumulador, el resultado de la UAL.' },
    { p: 'En el registro de estado, ¿qué indica el bit O?', o: ['Desbordamiento: el resultado no cabe', 'Que el resultado de la operación fue cero', 'Que el resultado fue un número negativo', 'Que hubo acarreo: «me llevo una»'], c: 0, exp: 'O es el desbordamiento (overflow). Z indica cero, S el signo y C el acarreo.' },
    { p: '¿Cuál es el primer paso del ciclo de instrucción?', o: ['Buscar la instrucción en la memoria', 'Decodificar la instrucción', 'Ejecutar la instrucción', 'Avanzar el contador de programa'], c: 0, exp: 'Buscar, decodificar, ejecutar y avanzar. Primero se trae de memoria la instrucción que señala el CP y se guarda en el RI.' },
    { p: 'Si la instrucción que se acaba de ejecutar era un salto, en el paso de avanzar…', o: ['El CP toma la dirección de destino del salto', 'El CP vuelve a cero y el programa empieza', 'El ciclo se para hasta recibir otra orden', 'Se repite la misma instrucción otra vez'], c: 0, exp: 'Normalmente el CP pasa a CP + 1; si era un salto, toma la dirección de destino y el programa sigue desde allí.' },
    { p: 'En el modo de direccionamiento inmediato, la instrucción lleva…', o: ['El propio dato: SUMA 5 suma un 5', 'La dirección del dato: SUMA [200]', 'La dirección de la dirección del dato', 'Una dirección más un índice fijo'], c: 0, exp: 'Inmediato: el dato. Directo: su dirección. Indirecto: la dirección de su dirección. Indexado: una dirección más un índice.' },
    { p: 'Un micro a 3 GHz da…', o: ['3.000 millones de ciclos por segundo', '3.000 millones de instrucciones por segundo', '3 millones de ciclos por segundo', '3.000 ciclos por segundo'], c: 0, exp: 'Giga es 10⁹. Son ciclos, no instrucciones: una instrucción puede tardar varios, y un núcleo moderno ejecuta varias por ciclo.' },
    { p: '¿Qué es la memoria caché?', o: ['Una memoria pequeña y muy rápida dentro del micro', 'La memoria de la tarjeta gráfica, para la imagen', 'La parte del disco que se usa cuando se llena la RAM', 'La ROM donde está el firmware de arranque'], c: 0, exp: 'Guarda lo que se usa a menudo para que el micro no tenga que esperar a la RAM, mucho más lenta.' },
    { p: 'La memoria RAM…', o: ['Es volátil y guarda el programa en ejecución', 'No es volátil y guarda el firmware de arranque (UEFI)', 'No es volátil y guarda los programas instalados', 'Es volátil y solo la usa la tarjeta gráfica'], c: 0, exp: 'Se borra al apagar y guarda el programa en ejecución y sus datos, cargados desde el disco. La UEFI está en la ROM; los programas instalados, en el disco.' }
  ];

  // UT1 · 1.4 Software, licencias y normativa (diapositiva 55)
  SOM.preguntas.licencias = [
    { p: 'Para ejecutarse, un programa…', o: ['Se carga del disco a la RAM y el micro lo ejecuta en código máquina', 'Se carga de la RAM al disco y el micro lo ejecuta en código máquina', 'Se carga del disco a la ROM y el micro lo ejecuta en alto nivel', 'Se ejecuta directamente desde el disco, sin pasar por la RAM'], c: 0, exp: 'Los programas se guardan en la memoria auxiliar, se cargan en la RAM y el micro los ejecuta instrucción a instrucción, siempre en lenguaje máquina.' },
    { p: 'Compilar es…', o: ['Traducirlo todo una vez y obtener un ejecutable', 'Traducir y ejecutar línea a línea cada vez que se lanza', 'Escribir el programa directamente en ceros y unos', 'Copiar el programa del disco a la RAM para ejecutarlo'], c: 0, exp: 'El ejecutable se lanza directamente y es rápido, pero solo vale para un sistema. Interpretar es traducir línea a línea en cada ejecución.' },
    { p: 'El controlador (driver) de la impresora es software…', o: ['De base', 'De aplicación', 'De programación', 'Ofimático'], c: 0, exp: 'El software de base hace utilizable el ordenador y oculta el hardware: sistemas operativos y controladores. El de aplicación es para una tarea concreta.' },
    { p: 'Una licencia de software es…', o: ['Un contrato que da permiso de uso con condiciones', 'Una compra: al pagar, el programa pasa a ser tuyo del todo', 'Un certificado de que el programa no tiene virus ni fallos', 'El precio del programa según el número de equipos'], c: 0, exp: 'No compras el programa: compras el derecho a usarlo con unas condiciones. Al instalarlo aceptas el contrato (EULA), aunque no lo leas.' },
    { p: '¿Qué es el copyleft?', o: ['Permitir copiar y modificar si lo derivado sigue igual de libre', 'Renunciar a todos los derechos: la obra pasa a dominio público', 'Reservar todos los derechos: solo el autor decide quién copia', 'Una marca que solo pueden usar los programas de la FSF'], c: 0, exp: 'El autor no renuncia a sus derechos: los usa para permitir usar, copiar y modificar, con la condición de que las versiones derivadas mantengan las mismas condiciones.' },
    { p: 'Chrome se descarga gratis, pero no puedes modificar su código. Es…', o: ['Propietario gratuito (freeware)', 'Software libre, porque es gratis', 'Software abierto (open source)', 'De dominio público, sin licencia'], c: 0, exp: 'Gratis no es libre: el freeware es propietario y no se paga. Libre es tener las cuatro libertades sobre el código, se pague o no.' },
    { p: 'Red Hat Enterprise Linux es libre y se paga por el soporte. ¿Es posible?', o: ['Sí: libre habla de libertades, no del precio', 'No: todo el software libre tiene que ser gratis', 'No: si se paga, pasa a ser software propietario', 'Sí, pero solo si se usa fuera de la Unión Europea'], c: 0, exp: 'Las cuatro libertades no dicen nada del precio: se puede distribuir gratis o cobrando. RHEL es libre y se paga la suscripción de soporte.' },
    { p: 'Subes tu código a GitHub sin archivo LICENSE. ¿Qué pueden hacer los demás?', o: ['Verlo, pero no modificarlo ni redistribuirlo', 'Todo: sin licencia, el código es de dominio público', 'Usarlo como software libre con copyleft', 'Venderlo, pero sin cambiar ni una línea'], c: 0, exp: 'Sin licencia todos los derechos siguen siendo del autor. Por eso GitHub insiste en añadir un archivo LICENSE.' },
    { p: 'MIT, BSD y Apache 2.0 son licencias libres…', o: ['Permisivas: dejan cerrar el resultado', 'Con copyleft: lo derivado sigue siendo libre', 'Solo para obras creativas, no para software', 'Que prohíben el uso comercial del programa'], c: 0, exp: 'Son permisivas, sin copyleft: permiten reutilizar el código incluso en un programa propietario. La GPL no lo permite.' },
    { p: '¿Qué tiene Apache 2.0 que no tiene MIT?', o: ['Condiciones sobre patentes', 'Copyleft, como la GPL', 'Prohibición del uso comercial', 'Validez solo para documentación'], c: 0, exp: 'Las dos son permisivas: MIT es la más corta y Apache 2.0 añade condiciones sobre patentes.' },
    { p: 'Creative Commons recomienda sus licencias para…', o: ['Textos, fotos, música o apuntes', 'Programas y bibliotecas de código', 'Sistemas operativos y controladores', 'Datos personales de los usuarios'], c: 0, exp: 'Creative Commons es para obras creativas y desaconseja sus licencias para software: para eso están GPL, MIT o Apache.' },
    { p: 'En una licencia Creative Commons, ¿qué significa SA?', o: ['Compartir igual: lo derivado lleva la misma licencia', 'Sin atribución: no hace falta citar al autor original', 'Sin obras derivadas: se copia tal cual', 'Solo para uso académico, no comercial'], c: 0, exp: 'SA es el copyleft de Creative Commons. BY obliga a citar al autor; NC prohíbe el uso comercial, y ND, las obras derivadas.' },
    { p: '¿Qué norma protege en España los programas, los textos, las fotos o la música?', o: ['La Ley de Propiedad Intelectual (RDL 1/1996)', 'El Reglamento General de Protección de Datos', 'La Ley Orgánica de Protección de Datos', 'La LSSI, sobre comercio electrónico y cookies'], c: 0, exp: 'Protege toda obra desde que se crea, sin registrarla. El RGPD y la LOPDGDD son de datos personales; la LSSI regula, entre otras cosas, las cookies.' },
    { p: 'Según el RGPD, ¿cuál de estos es un dato personal?', o: ['La dirección IP de tu ordenador', 'La temperatura media de Burgos', 'El precio de un portátil nuevo', 'La versión de un programa instalado'], c: 0, exp: 'Dato personal es toda información sobre una persona identificada o identificable: no solo el nombre o el DNI, también la IP, la matrícula, una foto o la ubicación.' },
    { p: 'Las cookies que no son necesarias…', o: ['Exigen consentimiento, y rechazar tan fácil como aceptar', 'Se pueden instalar sin avisar si no guardan datos bancarios', 'Basta con un aviso y un único botón de «Aceptar todas»', 'Están prohibidas en toda la Unión Europea desde el RGPD'], c: 0, exp: 'Lo dice la LSSI (artículo 22.2). Un aviso con solo «Aceptar todas» no es válido.' },
    { p: '¿Cuándo pueden salir datos personales fuera de la Unión Europea?', o: ['Solo a países con protección equivalente a la europea', 'Siempre que viajen cifrados y el servidor sea seguro', 'Nunca: el RGPD prohíbe guardarlos fuera de la Unión', 'Solo a Estados Unidos, por su acuerdo con la Unión'], c: 0, exp: 'Protección reconocida por la Comisión Europea o garantizada por contrato. Importa dónde están las personas que acceden, no solo el servidor.' }
  ];

  // UT1 · 1.6 Numeración y cambios de base (diapositiva 73)
  SOM.preguntas.numeracion = [
    { p: '¿Por qué el ordenador trabaja solo con dos estados?', o: ['Un circuito distingue dos estados con seguridad', 'En matemáticas solo hay dos números distintos', 'Lo decidió IBM con las primeras tarjetas', 'Con diez estados los cables se calientan'], c: 0, exp: 'Hay tensión o no la hay: dos niveles se distinguen con seguridad. Diez niveles con ruido darían errores.' },
    { p: 'La base de un sistema de numeración es…', o: ['El número de símbolos distintos que usa', 'El símbolo más grande que se puede escribir', 'El número de cifras que tiene el número', 'La posición de las unidades, la cifra 0'], c: 0, exp: '10 en decimal (0 a 9), 2 en binario, 8 en octal y 16 en hexadecimal (0 a 9 y A a F).' },
    { p: 'El teorema fundamental de la numeración sirve para pasar…', o: ['De cualquier base a decimal', 'De decimal a binario', 'De binario a hexadecimal', 'De octal a hexadecimal'], c: 0, exp: 'Cada dígito por el peso de su posición, y se suma todo. De decimal a binario se divide entre 2; entre binario, octal y hexadecimal se usa la tabla.' },
    { p: '¿Cuánto vale `100110` (binario) en decimal?', o: ['38', '25', '19', '76'], c: 0, exp: 'Pesos de derecha a izquierda: 1, 2, 4, 8, 16, 32. Los bits a 1 están en 32, 4 y 2: 32 + 4 + 2 = 38.' },
    { p: 'Al pasar un número de decimal a binario dividiendo entre 2, los restos se leen…', o: ['De abajo arriba: el primer resto es el bit de la derecha', 'De arriba abajo: el primer resto es el bit de más peso', 'En cualquier orden: el resultado es el mismo', 'Solo los que valen 1, en el orden en que salen'], c: 0, exp: 'El primer resto es el bit de menos peso, el de la derecha. Leerlos al revés es el error más frecuente.' },
    { p: '¿Cuánto es 44 en binario?', o: ['`101100`', '`001101`', '`110100`', '`101010`'], c: 0, exp: 'Restos: 0, 0, 1, 1, 0, 1. Leídos de abajo arriba: 101100 = 32 + 8 + 4 = 44.' },
    { p: 'Para pasar a binario la parte fraccionaria de un número decimal…', o: ['Se multiplica por 2 y se leen los enteros de arriba abajo', 'Se divide entre 2 y se leen los restos de abajo arriba', 'Se multiplica por 2 y se leen los enteros de abajo arriba', 'Se divide entre 10 y se pasa cada resto a cuatro bits'], c: 0, exp: 'La parte entera de cada producto es el siguiente dígito, hasta que la parte decimal sea 0. Al revés que las divisiones: de arriba abajo.' },
    { p: '¿Qué pasa al pasar 0,1 (decimal) a binario?', o: ['Es periódico y hay que cortarlo: se guarda con un error', 'Sale 0,1 exacto: la coma no cambia al cambiar de base', 'Sale 0,0001 exacto tras cuatro multiplicaciones', 'No se puede: el binario no admite parte decimal'], c: 0, exp: 'Vuelve a salir 0,2 y el ciclo se repite para siempre. El ordenador lo corta, y por eso guarda 0,1 con un pequeño error.' },
    { p: 'Con 8 bits, ¿cuántos valores distintos se pueden representar?', o: ['256', '255', '128', '8'], c: 0, exp: 'Con n bits hay 2ⁿ combinaciones: 2⁸ = 256, del 0 al 255.' },
    { p: '¿Cuántos bits representa cada dígito hexadecimal?', o: ['4', '3', '8', '16'], c: 0, exp: '16 = 2⁴: cada dígito hexadecimal es un grupo de cuatro bits, y un byte son dos dígitos. En octal, 8 = 2³: tres bits.' },
    { p: '¿Cuánto es `11011101` (binario) en octal?', o: ['335', '672', '353', '221'], c: 0, exp: 'Grupos de tres desde la derecha, con un cero de relleno a la izquierda: 011 011 101 → 3, 3, 5.' },
    { p: '¿Cuánto es `110110010` (binario) en hexadecimal?', o: ['1B2', 'D90', '662', '434'], c: 0, exp: 'Grupos de cuatro desde la derecha, con ceros de relleno a la izquierda: 0001 1011 0010 → 1, B, 2.' },
    { p: '¿Cuánto vale FF (hexadecimal) en decimal?', o: ['255', '256', '240', '1515'], c: 0, exp: 'F × 16 + F = 15 × 16 + 15 = 255. También: FF = 1111 1111, el byte más grande.' },
    { p: '¿Cómo se pasa de decimal a hexadecimal sin calculadora?', o: ['A binario dividiendo entre 2, y después grupos de 4', 'Dividiendo entre 16 y leyendo los restos de abajo arriba', 'Multiplicando por 16 y apuntando las partes enteras', 'Pasando antes a octal: se divide entre 8'], c: 0, exp: 'Nunca se divide entre 8 ni entre 16: se divide entre 2 hasta tener el binario y se agrupa de cuatro en cuatro con la tabla.' },
    { p: 'Al agrupar bits, ¿dónde van los ceros de relleno?', o: ['Izquierda en la parte entera, derecha en la fraccionaria', 'Derecha en la parte entera, izquierda en la fraccionaria', 'Siempre a la izquierda, en las dos partes', 'Siempre a la derecha, en las dos partes'], c: 0, exp: 'Donde no cambian el valor: 007 sigue siendo 7 y 0,50 sigue siendo 0,5. Un cero al final de la parte entera multiplicaría por la base.' }
  ];

  // UT1 · 1.7 Operaciones en binario y complementos (diapositiva 91)
  SOM.preguntas.operaciones = [
    { p: '¿Qué dos familias de operaciones hace la UAL?', o: ['Aritméticas (suma y resta) y lógicas (NOT, AND, OR…)', 'Multiplicaciones y divisiones, con tablas guardadas', 'Lectura y escritura de la memoria principal', 'Entrada y salida de datos hacia los periféricos'], c: 0, exp: 'Solo esas dos. La multiplicación y la división se hacen a base de sumas, restas y desplazamientos.' },
    { p: '`1101 + 111` en binario da…', o: ['`10100`', '`1010`', '`11100`', '`10010`'], c: 0, exp: 'Columna a columna, con acarreos: 0, 0, 1, 0 y el 1 que queda al final. Comprobación: 13 + 7 = 20.' },
    { p: '`1100 − 0101` en binario da…', o: ['`0111`', '`1001`', '`0110`', '`1011`'], c: 0, exp: 'Pidiendo 1 a la izquierda en las tres primeras columnas sale 0111. Comprobación: 12 − 5 = 7.' },
    { p: '`0101 AND 0011` bit a bit da…', o: ['`0001`', '`0111`', '`0110`', '`1000`'], c: 0, exp: 'AND solo da 1 donde los dos bits son 1: en la última posición. Bit a bit, sin acarreos.' },
    { p: 'XOR da 1…', o: ['Solo si los dos bits son distintos', 'Si al menos uno de los dos bits vale 1', 'Solo si los dos bits son 1', 'Solo si los dos bits son 0'], c: 0, exp: 'O exclusivo: 1 solo si son distintos. OR da 1 si alguno es 1; AND, si los dos son 1; NOR, si los dos son 0.' },
    { p: 'Con puertas de un solo tipo se puede construir cualquier circuito digital. ¿De cuál?', o: ['NAND', 'AND', 'XOR', 'NOT'], c: 0, exp: 'Con NAND se hacen NOT, AND y OR, y con esas, cualquier circuito. Por eso el chip clásico SN7400 lleva cuatro puertas NAND.' },
    { p: 'En el sumador de una columna, el bit que escribo y el que me llevo salen de…', o: ['XOR y AND', 'AND y OR', 'OR y NOT', 'NAND y NOR'], c: 0, exp: 'La tabla de la suma de dos bits coincide con las de XOR (lo que escribo) y AND (lo que me llevo). Dentro nadie sabe sumar: hay circuitos que cumplen una tabla.' },
    { p: 'El complemento a 2 es…', o: ['El complemento a 1 más 1', 'El complemento a 1 menos 1', 'Invertir solo el primer bit', 'Multiplicar el número por 2'], c: 0, exp: 'C1 invierte todos los bits; C2 = C1 + 1. Es lo que le falta al número para llegar a 2ⁿ: por eso sumarlo equivale a restar.' },
    { p: 'Complemento a 2 de `00001001` en 8 bits:', o: ['`11110111`', '`11110110`', '`10001001`', '`00001010`'], c: 0, exp: 'C1: se invierte, 11110110. C2: se suma 1, 11110111. Con el truco: se copia hasta el primer 1 desde la derecha y se invierte el resto.' },
    { p: '¿Por qué el ordenador resta con complementos?', o: ['No tiene circuito de restar: el sumador hace las dos cosas', 'Es más rápido: el complemento se calcula en un solo ciclo', 'Así los negativos ocupan menos bits en la memoria', 'Por tradición: lo empezó IBM y los demás lo copiaron'], c: 0, exp: 'Sumar el complemento del sustraendo da la resta, así que un solo circuito sirve para las dos operaciones. El ordenador no tiene un símbolo «−»: solo bits.' },
    { p: '¿Por qué los ordenadores usan el C2 y no el C1?', o: ['El C1 tiene un paso más y dos ceros distintos', 'El C1 no funciona con números de 8 bits', 'El C2 ocupa la mitad de bits que el C1', 'El C1 solo sirve para sumar, pero no para restar'], c: 0, exp: 'Con C1 hay que sumar el 1 que sobra (acarreo circular) y el cero tiene dos formas, 00000000 y 11111111. Con C2 el 1 se descarta y el cero es único.' },
    { p: 'Cuando una resta en C2 sale negativa…', o: ['No sobra ningún 1 y el resultado ya está en C2', 'Sobra un 1, se descarta y se lee como positivo', 'Hay que repetirla con los números cambiados', 'Se lee sumando los pesos y poniendo el signo'], c: 0, exp: 'Para leerlo se le hace el C2 y se pone el signo menos: 11111100 → 00000100 → −4.' },
    { p: 'El byte `11111011` leído en complemento a 2 vale…', o: ['−5', '251', '−123', '−4'], c: 0, exp: 'Empieza por 1: negativo. Su C2 es 00000101 = 5, así que vale −5. Sin signo, el mismo byte vale 251.' },
    { p: 'En C2 de 8 bits, al pasar de `01111111` a `10000000`, el valor…', o: ['Salta de 127 a −128', 'Pasa de 127 a 128', 'Pasa de 255 a 0', 'Salta de −1 a 0'], c: 0, exp: 'Es el desbordamiento: el resultado no cabe y el valor da la vuelta. Lo señala el bit O del registro de estado.' },
    { p: '¿Qué le pasó al contador de visitas de Gangnam Style?', o: ['Superó el mayor entero de 32 bits con signo', 'YouTube lo borró al pasar de mil millones', 'Se llenó el disco del servidor de estadísticas', 'El vídeo se corrompió y hubo que subirlo otra vez'], c: 0, exp: 'El máximo es 2³¹ − 1 = 2.147.483.647, y YouTube pasó el contador a 64 bits. Elegir cuántos bits tiene un dato tiene consecuencias.' }
  ];

  // UT1 · 1.8 Detección de errores y 1.9 Codificación, hasta Unicode (diapositiva 115)
  SOM.preguntas.codificacion = [
    { p: 'Con paridad par, ¿qué bit se añade al dato `1101011`?', o: ['Un 1: el dato tiene un número impar de unos', 'Un 0: el dato tiene un número par de unos', 'Un 1: el último bit del dato ya es un 1', 'Un 0: el dato tiene siete bits, que es impar'], c: 0, exp: 'Tiene cinco unos. El bit se elige para que el total, contándolo a él, sea par: hace falta un 1. Con paridad impar sería un 0.' },
    { p: 'Recibes `10110011` con paridad par. ¿Ha llegado bien?', o: ['No: tiene cinco unos y el total debería ser par', 'Sí: el número de unos es par, así que cuadra', 'Sí: el último bit es 1 y la paridad cuadra', 'No se puede saber sin conocer el dato original'], c: 0, exp: 'El receptor vuelve a contar: cinco unos no cuadran con paridad par. Hay un error y se pide el reenvío.' },
    { p: 'Una limitación del bit de paridad simple es que…', o: ['Si cambian dos bits, la cuenta vuelve a cuadrar', 'Necesita un circuito muy caro por cada byte', 'Solo funciona con datos de un número par de bits', 'Localiza el bit erróneo, pero no lo puede corregir'], c: 0, exp: 'Tampoco dice qué bit ha cambiado, así que no puede corregirlo. A cambio es baratísima: una puerta por bit.' },
    { p: 'La paridad bidimensional, frente a la simple…', o: ['Localiza el bit erróneo en el cruce y lo corrige', 'Detecta los errores, pero ya no los corrige', 'Usa menos bits de control para los mismos datos', 'Solo sirve para detectar errores de dos bits'], c: 0, exp: 'Un bit por fila y otro por columna: el bit cambiado hace fallar su fila y su columna, el cruce lo señala y se invierte. A cambio, más redundancia.' },
    { p: '¿Cómo funciona un CRC?', o: ['Divide el bloque por un número fijo y envía el resto', 'Cuenta los unos del bloque y envía el total', 'Envía el bloque dos veces y el receptor compara las copias', 'Comprime el bloque y compara el tamaño final'], c: 0, exp: 'El emisor divide el bloque por el polinomio generador y envía el resto; el receptor repite la división y, si no coincide, pide el bloque de nuevo.' },
    { p: '¿Por qué un disco «de 1 TB» muestra 931 GB en Windows?', o: ['El fabricante cuenta en decimal y Windows en binario', 'El sistema operativo ya ocupa esos 69 GB que faltan', 'El disco viene con sectores dañados de fábrica', 'Windows reserva ese espacio para la papelera'], c: 0, exp: 'Son los mismos bytes: 10¹² ÷ 2³⁰ = 931,3. Windows cuenta en binario, pero lo etiqueta «GB».' },
    { p: 'Una fibra de 1 Gb/s descarga como mucho a…', o: ['125 MB/s', '1 GB/s', '1.024 MB/s', '8 GB/s'], c: 0, exp: 'La red se mide en bits y un byte son 8 bits: 1.000 Mb/s ÷ 8 = 125 MB/s.' },
    { p: 'En decimal empaquetado, +13457 se guarda como…', o: ['`13 45 7C`', '`13 45 7D`', '`F1 F3 F4 F5 C7`', '`C1 34 57`'], c: 0, exp: 'Cada dígito en 4 bits y el signo en el último cuarteto: C positivo, D negativo. Cinco dígitos y el signo son seis cuartetos, tres bytes.' },
    { p: '¿Por qué los procesadores no guardan los enteros en signo y magnitud?', o: ['Tiene dos ceros y obliga a mirar los signos al sumar', 'No puede representar ningún número negativo', 'Ocupa el doble de bits que un entero en complemento a 2', 'Solo llega hasta 255 aunque tenga 32 bits'], c: 0, exp: 'Hay un +0 y un −0, y hay que mirar los signos antes de sumar. Los enteros se guardan en complemento a 2: un solo circuito y un solo cero.' },
    { p: 'Un número en coma flotante se guarda como…', o: ['Signo, mantisa y exponente, como en notación científica', 'Dos enteros: uno para la parte entera y otro para la decimal', 'Un entero multiplicado por 100 para las dos cifras decimales', 'Texto: cada cifra y la coma, un carácter ASCII'], c: 0, exp: 'La mantisa lleva las cifras significativas y el exponente coloca la coma. Gana rango, pero solo guarda unas pocas cifras: el resto se redondea.' },
    { p: '¿Por qué 0,1 + 0,2 no da 0,3 exacto en el ordenador?', o: ['0,1 y 0,2 son periódicos en binario y se redondean', 'Es un fallo de JavaScript que no pasa en otros lenguajes', 'El procesador comete errores al sumar decimales', 'Se suman como texto y se juntan las cifras'], c: 0, exp: 'Se cortan en 52 bits, y los dos redondeos asoman en la cifra 17. Es el formato IEEE 754, que usan todos los lenguajes.' },
    { p: 'En ASCII, el carácter «2» es…', o: ['El código 50, no el número 2', 'El número 2, en binario 00000010', 'El código 2, el tercero de la tabla', 'El código 34, dos después del espacio'], c: 0, exp: 'El ordenador guarda un código por carácter. Por eso «2» + «2» como texto da «22».' },
    { p: '¿Cuál es el código ASCII de la «K»?', o: ['75', '74', '76', '107'], c: 0, exp: 'Desde el ancla A = 65: la K es la undécima letra, 65 + 10 = 75. La k minúscula es 107.' },
    { p: 'En ASCII, una mayúscula y su minúscula se diferencian en…', o: ['32: un solo bit, el de peso 32', '26: las letras del alfabeto', '1: la minúscula va justo detrás', '64: el bit de más peso del código'], c: 0, exp: 'A = 65 = 01000001 y a = 97 = 01100001. Cambiar ese bit pasa de mayúscula a minúscula.' },
    { p: 'UTF-8 es…', o: ['Cómo se pasan a bytes los puntos de código Unicode', 'Una tabla de 8 bits como Latin-1, con emojis arriba', 'Un código fijo de 4 bytes por carácter, como UTF-32', 'La versión de ASCII que añade la ñ y las tildes'], c: 0, exp: 'Usa de 1 a 4 bytes según el carácter, y los 128 de ASCII ocupan un byte idéntico al de siempre: un archivo ASCII ya es UTF-8.' },
    { p: '«año» escrito en UTF-8 y abierto como Latin-1 se ve…', o: ['«aÃ±o»', '«a�o»', '«ano»', '«a?o»'], c: 0, exp: 'La ñ son dos bytes en UTF-8 (C3 B1) y Latin-1 lee cada uno como una letra. Se arregla cambiando la codificación al abrir, no reescribiendo.' }
  ];

  // UT1 · 1.9 Formatos de archivo (diapositiva 121)
  SOM.preguntas.formatos = [
    { p: 'Un formato de archivo es…', o: ['Cómo se organizan los bytes dentro del archivo', 'La extensión: al cambiarla se convierte el archivo', 'El tamaño del archivo, que decide cómo se abre', 'El programa que lo creó, el único que puede abrirlo'], c: 0, exp: 'La extensión es solo la pista que usa el sistema operativo para elegir el programa: cambiarla no cambia el formato.' },
    { p: 'Cambias la extensión de un .docx a .zip y lo abres. ¿Qué encuentras?', o: ['Archivos XML con el texto y los estilos, e imágenes', 'Un error: Windows no deja cambiar la extensión de un .docx', 'El mismo documento, que se abre en Word', 'Un único archivo de texto plano con todo'], c: 0, exp: 'Un .docx es un ZIP con XML e imágenes dentro, y un .odt también. Lo mismo pasa con xlsx, ods, pptx y odp.' },
    { p: '¿En qué formato entregas un trabajo para que se vea igual en cualquier ordenador?', o: ['.pdf', '.docx', '.txt', '.odt'], c: 0, exp: 'El PDF fija texto, tipografías e imágenes en su posición: se ve igual en todas partes. Es para entregar y archivar, no para editar.' },
    { p: 'Una imagen de mapa de bits…', o: ['Es una rejilla de píxeles: al ampliarla se ven los cuadrados', 'Guarda instrucciones de dibujo y se amplía sin perder calidad', 'Es un texto XML que el navegador dibuja al abrirlo', 'Guarda solo el contorno de las figuras, sin colores'], c: 0, exp: 'Guarda el color de cada píxel. Las instrucciones de dibujo son de la imagen vectorial, como SVG.' },
    { p: 'Un logotipo tiene que verse bien desde un icono hasta una lona gigante. ¿En qué formato lo guardas?', o: ['SVG, vectorial', 'JPG, con pérdida', 'PNG, sin pérdida', 'BMP, sin comprimir'], c: 0, exp: 'La imagen vectorial guarda instrucciones de dibujo y se redibuja a cualquier tamaño sin perder calidad. Las de mapa de bits pixelan al ampliar.' },
    { p: '¿Cuál de estos formatos de imagen comprime sin pérdida?', o: ['PNG', 'JPG', 'AVIF', 'JPG de calidad 95'], c: 0, exp: 'PNG comprime sin perder nada: la imagen vuelve idéntica. JPG y AVIF descartan lo que el ojo no distingue, aunque sea con calidad alta.' },
    { p: 'Guardas una foto en JPG, la editas y la vuelves a guardar varias veces. ¿Qué pasa?', o: ['Cada guardado descarta algo más de información', 'Nada: JPG conserva todo mientras no la amplíes', 'Ocupa más cada vez, hasta el tamaño de un BMP', 'Pierde la primera vez y después ya queda igual'], c: 0, exp: 'Con pérdida, cada nuevo guardado descarta algo más. Por eso el original se conserva en RAW o PNG.' },
    { p: 'FLAC frente a MP3:', o: ['FLAC comprime sin pérdida; MP3, con pérdida', 'MP3 comprime sin pérdida; FLAC, con pérdida', 'Los dos comprimen con pérdida, pero FLAC más', 'FLAC no comprime nada, igual que WAV'], c: 0, exp: 'FLAC ocupa más o menos la mitad que el WAV y el audio vuelve idéntico; MP3 descarta lo que el oído no distingue.' },
    { p: 'En un vídeo, ¿qué diferencia hay entre contenedor y códec?', o: ['El contenedor es la caja; el códec, cómo se comprime', 'Son lo mismo: cada extensión lleva su propio códec', 'El códec es la extensión; el contenedor, el reproductor', 'El contenedor comprime el vídeo; el códec lo reproduce'], c: 0, exp: 'MP4 o MKV llevan dentro vídeo, audio y subtítulos; H.264 o AV1 dicen cómo se comprime el vídeo. Dos .mp4 pueden llevar códecs distintos.' },
    { p: 'Empaquetar y comprimir, ¿son lo mismo?', o: ['No: empaquetar junta archivos; comprimir reduce su tamaño', 'Sí: los dos juntan varios archivos en uno más pequeño', 'No: empaquetar reduce el tamaño; comprimir los junta', 'Sí, pero comprimir además cifra con contraseña'], c: 0, exp: 'Empaquetar mete varios archivos en uno sin cambiar su tamaño (tar); comprimir reescribe los bytes para que ocupen menos (gz). ZIP hace las dos cosas.' },
    { p: 'Comprimes en ZIP una carpeta de fotos JPG y apenas baja de tamaño. ¿Por qué?', o: ['Los JPG ya están comprimidos', 'ZIP solo comprime archivos de texto', 'Las fotos se cifran al comprimirlas', 'ZIP solo empaqueta y no comprime'], c: 0, exp: 'Un texto o un BMP se reducen mucho; un JPG, un MP3 o un MP4 ya están comprimidos y casi no bajan.' },
    { p: '¿Qué formato solo junta archivos, sin comprimirlos?', o: ['.tar', '.zip', '.7z', '.gz'], c: 0, exp: 'tar (tape archive) solo empaqueta, y gz comprime un solo archivo. Por eso en Linux se usa .tar.gz: primero tar y después gzip.' },
    { p: 'Un archivo .csv es…', o: ['Texto plano con los datos separados por comas', 'Un ZIP con XML dentro, como el .xlsx', 'Una base de datos en un solo archivo binario', 'Una hoja de cálculo con fórmulas y gráficos'], c: 0, exp: 'Es el formato universal para mover datos entre programas. xlsx y ods, en cambio, son ZIP con XML dentro.' },
    { p: '¿Por qué un .exe de Windows no arranca en Linux?', o: ['Es código máquina para un sistema operativo concreto', 'Linux no admite archivos con extensión', 'Está comprimido en un formato que Linux no sabe abrir', 'Es texto plano con órdenes que solo entiende Windows'], c: 0, exp: 'Los ejecutables dependen del sistema: .exe para Windows, deb o rpm para Linux, apk para Android.' }
  ];

  /* ---------- quiz de opción múltiple ---------- */
  function montaQuiz(q) {
    const opts = [...q.querySelectorAll('.quiz-opt')];
    const fb = q.querySelector('.quiz-fb');
    const inicial = fb ? fb.textContent : '';
    const reset = () => {
      q.removeAttribute('data-answered');
      opts.forEach((o) => o.classList.remove('correct', 'wrong'));
      if (fb) fb.textContent = inicial;
    };
    opts.forEach((o, i) => o.addEventListener('click', () => {
      if (q.hasAttribute('data-answered')) return;
      // Se lee al pulsar: «Otra pregunta» cambia la correcta
      const correcta = parseInt(q.dataset.correct, 10);
      q.setAttribute('data-answered', '');
      opts[correcta].classList.add('correct');
      if (i !== correcta) o.classList.add('wrong');
      if (fb) fb.textContent = i === correcta ? (q.dataset.ok || 'Correcto.') : (q.dataset.ko || 'Incorrecto.');
    }));
    const r = q.querySelector('.quiz-reset');
    if (r) r.addEventListener('click', reset);
    const banco = SOM.preguntas[q.dataset.preguntas];
    if (r && banco && banco.length) montaOtraPregunta(q, r, opts, banco, reset);
  }

  /* «Otra pregunta», a la derecha de Reiniciar: alterna la pregunta de la diapositiva con las del banco,
     barajadas y con las opciones en otro orden. Al acabar la vuelta vuelve a la de la diapositiva. */
  const fmtQuiz = (s) => escapaHtml(s).replace(/`([^`]+)`/g, '<code class="en-linea">$1</code>');
  function montaOtraPregunta(q, r, opts, banco, reset) {
    const h2 = q.querySelector('h2');
    const textos = opts.map((o) => o.querySelector(':scope > span:not(.letra)'));
    const original = { h: h2.innerHTML, o: textos.map((t) => t.innerHTML), c: q.dataset.correct, ok: q.dataset.ok, ko: q.dataset.ko };
    const pon = (p) => {
      if (p === original) {
        h2.innerHTML = p.h;
        textos.forEach((t, k) => { t.innerHTML = p.o[k]; opts[k].style.display = ''; });
        Object.assign(q.dataset, { correct: p.c, ok: p.ok, ko: p.ko });
      } else {
        const orden = baraja(p.o.map((_, k) => k));
        h2.innerHTML = fmtQuiz(p.p);
        opts.forEach((o, k) => {
          o.style.display = k < orden.length ? '' : 'none';
          if (k < orden.length) textos[k].innerHTML = fmtQuiz(p.o[orden[k]]);
        });
        Object.assign(q.dataset, { correct: orden.indexOf(p.c), ok: 'Correcto. ' + p.exp, ko: 'No. ' + p.exp });
      }
      reset();
    };
    let lista = [original].concat(baraja(banco)), i = 0;
    const b = document.createElement('button');
    b.className = 'btn btn-amarillo quiz-otra';
    b.textContent = 'Otra pregunta';
    b.addEventListener('click', () => {
      i = (i + 1) % lista.length;
      if (i === 0) lista = [original].concat(baraja(banco));
      pon(lista[i]);
    });
    r.after(b);
  }


  /* ---------- panel que se revela (pregunta a la clase) ---------- */
  function montaRevela(r) {
    const btn = r.querySelector('.revela-btn');
    const textoVer = btn ? btn.textContent : 'Revelar';
    const pon = (v) => {
      r.toggleAttribute('data-revelado', v);
      if (btn) btn.textContent = v ? 'Ocultar' : textoVer;
    };
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); pon(!r.hasAttribute('data-revelado')); });
    r.addEventListener('click', () => { if (!r.hasAttribute('data-revelado')) pon(true); });
  }


  /* ---------- visor a pantalla completa para las fotos ---------- */
  function abreVisor(fig) {
    const img = fig.querySelector('img');
    const cred = fig.querySelector('.credito');
    const v = document.createElement('div');
    v.className = 'visor' + (fig.classList.contains('scroll') ? ' visor-scroll' : '');
    v.innerHTML = '<img alt=""><div class="visor-pie"></div><button class="visor-cerrar" aria-label="Cerrar">×</button>';
    v.querySelector('img').src = img.currentSrc || img.src;
    v.querySelector('img').alt = img.alt;
    if (cred) v.querySelector('.visor-pie').innerHTML = cred.innerHTML; else v.querySelector('.visor-pie').remove();
    const cierra = () => { v.remove(); document.removeEventListener('keydown', tecla, true); };
    const tecla = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); cierra(); return; }
      // En el modo con scroll, las teclas de desplazamiento mueven la imagen, no la presentación
      if (!v.classList.contains('visor-scroll')) return;
      const paso = { ArrowDown: 80, ArrowUp: -80, PageDown: v.clientHeight * .9, PageUp: -v.clientHeight * .9, ' ': v.clientHeight * .9 }[e.key];
      if (paso === undefined) return;
      e.stopPropagation(); e.preventDefault();
      v.scrollBy({ top: paso, behavior: 'smooth' });
    };
    v.addEventListener('click', (e) => { if (!e.target.closest('a')) cierra(); });
    document.addEventListener('keydown', tecla, true);
    document.body.appendChild(v);
  }
  function montaFoto(fig) {
    const img = fig.querySelector('img');
    if (!img) return;
    img.addEventListener('click', (e) => { e.stopPropagation(); abreVisor(fig); });
  }

  /* ---------- marcadores numerados sobre una foto ---------- */
  function montaMarcas(sec) {
    const marcas = [...sec.querySelectorAll('.foto .marca')];
    const items = [...sec.querySelectorAll('[data-marca]')];
    if (!marcas.length || !items.length) return;
    const pon = (n, v) => {
      marcas.forEach((m) => m.classList.toggle('activa', v && m.textContent.trim() === n));
      items.forEach((it) => it.classList.toggle('activa', v && it.dataset.marca === n));
    };
    items.forEach((it) => {
      it.addEventListener('mouseenter', () => pon(it.dataset.marca, true));
      it.addEventListener('mouseleave', () => pon(it.dataset.marca, false));
      it.addEventListener('click', (e) => { e.stopPropagation(); pon(it.dataset.marca, true); });
    });
    marcas.forEach((m) => {
      m.addEventListener('mouseenter', () => pon(m.textContent.trim(), true));
      m.addEventListener('mouseleave', () => pon(m.textContent.trim(), false));
      m.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  /* ---------- galería: varias fotos en el mismo hueco ---------- */
  function montaGaleria(g) {
    const figs = [...g.querySelectorAll(':scope > .foto')];
    if (figs.length < 2) return;
    const marco = document.createElement('div');
    marco.className = 'galeria-marco';
    figs.forEach((f) => marco.appendChild(f));
    const abajo = document.createElement('div');
    abajo.className = 'galeria-abajo';
    abajo.innerHTML = '<p class="galeria-pie"></p><div class="galeria-nav"><button type="button" aria-label="Foto anterior">‹</button><span class="galeria-cont"></span><button type="button" aria-label="Foto siguiente">›</button></div>';
    g.append(marco, abajo);
    const pie = abajo.querySelector('.galeria-pie');
    const cont = abajo.querySelector('.galeria-cont');
    const [ant, sig] = abajo.querySelectorAll('button');
    const sec = g.closest('section');
    const saltos = sec ? [...sec.querySelectorAll('[data-ir]')] : [];
    let i = 0;
    const muestra = (n) => {
      i = (n + figs.length) % figs.length;
      figs.forEach((f, k) => f.classList.toggle('activa', k === i));
      pie.innerHTML = figs[i].dataset.pie || '';
      cont.textContent = (i + 1) + ' / ' + figs.length;
      saltos.forEach((s) => s.classList.toggle('activa', Number(s.dataset.ir) === i + 1));
    };
    ant.addEventListener('click', (e) => { e.stopPropagation(); muestra(i - 1); });
    sig.addEventListener('click', (e) => { e.stopPropagation(); muestra(i + 1); });
    saltos.forEach((s) => s.addEventListener('click', (e) => { e.stopPropagation(); muestra(Number(s.dataset.ir) - 1); }));
    muestra(0);
  }

  /* ---------- título con letra animada (técnica de am-lyrics: barrido con background-clip) ---------- */
  function montaLetra(el) {
    const frag = document.createDocumentFragment();
    [...el.childNodes].forEach((nd) => {
      const hl = nd.nodeType === 1;
      if (nd.nodeType !== 3 && nd.nodeType !== 1) return;
      nd.textContent.split(/\s+/).filter(Boolean).forEach((texto) => {
        const w = document.createElement('span');
        w.className = 'w' + (hl ? ' hl' : '');
        if (!hl) w.textContent = texto;
        else texto.split('').forEach((ch) => {
          const c = document.createElement('span'); c.className = 'ch'; c.dataset.c = ch;   // ::before pinta el halo con data-c
          const f = document.createElement('span'); f.className = 'f'; f.textContent = ch; // .f lleva el relleno del barrido
          c.appendChild(f); w.appendChild(c);
        });
        frag.appendChild(w);
      });
    });
    el.innerHTML = '';
    el.appendChild(frag);
    tiemposLetra(el);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => tiemposLetra(el));   // anchuras con la fuente definitiva
  }
  /* Un solo frente recorre todo el título a velocidad continua: rápida en las palabras normales,
     lenta en la destacada, y sin pararse en los espacios. Cada palabra y cada letra reciben su
     instante según la posición que ocupan (medida en píxeles), de modo que el final de una y el
     principio de la siguiente encajan aunque sus animaciones se solapen. El frente es el centro
     de la pluma: en una palabra normal va de −pluma/2 antes de su borde a +pluma/2 después; en
     cada letra de la destacada cruza la letra de lado a lado (la primera empieza con la pluma fuera). */
  function tiemposLetra(el) {
    const cs = getComputedStyle(el);
    const em = parseFloat(cs.fontSize) || 64;
    const pl = (parseFloat(cs.getPropertyValue('--letra-pluma')) || .8) * em;
    const words = [...el.querySelectorAll('.w')];
    if (!words.length) return;
    // posiciones en píxeles de maqueta respecto al título (getBoundingClientRect va escalado por deck-stage; offsetLeft
    // no sirve porque las letras se miden respecto a su palabra y las palabras respecto al título)
    const r0 = el.getBoundingClientRect(), k = r0.width ? el.offsetWidth / r0.width : 1;
    const X = (e) => (e.getBoundingClientRect().left - r0.left) * k, AN = (e) => e.getBoundingClientRect().width * k || 1;
    const info = words.map((w) => {
      const n = w.textContent.length, hl = w.classList.contains('hl'), x0 = X(w), W = AN(w);
      // es un titular, no una canción: unos 45 ms por letra en las palabras normales y 120 ms en la destacada
      const v = hl ? W / (120 * n) : (W + pl) / (120 + 45 * n);        // px por ms
      return { w, n, hl, x0, W, v };
    });
    // tramos de velocidad: dentro de cada palabra la suya; en los espacios, la de la palabra anterior
    const seg = [];
    info.forEach((k, i) => {
      if (i === 0) seg.push({ a: k.x0 - pl, b: k.x0, v: k.v });
      else if (k.x0 > seg[seg.length - 1].b) seg.push({ a: seg[seg.length - 1].b, b: k.x0, v: info[i - 1].v });
      seg.push({ a: k.x0, b: k.x0 + k.W, v: k.v });
    });
    const T = (p) => { let t = 0; for (const s of seg) { if (p <= s.a) break; t += (Math.min(p, s.b) - s.a) / s.v; } if (p > seg[seg.length - 1].b) t += (p - seg[seg.length - 1].b) / seg[seg.length - 1].v; return t; };
    const ms = (x) => Math.round(x) + 'ms';
    info.forEach((k) => {
      if (!k.hl) {
        const a = T(k.x0 - pl / 2), b = T(k.x0 + k.W + pl / 2);
        k.w.style.setProperty('--ini', ms(a)); k.w.style.setProperty('--dur', ms(b - a));
        return;
      }
      const durHl = k.W / k.v, t0 = T(k.x0);
      [...k.w.children].forEach((c, i) => {
        const c0 = X(c), cw = AN(c);
        const a = T(i === 0 ? c0 - pl / 2 : c0), b = T(c0 + cw);
        const esc = 1 + (k.n <= 3 ? .09 : .08);
        const pos = k.n > 1 ? i / (k.n - 1) : .5;
        c.style.setProperty('--ini', ms(a));
        c.style.setProperty('--dur', ms(b - a));
        c.style.setProperty('--kf', i === 0 ? 'letra-char-wipe-1' : 'letra-char-wipe');
        // onda de crecimiento y halo (grow-dynamic de am-lyrics): desfase del 9 % por letra, 2,2 veces la palabra
        c.style.setProperty('--gini', ms(t0 + i * durHl * .09));
        c.style.setProperty('--gdur', ms(durHl * 2.2));
        c.style.setProperty('--esc', esc.toFixed(3));
        c.style.setProperty('--dx', ((pos - .5) * 2 * ((esc - 1) * 25)).toFixed(2) + 'px');
      });
    });
  }
  function enciendeLetras(slide) {
    if (!slide) return;
    slide.querySelectorAll('.letra').forEach((l) => {
      l.classList.remove('on');
      void l.offsetWidth;            // reinicia las animaciones
      l.classList.add('on');         // sin esperar al siguiente fotograma
    });
  }
  function apagaLetras(slide) {
    if (slide) slide.querySelectorAll('.letra').forEach((l) => l.classList.remove('on'));
  }

  /* ---------- simulador visual de planificación de procesos ----------
   *   En la misma diapositiva, dos elementos:
   *     <div class="sim-entrada"></div>                    (datos de entrada y tabla de tiempos)
   *     <div class="sim" data-algo="fifo" data-q="2"></div> (cronograma, cola, CPU y explicación)
   *   Algoritmos: fifo, sjf, srtf, pne (prioridades no expulsivo), pe (prioridades expulsivo), rr.
   *   Reglas de empate: FIFO; en SRTF y PE sigue el que está si empata con el que llega;
   *   en RR el que llega entra en la cola antes que el que agota su quantum en el mismo instante.
   *   data-procesos="0/7,2/4,3/3,5/2" (llegada/ejecución[/prioridad]) fija los datos iniciales.
   */
  const SIM_COLORES = ['#0B4AB5', '#1E8E5A', '#E67E22', '#8E44AD', '#C0392B', '#16A085'];
  const SIM_NOMBRES = { fifo: 'FIFO', sjf: 'SJF', srtf: 'SRTF', pne: 'prioridades no expulsivo', pe: 'prioridades expulsivo', rr: 'Round Robin' };
  const SIM_EJEMPLO = [[0, 7, 4], [2, 4, 2], [3, 3, 1], [5, 2, 3]];
  const coma = (x) => String(Math.round(x * 100) / 100).replace('.', ',');

  function simulaPlan(procs, algo, q) {
    const N = procs.length;
    const rem = procs.map((p) => p.ej);
    const fin = Array(N).fill(null);
    const queue = [];
    const llegado = new Set();
    const units = [];
    let t = 0, cur = null, usado = 0;
    const clave = algo === 'srtf' ? (i) => rem[i] : algo === 'sjf' ? (i) => procs[i].ej : (i) => procs[i].pr;
    const conClave = algo === 'sjf' || algo === 'srtf' || algo === 'pne' || algo === 'pe';
    const mejor = () => queue.reduce((b, i) => (clave(i) < clave(b) ? i : b), queue[0]);
    while (fin.some((f) => f === null) && t < 400) {
      const ev = { t, llegan: [], fin: [], requeue: null, expulsa: null, entra: null, ejecuta: null, ocioso: false };
      procs.forEach((p, i) => { if (p.ll === t && !llegado.has(i)) { llegado.add(i); queue.push(i); ev.llegan.push(i); } });
      if (algo === 'rr' && cur !== null && usado === q && rem[cur] > 0) { queue.push(cur); ev.requeue = cur; cur = null; }
      if ((algo === 'srtf' || algo === 'pe') && cur !== null && queue.length) {
        const b = mejor();
        if (clave(b) < clave(cur)) { queue.push(cur); ev.expulsa = { sale: cur, entra: b, kSale: clave(cur), kEntra: clave(b) }; cur = null; }
      }
      ev.colaAntes = queue.slice();
      if (cur === null && queue.length) {
        const e = conClave ? mejor() : queue[0];
        queue.splice(queue.indexOf(e), 1);
        cur = e; usado = 0; ev.entra = e; ev.claveEntra = clave(e);
      }
      ev.cola = queue.slice();
      if (cur === null) { ev.ocioso = true; t++; units.push(ev); continue; }
      ev.ejecuta = cur; rem[cur]--; usado++; t++; ev.quedan = rem[cur];
      if (rem[cur] === 0) { fin[cur] = t; ev.fin.push(cur); cur = null; }
      units.push(ev);
    }
    const resp = procs.map((p, i) => fin[i] - p.ll);
    const esp = procs.map((p, i) => resp[i] - p.ej);
    const media = (a) => a.reduce((x, y) => x + y, 0) / N;
    return { units, fin, resp, esp, T: t, mediaEsp: media(esp), mediaResp: media(resp) };
  }
  SOM.simulaPlan = simulaPlan;

  function montaSimulador(el) {
    const sec = el.closest('section');
    const entrada = sec && sec.querySelector('.sim-entrada');
    if (!entrada) { el.textContent = 'Falta el elemento .sim-entrada en la diapositiva.'; return; }
    const algo = el.dataset.algo || 'fifo';
    const q = parseInt(el.dataset.q || '2', 10);
    const conPrio = algo === 'pne' || algo === 'pe';
    const expulsivo = algo === 'srtf' || algo === 'pe' || algo === 'rr';
    const MAX = 5, MIN = 2;
    let procs = [];
    let R = null, paso = 0;
    const iniciales = el.dataset.procesos
      ? el.dataset.procesos.split(',').map((s) => s.split('/').map(Number))
      : SIM_EJEMPLO;
    const nombre = (i) => 'P' + (i + 1);
    const color = (i) => SIM_COLORES[i % SIM_COLORES.length];
    const P = (i) => `<b style="color:${color(i)}">${nombre(i)}</b>`;
    const lista = (ids) => ids.map(P).join(ids.length > 2 ? ', ' : ' y ').replace(/, ([^,]*)$/, ' y $1');

    /* ----- entrada ----- */
    entrada.innerHTML = `
      <table class="sim-tabla sim-in"><thead><tr><th>Proceso</th><th>Llegada</th><th>Ejecución</th>${conPrio ? '<th>Prioridad</th>' : ''}</tr></thead><tbody></tbody></table>
      <div class="sim-botones"><button type="button" data-a="azar">Al azar</button><button type="button" data-a="ejemplo">Ejemplo</button><button type="button" data-a="mas">+ proceso</button><button type="button" data-a="menos">− proceso</button></div>
      <table class="sim-tabla sim-out"><thead><tr><th>Proceso</th><th>Tiempo de espera</th><th>Tiempo de respuesta</th></tr></thead><tbody></tbody></table>`;
    const tbIn = entrada.querySelector('.sim-in tbody');
    const tbOut = entrada.querySelector('.sim-out tbody');

    function pintaEntrada() {
      entrada.classList.toggle('cinco', procs.length >= 5);
      tbIn.innerHTML = procs.map((p, i) => `<tr><td class="nombre" style="color:${color(i)}">${nombre(i)}</td>
        <td><input type="number" min="0" max="30" data-i="${i}" data-k="ll" value="${p.ll}"></td>
        <td><input type="number" min="1" max="30" data-i="${i}" data-k="ej" value="${p.ej}"></td>
        ${conPrio ? `<td><input type="number" min="1" max="9" data-i="${i}" data-k="pr" value="${p.pr}"></td>` : ''}</tr>`).join('');
      tbIn.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => {
        const p = procs[+inp.dataset.i]; const k = inp.dataset.k;
        let v = parseInt(inp.value, 10); if (isNaN(v)) v = k === 'll' ? 0 : 1;
        if (k === 'll') v = Math.max(0, Math.min(30, v)); else if (k === 'ej') v = Math.max(1, Math.min(30, v)); else v = Math.max(1, Math.min(9, v));
        p[k] = v; recalcula();
      }));
    }
    function pintaSalida() {
      const done = (i) => R && R.fin[i] !== null && R.fin[i] <= paso;
      const fin = R && paso >= R.T;
      const media = (v) => `${v.reduce((a, b) => a + b, 0)}/${v.length}`;
      tbOut.innerHTML = procs.map((p, i) => `<tr class="${done(i) ? 'hecho' : ''}"><td class="nombre" style="color:${color(i)}">${nombre(i)}</td>
        <td>${done(i) ? R.esp[i] : '·'}</td><td>${done(i) ? R.resp[i] : '·'}</td></tr>`).join('')
        + `<tr class="medias"><td>Medias</td><td>${fin ? media(R.esp) : '·'}</td><td>${fin ? media(R.resp) : '·'}</td></tr>`;
    }
    entrada.querySelector('.sim-botones').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'azar') {
        const n = procs.length;
        const prs = [...Array(n).keys()].map((x) => x + 1).sort(() => Math.random() - .5);
        procs = procs.map((p, i) => ({ ll: i === 0 ? 0 : rnd(1, n + 2), ej: rnd(2, 7), pr: prs[i] }));
      } else if (a === 'ejemplo') {
        procs = SIM_EJEMPLO.map(([ll, ej, pr]) => ({ ll, ej, pr }));
      } else if (a === 'mas' && procs.length < MAX) {
        procs.push({ ll: rnd(1, procs.length + 2), ej: rnd(2, 7), pr: procs.length + 1 });
      } else if (a === 'menos' && procs.length > MIN) {
        procs.pop();
      } else return;
      pintaEntrada(); recalcula();
    });

    /* ----- salida ----- */
    el.innerHTML = `
      <div class="sim-cab"><div class="sim-t">t = <b>0</b></div>
        <div class="sim-acciones"><button type="button" class="btn btn-ghost" data-a="ant">Anterior</button><button type="button" class="btn btn-primary" data-a="sig">Siguiente paso</button><button type="button" class="btn btn-ghost" data-a="fin">Hasta el final</button><button type="button" class="btn btn-ghost" data-a="ini">Reiniciar</button></div></div>
      <div class="sim-gantt"></div>
      <p class="sim-leyenda"><span><i class="run"></i>en ejecución</span><span><i class="wait"></i>espera en la cola</span><span><svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 3 L15 15" stroke="#0B4AB5" stroke-width="3" stroke-linecap="round"/><path d="M19 19 L9 17 L17 9 Z" fill="#0B4AB5"/></svg>llega</span>${expulsivo ? '<span><svg viewBox="0 0 24 24" width="24" height="24"><path d="M9 15 L21 3" stroke="#0B4AB5" stroke-width="3" stroke-linecap="round"/><path d="M5 19 L7 9 L15 17 Z" fill="#0B4AB5"/></svg>sale expulsado</span>' : ''}<span><i class="fin"></i>termina</span><span><i class="ahora"></i>instante actual</span></p>
      <div class="sim-estado"><div><span class="lbl">Cola de listos</span><div class="sim-chips" data-z="cola"></div></div><div><span class="lbl">CPU</span><div class="sim-chips" data-z="cpu"></div></div><div><span class="lbl">Terminados</span><div class="sim-chips" data-z="fin"></div></div></div>
      <div class="sim-msg"></div>`;
    const tEl = el.querySelector('.sim-t b');
    const gantt = el.querySelector('.sim-gantt');
    const zonas = { cola: el.querySelector('[data-z="cola"]'), cpu: el.querySelector('[data-z="cpu"]'), fin: el.querySelector('[data-z="fin"]') };
    const msg = el.querySelector('.sim-msg');
    const botones = {};
    el.querySelectorAll('.sim-acciones button').forEach((b) => { botones[b.dataset.a] = b; });
    el.querySelector('.sim-acciones').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'sig') paso = Math.min(R.T, paso + 1);
      else if (a === 'ant') paso = Math.max(0, paso - 1);
      else if (a === 'fin') paso = R.T;
      else paso = 0;
      pinta();
    });

    function chips(zona, ids) {
      zona.innerHTML = ids.length ? ids.map((i) => `<span class="sim-chip" style="background:${color(i)}">${nombre(i)}</span>`).join('') : '<span class="sim-chip vacio">vacía</span>';
    }

    // flecha en diagonal por la esquina superior de la casilla: dir -1 entra (llegada), dir 1 sale (expulsión)
    function flecha(x, y, dir, c) {
      const L = 11, h = 7;
      if (dir < 0) return `<path d="M${x - L - 3} ${y - L - 3} L${x - 5} ${y - 5}" stroke="${c}" stroke-width="3" stroke-linecap="round"/><path d="M${x} ${y} L${x - h - 2} ${y - 2} L${x - 2} ${y - h - 2} Z" fill="${c}"/>`;
      return `<path d="M${x + 5} ${y - 5} L${x + L - 2} ${y - L + 2}" stroke="${c}" stroke-width="3" stroke-linecap="round"/><path d="M${x + L + 3} ${y - L - 3} L${x + L + 1} ${y - L + h + 1} L${x + L - h - 1} ${y - L - 1} Z" fill="${c}"/>`;
    }
    function pintaGantt() {
      const W = 1020, LBL = 76, top = 24, rh = procs.length > 4 ? 48 : 56, gap = 20, T = Math.max(R.T, 1);
      const cw = Math.min(64, Math.floor((W - LBL - 24) / T));
      const H = top + procs.length * (rh + gap) + 44;
      const x = (k) => LBL + k * cw;
      let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, system-ui, sans-serif">`;
      procs.forEach((p, i) => {
        const y = top + i * (rh + gap);
        s += `<text x="${LBL - 16}" y="${y + rh / 2 + 9}" text-anchor="end" font-size="26" font-weight="800" fill="${color(i)}">${nombre(i)}</text>`;
        s += `<rect x="${x(0)}" y="${y}" width="${cw * T}" height="${rh}" fill="#FFFFFF" stroke="#D7DCE6" stroke-width="2"/>`;
        for (let u = 0; u < paso && u < R.units.length; u++) {
          const ev = R.units[u];
          const activo = p.ll <= ev.t && (R.fin[i] === null || R.fin[i] > ev.t);
          if (!activo) continue;
          if (ev.ejecuta === i) s += `<rect x="${x(u) + 1}" y="${y + 1}" width="${cw - 2}" height="${rh - 2}" fill="${color(i)}"/>`;
          else s += `<rect x="${x(u) + 1}" y="${y + 1}" width="${cw - 2}" height="${rh - 2}" fill="#E7EBF3"/><rect x="${x(u) + 7}" y="${y + rh / 2 - 3}" width="${cw - 14}" height="6" rx="3" fill="#B7C2D6"/>`;
        }
        if (p.ll < paso) s += flecha(x(p.ll), y, -1, color(i));  // la flecha aparece al dar el paso siguiente
        for (let u = 0; u < paso && u < R.units.length; u++) {
          const ev = R.units[u];
          if (ev.requeue === i || (ev.expulsa && ev.expulsa.sale === i)) s += flecha(x(ev.t), y, 1, color(i));
        }
        if (R.fin[i] !== null && R.fin[i] <= paso) s += `<rect x="${x(R.fin[i]) - 3}" y="${y - 4}" width="6" height="${rh + 8}" rx="2" fill="${color(i)}"/>`;
      });
      const yAxis = top + procs.length * (rh + gap) + 4;
      for (let k = 0; k <= T; k++) {
        s += `<line x1="${x(k)}" y1="${top - 2}" x2="${x(k)}" y2="${yAxis + 6}" stroke="#D7DCE6" stroke-width="1"/>`;
        s += `<text x="${x(k)}" y="${yAxis + 32}" text-anchor="middle" font-size="22" font-weight="600" fill="#485168" font-family="JetBrains Mono, Consolas, monospace">${k}</text>`;
      }
      s += `<line x1="${x(paso)}" y1="${top - 20}" x2="${x(paso)}" y2="${yAxis + 8}" stroke="#F4C20D" stroke-width="5" stroke-linecap="round"/>`;
      s += '</svg>';
      gantt.innerHTML = s;
    }

    function texto() {
      if (paso === 0) {
        return `Cronograma de <b>${SIM_NOMBRES[algo]}</b>${algo === 'rr' ? ` con quantum ${q}` : ''}. Pulsa <b>Siguiente paso</b> para avanzar una unidad de tiempo y ver quién llega, quién entra en la CPU y quién espera en la cola.`;
      }
      const ev = R.units[paso - 1];
      const partes = [];
      if (ev.llegan.length) partes.push(`${ev.llegan.length > 1 ? 'Llegan' : 'Llega'} ${lista(ev.llegan)} en t = ${ev.t} y ${ev.llegan.length > 1 ? 'se ponen' : 'se pone'} en la cola de listos.`);
      if (ev.requeue !== null) partes.push(`${P(ev.requeue)} agota su quantum de ${q} y vuelve al final de la cola.`);
      if (ev.expulsa) {
        const e = ev.expulsa;
        partes.push(`${P(e.entra)} expulsa a ${P(e.sale)}: ${algo === 'srtf' ? `le quedan ${e.kEntra} frente a ${e.kSale}` : `tiene prioridad ${e.kEntra} frente a ${e.kSale}`}.`);
      }
      if (ev.entra !== null) {
        const i = ev.entra;
        const solo = ev.colaAntes.length === 1;
        const motivo = {
          fifo: solo ? 'la cola solo lo tenía a él' : 'el primero que llegó de los que esperaban',
          sjf: solo ? 'la cola solo lo tenía a él' : `el de menor tiempo de ejecución (${procs[i].ej})`,
          srtf: solo ? 'la cola solo lo tenía a él' : `el que menos tiempo tiene pendiente (${ev.claveEntra})`,
          pne: solo ? 'la cola solo lo tenía a él' : `el de mayor prioridad (${procs[i].pr})`,
          pe: solo ? 'la cola solo lo tenía a él' : `el de mayor prioridad (${procs[i].pr})`,
          rr: solo ? 'la cola solo lo tenía a él' : 'el primero de la cola',
        }[algo];
        partes.push(`${ev.expulsa ? 'Entra' : 'La CPU está libre: entra'} ${P(i)}, ${motivo}${algo === 'rr' ? `, con un quantum de ${q}` : ''}.`);
      } else if (ev.llegan.length && ev.ejecuta !== null) {
        const noExp = algo === 'fifo' || algo === 'sjf' || algo === 'pne';
        partes.push(`La CPU está ocupada por ${P(ev.ejecuta)}${noExp ? ', que no se expulsa' : ''}: ${lista(ev.llegan)} ${ev.llegan.length > 1 ? 'esperan' : 'espera'}.`);
      }
      if (ev.ocioso) partes.push(`No hay ningún proceso listo entre t = ${ev.t} y t = ${ev.t + 1}: la CPU queda libre.`);
      else partes.push(`Entre t = ${ev.t} y t = ${ev.t + 1} se ejecuta ${P(ev.ejecuta)}${ev.quedan ? ` (le quedan ${ev.quedan})` : ''}.`);
      ev.fin.forEach((i) => partes.push(`${P(i)} termina en t = ${R.fin[i]}: respuesta = ${R.fin[i]} − ${procs[i].ll} = <b>${R.resp[i]}</b>; espera = ${R.resp[i]} − ${procs[i].ej} = <b>${R.esp[i]}</b>.`));
      if (paso >= R.T) partes.push(`<b>Fin.</b> Tiempo medio de espera <b>${coma(R.mediaEsp)}</b> y de respuesta <b>${coma(R.mediaResp)}</b>.`);
      return partes.join(' ');
    }

    function pinta() {
      tEl.textContent = paso;
      pintaGantt();
      const ev = paso > 0 ? R.units[paso - 1] : null;
      chips(zonas.cola, ev ? ev.cola : []);
      chips(zonas.cpu, ev && ev.ejecuta !== null && !ev.fin.includes(ev.ejecuta) ? [ev.ejecuta] : []);
      chips(zonas.fin, procs.map((p, i) => i).filter((i) => R.fin[i] !== null && R.fin[i] <= paso));
      msg.innerHTML = texto();
      botones.ant.disabled = paso === 0; botones.ini.disabled = paso === 0;
      botones.sig.disabled = paso >= R.T; botones.fin.disabled = paso >= R.T;
      pintaSalida();
    }
    function recalcula() { R = simulaPlan(procs, algo, q); paso = 0; pinta(); }

    procs = iniciales.map(([ll, ej, pr], i) => ({ ll: ll || 0, ej: ej || 1, pr: pr || i + 1 }));
    pintaEntrada();
    recalcula();
  }

  /* ---------- teorema fundamental de la numeración, paso a paso ----------
   * <div class="sumatorio" data-numero="52318" data-base="10"> <div class="sum-cuerpo">…</div> </div>
   * El número en grande, con su posición i debajo de cada cifra y la base de subíndice. Cada
   * «Siguiente» ilumina una cifra, de izquierda a derecha, y añade a la suma su término dᵢ·bⁱ con
   * su valor debajo; el último paso da el total. El selector «Base» cambia entre 2, 8, 10 y 16 (cada
   * una con su ejemplo) y «Otro número» saca otro al azar en la base elegida. El .sum-cuerpo del
   * HTML es la versión estática (miniaturas del carril, impresión); el script lo sustituye.
   */
  // por base: el ejemplo al elegirla, cuántas cifras tiene «Otro número» y hasta cuántos decimales.
  // Octal y hexadecimal, 3 cifras como en el ejercicio Entre bases y como mucho 1 decimal: con 2, los productos
  // ya son como 7·8⁻² = 0,109375 o 15·16⁻² = 0,05859375.
  const SUM_BASES = { 2: { ej: '11011', cifras: 5, dec: 3 }, 8: { ej: '745', cifras: 3, dec: 1 }, 10: { ej: '52318', cifras: 5, dec: 3 }, 16: { ej: '2AF', cifras: 3, dec: 1 } };

  function montaSumatorio(el) {
    const menos = (n) => String(n).replace('-', '−');
    const exp = (n) => `<sup>${menos(n)}</sup>`;                         // <sup> y no ⁴: en JetBrains Mono los ⁰⁴⁵… salen de otra fuente
    // en base 10, 0,05 sin arrastrar errores de coma flotante; en 2, 8 y 16 los pesos son potencias de 2 y el valor
    // es exacto (15·16⁻³ = 0,003662109375): no se redondea
    const dec = (x) => String(b === 10 ? Number(x.toFixed(10)) : x).replace('.', ',');
    let b = Math.min(16, Math.max(2, Number(el.dataset.base) || 10));
    let SIMB = '0123456789ABCDEF'.slice(0, b);
    let numero = String(el.dataset.numero || '52318').toUpperCase();
    let C = [], paso = 0;
    let cuerpo = el.querySelector('.sum-cuerpo');
    if (!cuerpo) { cuerpo = document.createElement('div'); cuerpo.className = 'sum-cuerpo'; el.appendChild(cuerpo); }
    const acciones = document.createElement('div');
    acciones.className = 'sum-acciones';
    acciones.innerHTML = `<div class="sum-bases"><span>Base</span>${Object.keys(SUM_BASES).map((x) => `<button type="button" data-b="${x}">${x}</button>`).join('')}</div>`
      + '<div class="sum-botones"><button type="button" class="btn btn-ghost" data-a="ant">Anterior</button><button type="button" class="btn btn-primary" data-a="sig">Siguiente</button><button type="button" class="btn btn-ghost" data-a="otro">Otro número</button></div>';
    el.appendChild(acciones);
    const botones = {};
    acciones.querySelectorAll('[data-a]').forEach((x) => { botones[x.dataset.a] = x; });
    const marcaBase = () => acciones.querySelectorAll('[data-b]').forEach((x) => x.classList.toggle('activo', Number(x.dataset.b) === b));

    // un número al azar en la base actual, con las cifras de SUM_BASES; la coma cae al azar (siempre quedan
    // 2 cifras enteras). Sin ceros a la izquierda ni al final de los decimales; en hexadecimal, con alguna letra.
    function otro() {
      const cfg = SUM_BASES[b] || { cifras: numero.replace(',', '').length, dec: 0 };
      const n = cfg.cifras;
      const cifra = (sinCero) => SIMB[rnd(sinCero ? 1 : 0, b - 1)];
      let nuevo;
      do {
        const nd = rnd(0, Math.max(0, Math.min(cfg.dec, n - 2))), ne = n - nd;
        nuevo = Array.from({ length: ne }, (_, k) => cifra(k === 0 && ne > 1)).join('')
          + (nd ? ',' + Array.from({ length: nd }, (_, k) => cifra(k === nd - 1)).join('') : '');
      } while (nuevo === numero || (b === 16 && !/[A-F]/.test(nuevo)));
      numero = nuevo;
    }

    // número escrito a mano: al pulsar el número se cambia por una caja con la misma letra. Solo deja
    // escribir cifras de la base, una coma (el punto vale como coma), hasta SUM_MAX cifras y hasta
    // SUM_DEC[b] decimales (con más, los pesos bajan de 10⁻⁶ y JavaScript los escribe como 5.96e-8).
    // Intro (o salir de la caja) lo desarrolla; Esc lo deja como estaba.
    const SUM_MAX = 8, SUM_DEC = { 2: 8, 8: 4, 10: 6, 16: 3 };
    const CIFRAS = { 2: '0 y 1', 8: 'del 0 al 7', 10: 'del 0 al 9', 16: 'del 0 al 9 y de la A a la F' };
    function filtra(v) {
      let s = [...v.toUpperCase().replace(/\./g, ',')].filter((ch) => ch === ',' || SIMB.includes(ch)).join('');
      const c = s.indexOf(',');
      if (c >= 0) s = s.slice(0, c + 1) + s.slice(c + 1).replace(/,/g, '');
      let n = 0, d = -1;
      return [...s].filter((ch) => { if (ch === ',') { d = 0; return true; } return ++n <= SUM_MAX && (d < 0 || ++d <= (SUM_DEC[b] || 3)); }).join('');
    }
    function edita() {
      const num = cuerpo.querySelector('.sum-numero');
      if (!num) return;
      const caja = document.createElement('div');
      caja.className = 'sum-edita';
      caja.innerHTML = `<div class="sum-edita-fila"><input class="sum-entrada" type="text" spellcheck="false" autocomplete="off" aria-label="Número en base ${b}"><span class="sum-edita-base">(${b}</span></div>
        <p class="sum-ayuda">Cifras ${CIFRAS[b] || 'de la base'}; hasta ${SUM_MAX} cifras y ${SUM_DEC[b] || 3} decimales. <b>Intro</b> para desarrollarlo, <b>Esc</b> para dejarlo como estaba.</p>`;
      num.replaceWith(caja);
      paso = 0; pinta();
      const inp = caja.querySelector('input');
      const ancho = () => { inp.style.width = (Math.max(inp.value.length, 1) + 0.5) + 'ch'; };
      inp.value = numero; ancho();
      inp.addEventListener('input', () => {
        const v = filtra(inp.value);
        if (v !== inp.value) { const p = Math.max(0, inp.selectionStart - (inp.value.length - v.length)); inp.value = v; inp.setSelectionRange(p, p); }
        ancho();
      });
      let cerrada = false;
      const cierra = (aplica) => {
        if (cerrada) return; cerrada = true;
        if (aplica) {
          const v = filtra(inp.value).replace(/,$/, '').replace(/^,/, '0,').replace(/^0+(?=[0-9A-F])/, '');
          if (v) numero = v;
        }
        monta();
      };
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation();                              // que no lo tomen las flechas, la N, la C ni la B del deck
        if (e.key === 'Enter') { e.preventDefault(); cierra(true); }
        else if (e.key === 'Escape') { e.preventDefault(); cierra(false); }
      });
      inp.addEventListener('blur', () => cierra(true));
      inp.focus(); inp.select();
    }

    // los números largos se encogen para caber en la tarjeta (--k en el número, --ks en la suma)
    function ajusta() {
      const W = cuerpo.clientWidth;
      if (!W) return;                                     // diapositiva oculta: ya se ajustará al volver a montar
      [['.sum-numero', '--k'], ['.sum-suma', '--ks']].forEach(([sel, v]) => {
        const x = cuerpo.querySelector(sel);
        x.style.removeProperty(v);
        let k = 1;
        for (let vuelta = 0; vuelta < 3; vuelta++) {       // los radios y algún borde no escalan: se afina en dos o tres vueltas
          const w = Math.max(x.scrollWidth, x.offsetWidth);
          if (w <= W) break;
          k *= W / w * 0.98;
          x.style.setProperty(v, k.toFixed(3));
        }
      });
    }

    function monta() {
      const [ent, fr = ''] = numero.split(',');
      C = [...ent].map((ch, k) => ({ ch, i: ent.length - 1 - k }))
        .concat([...fr].map((ch, k) => ({ ch, i: -(k + 1) })))
        .map((c) => ({ ...c, v: SIMB.indexOf(c.ch), w: Math.pow(b, c.i) }));
      const total = C.reduce((s, c) => s + c.v * c.w, 0);
      // el número: una columna por cifra (la cifra y su posición debajo), la coma y la base
      const col = (clase, k, arriba, abajo) => `<div class="sum-col ${clase}"${k === null ? '' : ` data-k="${k}"`}><span class="sum-d">${arriba}</span><span class="sum-i">${abajo}</span></div>`;
      const numeroHTML = col('sum-rotulos', null, 'd<sub>i</sub>', 'i')
        + C.map((c, k) => (fr && k === ent.length ? col('sum-coma', null, ',', '') : '') + col('', k, c.ch, menos(c.i))).join('')
        + col('sum-base', null, `(${b}`, 'b');
      // la suma: rejilla de dos filas, cada término encima de su valor
      // los términos nacen ya ocultos: si nacieran visibles y pinta() los ocultara, la transición de opacidad
      // enseñaría la solución un instante al pulsar «Otro número»
      const cel = (t, txt, clase = '') => {
        const c = [clase, t === null ? '' : 'oculto'].filter(Boolean).join(' ');
        return `<span${t === null ? '' : ` data-t="${t}"`}${c ? ` class="${c}"` : ''}>${txt}</span>`;
      };
      let suma = cel(null, 'N') + cel(null, '') + cel(null, '=') + cel(null, '=');
      C.forEach((c, k) => {
        if (k) suma += cel(k, '+') + cel(k, '+');
        suma += cel(k, `${c.v}·${b}${exp(c.i)}`, 'sum-t') + cel(k, dec(c.v * c.w), 'sum-t');
      });
      suma += cel(null, '') + cel('fin', '=') + cel(null, '') + cel('fin', dec(total), 'sum-t sum-total');
      cuerpo.innerHTML = `<div class="sum-numero" title="Pulsa para escribir tu número">${numeroHTML}</div><div class="sum-suma">${suma}</div>`;
      cuerpo.querySelector('.sum-numero').addEventListener('click', (e) => { e.stopPropagation(); edita(); });
      ajusta();
      paso = 0;
      pinta();
    }

    function pinta() {
      const n = C.length, FIN = n + 1;              // 0 inicio, 1…n una cifra cada uno, n+1 el total
      const actual = paso >= 1 && paso <= n ? paso - 1 : -1;
      cuerpo.querySelectorAll('.sum-col[data-k]').forEach((x) => x.classList.toggle('on', Number(x.dataset.k) === actual));
      cuerpo.querySelectorAll('[data-t]').forEach((x) => {
        const t = x.dataset.t;
        x.classList.toggle('oculto', t === 'fin' ? paso < FIN : Number(t) >= paso);
        x.classList.toggle('on', t === 'fin' ? paso === FIN : Number(t) === actual);
      });
      botones.ant.disabled = paso === 0;
      botones.sig.disabled = paso >= FIN;
    }

    acciones.addEventListener('click', (e) => {
      const x = e.target.closest('button'); if (!x) return;
      e.stopPropagation();
      if (x.dataset.b) {
        if (Number(x.dataset.b) === b) return;
        b = Number(x.dataset.b); SIMB = '0123456789ABCDEF'.slice(0, b);
        numero = SUM_BASES[b].ej;
        marcaBase(); monta(); return;
      }
      const a = x.dataset.a;
      if (a === 'otro') { otro(); monta(); return; }
      if (a === 'sig') paso = Math.min(C.length + 1, paso + 1);
      else paso = Math.max(0, paso - 1);
      pinta();
    });
    marcaBase();
    monta();
  }

  /* ---------- notas del profesor (tecla N) ----------
   * La ventana assets/notas.html se abre con window.open y habla con esta página por postMessage:
   *   ventana -> deck   {som:'hola'}            pide el estado (al abrir y cada segundo, por si el deck se recarga)
   *                     {som:'ir', index}       salta a una diapositiva
   *   deck -> ventana   {som:'estado', ...}     deck, título, índice actual y lista de diapositivas con sus notas
   *                     {som:'diapo', index}    ha cambiado la diapositiva actual
   */
  const URL_NOTAS = (document.currentScript && document.currentScript.src || '../assets/som.js').replace(/som\.js.*$/, 'notas.html');
  let ventanaNotas = null;

  function idDeck() {
    // /ut01/, /ut01/index.html o /ut01/otra.html -> 'ut01'
    return location.pathname.replace(/\/[^/]*\.html?$/, '').replace(/\/$/, '').split('/').pop() || 'deck';
  }

  function estadoNotas(stage) {
    const secs = [...stage.querySelectorAll(':scope > section')];
    return {
      som: 'estado',
      deck: idDeck(),
      titulo: document.title,
      index: stage.index || 0,
      diapos: secs.map((s, i) => {
        const aside = s.querySelector(':scope > aside.notas');
        return {
          n: i + 1,
          label: s.dataset.label || ('Diapositiva ' + (i + 1)),
          seccion: s.dataset.seccion || '',
          criterio: s.dataset.criterio || '',
          notas: aside ? aside.innerHTML.trim() : '',
        };
      }),
    };
  }

  function enviaNotas(msg) {
    if (!ventanaNotas || ventanaNotas.closed) return;
    try { ventanaNotas.postMessage(msg, '*'); } catch (e) {}
  }

  function abreNotas() {
    if (ventanaNotas && !ventanaNotas.closed) { ventanaNotas.focus(); return; }
    ventanaNotas = window.open(URL_NOTAS, 'som-notas', 'popup,width=980,height=760');
  }

  function montaNotas(stage) {
    window.addEventListener('keydown', (e) => {
      if ((e.key !== 'n' && e.key !== 'N') || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.composedPath ? e.composedPath()[0] : e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      abreNotas();
    });
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || typeof d !== 'object' || !d.som) return;
      if (d.som === 'hola') { ventanaNotas = e.source; enviaNotas(estadoNotas(stage)); }
      else if (d.som === 'ir' && typeof d.index === 'number') stage.goTo(d.index);
    });
    stage.addEventListener('slidechange', (e) => enviaNotas({ som: 'diapo', index: e.detail.index }));
  }
  SOM.abreNotas = abreNotas;

  /* ---------- calculadora básica (tecla C) ----------
   * Panel flotante con assets/calc.html en un iframe. Se arrastra por la cabecera, recuerda su
   * posición en localStorage y se puede extraer a una pestaña nueva (mismo archivo, solo).
   * La calculadora avisa por postMessage {som:'calc-cerrar'} cuando se pulsa Esc con todo a cero.
   */
  const URL_CALC = (document.currentScript && document.currentScript.src || '../assets/som.js').replace(/som\.js.*$/, 'calc.html');
  let panelCalc = null;

  function abreCalc() {
    if (panelCalc) { cierraCalc(); return; }
    const p = document.createElement('div');
    p.className = 'calc-panel';
    p.innerHTML = '<div class="calc-cab"><span class="calc-titulo">Calculadora básica</span>'
      + '<button class="calc-btn" data-calc="pestana" title="Abrir en una pestaña nueva">⧉</button>'
      + '<button class="calc-btn" data-calc="cerrar" title="Cerrar (tecla C)">×</button></div>'
      + '<iframe src="' + URL_CALC + '" title="Calculadora básica"></iframe>';
    let pos = null;
    try { pos = JSON.parse(localStorage.getItem('som-calc-pos') || 'null'); } catch (e) {}
    const ancho = 372, alto = 620;
    const x = pos && pos.x !== undefined ? pos.x : window.innerWidth - ancho - 32;
    const y = pos && pos.y !== undefined ? pos.y : Math.max(16, window.innerHeight - alto - 32);
    p.style.left = Math.max(0, Math.min(x, window.innerWidth - ancho)) + 'px';
    p.style.top = Math.max(0, Math.min(y, window.innerHeight - 60)) + 'px';
    p.addEventListener('click', (e) => {
      const b = e.target.closest('[data-calc]'); if (!b) return;
      if (b.dataset.calc === 'cerrar') cierraCalc();
      else { window.open(URL_CALC, '_blank', 'noopener'); cierraCalc(); }
    });
    // arrastre por la cabecera
    const cab = p.querySelector('.calc-cab');
    let arr = null;
    cab.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      arr = { dx: e.clientX - p.offsetLeft, dy: e.clientY - p.offsetTop };
      cab.setPointerCapture(e.pointerId);
      p.classList.add('arrastrando');
    });
    cab.addEventListener('pointermove', (e) => {
      if (!arr) return;
      const nx = Math.max(0, Math.min(e.clientX - arr.dx, window.innerWidth - p.offsetWidth));
      const ny = Math.max(0, Math.min(e.clientY - arr.dy, window.innerHeight - cab.offsetHeight));
      p.style.left = nx + 'px'; p.style.top = ny + 'px';
    });
    const suelta = () => {
      if (!arr) return;
      arr = null; p.classList.remove('arrastrando');
      try { localStorage.setItem('som-calc-pos', JSON.stringify({ x: p.offsetLeft, y: p.offsetTop })); } catch (e) {}
    };
    cab.addEventListener('pointerup', suelta);
    cab.addEventListener('pointercancel', suelta);
    document.body.appendChild(p);
    panelCalc = p;
    const fr = p.querySelector('iframe');
    fr.addEventListener('load', () => { try { fr.contentWindow.focus(); } catch (e) {} });
  }

  function cierraCalc() {
    if (!panelCalc) return;
    panelCalc.remove(); panelCalc = null;
    try { window.focus(); } catch (e) {}
  }

  function montaCalc() {
    window.addEventListener('keydown', (e) => {
      if ((e.key !== 'c' && e.key !== 'C') || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.composedPath ? e.composedPath()[0] : e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      abreCalc();
    });
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (d && typeof d === 'object' && d.som === 'calc-cerrar') cierraCalc();
    });
  }
  SOM.abreCalc = abreCalc;

  /* ---------- buscador dentro de la unidad (tecla B y botón «Buscar» en la barra flotante) ----------
   * Busca solo en esta presentación: las diapositivas ya están en el DOM, así que no descarga nada y
   * funciona igual en GitHub Pages, en un servidor local o abriendo el archivo. El índice se construye
   * la primera vez que se abre el panel: por diapositiva, su rótulo (data-label), la sección y el texto
   * visible, sin las notas del profesor ni los ejercicios y simuladores generados. Se compara sin tildes
   * ni mayúsculas.
   */
  function normaliza(s) {
    // Carácter a carácter para que las posiciones coincidan con el texto original (los fragmentos resaltados)
    return s.split('').map((c) => {
      const d = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      return d.length === 1 ? d : c;
    }).join('');
  }
  function escapaHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  // textContent pega las palabras de bloques contiguos («procesoLa»): se añade un espacio al cerrar cada bloque
  const BLOQUES = /^(P|H[1-6]|LI|UL|OL|DIV|SECTION|ARTICLE|ASIDE|HEADER|FOOTER|FIGURE|FIGCAPTION|TABLE|TR|TD|TH|BR|BLOCKQUOTE|DT|DD)$/;
  function textoVisible(el) {
    let t = '';
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) t += n.textContent;
      else if (n.nodeType === 1) { t += textoVisible(n); if (BLOQUES.test(n.tagName)) t += ' '; }
    });
    return t;
  }
  function indiceBusqueda(stage) {
    return [...stage.querySelectorAll(':scope > section')].map((s, i) => {
      const c = s.cloneNode(true);
      c.querySelectorAll('aside.notas, .seccion-pill, [data-slide-num], .ej, .sim, script, style').forEach((n) => n.remove());
      const texto = textoVisible(c).replace(/\s+/g, ' ').trim();
      const label = (s.dataset.label || ('Diapositiva ' + (i + 1))).replace(/^\S+\s·\s/, '');
      return {
        i, label, texto,
        seccion: s.dataset.seccion || '',
        nLabel: normaliza(label),
        nTexto: normaliza(texto),
      };
    });
  }
  // Fragmento del texto alrededor del primer término, con todos los términos resaltados
  function fragmento(d, terminos) {
    const ANTES = 60, LARGO = 190;
    let pos = -1;
    for (const t of terminos) { const p = d.nTexto.indexOf(t); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }
    if (pos < 0) return '';
    let ini = Math.max(0, pos - ANTES);
    if (ini > 0) { const sp = d.nTexto.lastIndexOf(' ', ini); ini = sp > 0 ? sp + 1 : ini; }
    let fin = Math.min(d.nTexto.length, ini + LARGO);
    if (fin < d.nTexto.length) { const sp = d.nTexto.indexOf(' ', fin); if (sp > 0 && sp - fin < 20) fin = sp; }
    const nTrozo = d.nTexto.slice(ini, fin), trozo = d.texto.slice(ini, fin);
    // Marcas por carácter de cada acierto, sin solapar
    const marcas = new Array(nTrozo.length + 1).fill(0);
    for (const t of terminos) {
      let p = nTrozo.indexOf(t);
      while (p >= 0) { for (let k = p; k < p + t.length; k++) marcas[k] = 1; p = nTrozo.indexOf(t, p + t.length); }
    }
    let html = '', dentro = false;
    for (let k = 0; k < trozo.length; k++) {
      if (marcas[k] && !dentro) { html += '<mark>'; dentro = true; }
      if (!marcas[k] && dentro) { html += '</mark>'; dentro = false; }
      html += escapaHtml(trozo[k]);
    }
    if (dentro) html += '</mark>';
    return (ini > 0 ? '… ' : '') + html + (fin < d.nTexto.length ? ' …' : '');
  }
  function buscaEn(indice, q) {
    const terminos = normaliza(q).split(/\s+/).filter(Boolean);
    if (!terminos.length) return [];
    const res = [];
    indice.forEach((d) => {
      let puntos = 0;
      for (const t of terminos) {
        const enLabel = d.nLabel.indexOf(t) >= 0, enTexto = d.nTexto.indexOf(t) >= 0;
        if (!enLabel && !enTexto) { puntos = -1; break; }
        puntos += enLabel ? 10 : 1;
      }
      if (puntos > 0) res.push({ d, puntos });
    });
    res.sort((a, b) => b.puntos - a.puntos || a.d.i - b.d.i);
    return res.slice(0, 40).map((r) => Object.assign({ frag: fragmento(r.d, terminos) }, r.d));
  }

  let panelBusqueda = null;
  function abreBuscador(stage) {
    if (panelBusqueda) { panelBusqueda.querySelector('input').focus(); return; }
    if (!stage.__indiceBusqueda) stage.__indiceBusqueda = indiceBusqueda(stage);
    const indice = stage.__indiceBusqueda;
    const p = document.createElement('div');
    p.className = 'buscador';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Buscar en la unidad');
    p.innerHTML =
      '<div class="buscador-caja">' +
        '<div class="buscador-cabecera"><input type="text" autocomplete="off" spellcheck="false" placeholder="Buscar en esta unidad…" aria-label="Buscar en esta unidad">' +
        '<button type="button" class="buscador-cerrar" aria-label="Cerrar">×</button></div>' +
        '<ol class="buscador-lista" hidden></ol>' +
        '<p class="buscador-vacio"></p>' +
        '<div class="buscador-pie"><span><kbd>↑</kbd><kbd>↓</kbd>moverse</span><span><kbd>Enter</kbd>ir a la diapositiva</span><span><kbd>Esc</kbd>cerrar</span></div>' +
      '</div>';
    const input = p.querySelector('input'), lista = p.querySelector('.buscador-lista'), vacio = p.querySelector('.buscador-vacio');
    let resultados = [], sel = 0;
    const cierra = () => { p.remove(); panelBusqueda = null; };
    const marca = () => {
      [...lista.children].forEach((li, k) => li.toggleAttribute('data-sel', k === sel));
      const li = lista.children[sel];
      if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
    };
    const ve = (k) => { const r = resultados[k]; if (!r) return; cierra(); stage.goTo(r.i); };
    const pinta = () => {
      const q = input.value.trim();
      resultados = q ? buscaEn(indice, q) : [];
      sel = 0;
      lista.innerHTML = resultados.map((r) =>
        '<li><span class="b-num">' + String(r.i + 1).padStart(2, '0') + '</span>' +
        '<span class="b-titulo">' + (r.seccion ? '<span class="b-pill">' + escapaHtml(r.seccion) + '</span>' : '') +
        escapaHtml(r.label) + '</span>' +
        (r.frag ? '<p class="b-frag">' + r.frag + '</p>' : '') + '</li>').join('');
      lista.hidden = !resultados.length;
      vacio.hidden = !!resultados.length;
      vacio.textContent = !q ? 'Escribe para buscar en las ' + indice.length + ' diapositivas de esta unidad.'
        : 'Nada en esta unidad para «' + q + '».';
      marca();
    };
    input.addEventListener('input', pinta);
    // Que las teclas del panel no lleguen al motor ni a los demás atajos (N, C, B)
    p.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); cierra(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (resultados.length) { sel = (sel + 1) % resultados.length; marca(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (resultados.length) { sel = (sel - 1 + resultados.length) % resultados.length; marca(); } }
      else if (e.key === 'Enter') { e.preventDefault(); ve(sel); }
    });
    lista.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (li) ve([...lista.children].indexOf(li));
    });
    p.querySelector('.buscador-cerrar').addEventListener('click', cierra);
    p.addEventListener('click', (e) => { if (e.target === p) cierra(); });
    document.body.appendChild(p);
    panelBusqueda = p;
    pinta();
    input.focus();
  }

  function montaBuscador(stage) {
    const overlay = stage.shadowRoot && stage.shadowRoot.querySelector('.overlay');
    if (overlay && !overlay.querySelector('.buscar')) {
      const sep = document.createElement('span'); sep.className = 'divider';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn buscar'; b.title = 'Buscar en esta unidad (B)';
      b.innerHTML = 'Buscar<span class="kbd" style="display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;margin-left:6px;padding:0 4px;border-radius:3px;background:rgba(255,255,255,.14);font-size:10px;font-weight:600">B</span>';
      b.addEventListener('click', () => abreBuscador(stage));
      overlay.append(sep, b);
    }
    window.addEventListener('keydown', (e) => {
      if ((e.key !== 'b' && e.key !== 'B') || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.composedPath ? e.composedPath()[0] : e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      abreBuscador(stage);
    });
  }
  SOM.abreBuscador = () => { const s = document.querySelector('deck-stage'); if (s) abreBuscador(s); };

  /* ---------- numeración ---------- */
  /* ---------- volver: botón «Inicio» en la barra flotante del motor y pastilla de sección clicable ----------
   * La barra flotante (.overlay, dentro del shadow DOM de deck-stage) aparece al mover el ratón y se oculta en
   * presentación e impresión: ahí va un enlace a la página principal del módulo (../). La pastilla amarilla con
   * el número de sección (data-seccion) es un botón que salta al índice de la unidad (la diapositiva cuya
   * etiqueta empieza por «Índice»; si no hay, la segunda).
   */
  function montaVolver(stage) {
    const overlay = stage.shadowRoot && stage.shadowRoot.querySelector('.overlay');
    if (overlay && !overlay.querySelector('.inicio')) {
      const sep = document.createElement('span'); sep.className = 'divider';
      const a = document.createElement('a');
      a.className = 'btn inicio'; a.href = '../'; a.title = 'Volver al índice del módulo';
      a.textContent = 'Inicio';
      a.style.cssText = 'color:inherit;text-decoration:none;cursor:pointer;padding:0 10px';
      overlay.append(sep, a);
    }
    const secs = [...stage.querySelectorAll(':scope > section')];
    let idx = secs.findIndex((s) => /^índice/i.test(s.dataset.label || ''));
    if (idx < 0) idx = Math.min(1, secs.length - 1);
    secs.forEach((s) => {
      if (!s.dataset.seccion || s.querySelector(':scope > .seccion-pill')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'seccion-pill'; b.textContent = s.dataset.seccion;
      b.title = 'Ir al índice de la unidad';
      b.addEventListener('click', (e) => { e.stopPropagation(); stage.goTo(idx); });
      s.appendChild(b);
    });
  }

  function numera(stage) {
    const secs = [...stage.querySelectorAll(':scope > section')];
    secs.forEach((s, i) => {
      if (s.querySelector('[data-slide-num]')) return;
      const n = document.createElement('span');
      n.setAttribute('data-slide-num', '');
      n.textContent = String(i + 1).padStart(2, '0') + ' / ' + secs.length;
      if (getComputedStyle(s).position === 'static') s.style.position = 'relative';
      s.appendChild(n);
    });
  }

  function init() {
    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    numera(stage);
    document.querySelectorAll('.ej[data-tipo]').forEach(montaEjercicio);
    document.querySelectorAll('.sim').forEach(montaSimulador);
    document.querySelectorAll('.sumatorio').forEach(montaSumatorio);
    document.querySelectorAll('.quiz').forEach(montaQuiz);
    document.querySelectorAll('.revela').forEach(montaRevela);
    document.querySelectorAll('.galeria').forEach(montaGaleria);
    document.querySelectorAll('.foto').forEach(montaFoto);
    document.querySelectorAll('deck-stage > section').forEach(montaMarcas);
    document.querySelectorAll('.letra').forEach(montaLetra);
    montaBuscador(stage);
    montaVolver(stage);
    montaNotas(stage);
    montaCalc();
    stage.addEventListener('slidechange', (e) => { apagaLetras(e.detail.previousSlide); enciendeLetras(e.detail.slide); });
    // el slidechange inicial se dispara antes de que este script escuche: se enciende la actual a mano
    customElements.whenDefined('deck-stage').then(() => { const secs = stage.querySelectorAll(':scope > section'); enciendeLetras(secs[stage.index || 0]); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
