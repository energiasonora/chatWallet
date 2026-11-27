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

## Libro en junas (Ğ1) · libro.chatwallet.org

Venta del PDF pagada en Ğ1, **aparte de /book y con interruptor** (el autor la abre en los
mercados de junas). Código en `src/libro-g1.js`; páginas estáticas en `libro/` (binding `ASSETS`,
`run_worker_first`: en `api.chatwallet.org` la API queda igual, las páginas sólo fuera de ese host).

- `libro.chatwallet.org` — página pública (ES/FR). Crea un pedido `CPS-XXXXX` y muestra el QR
  `june://<cuenta>?amount=…&comment=<código>` (lo leen Ğecko y ChatWallet).
- El Worker busca en el indexador (squid) transferencias a la cuenta con ese comentario; si suman
  el precio, crea la compra (`purchases`, network `g1`) y la página pasa sola a «Descargar».
- El código es público (queda en la cadena); la descarga sale sólo con la clave `s` del pedido,
  que guarda el navegador del comprador. `/purchases?address=` no lista compras en Ğ1.
- `libro.chatwallet.org/admin` — abrir/cerrar, precio, cuenta que cobra (muestra de quién es en la
  cadena), pedidos, «Marcar pagado» a mano (sin comentario / indexador caído) y QR de descarga.
  Usa el mismo `ADMIN_TOKEN` que book-admin. Cerrar sólo frena pedidos nuevos.
- Tablas nuevas: `settings` y `g1_orders` (en `schema.sql`, `IF NOT EXISTS`).
- **Por ChatWallet (opcional):** el comprador pega su 0x o su enlace de invitación (`?pk=` también:
  el Worker saca la 0x); `/admin/events` emite `libro-g1-chat` al pagarse (o al cargar la 0x si ya
  estaba pago) y el notificador de la caja le manda el enlace desde «Energía Sonora». El PDF (~53 MB)
  no entra en un mensaje XMTP (~1 MB): viaja el enlace.
- Pruebas: `./tests/run-libro-g1.sh` (API 46 + páginas 31, indexador Ğ1 falso y Chrome headless;
  `XMTP=1` suma el envío real por XMTP dev, 5).
