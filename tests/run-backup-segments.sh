#!/usr/bin/env bash
# Levanta Kubo + upload-server locales y corre el test del respaldo incremental.
#
# GOTCHA que ya costó caro: un daemon lanzado con `&` dentro de un task de background
# MUERE cuando el task "completa". Por eso todo corre en UNA sola invocación en primer
# plano: los hijos viven mientras el test bloquea.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT=3199
IPFS_BIN="${IPFS_BIN:-/usr/local/bin/ipfs}"
PTR=poc/ipfs-node/backup-pointers.json
NODE_BIN="${NODE_BIN:-$HOME/.nvm/versions/node/v22.23.2/bin/node}"
unset NODE_OPTIONS

started_ipfs=0
cleanup() {
  [ -n "${SRV_PID:-}" ] && kill "$SRV_PID" 2>/dev/null
  [ "$started_ipfs" = "1" ] && [ -n "${IPFS_PID:-}" ] && kill "$IPFS_PID" 2>/dev/null
  [ -f "$PTR.testbak" ] && mv "$PTR.testbak" "$PTR"
  return 0
}
trap cleanup EXIT

# Kubo: si ya hay uno sano, se reusa (no lo tocamos).
if curl -sf -X POST http://127.0.0.1:5001/api/v0/id --max-time 3 >/dev/null 2>&1; then
  echo "✦ Kubo ya estaba arriba, lo reuso"
else
  echo "✦ Levantando Kubo…"
  "$IPFS_BIN" daemon > /tmp/ipfs-test-daemon.log 2>&1 &
  IPFS_PID=$!
  started_ipfs=1
  for _ in $(seq 1 60); do
    curl -sf -X POST http://127.0.0.1:5001/api/v0/id --max-time 2 >/dev/null 2>&1 && break
    sleep 1
  done
  curl -sf -X POST http://127.0.0.1:5001/api/v0/id --max-time 2 >/dev/null 2>&1 || {
    echo "✗ Kubo no levantó — mirá /tmp/ipfs-test-daemon.log"; exit 1; }
fi

# Resguardar el padrón de punteros real antes de que el test escriba.
[ -f "$PTR" ] && cp "$PTR" "$PTR.testbak"

echo "✦ Levantando upload-server en :${PORT}…"
UPLOAD_PORT=$PORT "$NODE_BIN" poc/ipfs-node/upload-server.mjs > /tmp/upload-server-test.log 2>&1 &
SRV_PID=$!
for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
  sleep 0.25
done

echo "✦ Corriendo el test…"
UPLOAD_PORT=$PORT "$NODE_BIN" tests/backup-segments.mjs
rc=$?

echo "--- /metrics del server ---"
curl -s "http://127.0.0.1:$PORT/metrics" | sed 's/^/  /'
exit $rc
