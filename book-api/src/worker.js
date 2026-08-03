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
//    GET  /funding            · recaudación acumulada (meta soberana)
//    /admin/*                 · panel book-admin.html + notificador de la caja
//  Secrets: TOKEN_SECRET · MP_ACCESS_TOKEN · ADMIN_TOKEN (panel) · NOTIFIER_TOKEN (caja, solo /admin/events)
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

async function getEthUsd(net) {
  const [decimals, [, answer]] = await withRpc(net, (provider) => {
    const feed = new ethers.Contract(net.feed, CHAINLINK_ABI, provider);
    return Promise.all([feed.decimals(), feed.latestRoundData()]);
  });
  return Number(answer) / Math.pow(10, Number(decimals));
}

async function getMinAcceptableWei(C, net, priceUsd) {
  const ethPrice = await getEthUsd(net);
  const ethNeeded = priceUsd / ethPrice;
  const withTolerance = ethNeeded * (1 - C.SLIPPAGE_TOLERANCE);
  return ethers.parseEther(withTolerance.toFixed(8));
}

// ── Códigos de descuento ──
// Devuelve la fila si el código es válido AHORA para ese formato, o null.
// Único punto de verdad: lo usan /validateCode, /verifyPayment y /order.
async function lookupDiscount(env, code, format) {
  if (!code) return null;
  const row = await env.DB.prepare("SELECT * FROM discount_codes WHERE code = ?")
    .bind(String(code).trim().toUpperCase()).first();
  if (!row || !row.active) return null;
  const now = Date.now();
  if (now < row.valid_from || now > row.valid_until) return null;
  if (row.max_uses != null && row.uses >= row.max_uses) return null;
  if (row.format && row.format !== format) return null;
  return row;
}

function applyDiscount(priceUsd, discountRow) {
  if (!discountRow) return priceUsd;
  const pct = Math.min(100, Math.max(0, discountRow.discount_pct));
  return Math.round(priceUsd * (1 - pct / 100) * 100) / 100;
}

// Incrementa el contador de usos (batch atómico junto al insert de la venta).
function bumpDiscountUseStmt(env, code) {
  return env.DB.prepare("UPDATE discount_codes SET uses = uses + 1 WHERE code = ?").bind(code);
}

