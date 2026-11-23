#!/usr/bin/env bash
# Levanta Kubo + upload-server (con un padrón de planes temporal) + un http server sobre el build,
# y corre la verificación CDP de la pestaña Archivos. No toca la caja.
#   BUILD_DIR=dist-espacio-test tests/run-espacio-cdp.sh
set -uo pipefail
cd "$(dirname "$0")/.."

PORT=3198
WEB_PORT=8818
IPFS_BIN="${IPFS_BIN:-/usr/local/bin/ipfs}"
NODE_BIN="${NODE_BIN:-$(ls -d "$HOME"/.nvm/versions/node/v22*/bin | tail -1)/node}"
BUILD="${BUILD_DIR:?falta BUILD_DIR (el directorio del build a servir)}"
TMP=$(mktemp -d)
export ESPACIO_PLANES="$TMP/espacio-planes.json"
unset NODE_OPTIONS

started_ipfs=0
cleanup() {
  [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null
  [ -n "${SRV_PID:-}" ] && kill "$SRV_PID" 2>/dev/null
  [ "$started_ipfs" = "1" ] && [ -n "${IPFS_PID:-}" ] && kill "$IPFS_PID" 2>/dev/null
  rm -rf "$TMP"
  return 0
}
trap cleanup EXIT

if ! curl -sf -X POST http://127.0.0.1:5001/api/v0/id --max-time 3 >/dev/null 2>&1; then
  echo "✦ Levantando Kubo…"
  "$IPFS_BIN" daemon > "$TMP/ipfs.log" 2>&1 &
  IPFS_PID=$!; started_ipfs=1
  for _ in $(seq 1 60); do curl -sf -X POST http://127.0.0.1:5001/api/v0/id --max-time 2 >/dev/null 2>&1 && break; sleep 1; done
fi
curl -sf -X POST http://127.0.0.1:5001/api/v0/id --max-time 2 >/dev/null 2>&1 || { echo "✗ Kubo no responde"; exit 1; }

echo "✦ upload-server en :${PORT}…"
UPLOAD_PORT=$PORT "$NODE_BIN" poc/ipfs-node/upload-server.mjs > "$TMP/upload.log" 2>&1 &
SRV_PID=$!
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break; sleep 0.25; done

(cd "$BUILD" && python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 > "$TMP/web.log" 2>&1) &
WEB_PID=$!
sleep 1

UPLOAD_PORT=$PORT APP_URL="http://localhost:${WEB_PORT}/dapp.html" "$NODE_BIN" tests/espacio-archivos-cdp.mjs
rc=$?
[ $rc -ne 0 ] && { echo "--- upload-server.log ---"; tail -20 "$TMP/upload.log"; }
exit $rc
