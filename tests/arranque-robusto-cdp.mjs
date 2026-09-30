// El invitado por QR que "tuvo que reiniciar y crear otra wallet" (30/9/2026).
//
// Tres defectos del arranque, rotos a propósito y medidos en Chrome contra XMTP production:
//   1. Un error al arrancar con la wallet guardada BORRABA la clave privada (removeItem +
//      "Crea o restaura una"). Ahora la clave queda y se explica qué pasó.
//   2. Si XMTP no arrancaba, el chat decía "El chat no está listo — Recargar página" y el
//      motivo iba a la consola (invisible en un teléfono). Ahora se ve el motivo y
//      "Reintentar" vuelve a arrancar el chat sin recargar.
//   3. Si fallaba el primer syncAll, el cliente quedaba a medias y ningún reintento lo
//      levantaba ("ya está inicializado"). Ahora se desarma y el reintento arranca de cero.
//   4. Abierto adentro de Instagram & cía., avisa ANTES de crear la wallet.
//
// Correr:  ./tests/run-arranque-robusto.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8846/dapp.html';
const PORT = 9396;
// Wallet descartable registrada en XMTP production (repro del 30/9/2026): hace de "quien invita".
const INVITA = process.env.INVITA || '0xAba0232960Bb97Ac16D0a4a15309f8Be95cf6042';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const UA_INSTAGRAM_ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 350.0.0.0.0 Android';
const UA_INSTAGRAM_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0 (iPhone14,5; iOS 17_5)';
const UA_CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

// Rompe lo que diga sessionStorage['cw-test-romper'] ('provider' | 'create' | 'sync'),
// antes de que corra cualquier script de la página.
const ROMPER = `(() => {
    const modo = () => { try { return sessionStorage.getItem('cw-test-romper') || ''; } catch { return ''; } };
    let realClient;
    Object.defineProperty(window, 'Client', { configurable: true,
        set(v) { realClient = v; },
        get() { return realClient && new Proxy(realClient, { get(t, k) {
            if (k !== 'create') return Reflect.get(t, k);
            return async (...a) => {
                if (modo() === 'create') throw new Error('XMTP caído a propósito (test)');
                const c = await t.create(...a);
                if (modo() === 'sync') {
                    const conv = c.conversations;
                    conv.syncAll = async () => { throw new Error('syncAll roto a propósito (test)'); };
                }
                return c;
            };
        } }); } });
    let realEthers;
    Object.defineProperty(window, 'ethers', { configurable: true,
        set(v) { realEthers = v; },
        get() { return realEthers && new Proxy(realEthers, { get(t, k) {
            if (k === 'JsonRpcProvider' && modo() === 'provider') {
                return class { constructor() { throw new Error('provider roto a propósito (test)'); } };
            }
            return Reflect.get(t, k);
        } }); } });
})();`;

async function chrome(port) {
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-arranque-');
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
    await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await rpc('Page.addScriptToEvaluateOnNewDocument', { source: ROMPER });
    const close = () => { try { ws.close(); } catch { } try { proc.kill('SIGKILL'); } catch { } try { fs.rmSync(dir, { recursive: true, force: true }); } catch { } };
    return { rpc, ev, listo, close };
}

const texto = `(document.getElementById('messagesContainer')?.innerText || '').replace(/\\s+/g, ' ').trim()`;

