// ════════════════════════════════════════════════
//  chatWallet · Notificador XMTP de ventas del libro
//  Corre en la caja always-on: polling a /admin/events del book-api
//  y manda un DM XMTP (misma red que ChatWallet) al autor.
//
//  Config por env o archivo .env junto al script:
//    NOTIFIER_TOKEN  · token de solo-lectura de /admin/events (secret del Worker)
//    NOTIFY_TO       · address ChatWallet del autor (0x…)
//    XMTP_ENV        · production (default) | dev — debe coincidir con la dapp
//    API_BASE        · default https://api.chatwallet.org
//    POLL_MS         · default 60000
//    AGENDA_TOKEN    · NOTIFIER_KEY de la agenda de la Consultoría (energiasonora-agenda). Sin él,
//                      no se leen esos avisos.
//    AGENDA_API      · default https://energiasonora.org/api/agenda
//
//  Estado en state.json (misma carpeta): burner PK del notificador + último `since`.
//  Uso:  node sales-notifier.mjs            (loop)
//        node sales-notifier.mjs --test     (manda un mensaje de prueba y sale)
//        node sales-notifier.mjs --once     (un ciclo de polling y sale — debug)
// ════════════════════════════════════════════════
import { Client, IdentifierKind, ReactionAction, ReactionSchema } from '@xmtp/node-sdk';
import { Wallet, getBytes } from 'ethers';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

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
  XMTP_ENV: process.env.XMTP_ENV || 'production', // la app se mudó el 27/8/2026
  POLL_MS: Number(process.env.POLL_MS || 60000),
  AGENDA_API: process.env.AGENDA_API || 'https://energiasonora.org/api/agenda',
  AGENDA_TOKEN: process.env.AGENDA_TOKEN || '',
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
const NET = { 'arbitrum-one': 'Arbitrum', ethereum: 'Mainnet', g1: 'Ğ1' };

function fmtEvent(ev) {
  const fmt = FMT[ev.format] || ev.format || '?';
  const lang = (ev.lang || 'es').toUpperCase();
  if (ev.type === 'compra-crypto' && ev.network === 'g1') return `💰 Venta en junas (Ğ1) · ${fmt} ${lang} · libro.chatwallet.org`;
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

// Libro en junas (libro.chatwallet.org): si el comprador dejó su ChatWallet, el enlace de descarga
// le llega por chat desde «Energía Sonora» (el PDF pesa ~53 MB: por XMTP viaja el enlace).
const LIBRO_G1_TXT = {
  es: (ev) => `📚 ¡Gracias por comprar Cripto para Soberanos en junas!\n\nTu PDF:\n${ev.descarga}\n\nEl enlace es tuyo y no vence: guardalo acá para volver a bajarlo cuando quieras. (Pedido ${ev.codigo})`,
  fr: (ev) => `📚 Merci d’avoir acheté Crypto pour les Souverains en junes !\n\nVotre PDF :\n${ev.descarga}\n\nLe lien est à vous et n’expire pas : gardez-le ici pour le retélécharger quand vous voulez. (Commande ${ev.codigo})`,
};

async function entregarLibroG1(ev) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(ev.wallet_address || '') || !/^https:\/\//.test(ev.descarga || '')) return;
  const corta = `${ev.wallet_address.slice(0, 6)}…${ev.wallet_address.slice(-4)}`;
  try {
    await brandSend(ev.wallet_address, (LIBRO_G1_TXT[ev.lang] || LIBRO_G1_TXT.es)(ev));
    console.log(`📚 ${new Date().toISOString()} → libro ${ev.codigo} a ${corta}`);
    await notify(`📲 Libro en junas ${ev.codigo} enviado por ChatWallet a ${corta} (desde Energía Sonora)`);
  } catch (e) {
    // mejor esfuerzo, como notifyBuyer: puede no estar en XMTP. El comprador igual tiene la página.
    console.log(`(libro ${ev.codigo} → ${corta} sin XMTP o falló: ${e.message})`);
    await notify(`⚠️ Libro en junas ${ev.codigo}: no pude mandarlo por ChatWallet a ${corta} (${e.message}). Tiene la descarga en la página.`);
  }
}

