// ════════════════════════════════════════════════
//  Libro en junas (Ğ1) · libro.chatwallet.org
//
//  Venta del PDF de «Cripto para Soberanos» pagado en Ğ1, aparte de /book y con
//  interruptor: el autor la abre cuando va a un mercado de junas y la cierra después.
//
//  Cómo se cobra, sin billetera en el navegador:
//   1. POST /g1/pedido → código corto (CPS-XXXXX) + QR june://<cuenta>?amount=…&comment=<código>
//      (el formato que emite y lee Ğecko; ChatWallet también lo lee).
//   2. El comprador paga desde su billetera con el código como comentario.
//   3. GET /g1/pedido?codigo=&s= busca en el indexador (squid) transferencias a la cuenta con
//      ese comentario; si suman el precio, emite el token de /download (fila en purchases).
//  El código es PÚBLICO (queda en la cadena como comentario): sólo sirve para reconocer el pago.
//  La descarga sale con la clave secreta `s` que recibe el navegador del comprador al crear el
//  pedido (y el autor desde el panel). Sin `s`, el pedido "no existe".
//  Si el indexador se cae o el comprador olvidó el comentario: el autor lo marca a mano
//  desde libro.chatwallet.org/admin (POST /admin/g1/pagado).
//
//  Cerrar la venta sólo impide pedidos NUEVOS: los pedidos abiertos se siguen verificando,
//  para que nadie pague y se quede sin el libro.
// ════════════════════════════════════════════════
import QRCodeCore from "qrcode/lib/core/qrcode.js";
import SvgTag from "qrcode/lib/renderer/svg-tag.js";

// Indexadores Ğ1 (misma lista que ius/js/g1.js). Se puede pisar con la var G1_SQUIDS (coma).
const SQUIDS = [
  "https://squid.g1.brussels.ovh/v1/graphql",
  "https://g1-squid.axiom-team.fr/v1/graphql",
];

const PRECIO_INICIAL = 15000;         // céntimos de Ğ1 (la cadena usa 2 decimales) = 150 Ğ1
const FRENO_CONSULTA_MS = 4000;       // como mucho una consulta al indexador cada 4 s por pedido
const MARGEN_RELOJ_MS = 10 * 60e3;    // transferencias desde 10 min antes del pedido (relojes)
const CUENTA_RE = /^g1[1-9A-HJ-NP-Za-km-z]{45,50}$/;

// ── utilidades ───────────────────────────────────

