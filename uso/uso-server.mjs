// Panel de uso de ChatWallet: junta en un solo lugar lo que la infraestructura propia ya sabe.
//
// No agrega rastreo a la app. Todo sale de datos que ya existen por otro motivo:
//   · respaldos de chat (backup-pointers.json): una entrada por wallet, con la fecha del último
//   · subidas al nodo (/metrics del upload-server)
//   · avisos de despertar (ntfy)
//   · relayer (libro.jsonl)
//   · descargas del APK (releases de GitHub)
//   · visitas a chatwallet.org (Cloudflare, sólo si hay token con permiso de analítica)
//
// Entra sólo quien firma con una wallet de la lista USO_ADMINS. Hacia afuera salen cuentas,
// nunca direcciones.
//
//   USO_PORT=3300 node uso-server.mjs

import express from 'express';
import { ethers } from 'ethers';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const aqui = (p) => fileURLToPath(new URL(p, import.meta.url));
const PORT = Number(process.env.USO_PORT || 3300);
const ADMINS = (process.env.USO_ADMINS || '0xe14F241B23AC40487FAEDf68fFf2a6c693780f82')
    .split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
// Sin secreto fijo, las sesiones mueren con cada reinicio: molesto pero seguro.
const SECRETO = process.env.USO_SECRET || crypto.randomBytes(32).toString('hex');
const POINTERS = process.env.USO_POINTERS || aqui('../backup-pointers.json');
const LIBRO = process.env.USO_RELAY_LEDGER || aqui('../relay/libro.jsonl');
const HISTORIAL = process.env.USO_HISTORIAL || aqui('./historial.jsonl');
const UPLOAD_METRICS = process.env.USO_UPLOAD_METRICS || 'http://127.0.0.1:3100/metrics';
const NTFY_STATS = process.env.USO_NTFY_STATS || 'https://ntfy.chatwallet.org/v1/stats';
const GITHUB_REPO = process.env.USO_GITHUB_REPO || 'energiasonora/chatWallet';
const CF_TOKEN = process.env.CF_API_TOKEN || '';
const CF_ZONA = process.env.CF_ZONE_NAME || 'chatwallet.org';

const DIA = 86400000;
const VENTANA_FIRMA = 5 * 60000;
const SESION = 12 * 3600000;
const MENSAJE = (ts) => `chatwallet-panel:${ts}`;

// ── Sesión ──────────────────────────────────────────────────────────────────
const sellar = (cuerpo) => crypto.createHmac('sha256', SECRETO).update(cuerpo).digest('hex');
function emitirSesion(direccion) {
    const cuerpo = `${direccion}.${Date.now() + SESION}`;
    return `${cuerpo}.${sellar(cuerpo)}`;
}
function sesionValida(token) {
    const [direccion, vence, sello] = String(token || '').split('.');
    if (!direccion || !vence || !sello) return false;
    const a = Buffer.from(sello), b = Buffer.from(sellar(`${direccion}.${vence}`));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    return Number(vence) > Date.now() && ADMINS.includes(direccion);
}
function soloAdmin(req, res, next) {
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (sesionValida(token)) return next();
    res.status(401).json({ error: 'sesión vencida o inválida' });
}

// ── Fuentes ─────────────────────────────────────────────────────────────────
const pedir = async (url, opciones = {}) => {
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 8000);
    try { return await fetch(url, { ...opciones, signal: corte.signal }); }
    finally { clearTimeout(reloj); }
};
const diaDe = (ms) => new Date(ms).toISOString().slice(0, 10);

