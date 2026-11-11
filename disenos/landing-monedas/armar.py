#!/usr/bin/env python3
# Arma las variantes de «Monedas» sobre la landing compilada (dist-landing-test).
# Uso: python3 disenos/landing-monedas/armar.py  → http://127.0.0.1:8819/monedas-a.html …
import re, os
D = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.join(D, '..', '..')
DIST = os.path.join(RAIZ, 'dist-landing-test')
src = open(os.path.join(RAIZ, 'src/index.html')).read()
ETH = re.search(r'm-eth rev"><div class="moneda__sim">(<svg.*?</svg>)', src).group(1)
XMR = re.search(r'm-xmr rev"><div class="moneda__sim">(<svg.*?</svg>)', src).group(1)
base = open(os.path.join(DIST, 'index.html')).read()
sec = re.compile(r'<section[^>]*id="?monedas"?>.*?</section>', re.S)
assert sec.search(base)
comun = open(os.path.join(D, 'comun.css')).read()
for archivo, nombre in [('a-familia.html', 'A · Familia EVM'), ('b-cuatro.html', 'B · Cuatro logos'), ('c-dos-mundos.html', 'C · Dos mundos')]:
    frag = open(os.path.join(D, archivo)).read().replace('{ETH}', ETH).replace('{XMR}', XMR)
    frag = '<style>' + comun + '</style>' + frag
    out = sec.sub(lambda m: frag, base, count=1)
    out += '<a href="#monedas" style="position:fixed;left:12px;bottom:12px;z-index:50;font:600 13px Roboto Mono,monospace;background:var(--tinta);color:var(--fondo);padding:6px 10px;border-radius:8px;text-decoration:none">' + nombre + '</a>'
    open(os.path.join(DIST, 'monedas-' + archivo[0] + '.html'), 'w').write(out)
print('ok')
