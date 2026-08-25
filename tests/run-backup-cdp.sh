#!/usr/bin/env bash
# Levanta Kubo + upload-server + un http server sobre el build, y corre la verificación
# CDP del respaldo incremental dentro de la app real.
#
# GOTCHA: los servicios lanzados con `&` mueren si el task de background "completa", así
# que todo va en UNA invocación en primer plano — el test bloquea y mantiene vivos a los hijos.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT=3199
WEB_PORT=8817
IPFS_BIN="${IPFS_BIN:-/usr/local/bin/ipfs}"
NODE_BIN="${NODE_BIN:-$HOME/.nvm/versions/node/v22.23.2/bin/node}"
PTR=poc/ipfs-node/backup-pointers.json
BUILD="${BUILD_DIR:?falta BUILD_DIR (el directorio del build a servir)}"
unset NODE_OPTIONS

started_ipfs=0
cleanup() {
  [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null
  [ -n "${SRV_PID:-}" ] && kill "$SRV_PID" 2>/dev/null
  [ "$started_ipfs" = "1" ] && [ -n "${IPFS_PID:-}" ] && kill "$IPFS_PID" 2>/dev/null
  [ -f "$PTR.testbak" ] && mv "$PTR.testbak" "$PTR"
  return 0
}
trap cleanup EXIT

if curl -sf -X POST http://127.0.0.1:5001/api/v0/id --max-time 3 >/dev/null 2>&1; then
  echo "✦ Kubo ya estaba arriba, lo reuso"
else
  echo "✦ Levantando Kubo…"
  "$IPFS_BIN" daemon > /tmp/ipfs-cdp-daemon.log 2>&1 &
  IPFS_PID=$!
  started_ipfs=1
  for _ in $(seq 1 60); do
    curl -sf -X POST http://127.0.0.1:5001/api/v0/id --max-time 2 >/dev/null 2>&1 && break
    sleep 1
  done
fi
curl -sf -X POST http://127.0.0.1:5001/api/v0/id --max-time 2 >/dev/null 2>&1 || {
  echo "✗ Kubo no responde"; exit 1; }

[ -f "$PTR" ] && cp "$PTR" "$PTR.testbak"

echo "✦ upload-server en :${PORT}…"
UPLOAD_PORT=$PORT "$NODE_BIN" poc/ipfs-node/upload-server.mjs > /tmp/upload-server-cdp.log 2>&1 &
SRV_PID=$!
for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
  sleep 0.25
done

echo "✦ sirviendo el build desde $BUILD en :${WEB_PORT}…"
(cd "$BUILD" && python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 > /tmp/web-cdp.log 2>&1) &
WEB_PID=$!
sleep 1

echo "✦ corriendo la verificación CDP…"
UPLOAD_PORT=$PORT APP_URL="http://localhost:${WEB_PORT}/dapp.html" "$NODE_BIN" tests/backup-cdp.mjs
rc=$?

echo "--- /metrics ---"
curl -s "http://127.0.0.1:$PORT/metrics" | sed 's/^/  /'
exit $rc
