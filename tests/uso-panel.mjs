// Panel de uso: quién entra, y que las cuentas salgan bien de un padrón conocido.
import { ethers } from 'ethers';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-uso-'));
const admin = ethers.Wallet.createRandom(), intruso = ethers.Wallet.createRandom();
const ahora = Date.now(), DIA = 86400000;
const padron = {};
const edades = [0.1, 0.5, 3, 6, 20, 29, 45, 100, 200];           // días desde el último respaldo
edades.forEach((d, i) => { padron[ethers.Wallet.createRandom().address.toLowerCase()] = { cid: 'bafy' + i, ts: ahora - d * DIA, count: i * 5 }; });
fs.writeFileSync(path.join(tmp, 'p.json'), JSON.stringify(padron));
fs.writeFileSync(path.join(tmp, 'libro.jsonl'), [
    { ts: ahora - 40 * DIA, chainId: 8453, simbolo: 'USDC', ok: true, monto: '5000000', comision: '20000', gasWei: '1000000000000' },
    { ts: ahora - 2 * DIA, chainId: 8453, simbolo: 'USDC', ok: true, monto: '1500000', comision: '10000', gasWei: '2000000000000' },
    { ts: ahora - DIA, chainId: 8453, simbolo: 'USDC', ok: false, motivo: 'rechazado' },
].map(f => JSON.stringify(f)).join('\n') + '\n');

const falso = http.createServer((req, res) => {
    if (req.url === '/metrics') return res.end('chatwallet_uptime_seconds 172800\nchatwallet_uploads_total 328\nchatwallet_upload_bytes_total 2097152\nchatwallet_pointer_publishes_total 162\n');
    if (req.url === '/v1/stats') return res.end('{"messages":195}');
    if (req.url.startsWith('/repos/')) return res.end(JSON.stringify([
        { tag_name: 'v2', published_at: '2026-10-10T00:00:00Z', assets: [{ name: 'chatwallet-energiasonora.apk', download_count: 3 }, { name: 'chatwallet.apk', download_count: 1 }] },
        { tag_name: 'v1', published_at: '2026-10-01T00:00:00Z', assets: [{ name: 'chatwallet-energiasonora.apk', download_count: 4 }] }]));
    res.statusCode = 404; res.end();
}).listen(0);
const pf = falso.address().port;

Object.assign(process.env, {
    USO_ADMINS: admin.address, USO_POINTERS: path.join(tmp, 'p.json'), USO_RELAY_LEDGER: path.join(tmp, 'libro.jsonl'),
    USO_HISTORIAL: path.join(tmp, 'h.jsonl'), USO_UPLOAD_METRICS: `http://127.0.0.1:${pf}/metrics`,
    USO_NTFY_STATS: `http://127.0.0.1:${pf}/v1/stats`, CF_API_TOKEN: '',
    USO_MONITOR_DIR: path.join(tmp, 'monitor'), USO_ROADMAP: path.join(tmp, 'roadmap.json'),
});
// Lo que deja el monitor de la caja: estado, muestras de 2 días (una cada 5 min) y una caída.
fs.mkdirSync(path.join(tmp, 'monitor'));
fs.writeFileSync(path.join(tmp, 'monitor', 'status.json'), JSON.stringify({ timestamp: new Date(ahora - 40000).toISOString(), all_ok: false,
    sistema: { temp_c: 44, carga: [0.4, 0.3, 0.2] }, services: [{ id: 'ipfs', name: 'IPFS', status: 'ok', info: {} }, { id: 'openclaw', name: 'OpenClaw', status: 'down', info: {} }],
    abiertos: [{ id: 'openclaw', nombre: 'OpenClaw', desde: ahora / 1000 - 600 }] }));
fs.writeFileSync(path.join(tmp, 'monitor', 'muestras.jsonl'), Array.from({ length: 576 }, (_, i) =>
    JSON.stringify({ t: Math.floor(ahora / 1000) - (576 - i) * 300, temp: 40 + (i % 10), carga: 0.5, ram: 2000, ok: i === 500 ? 20 : 22, total: 23 })).join('\n') + '\n');
