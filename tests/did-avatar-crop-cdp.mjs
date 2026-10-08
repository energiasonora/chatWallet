// Recorte de la foto del DID propio: elegir imagen → recortador → el avatar queda encuadrado.
// Un solo Chrome headless; no hace falta XMTP (se dispara el 'change' del input real).
//
// Cómo correrlo:
//   1. nvm use 22 && corepack enable
//   2. rm -rf /tmp/cwui .parcel-cache-ui
//      yarn parcel build src/dapp.html --dist-dir /tmp/cwui --public-url ./ --cache-dir .parcel-cache-ui
//   3. cd /tmp/cwui && python3 -m http.server 8817 &
//   4. unset NODE_OPTIONS && node tests/did-avatar-crop-cdp.mjs
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8817/dapp.html';
const PORT = 9496;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function check(name, ok, extra = '') {
    if (!ok) fails++;
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-didcrop-');
const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=900,1400', 'about:blank',
], { stdio: 'ignore' });

let ws, seq = 0;
const pending = new Map();
const rpc = (method, params = {}) => new Promise(res => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
});
async function ev(expr) {
    const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
}
async function pollFor(expr, tries = 15, delay = 500) {
    for (let i = 0; i < tries; i++) { try { const v = await ev(expr); if (v) return v; } catch { } await sleep(delay); }
    return false;
}

// Mete un archivo en #avatarUpload y dispara 'change' (el handler real, sin atajos).
const pickFile = (makeBlobJs, name) => ev(`(async () => {
    const blob = await (${makeBlobJs})();
    const input = document.getElementById('avatarUpload');
    const dt = new DataTransfer();
    dt.items.add(new File([blob], ${JSON.stringify(name)}, { type: blob.type || 'image/png' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
const PHOTO = `async () => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400;
    const g = c.getContext('2d');
    g.fillStyle = '#f00'; g.fillRect(0, 0, 300, 400);      // mitad izquierda roja
    g.fillStyle = '#00f'; g.fillRect(300, 0, 300, 400);    // mitad derecha azul
    return await new Promise(r => c.toBlob(r, 'image/png'));
}`;
const cropOpen = `!document.getElementById('imgCropModal').classList.contains('hidden')`;

try {
    for (let i = 0; i < 60 && !ws; i++) {
        await sleep(500);
        try {
            const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page');
            if (page) {
                ws = new WebSocket(page.webSocketDebuggerUrl);
                await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
            }
        } catch { ws = null; }
    }
    ws.addEventListener('message', e => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.navigate', { url: BASE }); await sleep(2500);
    await ev(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify('0x' + randomBytes(32).toString('hex'))})`);
    await rpc('Page.reload'); await sleep(4000);
    await ev(`window.alert = () => {}`);

    const before = await ev(`document.getElementById('userDidAvatar').src`);

    // 1. Cancelar el recorte no toca el avatar.
    await pickFile(PHOTO, 'foto.png');
    check('elegir foto abre el recortador', await pollFor(cropOpen) === true);
    check('con el título del perfil', await ev(`document.getElementById('imgCropTitle').textContent`) === 'Tu foto de perfil');
    await ev(`document.getElementById('imgCropCancel').click()`);
    await sleep(500);
    check('cancelar cierra el recortador', await ev(cropOpen) === false);
    check('cancelar deja el avatar como estaba', await ev(`document.getElementById('userDidAvatar').src`) === before);

    // 2. Encuadrar a la derecha (zoom al máximo + empujar el offset) → el avatar sale azul.
    await pickFile(PHOTO, 'foto.png');
    await pollFor(cropOpen);
    await ev(`(() => {
        const z = document.getElementById('imgCropZoom');
        z.value = '4'; z.dispatchEvent(new Event('input', { bubbles: true }));
        const st = window.cwCropState(); st.ox = -1e6;   // clampCrop lo lleva al borde derecho
    })()`);
    await ev(`document.getElementById('imgCropOk').click()`);
    const src = await pollFor(`(() => { const s = document.getElementById('userDidAvatar').src; return s !== ${JSON.stringify(before)} && s; })()`);
    check('"Usar" pone el recorte en el avatar', /^data:image\/(webp|jpeg)/.test(src || ''), (src || '').slice(0, 25));
    const px = await ev(`(async () => {
        const img = new Image(); img.src = document.getElementById('userDidAvatar').src; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(img.width / 2, img.height / 2, 1, 1).data;
        return { w: img.width, h: img.height, r: d[0], b: d[2] };
    })()`);
    check('el avatar es cuadrado', px.w === px.h, `${px.w}x${px.h}`);
    check('respeta el encuadre elegido (lado azul)', px.b > 200 && px.r < 60, JSON.stringify(px));

    // 3. Un archivo roto avisa en vez de quedar mudo.
    await pickFile(`async () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })`, 'roto.png');
    const toast = await pollFor(`[...document.querySelectorAll('#cwNotifs .cw-notif, .toast, [id*=toast]')].map(e => e.textContent).join(' | ').match(/No se pudo leer esa imagen/)?.[0]`, 10);
    check('imagen ilegible → aviso', !!toast);
    check('y el recortador no se abre', await ev(cropOpen) === false);
} catch (e) {
    fails++; console.error('💥', e);
} finally {
    try { proc.kill(); } catch { }
}
console.log(fails ? `\n${fails} fallas` : '\nTodo verde');
process.exit(fails ? 1 : 0);
