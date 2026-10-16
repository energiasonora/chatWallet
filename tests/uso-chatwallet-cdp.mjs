// E2E: entrar al panel de uso firmando con ChatWallet por QR (CW Connect sobre XMTP de PRODUCCIÓN).
// Una pestaña es el panel; la otra hace de ChatWallet VIEJA (v1: JSON en texto) con una wallet nueva:
// lee el QR, manda `connect` y contesta el personal_sign. El panel tiene que terminar adentro.
// Si existe dist-cwconnect-test/ (./tests/run-cw-connect.sh lo arma), una segunda vuelta usa la
// ChatWallet REAL: v2 con el tipo propio, entre el XMTP v5 del panel y el v6 de la billetera.
//
//   unset NODE_OPTIONS; node tests/uso-chatwallet-cdp.mjs
// Necesita el bundle XMTP de Soberano Mail en uso/js (lo copia solo) y Chrome.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const JS = path.join(RAIZ, 'uso/js');
const XMTP_JS = process.env.XMTP_JS || path.join(os.homedir(), 'xunserver/soberano-mail/public/js');
const PUERTO = 8871, CDP = 9471;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

// Lo que no es del repo se copia para la prueba y se borra al final.
const copiados = [];
for (const n of ['xmtp-bundle.js', 'assets']) {
    const dst = path.join(JS, n);
    if (!fs.existsSync(dst)) { fs.cpSync(path.join(XMTP_JS, n), dst, { recursive: true }); copiados.push(dst); }
}
// ethers para la pestaña que hace de ChatWallet.
const ayuda = path.join(JS, 'prueba-ethers.js'); copiados.push(ayuda);
const entrada = path.join(os.tmpdir(), 'prueba-ethers-entrada.mjs');
fs.writeFileSync(entrada, `export { Wallet } from '${path.join(RAIZ, 'node_modules/ethers/lib.esm/index.js')}';`);
execFileSync(path.join(os.homedir(), 'xunserver/soberano-mail/node_modules/.bin/esbuild'),
    [entrada, '--bundle', '--format=esm', '--minify', '--outfile=' + ayuda], { stdio: 'ignore' });

