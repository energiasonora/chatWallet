// Enviar y recibir plata vibran al tocarlos (APK): los dos botones de la pantalla
// principal, los dos del encabezado del chat y los dos del panel del chat.
// Se simula el plugin nativo KeepAlive.vibrate, que es por donde vibra el APK.
//
// Correr:  ./tests/run-vibrar-botones.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8849/dapp.html';
const PORT = 9399;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-vibrar-');
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map();
try {
    for (let i = 0; i < 40 && !ws; i++) {
        await sleep(500);
        try {
            const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            const pg = l.find(t => t.type === 'page');
            if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl);
        } catch { }
    }
    if (!ws) throw new Error('Chrome no levantó');
    await new Promise((res, bad) => { ws.onopen = res; ws.onerror = bad; });
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        // un alert/confirm de algún botón (p. ej. "abrí un chat primero") congela la página: se acepta solo
        if (m.method === 'Page.javascriptDialogOpening') { console.log('   (diálogo: ' + m.params.message.slice(0, 80) + ')'); ws.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true } })); } });
    const rpc = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => {
        const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error((ex.exception?.description || ex.text || '').slice(0, 300));
        return r.result?.result?.value;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.navigate', { url: BASE });
    let listo = false;
    for (let i = 0; i < 60 && !listo; i++) {
        await sleep(1000);
        try { listo = (await ev(`typeof vibrar === 'function' && !!document.getElementById('chatSendCryptoBtn')`)) === true; } catch { }
    }
    if (!listo) throw new Error('la página no terminó de cargar (vibrar no existe)');


    // Hacemos de APK: el mismo plugin nativo que usa vibrar() en el teléfono, pero anotando.
    await ev(`(() => { window.__vib = [];
        window.Capacitor = { isNativePlatform: () => true, Plugins: { KeepAlive: {
            vibrate: (o) => { window.__vib.push(o.pattern); return Promise.resolve(); } } } };
        return true; })()`);
    const tocar = async (id) => {
        console.log('   tocando #' + id);
        await ev(`(() => { window.__vib = []; const b = document.getElementById(${JSON.stringify(id)});
            if (!b) return false; b.disabled = false; b.click(); return true; })()`);
        await sleep(150);
        return ev(`window.__vib.length`);
    };
    console.log('\n── pagar y cobrar vibran, en la pantalla principal y en el chat ──');
    for (const id of ['sendBtn', 'receiveBtn', 'headerSendBtn', 'headerRequestBtn', 'chatSendCryptoBtn', 'chatRequestCryptoBtn']) {
        const n = await tocar(id);
        ok(n >= 1, `tocar #${id} hace vibrar el teléfono`, `vibraciones: ${n}`);
        // cerrar lo que haya abierto el botón, para que no tape al siguiente
        await ev(`(() => { for (let i = 0; i < 5 && typeof modalesALaVista === 'function' && modalesALaVista().length; i++) manejarBotonAtras(); })()`);
    }
    console.log('\n── y otro botón cualquiera no ──');
    ok((await tocar('scanQrBtn')) === 0, 'tocar Escanear no vibra');
    await ev(`(() => { for (let i = 0; i < 5 && modalesALaVista().length; i++) manejarBotonAtras(); })()`);
    ok(await ev(`(() => { window.__vib = []; const s = document.querySelector('#sendBtn svg'); s.dispatchEvent(new MouseEvent('click', { bubbles: true })); return window.__vib.length; })()`) >= 1,
        'tocar el ícono (no el borde) del botón también vibra');
} catch (e) {
    ok(false, 'la prueba corrió entera', e.message);
} finally {
    try { ws?.close(); } catch { }
    proc.kill('SIGKILL');
}
console.log(fails ? `\n❌ ${fails} fallas` : '\n✅ todo bien');
process.exit(fails ? 1 : 0);
