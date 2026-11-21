#!/usr/bin/env bash
# Copia el panel de uso a la caja y lo arranca en 127.0.0.1:3300, y actualiza el monitor de la caja
# (uso/monitor/monitor.py), que manda los avisos a ChatWallet. No toca ningún otro servicio.
# Después muestra cómo están armados el túnel y el arranque, que es lo que falta para publicarlo
# en uso.chatwallet.org.
#
#   ./uso/instalar-en-la-caja.sh
set -euo pipefail
cd "$(dirname "$0")"
CAJA="${CAJA_HOST:-caja}"

ssh -o ConnectTimeout=8 "$CAJA" 'mkdir -p ~/chatwallet-node/uso/js'
rsync -az -e "ssh -o ConnectTimeout=8" uso-server.mjs panel.html "$CAJA:~/chatwallet-node/uso/"
# El roadmap se edita desde el panel: la copia local (uso/privado, fuera de git) sólo siembra la primera vez.
if [ -f privado/roadmap.json ]; then
  rsync -az --ignore-existing -e "ssh -o ConnectTimeout=8" privado/roadmap.json "$CAJA:~/chatwallet-node/uso/roadmap.json"
fi
# Monitor de la caja: el viejo queda como respaldo con fecha.
ssh -o ConnectTimeout=8 "$CAJA" 'cd ~/chatwallet-node/monitor && [ -f monitor.py.antes-panel ] || cp monitor.py monitor.py.antes-panel'
ssh -o ConnectTimeout=8 "$CAJA" 'cd ~/chatwallet-node/monitor && [ -f xmtp-alert.js.antes-perfil ] || cp xmtp-alert.js xmtp-alert.js.antes-perfil'
rsync -az -e "ssh -o ConnectTimeout=8" monitor/monitor.py monitor/xmtp-alert.js monitor/alerta-avatar.webp monitor/copia-respaldos.sh monitor/limpieza-semanal.sh "$CAJA:~/chatwallet-node/monitor/"
# Entrar con ChatWallet por QR: el módulo propio (js/cw-firma.js, de cw-firma.mjs) y el bundle XMTP
# para el navegador que ya construye Soberano Mail (npm run build:xmtp allá), con su wasm.
XMTP_JS="${XMTP_JS:-$HOME/xunserver/soberano-mail/public/js}"
[ -f "$XMTP_JS/xmtp-bundle.js" ] || { echo "Falta el bundle XMTP en $XMTP_JS (npm run build:xmtp en soberano-mail)"; exit 1; }
rsync -az -e "ssh -o ConnectTimeout=8" js/cw-firma.js "$XMTP_JS/xmtp-bundle.js" "$XMTP_JS/assets" "$CAJA:~/chatwallet-node/uso/js/"

ssh "$CAJA" "AVISO_PRUEBA=${AVISO_PRUEBA:-0} bash -s" <<'REMOTO'
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

# ── Monitor: los avisos van a la ChatWallet de producción (la misma que recibe las ventas) ──
cd ~/chatwallet-node/monitor
if [ ! -f .env ]; then
  DESTINO=$(sed -n 's/^NOTIFY_TO=//p' ~/chatwallet-node/sales-notifier/.env | head -1)
  umask 077; printf 'NOTIFY_TO=%s\nXMTP_ENV=production\n' "$DESTINO" > .env
fi
if [ "${AVISO_PRUEBA:-0}" = 1 ]; then
  echo "── aviso de prueba por ChatWallet ──"
  ( set -a; . ./.env; set +a; export PATH="$HOME/bin:$PATH"
    node xmtp-alert.js "🧪 Prueba del monitor de la caja: si ves esto, los avisos llegan." ) 2>&1 | tail -2 || true
fi
# Reemplazar el monitor por su PID exacto (nunca por patrón).
VIEJO=$(pgrep -f 'python3 +monito[r]\.py' | head -1)
[ -n "$VIEJO" ] && kill "$VIEJO" && sleep 2
~/start-monitor.sh
sleep 40
echo "── monitor ──"
tail -n 8 ~/chatwallet-node/monitor/monitor.log
python3 -c "import json;d=json.load(open('$HOME/www/monitor/status.json'));print('sistema:',d.get('sistema'));print([(s['id'],s['status']) for s in d['services'] if s['status']!='ok'] or 'todo ok')"
cd ~/chatwallet-node/uso

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