const llaveCw = ethers.Wallet.createRandom();
Object.assign(process.env, {
    USO_PORT: String(PUERTO), USO_ADMINS: llaveCw.address, USO_SECRET: 'x'.repeat(64),
    USO_POINTERS: '/nada', USO_RELAY_LEDGER: '/nada', USO_HISTORIAL: path.join(os.tmpdir(), 'uso-h.jsonl'),
    USO_UPLOAD_METRICS: 'http://127.0.0.1:1/', USO_NTFY_STATS: 'http://127.0.0.1:1/', USO_GITHUB_REPO: 'x/y',
});
const { app } = await import('../uso/uso-server.mjs');
const servidor = app.listen(PUERTO, '127.0.0.1');

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'uso-cw-'));
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
        // Un alert/confirm congela la página y CDP: se anota y se acepta.
        if (m.method === 'Page.javascriptDialogOpening') {
            console.log('    (diálogo: ' + m.params.message.slice(0, 200) + ')');
            ws.send(JSON.stringify({ id: 999999 + Math.floor(Math.random() * 1e6), method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
        }
        if (m.method === 'Inspector.targetCrashed') console.log('    (la pestaña se cayó)');
    };
    const rpc = (method, params = {}) => new Promise(r => { const id = ++n; esperando.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
    const evaluar = async (expr) => {
        const r = await Promise.race([rpc('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }),
            dormir(90000).then(() => ({ result: { exceptionDetails: { text: 'evaluate sin respuesta en 90 s: ' + expr.slice(0, 80) } } }))]);
        if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
        return r.result?.result?.value;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    return { rpc, evaluar, cerrar: () => ws.close() };
}

try {
    const panel = await pestaña();
    await panel.rpc('Page.navigate', { url: `http://127.0.0.1:${PUERTO}/` });
    await dormir(1500);
    chequear(await panel.evaluar(`!!document.getElementById('cwBtn') && !document.getElementById('puerta').hidden`), 'se ve «Entrar con ChatWallet»');
    chequear(await panel.evaluar('crossOriginIsolated'), 'la página está aislada (lo que pide XMTP)');
    await panel.evaluar(`document.getElementById('cwBtn').click()`);

    let uri = null;
    for (let i = 0; i < 90 && !uri; i++) { await dormir(1000); uri = await panel.evaluar(`document.getElementById('cwLink').hidden ? null : document.getElementById('cwLink').getAttribute('href')`); }
    chequear(!!uri && /^chatwallet:\/\/wc\?v=2&inbox=0x[0-9a-f]{40}&chain=1&name=Panel%20de%20uso&kind=once$/.test(uri), 'aparece el enlace chatwallet://wc… ' + (uri || await panel.evaluar(`document.getElementById('cwEstado').textContent + ' / ' + document.getElementById('puertaError').textContent`)));
    chequear(await panel.evaluar(`!!document.querySelector('#cwQr svg')`), 'se dibuja el QR');
    if (!uri) throw new Error('sin QR no sigo');
    const inbox = new URLSearchParams(uri.split('?')[1]).get('inbox');

    // ── la pestaña que hace de ChatWallet ──
    const cw = await pestaña();
    await cw.rpc('Page.navigate', { url: `http://127.0.0.1:${PUERTO}/js/prueba-ethers.js` });
    await dormir(800);
    await cw.evaluar(`(async () => {
        const { Wallet } = await import('/js/prueba-ethers.js');
        const { Client } = await import('/js/xmtp-bundle.js');
        const w = new Wallet(${JSON.stringify(llaveCw.privateKey)});
        const firmante = { type: 'EOA', getIdentifier: async () => ({ identifier: w.address.toLowerCase(), identifierKind: 'Ethereum' }),
            signMessage: async (m) => { const h = (await w.signMessage(m)).slice(2); return new Uint8Array(h.match(/.{2}/g).map(b => parseInt(b, 16))); } };
        const c = await Client.create(firmante, { env: 'production', dbEncryptionKey: crypto.getRandomValues(new Uint8Array(32)), appVersion: 'ChatWallet-Prueba/1' });
        await c.conversations.sync();
        const dm = await c.conversations.newDmWithIdentifier({ identifier: ${JSON.stringify(inbox)}, identifierKind: 'Ethereum' });
        window.__pedido = null;
        (async () => { const s = await c.conversations.streamAllMessages();
            for await (const m of s) {
                if (!m || m.senderInboxId === c.inboxId || typeof m.content !== 'string') continue;
                let d; try { d = JSON.parse(m.content); } catch { continue; }
                if (d.cw === 1 && d.type === 'rpc' && d.method === 'personal_sign') {
                    window.__pedido = d.params[0];
                    const sig = await w.signMessage(d.params[0]);
                    const conv = await c.conversations.getConversationById(m.conversationId);
                    await conv.send(JSON.stringify({ cw: 1, id: d.id, type: 'result', result: sig }));
                }
            } })();
        await dm.send(JSON.stringify({ cw: 1, type: 'connect', address: w.address, chainId: 1 }));
    })()`);

    let adentro = false;
    for (let i = 0; i < 120 && !adentro; i++) { await dormir(1000); adentro = await panel.evaluar(`!document.getElementById('panel').hidden`); }
    const pedido = await cw.evaluar('window.__pedido');
    chequear(/^chatwallet-panel:\d{13}$/.test(pedido || ''), 'ChatWallet recibe el pedido de firma: ' + pedido);
    chequear(adentro, 'el panel queda adentro con la firma de ChatWallet' + (adentro ? '' : ' — ' + await panel.evaluar(`document.getElementById('cwEstado').textContent + ' / ' + document.getElementById('puertaError').textContent`)));
    chequear(await panel.evaluar(`!!sessionStorage.getItem('cw-uso-sesion')`), 'la sesión queda guardada');

    // ── Segunda vuelta: la ChatWallet de verdad (v2) ──
    const DIST = path.join(RAIZ, 'dist-cwconnect-test');
    if (fs.existsSync(path.join(DIST, 'dapp.html'))) {
        console.log('  — con la ChatWallet real (v2) —');
        const web = spawn('python3', ['-m', 'http.server', '8854', '--bind', '127.0.0.1', '--directory', DIST], { stdio: 'ignore' });
        globalThis.__web = web;
        await dormir(1000);
        const W = await pestaña();
        await W.rpc('Page.bringToFront');
        await W.rpc('Page.navigate', { url: 'http://127.0.0.1:8854/dapp.html' });
        await dormir(2500);
        await W.evaluar(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(llaveCw.privateKey)}); true`);
        await W.rpc('Page.reload');
        let listo = false;
        for (let i = 0; i < 200 && !listo; i++) { await dormir(1000); listo = await W.evaluar(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId)`).catch(() => false); }
        chequear(listo, 'la billetera real arranca con la misma cuenta admin' + (listo ? '' : ' — ' + await W.evaluar(`String(window.cwXmtpUltimoError || '') + ' / ' + (document.getElementById('status')?.textContent || '')`)));

        await panel.evaluar(`sessionStorage.clear(); true`);
        await panel.rpc('Page.reload'); await dormir(2000);
        await panel.evaluar(`document.getElementById('cwBtn').click()`);
        let uri2 = null;
        for (let i = 0; i < 90 && !uri2; i++) { await dormir(1000); uri2 = await panel.evaluar(`document.getElementById('cwLink').hidden ? null : document.getElementById('cwLink').getAttribute('href')`); }
        const inbox2 = uri2 && new URLSearchParams(uri2.split('?')[1]).get('inbox');
        // Un alert() congela CDP: se anotan en vez de mostrarse.
        await W.evaluar(`window.__alertas = []; window.alert = m => { window.__alertas.push(String(m)); }; true`);
        W.evaluar(`handleScannedData(${JSON.stringify(uri2)})`).catch(() => {});
        const aprobar = async () => {
            let txt = null;
            for (let i = 0; i < 90 && !txt; i++) { await dormir(1000); txt = await W.evaluar(`document.getElementById('wc-body')?.textContent || null`); }
            if (txt) await W.evaluar(`document.getElementById('wc-yes').click(); true`);
            return txt || '';
        };
        const vincular = await aprobar();
        chequear(/«Panel de uso»/.test(vincular), 'la billetera muestra «Panel de uso» al vincular' + (vincular ? '' : ' — uri: ' + uri2 + ' / ' +
            await W.evaluar(`JSON.stringify({ alertas: window.__alertas, cw: typeof window.CwConnect, parse: window.CwConnect && window.CwConnect.leerUriVinculacion(${JSON.stringify(uri2)}), visible: document.visibilityState })`)));
        const firmaTxt = await aprobar();
        chequear(/chatwallet-panel:\d{13}/.test(firmaTxt), 'la billetera muestra el texto a firmar' + (firmaTxt ? '' : ' — ' +
            await W.evaluar(`JSON.stringify({ alertas: window.__alertas, ses: localStorage.getItem('chatwallet-wc-sessions') })`) + ' / panel: ' +
            await panel.evaluar(`document.getElementById('cwEstado').textContent + ' / ' + document.getElementById('puertaError').textContent`)));
        let adentro2 = false;
        for (let i = 0; i < 120 && !adentro2; i++) { await dormir(1000); adentro2 = await panel.evaluar(`!document.getElementById('panel').hidden`); }
        chequear(adentro2, 'el panel queda adentro con la ChatWallet real (v2, XMTP v5 ↔ v6)');
        let archivada = false;
        for (let i = 0; i < 60 && !archivada; i++) { await dormir(1000); archivada = await W.evaluar(`JSON.parse(localStorage.getItem('chatwallet-wc-apps') || '{}')[${JSON.stringify(inbox2)}]?.archivada === true`); }
        chequear(archivada, 'el panel cierra la sesión (bye) y la billetera la archiva');
        chequear(!(await W.evaluar(`contacts.some(c => String(c.address).toLowerCase() === ${JSON.stringify(inbox2)})`)), 'el panel no quedó como contacto');
    } else console.log('  (sin dist-cwconnect-test: no hay vuelta con la ChatWallet real)');
} catch (e) {
    mal++; console.log('  ✗ ' + e.message);
} finally {
    chrome.kill(); servidor.close(); try { globalThis.__web?.kill(); } catch {}
    for (const c of copiados) fs.rmSync(c, { recursive: true, force: true });
    await dormir(800); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
}
console.log(mal ? `\n${mal} fallaron` : '\ntodo bien');
process.exit(mal ? 1 : 0);