fs.writeFileSync(path.join(tmp, 'monitor', 'incidentes.jsonl'), JSON.stringify({ id: 'caja', nombre: 'La caja entera', desde: 1, hasta: 2 }) + '\n');
fs.writeFileSync(path.join(tmp, 'roadmap.json'), JSON.stringify({ version: 1, items: [{ id: 'r01', seccion: 'ahora', proyecto: 'Música', item: 'Publicar', tipo: 'construir' }] }));
// GitHub de mentira: se intercepta el fetch sólo para ese host.
const real = globalThis.fetch;
globalThis.fetch = (u, o) => real(String(u).replace('https://api.github.com', `http://127.0.0.1:${pf}`), o);

const { app } = await import('../uso/uso-server.mjs');
const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;

let fallas = 0;
const ok = (c, t) => { console.log((c ? '  ✓ ' : '  ✗ ') + t); if (!c) fallas++; };
const entrar = async (w, ts = Date.now(), dice = w.address) => real(base + '/api/uso/entrar', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: dice, ts, signature: await w.signMessage('chatwallet-panel:' + ts) }) });

ok((await real(base + '/api/uso/datos')).status === 401, 'sin sesión no hay datos');
ok((await real(base + '/api/uso/datos', { headers: { authorization: 'Bearer ' + admin.address.toLowerCase() + '.9999999999999.00' } })).status === 401, 'una sesión inventada no pasa');
ok((await entrar(intruso)).status === 403, 'otra wallet firma bien y queda afuera');
ok((await entrar(intruso, Date.now(), admin.address)).status === 401, 'firmar diciendo ser el admin no alcanza');
ok((await entrar(admin, Date.now() - 10 * 60000)).status === 401, 'una firma de hace 10 minutos ya venció');
const e = await entrar(admin); ok(e.status === 200, 'el admin entra');
const { token } = await e.json();
const r = await real(base + '/api/uso/datos', { headers: { authorization: 'Bearer ' + token } });
ok(r.status === 200, 'con sesión hay datos');
const texto = await r.text(); const d = JSON.parse(texto);
ok(d.respaldos.wallets === 9, 'cuenta las 9 wallets');
ok(d.respaldos.activas24h === 2 && d.respaldos.activas7d === 4 && d.respaldos.activas30d === 6, 'activas 24 h / 7 d / 30 d = 2 / 4 / 6');
ok(d.respaldos.dormidas90d === 2, 'dormidas hace 90 días = 2');
ok(d.respaldos.mensajesRespaldados === 180 && d.respaldos.conAlMenos10Mensajes === 7, 'mensajes respaldados');
ok(Object.values(d.respaldos.ultimoRespaldoPorDia).reduce((a, b) => a + b, 0) === 6 && Object.keys(d.respaldos.ultimoRespaldoPorDia).length === 30, 'la serie de 30 días suma las 6 activas');
ok(d.relayer.total.operaciones === 2 && d.relayer.total.rechazadas === 1 && d.relayer.ultimos30d.operaciones === 1, 'relayer: 2 operaciones, 1 en 30 días, 1 rechazo');
ok(d.relayer.total.movidoUsdc === 6.5 && d.relayer.total.ganadoUsdc === 0.03, 'relayer: 6,5 USDC movidos y 0,03 de comisión');
ok(d.descargas.totalFirmada === 7 && d.descargas.totalPuente === 1 && d.descargas.ultimas[0].version === 'v2', 'descargas del APK');
ok(d.subidas.subidas === 328 && d.subidas.megas === 2 && d.subidas.desdeHaceDias === 2, 'subidas al nodo');
ok(d.avisos.enCache === 195 && d.visitas.sinToken === true, 'ntfy, y Cloudflare sin token no rompe');
ok(!Object.keys(padron).some(a => texto.toLowerCase().includes(a)) && !/bafy\d/.test(texto), 'no sale ninguna dirección ni CID');
ok(d.historial.length === 1 && d.historial[0].wallets === 9, 'queda la foto del día');
await real(base + '/api/uso/datos', { headers: { authorization: 'Bearer ' + token } });
ok(fs.readFileSync(path.join(tmp, 'h.jsonl'), 'utf8').trim().split('\n').length === 1, 'la foto del día no se duplica');
fs.writeFileSync(path.join(tmp, 'p.json'), '{roto');
const roto = await (await real(base + '/api/uso/datos', { headers: { authorization: 'Bearer ' + token } })).json();
ok(roto.respaldos.error && roto.descargas.totalFirmada === 7, 'una fuente rota no tumba las demás');
const pag = await (await real(base + '/')).text();
ok(pag.includes('ChatWallet · panel') && !pag.includes(admin.address), 'la página se sirve y no trae datos adentro');

