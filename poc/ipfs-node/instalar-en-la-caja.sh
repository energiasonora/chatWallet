#!/usr/bin/env bash
# Instala en la caja el upload-server con topes de subida (+ espacio.mjs para dar planes) y lo
# reinicia. Corta las subidas y los respaldos de chat unos segundos; nada más.
#
#   ./poc/ipfs-node/instalar-en-la-caja.sh
#
# Vuelta atrás: el server anterior queda como ~/chatwallet-node/upload-server.mjs.antes-topes;
# copiarlo encima y volver a correr la parte del reinicio.
set -euo pipefail
cd "$(dirname "$0")"
CAJA="${CAJA_HOST:-caja}"
SSH=(ssh -o ConnectTimeout=8 "$CAJA")

"${SSH[@]}" 'cd ~/chatwallet-node && [ -f upload-server.mjs.antes-topes ] || cp upload-server.mjs upload-server.mjs.antes-topes'
rsync -az -e "ssh -o ConnectTimeout=8" upload-server.mjs espacio.mjs "$CAJA:~/chatwallet-node/"

"${SSH[@]}" 'bash -s' <<'REMOTO'
set -e
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$HOME/bin:$PATH"
cd ~/chatwallet-node
node --check upload-server.mjs

# Por PID, nunca por patrón suelto: sólo el proceso que es exactamente "node upload-server.mjs".
PID=$(pgrep -x -f 'node upload-server.mjs' || true)
if [ -n "$PID" ]; then
  echo "Parando el upload-server (PID $PID)…"
  kill "$PID"
  for i in $(seq 1 20); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
  kill -0 "$PID" 2>/dev/null && { echo "No paró: lo dejo como está"; exit 1; }
fi
# Mismo arranque que ~/start-chatwallet-node.sh, separado de esta sesión de ssh.
KUBO_GATEWAY=https://gateway.chatwallet.org setsid nohup node upload-server.mjs > ~/chatwallet-node/upload-server.log 2>&1 < /dev/null &
disown || true

for i in $(seq 1 20); do curl -sf 127.0.0.1:3100/health >/dev/null && break; sleep 0.5; done
curl -sf 127.0.0.1:3100/health >/dev/null || { echo "El upload-server no arrancó:"; tail -20 ~/chatwallet-node/upload-server.log; exit 1; }
echo "Upload-server arriba (PID $(pgrep -x -f 'node upload-server.mjs'))."
curl -s 127.0.0.1:3100/metrics | grep -E 'free_|repo_pct'
node espacio.mjs lista
REMOTO

# Desde afuera, por el túnel: un archivo de 6 MB de una wallet sin plan tiene que dar 413.
echo "Probando desde afuera…"
CODE=$(head -c 6291456 /dev/zero | curl -s -o /dev/null -w '%{http_code}' -X POST https://backup.chatwallet.org/api/ipfs/upload \
  -H 'x-address: 0x0000000000000000000000000000000000000001' -H 'x-signature: 0x00' -H 'x-sha256: 00' -H 'x-size: 6291456' --data-binary @-)
echo "Firma falsa con 6 MB → $CODE (esperado 401: rechazado antes de leer el cuerpo)"
curl -sf https://backup.chatwallet.org/health && echo " ← backup.chatwallet.org responde"
