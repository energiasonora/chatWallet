#!/bin/bash
# Segunda copia de lo que guarda el nodo IPFS de la caja (los respaldos de chat), en la Samsung 300E.
#
# Reemplaza a sync-gateway-pins.sh (cron */30), que pineaba en rhm-desktop con un SSH por CID: esa
# ráfaga saturaba el disco de aquella máquina, que además murió el 18/11/2026. Desde entonces los
# respaldos tenían UNA sola copia.
#
# Cómo funciona:
#   · cada CID pineado se exporta como archivo CAR (`ipfs dag export`) en ~/respaldos-car, una vez;
#   · rsync manda a la Samsung sólo los archivos nuevos, en una sola conexión, con una llave que
#     sólo puede escribir en ~/respaldos-ipfs (rrsync -wo). Allá no hace falta IPFS: para
#     restaurar, `ipfs dag import <archivo>.car`;
#   · también va una foto del padrón de respaldos (qué CID es el último de cada wallet);
#   · nunca se borra nada del otro lado: si acá se perdieran pins, la copia sigue.
#   · la copia del sitio (lo que publica IPNS) no se copia: ya vive en Cloudflare y en git.
#
# Cron (una vez por día de madrugada; si falla, reintenta cada hora hasta las 05:30):
#   30 0-5 * * * ~/chatwallet-node/monitor/copia-respaldos.sh
# El estado queda en ~/www/monitor/copia.json: lo lee el monitor (avisa si pasan 36 h sin copia)
# y lo muestra el panel. `--forzar` corre aunque ya se haya hecho hoy o esté fuera de horario.
set -uo pipefail
export PATH="$HOME/bin:$PATH"

DESTINO="${COPIA_DESTINO:-rhm@samsung.local}"
# El nombre .local (mDNS) a veces no resuelve desde la caja (pasó el 21/11/2026: 6 intentos
# fallidos con la Samsung prendida). Si no resuelve, se usa la IP fija de la LAN.
SAMSUNG_IP="${COPIA_SAMSUNG_IP:-192.168.1.45}"
if [ -z "${COPIA_DESTINO:-}" ] && ! getent hosts samsung.local >/dev/null 2>&1; then
  DESTINO="rhm@$SAMSUNG_IP"
fi
LLAVE="${COPIA_LLAVE:-$HOME/.ssh/id_respaldos_samsung}"
CARS="$HOME/respaldos-car"
ESTADO="$HOME/www/monitor/copia.json"
LOG="$HOME/chatwallet-node/monitor/copia-respaldos.log"
PADRON="$HOME/chatwallet-node/backup-pointers.json"
HOY=$(date +%F)

log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }
anterior() { python3 -c "import json,sys;print(json.load(open('$ESTADO')).get('$1',''))" 2>/dev/null; }
anotar() {   # anotar <ok|error> <detalle> [cids] [nuevos] [mb]
  python3 - "$ESTADO" "$@" <<'PY'
import json, sys, time
ruta, res, detalle = sys.argv[1], sys.argv[2], sys.argv[3]
try: e = json.load(open(ruta))
except Exception: e = {}
e["ultimo_intento"] = int(time.time())
e["resultado"] = res
e["detalle"] = detalle
if res == "ok":
    e["ultimo_ok"] = int(time.time())
    e["cids"], e["nuevos"], e["mb"] = int(sys.argv[4]), int(sys.argv[5]), float(sys.argv[6])
    e["fallas_seguidas"] = 0
else:
    e["fallas_seguidas"] = e.get("fallas_seguidas", 0) + 1
json.dump(e, open(ruta + ".tmp", "w"), indent=1); __import__("os").replace(ruta + ".tmp", ruta)
PY
}

FORZAR=0; [ "${1:-}" = "--forzar" ] && FORZAR=1
if [ $FORZAR = 0 ]; then
  H=$(date +%-H)
  [ "$H" -ge 6 ] && exit 0                                   # sólo de madrugada
  ULT=$(anterior ultimo_ok); [ -n "$ULT" ] && [ "$(date -d "@$ULT" +%F)" = "$HOY" ] && exit 0   # ya se hizo hoy
fi
exec 9>"$CARS.lock"; flock -n 9 || exit 0                     # una sola corrida a la vez
mkdir -p "$CARS" "$(dirname "$ESTADO")"
log "arranca"

SITIO=$(ipfs name resolve 2>/dev/null | sed 's#^/ipfs/##')
PINS=$(ipfs pin ls --type recursive -q 2>/dev/null) || { anotar error "ipfs no contesta"; log "ipfs no contesta"; exit 1; }
[ -n "$PINS" ] || { anotar error "el nodo no tiene pins (¿se borró el pinset?)"; log "sin pins"; exit 1; }

NUEVOS=0; TOTAL=0; FALLO=""
for cid in $PINS; do
  [ "$cid" = "$SITIO" ] && continue
  TOTAL=$((TOTAL + 1))
  [ -s "$CARS/$cid.car" ] && continue
  if nice -n 19 ipfs dag export --progress=false "$cid" > "$CARS/$cid.car.tmp" 2>>"$LOG"; then
    mv "$CARS/$cid.car.tmp" "$CARS/$cid.car"; NUEVOS=$((NUEVOS + 1))
  else
    rm -f "$CARS/$cid.car.tmp"; FALLO="no se pudo exportar $cid"; log "$FALLO"
  fi
done
cp "$PADRON" "$CARS/padron-$HOY.json" 2>/dev/null
ls -1t "$CARS"/padron-*.json 2>/dev/null | tail -n +31 | xargs -r rm -f   # 30 fotos del padrón

if ! rsync -a --ignore-existing --exclude '*.tmp' --exclude '*.lock' \
     -e "ssh -i $LLAVE -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15" \
     "$CARS/" "$DESTINO:" >>"$LOG" 2>&1; then
  anotar error "rsync a la Samsung falló (¿apagada o fuera de la red?)"; log "rsync falló"; exit 1
fi
# El padrón del día cambia aunque tenga el mismo nombre: ese sí se pisa.
rsync -a -e "ssh -i $LLAVE -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15" \
  "$CARS/padron-$HOY.json" "$DESTINO:" >>"$LOG" 2>&1

MB=$(du -sm "$CARS" | cut -f1)
if [ -n "$FALLO" ]; then
  anotar error "$FALLO (lo demás se copió)"; exit 1
fi
anotar ok "copiados $NUEVOS nuevos de $TOTAL" "$TOTAL" "$NUEVOS" "$MB"
log "ok: $NUEVOS nuevos de $TOTAL, $MB MB"
