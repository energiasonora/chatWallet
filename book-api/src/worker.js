// ════════════════════════════════════════════════
//  chatWallet · Book API (Cloudflare Worker)
//  Porteo 1:1 de functions/index.js (Firebase) → Worker + D1 + R2.
//  Endpoints (servidos en api.chatwallet.org):
//    POST /verifyPayment   · valida la tx on-chain y emite token de descarga
//    GET  /download?token= · sirve el PDF desde R2 (gated por token)
//    GET  /purchases?address= · lista compras de una address
// ════════════════════════════════════════════════
import { ethers } from "ethers";

const CHAINLINK_ABI = [
  "function latestRoundData() view returns (uint80, int256 answer, uint256, uint256, uint80)",
  "function decimals() view returns (uint8)",
];

const SIGNED_URL_TTL_MS = 1000 * 60 * 60; // sin uso directo: el download va gated por token en el Worker

// ── Helpers ──────────────────────────────────────

function cfg(env) {
  return {
    PAYMENT_ADDRESS:    env.PAYMENT_ADDRESS,
    BOOK_FILE_KEY:      env.BOOK_FILE_KEY,
    PRICE_USD:          Number(env.PRICE_USD),
    CHAIN_ID:           Number(env.CHAIN_ID),
    RPC_URL:            env.RPC_URL,
    CHAINLINK_FEED:     env.CHAINLINK_FEED,
    SLIPPAGE_TOLERANCE: Number(env.SLIPPAGE_TOLERANCE),
  };
}

async function generateToken(address, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret || "cambia_esto_en_produccion"),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(address.toLowerCase() + Date.now().toString()));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getMinAcceptableWei(C) {
  const provider = new ethers.JsonRpcProvider(C.RPC_URL);
  const feed = new ethers.Contract(C.CHAINLINK_FEED, CHAINLINK_ABI, provider);
  const [decimals, [, answer]] = await Promise.all([feed.decimals(), feed.latestRoundData()]);
  const ethPrice = Number(answer) / Math.pow(10, Number(decimals));
  const ethNeeded = C.PRICE_USD / ethPrice;
  const withTolerance = ethNeeded * (1 - C.SLIPPAGE_TOLERANCE);
  return ethers.parseEther(withTolerance.toFixed(8));
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ════════════════════════════════════════════════
//  ENDPOINTS
// ════════════════════════════════════════════════

async function verifyPayment(req, env, C) {
  const { txHash, address, format } = await req.json().catch(() => ({}));
  if (!txHash || !address) return json(400, { error: "txHash y address son requeridos" });

  const addr = address.toLowerCase();
  const txH = txHash.toLowerCase();

  // Anti-replay
  const used = await env.DB.prepare("SELECT 1 FROM used_tx_hashes WHERE tx_hash = ?").bind(txH).first();
  if (used) return json(409, { error: "Este txHash ya fue canjeado" });

  // Verificar tx on-chain
  let tx, receipt;
  try {
    const provider = new ethers.JsonRpcProvider(C.RPC_URL);
    [tx, receipt] = await Promise.all([
      provider.getTransaction(txH),
      provider.getTransactionReceipt(txH),
    ]);
  } catch (e) {
    return json(502, { error: "No se pudo consultar la blockchain" });
  }

  if (!tx || !receipt) return json(404, { error: "Transacción no encontrada. ¿Ya fue confirmada?" });
  if (receipt.status !== 1) return json(400, { error: "La transacción falló en la blockchain" });
  if (tx.to?.toLowerCase() !== C.PAYMENT_ADDRESS.toLowerCase())
    return json(400, { error: "La transacción no va a la wallet correcta" });
  if (tx.from?.toLowerCase() !== addr)
    return json(400, { error: "La address no coincide con el origen de la tx" });
  if (Number(tx.chainId) !== C.CHAIN_ID)
    return json(400, { error: "La transacción no es en Arbitrum One" });

  // Verificar monto con precio Chainlink
  let minWei;
  try {
    minWei = await getMinAcceptableWei(C);
  } catch (e) {
    return json(502, { error: "No se pudo verificar el precio en Chainlink" });
  }
  if (tx.value < minWei) {
    return json(400, {
      error: `Pago insuficiente. Enviaste ${parseFloat(ethers.formatEther(tx.value)).toFixed(6)} ETH`,
    });
  }

  // ✅ Crear purchase + marcar txHash usado (batch atómico)
  const token = await generateToken(addr, env.TOKEN_SECRET);
  const now = Date.now();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO purchases (token, address, tx_hash, downloads, amount_eth, block_number, network, format, created_at, last_download_at)
       VALUES (?, ?, ?, 0, ?, ?, 'arbitrum-one', ?, ?, NULL)`
    ).bind(token, addr, txH, ethers.formatEther(tx.value), receipt.blockNumber, format || null, now),
    env.DB.prepare(
      `INSERT INTO used_tx_hashes (tx_hash, address, token, used_at) VALUES (?, ?, ?, ?)`
    ).bind(txH, addr, token, now),
  ]);

  return json(200, { success: true, token });
}

async function download(url, env, C) {
  const token = url.searchParams.get("token");
  if (!token) return json(400, { error: "Token requerido" });

  const row = await env.DB.prepare("SELECT token FROM purchases WHERE token = ?").bind(token).first();
  if (!row) return json(404, { error: "Token inválido" });

  const obj = await env.BOOK_BUCKET.get(C.BOOK_FILE_KEY);
  if (!obj) return json(404, { error: "Archivo no disponible" });

  // Contador de descargas
  await env.DB.prepare(
    "UPDATE purchases SET downloads = downloads + 1, last_download_at = ? WHERE token = ?"
  ).bind(Date.now(), token).run();

  return new Response(obj.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Crypto-para-Soberanos.pdf"',
      ...CORS,
    },
  });
}

async function purchases(url, env) {
  const address = url.searchParams.get("address");
  if (!address) return json(400, { error: "address requerida" });

  const { results } = await env.DB.prepare(
    "SELECT token, address, tx_hash, amount_eth, block_number, network, format FROM purchases WHERE address = ? ORDER BY created_at DESC"
  ).bind(address.toLowerCase()).all();

  // El frontend espera camelCase y usa `id` como token de descarga (paridad con Firebase).
  const list = (results || []).map((r) => ({
    id: r.token,
    address: r.address,
    txHash: r.tx_hash,
    amountEth: r.amount_eth,
    blockNumber: r.block_number,
    network: r.network,
    format: r.format,
  }));

  return json(200, { purchases: list });
}

// ════════════════════════════════════════════════
//  ROUTER
// ════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const C = cfg(env);

    try {
      if (request.method === "POST" && path === "/verifyPayment") return await verifyPayment(request, env, C);
      if (request.method === "GET" && path === "/download") return await download(url, env, C);
      if (request.method === "GET" && path === "/purchases") return await purchases(url, env);
      return json(404, { error: "Endpoint no encontrado" });
    } catch (e) {
      return json(500, { error: "Error interno", detail: String(e?.message || e) });
    }
  },
};
