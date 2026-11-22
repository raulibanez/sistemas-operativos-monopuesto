/* Simulador de Linux · intérprete de bash: analizador (árbol sintáctico), expansiones, ejecución y sesión.
 *
 * Gramática (la de bash, recortada; las construcciones compuestas ya se analizan y se ejecutan):
 *   lista     := y_o ((';' | '&' | salto) y_o)*
 *   y_o       := tuberia (('&&' | '||') saltos tuberia)*
 *   tuberia   := ['!'] orden ('|' saltos orden)*
 *   orden     := simple | ( lista ) | { lista } | if | while | until | for | case | función, con redirecciones
 *   simple    := (asignación | palabra | redirección)+
 * Las palabras guardan sus partes (literal, escape, comillas simples y dobles, variable, $( ), $(( ))) y se
 * expanden en el orden de bash: llaves, tilde, parámetros/órdenes/aritmética, partición en campos, comodines y
 * quitar comillas.
 *
 * La ejecución usa generadores: una orden que necesita algo de fuera (leer una línea del teclado, una
 * contraseña, esperar un segundo, abrir un programa a pantalla completa, cargar las páginas de man) hace
 * `yield {tipo: …}` y quien la conduce (la terminal o ejecuta() en las pruebas) le devuelve la respuesta.
 * Ctrl+C se mete como una excepción Interrupcion en el punto donde espera la orden.
 */
