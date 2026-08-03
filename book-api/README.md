# chatWallet · Book API (Cloudflare Worker)

Backend de venta del libro, migrado desde Firebase Cloud Functions a un Worker de Cloudflare
(D1 para compras, R2 para el PDF). Paridad 1:1 con el `functions/index.js` viejo.

- **Worker:** `chatwallet-book-api` → ruteado a `https://api.chatwallet.org/*`
- **D1:** `chatwallet-purchases` (tablas `purchases`, `used_tx_hashes`)
- **R2:** `chatwallet-book` (objeto `cryptoParaSoberanos-v23d.pdf`)

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/verifyPayment` | Valida la tx on-chain (Arbitrum + Chainlink) y emite token de descarga |
| `GET`  | `/download?token=` | Sirve el PDF desde R2, gated por token |
| `GET`  | `/purchases?address=` | Lista las compras de una address |

## Puesta en marcha (una sola vez)

> Requiere **node 22** (el del sistema es v12). Usá `nvm use 22` antes de cada comando.

```bash
cd book-api
nvm use 22
npm install
npx wrangler login          # abre el browser, autenticás tu cuenta CF

# 1. Crear D1 y pegar el database_id que imprime en wrangler.toml
npx wrangler d1 create chatwallet-purchases
#   → copiá "database_id" al campo correspondiente de wrangler.toml

# 2. Aplicar el schema (local y remoto)
npm run schema:local
npm run schema:remote

# 3. Crear el bucket R2 y subir el PDF del libro
npx wrangler r2 bucket create chatwallet-book
#   (descargá antes el PDF de Firebase Storage; ponelo en ./cryptoParaSoberanos-v23d.pdf)
npx wrangler r2 object put chatwallet-book/cryptoParaSoberanos-v23d.pdf --file=./cryptoParaSoberanos-v23d.pdf

# 4. Setear el secreto del token
npx wrangler secret put TOKEN_SECRET
#   → pegá un valor largo y aleatorio (NO el placeholder)

# 5. Probar local
npm run dev
#   en otra terminal: curl "http://localhost:8787/purchases?address=0x0"

# 6. Deploy
npm run deploy
```

## DNS

El registro `api.chatwallet.org` se crea solo al hacer `wrangler deploy` porque la zona
`chatwallet.org` ya está en Cloudflare (misma cuenta que el gateway `freeway`). Si no,
agregá un CNAME proxied a `chatwallet-book-api.workers.dev`.

## Notas

- El `/download` ahora sirve el PDF **a través del Worker** (gated por token en D1), en vez del
  signed-URL temporal de Firebase. R2 tiene egress gratis, así que no hay costo de salida.
- `format` se guarda en `purchases` pero el cobro sigue siendo $10 fijo (paridad). El cobro por
  formato (digital/físico/pickup) llega en la **Capa 1**.
- `/purchases` devuelve el token como `id` (igual que Firebase) porque el frontend lo usa como
  token de descarga al detectar una compra previa.
