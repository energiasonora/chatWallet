#!/usr/bin/env bash
# Buildea la web a un dist aparte (no toca public/), la sirve y corre la verificación CDP
# de "en Android ofrecer el APK en vez de la PWA".
# Todo en primer plano: los hijos viven mientras el test bloquea (ver run-backup-cdp.sh).
set -uo pipefail
cd "$(dirname "$0")/.."

WEB_PORT=8819
CDP_PORT=9335
NODE_BIN="${NODE_BIN:-$HOME/.nvm/versions/node/v22.23.2/bin/node}"
NODE_DIR="$(dirname "$NODE_BIN")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
BUILD="${BUILD_DIR:-dist-android-test}"
unset NODE_OPTIONS

cleanup() {
  [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null
  [ -n "${CH_PID:-}" ] && kill "$CH_PID" 2>/dev/null
  [ -n "${PROF:-}" ] && rm -rf "$PROF" 2>/dev/null
  return 0
}
trap cleanup EXIT

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "✦ buildeando la web en ${BUILD}…"
  PATH="$NODE_DIR:$PATH" PARCEL_WORKERS=0 npx parcel build src/index.html src/dapp.html \
    --dist-dir "$BUILD" --public-url ./ --cache-dir .parcel-cache-android-test > /tmp/build-android.log 2>&1 || {
      echo "✗ falló el build — mirá /tmp/build-android.log"; tail -20 /tmp/build-android.log; exit 1; }
fi
[ -f "$BUILD/dapp.html" ] || { echo "✗ no hay $BUILD/dapp.html"; exit 1; }

echo "✦ sirviendo $BUILD en :${WEB_PORT}…"
# Sin subshell: con "( cd … ) &" el $! es la subshell y el python sobrevive al kill,
# dejando el puerto tomado y sirviendo un build viejo en la corrida siguiente.
python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 --directory "$BUILD" > /tmp/web-android.log 2>&1 &
WEB_PID=$!
sleep 1

echo "✦ Chrome headless en :${CDP_PORT}…"
PROF=$(mktemp -d)
"$CHROME" --headless=new --remote-debugging-port="$CDP_PORT" --user-data-dir="$PROF" \
  --no-first-run --window-size=430,900 about:blank > /tmp/chrome-android.log 2>&1 &
CH_PID=$!
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null && break; sleep 0.5; done

echo "✦ corriendo la verificación…"
CDP="http://127.0.0.1:${CDP_PORT}" BASE_URL="http://localhost:${WEB_PORT}" "$NODE_BIN" tests/apk-en-android-cdp.mjs
