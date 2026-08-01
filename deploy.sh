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
# Línea "Versión X.YY" del panel de ajustes. OJO: se ancla al id, NO al texto "Versión",
# porque desde la i18n (v1.93) hay un <span> en el medio ("Versión</span> 1.95") y el patrón
# viejo dejó de matchear en silencio: la versión del panel quedó congelada en 1.92 mientras
# el resto subía. No es cosmético — getCurrentVersion() lee de ahí, así que el auto-updater
# se creía desactualizado para siempre y ofrecía bajar el APK que ya tenías instalado.
sed -i '' -E "s|(id=\"settingsVersionText\".*)${CUR_NUM}|\1${NEW_NUM}|" "$DAPP"
grep -q "id=\"settingsVersionText\".*${NEW_NUM}" "$DAPP" || { echo "✗ No se pudo bumpear la versión del panel de ajustes (¿cambió el markup?)"; exit 1; }
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
# OJO: book-admin.html DEBE estar en esta lista. Es autocontenida (todo inline), pero si
# no es entry, Parcel la considera salida huérfana con la cache compartida y la BORRA de
# public/ en el siguiente deploy → el panel de ventas se cae con 404 sin avisar.
yarn parcel build src/index.html src/book.html src/dapp.html src/manifiesto.html src/book-admin.html \
  --dist-dir public --public-url ./ --cache-dir .parcel-cache-build

# ── 4. Deploy (Node 20, donde está firebase CLI) ──
nvm use 20.19.0 >/dev/null
echo "✦ Deploy con Node $(node -v)…"
firebase deploy --only hosting

# ── 5. Verificación post-deploy ──
# Una página que desaparece de public/ NO rompe el build ni el deploy: se cae en silencio
# con 404 (le pasó a book-admin.html entre el 20/7 y el 1/8 de 2026). Si le pasa a book.html
# se pierden ventas sin que nadie se entere, así que acá se chequea a mano.
echo ""
echo "✦ Verificando páginas críticas en producción…"
FALLOS=0
for RUTA in / /book.html /dapp.html /manifiesto.html /book-admin.html /tools/index.html; do
  CODIGO=$(curl -s -o /dev/null -w '%{http_code}' "https://chatwallet.org${RUTA}" || echo "000")
  if [ "$CODIGO" = "200" ]; then
    echo "   ✓ ${RUTA} (${CODIGO})"
  else
    echo "   ✗ ${RUTA} (${CODIGO})  ← NO está publicada"
    FALLOS=$((FALLOS + 1))
  fi
done

echo ""
if [ "$FALLOS" -gt 0 ]; then
  echo "⚠️  Publicado v${NEW_NUM} PERO ${FALLOS} página(s) quedaron caídas."
  echo "   Casi siempre es que falta como entry en el 'yarn parcel build' de arriba."
  exit 1
fi
echo "✅ Publicado v${NEW_NUM} → https://chatwallet.org  (hard-refresh o reinstalar PWA para tomar el SW nuevo)"
