// Mensajes de voz entre dos identidades reales de XMTP production.
// Mide: el micrófono aparece con el campo vacío, se graba (micrófono falso de Chrome: un
// tono), se manda como adjunto de XMTP, el otro lo ve con su duración y lo reproduce, queda
// en el almacén local, sobrevive a recargar, se descarta con el tachito y se reenvía como audio.
//
// Correr:  ./tests/run-voz.sh


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
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-voz-');
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


const cuantasVoces = (C) => C.ev(`document.querySelectorAll('#messagesContainer .voz').length`);
// Clic de verdad (cuenta como gesto del usuario, que es lo que pide el navegador para sonar).
async function clicReal(C, selector) {
    const r = await C.ev(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.scrollIntoView({ block: 'center' });
        const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    for (const type of ['mousePressed', 'mouseReleased'])
        await C.rpc('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
}
// SHOTS=<carpeta>: guarda capturas en los momentos clave (para mirar el diseño).
async function captura(C, nombre) {
    if (!process.env.SHOTS) return;
    const r = await C.rpc('Page.captureScreenshot');
    fs.writeFileSync(process.env.SHOTS + '/' + nombre + '.png', Buffer.from(r.result.data, 'base64'));
}
async function esperarVoces(C, n, seg = 40) {
    for (let i = 0; i < seg / 2.5; i++) {
        if ((await cuantasVoces(C)) >= n) return true;
        await C.ev(`reloadCurrentChat().then(() => true)`).catch(() => { });
        await sleep(2500);
    }
    return false;
}

const wa = Wallet.createRandom(), wb = Wallet.createRandom();
const A = await chrome(9431), B = await chrome(9432);
try {
    console.log('\n── dos identidades en XMTP production ──');
    // XMTP en headless a veces no arranca a la primera: un reintento por identidad.
    const conReintento = async (C, pk) => (await identidad(C, pk)) || (await identidad(C, pk));
    const [a, b] = await Promise.all([conReintento(A, wa.privateKey), conReintento(B, wb.privateKey)]);
    if (!a || !b) throw new Error('XMTP no arrancó: ' + await (a ? B : A).ev(`String(window.cwXmtpUltimoError || '') + ' / ' + document.getElementById('status')?.textContent`));
    ok(!!a && !!b, 'A y B conectadas', `${a} / ${b}`);
    await abrirChat(B, wa.address);
    await abrirChat(A, wb.address);

    console.log('\n── el botón ──');
    await sleep(900);
    const boton = await B.ev(`({ mic: !vozMicBtn.classList.contains('hidden'), env: !sendMessageBtn.classList.contains('hidden') })`);
    ok(boton.mic && !boton.env, 'con el campo vacío se ve el micrófono y no el enviar', JSON.stringify(boton));
    await B.ev(`messageInput.value = 'hola'; messageInput.dispatchEvent(new Event('input')); true`);
    const boton2 = await B.ev(`({ mic: !vozMicBtn.classList.contains('hidden'), env: !sendMessageBtn.classList.contains('hidden') })`);
    ok(!boton2.mic && boton2.env, 'al escribir vuelve el botón de enviar', JSON.stringify(boton2));
    await B.ev(`messageInput.value = ''; messageInput.dispatchEvent(new Event('input')); true`);

    console.log('\n── B graba 3 segundos y manda ──');
    await B.ev(`vozMicBtn.click(); true`);
    await sleep(3300);
    const grabando = await B.ev(`({ barra: vozBarra.classList.contains('activa'), form: sendMessageForm.classList.contains('hidden'),
        reloj: vozReloj.textContent, barras: vozVivo.children.length, mime: vozRec && vozRec.mime })`);
    await captura(B, '1-grabando');
    ok(grabando.barra && grabando.form && /^0:0[23]$/.test(grabando.reloj) && grabando.barras > 5,
        'la barra roja reemplaza al campo, con reloj y onda en vivo', JSON.stringify(grabando));
    await B.ev(`document.getElementById('vozEnviar').click(); true`);
    ok(await esperarVoces(B, 1), 'B ve su mensaje de voz en el hilo');
    const volvio = await B.ev(`!vozBarra.classList.contains('activa') && !sendMessageForm.classList.contains('hidden')`);
    ok(volvio, 'después de enviar vuelve el campo de texto');

    console.log('\n── A lo recibe ──');
    ok(await esperarVoces(A, 1), 'A ve el mensaje de voz');
    await sleep(1500);   // la onda se decodifica aparte
    const vista = await A.ev(`(() => { const v = document.querySelector('#messagesContainer .voz');
        const alturas = [...v.querySelectorAll('.voz-onda i')].map(i => i.style.height);
        return { tiempo: v.querySelector('.voz-tiempo').textContent, distintas: new Set(alturas).size, n: alturas.length,
                 recibida: !!v.closest('.message-bubble.received') }; })()`);
    ok(vista.recibida && /^0:0[34]$/.test(vista.tiempo) && vista.n === 34 && vista.distintas > 3,
        'burbuja recibida con la duración y la onda del audio', JSON.stringify(vista));
    await captura(A, '2-recibido');
    await captura(B, '2-enviado');
    const preview = await A.ev(`contacts.find(c => c.address.toLowerCase() === '${wb.address.toLowerCase()}')?.lastMessage`);
    ok(/Mensaje de voz/.test(preview || ''), 'la lista de chats dice «Mensaje de voz»', preview);

    console.log('\n── A lo reproduce ──');
    await clicReal(A, '#messagesContainer .voz .voz-play');
    await sleep(1600);
    const sonando = await A.ev(`(() => { const v = document.querySelector('#messagesContainer .voz');
        return { sonando: v.classList.contains('sonando'), on: v.querySelectorAll('.voz-onda i.on').length, tiempo: v.querySelector('.voz-tiempo').textContent }; })()`);
    await captura(A, '3-sonando');
    ok(sonando.sonando && sonando.on > 0, 'suena y la onda avanza', JSON.stringify(sonando));
    await clicReal(A, '#messagesContainer .voz .voz-vel');
    const vel = await A.ev(`document.querySelector('#messagesContainer .voz .voz-vel').textContent`);
    ok(vel === '1,5×', 'el botón de velocidad pasa a 1,5×', vel);
    await sleep(3500);
    const termino = await A.ev(`(() => { const v = document.querySelector('#messagesContainer .voz');
        return { sonando: v.classList.contains('sonando'), on: v.querySelectorAll('.voz-onda i.on').length }; })()`);
    ok(!termino.sonando && termino.on === 0, 'al terminar vuelve al principio', JSON.stringify(termino));

    console.log('\n── queda guardado (almacén local cifrado) ──');
    const reg = await A.ev(`msgStoreGetByPeer('${wb.address.toLowerCase()}').then(rs => {
        const r = rs.find(x => x.typeId === 'attachment'); if (!r) return null;
        const c = JSON.parse(r.content); return { mime: c.mimeType, nombre: c.filename, b64: (c.b64 || '').length }; })`);
    ok(reg && /^audio\//.test(reg.mime) && reg.b64 > 1000 && /^mensaje-de-voz-\d+s\./.test(reg.nombre), 'el audio está en el almacén local', JSON.stringify(reg));

    console.log('\n── sobrevive a recargar la app ──');
    await A.rpc('Page.navigate', { url: BASE });
    await A.listo(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId)`, 120);
    await abrirChat(A, wb.address);
    ok(await esperarVoces(A, 1, 20), 'después de recargar el audio sigue en el hilo');

    console.log('\n── el tachito descarta ──');
    await B.ev(`vozMicBtn.click(); true`);
    await sleep(1800);
    await B.ev(`document.getElementById('vozCancelar').click(); true`);
    await sleep(6000);
    await B.ev(`reloadCurrentChat().then(() => true)`); await sleep(2500);
    ok((await cuantasVoces(B)) === 1, 'descartar no manda nada');

    console.log('\n── reenviar manda el audio, no la etiqueta ──');
    const id = await A.ev(`document.querySelector('#messagesContainer .voz').closest('[id^="msg-"]').id.slice(4)`);
    await A.ev(`(async () => { abrirReenviar('${id}'); const c = contacts.find(x => x.address.toLowerCase() === '${wb.address.toLowerCase()}');
        await reenviarA(c); return true; })()`);
    ok(await esperarVoces(B, 2), 'B recibe el audio reenviado como audio');
    await B.ev(`document.body.classList.add('theme-light'); true`);
    await captura(B, '4-claro');

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
