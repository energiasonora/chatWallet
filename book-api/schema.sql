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
  last_download_at INTEGER        -- epoch ms
);
-- DB ya existente (prod): correr una vez → ALTER TABLE purchases ADD COLUMN lang TEXT;

CREATE INDEX IF NOT EXISTS idx_purchases_address ON purchases(address);

-- Anti-replay: un txHash sólo se puede canjear una vez.
CREATE TABLE IF NOT EXISTS used_tx_hashes (
  tx_hash  TEXT PRIMARY KEY,
  address  TEXT,
  token    TEXT,
  used_at  INTEGER               -- epoch ms
);

-- Pedidos físicos: dirección + contacto para coordinar el envío (crypto o Mercado Pago).
-- Consultar:  wrangler d1 execute chatwallet-purchases --remote --command "SELECT * FROM orders ORDER BY created_at DESC"
CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at     INTEGER NOT NULL,  -- epoch ms
  payment_method TEXT,              -- crypto | mercadopago
  format         TEXT,
  country        TEXT,
  lang           TEXT,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  address        TEXT,
  city           TEXT,
  cp             TEXT,
  notes          TEXT,
  tx_hash        TEXT,
  wallet_address TEXT
);