(function (raiz) {
  'use strict';
  const SOM = (raiz.SOM = raiz.SOM || {});
  const L = (SOM.linux = SOM.linux || {});
  const U = L.util;

  class Incompleto extends Error { constructor(busca) { super('incompleto'); this.busca = busca; } }
  class ErrorSintaxis extends Error { constructor(token, linea) { super(token); this.token = token; this.linea = linea; } }
  class Interrupcion extends Error { constructor() { super('Ctrl+C'); } }
  class SalidaShell extends Error { constructor(codigo) { super('exit'); this.codigo = codigo; } }
  class ErrorExpansion extends Error { constructor(msg, codigo) { super(msg); this.codigo = codigo === undefined ? 1 : codigo; } }
  class CortaLinea extends Error { constructor(codigo) { super('corta'); this.codigo = codigo; } }

  /* ============================== analizador ============================== */
  const RESERVADAS = new Set(['if', 'then', 'elif', 'else', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', 'case', 'esac', 'function', '{', '}', '!', 'select', 'time', '[[', ']]']);
  const META = ' \t\n|&;()<>';
  const OPS = ['&&', '||', ';;', '|&', '&>>', '&>', '>>', '>&', '<&', '<<<', '<<-', '<<', '<>', '>|', '|', '&', ';', '(', ')', '<', '>'];

  class Analizador {
    /* opc: alias (Map nombre -> valor) para expandir en la posición de orden; script (nombre del archivo, para
     * los mensajes de error con número de línea) */
    constructor(src, opc) {
      this.src = src; this.pos = 0; this.opc = opc || {};
      this.alias = this.opc.alias || null;
      this.mira = null;
      this.aliasUsados = 0;
    }
    linea(p) { let n = 1; for (let i = 0; i < Math.min(p === undefined ? this.pos : p, this.src.length); i++) if (this.src[i] === '\n') n++; return n; }
    error(tok) { throw new ErrorSintaxis(tok, this.linea()); }

    /* ---------- léxico ---------- */
    blancos() {
      for (;;) {
        const c = this.src[this.pos];
        if (c === ' ' || c === '\t') { this.pos++; continue; }
        if (c === '\\' && this.src[this.pos + 1] === '\n') { this.pos += 2; continue; }
        if (c === '#') { while (this.pos < this.src.length && this.src[this.pos] !== '\n') this.pos++; continue; }
        return;
      }
    }
    sig() { const t = this.ver(); this.mira = null; return t; }
    ver() {
      if (this.mira) return this.mira;
      this.blancos();
      const ini = this.pos;
      if (this.pos >= this.src.length) return (this.mira = { t: 'fin', ini });
      const c = this.src[this.pos];
      if (c === '\n') { this.pos++; return (this.mira = { t: 'nl', ini, v: '\n' }); }
      for (const op of OPS) {
        if (this.src.startsWith(op, this.pos)) {
          this.pos += op.length;
          if (/^[<>]|^&>|^<>/.test(op) || op === '>&' || op === '<&') return (this.mira = { t: 'redir', op, fd: null, ini });
          return (this.mira = { t: 'op', v: op, ini });
        }
      }
      const w = this.palabra();
      // número de descriptor pegado a una redirección: 2>, 2>>, 2>&1
      if (w.partes.length === 1 && w.partes[0].t === 'lit' && /^\d+$/.test(w.partes[0].v) && /[<>]/.test(this.src[this.pos] || '')) {
        for (const op of OPS) if (/[<>]/.test(op[0]) && this.src.startsWith(op, this.pos)) { this.pos += op.length; return (this.mira = { t: 'redir', op, fd: +w.partes[0].v, ini }); }
      }
      return (this.mira = Object.assign(w, { t: 'pal', ini, fin: this.pos }));
    }
    // una palabra con sus partes
    palabra() {
      const partes = [];
      let lit = '';
      const suelta = () => { if (lit) { partes.push({ t: 'lit', v: lit }); lit = ''; } };
      const ini = this.pos;
      while (this.pos < this.src.length) {
        const c = this.src[this.pos];
        if (META.includes(c)) break;
        if (c === '\\') {
          const d = this.src[this.pos + 1];
          if (d === undefined) throw new Incompleto('\\');
          if (d === '\n') { this.pos += 2; continue; }
          suelta(); partes.push({ t: 'esc', v: d }); this.pos += 2; continue;
        }
        if (c === "'") {
          const f = this.src.indexOf("'", this.pos + 1);
          if (f < 0) throw new Incompleto("'");
          suelta(); partes.push({ t: 'sq', v: this.src.slice(this.pos + 1, f) }); this.pos = f + 1; continue;
        }
        if (c === '"') { suelta(); this.pos++; partes.push({ t: 'dq', partes: this.dentroComillas() }); continue; }
        if (c === '$') { const p = this.dolar(false); if (p) { suelta(); partes.push(p); continue; } lit += '$'; this.pos++; continue; }
        if (c === '`') { suelta(); partes.push(this.comillaInvertida()); continue; }
        lit += c; this.pos++;
      }
      suelta();
      return { partes, src: this.src.slice(ini, this.pos) };
    }
    dentroComillas() {
      const partes = [];
      let lit = '';
      const suelta = () => { if (lit) { partes.push({ t: 'lit', v: lit }); lit = ''; } };
      for (;;) {
        if (this.pos >= this.src.length) throw new Incompleto('"');
        const c = this.src[this.pos];
        if (c === '"') { this.pos++; break; }
        if (c === '\\') {
          const d = this.src[this.pos + 1];
          if (d === undefined) throw new Incompleto('"');
          if ('$`"\\'.includes(d)) { lit += d; this.pos += 2; continue; }
          if (d === '\n') { this.pos += 2; continue; }
          lit += '\\'; this.pos++; continue;
        }
        if (c === '$') { const p = this.dolar(true); if (p) { suelta(); partes.push(p); continue; } lit += '$'; this.pos++; continue; }
        if (c === '`') { suelta(); partes.push(this.comillaInvertida()); continue; }
        lit += c; this.pos++;
      }
      suelta();
      return partes;
    }
    // busca el cierre de ( … ) o { … } saltando comillas y escapes; devuelve la posición del cierre
    cierre(desde, abre, cierra) {
      let prof = 1, i = desde;
      while (i < this.src.length) {
        const c = this.src[i];
        if (c === '\\') { i += 2; continue; }
        if (c === "'") { const f = this.src.indexOf("'", i + 1); if (f < 0) throw new Incompleto("'"); i = f + 1; continue; }
        if (c === '"') { i++; while (i < this.src.length && this.src[i] !== '"') { if (this.src[i] === '\\') i++; i++; } if (i >= this.src.length) throw new Incompleto('"'); i++; continue; }
        if (c === '`') { const f = this.src.indexOf('`', i + 1); if (f < 0) throw new Incompleto('`'); i = f + 1; continue; }
        if (c === abre) prof++;
        else if (c === cierra) { prof--; if (prof === 0) return i; }
        i++;
      }
      throw new Incompleto(cierra);
    }
    dolar(enComillas) {
      const s = this.src, p = this.pos, n = s[p + 1];
      if (n === '(' && s[p + 2] === '(') {   // $(( aritmética ))
        let prof = 0, i = p + 3;
        for (; i < s.length; i++) {
          if (s[i] === '(') prof++;
          else if (s[i] === ')') { if (prof === 0 && s[i + 1] === ')') break; prof--; }
        }
        if (i >= s.length) throw new Incompleto('))');
        this.pos = i + 2;
        return { t: 'arit', src: s.slice(p + 3, i) };
      }
      if (n === '(') {   // $( orden )
        const f = this.cierre(p + 2, '(', ')');
        const texto = s.slice(p + 2, f);
        this.pos = f + 1;
        return { t: 'sub', src: texto, arbol: new Analizador(texto, { alias: this.alias }).todo() };
      }
      if (n === '{') {
        const f = this.cierre(p + 2, '{', '}');
        const dentro = s.slice(p + 2, f);
        this.pos = f + 1;
        return this.parametro(dentro);
      }
      if (n === "'" && !enComillas) {   // $'…' con escapes de C
        let i = p + 2, v = '';
        for (; i < s.length && s[i] !== "'"; i++) {
          if (s[i] === '\\' && i + 1 < s.length) {
            const e = s[++i];
            v += { n: '\n', t: '\t', a: '\x07', b: '\b', e: '\x1b', E: '\x1b', r: '\r', '\\': '\\', "'": "'", '"': '"', '0': '\0' }[e] ?? ('\\' + e);
          } else v += s[i];
        }
        if (i >= s.length) throw new Incompleto("'");
        this.pos = i + 1;
        return { t: 'sq', v };
      }
      let m = s.slice(p + 1).match(/^([A-Za-z_][A-Za-z0-9_]*|[0-9]|[?$#@*!\-])/);
      if (!m) return null;
      this.pos = p + 1 + m[1].length;
      return { t: 'var', nombre: m[1] };
    }
    parametro(dentro) {
      let m;
      if ((m = dentro.match(/^#([A-Za-z_][A-Za-z0-9_]*|[0-9@*#?])$/))) return { t: 'var', nombre: m[1], largo: true };
      if ((m = dentro.match(/^([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[?$#@*!\-])(?:(:?[-=+?])([\s\S]*)|(##?|%%?)([\s\S]*)|\/(\/?)([^/]*)(?:\/([\s\S]*))?)?$/))) {
        const r = { t: 'var', nombre: m[1] };
        if (m[2]) { r.op = m[2]; r.palabra = this.subpalabra(m[3]); }
        else if (m[4]) { r.op = m[4]; r.patron = this.subpalabra(m[5]); }
        else if (m[7] !== undefined || m[6] !== undefined) { r.op = '/' + (m[6] || ''); r.patron = this.subpalabra(m[7] || ''); r.reemplazo = this.subpalabra(m[8] || ''); }
        return r;
      }
      throw new ErrorExpansion('${' + dentro + '}: sustitución errónea');
    }
    subpalabra(texto) { const a = new Analizador(texto, {}); const partes = []; while (a.pos < texto.length) { const w = a.palabraLibre(); partes.push(...w); } return { partes }; }
    // como palabra() pero sin cortar en los espacios (para ${x:-a b})
    palabraLibre() {
      const salida = [];
      while (this.pos < this.src.length) {
        const c = this.src[this.pos];
        if (META.includes(c)) { salida.push({ t: 'lit', v: c }); this.pos++; continue; }
        const w = this.palabra();
        salida.push(...w.partes);
      }
      return salida;
    }
    comillaInvertida() {
      let i = this.pos + 1, txt = '';
      for (; i < this.src.length && this.src[i] !== '`'; i++) {
        if (this.src[i] === '\\' && '`$\\'.includes(this.src[i + 1])) { txt += this.src[++i]; continue; }
        txt += this.src[i];
      }
      if (i >= this.src.length) throw new Incompleto('`');
      this.pos = i + 1;
      return { t: 'sub', src: txt, arbol: new Analizador(txt, { alias: this.alias }).todo() };
    }

    /* ---------- sintaxis ---------- */
    todo() {
      const l = this.lista(new Set());
      const t = this.ver();
      if (t.t !== 'fin') this.error(textoTok(t));
      return l;
    }
    saltos() { while (this.ver().t === 'nl') this.sig(); }
    esReservada(t, nombres) { return t.t === 'pal' && t.partes.length === 1 && t.partes[0].t === 'lit' && nombres.has(t.partes[0].v); }
    lista(fin) {
      const items = [];
      this.saltos();
      for (;;) {
        const t = this.ver();
        if (t.t === 'fin' || (t.t === 'op' && (t.v === ')' || t.v === ';;')) || this.esReservada(t, fin)) break;
        if (t.t === 'op' && (t.v === ';' || t.v === '&' || t.v === '|' || t.v === '&&' || t.v === '||' || t.v === '|&')) this.error(t.v);
        const ini = t.ini;
        const nodo = this.yo();
        const s = this.ver();
        let sep = null;
        if (s.t === 'op' && (s.v === ';' || s.v === '&')) { this.sig(); sep = s.v; }
        else if (s.t === 'nl') { this.sig(); sep = '\n'; }
        nodo.src = this.src.slice(ini, s.ini).trim();
        nodo.linea = this.linea(ini);
        items.push({ nodo, sep });
        if (!sep) break;
        this.saltos();
      }
      return { tipo: 'lista', items };
    }
    yo() {
      const primero = this.tuberia(), resto = [];
      for (;;) {
        const t = this.ver();
        if (t.t !== 'op' || (t.v !== '&&' && t.v !== '||')) break;
        this.sig(); this.saltos();
        if (this.ver().t === 'fin') throw new Incompleto(t.v);
        resto.push({ op: t.v, nodo: this.tuberia() });
      }
      return { tipo: 'y_o', primero, resto };
    }
    tuberia() {
      let negada = false;
      if (this.esReservada(this.ver(), new Set(['!']))) { this.sig(); negada = true; }
      const ordenes = [];
      const ini = this.ver().ini;
      ordenes.push(this.orden());
      for (;;) {
        const t = this.ver();
        if (t.t !== 'op' || (t.v !== '|' && t.v !== '|&')) break;
        this.sig(); this.saltos();
        if (this.ver().t === 'fin') throw new Incompleto('|');
        if (t.v === '|&') ordenes[ordenes.length - 1].redirs.push({ fd: 2, op: '>&', destino: { partes: [{ t: 'lit', v: '1' }] } });
        ordenes.push(this.orden());
      }
      return { tipo: 'tuberia', negada, ordenes, src: this.src.slice(ini, this.ver().ini).trim() };
    }
    redirs(nodo) {
      nodo.redirs = nodo.redirs || [];
      while (this.ver().t === 'redir') nodo.redirs.push(this.redir());
      return nodo;
    }
    redir() {
      const r = this.sig();
      const d = this.ver();
      if (d.t !== 'pal') { if (d.t === 'fin' || d.t === 'nl') this.error('newline'); this.error(textoTok(d)); }
      this.sig();
      if (r.op === '<<' || r.op === '<<-') return { fd: r.fd, op: r.op, destino: d, documento: true };
      return { fd: r.fd, op: r.op, destino: d };
    }
    orden() {
      const t = this.ver();
      if (t.t === 'op' && t.v === '(') {
        this.sig();
        const l = this.lista(new Set());
        const c = this.ver();
        if (c.t === 'fin') throw new Incompleto(')');
        if (!(c.t === 'op' && c.v === ')')) this.error(textoTok(c));
        this.sig();
        return this.redirs({ tipo: 'subshell', lista: l });
      }
      if (t.t === 'pal' && t.partes.length === 1 && t.partes[0].t === 'lit') {
        const v = t.partes[0].v;
        if (v === '{') { this.sig(); const l = this.cuerpo(['}']); return this.redirs({ tipo: 'grupo', lista: l }); }
        if (v === 'if') return this.redirs(this.si());
        if (v === 'while' || v === 'until') { this.sig(); const cond = this.cuerpo(['do']); const c = this.cuerpo(['done']); return this.redirs({ tipo: 'mientras', hasta: v === 'until', cond, cuerpo: c }); }
        if (v === 'for') return this.redirs(this.para());
        if (v === 'case') return this.redirs(this.caso());
        if (v === 'function') { this.sig(); const n = this.sig(); if (n.t !== 'pal') this.error(textoTok(n)); const m = this.ver(); if (m.t === 'op' && m.v === '(') { this.sig(); const c = this.sig(); if (!(c.t === 'op' && c.v === ')')) this.error(textoTok(c)); } this.saltos(); return { tipo: 'funcion', nombre: n.src, cuerpo: this.orden(), redirs: [] }; }
        if (['then', 'elif', 'else', 'fi', 'do', 'done', 'esac', '}', 'in'].includes(v)) this.error(v);
        // nombre() { … }
        const guarda = this.pos, guardaMira = this.mira;
        if (/^[A-Za-z_][\w.-]*$/.test(v)) {
          this.sig();
          const a = this.ver();
          if (a.t === 'op' && a.v === '(') {
            this.sig();
            const b = this.ver();
            if (b.t === 'op' && b.v === ')') { this.sig(); this.saltos(); if (this.ver().t === 'fin') throw new Incompleto('}'); return { tipo: 'funcion', nombre: v, cuerpo: this.orden(), redirs: [] }; }
            this.error(textoTok(b));
          }
          this.pos = guarda; this.mira = guardaMira;
        }
      }
      return this.simple();
    }
    cuerpo(fin) {
      const l = this.lista(new Set(fin.concat(['then', 'elif', 'else', 'fi', 'do', 'done', 'esac', '}'])));
      const t = this.ver();
      if (t.t === 'fin') throw new Incompleto(fin[0]);
      if (!this.esReservada(t, new Set(fin))) this.error(textoTok(t));
      this.sig();
      return l;
    }
    si() {
      this.sig();
      const ramas = [];
      let sino = null;
      let cond = this.cuerpo(['then']);
      for (;;) {
        const l = this.lista(new Set(['elif', 'else', 'fi']));
        const t = this.ver();
        if (t.t === 'fin') throw new Incompleto('fi');
        ramas.push({ cond, cuerpo: l });
        this.sig();
        const v = t.partes && t.partes[0].v;
        if (v === 'fi') break;
        if (v === 'else') { sino = this.cuerpo(['fi']); break; }
        if (v === 'elif') { cond = this.cuerpo(['then']); continue; }
        this.error(textoTok(t));
      }
      return { tipo: 'si', ramas, sino };
    }
    para() {
      this.sig();
      const n = this.sig();
      if (n.t !== 'pal') this.error(textoTok(n));
      let palabras = null;
      this.saltos();
      if (this.esReservada(this.ver(), new Set(['in']))) {
        this.sig(); palabras = [];
        while (this.ver().t === 'pal') palabras.push(this.sig());
      }
      const s = this.ver();
      if (s.t === 'op' && s.v === ';') this.sig();
      this.saltos();
      if (this.ver().t === 'fin') throw new Incompleto('do');
      if (!this.esReservada(this.ver(), new Set(['do']))) this.error(textoTok(this.ver()));
      this.sig();
      const cuerpo = this.cuerpo(['done']);
      return { tipo: 'para', variable: n.src, palabras, cuerpo };
    }
    caso() {
      this.sig();
      const w = this.sig();
      if (w.t !== 'pal') this.error(textoTok(w));
      this.saltos();
      if (!this.esReservada(this.ver(), new Set(['in']))) { if (this.ver().t === 'fin') throw new Incompleto('in'); this.error(textoTok(this.ver())); }
      this.sig();
      const ramas = [];
      for (;;) {
        this.saltos();
        const t = this.ver();
        if (t.t === 'fin') throw new Incompleto('esac');
        if (this.esReservada(t, new Set(['esac']))) { this.sig(); break; }
        if (t.t === 'op' && t.v === '(') this.sig();
        const patrones = [];
        for (;;) {
          const p = this.sig();
          if (p.t !== 'pal') this.error(textoTok(p));
          patrones.push(p);
          const s = this.sig();
          if (s.t === 'op' && s.v === ')') break;
          if (!(s.t === 'op' && s.v === '|')) this.error(textoTok(s));
        }
        const cuerpo = this.lista(new Set(['esac']));
        const f = this.ver();
        if (f.t === 'op' && f.v === ';;') this.sig();
        ramas.push({ patrones, cuerpo });
      }
      return { tipo: 'caso', palabra: w, ramas };
    }
    simple() {
      const nodo = { tipo: 'simple', asignaciones: [], palabras: [], redirs: [] };
      const ini = this.ver().ini;
      for (;;) {
        const t = this.ver();
        if (t.t === 'redir') { nodo.redirs.push(this.redir()); continue; }
        if (t.t !== 'pal') break;
        if (!nodo.palabras.length) {
          const m = t.src.match(/^([A-Za-z_][A-Za-z0-9_]*)(\+?)=/);
          if (m && t.partes[0].t === 'lit' && t.partes[0].v.startsWith(m[0])) {
            this.sig();
            const partes = t.partes.slice();
            partes[0] = { t: 'lit', v: partes[0].v.slice(m[0].length) };
            if (!partes[0].v) partes.shift();
            nodo.asignaciones.push({ nombre: m[1], suma: !!m[2], valor: { partes } });
            continue;
          }
          // alias: solo en la posición de orden, con la palabra sin comillas
          if (this.alias && t.partes.length === 1 && t.partes[0].t === 'lit' && this.alias.has(t.partes[0].v) && this.aliasUsados < 16 && !(this.usados || (this.usados = new Set())).has(t.partes[0].v)) {
            const v = this.alias.get(t.partes[0].v);
            this.usados.add(t.partes[0].v);
            this.aliasUsados++;
            this.src = this.src.slice(0, t.ini) + v + this.src.slice(t.fin);
            this.pos = t.ini; this.mira = null;
            continue;
          }
        }
        this.sig();
        nodo.palabras.push(t);
      }
      if (!nodo.palabras.length && !nodo.asignaciones.length && !nodo.redirs.length) {
        const t = this.ver();
        if (t.t === 'fin') throw new Incompleto('orden');
        this.error(textoTok(t));
      }
      nodo.src = this.src.slice(ini, this.ver().ini).trim();
      this.usados = null;
      return nodo;
    }
  }
  const textoTok = (t) => (t.t === 'fin' || t.t === 'nl' ? 'newline' : t.t === 'pal' ? t.src : t.t === 'redir' ? t.op : t.v);
  L.analiza = (src, opc) => new Analizador(src, opc).todo();

  /* ============================== patrones (comodines) ============================== */
  // patrón de bash -> expresión regular. activo(i): si el carácter i del patrón es especial (no estaba entre comillas)
  function patronARegex(pat, activo, opc) {
    opc = opc || {};
    let r = '', i = 0;
    const act = activo || (() => true);
    const esc = (c) => c.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    while (i < pat.length) {
      const c = pat[i];
      if (!act(i)) { r += esc(c); i++; continue; }
      if (c === '*') { r += opc.ruta ? '[^/]*' : '[\\s\\S]*'; i++; continue; }
      if (c === '?') { r += opc.ruta ? '[^/]' : '[\\s\\S]'; i++; continue; }
      if (c === '[') {
        let j = i + 1, neg = false;
        if (pat[j] === '!' || pat[j] === '^') { neg = true; j++; }
        let clase = '';
        let k = j;
        if (pat[k] === ']') { clase += '\\]'; k++; }
        let cerrado = false;
        while (k < pat.length) {
          if (pat[k] === ']') { cerrado = true; break; }
          if (pat[k] === '[' && pat[k + 1] === ':') {
            const f = pat.indexOf(':]', k + 2);
            if (f > 0) {
              const nom = pat.slice(k + 2, f);
              clase += { digit: '0-9', alpha: 'A-Za-zÀ-ÿ', alnum: '0-9A-Za-zÀ-ÿ', upper: 'A-ZÀ-Þ', lower: 'a-zß-ÿ', space: '\\s', punct: '!-\\/:-@\\[-`{-~' }[nom] || '';
              k = f + 2; continue;
            }
          }
          const ch = pat[k];
          clase += ch === '\\' || ch === ']' || ch === '^' ? '\\' + ch : ch === '-' ? '-' : esc(ch).replace(/^\\(?=[.*+?$(){}|\/])/, '\\');
          k++;
        }
        if (!cerrado) { r += '\\['; i++; continue; }
        r += '[' + (neg ? '^' : '') + clase + ']';
        i = k + 1; continue;
      }
      if (c === '\\' && i + 1 < pat.length) { r += esc(pat[i + 1]); i += 2; continue; }
      r += esc(c); i++;
    }
    return r;
  }
  function casaPatron(pat, texto, opc) {
    try { return new RegExp('^' + patronARegex(pat, null, opc) + '$', opc && opc.mayus ? 'i' : '').test(texto); } catch (e) { return pat === texto; }
  }
  L.casaPatron = casaPatron;
  L.patronARegex = patronARegex;

  /* ============================== aritmética $(( )) ============================== */
  function aritmetica(expr, sh) {
    const toks = [];
    const re = /\s*(?:(0[xX][0-9a-fA-F]+|\d+#[0-9a-zA-Z@_]+|\d+)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*=|<<=|>>=|&&|\|\||\+\+|--|\*\*|<<|>>|<=|>=|==|!=|[-+*\/%&|^]=|[-+*\/%<>&|^!~?:=(),]))/y;
    let p = 0;
    const src = expr;
    while (p < src.length) {
      re.lastIndex = p;
      if (/^\s*$/.test(src.slice(p))) break;
      const m = re.exec(src);
      if (!m) throw new ErrorExpansion(`${src.trim()}: error sintáctico: se esperaba un operando (el elemento de error es "${src.slice(p).trim()}")`);
      const ini = m.index + m[0].length - (m[1] || m[2] || m[3]).length;
      if (m[1]) toks.push({ t: 'n', v: m[1], ini }); else if (m[2]) toks.push({ t: 'id', v: m[2], ini }); else toks.push({ t: 'op', v: m[3], ini });
      p = re.lastIndex;
    }
    let i = 0;
    const resto = (k) => (k < toks.length ? src.slice(toks[k].ini).trim() : (toks.length ? src.slice(toks[toks.length - 1].ini).trim() : ''));
    const falla = (msg, k) => { throw new ErrorExpansion(`${src.trim()}: ${msg} (el elemento de error es "${resto(k === undefined ? i : k)}")`); };
    const ver = () => toks[i];
    const es = (v) => toks[i] && toks[i].t === 'op' && toks[i].v === v;
    const num = (s) => {
      if (/^0[xX]/.test(s)) return parseInt(s, 16);
      if (/#/.test(s)) { const [b, d] = s.split('#'); return parseInt(d, +b); }
      if (/^0\d/.test(s)) return parseInt(s, 8);
      return parseInt(s, 10);
    };
    const leeVar = (n) => { const v = sh.valor(n); if (v === undefined || v === '') return 0; if (/^-?\d+$/.test(v.trim())) return parseInt(v, 10); try { return aritmetica(v, sh); } catch (e) { return 0; } };
    const t32 = (x) => (Number.isFinite(x) ? Math.trunc(x) : 0);
    // precedencias de bash (de menor a mayor)
    function asig() {
      const t = ver();
      if (t && t.t === 'id' && toks[i + 1] && toks[i + 1].t === 'op' && /^([-+*\/%&|^]|<<|>>|\*\*)?=$/.test(toks[i + 1].v) && toks[i + 1].v !== '==') {
        i += 2;
        const op = toks[i - 1].v;
        let v = asig();
        if (op !== '=') v = binaria(op.slice(0, -1), leeVar(t.v), v, i);
        sh.asigna(t.v, String(v));
        return v;
      }
      return cond();
    }
    function cond() {
      const c = oLog();
      if (es('?')) { i++; const a = asig(); if (!es(':')) falla('error sintáctico en la expresión'); i++; const b = cond(); return c ? a : b; }
      return c;
    }
    const nivel = (ops, sigF) => () => { let a = sigF(); while (ver() && ver().t === 'op' && ops.includes(ver().v)) { const op = ver().v; const k = ++i; const b = sigF(); a = binaria(op, a, b, k); } return a; };
    function binaria(op, a, b, k) {
      switch (op) {
        case '+': return t32(a + b); case '-': return t32(a - b); case '*': return t32(a * b);
        case '/': if (b === 0) falla('división por 0', k); return t32(a / b);
        case '%': if (b === 0) falla('división por 0', k); return t32(a % b);
        case '**': if (b < 0) falla('exponente menor que 0', k); return t32(Math.pow(a, b));
        case '<<': return a << b; case '>>': return a >> b;
        case '<': return +(a < b); case '>': return +(a > b); case '<=': return +(a <= b); case '>=': return +(a >= b);
        case '==': return +(a === b); case '!=': return +(a !== b);
        case '&': return a & b; case '^': return a ^ b; case '|': return a | b;
        case '&&': return +(a !== 0 && b !== 0); case '||': return +(a !== 0 || b !== 0);
      }
      return 0;
    }
    function potencia() { const a = unaria(); if (es('**')) { const k = ++i; const b = potencia(); return binaria('**', a, b, k); } return a; }
    function unaria() {
      const t = ver();
      if (!t) falla('error sintáctico: se esperaba un operando', i);
      if (t.t === 'op' && ['-', '+', '!', '~'].includes(t.v)) { i++; const v = unaria(); return t.v === '-' ? -v : t.v === '+' ? v : t.v === '!' ? +(v === 0) : ~v; }
      if (t.t === 'op' && (t.v === '++' || t.v === '--')) { i++; const n = ver(); if (!n || n.t !== 'id') falla('error sintáctico: se esperaba un operando'); i++; const v = leeVar(n.v) + (t.v === '++' ? 1 : -1); sh.asigna(n.v, String(v)); return v; }
      return sufijo();
    }
    function sufijo() {
      const t = ver();
      if (t.t === 'id' && toks[i + 1] && toks[i + 1].t === 'op' && (toks[i + 1].v === '++' || toks[i + 1].v === '--')) { i += 2; const v = leeVar(t.v); sh.asigna(t.v, String(v + (toks[i - 1].v === '++' ? 1 : -1))); return v; }
      return primario();
    }
    function primario() {
      const t = ver();
      if (!t) falla('error sintáctico: se esperaba un operando', i);
      if (t.t === 'n') { i++; const v = num(t.v); if (Number.isNaN(v)) falla('valor demasiado grande para la base', i - 1); return v; }
      if (t.t === 'id') { i++; return leeVar(t.v); }
      if (es('(')) { i++; const v = coma(); if (!es(')')) falla('falta un `)\'', i); i++; return v; }
      falla('error sintáctico: se esperaba un operando', i);
    }
    const mult = nivel(['*', '/', '%'], potencia), sum = nivel(['+', '-'], mult), despl = nivel(['<<', '>>'], sum);
    const rel = nivel(['<', '>', '<=', '>='], despl), igual = nivel(['==', '!='], rel), yBit = nivel(['&'], igual), xBit = nivel(['^'], yBit), oBit = nivel(['|'], xBit);
    const yLog = nivel(['&&'], oBit), oLog = nivel(['||'], yLog);
    function coma() { let v = asig(); while (es(',')) { i++; v = asig(); } return v; }
    if (!toks.length) return 0;
    const v = coma();
    if (i < toks.length) falla('error sintáctico en la expresión', i);
    return v;
  }
  L.aritmetica = aritmetica;

  /* ============================== sesión de bash ============================== */
  const PS1_UBUNTU = '\\[\\e]0;${debian_chroot:+($debian_chroot)}\\u@\\h: \\w\\a\\]${debian_chroot:+($debian_chroot)}\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ';
  const ALIAS_UBUNTU = [['alert', 'notify-send --urgency=low -i "$([ $? = 0 ] && echo terminal || echo error)" "$(history|tail -n1|sed -e \'\\\'\'s/^\\s*[0-9]\\+\\s*//;s/[;&|]\\s*alert$//\'\\\'\')"'],
    ['egrep', 'egrep --color=auto'], ['fgrep', 'fgrep --color=auto'], ['grep', 'grep --color=auto'], ['l', 'ls -CF'], ['la', 'ls -A'], ['ll', 'ls -alF'], ['ls', 'ls --color=auto']];

  class Sesion {
    /* opc: usuario (el del escenario), cwd, interactiva (true: alias, historial, command-not-found y mensajes
     * sin «línea 1»), columnas y lineas de la terminal, padre (para subshells y sudo) */
    constructor(sis, opc) {
      this.sis = sis;
      opc = opc || {};
      const usuario = opc.usuario || sis.esc.usuario;
      const u = sis.usuario(usuario);
      this.usuario = u.nombre; this.uid = u.uid; this.gid = u.gid;
      this.grupos = sis.gruposDe(u.nombre).map((g) => g.gid);
      this.interactiva = opc.interactiva !== false;
      this.sinTty = !!opc.sinTty;   // como bash -c sin terminal (para comparar con la máquina real)
      this.columnas = opc.columnas || 80; this.lineas = opc.lineas || 24;
      this.vars = new Map();
      this.alias = new Map();
      this.funciones = new Map();
      this.hist = (sis.historialInicial || []).slice();
      this.histBase = 0;
      this.ultimo = 0;
      this.pid = opc.pid || sis.pidBash;
      this.posicionales = [];
      this.nombreScript = 'bash';
      this.sudoHasta = -1;
      this.eventos = [];
      if (opc.copia) return;
      const home = u.home;
      const env = {
        SHELL: '/bin/bash', SESSION_MANAGER: 'local/' + sis.esc.equipo + ':@/tmp/.ICE-unix/1518,unix/' + sis.esc.equipo + ':/tmp/.ICE-unix/1518', QT_ACCESSIBILITY: '1',
        COLORTERM: 'truecolor', XDG_CONFIG_DIRS: '/etc/xdg/xdg-ubuntu:/etc/xdg', XDG_MENU_PREFIX: 'gnome-', GNOME_DESKTOP_SESSION_ID: 'this-is-deprecated',
        LANGUAGE: 'es_ES:es', LC_ADDRESS: 'es_ES.UTF-8', LC_NAME: 'es_ES.UTF-8', LC_MONETARY: 'es_ES.UTF-8', LC_PAPER: 'es_ES.UTF-8',
        LC_IDENTIFICATION: 'es_ES.UTF-8', LC_TELEPHONE: 'es_ES.UTF-8', LC_MEASUREMENT: 'es_ES.UTF-8', LC_TIME: 'es_ES.UTF-8', LC_NUMERIC: 'es_ES.UTF-8',
        XDG_SESSION_DESKTOP: 'ubuntu', XDG_SESSION_TYPE: 'wayland', GDMSESSION: 'ubuntu', DESKTOP_SESSION: 'ubuntu', XDG_SESSION_CLASS: 'user',
        GNOME_TERMINAL_SCREEN: '/org/gnome/Terminal/screen/7a4c6e1b_2f3d_4a8b_9c5e_1d2f3a4b5c6d', GNOME_TERMINAL_SERVICE: ':1.120',
        TERM: 'xterm-256color', USER: u.nombre, VTE_VERSION: '7600', XDG_CURRENT_DESKTOP: 'ubuntu:GNOME', GTK_MODULES: 'gail:atk-bridge',
        PWD: home, HOME: home, LOGNAME: u.nombre, XDG_SESSION_ID: '2', XDG_DATA_DIRS: '/usr/share/ubuntu:/usr/share/gnome:/usr/local/share/:/usr/share/:/var/lib/snapd/desktop',
        LANG: 'es_ES.UTF-8', LS_COLORS: (L.datos && L.datos.lsColors) || '', XDG_RUNTIME_DIR: '/run/user/' + u.uid,
        WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0', SHLVL: '1', DBUS_SESSION_BUS_ADDRESS: 'unix:path=/run/user/' + u.uid + '/bus',
        LESSOPEN: '| /usr/bin/lesspipe %s', LESSCLOSE: '/usr/bin/lesspipe %s %s',
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin:/snap/bin',
        OLDPWD: undefined, _: '/usr/bin/env'
      };
      Object.keys(env).forEach((k) => { if (env[k] !== undefined) this.vars.set(k, { v: env[k], exp: true }); });
      [['HISTCONTROL', 'ignoreboth'], ['HISTSIZE', '1000'], ['HISTFILESIZE', '2000'], ['PS1', PS1_UBUNTU], ['PS2', '> '], ['PS4', '+ '], ['IFS', ' \t\n'],
        ['BASH', '/usr/bin/bash'], ['BASH_VERSION', '5.2.21(1)-release'], ['HOSTNAME', sis.esc.equipo], ['HOSTTYPE', 'x86_64'], ['OSTYPE', 'linux-gnu'],
        ['MACHTYPE', 'x86_64-pc-linux-gnu'], ['UID', String(u.uid)], ['EUID', String(u.uid)], ['PPID', '2103'], ['COLUMNS', String(this.columnas)], ['LINES', String(this.lineas)]]
        .forEach(([k, v]) => this.vars.set(k, { v, exp: false }));
      if (this.interactiva) ALIAS_UBUNTU.forEach(([k, v]) => this.alias.set(k, v));
      const cwd = opc.cwd ? sis.expandeTilde(opc.cwd) : (sis.esc.cwd ? sis.expandeTilde(sis.esc.cwd) : home);
      this.ponCwd(cwd);
    }
    cred() { return { uid: this.uid, gid: this.gid, grupos: this.grupos }; }
    ponCwd(ruta) {
      try {
        const r = this.sis.fs.resuelve(ruta, { uid: 0, gid: 0 });
        this.cwdIno = r.ino.n; this.pwd = ruta;
      } catch (e) { this.cwdIno = this.sis.fs.raiz; this.pwd = '/'; }
      this.vars.set('PWD', { v: this.pwd, exp: true });
    }
    // copia para un subshell ( … ) o $( … ): variables, alias y carpeta propios
    copia() {
      const c = new Sesion(this.sis, { copia: true, usuario: this.usuario, columnas: this.columnas, lineas: this.lineas, interactiva: false, pid: this.pid });
      c.vars = new Map([...this.vars].map(([k, v]) => [k, Object.assign({}, v)]));
      c.alias = new Map(this.alias); c.funciones = new Map(this.funciones);
      c.hist = this.hist; c.histBase = this.histBase;
      c.uid = this.uid; c.gid = this.gid; c.grupos = this.grupos.slice(); c.usuario = this.usuario;
      c.cwdIno = this.cwdIno; c.pwd = this.pwd; c.ultimo = this.ultimo; c.posicionales = this.posicionales.slice();
      c.nombreScript = this.nombreScript; c.sudoHasta = this.sudoHasta; c.emite = this.emite; c.esSub = true; c.sinTty = this.sinTty; c.mascara = this.mascara;
      c.interactivaPadre = this.interactiva || this.interactivaPadre;
      return c;
    }
    valor(nombre) {
      switch (nombre) {
        case '?': return String(this.ultimo);
        case '$': return String(this.pid);
        case '#': return String(this.posicionales.length);
        case '0': return this.nombreScript;
        case '@': case '*': return this.posicionales.join(' ');
        case '!': return this.ultimoFondo !== undefined ? String(this.ultimoFondo) : '';
        case '-': return this.interactiva ? 'himBHs' : 'hB';
        case 'RANDOM': return String(Math.floor(Math.random() * 32768));
        case 'SECONDS': return String(Math.floor((this.sis.ahora() - (this.inicio || this.sis.ahora())) / 1000));
        case 'PWD': return this.pwd;
      }
      if (/^\d+$/.test(nombre)) return this.posicionales[+nombre - 1];
      const v = this.vars.get(nombre);
      return v ? v.v : undefined;
    }
    asigna(nombre, valor, exportar) {
      const v = this.vars.get(nombre);
      if (v) { v.v = valor; if (exportar) v.exp = true; }
      else this.vars.set(nombre, { v: valor, exp: !!exportar });
      if (nombre === 'PWD') this.pwd = valor;
    }
    entorno(extra) {
      const e = {};
      this.vars.forEach((v, k) => { if (v.exp && v.v !== undefined) e[k] = v.v; });
      Object.keys(extra || {}).forEach((k) => { if (extra[k] === null) delete e[k]; else e[k] = extra[k]; });
      return e;
    }
    emiteEv(tipo, texto) { if (!texto) return; (this.emite || ((t, x) => this.eventos.push({ tipo: t, texto: x })))(tipo, texto); }

    /* ---------- prompt ---------- */
    prompt(cual) {
      const ps = this.valor(cual || 'PS1') || '';
      const home = this.valor('HOME') || '';
      const w = this.pwd === home ? '~' : (home && home !== '/' && this.pwd.startsWith(home + '/') ? '~' + this.pwd.slice(home.length) : this.pwd);
      const t = U.partes(this.sis.ahora());
      let s = ps.replace(/\\(\[|\]|u|h|H|w|W|\$|e|a|n|\\|d|t|T|@|A|s|v|V|#|!|j|l|0\d\d|\d\d\d)/g, (m, c) => {
        switch (c) {
          case '[': case ']': return '';
          case 'u': return this.usuario;
          case 'h': return this.sis.esc.equipo.split('.')[0];
          case 'H': return this.sis.esc.equipo;
          case 'w': return w;
          case 'W': return w === '/' ? '/' : w.split('/').pop() || '/';
          case '$': return this.uid === 0 ? '#' : '$';
          case 'e': return '\x1b';
          case 'a': return '\x07';
          case 'n': return '\n';
          case '\\': return '\\';
          case 'd': return U.strftime('%a %b %d', this.sis.ahora());
          case 't': return U.strftime('%H:%M:%S', this.sis.ahora());
          case 'T': return U.strftime('%I:%M:%S', this.sis.ahora());
          case '@': return U.strftime('%I:%M %p', this.sis.ahora());
          case 'A': return String(t.h).padStart(2, '0') + ':' + String(t.mi).padStart(2, '0');
          case 's': return 'bash';
          case 'v': return '5.2';
          case 'V': return '5.2.21';
          case '#': return String(this.hist.length + 1);
          case '!': return String(this.histBase + this.hist.length + 1);
          case 'j': return '0';
          case 'l': return 'pts/0';
          default: return String.fromCharCode(parseInt(c, 8));
        }
      });
      // promptvars: expansión de ${…} y $VAR en el resultado
      s = s.replace(/\$\{([A-Za-z_]\w*)(:?[-+])([^}]*)\}|\$([A-Za-z_]\w*)/g, (m, n, op, pal, n2) => {
        if (n2) return this.valor(n2) || '';
        const v = this.valor(n);
        const vacio = v === undefined || (op[0] === ':' && v === '');
        if (op.endsWith('+')) return vacio ? '' : pal.replace(/\$([A-Za-z_]\w*)/g, (x, y) => this.valor(y) || '');
        return vacio ? pal : v;
      });
      return s;
    }

    /* ---------- historial ---------- */
    expandeHistorial(linea) {
      if (!this.interactiva || !linea.includes('!')) return { linea, cambia: false };
      let salida = '', cambia = false, enSimple = false;
      for (let i = 0; i < linea.length; i++) {
        const c = linea[i];
        if (c === "'" ) enSimple = !enSimple;
        if (c === '\\' && linea[i + 1] === '!') { salida += '\\!'; i++; continue; }
        if (c !== '!' || enSimple) { salida += c; continue; }
        const resto = linea.slice(i + 1);
        let m, ev = null, largo = 0;
        if (resto[0] === '!') { ev = this.hist.length - 1; largo = 1; }
        else if ((m = resto.match(/^-(\d+)/))) { ev = this.hist.length - +m[1]; largo = m[0].length; }
        else if ((m = resto.match(/^(\d+)/))) { ev = +m[1] - this.histBase - 1; largo = m[0].length; }
        else if (resto[0] === '$') {
          const prev = this.hist[this.hist.length - 1];
          if (prev === undefined) throw new ErrorExpansion('!$: event not found');
          const palabras = prev.trim().split(/\s+/);
          salida += palabras[palabras.length - 1]; i += 1; cambia = true; continue;
        }
        else if ((m = resto.match(/^([^\s!=(;&|<>"'][^\s;&|<>"']*)/))) {
          for (let k = this.hist.length - 1; k >= 0; k--) if (this.hist[k].startsWith(m[1])) { ev = k; break; }
          if (ev === null) throw new ErrorExpansion('!' + m[1] + ': event not found');
          largo = m[1].length;
        } else { salida += c; continue; }
        if (ev === null || ev < 0 || ev >= this.hist.length) throw new ErrorExpansion('!' + resto.slice(0, largo) + ': event not found');
        salida += this.hist[ev]; i += largo; cambia = true;
      }
      return { linea: salida, cambia };
    }
    guardaHistorial(linea) {
      if (!this.interactiva || !linea.trim()) return;
      const hc = this.valor('HISTCONTROL') || '';
      if (/ignorespace|ignoreboth/.test(hc) && /^\s/.test(linea)) return;
      if (/ignoredups|ignoreboth/.test(hc) && this.hist[this.hist.length - 1] === linea) return;
      this.hist.push(linea.replace(/\n$/, ''));
      const max = +this.valor('HISTSIZE') || 1000;
      while (this.hist.length > max) { this.hist.shift(); this.histBase++; }
    }

    /* ---------- ejecución de una línea (generador) ---------- */
    *ejecutaTexto(texto, opc) {
      opc = opc || {};
      if (!this.interactiva && !opc.script) return yield* this.ejecutaEn(texto, this.ioTerminal(), { script: 'bash: -c' });
      let arbol;
      try { arbol = new Analizador(texto, { alias: this.interactiva || opc.alias ? this.alias : null }).todo(); }
      catch (e) {
        if (e instanceof Incompleto) {
          if (opc.script) { this.emiteEv('err', `${opc.script}: línea ${contarLineas(texto)}: ${e.busca === '"' || e.busca === "'" || e.busca === '`' ? `EOF inesperado mientras se buscaba un «${e.busca}» coincidente` : 'error sintáctico: no se esperaba el final del archivo'}\n`); return 2; }
          throw e;
        }
        if (e instanceof ErrorSintaxis) {
          if (opc.script) { this.emiteEv('err', `${opc.script}: línea ${e.linea}: error de sintaxis cerca del elemento inesperado \`${e.token}'\n${opc.script}: línea ${e.linea}: \`${texto.split('\n')[e.linea - 1].trim()}'\n`); return 2; }
          this.emiteEv('err', `bash: error de sintaxis cerca del elemento inesperado \`${e.token}'\n`);
          this.ultimo = 2;
          return 2;
        }
        if (e instanceof ErrorExpansion) { this.emiteEv('err', 'bash: ' + e.message + '\n'); this.ultimo = 1; return 1; }
        throw e;
      }
      return yield* this.ejLista(arbol, this.ioTerminal(), opc);
    }
    ioTerminal() { return { fd: { 0: { tipo: 'term' }, 1: { tipo: 'term', canal: 'out' }, 2: { tipo: 'term', canal: 'err' } } }; }
    // ejecuta un texto (guion o bash -c) con la entrada y salida dadas; los errores de sintaxis llevan el
    // nombre del guion y el número de línea, como bash
    *ejecutaEn(texto, io, opc) {
      opc = opc || {};
      const nombre = opc.script || 'bash';
      let arbol;
      try { arbol = new Analizador(texto, { alias: null }).todo(); }
      catch (e) {
        if (e instanceof Incompleto) {
          const comillas = ['"', "'", '`'].includes(e.busca);
          const ln = comillas ? texto.slice(0, texto.lastIndexOf(e.busca) + 1).split('\n').length : texto.replace(/\n$/, '').split('\n').length + 1;
          this.escribe(io.fd[2], comillas ? `${nombre}: línea ${ln}: EOF inesperado mientras se buscaba un «${e.busca}» coincidente\n` : `${nombre}: línea ${ln}: error sintáctico: no se esperaba el final del archivo\n`);
          return 2;
        }
        if (e instanceof ErrorSintaxis) {
          this.escribe(io.fd[2], `${nombre}: línea ${e.linea}: error de sintaxis cerca del elemento inesperado \`${e.token}'\n${nombre}: línea ${e.linea}: \`${(texto.split('\n')[e.linea - 1] || '').trim()}'\n`);
          return 2;
        }
        if (e instanceof ErrorExpansion) { this.escribe(io.fd[2], `${nombre}: ${e.message}\n`); return 1; }
        throw e;
      }
      return yield* this.ejLista(arbol, io, opc);
    }
    *ejLista(nodo, io, opc) {
      let c = this.ultimo;
      for (const it of nodo.items) {
        if (it.sep === '&') this.emiteEv('aviso', 'El simulador todavía no ejecuta órdenes en segundo plano: «' + it.nodo.src + '» se ejecuta en primer plano.');
        if (it.nodo.linea) this.lineaActual = it.nodo.linea;
        c = yield* this.ejYO(it.nodo, io, opc);
        this.ultimo = c;
      }
      return c;
    }
    *ejYO(n, io, opc) {
      let c = yield* this.ejTuberia(n.primero, io, opc);
      for (const r of n.resto) {
        if ((r.op === '&&' && c === 0) || (r.op === '||' && c !== 0)) c = yield* this.ejTuberia(r.nodo, io, opc);
      }
      return c;
    }
    *ejTuberia(n, io, opc) {
      let c;
      const traza = { orden: n.src, tramos: [] };
      if (n.ordenes.length === 1) {
        const o = n.ordenes[0];
        const buf = { tipo: 'copia', destino: io.fd[1], partes: [] };
        const bufE = { tipo: 'copia', destino: io.fd[2], partes: [] };
        c = yield* this.ejOrden(o, { fd: Object.assign({}, io.fd, { 1: buf, 2: bufE }) }, opc);
        traza.tramos.push({ orden: o.src || '', salida: buf.partes.join(''), errores: bufE.partes.join(''), codigo: c });
      } else {
        let entrada = io.fd[0];
        for (let k = 0; k < n.ordenes.length; k++) {
          const o = n.ordenes[k], ultimo = k === n.ordenes.length - 1;
          const salida = ultimo ? { tipo: 'copia', destino: io.fd[1], partes: [] } : { tipo: 'buf', partes: [] };
          const err = { tipo: 'copia', destino: io.fd[2], partes: [] };
          c = yield* this.ejOrden(o, { fd: Object.assign({}, io.fd, { 0: entrada, 1: salida, 2: err }), enTuberia: true }, opc);
          const texto = salida.partes.join('');
          traza.tramos.push({ orden: o.src || '', salida: texto, errores: err.partes.join(''), codigo: c });
          entrada = { tipo: 'texto', texto, pos: 0 };
        }
      }
      if (n.negada) c = c === 0 ? 1 : 0;
      if (this.trazas && !this.esSub) this.trazas.push(traza);
      this.ultimo = c;
      return c;
    }
    *ejOrden(n, io, opc) {
      switch (n.tipo) {
        case 'simple': return yield* this.ejSimple(n, io, opc);
        case 'subshell': {
          const sub = this.copia();
          const io2 = yield* this.abreRedirs(n.redirs, io);
          if (!io2) return 1;
          try { return yield* sub.ejLista(n.lista, io2, opc); } catch (e) { if (e instanceof SalidaShell) return e.codigo; throw e; }
        }
        case 'grupo': { const io2 = yield* this.abreRedirs(n.redirs, io); if (!io2) return 1; return yield* this.ejLista(n.lista, io2, opc); }
        case 'si': {
          const io2 = yield* this.abreRedirs(n.redirs, io); if (!io2) return 1;
          for (const r of n.ramas) { const c = yield* this.ejLista(r.cond, io2, opc); if (c === 0) return yield* this.ejLista(r.cuerpo, io2, opc); }
          return n.sino ? yield* this.ejLista(n.sino, io2, opc) : 0;
        }
        case 'mientras': {
          const io2 = yield* this.abreRedirs(n.redirs, io); if (!io2) return 1;
          let c = 0, vueltas = 0;
          for (;;) {
            const k = yield* this.ejLista(n.cond, io2, opc);
            if ((k === 0) === n.hasta) break;
            c = yield* this.ejLista(n.cuerpo, io2, opc);
            if (++vueltas > 10000) { this.emiteEv('aviso', 'El simulador corta el bucle tras 10 000 vueltas.'); break; }
            if (vueltas % 50 === 0) yield { tipo: 'respira' };
          }
          return c;
        }
        case 'para': {
          const io2 = yield* this.abreRedirs(n.redirs, io); if (!io2) return 1;
          let lista;
          if (n.palabras) { lista = []; for (const p of n.palabras) lista.push(...(yield* this.expande(p))); }
          else lista = this.posicionales.slice();
          let c = 0;
          for (const v of lista) { this.asigna(n.variable, v); c = yield* this.ejLista(n.cuerpo, io2, opc); }
          return c;
        }
        case 'caso': {
          const io2 = yield* this.abreRedirs(n.redirs, io); if (!io2) return 1;
          const w = (yield* this.expandeTexto(n.palabra));
          for (const r of n.ramas) {
            for (const p of r.patrones) {
              const pat = yield* this.expandePatron(p);
              if (casaPatron(pat.texto, w)) return yield* this.ejLista(r.cuerpo, io2, opc);
            }
          }
          return 0;
        }
        case 'funcion': this.funciones.set(n.nombre, n.cuerpo); return 0;
      }
      return 0;
    }

    /* ---------- orden simple ---------- */
    *ejSimple(n, io, opc) {
      let argv = [];
      const asign = [];
      try {
        this.ultimoSub = null;
        for (const p of n.palabras) argv.push(...(yield* this.expande(p)));
        for (const a of n.asignaciones) asign.push([a.nombre, (a.suma ? (this.valor(a.nombre) || '') : '') + (yield* this.expandeTexto(a.valor, { tildeTrasDosPuntos: true }))]);
      } catch (e) {
        if (e instanceof ErrorExpansion) { this.escribe(io.fd[2], this.prefijo() + e.message + '\n'); this.ultimo = e.codigo; if (this.esSub && !this.esGuion) return e.codigo; throw new CortaLinea(e.codigo); }
        throw e;
      }
      const io2 = yield* this.abreRedirs(n.redirs, io);
      if (!io2) return 1;
      if (!argv.length) {
        asign.forEach(([k, v]) => this.asigna(k, v));
        return this.ultimoSub !== null ? this.ultimoSub : 0;
      }
      const nombre = argv[0];
      if (this.funciones.has(nombre)) {
        const guarda = this.posicionales;
        this.posicionales = argv.slice(1);
        try { return yield* this.ejOrden(this.funciones.get(nombre), io2, opc); }
        finally { this.posicionales = guarda; }
      }
      const interna = L.internas[nombre];
      // desde bash 4.4, las internas aceptan --help y escriben lo mismo que help (CHECK_HELPOPT en el código de bash;
      // salen con 2); echo, true, false, :, test y [ no lo miran. No comparado con la máquina de clase.
      if (interna && argv[1] === '--help' && L.internas.help && !['echo', 'true', 'false', ':', 'test', '['].includes(nombre)) {
        yield* this.lanza(L.internas.help, 'help', ['help', nombre], io2, {}, true);
        return 2;
      }
      if (interna) {
        asign.forEach(([k, v]) => this.asigna(k, v));
        return yield* this.lanza(interna, nombre, argv, io2, {}, true);
      }
      return yield* this.ejecutaPrograma(nombre, argv, io2, Object.fromEntries(asign));
    }
    prefijo() { return this.nombreScriptActual ? this.nombreScriptActual + ': línea ' + (this.lineaActual || 1) + ': ' : 'bash: '; }
    // busca la orden en el PATH (o la ruta si lleva /) y la ejecuta como un proceso hijo
    *ejecutaPrograma(nombre, argv, io, envExtra) {
      const fs = this.sis.fs, cred = this.cred();
      let ino = null, ruta = null, sinPermiso = null;
      if (nombre.includes('/')) {
        try { ino = fs.resuelve(nombre, cred, { cwd: this.cwdIno }).ino; ruta = nombre; }
        catch (e) { if (e instanceof L.ErrorSis) { this.escribe(io.fd[2], this.prefijo() + nombre + ': ' + L.ERR[e.codigo] + '\n'); return e.codigo === 'EACCES' ? 126 : 127; } throw e; }
        if (ino.tipo === 'd') { this.escribe(io.fd[2], this.prefijo() + nombre + ': Es un directorio\n'); return 126; }
        if (!fs.puede(cred, ino, 'x')) { this.escribe(io.fd[2], this.prefijo() + nombre + ': Permiso denegado\n'); return 126; }
      } else {
        const path = (this.valor('PATH') || '').split(':');
        for (const d of path) {
          if (!d) continue;
          try {
            const r = fs.resuelve(d + '/' + nombre, cred, { cwd: this.cwdIno });
            if (r.ino.tipo !== '-') continue;
            if (!fs.puede(cred, r.ino, 'x')) { if (!sinPermiso) sinPermiso = d + '/' + nombre; continue; }
            ino = r.ino; ruta = d + '/' + nombre; break;
          } catch (e) { if (!(e instanceof L.ErrorSis)) throw e; }
        }
        if (!ino) {
          if (sinPermiso) { this.escribe(io.fd[2], this.prefijo() + sinPermiso + ': Permiso denegado\n'); return 126; }
          return this.noEncontrada(nombre, io);
        }
      }
      // qué hace ese archivo
      if (ino.prog) {
        const f = L.ordenes[ino.prog];
        if (!f) { this.emiteEv('aviso', `El simulador todavía no sabe ejecutar «${nombre}». En tu Ubuntu sí funciona.`); return 127; }
        return yield* this.lanza(f, nombre, argv, io, envExtra, false, ruta);
      }
      if (ino.elf || ino.noSimulado || ino.tam !== undefined) {
        this.emiteEv('aviso', `El simulador no tiene la orden «${nombre.split('/').pop()}». En tu Ubuntu sí funciona.`);
        return 127;
      }
      // un archivo de texto con permiso de ejecución: lo ejecuta bash como un guion
      return yield* this.lanza(L.ordenes.bash, 'bash', ['bash', ruta].concat(argv.slice(1)), io, envExtra, false, '/usr/bin/bash', { comoGuion: nombre });
    }
    noEncontrada(nombre, io) {
      const D = L.datos || {};
      if (!this.interactiva && !this.interactivaPadre) { this.escribe(io.fd[2], this.prefijo() + nombre + ': orden no encontrada\n'); return 127; }
      // existe en Ubuntu pero el simulador no la tiene
      if ((D.ordenesUbuntu || []).includes(nombre) || (D.internasBash || []).includes(nombre)) {
        this.emiteEv('aviso', `El simulador no tiene la orden «${nombre}». En tu Ubuntu sí funciona.`);
        return 127;
      }
      // command-not-found de Ubuntu: las que se instalan con apt, con su mensaje real
      if (D.cnf && D.cnf[nombre] && !/Quizá|similares/.test(D.cnf[nombre])) { this.escribe(io.fd[2], D.cnf[nombre]); return 127; }
      const pkg = Object.values(this.sis.paquetes).find((p) => Object.keys(p.ordenes).includes(nombre));
      if (pkg) { this.escribe(io.fd[2], `No se ha encontrado la orden «${nombre}», pero se puede instalar con:\nsudo apt install ${pkg.nombre}\n`); return 127; }
      if (D.cnf && D.cnf[nombre]) { this.escribe(io.fd[2], D.cnf[nombre]); return 127; }
      this.escribe(io.fd[2], nombre + ': no se encontró la orden\n');
      const parecida = this.parecida(nombre);
      if (parecida) this.emiteEv('aviso', `En tu Ubuntu, además, te propondría órdenes con un nombre parecido, como «${parecida}».`);
      return 127;
    }
    parecida(n) {
      if (n.length < 3) return null;
      const cand = Object.keys(L.ordenes).concat(Object.keys(L.internas));
      const dist = (a, b) => {
        if (Math.abs(a.length - b.length) > 1) return 9;
        const d = Array.from({ length: a.length + 1 }, (_, i) => [i].concat(Array(b.length).fill(0)));
        for (let j = 1; j <= b.length; j++) d[0][j] = j;
        for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
          d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
          if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
        return d[a.length][b.length];
      };
      const ok = cand.filter((c) => c !== n && c.toLowerCase() !== n.toLowerCase() && dist(n, c) === 1);
      return ok.length ? ok[0] : null;
    }
    // ejecuta una orden del simulador con su contexto
    *lanza(f, nombre, argv, io, envExtra, interna, ruta, extra) {
      const sh = this, sis = this.sis;
      let proc = null;
      if (!interna) {
        proc = { pid: sis.nuevoPid(), ppid: this.pid, uid: this.uid, orden: nombre.split('/').pop().slice(0, 15), ni: 0, estado: 'R', virt: 12108, res: 5900, shr: 3720, cpu: 0, mem: 0.1, tiempo: 0, tty: 'pts/0', inicio: sis.ahora(), ruta: argv.join(' ') };
        sis._procs.push(proc);
      }
      const c = crearContexto(this, nombre, argv, io, envExtra, ruta, extra);
      c.proc = proc;
      const base = nombre.split('/').pop();
      if (!interna && !this.notaIdioma && L.idiomaDe && L.idiomaDe(c.env) !== 'es' && !['env', 'printenv', 'echo', 'true', 'false', 'printf'].includes(base) && !argv.includes('--help')) {
        this.notaIdioma = true;
        this.emiteEv('nota', `El simulador escribe los mensajes de ${base} en español aunque el idioma no sea el español (LANG, LC_ALL o LC_MESSAGES): en tu Ubuntu saldrían en inglés.`);
      }
      const antes = this.enMarcha;
      if (!interna) this.enMarcha = nombre.split('/').pop();
      try {
        let codigo = yield* f.call(c, c);
        if (codigo === undefined) codigo = 0;
        return codigo;
      } catch (e) {
        if (e instanceof L.ErrorSis) { c.err(c.nombre + ': ' + L.ERR[e.codigo] + '\n'); return 1; }
        throw e;
      } finally {
        if (proc) sis._procs = sis._procs.filter((p) => p !== proc);
        if (!interna) this.enMarcha = antes;
        if (c.alAcabar) c.alAcabar();
      }
    }

    /* ---------- redirecciones ---------- */
    *abreRedirs(redirs, io) {
      if (!redirs || !redirs.length) return io;
      const fd = Object.assign({}, io.fd);
      const fs = this.sis.fs, cred = this.cred();
      for (const r of redirs) {
        if (r.documento) { this.emiteEv('aviso', 'El simulador todavía no tiene los documentos en línea (<<).'); return null; }
        let destino;
        try { destino = yield* this.expandeTexto(r.destino); }
        catch (e) { if (e instanceof ErrorExpansion) { this.escribe(io.fd[2], this.prefijo() + e.message + '\n'); return null; } throw e; }
        const num = r.fd !== null ? r.fd : (r.op[0] === '<' ? 0 : 1);
        if (r.op === '>&' || r.op === '<&') {
          if (/^\d+$/.test(destino)) { if (!fd[+destino]) { this.escribe(io.fd[2], this.prefijo() + destino + ': Descriptor de fichero erróneo\n'); return null; } fd[num] = fd[+destino]; continue; }
          if (destino === '-') { fd[num] = { tipo: 'nulo' }; continue; }
          if (r.op === '>&' && r.fd === null) { const s = this.abreArchivo(destino, false, io); if (!s) return null; fd[1] = s; fd[2] = s; continue; }
          this.escribe(io.fd[2], this.prefijo() + destino + ': redirección ambigua\n'); return null;
        }
        if (r.op === '&>' || r.op === '&>>') { const s = this.abreArchivo(destino, r.op === '&>>', io); if (!s) return null; fd[1] = s; fd[2] = s; continue; }
        if (r.op === '<' || r.op === '<>') {
          if (destino === '/dev/stdin') continue;
          try {
            const ino = fs.resuelve(destino, cred, { cwd: this.cwdIno }).ino;
            if (ino.tipo === 'd' && r.op === '<') { fd[num] = { tipo: 'texto', texto: '', pos: 0, esDir: destino }; continue; }
            if (!fs.puede(cred, ino, 'r')) throw new L.ErrorSis('EACCES');
            if (ino.tipo === 'c') { fd[num] = ino.rdev[1] === 3 ? { tipo: 'texto', texto: '', pos: 0 } : { tipo: 'term' }; continue; }
            fd[num] = { tipo: 'texto', texto: ino.datos || '', pos: 0, ino };
          } catch (e) {
            if (e instanceof L.ErrorSis) { this.escribe(io.fd[2], this.prefijo() + destino + ': ' + L.ERR[e.codigo] + '\n'); return null; }
            throw e;
          }
          continue;
        }
        if (r.op === '<<<') { fd[0] = { tipo: 'texto', texto: destino + '\n', pos: 0 }; continue; }
        const s = this.abreArchivo(destino, r.op === '>>', io);
        if (!s) return null;
        fd[num] = s;
      }
      return { fd, enTuberia: io.enTuberia };
    }
    abreArchivo(ruta, añadir, io) {
      const fs = this.sis.fs, cred = this.cred();
      if (ruta === '/dev/null') return { tipo: 'nulo' };
      if (ruta === '/dev/stdout') return io.fd[1];
      if (ruta === '/dev/stderr') return io.fd[2];
      if (ruta === '/dev/tty') return { tipo: 'term', canal: 'out' };
      try {
        const r = fs.resuelve(ruta, cred, { cwd: this.cwdIno, faltaUltimo: true });
        let ino = r.ino;
        if (ino && ino.tipo === 'd') throw new L.ErrorSis('EISDIR');
        if (ino && ino.tipo === 'c') return ino.rdev[1] === 3 || ino.rdev[1] === 5 ? { tipo: 'nulo' } : { tipo: 'term', canal: 'out' };
        const rutaAbs = this.rutaAbs(ruta);
        if (!ino) {
          if (!fs.puede(cred, r.padre, 'w')) throw new L.ErrorSis('EACCES');
          ino = fs.nuevo('-', 0o666 & ~this.umask(), this.uid, r.padre.modo & 0o2000 ? r.padre.gid : this.gid, { datos: '' });
          fs.enlaza(r.padre, r.nombre, ino, rutaAbs);
        } else {
          if (!fs.puede(cred, ino, 'w')) throw new L.ErrorSis('EACCES');
          if (!añadir) fs.escribe(ino, '', false, rutaAbs);
        }
        return { tipo: 'archivo', ino, ruta: rutaAbs };
      } catch (e) {
        if (e instanceof L.ErrorSis) { this.escribe(io.fd[2], this.prefijo() + ruta + ': ' + L.ERR[e.codigo] + '\n'); return null; }
        throw e;
      }
    }
    umask() { return this.mascara === undefined ? 0o002 : this.mascara; }
    rutaAbs(ruta) {
      if (ruta[0] === '/') return normaliza(ruta);
      return normaliza((this.pwd === '/' ? '' : this.pwd) + '/' + ruta);
    }
    escribe(dest, texto) {
      if (!texto || !dest) return;
      switch (dest.tipo) {
        case 'term': this.emiteEv(dest.canal || 'out', texto); break;
        case 'buf': dest.partes.push(texto); break;
        case 'copia': dest.partes.push(texto); this.escribe(dest.destino, texto); break;
        case 'archivo': this.sis.fs.escribe(dest.ino, texto, true, dest.ruta); break;
        case 'nulo': break;
      }
    }
    esTerm(dest) { if (this.sinTty) return false; while (dest && dest.tipo === 'copia') dest = dest.destino; return !!dest && dest.tipo === 'term'; }

    /* ---------- expansiones ---------- */
    // una palabra -> lista de campos
    *expande(palabra, opc) {
      const variantes = expandeLlaves(aAtomos(palabra.partes));
      const salida = [];
      for (const atomos of variantes) {
        const segs = yield* this.aSegmentos(atomos, opc);
        const campos = parteCampos(segs, this.valor('IFS'));
        for (const campo of campos) salida.push(...this.comodines(campo));
      }
      return salida;
    }
    // una palabra -> un texto (asignaciones, redirecciones, case): sin partir y sin comodines
    *expandeTexto(palabra, opc) {
      const segs = yield* this.aSegmentos(aAtomos(palabra.partes), opc);
      return segs.map((s) => s.s).join('');
    }
    // patrón de case o de ${x#…}: texto y qué caracteres siguen siendo comodines
    *expandePatron(palabra) {
      const segs = yield* this.aSegmentos(aAtomos(palabra.partes));
      let texto = '';
      segs.forEach((s) => { texto += s.q ? s.s.replace(/[*?[\]\\]/g, '\\$&') : s.s; });
      return { texto };
    }
    *aSegmentos(atomos, opc) {
      const segs = [];
      // tilde al principio de la palabra (y tras = o : en las asignaciones)
      let i = 0;
      if (atomos.length && atomos[0].c === '~') {
        let nombre = '', j = 1;
        while (j < atomos.length && atomos[j].c !== undefined && atomos[j].c !== '/') { nombre += atomos[j].c; j++; }
        if (j === atomos.length || atomos[j].c === '/') {
          const home = nombre === '' ? this.valor('HOME') : (this.sis.usuario(nombre) || {}).home;
          if (home !== undefined) { segs.push({ s: home, q: true }); i = j; }
        }
      }
      for (; i < atomos.length; i++) {
        const a = atomos[i];
        if (a.c !== undefined) { segs.push({ s: a.c, q: false }); continue; }
        const p = a.p;
        if (p.t === 'esc' || p.t === 'sq') { segs.push({ s: p.v, q: true }); continue; }
        if (p.t === 'dq') {
          let hay = false;
          for (const q of p.partes) {
            if (q.t === 'lit') { segs.push({ s: q.v, q: true }); hay = true; continue; }
            const v = yield* this.parte(q);
            segs.push({ s: v, q: true }); hay = true;
          }
          if (!hay) segs.push({ s: '', q: true });
          continue;
        }
        if (p.t === 'lit') { segs.push({ s: p.v, q: false }); continue; }
        const v = yield* this.parte(p);
        segs.push({ s: v, q: false, sp: true });
      }
      void opc;
      return segs;
    }
    // el valor de una parte con $
    *parte(p) {
      if (p.t === 'var') return yield* this.parametro(p);
      if (p.t === 'sub') {
        const sub = this.copia();
        const buf = { tipo: 'buf', partes: [] };
        const io = { fd: { 0: { tipo: 'term' }, 1: buf, 2: { tipo: 'term', canal: 'err' } } };
        let c;
        try { c = yield* sub.ejLista(p.arbol, io); } catch (e) { if (e instanceof SalidaShell) c = e.codigo; else throw e; }
        this.ultimoSub = c; this.ultimo = c;
        return buf.partes.join('').replace(/\n+$/, '');
      }
      if (p.t === 'arit') {
        // dentro de $(( )) se expanden antes las variables y las órdenes; luego se calcula
        const texto = yield* this.expandeTexto(new Analizador(p.src, {}).subpalabra(p.src));
        return String(aritmetica(texto, this));
      }
      return '';
    }
    *parametro(p) {
      let v = this.valor(p.nombre);
      if (p.largo) return String(v === undefined ? 0 : [...v].length);
      if (!p.op) {
        if (v === undefined && this.opcionU) throw new ErrorExpansion(p.nombre + ': variable sin asignar');
        return v === undefined ? '' : v;
      }
      const vacio = v === undefined || (p.op[0] === ':' && v === '');
      const op = p.op.replace(':', '');
      if (op === '-') return vacio ? yield* this.expandeTexto(p.palabra) : v;
      if (op === '=') { if (vacio) { v = yield* this.expandeTexto(p.palabra); this.asigna(p.nombre, v); } return v; }
      if (op === '+') return vacio ? '' : yield* this.expandeTexto(p.palabra);
      if (op === '?') { if (vacio) { const m = yield* this.expandeTexto(p.palabra); throw new ErrorExpansion(p.nombre + ': ' + (m || 'parámetro nulo o no establecido')); } return v; }
      v = v || '';
      if (op === '#' || op === '##' || op === '%' || op === '%%') {
        const pat = (yield* this.expandePatron(p.patron)).texto;
        const corto = op.length === 1;
        if (op[0] === '#') {
          for (let k = corto ? 0 : v.length; corto ? k <= v.length : k >= 0; k += corto ? 1 : -1) if (casaPatron(pat, v.slice(0, k))) return v.slice(k);
        } else {
          for (let k = corto ? v.length : 0; corto ? k >= 0 : k <= v.length; k += corto ? -1 : 1) if (casaPatron(pat, v.slice(k))) return v.slice(0, k);
        }
        return v;
      }
      if (op === '/' || op === '//') {
        const pat = (yield* this.expandePatron(p.patron)).texto, rep = yield* this.expandeTexto(p.reemplazo);
        let re;
        try { re = new RegExp(patronARegex(pat), op === '//' ? 'g' : ''); } catch (e) { return v; }
        return v.replace(re, () => rep);
      }
      return v;
    }
    // comodines de un campo: lista de rutas que casan, o el campo tal cual si no casa ninguna
    comodines(campo) {
      const texto = campo.map((x) => x.c).join('');
      if (!campo.some((x) => !x.q && /[*?[]/.test(x.c))) return [texto];
      if (this.noglob) return [texto];
      const fs = this.sis.fs, cred = this.cred();
      // trozos separados por /
      const trozos = [];
      let actual = [];
      campo.forEach((x) => { if (x.c === '/') { trozos.push(actual); actual = []; } else actual.push(x); });
      trozos.push(actual);
      const absoluta = texto[0] === '/';
      const une = (ruta, nom) => (ruta === '' ? nom : ruta.endsWith('/') ? ruta + nom : ruta + '/' + nom);
      // sigue el enlace simbólico de una entrada (para entrar en carpetas enlazadas)
      const sigue = (ruta, ino) => { if (ino.tipo !== 'l') return ino; try { return fs.resuelve(this.rutaAbs(ruta), cred).ino; } catch (e) { return ino; } };
      let caminos = [{ ruta: absoluta ? '/' : '', ino: absoluta ? fs.ino(fs.raiz) : fs.ino(this.cwdIno) }];
      for (let k = absoluta ? 1 : 0; k < trozos.length; k++) {
        const t = trozos[k], ultimo = k === trozos.length - 1;
        const tTexto = t.map((x) => x.c).join('');
        if (tTexto === '') {   // barra final («*/»: solo carpetas) o doble barra
          if (ultimo) caminos = caminos.filter((c) => fs.montado(c.ino).tipo === 'd').map((c) => ({ ruta: c.ruta + '/', ino: c.ino }));
          continue;
        }
        const especial = t.some((x) => !x.q && /[*?[]/.test(x.c));
        const nuevos = [];
        for (const c of caminos) {
          const dir = fs.montado(c.ino);
          if (!dir || dir.tipo !== 'd') continue;
          if (!especial) {
            if (tTexto === '.' || tTexto === '..') { nuevos.push({ ruta: une(c.ruta, tTexto), ino: tTexto === '.' ? dir : fs.padreDe(dir) }); continue; }
            const h = dir.hijos.get(tTexto);
            if (h === undefined) continue;
            const r = une(c.ruta, tTexto);
            nuevos.push({ ruta: r, ino: sigue(r, fs.ino(h)) });
            continue;
          }
          if (!fs.puede(cred, dir, 'r') || !fs.puede(cred, dir, 'x')) continue;
          const re = new RegExp('^' + patronARegex(tTexto, (i) => !t[i].q, { ruta: true }) + '$');
          const ocultos = t[0] && t[0].c === '.';
          const nombres = [...dir.hijos.keys()].filter((n) => (ocultos || n[0] !== '.') && re.test(n));
          for (const nom of nombres) { const r = une(c.ruta, nom); nuevos.push({ ruta: r, ino: sigue(r, fs.ino(dir.hijos.get(nom))) }); }
        }
        caminos = nuevos;
        if (!caminos.length) break;
      }
      if (!caminos.length) return [texto];
      return caminos.map((c) => c.ruta).sort(U.comparaLocale);
    }

    /* ---------- API pública ---------- */
    // ejecuta una línea de principio a fin (pruebas, misiones, Resolver). opc.respuestas: lo que se teclea en
    // las preguntas (contraseñas, s/n, líneas de cat); opc.teclas: teclas para los programas a pantalla completa
    ejecuta(linea, opc) {
      opc = opc || {};
      const ev = [];
      const ej = this.lanzaLinea(linea, { alSalir: (t, x) => ev.push({ tipo: t, texto: x }), columnas: opc.columnas });
      if (ej.incompleto) return { incompleto: true, codigo: null, stdout: '', stderr: '', avisos: [], eventos: [] };
      const respuestas = (opc.respuestas || []).slice();
      const teclas = (opc.teclas || []).slice();
      const pantallas = [];
      let r = ej.avanza();
      let vueltas = 0;
      while (!r.fin && vueltas++ < 100000) {
        if (r.tipo === 'leer') r = ej.avanza(respuestas.length ? respuestas.shift() : null);
        else if (r.tipo === 'espera' && opc.ctrlCTras !== undefined && --opc.ctrlCTras <= 0) { delete opc.ctrlCTras; this.sis.avanza(r.ms); r = ej.interrumpe(); }
        else if (r.tipo === 'espera') { this.sis.avanza(r.ms); r = ej.avanza(); }
        else if (r.tipo === 'programa') {
          const p = r.programa;
          const foto = () => pantallas.push(p.pantalla(opc.columnas || 80, opc.lineas || 24).join('\n'));
          foto();
          let fin = false;
          while (teclas.length && !fin) { fin = p.tecla(teclas.shift()) === 'fin'; if (!fin) foto(); }
          if (!fin) p.tecla('q');
          r = ej.avanza();
        } else if (r.tipo === 'ayuda' || r.tipo === 'carga') { const f = r.archivo || 'linux-ayuda.js'; if (typeof require === 'function') { try { require('./' + f); } catch (e) { /* sin ese archivo */ } } r = ej.avanza(); }
        else r = ej.avanza();
      }
      const res = resumen(ev, r.codigo, ej);
      res.pantallas = pantallas;
      return res;
    }
    // para la terminal: devuelve un objeto Ejecucion que se va conduciendo, o {incompleto: true}
    lanzaLinea(linea, opc) {
      opc = opc || {};
      if (opc.columnas) { this.columnas = opc.columnas; this.asigna('COLUMNS', String(opc.columnas)); }
      if (opc.lineas) { this.lineas = opc.lineas; this.asigna('LINES', String(opc.lineas)); }
      const salida = opc.alSalir || (() => {});
      let texto = linea;
      try {
        const h = this.expandeHistorial(linea);
        if (h.cambia) { texto = h.linea; salida('out', texto + '\n'); }
      } catch (e) {
        if (e instanceof ErrorExpansion) { this.guardaHistorial(linea); salida('err', 'bash: ' + e.message + '\n'); this.ultimo = 1; return new Ejecucion(this, null, salida, 1); }
        throw e;
      }
      // ¿está completa? (comillas, tuberías o && sin terminar: la terminal pide otra línea con «> »)
      if (this.interactiva) {
        try { new Analizador(texto, { alias: this.alias }).todo(); }
        catch (e) { if (e instanceof Incompleto) return { incompleto: true, busca: e.busca }; }
      }
      this.guardaHistorial(texto);
      try { L.registra(this.sis, { tipo: 'linea', texto, arbol: new Analizador(texto, { alias: this.interactiva ? this.alias : null }).todo() }); } catch (e) { /* línea con error */ }
      this.trazas = [];
      this.notaIdioma = false;
      const cambios = [];
      const quita = this.sis.alCambiar((ev) => cambios.push({ tipo: ev.tipo, ruta: ev.ruta }));
      const ej = new Ejecucion(this, this.ejecutaTexto(texto), salida);
      ej.cambios = cambios; ej.trazas = this.trazas; ej.quitaOyente = quita;
      if (this.sis.relojFijo) this.sis.avanza(1000);
      return ej;
    }
    // Tab: completa la palabra que hay antes del cursor
    completa(linea, cursor) {
      const antes = linea.slice(0, cursor);
      const m = antes.match(/(?:^|[\s;|&<>(])((?:\\.|[^\s;|&<>()\\])*)$/);
      const palabra = m ? m[1] : '';
      const inicio = antes.length - palabra.length;
      const previo = antes.slice(0, inicio);
      const enOrden = previo.trim() === '' || /(^|[;|&(]|\b(sudo|man|which|whereis|type|help))\s*$/.test(previo);
      const primera = previo.trim().split(/\s+/)[0] || '';
      const limpio = palabra.replace(/\\(.)/g, '$1');
      let cand = [];
      const sinBarra = !limpio.includes('/');
      if (enOrden && sinBarra) {
        const set = new Set();
        Object.keys(L.internas).forEach((k) => set.add(k));
        this.alias.forEach((v, k) => set.add(k));
        this.funciones.forEach((v, k) => set.add(k));
        (this.valor('PATH') || '').split(':').forEach((d) => {
          try { const r = this.sis.fs.resuelve(d, this.cred()); if (r.ino.tipo === 'd') r.ino.hijos.forEach((v, k) => { const i = this.sis.fs.ino(v); if (i && (i.tipo === '-' || i.tipo === 'l')) set.add(k); }); } catch (e) { /* nada */ }
        });
        cand = [...set].filter((k) => k.startsWith(limpio)).sort(U.comparaLocale).map((k) => ({ texto: k, mostrar: k, dir: false }));
      } else {
        let dirParte = limpio.includes('/') ? limpio.slice(0, limpio.lastIndexOf('/') + 1) : '';
        const base = limpio.slice(dirParte.length);
        let dirReal = dirParte.replace(/^~(?=\/|$)/, this.valor('HOME') || '~');
        try {
          const r = this.sis.fs.resuelve(dirReal || '.', this.cred(), { cwd: this.cwdIno });
          const dir = this.sis.fs.montado(r.ino);
          if (dir.tipo === 'd' && this.sis.fs.puede(this.cred(), dir, 'r')) {
            const soloDirs = ['cd', 'rmdir', 'pushd'].includes(primera);
            [...dir.hijos].forEach(([k, v]) => {
              if (!k.startsWith(base) || (k[0] === '.' && base[0] !== '.')) return;
              let ino = this.sis.fs.ino(v);
              if (ino.tipo === 'l') { try { ino = this.sis.fs.resuelve(this.rutaAbs((dirReal || '.') + '/' + k), this.cred()).ino; } catch (e) { /* roto */ } }
              const esDir = ino.tipo === 'd';
              if (soloDirs && !esDir) return;
              cand.push({ texto: dirParte + k, mostrar: k + (esDir ? '/' : ''), dir: esDir });
            });
            cand.sort((a, b) => U.comparaLocale(a.texto, b.texto));
          }
        } catch (e) { /* sin candidatos */ }
      }
      const escapa = (s) => s.replace(/([ \t'"\\()&;|<>*?[\]$`!])/g, '\\$1');
      if (!cand.length) return { inicio, fin: cursor, sustituye: null, candidatos: [] };
      if (cand.length === 1) {
        const c = cand[0];
        return { inicio, fin: cursor, sustituye: escapa(c.texto) + (c.dir ? '/' : ' '), candidatos: [], unico: true };
      }
      let comun = cand[0].texto;
      cand.forEach((c) => { while (!c.texto.startsWith(comun)) comun = comun.slice(0, -1); });
      return { inicio, fin: cursor, sustituye: comun.length > limpio.length ? escapa(comun) : null, candidatos: cand.map((c) => c.mostrar) };
    }
  }

  // partes de una palabra -> átomos (un carácter suelto por cada literal sin comillas, o una parte entera)
  function aAtomos(partes) {
    const a = [];
    partes.forEach((p) => { if (p.t === 'lit') for (const ch of p.v) a.push({ c: ch }); else a.push({ p }); });
    return a;
  }
  // expansión de llaves sobre los átomos: {a,b,c} y {1..5}, {a..e}, {01..10..2}
  function expandeLlaves(atomos) {
    for (let i = 0; i < atomos.length; i++) {
      if (atomos[i].c !== '{') continue;
      if (i > 0 && atomos[i - 1].c === '$') continue;
      let prof = 0, comas = [], fin = -1;
      for (let j = i; j < atomos.length; j++) {
        const c = atomos[j].c;
        if (c === '{') prof++;
        else if (c === '}') { prof--; if (prof === 0) { fin = j; break; } }
        else if (c === ',' && prof === 1) comas.push(j);
      }
      if (fin < 0) continue;
      const antes = atomos.slice(0, i), despues = atomos.slice(fin + 1);
      if (comas.length) {
        const trozos = [];
        let desde = i + 1;
        comas.concat([fin]).forEach((k) => { trozos.push(atomos.slice(desde, k)); desde = k + 1; });
        const salida = [];
        trozos.forEach((t) => expandeLlaves(antes.concat(t, despues)).forEach((x) => salida.push(x)));
        return salida;
      }
      const dentro = atomos.slice(i + 1, fin);
      if (dentro.every((x) => x.c !== undefined)) {
        const txt = dentro.map((x) => x.c).join('');
        let m = txt.match(/^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/);
        const lista = [];
        if (m) {
          const a = +m[1], b = +m[2];
          let paso = Math.abs(+(m[3] || 1)) || 1;
          const ancho = (/^-?0\d/.test(m[1]) || /^-?0\d/.test(m[2])) ? Math.max(m[1].length, m[2].length) : 0;
          for (let v = a; a <= b ? v <= b : v >= b; v += a <= b ? paso : -paso) {
            let s = String(Math.abs(v)).padStart(ancho - (v < 0 ? 1 : 0), '0'); if (v < 0) s = '-' + s;
            lista.push(s);
            if (lista.length > 100000) break;
          }
        } else if ((m = txt.match(/^([A-Za-z])\.\.([A-Za-z])(?:\.\.(-?\d+))?$/))) {
          const a = m[1].charCodeAt(0), b = m[2].charCodeAt(0), paso = Math.abs(+(m[3] || 1)) || 1;
          for (let v = a; a <= b ? v <= b : v >= b; v += a <= b ? paso : -paso) lista.push(String.fromCharCode(v));
        }
        if (lista.length) {
          const salida = [];
          lista.forEach((s) => expandeLlaves(antes.concat([...s].map((c) => ({ c, q: true })), despues)).forEach((x) => salida.push(x)));
          return salida;
        }
      }
    }
    return [atomos];
  }
  // segmentos -> campos; cada campo es una lista de {c, q}
  function parteCampos(segs, ifs) {
    if (ifs === undefined) ifs = ' \t\n';
    const campos = [];
    let actual = null;
    const empieza = () => { if (!actual) actual = []; };
    for (const s of segs) {
      if (s.sp && ifs) {
        for (const ch of s.s) {
          if (ifs.includes(ch)) { if (actual) { campos.push(actual); actual = null; } continue; }
          empieza(); actual.push({ c: ch, q: false });
        }
        continue;
      }
      empieza();
      for (const ch of s.s) actual.push({ c: ch, q: s.q });
      if (s.q && !s.s) actual.vacioCitado = true;
    }
    if (actual) campos.push(actual);
    return campos.filter((c) => c.length || c.vacioCitado);
  }
  const normaliza = (ruta) => {
    const abs = ruta[0] === '/';
    const out = [];
    ruta.split('/').forEach((c) => { if (!c || c === '.') return; if (c === '..') { out.pop(); return; } out.push(c); });
    return (abs ? '/' : '') + out.join('/') || (abs ? '/' : '.');
  };
  const contarLineas = (t) => t.split('\n').length;
  L.normaliza = normaliza;

  /* ============================== contexto de una orden ============================== */
  function crearContexto(sh, nombre, argv, io, envExtra, ruta, extra) {
    const sis = sh.sis, fs = sis.fs;
    const c = {
      sh, sis, fs, nombre: nombre.split('/').pop(), argv, args: argv.slice(1), ruta, extra: extra || {},
      io, env: sh.entorno(envExtra),
      get cred() { return sh.cred(); },
      get uid() { return sh.uid; },
      get usuario() { return sh.usuario; },
      get cwd() { return sh.cwdIno; },
      columnas: sh.columnas, lineas: sh.lineas,
      ttyOut: sh.esTerm(io.fd[1]), ttyErr: sh.esTerm(io.fd[2]), ttyIn: !sh.sinTty && (io.fd[0] || {}).tipo === 'term',
      sale(t) { sh.escribe(io.fd[1], t); },
      err(t) { sh.escribe(io.fd[2], t); },
      aviso(t) { sh.emiteEv('aviso', t); },
      nota(t) { sh.emiteEv('nota', t); },
      // lee toda la entrada estándar (del teclado: hasta Ctrl+D)
      *leeTodo() {
        const e = io.fd[0];
        if (!e || e.tipo === 'texto') { const t = e ? e.texto.slice(e.pos) : ''; if (e) e.pos = e.texto.length; return t; }
        if (sh.sinTty) return '';
        let t = '';
        for (;;) { const l = yield { tipo: 'leer', eco: true }; if (l === null || l === undefined) break; t += l + '\n'; }
        return t;
      },
      *leeLinea(prompt, eco) {
        const e = io.fd[0];
        if (e && e.tipo === 'texto') {
          if (e.pos >= e.texto.length) return null;
          const f = e.texto.indexOf('\n', e.pos);
          const l = f < 0 ? e.texto.slice(e.pos) : e.texto.slice(e.pos, f);
          e.pos = f < 0 ? e.texto.length : f + 1;
          return l;
        }
        if (sh.sinTty) return null;
        const r = yield { tipo: 'leer', eco: eco !== false, prompt };
        return r === undefined ? null : r;
      },
      resuelve(r, opc) { return fs.resuelve(r, sh.cred(), Object.assign({ cwd: sh.cwdIno }, opc || {})); },
      rutaAbs(r) { return sh.rutaAbs(r); },
      ahora() { return sis.ahora(); },
      // mensaje de opción que no tiene el simulador
      sinOpcion(op) { sh.emiteEv('aviso', `El simulador no tiene la opción ${op} de ${c.nombre}. En tu Ubuntu sí funciona: consulta «man ${c.nombre}».`); return 2; }
    };
    return c;
  }

  /* ============================== conductor de una ejecución ============================== */
  class Ejecucion {
    constructor(sh, gen, salida, codigoFijo) {
      this.sh = sh; this.gen = gen; this.salida = salida;
      this.codigo = codigoFijo; this.terminada = !gen;
      this.cambios = []; this.trazas = [];
      sh.emite = (t, x) => this.salida(t, x);
    }
    paso(f) {
      if (this.terminada) return { fin: true, codigo: this.codigo };
      let r;
      try { r = f(); }
      catch (e) {
        if (e instanceof Interrupcion) return this.acaba(130);
        if (e instanceof CortaLinea) return this.acaba(e.codigo);
        if (e instanceof SalidaShell) { this.salidaShell = true; return this.acaba(e.codigo); }
        if (e instanceof ErrorExpansion) { this.salida('err', 'bash: ' + e.message + '\n'); return this.acaba(e.codigo); }
        this.salida('aviso', 'Error interno del simulador: ' + (e && e.message) + '. Pulsa Reiniciar si la terminal no responde.');
        if (typeof console !== 'undefined' && console.error) console.error(e);
        return this.acaba(1);
      }
      if (r.done) return this.acaba(r.value === undefined ? 0 : r.value);
      return r.value;
    }
    acaba(codigo) {
      this.terminada = true; this.codigo = codigo; this.sh.ultimo = codigo;
      if (this.quitaOyente) this.quitaOyente();
      if (this.salidaShell && L.registra) { L.registra(this.sh.sis, { tipo: 'salir' }); this.sh.sis.sesionCerrada = true; }
      return { fin: true, codigo, salir: this.salidaShell };
    }
    avanza(valor) { return this.paso(() => this.gen.next(valor)); }
    interrumpe() { if (L.registra) L.registra(this.sh.sis, { tipo: 'tecla', tecla: 'Ctrl+C', orden: this.sh.enMarcha || null }); return this.paso(() => this.gen.throw(new Interrupcion())); }
  }
  function resumen(ev, codigo, ej) {
    const une = (t) => ev.filter((e) => e.tipo === t).map((e) => e.texto).join('');
    return { codigo, stdout: une('out'), stderr: une('err'), avisos: ev.filter((e) => e.tipo === 'aviso').map((e) => e.texto), notas: ev.filter((e) => e.tipo === 'nota').map((e) => e.texto), eventos: ev,
      trazas: ej.trazas || [], cambios: ej.cambios || [], salir: !!ej.salidaShell };
  }

  Object.assign(L, { Sesion, Analizador, Ejecucion, Incompleto, ErrorSintaxis, Interrupcion, SalidaShell, ErrorExpansion, CortaLinea, PS1_UBUNTU,
    internas: L.internas || {}, ordenes: L.ordenes || {} });
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof window !== 'undefined' ? window : globalThis);
