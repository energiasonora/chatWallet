// Ğ1 en el chat entre dos identidades reales de XMTP (ius-spec/vinculo-g1.md §11).
// La cadena Ğ1 va SIMULADA (nunca se manda una transferencia real). Mide: el perfil lleva la
// cuenta Ğ1 con doble firma y el otro la aprende; Enviar del chat ofrece Ğ1 y abre el envío
// con la cuenta del contacto; queda la tarjeta del pago en los dos lados y el que cobra la
// verifica; Solicitar pago ofrece Ğ1 y la tarjeta «Pagar con Ğ1» abre el envío con monto;
// sin cuenta compartida, Ğ1 se ve apagada y explica por qué.
//
// Correr:  ./tests/run-g1-chat.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import { Wallet } from 'ethers';
import { raizHex, cuentaDeRaizHex } from '../src/js/g1-billetera.js';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8847/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

async function chrome(port) {
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-g1chat-');
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




// Arranca con PK + cuenta Ğ1 (raíz guardada, como una billetera restaurada con frase).
async function identidadG1(C, w, raiz, g1) {
    await C.rpc('Page.navigate', { url: BASE });
    await C.listo(`typeof renderContacts === 'function'`);
    const a = w.address.toLowerCase();
    await C.ev(`localStorage.setItem('xmtp-chat-wallet', '${w.privateKey}');
        localStorage.setItem('cw-g1-cuenta-${a}', JSON.stringify({ g1: '${g1}', ruta: '' }));
        localStorage.setItem('cw-g1-raiz-${a}', '${raiz}'); true`);
    await C.rpc('Page.navigate', { url: BASE });
    return C.listo(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId) && currentWallet.address`, 120);
}
// Cadena simulada: saldo fijo y enviar() que anota en vez de mandar.
const simularCadena = (C) => C.ev(`(() => {
    const cadena = {
        saldo: async () => ({ saldo: 100000, pendiente: 0 }),
        enviar: async (cuenta, destino, centimos, comentario, alEstado) => {
            window.__g1env = { desde: cuenta.direccion, destino, centimos, comentario };
            alEstado && alEstado('en-bloque');
            return { hash: '0x' + 'ab'.repeat(32), bloque: 4242 };
        },
    };
    Object.defineProperty(window, 'cwCargarCadenaG1', { configurable: true, get: () => async () => cadena, set: () => { } });
    return true; })()`);
// El indexador de quien cobra: un historial con la transferencia que dice la tarjeta.
const simularHistorial = (C, de, centimos, bloque) => C.ev(`(async () => {
    const real = await window.cwCargarBilleteraG1();
    const B = { ...real, historial: async () => ({ total: 1, siguiente: null, movimientos: [{ id: 'x', bloque: ${bloque}, t: Date.now(), centimos: ${centimos}, otro: '${de}', nombre: null, comentario: null }] }) };
    Object.defineProperty(window, 'cwCargarBilleteraG1', { configurable: true, get: () => async () => B, set: () => { } });
    return true; })()`);
const textoTarjetas = (C) => C.ev(`[...document.querySelectorAll('#messagesContainer .g1-tarjeta')].map(c => c.innerText.replace(/\\s+/g, ' ').trim())`);
async function esperarTarjeta(C, re, seg = 60) {
    for (let i = 0; i < seg / 3; i++) {
        const ts = await textoTarjetas(C);
        if (ts.some(x => re.test(x))) return ts;
        await C.ev(`reloadCurrentChat().then(() => true)`).catch(() => { });
        await sleep(3000);
    }
    return await textoTarjetas(C);
}
async function captura(C, nombre) {
    if (!process.env.SHOTS) return;
    const r = await C.rpc('Page.captureScreenshot');
    fs.writeFileSync(process.env.SHOTS + '/' + nombre + '.png', Buffer.from(r.result.data, 'base64'));
}
const contactoG1 = (C, addr) => C.ev(`contacts.find(c => (c.address || '').toLowerCase() === '${addr.toLowerCase()}')?.g1 || null`);

const wa = Wallet.createRandom(), wb = Wallet.createRandom();
const ra = raizHex(wa.mnemonic.phrase), rb = raizHex(wb.mnemonic.phrase);
const ga = cuentaDeRaizHex(ra, '').direccion, gb = cuentaDeRaizHex(rb, '').direccion;
const A = await chrome(9433), B = await chrome(9434);
try {
    console.log('\n── dos identidades con Ğ1 ──');
    const conReintento = async (C, w, r, g) => (await identidadG1(C, w, r, g)) || (await identidadG1(C, w, r, g));
    const [a, b] = await Promise.all([conReintento(A, wa, ra, ga), conReintento(B, wb, rb, gb)]);
    if (!a || !b) throw new Error('XMTP no arrancó');
    await simularCadena(A); await simularCadena(B);

    console.log('\n── el perfil lleva la cuenta Ğ1 ──');
    const perfil = await A.ev(`buildSignedProfile().then(p => p.g1)`);
    ok(perfil && perfil.cuenta === ga && !!perfil.evm && !!perfil.ed, 'el perfil firmado de A lleva su cuenta Ğ1 con las dos firmas', perfil && perfil.cuenta);
    await abrirChat(A, wb.address);
    await abrirChat(B, wa.address);
    await A.ev(`sendProfile(currentConversation).then(() => true)`);
    await B.ev(`sendProfile(currentConversation).then(() => true)`);
    let gbEnA = null, gaEnB = null;
    for (let i = 0; i < 30 && !(gbEnA && gaEnB); i++) {
        await sleep(2000);
        gbEnA = await contactoG1(A, wb.address); gaEnB = await contactoG1(B, wa.address);
        if (!(gbEnA && gaEnB)) { await A.ev(`reloadCurrentChat().then(() => true)`).catch(() => { }); await B.ev(`reloadCurrentChat().then(() => true)`).catch(() => { }); }
    }
    ok(gbEnA === gb, 'A aprendió la cuenta Ğ1 de B por su perfil', gbEnA);
    ok(gaEnB === ga, 'B aprendió la cuenta Ğ1 de A por su perfil', gaEnB);

    await simularHistorial(B, ga, 1250, 4242);
    console.log('\n── A le manda Ğ1 desde el chat ──');
    await A.ev(`document.getElementById('headerSendBtn').click(); true`);
    await A.listo(`!document.getElementById('sendModal').classList.contains('hidden')`, 10);
    const item = await A.ev(`(() => { const i = document.getElementById('sendModalG1Item'); return i ? { txt: i.textContent, apagado: i.classList.contains('opacity-50') } : null; })()`);
    ok(item && /Ğ1/.test(item.txt) && !item.apagado, 'el menú «Activo» del envío ofrece Ğ1', JSON.stringify(item));
    await A.ev(`document.getElementById('sendModalG1Item').click(); true`);
    const abierto = await A.listo(`document.querySelector('#g1EnvioModal [data-g1="destino"]')?.value`, 15);
    ok(abierto === gb, 'abre «Enviar Ğ1» con la cuenta del contacto', abierto);
    ok(await A.ev(`document.getElementById('sendModal').classList.contains('hidden')`), 'el modal EVM se cierra');
    await A.listo(`/Podés|disponible|available/i.test(document.querySelector('#g1EnvioModal [data-g1="disponible"]')?.textContent || '')`, 20);
    await A.ev(`(() => { const m = document.getElementById('g1EnvioModal'); m.querySelector('[data-g1="monto"]').value = '12,5'; m.querySelector('[data-g1="comentario"]').value = 'café'; m.querySelector('form').requestSubmit(); return true; })()`);
    await A.listo(`!document.querySelector('#g1EnvioModal [data-g1="paso2"]').classList.contains('hidden')`, 30);
    await A.ev(`document.querySelector('#g1EnvioModal form').requestSubmit(); true`);
    const env = await A.listo(`window.__g1env`, 30);
    ok(env && env.desde === ga && env.destino === gb && env.centimos === 1250 && env.comentario === 'café', 'firma desde la cuenta Ğ1 de A hacia la de B, 12,50 Ğ1', JSON.stringify(env));
    let ta = await esperarTarjeta(A, /Enviaste/, 30);
    ok(ta.some(x => /Enviaste 12,50 Ğ1 bloque #4242/.test(x)), 'en el chat de A queda «Enviaste 12,50 Ğ1»', ta.join(' | '));
    await A.ev(`document.getElementById('g1EnvioModal')?.remove(); true`);

    console.log('\n── B lo ve y lo verifica ──');
    let tb = await esperarTarjeta(B, /Te mandaron/, 90);
    const verif = await B.listo(`[...document.querySelectorAll('#messagesContainer .g1-tarjeta')].map(c => c.innerText).join(' ').match(/Verificado: llegaron 12,50 Ğ1/)?.[0]`, 30);
    ok(!!verif, 'B ve «Te mandaron 12,50 Ğ1» y «✓ Verificado»', tb.join(' | '));
    const prevB = await B.ev(`contacts.find(c => c.address.toLowerCase() === '${wa.address.toLowerCase()}')?.lastMessage`);
    ok(/💸 12,50 Ğ1/.test(String(prevB)), 'la vista previa dice «💸 12,50 Ğ1»', String(prevB).slice(0, 80));
    const trucha = await B.ev(`(async () => { const l = document.createElement('p'); document.body.appendChild(l);
        await verificarTarjetaG1({ type: 'send', amount: 1250, from: '${ga}', to: '${ga}', block: 4242 }, l); return l.textContent; })()`);
    ok(/no fue a tu cuenta/.test(trucha), 'un pago a OTRA cuenta no se toma como propio', trucha);

    console.log('\n── B pide 3 Ğ1, A paga desde la tarjeta ──');
    await B.ev(`document.getElementById('headerRequestBtn').click(); true`);
    await B.listo(`!!document.getElementById('payReqToken')`, 10);
    ok(await B.ev(`[...document.getElementById('payReqToken').options].some(o => o.value === 'g1')`), 'Solicitar pago ofrece Ğ1');
    await B.ev(`(() => { const s = document.getElementById('payReqToken'); s.value = 'g1'; s.dispatchEvent(new Event('change')); document.getElementById('payReqAmount').value = '3'; document.getElementById('payReqSend').click(); return true; })()`);
    tb = await esperarTarjeta(B, /Pediste Ğ1/, 30);
    ok(tb.some(x => /Pediste Ğ1 3,00 Ğ1/.test(x)), 'B ve su pedido', tb.join(' | '));
    ta = await esperarTarjeta(A, /Te pidieron Ğ1/, 90);
    ok(ta.some(x => /Te pidieron Ğ1 3,00 Ğ1.*Pagar con Ğ1/.test(x)), 'A ve «Te pidieron Ğ1» con el botón', ta.join(' | '));
    await A.ev(`[...document.querySelectorAll('#messagesContainer .g1-tarjeta button')].pop().click(); true`);
    const pre = await A.listo(`(() => { const m = document.getElementById('g1EnvioModal'); return m && m.querySelector('[data-g1="destino"]').value ? { d: m.querySelector('[data-g1="destino"]').value, m: m.querySelector('[data-g1="monto"]').value } : null; })()`, 15);
    ok(pre && pre.d === gb && pre.m === '3,00', 'Pagar con Ğ1 abre el envío con la cuenta y el monto del pedido', JSON.stringify(pre));
    await A.ev(`document.getElementById('g1EnvioModal')?.remove(); true`);
    await captura(A, 'g1-chat-A'); await captura(B, 'g1-chat-B');

    console.log('\n── contacto sin cuenta Ğ1 ──');
    await A.ev(`(() => { const c = contacts.find(c => c.address.toLowerCase() === '${wb.address.toLowerCase()}'); delete c.g1; return true; })()`);
    await A.ev(`document.getElementById('headerSendBtn').click(); true`);
    await A.listo(`!document.getElementById('sendModal').classList.contains('hidden')`, 10);
    ok(await A.ev(`document.getElementById('sendModalG1Item')?.classList.contains('opacity-50')`), 'Ğ1 aparece apagada');
    await A.ev(`document.getElementById('sendModalG1Item').click(); true`);
    const aviso = await A.listo(`[...document.querySelectorAll('*')].map(e => e.childElementCount === 0 ? e.textContent : '').find(t => /todavía no compartió su cuenta Ğ1/.test(t))`, 5);
    ok(!!aviso, 'al tocarla explica por qué', aviso);
    ok(!(await A.ev(`!!document.getElementById("g1EnvioModal")`)), "y no abre el envío Ğ1");
    await A.ev(`document.getElementById('cancelSendBtn').click(); true`);
    await A.ev(`document.getElementById('sendBtn').click(); true`);
    await sleep(500);
    ok(!(await A.ev(`!!document.getElementById('sendModalG1Item')`)), 'desde la billetera (no el chat) el menú no ofrece Ğ1');

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
