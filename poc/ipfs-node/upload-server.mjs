// POC del endpoint de subida autenticada que reemplaza el flujo VIP/UCAN de Storacha.
// El browser NO habla con Kubo directo (su API es poderosa); habla con ESTE server, que:
//   1. verifica la firma del DID (wallet) sobre el CID+size → autentica el contenido exacto
//   2. (opcional) chequea cuota
//   3. mete los bytes en el Kubo LOCAL y pinea
//   4. verifica que el CID que devuelve Kubo == el CID firmado (integridad)
//   5. devuelve CID + URL de gateway
// En producción esto se pliega dentro de server.js (que ya corre) reemplazando /api/delegate.
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const KUBO_API = process.env.KUBO_API || 'http://127.0.0.1:5001';
const GATEWAY = process.env.KUBO_GATEWAY || 'http://127.0.0.1:8080';
const PORT = process.env.UPLOAD_PORT || 3100;

// ── Límites de subida ───────────────────────────────────────────────────────
// Hasta la v del 23/11/2026 cualquier wallet (una inventada en el momento sirve) podía subir
// 100 MB por vez, sin tope: alcanzaba para llenar los 15 GB del repo, y un disco lleno es lo que
// rompió los pins en agosto. Crear wallets es gratis, así que el tope por wallet solo no frena a
// nadie: hay tres capas para el uso gratis (wallet, IP, total del día) y un freno por el repo.
//
// Uso legítimo medido (nov 2026): respaldos de chat y avatares, ~35 KB de promedio por subida,
// 2 MB en 4 días entre todas las wallets. Los topes gratis dejan un margen de cientos de veces.
//
// Las wallets con plan (espacio-planes.json, se edita con espacio.mjs) se saltean los topes
// diarios y tienen su propio espacio total y vencimiento.
const MB = 1024 * 1024;
const envMB = (k, def) => Number(process.env[k] || def) * MB;
const LIM = {
  freeFile: envMB('FREE_MAX_FILE_MB', 5),          // un archivo, sin plan
  freeWalletDay: envMB('FREE_WALLET_DAY_MB', 20),  // por wallet y por día, sin plan
  freeIpDay: envMB('FREE_IP_DAY_MB', 50),          // por IP y por día, sin plan
  freeGlobalDay: envMB('FREE_GLOBAL_DAY_MB', 300), // todas las subidas sin plan del día
  planFile: envMB('PLAN_MAX_FILE_MB', 100),        // un archivo, con plan
  freeRepoPct: Number(process.env.FREE_REPO_PCT || 80), // repo por encima de esto: sin plan no sube
  planRepoPct: Number(process.env.PLAN_REPO_PCT || 92), // por encima de esto no sube nadie
};

// Planes: { "0xabc…": { "bytes": 10737418240, "used": 0, "until": "2026-12-23", "nota": "…" } }
// Se relee cuando cambia el archivo, así espacio.mjs lo edita sin reiniciar el server.
const PLANES_FILE = process.env.ESPACIO_PLANES || fileURLToPath(new URL('./espacio-planes.json', import.meta.url));
let planes = {};
let planesMtime = 0;
function cargarPlanes() {
  try {
    if (!existsSync(PLANES_FILE)) { planes = {}; planesMtime = 0; return; }
    const m = statSync(PLANES_FILE).mtimeMs;
    if (m === planesMtime) return;
    planes = JSON.parse(readFileSync(PLANES_FILE, 'utf8'));
    planesMtime = m;
  } catch (e) { console.error('espacio-planes.json ilegible, sigo con lo anterior:', e.message); }
}
function guardarPlanes() {
  const tmp = PLANES_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(planes, null, 2));
  renameSync(tmp, PLANES_FILE);
  planesMtime = statSync(PLANES_FILE).mtimeMs;
}
// Un plan vale hasta el final del día de "until" (hora de Argentina).
function planVigente(addr) {
  cargarPlanes();
  const p = planes[addr];
  if (!p) return null;
  if (p.until && Date.now() > Date.parse(`${p.until}T23:59:59-03:00`)) return null;
  return p;
}

