#!/usr/bin/env bash
# Levanta un fork de Base con anvil y corre el pago de un QR por P2P.me contra el Diamond real.
set -uo pipefail
cd "$(dirname "$0")/.."

PUERTO=8548
NODE_BIN="${NODE_BIN:-$(ls -d "$HOME"/.nvm/versions/node/v22.* | tail -1)/bin/node}"
ANVIL="${ANVIL:-$HOME/.foundry/bin/anvil}"
FORK="${FORK_URL:-https://mainnet.base.org}"
unset NODE_OPTIONS

cleanup() { [ -n "${ANVIL_PID:-}" ] && kill "$ANVIL_PID" 2>/dev/null; return 0; }
trap cleanup EXIT

"$ANVIL" --fork-url "$FORK" --port "$PUERTO" --silent --retries 12 --fork-retry-backoff 1500 > /tmp/anvil-p2p.log 2>&1 &
ANVIL_PID=$!
for _ in $(seq 1 40); do
  curl -s -m 2 -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' "http://127.0.0.1:$PUERTO" | grep -q result && break
  sleep 0.5
done

RPC="http://127.0.0.1:$PUERTO" "$NODE_BIN" tests/p2p-pago-fork.mjs