// La caja
ok(roto.caja.edadSeg >= 40 && roto.caja.edadSeg < 60 && roto.caja.services.length === 2, 'caja: estado y edad de la última foto');
ok(roto.caja.muestras24h.length >= 287 && roto.caja.semana.length >= 48 && roto.caja.semana.length <= 49, 'caja: 24 h enteras y 2 días en promedios por hora');
ok(roto.caja.semana.some(h => h.ok === 20), 'caja: la hora con chequeos en rojo guarda el peor momento');
ok(roto.caja.incidentes[0].nombre === 'La caja entera', 'caja: las caídas');
const sola = await real(base + '/api/uso/caja', { headers: { authorization: 'Bearer ' + token } });
ok(sola.status === 200 && (await real(base + '/api/uso/caja')).status === 401, 'caja sola: con sesión sí, sin sesión no');

// El roadmap
ok(roto.roadmap.items.length === 1, 'roadmap: sale con los datos');
const tocar = (c, tk = token) => real(base + '/api/uso/roadmap', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify(c) });
ok((await tocar({ accion: 'crear', item: 'x' }, 'trucho')).status === 401, 'roadmap: sin sesión no se toca');
let rm = await (await tocar({ accion: 'crear', item: '  Vigía externo  ', proyecto: 'Caja', tipo: 'decidir', seccion: 'pendiente' })).json();
const nuevo = rm.items.find(i => i.item === 'Vigía externo');
ok(nuevo && nuevo.proyecto === 'Caja' && nuevo.seccion === 'pendiente' && nuevo.anotada, 'roadmap: agregar (recorta espacios, anota la fecha)');
rm = await (await tocar({ accion: 'editar', id: 'r01', seccion: 'hecho' })).json();
ok(rm.items.find(i => i.id === 'r01').hecho, 'roadmap: marcar hecho le pone la fecha');
rm = await (await tocar({ accion: 'editar', id: 'r01', seccion: 'ahora', tipo: 'inventado' })).json();
ok(!rm.items.find(i => i.id === 'r01').hecho && rm.items.find(i => i.id === 'r01').tipo === 'construir', 'roadmap: volver de hecho y un tipo inventado no entra');
ok((await tocar({ accion: 'crear', item: '   ' })).status === 400 && (await tocar({ accion: 'romper' })).status === 400, 'roadmap: vacío o acción rara = 400');
rm = await (await tocar({ accion: 'borrar', id: nuevo.id })).json();
ok(rm.items.length === 1, 'roadmap: borrar');
ok(fs.readdirSync(tmp).some(f => /^roadmap\.\d{4}-\d\d-\d\d\.bak\.json$/.test(f)), 'roadmap: queda la copia del día');

srv.close(); falso.close(); fs.rmSync(tmp, { recursive: true });
console.log(fallas ? `\n${fallas} fallas` : '\ntodo bien'); process.exit(fallas ? 1 : 0);
