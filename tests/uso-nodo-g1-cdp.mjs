// Panel de uso (uso/panel.html): la sección «Nodo Ğ1» con datos simulados que pasan por la función
// real caja() del servidor. No toca la caja. Correr: node tests/uso-nodo-g1-cdp.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; };
const SHOTS = process.env.SHOTS;

// Un directorio de monitor falso: 24 h de muestras con el nodo sincronizando.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-uso-g1-'));
process.env.USO_MONITOR_DIR = dir;
const ahora = Math.floor(Date.now() / 1000);
const muestras = [];
for (let k = 288; k >= 0; k--) {
    const t = ahora - k * 300, horas = (288 - k) / 12;
    muestras.push({ t, temp: 46, carga: 1.1, ram: 1400, disco: 60, corriente: true, ok: 27, total: 27,
        g1_mb: Math.round(445 + horas * 40), g1_bloque: Math.round(22000 + horas * 13 * 3600), g1_meta: 3757000 });
}
fs.writeFileSync(path.join(dir, 'muestras.jsonl'), muestras.map(m => JSON.stringify(m)).join('\n') + '\n');
fs.writeFileSync(path.join(dir, 'incidentes.jsonl'), '');
const escenario = (info, status) => {
    fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({
        timestamp: new Date().toISOString(), all_ok: true,
        sistema: { temp_c: 46, carga: [1.1, 1, 1], nucleos: 2, ram_total_mb: 3798, ram_libre_mb: 1400, disco_pct: 60, disco_libre_gb: 28, discos: [], arriba_seg: 500000, corriente: true, bateria_pct: 0 },
        services: [{ id: 'internet', name: 'Internet', status: 'ok', info: {}, grupo: 'afuera' },
                   { id: 'g1_nodo', name: 'Nodo Ğ1', status, info, grupo: 'almacenamiento' }],
        abiertos: [], arranque_monitor: ahora - 3600 }));
};
const { caja } = await import('../uso/uso-server.mjs');
const datos = () => JSON.stringify({ generado: new Date().toISOString(), caja: caja(Date.now()), roadmap: { items: [] },
    respaldos: { error: 'x' }, subidas: { error: 'x' }, avisos: { error: 'x' }, relayer: { error: 'x' }, descargas: { error: 'x' }, visitas: { error: 'x' }, blog: { error: 'x' }, historial: [] });

// Servidor de prueba: el panel tal cual y la API simulada.
const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/api/uso/')) { res.setHeader('content-type', 'application/json'); return res.end(datos()); }
    res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(fs.readFileSync('uso/panel.html'));
}).listen(8853, '127.0.0.1');

const udir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-uso-chrome-'));
const proc = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=9465', `--user-data-dir=${udir}`, 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 40 && !ws; i++) { await sleep(500); try { const l = await (await fetch('http://127.0.0.1:9465/json/list')).json(); const pg = l.find(t => t.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch { } }
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errores = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
const rpc = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const esperar = async (expr, seg = 15) => { for (let i = 0; i < seg * 4; i++) { if (await ev(expr)) return true; await sleep(250); } return false; };
const foto = async (n) => { if (!SHOTS) return; const r = await rpc('Page.captureScreenshot', { captureBeyondViewport: true }); fs.writeFileSync(`${SHOTS}/uso-${n}.png`, Buffer.from(r.result.data, 'base64')); };
await rpc('Page.enable'); await rpc('Runtime.enable');
await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

