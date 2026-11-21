#!/bin/bash
# Limpieza semanal de la caja: sólo cosas que se pueden borrar sin perder nada.
#
#   · logs de la home de más de 50 MB → se quedan con sus últimos 5 MB (se reescribe el mismo
#     archivo, así el proceso que lo tiene abierto sigue escribiendo ahí);
#   · gateway-sync.log: era del script que pineaba en rhm-desktop, apagado el 19/11/2026;
#   · la caché de npm (~/.npm/_cacache): se vuelve a bajar sola cuando hace falta.
#
# NO toca: backups, respaldos, el repo de IPFS, bases, ~/.cache (no se sabe qué hay) ni nada
# fuera de la home. Lo que necesita sudo (journal del sistema, caché de apt) queda a mano.
#
# Cron (domingo 04:00):  0 4 * * 0 ~/chatwallet-node/monitor/limpieza-semanal.sh
# Prueba sin borrar:      ~/chatwallet-node/monitor/limpieza-semanal.sh --ver
set -uo pipefail
export PATH="$HOME/bin:$PATH"
VER=0; [ "${1:-}" = "--ver" ] && VER=1
LOG="$HOME/chatwallet-node/monitor/limpieza.log"
ESTADO="$HOME/www/monitor/limpieza.json"
LIMITE=$((50 * 1024 * 1024)); DEJAR=$((5 * 1024 * 1024))

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }
libre() { df -B1 --output=avail "$HOME" | tail -1 | tr -dc '0-9'; }
ANTES=$(libre)
[ $VER = 1 ] && log "── modo --ver: no se borra nada ──"

# 1. Logs grandes (en la home, sin bajar a node_modules, .ipfs ni otras particiones)
while IFS= read -r -d '' f; do
  t=$(stat -c %s "$f")
  log "log $(numfmt --to=iec "$t") → últimos 5 MB: $f"
  if [ $VER = 0 ]; then
    tail -c "$DEJAR" "$f" > "$f.recorte" && cat "$f.recorte" > "$f" && rm -f "$f.recorte"
  fi
done < <(find "$HOME" -xdev \( -name node_modules -o -name .ipfs -o -name .npm -o -name backups -o -name respaldos-car \) -prune \
              -o -type f -name '*.log' -size +"${LIMITE}c" -print0 2>/dev/null)

# 2. Restos del sync viejo
for f in "$HOME/gateway-sync.log"; do
  [ -f "$f" ] && { log "borro $(du -h "$f" | cut -f1) $f (script apagado)"; [ $VER = 0 ] && rm -f "$f"; }
done

# 3. Caché de npm
if [ -d "$HOME/.npm/_cacache" ]; then
  log "caché de npm: $(du -sh "$HOME/.npm/_cacache" 2>/dev/null | cut -f1)"
  [ $VER = 0 ] && { npm cache clean --force >/dev/null 2>&1 || rm -rf "$HOME/.npm/_cacache"; }
fi

DESPUES=$(libre)
LIBERADO=$(( (DESPUES - ANTES) / 1024 / 1024 ))
log "listo: liberados ${LIBERADO} MB"
if [ $VER = 0 ]; then
  mkdir -p "$(dirname "$ESTADO")"
  printf '{"cuando": %s, "liberado_mb": %s}\n' "$(date +%s)" "$LIBERADO" > "$ESTADO"
fi