// Contadores del día en memoria. Se vacían a medianoche UTC. Un reinicio también los vacía; no
// es un hueco útil para nadie de afuera, que no puede reiniciar el server.
let dia = new Date().toISOString().slice(0, 10);
let usoWallet = new Map(), usoIp = new Map(), usoGlobal = 0;
function rotarDia() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy !== dia) { dia = hoy; usoWallet = new Map(); usoIp = new Map(); usoGlobal = 0; }
}

// La IP real llega en CF-Connecting-IP, pero sólo se le cree si la conexión viene del túnel
// (cloudflared en la misma máquina). Desde la red de casa, la IP es la del socket.
function ipDe(req) {
  const sock = req.socket.remoteAddress || '';
  const local = sock === '127.0.0.1' || sock === '::1' || sock === '::ffff:127.0.0.1';
  return (local && req.header('cf-connecting-ip')) || sock;
}

// Uso del repo de Kubo, con caché de 60 s para no preguntar en cada subida.
let repo = { pct: 0, at: 0 };
async function repoPct() {
  if (Date.now() - repo.at < 60_000) return repo.pct;
  try {
    const r = await fetch(`${KUBO_API}/api/v0/repo/stat?size-only=true`, { method: 'POST', signal: AbortSignal.timeout(10_000) });
    const j = await r.json();
    repo = { pct: j.StorageMax ? (100 * j.RepoSize) / j.StorageMax : 0, at: Date.now() };
  } catch (e) {
    // Si Kubo no contesta, la subida igual va a fallar en el add; no se inventa un número.
    console.warn('repo/stat falló:', e.message);
  }
  return repo.pct;
}

const fmtMB = (b) => `${(b / MB).toFixed(b < 10 * MB ? 1 : 0)} MB`;

// ── Métricas ────────────────────────────────────────────────────────────────
// Sin dependencias ni base de datos: contadores en memoria que se leen por /metrics.
// POR QUÉ: hasta ahora la única señal era /health devolviendo {ok:true}, que no dice
// nada sobre el volumen ni sobre las fallas. Sin esto no hay forma de saber si estamos
// cerca de un límite ni de decidir cuándo activar la capa siguiente de escalado.
const metrics = {
  startedAt: Date.now(),
  uploads: 0,
  uploadBytes: 0,
  uploadMsTotal: 0,
  pointerPublishes: 0,
  errors: {},          // código HTTP -> cantidad
};
function countError(code) { metrics.errors[code] = (metrics.errors[code] || 0) + 1; }

const app = express();
app.use(cors());

// Health check liviano: el banner de Docs lo usa para mostrar el estado del nodo.
app.get('/health', (req, res) => res.json({ ok: true }));

// Métricas en texto plano (formato Prometheus, legible a ojo con curl).
app.get('/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.startedAt) / 1000);
  const avgMs = metrics.uploads ? Math.round(metrics.uploadMsTotal / metrics.uploads) : 0;
  const lines = [
    `chatwallet_uptime_seconds ${uptime}`,
    `chatwallet_uploads_total ${metrics.uploads}`,
    `chatwallet_upload_bytes_total ${metrics.uploadBytes}`,
    `chatwallet_upload_duration_ms_avg ${avgMs}`,
    `chatwallet_pointer_publishes_total ${metrics.pointerPublishes}`,
    `chatwallet_pointers_current ${Object.keys(backupPointers).length}`,
    `chatwallet_free_upload_bytes_today ${dia === new Date().toISOString().slice(0, 10) ? usoGlobal : 0}`,
    `chatwallet_free_wallets_today ${usoWallet.size}`,
    `chatwallet_repo_pct ${repo.pct.toFixed(1)}`,
  ];
  for (const [code, n] of Object.entries(metrics.errors)) {
    lines.push(`chatwallet_errors_total{code="${code}"} ${n}`);
  }
  res.type('text/plain').send(lines.join('\n') + '\n');
});
// Un solo lugar donde se contabiliza el resultado: así ninguna rama de error se
// escapa de las métricas (que es como no enterarse de que algo falla sistemáticamente).
const failer = (res) => (code, error) => { countError(code); return res.status(code).json({ error }); };

