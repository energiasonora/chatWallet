#!/usr/bin/env bash
# Verifica que el token de Cloudflare tenga los tres permisos que necesitamos.
# No modifica nada: la purga de prueba es de UN archivo inexistente (inofensiva).
#
# Uso:  ./cf-check-token.sh
set -uo pipefail
cd "$(dirname "$0")"

[ -f .cloudflare.env ] && . ./.cloudflare.env
: "${CF_API_TOKEN:?Falta CF_API_TOKEN — poné el token en .cloudflare.env}"
ZONE_NAME="${CF_ZONE_NAME:-chatwallet.org}"
API=https://api.cloudflare.com/client/v4
FALLOS=0

api() { curl -s -H "Authorization: Bearer $CF_API_TOKEN" -H "content-type: application/json" "$@"; }
ok()  { python3 -c 'import sys,json;d=json.load(sys.stdin);print("OK" if d.get("success") else "FAIL "+json.dumps(d.get("errors"),ensure_ascii=False))' 2>/dev/null || echo "FAIL (respuesta ilegible)"; }

echo "── 0. El token es válido ──"
R=$(api "$API/user/tokens/verify" | ok); echo "   $R"
[ "${R:0:2}" = "OK" ] || { echo "   → el token no sirve o está mal copiado"; exit 1; }

echo "── 1. Zone:Read (para resolver la zona) ──"
ZR=$(api "$API/zones?name=${ZONE_NAME}")
ZONE_ID=$(echo "$ZR" | python3 -c 'import sys,json;d=json.load(sys.stdin);r=d.get("result") or [];print(r[0]["id"] if d.get("success") and r else "",end="")')
if [ -n "$ZONE_ID" ]; then echo "   OK  zona ${ZONE_NAME} = ${ZONE_ID}"
else echo "   FAIL  $(echo "$ZR" | ok)"; echo "   → falta el permiso Zone → Read (o la zona no está en esta cuenta)"; FALLOS=$((FALLOS+1)); fi

if [ -n "$ZONE_ID" ]; then
  # OJO: consultar el entrypoint de la fase devuelve 10003 "could not find entrypoint
  # ruleset" cuando la zona todavía no tiene ninguna cache rule. Eso NO es falta de
  # permiso — es el estado inicial normal. Por eso la sonda de permisos es el LISTADO
  # de rulesets, que responde 200 si el token puede leerlos.
  echo "── 2. Leer Cache Rules (permiso de rulesets) ──"
  RR=$(api "$API/zones/${ZONE_ID}/rulesets")
  # Parseo JSON, NO grep: la API responde '"success": true' CON espacio y un
  # grep de '"success":true' da falso negativo.
  if [ "$(echo "$RR" | ok)" = "OK" ]; then
    echo "   OK  puedo listar rulesets"
    EP=$(api "$API/zones/${ZONE_ID}/rulesets/phases/http_request_cache_settings/entrypoint")
    if [ "$(echo "$EP" | ok)" != "OK" ]; then
      echo "   ·   la zona aún no tiene cache rules (se crea la primera al aplicar)"
    fi
  else
    echo "   FAIL  $(echo "$RR" | ok)"
    echo "   → falta Cache Rules → Edit (en cuentas viejas aparece como Zone Settings → Edit)"
    FALLOS=$((FALLOS+1))
  fi

  echo "── 3. Cache Purge ──"
  PR=$(api -X POST "$API/zones/${ZONE_ID}/purge_cache" \
        --data '{"files":["https://'"${ZONE_NAME}"'/__token-check-inexistente__"]}')
  if [ "$(echo "$PR" | ok)" = "OK" ]; then echo "   OK  puedo purgar"
  else echo "   FAIL  $(echo "$PR" | ok)"; echo "   → falta Cache Purge → Purge"; FALLOS=$((FALLOS+1)); fi
fi

echo ""
if [ "$FALLOS" -gt 0 ]; then
  echo "✗ Faltan ${FALLOS} permiso(s). Editá el token en:"
  echo "  https://dash.cloudflare.com/profile/api-tokens"
  exit 1
fi
echo "✅ El token tiene todo lo necesario. Siguiente:  ./cf-cache-rule.sh --dry-run"
