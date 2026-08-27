#!/usr/bin/env bash
# Compila el APK de ChatWallet y VERIFICA el resultado antes de darlo por bueno.
#
# POR QUÉ EXISTE: el WebView de Capacitor abre `index.html` de assets/public, no `dapp.html`.
# Como el build de Parcel emite las cinco entradas del sitio, `index.html` es la LANDING —
# así que el APK arranca mostrando la web promocional en vez de la app. El paso que lo
# arregla (copiar dapp.html sobre index.html) era conocimiento tribal sin script y el
# 27/8/2026 se publicó una 2.25 rota justamente por saltearlo. Por eso acá va verificado:
# si el index.html empaquetado no es la dapp, el script falla y no te deja publicar.
#
# Uso:  ./build-apk.sh dev debug           → el puente (firma debug, XMTP dev)
#       ./build-apk.sh production release  → la app (firma EnergíaSonora, XMTP production)
set -euo pipefail
cd "$(dirname "$0")"

ENV_XMTP="${1:?falta el env: dev | production}"
VARIANT="${2:?falta la variante: debug | release}"
case "$ENV_XMTP" in dev|production) ;; *) echo "✗ env inválido: $ENV_XMTP"; exit 1;; esac
case "$VARIANT"  in debug|release)  ;; *) echo "✗ variante inválida: $VARIANT"; exit 1;; esac

DAPP="src/dapp.html"
AAPT="$HOME/Library/Android/sdk/build-tools/35.0.0/aapt2"
export ANDROID_HOME="$HOME/Library/Android/sdk"
# JDK 21 SIEMPRE, ignorando el JAVA_HOME que traiga el shell: el java del sistema es el 25
# y Gradle 8.11 muere con "Unsupported class file major version 69" o, más traicionero,
# con lintVitalAnalyzeRelease fallando con un escueto "> 25.0.1".
for cand in "$HOME/.local/jdks/jdk-21.0.11+10/Contents/Home" \
            "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
            "$(/usr/libexec/java_home -v 21 2>/dev/null)"; do
  [ -n "$cand" ] && [ -x "$cand/bin/java" ] && { export JAVA_HOME="$cand"; break; }
done
[ -n "${JAVA_HOME:-}" ] || { echo "✗ no encontré un JDK 21"; exit 1; }
"$JAVA_HOME/bin/java" -version 2>&1 | grep -q '"21' || { echo "✗ JAVA_HOME no es un JDK 21: $JAVA_HOME"; exit 1; }

# El env vive en una sola constante de dapp.html. Se cambia, se buildea y se restaura,
# para no dejar el árbol de trabajo apuntando a una red que no es la del deploy.
ORIG_ENV=$(grep -oE "const XMTP_ENV = '[a-z]+'" "$DAPP" | grep -oE "'[a-z]+'" | tr -d "'")
restaurar() { sed -i '' "s/const XMTP_ENV = '[a-z]*';/const XMTP_ENV = '${ORIG_ENV}';/" "$DAPP"; }
trap restaurar EXIT
sed -i '' "s/const XMTP_ENV = '[a-z]*';/const XMTP_ENV = '${ENV_XMTP}';/" "$DAPP"
echo "✦ XMTP_ENV = ${ENV_XMTP} (el árbol vuelve a '${ORIG_ENV}' al terminar)"

# ── 1. Build web ──
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
unset NODE_OPTIONS
echo "✦ Parcel con Node $(node -v)…"
PARCEL_WORKERS=0 yarn parcel build src/index.html src/book.html src/dapp.html src/manifiesto.html src/book-admin.html \
  --dist-dir dist-apk --public-url ./ --cache-dir .parcel-cache-apk >/dev/null

# ── 2. EL paso que se olvida: el WebView abre index.html ──
cp dist-apk/dapp.html dist-apk/index.html
grep -q "walletScreen\|dapp\." dist-apk/index.html || { echo "✗ index.html no quedó siendo la dapp"; exit 1; }
echo "✦ index.html = dapp.html ($(wc -c < dist-apk/index.html | tr -d ' ') bytes)"

# ── 3. Empaquetar ──
export PATH="$HOME/.nvm/versions/node/v20.19.0/bin:$PATH"
npx cap copy android >/dev/null
echo "✦ assets copiados al proyecto Android"
( cd android && ./gradlew "assemble${VARIANT^}" --no-daemon -q )
APK="android/app/build/outputs/apk/${VARIANT}/app-${VARIANT}.apk"
[ -f "$APK" ] || { echo "✗ no se generó $APK"; exit 1; }

# ── 4. Verificar el APK, no el árbol de trabajo ──
echo ""
echo "── verificación del APK empaquetado ──"
"$AAPT" dump badging "$APK" 2>/dev/null | grep -oE "versionCode='[0-9]+' versionName='[^']+'" | sed 's/^/   /'

# OJO: nada de `unzip … | grep -q`. Con pipefail, grep -q cierra el pipe apenas encuentra
# la primera coincidencia, unzip se come un SIGPIPE y el pipeline entero da error — o sea
# que un APK sano se reporta como roto. Se extrae una vez a disco y se verifica ahí.
IDX=$(mktemp)
trap 'rm -f "$IDX"; restaurar' EXIT
unzip -p "$APK" assets/public/index.html > "$IDX"
IDX_BYTES=$(wc -c < "$IDX" | tr -d ' ')

if grep -q "dapp\." "$IDX"; then
  echo "   ✓ index.html es la dapp (${IDX_BYTES} bytes)"
else
  echo "   ✗ index.html NO es la dapp (${IDX_BYTES} bytes) — el APK abriría la landing"; exit 1
fi

APK_ENV=$(grep -oE 'XMTP_ENV="[a-z]+"' "$IDX" | head -1 || true)
if [ "$APK_ENV" = "XMTP_ENV=\"${ENV_XMTP}\"" ]; then
  echo "   ✓ red: ${ENV_XMTP}"
else
  echo "   ✗ red equivocada dentro del APK: ${APK_ENV:-no encontrada}"; exit 1
fi

KT="$JAVA_HOME/bin/keytool"
FIRMA=$("$KT" -printcert -jarfile "$APK" 2>/dev/null | grep -i "Owner:" | head -1 | sed 's/^[[:space:]]*//')
echo "   firma: ${FIRMA}"
if [ "$VARIANT" = "release" ]; then
  echo "$FIRMA" | grep -q "EnergiaSonora" || { echo "   ✗ el release no está firmado por EnergíaSonora"; exit 1; }
fi

echo ""
echo "✅ $APK"