// ── 1 y 2: invitado nuevo, XMTP no arranca, se ve el motivo y "Reintentar" lo levanta ──
{
    const B = await chrome(PORT);
    try {
        console.log('\n── invitado nuevo con XMTP caído ──');
        await B.rpc('Page.navigate', { url: BASE });
        await B.listo(`typeof renderContacts === 'function'`);
        await B.ev(`sessionStorage.setItem('cw-test-romper', 'create'); true`);
        await B.rpc('Page.navigate', { url: `${BASE}?address=${INVITA}` });
        const caido = await B.listo(`/no pudo arrancar/.test(${texto}) && ${texto}`, 90);
        ok(!!caido, 'el chat dice que no pudo arrancar', JSON.stringify(caido));
        ok(/XMTP caído a propósito/.test(caido || ''), 'y muestra el motivo en pantalla (no "ver consola")', JSON.stringify(caido));
        const botones = await B.ev(`[...document.querySelectorAll('#messagesContainer button')].map(b => b.innerText.trim())`);
        ok(botones.includes('Reintentar'), 'ofrece Reintentar', JSON.stringify(botones));
        const estado = await B.ev(`document.getElementById('status')?.innerText || statusEl.textContent`);
        ok(/Chat no disponible: XMTP caído/.test(estado), 'el estado también dice el motivo', JSON.stringify(estado));
        const clave1 = await B.ev(`localStorage.getItem('xmtp-chat-wallet')`);
        ok(!!clave1, 'la wallet autogenerada quedó guardada');

        // XMTP vuelve: Reintentar, sin recargar.
        await B.ev(`sessionStorage.removeItem('cw-test-romper'); window.__sinRecarga = 1; true`);
        await B.ev(`[...document.querySelectorAll('#messagesContainer button')].find(b => b.innerText.trim() === 'Reintentar').click(); true`);
        const vuelve = await B.listo(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId) && !!currentConversation`, 120);
        ok(!!vuelve, 'Reintentar arranca XMTP y abre el chat', JSON.stringify(await B.ev(texto)));
        ok((await B.ev(`window.__sinRecarga`)) === 1, 'sin recargar la página');
        ok((await B.ev(`localStorage.getItem('xmtp-chat-wallet')`)) === clave1, 'con la MISMA wallet (no tuvo que crear otra)');

        // ── 1: un error al arrancar con la wallet guardada NO borra la clave ──
        console.log('\n── recargar con un error en el arranque ──');
        await B.ev(`sessionStorage.setItem('cw-test-romper', 'provider'); true`);
        await B.rpc('Page.navigate', { url: BASE });
        await B.listo(`typeof renderContacts === 'function'`);
        await sleep(6000);
        const tras = await B.ev(`({ clave: localStorage.getItem('xmtp-chat-wallet'),
            estado: document.getElementById('status')?.innerText || statusEl.textContent,
            avisos: [...document.querySelectorAll('.cw-notif')].map(n => n.innerText.replace(/\\s+/g, ' ')).join(' | ') })`);
        ok(tras.clave === clave1, 'la clave privada SIGUE guardada', tras.clave ? 'misma' : 'BORRADA');
        ok(!/Crea o restaura/.test(tras.estado + tras.avisos), 'no manda a crear otra wallet', JSON.stringify(tras));
        ok(/provider roto a propósito/.test(tras.estado + tras.avisos), 'y dice qué falló', JSON.stringify(tras));
        await B.ev(`sessionStorage.removeItem('cw-test-romper'); true`);
        await B.rpc('Page.navigate', { url: BASE });
        const repone = await B.listo(`currentWallet && currentWallet.address`, 60);
        ok(repone && repone.toLowerCase() === (await B.ev(`new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address`)).toLowerCase(),
            'al recargar sin el error, abre la misma wallet', repone);
    } finally { B.close(); }
}

// ── 3: el primer syncAll falla → el cliente se desarma y el reintento lo levanta ──
{
    const B = await chrome(PORT + 1);
    try {
        console.log('\n── falla el primer syncAll ──');
        await B.rpc('Page.navigate', { url: BASE });
        await B.listo(`typeof renderContacts === 'function'`);
        await B.ev(`sessionStorage.setItem('cw-test-romper', 'sync'); true`);
        await B.rpc('Page.navigate', { url: `${BASE}?address=${INVITA}` });
        const caido = await B.listo(`/no pudo arrancar/.test(${texto}) && ${texto}`, 120);
        ok(/syncAll roto/.test(caido || ''), 'muestra el motivo', JSON.stringify(caido));
        ok((await B.ev(`window.chatwalletxmtp === null && !isXmtpInitializing`)) === true, 'el cliente a medias se desarmó');
        await B.ev(`sessionStorage.removeItem('cw-test-romper'); true`);
        await B.ev(`[...document.querySelectorAll('#messagesContainer button')].find(b => b.innerText.trim() === 'Reintentar').click(); true`);
        const vuelve = await B.listo(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId) && !!currentConversation`, 120);
        ok(!!vuelve, 'y Reintentar lo levanta de cero', JSON.stringify(await B.ev(texto)));
    } finally { B.close(); }
}

