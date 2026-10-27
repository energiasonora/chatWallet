// Monero en el chat entre dos identidades reales de XMTP, contra una red Monero de juguete
// (monerod --regtest, ver tests/monero-envio-e2e.mjs). Mide: Solicitar pago ofrece Monero, el
// pedido va con una subdirección propia del contacto, el otro paga desde la tarjeta, su app
// avisa con hash y clave, el que cobra verifica en la cadena (en camino → verificado), su saldo
// lo ve, y un pago real hecho a OTRO no se toma como propio.
//
// Correr:  ./tests/run-monero-chat.sh   (con monerod --regtest en :18091)

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



const NODO = process.env.NODO_REGTEST || 'http://127.0.0.1:18091';
const rpcNodo = async (method, params) => (await (await fetch(NODO + '/json_rpc', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: '0', method, params }) })).json()).result;
const minar = (n, addr) => rpcNodo('generateblocks', { amount_of_blocks: n, wallet_address: addr });
const botonXmr = (C, txt) => C.ev(`(() => { const b = [...document.querySelectorAll('#xmrModal button')].find(b => b.textContent.trim() === ${JSON.stringify(txt)} && !b.disabled); if (!b) return false; b.click(); return true; })()`);
const textoTarjetas = (C) => C.ev(`[...document.querySelectorAll('#messagesContainer .xmr-tarjeta')].map(c => c.innerText.replace(/\\s+/g, ' ').trim())`);
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
// Activa Monero contra la red de juguete, desde el bloque 0.
const prepararXmr = (C) => C.ev(`(async () => { localStorage.setItem('cw-xmr-regtest', '1'); localStorage.setItem('cw-xmr-nodo', '${NODO}');
    const M = await cwCargarMonero(); const a = await M.cuenta(currentWallet.privateKey);
    localStorage.setItem(claveEstadoXmr(currentWallet.address), JSON.stringify({ direccion: a.direccion, nacimiento: 0, total: '0', desbloqueado: '0', altura: 0, t: 0 }));
    return a.direccion; })()`);

