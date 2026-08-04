#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
#  Caja soberana · DNS propio con unbound + DNS-over-TLS
#
#  Por qué: el resolver del ISP (Movistar 186.130.12x.250) se pone
#  intermitente por ráfagas — el 3/8/2026 systemd-resolved estuvo saltando
#  UDP↔TCP↔EDNS0 degradado entre 20:59 y 21:05 y se cayeron 10 polls del
#  sales-notifier + el resumen diario ("dns error"). Ni la API ni el enlace
#  estaban caídos: era solo el DNS.
#
#  Qué deja: unbound en 127.0.0.1:53 cacheando localmente y reenviando
#  cifrado por TLS a Quad9 y Cloudflare. El ISP deja de ver y de poder
#  intercalarse en las consultas.
#
#  Uso:  sudo bash setup-unbound-dot.sh
#  Es idempotente: se puede correr de nuevo sin romper nada.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

WIFI_CON="lanusperonista"
WIFI_DEV="wlp3s0"
CONF="/etc/unbound/unbound.conf.d/dot-forward.conf"

if [ "$(id -u)" -ne 0 ]; then
  echo "✗ Correlo con sudo:  sudo bash $0" >&2
  exit 1
fi

# ── 1. Preflight: ¿sale el 853? ─────────────────────────────────────────
# Si el ISP bloquea DoT, abortamos ACÁ, antes de tocar el DNS del sistema.
echo "✦ Probando que el puerto 853 (DoT) salga…"
ALCANZABLES=0
for IP in 9.9.9.9 149.112.112.112 1.1.1.1 1.0.0.1; do
  if timeout 5 bash -c "echo > /dev/tcp/${IP}/853" 2>/dev/null; then
    echo "   ✓ ${IP}:853 responde"
    ALCANZABLES=$((ALCANZABLES + 1))
  else
    echo "   ✗ ${IP}:853 NO responde"
  fi
done
if [ "$ALCANZABLES" -lt 2 ]; then
  echo "✗ Menos de dos upstreams DoT alcanzables — el ISP probablemente bloquea el 853."
  echo "  No toco nada. El DNS de la caja queda como está."
  exit 1
fi

# ── 2. Instalar ─────────────────────────────────────────────────────────
echo "✦ Instalando unbound…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq unbound ca-certificates dnsutils

# El paquete trae un helper que pisa la config con la del DHCP: lo sacamos
# del medio para que mande nuestro forward-zone y no vuelva el DNS del ISP.
systemctl disable --now unbound-resolvconf.service 2>/dev/null || true

# ── 3. Configurar ───────────────────────────────────────────────────────
echo "✦ Escribiendo ${CONF}…"
cat > "$CONF" <<'EOF'
# Gestionado por setup-unbound-dot.sh (repo chatWallet, poc/monitor/).
# Editá el script, no este archivo: se sobrescribe en cada corrida.
server:
    interface: 127.0.0.1
    port: 53
    do-ip4: yes
    do-ip6: no
    prefer-ip6: no

    # Solo la propia caja consulta este resolver (no es un DNS abierto)
    access-control: 127.0.0.0/8 allow
    access-control: 0.0.0.0/0 refuse

    # Caché: el motivo por el que un corte del upstream ya no se siente igual
    cache-min-ttl: 60
    cache-max-ttl: 86400
    prefetch: yes
    prefetch-key: yes

    hide-identity: yes
    hide-version: yes
    qname-minimisation: yes

    # Necesario para validar el certificado de los upstream DoT
    tls-cert-bundle: /etc/ssl/certs/ca-certificates.crt

forward-zone:
    name: "."
    forward-tls-upstream: yes
    # forward-first: no → si el TLS falla NO cae a consultas en claro.
    # Preferimos fallar a filtrar las consultas hacia el ISP.
    forward-first: no
    forward-addr: 9.9.9.9@853#dns.quad9.net
    forward-addr: 149.112.112.112@853#dns.quad9.net
    forward-addr: 1.1.1.1@853#cloudflare-dns.com
    forward-addr: 1.0.0.1@853#cloudflare-dns.com
EOF

echo "✦ Validando la config…"
unbound-checkconf "$CONF" || { echo "✗ Config inválida, no sigo"; exit 1; }

systemctl enable --now unbound
systemctl restart unbound
sleep 2

# ── 4. Verificar unbound ANTES de cambiar el resolver del sistema ───────
echo "✦ Probando unbound en 127.0.0.1…"
if ! dig +short +timeout=5 @127.0.0.1 api.chatwallet.org > /dev/null; then
  echo "✗ unbound no resuelve. NO cambio el DNS del sistema (la caja sigue con el del ISP)."
  echo "  Mirá:  journalctl -u unbound -n 40 --no-pager"
  exit 1
fi
echo "   ✓ resuelve api.chatwallet.org"

# ── 5. Apuntar el sistema a unbound ─────────────────────────────────────
# En vivo con resolvectl (NO reconecta el WiFi: el ssh entra por ahí) y
# persistente con nmcli para los reinicios.
echo "✦ Apuntando el sistema a 127.0.0.1…"
resolvectl dns "$WIFI_DEV" 127.0.0.1
resolvectl domain "$WIFI_DEV" '~.'
nmcli con mod "$WIFI_CON" ipv4.dns 127.0.0.1
nmcli con mod "$WIFI_CON" ipv4.ignore-auto-dns yes

# ── 6. Verificación final ───────────────────────────────────────────────
echo ""
echo "✦ Verificación:"
FALLOS=0
for H in api.chatwallet.org chatwallet.org production.xmtp.network; do
  if getent hosts "$H" > /dev/null 2>&1; then
    echo "   ✓ $H"
  else
    echo "   ✗ $H NO resuelve"
    FALLOS=$((FALLOS + 1))
  fi
done
echo ""
echo "   Resolver en uso:"
resolvectl status "$WIFI_DEV" | grep -E "Current DNS|DNS Servers" | sed 's/^/   /'

if [ "$FALLOS" -gt 0 ]; then
  echo ""
  echo "⚠️  Algo no resuelve. Para volver atrás:"
  echo "   sudo resolvectl revert $WIFI_DEV"
  echo "   sudo nmcli con mod $WIFI_CON ipv4.ignore-auto-dns no"
  echo "   sudo nmcli con mod $WIFI_CON -ipv4.dns 127.0.0.1"
  exit 1
fi

echo ""
echo "✅ DNS soberano andando: unbound + DoT (Quad9 / Cloudflare), caché local."
echo "   Rollback:  sudo resolvectl revert $WIFI_DEV && sudo nmcli con mod $WIFI_CON ipv4.ignore-auto-dns no"
echo "   Estadísticas:  sudo unbound-control stats_noreset | grep -E 'total.num|cache'"
