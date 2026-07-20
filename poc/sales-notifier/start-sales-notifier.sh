#!/bin/bash
# Levanta el notificador XMTP de ventas si no está corriendo (idempotente, estilo caja).
# Instalación en la caja: cron @reboot sleep 25 && ~/chatwallet-node/sales-notifier/start-sales-notifier.sh
DIR="$(cd "$(dirname "$0")" && pwd)"
if pgrep -f 'node.*sales-notifier\.mjs' > /dev/null; then
  echo "sales-notifier ya corre"
  exit 0
fi
cd "$DIR"
setsid nohup node sales-notifier.mjs >> notifier.log 2>&1 < /dev/null &
sleep 2
pgrep -f 'node.*sales-notifier\.mjs' > /dev/null && echo "sales-notifier arriba 🟢" || { echo "NO arrancó — ver notifier.log"; exit 1; }
