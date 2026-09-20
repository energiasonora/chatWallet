#!/usr/bin/env bash
# Buildea la web a un dist aparte, la sirve y corre la verificación del chat
# (picker, emojis, responder con cita, y reenviar de punta a punta con tres identidades).
set -uo pipefail
cd "$(dirname "$0")/.."

WEB_PORT=8840
NODE_BIN="${NODE_BIN:-$HOME/.nvm/versions/node/v22.23.2/bin/node}"
NODE_DIR="$(dirname "$NODE_BIN")"
BUILD="${BUILD_DIR:-dist-chat-test}"
unset NODE_OPTIONS

cleanup() { [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null; return 0; }
trap cleanup EXIT

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "✦ buildeando la web en ${BUILD}…"
  PATH="$NODE_DIR:$PATH" PARCEL_WORKERS=0 npx parcel build src/dapp.html \
    --dist-dir "$BUILD" --public-url ./ --cache-dir .parcel-cache-chat-test > /tmp/build-chat.log 2>&1 || {
      echo "✗ falló el build — mirá /tmp/build-chat.log"; tail -20 /tmp/build-chat.log; exit 1; }
fi
[ -f "$BUILD/dapp.html" ] || { echo "✗ no hay $BUILD/dapp.html"; exit 1; }

echo "✦ sirviendo $BUILD en :${WEB_PORT}…"
python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 --directory "$BUILD" > /tmp/web-chat.log 2>&1 &
WEB_PID=$!
sleep 1

# Chrome de una corrida anterior que se quedó con los puertos: el test se ataría a él.
pkill -f "remote-debugging-port=938[123]" 2>/dev/null
sleep 1

echo "✦ corriendo la verificación (tres navegadores contra XMTP real: tarda)…"
BASE="http://127.0.0.1:${WEB_PORT}/dapp" "$NODE_BIN" tests/chat-ux-e2e.mjs
