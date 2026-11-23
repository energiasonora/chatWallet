// Adjuntar un archivo desde el + del chat, entre dos identidades reales de XMTP production.
// Mide: el botón Adjuntar en el menú +, un archivo chico llega y se guarda al tocarlo,
// una foto grande se achica para entrar, y uno grande sin achicar se rechaza con aviso.
//
// Correr:  ./tests/run-adjuntos.sh


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
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-adj-');
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
async function captura(C, nombre) {
    if (!process.env.SHOTS) return;
    const r = await C.rpc('Page.captureScreenshot');
    fs.writeFileSync(process.env.SHOTS + '/adj-' + nombre + '.png', Buffer.from(r.result.data, 'base64'));
}
// Elige un archivo en el input como lo haría el selector del sistema (el File se arma en la página).
const elegir = (C, armar) => C.ev(`(async () => {
    const f = await (${armar})();
    const dt = new DataTransfer(); dt.items.add(f);
    const inp = document.getElementById('chatAttachInput'); inp.files = dt.files;
    inp.dispatchEvent(new Event('change')); return true; })()`);
const espiarToasts = (C) => C.ev(`(() => { if (window.__toasts) { window.__toasts.length = 0; return true; } const o = window.showToast; window.__toasts = [];
    window.showToast = (m, t) => { window.__toasts.push(String(m)); return o?.(m, t); }; return true; })()`);
async function esperarEn(C, expr, seg = 40) {
    for (let i = 0; i < seg / 2.5; i++) {
        if (await C.ev(expr)) return true;
        await C.ev(`reloadCurrentChat().then(() => true)`).catch(() => { });
        await sleep(2500);
    }
    return false;
}

const wa = Wallet.createRandom(), wb = Wallet.createRandom();
const A = await chrome(9431), B = await chrome(9432);
try {
    console.log('\n── dos identidades en XMTP production ──');
    const conReintento = async (C, pk) => (await identidad(C, pk)) || (await identidad(C, pk));
    const [a, b] = await Promise.all([conReintento(A, wa.privateKey), conReintento(B, wb.privateKey)]);
    if (!a || !b) throw new Error('XMTP no arrancó');
    ok(!!a && !!b, 'A y B conectadas');
    await abrirChat(B, wa.address);
    await abrirChat(A, wb.address);
    await espiarToasts(B); await espiarToasts(A);

    console.log('\n── el menú + ──');
    await B.ev(`chatActionsToggle.click(); true`);
    await sleep(400);
    const menu = await B.ev(`(() => { const b = document.getElementById('chatAttachBtn'); const r = b.getBoundingClientRect();
        return { visible: !chatActionsContainer.classList.contains('hidden') && r.height > 0, texto: b.textContent.trim() }; })()`);
    ok(menu.visible && menu.texto === 'Adjuntar', 'el + muestra «Adjuntar»', JSON.stringify(menu));
    await captura(B, '1-menu');
    // Tocar Adjuntar cierra el menú (el selector de archivos del sistema no se ve en headless).
    await B.ev(`document.getElementById('chatAttachBtn').click(); true`);
    ok(await B.ev(`chatActionsContainer.classList.contains('hidden')`), 'al tocar Adjuntar se cierra el menú');

    console.log('\n── un PDF chico ──');
    await elegir(B, `async () => new File([new TextEncoder().encode('%PDF-1.4 prueba ' + 'x'.repeat(50000))], "it's informe.pdf", { type: 'application/pdf' })`);
    ok(await esperarEn(A, `[...document.querySelectorAll('#messagesContainer .adjunto-guardable')].some(e => e.textContent.includes("it's informe.pdf"))`),
        'A recibe el PDF con su nombre, tocable');
    await A.ev(`window.__guardado = null; window.cwGuardarBytes = async (n, b, m) => { window.__guardado = { n, len: b.length, m }; return n; }; true`);
    await A.ev(`[...document.querySelectorAll('#messagesContainer .adjunto-guardable')].find(e => e.textContent.includes('informe')).click(); true`);
    await sleep(500);
    const g = await A.ev(`window.__guardado`);
    ok(g && g.n === "it's informe.pdf" && g.len === 50016 && g.m === 'application/pdf', 'tocarlo lo guarda con nombre, bytes y tipo', JSON.stringify(g));
    const prev = await A.ev(`contacts.find(c => c.address.toLowerCase() === '${wb.address.toLowerCase()}')?.lastMessage`);
    ok(/informe\.pdf/.test(prev || ''), 'la lista de chats muestra el nombre', prev);

    console.log('\n── una foto grande se achica ──');
    await elegir(B, `async () => { const c = document.createElement('canvas'); c.width = c.height = 2000; const x = c.getContext('2d');
        const d = x.createImageData(2000, 2000); for (let i = 0; i < d.data.length; i++) d.data[i] = (Math.random() * 256) | 0; x.putImageData(d, 0, 0);
        const b = await new Promise(r => c.toBlob(r, 'image/png')); window.__pngSize = b.size; return new File([b], 'foto.png', { type: 'image/png' }); }`);
    const pngSize = await B.ev(`window.__pngSize`);
    ok(await esperarEn(A, `[...document.querySelectorAll('#messagesContainer img.adjunto-img')].some(i => i.naturalWidth > 0)`, 60),
        'A ve la foto', `PNG original ${(pngSize / 1e6).toFixed(1)} MB`);
    const img = await A.ev(`(() => { const i = [...document.querySelectorAll('#messagesContainer img.adjunto-img')].pop(); return { w: i.naturalWidth, alt: i.alt }; })()`);
    ok(img.w <= 1600 && img.alt === 'foto.jpg', 'llegó achicada a JPEG', JSON.stringify(img));
    await captura(A, '2-recibido');
    await captura(B, '2-enviado');

    console.log('\n── un archivo grande que no se puede achicar ──');
    await B.ev(`window.__toasts.length = 0; true`);
    await elegir(B, `async () => new File([crypto.getRandomValues(new Uint8Array(60000))].concat(Array(30).fill(new Uint8Array(60000))), 'video.mp4', { type: 'video/mp4' })`);
    await sleep(800);
    ok(await B.ev(`window.__toasts.some(t => /900 KB/.test(t))`), 'avisa que pasa de 900 KB', await B.ev(`window.__toasts.join(' | ')`));

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
