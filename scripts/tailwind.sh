#!/usr/bin/env bash
# Compila el CSS de Tailwind de las páginas que lo usan (dapp.html y manifiesto.html).
# Antes lo generaba en el navegador el script de cdn.tailwindcss.com: código de un tercero,
# sin versión fija, corriendo en la misma página que tiene las llaves. Ahora sale de acá,
# con la misma versión que servía la CDN (3.4.17). Correrlo después de usar clases nuevas;
# deploy.sh y build-apk.sh lo corren solos antes de buildear.
set -euo pipefail
cd "$(dirname "$0")/.."
for pag in dapp manifiesto; do
  npx -y tailwindcss@3.4.17 -c "tailwind.$pag.config.cjs" \
    -i src/css/tailwind.src.css -o "src/css/tailwind-$pag.css" --minify 2>&1 | grep -v '^$\|rowserslist\|update-browserslist\|update-db' || true
  test -s "src/css/tailwind-$pag.css"
done
