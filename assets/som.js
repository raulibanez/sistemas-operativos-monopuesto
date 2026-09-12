/* Motor común de las presentaciones de Sistemas Operativos Monopuesto.
 *
 *  1. Numera las diapositivas ("03 / 72").
 *  2. Quiz de opción múltiple:
 *       <div class="quiz" data-correct="1" data-ok="..." data-ko="...">
 *         <p class="quiz-fb">Selecciona una opción.</p>
 *         <div class="quiz-opts"> <button class="quiz-opt">…</button> … </div>
 *         <button class="btn btn-ghost quiz-reset">Reiniciar</button>
 *       </div>
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
 *     restabin, logica, c1c2, restac2, paridad, unidades, ascii, ieee754. Atributos: data-bits,
 *     data-min, data-max, data-modo (modo fijo de los que tienen modos) y data-paridad (par | impar).
 *  6. Simulador visual de planificación de procesos, paso a paso:
 *       <div class="sim-entrada"></div> (datos) y <div class="sim" data-algo="fifo"></div> (cronograma)
 *     en la misma diapositiva. Algoritmos: fifo, sjf, srtf, pne, pe, rr (data-q). SOM.simulaPlan expone el motor.
 */
(function () {
  'use strict';

  const SOM = (window.SOM = window.SOM || {});

  /* ---------- utilidades ---------- */
  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const bin = (n, bits) => n.toString(2).padStart(bits || 0, '0');
  const agrupa = (s) => s.replace(/\B(?=(\d{4})+(?!\d))/g, ' ');
  const esBin = (s) => /^[01]+$/.test(s);
  const limpia = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

  /* ---------- generadores de ejercicios ----------
   * Los ejercicios "de rejilla" (rejilla: true) se resuelven en vertical, como en la pizarra:
   * el generador devuelve un objeto g con
   *   enunciado  texto de la consigna
   *   columnas   grid-template-columns de la rejilla
   *   clase      clases extra de la rejilla ('compacta' para 8 o 9 celdas por fila)
   *   filas      lista de filas; cada fila es una lista de elementos:
   *                {lbl:'texto'}                        etiqueta de la fila
   *                {d:'1', clase, span, espejo:'id'}    dato visible (espejo: copia lo que se escribe en la casilla id)
   *                {c:'valor', clase, max, filtro, n, id, expl, cmp, span}   casilla que rellena el alumno
   *                {sel:['+','−'], c:'−', expl}          botón que alterna entre opciones
   *              o {linea:true} para la raya de la operación
   *   n          orden de resolución de las casillas (menor primero); sin n, orden de aparición
   *   expl       explicación de la casilla (la usa Pista)
   *   correcto   mensaje al acertar
   *   espejo     función (id, valorEscrito) -> texto que se muestra en los espejos
   *   valida     función () -> mensaje de error o null, antes de corregir las casillas
   *   acciones   botones extra [{texto, accion(api)}]
   * y el generador puede tener modos: [{t:'texto', v:'valor'}] que se muestran como botones.
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
    const fBits = [{ lbl: base === 2 ? 'bits' : 'dígitos' }], fPos = [{ lbl: 'posición' }];
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
    filas.push([{ lbl: 'suma' }, { c: String(suma), clase: 'num', max: 6, filtro: /[^0-9]/g, span: w, n: 300,
      expl: `Sumo los productos distintos de cero: ${sumandos.join(' + ')} = ${suma}` }]);
    return { filas, suma, sumandos };
  }

  SOM.generadores = {

    /* 3.1 binario -> decimal */
    bin2dec: {
      titulo: 'De binario a decimal',
      rejilla: true,
      generar(cfg) {
        const bits = cfg.bits || 8;
        const n = rnd(cfg.min || 16, cfg.max || (1 << bits) - 1);
        const b = bin(n, bits);
        const t = tablaPesos(b.split(''), 2);
        return {
          enunciado: 'Escribe el peso de cada posición, multiplica por el bit y suma. Empieza por la derecha.',
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
          columnas: '110px 36px 50px 40px 110px 80px 62px', clase: 'compacta mini',
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
      modos: [{ t: 'Binario → octal', v: 'bin2oct' }, { t: 'Binario → hexadecimal', v: 'bin2hex' }, { t: 'Octal → binario', v: 'oct2bin' }, { t: 'Hexadecimal → binario', v: 'hex2bin' }, { t: 'Hexadecimal → decimal', v: 'hex2dec' }, { t: 'Al azar', v: null }],
      generar(cfg) {
        const modo = cfg.modo || ['bin2oct', 'bin2hex', 'oct2bin', 'hex2bin', 'hex2dec'][rnd(0, 4)];
        const base = modo.includes('oct') ? 8 : 16, gr = base === 8 ? 3 : 4;
        if (modo === 'hex2dec') {
          const k = rnd(2, 3);
          const n = rnd(Math.pow(16, k - 1) + 1, Math.pow(16, k) - 1);
          const h = n.toString(16).toUpperCase();
          const t = tablaPesos(h.split(''), 16);
          return {
            enunciado: 'Hexadecimal a decimal: el valor de cada dígito por el peso de su posición (16ⁿ), y se suma.',
            columnas: `130px repeat(${k}, 130px)`, clase: 'compacta', filas: t.filas,
            correcto: `Correcto: ${h} (16 = ${t.sumandos.join(' + ')} = ${n} (10`
          };
        }
        if (modo === 'bin2oct' || modo === 'bin2hex') {
          const bits = rnd(gr + 2, gr * 3);
          const n = rnd(1 << (bits - 1), (1 << bits) - 1);
          const b = n.toString(2), k = Math.ceil(b.length / gr), rell = b.padStart(k * gr, '0');
          const grupos = rell.match(new RegExp(`.{${gr}}`, 'g'));
          const res = n.toString(base).toUpperCase();
          return {
            enunciado: `Binario a ${NOMBRE_BASE[base]}: separa en grupos de ${gr} bits empezando por la derecha y traduce cada grupo.`,
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
          enunciado: `${NOMBRE_BASE[base][0].toUpperCase() + NOMBRE_BASE[base].slice(1)} a binario: cada dígito se convierte en un grupo de ${gr} bits, con ceros a la izquierda si hace falta.`,
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
            enunciado: aBits ? 'Pasa de bytes a bits. Elige la operación y escribe el resultado.' : 'Pasa de bits a bytes. Elige la operación y escribe el resultado.',
            columnas: '190px 200px 140px', clase: 'compacta',
            filas: [
              [{ lbl: 'dato' }, { d: aBits ? String(nB) : String(nb), clase: 'ancho' }, { d: aBits ? 'bytes' : 'bits', clase: 'peq' }],
              [{ lbl: 'operación' }, { sel: ['× 8', '÷ 8'], c: aBits ? '× 8' : '÷ 8', n: 0,
                expl: aBits ? 'Un byte son 8 bits: de bytes a bits se multiplica por 8' : 'Un byte son 8 bits: de bits a bytes se divide entre 8' }, { d: '' }],
              { linea: true },
              [{ lbl: 'resultado' }, { c: aBits ? String(nb) : String(nB), clase: 'num', max: 4, filtro: /[^0-9]/g, n: 1,
                expl: aBits ? `${nB} × 8 = ${nb} bits` : `${nb} ÷ 8 = ${nB} bytes` }, { d: aBits ? 'bits' : 'bytes', clase: 'peq' }]
            ],
            correcto: aBits ? `Correcto: ${nB} bytes son ${nb} bits.` : `Correcto: ${nb} bits son ${nB} bytes.`
          };
        }
        if (modo === 'binario') {
          const U = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
          const sube = rnd(0, 1) === 1;                        // sube: a una unidad mayor (se divide)
          const pasos = sube ? 1 : rnd(1, 2);                  // dividir dos veces sin calculadora es demasiado
          const i = sube ? rnd(0, U.length - 1 - pasos) : rnd(pasos, U.length - 1);
          const k = rnd(1, 12);
          const valor = sube ? k * Math.pow(1024, pasos) : k;
          const filas = [[{ lbl: 'dato' }, { d: miles(valor), clase: 'ancho' }, { d: '' }, { d: U[i], clase: 'peq' }]];
          let v = valor, u = i;
          for (let p = 0; p < pasos; p++) {
            const nu = sube ? u + 1 : u - 1, nv = sube ? v / 1024 : v * 1024;
            filas.push([{ lbl: pasos > 1 ? `paso ${p + 1}` : 'operación' },
              { sel: ['× 1024', '÷ 1024'], c: sube ? '÷ 1024' : '× 1024', n: 2 * p,
                expl: `1 ${U[Math.max(u, nu)]} son 1024 ${U[Math.min(u, nu)]}: de ${U[u]} a ${U[nu]} se ${sube ? 'divide entre' : 'multiplica por'} 1024` },
              { c: String(nv), clase: 'num', max: 9, filtro: /[^0-9]/g, n: 2 * p + 1, cmp: (x) => sinSep(x) === String(nv),
                expl: `${miles(v)} ${sube ? '÷' : '×'} 1024 = ${miles(nv)} ${U[nu]}` },
              { d: U[nu], clase: 'peq' }]);
            v = nv; u = nu;
          }
          return {
            enunciado: `Pasa de ${U[i]} a ${U[u]}. Cada paso entre unidades vecinas es multiplicar o dividir por 1024 (2¹⁰).`,
            columnas: '150px 170px 210px 90px', clase: 'compacta',
            filas,
            correcto: `Correcto: ${miles(valor)} ${U[i]} = ${miles(v)} ${U[u]}. Regla: hacia una unidad mayor se divide, hacia una menor se multiplica.`
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
            columnas: '210px 200px 1fr', clase: 'compacta mini',
            filas: [
              [{ lbl: 'carácter' }, { d: ch, clase: 'ancho' }, { d: '' }],
              [{ lbl: 'código base' }, { c: String(r.base), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 0, expl: exBase }, { d: 'A = 65 · a = 97 · 0 = 48', clase: 'peq' }],
              [{ lbl: 'posición' }, { c: String(pos), clase: 'num', max: 2, filtro: /[^0-9]/g, n: 1, expl: exPos }, { d: 'contando desde 0', clase: 'peq' }],
              [{ lbl: 'decimal' }, { c: String(cod), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 2, expl: `${r.base} + ${pos} = ${cod}` }, { d: 'base + posición', clase: 'peq' }],
              [{ lbl: 'binario' }, { c: b8, clase: 'bin', max: 8, filtro: /[^01]/g, n: 3, expl: exBin }, { d: '8 bits', clase: 'peq' }],
              [{ lbl: 'hexadecimal' }, { c: hx, clase: 'hex', max: 2, filtro: /[^0-9a-fA-F]/g, n: 4, expl: exHex }, { d: 'grupos de 4 bits', clase: 'peq' }]
            ],
            correcto: `Correcto: «${ch}» = ${cod} = ${b8} = ${hx} (16.`
          };
        }
        if (modo === 'caracter') {
          return {
            enunciado: 'Del código ASCII al carácter. Primero decide en qué rango cae el número.',
            columnas: '210px 240px 1fr', clase: 'compacta',
            filas: [
              [{ lbl: 'código' }, { d: b8, clase: 'ancho' }, { d: 'binario', clase: 'peq' }],
              [{ lbl: 'decimal' }, { c: String(cod), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 0, expl: `${b8} = ${b8.split('').map((x, i) => x === '1' ? 1 << (7 - i) : 0).filter(Boolean).join(' + ')} = ${cod}` }, { d: 'suma de pesos', clase: 'peq' }],
              [{ lbl: 'rango' }, { sel: RANGOS.map((x) => x.sel), c: r.sel, n: 1, expl: `${cod} está entre ${r.base} y ${r.base + r.n - 1}: ${r.nombre}` }, { d: 'pulsa para cambiar', clase: 'peq' }],
              [{ lbl: 'posición' }, { c: String(pos), clase: 'num', max: 2, filtro: /[^0-9]/g, n: 2, expl: `${cod} − ${r.base} = ${pos}` }, { d: `código − ${r.base}`, clase: 'peq' }],
              [{ lbl: 'carácter' }, { c: ch, max: 1, filtro: filtroChar, n: 3, cmp: (v) => v === ch, expl: `${pos} posiciones después de ${r.primero}: ${ch}` }, { d: r.nombre === 'dígitos' ? '0 1 2 3 4 5 6 7 8 9' : (r.nombre === 'mayúsculas' ? 'A B C D E F G H I J K L M…' : 'a b c d e f g h i j k l m…'), clase: 'peq' }]
            ],
            correcto: `Correcto: ${b8} (${cod}) es el carácter «${ch}».`
          };
        }
        // caso: mayúscula <-> minúscula (solo letras)
        const aMayus = r.base === 97;                 // la letra dada es minúscula: hay que restar 32
        const cod2 = aMayus ? cod - 32 : cod + 32, ch2 = String.fromCharCode(cod2), b2 = bin(cod2, 8);
        return {
          enunciado: `Pasa «${ch}» a ${aMayus ? 'mayúscula' : 'minúscula'}. Las dos letras se diferencian en 32, que es un solo bit.`,
          columnas: '210px 240px 1fr', clase: 'compacta mini',
          filas: [
            [{ lbl: 'carácter' }, { d: ch, clase: 'ancho' }, { d: '' }],
            [{ lbl: 'código' }, { c: String(cod), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 0, expl: exBase + `, y ${ch} está ${pos} después: ${cod}` }, { d: 'A = 65 · a = 97', clase: 'peq' }],
            [{ lbl: 'operación' }, { sel: ['− 32', '+ 32'], c: aMayus ? '− 32' : '+ 32', n: 1, expl: aMayus ? 'La mayúscula está 32 por debajo de la minúscula: se resta 32' : 'La minúscula está 32 por encima de la mayúscula: se suma 32' }, { d: 'pulsa para cambiar', clase: 'peq' }],
            [{ lbl: 'nuevo código' }, { c: String(cod2), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 2, expl: `${cod} ${aMayus ? '−' : '+'} 32 = ${cod2}` }, { d: '' }],
            [{ lbl: 'carácter' }, { c: ch2, max: 1, filtro: filtroChar, n: 3, cmp: (v) => v === ch2, expl: `${cod2} es «${ch2}»` }, { d: aMayus ? 'en mayúscula' : 'en minúscula', clase: 'peq' }],
            [{ lbl: `${ch} en binario` }, { d: b8, clase: 'ancho' }, { d: 'el tercer bit por la izquierda vale 32', clase: 'peq' }],
            [{ lbl: `${ch2} en binario` }, { c: b2, clase: 'bin', max: 8, filtro: /[^01]/g, n: 4, expl: `Solo cambia el bit de peso 32 (el tercero por la izquierda): ${b8} → ${b2}` }, { d: 'solo cambia un bit', clase: 'peq' }]
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
          columnas: '230px 120px 1fr', clase: 'compacta mini',
          filas: [
            [{ lbl: 'número' }, { d: numES(x), clase: 'ancho', span: 2 }],
            [{ lbl: 'signo' }, { c: neg ? '1' : '0', n: 0, expl: neg ? 'Es negativo: el bit de signo vale 1' : 'Es positivo: el bit de signo vale 0' }, { d: '0 positivo · 1 negativo', clase: 'peq' }],
            [{ lbl: 'en binario' }, { c: binTxt, clase: 'bin', max: 16, filtro: /[^01.,]/g, span: 2, n: 1, cmp: (v) => v.replace('.', ',') === binTxt,
              expl: `Parte entera ${ent} = ${ent ? eb : '0'}` + (fb ? `; parte decimal ${numES(frac)} = 0,${fb} (multiplicando por 2)` : '') + ` → ${binTxt}` }],
            [{ lbl: 'exponente' }, { c: String(e), clase: 'num', max: 3, filtro: /[^0-9\-−]/g, n: 2, cmp: (v) => aNum(v) === e,
              expl: `Muevo la coma hasta dejar un solo 1 delante: ${norm}. ` + (e >= 0 ? `La coma se ha movido ${e} posiciones a la izquierda` : `La coma se ha movido ${-e} posiciones a la derecha, así que el exponente es negativo`) }, { d: `${xTxt} = ${norm}`, clase: 'peq' }],
            [{ lbl: 'exponente + 127' }, { c: String(E), clase: 'num', max: 3, filtro: /[^0-9]/g, n: 3, expl: `${e} + 127 = ${E} (el sesgo evita guardar exponentes negativos)` }, { d: 'sesgo 127', clase: 'peq' }],
            [{ lbl: 'exponente 8 bits' }, { c: E8, clase: 'bin', max: 8, filtro: /[^01]/g, n: 4, span: 2, expl: `${E} en binario de 8 bits: ${E8}` }],
            [{ lbl: 'mantisa 23 bits' }, { c: mant23, clase: 'bin', max: 23, filtro: /[^01]/g, n: 5, span: 2, expl: `Lo que queda detrás de la coma en ${norm.split(' ×')[0]} sin el 1 implícito: ${mant || '(nada)'}, y ceros hasta completar 23 bits` }],
            { linea: true },
            [{ lbl: 'hexadecimal' }, { c: hex, clase: 'hex', max: 8, filtro: /[^0-9a-fA-F]/g, n: 6, span: 2, expl: `${bits32.match(/.{4}/g).join(' ')} → ${hex}` }]
          ],
          correcto: `Correcto: ${numES(x)} = ${neg ? '−' : ''}${norm} → ${hex.match(/.{2}/g).join(' ')} en hexadecimal.`
        };
      }
    }
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

    const norm = (v) => String(v || '').trim().replace(/\s+/g, '').replace('.', ',').toUpperCase();
    const valorDe = (c) => (c.tagName === 'BUTTON' ? c._it.sel[+c.dataset.i] : c.value);
    const bien = (c) => { const v = valorDe(c); if (!v) return false; return c._it.cmp ? c._it.cmp(v) : norm(v) === norm(c.dataset.valor); };
    const pon = (c, v) => {
      if (c.tagName === 'BUTTON') { const i = Math.max(0, c._it.sel.indexOf(v)); c.dataset.i = i; c.textContent = c._it.sel[i]; }
      else c.value = v;
    };
    const mensaje = (t, clase) => { fb.textContent = t; fb.className = 'ej-fb' + (clase ? ' ' + clase : ''); };

    function espejos() {
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
      enunciado.textContent = g.enunciado || '';
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

    if (gen.modos) {
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

  /* ---------- quiz de opción múltiple ---------- */
  function montaQuiz(q) {
    const correcta = parseInt(q.dataset.correct, 10);
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
      q.setAttribute('data-answered', '');
      opts[correcta].classList.add('correct');
      if (i !== correcta) o.classList.add('wrong');
      if (fb) fb.textContent = i === correcta ? (q.dataset.ok || 'Correcto.') : (q.dataset.ko || 'Incorrecto.');
    }));
    const r = q.querySelector('.quiz-reset');
    if (r) r.addEventListener('click', reset);
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

  /* ---------- numeración ---------- */
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
    document.querySelectorAll('.quiz').forEach(montaQuiz);
    document.querySelectorAll('.revela').forEach(montaRevela);
    document.querySelectorAll('.galeria').forEach(montaGaleria);
    document.querySelectorAll('.foto').forEach(montaFoto);
    document.querySelectorAll('deck-stage > section').forEach(montaMarcas);
    document.querySelectorAll('.letra').forEach(montaLetra);
    stage.addEventListener('slidechange', (e) => { apagaLetras(e.detail.previousSlide); enciendeLetras(e.detail.slide); });
    // el slidechange inicial se dispara antes de que este script escuche: se enciende la actual a mano
    customElements.whenDefined('deck-stage').then(() => { const secs = stage.querySelectorAll(':scope > section'); enciendeLetras(secs[stage.index || 0]); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
