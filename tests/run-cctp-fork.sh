#!/usr/bin/env bash
# Buildea la web a un dist aparte, levanta forks de Base y Ethereum y pasa USDC con CCTP v2.
set -uo pipefail
cd "$(dirname "$0")/.."

WEB_PORT=8863
P_BASE=8561
P_ETH=8562
NODE_BIN="${NODE_BIN:-$(ls -d "$HOME"/.nvm/versions/node/v22.* | tail -1)/bin/node}"
NODE_DIR="$(dirname "$NODE_BIN")"
ANVIL="${ANVIL:-$HOME/.foundry/bin/anvil}"
BUILD="${BUILD_DIR:-dist-cctp-test}"
unset NODE_OPTIONS

cleanup() { for p in "${WEB_PID:-}" "${AB_PID:-}" "${AE_PID:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null; done; return 0; }
trap cleanup EXIT

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "✦ buildeando la web en ${BUILD}…"
  PATH="$NODE_DIR:$PATH" PARCEL_WORKERS=0 npx parcel build src/dapp.html \
    --dist-dir "$BUILD" --public-url ./ --cache-dir .parcel-cache-cctp-test > /tmp/build-cctp.log 2>&1 || {
      echo "✗ falló el build — mirá /tmp/build-cctp.log"; tail -20 /tmp/build-cctp.log; exit 1; }
fi
[ -f "$BUILD/dapp.html" ] || { echo "✗ no hay $BUILD/dapp.html"; exit 1; }

"$ANVIL" --fork-url "${FORK_BASE:-https://base-rpc.publicnode.com}" --port "$P_BASE" --silent --retries 12 --fork-retry-backoff 1500 > /tmp/anvil-cctp-base.log 2>&1 &
AB_PID=$!
"$ANVIL" --fork-url "${FORK_ETH:-https://ethereum-rpc.publicnode.com}" --port "$P_ETH" --silent --retries 12 --fork-retry-backoff 1500 > /tmp/anvil-cctp-eth.log 2>&1 &
AE_PID=$!
python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 --directory "$BUILD" > /tmp/web-cctp.log 2>&1 &
WEB_PID=$!
for P in $P_BASE $P_ETH; do
  for _ in $(seq 1 40); do
    curl -s -m 2 -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' "http://127.0.0.1:$P" | grep -q result && break
    sleep 0.5
  done
done

BASE="http://127.0.0.1:${WEB_PORT}/dapp.html" RPC_BASE="http://127.0.0.1:$P_BASE" RPC_ETH="http://127.0.0.1:$P_ETH" "$NODE_BIN" tests/cctp-fork.mjs
