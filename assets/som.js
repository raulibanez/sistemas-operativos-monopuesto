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
 *  5. Ejercicio generado con números al azar:
 *       <div class="ej" data-tipo="dec2bin"></div>
 *     Tipos disponibles en SOM.generadores (dec2bin, bin2dec, sumabin, restac2).
 *     Cada generador devuelve { dato, unidad, pregunta, respuesta, solucion }.
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

  /* ---------- generadores de ejercicios ---------- */
  SOM.generadores = {

    dec2bin: {
      titulo: 'Convierte a binario',
      generar(cfg) {
        const n = rnd(cfg.min || 16, cfg.max || 255);
        const pasos = [];
        let q = n;
        while (q > 0) {
          pasos.push(`${String(q).padStart(3)} : 2 = ${String(Math.floor(q / 2)).padStart(3)}   resto ${q % 2}`);
          q = Math.floor(q / 2);
        }
        return {
          dato: String(n), unidad: '(10',
          pregunta: 'Escribe el número en binario',
          respuesta: bin(n),
          comprueba: (r) => esBin(r) && parseInt(r, 2) === n,
          solucion:
            'Divisiones sucesivas entre 2 (se lee de abajo arriba):\n' +
            pasos.join('\n') +
            `\n\nResultado: ${agrupa(bin(n))} (2`
        };
      }
    },

    bin2dec: {
      titulo: 'Convierte a decimal',
      generar(cfg) {
        const bits = cfg.bits || 8;
        const n = rnd(1 << (bits - 2), (1 << bits) - 1);
        const b = bin(n, bits);
        const terminos = [];
        for (let i = 0; i < b.length; i++) {
          const peso = b.length - 1 - i;
          if (b[i] === '1') terminos.push(`2^${peso} = ${1 << peso}`);
        }
        return {
          dato: agrupa(b), unidad: '(2',
          pregunta: 'Escribe el número en decimal',
          respuesta: String(n),
          comprueba: (r) => /^\d+$/.test(r) && parseInt(r, 10) === n,
          solucion:
            'Teorema fundamental de la numeración: se suman los pesos de los bits a 1.\n' +
            terminos.join('\n') +
            `\n\nSuma: ${terminos.map((t) => t.split('= ')[1]).join(' + ')} = ${n}`
        };
      }
    },

    sumabin: {
      titulo: 'Suma en binario',
      vertical: true,
      generar(cfg) {
        const bits = cfg.bits || 5;
        const a = rnd(1 << (bits - 2), (1 << bits) - 1);
        const b = rnd(1 << (bits - 2), (1 << bits) - 1);
        const s = a + b;
        const w = bin(s).length;               // columnas del resultado
        const A = bin(a, w), B = bin(b, w), S = bin(s, w);
        // acarreo que ENTRA en cada columna (índice 0 = columna izquierda)
        const entra = new Array(w).fill(0);
        const expl = new Array(w), explC = new Array(w);
        let carry = 0;
        for (let i = w - 1; i >= 0; i--) {
          entra[i] = carry;
          const t = +A[i] + +B[i] + carry;
          const sumandos = [A[i], B[i]].concat(carry ? ['1 que me llevaba'] : []).join(' + ');
          carry = t > 1 ? 1 : 0;
          const col = `Columna ${w - i}: ${sumandos} son ${t}` + (t > 1 ? `, en binario ${bin(t)}` : '');
          expl[i] = col + (t > 1 ? ` → escribo ${t % 2} y me llevo 1` : ` → escribo ${t}`);
          explC[i] = col + (carry ? ' → me llevo 1 a la columna siguiente' : ' → no me llevo nada, acarreo 0');
        }
        return { a, b, s, w, A, B, S, entra, expl, explC };
      }
    },

    restac2: {
      titulo: 'Resta en complemento a 2',
      generar(cfg) {
        const bits = cfg.bits || 8;
        const a = rnd(1 << (bits - 2), (1 << bits) - 1);
        const b = rnd(1, a - 1);
        const A = bin(a, bits), B = bin(b, bits);
        const c1 = B.split('').map((x) => (x === '1' ? '0' : '1')).join('');
        const c2 = bin(parseInt(c1, 2) + 1, bits);
        const suma = a + parseInt(c2, 2);
        const sumaBin = bin(suma, bits + 1);
        const res = bin(a - b, bits);
        return {
          dato: `${agrupa(A)} − ${agrupa(B)}`, unidad: '(2',
          pregunta: `Escribe el resultado en binario con ${bits} bits`,
          respuesta: res,
          comprueba: (r) => esBin(r) && parseInt(r, 2) === a - b,
          solucion:
            `1. Complemento a 1 del sustraendo (invertir bits):\n   ${B}  ->  ${c1}\n` +
            `2. Complemento a 2 = C1 + 1:\n   ${c1} + 1 = ${c2}\n` +
            `3. Sumar el minuendo y el C2:\n     ${A}\n   + ${c2}\n   ${'-'.repeat(bits + 2)}\n    ${sumaBin}\n` +
            `4. Se descarta el bit de acarreo que sobra (el ${bits + 1}.º):\n   ${sumaBin[0]} | ${sumaBin.slice(1)}\n\n` +
            `Resultado: ${agrupa(res)} (2  =  ${a} − ${b} = ${a - b}`
        };
      }
    }
  };


  /* ---------- suma vertical con huecos (como en la pizarra) ---------- */
  function montaSumaVertical(el, gen, cfg) {
    el.innerHTML =
      '<p class="ej-enunciado"></p>' +
      '<div class="sv"></div>' +
      '<div class="ej-fila">' +
      '  <button class="btn btn-primary ej-comprobar">Comprobar</button>' +
      '  <button class="btn btn-ghost ej-pista">Pista</button>' +
      '  <button class="btn btn-ghost ej-resolver">Resolver</button>' +
      '  <button class="btn btn-ghost ej-otro">Otro ejercicio</button>' +
      '  <span class="ej-racha">Aciertos seguidos: <b>0</b></span>' +
      '</div>' +
      '<p class="ej-fb"></p>';
    const $ = (s) => el.querySelector(s);
    const sv = $('.sv'), fb = $('.ej-fb'), racha = $('.ej-racha b'), enunciado = $('.ej-enunciado');
    let g, orden = [], conPista = false, resuelto = false, aciertos = 0;

    const celda = (clase, valor) => {
      const c = document.createElement('input');
      c.className = 'c ' + clase;
      c.maxLength = 1; c.inputMode = 'numeric'; c.autocomplete = 'off';
      c.dataset.valor = valor;
      return c;
    };
    const digito = (d, visible) => {
      const x = document.createElement('span');
      x.className = 'd'; x.textContent = visible ? d : '';
      return x;
    };
    const etiqueta = (t) => { const x = document.createElement('span'); x.className = 'lbl'; x.textContent = t; return x; };

    function nuevo() {
      g = gen.generar(cfg);
      const w = g.w;
      sv.style.setProperty('--w', w);
      sv.innerHTML = '';
      enunciado.textContent = 'Rellena los acarreos y el resultado, columna a columna, empezando por la derecha (las columnas se numeran desde la derecha).';
      // fila de acarreos: casilla sobre cada columna que recibe acarreo (todas menos la última)
      sv.appendChild(etiqueta('me llevo'));
      const carries = [];
      for (let i = 0; i < w; i++) {
        if (i === w - 1) { sv.appendChild(digito('', false)); continue; }
        const c = celda('carry', String(g.entra[i]));
        c.dataset.col = String(i);
        carries[i] = c; sv.appendChild(c);
      }
      // operandos: no se muestran los ceros a la izquierda que sobran
      const la = bin(g.a).length, lb = bin(g.b).length;
      sv.appendChild(etiqueta(''));
      for (let i = 0; i < w; i++) sv.appendChild(digito(g.A[i], i >= w - la));
      sv.appendChild(etiqueta('+'));
      for (let i = 0; i < w; i++) sv.appendChild(digito(g.B[i], i >= w - lb));
      const linea = document.createElement('div'); linea.className = 'linea'; sv.appendChild(linea);
      sv.appendChild(etiqueta('resultado'));
      const res = [];
      for (let i = 0; i < w; i++) { const c = celda('res', g.S[i]); c.dataset.col = String(i); res[i] = c; sv.appendChild(c); }
      // orden de resolución: resultado de la columna y después el acarreo hacia la columna siguiente
      orden = [];
      for (let i = w - 1; i >= 0; i--) { orden.push(res[i]); if (i > 0) orden.push(carries[i - 1]); }
      orden.forEach((c, k) => {
        c.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { comprobar(); return; }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const j = k + (e.key === 'ArrowLeft' ? 1 : -1);
            if (orden[j]) orden[j].focus();
            e.preventDefault();
          }
        });
        c.addEventListener('input', () => {
          c.value = c.value.replace(/[^01]/g, '').slice(-1);
          c.classList.remove('ok', 'ko');
          if (c.value && orden[k + 1]) orden[k + 1].focus();
        });
      });
      conPista = false; resuelto = false;
      fb.textContent = ''; fb.className = 'ej-fb';
      orden[0].focus();
    }

    function comprobar() {
      let mal = 0, vacias = 0;
      orden.forEach((c) => {
        if (!c.value) { vacias++; c.classList.remove('ok'); c.classList.add('ko'); return; }
        const ok = c.value === c.dataset.valor;
        c.classList.toggle('ok', ok); c.classList.toggle('ko', !ok);
        if (!ok) mal++;
      });
      if (mal === 0 && vacias === 0) {
        if (!resuelto && !conPista) { aciertos++; racha.textContent = aciertos; }
        resuelto = true;
        fb.textContent = `Correcto: ${g.a} + ${g.b} = ${g.s}, es decir ${agrupa(g.S)} en binario.`;
        fb.className = 'ej-fb ok';
      } else {
        if (mal) { aciertos = 0; racha.textContent = '0'; }
        fb.textContent = (mal ? `${mal} casilla${mal > 1 ? 's' : ''} mal. ` : '') + (vacias ? `${vacias} sin rellenar.` : '');
        fb.className = 'ej-fb ko';
      }
    }

    function pista() {
      const c = orden.find((x) => x.value !== x.dataset.valor);
      if (!c) { fb.textContent = 'Ya está todo resuelto.'; fb.className = 'ej-fb ok'; return; }
      conPista = true; aciertos = 0; racha.textContent = '0';
      c.value = c.dataset.valor;
      c.classList.remove('ko', 'ok'); c.classList.add('pista');
      // la casilla de acarreo de la columna i se explica con la columna i+1 (la que genera el acarreo)
      fb.textContent = c.classList.contains('carry') ? g.explC[+c.dataset.col + 1] : g.expl[+c.dataset.col];
      fb.className = 'ej-fb';
      const i = orden.indexOf(c);
      if (orden[i + 1]) orden[i + 1].focus();
    }

    function resolver() {
      conPista = true; resuelto = true; aciertos = 0; racha.textContent = '0';
      orden.forEach((c) => { c.value = c.dataset.valor; c.classList.remove('ko'); c.classList.add('ok'); });
      fb.textContent = g.expl.slice().reverse().join('\n');
      fb.className = 'ej-fb';
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
    if (gen.vertical) return montaSumaVertical(el, gen, cfg);

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
    // Que las flechas y el espacio dentro del campo no cambien de diapositiva
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
    v.className = 'visor';
    v.innerHTML = '<img alt=""><div class="visor-pie"></div><button class="visor-cerrar" aria-label="Cerrar">×</button>';
    v.querySelector('img').src = img.currentSrc || img.src;
    v.querySelector('img').alt = img.alt;
    if (cred) v.querySelector('.visor-pie').innerHTML = cred.innerHTML; else v.querySelector('.visor-pie').remove();
    const cierra = () => { v.remove(); document.removeEventListener('keydown', tecla, true); };
    const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cierra(); } };
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
    document.querySelectorAll('.quiz').forEach(montaQuiz);
    document.querySelectorAll('.revela').forEach(montaRevela);
    document.querySelectorAll('.galeria').forEach(montaGaleria);
    document.querySelectorAll('.foto').forEach(montaFoto);
    document.querySelectorAll('deck-stage > section').forEach(montaMarcas);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
