#!/bin/bash
# Arma los modelos con la Flor de la Vida sobre la landing ya compilada (dist-landing-test).
# Uso: disenos/landing-flor/armar.sh  → abrir http://127.0.0.1:8819/flor/
set -e
cd "$(dirname "$0")"
DIST=../../dist-landing-test
mkdir -p "$DIST/flor"
cp flor.js flor.css "$DIST/flor/"
CSS=$(grep -o 'href=[^ >]*\.css' "$DIST/index.html" | head -1 | sed 's/href=//')
sed "s#../fonts/fuentes-landing.css#../$CSS#" index.html > "$DIST/flor/index.html"
armar() { # $1 archivo  $2 modos  $3 etiqueta
  # El HTML compilado viene minificado (sin </head> ni </body>): va antes del primer <style> y al final.
  sed -e "1,/<style>/s#<style>#<link rel=stylesheet href=flor/flor.css><script>document.documentElement.setAttribute('data-flor','$2')</script><style>#" \
      "$DIST/index.html" > "$DIST/$1"
  printf '%s' "<a class=flor-etiqueta href=flor/>$3 · ver todos</a><script src=flor/flor.js></script>" >> "$DIST/$1"
}
armar flor-1-halo.html       "halo cinta"                    "1 · Halo"
armar flor-2-semilla.html    "semilla cinta"                 "2 · Semilla que crece"
armar flor-3-meditacion.html "meditacion cinta"              "3 · Meditación"
armar flor-4-trama.html      "trama cinta"                   "4 · Trama"
armar flor-5-todo.html       "halo semilla meditacion cinta" "5 · Todo junto"
echo ok
