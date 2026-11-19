// Panel de uso de ChatWallet: junta en un solo lugar lo que la infraestructura propia ya sabe.
//
// No agrega rastreo a la app. Todo sale de datos que ya existen por otro motivo:
//   · respaldos de chat (backup-pointers.json): una entrada por wallet, con la fecha del último
//   · subidas al nodo (/metrics del upload-server)
//   · avisos de despertar (ntfy)
//   · relayer (libro.jsonl)
//   · descargas del APK (releases de GitHub)
//   · visitas a chatwallet.org (Cloudflare, sólo si hay token con permiso de analítica)
//   · la caja: lo que escribe el monitor (servicios, máquina, caídas)
//   · el roadmap («en el tintero»), que se edita desde el panel
//
// Entra sólo quien firma con una wallet de la lista USO_ADMINS. Hacia afuera salen cuentas,
// nunca direcciones.
//
//   USO_PORT=3300 node uso-server.mjs

import express from 'express';
import { ethers } from 'ethers';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
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
// Avisos del blog de energiasonora.org: la lista la tiene el worker; lo mandado, el notificador.
const NOTIFICADOR = process.env.USO_NOTIFIER_DIR || aqui('../sales-notifier');
const AVISOS_API = process.env.USO_AVISOS_API || 'https://energiasonora.org/api/avisos';
const CF_ZONA = process.env.CF_ZONE_NAME || 'chatwallet.org';
// Lo que escribe el monitor de la caja (uso/monitor/monitor.py) y el roadmap, que se edita desde acá.
const MONITOR = process.env.USO_MONITOR_DIR || (os.homedir() + '/www/monitor');
const ROADMAP = process.env.USO_ROADMAP || aqui('./roadmap.json');

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

