#!/usr/bin/env python3
"""Renueva src/static/chainsv1.json desde la lista pública de redes EVM (ethereum-lists/chains,
la misma que muestra chainlist.org).

La app la consulta en vivo al abrir «Añadir red»; esta copia es el respaldo para cuando no hay
conexión, y la que viaja dentro del APK. Se queda sólo con los campos que la app usa.

Si la descarga falla o viene rara NO toca el archivo: una copia vieja sirve, una rota no.
"""
import json, sys, urllib.request

ORIGEN = 'https://chainid.network/chains.json'
DESTINO = 'src/static/chainsv1.json'
CAMPOS = ('name', 'chainId', 'shortName', 'nativeCurrency', 'rpc', 'explorers')

def main():
    try:
        with open(DESTINO, encoding='utf-8') as f: previas = len(json.load(f))
    except Exception: previas = 0
    try:
        pedido = urllib.request.Request(ORIGEN, headers={'user-agent': 'chatwallet-deploy'})
        with urllib.request.urlopen(pedido, timeout=30) as r: redes = json.load(r)
    except Exception as e:
        print(f'⚠ Lista de redes: no se pudo bajar ({e}); queda la copia de {previas} redes.'); return
    limpias = []
    for c in redes:
        if not isinstance(c, dict) or not isinstance(c.get('chainId'), int) or not c.get('name'): continue
        fila = {k: c[k] for k in CAMPOS if k in c}
        fila['rpc'] = [u for u in c.get('rpc') or [] if isinstance(u, str)]
        fila['explorers'] = [{'url': e['url']} for e in c.get('explorers') or [] if isinstance(e, dict) and e.get('url')][:1]
        limpias.append(fila)
    # Una lista que se achica de golpe es una descarga a medias o un origen roto, no una novedad.
    if len(limpias) < max(1500, int(previas * 0.9)):
        print(f'⚠ Lista de redes: llegaron {len(limpias)} y había {previas}; se descarta.'); return
    with open(DESTINO, 'w', encoding='utf-8') as f:
        json.dump(limpias, f, ensure_ascii=False, separators=(',', ':'))
    print(f'✦ Lista de redes: {previas} -> {len(limpias)}')

if __name__ == '__main__':
    sys.exit(main())