function squids(env) {
  const propios = (env.G1_SQUIDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return propios.length ? propios : SQUIDS;
}

async function squid(env, query, variables) {
  let ultimo;
  for (const u of squids(env)) {
    try {
      const r = await fetch(u, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) { ultimo = new Error(`indexador ${r.status}`); continue; }
      const j = await r.json();
      if (j.errors) { ultimo = new Error(j.errors[0]?.message || "indexador: error"); continue; }
      return j.data;
    } catch (e) { ultimo = e; }
  }
  throw ultimo || new Error("sin indexador");
}

export function qrSvg(texto) {
  const opts = { errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000ff", light: "#ffffffff" } };
  return SvgTag.render(QRCodeCore.create(texto, opts), opts);
}

const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

function iguales(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || !a.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// "CPS-7K3QX" → "CPS7K3QX": el comprador puede escribirlo con espacios, sin guion o en minúscula.
const normal = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function nuevoCodigo() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I/L
  const rnd = crypto.getRandomValues(new Uint8Array(5));
  return "CPS-" + [...rnd].map((b) => chars[b % chars.length]).join("");
}

const g1Texto = (centimos) => {
  const v = centimos / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

export function enlacePago(cuenta, centimos, codigo) {
  return `june://${cuenta}?amount=${g1Texto(centimos)}&comment=${encodeURIComponent(codigo)}`;
}

async function generarToken(semilla, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret || "cambia_esto_en_produccion"),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const rnd = [...crypto.getRandomValues(new Uint8Array(16))].join(".");
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`g1|${semilla}|${Date.now()}|${rnd}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── configuración (tabla settings) ───────────────

async function leerAjustes(env) {
  const { results } = await env.DB.prepare(
    "SELECT key, value FROM settings WHERE key LIKE 'g1_%'"
  ).all();
  const m = Object.fromEntries((results || []).map((r) => [r.key, r.value]));
  return {
    activo: m.g1_activo === "1",
    centimos: Number(m.g1_centimos) > 0 ? Number(m.g1_centimos) : PRECIO_INICIAL,
    cuenta: m.g1_cuenta || "",
    du: Number(m.g1_du) || 0,
    duAt: Number(m.g1_du_at) || 0,
  };
}

const guardar = (env, key, value) =>
  env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3"
  ).bind(key, String(value), Date.now());

// DU vigente (céntimos), para mostrar el precio también en DU. Se refresca cada 6 h.
async function duVigente(env, aj) {
  if (aj.du && Date.now() - aj.duAt < 6 * 3600e3) return aj.du;
  try {
    const d = await squid(env, "{ universalDividends(first:1, orderBy:INDEX_DESC){ nodes{ amount } } }");
    const du = Number(d?.universalDividends?.nodes?.[0]?.amount) || 0;
    if (du > 0) await env.DB.batch([guardar(env, "g1_du", du), guardar(env, "g1_du_at", Date.now())]);
    return du || aj.du;
  } catch { return aj.du; }
}

// ── verificación contra la cadena ────────────────

const Q_TRANSFERENCIAS = `query($c:String!,$d:Datetime!){
  transfers(first:100, orderBy:BLOCK_NUMBER_DESC, filter:{ toId:{equalTo:$c}, timestamp:{greaterThanOrEqualTo:$d} }){
    nodes{ id blockNumber timestamp amount fromId comment{ remark } } } }`;

// Transferencias a la cuenta del pedido cuyo comentario lleva el código.
async function pagosDelPedido(env, p) {
  const desde = new Date(p.created_at - MARGEN_RELOJ_MS).toISOString();
  const d = await squid(env, Q_TRANSFERENCIAS, { c: p.cuenta, d: desde });
  const cod = normal(p.code);
  return (d?.transfers?.nodes || []).filter((t) => normal(t.comment?.remark).includes(cod));
}

// Marca el pedido pagado y crea la compra (token de /download). Idempotente: si dos consultas
// llegan a la vez, sólo una escribe (UPDATE condicionado + INSERT que depende de él, en un batch).
async function acreditar(env, p, { via, transferId, desde, centimos, bloque }) {
  const token = await generarToken(p.code, env.TOKEN_SECRET);
  const ahora = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE g1_orders SET token = ?1, paid_at = ?2, via = ?3, transfer_id = ?4, from_account = ?5,
         paid_centimos = ?6, block_number = ?7 WHERE code = ?8 AND token IS NULL`
    ).bind(token, ahora, via, transferId, desde, centimos, bloque, p.code),
    env.DB.prepare(
      `INSERT INTO purchases (token, address, tx_hash, downloads, amount_eth, block_number, network, format, lang, created_at, last_download_at, discount_code)
       SELECT ?1, ?2, ?3, 0, NULL, ?4, 'g1', 'digital', ?5, ?6, NULL, NULL
       WHERE EXISTS (SELECT 1 FROM g1_orders WHERE code = ?7 AND token = ?1)`
    ).bind(token, "g1:" + (desde || "manual"), "g1:" + (transferId || p.code), bloque, p.lang, ahora, p.code),
  ]);
  return env.DB.prepare("SELECT * FROM g1_orders WHERE code = ?").bind(p.code).first();
}

function vistaPedido(p, url) {
  const base = `${url.protocol}//${url.host}`;
  const v = {
    codigo: p.code,
    s: p.secret,
    lang: p.lang,
    centimos: p.centimos,
    cuenta: p.cuenta,
    pago: enlacePago(p.cuenta, p.centimos, p.code),
    pagado: !!p.token,
    creado: p.created_at,
  };
  if (p.token) {
    v.descarga = `${base}/download?token=${p.token}`;
    v.qrDescarga = qrSvg(v.descarga);
  } else {
    v.qrPago = qrSvg(v.pago);
  }
  return v;
}

