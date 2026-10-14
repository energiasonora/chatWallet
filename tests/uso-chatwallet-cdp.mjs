// E2E: entrar al panel de uso firmando con ChatWallet por QR (cw:1 sobre XMTP de PRODUCCIÓN).
// Una pestaña es el panel; la otra hace de ChatWallet con una wallet nueva: lee el QR, manda
// `connect` y contesta el personal_sign igual que dapp.html. El panel tiene que terminar adentro.
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
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && esperando.has(m.id)) { esperando.get(m.id)(m); esperando.delete(m.id); } };
    const rpc = (method, params = {}) => new Promise(r => { const id = ++n; esperando.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
    const evaluar = async (expr) => {
        const r = await rpc('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
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
    chequear(!!uri && /^chatwallet:\/\/wc\?inbox=0x[0-9a-f]{40}&chain=1&v=1$/.test(uri), 'aparece el enlace chatwallet://wc… ' + (uri || await panel.evaluar(`document.getElementById('cwEstado').textContent + ' / ' + document.getElementById('puertaError').textContent`)));
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
} catch (e) {
    mal++; console.log('  ✗ ' + e.message);
} finally {
    chrome.kill(); servidor.close();
    for (const c of copiados) fs.rmSync(c, { recursive: true, force: true });
    await dormir(800); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
}
console.log(mal ? `\n${mal} fallaron` : '\ntodo bien');
process.exit(mal ? 1 : 0);