// Paso 1, ANTES de leer el cuerpo: firma, tamaño y topes salen de los headers. Así un archivo
// que no corresponde se rechaza sin cargar 100 MB en memoria. El tamaño declarado está firmado,
// y en el paso 2 se exige que el cuerpo mida exactamente eso.
async function precheck(req, res, next) {
  const fail = failer(res);
  try {
    const address = req.header('x-address');
    const signature = req.header('x-signature');
    const claimedSha = req.header('x-sha256'); // hex del sha256 de los bytes (plaintext o ciphertext)
    const size = Number(req.header('x-size'));
    if (!address || !signature || !claimedSha) return fail(400, 'Faltan address/signature/sha256');
    if (!Number.isSafeInteger(size) || size <= 0) return fail(400, 'x-size inválido');
    const cl = req.header('content-length');
    if (cl !== undefined && Number(cl) !== size) return fail(400, 'content-length no coincide con x-size');

    // El usuario firma "ipfs-upload:<sha256>:<size>" con su wallet (DID).
    // sha256 sobre los bytes crudos → size-agnóstico (no depende del chunking de IPFS).
    let recovered;
    try { recovered = ethers.verifyMessage(`ipfs-upload:${claimedSha}:${size}`, signature); }
    catch (e) { return fail(401, 'Firma ilegible'); }
    if (recovered.toLowerCase() !== address.toLowerCase()) return fail(401, 'Firma no corresponde a la address');

    const addr = address.toLowerCase();
    const ip = ipDe(req);
    const plan = planVigente(addr);
    const pct = await repoPct();

    if (plan) {
      if (size > LIM.planFile) return fail(413, `El archivo supera ${fmtMB(LIM.planFile)}`);
      if (pct >= LIM.planRepoPct) return fail(507, 'El nodo está casi lleno. Probá más tarde.');
      if ((plan.used || 0) + size > plan.bytes) {
        return fail(403, `Tu plan no tiene lugar: usaste ${fmtMB(plan.used || 0)} de ${fmtMB(plan.bytes)}`);
      }
    } else {
      if (size > LIM.freeFile) return fail(413, `Sin plan, cada archivo puede pesar hasta ${fmtMB(LIM.freeFile)}`);
      if (pct >= LIM.freeRepoPct) return fail(507, 'El nodo está casi lleno: por ahora sólo suben las wallets con plan.');
      rotarDia();
      if ((usoWallet.get(addr) || 0) + size > LIM.freeWalletDay) {
        return fail(429, `Esta wallet ya subió ${fmtMB(usoWallet.get(addr) || 0)} hoy; el tope sin plan es ${fmtMB(LIM.freeWalletDay)} por día`);
      }
      if ((usoIp.get(ip) || 0) + size > LIM.freeIpDay) return fail(429, 'Demasiadas subidas desde esta conexión hoy. Probá mañana.');
      if (usoGlobal + size > LIM.freeGlobalDay) return fail(429, 'El nodo llegó a su tope de subidas gratis de hoy. Probá mañana.');
      // Se reserva ya, para que varias subidas en paralelo no pasen todas el mismo control.
      usoWallet.set(addr, (usoWallet.get(addr) || 0) + size);
      usoIp.set(ip, (usoIp.get(ip) || 0) + size);
      usoGlobal += size;
      // Si después algo falla, se devuelve la reserva (una sola vez).
      let devuelto = false;
      req.cwDevolver = () => {
        if (devuelto) return; devuelto = true;
        if (dia !== req.cwDia) return; // ya cambió el día: los contadores son otros
        usoWallet.set(addr, Math.max(0, (usoWallet.get(addr) || 0) - size));
        usoIp.set(ip, Math.max(0, (usoIp.get(ip) || 0) - size));
        usoGlobal = Math.max(0, usoGlobal - size);
      };
      req.cwDia = dia;
      res.on('finish', () => { if (res.statusCode >= 400) req.cwDevolver(); });
      res.on('close', () => { if (!res.writableFinished) req.cwDevolver(); });
    }
    req.cw = { addr, claimedSha, size, plan: !!plan };
    next();
  } catch (e) {
    console.error('precheck error', e);
    return fail(500, e.message);
  }
}

