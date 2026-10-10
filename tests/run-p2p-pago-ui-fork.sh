#!/usr/bin/env bash
# Buildea la web a un dist aparte, levanta un fork de Base y paga un QR desde la ficha.
set -uo pipefail
cd "$(dirname "$0")/.."

WEB_PORT=8853
PUERTO=8548
NODE_BIN="${NODE_BIN:-$(ls -d "$HOME"/.nvm/versions/node/v22.* | tail -1)/bin/node}"
NODE_DIR="$(dirname "$NODE_BIN")"
ANVIL="${ANVIL:-$HOME/.foundry/bin/anvil}"
BUILD="${BUILD_DIR:-dist-p2p-test}"
unset NODE_OPTIONS

cleanup() { [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null; [ -n "${ANVIL_PID:-}" ] && kill "$ANVIL_PID" 2>/dev/null; return 0; }
trap cleanup EXIT

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "✦ buildeando la web en ${BUILD}…"
  PATH="$NODE_DIR:$PATH" PARCEL_WORKERS=0 npx parcel build src/dapp.html \
    --dist-dir "$BUILD" --public-url ./ --cache-dir .parcel-cache-p2p-test > /tmp/build-p2p.log 2>&1 || {
      echo "✗ falló el build — mirá /tmp/build-p2p.log"; tail -20 /tmp/build-p2p.log; exit 1; }
fi
[ -f "$BUILD/dapp.html" ] || { echo "✗ no hay $BUILD/dapp.html"; exit 1; }

pkill -f "remote-debugging-port=9412" 2>/dev/null
"$ANVIL" --fork-url "${FORK_URL:-https://mainnet.base.org}" --port "$PUERTO" --silent --retries 12 --fork-retry-backoff 1500 > /tmp/anvil-p2p.log 2>&1 &
ANVIL_PID=$!
python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 --directory "$BUILD" > /tmp/web-p2p.log 2>&1 &
WEB_PID=$!
for _ in $(seq 1 40); do
  curl -s -m 2 -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' "http://127.0.0.1:$PUERTO" | grep -q result && break
  sleep 0.5
done

BASE="http://127.0.0.1:${WEB_PORT}/dapp.html" RPC="http://127.0.0.1:$PUERTO" "$NODE_BIN" tests/p2p-pago-ui-fork.mjs
