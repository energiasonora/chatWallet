#!/usr/bin/env bash
# Sirve el build del APK y corre la verificación CDP del aviso de mudanza.
# Todo en primer plano: los hijos viven mientras el test bloquea (ver run-backup-cdp.sh).
set -uo pipefail
cd "$(dirname "$0")/.."

WEB_PORT=8818
CDP_PORT=9334
NODE_BIN="${NODE_BIN:-$HOME/.nvm/versions/node/v22.23.2/bin/node}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
BUILD="${BUILD_DIR:-dist-apk}"
unset NODE_OPTIONS

cleanup() {
  [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null
  [ -n "${CH_PID:-}" ] && kill "$CH_PID" 2>/dev/null
  [ -n "${PROF:-}" ] && rm -rf "$PROF" 2>/dev/null
  return 0
}
trap cleanup EXIT

# El puente NO debe llevarse la mudanza puesta: si esta build ya apunta a producción,
# el aviso no aparecería y estaríamos publicando una APK que nadie puede instalar.
grep -q "const XMTP_ENV = 'dev';" src/dapp.html || {
  echo "✗ src/dapp.html no está en XMTP dev — esta no es la build del puente"; exit 1; }
echo "✦ el fuente está en XMTP dev (build de puente) ✓"

echo "✦ sirviendo $BUILD en :${WEB_PORT}…"
(cd "$BUILD" && python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 > /tmp/web-mig.log 2>&1) &
WEB_PID=$!
sleep 1

echo "✦ Chrome headless en :${CDP_PORT}…"
PROF=$(mktemp -d)
"$CHROME" --headless=new --remote-debugging-port="$CDP_PORT" --user-data-dir="$PROF" \
  --no-first-run --window-size=430,900 about:blank > /tmp/chrome-mig.log 2>&1 &
CH_PID=$!
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null && break; sleep 0.5; done

echo "✦ corriendo la verificación…"
CDP="http://127.0.0.1:${CDP_PORT}" APP_URL="http://localhost:${WEB_PORT}/dapp.html" "$NODE_BIN" tests/migration-splash-cdp.mjs