const wa = Wallet.createRandom(), wb = Wallet.createRandom();
const A = await chrome(9431), B = await chrome(9432);
try {
    if (!(await rpcNodo('get_info'))) throw new Error('no hay monerod --regtest en ' + NODO);
    console.log('\n── dos identidades + Monero de juguete ──');
    const conReintento = async (C, pk) => (await identidad(C, pk)) || (await identidad(C, pk));
    const [a, b] = await Promise.all([conReintento(A, wa.privateKey), conReintento(B, wb.privateKey)]);
    if (!a || !b) throw new Error('XMTP no arrancó');
    const xa = await prepararXmr(A), xb = await prepararXmr(B);
    const pkC = '0x' + 'c0'.repeat(32);
    const xc = await A.ev(`cwCargarMonero().then(M => M.cuenta('${pkC}')).then(c => c.direccion)`);
    await minar(5, xa); await minar(70, xc);
    await A.ev(`pintarRedXmr(true).then(() => true)`);
    ok(BigInt((await A.ev(`estadoXmr()`)).desbloqueado) > 0n, 'A tiene XMR para pagar');

    console.log('\n── B pide 0,4 XMR en el chat ──');
    await abrirChat(B, wa.address);
    await B.ev(`document.getElementById('headerRequestBtn').click(); true`);
    await B.listo(`!!document.getElementById('payReqToken')`, 10);
    const tieneXmr = await B.ev(`[...document.getElementById('payReqToken').options].some(o => o.value === 'xmr')`);
    ok(tieneXmr, 'Solicitar pago ofrece Monero');
    await B.ev(`(() => { const s = document.getElementById('payReqToken'); s.value = 'xmr'; s.dispatchEvent(new Event('change')); document.getElementById('payReqAmount').value = '0.4'; document.getElementById('payReqSend').click(); return true; })()`);
    let tb = await esperarTarjeta(B, /Pediste Monero/, 60);
    ok(tb.some(x => /Pediste Monero 0,4 XMR/.test(x)), 'B ve su pedido', tb.join(' | '));
    const sub = await B.ev(`Object.values(leerJSONLocal(claveSubdirsXmr(currentWallet.address)) || {})[0]`);
    ok(sub && sub.i === 1 && sub.dir.startsWith('8') && sub.dir !== xb, 'el pedido usa una subdirección propia de ese contacto', sub && sub.dir.slice(0, 10));

    console.log('\n── A paga desde la tarjeta ──');
    await abrirChat(A, wb.address);
    let ta = await esperarTarjeta(A, /Te pidieron Monero/, 90);
    ok(ta.some(x => /Te pidieron Monero 0,4 XMR.*Pagar con Monero/.test(x)), 'A ve «Te pidieron Monero» con el botón', ta.join(' | '));
    const prev = await A.ev(`contacts.find(c => c.address.toLowerCase() === '${wb.address.toLowerCase()}')?.lastMessage`);
    ok(/Pedido de 0,4 XMR/.test(String(prev)), 'la lista de chats dice «Pedido de 0,4 XMR»', String(prev).slice(0, 40));
    await A.ev(`[...document.querySelectorAll('#messagesContainer .xmr-tarjeta button')].pop().click(); true`);
    await A.listo(`!!document.querySelector('#xmrModal textarea')`, 15);
    const pre = await A.ev(`({ d: document.querySelector('#xmrModal textarea').value, m: document.querySelector('#xmrModal input[type=text]').value })`);
    ok(pre.d === sub.dir && pre.m === '0.4', 'Mandar se abre con la subdirección y el monto del pedido');
    await botonXmr(A, 'Revisar');
    await A.listo(`/Comisión/.test(document.getElementById('xmrModal')?.innerText || '')`, 120);
    await botonXmr(A, 'Mandar');
    ok(!!await A.listo(`/Mandaste/.test(document.getElementById('xmrModal')?.innerText || '')`, 60), 'A mandó');
    await botonXmr(A, 'Cerrar');
    ta = await esperarTarjeta(A, /Enviaste/, 60);
    ok(ta.some(x => /Enviaste 0,4 XMR/.test(x)), 'en el chat de A queda «Enviaste 0,4 XMR»', ta.filter(x => /Enviaste/.test(x)).join(' | '));

    console.log('\n── B verifica ──');
    tb = await esperarTarjeta(B, /Te mandaron/, 90);
    const enCamino = await B.listo(`[...document.querySelectorAll('#messagesContainer .xmr-tarjeta')].map(c => c.innerText).join(' ').match(/En camino|Verificado/)?.[0]`, 60);
    ok(!!enCamino, 'B ve «Te mandaron 0,4 XMR» y lo verifica en la cadena', enCamino);
    await minar(3, xc);
    await B.ev(`Object.keys(localStorage).filter(k => k.startsWith('cw-xmr-verif-')).forEach(k => localStorage.removeItem(k)); reloadCurrentChat().then(() => true)`);
    const verif = await B.listo(`[...document.querySelectorAll('#messagesContainer .xmr-tarjeta')].map(c => c.innerText).join(' ').match(/Verificado: llegaron 0,4 XMR \\(\\d+ confirmaciones\\)/)?.[0]`, 90);
    ok(!!verif, 'minado: «✓ Verificado»', verif);
    await captura(B, 'xmr-chat-B');
    await captura(A, 'xmr-chat-A');
    await B.ev(`pintarRedXmr(true).then(() => true)`);
    const saldoB = await B.ev(`estadoXmr().total`);
    ok(saldoB === '400000000000', 'la billetera de B ve los 0,4 XMR en su subdirección', saldoB);

    console.log('\n── historial de Monero ──');
    const abrirHist = (X) => X.ev(`(async () => { document.querySelector('[data-view="historyView"]').click();
        await new Promise(r => setTimeout(r, 300)); historyNetworkSelector.value = 'xmr'; await fetchTransactionHistory(); return true; })()`);
    const filasX = (X) => X.ev(`[...document.querySelectorAll('#transactionList .hist-fila')].map(f => ({ quien: f.querySelector('.hist-quien').textContent, monto: f.querySelector('.hist-monto').textContent, det: f.querySelector('.hist-detalle').textContent }))`);
    await abrirHist(B);
    ok(!!await B.listo(`document.querySelectorAll('#transactionList .hist-fila').length >= 1`, 20), 'B: el historial de Monero tiene el cobro');
    const nombreA = await B.ev(`nombreContactoPorDir(${JSON.stringify(wa.address)})`);
    const fb = (await filasX(B))[0];
    ok(!!nombreA && fb.quien === nombreA, 'B: dice QUIÉN le pagó (el contacto de esa subdirección)', `${JSON.stringify(fb)} / ${nombreA}`);
    ok(fb.monto === '+0,4 XMR' && /subdirección #\d+, la que le diste en el chat/.test(fb.det), 'B: monto y por qué se sabe', JSON.stringify(fb));
    await abrirHist(A);
    ok(!!await A.listo(`document.querySelectorAll('#transactionList .hist-fila').length >= 1`, 20), 'A: el historial de Monero tiene el envío');
    const nombreB = await A.ev(`nombreContactoPorDir(${JSON.stringify(wb.address)})`);
    const fa = (await filasX(A)).find(f => f.monto.startsWith('−'));
    ok(!!fa && !!nombreB && fa.quien === nombreB, 'A: dice a quién le mandó', `${JSON.stringify(fa)} / ${nombreB}`);
    ok(!!fa && /^−0,4\d* XMR$/.test(fa.monto) && /Clave de la transacción/.test(fa.det), 'A: monto con comisión y la clave de la transacción', JSON.stringify(fa));

    console.log('\n── una tarjeta trucha ──');
    const hashA = await A.ev(`leerJSONLocal(claveEnviosXmr(currentWallet.address))[0]`);
    const trucha = await A.ev(`(async () => { const l = document.createElement('p'); document.body.appendChild(l);
        await verificarTarjetaXmr({ v: 1, type: 'send', amount: '400000000000', txHash: '${hashA.hashes[0]}', txKey: '${hashA.claves[0]}', address: '${sub.dir}' }, l);
        return l.textContent; })()`);
    ok(/no fue a una dirección tuya/.test(trucha), 'un pago real hecho a OTRO no se toma como propio', trucha);

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