// ── Polling ──
async function poll() {
  const resp = await fetch(`${CFG.API_BASE}/admin/events?since=${state.since}`, {
    headers: { Authorization: `Bearer ${CFG.NOTIFIER_TOKEN}` },
  });
  if (!resp.ok) throw new Error(`events ${resp.status}`);
  const { now, events } = await resp.json();
  for (const ev of events) {
    if (ev.type === 'libro-g1-chat') { await entregarLibroG1(ev); continue; }
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

// ── Consultoría (agenda de energiasonora.org) ──
// Altas con pago, reservas y cancelaciones. KV puede tardar en mostrar lo último, así que
// se relee un margen de 10 min y se descartan los avisos ya mandados por su id.
async function pollAgenda() {
  if (!CFG.AGENDA_TOKEN) return 0;
  if (!state.agendaSince) { state.agendaSince = Date.now(); state.agendaSeen = []; saveState(state); }
  const since = state.agendaSince - 10 * 60 * 1000;
  const resp = await fetch(`${CFG.AGENDA_API}/events?since=${since}`, {
    headers: { Authorization: `Bearer ${CFG.AGENDA_TOKEN}` },
  });
  if (!resp.ok) throw new Error(`agenda ${resp.status}`);
  const { now, events } = await resp.json();
  const seen = new Set(state.agendaSeen || []);
  let n = 0;
  for (const ev of events) {
    if (seen.has(ev.id)) continue;
    await notify(`${ev.subject}\n${ev.text}`);
    // Confirmación al cliente, si dejó su ChatWallet al contratar
    if (ev.client?.to && /^0x[0-9a-fA-F]{40}$/.test(ev.client.to) && ev.client.to.toLowerCase() !== CFG.NOTIFY_TO) {
      await notifyBuyer(ev.client.to, ev.client.text);
    }
    seen.add(ev.id); n++;
  }
  state.agendaSince = now;
  state.agendaSeen = [...seen].slice(-300);
  saveState(state);
  return n;
}

// ── Avisos del blog de energiasonora.org (identidad propia: «Energía Sonora») ──
// Quien se suscribe firmó con su ChatWallet en el blog (energiasonora.org/api/avisos).
// Los avisos salen de una identidad de marca, no de la burner de ventas ni de xunorus: antes
// del primer aviso se le manda el perfil firmado (nombre + ícono), así ChatWallet muestra quién es.
// La baja: contestar BAJA / STOP en ese chat.
const BRAND = {
  alias: 'Energía Sonora',
  links: 'https://energiasonora.org',
  avatarFile: join(HERE, 'brand-avatar.webp'),
};
const AVISOS_API = process.env.AVISOS_API || 'https://energiasonora.org/api/avisos';
const BAJA = /^\s*(baja|stop|unsubscribe|d[ée]sinscri(re|ption)|desabonner|désabonner)\s*[.!]*\s*$/i;
const AVISO_TXT = {
  es: (p) => `📝 Nuevo en el blog de Energía Sonora\n\n${p.title}\n${p.summary ? p.summary + '\n' : ''}\n${p.url}\n\n(Para dejar de recibir estos avisos, respondé BAJA.)`,
  en: (p) => `📝 New on the Energía Sonora blog\n\n${p.title}\n${p.summary ? p.summary + '\n' : ''}\n${p.url}\n\n(To stop these notices, reply STOP.)`,
  fr: (p) => `📝 Nouveau sur le blog d'Energía Sonora\n\n${p.title}\n${p.summary ? p.summary + '\n' : ''}\n${p.url}\n\n(Pour ne plus recevoir ces avis, répondez STOP.)`,
};
// Bienvenida: llega apenas se suscribe y queda fijada (📌) arriba del chat, así la forma de darse
// de baja está siempre a la vista. En ChatWallet un fijado es una reacción 📌 (lo ven los dos lados).
const BIENVENIDA = {
  es: '👋 ¡Hola! Te suscribiste a los posts nuevos del blog de Energía Sonora. Cada vez que publique algo te llega por este chat.\n\n📌 Para dejar de recibirlos, respondé BAJA en cualquier momento.\n\nhttps://energiasonora.org/blog',
  en: '👋 Hi! You subscribed to new posts on the Energía Sonora blog. Every time I publish something it reaches you in this chat.\n\n📌 To stop receiving them, reply STOP at any time.\n\nhttps://energiasonora.org/blog',
  fr: '👋 Bonjour ! Vous êtes abonné·e aux nouveaux articles du blog d\u2019Energía Sonora. Chaque publication vous arrive dans ce chat.\n\n📌 Pour ne plus les recevoir, répondez STOP à tout moment.\n\nhttps://energiasonora.org/fr/blog',
};
const BAJA_OK = {
  es: 'Listo, ya no vas a recibir avisos del blog. Si querés volver, suscribite de nuevo en energiasonora.org/blog.',
  en: 'Done, you will no longer receive blog notices. To come back, subscribe again at energiasonora.org/blog.',
  fr: 'C’est fait, vous ne recevrez plus d’avis du blog. Pour revenir, abonnez-vous de nouveau sur energiasonora.org/blog.',
};

if (!state.brandPk) {
  state.brandPk = Wallet.createRandom().privateKey;
  saveState(state);
  console.log('🔑 Identidad de marca nueva generada (Energía Sonora)');
}
const brandWallet = new Wallet(state.brandPk);
let brand;
const brandDms = new Map();

async function ensureBrand() {
  if (brand) return brand;
  brand = await Client.create(makeSigner(brandWallet), {
    env: CFG.XMTP_ENV,
    dbPath: join(HERE, `xmtp-brand-${CFG.XMTP_ENV}.db3`),
  });
  await brand.conversations.sync();
  return brand;
}

async function brandDm(address) {
  const addr = address.toLowerCase();
  if (brandDms.has(addr)) return brandDms.get(addr);
  const c = await ensureBrand();
  const dm = await c.conversations.createDmWithIdentifier({ identifier: addr, identifierKind: IdentifierKind.Ethereum });
  brandDms.set(addr, dm);
  state.brandConvs = state.brandConvs || {};
  state.brandConvs[dm.id] = addr;
  return dm;
}

// Perfil soberano v1 de ChatWallet (xmtp.chatwallet/profile:1.0): firmado por la dirección que manda.
// La cadena canónica tiene que ser idéntica a profileCanonical() de la dapp.
let brandProfile = null;
async function brandProfileEncoded() {
  if (!brandProfile) {
    const avatar = existsSync(BRAND.avatarFile) ? 'data:image/webp;base64,' + readFileSync(BRAND.avatarFile).toString('base64') : '';
    // updatedAt fijo mientras no cambie el perfil: si cambia, ChatWallet lo reemplaza.
    const sello = JSON.stringify([BRAND.alias, BRAND.links, avatar.length]);
    if (state.brandProfileSello !== sello) { state.brandProfileSello = sello; state.brandProfileAt = Date.now(); state.brandProfiled = []; saveState(state); }
    const p = { v: 1, did: brandWallet.address, alias: BRAND.alias, links: BRAND.links, avatar, updatedAt: state.brandProfileAt };
    p.sig = await brandWallet.signMessage(JSON.stringify([1, p.did.toLowerCase(), p.alias, p.links, p.avatar, p.updatedAt]));
    if (avatar) p.avatarHash = createHash('sha256').update(avatar).digest('hex');
    brandProfile = {
      type: { authorityId: 'xmtp.chatwallet', typeId: 'profile', versionMajor: 1, versionMinor: 0 },
      parameters: {},
      fallback: `[Perfil de ${BRAND.alias}]`,
      content: new TextEncoder().encode(JSON.stringify(p)),
    };
  }
  return brandProfile;
}

async function brandSend(address, text) {
  const addr = address.toLowerCase();
  const dm = await brandDm(addr);
  const enviados = new Set(state.brandProfiled || []);
  if (!enviados.has(addr)) {
    await dm.send(await brandProfileEncoded());
    enviados.add(addr); state.brandProfiled = [...enviados]; saveState(state);
  }
  return dm.sendText(text);
}

async function avisosApi(path, opts = {}) {
  const r = await fetch(AVISOS_API + path, { ...opts, headers: { Authorization: `Bearer ${CFG.AGENDA_TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`avisos ${path} ${r.status}`);
  return r.json();
}

// Posts anunciados → un mensaje a cada suscriptor en su idioma. Lo ya mandado queda en
// state.avisosSent (post → direcciones), así un corte a mitad de camino no repite mensajes.
async function pollAvisos() {
  if (!CFG.AGENDA_TOKEN) return 0;
  if (!state.avisosSince) { state.avisosSince = Date.now(); saveState(state); }
  const { now, posts } = await avisosApi(`/posts?since=${state.avisosSince - 24 * 3600 * 1000}`);
  state.avisosSent = state.avisosSent || {};
  state.avisosDone = state.avisosDone || [];
  let n = 0;
  const pendientes = posts.filter((p) => !state.avisosDone.includes(p.id));
  if (pendientes.length) {
    const { subs } = await avisosApi('/subs');
    for (const post of pendientes) {
      const ya = new Set(state.avisosSent[post.id] || []);
      for (const s of subs) {
        if (ya.has(s.address)) continue;
        const lang = post.title[s.lang] && post.url[s.lang] ? s.lang : 'es';
        const texto = (AVISO_TXT[s.lang] || AVISO_TXT.es)({ title: post.title[lang], summary: post.summary?.[lang] || '', url: post.url[lang] });
        try { await brandSend(s.address, texto); n++; }
        catch (e) { console.log(`(aviso a ${s.address.slice(0, 10)}… falló: ${e.message})`); }
        // Fallido o no, no se reintenta en cada ciclo: una dirección sin XMTP fallaría siempre.
        ya.add(s.address); state.avisosSent[post.id] = [...ya]; saveState(state);
      }
      state.avisosDone.push(post.id);
      state.avisosDone = state.avisosDone.slice(-200);
      saveState(state);
      console.log(`📝 ${new Date().toISOString()} aviso «${post.id}» → ${ya.size} suscriptor(es)`);
      await notify(`📝 Aviso del blog mandado: ${post.title.es}\n→ ${ya.size} suscriptor(es) por ChatWallet`);
    }
  }
  state.avisosSince = now;
  saveState(state);
  return n;
}

// Suscriptores nuevos → bienvenida fijada. Quien se da de baja sale de la lista de bienvenidos,
// así si vuelve a suscribirse la recibe de nuevo.
async function pollBienvenidas() {
  if (!CFG.AGENDA_TOKEN) return 0;
  const { subs } = await avisosApi('/subs');
  const ya = new Set(state.welcomed || []);
  let n = 0;
  for (const s of subs) {
    if (ya.has(s.address)) continue;
    try {
      const id = await brandSend(s.address, BIENVENIDA[s.lang] || BIENVENIDA.es);
      try {
        await (await brandDm(s.address)).sendReaction({
          reference: id, referenceInboxId: brand.inboxId, action: ReactionAction.Added, content: '📌', schema: ReactionSchema.Unicode,
        });
      } catch (e) { console.log(`(no se pudo fijar la bienvenida: ${e.message})`); }
      n++;
      console.log(`👋 ${new Date().toISOString()} bienvenida → ${s.address.slice(0, 10)}… (${s.lang})`);
      await notify(`👋 Nuevo suscriptor del blog (${s.lang}). Ya son ${subs.length}.`);
    } catch (e) { console.log(`(bienvenida a ${s.address.slice(0, 10)}… falló: ${e.message})`); }
    // Fallida o no, se marca: una dirección sin XMTP fallaría en cada ciclo.
    ya.add(s.address); state.welcomed = [...ya]; saveState(state);
  }
  return n;
}

// Bajas: se leen las respuestas nuevas en los chats de la marca.
async function pollBajas() {
  if (!CFG.AGENDA_TOKEN || !state.brandConvs || !Object.keys(state.brandConvs).length) return 0;
  const c = await ensureBrand();
  await c.conversations.syncAll();
  const desde = BigInt(state.bajasNs || String(BigInt(Date.now()) * 1000000n));
  let max = desde, n = 0;
  for (const dm of c.conversations.listDms()) {
    const addr = state.brandConvs[dm.id];
    if (!addr) continue;
    const msgs = await dm.messages({ sentAfterNs: desde, excludeSenderInboxIds: [c.inboxId] });
    for (const m of msgs) {
      if (m.sentAtNs > max) max = m.sentAtNs;
      if (typeof m.content !== 'string' || !BAJA.test(m.content)) continue;
      const { subs } = await avisosApi('/subs');
      const lang = subs.find((s) => s.address === addr)?.lang || (/stop/i.test(m.content) ? 'en' : 'es');
      await avisosApi('/unsub', { method: 'POST', body: JSON.stringify({ address: addr }) });
      state.welcomed = (state.welcomed || []).filter((a) => a !== addr);
      state.bajasTotal = (state.bajasTotal || 0) + 1;
      try { await dm.sendText(BAJA_OK[lang] || BAJA_OK.es); } catch (_) {}
      console.log(`🚪 ${new Date().toISOString()} baja de ${addr.slice(0, 10)}…`);
      n++;
    }
  }
  state.bajasNs = String(max);
  saveState(state);
  return n;
}

// ── Main ──
if (process.argv.includes('--test')) {
  await notify('👋 Soy el notificador de ventas de Cripto para Soberanos. Por acá te aviso cada venta y pedido. Agendame como "📚 Ventas del libro".');
  console.log('Test OK');
  process.exit(0);
}

// Manda el perfil de la marca y un saludo a una dirección (para ver cómo se ve en ChatWallet).
//   node sales-notifier.mjs --brand-test 0x…
const bt = process.argv.indexOf('--brand-test');
if (bt > -1) {
  const to = (process.argv[bt + 1] || CFG.NOTIFY_TO).toLowerCase();
  console.log(`Marca: ${brandWallet.address} → ${to}`);
  state.brandProfiled = (state.brandProfiled || []).filter((a) => a !== to);
  await brandSend(to, '👋 Hola, soy Energía Sonora. Por este chat llegan los avisos de los posts nuevos del blog.');
  console.log('Brand test OK');
  process.exit(0);
}

if (process.argv.includes('--once')) {
  console.log(`Consultoría: ${await pollAgenda()} aviso(s)`);
  console.log(`Blog: ${await pollBienvenidas()} bienvenida(s), ${await pollAvisos()} aviso(s), ${await pollBajas()} baja(s)`);
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
  // La agenda va aparte: si energiasonora.org falla, los avisos del libro siguen.
  try { await pollAgenda(); } catch (e) { console.error(`⚠️ agenda falló: ${e.message}`); }
  // Fuera del try de arriba: que un resumen fallido tampoco corte el loop
  try { await maybeDigest(); } catch (e) { console.error(`⚠️ resumen diario falló: ${e.message}`); }
  // Avisos del blog y bajas: aparte, que un fallo no corte lo demás.
  try { await pollBienvenidas(); } catch (e) { console.error(`⚠️ bienvenidas falló: ${e.message}`); }
  try { await pollAvisos(); } catch (e) { console.error(`⚠️ avisos falló: ${e.message}`); }
  try { await pollBajas(); } catch (e) { console.error(`⚠️ bajas falló: ${e.message}`); brand = null; brandDms.clear(); }
  await new Promise((r) => setTimeout(r, Math.min(CFG.POLL_MS * Math.max(1, failures), 10 * 60 * 1000)));
}
