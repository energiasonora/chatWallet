// ════════════════════════════════════════════════
//  chatWallet · Notificador XMTP de ventas del libro
//  Corre en la caja always-on: polling a /admin/events del book-api
//  y manda un DM XMTP (env dev, misma red que ChatWallet) al autor.
//
//  Config por env o archivo .env junto al script:
//    NOTIFIER_TOKEN  · token de solo-lectura de /admin/events (secret del Worker)
//    NOTIFY_TO       · address ChatWallet del autor (0x…)
//    XMTP_ENV        · dev (default) | production — debe coincidir con la dapp
//    API_BASE        · default https://api.chatwallet.org
//    POLL_MS         · default 60000
//
//  Estado en state.json (misma carpeta): burner PK del notificador + último `since`.
//  Uso:  node sales-notifier.mjs            (loop)
//        node sales-notifier.mjs --test     (manda un mensaje de prueba y sale)
//        node sales-notifier.mjs --once     (un ciclo de polling y sale — debug)
// ════════════════════════════════════════════════
import { Client, IdentifierKind } from '@xmtp/node-sdk';
import { Wallet, getBytes } from 'ethers';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(HERE, 'state.json');
const ENV_FILE = join(HERE, '.env');

// ── Config ──
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const CFG = {
  API_BASE: process.env.API_BASE || 'https://api.chatwallet.org',
  NOTIFIER_TOKEN: process.env.NOTIFIER_TOKEN,
  NOTIFY_TO: (process.env.NOTIFY_TO || '').toLowerCase(),
  XMTP_ENV: process.env.XMTP_ENV || 'dev',
  POLL_MS: Number(process.env.POLL_MS || 60000),
  DIGEST_AT: process.env.DIGEST_AT || '21:00', // hora local de la caja; 'off' lo desactiva
};
if (!CFG.NOTIFIER_TOKEN || !CFG.NOTIFY_TO) {
  console.error('Faltan NOTIFIER_TOKEN y/o NOTIFY_TO (env o .env junto al script)');
  process.exit(1);
}

