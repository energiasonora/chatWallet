#!/bin/bash
# Levanta el notificador XMTP de ventas si no está corriendo (idempotente, estilo caja).
# Instalación en la caja: cron @reboot sleep 25 && ~/chatwallet-node/sales-notifier/start-sales-notifier.sh
#
# El guardián NO es el cron: es ~/chatwallet-node/monitor/monitor.py, que chequea el pgrep
# cada ~30s y llama a ESTE script como restart_cmd (servicio "sales_notifier"). Por eso
# alcanza con que sea idempotente y por eso no hace falta un cron */5: sería un segundo
# guardián compitiendo con el monitor.
DIR="$(cd "$(dirname "$0")" && pwd)"
# patrón con corchete: no se matchea a sí mismo ni al comando ssh que lo invoca
if pgrep -f 'node.*sales-notifie[r]\.mjs' > /dev/null; then
  echo "sales-notifier ya corre"
  exit 0
fi
cd "$DIR"
setsid nohup node sales-notifier.mjs >> notifier.log 2>&1 < /dev/null &
sleep 2
# El fallo va a stderr: el cron guardián manda stdout a /dev/null y solo registra errores
pgrep -f 'node.*sales-notifie[r]\.mjs' > /dev/null && echo "sales-notifier arriba 🟢" || { echo "$(date '+%F %T') NO arrancó — ver notifier.log" >&2; exit 1; }
