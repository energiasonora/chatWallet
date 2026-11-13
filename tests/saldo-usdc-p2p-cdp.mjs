// Saldo de USDC en la billetera: 2 decimales cortados hacia abajo, sin repetir dólares debajo, y con
// P2P.me activado la insignia «🇦🇷 P2P» junto a la red + los pesos + el globo al tocarla.
// Un Chrome headless, red real (RPC de Base + P2P.me), sin XMTP. Sólo se LEEN saldos de una
// dirección pública con fondos; no se firma nada.
//
// Cómo correrlo (igual que balances-cdp.mjs):
//   yarn parcel build src/dapp.html --dist-dir /tmp/cwui --public-url ./ --cache-dir .parcel-cache-ui
//   cd /tmp/cwui && python3 -m http.server 8817 &
//   unset NODE_OPTIONS && node tests/saldo-usdc-p2p-cdp.mjs   (SHOT=prefijo guarda capturas)
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8817/dapp.html';
const PORT = 9498;
const RICO = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function check(name, ok, extra = '') {
    if (!ok) fails++;
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-usdc-');
const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=390,844', 'about:blank',
], { stdio: 'ignore' });

let ws, seq = 0;
const pending = new Map();
const errores = [];
const rpc = (method, params = {}) => new Promise(res => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
});
async function ev(expr) {
    const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
}
async function pollFor(expr, tries = 40, delay = 500) {
    for (let i = 0; i < tries; i++) { try { const v = await ev(expr); if (v) return v; } catch { } await sleep(delay); }
    return false;
}
async function foto(nombre) {
    if (!process.env.SHOT) return;
    const s = await rpc('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${process.env.SHOT}-${nombre}.png`, Buffer.from(s.result.data, 'base64'));
}
const texto = id => `document.getElementById('${id}').textContent.trim()`;
const visible = id => `!document.getElementById('${id}').classList.contains('hidden')`;

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
        if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    });
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await rpc('Page.navigate', { url: BASE }); await sleep(2500);
    await ev(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify('0x' + randomBytes(32).toString('hex'))})`);
    await rpc('Page.reload'); await sleep(1500);
    await pollFor(`!!currentWallet && !document.getElementById('appNav').classList.contains('hidden')`, 60);

    // ── Formato de una stablecoin ──
    const fmt = await ev(`[5.981234, 5.989, 0.29, 0.004, 0, 1234.5].map(cwFormatoEstable)`);
    check('2 decimales cortados hacia abajo', JSON.stringify(fmt) === JSON.stringify(['5,98', '5,98', '0,29', '< 0,01', '0,00', '1.234,50']), JSON.stringify(fmt));

    // ── USDC on Base de una dirección con fondos, sin P2P.me ──
    await ev(`currentWallet = { ...currentWallet, address: ${JSON.stringify(RICO)} }`);
    await ev(`localStorage.removeItem('cw-p2p-pago'); localStorage.setItem('cw-moneda', 'USD')`);
    const iUsdc = await ev(`optionsList.findIndex(n => String(n.TOKEN_CHAINID) === '8453' && (n.TOKEN_ADDRESS || '').toLowerCase() === CW_P2P_USDC.toLowerCase())`);
    check('USDC on Base está en la lista', iUsdc >= 0, String(iUsdc));
    await ev(`switchNetwork(${iUsdc})`);
    const monto = await pollFor(`(() => { const t = ${texto('balanceDisplay')}; return /USDC$/.test(t) && t; })()`, 40);
    check('el saldo va con coma y 2 decimales', /^(< )?[\d.]+,\d{2} USDC$/.test(monto || ''), monto);
    await sleep(1500);
    check('sin P2P: debajo no repite dólares', (await ev(texto('balanceFiat'))) === '', await ev(texto('balanceFiat')));
    check('sin P2P: sin insignia', !(await ev(visible('p2pInsignia'))));
    await foto('1-sin-p2p');

    // ── Con P2P.me activado ──
    await ev(`localStorage.setItem('cw-p2p-pago', '1'); renderBalances()`);
    const pesos = await pollFor(`(() => { const t = ${texto('balanceFiat')}; return /^≈ \\$\\s?[\\d.]+/.test(t) && t; })()`, 40);
    check('con P2P: los pesos debajo', !!pesos, pesos);
    check('con P2P: la insignia 🇦🇷 P2P', (await ev(visible('p2pInsignia'))) && (await ev(texto('p2pInsignia'))) === '🇦🇷 P2P', await ev(texto('p2pInsignia')));
    const cuenta = await ev(`(async () => { const p = await cwPrecioP2P('ARS'); return Math.round(lastBalanceNum * p.venta); })()`);
    const leido = Number(String(pesos).replace(/[^\d]/g, ''));
    check('los pesos = saldo × venta de P2P.me', Math.abs(leido - cuenta) <= 1 || cuenta < 1000, `${leido} vs ${cuenta}`);
    check('el globo arranca cerrado', !(await ev(visible('p2pGlobo'))));
    await foto('2-con-p2p');

    // Tocar la insignia abre el globo y NO el selector de red que la contiene.
    await ev(`document.getElementById('p2pInsignia').click()`);
    await sleep(300);
    const globo = await ev(texto('p2pGlobo'));
    check('al tocarla se abre el globo', (await ev(visible('p2pGlobo'))) && /1 USDC = \$/.test(globo) && /Argentina/.test(globo), globo);
    check('el globo dice de cuándo es la cotización', /recién|hace \d+ (min|h)/.test(globo), globo);
    const selectorAbierto = await ev(`(() => { const d = document.getElementById('tokenSelectorMenu'); return d ? !d.classList.contains('hidden') : null; })()`);
    check('el toque no abre el selector de red', selectorAbierto !== true, String(selectorAbierto));
    await foto('3-globo');
    await ev(`document.getElementById('p2pInsignia').click()`);
    check('otro toque lo cierra', !(await ev(visible('p2pGlobo'))));

    // Ojito: tapa monto y pesos.
    await ev(`localStorage.setItem(HIDE_BALANCE_KEY(), '1'); renderBalances()`);
    await sleep(800);
    check('ojito: tapa el monto', (await ev(texto('balanceDisplay'))) === '••••', await ev(texto('balanceDisplay')));
    check('ojito: tapa los pesos', (await ev(texto('balanceFiat'))) === '≈ ••••', await ev(texto('balanceFiat')));
    await ev(`localStorage.removeItem(HIDE_BALANCE_KEY()); renderBalances()`);

    // ── Otra red (ETH nativo en Base): sin insignia y con el valor como siempre ──
    const iEth = await ev(`optionsList.findIndex(n => String(n.TOKEN_CHAINID) === '8453' && !cwEsToken(n))`);
    if (iEth >= 0) {
        await ev(`switchNetwork(${iEth})`);
        const eth = await pollFor(`(() => { const t = ${texto('balanceFiat')}; return /US\\$/.test(t) && t; })()`, 40);
        check('ETH: sin insignia', !(await ev(visible('p2pInsignia'))));
        check('ETH: sigue el valor en dólares', !!eth, eth);
    }

    check('sin errores de JS en la página', errores.length === 0, errores.slice(0, 3).join(' | '));
} catch (e) {
    fails++; console.log('❌ el test se cortó:', e.message);
} finally {
    try { ws?.close(); } catch { }
    proc.kill();
    console.log(fails ? `\n${fails} falla(s)` : '\nTodo OK');
    process.exit(fails ? 1 : 0);
}
