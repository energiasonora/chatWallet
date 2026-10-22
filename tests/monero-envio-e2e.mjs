// Mandar Monero en la app armada, contra una red de juguete local (monerod --regtest).
// Mide: un QR de Monero abre Mandar con destino y monto, errores (dirección, sin fondos),
// cancelar suelta la billetera, revisar muestra monto/comisión/total, mandar, quedar anotado
// con la clave de la transacción, el saldo baja y el otro recibe.
//
// Correr:  monerod --regtest --offline --fixed-difficulty 1 --rpc-bind-port 18091 \
//            --rpc-access-control-origins '*' --data-dir <dir>   (en otra terminal)
//          ./tests/run-monero-envio.sh

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
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-xmr-');
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


const NODO = process.env.NODO_REGTEST || 'http://127.0.0.1:18091';
const rpcNodo = async (method, params) => (await (await fetch(NODO + '/json_rpc', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: '0', method, params }) })).json()).result;
const minar = (n, addr) => rpcNodo('generateblocks', { amount_of_blocks: n, wallet_address: addr });
const clic = (C, sel) => C.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
const boton = (C, txt) => C.ev(`(() => { const b = [...document.querySelectorAll('#xmrModal button')].find(b => b.textContent.trim() === ${JSON.stringify(txt)} && !b.disabled); if (!b) return false; b.click(); return true; })()`);
const textoModal = (C) => C.ev(`document.getElementById('xmrModal')?.innerText || ''`);
async function captura(C, nombre) {
    if (!process.env.SHOTS) return;
    const r = await C.rpc('Page.captureScreenshot');
    fs.writeFileSync(process.env.SHOTS + '/' + nombre + '.png', Buffer.from(r.result.data, 'base64'));
}
// B empieza vacía (clave al azar en cada corrida); los bloques para desbloquear se minan a C.
const pkB = Wallet.createRandom().privateKey, pkC = '0x' + 'c0'.repeat(32);

