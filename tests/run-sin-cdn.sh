#!/usr/bin/env bash
# Buildea las páginas nuevas junto a las de REF (que usaban CDN y Google Fonts) y las compara en Chrome headless.
set -uo pipefail
cd "$(dirname "$0")/.."

WEB_PORT=8818
NODE_BIN="${NODE_BIN:-$(ls -d "$HOME"/.nvm/versions/node/v22*/bin | tail -1)/node}"
NODE_DIR="$(dirname "$NODE_BIN")"
BUILD="${BUILD_DIR:-dist-cdn-test}"
REF="${REF:-3c97f65}"   # último commit con las CDN
unset NODE_OPTIONS

cleanup() { [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null; rm -f src/*-viejo.html; return 0; }
trap cleanup EXIT

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "✦ buildeando la nueva y la de ${REF} en ${BUILD}…"
  ENTRADAS=()
  for p in dapp index manifiesto book book-admin; do
    git show "${REF}:src/$p.html" > "src/$p-viejo.html"
    ENTRADAS+=("src/$p.html" "src/$p-viejo.html")
  done
  rm -rf "$BUILD"
  PATH="$NODE_DIR:$PATH" PARCEL_WORKERS=0 npx parcel build "${ENTRADAS[@]}" \
    --dist-dir "$BUILD" --public-url ./ --cache-dir .parcel-cache-cdn-test > /tmp/build-sincdn.log 2>&1 || {
      echo "✗ falló el build — mirá /tmp/build-sincdn.log"; tail -20 /tmp/build-sincdn.log; exit 1; }
fi

echo "✦ sirviendo $BUILD en :${WEB_PORT}…"
python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 --directory "$BUILD" > /tmp/web-sincdn.log 2>&1 &
WEB_PID=$!
sleep 1
BASE="http://127.0.0.1:${WEB_PORT}/" "$NODE_BIN" tests/sin-cdn-cdp.mjs
