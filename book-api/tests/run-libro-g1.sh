#!/bin/bash
# Pruebas del libro en junas (Ğ1): API (46) + páginas en Chrome headless (31).
# Con XMTP=1 suma el envío por ChatWallet de punta a punta: copia del notificador de la caja
# + dos identidades nuevas en XMTP dev (autor y comprador) que leen lo que les llegó (5).
# Levanta un indexador Ğ1 falso (:8799) y el Worker local (:8787) con estado aparte.
#   ./tests/run-libro-g1.sh            → ambas
#   FOTOS=/algún/dir ./tests/run-libro-g1.sh   → guarda capturas de la página
set -e
cd "$(dirname "$0")/.."
export PATH="$HOME/.nvm/versions/node/v22.23.4/bin:$PATH"; unset NODE_OPTIONS
EST=$(mktemp -d)
printf '%%PDF-1.4\n%% libro ES de prueba\n' > "$EST/es.pdf"; printf '%%PDF-1.4\n%% livre FR de test\n' > "$EST/fr.pdf"
npx wrangler d1 execute chatwallet-purchases --local --persist-to "$EST/d" --file=schema.sql > /dev/null
npx wrangler r2 object put chatwallet-book/cryptoParaSoberanos-v34b.pdf --file="$EST/es.pdf" --local --persist-to "$EST/d" > /dev/null
npx wrangler r2 object put chatwallet-book/cryptoPourSouverains-v34b.pdf --file="$EST/fr.pdf" --local --persist-to "$EST/d" > /dev/null
node tests/g1-squid-falso.mjs > "$EST/squid.log" 2>&1 & SQ=$!
# --local-upstream: wrangler dev reescribe el host con el de la 1.ª ruta (api.), que esconde las páginas
npx wrangler dev --local --persist-to "$EST/d" --port 8787 --local-upstream libro.chatwallet.org \
  --var ADMIN_TOKEN:admin-prueba --var TOKEN_SECRET:secreto-prueba --var G1_SQUIDS:http://127.0.0.1:8799 > "$EST/wrangler.log" 2>&1 & WR=$!
trap 'kill $SQ $WR 2>/dev/null || true; pkill -f "remote-debugging-port=9461" 2>/dev/null || true; rm -rf "$EST"' EXIT
for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:8787/g1/estado && break; sleep 1; done
node tests/libro-g1-api.mjs
npx wrangler d1 execute chatwallet-purchases --local --persist-to "$EST/d" --command "DELETE FROM g1_orders; DELETE FROM settings; DELETE FROM purchases;" > /dev/null
node tests/libro-g1-pagina.mjs ${FOTOS:-}
if [ -n "${XMTP:-}" ]; then
  N="$EST/notificador"; mkdir -p "$N"
  cp ../poc/sales-notifier/sales-notifier.mjs ../poc/sales-notifier/brand-avatar.webp ../poc/sales-notifier/package.json "$N/"
  ln -s "$PWD/../poc/sales-notifier/node_modules" "$N/node_modules"
  npx wrangler d1 execute chatwallet-purchases --local --persist-to "$EST/d" --command "DELETE FROM g1_orders; DELETE FROM settings; DELETE FROM purchases;" > /dev/null
  node tests/libro-g1-notificador.mjs "$N"
fi
