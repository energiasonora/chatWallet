// ════════════════════════════════════════════════
//  chatWallet · Book API (Cloudflare Worker)
//  Porteo 1:1 de functions/index.js (Firebase) → Worker + D1 + R2.
//  Endpoints (servidos en api.chatwallet.org):
//    POST /verifyPayment   · valida la tx on-chain y emite token de descarga
//    POST /order           · crea el pedido (+ checkout Mercado Pago si aplica)
//    POST /mpWebhook       · notificación de MP: pago acreditado → avanza etapa / libera PDF
//    GET  /orderStatus?id= · seguimiento público del pedido
//    GET  /download?token= · sirve el PDF desde R2 (gated por token)
//    GET  /purchases?address= · lista compras de una address
//  Secrets: TOKEN_SECRET · MP_ACCESS_TOKEN (wrangler secret put MP_ACCESS_TOKEN)
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
    SLIPPAGE_TOLERANCE: Number(env.SLIPPAGE_TOLERANCE),
    // Redes aceptadas para el pago. Los vars CHAIN_ID/RPC_URL/CHAINLINK_FEED
    // siguen definiendo la red histórica (Arbitrum One).
    NETWORKS: {
      "arbitrum-one": {
        chainId:  Number(env.CHAIN_ID),
        rpcUrls:  [env.RPC_URL, "https://arbitrum-one-rpc.publicnode.com"],
        feed:     env.CHAINLINK_FEED,
        label:    "Arbitrum One",
      },
      "ethereum": {
        chainId:  1,
        rpcUrls:  [env.RPC_URL_ETHEREUM || "https://ethereum-rpc.publicnode.com", "https://eth.drpc.org"],
        feed:     env.CHAINLINK_FEED_ETHEREUM || "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
        label:    "Ethereum Mainnet",
      },
    },
    // Precio según formato (arregla el undercharge: antes todo validaba contra PRICE_USD=10).
    // "physical" = físico + digital (key legacy: siempre incluyó el PDF).
    // "physical-only" = solo el libro en papel, sin PDF.
    PRICES_USD: {
      digital:         Number(env.PRICE_USD) || 10,
      physical:        40,
      "physical-only": 35,
      pickup:          25,
    },
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

