#!/usr/bin/env bash
# Publica public/ en el nodo IPFS soberano de la caja y actualiza el nombre IPNS.
#
# POR QUÉ: si Firebase/Fastly hipa (pasó el 12/8/2026: un usuario en Costa Rica comió
# un 503 de Varnish y nunca llegó a la app), esta es la vía alternativa. Sirve desde
# gateway.chatwallet.org, que es OTRO origen — no depende de Firebase ni de Fastly.
# OJO con lo que NO resuelve: sigue pasando por Cloudflare, así que contra una caída
# de Cloudflare no es independiente. Y el nodo está detrás de NAT sin puertos abiertos
# (todas sus direcciones públicas son /p2p-circuit), así que los gateways PÚBLICOS
# tienen que llegar por relay: lento y poco confiable para 30 MB. La vía buena es la propia.
#
# Uso:  ./publish-ipfs.sh          (asume que public/ ya está buildeado)
set -euo pipefail
cd "$(dirname "$0")"

CAJA="${CAJA_HOST:-caja}"
REMOTE_DIR="chatwallet-site"
IPNS_KEY="k51qzi5uqu5dghdtbhu5ou8dqm0nlf7zpudzdne5jppd9p86lcenk76i1rshmc"

[ -f public/dapp.html ] || { echo "✗ No hay public/dapp.html — buildeá primero"; exit 1; }

if ! ssh -o ConnectTimeout=8 -o BatchMode=yes "$CAJA" true 2>/dev/null; then
  echo "⚠️  La caja ($CAJA) no responde por SSH: no se publicó en IPFS."
  exit 0   # no rompemos el deploy por esto
fi

echo "✦ Sincronizando public/ → $CAJA:~/$REMOTE_DIR"
rsync -az --delete -e "ssh -o ConnectTimeout=8" public/ "$CAJA:~/$REMOTE_DIR/"

# El add + pin + publish corre en la caja. Guarda el CID anterior para despinearlo y
# no acumular ~30 MB por deploy.
ssh "$CAJA" "export PATH=\$HOME/bin:\$PATH
set -e
PREV=\$(cat ~/${REMOTE_DIR}.cid 2>/dev/null || true)
CID=\$(ipfs add -r -Q --pin ~/${REMOTE_DIR})
echo \"CID=\$CID\"
# Verificar que el pin QUEDÓ: si el LevelDB del datastore está latcheado en error
# (pasó del 11 al 13/8/2026 tras un ENOSPC), 'ipfs add --pin' devuelve CID igual
# pero NO persiste el pin, y el contenido queda a merced de un gc.
if ! ipfs pin ls --type=recursive \"\$CID\" >/dev/null 2>&1; then
  echo 'PIN_FALLO'
  exit 1
fi
ipfs name publish --lifetime=8760h --ttl=1m --quieter /ipfs/\$CID >/dev/null
echo \"\$CID\" > ~/${REMOTE_DIR}.cid
if [ -n \"\$PREV\" ] && [ \"\$PREV\" != \"\$CID\" ]; then
  ipfs pin rm \"\$PREV\" >/dev/null 2>&1 || true
  echo \"despineado el anterior: \$PREV\"
fi
" || { echo "⚠️  Falló la publicación en IPFS (¿pins rotos? revisar ~/ipfs-daemon.log en la caja)"; exit 0; }

echo "✦ Verificando por el gateway soberano…"
COD=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "https://gateway.chatwallet.org/ipns/${IPNS_KEY}/dapp.html" || echo 000)
if [ "$COD" = "200" ]; then
  echo "✅ Espejo IPFS al día → https://gateway.chatwallet.org/ipns/${IPNS_KEY}/dapp.html"
else
  echo "⚠️  El gateway devolvió ${COD} para el espejo IPFS"
fi
