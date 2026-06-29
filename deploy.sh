#!/usr/bin/env bash
# Publica chatWallet a Firebase Hosting bumpeando la versión automáticamente.
#   - Sube la versión visible en dapp.html (v X.YY alpha)
#   - Sincroniza el cache del service worker con esa versión (fuerza refresh del PWA)
#   - Buildea con Node 22 (lo exige @xmtp/browser-sdk) y despliega con Node 20 (donde vive el CLI de firebase)
# Uso:  ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

DAPP="src/dapp.html"
SW="src/service-worker.js"
GRADLE="android/app/build.gradle"

export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

# ── 1. Bump de la versión visible: "v 1.04 alpha" -> "v 1.05 alpha" ──
CUR_NUM=$(grep -oE 'v [0-9]+\.[0-9]+ alpha' "$DAPP" | head -1 | grep -oE '[0-9]+\.[0-9]+')
MAJOR=${CUR_NUM%.*}
MINOR=${CUR_NUM#*.}
NEW_MINOR=$(printf "%02d" "$((10#$MINOR + 1))")
NEW_NUM="${MAJOR}.${NEW_MINOR}"
sed -i '' "s/v ${CUR_NUM} alpha/v ${NEW_NUM} alpha/" "$DAPP"
echo "✦ Versión app: $CUR_NUM -> $NEW_NUM"

# ── 2. Sincronizar cache del service worker con la versión ──
sed -i '' -E "s/(const CACHE_NAME = ')[^']+(';)/\1chatwallet-cache-${NEW_NUM}\2/" "$SW"
echo "✦ Service worker cache: chatwallet-cache-${NEW_NUM}"

# ── 2b. Mantener TODO junto en la misma versión (PWA + APK) ──
# Línea "Versión X.YY" del panel de ajustes
sed -i '' -E "s/(Versión )${CUR_NUM}/\1${NEW_NUM}/" "$DAPP"
# APK: versionName = misma versión; versionCode se incrementa (Android lo exige creciente)
if [ -f "$GRADLE" ]; then
  sed -i '' -E "s/(versionName )\"[0-9]+\.[0-9]+\"/\1\"${NEW_NUM}\"/" "$GRADLE"
  CUR_CODE=$(grep -oE 'versionCode [0-9]+' "$GRADLE" | grep -oE '[0-9]+')
  NEW_CODE=$((CUR_CODE + 1))
  sed -i '' -E "s/versionCode [0-9]+/versionCode ${NEW_CODE}/" "$GRADLE"
  echo "✦ APK build.gradle: versionName ${NEW_NUM} / versionCode ${NEW_CODE} (rebuildeá el APK para que tome la versión)"
fi

# ── 3. Build (Node 22) ──
nvm use 22.22.3 >/dev/null
echo "✦ Build con Node $(node -v)…"
# Las páginas de /tools son didácticas y se copian verbatim desde src/static/tools
# (vía parcel-reporter-static-files-copy), NO como entries de Parcel: así no se les
# reescriben los links relativos entre sí.
yarn parcel build src/index.html src/book.html src/dapp.html \
  --dist-dir public --public-url ./ --cache-dir .parcel-cache-build

# ── 4. Deploy (Node 20, donde está firebase CLI) ──
nvm use 20.19.0 >/dev/null
echo "✦ Deploy con Node $(node -v)…"
firebase deploy --only hosting

echo ""
echo "✅ Publicado v${NEW_NUM} → https://chatwallet.org  (hard-refresh o reinstalar PWA para tomar el SW nuevo)"