// Prueba los RPCs de la red en orden (los públicos fallan intermitentemente).
async function withRpc(net, fn) {
  let lastErr;
  for (const url of net.rpcUrls) {
    try {
      return await fn(new ethers.JsonRpcProvider(url, net.chainId, { staticNetwork: true, batchMaxCount: 1 }));
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function getMinAcceptableWei(C, net, priceUsd) {
  const [decimals, [, answer]] = await withRpc(net, (provider) => {
    const feed = new ethers.Contract(net.feed, CHAINLINK_ABI, provider);
    return Promise.all([feed.decimals(), feed.latestRoundData()]);
  });
  const ethPrice = Number(answer) / Math.pow(10, Number(decimals));
  const ethNeeded = priceUsd / ethPrice;
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
  const { txHash, address, format, network, lang } = await req.json().catch(() => ({}));
  if (!txHash || !address) return json(400, { error: "txHash y address son requeridos" });

  const langOk = ["es", "fr"].includes(lang) ? lang : "es";

  const netKey = network || "arbitrum-one";
  const net = C.NETWORKS[netKey];
  if (!net) return json(400, { error: "Red no soportada" });

  const priceUsd = C.PRICES_USD[format] ?? C.PRICES_USD.digital;

  const addr = address.toLowerCase();
  const txH = txHash.toLowerCase();

  // Anti-replay
  const used = await env.DB.prepare("SELECT 1 FROM used_tx_hashes WHERE tx_hash = ?").bind(txH).first();
  if (used) return json(409, { error: "Este txHash ya fue canjeado" });

  // Verificar tx on-chain
  let tx, receipt;
  try {
    [tx, receipt] = await withRpc(net, (provider) => Promise.all([
      provider.getTransaction(txH),
      provider.getTransactionReceipt(txH),
    ]));
  } catch (e) {
    return json(502, { error: "No se pudo consultar la blockchain" });
  }

  if (!tx || !receipt) return json(404, { error: "Transacción no encontrada. ¿Ya fue confirmada?" });
  if (receipt.status !== 1) return json(400, { error: "La transacción falló en la blockchain" });
  if (tx.to?.toLowerCase() !== C.PAYMENT_ADDRESS.toLowerCase())
    return json(400, { error: "La transacción no va a la wallet correcta" });
  if (tx.from?.toLowerCase() !== addr)
    return json(400, { error: "La address no coincide con el origen de la tx" });
  if (Number(tx.chainId) !== net.chainId)
    return json(400, { error: `La transacción no es en ${net.label}` });

  // Verificar monto con precio Chainlink (según formato)
  let minWei;
  try {
    minWei = await getMinAcceptableWei(C, net, priceUsd);
  } catch (e) {
    return json(502, { error: "No se pudo verificar el precio en Chainlink" });
  }
  if (tx.value < minWei) {
    return json(400, {
      error: `Pago insuficiente (el formato elegido cuesta $${priceUsd} USD). Enviaste ${parseFloat(ethers.formatEther(tx.value)).toFixed(6)} ETH`,
    });
  }

  // ✅ Crear purchase + marcar txHash usado (batch atómico)
  const token = await generateToken(addr, env.TOKEN_SECRET);
  const now = Date.now();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO purchases (token, address, tx_hash, downloads, amount_eth, block_number, network, format, lang, created_at, last_download_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, NULL)`
    ).bind(token, addr, txH, ethers.formatEther(tx.value), receipt.blockNumber, netKey, format || null, langOk, now),
    env.DB.prepare(
      `INSERT INTO used_tx_hashes (tx_hash, address, token, used_at) VALUES (?, ?, ?, ?)`
    ).bind(txH, addr, token, now),
  ]);

  return json(200, { success: true, token });
}

async function download(url, env, C) {
  const token = url.searchParams.get("token");
  if (!token) return json(400, { error: "Token requerido" });

  const row = await env.DB.prepare("SELECT token, format, lang FROM purchases WHERE token = ?").bind(token).first();
  if (!row) return json(404, { error: "Token inválido" });
  if (row.format === "physical-only")
    return json(403, { error: "Tu compra es solo la edición física: no incluye el PDF" });

  // Edición según idioma de la compra; si la FR no está subida a R2, cae a la ES.
  const wantsFr = row.lang === "fr" && env.BOOK_FILE_KEY_FR;
  let obj = wantsFr ? await env.BOOK_BUCKET.get(env.BOOK_FILE_KEY_FR) : null;
  const servedFr = !!obj;
  if (!obj) obj = await env.BOOK_BUCKET.get(C.BOOK_FILE_KEY);
  if (!obj) return json(404, { error: "Archivo no disponible" });

  // Contador de descargas
  await env.DB.prepare(
    "UPDATE purchases SET downloads = downloads + 1, last_download_at = ? WHERE token = ?"
  ).bind(Date.now(), token).run();

  const filename = servedFr ? "Crypto-pour-Souverains.pdf" : "Crypto-para-Soberanos.pdf";
  return new Response(obj.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...CORS,
    },
  });
}

// Pedido: guarda dirección + contacto en D1 y devuelve un id público de seguimiento.
// Leerlos:  wrangler d1 execute chatwallet-purchases --remote --command "SELECT * FROM orders ORDER BY created_at DESC"
// Avanzar:  UPDATE orders SET stage=2 WHERE public_id='CW-XXXXXX'   (1 creado · 2 imprimiendo/verificando · 3 distribución/enviado)
function makeOrderId() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I/L
  const rnd = crypto.getRandomValues(new Uint8Array(6));
  return "CW-" + [...rnd].map((b) => chars[b % chars.length]).join("");
}

async function createOrder(req, env, C) {
  const b = await req.json().catch(() => ({}));
  const s = (v, max = 500) => (typeof v === "string" ? v.slice(0, max) : null);
  const name = s(b.name, 120), email = s(b.email, 200);
  if (!name || !email) return json(400, { error: "nombre y email son requeridos" });

  const paymentMethod = s(b.payment_method, 30);
  const format = s(b.format, 30);

  // reintentar ante la (improbable) colisión del public_id
  for (let attempt = 0; attempt < 3; attempt++) {
    const publicId = makeOrderId();
    try {
      await env.DB.prepare(
        `INSERT INTO orders (public_id, stage, created_at, payment_method, format, country, lang, name, email, phone, address, city, cp, notes, tx_hash, wallet_address)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        publicId, Date.now(), paymentMethod, format, s(b.country, 10), s(b.lang, 10),
        name, email, s(b.phone, 60), s(b.address), s(b.city, 200), s(b.cp, 30), s(b.notes, 1000),
        s(b.txHash, 80), s(b.walletAddress, 60)
      ).run();

      // Mercado Pago: crear el checkout con el monto exacto en ARS.
      // Si falla (MP caído, sin cotización), el pedido igual queda creado y el
      // frontend cae al link manual — nunca bloqueamos la venta por esto.
      let initPoint = null;
      if (paymentMethod === "mercadopago" && env.MP_ACCESS_TOKEN) {
        try {
          initPoint = await mpCreatePreference(env, C, publicId, format);
        } catch (e) {
          console.log("MP preference falló:", String(e?.message || e));
        }
      }

      return json(200, { success: true, orderId: publicId, initPoint });
    } catch (e) {
      if (!String(e?.message || e).includes("UNIQUE")) throw e;
    }
  }
  return json(500, { error: "No se pudo generar el id del pedido" });
}

