#!/usr/bin/env bash
# Levanta el nodo soberano local para probar el uploader de Docs en esta máquina:
#   - Kubo daemon (gateway :8080, API :5001)
#   - upload-server autenticado (:3100) que pinea en Kubo
# Ctrl-C corta ambos. Mañana esto vive en la caja always-on de casa.
set -euo pipefail
cd "$(dirname "$0")/../.."

export IPFS_PATH="$HOME/.ipfs"
export PATH="$HOME/.nvm/versions/node/v20.19.0/bin:$PATH"

cleanup() { echo; echo "⏹  parando…"; kill "${KUBO_PID:-}" "${UP_PID:-}" 2>/dev/null || true; ipfs shutdown 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "▶ Kubo daemon…"
ipfs daemon > /tmp/ipfs-daemon.log 2>&1 &
KUBO_PID=$!

# Esperar API REAL (ojo: 'ipfs id' da falso positivo en modo offline).
for i in $(seq 1 30); do
  curl -s -X POST "http://127.0.0.1:5001/api/v0/id" >/dev/null 2>&1 && { echo "  ✓ Kubo API lista"; break; }
  sleep 1
done

echo "▶ upload-server (:3100)…"
node poc/ipfs-node/upload-server.mjs > /tmp/upload-server.log 2>&1 &
UP_PID=$!
sleep 2

echo
echo "✅ Nodo soberano arriba:"
echo "   gateway : http://127.0.0.1:8080/ipfs/<cid>"
echo "   upload  : http://127.0.0.1:3100/api/ipfs/upload"
echo "   (la dapp ya apunta acá: GATEWAY_BASE + IPFS_UPLOAD_URL en dapp.html)"
echo
echo "Ahora, en OTRA terminal, corré la dapp:  yarn start   (o parcel)"
echo "y probá la pestaña Docs. Ctrl-C acá para parar el nodo."
echo
wait
