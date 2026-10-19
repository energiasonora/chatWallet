// E2E: entrar a Soberano Mail con la ChatWallet REAL por CW Connect v2 (XMTP de PRODUCCIÓN).
// Sirve ~/xunserver/soberano-mail/dist (npx vite build allá) y la billetera de dist-cwconnect-test
// (./tests/run-cw-connect.sh la arma). El servidor de Soberano NO se toca: /auth/nonce y
// /auth/verify se contestan dentro de la página, y lo que se comprueba es que la firma que
// llega sea de la wallet, que la billetera muestre «Soberano Mail» y que la sesión se cierre.
//
//   unset NODE_OPTIONS; node tests/soberano-chatwallet-cdp.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SOBERANO = process.env.SOBERANO_DIST || path.join(os.homedir(), 'xunserver/soberano-mail/dist');
const BILLETERA = path.join(RAIZ, 'dist-cwconnect-test');
const P_MAIL = 8873, P_CW = 8855, CDP = 9473;
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

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'soberano-cw-'));
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
    if (!fs.existsSync(path.join(SOBERANO, 'lib/cw-connect.mjs'))) throw new Error('falta ' + SOBERANO + '/lib/cw-connect.mjs (¿vite build?)');
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
    chequear(listo, 'la billetera real arranca' + (listo ? '' : ' — ' + await W.evaluar(`String(window.cwXmtpUltimoError || '') + ' / ' + (document.getElementById('status')?.textContent || '')`).catch(e => e.message)));
    await W.evaluar(`window.__alertas = []; window.alert = m => { window.__alertas.push(String(m)); }; true`);

    // ── Soberano Mail ──
    const S = await pestaña();
    await S.rpc('Page.bringToFront');
    await S.rpc('Page.navigate', { url: `http://127.0.0.1:${P_MAIL}/` });
    await dormir(3000);
    chequear(await S.evaluar('crossOriginIsolated'), 'Soberano Mail queda aislado (lo que pide XMTP)');
    // El servidor de verdad no se toca: nonce fijo y la firma se guarda para revisarla.
    await S.evaluar(`(() => { const f = window.fetch.bind(window); window.__firma = null;
        window.fetch = async (u, o = {}) => { u = String(u);
            if (u.includes('/api/auth/nonce')) return new Response(JSON.stringify({ nonce: 'prueba-cw2' }), { status: 200, headers: { 'content-type': 'application/json' } });
            if (u.includes('/api/auth/verify')) { window.__firma = JSON.parse(o.body); return new Response(JSON.stringify({ error: 'prueba: no se crea sesión' }), { status: 403, headers: { 'content-type': 'application/json' } }); }
            return f(u, o); }; return true; })()`);
    await S.evaluar(`startChatWalletLogin(); true`);
    let uri = null;
    for (let i = 0; i < 90 && !uri; i++) { await dormir(1000); uri = await S.evaluar(`document.querySelector('.cw-sc-phone')?.getAttribute('href') || null`); }
    const q = uri ? new URLSearchParams(uri.split('?')[1]) : new URLSearchParams();
    chequear(!!uri && q.get('v') === '2' && q.get('name') === 'Soberano Mail' && q.get('app') === '127.0.0.1' && q.get('kind') === 'once',
        'el QR es CW Connect v2 con nombre, dominio y un solo uso: ' + (uri || await S.evaluar(`document.getElementById('xmtp-status').textContent`)));
    const link = await S.evaluar(`document.querySelector('.cw-sin-camara a.web3-btn')?.getAttribute('href') || ''`);
    chequear(link.startsWith('https://chatwallet.org/dapp?wc=1&v=2&') && link.includes('name=Soberano'), 'el link «sin cámara» lleva los mismos datos');
    chequear(/CWW2\|0x[0-9a-f]{40}\|1/.test(await S.evaluar(`document.querySelector('.cw-sc-code')?.textContent || ''`)), 'el código corto es CWW2');
    if (!uri) throw new Error('sin QR no sigo');
    const inbox = q.get('inbox');

    await W.rpc('Page.bringToFront');
    W.evaluar(`handleScannedData(${JSON.stringify(uri)})`).catch(() => {});
    const aprobar = async () => {
        let txt = null;
        for (let i = 0; i < 90 && !txt; i++) { await dormir(1000); txt = await W.evaluar(`document.getElementById('wc-body')?.textContent || null`); }
        if (txt) await W.evaluar(`document.getElementById('wc-yes').click(); true`);
        return txt || '';
    };
    const vincular = await aprobar();
    chequear(/«Soberano Mail»/.test(vincular), 'la billetera muestra «Soberano Mail» al vincular' + (vincular ? '' : ' — ' + await W.evaluar(`JSON.stringify(window.__alertas)`)));
    const firmaTxt = await aprobar();
    chequear(/Soberano Mail Login/.test(firmaTxt) && /prueba-cw2/.test(firmaTxt), 'la billetera muestra el texto a firmar');

    let firma = null;
    for (let i = 0; i < 120 && !firma; i++) { await dormir(1000); firma = await S.evaluar(`window.__firma`); }
    const firmante = firma && ethers.verifyMessage('Soberano Mail Login\nNonce: prueba-cw2', firma.signature);
    chequear(!!firma && firmante === llave.address && ethers.getAddress(firma.address) === llave.address, 'a Soberano Mail le llega la firma de la wallet');

    let archivada = false;
    for (let i = 0; i < 60 && !archivada; i++) { await dormir(1000); archivada = await W.evaluar(`JSON.parse(localStorage.getItem('chatwallet-wc-apps') || '{}')[${JSON.stringify(inbox)}]?.archivada === true`); }
    chequear(archivada, 'Soberano Mail cierra la sesión (bye) y la billetera la archiva');
    const app = await W.evaluar(`JSON.parse(localStorage.getItem('chatwallet-wc-apps') || '{}')[${JSON.stringify(inbox)}] || null`);
    chequear(app?.name === 'Soberano Mail' && app?.v === 2, 'queda registrada como app «Soberano Mail» (v2)');
    chequear(!(await W.evaluar(`contacts.some(c => String(c.address).toLowerCase() === ${JSON.stringify(inbox)})`)), 'Soberano Mail no quedó como contacto');
} catch (e) {
    mal++; console.log('  ✗ ' + e.message);
} finally {
    chrome.kill(); servidor.close(); web.kill();
    await dormir(800); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
}
console.log(mal ? `\n${mal} fallaron` : '\ntodo bien');
process.exit(mal ? 1 : 0);
