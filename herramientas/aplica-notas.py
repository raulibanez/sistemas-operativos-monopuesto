#!/usr/bin/env python3
"""Aplica al repositorio un JSON exportado desde la ventana de notas (tecla N).

Uso:
    python herramientas/aplica-notas.py notas-ut01-2026-10-15.json [--ver] [--solo-bitacora]

  - Las notas de guion editadas se escriben en el <aside class="notas"> de cada
    diapositiva de utNN/index.html (se localiza por data-label).
  - La bitácora se vuelca a un Markdown junto al JSON (bitacora-utNN-fecha.md),
    fuera del repositorio: son notas privadas de clase, no se publican.
  - --ver muestra el antes y el después de cada nota sin tocar nada.
"""
import io
import json
import os
import re
import sys
from html import unescape


def texto_plano(html):
    t = re.sub(r'<(br|/p|/li|/div)\s*/?>', '\n', html or '', flags=re.I)
    t = re.sub(r'<li[^>]*>', '- ', t, flags=re.I)
    t = re.sub(r'<[^>]+>', '', t)
    t = unescape(t)
    return re.sub(r'\n{3,}', '\n\n', t).strip()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ver = '--ver' in sys.argv
    solo_bit = '--solo-bitacora' in sys.argv
    if len(args) != 1:
        print(__doc__)
        sys.exit(1)
    ruta = args[0]
    with io.open(ruta, encoding='utf-8') as f:
        j = json.load(f)
    if j.get('formato') != 'som-notas/1':
        sys.exit('El archivo no es un JSON de notas de SOM (formato som-notas/1).')

    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    deck = j['deck']
    html_path = os.path.join(raiz, deck, 'index.html')
    if not os.path.isfile(html_path):
        sys.exit('No encuentro %s' % html_path)

    # ---- guion -> aside.notas ----
    guion = [g for g in j.get('guion', []) if (g.get('nuevo') or '').strip() != (g.get('original') or '').strip()]
    if guion and not solo_bit:
        with io.open(html_path, encoding='utf-8', newline='') as f:
            s = f.read()
        aplicadas, fallidas = 0, []
        for g in sorted(guion, key=lambda x: x.get('n', 0)):
            label = g['label']
            pat = re.compile(
                r'(<section\b[^>]*\bdata-label="' + re.escape(label) + r'"[^>]*>\s*<aside class="notas">)(.*?)(</aside>)',
                re.S)
            m = pat.search(s)
            if not m:
                fallidas.append(label)
                continue
            if ver:
                print('== %02d · %s' % (g.get('n', 0), label))
                print('   antes:   ' + texto_plano(m.group(2)).replace('\n', '\n            '))
                print('   después: ' + texto_plano(g['nuevo']).replace('\n', '\n            '))
                continue
            if m.group(2).strip() != (g.get('original') or '').strip():
                print('AVISO %02d · %s: la nota del repositorio ya no es la que se exportó; se sobrescribe.' % (g.get('n', 0), label))
            s = s[:m.start(2)] + g['nuevo'].strip() + s[m.end(2):]
            aplicadas += 1
        if not ver:
            with io.open(html_path, 'w', encoding='utf-8', newline='') as f:
                f.write(s)
            print('%s: %d notas de guion aplicadas.' % (os.path.relpath(html_path, raiz), aplicadas))
        for label in fallidas:
            print('NO ENCONTRADA: "%s" (¿se ha renombrado o borrado la diapositiva?)' % label)
    elif not solo_bit:
        print('No hay notas de guion cambiadas.')

    # ---- bitácora -> markdown junto al JSON ----
    bit = j.get('bitacora') or {}
    unidad = bit.get('unidad')
    diapos = bit.get('diapos') or []
    if unidad or diapos:
        lineas = ['# Bitácora %s · %s' % (deck.upper(), j.get('titulo', '')), '', 'Exportada el %s.' % j.get('fecha', '')[:10], '']
        if unidad:
            lineas += ['## Toda la unidad', '', texto_plano(unidad.get('html', '')), '']
        if diapos:
            lineas += ['## Por diapositiva', '']
            for d in sorted(diapos, key=lambda x: x.get('n', 0)):
                lineas += ['### %02d · %s' % (d.get('n', 0), d['label']), '', texto_plano(d.get('html', '')), '']
        md = os.path.join(os.path.dirname(os.path.abspath(ruta)), 'bitacora-%s-%s.md' % (deck, j.get('fecha', '')[:10]))
        if ver:
            print('\n'.join(lineas))
        else:
            with io.open(md, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lineas))
            print('Bitácora escrita en %s' % md)
    else:
        print('Sin bitácora.')


if __name__ == '__main__':
    main()
