// Mensajes fijados (📌) entre dos identidades reales de XMTP production (v3.61).
//
// El pin viaja como una reacción 📌: lo que se mide es que lo vean LOS DOS, que no se
// dibuje como chip, que sobreviva a recargar (sale de reproducir el historial), que varios
// roten en la barra, que cualquiera lo desfije, y que la barra no se cuele en otro chat.
//
// Correr:  ./tests/run-fijar-mensajes.sh

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
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-pin-');
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

const idDe = (C, texto) => C.ev(`(() => {
    const b = [...document.querySelectorAll('#messagesContainer [id^="msg-"]')].find(r => r.innerText.includes(${JSON.stringify(texto)}));
    return b ? b.id.slice(4) : null; })()`);
const barra = (C) => C.ev(`(() => { const b = document.getElementById('pinBar');
    return { visible: !b.classList.contains('hidden'), label: document.getElementById('pinBarLabel').innerText,
             texto: document.getElementById('pinBarText').innerText, id: b.dataset.msgId }; })()`);

const wa = Wallet.createRandom(), wb = Wallet.createRandom();
const A = await chrome(9421), B = await chrome(9422);
try {
    console.log('\n── dos identidades en XMTP production ──');
    const [a, b] = await Promise.all([identidad(A, wa.privateKey), identidad(B, wb.privateKey)]);
    ok(!!a && !!b, 'A y B conectadas', `${a} / ${b}`);

    const M1 = 'la dirección es Rivadavia 1234', M2 = 'el martes a las 18';
    await abrirChat(B, wa.address);
    await B.ev(`currentConversation.sendText(${JSON.stringify(M1)}).then(() => true)`);
    await sleep(800);
    await B.ev(`currentConversation.sendText(${JSON.stringify(M2)}).then(() => true)`);
    const llego = await abrirChat(A, wb.address, M2);
    ok(llego, 'A recibe los dos mensajes de B');

    console.log('\n── A fija un mensaje desde el menú ──');
    const id1 = await idDe(A, M1);
    const menu = await A.ev(`(() => {
        const row = document.getElementById('msg-${id1}');
        showReactionPicker('${id1}', row.querySelector('.message-bubble') || row);
        const pb = document.getElementById('rpPinBtn');
        return pb ? { t: pb.title, visible: !document.getElementById('reactionPicker').classList.contains('hidden') } : null; })()`);
    ok(menu && menu.visible && menu.t === 'Fijar mensaje', 'el menú del long-press tiene "Fijar mensaje"', JSON.stringify(menu));
    await A.ev(`document.getElementById('rpPinBtn').click(); true`);
    await sleep(1500);
    const bA = await barra(A);
    ok(bA.visible && bA.texto === M1 && bA.label === 'Mensaje fijado', 'A ve la barra con el mensaje fijado', JSON.stringify(bA));
    const chip = await A.ev(`!!document.querySelector('#msg-${id1} .reactions-bar')`);
    ok(!chip, 'el 📌 no se dibuja como chip de reacción');

    console.log('\n── B lo ve fijado ──');
    let bB = null;
    for (let i = 0; i < 10; i++) {
        await B.ev(`reloadCurrentChat().then(() => true)`); await sleep(2000);
        bB = await barra(B); if (bB.visible) break;
    }
    ok(bB.visible && bB.texto === M1, 'B ve el mismo mensaje fijado', JSON.stringify(bB));

    console.log('\n── dos fijados rotan ──');
    const id2 = await idDe(A, M2);
    await A.ev(`togglePin('${id2}').then(() => true)`);
    await sleep(1200);
    const r1 = await barra(A);
    ok(r1.label === 'Fijado 1 de 2' && r1.texto === M2, 'el más reciente arriba, con "1 de 2"', JSON.stringify(r1));
    await A.ev(`document.getElementById('pinBar').click(); true`);
    await sleep(600);
    const r2 = await barra(A);
    ok(r2.label === 'Fijado 2 de 2' && r2.texto === M1, 'tocar la barra pasa al siguiente', JSON.stringify(r2));
    const flash = await A.ev(`document.getElementById('msg-${id2}').classList.contains('quote-flash')`);
    ok(flash, 'y salta al mensaje con el destello');

    console.log('\n── sobrevive a recargar ──');
    await A.rpc('Page.navigate', { url: BASE });
    await A.listo(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId)`, 120);
    await abrirChat(A, wb.address);
    const tras = await barra(A);
    ok(tras.visible && tras.label === 'Fijado 1 de 2', 'tras recargar la app siguen los dos fijados', JSON.stringify(tras));

    console.log('\n── B desfija con la ✕ ──');
    for (let i = 0; i < 10; i++) {
        await B.ev(`reloadCurrentChat().then(() => true)`); await sleep(2000);
        if ((await barra(B)).label === 'Fijado 1 de 2') break;
    }
    const antes = await barra(B);
    await B.ev(`document.getElementById('pinBarUnpin').click(); true`);
    await sleep(1500);
    const despues = await barra(B);
    ok(antes.label === 'Fijado 1 de 2' && despues.label === 'Mensaje fijado' && despues.texto === M1,
        'B desfija el de arriba y queda uno', JSON.stringify({ antes, despues }));
    let final = null;
    for (let i = 0; i < 10; i++) {
        await A.ev(`reloadCurrentChat().then(() => true)`); await sleep(2000);
        final = await barra(A); if (final.label === 'Mensaje fijado') break;
    }
    ok(final.label === 'Mensaje fijado' && final.texto === M1, 'A también ve que quedó uno solo', JSON.stringify(final));
    const menu2 = await A.ev(`(() => { const row = document.getElementById('msg-${id1}');
        showReactionPicker('${id1}', row.querySelector('.message-bubble') || row);
        const t = document.getElementById('rpPinBtn').title; hideReactionPicker(); return t; })()`);
    ok(menu2 === 'Desfijar mensaje', 'sobre un fijado, el menú ofrece "Desfijar"', menu2);

    console.log('\n── con la app de B cerrada ──');
    // Lo que llega con la app cerrada no pasa por el stream: sale de message.reactions al
    // cargar el historial. Antes eso no se leía y el 📌 (o una reacción) no aparecía nunca.
    await B.rpc('Page.navigate', { url: 'about:blank' });
    await A.ev(`togglePin('${id2}').then(() => true)`);
    await sleep(1500);
    await B.rpc('Page.navigate', { url: BASE });
    await B.listo(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId)`, 120);
    await abrirChat(B, wa.address);
    let off = null;
    for (let i = 0; i < 8; i++) { off = await barra(B); if (off.label === 'Fijado 1 de 2') break; await B.ev(`reloadCurrentChat().then(() => true)`); await sleep(2000); }
    ok(off.label === 'Fijado 1 de 2' && off.texto === M2, 'B abre la app y ve el 📌 que llegó mientras estaba cerrada', JSON.stringify(off));

    console.log('\n── quitar una reacción llega al otro (bug viejo: action llega como número) ──');
    await abrirChat(A, wb.address);
    await A.ev(`sendReaction('${id1}', '👍').then(() => true)`);
    let chipB = false;
    for (let i = 0; i < 8 && !chipB; i++) { await B.ev(`reloadCurrentChat().then(() => true)`); await sleep(2000); chipB = await B.ev(`!!document.querySelector('#msg-${id1} .reaction-chip')`); }
    ok(chipB, 'B ve el 👍 de A');
    await A.ev(`sendReaction('${id1}', '👍').then(() => true)`);   // el mismo emoji otra vez = quitarlo
    await sleep(2500);
    const chipA = await A.ev(`!!document.querySelector('#msg-${id1} .reaction-chip')`);
    ok(!chipA, 'A lo quita y el eco no lo vuelve a poner');
    let sigue = true;
    for (let i = 0; i < 8 && sigue; i++) { await B.ev(`reloadCurrentChat().then(() => true)`); await sleep(2000); sigue = await B.ev(`!!document.querySelector('#msg-${id1} .reaction-chip')`); }
    ok(!sigue, 'y a B se le va');

    console.log('\n── otro chat no hereda la barra ──');
    const otro = Wallet.createRandom().address;
    await A.ev(`(async () => { const c = { name: 'Nadie', address: '${otro}', unreadCount: 0, status: 'offline' };
        contacts.push(c); startChatWithContact(c); return true; })()`);
    await sleep(800);
    const ajena = await barra(A);
    ok(!ajena.visible, 'al abrir otro chat la barra se va', JSON.stringify(ajena));

    ok(A.errores.length === 0 && B.errores.length === 0, 'sin excepciones en ninguna de las dos',
        JSON.stringify([...A.errores, ...B.errores].slice(0, 3)));
} finally { A.close(); B.close(); }

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