function respaldos(ahora) {
    const padron = JSON.parse(fs.readFileSync(POINTERS, 'utf8'));
    const filas = Object.values(padron).filter(p => p && Number(p.ts) > 0);
    const dentro = (ms) => filas.filter(p => ahora - Number(p.ts) < ms).length;
    // Cuántas wallets hicieron su ÚLTIMO respaldo cada día: la cola reciente es la gente activa,
    // lo viejo es gente que no volvió.
    const porDia = {};
    for (let i = 29; i >= 0; i--) porDia[diaDe(ahora - i * DIA)] = 0;
    for (const p of filas) { const d = diaDe(Number(p.ts)); if (d in porDia) porDia[d]++; }
    const cuentas = filas.map(p => Number(p.count) || 0);
    return {
        wallets: filas.length,
        activas24h: dentro(DIA), activas7d: dentro(7 * DIA), activas30d: dentro(30 * DIA),
        dormidas90d: filas.filter(p => ahora - Number(p.ts) >= 90 * DIA).length,
        mensajesRespaldados: cuentas.reduce((a, b) => a + b, 0),
        conAlMenos10Mensajes: cuentas.filter(c => c >= 10).length,
        ultimoRespaldoPorDia: porDia,
    };
}

async function subidas() {
    const texto = await (await pedir(UPLOAD_METRICS)).text();
    const leer = (nombre) => Number((texto.match(new RegExp(`^${nombre} (\\d+)`, 'm')) || [])[1] || 0);
    return {
        desdeHaceDias: +(leer('chatwallet_uptime_seconds') / 86400).toFixed(1),
        subidas: leer('chatwallet_uploads_total'),
        megas: +(leer('chatwallet_upload_bytes_total') / 1048576).toFixed(2),
        respaldosPublicados: leer('chatwallet_pointer_publishes_total'),
    };
}

async function avisos() {
    const d = await (await pedir(NTFY_STATS)).json();
    return { enCache: d.messages ?? null };
}

function relayer(ahora) {
    let filas = [];
    try {
        filas = fs.readFileSync(LIBRO, 'utf8').split('\n').filter(Boolean)
            .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return { operaciones: 0, sinLibro: true }; }
    const resumen = (fs_) => {
        const ok = fs_.filter(f => f.ok);
        const suma = (campo) => ok.reduce((a, f) => a + BigInt(f[campo] || 0), 0n);
        return {
            operaciones: ok.length, rechazadas: fs_.length - ok.length,
            movidoUsdc: +(Number(suma('monto')) / 1e6).toFixed(2),
            ganadoUsdc: +(Number(suma('comision')) / 1e6).toFixed(4),
            gastadoEth: ethers.formatEther(suma('gasWei')),
        };
    };
    return {
        desde: filas.length ? diaDe(filas[0].ts) : null,
        total: resumen(filas),
        ultimos30d: resumen(filas.filter(f => ahora - f.ts < 30 * DIA)),
    };
}

async function descargas() {
    const r = await pedir(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100`,
        { headers: { 'user-agent': 'chatwallet-uso', accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
    const versiones = (await r.json()).map(v => {
        const de = (nombre) => v.assets.find(a => a.name === nombre)?.download_count || 0;
        return { version: v.tag_name, cuando: v.published_at || '',
                 firmada: de('chatwallet-energiasonora.apk'), puente: de('chatwallet.apk') };
    }).sort((a, b) => b.cuando.localeCompare(a.cuando))
      .map(({ cuando, ...v }) => ({ ...v, fecha: cuando.slice(0, 10) }));
    return {
        totalFirmada: versiones.reduce((a, v) => a + v.firmada, 0),
        totalPuente: versiones.reduce((a, v) => a + v.puente, 0),
        ultimas: versiones.slice(0, 12),
    };
}

let zonaCf = null;
async function visitas(ahora) {
    if (!CF_TOKEN) return { sinToken: true };
    const cab = { authorization: `Bearer ${CF_TOKEN}`, 'content-type': 'application/json' };
    if (!zonaCf) {
        const z = await (await pedir(`https://api.cloudflare.com/client/v4/zones?name=${CF_ZONA}`, { headers: cab })).json();
        zonaCf = z.result?.[0]?.id;
        if (!zonaCf) throw new Error('el token no ve la zona');
    }
    const consulta = `{ viewer { zones(filter: {zoneTag: "${zonaCf}"}) {
        httpRequests1dGroups(limit: 31, orderBy: [date_ASC], filter: {date_geq: "${diaDe(ahora - 30 * DIA)}"}) {
            dimensions { date } sum { requests pageViews } uniq { uniques } } } } }`;
    const d = await (await pedir('https://api.cloudflare.com/client/v4/graphql',
        { method: 'POST', headers: cab, body: JSON.stringify({ query: consulta }) })).json();
    if (d.errors?.length) throw new Error(d.errors[0].message);
    const dias = (d.data?.viewer?.zones?.[0]?.httpRequests1dGroups || []).map(g => ({
        dia: g.dimensions.date, unicos: g.uniq.uniques, paginas: g.sum.pageViews, pedidos: g.sum.requests }));
    return { dias, nota: 'todo chatwallet.org (landing, libro y dapp juntos); únicos por IP y por día' };
}

