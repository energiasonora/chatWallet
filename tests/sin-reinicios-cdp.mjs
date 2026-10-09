// "Se reinició la UX con la app abierta": ¿la página se recarga o salta de pantalla sola?
// Un Chrome headless con XMTP real: se para en Balances, simula varias veces salir y volver
// (visibilitychange + focus, lo que dispara resyncMessages) y vigila durante unos minutos:
//   - una marca en window que una recarga borraría,
//   - cada showView y quién lo llamó,
//   - los console.error de recuperación ("XMTP wedged, recargando…").
//
//   unset NODE_OPTIONS && node tests/sin-reinicios-cdp.mjs     (MINUTOS=3 por defecto)
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8817/dapp.html';
const PORT = 9498;
const MINUTOS = Number(process.env.MINUTOS || 3);
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function check(name, ok, extra = '') {
    if (!ok) fails++;
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-reinicio-');
const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank',
], { stdio: 'ignore' });

let ws, seq = 0;
const pending = new Map();
const eventos = [];
const rpc = (method, params = {}) => new Promise(res => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
});
async function ev(expr) {
    const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
}
async function pollFor(expr, tries = 60, delay = 1000) {
    for (let i = 0; i < tries; i++) { try { const v = await ev(expr); if (v) return v; } catch { } await sleep(delay); }
    return false;
}
// Espía de showView: se reinstala tras cada carga (una recarga lo borra junto con la marca).
const ESPIA = `(() => {
    if (window.__espia) return;
    window.__espia = true; window.__vistas = [];
    const o = showView;
    showView = function (v) {
        window.__vistas.push({ v, t: Date.now(), quien: new Error().stack.split('\\n').slice(2, 6).join(' | ') });
        return o.apply(this, arguments);
    };
})()`;

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
        if (m.method === 'Page.frameNavigated' && !m.params.frame.parentId) eventos.push({ t: Date.now(), tipo: 'NAVEGACIÓN', url: m.params.frame.url });
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
            const txt = m.params.args.map(a => a.value ?? a.description).join(' ');
            if (/wedged|recarg|reload|reinici/i.test(txt)) eventos.push({ t: Date.now(), tipo: 'console.error', txt: txt.slice(0, 200) });
        }
        if (m.method === 'Runtime.exceptionThrown') eventos.push({ t: Date.now(), tipo: 'excepción', txt: (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 200) });
    });
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.navigate', { url: BASE }); await sleep(2500);
    await ev(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify('0x' + randomBytes(32).toString('hex'))})`);
    await rpc('Page.reload');
    const inbox = await pollFor(`window.chatwalletxmtp && window.chatwalletxmtp.inboxId`, 120);
    check('XMTP conectado', !!inbox, inbox || await ev(`(document.getElementById('status')?.textContent || '') + ' | err: ' + (typeof cwXmtpUltimoError !== 'undefined' ? cwXmtpUltimoError : '')`).catch(e => e.message));
    if (!inbox) throw new Error('sin XMTP no se puede probar la resincronización');
    eventos.length = 0;   // lo de antes es el arranque, que sí navega

    await ev(ESPIA);
    await ev(`window.__marca = 'sigo-viva'`);
    await ev(`document.getElementById('balancesNavBtn').click()`);
    await sleep(3000);

    // ── El guardián, forzado (no depende de que XMTP esté lento justo hoy) ──
    // 1. Timeout con el worker vivo (= red lenta): no se recarga nada.
    await ev(`recoverFromWedgedXmtpStream('timeout: prueba (red lenta)')`);
    await sleep(1500);
    check('timeout con el chat vivo: no recarga', await ev(`window.__marca`) === 'sigo-viva');
    check('y el guardián queda listo para la próxima', await ev(`recoveringFromWedgedXmtp`) === false);
    // 2. Worker trabado (la sonda local no contesta) con la app en pantalla: aviso, no recarga.
    await ev(`(() => { window.__listOrig = chatwalletxmtp.conversations.list.bind(chatwalletxmtp.conversations);
        chatwalletxmtp.conversations.list = () => new Promise(() => {}); })()`);
    await ev(`recoverFromWedgedXmtpStream('timeout: prueba (trabado)')`);
    await sleep(1500);
    check('trabado y en pantalla: no recarga', await ev(`window.__marca`) === 'sigo-viva');
    check('…y avisa con "El chat no responde"', /El chat no responde/.test(await ev(`document.getElementById('cwNotifs')?.innerText || ''`)));
    check('…sin moverte de pantalla', await ev(`document.querySelector('.view.active')?.id`) === 'balancesView');
    // 3. Trabado y en segundo plano: ahí sí recarga (el caso del APK, para que vuelvan los push).
    await ev(`recoveringFromWedgedXmtp = false`);
    await ev(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })`);
    await ev(`recoverFromWedgedXmtpStream('timeout: prueba (trabado en background)')`).catch(() => { });
    const recargo = await pollFor(`window.__marca !== 'sigo-viva'`, 20, 500);
    check('trabado en segundo plano: recarga', recargo === true);
    eventos.length = 0;
    // Tras la recarga: esperar el chat de nuevo y rearmar la vigilancia.
    await pollFor(`!!(window.chatwalletxmtp && window.chatwalletxmtp.inboxId)`, 120);
    await ev(ESPIA);
    await ev(`window.__marca = 'sigo-viva'`);
    await ev(`document.getElementById('balancesNavBtn').click()`);
    await sleep(2000);

    const fin = Date.now() + MINUTOS * 60000;
    let vueltas = 0;
    while (Date.now() < fin) {
        // Salir y volver a la app, como al cambiar de pestaña o de app en el celular.
        await rpc('Emulation.setFocusEmulationEnabled', { enabled: false }).catch(() => { });
        await ev(`(() => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
            document.dispatchEvent(new Event('visibilitychange'));
        })()`).catch(() => { });
        await sleep(4000);
        await ev(`(() => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('focus'));
        })()`).catch(() => { });
        vueltas++;
        await sleep(20000);
        const marca = await ev(`window.__marca`).catch(() => null);
        if (marca !== 'sigo-viva') { eventos.push({ t: Date.now(), tipo: 'MARCA PERDIDA (recarga)' }); await ev(ESPIA).catch(() => { }); await ev(`window.__marca = 'sigo-viva'`).catch(() => { }); }
    }

    const vistas = await ev(`window.__vistas || []`).catch(() => []);
    const activa = await ev(`document.querySelector('.view.active')?.id`).catch(() => '?');
    console.log(`\n   ${vueltas} idas y vueltas en ${MINUTOS} min`);
    eventos.forEach(e => console.log('   ⚠', new Date(e.t).toISOString().slice(11, 19), e.tipo, e.url || e.txt || ''));
    vistas.forEach(v => console.log('   ↪ showView', v.v, '←', v.quien.slice(0, 160)));
    check('sin recargas de la página', !eventos.some(e => /NAVEGACIÓN|MARCA/.test(e.tipo)));
    check('sin recuperaciones de XMTP colgado', !eventos.some(e => e.tipo === 'console.error'));
    check('sigue en Balances', activa === 'balancesView', activa);
    check('nadie la mandó a otra pantalla', vistas.filter(v => v.v !== 'balancesView').length === 0, vistas.map(v => v.v).join(','));
} catch (e) {
    fails++; console.error('💥', e);
} finally {
    try { proc.kill(); } catch { }
}
console.log(fails ? `\n${fails} fallas` : '\nTodo verde');
process.exit(fails ? 1 : 0);
