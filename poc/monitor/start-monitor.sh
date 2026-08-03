#!/bin/bash
# Monitor daemon — starts embedded HTTP dashboard + health check loop
export PATH="$HOME/bin:$PATH"
# OJO con el patrón: el viejo era 'monito[r].*monitor.py', que NO matchea el cmdline real
# ("python3 monitor.py": no hay ningún "monitor" ANTES del "monitor.py"). Solo matcheaba el
# bash -c colgado del lanzamiento, así que si ese moría el guardia fallaba y arrancaba un
# segundo monitor: el 3/8/2026 había DOS corriendo hace 4 días, duplicando alertas XMTP.
# Además ahora se lanza con setsid (como el resto de la caja) para no dejar wrapper colgado.
if pgrep -f 'python3 +monito[r]\.py' > /dev/null; then
  echo "Monitor ya está corriendo"
  exit 0
fi
cd ~/chatwallet-node/monitor
# monitor.py YA escribe cada línea en monitor.log (LOG_FILE). Si además le mandamos el
# stdout ahí, cada línea queda duplicada. stdout va a /dev/null y solo capturamos stderr
# (tracebacks que no pasan por logline) en un archivo aparte.
setsid nohup python3 monitor.py >/dev/null 2>>monitor.boot.log < /dev/null &
sleep 2
if pgrep -f 'python3 +monito[r]\.py' > /dev/null; then
  echo "Monitor arriba 🟢"
else
  echo "$(date '+%F %T') Monitor NO arrancó" >&2
  exit 1
fi
