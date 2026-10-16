// Diagnóstico: ¿un cliente XMTP v5 (el bundle de Soberano Mail, el que usa el panel) recibe un
// mensaje con el tipo chatwallet.org/cw que manda la billetera (v6)?   node tests/cw-v5-interop-cdp.mjs
// Necesita dist-cwconnect-test (./tests/run-cw-connect.sh) y el bundle XMTP en uso/js (lo copia).
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { ethers } from 'ethers';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const JS = path.join(RAIZ, 'uso/js');
const XMTP_JS = path.join(os.homedir(), 'xunserver/soberano-mail/public/js');
const dormir = ms => new Promise(r => setTimeout(r, ms));
const copiados = [];
for (const n of ['xmtp-bundle.js', 'assets']) { const d = path.join(JS, n); if (!fs.existsSync(d)) { fs.cpSync(path.join(XMTP_JS, n), d, { recursive: true }); copiados.push(d); } }
const ayuda = path.join(JS, 'prueba-ethers.js'); copiados.push(ayuda);
const entrada = path.join(os.tmpdir(), 'prueba-ethers-v5.mjs');
fs.writeFileSync(entrada, `export { Wallet } from '${path.join(RAIZ, 'node_modules/ethers/lib.esm/index.js')}';`);
execFileSync(path.join(os.homedir(), 'xunserver/soberano-mail/node_modules/.bin/esbuild'), [entrada, '--bundle', '--format=esm', '--minify', '--outfile=' + ayuda], { stdio: 'ignore' });
const cwmod = path.join(JS, 'cw-connect.mjs'); fs.copyFileSync(path.join(RAIZ, 'cw-connect/cw-connect.mjs'), cwmod); copiados.push(cwmod);
Object.assign(process.env, { USO_PORT: '8872', USO_ADMINS: ethers.ZeroAddress, USO_SECRET: 'x'.repeat(64), USO_POINTERS: '/nada', USO_RELAY_LEDGER: '/nada',
    USO_HISTORIAL: path.join(os.tmpdir(), 'uso-h2.jsonl'), USO_UPLOAD_METRICS: 'http://127.0.0.1:1/', USO_NTFY_STATS: 'http://127.0.0.1:1/', USO_GITHUB_REPO: 'x/y' });
const { app } = await import('../uso/uso-server.mjs');
const srv = app.listen(8872, '127.0.0.1');
const web = spawn('python3', ['-m', 'http.server', '8855', '--bind', '127.0.0.1', '--directory', path.join(RAIZ, 'dist-cwconnect-test')], { stdio: 'ignore' });
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT = 9542;
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'v5-'));
const pr = spawn(CH, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });
async function tab(url) {
    let t; for (let i = 0; i < 40 && !t; i++) { await dormir(500); try { t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json(); } catch { } }
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let n = 0; const p = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
    const rpc = (method, params = {}) => new Promise(r => { const id = ++n; p.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
    await rpc('Runtime.enable');
    return async e => { const r = await rpc('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).slice(0, 500); return r.result?.result?.value; };
}
try {
    const P = await tab('http://127.0.0.1:8872/'); await dormir(2000);
    const k5 = ethers.Wallet.createRandom();
    console.log('v5 arranca:', await P(`(async () => {
        const { Wallet } = await import('/js/prueba-ethers.js'); const { Client } = await import('/js/xmtp-bundle.js'); const Cw = await import('/js/cw-connect.mjs');
        const w = new Wallet(${JSON.stringify(k5.privateKey)});
        const f = { type: 'EOA', getIdentifier: async () => ({ identifier: w.address.toLowerCase(), identifierKind: 'Ethereum' }),
            signMessage: async (m) => { const h = (await w.signMessage(m)).slice(2); return new Uint8Array(h.match(/.{2}/g).map(b => parseInt(b, 16))); } };
        const c = await Client.create(f, { env: 'production', dbEncryptionKey: crypto.getRandomValues(new Uint8Array(32)), codecs: [new Cw.CwCodec()] });
        window.__c = c; window.__Cw = Cw; window.__vistos = [];
        await c.conversations.sync();
        const s = await c.conversations.streamAllMessages();
        (async () => { for await (const m of s) { if (!m) continue; window.__vistos.push({ conv: m.conversationId, ct: m.contentType && { a: m.contentType.authorityId, t: m.contentType.typeId, M: m.contentType.versionMajor }, tipo: typeof m.content, content: m.content, fb: m.fallback, enc: !!m.encodedContent, leido: Cw.leerMensaje(m) }); } })();
        return c.inboxId;
    })()`));
    const W = await tab('http://127.0.0.1:8855/dapp.html'); await dormir(3000);
    await W(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(ethers.Wallet.createRandom().privateKey)}); location.reload(); true`);
    let ok = false; for (let i = 0; i < 200 && !ok; i++) { await dormir(1000); ok = await W(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId)`); }
    console.log('v6 lista:', ok);
    console.log('envío:', await W(`(async () => { const dm = await chatwalletxmtp.conversations.createDmWithIdentifier({ identifier: ${JSON.stringify(k5.address.toLowerCase())}, identifierKind: 0 });
        await CwConnect.enviar(dm, { cw: 1, type: 'connect', v: 2, address: currentWallet.address, chainId: 1 }, 2);
        await dm.sendText('texto de control'); return 'ok'; })()`));
    for (let i = 0; i < 40; i++) { await dormir(1000); const v = await P(`window.__vistos.length`); if (v >= 2) break; }
    console.log('v5 vio:', JSON.stringify(await P(`window.__vistos`), null, 1).slice(0, 3000));
    console.log('v5 → v6 (tipo propio):', await P(`(async () => { await __c.conversations.sync(); const cs = await __c.conversations.list();
        const dm = cs.find(x => x.id === window.__vistos[0]?.conv) || cs[cs.length - 1];
        await __Cw.enviar(dm, { cw: 1, type: 'rpc', id: 'x1', method: 'personal_sign', params: ['hola desde v5', '0x0'] }, 2); return 'enviado'; })()`));
    let llego = null;
    for (let i = 0; i < 40 && !llego; i++) { await dormir(1000); llego = await W(`(async () => { const cs = await chatwalletxmtp.conversations.list(); for (const c of cs) { await c.sync(); for (const m of await c.messages()) { const p = CwConnect.leerMensaje(m); if (p && p.m.id === 'x1') return JSON.stringify(p); } } return null; })()`); }
    console.log('v6 recibió:', llego);
    console.log('v5 lista del DM:', await P(`(async () => { await __c.conversations.sync(); const cs = await __c.conversations.list(); const out = [];
        for (const cv of cs) { await cv.sync(); for (const m of await cv.messages()) out.push({ t: m.contentType?.typeId, tipo: typeof m.content, leido: !!__Cw.leerMensaje(m) }); } return JSON.stringify(out); })()`));
} finally {
    pr.kill(); web.kill(); srv.close();
    for (const c of copiados) fs.rmSync(c, { recursive: true, force: true });
}