// Paso 1b: leer el cuerpo con el tope que corresponde a quien sube.
const rawFree = express.raw({ type: '*/*', limit: LIM.freeFile });
const rawPlan = express.raw({ type: '*/*', limit: LIM.planFile });
const leerCuerpo = (req, res, next) => (req.cw.plan ? rawPlan : rawFree)(req, res, next);

app.post('/api/ipfs/upload', precheck, leerCuerpo, async (req, res) => {
  const t0 = Date.now();
  const fail = failer(res);
  try {
    const { addr, claimedSha, size } = req.cw;
    const bytes = req.body; // Buffer
    if (!Buffer.isBuffer(bytes) || bytes.length !== size) {
      return fail(400, `El cuerpo mide ${bytes?.length ?? 0} bytes y la firma dice ${size}`);
    }

    // 2. Integridad: los bytes recibidos deben hashear al sha256 firmado (cualquier tamaño).
    const actualSha = createHash('sha256').update(bytes).digest('hex');
    if (actualSha !== claimedSha) {
      return fail(409, `sha256 no coincide: firmado ${claimedSha} vs recibido ${actualSha}`);
    }

    // 3. Meter en Kubo local y pinear. Kubo calcula el CID (dag-pb para >256KB, raw para chico).
    //    El cliente aprende el CID de la respuesta y lo guarda en la atestación del DID.
    const form = new FormData();
    form.append('file', new Blob([bytes]), 'f');
    const kuboRes = await fetch(`${KUBO_API}/api/v0/add?cid-version=1&pin=true`, {
      method: 'POST', body: form,
    });
    if (!kuboRes.ok) {
      return fail(502, `Kubo add falló: ${kuboRes.status}`);
    }
    const text = await kuboRes.text();
    const last = text.trim().split('\n').pop();
    const kuboCid = JSON.parse(last).Hash;

    // 4. Descontar del plan (las subidas gratis ya quedaron reservadas en el precheck) y responder.
    if (req.cw.plan) {
      cargarPlanes();
      if (planes[addr]) {
        planes[addr].used = (planes[addr].used || 0) + bytes.length;
        try { guardarPlanes(); } catch (e) { console.error('No se pudo guardar espacio-planes.json:', e.message); }
      }
    }
    metrics.uploads++;
    metrics.uploadBytes += bytes.length;
    metrics.uploadMsTotal += Date.now() - t0;
    res.json({ success: true, cid: kuboCid, gateway: `${GATEWAY}/ipfs/${kuboCid}`, pinned: true });
  } catch (e) {
    console.error('upload error', e);
    countError(500);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  POINTER DE RESPALDO DE CHATS (address → último CID)
//  El dapp sube el respaldo cifrado por /api/ipfs/upload (blob opaco: el server
//  no puede leerlo) y publica acá el CID firmado. Un dispositivo nuevo, con solo
//  la seed, pregunta por su address y recupera el historial.
//  Persistido en backup-pointers.json para sobrevivir reinicios.
// ═══════════════════════════════════════════════════════════════════════════
const POINTERS_FILE = fileURLToPath(new URL('./backup-pointers.json', import.meta.url));
let backupPointers = {};
try { if (existsSync(POINTERS_FILE)) backupPointers = JSON.parse(readFileSync(POINTERS_FILE, 'utf8')); }
catch (e) { console.warn('backup-pointers.json ilegible, arrancando vacío:', e.message); }
// Escritura ATÓMICA y coalescida del padrón.
// Antes esto era un writeFileSync directo sobre el archivo final, con dos problemas:
//   · un corte a mitad de escritura no perdía UN pointer, perdía el padrón ENTERO
//     (queda truncado y al arrancar se parsea mal → todos los respaldos quedan huérfanos);
//   · el costo es O(usuarios) por publicación, y cada respaldo de cada usuario publica.
// Ahora se escribe a un temporal y se renombra (rename es atómico dentro del mismo
// filesystem: o está el archivo viejo entero o el nuevo entero, nunca a medias), y las
// publicaciones que llegan juntas se agrupan en un solo flush.
const POINTERS_FLUSH_MS = 1000;
let pointersDirty = false;
let pointersTimer = null;
let pointersLastFlush = 0;

function flushPointers() {
  if (pointersTimer) { clearTimeout(pointersTimer); pointersTimer = null; }
  if (!pointersDirty) return;
  try {
    const tmp = POINTERS_FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify(backupPointers, null, 2));
    renameSync(tmp, POINTERS_FILE);
    pointersDirty = false;
    pointersLastFlush = Date.now();
  } catch (e) {
    // Queda sucio a propósito: que lo reintente el próximo flush en vez de dar por
    // guardado algo que no se guardó.
    console.error('No se pudo persistir backup-pointers.json:', e.message);
  }
}

function savePointers() {
  pointersDirty = true;
  const since = Date.now() - pointersLastFlush;
  // La primera publicación se escribe YA (no queremos una ventana de pérdida cuando el
  // tráfico es bajo, que es siempre salvo en una ráfaga); las de una ráfaga se agrupan.
  if (since >= POINTERS_FLUSH_MS) flushPointers();
  else if (!pointersTimer) pointersTimer = setTimeout(flushPointers, POINTERS_FLUSH_MS - since);
}

// Un apagado ordenado no puede llevarse lo que quedó pendiente en la ventana de coalescencia.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { flushPointers(); process.exit(0); });
}

app.post('/api/backup/pointer', express.json(), async (req, res) => {
  try {
    const { address, cid, ts, count, signature } = req.body || {};
    if (!address || !cid || !ts || !signature) {
      return res.status(400).json({ error: 'Faltan address/cid/ts/signature' });
    }
    // El dueño de la address firma "chatwallet-backup:<cid>:<ts>" — nadie más puede pisar su pointer.
    let recovered;
    try { recovered = ethers.verifyMessage(`chatwallet-backup:${cid}:${ts}`, signature); }
    catch (e) { return res.status(401).json({ error: 'Firma ilegible' }); }
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Firma no corresponde a la address' });
    }

    const addr = address.toLowerCase();
    const prev = backupPointers[addr];
    if (prev && prev.ts >= ts) {
      return res.status(409).json({ error: 'Ya hay un pointer más nuevo', current: prev });
    }
    backupPointers[addr] = { cid, ts, count: count ?? null };
    savePointers();
    metrics.pointerPublishes++;

    // Best-effort: despinear el respaldo anterior para no acumular blobs viejos en Kubo.
    if (prev && prev.cid && prev.cid !== cid) {
      fetch(`${KUBO_API}/api/v0/pin/rm?arg=${prev.cid}`, { method: 'POST' })
        .catch(e => console.warn(`unpin ${prev.cid} falló:`, e.message));
    }

    res.json({ success: true, cid, ts });
  } catch (e) {
    console.error('backup pointer error', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/backup/pointer/:address', (req, res) => {
  const ptr = backupPointers[(req.params.address || '').toLowerCase()];
  if (!ptr) return res.status(404).json({ error: 'Sin respaldo para esa address' });
  res.json(ptr);
});

app.listen(PORT, () => console.log(`POC upload server en http://localhost:${PORT} (Kubo ${KUBO_API})`));
