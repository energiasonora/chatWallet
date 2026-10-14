#!/usr/bin/env bash
# Copia el panel de uso a la caja y lo arranca en 127.0.0.1:3300. No toca ningún otro servicio.
# Después muestra cómo están armados el túnel y el arranque, que es lo que falta para publicarlo
# en uso.chatwallet.org.
#
#   ./uso/instalar-en-la-caja.sh
set -euo pipefail
cd "$(dirname "$0")"
CAJA="${CAJA_HOST:-caja}"

ssh -o ConnectTimeout=8 "$CAJA" 'mkdir -p ~/chatwallet-node/uso'
rsync -az -e "ssh -o ConnectTimeout=8" uso-server.mjs panel.html "$CAJA:~/chatwallet-node/uso/"

ssh "$CAJA" 'bash -s' <<'REMOTO'
set -e
cat > ~/start-uso.sh <<'ARRANQUE'
#!/bin/bash
# Panel de uso de ChatWallet. El guard mira el PUERTO, igual que start-relay.sh.
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
cd "$HOME/chatwallet-node/uso" || exit 1
if (exec 3<>/dev/tcp/127.0.0.1/3300) 2>/dev/null; then exec 3<&-; exit 0; fi
[ -f ./.env ] && { set -a; . ./.env; set +a; }
nohup node uso-server.mjs >> "$HOME/chatwallet-node/uso/uso.log" 2>&1 &
ARRANQUE
chmod +x ~/start-uso.sh

# Secreto de sesión fijo: sin él, cada reinicio te saca del panel.
cd ~/chatwallet-node/uso
if [ ! -f .env ]; then umask 077; echo "USO_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')" > .env; fi

# Si ya corría una versión anterior, se reemplaza por su PID exacto (nunca por patrón).
VIEJO=$(ss -ltnpH 'sport = :3300' 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
[ -n "$VIEJO" ] && kill "$VIEJO" && sleep 1
~/start-uso.sh
# La caja es lenta cargando módulos: se espera hasta 20 s, y si no levanta se muestra por qué.
for i in $(seq 20); do (exec 3<>/dev/tcp/127.0.0.1/3300) 2>/dev/null && break; sleep 1; done
echo "── salud ──"
curl -s -m 5 http://127.0.0.1:3300/api/uso/salud || echo "NO LEVANTÓ"; echo
echo "── registro (últimas líneas) ──"
tail -n 15 ~/chatwallet-node/uso/uso.log 2>/dev/null || true
echo "── módulos a la vista ──"
ls -d ~/chatwallet-node/node_modules/express ~/chatwallet-node/node_modules/ethers 2>&1 || true
ls -ld ~/chatwallet-node
echo "── túnel (sólo nombres y destinos) ──"
grep -E '^\s*(tunnel|- hostname|hostname|service):' ~/.cloudflared-gateway/config.yml || true
echo "── arranque al encender ──"
crontab -l 2>/dev/null | grep -v '^#' || true
grep -l 'start-relay' ~/*.sh 2>/dev/null || true
REMOTO
