// E2E: StealthPay con la ChatWallet REAL por CW Connect v2 (XMTP de PRODUCCIÓN).
// Sirve ~/xunserver/stealthpay-app/src y la billetera de dist-cwconnect-test
// (./tests/run-cw-connect.sh la arma). Comprueba: QR v2 de sesión, «StealthPay» en la billetera,
// la firma que deriva la identidad stealth, la sesión guardada en v2, y que «Desconectar» en
// ChatWallet (bye) desconecte StealthPay. No se mueve plata.
//
//   unset NODE_OPTIONS; node tests/stealthpay-chatwallet-cdp.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SOBERANO = process.env.STEALTHPAY_SRC || path.join(os.homedir(), 'xunserver/stealthpay-app/src');
const BILLETERA = path.join(RAIZ, 'dist-cwconnect-test');
const P_MAIL = 8875, P_CW = 8856, CDP = 9475;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

// Servidor estático con aislamiento (XMTP lo pide en Soberano Mail).
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const servidor = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(SOBERANO, p);
    if (!f.startsWith(SOBERANO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream',
        'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
    fs.createReadStream(f).pipe(res);
}).listen(P_MAIL, '127.0.0.1');
const web = spawn('python3', ['-m', 'http.server', String(P_CW), '--bind', '127.0.0.1', '--directory', BILLETERA], { stdio: 'ignore' });

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'stealthpay-cw-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${CDP}`,
    `--user-data-dir=${perfil}`, '--window-size=500,900', 'about:blank'], { stdio: 'ignore' });

let ok = 0, mal = 0;
const chequear = (cond, txt) => { cond ? ok++ : mal++; console.log(`  ${cond ? '✓' : '✗'} ${txt}`); };