const w = Wallet.createRandom();
const A = await chrome(9431);
try {
    if (!(await rpcNodo('get_info'))) throw new Error('no hay monerod --regtest en ' + NODO);
    await A.rpc('Page.navigate', { url: BASE });
    await A.listo(`typeof renderContacts === 'function'`);
    await A.ev(`localStorage.setItem('xmtp-chat-wallet', '${w.privateKey}'); localStorage.setItem('cw-xmr-regtest', '1'); localStorage.setItem('cw-xmr-nodo', '${NODO}'); true`);
    await A.rpc('Page.navigate', { url: BASE });
    await A.listo(`window.currentWallet && currentWallet.address`, 60);
    // Cuenta de Monero de la billetera (desde el bloque 0 de la red de juguete) y la de B.
    const dirs = await A.ev(`(async () => { const M = await cwCargarMonero(); const a = await M.cuenta(currentWallet.privateKey); const b = await M.cuenta('${pkB}'); const c = await M.cuenta('${pkC}');
        localStorage.setItem(claveEstadoXmr(currentWallet.address), JSON.stringify({ direccion: a.direccion, nacimiento: 0, total: '0', desbloqueado: '0', altura: 0, t: 0 }));
        localStorage.setItem(claveRedXmr(), '1'); return { a: a.direccion, b: b.direccion, c: c.direccion }; })()`);
    await minar(5, dirs.a); await minar(70, dirs.c);
    console.log('\n── saldo minado ──');
    await A.ev(`pintarRedXmr(true).then(() => true)`);
    const est = await A.ev(`estadoXmr()`);
    ok(BigInt(est.desbloqueado) > 0n, 'la billetera tiene XMR (de la red de juguete)', `${est.desbloqueado} piconero`);

    console.log('\n── QR de Monero abre Mandar ──');
    await A.ev(`handleScannedData('monero:${dirs.b}?tx_amount=0.25').then(() => true)`);
    await A.listo(`!!document.querySelector('#xmrModal textarea')`, 10);
    const pre = await A.ev(`({ d: document.querySelector('#xmrModal textarea').value, m: document.querySelector('#xmrModal input[type=text]').value })`);
    ok(pre.d === dirs.b && pre.m === '0.25', 'el QR llena destino y monto', JSON.stringify({ m: pre.m }));
    await boton(A, 'Cancelar');

    console.log('\n── errores ──');
    await clic(A, '#sendBtn');
    await A.listo(`!!document.querySelector('#xmrModal textarea')`, 10);
    ok(/Podés mandar/.test(await textoModal(A)), 'muestra cuánto se puede mandar');
    await A.ev(`document.querySelector('#xmrModal textarea').value = '4abc'; true`);
    await boton(A, 'Revisar');
    ok(/no es válida/.test(await textoModal(A)), 'rechaza una dirección inválida');
    await A.ev(`document.querySelector('#xmrModal textarea').value = '${dirs.b}'; document.querySelector('#xmrModal input[type=text]').value = '999999'; true`);
    await boton(A, 'Revisar');
    const sinFondos = await A.listo(`/No alcanza/.test(document.getElementById('xmrModal')?.innerText || '')`, 120);
    ok(!!sinFondos, 'pedir de más dice «No alcanza»', (await textoModal(A)).split('\n').slice(-3).join(' | '));
    await boton(A, 'Cancelar');
    ok(!!await A.listo(`pintarRedXmr(true).then(() => true)`, 120), 'cancelar suelta la billetera (se puede volver a poner al día)');

    console.log('\n── mandar 1,5 XMR ──');
    await clic(A, '#sendBtn');
    await A.listo(`!!document.querySelector('#xmrModal textarea')`, 10);
    await A.ev(`document.querySelector('#xmrModal textarea').value = '${dirs.b}'; document.querySelector('#xmrModal input[type=text]').value = '1,5'; true`);
    await boton(A, 'Revisar');
    const listo = await A.listo(`/Comisión/.test(document.getElementById('xmrModal')?.innerText || '')`, 120);
    const resumen = await textoModal(A);
    ok(!!listo && /Mandás 1,5 XMR/.test(resumen) && /Total:/.test(resumen), 'muestra monto, comisión y total antes de mandar', resumen.split('\n').filter(l => /Comisión|Total/.test(l)).join(' | '));
    await captura(A, 'xmr-envio-1-confirmar');
    await boton(A, 'Mandar');
    const fin = await A.listo(`/Mandaste/.test(document.getElementById('xmrModal')?.innerText || '')`, 60);
    ok(!!fin, 'dice «Mandaste 1,5 XMR»');
    await captura(A, 'xmr-envio-2-enviado');
    const envios = await A.ev(`leerJSONLocal(claveEnviosXmr(currentWallet.address))`);
    ok(envios && envios[0] && envios[0].monto === '1500000000000' && envios[0].claves[0], 'queda anotado con su clave de transacción (para probar el pago)');
    const est2 = await A.ev(`estadoXmr()`);
    ok(BigInt(est2.total) < BigInt(est.total), 'el saldo baja enseguida', `${est.total} → ${est2.total}`);
    await boton(A, 'Cerrar');
    await minar(12, dirs.a);
    const recibido = await A.ev(`(async () => { const M = await cwCargarMonero(); const r = await M.sincronizar({ privEvm: '${pkB}', nodo: '${NODO}', nacimiento: 0, datos: null, regtest: true }); return r.total; })()`);
    ok(recibido === '1500000000000', 'B (que estaba vacía) recibe exactamente 1,5 XMR', recibido);

    console.log('\n── sin errores de página ──');
    const errs = A.errores.filter(e => !/favicon|ERR_|Failed to fetch|NetworkError|XMTP|xmtp/i.test(e));
    ok(!errs.length, 'ninguna excepción sin atrapar', errs.join(' | ').slice(0, 400));
} catch (e) {
    ok(false, 'la prueba se cortó', e.message);
} finally {
    A.close();
}
console.log(fails ? `\n${fails} fallaron` : '\ntodo bien');
process.exit(fails ? 1 : 0);
