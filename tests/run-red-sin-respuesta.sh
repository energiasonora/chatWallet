#!/usr/bin/env bash
# Buildea la web a un dist aparte, la sirve y corre la verificación del botón atrás de Android.
set -uo pipefail
cd "$(dirname "$0")/.."

WEB_PORT=8845
NODE_BIN="${NODE_BIN:-$HOME/.nvm/versions/node/v22.23.2/bin/node}"
NODE_DIR="$(dirname "$NODE_BIN")"
BUILD="${BUILD_DIR:-dist-rpc-test}"
unset NODE_OPTIONS

cleanup() { [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null; return 0; }
trap cleanup EXIT

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "✦ buildeando la web en ${BUILD}…"
  PATH="$NODE_DIR:$PATH" PARCEL_WORKERS=0 npx parcel build src/dapp.html \
    --dist-dir "$BUILD" --public-url ./ --cache-dir .parcel-cache-rpc-test > /tmp/build-rpc.log 2>&1 || {
      echo "✗ falló el build — mirá /tmp/build-rpc.log"; tail -20 /tmp/build-rpc.log; exit 1; }
fi
[ -f "$BUILD/dapp.html" ] || { echo "✗ no hay $BUILD/dapp.html"; exit 1; }

pkill -f "remote-debugging-port=9399" 2>/dev/null
echo "✦ sirviendo $BUILD en :${WEB_PORT}…"
python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 --directory "$BUILD" > /tmp/web-rpc.log 2>&1 &
WEB_PID=$!
sleep 1

BASE="http://127.0.0.1:${WEB_PORT}/dapp.html" "$NODE_BIN" tests/red-sin-respuesta.mjs