async function pestaña() {
    let lista;
    for (let i = 0; i < 50; i++) { try { lista = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); break; } catch { await dormir(200); } }
    const usadas = new Set(globalThis.__usadas || []);
    let t = lista.find(x => x.type === 'page' && !usadas.has(x.id));
    if (!t) t = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
    globalThis.__usadas = [...usadas, t.id];
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    let n = 0; const esperando = new Map();
    ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id && esperando.has(m.id)) { esperando.get(m.id)(m); esperando.delete(m.id); }
        if (m.method === 'Page.javascriptDialogOpening') {
            console.log('    (diálogo: ' + m.params.message.slice(0, 200) + ')');
            ws.send(JSON.stringify({ id: 999999 + Math.floor(Math.random() * 1e6), method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
        }
    };
    const rpc = (method, params = {}) => new Promise(r => { const id = ++n; esperando.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
    const evaluar = async (expr) => {
        const r = await Promise.race([rpc('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }),
            dormir(90000).then(() => ({ result: { exceptionDetails: { text: 'evaluate sin respuesta en 90 s: ' + expr.slice(0, 80) } } }))]);
        if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
        return r.result?.result?.value;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    return { rpc, evaluar };
}

try {
    if (!fs.existsSync(path.join(SOBERANO, 'js/cw-connect.js'))) throw new Error('falta ' + SOBERANO + '/js/cw-connect.js');
    if (!fs.existsSync(path.join(BILLETERA, 'dapp.html'))) throw new Error('falta dist-cwconnect-test (./tests/run-cw-connect.sh)');
    const llave = ethers.Wallet.createRandom();

    // ── la billetera ──
    const W = await pestaña();
    await W.rpc('Page.navigate', { url: `http://127.0.0.1:${P_CW}/dapp.html` });
    await dormir(2500);
    await W.evaluar(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(llave.privateKey)}); true`);
    await W.rpc('Page.reload');
    let listo = false;
    for (let i = 0; i < 200 && !listo; i++) { await dormir(1000); listo = await W.evaluar(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId)`).catch(() => false); }
    chequear(listo, 'la billetera real arranca' + (listo ? '' : ' — ' + await W.evaluar(`String(window.cwXmtpUltimoError || '')`).catch(e => e.message)));
    await W.evaluar(`window.__alertas = []; window.alert = m => { window.__alertas.push(String(m)); }; true`);

    // ── StealthPay ──
    const S = await pestaña();
    await S.rpc('Page.bringToFront');
    await S.rpc('Page.navigate', { url: `http://127.0.0.1:${P_MAIL}/` });
    await dormir(3000);
    await S.evaluar(`window.__uri = null; const _r = window.renderPairQR; window.renderPairQR = (u, a) => { window.__uri = u; return _r(u, a); }; true`);
    S.evaluar(`connectViaChatWallet()`).catch(() => {});
    let uri = null;
    for (let i = 0; i < 90 && !uri; i++) { await dormir(1000); uri = await S.evaluar(`window.__uri`); }
    const q = uri ? new URLSearchParams(uri.split('?')[1]) : new URLSearchParams();
    chequear(!!uri && q.get('v') === '2' && q.get('name') === 'StealthPay' && q.get('app') === '127.0.0.1' && q.get('kind') === 'session',
        'el QR es CW Connect v2 de sesión: ' + uri);
    if (!uri) throw new Error('sin QR no sigo');
    const inbox = q.get('inbox');

    await W.rpc('Page.bringToFront');
    W.evaluar(`handleScannedData(${JSON.stringify(uri)})`).catch(() => {});
    const aprobar = async (seg = 90) => {
        let txt = null;
        for (let i = 0; i < seg && !txt; i++) { await dormir(1000); txt = await W.evaluar(`document.getElementById('wc-body')?.textContent || null`); }
        if (txt) await W.evaluar(`document.getElementById('wc-yes').click(); true`);
        return txt || '';
    };
    const vincular = await aprobar();
    chequear(/«StealthPay»/.test(vincular) && /Queda conectada/.test(vincular), 'la billetera muestra «StealthPay» y que queda conectada');
    const firmaTxt = await aprobar(120);
    chequear(firmaTxt.length > 0, 'la billetera recibe el pedido de firma de StealthPay: ' + firmaTxt.slice(0, 80));

    let identidad = false;
    for (let i = 0; i < 120 && !identidad; i++) { await dormir(1000); identidad = await S.evaluar(`!!myIdentity`); }
    chequear(identidad, 'StealthPay deriva la identidad stealth con la firma de ChatWallet');
    const ses = await S.evaluar(`localStorage.getItem('stealthpay_wallet_session')`);
    chequear(JSON.parse(ses || '{}').v === 2, 'la sesión guardada recuerda v2: ' + ses?.slice(0, 80));
    const app = await W.evaluar(`JSON.parse(localStorage.getItem('chatwallet-wc-apps') || '{}')[${JSON.stringify(inbox)}] || null`);
    chequear(app?.name === 'StealthPay' && app?.v === 2 && app?.kind === 'session' && !app?.archivada, 'en la billetera: app «StealthPay» v2 de sesión, activa');
    chequear(!(await W.evaluar(`contacts.some(c => String(c.address).toLowerCase() === ${JSON.stringify(inbox)})`)), 'StealthPay no quedó como contacto');

    // «Desconectar» desde ChatWallet → bye → StealthPay se desconecta.
    await W.evaluar(`document.getElementById('settingsBtn').click(); true`);
    let boton = false;
    for (let i = 0; i < 20 && !boton; i++) { await dormir(1000); boton = await W.evaluar(`!!document.querySelector('#wcSessionsList [data-app="${inbox}"] button')`); }
    chequear(boton && /StealthPay/.test(await W.evaluar(`document.getElementById('wcSessionsList').textContent`)), 'Configuración → Apps conectadas lista StealthPay');
    if (boton) await W.evaluar(`document.querySelector('#wcSessionsList [data-app="${inbox}"] button').click(); true`);
    let fuera = false;
    for (let i = 0; i < 90 && !fuera; i++) { await dormir(1000); fuera = await S.evaluar(`!signer && !localStorage.getItem('stealthpay_wallet_session')`); }
    chequear(fuera, '«Desconectar» en ChatWallet desconecta StealthPay');
} catch (e) {
    mal++; console.log('  ✗ ' + e.message);
} finally {
    chrome.kill(); servidor.close(); web.kill();
    await dormir(800); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
}
console.log(mal ? `\n${mal} fallaron` : '\ntodo bien');
process.exit(mal ? 1 : 0);
