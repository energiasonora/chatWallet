# Spike: nodo IPFS propio como alternativa soberana a Storacha

Objetivo: reemplazar Storacha (muerto) para los **Documentos Verificables** sin depender
de un pinning service de terceros que puede quedarse sin fondos. La base es un **nodo
always-on propio** (Kubo) que pinea + gateway; el browser baja por gateway (HTTP) o por
libp2p (trustless). Nada de terceros nuevos.

Fecha del spike: 2026-07-02. Máquina: Mac de xunorus, Kubo **0.39.0** ya instalado.

## Qué se validó (todo ✓)

1. **Público end-to-end**: `ipfs add --cid-version=1` → `pin add` → retrieve por gateway
   local `http://127.0.0.1:8080/ipfs/<cid>`. Funciona.
2. **CID reproducible en el cliente** (clave para "verificable"): calcular el CID en el
   browser con `multiformats` (raw + sha256, CIDv1) da **exactamente** el mismo CID que
   Kubo para archivos de 1 bloque (< 256 KB). Ver `cid-check.mjs`.
   → el CID que va en la atestación del DID es content-addressing puro y verificable; el
   nodo solo sirve el byte, no es "fuente de verdad".
3. **Privado (compartir en chat)**: cifrar en el cliente (AES-256-GCM, envelope
   `[iv|ciphertext]`) → pinear SOLO el ciphertext → el gateway devuelve **binario opaco**.
   El nodo/gateway nunca ve el plaintext. La **clave viaja por XMTP** junto al CID.
4. **El nodo ES dialable desde browser** (matiza el mito "Helia en browser no sirve"):
   - **WSS vía relay `libp2p.direct`**: `/dns4/<...>.libp2p.direct/tcp/4001/tls/ws/.../p2p-circuit/...`
     — funciona **detrás de NAT** (AutoTLS/AutoWSS de Kubo).
   - **WebTransport** en IP pública: `/ip4/<pub>/udp/4001/quic-v1/webtransport/certhash/...`
     — dialable directo si el UDP 4001 es alcanzable (port-forward).
   → *browser → tu nodo* es viable. Lo que NO es confiable es *browser → browser* sin relay.

## Caveat: archivos grandes (> 256 KB)

`ipfs add` chunkea a 256 KB y arma un DAG UnixFS (`dag-pb`, CID `bafybei...`), NO un raw
simple (`bafkrei...`). Para reproducir ese CID en el browser hay que usar el **mismo
chunker** (256 KB, balanced) con **`@ipld/unixfs`** (ya está en deps del proyecto).
Alternativa: dejar que el nodo calcule el CID en el `add` y confiar en él (menos puro —
para docs verificables conviene calcularlo cliente-side).

## Arquitectura recomendada

```
                    ┌─────────────────────────────────────────────┐
   PÚBLICO          │  Browser (dapp)                             │
   (docs del DID)   │   1. comprimir/normalizar                   │
                    │   2. CID = client-side (multiformats/unixfs)│  ← CID va en la
                    │   3. subir bytes → tu nodo (API/HTTP PUT)   │    atestación DID
                    │   4. guardar CID en atestación DID          │
   PRIVADO          │   privado: cifrar (AES-GCM) ANTES del paso 2│
   (chat)           │            → pinear ciphertext; key+CID→XMTP│
                    └───────────────┬─────────────────────────────┘
                                    │  retrieve
                    ┌───────────────▼─────────────────────────────┐
                    │  TU NODO always-on (Kubo)                   │
                    │   - pinea (durabilidad = tu disco)          │
                    │   - gateway: gateway.chatwallet.org/ipfs/CID│  ← el código ya
                    │   - libp2p WSS/WebTransport (P2P trustless) │    apunta acá
                    │   - opcional: es su propio circuit-relay    │
                    └─────────────────────────────────────────────┘
```

- **Retrieval por defecto = gateway HTTP** (`GATEWAY_BASE` en dapp.html; hoy `w3s.link`,
  cambiar a `gateway.chatwallet.org`). Simple, funciona siempre, cacheable.
- **P2P libp2p (opcional, trustless)**: Helia en el browser dialando tu nodo por
  WebTransport/WSS + verificando el CID contra los bytes. Útil si querés no confiar en el
  gateway. El stack ya está en `poc/orbitdb-eth` (Helia 5, libp2p 2, webrtc, ws, relay-v2).