// ── Estado persistente (burner PK + since) ──
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveState(s) { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

const state = loadState();
if (!state.pk) {
  state.pk = Wallet.createRandom().privateKey;
  saveState(state);
  console.log('🔑 Identidad burner nueva generada para el notificador');
}
if (!state.since) { state.since = Date.now(); saveState(state); } // primer arranque: no inundar con historial

// ── XMTP ──
const wallet = new Wallet(state.pk);
console.log(`Notificador: ${wallet.address} → avisa a ${CFG.NOTIFY_TO} (XMTP ${CFG.XMTP_ENV})`);

function makeSigner(w) {
  return {
    type: 'EOA',
    getIdentifier: () => ({ identifier: w.address.toLowerCase(), identifierKind: IdentifierKind.Ethereum }),
    signMessage: async (message) => getBytes(await w.signMessage(message)),
  };
}

let client;
const dms = new Map(); // address → conversación (autor + compradores que dejaron su ChatWallet)

async function ensureClient() {
  if (client) return client;
  client = await Client.create(makeSigner(wallet), {
    env: CFG.XMTP_ENV,
    dbPath: join(HERE, `xmtp-notifier-${CFG.XMTP_ENV}.db3`),
  });
  await client.conversations.sync();
  return client;
}

async function dmTo(address) {
  const addr = address.toLowerCase();
  if (dms.has(addr)) return dms.get(addr);
  const c = await ensureClient();
  // node-sdk v6: createDmWithIdentifier (el newDmWithIdentifier es del browser-sdk)
  const dm = await c.conversations.createDmWithIdentifier({
    identifier: addr,
    identifierKind: IdentifierKind.Ethereum,
  });
  dms.set(addr, dm);
  return dm;
}

async function notify(text) {
  const conv = await dmTo(CFG.NOTIFY_TO);
  await conv.sendText(text); // v6: send() espera EncodedContent; texto plano = sendText()
  console.log(`📨 ${new Date().toISOString()} → ${text.split('\n')[0]}`);
}

// DM al comprador (mejor esfuerzo: puede no estar registrado en XMTP)
async function notifyBuyer(address, text) {
  try {
    const conv = await dmTo(address);
    await conv.sendText(text);
    console.log(`📬 ${new Date().toISOString()} → comprador ${address.slice(0, 10)}…`);
  } catch (e) {
    console.log(`(comprador ${address.slice(0, 10)}… sin XMTP o falló: ${e.message})`);
  }
}

// ── Formateo de eventos ──
const FMT = { digital: 'Digital 📄', physical: 'Físico+digital 📦📄', 'physical-only': 'Físico 📦' };
const NET = { 'arbitrum-one': 'Arbitrum', ethereum: 'Mainnet' };

function fmtEvent(ev) {
  const fmt = FMT[ev.format] || ev.format || '?';
  const lang = (ev.lang || 'es').toUpperCase();
  if (ev.type === 'compra-crypto') {
    const eth = ev.amount_eth ? `${parseFloat(ev.amount_eth).toFixed(5)} ETH` : '';
    return `💰 Venta crypto · ${fmt} ${lang} · ${eth} (${NET[ev.network] || ev.network})`;
  }
  const via = ev.payment_method === 'mercadopago'
    ? `$${(ev.ars_amount || 0).toLocaleString('es-AR')} ARS · MP acreditado`
    : 'pagado con ETH';
  const fisico = ev.format !== 'digital';
  const head = fisico ? `📦 ¡Pedido físico pagado!` : `💰 Venta`;
  const lugar = fisico && ev.city ? ` · 📍 ${ev.city}` : '';
  const accion = fisico ? `\n→ datos de envío en chatwallet.org/book-admin.html` : '';
  return `${head} ${ev.public_id} · ${fmt} ${lang} · ${via}${lugar}${accion}`;
}

// ── Resumen diario ──
// El silencio es ambiguo: "hoy no hubo ventas" y "el notificador está muerto" se ven
// exactamente igual desde el chat. Este mensaje llega SIEMPRE, aunque no haya pasado
// nada, así que si un día no llega, eso ya es la señal de que algo se rompió.
const ARRANQUE = Date.now();
let pollsOk = 0;
let pollsFallidos = 0;

const [DIG_H, DIG_M] = (CFG.DIGEST_AT.match(/^(\d{1,2}):(\d{2})$/) || []).slice(1).map(Number);
const DIGEST_ON = Number.isInteger(DIG_H);

// YYYY-MM-DD en hora local de la caja: el corte del día es el del autor, no UTC
const diaLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Lectura aparte del día, con su propio `since`: NO toca state.since ni el flujo de avisos
async function eventosDelDia() {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const resp = await fetch(`${CFG.API_BASE}/admin/events?since=${inicio.getTime()}`, {
    headers: { Authorization: `Bearer ${CFG.NOTIFIER_TOKEN}` },
  });
  if (!resp.ok) throw new Error(`events ${resp.status}`);
  return (await resp.json()).events || [];
}

async function textoDigest() {
  const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  const L = [`🌙 Resumen diario · ${fecha}`];

  const eventos = await eventosDelDia().catch(() => null);
  if (eventos === null) {
    L.push('⚠️ No pude leer las ventas del día (la API no respondió).');
  } else if (eventos.length === 0) {
    L.push('Ventas de hoy: ninguna.');
  } else {
    const ars = eventos.reduce((a, e) => a + (e.ars_amount || 0), 0);
    L.push(`Ventas de hoy: ${eventos.length}${ars ? ` · $${ars.toLocaleString('es-AR')} ARS` : ''}`);
    for (const ev of eventos) L.push(`  • ${fmtEvent(ev).split('\n')[0]}`);
  }

  const fund = await fetch(`${CFG.API_BASE}/funding`).then((r) => r.json()).catch(() => null);
  if (fund) L.push(`Recaudado total: ${Number(fund.raisedEth).toFixed(5)} ETH`);

  const horas = Math.floor((Date.now() - ARRANQUE) / 3600000);
  L.push(`Estado: ✅ vivo hace ${horas}h · ${pollsOk} chequeos` +
    (pollsFallidos ? ` · ⚠️ ${pollsFallidos} fallos de red` : ' · sin fallos'));
  return L.join('\n');
}

async function maybeDigest() {
  if (!DIGEST_ON) return;
  const ahora = new Date();
  const hoy = diaLocal(ahora);
  if (state.lastDigest === hoy) return; // ya salió el de hoy (persistido: sobrevive reinicios)
  if (ahora.getHours() < DIG_H || (ahora.getHours() === DIG_H && ahora.getMinutes() < DIG_M)) return;
  await notify(await textoDigest());
  state.lastDigest = hoy;
  saveState(state);
  pollsOk = 0;
  pollsFallidos = 0;
}

// ── Polling ──
async function poll() {
  const resp = await fetch(`${CFG.API_BASE}/admin/events?since=${state.since}`, {
    headers: { Authorization: `Bearer ${CFG.NOTIFIER_TOKEN}` },
  });
  if (!resp.ok) throw new Error(`events ${resp.status}`);
  const { now, events } = await resp.json();
  for (const ev of events) {
    await notify(fmtEvent(ev));
    // si el comprador dejó su ChatWallet, le confirmamos la compra por chat
    if (ev.type === 'pedido' && ev.wallet_address && /^0x[0-9a-fA-F]{40}$/.test(ev.wallet_address)) {
      const fisico = ev.format !== 'digital';
      await notifyBuyer(ev.wallet_address,
        `✅ ¡Gracias por tu compra de Cripto para Soberanos! Tu pedido ${ev.public_id} está confirmado` +
        (fisico ? ' — tu ejemplar entra a imprenta (~10 días).' : ' — tu PDF ya está disponible.') +
        `\nSeguilo acá: https://chatwallet.org/book.html?pedido=${ev.public_id}`);
    }
  }
  state.since = now;
  saveState(state);
  return events.length;
}

// ── Main ──
if (process.argv.includes('--test')) {
  await notify('👋 Soy el notificador de ventas de Cripto para Soberanos. Por acá te aviso cada venta y pedido. Agendame como "📚 Ventas del libro".');
  console.log('Test OK');
  process.exit(0);
}

if (process.argv.includes('--once')) {
  const n = await poll();
  console.log(`Once OK: ${n} evento(s)`);
  process.exit(0);
}

// Manda el resumen diario ahora mismo y sale (para probarlo sin esperar a la hora)
if (process.argv.includes('--digest')) {
  await notify(await textoDigest());
  console.log('Digest OK');
  process.exit(0);
}

console.log(`Polling cada ${CFG.POLL_MS / 1000}s desde ${new Date(state.since).toISOString()}` +
  (DIGEST_ON ? ` · resumen diario ${CFG.DIGEST_AT}` : ' · resumen diario desactivado'));
let failures = 0;
while (true) {
  try {
    await poll();
    pollsOk++;
    failures = 0;
  } catch (e) {
    failures++;
    pollsFallidos++;
    console.error(`⚠️ poll falló (${failures}): ${e.message}`);
    // Fallo persistente: tiramos la sesión XMTP y las conversaciones cacheadas para
    // reconectar de cero en el próximo ciclo. OJO: acá decía `dm`, una variable que no
    // existe en este scope (las conversaciones viven en el Map `dms`) → ReferenceError
    // que MATABA el proceso justo cuando había que aguantar un fallo de red pasajero.
    if (failures > 3) { dms.clear(); client = null; }
  }
  // Fuera del try de arriba: que un resumen fallido tampoco corte el loop
  try { await maybeDigest(); } catch (e) { console.error(`⚠️ resumen diario falló: ${e.message}`); }
  await new Promise((r) => setTimeout(r, Math.min(CFG.POLL_MS * Math.max(1, failures), 10 * 60 * 1000)));
}
