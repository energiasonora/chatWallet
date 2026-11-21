#!/usr/bin/env bash
# Que no se llene el disco de la caja (21/11/2026). Se corre UNA vez desde la Mac:
#
#   ./uso/monitor/instalar-espacio.sh
#
# 1. Monitor y panel nuevos: vigilan / y /mnt/backups, avisan al 85 % y si al ritmo que vienen
#    se llenan en menos de 14 días (instalar-en-la-caja.sh, que ahora también sube la limpieza).
# 2. Backups de RHM comprimidos (zstd): rhm-backup.sh y el vigía de las 07:30, desde el repo
#    rhmseguros/scripts. Las versiones de la caja quedan como *.antes-zst.
# 3. Cron: limpieza semanal los domingos a las 04:00.
# 4. Comprime una vez los .sql que ya hay, en la caja y en la Samsung (se verifica cada .zst
#    antes de borrar el .sql; la fecha del archivo se conserva, así la poda de 30 días sigue igual).
set -euo pipefail
cd "$(dirname "$0")/../.."   # raíz del repo
CAJA="${CAJA_HOST:-caja}"
RHM="${RHM_REPO:-$HOME/xunserver/rhmseguros}"
SAMSUNG="${SAMSUNG_HOST:-rhm@192.168.1.45}"
SAMSUNG_LLAVE="${SAMSUNG_LLAVE:-$HOME/.ssh/caja_ed25519}"

echo "── 1. monitor, panel y script de limpieza ──"
./uso/instalar-en-la-caja.sh > /tmp/instalar-caja.log 2>&1 || { tail -20 /tmp/instalar-caja.log; exit 1; }
grep -A2 '── monitor ──' /tmp/instalar-caja.log | tail -2

echo "── 2. backups de RHM comprimidos ──"
ssh -o ConnectTimeout=8 "$CAJA" '[ -f ~/rhm-backup.sh.antes-zst ] || cp ~/rhm-backup.sh ~/rhm-backup.sh.antes-zst
  W=~/.openclaw/workspace; [ -f $W/check_rhm_backups.sh.antes-zst ] || cp $W/check_rhm_backups.sh $W/check_rhm_backups.sh.antes-zst'
scp -q "$RHM/scripts/rhm-backup.sh" "$CAJA:rhm-backup.sh"
scp -q "$RHM/scripts/check_rhm_backups.sh" "$CAJA:.openclaw/workspace/check_rhm_backups.sh"
ssh -o ConnectTimeout=8 "$CAJA" 'chmod +x ~/rhm-backup.sh ~/.openclaw/workspace/check_rhm_backups.sh; bash -n ~/rhm-backup.sh && bash -n ~/.openclaw/workspace/check_rhm_backups.sh && echo "scripts ok"'

echo "── 3. cron de la limpieza ──"
ssh -o ConnectTimeout=8 "$CAJA" 'chmod +x ~/chatwallet-node/monitor/limpieza-semanal.sh
  { crontab -l | grep -v limpieza-semanal.sh; echo "0 4 * * 0 /home/xunorus/chatwallet-node/monitor/limpieza-semanal.sh"; } | crontab -
  crontab -l | grep limpieza'

COMPRIMIR='cd ~/backups/rhm-d1 && n=0 && for f in *.sql; do [ -f "$f" ] || continue
  if zstd -q -6 "$f" -o "$f.zst" && zstd -q -t "$f.zst"; then touch -r "$f" "$f.zst"; rm -f "$f"; n=$((n+1)); else rm -f "$f.zst"; echo "✘ $f"; fi
done; echo "comprimidos: $n · quedan .sql: $(ls *.sql 2>/dev/null | wc -l)"; du -sh .'

echo "── 4a. comprimir lo que ya hay en la caja (unos minutos) ──"
ssh -o ConnectTimeout=8 "$CAJA" "$COMPRIMIR"
echo "── 4b. ídem en la Samsung ──"
ssh -o ConnectTimeout=8 -o IdentitiesOnly=yes -i "$SAMSUNG_LLAVE" "$SAMSUNG" "nice -n 19 bash -c '$COMPRIMIR'"

echo "── espacio ──"
ssh -o ConnectTimeout=8 "$CAJA" 'df -h / /mnt/backups | tail -2'
echo "(la caché de npm, ~5 GB en /, la borra la limpieza del domingo; para hacerlo ya: ssh caja ~/chatwallet-node/monitor/limpieza-semanal.sh)"
