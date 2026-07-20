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

let client, dm;
async function ensureXmtp() {
  if (dm) return dm;
  client = await Client.create(makeSigner(wallet), {
    env: CFG.XMTP_ENV,
    dbPath: join(HERE, `xmtp-notifier-${CFG.XMTP_ENV}.db3`),
  });
  await client.conversations.sync();
  // node-sdk v6: createDmWithIdentifier (el newDmWithIdentifier es del browser-sdk)
  dm = await client.conversations.createDmWithIdentifier({
    identifier: CFG.NOTIFY_TO,
    identifierKind: IdentifierKind.Ethereum,
  });
  return dm;
}

async function notify(text) {
  const conv = await ensureXmtp();
  await conv.sendText(text); // v6: send() espera EncodedContent; texto plano = sendText()
  console.log(`📨 ${new Date().toISOString()} → ${text.split('\n')[0]}`);
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

// ── Polling ──
async function poll() {
  const resp = await fetch(`${CFG.API_BASE}/admin/events?since=${state.since}`, {
    headers: { Authorization: `Bearer ${CFG.NOTIFIER_TOKEN}` },
  });
  if (!resp.ok) throw new Error(`events ${resp.status}`);
  const { now, events } = await resp.json();
  for (const ev of events) await notify(fmtEvent(ev));
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

console.log(`Polling cada ${CFG.POLL_MS / 1000}s desde ${new Date(state.since).toISOString()}`);
let failures = 0;
while (true) {
  try {
    await poll();
    failures = 0;
  } catch (e) {
    failures++;
    console.error(`⚠️ poll falló (${failures}): ${e.message}`);
    if (dm && failures > 3) { dm = null; client = null; } // reconectar XMTP si persiste
  }
  await new Promise((r) => setTimeout(r, Math.min(CFG.POLL_MS * Math.max(1, failures), 10 * 60 * 1000)));
}