// ── Mercado Pago (Checkout Pro) ──────────────────
// Preference con external_reference = public_id del pedido; MP nos avisa el
// pago acreditado por webhook (POST /mpWebhook) y ahí avanza la etapa solo.

async function getArsAmount(usd) {
  const resp = await fetch("https://dolarapi.com/v1/dolares/blue");
  const data = await resp.json();
  const rate = Number(data?.venta);
  if (!rate || rate <= 0) throw new Error("cotización ARS no disponible");
  return Math.round(usd * rate);
}

const FORMAT_LABELS = { digital: "Digital (PDF)", physical: "Físico + digital", "physical-only": "Físico" };

async function mpCreatePreference(env, C, publicId, format) {
  const usd = C.PRICES_USD[format] ?? C.PRICES_USD.digital;
  const ars = await getArsAmount(usd);
  const bookUrl = env.PUBLIC_BOOK_URL || "https://chatwallet.org/book.html";
  const trackUrl = `${bookUrl}?pedido=${publicId}`;

  const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      items: [{
        id: format,
        title: `Crypto para Soberanos — ${FORMAT_LABELS[format] || format}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: ars,
      }],
      external_reference: publicId,
      notification_url: "https://api.chatwallet.org/mpWebhook",
      back_urls: { success: trackUrl, pending: trackUrl, failure: trackUrl },
      auto_return: "approved",
      metadata: { order_id: publicId },
    }),
  });
  const pref = await resp.json().catch(() => ({}));
  if (!resp.ok || !pref.init_point) throw new Error(`MP ${resp.status}: ${JSON.stringify(pref).slice(0, 300)}`);

  await env.DB.prepare(
    "UPDATE orders SET mp_preference_id = ?, ars_amount = ? WHERE public_id = ?"
  ).bind(pref.id || null, ars, publicId).run();

  return pref.init_point;
}

// Webhook de MP: llega al acreditarse un pago. No confiamos en el body — solo
// tomamos el id y le preguntamos a la API de MP (con nuestro token) el estado real.
async function mpWebhook(req, url, env) {
  let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const topic = url.searchParams.get("type") || url.searchParams.get("topic");
  const body = await req.json().catch(() => ({}));
  if (!paymentId) paymentId = body?.data?.id;
  const kind = topic || body?.type;

  // MP manda otras notificaciones (merchant_order, etc.): 200 y listo.
  if (!paymentId || (kind && kind !== "payment")) return json(200, { ok: true });

  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${env.MP_ACCESS_TOKEN}` },
  });
  if (!resp.ok) return json(200, { ok: true }); // id desconocido: no reintentar
  const pay = await resp.json();

  if (pay.status !== "approved" || !pay.external_reference) return json(200, { ok: true });

  const order = await env.DB.prepare(
    "SELECT public_id, stage, paid, format, lang, ars_amount FROM orders WHERE public_id = ?"
  ).bind(pay.external_reference).first();
  if (!order || order.paid) return json(200, { ok: true }); // idempotente

  // El monto tiene que cubrir lo que pedía el pedido (tolerancia de $1 por redondeos)
  if (order.ars_amount && Number(pay.transaction_amount) < order.ars_amount - 1)
    return json(200, { ok: true });

  const digital = order.format === "digital";
  const includesPdf = order.format === "digital" || order.format === "physical";
  const now = Date.now();
  const stmts = [];

  // Si incluye PDF, emitimos un token de descarga (el mismo sistema que las compras crypto);
  // el comprador lo ve como botón "Descargar PDF" en su página de seguimiento.
  let downloadToken = null;
  if (includesPdf) {
    downloadToken = await generateToken(`mp-${paymentId}`, env.TOKEN_SECRET);
    stmts.push(env.DB.prepare(
      `INSERT INTO purchases (token, address, tx_hash, downloads, amount_eth, block_number, network, format, lang, created_at, last_download_at)
       VALUES (?, 'mercadopago', ?, 0, NULL, NULL, 'mercadopago', ?, ?, ?, NULL)`
    ).bind(downloadToken, `mp-${paymentId}`, order.format, order.lang || "es", now));
  }

  // digital: pago acreditado = PDF disponible → etapa 3. Físico: pasa a "imprimiendo" (2).
  const newStage = digital ? 3 : Math.max(2, order.stage || 1);
  stmts.push(env.DB.prepare(
    "UPDATE orders SET paid = 1, mp_payment_id = ?, stage = ?, download_token = ? WHERE public_id = ?"
  ).bind(String(paymentId), newStage, downloadToken, order.public_id));

  await env.DB.batch(stmts);
  return json(200, { ok: true });
}

