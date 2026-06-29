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
  format           TEXT,          -- digital | physical | pickup (se guarda; el cobro por formato llega en Capa 1)
  created_at       INTEGER,       -- epoch ms
  last_download_at INTEGER        -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_purchases_address ON purchases(address);

-- Anti-replay: un txHash sólo se puede canjear una vez.
CREATE TABLE IF NOT EXISTS used_tx_hashes (
  tx_hash  TEXT PRIMARY KEY,
  address  TEXT,
  token    TEXT,
  used_at  INTEGER               -- epoch ms
);
