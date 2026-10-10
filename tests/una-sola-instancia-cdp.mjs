// El chat arranca en UNA sola pestaña/ventana por navegador. La base de XMTP (OPFS) es de
// acceso exclusivo: antes, la segunda instancia estrenaba otra instalación, la app lo leía como
// "el navegador borró la base" y daba de baja la instalación viva de la primera ventana.
// Dos pestañas del mismo perfil de Chrome headless, XMTP real.
//
//   unset NODE_OPTIONS && node tests/una-sola-instancia-cdp.mjs     (BASE=… para otro build)
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8817/dapp.html';
const PORT = 9507;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function check(name, ok, extra = '') {
    if (!ok) fails++;
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-una-');
const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank',
], { stdio: 'ignore' });

async function conectar(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0; const pending = new Map();
    ws.addEventListener('message', e => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    const rpc = (method, params = {}) => new Promise(res => {
        const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
    });
    const ev = async (expr) => (await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
    const pollFor = async (expr, tries = 60, delay = 1000) => {
        for (let i = 0; i < tries; i++) { try { const v = await ev(expr); if (v) return v; } catch { } await sleep(delay); }
        return false;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    return { rpc, ev, pollFor };
}
const INST = `window.chatwalletxmtp && String(chatwalletxmtp.installationId || '')`;

try {
    let paginas;
    for (let i = 0; i < 60 && !paginas?.length; i++) {
        await sleep(500);
        try { paginas = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page'); } catch { }
    }
    const A = await conectar(paginas[0].webSocketDebuggerUrl);
    await A.rpc('Page.navigate', { url: BASE }); await sleep(2500);
    await A.ev(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
    await A.ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify('0x' + randomBytes(32).toString('hex'))})`);
    await A.rpc('Page.reload');
    const instA = await A.pollFor(INST, 300);
    check('primera pestaña: chat conectado', !!instA, String(instA).slice(0, 16));
    if (!instA) throw new Error('sin XMTP no se puede probar');

    // Segunda pestaña, misma cuenta, mismo perfil.
    const nueva = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE)}`, { method: 'PUT' })).json();
    const B = await conectar(nueva.webSocketDebuggerUrl);
    const aviso = await B.pollFor(`/otra pestaña o ventana/.test(document.getElementById('status')?.textContent || '')`, 60);
    check('segunda pestaña: avisa que ya está abierta en otra', aviso === true, await B.ev(`document.getElementById('status')?.textContent`));
    await sleep(8000);
    check('…y NO crea otro cliente de XMTP', !await B.ev(INST));
    check('…la wallet sí abrió', await B.ev(`!!currentWallet`));
    check('…no sale el aviso de "este navegador borró los chats"', !/borró los chats/.test(await B.ev(`document.body.innerText`)));
    check('la instalación anotada sigue siendo la de la primera',
        await B.ev(`Object.keys(localStorage).filter(k => k.startsWith('cw-xmtp-instalacion')).map(k => localStorage.getItem(k)).join(',')`) === instA);
    check('la primera sigue con su instalación', await A.ev(INST) === instA);

    // Se cierra la primera: la segunda arranca sola, con la MISMA base.
    await A.rpc('Page.navigate', { url: 'about:blank' });
    const instB = await B.pollFor(INST, 300);
    check('al cerrar la primera, la segunda arranca sola', !!instB);
    check('…con la misma instalación (misma base, nada rehecho)', instB === instA, `${String(instB).slice(0, 16)} vs ${instA.slice(0, 16)}`);
    await sleep(12000);   // el margen en que antes salía el aviso y se revocaba la "muerta"
    check('…y sin el aviso de base borrada', !/borró los chats/.test(await B.ev(`document.body.innerText`)));
} catch (e) {
    fails++; console.error('💥', e);
} finally {
    try { proc.kill(); } catch { }
}
console.log(fails ? `\n${fails} fallas` : '\nTodo verde');
process.exit(fails ? 1 : 0);