// ── endpoints públicos ───────────────────────────

// GET /g1/estado → si la venta está abierta, precio, cuenta y DU
async function estado(env) {
  const aj = await leerAjustes(env);
  const abierto = aj.activo && CUENTA_RE.test(aj.cuenta);
  const du = abierto ? await duVigente(env, aj) : 0;
  return json(200, { abierto, centimos: aj.centimos, cuenta: abierto ? aj.cuenta : null, du });
}

// POST /g1/pedido {lang} → pedido nuevo (sólo con la venta abierta)
async function crearPedido(req, env, url) {
  const b = await req.json().catch(() => ({}));
  const lang = b.lang === "fr" ? "fr" : "es";
  const aj = await leerAjustes(env);
  if (!aj.activo || !CUENTA_RE.test(aj.cuenta)) return json(403, { error: "cerrado" });
  for (let i = 0; i < 3; i++) {
    const code = nuevoCodigo();
    try {
      await env.DB.prepare(
        "INSERT INTO g1_orders (code, secret, lang, centimos, cuenta, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(code, hex(16), lang, aj.centimos, aj.cuenta, Date.now()).run();
      const p = await env.DB.prepare("SELECT * FROM g1_orders WHERE code = ?").bind(code).first();
      return json(200, vistaPedido(p, url));
    } catch (e) {
      if (!/UNIQUE/i.test(String(e?.message))) throw e;
    }
  }
  return json(500, { error: "no se pudo crear el pedido" });
}

// GET /g1/pedido?codigo=&s= → estado; si falta el pago, mira la cadena (con freno)
async function consultarPedido(url, env) {
  const code = (url.searchParams.get("codigo") || "").toUpperCase().trim();
  const p = await env.DB.prepare("SELECT * FROM g1_orders WHERE code = ?").bind(code).first();
  if (!p || !iguales(url.searchParams.get("s") || "", p.secret || "")) return json(404, { error: "Pedido no encontrado" });
  if (p.token) return json(200, vistaPedido(p, url));

  const ahora = Date.now();
  if (p.checked_at && ahora - p.checked_at < FRENO_CONSULTA_MS)
    return json(200, { ...vistaPedido(p, url), recibido: p.paid_centimos || 0 });
  await env.DB.prepare("UPDATE g1_orders SET checked_at = ? WHERE code = ?").bind(ahora, code).run();

  let pagos;
  try { pagos = await pagosDelPedido(env, p); }
  catch (e) { return json(200, { ...vistaPedido(p, url), indexador: "sin respuesta" }); }

  const recibido = pagos.reduce((s, t) => s + Number(t.amount || 0), 0);
  if (recibido >= p.centimos) {
    const t = pagos.reduce((a, b) => (Number(b.amount) > Number(a.amount) ? b : a));
    const q = await acreditar(env, p, {
      via: "cadena", transferId: t.id, desde: t.fromId, centimos: recibido, bloque: t.blockNumber,
    });
    return json(200, vistaPedido(q, url));
  }
  // pago parcial: se informa para que el comprador complete
  if (recibido > 0) await env.DB.prepare("UPDATE g1_orders SET paid_centimos = ? WHERE code = ?").bind(recibido, code).run();
  return json(200, { ...vistaPedido(p, url), recibido });
}

// ── panel (libro.chatwallet.org/admin) ───────────

async function adminVer(env) {
  const aj = await leerAjustes(env);
  let nombre = null, existe = null;
  if (CUENTA_RE.test(aj.cuenta)) {
    try {
      const d = await squid(env, "query($c:String!){ accounts(filter:{id:{equalTo:$c}}){ nodes{ id identity{ name } } } }", { c: aj.cuenta });
      const n = d?.accounts?.nodes?.[0];
      existe = !!n;
      nombre = n?.identity?.name || null;
    } catch { /* indexador caído: el panel lo muestra como desconocido */ }
  }
  const { results } = await env.DB.prepare(
    `SELECT code, lang, centimos, created_at, paid_at, via, from_account, paid_centimos, token,
       (SELECT downloads FROM purchases WHERE purchases.token = g1_orders.token) AS downloads
     FROM g1_orders ORDER BY created_at DESC LIMIT 60`
  ).all();
  return json(200, {
    activo: aj.activo, centimos: aj.centimos, cuenta: aj.cuenta, cuentaExiste: existe, cuentaNombre: nombre,
    pedidos: (results || []).map((r) => ({
      codigo: r.code, lang: r.lang, centimos: r.centimos, creado: r.created_at, pagado: r.paid_at,
      via: r.via, desde: r.from_account, recibido: r.paid_centimos, descargas: r.downloads ?? null,
      tieneDescarga: !!r.token,
    })),
  });
}

// POST /admin/g1/config {activo?, centimos?, cuenta?}
async function adminConfig(req, env) {
  const b = await req.json().catch(() => ({}));
  const stmts = [];
  if (b.cuenta !== undefined) {
    const c = String(b.cuenta).trim();
    if (c && !CUENTA_RE.test(c)) return json(400, { error: "Cuenta Ğ1 inválida (empieza con g1…)" });
    stmts.push(guardar(env, "g1_cuenta", c));
  }
  if (b.centimos !== undefined) {
    const n = Math.round(Number(b.centimos));
    if (!(n > 0) || n > 100000000) return json(400, { error: "Precio inválido" });
    stmts.push(guardar(env, "g1_centimos", n));
  }
  if (b.activo !== undefined) {
    if (b.activo) {
      const aj = await leerAjustes(env);
      const cuenta = b.cuenta !== undefined ? String(b.cuenta).trim() : aj.cuenta;
      if (!CUENTA_RE.test(cuenta)) return json(400, { error: "Cargá la cuenta Ğ1 antes de abrir la venta" });
    }
    stmts.push(guardar(env, "g1_activo", b.activo ? "1" : "0"));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return adminVer(env);
}

// POST /admin/g1/pagado {codigo} → acreditar a mano (pago visto en la billetera del autor)
async function adminPagado(req, env, url) {
  const b = await req.json().catch(() => ({}));
  const code = String(b.codigo || "").toUpperCase().trim();
  const p = await env.DB.prepare("SELECT * FROM g1_orders WHERE code = ?").bind(code).first();
  if (!p) return json(404, { error: "Pedido no encontrado" });
  const q = p.token ? p : await acreditar(env, p, {
    via: "manual", transferId: null, desde: null, centimos: p.centimos, bloque: null,
  });
  return json(200, vistaPedido(q, url));
}

// GET /admin/g1/pedido?codigo= → incluye el enlace de descarga (para mostrarle el QR al comprador)
async function adminPedido(url, env) {
  const code = (url.searchParams.get("codigo") || "").toUpperCase().trim();
  const p = await env.DB.prepare("SELECT * FROM g1_orders WHERE code = ?").bind(code).first();
  if (!p) return json(404, { error: "Pedido no encontrado" });
  return json(200, vistaPedido(p, url));
}

// ── router del módulo ────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });
}

// Devuelve una Response si la ruta es del libro en junas, o null.
export async function rutaLibroG1(request, env, url, path, isAdmin) {
  if (path.startsWith("/admin/g1")) {
    if (!isAdmin(request, env)) return json(401, { error: "No autorizado" });
    if (request.method === "GET" && path === "/admin/g1") return adminVer(env);
    if (request.method === "POST" && path === "/admin/g1/config") return adminConfig(request, env);
    if (request.method === "POST" && path === "/admin/g1/pagado") return adminPagado(request, env, url);
    if (request.method === "GET" && path === "/admin/g1/pedido") return adminPedido(url, env);
    return json(404, { error: "Endpoint no encontrado" });
  }
  if (request.method === "GET" && path === "/g1/estado") return estado(env);
  if (request.method === "POST" && path === "/g1/pedido") return crearPedido(request, env, url);
  if (request.method === "GET" && path === "/g1/pedido") return consultarPedido(url, env);
  return null;
}
