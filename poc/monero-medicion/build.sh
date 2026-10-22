#!/usr/bin/env bash
set -e; cd "$(dirname "$0")"
cp node_modules/monero-ts/dist/monero.worker.js web/
npx -y esbuild@0.24.0 pagina.mjs --bundle --format=iife --platform=browser --outfile=web/pagina.js --log-limit=0 \
  --alias:child_process=./vacio.cjs --alias:fs=./vacio.cjs --alias:path=./vacio.cjs --alias:net=./vacio.cjs --alias:tls=./vacio.cjs \
  --alias:http=./agente.cjs --alias:https=./agente.cjs --define:global=globalThis --inject:./shim.js
