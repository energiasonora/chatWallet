// Vistos (tildes) entre dos identidades reales de XMTP production.
// Mide: ✓ al salir, ✓✓ celeste cuando el otro abre el chat (recibo de lectura de XMTP), un solo
// recibo por apertura, vistos en vivo con el chat abierto, el interruptor (quien lo apaga no manda
// ni ve) y que tras recargar los vistos salen de la base local.
//
// Correr:  ./tests/run-vistos.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import { Wallet } from 'ethers';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8847/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

async function chrome(port) {
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-vistos-');
    const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
        `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--window-size=390,844', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', 'about:blank'], { stdio: 'ignore' });
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

// Arranca una identidad con su PK y espera a XMTP.
async function identidad(C, pk) {
    await C.rpc('Page.navigate', { url: BASE });
    await C.listo(`typeof renderContacts === 'function'`);
    await C.ev(`localStorage.setItem('xmtp-chat-wallet', '${pk}'); true`);
    await C.rpc('Page.navigate', { url: BASE });
    return C.listo(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId) && currentWallet.address`, 120);
}

// Abre (o crea) el chat con `addr` y espera el hilo cargado.
async function abrirChat(C, addr, conTexto = null) {
    await C.ev(`(async () => {
        let c = contacts.find(x => (x.address || '').toLowerCase() === '${addr.toLowerCase()}');
        if (!c) { c = { name: 'Otro', address: '${addr}', unreadCount: 0, status: 'offline' }; contacts.push(c); await saveContacts(); }
        showView && showView('chatView');
        await startChatWithContact(c);
        return true;
    })()`);
    await C.listo(`!!currentConversation && !/Sincronizando|Iniciando/.test(messagesContainer.innerText)`, 90);
    if (conTexto) {
        // Hasta que el mensaje del otro esté en el hilo (puede tardar un sync).
        for (let i = 0; i < 12; i++) {
            if (await C.ev(`messagesContainer.innerText.includes(${JSON.stringify(conTexto)})`)) return true;
            await C.ev(`reloadCurrentChat().then(() => true)`);
            await sleep(2500);
        }
        return false;
    }
    return true;
}



const estados = (C) => C.ev(`[...document.querySelectorAll('#messagesContainer .status-icon')].map(s => s.dataset.estado)`);
async function mandar(C, texto) {
    await C.ev(`messageInput.value = ${JSON.stringify(texto)}; messageInput.dispatchEvent(new Event('input')); sendMessageForm.requestSubmit(); true`);
}
// Espera a que la burbuja propia número `i` (0 = la primera) llegue a `estado`.
async function esperarEstado(C, i, estado, seg = 40) {
    for (let k = 0; k < seg; k++) {
        const e = await estados(C);
        if (e[i] === estado) return e;
        await sleep(1000);
    }
    return await estados(C);
}

