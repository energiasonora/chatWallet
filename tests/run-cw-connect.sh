#!/usr/bin/env bash
# Buildea la billetera + la app de prueba y corre la prueba de CW Connect v2 contra XMTP real.
set -uo pipefail
cd "$(dirname "$0")/.."

WEB_PORT=8853
NODE_BIN="${NODE_BIN:-$(ls -d "$HOME"/.nvm/versions/node/v22*/bin | tail -1)/node}"
NODE_DIR="$(dirname "$NODE_BIN")"
BUILD="${BUILD_DIR:-dist-cwconnect-test}"
unset NODE_OPTIONS

cleanup() { [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null; return 0; }
trap cleanup EXIT

"$NODE_BIN" cw-connect/test/verificar.mjs > /dev/null || { echo "✗ los vectores no verifican"; exit 1; }

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "✦ buildeando en ${BUILD}…"
  rm -rf "$BUILD"
  # Por separado: con dos entradas Parcel las deja en src/ y tests/, y la billetera busca sus
  # archivos estáticos en la raíz.
  PATH="$NODE_DIR:$PATH" PARCEL_WORKERS=0 npx parcel build src/dapp.html \
    --dist-dir "$BUILD" --public-url ./ --cache-dir .parcel-cache-cwconnect-test > /tmp/build-cwconnect.log 2>&1 &&
  PATH="$NODE_DIR:$PATH" PARCEL_WORKERS=0 npx parcel build tests/cw-connect-app.html \
    --dist-dir "$BUILD/app" --public-url ./ --cache-dir .parcel-cache-cwconnect-test >> /tmp/build-cwconnect.log 2>&1 || {
      echo "✗ falló el build — mirá /tmp/build-cwconnect.log"; tail -20 /tmp/build-cwconnect.log; exit 1; }
fi
[ -f "$BUILD/dapp.html" ] && [ -f "$BUILD/app/cw-connect-app.html" ] || { echo "✗ faltan páginas en $BUILD"; ls "$BUILD" | head; exit 1; }

echo "✦ sirviendo $BUILD en :${WEB_PORT}…"
python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 --directory "$BUILD" > /tmp/web-cwconnect.log 2>&1 &
WEB_PID=$!
sleep 1

BASE="http://127.0.0.1:${WEB_PORT}" "$NODE_BIN" tests/cw-connect-cdp.mjs
