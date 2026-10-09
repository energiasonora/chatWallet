// SmartWallet apagada (SMART_ENABLED = false): ni la línea "SmartWallet: … CWLT" debajo del
// saldo, ni pedidos al localhost:3000 del usuario, ni la lectura del saldo CWLT en Arbitrum.
// Un Chrome headless con la red real; mira TODOS los pedidos de red desde que abre la wallet.
//
//   unset NODE_OPTIONS && node tests/sin-smartwallet-cdp.mjs   (BASE=… para otro build)
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8817/dapp.html';
const PORT = 9500;
const CWLT = '0x4697bde7f6b40790d11c9ab7628fa4827fce8bae';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function check(name, ok, extra = '') {
    if (!ok) fails++;
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-smart-');
const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank',
], { stdio: 'ignore' });

let ws, seq = 0;
const pending = new Map();
const pedidos = [];
const rpc = (method, params = {}) => new Promise(res => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
});
async function ev(expr) {
    const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
}
async function pollFor(expr, tries = 60, delay = 500) {
    for (let i = 0; i < tries; i++) { try { const v = await ev(expr); if (v) return v; } catch { } await sleep(delay); }
    return false;
}

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
        if (m.method === 'Network.requestWillBeSent') {
            const r = m.params.request;
            pedidos.push({ url: r.url, body: (r.postData || '').toLowerCase() });
        }
    });
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.navigate', { url: BASE }); await sleep(2500);
    await ev(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify('0x' + randomBytes(32).toString('hex'))})`);
    await rpc('Network.enable');
    await rpc('Page.reload');
    await pollFor(`!!currentWallet && !document.getElementById('appNav').classList.contains('hidden')`, 60);
    // Que pasen el saldo, un refresco manual y el arranque del chat.
    await pollFor(`/\\d/.test(document.getElementById('balanceDisplay').textContent)`, 40);
    await ev(`document.getElementById('manualBalanceRefresh').click()`);
    await sleep(8000);

    const visible = await ev(`(() => { const el = document.getElementById('smartWalletBalanceDisplay');
        return !!el && getComputedStyle(el).display !== 'none' && !el.classList.contains('hidden'); })()`);
    check('no se ve "SmartWallet: … CWLT"', visible === false);
    const local = pedidos.filter(p => /\/\/(localhost|127\.0\.0\.1):3000/.test(p.url));
    check('ningún pedido al localhost:3000', local.length === 0, local.map(p => p.url).join(' ').slice(0, 200));
    const cwlt = pedidos.filter(p => p.body.includes(CWLT.slice(2)));
    check('no lee el saldo de CWLT', cwlt.length === 0, cwlt.length + ' pedidos');
    check('el saldo de la red sí se lee', /\d/.test(await ev(`document.getElementById('balanceDisplay').textContent`)));
    console.log(`   (${pedidos.length} pedidos de red observados)`);
} catch (e) {
    fails++; console.error('💥', e);
} finally {
    try { proc.kill(); } catch { }
}
console.log(fails ? `\n${fails} fallas` : '\nTodo verde');
process.exit(fails ? 1 : 0);