// ── 4: adentro de Instagram ──
for (const [nombre, ua, android] of [['Android', UA_INSTAGRAM_ANDROID, true], ['iPhone', UA_INSTAGRAM_IOS, false]]) {
    const B = await chrome(PORT + 2);
    try {
        console.log(`\n── link abierto en Instagram (${nombre}) ──`);
        await B.rpc('Emulation.setUserAgentOverride', { userAgent: ua });
        await B.rpc('Page.navigate', { url: `${BASE}?address=${INVITA}` });
        const modal = await B.listo(`!!document.getElementById('cwEmbebidoModal') && document.getElementById('cwEmbebidoModal').innerText.replace(/\\s+/g, ' ')`, 60);
        ok(/navegador de Instagram/.test(modal || ''), 'avisa que está en el navegador de Instagram', JSON.stringify(modal));
        await sleep(3000);
        ok((await B.ev(`localStorage.getItem('xmtp-chat-wallet')`)) === null, 'y NO crea la wallet mientras tanto');
        if (android) {
            const href = await B.ev(`document.getElementById('cwEmbAbrir')?.getAttribute('href') || ''`);
            ok(href.startsWith('intent://') && href.includes('package=com.android.chrome') && href.includes(`address=${INVITA}`),
                '"Abrir en Chrome" lleva el link completo a Chrome', href.slice(0, 120));
        } else {
            ok(/Abrir en Safari/.test(modal || ''), 'en iPhone explica cómo abrirlo en Safari');
        }
        await B.ev(`document.getElementById('cwEmbSeguir').click(); true`);
        const sigue = await B.listo(`!document.getElementById('cwEmbebidoModal') && localStorage.getItem('xmtp-chat-wallet')`, 30);
        ok(!!sigue, '"Seguir acá igual" sigue con el flujo de siempre');
    } finally { B.close(); }
}

// ── y en Chrome normal no aparece ──
{
    const B = await chrome(PORT + 3);
    try {
        console.log('\n── Chrome de Android ──');
        await B.rpc('Emulation.setUserAgentOverride', { userAgent: UA_CHROME_ANDROID });
        await B.rpc('Page.navigate', { url: `${BASE}?address=${INVITA}` });
        const w = await B.listo(`localStorage.getItem('xmtp-chat-wallet')`, 60);
        ok(!!w && !(await B.ev(`!!document.getElementById('cwEmbebidoModal')`)), 'sin aviso: crea la wallet directo');
        const casos = await B.ev(`({
            apk: (() => { const ua = '${UA_INSTAGRAM_ANDROID}'.replace(' Instagram 350.0.0.0.0 Android', ''); return cwNavegadorEmbebido(ua); })(),
            fb: cwNavegadorEmbebido('Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/450.0]'),
            tiktok: cwNavegadorEmbebido('Mozilla/5.0 (Linux; Android 12) musical_ly_2023'),
            safari: cwNavegadorEmbebido('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'),
        })`);
        ok(casos.apk === '?' && casos.fb === 'Facebook' && casos.tiktok === 'TikTok' && casos.safari === null,
            'reconoce WebView ajeno, Facebook y TikTok; Safari no', JSON.stringify(casos));
    } finally { B.close(); }
}

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