- **Nodo live en browser**: solo como **caché oportunista** (servís lo que ya tenés
  mientras estás online), NUNCA como capa de durabilidad.
- **Filecoin / pinning pago**: el día que sea resiliente, el **mismo CID** sirve → migrás
  sin romper nada. Cero lock-in.

## Endpoint de subida autenticada (POC, reemplaza el UCAN/VIP de Storacha)

`upload-server.mjs` + `upload-client.mjs`. El browser NO habla con Kubo directo (su API es
poderosa): habla con nuestro server, que autentica por **firma del DID** y pinea en el Kubo
local. Reemplaza `/api/delegate` (que minteaba un UCAN de Storacha).

**Binding por sha256, NO por CID** (decisión clave): reproducir el CID exacto de Kubo en el
browser para archivos grandes es frágil (Kubo chunkea a 256KB con su layout; `@ipld/unixfs`
de Storacha usa otros defaults → CIDs distintos). En vez de eso el cliente firma el **sha256
de los bytes** — size-agnóstico, sin tocar chunking. El CID lo calcula Kubo y el cliente lo
aprende de la respuesta (lo guarda en la atestación DID). La verificabilidad se mantiene: el
CID es content-addressed, cualquier tercero baja por CID e IPFS ya garantiza bytes==CID.

Flujo: cliente calcula `sha256(bytes)` → firma `ipfs-upload:<sha256>:<size>` → POST bytes con
headers `x-address/x-signature/x-sha256/x-size` → server verifica firma + **recomputa sha256
de los bytes recibidos** (integridad, cualquier tamaño) → mete en Kubo
(`/api/v0/add?cid-version=1&pin=true`) → descuenta cuota → devuelve CID + URL de gateway.

Validado (contra Kubo 0.39 real):
- Archivo chico (66 B, raw `bafkrei…`) → **200**, pineado, gateway sha256 coincide ✓
- Archivo grande (1.5 MB, dag-pb `bafybei…`) → **200**, pineado, gateway sha256 coincide ✓
  → el modelo sha256 sirve para CUALQUIER tamaño sin reproducir el chunker de Kubo.
- Firma inválida (otra wallet firmó) → **401** ✓
- Bytes manipulados (sha256 no coincide) → **409** ✓

```bash
export IPFS_PATH="$HOME/.ipfs"; ipfs daemon &          # OJO: 'ipfs id' da falso positivo
                                                        # en modo offline; probar API real:
                                                        # curl -X POST 127.0.0.1:5001/api/v0/id
node poc/ipfs-node/upload-server.mjs &                 # :3100 → habla con Kubo :5001
node poc/ipfs-node/upload-client.mjs /tmp/doc.txt      # test firma/subida/gateway
```

Integración en prod: plegar este handler en `server.js` (ya corre, ya tiene `ethers` +
quotas.json) como `POST /api/ipfs/upload`, y borrar `/api/delegate` + imports ucanto/storacha.

## Pendiente para producción (no en este spike)

- Desplegar Kubo en la caja always-on real (no el Mac). Config: `Gateway`,
  `Addresses.Gateway`, exponer `gateway.chatwallet.org` (reverse proxy + TLS), abrir
  UDP/TCP 4001 o confiar en AutoTLS-relay.
- Endpoint de **subida autenticada** (reemplaza el flujo VIP/cuota de Storacha): el
  browser sube bytes al nodo firmando con el DID (evita que cualquiera pinee gratis).
  Puede vivir en `server.js` (ya corre) hablándole a la API de Kubo (`/api/v0/add`).
- Cliente-side: `@ipld/unixfs` para CID de archivos grandes; AES-GCM para el path privado.
- GC / cuotas de disco en el nodo (`--enable-gc`, `Datastore.StorageMax`).

## Cómo se corrió el spike

```bash
export IPFS_PATH="$HOME/.ipfs"
ipfs daemon --enable-gc &                     # gateway :8080, API :5001
ipfs add -q --cid-version=1 doc.txt           # → CID público
node cid-check.mjs doc.txt                     # CID cliente == CID Kubo (+ demo cifrado)
curl -s http://127.0.0.1:8080/ipfs/<cid>       # retrieve por gateway propio
```
