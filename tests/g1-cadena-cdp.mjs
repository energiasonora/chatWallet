// La cadena Ğ1 REAL dentro de la página (el pedazo g1-cadena que arma Parcel), sin mandar
// nada: lee el saldo de una cuenta miembro y firma una transferencia en el navegador.
// Es lo que las otras pruebas de Ğ1 simulan. Necesita red.
// Correr:  BASE=https://chatwallet.org/dapp.html node tests/g1-cadena-cdp.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8849/dapp.html';
const PORT = 9407;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; };

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-g1cad-');
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map();
try {
    for (let i = 0; i < 200 && !ws; i++) {
        await sleep(300);
        try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = l.find(t => t.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch { }
    }
    if (!ws) throw new Error('Chrome no levantó');
    await new Promise((res, bad) => { ws.onopen = res; ws.onerror = bad; });
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const rpc = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => {
        const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error((ex.exception?.description || ex.text || '').slice(0, 400));
        return r.result?.result?.value;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.navigate', { url: BASE });
    for (let i = 0; i < 60; i++) { await sleep(500); try { if (await ev(`typeof window.cwCargarCadenaG1 === 'function'`)) break; } catch { } }
    const t0 = Date.now();
    const r = await ev(`(async () => {
        const C = await window.cwCargarCadenaG1();
        const B = await window.cwCargarBilleteraG1();
        const s = await C.saldo('g1K378tVb3YMtuLRCB7T63zQ22orBRdkmtrhzMsu81LRRaLxH');
        const cuenta = B.cuentaDeRaizHex(B.raizHex('bottom drive obey lake curtain smoke basket hold race lonely fit walk'), '');
        const { tx } = await C.prepararEnvio(cuenta, 'g1K378tVb3YMtuLRCB7T63zQ22orBRdkmtrhzMsu81LRRaLxH', 150, 'hola');
        return { saldo: s, de: cuenta.direccion, firmada: tx.isSigned, firmante: tx.signer.toString(), metodo: tx.method.toHex().slice(0, 6) };
    })()`);
    ok(r.saldo.saldo > 0 && Number.isInteger(r.saldo.pendiente), 'saldo real de una cuenta miembro, leído de la cadena', JSON.stringify(r.saldo));
    ok(r.firmada && r.firmante === r.de && r.de === 'g1LAN1C5rktuWS2giuZ7z1CydYKV2HQeH2rj8A6qY3CemwTVz', 'transferencia firmada en el navegador por la cuenta correcta');
    ok(r.metodo === '0x3602', 'es un batch_all (transferencia + comentario)');
    console.log(`   (${Date.now() - t0} ms, contando bajar el pedazo y conectar)`);
} finally {
    try { ws && ws.close(); } catch { }
    try { proc.kill('SIGKILL'); } catch { }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
}
console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