// Seguimiento público del pedido (sin datos personales).
async function orderStatus(url, env) {
  const id = (url.searchParams.get("id") || "").toUpperCase();
  if (!id) return json(400, { error: "id requerido" });
  const row = await env.DB.prepare(
    "SELECT public_id, stage, format, country, lang, created_at, paid, download_token FROM orders WHERE public_id = ?"
  ).bind(id).first();
  if (!row) return json(404, { error: "Pedido no encontrado" });
  return json(200, {
    orderId: row.public_id,
    stage: row.stage,
    format: row.format,
    country: row.country,
    lang: row.lang,
    createdAt: row.created_at,
    paid: !!row.paid,
    // solo existe si el pago acreditó y el formato incluye PDF: quien tiene el
    // link de seguimiento es el comprador (el CW-XXXXXX actúa de secreto).
    downloadToken: row.download_token || null,
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
      if (request.method === "POST" && path === "/order") return await createOrder(request, env, C);
      if (request.method === "POST" && path === "/mpWebhook") return await mpWebhook(request, url, env);
      if (request.method === "GET" && path === "/orderStatus") return await orderStatus(url, env);
      if (request.method === "GET" && path === "/download") return await download(url, env, C);
      if (request.method === "GET" && path === "/purchases") return await purchases(url, env);
      return json(404, { error: "Endpoint no encontrado" });
    } catch (e) {
      return json(500, { error: "Error interno", detail: String(e?.message || e) });
    }
  },
};
