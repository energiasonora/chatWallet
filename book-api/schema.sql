-- ════════════════════════════════════════════════
--  D1 schema · chatwallet-purchases
--  Aplicar con:
--    wrangler d1 execute chatwallet-purchases --file=schema.sql            (local)
--    wrangler d1 execute chatwallet-purchases --remote --file=schema.sql   (producción)
-- ════════════════════════════════════════════════

-- Compras confirmadas on-chain. El token (PK) es el id de descarga.
CREATE TABLE IF NOT EXISTS purchases (
  token            TEXT PRIMARY KEY,
  address          TEXT NOT NULL,
  tx_hash          TEXT NOT NULL,
  downloads        INTEGER NOT NULL DEFAULT 0,
  amount_eth       TEXT,
  block_number     INTEGER,
  network          TEXT,
  format           TEXT,          -- digital | physical (= físico+digital) | physical-only | pickup (legacy)
  lang             TEXT,          -- es | fr → qué edición del PDF sirve /download
  created_at       INTEGER,       -- epoch ms
  last_download_at INTEGER,       -- epoch ms
  discount_code    TEXT           -- código de descuento aplicado (si hubo), para el panel/contabilidad
);
-- DB ya existente (prod): correr una vez → ALTER TABLE purchases ADD COLUMN lang TEXT;
-- DB ya existente (prod): correr una vez → ALTER TABLE purchases ADD COLUMN discount_code TEXT;

CREATE INDEX IF NOT EXISTS idx_purchases_address ON purchases(address);

-- Códigos de descuento. Se validan y aplican SIEMPRE server-side (nunca se
-- confía en el % que manda el navegador): /validateCode (público, solo lectura)
-- para que el frontend muestre el precio; /verifyPayment y /order recalculan.
CREATE TABLE IF NOT EXISTS discount_codes (
  code           TEXT PRIMARY KEY,   -- se guarda en mayúsculas
  discount_pct   INTEGER NOT NULL,   -- 1-100
  valid_from     INTEGER NOT NULL,   -- epoch ms
  valid_until    INTEGER NOT NULL,   -- epoch ms
  format         TEXT,               -- NULL = todos los formatos; o digital|physical|physical-only
  max_uses       INTEGER,            -- NULL = sin límite
  uses           INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1,
  note           TEXT,               -- uso interno (a quién/por qué), no se muestra al comprador
  created_at     INTEGER NOT NULL
);

-- Anti-replay: un txHash sólo se puede canjear una vez.
CREATE TABLE IF NOT EXISTS used_tx_hashes (
  tx_hash  TEXT PRIMARY KEY,
  address  TEXT,
  token    TEXT,
  used_at  INTEGER               -- epoch ms
);

-- Pedidos: dirección + contacto para coordinar la entrega (crypto o Mercado Pago).
-- Consultar:  wrangler d1 execute chatwallet-purchases --remote --command "SELECT * FROM orders ORDER BY created_at DESC"
-- Avanzar etapa (la ve el comprador en book.html?pedido=CW-XXXXXX):
--   wrangler d1 execute chatwallet-purchases --remote --command "UPDATE orders SET stage=2 WHERE public_id='CW-XXXXXX'"
--   stage: 1 = pedido creado · 2 = imprimiendo (físico) / verificando pago (digital) · 3 = en distribución / PDF enviado
CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id        TEXT UNIQUE,       -- "CW-XXXXXX": id de seguimiento que ve el comprador
  stage            INTEGER NOT NULL DEFAULT 1,
  created_at       INTEGER NOT NULL,  -- epoch ms
  payment_method   TEXT,              -- crypto | mercadopago
  format           TEXT,
  country          TEXT,
  lang             TEXT,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  address          TEXT,
  city             TEXT,
  cp               TEXT,
  notes            TEXT,
  tx_hash          TEXT,
  wallet_address   TEXT,
  -- Mercado Pago (Checkout Pro): el webhook /mpWebhook completa estos campos
  mp_preference_id TEXT,              -- checkout creado para este pedido
  mp_payment_id    TEXT,              -- pago acreditado (llega por webhook)
  ars_amount       INTEGER,           -- monto ARS cobrado (dólar blue al crear el pedido)
  paid             INTEGER NOT NULL DEFAULT 0,
  paid_at          INTEGER,           -- epoch ms de la acreditación (webhook MP) — lo usa /admin/events
  download_token   TEXT,              -- token de /download emitido al acreditarse (si incluye PDF)
  delivery_pref    TEXT,              -- correo | coordinar (AMBA: entrega coordinada con el autor)
  tracking         TEXT,              -- código o URL de seguimiento del envío (lo carga el panel; visible en orderStatus)
  email_sent_at    INTEGER,           -- epoch ms del último email exitoso AL COMPRADOR (visible en el panel)
  discount_code    TEXT,              -- código de descuento aplicado (si hubo)
  discount_pct     INTEGER            -- % aplicado (guardado aparte: el código puede cambiar/desactivarse después)
);
-- DB ya existente (prod): correr una vez →
--   ALTER TABLE orders ADD COLUMN paid_at INTEGER;
--   ALTER TABLE orders ADD COLUMN delivery_pref TEXT; ALTER TABLE orders ADD COLUMN tracking TEXT;
--   ALTER TABLE orders ADD COLUMN email_sent_at INTEGER;
--   ALTER TABLE orders ADD COLUMN discount_code TEXT; ALTER TABLE orders ADD COLUMN discount_pct INTEGER;
