#!/usr/bin/env bash
# Publica el nodo Ğ1 de la caja como wss://g1.chatwallet.org por el túnel de Cloudflare que ya
# sirve stealthpay/backup/ntfy/relay/uso. Lo corre el usuario desde la Mac:
#   ./poc/g1-nodo/exponer-en-el-tunel.sh            agrega la entrada, crea el DNS, reinicia el túnel
#   ./poc/g1-nodo/exponer-en-el-tunel.sh --deshacer vuelve al config anterior y reinicia el túnel
#                                                   (el registro DNS se borra a mano en Cloudflare:
#                                                   sin la entrada, g1.chatwallet.org da 404)
# Reiniciar el túnel corta ~40 s las otras páginas de la caja (530 de Cloudflare).
# El nodo corre con --rpc-external, que deja los métodos en «safe»: los que cambian algo del nodo
# (rotar llaves, agregar pares…) los rechaza. Sólo se exponen las consultas públicas.
set -euo pipefail
DESHACER=0; [ "${1:-}" = "--deshacer" ] && DESHACER=1
NOMBRE="g1.chatwallet.org"

ssh caja DESHACER="$DESHACER" NOMBRE="$NOMBRE" bash -s <<'REMOTO'
set -euo pipefail
export PATH="$HOME/bin:$HOME/.local/bin:$PATH"
CONF=~/.cloudflared/config.yml
COPIA=~/.cloudflared/config.yml.antes-de-g1

if [ "$DESHACER" = 1 ]; then
  [ -f "$COPIA" ] || { echo "No hay copia $COPIA: nada que deshacer."; exit 1; }
  cp "$COPIA" "$CONF"
  echo "Config restaurado (sin $NOMBRE)."
else
  echo "1/4 ¿Responde el nodo en la caja?"
  curl -sf -m 5 -H 'Content-Type: application/json' \
    -d '{"id":1,"jsonrpc":"2.0","method":"system_health","params":[]}' http://127.0.0.1:9944 \
    || { echo "El nodo no responde en localhost:9944. ¿Está corriendo g1-nodo?"; exit 1; }
  echo

  echo "2/4 Entrada en el config del túnel"
  if grep -q "hostname: $NOMBRE" "$CONF"; then
    echo "   ya estaba."
  else
    cp "$CONF" "$COPIA"
    # va justo antes de la regla final (http_status:404), que tiene que quedar última
    awk -v h="$NOMBRE" '
      /^  - service: http_status:404/ && !hecho { print "  - hostname: " h; print "    service: http://localhost:9944"; hecho=1 }
      { print }
      END { if (!hecho) exit 3 }' "$COPIA" > "$CONF.nuevo" \
      || { echo "No encontré la regla final http_status:404; no toqué nada."; rm -f "$CONF.nuevo"; exit 1; }
    mv "$CONF.nuevo" "$CONF"
    echo "   agregada (copia del anterior: $COPIA)."
  fi
  cloudflared tunnel --config "$CONF" ingress validate
  cloudflared tunnel --config "$CONF" ingress rule "https://$NOMBRE" | tail -2

  echo "3/4 Registro DNS"
  if salida=$(cloudflared tunnel route dns stealthpay "$NOMBRE" 2>&1); then
    echo "   $salida" | tail -1
  elif echo "$salida" | grep -qi "already exists"; then
    echo "   ya existía."
  else
    echo "$salida"; echo "No pude crear el DNS; el config ya quedó cambiado (no molesta: sin DNS nadie llega)."; exit 1
  fi
fi

echo "4/4 Reinicio del túnel (corta ~40 s las otras páginas)"
# por PID, nunca por patrón: el proceso cloudflared hijo del bucle supervisor de start-cloudflared.sh
PID=$(ps -eo pid=,args= | awk '$2=="cloudflared" && /tunnel run stealthpay$/ {print $1}')
[ -n "$PID" ] && [ "$(echo "$PID" | wc -l)" = 1 ] || { echo "No encontré un único cloudflared de stealthpay (encontré: '$PID'). Reinicialo a mano."; exit 1; }
LINEAS=$(wc -l < ~/cloudflared.log)
kill "$PID"
echo "   paré el PID $PID; el supervisor lo vuelve a levantar en 5 s."
for i in $(seq 1 30); do
  sleep 3
  if tail -n +"$((LINEAS+1))" ~/cloudflared.log | grep -q "Registered tunnel connection"; then
    echo "   túnel conectado de nuevo."; break
  fi
  [ "$i" = 30 ] && { echo "   El túnel no volvió en 90 s. Mirá: tail -30 ~/cloudflared.log"; exit 1; }
done
REMOTO

[ "$DESHACER" = 1 ] && { echo "Listo: $NOMBRE ya no llega al nodo."; exit 0; }

echo
echo "Prueba desde afuera (el DNS nuevo puede tardar un minuto):"
for i in $(seq 1 12); do
  if r=$(curl -sf -m 10 -H 'Content-Type: application/json' \
        -d '{"id":1,"jsonrpc":"2.0","method":"chain_getFinalizedHead","params":[]}' "https://$NOMBRE"); then
    echo "   HTTPS: $r"; break
  fi
  [ "$i" = 12 ] && { echo "   https://$NOMBRE todavía no responde; probá de nuevo en unos minutos."; exit 1; }
  sleep 10
done
node -e '
const ws = new WebSocket("wss://" + process.argv[1]);
const t = setTimeout(() => { console.log("   WebSocket: sin respuesta en 15 s"); process.exit(1); }, 15000);
ws.onopen = () => ws.send(JSON.stringify({id:1,jsonrpc:"2.0",method:"chain_getHeader",params:[]}));
ws.onmessage = (e) => { const h = JSON.parse(e.data).result; console.log("   WebSocket: último bloque #" + parseInt(h.number, 16)); clearTimeout(t); ws.close(); };
ws.onerror = (e) => { console.log("   WebSocket: error", e.message || ""); process.exit(1); };
' "$NOMBRE"
echo
echo "Listo. Probalo en el explorador: https://chatwallet.org/g1/?bloque=3757000&nodo=wss://$NOMBRE"