const wa = Wallet.createRandom(), wb = Wallet.createRandom();
const A = await chrome(9431), B = await chrome(9432);
try {
    console.log('\n── dos identidades en XMTP production ──');
    const conReintento = async (C, pk) => (await identidad(C, pk)) || (await identidad(C, pk));
    const [a, b] = await Promise.all([conReintento(A, wa.privateKey), conReintento(B, wb.privateKey)]);
    if (!a || !b) throw new Error('XMTP no arrancó');
    ok(!!a && !!b, 'A y B conectadas', `${a} / ${b}`);
    await abrirChat(A, wb.address);

    console.log('\n── A escribe; B no abrió el chat ──');
    await mandar(A, 'primero');
    let e = await esperarEstado(A, 0, 'enviado', 30);
    ok(e.length === 1 && e[0] === 'enviado', 'el mensaje sale con un solo tilde', JSON.stringify(e));
    const tit = await A.ev(`document.querySelector('#messagesContainer .status-icon').title`);
    ok(tit === 'Enviado', 'el tilde dice «Enviado» al pasar el dedo/mouse', tit);
    await sleep(6000);
    e = await estados(A);
    ok(e[0] === 'enviado', 'mientras B no lo abre sigue en un tilde', JSON.stringify(e));

    console.log('\n── B abre el chat ──');
    // Espía: cuenta los recibos que manda B (messages() no los devuelve).
    await B.ev(`(async () => { window.__recibos = 0; await chatwalletxmtp.conversations.sync();
        const cs = await chatwalletxmtp.conversations.list(); let p = cs[0];
        while (p && !Object.prototype.hasOwnProperty.call(p, 'sendReadReceipt')) p = Object.getPrototypeOf(p);
        const orig = p.sendReadReceipt; p.sendReadReceipt = function (...a) { window.__recibos++; return orig.apply(this, a); };
        return true; })()`);
    ok(await abrirChat(B, wa.address, 'primero'), 'B ve el mensaje');
    e = await esperarEstado(A, 0, 'visto');
    ok(e[0] === 'visto', 'a A se le pinta ✓✓ celeste sin recargar', JSON.stringify(e));
    const color = await A.ev(`getComputedStyle(document.querySelector('#messagesContainer .status-icon svg')).color`);
    ok(color === 'rgb(56, 189, 248)', 'el visto es celeste', color);
    await sleep(3000);
    const recibos = await B.ev(`window.__recibos`);
    ok(recibos === 1, 'B mandó un solo recibo al abrir', String(recibos));

    console.log('\n── con el chat abierto del otro lado ──');
    await mandar(A, 'segundo');
    e = await esperarEstado(A, 1, 'visto');
    ok(e[1] === 'visto', 'el siguiente mensaje se ve leído enseguida', JSON.stringify(e));

    console.log('\n── B responde: A ve el visto de B ──');
    await mandar(B, 'respuesta');
    e = await esperarEstado(B, 0, 'visto');
    ok(e[0] === 'visto', 'B también ve ✓✓ (A tiene el chat abierto)', JSON.stringify(e));

    console.log('\n── B apaga las confirmaciones ──');
    await B.ev(`localStorage.setItem(VISTOS_OFF_KEY, '1'); cwPintarVistos(); true`);
    e = await estados(B);
    ok(e.every(x => x === 'enviado'), 'quien las apaga deja de ver las de los demás', JSON.stringify(e));
    await mandar(A, 'tercero');
    await B.ev(`(async () => { for (let i = 0; i < 30; i++) { if (messagesContainer.innerText.includes('tercero')) return true; await new Promise(r => setTimeout(r, 1000)); } return false; })()`);
    await sleep(8000);
    e = await estados(A);
    ok(e[2] === 'enviado', 'y no manda vistos: A ve un solo tilde', JSON.stringify(e));

    console.log('\n── después de recargar, A sigue viendo los vistos ──');
    await A.rpc('Page.navigate', { url: BASE });
    await A.listo(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId)`, 120);
    await abrirChat(A, wb.address, 'tercero');
    e = await esperarEstado(A, 1, 'visto', 20);
    ok(e[0] === 'visto' && e[1] === 'visto' && e[2] === 'enviado', 'los vistos salen de la base local', JSON.stringify(e));

    if (process.env.SHOTS) {
        const r = await A.rpc('Page.captureScreenshot');
        fs.writeFileSync(process.env.SHOTS + '/vistos-oscuro.png', Buffer.from(r.result.data, 'base64'));
        await A.ev(`document.body.classList.add('theme-light'); true`);
        const r2 = await A.rpc('Page.captureScreenshot');
        fs.writeFileSync(process.env.SHOTS + '/vistos-claro.png', Buffer.from(r2.result.data, 'base64'));
    }

    console.log('\n── sin errores de página ──');
    const errs = [...A.errores, ...B.errores].filter(e => !/favicon|ERR_|Failed to fetch|NetworkError/i.test(e));
    ok(!errs.length, 'ninguna excepción sin atrapar', errs.join(' | ').slice(0, 400));
} catch (e) {
    ok(false, 'la prueba se cortó', e.message);
} finally {
    A.close(); B.close();
}
console.log(fails ? `\n${fails} fallaron` : '\ntodo bien');
process.exit(fails ? 1 : 0);
