# POC · OrbitDB + identidad Ethereum + permisos on-chain

Valida que OrbitDB encaja con los requisitos del proyecto:
**base de datos soberana, descentralizada, resistente al walkaway, con la address
Ethereum como llave admin y DIDs interoperables con otras dapps EVM.**

Aislado del proyecto principal (su propio `package.json`/`node_modules`) para no
contaminar las deps de chatWallet mientras evaluamos.

## Las 3 piezas

| Archivo | Qué hace |
|---|---|
| `src/eth-identity-provider.js` | Identity provider de OrbitDB que firma con una wallet ethers (secp256k1). El `id` de la identidad **es la address**; se deriva `did:pkh:eip155:<chainId>:<address>` (interoperable EVM). |
| `src/onchain-access-controller.js` | Access controller cuyo `canAppend` resuelve la address del firmante, verifica la cadena de firmas y **pregunta a un contrato** `isWriter(address)` si puede escribir. Cae a allowlist en memoria si no hay RPC (modo offline del POC). |
| `src/libp2p-browser.js` | Config libp2p para browser (WS + WebRTC + circuit relay) — el grueso del peso de bundle. |

## Correr

```bash
nvm use 22
npm install
npm start          # dev server Parcel
# o build de producción:
npm run build      # -> dist/
```

Verificación headless (sin playwright, CDP puro):

```bash
python3 -m http.server 8099 --directory dist &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --remote-debugging-port=9222 --user-data-dir=/tmp/poc-chrome &
node cdp-verify.mjs 9222 http://localhost:8099/
```

## Resultados medidos (2026-06-13, Node 22)

- **Build Parcel: OK.** Bundle `1.74 MB raw / ~536 KB gzip`. **Sin WASM** (la cripto
  usa `@noble/*` en JS) → más simple de bundlear que XMTP.
- **Runtime headless: OK end-to-end.** Address→DID, Helia inicia, identidad válida
  (`id == address`, firma verificada), DB abierta con el AC, escritura permitida por
  el contrato/allowlist y releída.

### Gotchas de bundling (importantes para el proyecto real)
1. **Parcel ignora el campo `exports` por defecto.** Helia/libp2p son ESM-only con
   solo `exports`. Hay que activarlo en `package.json`:
   ```json
   "@parcel/resolver-default": { "packageExports": true }
   ```
   ⚠️ Si se integra en chatWallet, este flag es global al proyecto → re-testear el
   bundle de XMTP después de activarlo.

## Test del caso negativo (permisos dictados por contrato) — ✅ PASA

Prueba que el contrato realmente decide quién escribe, con dos wallets:
- `contracts/WriterAllowlist.sol` — `owner` + `setWriter` + `isWriter(address)`.
- `deploy.mjs` — compila (solc), despliega en anvil y autoriza SOLO a wallet A.
- `test-onchain.mjs` — A escribe ✅, B (no autorizada) es rechazada por el AC ❌.

```bash
anvil --silent &                       # cadena EVM local
nvm use 22
node deploy.mjs                         # despliega + autoriza A -> deployed.json
node test-onchain.mjs                   # corre el test
```

Resultado (2026-06-13):
```
✅ Wallet A (autorizada on-chain) ESCRIBIÓ
✅ Wallet B (NO autorizada) RECHAZADA: "is not allowed to write to the log"
✅ TEST OK — 2 pasaron, 0 fallaron
```
El único cambio para autorizar/denegar es on-chain (`setWriter`); el AC y el identity
provider quedan intactos. La decisión del AC es **por identidad del firmante**, no por
DB (por eso B usa su propia DB con el mismo AC, sin necesitar replicación entre nodos).

Notas Node: OrbitDB exige `pubsub` (gossipsub) en el libp2p; cada nodo necesita su
propio `path` de keystore (si no, choca el LOCK de LevelDB).

## Test de replicación cross-node (descentralización / walkaway) — ✅ PASA

Dos nodos OrbitDB independientes conectados por TCP: A escribe, B recibe la entrada
peer-a-peer, sin servidor central.

```bash
nvm use 22
node test-replication.mjs
```

Resultado (2026-06-13):
```
✓ B conectado a A vía TCP
✓ A escribió
✅ REPLICACIÓN OK — B recibió 1 entry de A, peer-a-peer
```
Requiere transport (TCP en Node; en browser sería WebSockets/WebRTC + circuit relay)
y pubsub/gossipsub en ambos nodos.

## Próximos pasos (no cubiertos por este POC)
- Apuntar el AC a un contrato de roles real / la allowlist de `ChatSmartAccountFactory`
  en una testnet (cambiar `rpcUrl` + `contractAddress`).
- Replicación en BROWSER entre máquinas distintas (WebRTC + circuit-relay alcanzable;
  acá se probó node-a-node por TCP).
- Estrategia de **pinning** (usuarios + pinning service) — sin esto, el walkaway no
  se sostiene: IPFS hace GC y el dato se evapora.
- En browser, el AC consultando el contrato vía RPC público (verificar CORS del RPC).
