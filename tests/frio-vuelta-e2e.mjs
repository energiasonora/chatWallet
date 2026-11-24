import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import { Wallet } from 'ethers';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8849/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

async function chrome(port) {
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-radio-');
    const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
        `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });
    let ws;
    for (let i = 0; i < 40 && !ws; i++) {
        await sleep(500);
        try {
            const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            const pg = l.find(t => t.type === 'page');
            if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl);
        } catch { }
    }
    if (!ws) throw new Error('Chrome no levantó');
    await new Promise((res, bad) => { ws.onopen = res; ws.onerror = bad; });
    let id = 0; const pend = new Map(); const errores = [];
    ws.addEventListener('message', e => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') errores.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 300));
    });
    const rpc = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => {
        const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error((ex.exception?.description || ex.text || '').slice(0, 300));
        return r.result?.result?.value;
    };
    const listo = async (expr, seg = 60) => {
        for (let i = 0; i < seg * 2; i++) { try { const v = await ev(expr); if (v) return v; } catch { } await sleep(500); }
        return null;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const close = () => { try { ws.close(); } catch { } try { proc.kill('SIGKILL'); } catch { } try { fs.rmSync(dir, { recursive: true, force: true }); } catch { } };
    return { rpc, ev, listo, close, errores };
}

// El dongle de mentira: guarda lo que la página escribe y le entrega lo que "llega".

// Ida y vuelta del modo frío con XMTP de verdad: al volver tiene que seguir la MISMA
// instalación (misma base). Antes arrancaba un segundo cliente en la página, no podía abrir
// la base trabada, XMTP estrenaba instalación y salía «el navegador borró los chats».
// Correr:  ./tests/run-frio-vuelta.sh
(async () => {
    const pk = Wallet.createRandom().privateKey;
    const C = await chrome(9443);
    const toasts = `[...document.querySelectorAll('*')].some(e => e.children.length === 0 && e.tagName !== 'SCRIPT' && /borró los chats/.test(e.textContent || ''))`;
    try {
        await C.rpc('Page.navigate', { url: BASE });
        await C.listo(`typeof renderContacts === 'function'`);
        await C.ev(`localStorage.setItem('xmtp-chat-wallet', '${pk}'); localStorage.setItem('cw:frioVisto', '1'); true`);
        await C.rpc('Page.navigate', { url: BASE });
        const inst1 = await C.listo(`typeof chatwalletxmtp !== 'undefined' && chatwalletxmtp && !isXmtpInitializing && String(chatwalletxmtp.installationId || '')`, 150);
        ok(!!inst1, 'XMTP arrancó', String(inst1).slice(0, 8));
        await sleep(3000);
        // Ida: frío por el interruptor (segunda vez: directo)
        await C.ev(`document.getElementById('settingsBtn').click(); true`); await sleep(400);
        await C.ev(`document.getElementById('coldModeSwitch').click(); true`); await sleep(1500);
        ok(await C.ev(`isOffline`), 'en modo frío');
        // Vuelta
        await C.ev(`document.getElementById('settingsBtn').click(); true`); await sleep(400);
        await C.ev(`document.getElementById('coldModeSwitch').click(); true`);
        await sleep(2500);
        const inst2 = await C.listo(`typeof chatwalletxmtp !== 'undefined' && chatwalletxmtp && !isXmtpInitializing && !isOffline && String(chatwalletxmtp.installationId || '')`, 150);
        ok(!!inst2, 'XMTP volvió a arrancar', String(inst2).slice(0, 8));
        await sleep(4000);
        ok(inst1 && inst1 === inst2, 'misma instalación de XMTP (no se rehízo la base)', `${String(inst1).slice(0, 8)} → ${String(inst2).slice(0, 8)}`);
        ok(!(await C.ev(toasts)), 'sin el aviso «el navegador borró los chats»');
        ok(!(await C.ev(`isOffline`)) && !(await C.ev(`document.body.classList.contains('cold-mode')`)), 'quedó en caliente');
        // Un mensaje que llega por internet MIENTRAS estás en frío: ¿aparece al volver?
        const pkB = Wallet.createRandom().privateKey;
        const B = await chrome(9444);
        try {
            await B.rpc('Page.navigate', { url: BASE });
            await B.listo(`typeof renderContacts === 'function'`);
            await B.ev(`localStorage.setItem('xmtp-chat-wallet', '${pkB}'); true`);
            await B.rpc('Page.navigate', { url: BASE });
            ok(!!(await B.listo(`typeof chatwalletxmtp !== 'undefined' && chatwalletxmtp && !isXmtpInitializing`, 150)), 'B: XMTP arrancó');
            const addrA = await C.ev(`currentWallet.address`);
            await C.ev(`document.getElementById('settingsBtn').click(); true`); await sleep(400);
            await C.ev(`document.getElementById('coldModeSwitch').click(); true`); await sleep(1500);
            ok(await C.ev(`isOffline`), 'A: de nuevo en frío');
            const texto = 'hola mientras estabas en frío ' + Date.now();
            await B.ev(`(async () => { const c = await chatwalletxmtp.conversations.createDmWithIdentifier({ identifier: '${addrA}', identifierKind: 0 }); await c.sync().catch(() => {}); await c.sendText(${JSON.stringify(texto)}); return true; })()`);
            await sleep(6000);
            ok(!(await C.ev(`[...document.querySelectorAll('*')].some(e => e.children.length === 0 && e.tagName !== 'SCRIPT' && (e.textContent || '').includes(${JSON.stringify(texto)}))`)),
                'A en frío: el mensaje NO entra mientras está en frío');
            await C.ev(`document.getElementById('settingsBtn').click(); true`); await sleep(400);
            await C.ev(`document.getElementById('coldModeSwitch').click(); true`); await sleep(2500);
            await C.listo(`typeof chatwalletxmtp !== 'undefined' && chatwalletxmtp && !isXmtpInitializing && !isOffline`, 150);
            const addrB = (await B.ev(`currentWallet.address`)).toLowerCase();
            ok(!!(await C.listo(`contacts.some(c => (c.address || '').toLowerCase() === '${addrB}')`, 60)), 'A al volver: aparece B en la lista de chats');
            const unread = await C.ev(`(() => { const c = contacts.find(c => (c.address || '').toLowerCase() === '${addrB}'); return c ? (c.unread || c.unreadCount || 0) : -1; })()`);
            ok(!!(await C.listo(`(async () => { const dms = await chatwalletxmtp.conversations.listDms(); for (const d of dms) { const ms = await d.messages(); if (ms.some(m => typeof m.content === 'string' && m.content.includes(${JSON.stringify(texto)}))) return true; } return false; })()`, 60)),
                'A al volver: el mensaje está en su base', `sin leer: ${unread}`);
        } finally { B.close(); }
    } catch (e) { ok(false, 'excepción', e.message); }
    finally { C.close(); }
    console.log(fails ? `\n✗ ${fails} fallas` : '\n✓ todo bien');
    process.exit(fails ? 1 : 0);
})();
