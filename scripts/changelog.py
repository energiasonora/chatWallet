#!/usr/bin/env python3
"""Novedades: CHANGELOG.md -> versión estampada -> JSON incrustado en dapp.html.

Lo usa deploy.sh, en este orden:

  check              falla si "## Sin publicar" está vacío (nadie escribió la novedad)
  release <X.YY>     renombra "## Sin publicar" a "## X.YY — AAAA-MM-DD" y abre una vacía
  inject             escribe las últimas entradas dentro de los marcadores de dapp.html

Por qué se incrusta en el HTML y no se baja de la red: en el APK la pantalla de Novedades
tiene que funcionar sin conexión, y los releases de GitHub sólo existen cuando sale un APK
(la web publica muchas más versiones que el APK).

Sin dependencias a propósito: corre con el python3 del sistema, así deploy.sh no depende
de qué node haya activo cuando llega a este paso.
"""
import datetime
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHANGELOG = os.path.join(RAIZ, 'CHANGELOG.md')
DAPP = os.path.join(RAIZ, 'src', 'dapp.html')

SIN_PUBLICAR = 'Sin publicar'
INICIO = '<!-- NOVEDADES:INICIO -->'
FIN = '<!-- NOVEDADES:FIN -->'
MAX_ENTRADAS = 15          # lo que se incrusta; el resto vive en CHANGELOG.md y en GitHub

# "## 3.25 — 2026-09-04" (em dash o guion común, la fecha es opcional)
RE_TITULO = re.compile(r'^##\s+(.+?)\s*$')
RE_VERSION = re.compile(r'^(\d+\.\d+)\s*[—-]\s*(\d{4}-\d{2}-\d{2})?\s*$')


def parsear():
    """[(titulo, [viñetas])] en el orden del archivo (la más nueva primero)."""
    with open(CHANGELOG, encoding='utf-8') as f:
        lineas = f.read().split('\n')
    secciones, actual = [], None
    for linea in lineas:
        m = RE_TITULO.match(linea)
        if m:
            actual = (m.group(1), [])
            secciones.append(actual)
            continue
        if actual is None:
            continue                                  # preámbulo del archivo
        if linea.startswith('- '):
            actual[1].append(linea[2:].strip())
        elif linea.startswith(('  ', '\t')) and actual[1] and linea.strip():
            actual[1][-1] += ' ' + linea.strip()      # viñeta cortada en varios renglones
    return secciones


def sin_publicar(secciones):
    for titulo, items in secciones:
        if titulo.strip().lower() == SIN_PUBLICAR.lower():
            return items
    return None


def cmd_check():
    items = sin_publicar(parsear())
    if items is None:
        print('✗ CHANGELOG.md no tiene la sección "## %s".' % SIN_PUBLICAR)
        return 1
    if not items:
        print('✗ No hay novedades escritas para esta versión.')
        print('  Agregá al menos una viñeta bajo "## %s" en CHANGELOG.md,' % SIN_PUBLICAR)
        print('  contando qué cambia para quien usa la app. Si de verdad no cambia nada')
        print('  para nadie (un redeploy), corré:  ALLOW_EMPTY_CHANGELOG=1 ./deploy.sh')
        return 1
    print('✦ Novedades a publicar: %d' % len(items))
    for it in items:
        print('    - %s' % it)
    return 0


def cmd_release(version):
    fecha = datetime.date.today().isoformat()
    with open(CHANGELOG, encoding='utf-8') as f:
        texto = f.read()
    nuevo, n = re.subn(
        r'^##\s+%s\s*$' % re.escape(SIN_PUBLICAR),
        '## %s\n\n## %s — %s\n' % (SIN_PUBLICAR, version, fecha),
        texto, count=1, flags=re.M)
    if n != 1:
        print('✗ No se encontró "## %s" en CHANGELOG.md.' % SIN_PUBLICAR)
        return 1
    with open(CHANGELOG, 'w', encoding='utf-8') as f:
        f.write(nuevo)
    print('✦ CHANGELOG.md: la sección sin publicar pasó a ser %s — %s' % (version, fecha))
    return 0


def entradas_publicadas():
    salida = []
    for titulo, items in parsear():
        m = RE_VERSION.match(titulo)
        if not m or not items:
            continue                                   # "Sin publicar", o una versión vacía
        salida.append({'v': m.group(1), 'd': m.group(2) or '', 'items': items})
    return salida[:MAX_ENTRADAS]


def cmd_inject():
    entradas = entradas_publicadas()
    if not entradas:
        print('✗ CHANGELOG.md no tiene ninguna versión publicada para incrustar.')
        return 1
    # `</script>` y `<` escapados: el JSON viaja dentro de un <script> del HTML.
    datos = json.dumps(entradas, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    with open(DAPP, encoding='utf-8') as f:
        html = f.read()
    if INICIO not in html or FIN not in html:
        print('✗ No están los marcadores %s / %s en src/dapp.html.' % (INICIO, FIN))
        return 1
    bloque = ('%s\n    <script id="cwChangelogData" type="application/json">%s</script>\n    %s'
              % (INICIO, datos, FIN))
    nuevo = re.sub(re.escape(INICIO) + r'.*?' + re.escape(FIN), lambda _: bloque, html, count=1, flags=re.S)
    if nuevo != html:
        with open(DAPP, 'w', encoding='utf-8') as f:
            f.write(nuevo)
    print('✦ Novedades incrustadas en dapp.html: %d versiones (la última, %s)'
          % (len(entradas), entradas[0]['v']))
    return 0


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    cmd = argv[1]
    if cmd == 'check':
        return cmd_check()
    if cmd == 'release':
        if len(argv) < 3:
            print('uso: changelog.py release <X.YY>')
            return 2
        return cmd_release(argv[2])
    if cmd == 'inject':
        return cmd_inject()
    print('comando desconocido: %s' % cmd)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv))