const entrar = async () => {
    await rpc('Page.navigate', { url: 'http://127.0.0.1:8853/' });
    await sleep(800);
    await ev(`sessionStorage.setItem('cw-uso-sesion', 'prueba'); localStorage.setItem('cw-panel-vista', 'caja'); true`);
    await rpc('Page.navigate', { url: 'http://127.0.0.1:8853/' });
};
try {
    console.log('── sincronizando ──');
    const ultima = muestras.at(-1);
    escenario({ corriendo: true, mb: ultima.g1_mb, bloque: ultima.g1_bloque, meta: 3757000, pct: +(100 * ultima.g1_bloque / 3757000).toFixed(1), ram: '1.04GB',
        resumen: 'bloque … de …' }, 'ok');
    await entrar();
    ok(await esperar(`[...document.querySelectorAll('h2')].some(h => h.textContent.startsWith('Nodo Ğ1'))`), 'aparece la sección Nodo Ğ1');
    const href = await ev(`[...document.querySelectorAll('h2')].find(h => h.textContent.startsWith('Nodo Ğ1'))?.querySelector('a')?.href || ''`);
    ok(/^https:\/\/chatwallet\.org\/g1\/\?bloque=\d+$/.test(href), 'link al explorador en el último bloque — ' + href);
    const v = await ev(`(() => { const s = document.querySelector('.nodo-g1'); return { txt: s.textContent.replace(/\\s+/g, ' '),
        sync: s.querySelectorAll('.progreso i')[0].style.width, disco: s.querySelectorAll('.progreso i')[1].style.width,
        graf: [...document.querySelectorAll('.grafico .cab .tenue')].map(e => e.textContent) }; })()`);
    ok(/Sincronizando con la red Ğ1/.test(v.txt) && /RAM 1\.04GB/.test(v.txt), 'estado y RAM', v.txt.slice(0, 90));
    ok(/13 bloques\/s/.test(v.txt) && /faltan ~/.test(v.txt), 'ritmo y tiempo que falta', (v.txt.match(/[\d,.]+ bloques\/s[^G]*/) || [''])[0]);
    ok(/crece 960 MB\/día/.test(v.txt), 'cuánto crece el disco por día', (v.txt.match(/crece [^ ]+ MB\/día/) || [''])[0]);
    ok(parseFloat(v.sync) > 25 && parseFloat(v.sync) < 35 && parseFloat(v.disco) > 13 && parseFloat(v.disco) < 15, 'las barras', `sincro ${v.sync} · disco ${v.disco}`);
    ok(v.graf.includes('Disco del nodo Ğ1') && v.graf.includes('Bloques sincronizados'), 'los dos gráficos');
    ok(await ev(`document.documentElement.scrollWidth`) <= 390, 'entra a lo ancho en el celu');
    await ev(`[...document.querySelectorAll('h2')].find(h => h.textContent.startsWith('Nodo Ğ1')).scrollIntoView(); true`);
    await foto('1-sincronizando');

    console.log('── 7 días ──');
    await ev(`document.querySelector('.segmentos button[data-r="7d"]').click(); true`);
    await sleep(300);
    ok(await ev(`[...document.querySelectorAll('.grafico')].filter(g => /Disco del nodo|Bloques sinc/.test(g.textContent)).every(g => !!g.querySelector('svg path'))`), 'los gráficos también en 7 días (promedio por hora)');

    console.log('── cerca del tope ──');
    escenario({ corriendo: true, mb: 7600, bloque: 2000000, meta: 3757000, pct: 53.2, resumen: '…' }, 'degraded');
    await entrar();
    await esperar(`!!document.querySelector('.nodo-g1')`);
    ok(await ev(`document.querySelectorAll('.nodo-g1 .progreso')[1].classList.contains('aviso')`), 'pasados los 7 GB la barra se pone amarilla');

    console.log('── frenado ──');
    escenario({ corriendo: false, mb: 10300, bloque: 2600000, meta: 3757000, pct: 69.2, frenado: true, resumen: '…' }, 'down');
    await entrar();
    await esperar(`!!document.querySelector('.nodo-g1')`);
    const fr = await ev(`document.querySelector('.nodo-g1').parentElement.textContent.replace(/\\s+/g, ' ')`);
    ok(/Frenado por tamaño/.test(fr) && /rm ~\/g1-nodo-FRENADO/.test(fr) && await ev(`document.querySelectorAll('.nodo-g1 .progreso')[1].classList.contains('mal')`), 'frenado: lo dice, barra roja y cómo seguir');
    await foto('2-frenado');

    console.log('── sin nodo instalado ──');
    escenario({ note: 'no instalado' }, 'unknown');
    await entrar();
    await esperar(`!!document.querySelector('.estado-grande')`);
    ok(!(await ev(`[...document.querySelectorAll('h2')].some(h => h.textContent.startsWith('Nodo Ğ1'))`)), 'sin nodo, no hay sección');

    ok(!errores.length, 'sin excepciones', errores.join(' | ').slice(0, 300));
} catch (e) { ok(false, 'la prueba se cortó', e.message); }
finally { try { ws.close(); } catch { } proc.kill('SIGKILL'); srv.close(); try { fs.rmSync(dir, { recursive: true }); fs.rmSync(udir, { recursive: true, force: true }); } catch { } }
console.log(fails ? `\n${fails} fallaron` : '\ntodo bien');
process.exit(fails ? 1 : 0);
