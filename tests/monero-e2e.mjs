// Monero (paso 2: recibir y ver el saldo) en la app armada, contra un nodo real de mainnet.
// Mide: Monero en el selector, la pregunta de la primera vez, ponerse al día, saldo y dirección,
// Recibir con QR, Enviar todavía desviado, las 25 palabras, ajustes (nodo y solo wifi), que
// sobreviva a recargar y que elegir una red EVM salga de Monero.
//
// Correr:  ./tests/run-monero.sh

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


const clic = (C, sel) => C.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
const botonConTexto = (C, txt) => C.ev(`(() => { const b = [...document.querySelectorAll('#xmrModal button')].find(b => b.textContent.includes(${JSON.stringify(txt)})); if (!b) return false; b.click(); return true; })()`);
async function captura(C, nombre) {
    if (!process.env.SHOTS) return;
    const r = await C.rpc('Page.captureScreenshot');
    fs.writeFileSync(process.env.SHOTS + '/' + nombre + '.png', Buffer.from(r.result.data, 'base64'));
}

const w = Wallet.createRandom();
const A = await chrome(9431);
try {
    await A.rpc('Page.navigate', { url: BASE });
    await A.listo(`typeof renderContacts === 'function'`);
    await A.ev(`localStorage.setItem('xmtp-chat-wallet', '${w.privateKey}'); true`);
    await A.rpc('Page.navigate', { url: BASE });
    ok(!!await A.listo(`window.currentWallet && currentWallet.address`, 60), 'billetera cargada');
    await sleep(1500);

    console.log('\n── el selector ofrece Monero ──');
    await A.ev(`renderTokenMenu(); true`);
    ok(await A.ev(`!!document.getElementById('redXmrItem') && document.getElementById('redXmrItem').textContent.includes('Monero')`), 'Monero aparece debajo de las redes');
    await clic(A, '#redXmrItem');
    ok(!!await A.listo(`document.getElementById('xmrModal')?.textContent.includes('primera vez')`, 10), 'la primera vez pregunta si ya se usó en otro dispositivo');
    await captura(A, 'xmr-1-pregunta');
    await botonConTexto(A, 'primera vez');

    console.log('\n── se pone al día ──');
    const est = await A.listo(`(() => { const e = estadoXmr(); return e && e.t ? e : null; })()`, 240);
    ok(!!est, 'terminó de ponerse al día', est && `altura ${est.altura}, nacimiento ${est.nacimiento}`);
    ok(est && /^4[1-9A-HJ-NP-Za-km-z]{94}$/.test(est.direccion), 'dirección de Monero válida', est && est.direccion.slice(0, 12) + '…');
    const vista = await A.ev(`({ saldo: document.getElementById('mainBalanceValue')?.textContent || lastBalances.main, red: chainNameDisplay.textContent,
        clase: document.body.classList.contains('red-xmr'), info: document.getElementById('xmrWalletEstado').textContent,
        gas: getComputedStyle(document.getElementById('gasBalanceDisplay')).display, etiqueta: document.getElementById('qrAddressLabel').textContent })`);
    ok(/0 XMR/.test(vista.saldo) && vista.red === 'Monero' && vista.clase, 'saldo en XMR y red Monero', JSON.stringify(vista));
    ok(/Al día/.test(vista.info) && vista.gas === 'none', 'dice «Al día» y oculta el gas de EVM', vista.info);
    ok(vista.etiqueta.startsWith(est.direccion.slice(0, 8)), 'la etiqueta del QR es la dirección de Monero', vista.etiqueta);
    const datos = await A.ev(`leerDatosXmr(currentWallet.address).then(d => d ? { k: d.keys.length, c: d.cache.length } : null)`);
    ok(datos && datos.k > 100 && datos.c > 1000, 'el estado de la billetera quedó guardado en el dispositivo', JSON.stringify(datos));
    const mem = await A.ev(`performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1`);
    console.log('   heap de la página después de sincronizar:', mem, 'MB');
    await captura(A, 'xmr-2-saldo');

    console.log('\n── recibir ──');
    await clic(A, '#receiveBtn');
    const rec = await A.ev(`({ dir: document.getElementById('receiveStandardAddress').textContent, visible: !document.getElementById('receiveModal').classList.contains('hidden'),
        qr: !!document.querySelector('#receiveStandardQr svg') })`);
    ok(rec.visible && rec.dir === est.direccion && rec.qr, 'Recibir muestra la dirección de Monero con su QR');
    await captura(A, 'xmr-3-recibir');
    await A.ev(`document.getElementById('receiveModal').classList.add('hidden'); true`);
    await clic(A, '#sendBtn');
    await sleep(500);
    ok(await A.ev(`/Mandar Monero/.test(document.getElementById('xmrModal')?.innerText || '') && document.getElementById('sendModal')?.classList.contains('hidden') !== false`), 'Enviar abre Mandar Monero (no el envío EVM)');
    await A.ev(`document.getElementById('xmrModal').remove(); true`);

    console.log('\n── las 25 palabras ──');
    await clic(A, '#xmrPalabrasBtn');
    await botonConTexto(A, 'Mostrar');
    const pal = await A.listo(`document.querySelectorAll('#xmrModal .xmr-palabras span').length`, 30);
    ok(pal === 25, 'muestra las 25 palabras', String(pal));
    ok(await A.ev(`document.getElementById('xmrModal').textContent.includes('${est.nacimiento}')`), 'y la altura de restauración');
    await captura(A, 'xmr-4-palabras');
    await A.ev(`document.getElementById('xmrModal').remove(); true`);

    console.log('\n── ajustes ──');
    await clic(A, '#xmrAjustesBtn');
    await A.ev(`(() => { const s = document.querySelector('#xmrModal select'); s.value = 'otro'; s.onchange(); document.querySelector('#xmrModal input[type=url]').value = 'ftp://x'; return true; })()`);
    await botonConTexto(A, 'Guardar');
    ok(await A.ev(`document.getElementById('xmrModal')?.textContent.includes('no es válida')`), 'rechaza un nodo inválido');
    await A.ev(`(() => { document.querySelector('#xmrModal select').value = 'https://node.sethforprivacy.com'; document.querySelector('#xmrModal input[type=checkbox]').checked = true; return true; })()`);
    await captura(A, 'xmr-5-ajustes');
    await botonConTexto(A, 'Guardar');
    ok(await A.ev(`localStorage.getItem(XMR_NODO_KEY) === 'https://node.sethforprivacy.com' && soloWifiXmr()`), 'guarda nodo y «solo con wifi»');
    await A.listo(`!xmrSincronizando`, 120);
    ok(await A.ev(`/Al día/.test(document.getElementById('xmrWalletEstado').textContent)`), 'con el otro nodo también se pone al día');

    console.log('\n── recargar y volver a EVM ──');
    await A.rpc('Page.navigate', { url: BASE });
    await A.listo(`window.currentWallet && currentWallet.address`, 60);
    ok(!!await A.listo(`document.body.classList.contains('red-xmr') && /XMR/.test(lastBalances.main || '')`, 30), 'al recargar sigue en Monero con el saldo guardado');
    await A.ev(`switchNetwork(0).then(() => true)`);
    const evm = await A.ev(`({ clase: document.body.classList.contains('red-xmr'), red: chainNameDisplay.textContent, info: getComputedStyle(document.getElementById('xmrWalletInfo')).display })`);
    ok(!evm.clase && evm.red !== 'Monero' && evm.info === 'none', 'al elegir una red EVM sale de Monero', JSON.stringify(evm));

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