async function validateCode(url, env) {
  const code = url.searchParams.get("code");
  const format = url.searchParams.get("format") || "digital";
  const priceUsd = Number(url.searchParams.get("priceUsd")) || 0;
  const row = await lookupDiscount(env, code, format);
  if (!row) return json(200, { valid: false });
  return json(200, {
    valid: true,
    discountPct: row.discount_pct,
    priceUsd: applyDiscount(priceUsd, row),
  });
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ── Auth del panel/notificador (comparación constante) ──
function safeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || !a.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function bearer(req) {
  return (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
}

// ADMIN_TOKEN (secret) = panel completo · NOTIFIER_TOKEN (secret) = solo /admin/events (la caja)
const isAdmin = (req, env) => safeEq(bearer(req), env.ADMIN_TOKEN || "");
const isNotifier = (req, env) => isAdmin(req, env) || safeEq(bearer(req), env.NOTIFIER_TOKEN || "");

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
  const { txHash, address, format, network, lang, code } = await req.json().catch(() => ({}));
  if (!txHash || !address) return json(400, { error: "txHash y address son requeridos" });

  const langOk = ["es", "fr"].includes(lang) ? lang : "es";

  const netKey = network || "arbitrum-one";
  const net = C.NETWORKS[netKey];
  if (!net) return json(400, { error: "Red no soportada" });

  const basePriceUsd = C.PRICES_USD[format] ?? C.PRICES_USD.digital;
  // El % de descuento se recalcula ACÁ (server-side), nunca se confía en lo que
  // mandó el navegador — el código puede haber caducado entre que se mostró el
  // precio y que se firmó la tx.
  const discountRow = await lookupDiscount(env, code, format);
  const priceUsd = applyDiscount(basePriceUsd, discountRow);

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

  const stmts = [
    env.DB.prepare(
      `INSERT INTO purchases (token, address, tx_hash, downloads, amount_eth, block_number, network, format, lang, created_at, last_download_at, discount_code)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, NULL, ?)`
    ).bind(token, addr, txH, ethers.formatEther(tx.value), receipt.blockNumber, netKey, format || null, langOk, now, discountRow?.code || null),
    env.DB.prepare(
      `INSERT INTO used_tx_hashes (tx_hash, address, token, used_at) VALUES (?, ?, ?, ?)`
    ).bind(txH, addr, token, now),
  ];
  if (discountRow) stmts.push(bumpDiscountUseStmt(env, discountRow.code));
  await env.DB.batch(stmts);

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

  // ES con i (como la tapa: "Cripto"); FR con y (grafía francesa correcta)
  const filename = servedFr ? "Crypto-pour-Souverains.pdf" : "Cripto-para-Soberanos.pdf";
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
  // preferencia de entrega (AR físico): correo | coordinar (AMBA, entrega del autor)
  const deliveryPref = ["correo", "coordinar"].includes(b.delivery_pref) ? b.delivery_pref : null;
  // código de descuento: se revalida server-side (el % que mandó el navegador no importa)
  const discountRow = await lookupDiscount(env, s(b.code, 40), format);

  // reintentar ante la (improbable) colisión del public_id
  for (let attempt = 0; attempt < 3; attempt++) {
    const publicId = makeOrderId();
    try {
      await env.DB.prepare(
        `INSERT INTO orders (public_id, stage, created_at, payment_method, format, country, lang, name, email, phone, address, city, cp, notes, tx_hash, wallet_address, delivery_pref, discount_code, discount_pct)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        publicId, Date.now(), paymentMethod, format, s(b.country, 10), s(b.lang, 10),
        name, email, s(b.phone, 60), s(b.address), s(b.city, 200), s(b.cp, 30), s(b.notes, 1000),
        s(b.txHash, 80), s(b.walletAddress, 60), deliveryPref,
        discountRow?.code || null, discountRow?.discount_pct ?? null
      ).run();
      if (discountRow) await bumpDiscountUseStmt(env, discountRow.code).run();

      // Mercado Pago: crear el checkout con el monto exacto en ARS.
      // Si falla (MP caído, sin cotización), el pedido igual queda creado y el
      // frontend cae al link manual — nunca bloqueamos la venta por esto.
      let initPoint = null;
      if (paymentMethod === "mercadopago" && env.MP_ACCESS_TOKEN) {
        try {
          initPoint = await mpCreatePreference(env, C, publicId, format, discountRow);
        } catch (e) {
          console.log("MP preference falló:", String(e?.message || e));
        }
      }

      // Email al comprador con su link de seguimiento (crypto: el pedido nace pagado)
      await sendBuyerEmail(env, { public_id: publicId, name, email, format },
        paymentMethod === "crypto" ? "paid" : "created");

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

// Overrideable para tests locales (mock de MP); en prod queda el default.
function mpApiBase(env) {
  return env.MP_API_BASE || "https://api.mercadopago.com";
}

async function mpCreatePreference(env, C, publicId, format, discountRow) {
  const baseUsd = C.PRICES_USD[format] ?? C.PRICES_USD.digital;
  const usd = applyDiscount(baseUsd, discountRow);
  const ars = await getArsAmount(usd);
  const bookUrl = env.PUBLIC_BOOK_URL || "https://chatwallet.org/book.html";
  const trackUrl = `${bookUrl}?pedido=${publicId}`;

  const resp = await fetch(`${mpApiBase(env)}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      items: [{
        id: format,
        title: `Cripto para Soberanos — ${FORMAT_LABELS[format] || format}`,
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

  const resp = await fetch(`${mpApiBase(env)}/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${env.MP_ACCESS_TOKEN}` },
  });
  if (!resp.ok) return json(200, { ok: true }); // id desconocido: no reintentar
  const pay = await resp.json();

  if (pay.status !== "approved" || !pay.external_reference) return json(200, { ok: true });

  const order = await env.DB.prepare(
    "SELECT public_id, stage, paid, format, lang, ars_amount, name, email FROM orders WHERE public_id = ?"
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
    "UPDATE orders SET paid = 1, mp_payment_id = ?, stage = ?, download_token = ?, paid_at = ? WHERE public_id = ?"
  ).bind(String(paymentId), newStage, downloadToken, now, order.public_id));

  await env.DB.batch(stmts);

  // Email al comprador: pago acreditado (digital: PDF listo · físico: entra a imprenta)
  await sendBuyerEmail(env, order, "paid");

  return json(200, { ok: true });
}

// Recaudación acumulada para la "meta soberana" (2 ETH → PDF libre).
// Suma las ventas reales registradas: compras crypto (amount_eth en purchases)
// + pedidos Mercado Pago acreditados (ars_amount → ETH vía dólar blue + Chainlink).
// A diferencia del balance on-chain de la wallet, esto no retrocede si se mueven fondos.
async function funding(env, C) {
  const [cryptoRow, mpRow] = await Promise.all([
    env.DB.prepare("SELECT SUM(CAST(amount_eth AS REAL)) AS s FROM purchases WHERE amount_eth IS NOT NULL").first(),
    env.DB.prepare("SELECT SUM(ars_amount) AS s FROM orders WHERE paid = 1 AND ars_amount IS NOT NULL").first(),
  ]);
  const cryptoEth = Number(cryptoRow?.s || 0);
  const arsPaid = Number(mpRow?.s || 0);

  let mpEth = 0, converted = true;
  if (arsPaid > 0) {
    try {
      const blueResp = await fetch("https://dolarapi.com/v1/dolares/blue");
      const blue = Number((await blueResp.json())?.venta);
      const ethUsd = await getEthUsd(C.NETWORKS["ethereum"]);
      if (blue > 0 && ethUsd > 0) mpEth = arsPaid / blue / ethUsd;
      else converted = false;
    } catch { converted = false; }
  }

  return json(200, {
    raisedEth: cryptoEth + mpEth,
    breakdown: { cryptoEth, arsPaid, mpEth, mpConverted: converted },
  });
}

// ── Email al comprador (Cloudflare Email Service, binding EMAIL) ──
// Si el binding no existe todavía (dominio sin onboardear) se saltea sin romper:
// el email es un refuerzo, nunca un bloqueante de la venta.
function buyerEmailContent(order, kind) {
  const track = `https://chatwallet.org/book.html?pedido=${order.public_id}`;
  const fisico = order.format && order.format !== "digital";
  const nombre = (order.name || "").split(" ")[0];
  const hola = nombre ? `Hola ${nombre}!` : "¡Hola!";

  let subject, intro;
  if (kind === "paid") {
    if (fisico) {
      subject = `📦 Pago acreditado — tu ejemplar de Cripto para Soberanos entra a imprenta (${order.public_id})`;
      intro = "Tu pago se acreditó. Tu ejemplar se imprime y encuaderna artesanalmente (~10 días) y coordinamos la entrega.";
    } else {
      subject = `📄 Tu PDF de Cripto para Soberanos está listo (${order.public_id})`;
      intro = "Tu pago se acreditó y tu edición digital ya está disponible: entrá a tu página de pedido y tocá «Descargar PDF».";
    }
  } else {
    subject = `Recibimos tu pedido de Cripto para Soberanos (${order.public_id})`;
    intro = fisico
      ? "Recibimos tu pedido. Apenas se acredite el pago, tu ejemplar entra a imprenta y te avisamos por acá."
      : "Recibimos tu pedido. Apenas se acredite el pago, tu PDF queda disponible en tu página de pedido.";
  }

  const text = `${hola}

${intro}

Tu pedido: ${order.public_id}
Seguilo (y guardá este link): ${track}

Cualquier cosa respondé este mail.
— Cripto para Soberanos · chatwallet.org/book.html`;

  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#0a0a0a;line-height:1.6">
    <h2 style="font-weight:800;letter-spacing:-.02em">Cripto para <em>Soberanos</em></h2>
    <p>${hola}</p>
    <p>${intro}</p>
    <p style="background:#f7f7f7;border-radius:10px;padding:12px 16px">Tu pedido: <strong>${order.public_id}</strong></p>
    <p><a href="${track}" style="display:inline-block;background:#2b9de3;color:#fff;text-decoration:none;border-radius:999px;padding:10px 22px;font-weight:600">Seguir mi pedido →</a></p>
    <p style="color:#555;font-size:13px">Guardá este mail: el link de arriba es tu comprobante y seguimiento${fisico ? "" : " (ahí está tu botón de descarga)"}.</p>
    <p style="color:#999;font-size:12px">Cualquier cosa respondé este mail · chatwallet.org/book.html</p>
  </div>`;

  return { subject, text, html };
}

async function sendBuyerEmail(env, order, kind, { record = true } = {}) {
  if (!env.EMAIL || !order?.email || !order?.public_id) return false;
  const { subject, text, html } = buyerEmailContent(order, kind);
  try {
    await env.EMAIL.send({
      to: order.email,
      from: { email: "pedidos@chatwallet.org", name: "Cripto para Soberanos" },
      replyTo: "energiasonorasoftware@protonmail.com",
      subject, text, html,
    });
    // asentar el envío para que el panel muestre "✉️ enviado" (no cuando es
    // una prueba a otra casilla: record=false)
    if (record) {
      await env.DB.prepare("UPDATE orders SET email_sent_at = ? WHERE public_id = ?")
        .bind(Date.now(), order.public_id).run().catch(() => {});
    }
    return true;
  } catch (e) {
    console.log("email al comprador falló:", String(e?.message || e));
    return false;
  }
}

// ════════════════════════════════════════════════
//  PANEL DE ADMINISTRACIÓN (book-admin.html)
//  GET  /admin/orders     · pedidos completos (con datos de envío)
//  GET  /admin/purchases  · compras crypto/MP
//  POST /admin/orderStage · { publicId, stage } avanza/corrige etapa
//  GET  /admin/events?since=ms · ventas nuevas (lo consume el notificador XMTP de la caja)
// ════════════════════════════════════════════════

async function adminOrders(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM orders ORDER BY created_at DESC LIMIT 300"
  ).all();
  return json(200, { orders: results || [] });
}

async function adminPurchases(env) {
  const { results } = await env.DB.prepare(
    "SELECT address, tx_hash, downloads, amount_eth, block_number, network, format, lang, created_at, last_download_at FROM purchases ORDER BY created_at DESC LIMIT 300"
  ).all();
  return json(200, { purchases: results || [] });
}

async function adminOrderStage(req, env) {
  const { publicId, stage, tracking } = await req.json().catch(() => ({}));
  const id = String(publicId || "").toUpperCase();
  if (!id) return json(400, { error: "publicId requerido" });

  // tracking solo (sin cambiar etapa): código o URL que ve el comprador en su seguimiento
  if (stage === undefined && tracking !== undefined) {
    const r = await env.DB.prepare("UPDATE orders SET tracking = ? WHERE public_id = ?")
      .bind(String(tracking).slice(0, 200) || null, id).run();
    if (!r.meta.changes) return json(404, { error: "Pedido no encontrado" });
    return json(200, { success: true, tracking: String(tracking).slice(0, 200) || null });
  }

  const s = Number(stage);
  if (![1, 2, 3].includes(s)) return json(400, { error: "stage (1-3) o tracking requeridos" });
  const r = tracking !== undefined
    ? await env.DB.prepare("UPDATE orders SET stage = ?, tracking = ? WHERE public_id = ?")
        .bind(s, String(tracking).slice(0, 200) || null, id).run()
    : await env.DB.prepare("UPDATE orders SET stage = ? WHERE public_id = ?").bind(s, id).run();
  if (!r.meta.changes) return json(404, { error: "Pedido no encontrado" });
  return json(200, { success: true, stage: s });
}

// ── Panel: gestión de códigos de descuento ──
async function adminListDiscounts(env) {
  const { results } = await env.DB.prepare("SELECT * FROM discount_codes ORDER BY created_at DESC LIMIT 200").all();
  return json(200, { codes: results || [] });
}

async function adminCreateDiscount(req, env) {
  const b = await req.json().catch(() => ({}));
  const code = String(b.code || "").trim().toUpperCase().slice(0, 40);
  const pct = Number(b.discountPct);
  const validFrom = Number(b.validFrom) || Date.now();
  const validDays = Number(b.validDays);
  if (!code || !pct || pct <= 0 || pct > 100 || !validDays || validDays <= 0)
    return json(400, { error: "code, discountPct (1-100) y validDays (>0) son requeridos" });

  const validUntil = validFrom + validDays * 86400000;
  const format = ["digital", "physical", "physical-only"].includes(b.format) ? b.format : null;
  const maxUses = b.maxUses ? Math.max(1, Number(b.maxUses)) : null;

  try {
    await env.DB.prepare(
      `INSERT INTO discount_codes (code, discount_pct, valid_from, valid_until, format, max_uses, uses, active, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`
    ).bind(code, pct, validFrom, validUntil, format, maxUses, (b.note || "").slice(0, 300), Date.now()).run();
    return json(200, { success: true, code });
  } catch (e) {
    if (String(e?.message || e).includes("UNIQUE")) return json(409, { error: "Ese código ya existe" });
    throw e;
  }
}

async function adminSetDiscountActive(req, env) {
  const { code, active } = await req.json().catch(() => ({}));
  if (!code) return json(400, { error: "code requerido" });
  const r = await env.DB.prepare("UPDATE discount_codes SET active = ? WHERE code = ?")
    .bind(active ? 1 : 0, String(code).toUpperCase()).run();
  if (!r.meta.changes) return json(404, { error: "Código no encontrado" });
  return json(200, { success: true });
}

// Reenviar (o probar) el email del pedido: { publicId, to?, kind? }.
// `to` permite mandarlo a otra casilla (probar cómo se ve) sin tocar el pedido.
async function adminSendOrderEmail(req, env) {
  const { publicId, to, kind } = await req.json().catch(() => ({}));
  const order = await env.DB.prepare("SELECT public_id, name, email, format, paid, payment_method FROM orders WHERE public_id = ?")
    .bind(String(publicId || "").toUpperCase()).first();
  if (!order) return json(404, { error: "Pedido no encontrado" });
  const k = kind || ((order.paid || order.payment_method === "crypto") ? "paid" : "created");
  const target = { ...order, email: to || order.email };
  if (!env.EMAIL) return json(503, { error: "Email no configurado (falta onboardear el dominio / binding EMAIL)" });
  // una prueba a otra casilla no cuenta como "email enviado al comprador"
  const ok = await sendBuyerEmail(env, target, k, { record: target.email === order.email });
  return json(ok ? 200 : 502, ok ? { success: true, to: target.email, kind: k } : { error: "El envío falló (ver logs)" });
}

// Ventas nuevas desde `since` (epoch ms). Dos fuentes sin duplicar:
//  · pedidos: crypto se crean recién con la tx verificada (created_at = venta);
//    MP cuentan cuando acreditan (paid_at, seteado por el webhook).
//  · compras crypto digitales (no generan pedido — el PDF sale al toque).
async function adminEvents(url, env) {
  const since = Number(url.searchParams.get("since") || 0);
  const now = Date.now();
  const [orders, purchases] = await Promise.all([
    env.DB.prepare(
      `SELECT public_id, format, lang, country, payment_method, ars_amount, city, stage, paid, created_at, paid_at, wallet_address, delivery_pref FROM orders
       WHERE (payment_method = 'crypto' AND created_at > ?1)
          OR (paid = 1 AND COALESCE(paid_at, created_at) > ?1)
       ORDER BY created_at ASC LIMIT 50`
    ).bind(since).all(),
    env.DB.prepare(
      `SELECT tx_hash, amount_eth, network, format, lang, created_at FROM purchases
       WHERE network != 'mercadopago' AND (format = 'digital' OR format IS NULL) AND created_at > ?1
       ORDER BY created_at ASC LIMIT 50`
    ).bind(since).all(),
  ]);
  const events = [
    ...(orders.results || []).map((o) => ({ type: "pedido", at: o.paid_at || o.created_at, ...o })),
    ...(purchases.results || []).map((p) => ({ type: "compra-crypto", at: p.created_at, ...p })),
  ].sort((a, b) => a.at - b.at);
  return json(200, { now, events });
}

// Seguimiento público del pedido (sin datos personales).
async function orderStatus(url, env) {
  const id = (url.searchParams.get("id") || "").toUpperCase();
  if (!id) return json(400, { error: "id requerido" });
  const row = await env.DB.prepare(
    "SELECT public_id, stage, format, country, lang, created_at, paid, download_token, tracking, delivery_pref FROM orders WHERE public_id = ?"
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
    tracking: row.tracking || null,
    deliveryPref: row.delivery_pref || null,
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
      if (path.startsWith("/admin/")) {
        const authed = path === "/admin/events" ? isNotifier(request, env) : isAdmin(request, env);
        if (!authed) return json(401, { error: "No autorizado" });
        if (request.method === "GET" && path === "/admin/orders") return await adminOrders(env);
        if (request.method === "GET" && path === "/admin/purchases") return await adminPurchases(env);
        if (request.method === "GET" && path === "/admin/events") return await adminEvents(url, env);
        if (request.method === "POST" && path === "/admin/orderStage") return await adminOrderStage(request, env);
        if (request.method === "POST" && path === "/admin/sendOrderEmail") return await adminSendOrderEmail(request, env);
        if (request.method === "GET" && path === "/admin/discounts") return await adminListDiscounts(env);
        if (request.method === "POST" && path === "/admin/discounts") return await adminCreateDiscount(request, env);
        if (request.method === "POST" && path === "/admin/discounts/setActive") return await adminSetDiscountActive(request, env);
        return json(404, { error: "Endpoint no encontrado" });
      }
      if (request.method === "GET" && path === "/validateCode") return await validateCode(url, env);
      if (request.method === "POST" && path === "/verifyPayment") return await verifyPayment(request, env, C);
      if (request.method === "POST" && path === "/order") return await createOrder(request, env, C);
      if (request.method === "POST" && path === "/mpWebhook") return await mpWebhook(request, url, env);
      if (request.method === "GET" && path === "/orderStatus") return await orderStatus(url, env);
      if (request.method === "GET" && path === "/funding") return await funding(env, C);
      if (request.method === "GET" && path === "/download") return await download(url, env, C);
      if (request.method === "GET" && path === "/purchases") return await purchases(url, env);
      return json(404, { error: "Endpoint no encontrado" });
    } catch (e) {
      return json(500, { error: "Error interno", detail: String(e?.message || e) });
    }
  },
};
