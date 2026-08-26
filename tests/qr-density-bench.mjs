// Banco de densidad: hasta dónde aguanta cada QR de la app antes de dejar de leerse.
//
// Alimenta el escáner real (startScanner de dapp.html) con una cámara falsa y barre dos
// ejes: cuánto del cuadro ocupa el QR y cuánto desenfoque tiene. Sirve para responder la
// pregunta práctica — "¿a qué distancia hay que poner el teléfono?" — sin adivinar.
//
//   nvm use 22 && unset NODE_OPTIONS && node tests/qr-density-bench.mjs <qr1.png> [qr2.png …]
//
// Los PNG son las tarjetas blancas que sacó link-camera-e2e.mjs (cwl1.png, cwl2.png, cwl3.png).
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'https://chatwallet.org/dapp.html';
const FRAME = 1080;                       // el escáner pide aspectRatio 1 → cuadro cuadrado
const TIMEOUT = +(process.env.TIMEOUT || 14000);   // deja pasar 3 capturas automáticas (cada 4s)
const FRACTIONS = (process.env.FRACTIONS || '0.85,0.70,0.55,0.45,0.35').split(',').map(Number);
const BLURS = (process.env.BLURS || '0,1.2,2.2').split(',').map(Number);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pngs = process.argv.slice(2);
if (!pngs.length) { console.error('Pasá al menos un PNG de QR'); process.exit(2); }

const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-bench-'));
const CAM = path.join(WORK, 'cam.y4m');

function scene(png, fraction, blur) {
    const h = Math.round(FRAME * fraction);
    const chain = [`scale=-1:${h}`, blur ? `gblur=sigma=${blur}` : null].filter(Boolean).join(',');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', png,
        '-f', 'lavfi', '-i', `color=c=0x1b1b1b:s=${FRAME}x${FRAME}`,
        '-filter_complex', `[0:v]${chain}[q];[1:v][q]overlay=(W-w)*0.85:(H-h)*0.15`,
        '-frames:v', '12', '-r', '15', '-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe', CAM]);
}

scene(pngs[0], 0.85, 0);   // el archivo tiene que existir antes de abrir Chrome

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-bench-prof-'));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=9487', `--user-data-dir=${dir}`, '--window-size=900,1400',
    '--autoplay-policy=no-user-gesture-required',
    // Los tres van juntos: sin --use-fake-device-for-media-stream Chrome abre la cámara REAL.
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${CAM}`, 'about:blank'], { stdio: 'ignore' });

let ws, id = 0; const pending = new Map();
const rpc = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const evalx = async (e, awaitPromise = true) => {
    const r = await rpc('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
};

for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
        const list = await (await fetch('http://127.0.0.1:9487/json/list')).json();
        const p = list.find(t => t.type === 'page');
        if (p) {
            await new Promise((resolve, reject) => {
                ws = new WebSocket(p.webSocketDebuggerUrl);
                ws.onopen = async () => { await rpc('Page.enable'); await rpc('Runtime.enable'); resolve(); };
                ws.onerror = reject;
                ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
            });
            break;
        }
    } catch { }
}

await rpc('Page.navigate', { url: BASE });
await sleep(3000);
await evalx(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
await evalx(`localStorage.setItem('xmtp-chat-wallet', '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2,'0')).join(''))`);
await rpc('Page.reload'); await sleep(6000);

// Envolver captureAndAnalyze para separar el bucle en vivo de la captura a resolución nativa.
await evalx(`(() => {
    if (window.__capInstalled) return true;
    window.__capInstalled = true;
    const orig = captureAndAnalyze;
    window.captureAndAnalyze = async (silent) => {
        const r = await orig(silent);
        (window.__capTrace = window.__capTrace || []).push(!!r);
        return r;
    };
    return true;
})()`);

async function tryScene(png, fraction, blur) {
    scene(png, fraction, blur);
    await evalx(`(() => { window.__capTrace = []; document.getElementById('scanned-data').textContent = ''; })()`);
    await evalx(`startScanner()`, false);
    const t0 = Date.now();
    let out = null;
    while (Date.now() - t0 < TIMEOUT) {
        await sleep(400);
        const got = await evalx(`document.getElementById('scanned-data')?.textContent || ''`);
        if (got) {
            const viaCapture = await evalx(`(window.__capTrace || []).some(Boolean)`);
            out = { ms: Date.now() - t0, via: viaCapture ? 'captura' : 'vivo' };
            break;
        }
    }
    await evalx(`stopScanner()`, false);
    await sleep(1200);   // que la cámara suelte el archivo antes de reescribirlo
    return out;
}

console.log(`Cuadro ${FRAME}x${FRAME} · timeout ${TIMEOUT}ms · ${BASE}\n`);
for (const png of pngs) {
    console.log(`── ${path.basename(png)} ──`);
    console.log('  % del cuadro │ ' + BLURS.map(b => `blur ${b}`.padEnd(14)).join('│'));
    for (const f of FRACTIONS) {
        const cells = [];
        for (const b of BLURS) {
            const r = await tryScene(png, f, b);
            cells.push((r ? `✅ ${r.ms}ms ${r.via}` : '❌ no leyó').padEnd(14));
        }
        console.log(`  ${String(Math.round(f * 100)).padStart(11)}% │ ` + cells.join('│'));
    }
    console.log('');
}

try { proc.kill(); } catch { }
process.exit(0);
