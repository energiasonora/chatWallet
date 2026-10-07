// Vincular una dApp por link abierto en frío (7/10/2026, Soberano Mail → "Abrir ChatWallet aquí").
//
// Dos defectos, medidos en Chrome contra XMTP production:
//   1. init() llamaba a handleUrlParameters() apenas cargaba la wallet, con XMTP todavía
//      arrancando: alerta "El chat (XMTP) todavía no está listo" y, peor, el replaceState
//      borraba el pedido de la URL, así que cuando el chat quedaba listo no había nada que abrir.
//      Ahora espera al chat (toast "Conectando el chat para vincular…") y abre la vinculación sola.
//   2. libxmtp devuelve como error el resumen de una sincronización parcial
//      ("synced 1 messages, 0 failed 1 succeeded from cursor …") y eso salía como
//      "No se pudo conectar". Ahora se reintenta y conecta.
//   + si el chat no llega en 60 s, avisa y deja el pedido en la URL para que recargar lo reintente.
//
// Correr:  ./tests/run-link-dapp-en-frio.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import crypto from 'node:crypto';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8851/dapp.html';
const PORT = 9386;
// Wallet descartable registrada en XMTP production: hace de dApp (Soberano Mail).
const DAPP = process.env.DAPP || '0xAba0232960Bb97Ac16D0a4a15309f8Be95cf6042';
const LINK = `${BASE}?wc=1&inbox=${DAPP}&chain=8453`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

// Antes de cualquier script: alertas a una lista (un alert() congela CDP), toasts anotados,
// y lo que pida sessionStorage['cw-test-modo']: 'resumen' (createDm devuelve una vez el
// resumen de sync como error) o 'caido' (XMTP no arranca nunca).
const ESPIA = `(() => {
    window.__alertas = []; window.__toasts = [];
    window.alert = m => { window.__alertas.push(String(m)); };
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes)
        if (n.nodeType === 1 && n.parentNode === document.body && /bottom: 24px/.test(n.getAttribute('style') || '')) window.__toasts.push(n.textContent); })
        .observe(document, { childList: true, subtree: true });
    const modo = () => { try { return sessionStorage.getItem('cw-test-modo') || ''; } catch { return ''; } };
    let realClient;
    Object.defineProperty(window, 'Client', { configurable: true,
        set(v) { realClient = v; },
        get() { return realClient && new Proxy(realClient, { get(t, k) {
            if (k !== 'create') return Reflect.get(t, k);
            return async (...a) => {
                if (modo() === 'caido') return new Promise(() => {});   // cuelga para siempre
                const c = await t.create(...a);
                if (modo() === 'resumen') {
                    const conv = c.conversations, orig = conv.createDmWithIdentifier.bind(conv);
                    let una = true;
                    conv.createDmWithIdentifier = async (...b) => {
                        if (una) { una = false; window.__resumenLanzado = 1;
                            throw new Error('synced 1 messages, 0 failed 1 succeeded from cursor Some(Cursor { sequence_id: 170087174, originator_id: 0 })'); }
                        return orig(...b);
                    };
                }
                return c;
            };
        } }); } });
})();`;

async function chrome(port) {
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-linkdapp-');
    const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
        `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--window-size=900,1000', 'about:blank'], { stdio: 'ignore' });
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
    let id = 0; const pend = new Map();
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
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
    await rpc('Page.addScriptToEvaluateOnNewDocument', { source: ESPIA });
    const close = () => { try { ws.close(); } catch { } try { proc.kill('SIGKILL'); } catch { } try { fs.rmSync(dir, { recursive: true, force: true }); } catch { } };
    return { rpc, ev, listo, close };
}

// Abre el link en frío con una wallet guardada (como quien ya usa ChatWallet en esa laptop).
async function abrirEnFrio(B, modo) {
    const pk = '0x' + crypto.randomBytes(32).toString('hex');
    await B.rpc('Page.navigate', { url: BASE });
    await B.listo(`typeof renderContacts === 'function'`);
    await B.ev(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        localStorage.setItem('xmtp-chat-wallet', '${pk}'); localStorage.setItem('chatwallet-lang', 'es');
        ${modo ? `sessionStorage.setItem('cw-test-modo', '${modo}');` : `sessionStorage.removeItem('cw-test-modo');`} return true; })()`);
    await B.rpc('Page.navigate', { url: LINK });
}

const estado = `({ url: location.search, alertas: window.__alertas, toasts: window.__toasts,
    modal: document.getElementById('wc-yes') ? document.getElementById('wc-body').innerText : null,
    xmtp: !!(window.chatwalletxmtp && chatwalletxmtp.inboxId) })`;

// ── 1: link en frío → espera al chat, NO alerta, abre la vinculación y conecta ──
for (const [titulo, modo] of [['link en frío, wallet guardada', ''], ['link en frío + createDm devuelve el resumen de sync', 'resumen']]) {
    const B = await chrome(PORT);
    try {
        console.log(`\n── ${titulo} ──`);
        await abrirEnFrio(B, modo);
        const antes = await B.listo(`window.__toasts && window.__toasts.length && ${estado}`, 30);
        ok(antes && antes.toasts.some(x => /Conectando el chat para vincular/.test(x)), 'avisa "Conectando el chat para vincular…"', JSON.stringify(antes?.toasts));
        ok(antes && /wc=1/.test(antes.url), 'el pedido sigue en la URL mientras tanto', antes?.url);
        const modal = await B.listo(`document.getElementById('wc-yes') && ${estado}`, 150);
        ok(!!modal, 'cuando el chat queda listo, abre solo el pedido de vinculación', JSON.stringify(await B.ev(estado)));
        ok(modal && modal.alertas.length === 0, 'sin la alerta "no está listo"', JSON.stringify(modal?.alertas));
        await B.ev(`document.getElementById('wc-yes').click(); true`);
        const fin = await B.listo(`window.__toasts.some(x => /onectad|vinculad|onnected/i.test(x)) && ${estado}`, 60);
        const ahora = fin || await B.ev(estado);
        ok(!!fin, 'conecta (toast de vinculado)', JSON.stringify(ahora));
        ok(ahora.alertas.length === 0, 'sin "No se pudo conectar"', JSON.stringify(ahora.alertas));
        ok(!/wc=1/.test(ahora.url), 'y recién ahí borra el pedido de la URL', ahora.url);
        if (modo === 'resumen') ok((await B.ev(`window.__resumenLanzado`)) === 1, 'el resumen de sync se lanzó de verdad (la prueba no fue en vano)');
    } finally { B.close(); }
}

// ── 2: el chat no llega → a los 60 s avisa y deja el pedido para reintentar ──
{
    const B = await chrome(PORT + 1);
    try {
        console.log('\n── XMTP no arranca ──');
        await abrirEnFrio(B, 'caido');
        await B.listo(`window.__toasts && window.__toasts.length`, 30);
        await sleep(20000);
        ok((await B.ev(`window.__alertas.length`)) === 0, 'a los 20 s todavía espera, sin alertar');
        const tarde = await B.listo(`window.__alertas.length && ${estado}`, 70);
        ok(tarde && /no terminó de conectar.*Recargá/.test(tarde.alertas.join(' ')), 'después avisa que recargue', JSON.stringify(tarde?.alertas));
        ok(tarde && /wc=1/.test(tarde.url), 'y el pedido sigue en la URL (recargar lo reintenta)', tarde?.url);
    } finally { B.close(); }
}

console.log(fails ? `\n✗ ${fails} fallas` : '\n✓ todo bien');
process.exit(fails ? 1 : 0);
