#!/usr/bin/env bash
# Baja los circuitos de Railgun del IPFS que usa el SDK oficial (@railgun-community/wallet 11.2.0)
# y verifica el sha256 contra la tabla que trae el propio SDK (artifact-v2-hashes.json).
set -euo pipefail
cd "$(dirname "$0")"
MASTER=QmUsmnK4PFc7zDp2cmC4wBZxYLjNyRgWfs5GNcJJ2uLcpU
GW=${GW:-https://ipfs-lb.com}
for v in "${@:-01x02 02x02 03x02 08x02}"; do
  for v1 in $v; do
    mkdir -p "art/$v1"
    curl -sfL --max-time 300 -o "art/$v1/zkey.br" "$GW/ipfs/$MASTER/circuits/$v1/zkey.br"
    curl -sfL --max-time 300 -o "art/$v1/wasm.br" "$GW/ipfs/$MASTER/prover/snarkjs/$v1.wasm.br"
    curl -sfL --max-time 300 -o "art/$v1/vkey.json" "$GW/ipfs/$MASTER/circuits/$v1/vkey.json"
  done
done
# Prueba de inocencia "mini" (hasta 3 entradas y 3 salidas). El SDK la publica como POI_3x3,
# pero en el IPFS vive bajo el directorio del circuito 03x03.
POI=QmZ2MyM6TKxffkv6stuo2hFwmUfs3q4xgMYN164Sje8new
mkdir -p art/POI_3x3
curl -sfL --max-time 300 -o art/POI_3x3/zkey.br "$GW/ipfs/$POI/circuits/03x03/zkey.br"
curl -sfL --max-time 300 -o art/POI_3x3/wasm.br "$GW/ipfs/$POI/prover/snarkjs/03x03.wasm.br"
curl -sfL --max-time 300 -o art/POI_3x3/vkey.json "$GW/ipfs/$POI/circuits/03x03/vkey.json"
node descomprimir.mjs