// Suscriptores del blog por ChatWallet. Sólo cuentas: las direcciones no salen del worker.
export async function blog(ahora) {
    let token = '';
    try { token = fs.readFileSync(NOTIFICADOR + '/.env', 'utf8').match(/^AGENDA_TOKEN=(.*)$/m)?.[1].trim() || ''; } catch {}
    if (!token) return { sinToken: true };
    const leer = async (ruta) => {
        const r = await pedir(AVISOS_API + ruta, { headers: { authorization: 'Bearer ' + token } });
        if (!r.ok) throw new Error('avisos ' + r.status);
        return r.json();
    };
    const [{ subs }, { posts }] = await Promise.all([leer('/subs'), leer('/posts?since=0')]);
    let estado = {};
    try { estado = JSON.parse(fs.readFileSync(NOTIFICADOR + '/state.json', 'utf8')); } catch {}
    const porIdioma = { es: 0, en: 0, fr: 0 };
    for (const x of subs) porIdioma[x.lang] = (porIdioma[x.lang] || 0) + 1;
    return {
        suscriptores: subs.length,
        nuevos7d: subs.filter(x => ahora - x.at < 7 * DIA).length,
        porIdioma,
        bajas: estado.bajasTotal || 0,
        avisos: posts.slice().reverse().slice(0, 10).map(p => ({
            id: p.id, titulo: p.title?.es || p.id, fecha: diaDe(p.at), enviados: (estado.avisosSent?.[p.id] || []).length,
        })),
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

// La caja: estado de ahora, muestras de la máquina y caídas. Lo escribe el monitor cada 30 s.
const leerJsonl = (ruta) => {
    try {
        return fs.readFileSync(ruta, 'utf8').split('\n').filter(Boolean)
            .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
};
export function caja(ahora) {
    const estado = JSON.parse(fs.readFileSync(MONITOR + '/status.json', 'utf8'));
    const edadSeg = Math.round((ahora - Date.parse(estado.timestamp)) / 1000);
    const muestras = leerJsonl(MONITOR + '/muestras.jsonl');
    const ultimas24 = muestras.filter(m => ahora - m.t * 1000 < DIA);
    // 7 días: promedio por hora, para que el gráfico no cargue 2.000 puntos.
    const porHora = new Map();
    for (const m of muestras.filter(m => ahora - m.t * 1000 < 7 * DIA)) {
        const h = Math.floor(m.t / 3600) * 3600;
        const a = porHora.get(h) || { t: h, n: 0, temp: 0, carga: 0, ram: 0, peor: m.ok, total: m.total, sinCorriente: false };
        a.n++; a.temp += m.temp || 0; a.carga += m.carga || 0; a.ram += m.ram || 0;
        a.peor = Math.min(a.peor, m.ok); a.sinCorriente ||= m.corriente === false;
        porHora.set(h, a);
    }
    const semana = [...porHora.values()].map(a => ({ t: a.t, temp: +(a.temp / a.n).toFixed(1), carga: +(a.carga / a.n).toFixed(2),
        ram: Math.round(a.ram / a.n), ok: a.peor, total: a.total, sinCorriente: a.sinCorriente }));
    const incidentes = leerJsonl(MONITOR + '/incidentes.jsonl').slice(-40).reverse();
    return { ...estado, edadSeg, muestras24h: ultimas24, semana, incidentes };
}

// ── Roadmap ────────────────────────────────────────────────────────────────
// Vive en la caja (roadmap.json junto al panel) y se edita desde el panel. El repo es público:
// la copia de arranque está en uso/privado/, fuera de git, y el instalador no pisa la de la caja.
const COLUMNAS = ['ahora', 'anunciar', 'pendiente', 'aparcada', 'otros', 'hecho'];
const TIPOS = ['construir', 'anunciar', 'honestidad', 'publicar', 'terminar', 'probar', 'decidir', 'idea'];
function leerRoadmap() {
    try { return JSON.parse(fs.readFileSync(ROADMAP, 'utf8')); }
    catch { return { version: 1, actualizado: 0, items: [] }; }
}
function guardarRoadmap(r) {
    r.actualizado = Date.now();
    // Una copia por día antes del primer cambio: un toque equivocado no se lleva nada.
    const copia = ROADMAP.replace(/\.json$/, '') + '.' + diaDe(Date.now()) + '.bak.json';
    if (fs.existsSync(ROADMAP) && !fs.existsSync(copia)) fs.copyFileSync(ROADMAP, copia);
    fs.writeFileSync(ROADMAP + '.tmp', JSON.stringify(r, null, 1));
    fs.renameSync(ROADMAP + '.tmp', ROADMAP);
    return r;
}
const texto = (v, max) => String(v ?? '').trim().slice(0, max);
export function cambiarRoadmap(cambio) {
    const r = leerRoadmap();
    const item = r.items.find(i => i.id === cambio.id);
    switch (cambio.accion) {
        case 'crear': {
            const nuevo = { id: 'r' + Date.now().toString(36), seccion: COLUMNAS.includes(cambio.seccion) ? cambio.seccion : 'pendiente',
                proyecto: texto(cambio.proyecto, 40) || 'General', item: texto(cambio.item, 200), detalle: texto(cambio.detalle, 600),
                tipo: TIPOS.includes(cambio.tipo) ? cambio.tipo : 'idea', anotada: diaDe(Date.now()), creado: Date.now() };
            if (!nuevo.item) throw new Error('falta el texto');
            r.items.push(nuevo);
            break;
        }
        case 'editar':
            if (!item) throw new Error('no existe');
            if ('item' in cambio) item.item = texto(cambio.item, 200) || item.item;
            if ('detalle' in cambio) item.detalle = texto(cambio.detalle, 600);
            if ('proyecto' in cambio) item.proyecto = texto(cambio.proyecto, 40) || item.proyecto;
            if (TIPOS.includes(cambio.tipo)) item.tipo = cambio.tipo;
            if (COLUMNAS.includes(cambio.seccion) && cambio.seccion !== item.seccion) {
                item.seccion = cambio.seccion;
                item.hecho = cambio.seccion === 'hecho' ? diaDe(Date.now()) : undefined;
            }
            break;
        case 'borrar':
            if (!item) throw new Error('no existe');
            r.items = r.items.filter(i => i !== item);
            break;
        default: throw new Error('acción desconocida');
    }
    return guardarRoadmap(r);
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
    const [r, s, a, rl, d, v, b, c] = await Promise.all([
        probar(() => respaldos(ahora)), probar(subidas), probar(avisos),
        probar(() => relayer(ahora)), probar(descargas), probar(() => visitas(ahora)), probar(() => blog(ahora)),
        probar(() => caja(ahora)),
    ]);
    const datos = { generado: new Date(ahora).toISOString(), respaldos: r, subidas: s, avisos: a,
                    relayer: rl, descargas: d, visitas: v, blog: b, caja: c, roadmap: leerRoadmap() };
    anotarFoto(datos);
    datos.historial = leerHistorial().slice(-90);
    return datos;
}

// ── Servidor ────────────────────────────────────────────────────────────────
export const app = express();
app.use(express.json({ limit: '4kb' }));

// XMTP en el navegador (entrar firmando con ChatWallet por QR) pide aislamiento de origen, como
// en Soberano Mail. js/ trae el bundle XMTP (copiado de Soberano Mail al instalar) y cw-firma.js.
app.use((req, res, next) => {
    res.set('Cross-Origin-Opener-Policy', 'same-origin');
    res.set('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});
app.use('/js', express.static(aqui('./js'), { maxAge: '1h' }));
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

// La caja sola, sin las fuentes lentas (GitHub, Cloudflare): el panel la refresca cada 30 s.
app.get('/api/uso/caja', soloAdmin, (req, res) => {
    try { res.json(caja(Date.now())); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/uso/roadmap', soloAdmin, (req, res) => {
    try { res.json(cambiarRoadmap(req.body || {})); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

// realpath: si la carpeta es un enlace, argv[1] y la URL del módulo no coinciden letra por letra.
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
    app.listen(PORT, '127.0.0.1', () => console.log(`panel de uso en http://127.0.0.1:${PORT}`));
    // Una foto por día aunque nadie abra el panel.
    setInterval(() => juntar().catch(() => {}), 6 * 3600000);
    juntar().catch(() => {});
}
