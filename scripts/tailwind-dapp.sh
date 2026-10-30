#!/usr/bin/env bash
# Compila el CSS de Tailwind de dapp.html (src/css/tailwind-dapp.css).
# Antes lo generaba en el navegador el script de cdn.tailwindcss.com: código de un tercero,
# sin versión fija, corriendo en la misma página que tiene las llaves. Ahora sale de acá,
# con la misma versión que servía la CDN (3.4.17). Correrlo después de usar clases nuevas;
# deploy.sh y build-apk.sh lo corren solos antes de buildear.
set -euo pipefail
cd "$(dirname "$0")/.."
npx -y tailwindcss@3.4.17 -c tailwind.dapp.config.cjs \
  -i src/css/tailwind-dapp.src.css -o src/css/tailwind-dapp.css --minify 2>&1 | grep -v '^$' || true
test -s src/css/tailwind-dapp.css
