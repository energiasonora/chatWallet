#!/usr/bin/env bash
# Pone en marcha la segunda copia de los respaldos (caja → Samsung 300E) y apaga la vieja
# (sync-gateway-pins.sh hacia rhm-desktop, muerta). Se corre UNA vez desde la Mac:
#
#   ./uso/monitor/instalar-copia.sh
#
# 1. La caja genera una llave propia para esto (id_respaldos_samsung).
# 2. La Samsung la acepta SOLO para escribir en ~/respaldos-ipfs (rrsync -wo): con esa llave no
#    se puede leer, borrar ni abrir una consola allá.
# 3. Copia el script y el monitor/panel nuevos (instalar-en-la-caja.sh).
# 4. Cron de la caja: sale sync-gateway-pins.sh (*/30), entra copia-respaldos.sh (00:30, reintentos
#    hasta las 05:30). El crontab anterior queda en ~/crontab.antes-copia.bak.
# 5. Primera corrida forzada y verificación de lo que llegó.
set -euo pipefail
cd "$(dirname "$0")/.."
CAJA="${CAJA_HOST:-caja}"
SAMSUNG="${SAMSUNG_HOST:-rhm@192.168.1.45}"
SAMSUNG_LLAVE="${SAMSUNG_LLAVE:-$HOME/.ssh/caja_ed25519}"
ss() { ssh -o ConnectTimeout=8 -o IdentitiesOnly=yes -i "$SAMSUNG_LLAVE" "$SAMSUNG" "$@"; }

echo "── 1. llave de la caja ──"
PUB=$(ssh -o ConnectTimeout=8 "$CAJA" '[ -f ~/.ssh/id_respaldos_samsung ] || ssh-keygen -q -t ed25519 -N "" -C respaldos-caja -f ~/.ssh/id_respaldos_samsung; cat ~/.ssh/id_respaldos_samsung.pub')
echo "$PUB"

echo "── 2. la Samsung la acepta sólo para escribir en ~/respaldos-ipfs ──"
ss "mkdir -p ~/respaldos-ipfs && chmod 700 ~/respaldos-ipfs && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
    grep -qF '$(echo "$PUB" | cut -d' ' -f2)' ~/.ssh/authorized_keys || echo 'command=\"/usr/bin/rrsync -wo /home/rhm/respaldos-ipfs\",restrict $PUB' >> ~/.ssh/authorized_keys
    grep -c respaldos-caja ~/.ssh/authorized_keys"

echo "── 3. script, monitor y panel ──"
./uso/instalar-en-la-caja.sh > /tmp/instalar-caja.log 2>&1 || { tail -20 /tmp/instalar-caja.log; exit 1; }
tail -n 4 /tmp/instalar-caja.log

echo "── 4. cron ──"
ssh -o ConnectTimeout=8 "$CAJA" 'bash -s' <<'REMOTO'
set -e
chmod +x ~/chatwallet-node/monitor/copia-respaldos.sh
[ -f ~/crontab.antes-copia.bak ] || crontab -l > ~/crontab.antes-copia.bak
{ crontab -l | sed 's|^\(\*/30 \* \* \* \* /home/xunorus/sync-gateway-pins.sh\)$|# apagado 19/11/2026 (rhm-desktop murió; reemplazo: copia-respaldos.sh) \1|' \
             | grep -v 'copia-respaldos.sh'
  echo '30 0-5 * * * /home/xunorus/chatwallet-node/monitor/copia-respaldos.sh'; } | crontab -
crontab -l | grep -E 'sync-gateway|copia-respaldos'
REMOTO

echo "── 5. primera copia (forzada) ──"
ssh -o ConnectTimeout=8 "$CAJA" '~/chatwallet-node/monitor/copia-respaldos.sh --forzar; echo "salida=$?"; cat ~/www/monitor/copia.json; tail -n 3 ~/chatwallet-node/monitor/copia-respaldos.log'
echo "── en la Samsung ──"
ss 'ls ~/respaldos-ipfs | wc -l; du -sh ~/respaldos-ipfs'
echo "── la llave no sirve para otra cosa (tiene que fallar) ──"
ssh -o ConnectTimeout=8 "$CAJA" 'ssh -i ~/.ssh/id_respaldos_samsung -o IdentitiesOnly=yes -o BatchMode=yes rhm@samsung.local "ls /" 2>&1 | head -2' || true
