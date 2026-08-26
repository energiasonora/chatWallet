#!/usr/bin/env bash
# Crea (o actualiza) la Cache Rule de chatwallet.org en Cloudflare.
#
# POR QUÉ: chatwallet.org va Cloudflare → Firebase Hosting (que por debajo es Fastly)
# → origen de Google. Hoy Cloudflare responde `cf-cache-status: DYNAMIC`, o sea que NO
# cachea nada: cada visita depende de que Fastly esté sano en ese instante. El 12/8/2026
# un usuario en Costa Rica comió un "Error 503 backend read error" de Varnish/Fastly
# (POP de Miami) y nunca llegó a la app. Con la página cacheada en el borde, ese hipo
# no habría llegado a nadie.
#
# QUÉ HACE LA REGLA:
#   · cachea todo chatwallet.org (es un sitio estático: no hay API en este hostname,
#     firebase.json no rutea nada a functions).
#   · IGNORA EL QUERY STRING en la cache key. Es lo más importante: los links de
#     invitación son /dapp?address=…&pk=… y con la key por defecto cada invitación
#     sería una entrada nueva → MISS siempre → seguiríamos expuestos exactamente en
#     la URL que falló. El HTML es idéntico para cualquier query (lo lee el JS).
#   · edge TTL 1 día (el deploy purga, ver deploy.sh), browser TTL el del origen (1h).
#   · serve-stale mientras revalida → si el origen hipa, se sirve la copia vieja.
#
# TOKEN: crear en https://dash.cloudflare.com/profile/api-tokens con permisos de ZONA
# sobre chatwallet.org:  Zone:Read  +  Zone Settings:Edit  +  Cache Purge:Purge
# (el de "Cache Rules" viaja dentro de Zone Settings / Rulesets).
#   export CF_API_TOKEN=...      # o ponerlo en .cloudflare.env (gitignored)
#
# Uso:  ./cf-cache-rule.sh [--dry-run]
set -euo pipefail
cd "$(dirname "$0")"

[ -f .cloudflare.env ] && . ./.cloudflare.env
: "${CF_API_TOKEN:?Falta CF_API_TOKEN (ver cabecera de este script)}"
ZONE_NAME="${CF_ZONE_NAME:-chatwallet.org}"
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1

api() { curl -s -H "Authorization: Bearer $CF_API_TOKEN" -H "content-type: application/json" "$@"; }

# ── 1. Zone ID ──
ZONE_ID=$(api "https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);
r=d.get("result") or []
print(r[0]["id"] if d.get("success") and r else "", end="")')
[ -n "$ZONE_ID" ] || { echo "✗ No pude resolver la zona ${ZONE_NAME} (¿token sin Zone:Read?)"; exit 1; }
echo "✦ Zona ${ZONE_NAME} = ${ZONE_ID}"

# ── 2. Regla ──
RULE_DESC="chatWallet: cachear estático e ignorar query (links de invitación)"
read -r -d '' RULE <<JSON || true
{
  "description": "${RULE_DESC}",
  "expression": "(http.host eq \"${ZONE_NAME}\")",
  "action": "set_cache_settings",
  "enabled": true,
  "action_parameters": {
    "cache": true,
    "edge_ttl":    { "mode": "override_origin", "default": 86400 },
    "browser_ttl": { "mode": "respect_origin" },
    "serve_stale": { "disable_stale_while_updating": false },
    "cache_key": {
      "ignore_query_strings_order": true,
      "custom_key": { "query_string": { "exclude": { "all": true } } }
    }
  }
}
JSON

# ── 3. Leer las reglas que ya existen en la fase (NO pisarlas) ──
PHASE="https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/phases/http_request_cache_settings/entrypoint"
EXISTING=$(api "$PHASE" || true)
echo "✦ Reglas actuales en la fase de cache:"
echo "$EXISTING" | python3 -c '
import sys,json
d=json.load(sys.stdin)
rules=(d.get("result") or {}).get("rules") or []
if not rules:
    print("   (ninguna)")
for r in rules:
    desc = r.get("description") or r.get("id")
    print("   · " + str(desc) + "  [" + str(r.get("expression")) + "]")
' || echo "   (fase vacía o inexistente)"

# Merge: reemplaza la nuestra si ya está (por description), conserva el resto.
BODY=$(python3 -c '
import json,sys
existing=json.loads(sys.argv[1] or "{}")
rule=json.loads(sys.argv[2])
rules=(existing.get("result") or {}).get("rules") or []
rules=[r for r in rules if r.get("description")!=rule["description"]]
rules.append(rule)
keep=lambda r:{k:v for k,v in r.items() if k in ("description","expression","action","action_parameters","enabled")}
print(json.dumps({"rules":[keep(r) for r in rules]}))
' "$EXISTING" "$RULE")

if [ "$DRY" = "1" ]; then
  echo "✦ --dry-run; esto es lo que se mandaría:"; echo "$BODY" | python3 -m json.tool; exit 0
fi

# ── 4. Aplicar ──
RES=$(api -X PUT "$PHASE" --data "$BODY")
echo "$RES" | python3 -c '
import sys,json
d=json.load(sys.stdin)
if not d.get("success"):
    print("✗ Error:", json.dumps(d.get("errors"), ensure_ascii=False)); sys.exit(1)
print("✅ Regla aplicada. Reglas en la fase:")
for r in (d.get("result") or {}).get("rules") or []:
    print("   · " + str(r.get("description")))
'
echo ""
echo "Verificar (esperar unos segundos y pedir dos veces; la 2da debería dar HIT):"
echo "  curl -sI https://${ZONE_NAME}/dapp | grep -i cf-cache-status"