// ── Historial ───────────────────────────────────────────────────────────────
// El padrón de respaldos sólo guarda el último respaldo de cada wallet: sin una foto diaria no
// hay forma de saber cómo venía la curva. Se guarda una línea por día, la última gana.
function leerHistorial() {
    try {
        return fs.readFileSync(HISTORIAL, 'utf8').split('\n').filter(Boolean)
            .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
}
function anotarFoto(datos) {
    if (!datos.respaldos || datos.respaldos.error) return;
    const foto = {
        dia: diaDe(Date.now()),
        wallets: datos.respaldos.wallets, activas7d: datos.respaldos.activas7d,
        activas30d: datos.respaldos.activas30d,
        descargas: datos.descargas?.totalFirmada ?? null,
        relayer: datos.relayer?.total?.operaciones ?? null,
    };
    const previas = leerHistorial().filter(f => f.dia !== foto.dia);
    try { fs.writeFileSync(HISTORIAL, [...previas, foto].map(f => JSON.stringify(f)).join('\n') + '\n'); }
    catch (e) { console.warn('[historial]', e.message); }
}

async function juntar() {
    const ahora = Date.now();
    // Cada fuente falla por separado: que GitHub no conteste no puede dejar el panel en blanco.
    const probar = async (fn) => { try { return await fn(); } catch (e) { return { error: String(e.message).slice(0, 120) }; } };
    const [r, s, a, rl, d, v] = await Promise.all([
        probar(() => respaldos(ahora)), probar(subidas), probar(avisos),
        probar(() => relayer(ahora)), probar(descargas), probar(() => visitas(ahora)),
    ]);
    const datos = { generado: new Date(ahora).toISOString(), respaldos: r, subidas: s, avisos: a,
                    relayer: rl, descargas: d, visitas: v };
    anotarFoto(datos);
    datos.historial = leerHistorial().slice(-90);
    return datos;
}

// ── Servidor ────────────────────────────────────────────────────────────────
export const app = express();
app.use(express.json({ limit: '4kb' }));

app.get('/', (req, res) => res.sendFile(aqui('./panel.html')));
app.get('/api/uso/salud', (req, res) => res.json({ ok: true }));

app.post('/api/uso/entrar', (req, res) => {
    const { address, ts, signature } = req.body || {};
    if (!address || !ts || !signature) return res.status(400).json({ error: 'faltan address, ts o signature' });
    if (Math.abs(Date.now() - Number(ts)) > VENTANA_FIRMA) return res.status(401).json({ error: 'la firma venció: pedí una nueva' });
    let firmo;
    try { firmo = ethers.verifyMessage(MENSAJE(ts), signature).toLowerCase(); }
    catch { return res.status(401).json({ error: 'firma ilegible' }); }
    if (firmo !== String(address).toLowerCase()) return res.status(401).json({ error: 'la firma no es de esa dirección' });
    if (!ADMINS.includes(firmo)) return res.status(403).json({ error: 'esa wallet no tiene acceso al panel' });
    res.json({ token: emitirSesion(firmo), vence: Date.now() + SESION });
});

app.get('/api/uso/datos', soloAdmin, async (req, res) => {
    try { res.json(await juntar()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    app.listen(PORT, '127.0.0.1', () => console.log(`panel de uso en http://127.0.0.1:${PORT}`));
    // Una foto por día aunque nadie abra el panel.
    setInterval(() => juntar().catch(() => {}), 6 * 3600000);
    juntar().catch(() => {});
}
