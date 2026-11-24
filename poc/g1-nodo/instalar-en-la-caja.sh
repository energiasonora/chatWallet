#!/usr/bin/env bash
# Instala un nodo espejo de Ğ1 (Duniter v2) en la caja, con podman. Lo corre el usuario:
#   ./poc/g1-nodo/instalar-en-la-caja.sh
# Ver poc/g1-nodo/README.md para qué es, cuánto ocupa y cómo exponerlo.
#   --de-cero   borra lo sincronizado y arranca de nuevo (hace falta para pasar a warp)
set -euo pipefail
DE_CERO=0; [ "${1:-}" = "--de-cero" ] && DE_CERO=1
IMAGEN="docker.io/duniter/duniter-g1-1100:1101-2.3.1"   # 1101 = versión de la red (specVersion) en nov 2026

ssh caja IMAGEN="$IMAGEN" DE_CERO="$DE_CERO" bash -s <<'REMOTO'
set -euo pipefail
cat > ~/start-g1-nodo.sh <<SCRIPT
#!/bin/bash
# Nodo espejo Ğ1 (instalado por chatWallet/poc/g1-nodo). RPC sólo en localhost:9944; afuera
# sale por el túnel de Cloudflare (g1.chatwallet.org), nunca abriendo un puerto.
# El monitor de la caja lo frena a los 10 GB y deja esta marca: con la marca no arranca.
if [ -f ~/g1-nodo-FRENADO ]; then echo "g1-nodo frenado por tamaño: \$(cat ~/g1-nodo-FRENADO)"; exit 0; fi
podman rm -f g1-nodo >/dev/null 2>&1 || true
# warp: baja el estado ya finalizado (con su prueba) en vez de re-ejecutar cada bloque desde
# 2023; la historia de bloques se completa después, sin ejecutarla. La sincronización completa
# medida en la caja iba a 2,6 bloques/s (~2 semanas) y cargaba la caja a 4,8 con 2 núcleos.
# NO_CHECKPOINT: el binario trae un punto de partida incorporado para el warp de Ğ1 que es viejo
# (bloque 84.128): con él, warp saltaba sólo el 2 % y el resto volvía a ser bloque por bloque.
# Sin él, el warp va con las pruebas de GRANDPA de la red hasta lo último finalizado.
# --cpus=1.5: que siempre quede medio núcleo para IPFS, el relayer y los respaldos.
exec podman run -d --name g1-nodo \\
  --memory=1500m --cpus=1.5 \\
  -p 127.0.0.1:9944:9944 \\
  -v g1-datos:/var/lib/duniter \\
  -e DUNITER_CHAIN_NAME=g1 \\
  -e DUNITER_NODE_NAME=chatwallet-caja \\
  -e DUNITER_PRUNING_PROFILE=light \\
  -e DUNITER_SYNC=warp \\
  -e DUNITER_NO_CHECKPOINT=true \\
  -e DUNITER_NO_TELEMETRY=true \\
  -e DUNITER_NO_PROMETHEUS=true \\
  $IMAGEN
SCRIPT
chmod +x ~/start-g1-nodo.sh
echo "Bajando la imagen (~85 MB)…"
podman pull -q "$IMAGEN" >/dev/null
if [ "$DE_CERO" = 1 ]; then
  echo "Borrando lo sincronizado (--de-cero)…"
  podman rm -f g1-nodo >/dev/null 2>&1 || true
  podman volume rm -f g1-datos >/dev/null 2>&1 || true
fi
# Si ya está corriendo, no se reinicia (sólo se actualiza el script de arranque).
podman container exists g1-nodo && [ "$(podman inspect --format '{{.State.Running}}' g1-nodo)" = true ] || ~/start-g1-nodo.sh >/dev/null
# Arranque al encender, como los demás servicios de la caja.
( crontab -l 2>/dev/null | grep -v start-g1-nodo.sh; echo "@reboot sleep 35 && /home/$USER/start-g1-nodo.sh" ) | crontab -
sleep 20
echo "── registro ──"; podman logs --tail 8 g1-nodo 2>&1
echo "── sincronización ──"
curl -s -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"system_syncState","params":[]}' http://127.0.0.1:9944 || echo "(el RPC todavía no responde)"
echo; echo "── disco del volumen ──"; podman unshare du -sh "$(podman volume inspect g1-datos --format '{{.Mountpoint}}')" 2>/dev/null || true
REMOTO
